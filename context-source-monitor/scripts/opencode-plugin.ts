/**
 * Context Source Monitor — OpenCode plugin adapter.
 *
 * This file contains NO engine logic: the engine lives in
 * ./context_source_monitor/ and is shared with the CLI and the tests. This
 * adapter is part of the `context-source-monitor` global skill — see
 * `../SKILL.md` and `../references/development-history.md` for the design
 * rationale summarized below and the full history of how it got this way.
 *
 * Do not hand-copy this file into a project's own `.opencode/plugins/`: the
 * skill ships a thin loader for that (`../references/cli-reference.md` §
 * "OpenCode integration"). Keeping exactly one copy of this adapter is what
 * makes the skill safe to update in place across every project that uses it.
 *
 * Influence-graph design (v4):
 *   - the scaffold's `hint` edges are a cheap mechanical first pass, NOT an
 *     answer; `confirm`/`reject`/`link` are how a reader settles them
 *   - `needs-reconfirm` marks an edge that WAS settled until one side's content
 *     changed underneath it — a re-check, not a fresh guess
 *   - nothing is deleted by hash: a vanished location is retired into
 *     inf-map-archive.json with the edges it had, and `infer` turns that
 *     history back into current provenance
 *   - `infer` also establishes provenance by CONTENT where no detector can see
 *     it, which is the only way to map a repo whose work predates this tool
 *
 * Hook signatures follow @opencode-ai/plugin exactly:
 *   "tool.execute.before"(input: {tool, sessionID, callID}, output: {args})
 *   "tool.execute.after"(input:  {tool, sessionID, callID, args}, output: {title, output, metadata})
 */

import { type Plugin, tool } from "@opencode-ai/plugin";

import {
  ContextSourceMonitorEngine,
  ARTIFACT_DIR,
  MAP_FILENAME,
} from "./context_source_monitor/engine.mjs";
import { extractReads, extractWrites } from "./context_source_monitor/terminal.mjs";
import {
  renderCoverageMarkdown,
  renderInfluenceMarkdown,
  renderExplainMarkdown,
  renderPendingMarkdown,
  renderInferMarkdown,
} from "./context_source_monitor/report.mjs";
import { InfluenceGraph } from "./context_source_monitor/graph.mjs";
import { installAll, checkAll, supportedTools, summarizeCheck, summarizeInstall } from "./context_source_monitor/install.mjs";

const READ_TOOLS = new Set(["read", "read_file", "readfile", "view"]);
const WRITE_TOOLS = new Set(["write", "edit", "patch", "multiedit", "create_file", "write_file", "notebook_edit"]);
const SHELL_TOOLS = new Set(["bash", "shell", "exec", "terminal"]);
const SUBAGENT_TOOLS = new Set(["task", "agent", "subagent", "delegate"]);

const ENFORCEMENT_PROMPT = `
[CONTEXT SOURCE MONITOR — ACTIVE]
Read and write provenance are being tracked for this workspace.
1. Read files with the built-in \`read\` tool, not \`cat\`/\`head\`/\`tail\`/\`sed\`/inline scripts.
2. Modify files with \`edit\`/\`write\`, not \`echo >\`/\`sed -i\`/\`tee\`.
3. Shell access to files is still recorded, but only approximately — exact line
   intervals are only known for the built-in tools.
Use the \`context_source_monitor\` tool (action: coverage) to see what remains unread,
(action: reconcile) to refresh the influence map, (action: pending) to see what awaits
judgment, and (action: infer) to establish provenance by content where no detector can.
`.trim();

const SUBAGENT_NOTICE = `
[CONTEXT SOURCE MONITOR] Read files with the built-in \`read\` tool only; do not use cat/head/tail/sed to inspect files. File access outside the built-in tools cannot be attributed to exact line ranges.
`.trim();

/** Exact interval actually returned by the read tool, parsed from its output. */
export function parseReadOutputInterval(outputText: string): { start: number; end: number } | null {
  if (!outputText) return null;

  const footer = outputText.match(/\(Showing lines (\d+)-(\d+) of (\d+)/);
  if (footer) return { start: Number(footer[1]), end: Number(footer[2]) };

  // Fall back to the numeric line prefixes the tool emits ("  12: content").
  const numbers: number[] = [];
  for (const m of outputText.matchAll(/^\s*(\d+):/gm)) {
    numbers.push(Number(m[1]));
    if (numbers.length > 100000) break;
  }
  if (numbers.length === 0) return null;

  const start = numbers[0];
  const end = numbers[numbers.length - 1];
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return { start, end };
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) if (typeof value === "string" && value.length > 0) return value;
  return undefined;
}

function toNumber(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : undefined;
}

export const ContextSourceMonitorPlugin: Plugin = async ({ directory, worktree, client }) => {
  const workspace = worktree || directory || process.cwd();
  const engine = getEngine(workspace);
  const defaultMapPath = `${ARTIFACT_DIR}/${MAP_FILENAME}`;

  const log = async (level: "debug" | "info" | "warn" | "error", message: string, extra?: Record<string, unknown>) => {
    try {
      await client.app.log({ body: { service: "context-source-monitor", level, message, extra } });
    } catch {
      /* logging must never break a tool call */
    }
  };

  /** Persist, but never let an IO error escape into the session. */
  const persist = () => {
    try {
      engine.save();
    } catch (error) {
      void log("warn", `state save failed: ${(error as Error).message}`);
    }
  };

  /** Reads awaiting their exact interval, keyed by callID. */
  const pendingReads = new Map<string, { filePath: string; offset?: number; limit?: number }>();

  return {
    tool: {
      context_source_monitor: tool({
        description:
          "Context Source Monitor: read-coverage audit and a source-interval -> target-interval influence " +
          "map. `influence`/`reconcile` only produce HINTS (a cheap scaffold guess, not an answer) — " +
          "confirm/reject/link settle them, `pending` lists what awaits judgment (including edges demoted " +
          "to needs-reconfirm when content changed underneath them), and `infer` proposes provenance by " +
          "CONTENT where no detector can see it (paraphrase, or work done before this tool existed). " +
          "Nothing is deleted by hash: vanished locations retire into an archive that `infer`/`resolve` " +
          "turn back into current provenance. `install` (re)installs this project's own copy of this tool's " +
          "integration files from the skill bundle, and `status` reports whether that copy is current, an " +
          "update is available, or it was hand-edited (drifted, needs `force` to overwrite). Actions: " +
          "status, coverage, influence, reconcile, confirm, reject, pending, infer, resolve, explain, link, " +
          "annotate, install, enable, disable, reset.",
        args: {
          action: tool.schema
            .enum([
              "status",
              "coverage",
              "influence",
              "reconcile",
              "confirm",
              "reject",
              "pending",
              "infer",
              "resolve",
              "explain",
              "link",
              "annotate",
              "install",
              "enable",
              "disable",
              "reset",
            ])
            .describe("what to do"),
          scope: tool.schema.string().optional().describe("coverage: limit to this directory"),
          sources: tool.schema
            .string()
            .optional()
            .describe("influence/reconcile/infer: comma-separated source roots (influencers)"),
          targets: tool.schema
            .string()
            .optional()
            .describe("influence/reconcile/infer: comma-separated target roots (influenced)"),
          detectors: tool.schema
            .string()
            .optional()
            .describe("influence/reconcile: comma-separated subset of path-reference,entity-mention,content-overlap"),
          minConfidence: tool.schema
            .number()
            .optional()
            .describe("influence/reconcile: drop weak HINT edges below this (0-1); never touches confirmed or needs-reconfirm"),
          mapFile: tool.schema
            .string()
            .optional()
            .describe("map to read (default data/research/context-source-monitor/inf-map.json)"),
          archiveFile: tool.schema
            .string()
            .optional()
            .describe("retired archive (default alongside the map as inf-map-archive.json)"),
          outFile: tool.schema.string().optional().describe("write the report/map to this path instead of returning it"),
          filePath: tool.schema.string().optional().describe("explain/annotate target file"),
          sourceFile: tool.schema
            .string()
            .optional()
            .describe("confirm/reject/link: the source (influencing) file. infer: a path whose retired history to re-investigate"),
          sourceInterval: tool.schema
            .string()
            .optional()
            .describe('confirm/reject/link: source line range "START-END" (omit for whole file)'),
          targetFile: tool.schema
            .string()
            .optional()
            .describe("confirm/reject/link: the target (influenced) file. infer: focus on this target"),
          targetInterval: tool.schema
            .string()
            .optional()
            .describe('confirm/reject/link/infer: target line range "START-END" (omit for whole file)'),
          confidence: tool.schema.number().optional().describe("confirm/link: confidence to record (default 1)"),
          resolves: tool.schema
            .string()
            .optional()
            .describe("confirm/link: comma-separated retired node ids this edge re-derives"),
          nodeId: tool.schema.string().optional().describe("resolve: the retired node id being answered"),
          into: tool.schema
            .string()
            .optional()
            .describe("resolve: comma-separated live node ids that now carry that influence"),
          note: tool.schema.string().optional().describe("confirm/resolve: why"),
          description: tool.schema.string().optional().describe("annotate: summary for the whole file"),
          blockName: tool.schema.string().optional().describe("annotate: structural block name"),
          blockDocumentation: tool.schema.string().optional().describe("annotate: documentation for that block"),
          limit: tool.schema.number().optional().describe("rows per report section"),
          tools: tool.schema
            .string()
            .optional()
            .describe(`install: comma-separated tool integrations to (re)install (default: all — ${supportedTools().join(", ")})`),
          force: tool.schema
            .boolean()
            .optional()
            .describe("install: overwrite a locally-modified installed file instead of skipping it"),
        },
        async execute(args, context) {
          engine.touchSession(context.sessionID);
          const limit = args.limit;
          const mapPath = args.mapFile || defaultMapPath;
          const parseInterval = (raw?: string) => {
            if (!raw) return undefined;
            const m = raw.match(/^(\d+)-(\d+)$/);
            return m ? { start: Number(m[1]), end: Number(m[2]) } : undefined;
          };

          switch (args.action) {
            case "enable": {
              const res = engine.enable(context.sessionID);
              persist();
              return res.message;
            }
            case "disable": {
              const res = engine.disable();
              persist();
              return res.message;
            }
            case "reset": {
              const res = engine.reset();
              persist();
              return res.message;
            }

            case "coverage": {
              const snapshot = engine.coverage({ scope: args.scope });
              engine.recordTrace(snapshot);
              persist();
              const markdown = renderCoverageMarkdown(snapshot, { limit });
              if (args.outFile) {
                const dest = engine.writeArtifact(args.outFile, markdown);
                return `Coverage written to ${dest}: ${snapshot.totals.lineCoveragePercent}% of lines, ${snapshot.totals.unreadIntervals} unread intervals across ${snapshot.totals.files} files.`;
              }
              return { title: `coverage ${snapshot.totals.lineCoveragePercent}%`, output: markdown };
            }

            case "influence":
            case "reconcile": {
              const opts = {
                sourceRoots: splitList(args.sources),
                targetRoots: splitList(args.targets),
                detectors: splitList(args.detectors),
                minConfidence: args.minConfidence,
              };
              const result =
                args.action === "reconcile"
                  ? engine.reconcileInfluenceGraph({
                      ...opts,
                      previousPath: args.mapFile,
                      archivePath: args.archiveFile,
                    })
                  : { graph: engine.buildInfluenceGraph(opts), reconciled: false as const, report: null };
              const graph = result.graph;
              const stats = graph.stats();
              const written = engine.saveGraphArtifact(graph, args.outFile || mapPath, {
                archivePath: args.archiveFile,
              });
              const summary =
                args.action === "reconcile"
                  ? result.reconciled
                    ? reconcileSummary((result as { report: ReconcileReport }).report)
                    : "no previous map found — built fresh"
                  : "built from scratch";
              return (
                `${summary}. Written to ${written.mapPath}: ${stats.edges} edges over ${stats.nodes} nodes ` +
                `(${JSON.stringify(stats.byState)}), ${stats.unresolvedReferences} unresolved references.` +
                (written.archivePath
                  ? ` Archive ${written.archivePath}: ${stats.archived.retiredNodes} retired.`
                  : "") +
                ` Hints are not verified — read both locations and confirm/reject each.` +
                (stats.byState["needs-reconfirm"]
                  ? ` ${stats.byState["needs-reconfirm"]} edge(s) need RE-confirmation (action: pending).`
                  : "")
              );
            }

            case "confirm":
            case "link": {
              if (!args.sourceFile || !args.targetFile) return `${args.action} requires sourceFile and targetFile.`;
              const result = engine.confirmInfluence({
                mapPath: args.mapFile,
                archivePath: args.archiveFile,
                sourceFile: args.sourceFile,
                sourceInterval: parseInterval(args.sourceInterval),
                targetFile: args.targetFile,
                targetInterval: parseInterval(args.targetInterval),
                confidence: args.confidence,
                resolves: splitList(args.resolves),
                note: args.note,
              });
              if (!result.ok) return `Cannot ${args.action}: ${result.error}`;
              return (
                `${args.action === "link" ? "Declared" : "Confirmed"}: ${args.sourceFile} -> ${args.targetFile} ` +
                `(confidence ${result.edge.confidence}).` +
                (result.resolved?.length ? ` Resolved retired: ${result.resolved.join(", ")}.` : "")
              );
            }

            case "reject": {
              if (!args.sourceFile || !args.targetFile) return "reject requires sourceFile and targetFile.";
              const result = engine.rejectInfluence({
                mapPath: args.mapFile,
                archivePath: args.archiveFile,
                sourceFile: args.sourceFile,
                sourceInterval: parseInterval(args.sourceInterval),
                targetFile: args.targetFile,
                targetInterval: parseInterval(args.targetInterval),
              });
              if (!result.ok) return `Cannot reject: ${result.error}`;
              return `Rejected (deleted, not tombstoned): ${args.sourceFile} -> ${args.targetFile}.`;
            }

            case "pending": {
              const graph =
                engine.readGraphArtifact(mapPath, { archivePath: args.archiveFile }) || new InfluenceGraph();
              const pending = engine.pendingReview(graph);
              return {
                title:
                  `${pending.needsReconfirm.length} need re-confirm, ${pending.retired.length} retired, ` +
                  `${pending.staleWrites.length} stale writes, ${pending.staleReads.length} stale reads`,
                output: renderPendingMarkdown(pending, { limit }),
              };
            }

            case "infer": {
              const result = engine.inferProvenance({
                mapPath: args.mapFile,
                archivePath: args.archiveFile,
                sourceFile: args.sourceFile,
                targetFile: args.targetFile,
                interval: parseInterval(args.targetInterval),
                sourceRoots: splitList(args.sources),
                targetRoots: splitList(args.targets),
                limit,
              });
              const markdown = renderInferMarkdown(result, { limit });
              if (args.outFile) {
                const dest = engine.writeArtifact(args.outFile, markdown);
                return `Inference written to ${dest}.`;
              }
              const title =
                result.kind === "reinvestigation"
                  ? `re-investigate ${result.source} (${result.packets.length} retired)`
                  : `${result.targets.length} target(s) with unexplained content`;
              return { title, output: markdown };
            }

            case "resolve": {
              if (!args.nodeId) return "resolve requires nodeId (the retired node being answered).";
              const result = engine.resolveRetired({
                mapPath: args.mapFile,
                archivePath: args.archiveFile,
                nodeId: args.nodeId,
                into: splitList(args.into) || [],
                note: args.note,
              });
              if (!result.ok) return `Cannot resolve: ${result.error}`;
              return `Resolved retired node ${args.nodeId} — moved out of the re-investigation queue.`;
            }

            case "explain": {
              if (!args.filePath) return "explain requires filePath.";
              const relPath = engine.normalize(args.filePath).relative;
              const graph =
                engine.readGraphArtifact(mapPath, { archivePath: args.archiveFile }) || new InfluenceGraph();
              return { title: `provenance of ${relPath}`, output: renderExplainMarkdown(graph, relPath, { limit }) };
            }

            case "annotate": {
              if (!args.filePath) return "annotate requires filePath.";
              const done: string[] = [];
              if (args.description) {
                engine.annotateFile(args.filePath, args.description);
                done.push("file description");
              }
              if (args.blockName && args.blockDocumentation) {
                engine.annotateBlock(args.filePath, args.blockName, args.blockDocumentation);
                done.push(`block "${args.blockName}"`);
              }
              if (done.length === 0) return "annotate requires description, or blockName + blockDocumentation.";
              persist();
              return `Annotated ${args.filePath}: ${done.join(", ")}.`;
            }

            case "install": {
              const tools = splitList(args.tools);
              const reports = installAll(engine.workspace, { tools, force: args.force === true });
              const drifted = reports.some((r) => r.skippedDrift.length);
              return (
                summarizeInstall(reports) +
                (drifted ? "\nSome installed files were locally modified and were left alone. Pass force: true to overwrite them." : "")
              );
            }

            case "status":
            default: {
              const snapshot = engine.coverage({ scope: args.scope, blockDetail: "none" });
              const t = snapshot.totals;
              const integrations = checkAll(engine.workspace);
              return [
                `tracking: ${engine.isTracking() ? "active" : "inactive"}`,
                `coverage: ${t.lineCoveragePercent}% of ${t.lines} lines in ${t.files} files`,
                `fully read ${t.filesFullyRead} | partial ${t.filesPartiallyRead} | unread ${t.filesUnread}`,
                `unread intervals: ${t.unreadIntervals}`,
                `files written: ${t.filesWritten}`,
                `integrations:`,
                ...summarizeCheck(integrations)
                  .split("\n")
                  .map((line) => `  ${line}`),
              ].join("\n");
            }
          }
        },
      }),
    },

    "experimental.chat.system.transform": async (_input, output) => {
      if (!engine.isTracking()) return;
      output.system.push(ENFORCEMENT_PROMPT);
    },

    "tool.execute.before": async (input, output) => {
      if (!engine.isTracking()) return;
      const toolName = (input.tool || "").toLowerCase();
      const args = output?.args ?? {};

      if (READ_TOOLS.has(toolName)) {
        const filePath = firstString(args.filePath, args.path, args.file, args.filename, args.uri);
        if (filePath) {
          // Remember the request; the exact interval is known only from the result.
          pendingReads.set(input.callID, {
            filePath,
            offset: toNumber(args.offset),
            limit: toNumber(args.limit),
          });
        }
        return;
      }

      if (WRITE_TOOLS.has(toolName)) return; // recorded in .after, once it succeeded

      if (SHELL_TOOLS.has(toolName)) {
        const command = firstString(args.command, args.cmd, args.script);
        if (!command) return;
        for (const read of extractReads(command, engine.workspace)) {
          engine.recordRead(read.filePath, {
            offset: read.offset,
            limit: read.limit,
            tailLines: read.tailLines,
            tool: `bash:${read.utility}`,
            sessionId: input.sessionID,
          });
        }
        for (const write of extractWrites(command, engine.workspace)) {
          engine.recordWrite(write.filePath, { tool: `bash:${write.utility}`, sessionId: input.sessionID });
        }
        persist();
        return;
      }

      if (SUBAGENT_TOOLS.has(toolName) && typeof args.prompt === "string") {
        output.args.prompt = `${args.prompt}\n\n${SUBAGENT_NOTICE}`;
      }
    },

    "tool.execute.after": async (input, output) => {
      if (!engine.isTracking()) return;
      const toolName = (input.tool || "").toLowerCase();

      if (READ_TOOLS.has(toolName)) {
        const pending = pendingReads.get(input.callID);
        pendingReads.delete(input.callID);
        if (!pending) return;
        // Directory listings and errors have no line numbering — nothing to record.
        const interval = parseReadOutputInterval(String(output?.output ?? ""));
        engine.recordRead(pending.filePath, {
          interval: interval ?? undefined,
          offset: pending.offset,
          limit: pending.limit,
          tool: toolName,
          sessionId: input.sessionID,
        });
        persist();
        return;
      }

      if (WRITE_TOOLS.has(toolName)) {
        const args = input.args ?? {};
        const filePath = firstString(args.filePath, args.path, args.file, args.filename);
        if (!filePath) return;
        engine.recordWrite(filePath, { tool: toolName, sessionId: input.sessionID });
        persist();
      }
    },

    event: async ({ event }) => {
      // Writes made outside tool calls (formatters, external editors) still matter.
      if (!engine.isTracking()) return;
      if (event.type === "file.edited" && (event as any).properties?.file) {
        engine.recordWrite(String((event as any).properties.file), { tool: "file.edited" });
      }
      if (event.type === "session.idle") persist();
    },

    dispose: async () => {
      // Only persist what we actually tracked. An inactive engine holds nothing worth
      // saving, and writing it anyway would clobber state produced by another process
      // (the CLI, or a second editor session on the same workspace) with an empty,
      // stale snapshot on every shutdown.
      if (!engine.isTracking()) return;
      persist();
    },
  };
};

function splitList(value?: string): string[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

type ReconcileReport = {
  unchanged: boolean;
  changedFiles: string[];
  deletedFiles: string[];
  relocated: unknown[];
  demoted: unknown[];
  bounded: unknown[];
  retired: unknown[];
  reparented: number;
  freshHints: number;
  coalesced: number;
  needsReconfirm: number;
};

/** One line naming everything that actually happened, so a reconcile is never a mystery. */
function reconcileSummary(report: ReconcileReport): string {
  if (!report) return "reconciled";
  if (report.unchanged) return "nothing changed since the previous map";
  const parts: string[] = [];
  if (report.changedFiles.length) parts.push(`changed ${report.changedFiles.length}`);
  if (report.deletedFiles.length) parts.push(`deleted ${report.deletedFiles.length}`);
  if (report.relocated.length) parts.push(`relocated ${report.relocated.length}`);
  if (report.demoted.length) parts.push(`demoted-files ${report.demoted.length}`);
  if (report.bounded.length) parts.push(`bounded ${report.bounded.length}`);
  if (report.reparented) parts.push(`re-parented ${report.reparented}`);
  if (report.retired.length) parts.push(`retired ${report.retired.length}`);
  if (report.freshHints) parts.push(`fresh-hints ${report.freshHints}`);
  if (report.coalesced) parts.push(`coalesced ${report.coalesced}`);
  return parts.join(", ") || "no structural change";
}

/**
 * One engine per workspace. Files in .opencode/plugins/ are auto-loaded, and a
 * stale `plugin` entry in opencode.json can load this module a second time;
 * without this guard that would mean two engines double-counting every read and
 * racing each other's state writes.
 */
const engines = new Map<string, ContextSourceMonitorEngine>();

function getEngine(workspace: string): ContextSourceMonitorEngine {
  let engine = engines.get(workspace);
  if (!engine) {
    engine = ContextSourceMonitorEngine.open({ workspace });
    engines.set(workspace, engine);
  }
  return engine;
}

/** Drop cached engines. For tests and hot-reload; not used in normal operation. */
export function resetEngineCache(): void {
  engines.clear();
}

export default ContextSourceMonitorPlugin;
