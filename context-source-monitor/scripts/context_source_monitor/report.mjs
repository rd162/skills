/**
 * Human-readable renderers for coverage snapshots, influence maps, and
 * inference packets. Numbers come straight from the snapshot/graph — no
 * recomputation, so a report can never disagree with the data it renders.
 *
 * The retired archive is deliberately NOT rendered anywhere: it is a machine
 * work-queue read through `pending`/`infer`, and mixing retired records into a
 * human-facing provenance report is exactly how a stale claim gets mistaken
 * for a current one.
 */

import { formatIntervals } from "./text.mjs";

const MAX_LIST = 40;

export function renderCoverageMarkdown(snapshot, options = {}) {
  const t = snapshot.totals;
  const limit = options.limit ?? MAX_LIST;
  const saturated = t.unreadIntervals === 0;

  const out = [];
  out.push("# Context source coverage");
  out.push("");
  out.push(`- generated: ${snapshot.generatedAt}`);
  out.push(`- workspace: \`${snapshot.workspace}\``);
  out.push(`- scope: \`${snapshot.scope}\``);
  out.push(`- tracking: ${snapshot.active ? "active" : "inactive"}`);
  out.push("");
  out.push("| metric | value |");
  out.push("| :-- | --: |");
  out.push(`| line coverage | ${t.lineCoveragePercent}% (${t.linesRead} / ${t.lines}) |`);
  out.push(`| file coverage | ${t.fileCoveragePercent}% (${t.filesFullyRead} / ${t.files}) |`);
  out.push(`| partially read | ${t.filesPartiallyRead} |`);
  out.push(`| unread | ${t.filesUnread} |`);
  out.push(`| unread intervals | ${t.unreadIntervals} |`);
  out.push(`| files written | ${t.filesWritten} |`);
  if (t.readOutsideScope) out.push(`| read outside scope | ${t.readOutsideScope} |`);
  out.push("");

  if (saturated) {
    out.push(`All ${t.files} files in scope are fully read (${t.lines} lines). No unread intervals remain.`);
    out.push("");
  } else {
    const partial = snapshot.files.filter((f) => f.status === "PARTIALLY_READ");
    if (partial.length) {
      out.push(`## Partially read (${partial.length})`);
      out.push("");
      for (const f of partial.slice(0, limit)) {
        out.push(`### \`${f.relPath}\``);
        out.push(`- read: ${formatIntervals(f.readIntervals)} — ${f.linesRead}/${f.lines} lines (${f.coveragePercent}%)`);
        if (f.description) out.push(`- description: ${f.description}`);
        for (const gap of f.unreadIntervals) {
          const count = gap.end - gap.start + 1;
          out.push(
            `- unread ${gap.start}-${gap.end} (${count} lines) → \`read(filePath: "${f.relPath}", offset: ${gap.start}, limit: ${count})\``,
          );
        }
        const unreadBlocks = (f.blocks || []).filter((b) => b.status !== "READ");
        for (const b of unreadBlocks.slice(0, 8)) {
          out.push(
            `  - ${b.status === "UNREAD" ? "unread" : "partial"}: ${b.name} (L${b.startLine}-${b.endLine}, ${b.linesUnread} lines missing)`,
          );
        }
        if (unreadBlocks.length > 8) out.push(`  - ... ${unreadBlocks.length - 8} more blocks`);
        out.push("");
      }
      if (partial.length > limit) out.push(`... ${partial.length - limit} more partially read files`, "");
    }

    const unread = snapshot.files.filter((f) => f.status === "UNREAD").sort((a, b) => b.lines - a.lines);
    if (unread.length) {
      out.push(`## Unread (${unread.length})`);
      out.push("");
      out.push("| file | lines | action |");
      out.push("| :-- | --: | :-- |");
      for (const f of unread.slice(0, limit)) {
        out.push(`| \`${f.relPath}\` | ${f.lines} | \`read(filePath: "${f.relPath}")\` |`);
      }
      out.push("");
      if (unread.length > limit) out.push(`... ${unread.length - limit} more unread files`, "");
    }
  }

  const touched = snapshot.files.filter((f) => f.readCount > 0 || f.writeCount > 0);
  if (touched.length) {
    out.push(`## Touched this session (${touched.length})`);
    out.push("");
    out.push("| file | read | lines read | coverage | writes |");
    out.push("| :-- | --: | :-- | --: | --: |");
    for (const f of touched.slice(0, limit)) {
      out.push(
        `| \`${f.relPath}\` | ${f.readCount} | ${formatIntervals(f.readIntervals)} | ${f.coveragePercent}% | ${f.writeCount} |`,
      );
    }
    out.push("");
  }

  return `${out.join("\n")}\n`;
}

/** One node as a location. File-scope nodes have no interval — say so, don't fake one. */
function loc(node) {
  if (!node) return "(unknown)";
  if (node.interval) return `\`${node.path}\`:${node.interval.start}-${node.interval.end}`;
  return `\`${node.path}\` (whole file)`;
}

const STATE_SECTIONS = [
  ["Confirmed", "confirmed"],
  ["Needs re-confirmation — content moved under a settled edge", "needs-reconfirm"],
  ["Hints — needs review", "hint"],
];

/** Settled by watching the work, not by a reader: `basis: "observed-read-write"`. */
export function splitObserved(edges) {
  const observed = [];
  const judged = [];
  for (const e of edges) (e.basis === "observed-read-write" ? observed : judged).push(e);
  return { observed, judged };
}

export function renderInfluenceMarkdown(graph, options = {}) {
  const limit = options.limit ?? 25;
  const stats = graph.stats();
  const nodes = graph.nodes;

  const out = [];
  out.push("# Influence map");
  out.push("");
  out.push(`- nodes: ${stats.nodes} (${Object.entries(stats.byScope).map(([s, n]) => `${s}: ${n}`).join(", ") || "none"})`);
  out.push(
    `- edges: ${stats.edges} (${Object.entries(stats.byState).map(([s, n]) => `${s}: ${n}`).join(", ") || "none"}, avg confidence ${stats.averageConfidence})`,
  );
  out.push(`- unresolved references: ${stats.unresolvedReferences}`);
  if (stats.archived?.retiredNodes) {
    out.push(
      `- retired (archived, awaiting re-investigation): ${stats.archived.retiredNodes} nodes / ${stats.archived.retiredEdges} edges` +
        (stats.archived.resolvedNodes ? `, ${stats.archived.resolvedNodes} already resolved` : ""),
    );
  }
  out.push("");
  out.push("Edge direction: **source → target**, i.e. the source influenced the target.");
  out.push(
    "`hint` edges are scaffold guesses, not verified — read both locations and call `confirm` or `reject`. " +
      "`needs-reconfirm` edges were settled once and then one side's content changed underneath them: re-read " +
      "both sides and `confirm` again, or `reject`. Only `confirmed` is a settled answer.",
  );
  const observedCount = [...graph.edges.values()].filter((e) => e.basis === "observed-read-write").length;
  if (observedCount) {
    out.push("");
    out.push(
      `**${observedCount} confirmed edge(s) were settled by observation, not by a reader.** The tool watched the ` +
        "source get read, then watched the target get written citing it by path, so direction is observed rather " +
        "than inferred. They are listed separately below and carry confidence < 1 to keep them distinguishable " +
        "from a judgment. They are deliberately kept OUT of the review queue — that is the saving — so spot-check " +
        "them if a convention slipped, and `reject` any that are wrong.",
    );
  }
  out.push("");

  for (const [title, state] of STATE_SECTIONS) {
    let edges = [...graph.edges.values()].filter((e) => e.state === state);
    // Observed edges are confirmed, but they were never read by anyone. Listing them
    // inside "Confirmed" would hide exactly the set most worth spot-checking.
    if (state === "confirmed") edges = splitObserved(edges).judged;
    if (!edges.length) continue;
    out.push(`## ${title} (${edges.length})`);
    out.push("");
    const byTarget = new Map();
    for (const e of edges) {
      const to = nodes.get(e.to);
      const key = to?.path || e.to;
      if (!byTarget.has(key)) byTarget.set(key, []);
      byTarget.get(key).push(e);
    }
    const ranked = [...byTarget.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, limit);
    for (const [targetPath, targetEdges] of ranked) {
      out.push(`### \`${targetPath}\` — ${targetEdges.length} edge${targetEdges.length === 1 ? "" : "s"}`);
      for (const e of targetEdges.sort((a, b) => b.confidence - a.confidence).slice(0, limit)) {
        const wasWhat = e.priorState ? ` — was ${e.priorState} @ ${e.priorConfidence}${e.reason ? `, ${e.reason}` : ""}` : "";
        out.push(`- ${loc(nodes.get(e.from))} → ${loc(nodes.get(e.to))} (confidence ${e.confidence}${wasWhat})`);
      }
      out.push("");
    }
    if (byTarget.size > limit) out.push(`... ${byTarget.size - limit} more target files`, "");
  }

  if (observedEdges.length) {
    out.push(`## Settled by observation — not reviewed (${observedEdges.length})`);
    out.push("");
    out.push(
      "The source was read, then the target was written citing it by path. Direction is observed. " +
        "No reader has compared the two sides: skim for a citation that names a file it did not draw from.",
    );
    out.push("");
    for (const e of observedEdges.sort((a, b) => b.confidence - a.confidence).slice(0, limit)) {
      out.push(`- ${loc(nodes.get(e.from))} → ${loc(nodes.get(e.to))} (confidence ${e.confidence})`);
    }
    if (observedEdges.length > limit) out.push(`... ${observedEdges.length - limit} more`);
    out.push("");
  }

  if (graph.unresolved.length) {
    out.push(`## Unresolved references (${graph.unresolved.length})`);
    out.push("");
    out.push("References that look like paths but match no workspace file — no node was fabricated for them.");
    out.push("");
    out.push("| reference | in | line | reason |");
    out.push("| :-- | :-- | --: | :-- |");
    for (const u of graph.unresolved.slice(0, limit)) {
      out.push(`| \`${u.raw}\` | \`${u.path || ""}\` | ${u.line ?? ""} | ${u.reason} |`);
    }
    out.push("");
  }

  if (graph.reconcileReport) out.push(...reconcileSection(graph.reconcileReport, limit));

  return `${out.join("\n")}\n`;
}

function reconcileSection(r, limit) {
  const out = [];
  out.push("## Last reconcile");
  out.push("");
  out.push(`- unchanged: ${r.unchanged}`);
  if (r.changedFiles?.length) out.push(`- changed files: ${r.changedFiles.length}`);
  if (r.deletedFiles?.length) out.push(`- deleted: ${r.deletedFiles.map((p) => `\`${p}\``).join(", ")}`);
  if (r.relocated?.length) {
    out.push(`- relocated (text moved, identity and edges kept): ${r.relocated.length}`);
    for (const item of r.relocated.slice(0, limit)) {
      out.push(
        `  - \`${item.path}\`: ${item.from.start}-${item.from.end} → ${item.to.start}-${item.to.end}` +
          (item.ambiguous ? " (repeated text — position chosen by nearest match)" : ""),
      );
    }
  }
  if (r.demoted?.length) {
    out.push(`- source files changed, their settled edges demoted to needs-reconfirm: ${r.demoted.length}`);
    for (const item of r.demoted.slice(0, limit)) out.push(`  - \`${item.path}\` (${item.edges} edges)`);
  }
  if (r.bounded?.length) {
    out.push(`- rewritten regions replaced by a bounding span that inherited the old edges: ${r.bounded.length}`);
    for (const item of r.bounded.slice(0, limit)) {
      out.push(
        `  - \`${item.path}\`:${item.interval.start}-${item.interval.end} absorbed ${item.absorbed.length}` +
          (item.widenedByWrites ? " (widened by recorded writes)" : ""),
      );
    }
  }
  if (r.reparented) out.push(`- edges carried onto replacements as needs-reconfirm: ${r.reparented}`);
  if (r.retired?.length) {
    const withConfirmed = r.retired.filter((x) => x.hadConfirmed);
    out.push(`- retired to the archive: ${r.retired.length}${withConfirmed.length ? ` (${withConfirmed.length} had confirmed edges)` : ""}`);
    for (const item of r.retired.slice(0, limit)) {
      out.push(
        `  - \`${item.path}\`${item.interval ? `:${item.interval.start}-${item.interval.end}` : ""} — ${item.reason}` +
          (item.affectedTargets ? `, ${item.affectedTargets} affected` : ""),
      );
    }
  }
  if (r.freshHints) out.push(`- fresh hints proposed for changed content: ${r.freshHints}`);
  if (r.coalesced) out.push(`- duplicate fresh hints folded into inherited edges: ${r.coalesced}`);
  if (r.needsReconfirm) out.push(`- **needs re-confirmation right now: ${r.needsReconfirm}** (see \`pending\`)`);
  out.push("");
  return out;
}

/** One target file explained: where did its content come from? */
export function renderExplainMarkdown(graph, relPath, options = {}) {
  const limit = options.limit ?? 40;
  const edges = graph.edgesIntoFile(relPath);
  const out = [];
  out.push(`# Provenance of \`${relPath}\``);
  out.push("");

  const retired = graph.archive?.forPath(relPath) || [];
  if (edges.length === 0) {
    out.push("No incoming influence edges (hint, needs-reconfirm or confirmed) were found for this file.");
    if (retired.length) {
      out.push("");
      out.push(
        `${retired.length} retired record${retired.length === 1 ? "" : "s"} for this path exist in the archive — ` +
          "run `infer` with this file as `sourceFile` to re-derive where that influence went.",
      );
    }
    out.push("");
    return `${out.join("\n")}\n`;
  }

  for (const [title, state] of STATE_SECTIONS) {
    const stateEdges = edges.filter((e) => e.state === state).sort((a, b) => b.confidence - a.confidence);
    if (!stateEdges.length) continue;
    out.push(`## ${title} (${stateEdges.length})`);
    out.push("");
    for (const e of stateEdges.slice(0, limit)) {
      const wasWhat = e.priorState ? ` — was ${e.priorState} @ ${e.priorConfidence}` : "";
      out.push(`- ${loc(graph.nodes.get(e.from))} → ${loc(graph.nodes.get(e.to))} (confidence ${e.confidence}${wasWhat})`);
    }
    out.push("");
  }
  return `${out.join("\n")}\n`;
}

/** Pending review: everything still awaiting judgment. */
export function renderPendingMarkdown(pending, options = {}) {
  const limit = options.limit ?? 40;
  const out = [];
  out.push("# Pending review");
  out.push("");
  out.push(
    "Four queues, in the order worth working: a demoted edge is a belief that has already been checked once " +
      "and only needs re-checking; a retired record is a connection whose text is gone and needs re-deriving; " +
      "writes and reads are this session's own activity that nothing yet explains.",
  );
  out.push("");

  out.push(`## Needs re-confirmation (${pending.needsReconfirm.length})`);
  out.push("");
  if (pending.needsReconfirm.length) {
    out.push("Read both sides again, then `confirm` (or `reject` if the change broke the relationship).");
    out.push("");
    for (const item of pending.needsReconfirm.slice(0, limit)) {
      out.push(
        `- ${fmtLoc(item.source)} → ${fmtLoc(item.target)} — was ${item.priorState} @ ${item.priorConfidence} (${item.reason})`,
      );
    }
  } else out.push("Nothing demoted.");
  out.push("");

  out.push(`## Retired, awaiting re-investigation (${pending.retired.length})`);
  out.push("");
  if (pending.retired.length) {
    out.push("Their text is gone from disk. `infer` with the path as `sourceFile` returns the retired text plus every target it used to influence.");
    out.push("");
    for (const item of pending.retired.slice(0, limit)) {
      out.push(
        `- \`${item.path}\`${item.interval ? `:${item.interval.start}-${item.interval.end}` : ""} — ${item.reason}, ${item.affectedTargets} affected (node \`${item.nodeId}\`)`,
      );
    }
  } else out.push("Archive is empty.");
  out.push("");

  out.push(`## Stale writes (${pending.staleWrites.length})`);
  out.push("");
  for (const w of pending.staleWrites.slice(0, limit)) {
    out.push(`- \`${w.path}\`:${w.interval.start}-${w.interval.end} (written ${w.at})`);
  }
  out.push("");

  out.push(`## Stale reads (${pending.staleReads.length})`);
  out.push("");
  out.push("Process writes first — a read explained while accounting for a write needs no separate entry.");
  out.push("");
  for (const r of pending.staleReads.slice(0, limit)) {
    out.push(`- \`${r.path}\`:${r.interval.start}-${r.interval.end} (read ${r.at})`);
  }
  out.push("");
  return `${out.join("\n")}\n`;
}

function fmtLoc(loc) {
  if (!loc?.path) return `(node ${loc?.nodeId ?? "?"})`;
  return loc.interval ? `\`${loc.path}\`:${loc.interval.start}-${loc.interval.end}` : `\`${loc.path}\` (whole file)`;
}

/**
 * The `infer` packet: evidence for a judgment, explicitly not a verdict.
 */
export function renderInferMarkdown(result, options = {}) {
  const limit = options.limit ?? 20;
  const out = [];

  if (result.kind === "reinvestigation") {
    out.push(`# Re-investigation of \`${result.source}\``);
    out.push("");
    out.push(
      "This path has retired records: text that once influenced other files and is no longer on disk. " +
        "For each packet, read the retired text and each affected target's CURRENT content, decide where that " +
        "influence now lives, then `confirm`/`link` the new pair and pass `resolves` with the retired node id.",
    );
    out.push("");
    out.push(`- current file on disk: ${result.currentContentAvailable ? "yes" : "no (deleted)"}`);
    out.push("");
    for (const packet of result.packets) {
      out.push(`## Retired node \`${packet.nodeId}\``);
      out.push(
        `- retired ${packet.retiredAt} (${packet.reason})${packet.retiredInterval ? `, was at ${packet.retiredInterval.start}-${packet.retiredInterval.end}` : ""}`,
      );
      out.push("");
      if (packet.retiredContent) {
        out.push("Retired text:");
        out.push("");
        out.push("```");
        out.push(packet.retiredContent);
        out.push("```");
        out.push("");
      }
      out.push(`### Affected targets (${packet.affectedTargets.length})`);
      out.push("");
      for (const target of packet.affectedTargets.slice(0, limit)) {
        out.push(
          `- ${target.direction} \`${target.path ?? "?"}\`${target.interval ? `:${target.interval.start}-${target.interval.end}` : ""} — was ${target.state} @ ${target.confidence}${target.stillLive ? "" : " (target node also retired)"}`,
        );
      }
      out.push("");
    }
    return `${out.join("\n")}\n`;
  }

  out.push("# Inferred provenance candidates");
  out.push("");
  out.push(
    "Nothing here is an edge yet. The scaffold can only see literal paths, imports and verbatim phrases, so " +
      "anything paraphrased — or written before this tool existed, with no recorded read to pair against the " +
      "write — is invisible to it. Read a target's unexplained region and its candidates, decide by content, " +
      "then `confirm`/`link`.",
  );
  out.push("");
  out.push(`- sources: ${result.sourceRoots.map((r) => `\`${r}\``).join(", ")}`);
  out.push(`- targets: ${result.targetRoots.map((r) => `\`${r}\``).join(", ")}`);
  out.push(`- role map: ${result.roles.file ? `\`${result.roles.file}\`` : "none (using the roots above)"}`);
  out.push("");

  for (const target of result.targets) {
    out.push(`## \`${target.path}\` — ${target.unexplainedLines}/${target.lines} lines unexplained`);
    out.push("");
    out.push(`- unexplained: ${formatIntervals(target.unexplainedIntervals)}`);
    if (target.explainedIntervals.length) out.push(`- already explained: ${formatIntervals(target.explainedIntervals)}`);
    out.push("");
    if (target.candidates.length === 0) {
      out.push("No candidate source shares measurable content with this file. If you know it is derived from");
      out.push("something, `link` it directly — an unmeasurable relationship is still a real one.");
      out.push("");
      continue;
    }
    out.push("| candidate source | shared phrases | name mentions | source lines |");
    out.push("| :-- | --: | --: | :-- |");
    for (const c of target.candidates) {
      out.push(
        `| \`${c.path}\` | ${c.sharedPhrases} | ${c.mentions} | ${c.sampleSourceLines.length ? c.sampleSourceLines.join(", ") : "—"} |`,
      );
    }
    out.push("");
    if (target.preview) {
      out.push("<details><summary>unexplained region</summary>");
      out.push("");
      out.push("```");
      out.push(target.preview);
      out.push("```");
      out.push("");
      out.push("</details>");
      out.push("");
    }
  }

  if (result.retiredQueue.length) {
    out.push(`## Retired records also awaiting re-investigation (${result.retiredQueue.length})`);
    out.push("");
    for (const item of result.retiredQueue) {
      out.push(
        `- \`${item.path}\`${item.interval ? `:${item.interval.start}-${item.interval.end}` : ""} — ${item.reason}, ${item.affectedTargets} affected`,
      );
    }
    out.push("");
  }

  return `${out.join("\n")}\n`;
}
