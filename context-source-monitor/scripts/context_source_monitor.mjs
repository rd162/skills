#!/usr/bin/env node

/**
 * Context Source Monitor — CLI and library entry point.
 *
 * Two products:
 *   coverage    which workspace lines this agent has actually read
 *   influence   a source -> target influence graph. The scaffold's hints are a
 *               cheap starting guess, not an answer — confirm/reject/link is
 *               where the judgment happens, `infer` is how provenance gets
 *               established by CONTENT when no detector can see it, and
 *               `reconcile` keeps all of it honest as files change.
 *
 * Nothing is ever deleted by hash: a stale location is retired into
 * inf-map-archive.json with the edges it had, because "this text once
 * influenced these targets" is the lead you need to re-establish provenance.
 *
 * Durable artifacts go to data/research/context-source-monitor/.
 *
 * Usage
 *   node scripts/context_source_monitor.mjs install [--tools opencode] [--force]
 *   node scripts/context_source_monitor.mjs status
 *   node scripts/context_source_monitor.mjs enable | disable | reset
 *   node scripts/context_source_monitor.mjs coverage [--scope DIR] [--out FILE] [--blocks all|partial|none]
 *   node scripts/context_source_monitor.mjs influence --sources DIR[,DIR] --targets DIR[,DIR]
 *   node scripts/context_source_monitor.mjs reconcile --sources DIR[,DIR] --targets DIR[,DIR]
 *   node scripts/context_source_monitor.mjs confirm --source A[:S-E] --target B[:S-E] [--confidence N] [--resolves NODE_ID]
 *   node scripts/context_source_monitor.mjs reject  --source A[:S-E] --target B[:S-E]
 *   node scripts/context_source_monitor.mjs pending
 *   node scripts/context_source_monitor.mjs infer [--target FILE] [--source FILE] [--sources A,B] [--targets A,B]
 *   node scripts/context_source_monitor.mjs resolve --node NODE_ID [--into ID,ID] [--note "why"]
 *   node scripts/context_source_monitor.mjs explain PATH
 *   node scripts/context_source_monitor.mjs link --source A[:S-E] --target B[:S-E]   (alias of confirm)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ContextSourceMonitorEngine,
  ARTIFACT_DIR,
  MAP_FILENAME,
  ARCHIVE_FILENAME,
  ROLES_FILENAME,
  DEFAULT_CONFIG,
  writeFileAtomic,
} from "./context_source_monitor/engine.mjs";
import {
  InfluenceGraph,
  GraphArchive,
  EDGE_STATES,
  NODE_SCOPES,
  RETIRE_REASONS,
  SCHEMA_VERSION,
} from "./context_source_monitor/graph.mjs";
import {
  renderCoverageMarkdown,
  renderInfluenceMarkdown,
  renderExplainMarkdown,
  renderPendingMarkdown,
  renderInferMarkdown,
} from "./context_source_monitor/report.mjs";
import { TerminalCommandParser, extractReads, extractWrites } from "./context_source_monitor/terminal.mjs";
import { parseStructure, isProbablyBinary } from "./context_source_monitor/structure.mjs";
import { WorkspaceIndex } from "./context_source_monitor/resolve.mjs";
import { ShingleIndex, DEFAULT_OVERLAP_OPTIONS } from "./context_source_monitor/overlap.mjs";
import { SCAFFOLD_MECHANISMS } from "./context_source_monitor/detectors.mjs";
import {
  TOOL_REGISTRY,
  supportedTools,
  getSkillRoot,
  getSkillVersion,
  checkAll,
  installAll,
  summarizeCheck,
  summarizeInstall,
} from "./context_source_monitor/install.mjs";

export {
  ContextSourceMonitorEngine,
  InfluenceGraph,
  GraphArchive,
  WorkspaceIndex,
  ShingleIndex,
  TerminalCommandParser,
  extractReads,
  extractWrites,
  parseStructure,
  isProbablyBinary,
  renderCoverageMarkdown,
  renderInfluenceMarkdown,
  renderExplainMarkdown,
  renderPendingMarkdown,
  renderInferMarkdown,
  EDGE_STATES,
  NODE_SCOPES,
  RETIRE_REASONS,
  DEFAULT_CONFIG,
  DEFAULT_OVERLAP_OPTIONS,
  ARTIFACT_DIR,
  SCHEMA_VERSION,
  SCAFFOLD_MECHANISMS,
  TOOL_REGISTRY,
  supportedTools,
  getSkillRoot,
  getSkillVersion,
  checkAll,
  installAll,
  summarizeCheck,
  summarizeInstall,
};
export default ContextSourceMonitorEngine;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const HELP = `Context Source Monitor

  install                         install/update this project's tool integrations from the skill bundle
                                   (aliases: init, update; supported tools: ${supportedTools().join(", ")})
  status                          coverage + influence summary + installed-integration status
  enable | disable | reset        toggle tracking / clear state
  coverage                        read-coverage report
  influence                       build the influence map from scratch (hints only)
  reconcile                       refresh a map: relocate moved text, demote settled edges whose
                                  content changed, retire vanished spans into the archive, re-scaffold
  confirm                         mark a hint (or a demoted edge, or a brand-new edge) as verified
  reject                          delete an edge outright (never tombstoned)
  pending                         everything awaiting judgment: needs-reconfirm, retired, writes, reads
  infer                           propose provenance by CONTENT where no detector can see it
  resolve                         mark a retired record as re-derived (moves it out of the queue)
  explain <path>                  provenance of one file
  link                            alias of confirm (for edges the scaffold never proposed)

Options
  --tools t1,t2                   install: which tool integrations to (re)install (default: all supported)
  --force                         install: overwrite a locally-modified installed file instead of skipping it
  --scope DIR                     limit coverage to DIR
  --sources A,B                   source roots (influencers; default: whole workspace or roles.txt)
  --targets A,B                   target roots (influenced; default: whole workspace or roles.txt)
  --detectors a,b                 subset of ${SCAFFOLD_MECHANISMS.join(", ")}
  --min-confidence N              drop weak HINT edges below this (0-1; never touches confirmed/needs-reconfirm)
  --shingle N                     overlap window in tokens (default ${DEFAULT_OVERLAP_OPTIONS.shingleSize})
  --min-matches N                 min shared phrases for overlap (default ${DEFAULT_OVERLAP_OPTIONS.minMatches})
  --blocks all|partial|none       block detail in coverage (default partial)
  --map FILE                      map to read/refresh (default ${ARTIFACT_DIR}/${MAP_FILENAME})
  --archive FILE                  retired archive (default ${ARTIFACT_DIR}/${ARCHIVE_FILENAME})
  --source FILE[:START-END]       confirm/reject/link/infer: source location (no interval = whole file)
  --target FILE[:START-END]       confirm/reject/link/infer: target location (no interval = whole file)
  --confidence N                  confirm/link: confidence to record (default 1)
  --resolves ID[,ID]              confirm/link: retired node ids this edge re-derives
  --node ID                       resolve: the retired node id
  --into ID[,ID]                  resolve: live node ids that now carry the influence
  --note TEXT                     confirm/resolve: why
  --out FILE                      write JSON (.json) or markdown (.md)
  --md FILE                       also write a markdown rendering
  --limit N                       rows per report section
  --no-state                      ignore and do not update saved state
  --json                          print JSON to stdout

Role map (optional): ${ARTIFACT_DIR}/${ROLES_FILENAME}
  Lines of "source: data/corpus" / "generated: memory". \`infer\` uses it to know which trees can only
  ever be original material and which can only ever be derived, so candidate ranking has a prior even
  with no recorded reads at all.
`;

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }
    const key = token.replace(/^--/, "");
    if (key.startsWith("no-")) {
      args.flags[key.slice(3)] = false;
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) args.flags[key] = true;
    else {
      args.flags[key] = next;
      i++;
    }
  }
  return args;
}

function list(value) {
  if (value === undefined || value === true) return undefined;
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "path/to/file.md:12-34" -> { file, interval } ; no range -> whole-file (file scope) */
function parseLocation(value) {
  if (typeof value !== "string") return null;
  const m = value.match(/^(.*):(\d+)-(\d+)$/);
  if (!m) return { file: value, interval: undefined };
  return { file: m[1], interval: { start: Number(m[2]), end: Number(m[3]) } };
}

function overlapOptions(flags) {
  const opts = {};
  if (flags.shingle) opts.shingleSize = Number(flags.shingle);
  if (flags["min-matches"]) opts.minMatches = Number(flags["min-matches"]);
  if (flags["max-df"]) opts.maxDocFrequency = Number(flags["max-df"]);
  return Object.keys(opts).length ? opts : undefined;
}

function writeOut(target, contents, workspace) {
  const dest = path.resolve(workspace, target);
  writeFileAtomic(dest, contents);
  return path.relative(workspace, dest) || dest;
}

function influenceOptions(flags) {
  return {
    sourceRoots: list(flags.sources),
    targetRoots: list(flags.targets),
    detectors: list(flags.detectors),
    minConfidence: flags["min-confidence"] ? Number(flags["min-confidence"]) : undefined,
    overlap: overlapOptions(flags),
  };
}

function graphMeta(engine, flags) {
  return {
    workspace: engine.workspace,
    sources: list(flags.sources) || ["<workspace>"],
    targets: list(flags.targets) || ["<workspace>"],
  };
}

/** One line per thing that actually happened, so a reconcile is never a mystery. */
function reconcileSummary(report) {
  if (report.unchanged) return "nothing changed since the previous map";
  const parts = [];
  if (report.changedFiles.length) parts.push(`changed ${report.changedFiles.length}`);
  if (report.deletedFiles.length) parts.push(`deleted ${report.deletedFiles.length}`);
  if (report.relocated.length) parts.push(`relocated ${report.relocated.length}`);
  if (report.demoted.length) parts.push(`demoted-files ${report.demoted.length}`);
  if (report.bounded.length) parts.push(`bounded ${report.bounded.length}`);
  if (report.reparented) parts.push(`re-parented ${report.reparented}`);
  if (report.retired.length) parts.push(`retired ${report.retired.length}`);
  if (report.freshHints) parts.push(`fresh-hints ${report.freshHints}`);
  if (report.coalesced) parts.push(`coalesced ${report.coalesced}`);
  if (report.needsReconfirm) parts.push(`needs-reconfirm ${report.needsReconfirm}`);
  return parts.join(", ") || "no structural change";
}

async function main(argv) {
  const args = parseArgs(argv);
  const command = (args._[0] || "status").replace(/^--/, "");
  const flags = args.flags;
  const workspace = flags.workspace ? path.resolve(String(flags.workspace)) : process.cwd();
  const useState = flags.state !== false;

  const engine = ContextSourceMonitorEngine.open({ workspace, load: useState });
  const limit = flags.limit ? Number(flags.limit) : undefined;
  const mapFlag = typeof flags.map === "string" ? flags.map : undefined;
  const archiveFlag = typeof flags.archive === "string" ? flags.archive : undefined;
  const defaultMap = `${ARTIFACT_DIR}/${MAP_FILENAME}`;

  switch (command) {
    case "help":
      process.stdout.write(HELP);
      return 0;

    case "install":
    case "init":
    case "update": {
      const requested = list(flags.tools);
      const tools = requested || supportedTools();
      for (const t of tools) {
        if (!supportedTools().includes(t)) {
          process.stderr.write(`unknown tool "${t}" (supported: ${supportedTools().join(", ")})\n`);
          return 2;
        }
      }
      const reports = installAll(workspace, { tools, force: flags.force === true });
      if (flags.json) {
        process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
        return 0;
      }
      process.stdout.write(`${summarizeInstall(reports)}\n`);
      const anyDrift = reports.some((r) => r.skippedDrift.length);
      if (anyDrift) {
        process.stdout.write(
          "Some installed files were locally modified and were left alone. Re-run with --force to overwrite them.\n",
        );
      }
      return 0;
    }

    case "enable": {
      const res = engine.enable();
      if (useState) engine.save();
      process.stdout.write(`${res.message}\n`);
      return 0;
    }

    case "disable": {
      const res = engine.disable();
      if (useState) engine.save();
      process.stdout.write(`${res.message}\n`);
      return 0;
    }

    case "reset": {
      const res = engine.reset({ keepAnnotations: flags["keep-annotations"] === true });
      if (useState) engine.save();
      process.stdout.write(`${res.message}\n`);
      return 0;
    }

    case "status": {
      const snapshot = engine.coverage({ scope: flags.scope, blockDetail: "none" });
      const t = snapshot.totals;
      const graph = engine.readGraphArtifact(mapFlag || defaultMap, { archivePath: archiveFlag });
      const stats = graph?.stats();
      const integrations = checkAll(workspace);
      process.stdout.write(
        [
          `tracking:        ${engine.isTracking() ? "active" : "inactive"}`,
          `files in scope:  ${t.files}`,
          `line coverage:   ${t.lineCoveragePercent}% (${t.linesRead}/${t.lines})`,
          `fully read:      ${t.filesFullyRead}`,
          `partially read:  ${t.filesPartiallyRead}`,
          `unread:          ${t.filesUnread}`,
          `unread intervals:${t.unreadIntervals}`,
          `files written:   ${t.filesWritten}`,
          stats
            ? `influence map:   ${stats.edges} edges / ${stats.nodes} nodes ${JSON.stringify(stats.byState)}`
            : `influence map:   none at ${mapFlag || defaultMap}`,
          stats?.archived?.retiredNodes
            ? `archived:        ${stats.archived.retiredNodes} retired, ${stats.archived.resolvedNodes} resolved`
            : null,
          `state:           ${path.relative(workspace, engine.statePath)}`,
          `integrations:`,
          ...summarizeCheck(integrations)
            .split("\n")
            .map((line) => `  ${line}`),
        ]
          .filter(Boolean)
          .join("\n") + "\n",
      );
      return 0;
    }

    case "coverage": {
      const snapshot = engine.coverage({
        scope: flags.scope,
        blockDetail: typeof flags.blocks === "string" ? flags.blocks : undefined,
      });
      if (flags.trace) {
        engine.recordTrace(snapshot);
        if (useState) engine.save();
      }
      if (flags.json) {
        process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
        return 0;
      }
      const markdown = renderCoverageMarkdown(snapshot, { limit });
      if (typeof flags.out === "string") {
        const isJson = flags.out.endsWith(".json");
        const written = writeOut(flags.out, isJson ? `${JSON.stringify(snapshot, null, 2)}\n` : markdown, workspace);
        process.stdout.write(
          `coverage written to ${written} (${snapshot.totals.lineCoveragePercent}% lines, ${snapshot.totals.unreadIntervals} unread intervals)\n`,
        );
        return 0;
      }
      process.stdout.write(markdown);
      return 0;
    }

    case "influence":
    case "reconcile": {
      const opts = influenceOptions(flags);
      const isReconcile = command === "reconcile";
      const result = isReconcile
        ? engine.reconcileInfluenceGraph({ ...opts, previousPath: mapFlag, archivePath: archiveFlag })
        : { graph: engine.buildInfluenceGraph(opts), reconciled: false };
      const graph = result.graph;
      const json = graph.toJSON(graphMeta(engine, flags));

      if (flags.json) {
        process.stdout.write(`${JSON.stringify(json, null, 2)}\n`);
      } else if (flags.out === false) {
        process.stdout.write(renderInfluenceMarkdown(graph, { limit }));
      } else {
        const outPath = typeof flags.out === "string" ? flags.out : mapFlag || defaultMap;
        const written = engine.saveGraphArtifact(graph, outPath, { archivePath: archiveFlag });
        const s = json.stats;
        const summary = isReconcile
          ? result.reconciled
            ? reconcileSummary(result.report)
            : "no previous map found — built fresh"
          : "built from scratch";
        process.stdout.write(
          `${isReconcile ? "reconciled" : "influence map"} written to ${written.mapPath} (${summary})\n` +
            `  nodes ${s.nodes} ${JSON.stringify(s.byScope)}\n` +
            `  edges ${s.edges} ${JSON.stringify(s.byState)} avg-confidence ${s.averageConfidence}\n` +
            `  unresolved ${s.unresolvedReferences}\n` +
            (written.archivePath
              ? `  archive ${written.archivePath} (${s.archived.retiredNodes} retired, ${s.archived.resolvedNodes} resolved)\n`
              : ""),
        );
      }
      if (typeof flags.md === "string") {
        const written = writeOut(flags.md, renderInfluenceMarkdown(graph, { limit }), workspace);
        process.stdout.write(`markdown rendering written to ${written}\n`);
      }
      return 0;
    }

    case "confirm":
    case "link":
    case "reject": {
      const source = parseLocation(flags.source);
      const target = parseLocation(flags.target);
      if (!source || !target) {
        process.stderr.write(`${command} requires --source FILE[:START-END] and --target FILE[:START-END]\n`);
        return 2;
      }
      const shared = {
        mapPath: mapFlag,
        archivePath: archiveFlag,
        sourceFile: source.file,
        sourceInterval: source.interval,
        targetFile: target.file,
        targetInterval: target.interval,
      };
      const result =
        command === "reject"
          ? engine.rejectInfluence(shared)
          : engine.confirmInfluence({
              ...shared,
              confidence: flags.confidence ? Number(flags.confidence) : undefined,
              resolves: list(flags.resolves),
              note: typeof flags.note === "string" ? flags.note : undefined,
            });
      if (!result.ok) {
        process.stderr.write(`${result.error}\n`);
        return 2;
      }
      if (command === "reject") {
        process.stdout.write(`rejected: ${flags.source} -> ${flags.target}\n`);
        return 0;
      }
      const demotions = [result.demoted?.source, result.demoted?.target].filter(Boolean);
      process.stdout.write(
        `${command === "link" ? "declared" : "confirmed"}: ${flags.source} -> ${flags.target} (confidence ${result.edge.confidence})\n` +
          (result.resolved?.length ? `  resolved retired: ${result.resolved.join(", ")}\n` : "") +
          (demotions.length ? `  note: represented at file scope (${demotions.join(", ")})\n` : ""),
      );
      return 0;
    }

    case "pending": {
      const mapPath = mapFlag || defaultMap;
      const graph = engine.readGraphArtifact(mapPath, { archivePath: archiveFlag }) || new InfluenceGraph();
      const pending = engine.pendingReview(graph);
      if (flags.json) {
        process.stdout.write(`${JSON.stringify(pending, null, 2)}\n`);
        return 0;
      }
      process.stdout.write(renderPendingMarkdown(pending, { limit }));
      return 0;
    }

    case "infer": {
      const source = parseLocation(flags.source);
      const target = parseLocation(flags.target);
      const result = engine.inferProvenance({
        mapPath: mapFlag,
        archivePath: archiveFlag,
        sourceFile: source?.file,
        targetFile: target?.file,
        interval: target?.interval,
        sourceRoots: list(flags.sources),
        targetRoots: list(flags.targets),
        overlap: overlapOptions(flags),
        limit,
      });
      if (flags.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return 0;
      }
      const markdown = renderInferMarkdown(result, { limit });
      if (typeof flags.out === "string") {
        const written = writeOut(flags.out, markdown, workspace);
        process.stdout.write(`inference written to ${written}\n`);
        return 0;
      }
      process.stdout.write(markdown);
      return 0;
    }

    case "resolve": {
      const nodeId = typeof flags.node === "string" ? flags.node : null;
      if (!nodeId) {
        process.stderr.write("resolve requires --node NODE_ID\n");
        return 2;
      }
      const result = engine.resolveRetired({
        mapPath: mapFlag,
        archivePath: archiveFlag,
        nodeId,
        into: list(flags.into) || [],
        note: typeof flags.note === "string" ? flags.note : undefined,
      });
      if (!result.ok) {
        process.stderr.write(`${result.error}\n`);
        return 2;
      }
      process.stdout.write(`resolved retired node ${nodeId} (archive: ${result.archivePath})\n`);
      return 0;
    }

    case "explain": {
      const target = args._[1];
      if (!target) {
        process.stderr.write("explain requires a file path\n");
        return 2;
      }
      const relTarget = engine.normalize(target).relative;
      const graph = engine.readGraphArtifact(mapFlag || defaultMap, { archivePath: archiveFlag }) || new InfluenceGraph();
      const markdown = renderExplainMarkdown(graph, relTarget, { limit });
      if (typeof flags.out === "string") {
        const written = writeOut(flags.out, markdown, workspace);
        process.stdout.write(`explanation written to ${written}\n`);
      } else {
        process.stdout.write(markdown);
      }
      return 0;
    }

    default:
      process.stderr.write(`unknown command: ${command}\n\n${HELP}`);
      return 2;
  }
}

/**
 * Realpath both sides before comparing. This module is meant to be invoked as
 * `node ~/.agents/skills/context-source-monitor/scripts/context_source_monitor.mjs`
 * from any project — i.e. through a symlink, since that is exactly how global
 * skill installs normally work. Node resolves the entry module's symlink to
 * its real path before setting `import.meta.url`, but does NOT resolve
 * `process.argv[1]` the same way, so a plain `path.resolve()` comparison only
 * matches when invoked via the real, non-symlinked path — it silently exits
 * with no output and code 0 through a symlink. Realpath-normalizing both
 * sides makes the check invariant to how the script was reached.
 */
function realpathOrResolve(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

const invokedDirectly =
  process.argv[1] && realpathOrResolve(process.argv[1]) === realpathOrResolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code ?? 0))
    .catch((error) => {
      process.stderr.write(`${error?.stack || error}\n`);
      process.exit(1);
    });
}
