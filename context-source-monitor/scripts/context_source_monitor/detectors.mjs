/**
 * Scaffold: cheap, mechanical first-pass "hint" edges.
 *
 * NOT authoritative. It turns a blank map into a probable starting point fast,
 * at machine scale, before any LLM reads a line. Every edge carries
 * `state: "hint"` at one uniform low confidence (HINT_CONFIDENCE) —
 * deliberately not a spectrum by mechanism, because once a hint stops being
 * ground truth, *how* it was found stops mattering; only whether a reader
 * confirms it does. No detector name and no evidence blob is persisted.
 *
 * Node scope choices here matter more than they look (see graph.mjs):
 *   - A citation's SOURCE is the cited file as a whole, so it is a FILE-scope
 *     node. Content-addressing a whole file would mean one typo in a corpus
 *     document changes the source's identity and mass-archives every edge out
 *     of it, confirmed ones included.
 *   - A citation's TARGET is the citing line, which is far too little text to
 *     be identifiable on its own ("" or "---" recurs everywhere in a file), so
 *     it goes through `ensureSpanNode`, which widens it to a distinctive region
 *     or demotes it to file scope rather than minting an ambiguous node.
 */

import { splitLines, linesToIntervals } from "./text.mjs";
import { ShingleIndex, DEFAULT_OVERLAP_OPTIONS } from "./overlap.mjs";

/** Uniform confidence for every scaffold-proposed hint, regardless of mechanism. */
export const HINT_CONFIDENCE = 0.3;

/** Which internal scaffold mechanisms exist, for the `detectors` option. Not persisted on edges. */
export const SCAFFOLD_MECHANISMS = ["path-reference", "entity-mention", "content-overlap"];

/**
 * A "directory" resolution fanning out past this many files carries no
 * file-specific signal at all (it is indistinguishable for every sibling) —
 * skip hint generation entirely rather than propose noise. A genuinely
 * specific subdirectory (one document's own corpus folder) stays well under
 * this; a bare corpus root does not.
 */
export const GENERIC_FANOUT_THRESHOLD = 6;

/** Lines of context a bare citation line gets before it is asked to stand as a span. */
export const CITATION_CONTEXT_LINES = 2;

// ---------------------------------------------------------------------------
// Reference extraction
// ---------------------------------------------------------------------------

const IMPORT_PATTERNS = [
  /(?:^|\s)(?:import|export)\s[^;\n]*?\bfrom\s+["']([^"']+)["']/g,
  /(?:^|\s)import\s+["']([^"']+)["']/g,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /(?:^|\s)from\s+([A-Za-z0-9_.]+)\s+import\s/g,
  /#include\s+["<]([^">]+)[">]/g,
  /@import\s+["']?([^"';\s]+)/g,
  /(?:^|\s)(?:source|\.)\s+(\.{0,2}\/[^\s;|&]+)/g,
  /\{%-?\s*(?:include|import|extends|from)\s+["']([^"']+)["']/g,
];

const CITATION_PATTERNS = [
  { re: /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, kind: "markdown-link" },
  { re: /^\s*\[[^\]]+\]:\s*(\S+)/gm, kind: "markdown-ref" },
  { re: /`([^`\n]*?[\w.\-]+\/[^`\n]*?)`/g, kind: "inline-code-path" },
  { re: /(?:^|\s)@([\w.\-][\w.\-/]*\.[A-Za-z0-9]{1,8})\b/g, kind: "at-reference" },
  { re: /(?:^|[\s(<"'])((?:\.{0,2}\/)?(?:[\w.\-]+\/)+[\w.\-]+\.[A-Za-z0-9]{1,8})/g, kind: "bare-path" },
  { re: /(?:^|[\s(<"'`])((?:[\w.\-]+\/){1,8})(?=[\s)>"'`,.]|$)/g, kind: "bare-directory" },
];

/** Extract candidate references with their line numbers. */
export function extractReferences(content) {
  const lines = splitLines(content);
  const offsets = [];
  let cursor = 0;
  for (const line of lines) {
    offsets.push(cursor);
    cursor += line.length + 1;
  }
  const lineOf = (index) => {
    let lo = 0;
    let hi = offsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (offsets[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };

  const seen = new Set();
  const out = [];
  const push = (raw, index, kind) => {
    if (!raw) return;
    const line = lineOf(index);
    const key = `${kind}|${raw}|${line}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ raw, line, kind });
  };

  for (const re of IMPORT_PATTERNS) {
    re.lastIndex = 0;
    for (const m of content.matchAll(re)) push(m[1], m.index ?? 0, "import");
  }
  for (const { re, kind } of CITATION_PATTERNS) {
    re.lastIndex = 0;
    for (const m of content.matchAll(re)) push(m[1], m.index ?? 0, kind);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Path / import / entity-mention hints
// ---------------------------------------------------------------------------

/**
 * Propose citation- and mention-based hints for one target file.
 *
 * @param {object} args
 * @param {import("./graph.mjs").InfluenceGraph} args.graph
 * @param {import("./resolve.mjs").WorkspaceIndex} args.index
 * @param {string} args.relPath   the file being scanned (the influenced side)
 * @param {string} args.content
 * @param {object} [args.options]
 */
export function detectReferences({ graph, index, relPath, content, options = {} }) {
  const fanoutThreshold = options.genericFanoutThreshold ?? GENERIC_FANOUT_THRESHOLD;
  const sourceFilter = options.sourceFilter || null;
  const allows = (candidate) => !sourceFilter || sourceFilter.has(candidate);
  const stats = { edges: 0, unresolved: 0, skippedOutOfScope: 0, skippedGeneric: 0 };
  const explicit = new Set(); // citation anchors, so a weaker entity mention does not restate them

  /** The citing line plus a little context — enough text to be identifiable. */
  const citationSpan = (line) => ({
    start: Math.max(1, line - CITATION_CONTEXT_LINES),
    end: line + CITATION_CONTEXT_LINES,
  });

  const emit = (sourceRel, targetInterval) => {
    const sourceContent = options.loadContent(sourceRel);
    if (sourceContent === null || sourceContent === undefined) return false;
    // Source = the cited file as a whole: file scope, so editing it does not
    // change its identity (only demotes its edges for re-review).
    const fromNode = graph.ensureFileNode(sourceRel, { content: sourceContent });
    const { node: toNode } = graph.ensureSpanNode(relPath, targetInterval, content);
    if (fromNode.id === toNode.id) return false;
    graph.addEdge({ from: fromNode.id, to: toNode.id, confidence: HINT_CONFIDENCE });
    return true;
  };

  for (const ref of extractReferences(content)) {
    const resolution = index.resolveReference(ref.raw, relPath, { directoryFanoutCap: fanoutThreshold * 4 });
    if (!resolution.ok) {
      const worthReporting =
        resolution.reason !== "empty-after-cleaning" && (ref.kind === "import" || index.isPathShaped(ref.raw));
      if (worthReporting) {
        graph.addUnresolved({ raw: ref.raw, kind: ref.kind, path: relPath, line: ref.line, reason: resolution.reason });
        stats.unresolved++;
      }
      continue;
    }

    const isDirectoryKind = resolution.kind === "directory" || resolution.kind === "derived-directory";
    if (isDirectoryKind && (resolution.totalInDirectory ?? resolution.relPaths.length) > fanoutThreshold) {
      stats.skippedGeneric++;
      continue;
    }

    const targetInterval = citationSpan(ref.line);
    for (const sourceRel of resolution.relPaths) {
      if (sourceRel === relPath) continue;
      if (!allows(sourceRel)) {
        stats.skippedOutOfScope++;
        continue;
      }
      if (emit(sourceRel, targetInterval)) {
        explicit.add(`${sourceRel}|${ref.line}`);
        stats.edges++;
      }
    }
  }

  // Entity mentions: names that map to a file without an explicit path.
  if (options.entityMentions !== false) {
    const lines = splitLines(content);
    const maxHintsPerFile = options.maxMentionEdgesPerFile ?? 60;
    let emitted = 0;
    for (const mention of index.findEntityMentions(content, lines, { directoryFanoutCap: fanoutThreshold })) {
      if (emitted >= maxHintsPerFile) break;
      const targetInterval = citationSpan(mention.line);
      for (const sourceRel of mention.relPaths) {
        if (sourceRel === relPath) continue;
        if (!allows(sourceRel)) {
          stats.skippedOutOfScope++;
          continue;
        }
        if (explicit.has(`${sourceRel}|${mention.line}`)) continue; // an explicit citation already covers this
        if (emit(sourceRel, targetInterval)) {
          stats.edges++;
          emitted++;
        }
      }
    }
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Content overlap
// ---------------------------------------------------------------------------

/**
 * Propose content-overlap hints. Target line-hits are clustered by proximity
 * (not snapped to an enclosing structural block — a heading with no closing
 * sibling spans to end-of-file, which made block-snapped identity shift on
 * edits far from the actually-matched text). Each cluster becomes one hint:
 * a tight target span, and a source span enveloping whichever source lines
 * matched into that cluster.
 *
 * Both sides go through `ensureSpanNode`, so a match too thin to identify by
 * content is represented at file scope instead of as an ambiguous span.
 */
export function detectContentOverlap({ graph, sources, targets, options = {} }) {
  const opts = { ...DEFAULT_OVERLAP_OPTIONS, ...options };
  const index = new ShingleIndex(opts);
  for (const source of sources) {
    if (!source.content) continue;
    index.addDocument(source.relPath, source.content);
  }
  index.prune();

  const stats = { edges: 0, comparedTargets: 0, prunedShingles: index.prunedAt?.remainingShingles ?? 0 };

  for (const target of targets) {
    if (!target.content) continue;
    stats.comparedTargets++;
    const matches = index.match(target.relPath, target.content);

    for (const match of matches) {
      if (match.sourcePath === target.relPath) continue;
      const sourceEntry = sources.find((s) => s.relPath === match.sourcePath);
      if (!sourceEntry) continue;

      const targetClusters = linesToIntervals(match.targetLines, opts.intervalTolerance);
      for (const cluster of targetClusters) {
        const sourceLines = match.pairs
          .filter((p) => p.targetLine >= cluster.start && p.targetLine <= cluster.end)
          .map((p) => p.sourceLine);
        if (sourceLines.length === 0) continue;
        const sourceInterval = { start: Math.min(...sourceLines), end: Math.max(...sourceLines) };

        const { node: fromNode } = graph.ensureSpanNode(match.sourcePath, sourceInterval, sourceEntry.content);
        const { node: toNode } = graph.ensureSpanNode(target.relPath, cluster, target.content);
        if (fromNode.id === toNode.id) continue;
        graph.addEdge({ from: fromNode.id, to: toNode.id, confidence: HINT_CONFIDENCE });
        stats.edges++;
      }
    }
  }

  return stats;
}
