#!/usr/bin/env node

/**
 * Context Source Monitor test suite.
 *
 * Covers the invariants the implementation depends on:
 *   - line counting with/without a trailing newline; interval algebra
 *   - node identity: file scope (path-only, survives content edits) vs. span
 *     scope (path + occurrence + content, survives line drift)
 *   - the edge state machine: hint -> confirmed -> needs-reconfirm
 *   - reconcile: relocate what moved, demote what changed, retire what vanished,
 *     re-parent onto bounding spans, coalesce rival descriptions
 *   - nothing is ever deleted by hash: the archive, and resurrection
 *   - reference resolution to REAL files only; generic fan-out is dropped
 *   - content overlap on small source sets
 *   - the ignored-paths list (influence-only, distinct from .gitignore)
 *   - infer: content-driven provenance and retired re-investigation
 *   - plugin hook wiring with the real (input, output) signatures
 *   - state persistence round-trip
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  splitLines,
  countLinesInText,
  statLines,
  mergeIntervals,
  invertIntervals,
  intersectIntervals,
  countIntervalLines,
  linesToIntervals,
  hashText,
  hashInterval,
  sliceLines,
  contentSignal,
  findBlockOccurrences,
  boundingInterval,
  intervalsTouch,
} from "../scripts/context_source_monitor/text.mjs";
import { IgnoreRules, walkFiles } from "../scripts/context_source_monitor/ignore.mjs";
import { parseStructure, isProbablyBinary } from "../scripts/context_source_monitor/structure.mjs";
import { extractReads, extractWrites, stripHeredocs } from "../scripts/context_source_monitor/terminal.mjs";
import {
  InfluenceGraph,
  GraphArchive,
  EDGE_STATES,
  NODE_SCOPES,
  RETIRE_REASONS,
  NEEDS_RECONFIRM_CEILING,
  MIN_SPAN_SIGNAL,
  fileNodeId,
  spanNodeId,
  describeOccurrence,
  relocateSpan,
  widenToSignal,
} from "../scripts/context_source_monitor/graph.mjs";
import { WorkspaceIndex } from "../scripts/context_source_monitor/resolve.mjs";
import { ShingleIndex, tokenize } from "../scripts/context_source_monitor/overlap.mjs";
import { GENERIC_FANOUT_THRESHOLD, disclaimsDerivation } from "../scripts/context_source_monitor/detectors.mjs";
import {
  ContextSourceMonitorEngine,
  ARTIFACT_DIR,
  clusterStaleNodes,
  coalesceDuplicateHints,
} from "../scripts/context_source_monitor/engine.mjs";
import {
  parseReadOutputInterval,
  ContextSourceMonitorPlugin,
  resetEngineCache,
} from "../scripts/opencode-plugin.ts";

let passed = 0;
let failed = 0;
const failures = [];
/** Registered work: groups and checks, executed sequentially so async checks are awaited. */
const queue = [];

function check(name, fn) {
  queue.push({ type: "check", name, fn });
}

function group(title, fn) {
  queue.push({ type: "group", title });
  fn();
}

async function runQueue() {
  for (const item of queue) {
    if (item.type === "group") {
      process.stdout.write(`\n${item.title}\n`);
      continue;
    }
    try {
      await item.fn();
      passed++;
      process.stdout.write(`  ok   ${item.name}\n`);
    } catch (error) {
      failed++;
      failures.push({ name: item.name, error });
      process.stdout.write(`  FAIL ${item.name}\n         ${error.message}\n`);
    }
  }
}

function readIfExists(rel) {
  try {
    return fs.readFileSync(path.join(workspace, rel), "utf8");
  } catch {
    return "";
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "assertion failed");
}

function equal(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${message || "not equal"}: got ${a}, expected ${b}`);
}

// ---------------------------------------------------------------------------

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "csm-test-"));

function write(relPath, content) {
  const abs = path.join(workspace, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf8");
  return abs;
}

write("docs/spec.md", [
  "# L3VPN specification",
  "",
  "## VRF requirements",
  "Each service instance must allocate a distinct route distinguisher per tenant edge.",
  "The provisioning pipeline validates the route target import and export policy set.",
  "",
  "## QoS requirements",
  "Ingress classification maps DSCP values onto forwarding classes before queueing.",
  "",
].join("\n"));

write("docs/notes.md", [
  "# Implementation notes",
  "",
  "Derived from `docs/spec.md` and the diagram at ./diagram.svg.",
  "",
  "## Route distinguisher handling",
  "Each service instance must allocate a distinct route distinguisher per tenant edge.",
  "The provisioning pipeline validates the route target import and export policy set.",
  "",
  "## Unrelated section",
  "Operational runbooks live elsewhere; see missing/file.md for details.",
  "",
].join("\n"));

write("docs/other.md", [
  "# A second, unrelated target",
  "",
  "## Also derived from the spec",
  "See `docs/spec.md` for the source.",
  "Each service instance must allocate a distinct route distinguisher per tenant edge.",
  "The provisioning pipeline validates the route target import and export policy set.",
  "",
].join("\n"));

write("src/service.ts", [
  "import { helper } from './helper';",
  "",
  "export class L3vpnService {",
  "  provision(id: string) {",
  "    const label = `rd-${id}`;",
  "    return helper(label);",
  "  }",
  "}",
  "",
].join("\n"));

write("src/helper.ts", "export function helper(x: string) {\n  return x;\n}\n");
write(".gitignore", "build/\n*.log\n# a comment\n!keep.log\ngenerated/\n");
write("build/generated.md", "# generated\ncontent\n");
write("generated/output.md", "# also generated, gitignore-only (not a HARD_IGNORES name)\n");
write("debug.log", "noise\n");
write("keep.log", "kept\n");
write("bin/blob.bin", Buffer.from([0x00, 0x01, 0x02, 0x00, 0xff]).toString("binary"));

// ---------------------------------------------------------------------------

group("text: line counting", () => {
  check("trailing newline does not create a phantom line", () => {
    equal(countLinesInText("a\nb\nc\n"), 3);
    equal(splitLines("a\nb\nc\n"), ["a", "b", "c"]);
  });
  check("missing trailing newline still counts the last line", () => {
    equal(countLinesInText("a\nb\nc"), 3);
  });
  check("CRLF and lone CR are handled", () => {
    equal(countLinesInText("a\r\nb\r\n"), 2);
    equal(countLinesInText("a\rb"), 2);
  });
  check("empty content has zero lines", () => {
    equal(countLinesInText(""), 0);
  });
  check("statLines matches countLinesInText on disk", () => {
    const abs = write("tmp/count.txt", "one\ntwo\nthree\n");
    equal(statLines(abs).lines, 3, "with trailing newline");
    const abs2 = write("tmp/count2.txt", "one\ntwo\nthree");
    equal(statLines(abs2).lines, 3, "without trailing newline");
  });
  check("100% coverage is reachable (the off-by-one regression)", () => {
    const abs = write("tmp/full.md", "l1\nl2\nl3\nl4\n");
    const total = statLines(abs).lines;
    equal(invertIntervals(total, [{ start: 1, end: total }]), []);
  });
});

group("text: interval algebra", () => {
  check("adjacent intervals merge", () => {
    equal(mergeIntervals([{ start: 1, end: 5 }, { start: 6, end: 9 }]), [{ start: 1, end: 9 }]);
  });
  check("disjoint intervals stay separate", () => {
    equal(mergeIntervals([{ start: 1, end: 3 }, { start: 7, end: 9 }]), [
      { start: 1, end: 3 },
      { start: 7, end: 9 },
    ]);
  });
  check("invalid intervals are dropped", () => {
    equal(mergeIntervals([{ start: 5, end: 1 }, null, { start: 0, end: 0 }]), []);
  });
  check("invert produces the exact complement", () => {
    equal(invertIntervals(10, [{ start: 3, end: 4 }, { start: 8, end: 8 }]), [
      { start: 1, end: 2 },
      { start: 5, end: 7 },
      { start: 9, end: 10 },
    ]);
  });
  check("invert of nothing is the whole file", () => {
    equal(invertIntervals(4, []), [{ start: 1, end: 4 }]);
  });
  check("reads beyond EOF are clamped", () => {
    equal(invertIntervals(5, [{ start: 1, end: 9999 }]), []);
  });
  check("intersect finds the shared span", () => {
    equal(intersectIntervals([{ start: 1, end: 10 }], [{ start: 5, end: 20 }]), [{ start: 5, end: 10 }]);
  });
  check("countIntervalLines does not double count overlaps", () => {
    equal(countIntervalLines([{ start: 1, end: 5 }, { start: 3, end: 7 }]), 7);
  });
  check("linesToIntervals groups with tolerance", () => {
    equal(linesToIntervals([1, 2, 3, 10, 11], 1), [
      { start: 1, end: 3 },
      { start: 10, end: 11 },
    ]);
  });
});

group("text: content hashing", () => {
  check("hashText is deterministic and content-sensitive", () => {
    equal(hashText("abc"), hashText("abc"));
    assert(hashText("abc") !== hashText("abd"), "different content must hash differently");
  });
  check("hashInterval with no interval hashes the whole file", () => {
    const content = "l1\nl2\nl3\n";
    equal(hashInterval(content), hashText(content));
  });
  check("hashInterval scopes to exactly the given lines", () => {
    const content = "l1\nl2\nl3\nl4\n";
    const first = hashInterval(content, { start: 1, end: 2 });
    const last = hashInterval(content, { start: 3, end: 4 });
    assert(first !== last, "different spans must hash differently");
  });
  check("hashInterval is stable across an edit OUTSIDE its own span", () => {
    const before = hashInterval("a\nb\nTARGET\nc\n", { start: 3, end: 3 });
    const after = hashInterval("a\nCHANGED\nTARGET\nc\n", { start: 3, end: 3 });
    equal(before, after, "editing line 2 must not dirty a hash scoped to line 3");
  });
  check("sliceLines(content) with no interval equals the whole file rejoined", () => {
    equal(sliceLines("a\nb\nc\n"), "a\nb\nc"); // note: no trailing newline -- see the regression this guards below
  });
  check("whole-file interval and no-interval slice must agree (the trailing-newline regression)", () => {
    // A node created from a raw whole-file string vs. one created via
    // sliceLines(content, {1, totalLines}) must hash identically, or the
    // "same" (path, interval) gets two different ids depending on which
    // code path created it -- this broke confirm/reconcile round-tripping.
    const content = "a\nb\nc\n"; // trailing newline: the common case
    const total = splitLines(content).length;
    equal(sliceLines(content, { start: 1, end: total }), sliceLines(content));
  });
});

group("discovery: gitignore and binaries", () => {
  check("inline comments do not break patterns (git's real trap)", () => {
    const rules = new IgnoreRules().addPatterns([".cache/   # tool cache"]);
    assert(rules.isIgnored(".cache", true), "directory should be ignored");
    assert(rules.isIgnored(".cache/x.json", false), "contents should be ignored");
  });
  check("negation re-includes", () => {
    const rules = new IgnoreRules().addPatterns(["*.log", "!keep.log"]);
    assert(rules.isIgnored("debug.log", false));
    assert(!rules.isIgnored("keep.log", false));
  });
  check("anchored patterns do not match nested paths", () => {
    const rules = new IgnoreRules().addPatterns(["/build/"]);
    assert(rules.isIgnored("build/x", false));
    assert(!rules.isIgnored("src/build/x", false));
  });
  check("walkFiles honors .gitignore", () => {
    const found = walkFiles({ workspace }).map((f) => f.relPath);
    assert(!found.includes("build/generated.md"), "build/ must be ignored");
    assert(!found.includes("debug.log"), "*.log must be ignored");
    assert(found.includes("keep.log"), "negation must re-include keep.log");
    assert(found.includes("docs/spec.md"));
  });
  check("binary files are detected", () => {
    assert(isProbablyBinary(path.join(workspace, "bin/blob.bin")), "null bytes => binary");
    assert(!isProbablyBinary(path.join(workspace, "docs/spec.md")), "markdown => text");
  });
});

group("discovery: ignored-list capture (walk-level, .gitignore-driven)", () => {
  check("matchRule reports which line decided the verdict", () => {
    const rules = new IgnoreRules().addPatterns(["*.log", "!keep.log"]);
    equal(rules.matchRule("debug.log", false), { ignored: true, rule: "*.log", matched: true });
    equal(rules.matchRule("keep.log", false).ignored, false);
    // `matched` separates "a negation re-included this" from "no rule mentioned it".
    // Both say ignored:false, and an override layer cannot compose them without this.
    equal(rules.matchRule("keep.log", false).matched, true);
    equal(rules.matchRule("untouched.txt", false), { ignored: false, rule: null, matched: false });
  });
  check("extraIgnores override every .gitignore, in both directions", () => {
    // The override layer must outrank a directory's own .gitignore, including the
    // workspace root's -- which the walk re-loads on the way in. Appending these
    // patterns to the same rule set silently lost to the root file at the first level.
    const reIncluded = walkFiles({ workspace, extraIgnores: ["!generated/"] }).map((f) => f.relPath);
    assert(
      reIncluded.some((p) => p.startsWith("generated/")),
      `a negation must re-include a gitignored tree, got: ${reIncluded.join(", ")}`,
    );
    const excluded = walkFiles({ workspace, extraIgnores: ["*.md"] }).map((f) => f.relPath);
    assert(!excluded.some((p) => p.endsWith(".md")), "an extra ignore must still exclude");
    // HARD_IGNORES is never overridable.
    const hard = walkFiles({ workspace, extraIgnores: ["!node_modules/", "!.git/"] }).map((f) => f.relPath);
    assert(
      !hard.some((p) => p.startsWith("node_modules/") || p.startsWith(".git/")),
      "hard ignores must survive an explicit negation",
    );
  });
  check("walkFiles reports gitignored entries with the matching rule, once each", () => {
    const sink = [];
    walkFiles({ workspace, ignoredSink: sink });
    const byPath = Object.fromEntries(sink.map((e) => [e.path, e]));
    // "build" collides with a HARD_IGNORES name too, so it is reported as hard-ignore
    // (checked below) -- "generated" is gitignore-only, so it proves the gitignore path.
    equal(byPath["generated"], { path: "generated", kind: "directory", reason: "gitignore", rule: "generated/" });
    equal(byPath["debug.log"], { path: "debug.log", kind: "file", reason: "gitignore", rule: "*.log" });
    assert(!("keep.log" in byPath), "a negated pattern must not be reported as ignored");
    assert(!("generated/output.md" in byPath), "a skipped directory is never descended into, so its contents are never listed");
  });
  check("hard ignores are reported once, not descended into", () => {
    write("node_modules/pkg/index.js", "export default 1;\n");
    const sink = [];
    const files = walkFiles({ workspace, ignoredSink: sink });
    assert(!files.some((f) => f.relPath.startsWith("node_modules/")), "hard-ignored dir must not be walked");
    const entry = sink.find((e) => e.path === "node_modules");
    equal(entry, { path: "node_modules", kind: "directory", reason: "hard-ignore", rule: null });
  });
  check("without a sink, walking is unaffected (the sink is opt-in)", () => {
    equal(walkFiles({ workspace }).some((f) => f.relPath === "docs/spec.md"), true);
  });
});

group("structure parsing", () => {
  check("markdown headings get correct spans", () => {
    const blocks = parseStructure("docs/spec.md", fs.readFileSync(path.join(workspace, "docs/spec.md"), "utf8"));
    const vrf = blocks.find((b) => b.name === "## VRF requirements");
    assert(vrf, "VRF heading not found");
    equal([vrf.startLine, vrf.endLine], [3, 6], "VRF section span");
  });
  check("code fences are not mistaken for headings", () => {
    const blocks = parseStructure("x.md", "# T\n\n```md\n# not a heading\n```\n");
    equal(blocks.filter((b) => b.kind === "heading").length, 1);
    equal(blocks.filter((b) => b.kind === "code_block").length, 1);
  });
  check("braces inside strings do not break class spans", () => {
    const blocks = parseStructure("src/service.ts", fs.readFileSync(path.join(workspace, "src/service.ts"), "utf8"));
    const cls = blocks.find((b) => b.name === "class L3vpnService");
    assert(cls, "class not found");
    equal([cls.startLine, cls.endLine], [3, 8], "class span");
    assert(blocks.some((b) => b.name === "method provision()"), "method not found");
  });
  check("control-flow keywords are not methods", () => {
    const blocks = parseStructure("a.ts", "function f() {\n  if (x) {\n    y();\n  }\n}\n");
    equal(blocks.filter((b) => b.kind === "method").length, 0);
  });
  check("python blocks end at dedent", () => {
    const blocks = parseStructure("a.py", "class A:\n    def m(self):\n        pass\n\nx = 1\n");
    const cls = blocks.find((b) => b.name === "class A");
    equal([cls.startLine, cls.endLine], [1, 3]);
  });
});

group("terminal fallback parsing", () => {
  check("head -n N yields an offset/limit read", () => {
    const reads = extractReads("head -n 20 docs/spec.md", workspace);
    equal(reads.length, 1);
    equal([reads[0].offset ?? 1, reads[0].limit], [1, 20]);
  });
  check("sed range yields the exact interval", () => {
    const reads = extractReads("sed -n '10,25p' docs/spec.md", workspace);
    equal([reads[0].offset, reads[0].limit], [10, 16]);
  });
  check("nonexistent paths are not invented", () => {
    equal(extractReads("cat nope/missing.md", workspace).length, 0);
  });
  check("sed expressions are not treated as files", () => {
    const writes = extractWrites("sed -i 's/a\\/b/c/' docs/spec.md", workspace);
    equal(writes.map((w) => w.filePath), ["docs/spec.md"]);
  });
  check("redirects are captured with append semantics", () => {
    const writes = extractWrites("echo hi >> out/log.txt", workspace);
    equal([writes[0].filePath, writes[0].append], ["out/log.txt", true]);
  });
  check("/dev/null and 2>&1 are not files", () => {
    equal(extractWrites("cmd > /dev/null 2>&1", workspace).length, 0);
  });
  check("pipelines are split and both sides parsed", () => {
    const reads = extractReads("cat docs/spec.md | grep -n rd && tail -5 docs/notes.md", workspace);
    const files = reads.map((r) => r.filePath).sort();
    equal(files, ["docs/notes.md", "docs/spec.md"]);
  });
  check("quoted filenames with spaces survive tokenization", () => {
    write("docs/with space.md", "x\n");
    const reads = extractReads('cat "docs/with space.md"', workspace);
    equal(reads.map((r) => r.filePath), ["docs/with space.md"]);
  });
  check("JS arrow functions in an inline `node -e` script are not shell redirects", () => {
    // `=>` contains a bare `>` -- the exact pattern that used to fabricate a
    // write to a file named after whatever followed the arrow.
    const script = 'node -e "sourceFiles.filter(isDirty).map(f => f.relPath)"';
    equal(extractWrites(script, workspace), []);
    equal(extractReads(script, workspace), []);
  });
  check("comparison operators >= and <= are not misread as redirects", () => {
    equal(extractWrites('node -e "if (a >= b) console.log(1)"', workspace), []);
    equal(extractReads('node -e "if (a <= b) console.log(1)"', workspace), []);
  });
});

group("text: span primitives", () => {
  check("contentSignal counts only non-whitespace", () => {
    equal(contentSignal("  \n\t "), 0);
    equal(contentSignal("abc def"), 6);
  });
  check("findBlockOccurrences finds every verbatim repeat", () => {
    const file = ["a", "x", "y", "b", "x", "y", "c"];
    equal(findBlockOccurrences(file, ["x", "y"]), [2, 5]);
  });
  check("findBlockOccurrences returns nothing when the text is absent", () => {
    equal(findBlockOccurrences(["a", "b"], ["z"]), []);
  });
  check("boundingInterval spans every input", () => {
    equal(boundingInterval([{ start: 5, end: 7 }, { start: 2, end: 3 }]), { start: 2, end: 7 });
  });
  check("intervalsTouch treats adjacency as touching", () => {
    assert(intervalsTouch({ start: 1, end: 5 }, { start: 6, end: 9 }));
    assert(!intervalsTouch({ start: 1, end: 5 }, { start: 8, end: 9 }));
  });
});

group("graph: node identity", () => {
  const doc = [
    "# Title",
    "",
    "A distinctive paragraph about route distinguishers and tenant edges.",
    "",
    "A distinctive paragraph about route distinguishers and tenant edges.",
    "",
  ].join("\n");

  check("a file node's identity is path-only, so a content edit cannot change it", () => {
    // The whole point: editing a corpus file must not re-identify it and mass-archive its edges.
    equal(fileNodeId("data/corpus/a.md"), fileNodeId("data/corpus/a.md"));
    const graph = new InfluenceGraph();
    const first = graph.ensureFileNode("a.md", { content: "one\n" });
    const second = graph.ensureFileNode("a.md", { content: "totally different\n" });
    equal(first.id, second.id, "same file, same identity");
    equal(graph.nodes.size, 1);
    assert(second.contentHash === hashText("totally different\n"), "but the tracked hash must follow the content");
  });

  check("different paths never collide", () => {
    assert(fileNodeId("a.md") !== fileNodeId("b.md"));
    assert(spanNodeId("a.md", "same text", 0) !== spanNodeId("b.md", "same text", 0));
  });

  check("identical text at two places in ONE file gets two identities (the collapse bug)", () => {
    // Without the occurrence index these two would be the same node, and edges
    // from unrelated sources would silently merge onto whichever won last.
    const graph = new InfluenceGraph();
    const first = graph.ensureSpanNode("doc.md", { start: 3, end: 3 }, doc);
    const second = graph.ensureSpanNode("doc.md", { start: 5, end: 5 }, doc);
    assert(first.node.id !== second.node.id, "repeated text must not collapse into one node");
    equal(first.node.occurrence, 0);
    equal(second.node.occurrence, 1);
    equal(graph.nodes.size, 2);
  });

  check("a span's id is recomputable from its own stored payload (content is never truncated)", () => {
    const graph = new InfluenceGraph();
    const { node } = graph.ensureSpanNode("doc.md", { start: 3, end: 3 }, doc);
    equal(spanNodeId(node.path, node.content, node.occurrence), node.id);
  });

  check("a degenerate span is widened until it carries real signal", () => {
    const graph = new InfluenceGraph();
    const { node, scope } = graph.ensureSpanNode("doc.md", { start: 2, end: 2 }, doc); // a blank line
    equal(scope, NODE_SCOPES.SPAN);
    assert(contentSignal(node.content) >= MIN_SPAN_SIGNAL, `widened content still too thin: ${JSON.stringify(node.content)}`);
    assert(node.interval.end > node.interval.start, "it must have grown past the single blank line");
  });

  check("an all-whitespace file cannot produce a span — it falls back to file scope", () => {
    const graph = new InfluenceGraph();
    const { node, scope, demoted } = graph.ensureSpanNode("blank.md", { start: 1, end: 1 }, "\n\n\n");
    equal(scope, NODE_SCOPES.FILE);
    equal(node.scope, NODE_SCOPES.FILE);
    assert(demoted, "the demotion reason must be reported, not silently swallowed");
  });

  check("a whole-file interval IS the file, not a span that shadows it", () => {
    const graph = new InfluenceGraph();
    const total = splitLines(doc).length;
    const { node, scope } = graph.ensureSpanNode("doc.md", { start: 1, end: total }, doc);
    equal(scope, NODE_SCOPES.FILE);
    equal(node.id, fileNodeId("doc.md"));
  });

  check("ensureSpanNode is deterministic: the interval is derived, never last-writer-wins", () => {
    const graph = new InfluenceGraph();
    const a = graph.ensureSpanNode("doc.md", { start: 3, end: 3 }, doc);
    const b = graph.ensureSpanNode("doc.md", { start: 3, end: 3 }, doc);
    equal(a.node.id, b.node.id);
    equal(a.node.interval, b.node.interval);
    equal(graph.nodes.size, 1);
  });

  check("describeOccurrence reports which repeat a location is", () => {
    equal(describeOccurrence(doc, { start: 5, end: 5 }).occurrence, 1);
    equal(describeOccurrence(doc, { start: 3, end: 3 }).occurrence, 0);
  });

  check("relocateSpan follows text that moved down the file", () => {
    const shifted = `PREPENDED\nALSO PREPENDED\n${doc}`;
    const moved = relocateSpan(shifted, "A distinctive paragraph about route distinguishers and tenant edges.", {
      occurrence: 0,
      previousStart: 3,
    });
    equal(moved.interval.start, 5, "two prepended lines shift it by two");
  });

  check("relocateSpan returns null when the text is genuinely gone", () => {
    equal(relocateSpan("nothing like it here\n", "vanished text", { occurrence: 0 }), null);
  });

  check("widenToSignal gives up rather than returning a useless span", () => {
    equal(widenToSignal("\n\n\n", { start: 1, end: 1 }), null);
  });
});

group("graph: edge state machine", () => {
  const makePair = () => {
    const graph = new InfluenceGraph();
    const a = graph.ensureFileNode("a.md", { content: "source content here\n" });
    const b = graph.ensureFileNode("b.md", { content: "target content here\n" });
    return { graph, a, b };
  };

  check("a new edge defaults to hint at the given confidence", () => {
    const { graph, a, b } = makePair();
    const edge = graph.addEdge({ from: a.id, to: b.id, confidence: 0.3 });
    equal(edge.state, EDGE_STATES.HINT);
    equal(edge.confidence, 0.3);
  });
  check("re-adding the same hint does not duplicate it", () => {
    const { graph, a, b } = makePair();
    graph.addEdge({ from: a.id, to: b.id, confidence: 0.3 });
    graph.addEdge({ from: a.id, to: b.id, confidence: 0.3 });
    equal(graph.edges.size, 1);
  });
  check("confirming a hint upgrades it in place, same edge identity", () => {
    const { graph, a, b } = makePair();
    const hint = graph.addEdge({ from: a.id, to: b.id, confidence: 0.3 });
    const confirmed = graph.addEdge({ from: a.id, to: b.id, state: EDGE_STATES.CONFIRMED, confidence: 1 });
    equal(hint.id, confirmed.id);
    equal(graph.edges.size, 1);
    equal(graph.edges.get(hint.id).state, EDGE_STATES.CONFIRMED);
  });
  check("re-proposing a hint never downgrades an already-confirmed edge", () => {
    const { graph, a, b } = makePair();
    graph.addEdge({ from: a.id, to: b.id, state: EDGE_STATES.CONFIRMED, confidence: 1 });
    graph.addEdge({ from: a.id, to: b.id, confidence: 0.3 });
    equal(graph.edges.size, 1);
    const edge = [...graph.edges.values()][0];
    equal(edge.state, EDGE_STATES.CONFIRMED);
    equal(edge.confidence, 1);
  });
  check("demoting keeps the edge and remembers what it used to claim", () => {
    const { graph, a, b } = makePair();
    const edge = graph.addEdge({ from: a.id, to: b.id, state: EDGE_STATES.CONFIRMED, confidence: 1 });
    graph.demoteEdge(edge.id, "source-file-content-changed");
    equal(edge.state, EDGE_STATES.NEEDS_RECONFIRM);
    equal(edge.priorState, EDGE_STATES.CONFIRMED);
    equal(edge.priorConfidence, 1);
    equal(edge.reason, "source-file-content-changed");
  });
  check("a demoted edge can never outrank a real confirmation", () => {
    const { graph, a, b } = makePair();
    const edge = graph.addEdge({ from: a.id, to: b.id, state: EDGE_STATES.CONFIRMED, confidence: 1 });
    graph.demoteEdge(edge.id);
    assert(edge.confidence <= NEEDS_RECONFIRM_CEILING, `confidence ${edge.confidence} must be capped`);
  });
  check("re-confirming a demoted edge clears the demotion entirely", () => {
    const { graph, a, b } = makePair();
    const edge = graph.addEdge({ from: a.id, to: b.id, state: EDGE_STATES.CONFIRMED, confidence: 1 });
    graph.demoteEdge(edge.id);
    graph.addEdge({ from: a.id, to: b.id, state: EDGE_STATES.CONFIRMED, confidence: 1 });
    equal(edge.state, EDGE_STATES.CONFIRMED);
    equal(edge.confidence, 1);
    assert(!("priorState" in edge), "a re-confirmed edge must not still look demoted");
  });
  check("a scaffold hint cannot silently un-demote an edge awaiting re-review", () => {
    const { graph, a, b } = makePair();
    const edge = graph.addEdge({ from: a.id, to: b.id, state: EDGE_STATES.CONFIRMED, confidence: 1 });
    graph.demoteEdge(edge.id);
    graph.addEdge({ from: a.id, to: b.id, confidence: 0.3 }); // scaffold re-discovers it
    equal(edge.state, EDGE_STATES.NEEDS_RECONFIRM);
  });
  check("reject deletes outright -- no tombstone left behind", () => {
    const { graph, a, b } = makePair();
    const edge = graph.addEdge({ from: a.id, to: b.id, confidence: 0.3 });
    graph.removeEdge(edge.id);
    equal(graph.edges.size, 0);
  });
  check("self-influence is refused", () => {
    const { graph, a } = makePair();
    equal(graph.addEdge({ from: a.id, to: a.id }), null);
  });
  check("edges to unknown nodes are refused", () => {
    const { graph, a } = makePair();
    let threw = false;
    try {
      graph.addEdge({ from: a.id, to: "s_ghost" });
    } catch {
      threw = true;
    }
    assert(threw, "should refuse a dangling edge");
  });
  check("round-trip through JSON preserves nodes, edges and fileHashes", () => {
    const { graph, a, b } = makePair();
    graph.addEdge({ from: a.id, to: b.id, state: EDGE_STATES.CONFIRMED, confidence: 1 });
    graph.fileHashes.set("a.md", hashText("x"));
    const restored = InfluenceGraph.fromJSON(graph.toJSON());
    equal(restored.stats().edges, graph.stats().edges);
    equal(restored.stats().nodes, graph.stats().nodes);
    equal(restored.fileHashes.get("a.md"), graph.fileHashes.get("a.md"));
    equal(restored.nodeIdsForPath("a.md"), [a.id], "the path index must survive a reload");
  });
  check("a reloaded map does not re-publish the previous run's reconcile report as its own", () => {
    const { graph } = makePair();
    graph.reconcileReport = { unchanged: false, retired: [{ path: "gone.md" }] };
    const restored = InfluenceGraph.fromJSON(graph.toJSON());
    equal(restored.reconcileReport, undefined);
  });
});

group("graph: retirement and the archive", () => {
  const makeGraph = () => {
    const graph = new InfluenceGraph();
    const src = graph.ensureFileNode("src.md", { content: "source content here\n" });
    const tgt = graph.ensureSpanNode("tgt.md", { start: 1, end: 1 }, "a distinctive target line with signal\nmore\n");
    graph.addEdge({ from: src.id, to: tgt.node.id, state: EDGE_STATES.CONFIRMED, confidence: 1 });
    return { graph, src, tgt: tgt.node };
  };

  check("retiring moves the node AND its edges into the archive, keeping the content", () => {
    const { graph, tgt } = makeGraph();
    const record = graph.retireNode(tgt.id, RETIRE_REASONS.CONTENT_CHANGED);
    equal(graph.nodes.has(tgt.id), false, "gone from the live map");
    equal(graph.edges.size, 0, "its edges left with it");
    equal(graph.archive.retiredNodes.size, 1);
    equal(record.node.content, tgt.content, "the retired text must be preserved — it is the only copy left");
    equal(record.edges.length, 1);
  });

  check("a retired record remembers what it influenced (the re-investigation lead)", () => {
    const { graph, src, tgt } = makeGraph();
    const record = graph.retireNode(src.id, RETIRE_REASONS.CONTENT_CHANGED);
    equal(record.affectedTargets.length, 1);
    equal(record.affectedTargets[0].nodeId, tgt.id);
    equal(record.affectedTargets[0].direction, "influenced");
    equal(record.affectedTargets[0].state, EDGE_STATES.CONFIRMED);
  });

  check("the live map serializes clean — zero retired records in it", () => {
    const { graph, tgt } = makeGraph();
    graph.retireNode(tgt.id, RETIRE_REASONS.CONTENT_CHANGED);
    const json = graph.toJSON();
    equal(json.nodes.length, 1, "only the surviving node");
    equal(json.retiredNodes, undefined, "no retired records in the live map");
    assert(
      !json.nodes.some((n) => n.id === tgt.id) && !json.edges.length,
      "neither the retired node nor its edges may linger",
    );
    // A COUNT in stats is fine and wanted (otherwise a reader of the live map
    // has no idea history exists at all); the records themselves are not.
    equal(json.stats.archived.retiredNodes, 1);
    equal(graph.archive.toJSON().retiredNodes.length, 1, "the archive carries the records instead");
  });

  check("retire -> resurrect -> retire keeps the flip-flop on record", () => {
    const { graph, tgt } = makeGraph();
    const content = "a distinctive target line with signal\nmore\n";
    graph.retireNode(tgt.id, RETIRE_REASONS.CONTENT_CHANGED);
    const revived = graph.ensureSpanNode("tgt.md", { start: 1, end: 1 }, content); // text came back
    assert(revived.node.retiredHistory?.length, "a resurrected node must remember it was retired");
    graph.retireNode(revived.node.id, RETIRE_REASONS.ORPHANED);
    equal(graph.archive.retiredNodes.size, 1, "one identity, one record");
    equal(graph.archive.retiredNodes.get(tgt.id).history.length, 1, "and the earlier retirement is still visible");
  });

  check("reverted content resurrects its record instead of existing twice", () => {
    // The exact text reappearing on disk (git checkout, undo) regenerates the
    // same id -- which must not be live and retired at the same time.
    const { graph, tgt } = makeGraph();
    graph.retireNode(tgt.id, RETIRE_REASONS.CONTENT_CHANGED);
    assert(graph.archive.has(tgt.id));
    const revived = graph.ensureSpanNode("tgt.md", { start: 1, end: 1 }, "a distinctive target line with signal\nmore\n");
    equal(revived.node.id, tgt.id, "content-addressing regenerates the same identity");
    equal(graph.archive.has(tgt.id), false, "and it must have left the archive");
    equal(graph.nodes.has(tgt.id), true);
  });

  check("resolving moves a record out of the queue but never deletes it", () => {
    const { graph, tgt } = makeGraph();
    graph.retireNode(tgt.id, RETIRE_REASONS.CONTENT_CHANGED);
    graph.archive.resolve(tgt.id, { into: ["s_new"], note: "re-derived" });
    equal(graph.archive.retiredNodes.size, 0, "out of the work queue");
    equal(graph.archive.resolvedNodes.size, 1, "but still on record");
    equal(graph.archive.resolvedNodes.get(tgt.id).resolvedInto, ["s_new"]);
  });

  check("the re-investigation queue only lists records that actually lead somewhere", () => {
    const { graph, src, tgt } = makeGraph();
    const lonely = graph.ensureFileNode("lonely.md", { content: "no edges\n" });
    graph.retireNode(lonely.id, RETIRE_REASONS.ORPHANED);
    graph.retireNode(src.id, RETIRE_REASONS.CONTENT_CHANGED);
    const queue = graph.reinvestigationQueue();
    equal(queue.length, 1);
    equal(queue[0].node.id, src.id);
  });

  check("archive round-trips through JSON", () => {
    const { graph, tgt } = makeGraph();
    graph.retireNode(tgt.id, RETIRE_REASONS.CONTENT_CHANGED);
    const restored = GraphArchive.fromJSON(graph.archive.toJSON());
    equal(restored.retiredNodes.size, 1);
    equal(restored.retiredNodes.get(tgt.id).node.content, tgt.content);
  });

  check("a foreign or future archive is ignored, not misread", () => {
    equal(GraphArchive.fromJSON({ kind: "something-else", retiredNodes: [{ node: { id: "x" } }] }).size, 0);
    equal(GraphArchive.fromJSON({ kind: "influence-archive", schemaVersion: "99.0.0", retiredNodes: [{ node: { id: "x" } }] }).size, 0);
  });

  check("migrateNode carries a node and its edges to a new identity", () => {
    const { graph, src, tgt } = makeGraph();
    const migrated = graph.migrateNode(tgt.id, {
      interval: { start: 9, end: 9 },
      occurrence: 1,
      content: tgt.content,
    });
    assert(migrated.id !== tgt.id, "a new occurrence index means a new identity");
    equal(graph.nodes.has(tgt.id), false);
    equal(graph.archive.size, 0, "a migration is a rename, NOT a retirement");
    const edge = [...graph.edges.values()][0];
    equal(edge.to, migrated.id, "the edge followed it");
    equal(edge.state, EDGE_STATES.CONFIRMED, "and kept its verdict");
    equal(migrated.migratedFrom, [tgt.id]);
  });
});

group("engine: stale-node clustering and coalescing", () => {
  check("touching stale spans cluster into one bounding region", () => {
    const clusters = clusterStaleNodes([
      { id: "a", interval: { start: 10, end: 12 } },
      { id: "b", interval: { start: 13, end: 16 } },
      { id: "c", interval: { start: 40, end: 41 } },
    ]);
    equal(clusters.length, 2);
    equal(clusters[0].interval, { start: 10, end: 16 });
    equal(clusters[0].nodes.length, 2);
    equal(clusters[1].interval, { start: 40, end: 41 });
  });

  check("clustering works with ZERO recorded writes (the repo-adoption case)", () => {
    // Gating this on session write records would mean a repo whose history
    // predates the tool gets no replacement spans at all.
    const clusters = clusterStaleNodes([{ id: "a", interval: { start: 3, end: 4 } }], []);
    equal(clusters.length, 1);
    equal(clusters[0].widenedByWrites, false);
  });

  check("a recorded write widens the bounding region when one is available", () => {
    const clusters = clusterStaleNodes([{ id: "a", interval: { start: 10, end: 12 } }], [{ start: 8, end: 20 }]);
    equal(clusters[0].interval, { start: 8, end: 20 });
    equal(clusters[0].widenedByWrites, true);
  });

  check("a fresh hint restating an inherited needs-reconfirm edge is folded away", () => {
    const graph = new InfluenceGraph();
    const doc = [
      "line one of the target with plenty of signal",
      "line two also carries real content here",
      "line three continues the same passage",
      "line four wraps it up with more text",
      "line five is outside the bounding region",
      "line six is also outside it entirely",
      "line seven trails the document",
    ].join("\n");
    const src = graph.ensureFileNode("src.md", { content: "source\n" });
    const bounding = graph.ensureSpanNode("tgt.md", { start: 1, end: 4 }, doc);
    equal(bounding.scope, NODE_SCOPES.SPAN, "fixture: the bounding region must not be the whole file");
    graph.addEdge({
      from: src.id,
      to: bounding.node.id,
      state: EDGE_STATES.NEEDS_RECONFIRM,
      confidence: 0.2,
      priorState: EDGE_STATES.CONFIRMED,
    });
    // The scaffold independently re-proposes the same influence, tighter.
    const fresh = graph.ensureSpanNode("tgt.md", { start: 2, end: 3 }, doc);
    graph.addEdge({ from: src.id, to: fresh.node.id, confidence: 0.3 });
    equal(graph.edges.size, 2, "fixture: two rival descriptions");

    const dropped = coalesceDuplicateHints(graph);
    equal(dropped, 1);
    equal(graph.edges.size, 1);
    equal([...graph.edges.values()][0].state, EDGE_STATES.NEEDS_RECONFIRM, "history wins over a fresh guess");
  });

  check("a file-scope inherited claim also covers spans inside that file", () => {
    const graph = new InfluenceGraph();
    const doc = "alpha line with plenty of signal here\nbeta line\ngamma line here\ndelta line\n";
    const src = graph.ensureFileNode("src.md", { content: "source\n" });
    const whole = graph.ensureFileNode("tgt.md", { content: doc });
    graph.addEdge({ from: src.id, to: whole.id, state: EDGE_STATES.NEEDS_RECONFIRM, confidence: 0.2 });
    const span = graph.ensureSpanNode("tgt.md", { start: 1, end: 2 }, doc);
    graph.addEdge({ from: src.id, to: span.node.id, confidence: 0.3 });
    equal(coalesceDuplicateHints(graph), 1, "a whole-file claim contains any span in that file");
  });

  check("coalescing leaves an unrelated hint alone", () => {
    const graph = new InfluenceGraph();
    const doc = "alpha line with plenty of signal\nbeta line is here too\ngamma line here with text\ndelta line ends it\n";
    const src = graph.ensureFileNode("src.md", { content: "source\n" });
    const a = graph.ensureSpanNode("tgt.md", { start: 1, end: 2 }, doc);
    const b = graph.ensureSpanNode("tgt.md", { start: 3, end: 4 }, doc);
    graph.addEdge({ from: src.id, to: a.node.id, state: EDGE_STATES.NEEDS_RECONFIRM, confidence: 0.2 });
    graph.addEdge({ from: src.id, to: b.node.id, confidence: 0.3 });
    equal(coalesceDuplicateHints(graph), 0, "a different region is not a duplicate");
    equal(graph.edges.size, 2);
  });
});

group("resolution: only real files become edges", () => {
  const engine = new ContextSourceMonitorEngine({ workspace });
  const index = engine.index();

  check("relative markdown link resolves", () => {
    const res = index.resolveReference("docs/spec.md", "docs/notes.md");
    assert(res.ok);
    equal(res.relPaths, ["docs/spec.md"]);
  });
  check("extensionless code import resolves", () => {
    const res = index.resolveReference("./helper", "src/service.ts");
    assert(res.ok, "should resolve ./helper");
    equal(res.relPaths, ["src/helper.ts"]);
    equal(res.kind, "extension");
  });
  check("directory citation fans out to its files", () => {
    const res = index.resolveReference("docs/", "README.md");
    assert(res.ok);
    equal(res.kind, "directory");
    assert(res.relPaths.includes("docs/spec.md"));
  });
  check("missing file is unresolved, not fabricated", () => {
    const res = index.resolveReference("missing/file.md", "docs/notes.md");
    assert(!res.ok);
    equal(res.reason, "no-matching-file");
  });
  check("external URIs are rejected", () => {
    assert(!index.resolveReference("https://example.com/x.md", "docs/notes.md").ok);
  });
  check("bare entity tokens never resolve to themselves as a file", () => {
    const res = index.resolveReference("L3VPN", "docs/notes.md");
    assert(!res.ok, "a bare token is not a file");
  });
  check("slash-separated prose is not path-shaped", () => {
    assert(!index.isPathShaped("Create iEVC Static/Direct/BGP"));
    assert(!index.isPathShaped("3.3/4.4"));
    assert(index.isPathShaped("docs/spec.md"));
  });
});

group("content overlap", () => {
  check("tokenizer keeps technical identifiers whole", () => {
    const tokens = tokenize("Payload NFV-OSS-CO-LAN maps to data/corpus/x.md").map((t) => t.token);
    assert(tokens.includes("nfv-oss-co-lan"), `got ${tokens.join(",")}`);
    assert(tokens.includes("data/corpus/x.md"));
  });
  check("shared prose is detected between two documents", () => {
    const index = new ShingleIndex({ minMatches: 2 });
    index.addDocument("docs/spec.md", fs.readFileSync(path.join(workspace, "docs/spec.md"), "utf8"));
    index.prune();
    const matches = index.match("docs/notes.md", fs.readFileSync(path.join(workspace, "docs/notes.md"), "utf8"));
    equal(matches.length, 1, "spec should be matched");
    equal(matches[0].sourcePath, "docs/spec.md");
    assert(matches[0].distinctShingles >= 2, "should share several shingles");
    assert(matches[0].pairs.length > 0, "pairs must correlate source and target lines");
  });
  check("small source sets are not pruned into oblivion", () => {
    const shared = "the provisioning pipeline validates the route target import and export policy set\n";
    const index = new ShingleIndex();
    index.addDocument("a.md", shared);
    index.addDocument("b.md", shared); // dual conversion of the same source
    index.prune();
    assert(index.postings.size > 0, "df cap must not delete shingles shared by 2 docs");
  });
  check("unrelated documents produce no match", () => {
    const index = new ShingleIndex();
    index.addDocument("a.md", "completely unrelated text about gardening tools and soil\n");
    index.prune();
    equal(index.match("b.md", "quantum chromodynamics lattice simulations on gpus\n").length, 0);
  });
});

group("engine: coverage", () => {
  check("coverage is pure — reading metrics does not create history", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    engine.coverage();
    engine.coverage();
    equal(engine.traceHistory.length, 0, "history must only grow via recordTrace()");
    engine.recordTrace(engine.coverage());
    equal(engine.traceHistory.length, 1);
  });
  check("a full read reaches 100% and leaves no unread interval", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    const total = statLines(path.join(workspace, "docs/spec.md")).lines;
    engine.recordRead("docs/spec.md", { interval: { start: 1, end: total } });
    const file = engine.coverage().files.find((f) => f.relPath === "docs/spec.md");
    equal(file.status, "FULLY_READ");
    equal(file.coveragePercent, 100);
    equal(file.unreadIntervals, []);
  });
  check("partial reads report exact unread intervals", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    engine.recordRead("docs/spec.md", { interval: { start: 1, end: 3 } });
    const file = engine.coverage().files.find((f) => f.relPath === "docs/spec.md");
    equal(file.status, "PARTIALLY_READ");
    equal(file.readIntervals, [{ start: 1, end: 3 }]);
    equal(file.unreadIntervals, [{ start: 4, end: 8 }]);
  });
  check("offset/limit reads are translated to intervals", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    engine.recordRead("docs/spec.md", { offset: 4, limit: 2 });
    const file = engine.coverage().files.find((f) => f.relPath === "docs/spec.md");
    equal(file.readIntervals, [{ start: 4, end: 5 }]);
  });
  check("block coverage marks which sections were seen", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    engine.recordRead("docs/spec.md", { interval: { start: 3, end: 6 } });
    const file = engine.coverage({ blockDetail: "all" }).files.find((f) => f.relPath === "docs/spec.md");
    const vrf = file.blocks.find((b) => b.name === "## VRF requirements");
    equal(vrf.status, "READ");
    const qos = file.blocks.find((b) => b.name === "## QoS requirements");
    equal(qos.status, "UNREAD");
  });
  check("reads outside the scope are reported separately, not lost", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    engine.recordRead("src/service.ts", { interval: { start: 1, end: 2 } });
    const snapshot = engine.coverage({ scope: "docs" });
    equal(snapshot.totals.readOutsideScope, 1);
    equal(snapshot.readOutsideScope[0].relPath, "src/service.ts");
  });
});

group("engine: influence (scaffold hints)", () => {
  const opts = { sourceRoots: ["docs/spec.md"], targetRoots: ["docs/notes.md"], overlap: { minMatches: 2 } };

  check("citation and overlap both propose hints, source -> target", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    const graph = engine.buildInfluenceGraph(opts);
    const edges = graph.edgesIntoFile("docs/notes.md");
    assert(edges.length > 0, "expected incoming edges");
    assert(edges.every((e) => e.state === EDGE_STATES.HINT), "a fresh build only ever produces hints");
    assert(edges.every((e) => graph.nodes.get(e.from).path === "docs/spec.md"), "source scope must be respected");
    const confidences = new Set(edges.map((e) => e.confidence));
    equal(confidences.size, 1, "all hints share one uniform confidence, not a spectrum by mechanism");
  });

  check("a citation's source is the cited FILE, so editing it cannot re-identify it", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    const graph = engine.buildInfluenceGraph({ ...opts, detectors: ["path-reference"] });
    const edges = graph.edgesIntoFile("docs/notes.md");
    assert(edges.length > 0, "expected a citation hint");
    const source = graph.nodes.get(edges[0].from);
    equal(source.scope, NODE_SCOPES.FILE);
    equal(source.id, fileNodeId("docs/spec.md"));
  });

  check("a citation's target carries enough context to be identifiable", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    const graph = engine.buildInfluenceGraph({ ...opts, detectors: ["path-reference"] });
    const edge = graph.edgesIntoFile("docs/notes.md")[0];
    const target = graph.nodes.get(edge.to);
    if (target.scope === NODE_SCOPES.SPAN) {
      assert(
        contentSignal(target.content) >= MIN_SPAN_SIGNAL,
        `a target span must be distinctive, got ${JSON.stringify(target.content)}`,
      );
      equal(spanNodeId(target.path, target.content, target.occurrence), target.id, "and self-verifying");
    }
  });

  check("no node/edge participates without the other -- no orphans, even for out-of-scope resolutions", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    const graph = engine.buildInfluenceGraph({ targetRoots: ["docs/notes.md"] });
    const used = new Set();
    for (const e of graph.edges.values()) {
      used.add(e.from);
      used.add(e.to);
    }
    assert([...graph.nodes.keys()].every((id) => used.has(id)), "every persisted node must have an edge");
  });
  check("unresolvable citations land in the unresolved bucket, never fabricated", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    const graph = engine.buildInfluenceGraph({ targetRoots: ["docs/notes.md"] });
    assert(
      graph.unresolved.some((u) => u.raw.includes("missing/file.md")),
      "missing/file.md should be reported unresolved",
    );
  });
  check("a real file outside the given roots resolves silently scope-filtered, not falsely unresolved", () => {
    // src/service.ts is a real file but not in sourceRoots -- referencing it
    // must not show up as "no-matching-file" just because it's out of scope.
    write("docs/refs-code.md", "See `src/service.ts` for the implementation.\n");
    const engine = new ContextSourceMonitorEngine({ workspace });
    const graph = engine.buildInfluenceGraph({ sourceRoots: ["docs/spec.md"], targetRoots: ["docs/refs-code.md"] });
    assert(!graph.unresolved.some((u) => u.raw.includes("src/service.ts")), "a real, merely out-of-scope file must not be 'unresolved'");
  });
  check("generic bare-root directory fan-out is dropped entirely, not hinted", () => {
    // Pad docs/ well past GENERIC_FANOUT_THRESHOLD -- earlier checks in this
    // group already added a couple of files to docs/, so asserting an exact
    // count here would be fragile against fixture growth; margin is the point.
    for (let i = 0; i < GENERIC_FANOUT_THRESHOLD + 4; i++) write(`docs/pad-${i}.md`, `padding ${i}\n`);
    write("docs/generic-mention.md", "Everything lives under `docs/` somewhere.\n");
    const engine = new ContextSourceMonitorEngine({ workspace });
    const graph = engine.buildInfluenceGraph({ sourceRoots: ["docs"], targetRoots: ["docs/generic-mention.md"] });
    equal(graph.edgesIntoFile("docs/generic-mention.md").length, 0, "a bare, generic directory mention must not hint at every sibling file");
  });
  check("code imports produce a hint in the right direction", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    const graph = engine.buildInfluenceGraph({ sourceRoots: ["src"], targetRoots: ["src"] });
    const edge = [...graph.edges.values()][0];
    assert(edge, "no import hint found");
    equal(graph.nodes.get(edge.from).path, "src/helper.ts", "helper influences service");
    equal(graph.nodes.get(edge.to).path, "src/service.ts");
  });
  check("minConfidence drops weak hints but never drops a confirmed edge", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    const graph = engine.buildInfluenceGraph({ targetRoots: ["docs/notes.md"], minConfidence: 0.99 });
    equal(graph.stats().edges, 0);
    equal(graph.stats().nodes, 0);
  });
  check("ignored summary reports both the active gitignore rules and what they matched", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    const graph = engine.buildInfluenceGraph({ targetRoots: ["docs/notes.md"] });
    assert(graph.ignored.gitignore.includes("*.log"), "active .gitignore patterns should be echoed");
    assert(graph.ignored.resolved.some((e) => e.path === "generated" && e.reason === "gitignore"));
    assert(graph.ignored.hardIgnores.includes("node_modules"));
  });
});

group("engine: influence-only ignore list (distinct from .gitignore)", () => {
  check("a path in the ignored-paths file never enters the scaffold, even though it is not gitignored", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    write("docs/noisy.md", "See `docs/spec.md` for the source.\n");
    const before = engine.buildInfluenceGraph({ sourceRoots: ["docs/spec.md"], targetRoots: ["docs/noisy.md"] });
    assert(before.edgesIntoFile("docs/noisy.md").length > 0, "sanity: it hints before being ignored");

    write(`${ARTIFACT_DIR}/ignored-paths.txt`, "docs/noisy.md\n");
    const after = engine.buildInfluenceGraph({ sourceRoots: ["docs/spec.md"], targetRoots: ["docs/noisy.md"] });
    equal(after.edgesIntoFile("docs/noisy.md").length, 0, "an ignored-list path must produce zero hints");
    equal(after.ignored.ignoredPathsPatterns, ["docs/noisy.md"]);
  });
  check("coverage/status are unaffected by the influence-only ignore list", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    const file = engine.coverage().files.find((f) => f.relPath === "docs/noisy.md");
    assert(file, "an influence-ignored file must still be tracked for coverage purposes");
  });
});

group("engine: confirm / reject / link", () => {
  const opts = { sourceRoots: ["docs/spec.md"], targetRoots: ["docs/notes.md"], overlap: { minMatches: 2 } };

  function freshMap(mapRelPath) {
    const engine = new ContextSourceMonitorEngine({ workspace });
    const graph = engine.buildInfluenceGraph(opts);
    write(mapRelPath, JSON.stringify(graph.toJSON()));
    return { engine, graph };
  }

  check("confirming an existing hint upgrades it, not duplicates it", () => {
    const { engine, graph } = freshMap("state/confirm1.json");
    const hint = [...graph.edges.values()][0];
    const from = graph.nodes.get(hint.from);
    const to = graph.nodes.get(hint.to);
    const result = engine.confirmInfluence({
      mapPath: "state/confirm1.json",
      sourceFile: from.path,
      sourceInterval: from.interval,
      targetFile: to.path,
      targetInterval: to.interval,
    });
    assert(result.ok);
    equal(result.edge.state, EDGE_STATES.CONFIRMED);
    const reloaded = engine.readGraphArtifact("state/confirm1.json");
    equal(reloaded.stats().edges, graph.stats().edges, "confirming must not add a new edge");
    equal(reloaded.stats().byState.confirmed, 1);
  });
  check("rejecting an existing hint deletes it outright", () => {
    const { engine, graph } = freshMap("state/reject1.json");
    const before = graph.stats().edges;
    const hint = [...graph.edges.values()][0];
    const from = graph.nodes.get(hint.from);
    const to = graph.nodes.get(hint.to);
    const result = engine.rejectInfluence({
      mapPath: "state/reject1.json",
      sourceFile: from.path,
      sourceInterval: from.interval,
      targetFile: to.path,
      targetInterval: to.interval,
    });
    assert(result.ok);
    const reloaded = engine.readGraphArtifact("state/reject1.json");
    equal(reloaded.stats().edges, before - 1);
    assert(!reloaded.edges.has(hint.id), "the specific edge must be gone, not tombstoned as rejected");
  });
  check("rejecting a non-existent hint fails with a clear error", () => {
    const { engine } = freshMap("state/reject2.json");
    const result = engine.rejectInfluence({
      mapPath: "state/reject2.json",
      sourceFile: "docs/spec.md",
      targetFile: "docs/other.md", // never hinted against each other in this map
    });
    equal(result.ok, false);
  });
  check("link asserts a brand-new confirmed edge the scaffold never proposed", () => {
    const { engine } = freshMap("state/link1.json");
    const result = engine.confirmInfluence({
      mapPath: "state/link1.json",
      sourceFile: "docs/spec.md",
      sourceInterval: { start: 7, end: 7 },
      targetFile: "docs/notes.md",
      targetInterval: { start: 9, end: 9 },
      confidence: 1,
    });
    assert(result.ok);
    equal(result.edge.state, EDGE_STATES.CONFIRMED);
    equal(result.edge.confidence, 1);
  });
  check("source and target resolving to the same location is refused", () => {
    const { engine } = freshMap("state/link2.json");
    const result = engine.confirmInfluence({ mapPath: "state/link2.json", sourceFile: "docs/spec.md", targetFile: "docs/spec.md" });
    equal(result.ok, false);
  });
  check("confirm/reject/link work even with no previous map (bootstraps one)", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    const result = engine.confirmInfluence({ mapPath: "state/bootstrap.json", sourceFile: "docs/spec.md", targetFile: "docs/notes.md" });
    assert(result.ok);
    assert(fs.existsSync(path.join(workspace, "state/bootstrap.json")));
  });
});

group("engine: reconcile", () => {
  const opts = { sourceRoots: ["docs/spec.md"], targetRoots: ["docs/notes.md"], overlap: { minMatches: 2 } };

  function buildAndSave(mapRelPath) {
    const engine = new ContextSourceMonitorEngine({ workspace });
    const graph = engine.buildInfluenceGraph(opts);
    engine.saveGraphArtifact(graph, mapRelPath);
    return graph;
  }

  /** Edit a file, run the body, then always put it back. */
  function withEdit(relPath, transform, body) {
    const abs = path.join(workspace, relPath);
    const original = fs.readFileSync(abs, "utf8");
    fs.writeFileSync(abs, transform(original));
    try {
      return body();
    } finally {
      fs.writeFileSync(abs, original);
    }
  }

  check("no previous map degrades to a fresh build, not a failure", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    const result = engine.reconcileInfluenceGraph({ ...opts, previousPath: "state/does-not-exist.json" });
    equal(result.reconciled, false);
    equal(result.reason, "no-previous-map");
    assert(result.graph.stats().edges > 0, "it should still produce a real graph");
  });

  check("reconciling with nothing changed is a true no-op: rejected hints stay gone", () => {
    buildAndSave("state/reconcile-unchanged.json");
    const engine1 = new ContextSourceMonitorEngine({ workspace });
    const first = engine1.readGraphArtifact("state/reconcile-unchanged.json");
    const hint = [...first.edges.values()][0];
    const from = first.nodes.get(hint.from);
    const to = first.nodes.get(hint.to);
    engine1.rejectInfluence({
      mapPath: "state/reconcile-unchanged.json",
      sourceFile: from.path,
      sourceInterval: from.interval,
      targetFile: to.path,
      targetInterval: to.interval,
    });
    const afterReject = engine1.readGraphArtifact("state/reconcile-unchanged.json").stats().edges;

    const engine2 = new ContextSourceMonitorEngine({ workspace });
    const result = engine2.reconcileInfluenceGraph({ ...opts, previousPath: "state/reconcile-unchanged.json" });
    equal(result.unchanged, true);
    equal(result.graph.stats().edges, afterReject, "a rejected hint must not reappear when nothing was touched");
    equal(result.report.retired.length, 0, "and nothing may be retired on a no-op");
  });

  check("editing a SOURCE file demotes its settled edges but never retires the file node", () => {
    // The regression that motivated file-scope identity: one typo in a corpus
    // document must not archive every confirmed edge out of it.
    const engine1 = new ContextSourceMonitorEngine({ workspace });
    const first = engine1.buildInfluenceGraph(opts);
    engine1.saveGraphArtifact(first, "state/reconcile-source-edit.json");
    const hint = [...first.edges.values()][0];
    const from = first.nodes.get(hint.from);
    const to = first.nodes.get(hint.to);
    engine1.confirmInfluence({
      mapPath: "state/reconcile-source-edit.json",
      sourceFile: from.path,
      sourceInterval: from.interval,
      targetFile: to.path,
      targetInterval: to.interval,
    });
    const sourceFileNodeId = fileNodeId("docs/spec.md");

    withEdit("docs/spec.md", (text) => `${text}\nAn appended clarification sentence for the reconcile test.\n`, () => {
      const engine2 = new ContextSourceMonitorEngine({ workspace });
      const result = engine2.reconcileInfluenceGraph({ ...opts, previousPath: "state/reconcile-source-edit.json" });
      assert(result.graph.nodes.has(sourceFileNodeId), "the source file node must survive a content edit");
      const demoted = [...result.graph.edges.values()].filter((e) => e.state === EDGE_STATES.NEEDS_RECONFIRM);
      assert(demoted.length > 0, "its settled edges must be flagged for re-review");
      assert(
        demoted.every((e) => e.confidence <= NEEDS_RECONFIRM_CEILING),
        "a demoted edge must not keep competing at its old confidence",
      );
      assert(
        !result.graph.archive.forPath("docs/spec.md").length,
        "editing a source file must not archive anything",
      );
    });
  });

  check("text that merely MOVED is relocated: same edges, new interval, nothing retired", () => {
    const engine1 = new ContextSourceMonitorEngine({ workspace });
    const overlapOnly = { ...opts, detectors: ["content-overlap"] };
    const first = engine1.buildInfluenceGraph(overlapOnly);
    engine1.saveGraphArtifact(first, "state/reconcile-move.json");
    const spanBefore = [...first.nodes.values()].find((n) => n.scope === NODE_SCOPES.SPAN && n.path === "docs/notes.md");
    assert(spanBefore, "fixture: expected a span node in the target");
    const edgesBefore = first.edgesIntoFile("docs/notes.md").length;

    withEdit("docs/notes.md", (text) => `PREPENDED CONTEXT LINE\nANOTHER PREPENDED LINE\n${text}`, () => {
      const engine2 = new ContextSourceMonitorEngine({ workspace });
      const result = engine2.reconcileInfluenceGraph({ ...overlapOnly, previousPath: "state/reconcile-move.json" });
      assert(result.report.relocated.length > 0, "prepending lines must relocate spans, not invalidate them");
      const moved = result.report.relocated.find((r) => r.path === "docs/notes.md");
      equal(moved.to.start, moved.from.start + 2, "shifted by exactly the two prepended lines");
      assert(
        result.graph.edgesIntoFile("docs/notes.md").length >= edgesBefore,
        "no edge may be lost to a pure line shift",
      );
    });
  });

  check("a vanished span retires into the archive and its edges are re-parented onto the replacement", () => {
    const engine1 = new ContextSourceMonitorEngine({ workspace });
    const overlapOnly = { ...opts, detectors: ["content-overlap"] };
    const first = engine1.buildInfluenceGraph(overlapOnly);
    engine1.saveGraphArtifact(first, "state/reconcile-retire.json");
    const span = [...first.nodes.values()].find((n) => n.scope === NODE_SCOPES.SPAN && n.path === "docs/notes.md");
    assert(span, "fixture: expected a target span");

    withEdit(
      "docs/notes.md",
      (text) =>
        text.replace(
          "Each service instance must allocate a distinct route distinguisher per tenant edge.",
          "Completely rewritten sentence bearing no resemblance to the original wording at all.",
        ),
      () => {
        const engine2 = new ContextSourceMonitorEngine({ workspace });
        const result = engine2.reconcileInfluenceGraph({ ...overlapOnly, previousPath: "state/reconcile-retire.json" });
        assert(result.report.retired.length > 0, "the vanished span must be retired");
        assert(result.graph.archive.retiredNodes.size > 0, "and it must be in the archive, not deleted");
        const record = [...result.graph.archive.retiredNodes.values()][0];
        assert(record.node.content, "the retired text is the only copy left — it must be kept");
      },
    );
  });

  check("a confirmed edge on an untouched file survives byte-identical", () => {
    const engine1 = new ContextSourceMonitorEngine({ workspace });
    const opts2 = {
      sourceRoots: ["docs/spec.md"],
      targetRoots: ["docs/notes.md", "docs/other.md"],
      overlap: { minMatches: 2 },
    };
    const first = engine1.buildInfluenceGraph(opts2);
    const otherHint = first.edgesIntoFile("docs/other.md")[0];
    assert(otherHint, "fixture sanity: docs/other.md should already hint");
    const otherFrom = first.nodes.get(otherHint.from);
    const otherTo = first.nodes.get(otherHint.to);
    engine1.saveGraphArtifact(first, "state/reconcile-untouched.json");
    engine1.confirmInfluence({
      mapPath: "state/reconcile-untouched.json",
      sourceFile: otherFrom.path,
      sourceInterval: otherFrom.interval,
      targetFile: otherTo.path,
      targetInterval: otherTo.interval,
    });
    const confirmedId = `${otherFrom.id}->${otherTo.id}`;

    withEdit("docs/notes.md", (text) => `${text}\nExtra line only for the reconcile test.\n`, () => {
      const engine2 = new ContextSourceMonitorEngine({ workspace });
      const result = engine2.reconcileInfluenceGraph({ ...opts2, previousPath: "state/reconcile-untouched.json" });
      equal(result.unchanged, false);
      assert(result.graph.edges.has(confirmedId), "the untouched file's confirmed edge must survive");
      equal(result.graph.edges.get(confirmedId).state, EDGE_STATES.CONFIRMED);
    });
  });

  check("a deleted source retires its node with the right reason — no dangling edge", () => {
    buildAndSave("state/reconcile-delete.json");
    const specPath = path.join(workspace, "docs/spec.md");
    const backupPath = path.join(workspace, "docs/spec.md.bak");
    fs.renameSync(specPath, backupPath);
    try {
      const engine = new ContextSourceMonitorEngine({ workspace });
      const result = engine.reconcileInfluenceGraph({ ...opts, previousPath: "state/reconcile-delete.json" });
      assert(result.report.deletedFiles.includes("docs/spec.md"));
      assert(![...result.graph.nodes.values()].some((n) => n.path === "docs/spec.md"), "no live node for a deleted file");
      assert(
        result.report.retired.some((r) => r.path === "docs/spec.md" && r.reason === RETIRE_REASONS.FILE_DELETED),
        "a deleted file must retire as file-deleted, not as content-changed",
      );
      for (const edge of result.graph.edges.values()) {
        assert(result.graph.nodes.has(edge.from) && result.graph.nodes.has(edge.to), "no edge may dangle");
      }
    } finally {
      fs.renameSync(backupPath, specPath);
    }
  });

  check("a file that comes back is resurrected, not duplicated", () => {
    buildAndSave("state/reconcile-return.json");
    const specPath = path.join(workspace, "docs/spec.md");
    const backupPath = path.join(workspace, "docs/spec.md.bak2");
    fs.renameSync(specPath, backupPath);
    const engine = new ContextSourceMonitorEngine({ workspace });
    const gone = engine.reconcileInfluenceGraph({ ...opts, previousPath: "state/reconcile-return.json" });
    engine.saveGraphArtifact(gone.graph, "state/reconcile-return.json");
    assert(gone.graph.archive.size > 0, "fixture: something should be archived while the file is missing");
    fs.renameSync(backupPath, specPath);

    const engine2 = new ContextSourceMonitorEngine({ workspace });
    const back = engine2.reconcileInfluenceGraph({ ...opts, previousPath: "state/reconcile-return.json" });
    const specNodes = [...back.graph.nodes.values()].filter((n) => n.path === "docs/spec.md");
    assert(specNodes.length > 0, "the returning file must be mapped again");
    for (const node of specNodes) {
      equal(back.graph.archive.has(node.id), false, "a live node must never also sit in the archive");
    }
  });

  check("the confidence floor drops weak hints but never a confirmed or demoted edge", () => {
    const engine1 = new ContextSourceMonitorEngine({ workspace });
    const first = engine1.buildInfluenceGraph(opts);
    engine1.saveGraphArtifact(first, "state/reconcile-floor.json");
    const hint = [...first.edges.values()][0];
    const from = first.nodes.get(hint.from);
    const to = first.nodes.get(hint.to);
    engine1.confirmInfluence({
      mapPath: "state/reconcile-floor.json",
      sourceFile: from.path,
      sourceInterval: from.interval,
      targetFile: to.path,
      targetInterval: to.interval,
    });

    const engine2 = new ContextSourceMonitorEngine({ workspace });
    const result = engine2.reconcileInfluenceGraph({
      ...opts,
      minConfidence: 0.99,
      previousPath: "state/reconcile-floor.json",
    });
    const survivors = [...result.graph.edges.values()];
    assert(
      survivors.some((e) => e.state === EDGE_STATES.CONFIRMED),
      "a confirmed edge must survive any floor — dropping a judgment to tidy the map destroys the answer",
    );
    assert(!survivors.some((e) => e.state === EDGE_STATES.HINT && e.confidence < 0.99), "weak hints should be gone");
  });

  check("unresolved references are replaced, not accumulated, on every rescan", () => {
    // Found live: reconciling after a source edit rescans every target and
    // re-derives their unresolved references. Appending instead of replacing
    // doubled the list on each pass (61 -> 123 -> 185 ...) while looking like
    // new findings.
    const engine1 = new ContextSourceMonitorEngine({ workspace });
    const first = engine1.buildInfluenceGraph(opts);
    const before = first.unresolved.length;
    assert(before > 0, "fixture: docs/notes.md cites missing/file.md");
    engine1.saveGraphArtifact(first, "state/reconcile-unresolved.json");

    withEdit("docs/spec.md", (text) => `${text}\nAnother appended clarification line.\n`, () => {
      const engine2 = new ContextSourceMonitorEngine({ workspace });
      const result = engine2.reconcileInfluenceGraph({ ...opts, previousPath: "state/reconcile-unresolved.json" });
      equal(result.graph.unresolved.length, before, "the same unresolvable reference must appear exactly once");
    });
  });

  check("a source edit forces every target to be rescanned, not just the changed file", () => {
    // A target that did not change can still gain or lose a relationship
    // because the source's text moved underneath it — restricting the rescan to
    // changed files silently loses those.
    const engine1 = new ContextSourceMonitorEngine({ workspace });
    const first = engine1.buildInfluenceGraph(opts);
    engine1.saveGraphArtifact(first, "state/reconcile-rescan.json");

    withEdit("docs/spec.md", (text) => `${text}\nYet another appended line.\n`, () => {
      const engine2 = new ContextSourceMonitorEngine({ workspace });
      const result = engine2.reconcileInfluenceGraph({ ...opts, previousPath: "state/reconcile-rescan.json" });
      equal(result.report.rescanReason, "source-side-changed");
      assert(result.report.rescannedTargets > 0, "targets must be rescanned when a source changes");
    });
  });

  check("reconciled output is a valid, re-loadable artifact and the archive is written separately", () => {
    buildAndSave("state/reconcile-roundtrip.json");
    const engine = new ContextSourceMonitorEngine({ workspace });
    const result = engine.reconcileInfluenceGraph({ ...opts, previousPath: "state/reconcile-roundtrip.json" });
    const written = engine.saveGraphArtifact(result.graph, "state/reconcile-roundtrip.json");
    const reloaded = engine.readGraphArtifact("state/reconcile-roundtrip.json");
    equal(reloaded.stats().edges, result.graph.stats().edges);
    const json = JSON.parse(fs.readFileSync(path.join(workspace, written.mapPath), "utf8"));
    assert(json.reconcile, "the persisted map should record what this pass changed");
    assert(!("retiredNodes" in json), "retired records belong in the archive file only");
  });
});

group("engine: infer (content-driven provenance)", () => {
  check("a target with no confirmed edges reports its unexplained regions and ranked candidates", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    const result = engine.inferProvenance({
      mapPath: "state/infer-missing.json",
      sourceRoots: ["docs/spec.md"],
      targetRoots: ["docs/notes.md"],
    });
    equal(result.kind, "inference");
    const target = result.targets.find((t) => t.path === "docs/notes.md");
    assert(target, "the target should be listed");
    assert(target.unexplainedLines > 0);
    assert(
      target.candidates.some((c) => c.path === "docs/spec.md"),
      "the real source must appear as a candidate",
    );
  });

  check("confirmed regions stop being reported as unexplained", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    const mapPath = "state/infer-explained.json";
    engine.confirmInfluence({
      mapPath,
      sourceFile: "docs/spec.md",
      targetFile: "docs/notes.md",
      targetInterval: { start: 5, end: 7 },
    });
    const result = engine.inferProvenance({
      mapPath,
      sourceRoots: ["docs/spec.md"],
      targetRoots: ["docs/notes.md"],
    });
    const target = result.targets.find((t) => t.path === "docs/notes.md");
    if (target) {
      const stillClaimed = target.unexplainedIntervals.some((iv) => iv.start <= 5 && iv.end >= 7);
      assert(!stillClaimed, "a confirmed region must not be re-listed as unexplained");
    }
  });

  check("roles.txt supplies source/target roots when no arguments are given", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    write(`${ARTIFACT_DIR}/roles.txt`, "# roles\nsource: docs/spec.md\ngenerated: docs/other.md\n");
    const roles = engine.loadRoles();
    equal(roles.source, ["docs/spec.md"]);
    equal(roles.generated, ["docs/other.md"]);
    const result = engine.inferProvenance({ mapPath: "state/infer-roles.json" });
    equal(result.sourceRoots, ["docs/spec.md"]);
    equal(result.targetRoots, ["docs/other.md"]);
    fs.unlinkSync(path.join(workspace, ARTIFACT_DIR, "roles.txt"));
  });

  check("a watched read -> write -> citation settles itself without a reader", () => {
    // The convention does the work: agents are told to cite sources in what they write.
    // Where that holds, the tool has WATCHED the derivation -- source read, target
    // written, target cites source -- and direction is observed, not guessed. Those
    // edges should not occupy the judgment queue.
    write("docs/upstream.md", "# Upstream\n\nThe canonical rule is X.\n");
    write("out/derived.md", "# Derived\n\nPer `docs/upstream.md` the rule is X.\n");

    const e = new ContextSourceMonitorEngine({ workspace });
    e.enable();
    e.recordRead("docs/upstream.md", { interval: { start: 1, end: 3 }, tool: "read" });
    e.recordWrite("out/derived.md", { tool: "write" });

    const g = e.buildInfluenceGraph({
      sourceRoots: ["docs"],
      targetRoots: ["out"],
      detectors: ["path-reference"],
      mapPath: "state/observed.json",
    });
    const edges = [...g.edges.values()];
    const obs = edges.filter((x) => x.basis === "observed-read-write");
    assert(obs.length === 1, `expected 1 observed edge, got ${obs.length} of ${edges.length}`);
    equal(obs[0].state, "confirmed");
    assert(obs[0].confidence < 1, "an observation must rank below a reader's judgment");
    assert(/observed:/.test(obs[0].note || ""), "an observed edge must say why");
  });

  check("an observation never settles a citation that disclaims derivation", () => {
    // "NOT FOUND: looked in x" cites x precisely because nothing was drawn from it.
    // This is the false positive that auto-settling would otherwise make permanent.
    write("docs/absent.md", "# Absent\n\nnothing relevant here\n");
    write("out/negative.md", "# Findings\n\nNOT FOUND: no port is declared in `docs/absent.md`.\n");

    const e = new ContextSourceMonitorEngine({ workspace });
    e.enable();
    e.recordRead("docs/absent.md", { interval: { start: 1, end: 3 }, tool: "read" });
    e.recordWrite("out/negative.md", { tool: "write" });

    const g = e.buildInfluenceGraph({
      sourceRoots: ["docs"],
      targetRoots: ["out"],
      detectors: ["path-reference"],
      mapPath: "state/observed-negative.json",
    });
    const into = [...g.edges.values()].filter((x) => g.nodes.get(x.to)?.path === "out/negative.md");
    assert(into.length > 0, "the citation should still produce a hint");
    assert(
      into.every((x) => x.basis !== "observed-read-write"),
      "a disclaiming citation must stay a hint for a reader to judge",
    );
  });

  check("a heredoc body is data, never shell", () => {
    // Observed for real: an agent ran `python3 - <<'PY'` whose script contained
    // `p.write_text(...)` and `>`, and the parser recorded writes to files named `,`,
    // `write`, `citation`, `path")` and `limit)`. Tolerable while writes were only
    // reported; not tolerable once a write drives an automatic provenance decision.
    const cmd = [
      "python3 - <<'PY'",
      "import pathlib",
      "p = pathlib.Path('real.txt')",
      "p.write_text('x > y, citation, limit)')",
      "print('a' > 'b')",
      "PY",
      "echo done > actually-written.txt",
    ].join("\n");
    const writes = extractWrites(cmd, workspace).map((w) => w.filePath);
    equal(writes, ["actually-written.txt"]);
    assert(!stripHeredocs(cmd).includes("write_text"), "the heredoc body must be gone before parsing");
    // A terminator inside the body must not end it early, and unquoted markers work too.
    const nested = ["cat <<EOF", "not EOF really", "EOF", "rm -f x > kept.txt"].join("\n");
    equal(extractWrites(nested, workspace).map((w) => w.filePath), ["kept.txt"]);
  });

  check("provenance is never recorded for a path outside the workspace", () => {
    const e = new ContextSourceMonitorEngine({ workspace });
    e.enable();
    equal(e.recordRead("../../elsewhere/secret.md"), null);
    equal(e.recordWrite("/etc/hosts"), null);
    assert(!e.reads.has("../../elsewhere/secret.md"), "an escaping read must not be stored");
    assert(e.reads.size === 0 && e.writes.size === 0, "nothing outside the workspace is provenance");
  });

  check("only text BEFORE a citation can disclaim it", () => {
    // The asymmetry is the correctness argument. These markers govern what FOLLOWS them.
    // A first version scanned whole lines around the citation and blocked a real edge
    // because "rather than" appeared in the CITED CONTENT ("per `x`, use Gemini rather
    // than Whisper"). Only the lookbehind may veto.
    const lines = [
      "NOT FOUND: no port is declared in `docs/a.md`.",
      "Per `docs/b.md`, use Gemini rather than local Whisper.",
      "Unlike `docs/c.md`, this one is normative.",
    ];
    // column of the citation on each line
    const col = (i, token) => lines[i].indexOf(token);
    assert(disclaimsDerivation(lines, 1, col(0, "`docs/a.md`")), "a preceding NOT FOUND must veto");
    assert(
      !disclaimsDerivation(lines, 2, col(1, "`docs/b.md`")),
      "a contrast AFTER the citation governs the contrasted thing, not the citation",
    );
    assert(disclaimsDerivation(lines, 3, col(2, "`docs/c.md`")), "a preceding 'Unlike' must veto");
  });

  check("an observation requires the read to precede the write", () => {
    write("docs/later.md", "# Later\n\nrule Y\n");
    write("out/early.md", "# Early\n\nsee `docs/later.md`\n");

    const e = new ContextSourceMonitorEngine({ workspace });
    e.enable();
    e.recordWrite("out/early.md", { tool: "write" });
    const w = e.writes.get("out/early.md");
    w.firstWriteAt = w.lastWriteAt = "2020-01-01T00:00:00.000Z"; // write long before the read
    e.recordRead("docs/later.md", { interval: { start: 1, end: 3 }, tool: "read" });

    const g = e.buildInfluenceGraph({
      sourceRoots: ["docs"],
      targetRoots: ["out"],
      detectors: ["path-reference"],
      mapPath: "state/observed-order.json",
    });
    assert(
      [...g.edges.values()].every((x) => x.basis !== "observed-read-write"),
      "a citation written before its source was ever read is not observed derivation",
    );
  });

  check("a reader's judgment outranks a later observation", () => {
    const g = new InfluenceGraph();
    const a = g.ensureFileNode("docs/upstream.md", { content: "x" });
    const b = g.ensureFileNode("out/derived.md", { content: "y" });
    g.addEdge({ from: a.id, to: b.id, state: "confirmed", confidence: 1, note: "read both, vouched" });
    g.addEdge({ from: a.id, to: b.id, state: "confirmed", confidence: 0.9, basis: "observed-read-write" });
    const edge = g.edges.get(`${a.id}->${b.id}`);
    equal(edge.confidence, 1);
    assert(!edge.basis, "an observation must not overwrite a judged edge's basis");
  });

  check("a gitignored tree declared in roles.txt is still in coverage scope", () => {
    // The case this fixes: a locally mounted dependency -- a cloned service repo, a
    // vendored upstream -- is gitignored BECAUSE it is an independent git tree, and is
    // simultaneously the most important material in the workspace. Before this, the tool
    // contradicted itself: `influence --sources` scanned it with gitignore off and built
    // edges out of it, while `coverage` reported zero files in scope. Coverage read 0% of
    // everything and the reason was invisible.
    write("vendor/dep/main.py", "print('x')\n");
    write("vendor/dep/.gitignore", "artifact.txt\n");
    write("vendor/dep/artifact.txt", "generated, must stay out\n");
    write("vendor/dep/node_modules/pkg/index.js", "module.exports = 1\n");
    write(".gitignore", `${readIfExists(".gitignore")}\nvendor/\n`);

    const plain = new ContextSourceMonitorEngine({ workspace });
    const before = plain.scan({ force: true }).map((f) => f.relPath);
    assert(!before.some((p) => p.startsWith("vendor/")), "gitignore alone must hide the tree");

    write(`${ARTIFACT_DIR}/roles.txt`, "source: vendor\n");
    const declared = new ContextSourceMonitorEngine({ workspace });
    const after = declared.scan({ force: true }).map((f) => f.relPath);
    assert(after.includes("vendor/dep/main.py"), `declaring a role must restore scope, got: ${after.filter((p) => p.startsWith("vendor")).join(", ")}`);
    // The clone's OWN .gitignore keeps filtering inside it, and hard ignores hold.
    assert(!after.includes("vendor/dep/artifact.txt"), "a nested .gitignore must still apply inside a re-included tree");
    assert(!after.some((p) => p.includes("node_modules")), "hard ignores must hold inside a re-included tree");
    // And opting out is still possible.
    const opted = declared.scan({ force: true, declaredRoots: false }).map((f) => f.relPath);
    assert(!opted.some((p) => p.startsWith("vendor/")), "declaredRoots:false must restore the old behaviour");

    fs.unlinkSync(path.join(workspace, ARTIFACT_DIR, "roles.txt"));
  });

  check("a retired path returns a re-investigation packet with the old text and current targets", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    const mapPath = "state/infer-retired.json";
    const graph = new InfluenceGraph();
    const src = graph.ensureSpanNode(
      "docs/spec.md",
      { start: 4, end: 5 },
      fs.readFileSync(path.join(workspace, "docs/spec.md"), "utf8"),
    );
    const tgt = graph.ensureFileNode("docs/notes.md", {
      content: fs.readFileSync(path.join(workspace, "docs/notes.md"), "utf8"),
    });
    graph.addEdge({ from: src.node.id, to: tgt.id, state: EDGE_STATES.CONFIRMED, confidence: 1 });
    graph.retireNode(src.node.id, RETIRE_REASONS.CONTENT_CHANGED);
    engine.saveGraphArtifact(graph, mapPath);

    const result = engine.inferProvenance({ mapPath, sourceFile: "docs/spec.md" });
    equal(result.kind, "reinvestigation");
    equal(result.packets.length, 1);
    assert(result.packets[0].retiredContent, "the retired text must be handed back for re-reading");
    equal(result.packets[0].affectedTargets.length, 1);
    assert(result.packets[0].affectedTargets[0].currentContent, "and the target's CURRENT content, to compare against");
  });

  check("resolving a retired record moves it out of the queue", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    const mapPath = "state/infer-resolve.json";
    const graph = new InfluenceGraph();
    const src = graph.ensureFileNode("docs/spec.md", { content: "x\n" });
    const tgt = graph.ensureFileNode("docs/notes.md", { content: "y\n" });
    graph.addEdge({ from: src.id, to: tgt.id, state: EDGE_STATES.CONFIRMED, confidence: 1 });
    graph.retireNode(src.id, RETIRE_REASONS.CONTENT_CHANGED);
    engine.saveGraphArtifact(graph, mapPath);

    const result = engine.resolveRetired({ mapPath, nodeId: src.id, into: ["s_whatever"], note: "re-derived" });
    assert(result.ok, JSON.stringify(result));
    const reloaded = engine.readGraphArtifact(mapPath);
    equal(reloaded.archive.retiredNodes.size, 0);
    equal(reloaded.archive.resolvedNodes.size, 1);
  });

  check("resolving an unknown node fails loudly", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    const mapPath = "state/infer-resolve-missing.json";
    engine.saveGraphArtifact(new InfluenceGraph(), mapPath);
    equal(engine.resolveRetired({ mapPath, nodeId: "s_nope" }).ok, false);
  });
});

group("engine: pending review", () => {
  check("a write with no confirmed edge as target is stale; one with a confirmed edge is not", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    const graph = new InfluenceGraph();
    const src = graph.ensureFileNode("docs/spec.md", { content: "source\n" });
    const tgt = graph.ensureSpanNode("docs/notes.md", { start: 6, end: 7 }, fs.readFileSync(path.join(workspace, "docs/notes.md"), "utf8"));
    graph.addEdge({ from: src.id, to: tgt.node.id, state: EDGE_STATES.CONFIRMED, confidence: 1 });

    engine.recordWrite("docs/notes.md", { interval: tgt.node.interval }); // explained
    engine.recordWrite("docs/notes.md", { interval: { start: 30, end: 30 } }); // NOT explained
    const pending = engine.pendingReview(graph);
    assert(!pending.staleWrites.some((w) => w.interval.start === tgt.node.interval.start), "an explained write must not be stale");
    assert(pending.staleWrites.some((w) => w.interval.start === 30), "an unexplained write must be stale");
  });

  check("a read with no confirmed edge as source is stale; one with a confirmed edge is not", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    const graph = new InfluenceGraph();
    const src = graph.ensureSpanNode("docs/spec.md", { start: 4, end: 5 }, fs.readFileSync(path.join(workspace, "docs/spec.md"), "utf8"));
    const tgt = graph.ensureFileNode("docs/notes.md", { content: "target\n" });
    graph.addEdge({ from: src.node.id, to: tgt.id, state: EDGE_STATES.CONFIRMED, confidence: 1 });

    engine.recordRead("docs/spec.md", { interval: src.node.interval }); // explained
    engine.recordRead("docs/spec.md", { interval: { start: 8, end: 8 } }); // NOT explained
    const pending = engine.pendingReview(graph);
    assert(!pending.staleReads.some((r) => r.interval.start === src.node.interval.start), "an explained read must not be stale");
    assert(pending.staleReads.some((r) => r.interval.start === 8), "an unexplained read must be stale");
  });

  check("demoted edges and retired records are surfaced as their own queues", () => {
    const engine = new ContextSourceMonitorEngine({ workspace });
    const graph = new InfluenceGraph();
    const src = graph.ensureFileNode("docs/spec.md", { content: "source\n" });
    const tgt = graph.ensureFileNode("docs/notes.md", { content: "target\n" });
    const edge = graph.addEdge({ from: src.id, to: tgt.id, state: EDGE_STATES.CONFIRMED, confidence: 1 });
    graph.demoteEdge(edge.id, "source-file-content-changed");

    const other = graph.ensureFileNode("docs/other.md", { content: "other\n" });
    graph.addEdge({ from: other.id, to: tgt.id, state: EDGE_STATES.CONFIRMED, confidence: 1 });
    graph.retireNode(other.id, RETIRE_REASONS.CONTENT_CHANGED);

    const pending = engine.pendingReview(graph);
    equal(pending.needsReconfirm.length, 1);
    equal(pending.needsReconfirm[0].priorState, EDGE_STATES.CONFIRMED);
    equal(pending.retired.length, 1);
    equal(pending.retired[0].path, "docs/other.md");
  });
});

group("engine: persistence", () => {
  check("state round-trips through disk", () => {
    const statePath = "state/monitor.json";
    const engine = new ContextSourceMonitorEngine({ workspace, statePath });
    engine.enable("session-1");
    engine.recordRead("docs/spec.md", { interval: { start: 1, end: 4 }, tool: "read" });
    engine.recordWrite("docs/notes.md", { tool: "edit" });
    engine.annotateFile("docs/spec.md", "the authoritative L3VPN spec");
    engine.save();

    const reopened = ContextSourceMonitorEngine.open({ workspace, statePath });
    equal(reopened.isTracking(), true);
    equal(reopened.reads.get("docs/spec.md").intervals, [{ start: 1, end: 4 }]);
    equal(reopened.writes.get("docs/notes.md").writeCount, 1);
    equal(reopened.annotations.get("docs/spec.md").description, "the authoritative L3VPN spec");
  });
  check("coverage survives a restart (cross-session accumulation)", () => {
    const statePath = "state/monitor2.json";
    const first = new ContextSourceMonitorEngine({ workspace, statePath });
    first.recordRead("docs/spec.md", { interval: { start: 1, end: 3 } });
    first.save();
    const second = ContextSourceMonitorEngine.open({ workspace, statePath });
    second.recordRead("docs/spec.md", { interval: { start: 4, end: 9 } });
    const file = second.coverage().files.find((f) => f.relPath === "docs/spec.md");
    equal(file.status, "FULLY_READ", "intervals from both sessions must combine");
  });
  check("incompatible state is rejected rather than misread", () => {
    const bad = path.join(workspace, "state/bad.json");
    fs.mkdirSync(path.dirname(bad), { recursive: true });
    fs.writeFileSync(bad, JSON.stringify({ schemaVersion: "99.0.0" }), "utf8");
    let threw = false;
    try {
      new ContextSourceMonitorEngine({ workspace }).load("state/bad.json");
    } catch {
      threw = true;
    }
    assert(threw, "must refuse a future schema");
    // open() must degrade gracefully instead of crashing the session
    const engine = ContextSourceMonitorEngine.open({ workspace, statePath: "state/bad.json" });
    equal(engine.isTracking(), false);
  });
  check("atomic save leaves no temp files behind", () => {
    const engine = new ContextSourceMonitorEngine({ workspace, statePath: "state/atomic.json" });
    engine.save();
    const leftovers = fs.readdirSync(path.join(workspace, "state")).filter((f) => f.includes(".tmp"));
    equal(leftovers, []);
  });
  check("an influence map with an incompatible schema is refused, not misread", () => {
    write("state/old-map.json", JSON.stringify({ kind: "influence-graph", schemaVersion: "1.0.0", nodes: [], edges: [] }));
    const engine = new ContextSourceMonitorEngine({ workspace });
    equal(engine.readGraphArtifact("state/old-map.json"), null);
  });
});

group("plugin: hook wiring", () => {
  check("read output footer gives the exact interval", () => {
    equal(parseReadOutputInterval("(Showing lines 1713-2175 of 2175 lines)"), { start: 1713, end: 2175 });
  });
  check("line-numbered content gives the interval when no footer exists", () => {
    equal(parseReadOutputInterval("1: alpha\n2: beta\n3: gamma\n"), { start: 1, end: 3 });
  });
  check("non-file output yields no interval", () => {
    equal(parseReadOutputInterval("docs/\nsrc/\n"), null);
  });

  const makePlugin = async () => {
    // the plugin caches one engine per workspace and persists to its default
    // artifact path; clear both so each check starts from nothing
    resetEngineCache();
    const statePath = path.join(workspace, "data/research/context-source-monitor/state.json");
    if (fs.existsSync(statePath)) fs.unlinkSync(statePath);
    const hooks = await ContextSourceMonitorPlugin({
      directory: workspace,
      worktree: workspace,
      client: { app: { log: async () => {} } },
    });
    return hooks;
  };

  check("read is tracked with the REAL (input, output) signature", async () => {
    const hooks = await makePlugin();
    await hooks.tool.context_source_monitor.execute({ action: "enable" }, { sessionID: "s1" });
    const input = { tool: "read", sessionID: "s1", callID: "c1" };
    await hooks["tool.execute.before"](input, { args: { filePath: "docs/spec.md", offset: 1, limit: 4 } });
    await hooks["tool.execute.after"](
      { ...input, args: { filePath: "docs/spec.md" } },
      { title: "", output: "1: a\n2: b\n3: c\n4: d\n", metadata: {} },
    );
    const status = await hooks.tool.context_source_monitor.execute({ action: "status" }, { sessionID: "s1" });
    assert(/coverage: (?!0%)/.test(status), `nothing was tracked: ${status}`);
  });

  check("bash reads/writes are recorded as fallback", async () => {
    const hooks = await makePlugin();
    await hooks.tool.context_source_monitor.execute({ action: "enable" }, { sessionID: "s1" });
    await hooks["tool.execute.before"](
      { tool: "bash", sessionID: "s1", callID: "b1" },
      { args: { command: "head -n 3 docs/spec.md > out/copy.md" } },
    );
    const out = await hooks.tool.context_source_monitor.execute({ action: "status" }, { sessionID: "s1" });
    assert(/files written: [1-9]/.test(out), `bash write not tracked: ${out}`);
  });

  check("subagent prompts are augmented via output.args", async () => {
    const hooks = await makePlugin();
    await hooks.tool.context_source_monitor.execute({ action: "enable" }, { sessionID: "s1" });
    const output = { args: { prompt: "do the thing" } };
    await hooks["tool.execute.before"]({ tool: "task", sessionID: "s1", callID: "t1" }, output);
    assert(output.args.prompt.includes("CONTEXT SOURCE MONITOR"), "prompt not augmented");
  });

  check("nothing is tracked while disabled", async () => {
    const hooks = await makePlugin();
    await hooks["tool.execute.before"](
      { tool: "read", sessionID: "s1", callID: "c9" },
      { args: { filePath: "docs/spec.md" } },
    );
    const out = await hooks.tool.context_source_monitor.execute({ action: "status" }, { sessionID: "s1" });
    assert(/tracking: inactive/.test(out), out);
    assert(/coverage: 0%/.test(out), `should be untracked: ${out}`);
  });

  check("system prompt is injected only while tracking", async () => {
    const hooks = await makePlugin();
    const off = { system: [] };
    await hooks["experimental.chat.system.transform"]({}, off);
    equal(off.system.length, 0);
    await hooks.tool.context_source_monitor.execute({ action: "enable" }, { sessionID: "s1" });
    const on = { system: [] };
    await hooks["experimental.chat.system.transform"]({}, on);
    equal(on.system.length, 1);
  });

  check("loading the plugin twice shares one engine (no double counting)", async () => {
    resetEngineCache();
    const statePath = path.join(workspace, "data/research/context-source-monitor/state.json");
    if (fs.existsSync(statePath)) fs.unlinkSync(statePath);

    const ctx = { directory: workspace, worktree: workspace, client: { app: { log: async () => {} } } };
    const a = await ContextSourceMonitorPlugin(ctx);
    const b = await ContextSourceMonitorPlugin(ctx); // e.g. auto-load + a stale opencode.json entry
    await a.tool.context_source_monitor.execute({ action: "enable" }, { sessionID: "s1" });

    for (const hooks of [a, b]) {
      await hooks["tool.execute.before"](
        { tool: "read", sessionID: "s1", callID: "dup" },
        { args: { filePath: "docs/spec.md" } },
      );
      await hooks["tool.execute.after"](
        { tool: "read", sessionID: "s1", callID: "dup", args: {} },
        { output: "(Showing lines 1-8 of 8)", title: "", metadata: {} },
      );
    }
    const out = await b.tool.context_source_monitor.execute({ action: "status" }, { sessionID: "s1" });
    assert(/fully read 1 /.test(out), `expected one fully-read file, got: ${out}`);
  });

  check("tool args are optional (all-required schema regression)", async () => {
    const hooks = await makePlugin();
    const shape = hooks.tool.context_source_monitor.args;
    const required = Object.entries(shape).filter(([, schema]) => !schema.isOptional());
    equal(required.map(([name]) => name), ["action"], "only action may be required");
  });

  check("influence -> confirm -> reconcile round-trips through the tool interface", async () => {
    const hooks = await makePlugin();
    await hooks.tool.context_source_monitor.execute({ action: "enable" }, { sessionID: "s1" });
    const mapFile = "state/plugin-map.json";
    const built = await hooks.tool.context_source_monitor.execute(
      { action: "influence", sources: "docs/spec.md", targets: "docs/notes.md", outFile: mapFile },
      { sessionID: "s1" },
    );
    assert(/built from scratch/.test(built), built);

    const confirmed = await hooks.tool.context_source_monitor.execute(
      { action: "confirm", mapFile, sourceFile: "docs/spec.md", targetFile: "docs/notes.md" },
      { sessionID: "s1" },
    );
    assert(/^Confirmed:/.test(confirmed), confirmed);

    const reconciled = await hooks.tool.context_source_monitor.execute(
      { action: "reconcile", sources: "docs/spec.md", targets: "docs/notes.md", mapFile },
      { sessionID: "s1" },
    );
    assert(/nothing changed/.test(reconciled), reconciled);
  });

  check("reject action removes a hint through the tool interface", async () => {
    const hooks = await makePlugin();
    await hooks.tool.context_source_monitor.execute({ action: "enable" }, { sessionID: "s1" });
    const mapFile = "state/plugin-reject-map.json";
    await hooks.tool.context_source_monitor.execute(
      { action: "influence", sources: "docs/spec.md", targets: "docs/other.md", outFile: mapFile },
      { sessionID: "s1" },
    );
    // Discover the edge's exact endpoints rather than assume a scope -- a
    // citation's source is the whole cited FILE (no interval), while its target
    // is a span, so the arguments differ per side.
    const map = JSON.parse(fs.readFileSync(path.join(workspace, mapFile), "utf8"));
    const edge = map.edges[0];
    const fromNode = map.nodes.find((n) => n.id === edge.from);
    const toNode = map.nodes.find((n) => n.id === edge.to);
    const asInterval = (node) => (node.interval ? `${node.interval.start}-${node.interval.end}` : undefined);
    const rejected = await hooks.tool.context_source_monitor.execute(
      {
        action: "reject",
        mapFile,
        sourceFile: fromNode.path,
        sourceInterval: asInterval(fromNode),
        targetFile: toNode.path,
        targetInterval: asInterval(toNode),
      },
      { sessionID: "s1" },
    );
    assert(/^Rejected/.test(rejected), rejected);
  });

  check("pending action reports stale writes through the tool interface", async () => {
    const hooks = await makePlugin();
    await hooks.tool.context_source_monitor.execute({ action: "enable" }, { sessionID: "s1" });
    await hooks["tool.execute.after"](
      { tool: "write", sessionID: "s1", callID: "w1", args: { filePath: "docs/notes.md" } },
      { output: "", title: "", metadata: {} },
    );
    const result = await hooks.tool.context_source_monitor.execute({ action: "pending" }, { sessionID: "s1" });
    assert(/stale writes/.test(result.title), JSON.stringify(result));
  });
});

// ---------------------------------------------------------------------------

async function run() {
  await runQueue();

  process.stdout.write("\n");
  if (failed === 0) {
    process.stdout.write(`All ${passed} checks passed.\n`);
  } else {
    process.stdout.write(`${passed} passed, ${failed} FAILED\n`);
    for (const f of failures) process.stdout.write(`  - ${f.name}: ${f.error.message}\n`);
  }
  try {
    fs.rmSync(workspace, { recursive: true, force: true });
  } catch {}
  process.exit(failed === 0 ? 0 : 1);
}

run();
