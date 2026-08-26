/**
 * Context Source Monitor engine.
 *
 * Two independent concerns, deliberately not conflated:
 *   1. COVERAGE   — which lines of the workspace this agent has actually read.
 *   2. INFLUENCE  — a graph of source -> target influence, scaffolded cheaply
 *                   and refined by whoever actually reads both sides.
 *
 * Coverage computation is PURE: calling it never mutates history.
 *
 * Reconcile contract (v4 — see graph.mjs for the identity model):
 *   - A file's content changing NEVER destroys a connection. File-scope nodes
 *     keep their identity and have their edges demoted to `needs-reconfirm`;
 *     span-scope nodes are RELOCATED when their text merely moved.
 *   - A span whose text is genuinely gone is RETIRED into the archive, and
 *     wherever possible its edges are re-parented onto the bounding span that
 *     replaced it, as `needs-reconfirm`. Nothing is deleted by hash.
 *   - Retirement is the only removal path for a node. The confidence floor may
 *     drop `hint` edges and nothing else.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  statLines,
  readTextFile,
  mergeIntervals,
  clampIntervals,
  invertIntervals,
  intersectIntervals,
  countIntervalLines,
  percent,
  hashText,
  sliceLines,
  splitLines,
  isValidInterval,
  intervalsTouch,
  boundingInterval,
} from "./text.mjs";
import { walkFiles, toPosix, IgnoreRules, HARD_IGNORES } from "./ignore.mjs";
import { isProbablyBinary, parseStructure } from "./structure.mjs";
import { WorkspaceIndex } from "./resolve.mjs";
import { ShingleIndex, DEFAULT_OVERLAP_OPTIONS } from "./overlap.mjs";
import {
  InfluenceGraph,
  GraphArchive,
  SCHEMA_VERSION,
  EDGE_STATES,
  NODE_SCOPES,
  RETIRE_REASONS,
  spanNodeId,
  describeOccurrence,
  relocateSpan,
} from "./graph.mjs";
import { detectReferences, detectContentOverlap, HINT_CONFIDENCE } from "./detectors.mjs";

/** Where durable artifacts live. AGENTS.md: generated analysis goes to data/research/. */
export const ARTIFACT_DIR = "data/research/context-source-monitor";
export const STATE_FILENAME = "state.json";
export const MAP_FILENAME = "inf-map.json";
/** Retired history. Never rendered to markdown, never mixed into the live map. */
export const ARCHIVE_FILENAME = "inf-map-archive.json";
/** Plain, gitignore-syntax, hand-editable list of paths noisy for influence-mapping. */
export const IGNORED_PATHS_FILENAME = "ignored-paths.txt";
/** Which roots are original source material vs. generated artifacts (for `infer`). */
export const ROLES_FILENAME = "roles.txt";

export const DEFAULT_CONFIG = Object.freeze({
  readToolDefaultLimit: 2000,
  maxTextFileBytes: 4 * 1024 * 1024,
  directoryFanoutCap: 12,
  respectGitignore: true,
  blockDetail: "partial", // "none" | "partial" | "all"
});

export class ContextSourceMonitorEngine {
  constructor(options = {}) {
    this.workspace = path.resolve(options.workspace || process.cwd());
    this.config = { ...DEFAULT_CONFIG, ...(options.config || {}) };
    this.statePath = options.statePath
      ? path.resolve(this.workspace, options.statePath)
      : path.join(this.workspace, ARTIFACT_DIR, STATE_FILENAME);

    this.active = false;
    this.sessions = [];
    /** @type {Map<string, object>} relPath -> read record */
    this.reads = new Map();
    /** @type {Map<string, object>} relPath -> write record */
    this.writes = new Map();
    /** @type {Map<string, {description?: string, blocks: Record<string,string>}>} */
    this.annotations = new Map();
    this.traceHistory = [];
    this.scanCache = null;
  }

  // -- lifecycle ------------------------------------------------------------

  enable(sessionId) {
    this.active = true;
    this.touchSession(sessionId);
    return { active: true, message: `Context Source Monitor enabled for ${this.workspace}` };
  }

  disable() {
    this.active = false;
    return { active: false, message: `Context Source Monitor disabled (${this.reads.size} files tracked)` };
  }

  isTracking() {
    return this.active;
  }

  touchSession(sessionId) {
    if (!sessionId) return;
    const now = new Date().toISOString();
    const existing = this.sessions.find((s) => s.id === sessionId);
    if (existing) existing.lastSeenAt = now;
    else this.sessions.push({ id: sessionId, startedAt: now, lastSeenAt: now });
  }

  reset({ keepAnnotations = false } = {}) {
    this.reads.clear();
    this.writes.clear();
    this.traceHistory = [];
    this.scanCache = null;
    if (!keepAnnotations) this.annotations.clear();
    return { message: "Context Source Monitor state cleared" };
  }

  // -- paths ----------------------------------------------------------------

  normalize(rawPath) {
    const absolute = path.isAbsolute(rawPath) ? path.resolve(rawPath) : path.resolve(this.workspace, rawPath);
    const relative = toPosix(path.relative(this.workspace, absolute));
    return { absolute, relative, inWorkspace: relative !== "" && !relative.startsWith("..") };
  }

  // -- recording ------------------------------------------------------------

  recordRead(rawPath, options = {}) {
    if (!rawPath) return null;
    const { absolute, relative } = this.normalize(rawPath);
    const { lines: totalLines, bytes } = statLines(absolute);
    const now = new Date().toISOString();
    const tool = options.tool || "read";

    const interval = this.resolveReadInterval(totalLines, options);

    let record = this.reads.get(relative);
    if (!record) {
      record = {
        relPath: relative,
        readCount: 0,
        intervals: [],
        tools: [],
        firstReadAt: now,
        lastReadAt: now,
        lines: totalLines,
        bytes,
      };
      this.reads.set(relative, record);
    }
    record.readCount++;
    record.lastReadAt = now;
    record.lines = totalLines;
    record.bytes = bytes;
    if (!record.tools.includes(tool)) record.tools.push(tool);
    if (interval) record.intervals = mergeIntervals([...record.intervals, interval]);

    this.touchSession(options.sessionId);
    return record;
  }

  resolveReadInterval(totalLines, options) {
    if (totalLines <= 0) return null;
    if (options.interval) {
      const clamped = clampIntervals([options.interval], totalLines);
      return clamped[0] || null;
    }
    if (options.tailLines && options.tailLines > 0) {
      const start = Math.max(1, totalLines - options.tailLines + 1);
      return { start, end: totalLines };
    }
    const offset = Number.isInteger(options.offset) && options.offset > 0 ? options.offset : 1;
    if (offset > totalLines) return null;
    const limit =
      Number.isInteger(options.limit) && options.limit > 0 ? options.limit : this.config.readToolDefaultLimit;
    return { start: offset, end: Math.min(totalLines, offset + limit - 1) };
  }

  recordWrite(rawPath, options = {}) {
    if (!rawPath) return null;
    const { absolute, relative } = this.normalize(rawPath);
    const { lines: totalLines, bytes } = statLines(absolute);
    const now = new Date().toISOString();
    const tool = options.tool || "write";

    let record = this.writes.get(relative);
    if (!record) {
      record = { relPath: relative, writeCount: 0, tools: [], firstWriteAt: now, lastWriteAt: now, intervals: [] };
      this.writes.set(relative, record);
    }
    record.writeCount++;
    record.lastWriteAt = now;
    record.lines = totalLines;
    record.bytes = bytes;
    if (!record.tools.includes(tool)) record.tools.push(tool);
    if (options.interval) record.intervals = mergeIntervals([...record.intervals, options.interval]);
    else record.intervals = mergeIntervals([...record.intervals, { start: 1, end: Math.max(1, totalLines) }]);

    this.touchSession(options.sessionId);
    return record;
  }

  // -- annotations ------------------------------------------------------------

  annotateFile(rawPath, description) {
    const { relative } = this.normalize(rawPath);
    const entry = this.annotations.get(relative) || { blocks: {} };
    entry.description = description;
    this.annotations.set(relative, entry);
    return { relPath: relative, description };
  }

  annotateBlock(rawPath, blockName, documentation) {
    const { relative } = this.normalize(rawPath);
    const entry = this.annotations.get(relative) || { blocks: {} };
    entry.blocks[blockName] = documentation;
    this.annotations.set(relative, entry);
    return { relPath: relative, blockName, documentation };
  }

  // -- workspace scanning ---------------------------------------------------

  scan(options = {}) {
    const scope = options.scope ? path.resolve(this.workspace, options.scope) : this.workspace;
    const respectGitignore = options.respectGitignore ?? this.config.respectGitignore;
    const cacheKey = `${scope}|${respectGitignore}|${(options.extraIgnores || []).join(",")}`;
    if (!options.force && !options.ignoredSink && this.scanCache?.key === cacheKey) return this.scanCache.files;

    const walked = walkFiles({
      workspace: this.workspace,
      root: scope,
      respectGitignore,
      extraIgnores: options.extraIgnores,
      ignoredSink: options.ignoredSink,
    });

    const files = [];
    for (const entry of walked) {
      if (isProbablyBinary(entry.absPath)) continue;
      const { lines, bytes } = statLines(entry.absPath);
      files.push({
        relPath: entry.relPath,
        absPath: entry.absPath,
        lines,
        bytes,
        load: memoize(() => readTextFile(entry.absPath, this.config.maxTextFileBytes).content),
      });
    }

    this.scanCache = { key: cacheKey, files };
    return files;
  }

  index(options = {}) {
    return new WorkspaceIndex(this.workspace, this.scan(options));
  }

  // -- coverage (pure) ------------------------------------------------------

  coverage(options = {}) {
    const files = this.scan(options);
    const blockDetail = options.blockDetail || this.config.blockDetail;
    const inScope = new Set(files.map((f) => f.relPath));

    const entries = [];
    let totalLines = 0;
    let totalRead = 0;
    let fullyRead = 0;
    let partiallyRead = 0;
    let unread = 0;
    let unreadIntervalCount = 0;

    for (const file of files) {
      const read = this.reads.get(file.relPath);
      const write = this.writes.get(file.relPath);
      const annotation = this.annotations.get(file.relPath);
      const readIntervals = clampIntervals(read?.intervals || [], file.lines);
      const linesRead = countIntervalLines(readIntervals);
      const unreadIntervals = invertIntervals(file.lines, readIntervals);

      totalLines += file.lines;
      totalRead += linesRead;
      unreadIntervalCount += unreadIntervals.length;

      let status;
      if (file.lines === 0) status = "EMPTY";
      else if (unreadIntervals.length === 0) status = "FULLY_READ";
      else if (linesRead > 0) status = "PARTIALLY_READ";
      else status = "UNREAD";

      if (status === "FULLY_READ" || status === "EMPTY") fullyRead++;
      else if (status === "PARTIALLY_READ") partiallyRead++;
      else unread++;

      const entry = {
        relPath: file.relPath,
        lines: file.lines,
        bytes: file.bytes,
        status,
        readCount: read?.readCount || 0,
        readIntervals,
        linesRead,
        unreadIntervals,
        coveragePercent: file.lines === 0 ? 100 : percent(linesRead, file.lines),
        tools: read?.tools || [],
        writeCount: write?.writeCount || 0,
        writeTools: write?.tools || [],
        description: annotation?.description,
      };

      const wantBlocks = blockDetail === "all" || (blockDetail === "partial" && status === "PARTIALLY_READ");
      if (wantBlocks) entry.blocks = this.blockCoverage(file, readIntervals, unreadIntervals, annotation);
      entries.push(entry);
    }

    const outsideScope = [];
    for (const [relPath, read] of this.reads) {
      if (inScope.has(relPath)) continue;
      outsideScope.push({
        relPath,
        lines: read.lines,
        readCount: read.readCount,
        readIntervals: read.intervals,
        linesRead: countIntervalLines(read.intervals),
        tools: read.tools,
      });
    }

    return {
      schemaVersion: SCHEMA_VERSION,
      kind: "coverage-report",
      generatedAt: new Date().toISOString(),
      workspace: this.workspace,
      scope: options.scope
        ? toPosix(path.relative(this.workspace, path.resolve(this.workspace, options.scope))) || "."
        : ".",
      active: this.active,
      totals: {
        files: files.length,
        lines: totalLines,
        linesRead: Math.min(totalRead, totalLines),
        lineCoveragePercent: percent(Math.min(totalRead, totalLines), totalLines),
        filesFullyRead: fullyRead,
        filesPartiallyRead: partiallyRead,
        filesUnread: unread,
        fileCoveragePercent: percent(fullyRead, files.length),
        unreadIntervals: unreadIntervalCount,
        filesWritten: this.writes.size,
        readOutsideScope: outsideScope.length,
      },
      files: entries,
      readOutsideScope: outsideScope,
    };
  }

  blockCoverage(file, readIntervals, unreadIntervals, annotation) {
    const content = file.load();
    if (!content) return [];
    return parseStructure(file.relPath, content).map((block) => {
      const span = [{ start: block.startLine, end: block.endLine }];
      const readIn = intersectIntervals(span, readIntervals);
      const unreadIn = intersectIntervals(span, unreadIntervals);
      const covered = countIntervalLines(readIn);
      return {
        name: block.name,
        kind: block.kind,
        startLine: block.startLine,
        endLine: block.endLine,
        lineCount: block.lineCount,
        linesRead: covered,
        linesUnread: countIntervalLines(unreadIn),
        coveragePercent: percent(covered, block.lineCount),
        status: covered === 0 ? "UNREAD" : covered >= block.lineCount ? "READ" : "PARTIAL",
        readIntervals: readIn,
        unreadIntervals: unreadIn,
        documentation: annotation?.blocks?.[block.name],
      };
    });
  }

  recordTrace(snapshot) {
    const entry = {
      index: this.traceHistory.length + 1,
      at: snapshot.generatedAt,
      lineCoveragePercent: snapshot.totals.lineCoveragePercent,
      unreadIntervals: snapshot.totals.unreadIntervals,
      filesUnread: snapshot.totals.filesUnread,
      filesPartiallyRead: snapshot.totals.filesPartiallyRead,
    };
    this.traceHistory.push(entry);
    return entry;
  }

  // -- influence-mapping ignore list (separate from .gitignore) --------------

  ignoredPathsFile() {
    return path.join(this.workspace, ARTIFACT_DIR, IGNORED_PATHS_FILENAME);
  }

  loadIgnoredPathsRules() {
    const file = this.ignoredPathsFile();
    if (!fs.existsSync(file)) return null;
    return new IgnoreRules().addFile(file, "");
  }

  /** Drop any file the ignore-list matches. Never affects coverage/status — influence-only. */
  filterIgnoredPaths(files) {
    const rules = this.loadIgnoredPathsRules();
    if (!rules) return files;
    return files.filter((f) => !rules.isIgnored(f.relPath, false));
  }

  // -- roles: which roots are original material vs. generated artifacts ------

  rolesFile() {
    return path.join(this.workspace, ARTIFACT_DIR, ROLES_FILENAME);
  }

  /**
   * Parse `roles.txt`: lines of `source: <path>` / `generated: <path>`.
   *
   * `infer` needs this to reason about direction when there is no session log
   * at all (adopting a repo built before this tool existed): original intake
   * material can only ever be a source, and generated trees can only ever be
   * targets, so candidate ranking has a prior even with zero recorded reads.
   */
  loadRoles() {
    const file = this.rolesFile();
    const roles = { source: [], generated: [], file: fs.existsSync(file) ? toPosix(path.relative(this.workspace, file)) : null };
    if (!roles.file) return roles;
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      return roles;
    }
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.replace(/\s+#.*$/, "").trim();
      if (!line || line.startsWith("#")) continue;
      const m = line.match(/^(source|generated)\s*:\s*(.+)$/i);
      if (!m) continue;
      const key = m[1].toLowerCase();
      roles[key].push(m[2].trim().replace(/\/+$/, ""));
    }
    return roles;
  }

  // -- influence graph: scaffold ---------------------------------------------

  /**
   * Run the scaffold over the given source/target file sets and fold the result
   * into `graph`. Idempotent by construction: unchanged content regenerates the
   * exact same node ids and intervals (span intervals are derived from the
   * occurrence index, never from call order).
   */
  runScaffold(graph, { sourceFiles, targetFiles, detectors, options = {} }) {
    const enabled = new Set(detectors?.length ? detectors : ["path-reference", "content-overlap"]);
    const sourceFilter = options.sourceRoots?.length ? new Set(sourceFiles.map((f) => f.relPath)) : null;
    const byRelPath = new Map([...sourceFiles, ...targetFiles].map((f) => [f.relPath, f]));
    const loadContent = (relPath) => byRelPath.get(relPath)?.load() ?? null;

    const stats = { references: 0, unresolved: 0, skippedOutOfScope: 0, skippedGeneric: 0, overlap: 0 };
    const restrictTo = options.onlyTargets ? new Set(options.onlyTargets) : null;
    const scaffoldTargets = restrictTo ? targetFiles.filter((f) => restrictTo.has(f.relPath)) : targetFiles;

    if (enabled.has("path-reference") || enabled.has("entity-mention")) {
      const indexFiles = options.indexFiles || this.scan(options);
      const indexUniverse = new Map([...indexFiles, ...sourceFiles, ...targetFiles].map((f) => [f.relPath, f]));
      const index = new WorkspaceIndex(this.workspace, [...indexUniverse.values()]);
      for (const file of scaffoldTargets) {
        const content = file.load();
        if (!content) continue;
        const result = detectReferences({
          graph,
          index,
          relPath: file.relPath,
          content,
          options: {
            genericFanoutThreshold: options.genericFanoutThreshold,
            entityMentions: enabled.has("entity-mention"),
            sourceFilter,
            loadContent,
          },
        });
        stats.references += result.edges;
        stats.unresolved += result.unresolved;
        stats.skippedOutOfScope += result.skippedOutOfScope;
        stats.skippedGeneric += result.skippedGeneric;
      }
    }

    if (enabled.has("content-overlap")) {
      const result = detectContentOverlap({
        graph,
        sources: loadAll(sourceFiles),
        targets: loadAll(scaffoldTargets),
        options: options.overlap,
      });
      stats.overlap += result.edges;
    }

    return stats;
  }

  /** Build the influence graph from scratch. */
  buildInfluenceGraph(options = {}) {
    const ignoredSink = options.ignoredSink || [];
    const scanOpts = { ...options, ignoredSink };
    const sourceFiles = this.filterIgnoredPaths(this.collectRoots(options.sourceRoots, scanOpts));
    const targetFiles = this.filterIgnoredPaths(this.collectRoots(options.targetRoots, scanOpts));
    const universe = new Map();
    for (const f of [...sourceFiles, ...targetFiles]) universe.set(f.relPath, f);

    const graph = new InfluenceGraph();
    const stats = this.runScaffold(graph, { sourceFiles, targetFiles, detectors: options.detectors, options });
    for (const f of universe.values()) graph.fileHashes.set(f.relPath, hashText(f.load()));

    this.finalizeInfluenceGraph(graph, { options, ignoredSink });
    graph.scaffoldStats = stats;
    return graph;
  }

  /**
   * Incrementally refresh a previously built influence graph.
   *
   * Order matters and is not arbitrary:
   *   1. deleted files    -> retire their nodes (`file-deleted`)
   *   2. changed files    -> file nodes keep identity, their edges get demoted;
   *                          span nodes are verified, then relocated if their
   *                          text merely moved
   *   3. genuinely gone spans -> clustered into bounding spans that inherit
   *                          their edges as `needs-reconfirm`, then retired
   *   4. scaffold re-run  -> fresh hints for the new content
   *   5. coalesce         -> a fresh hint that merely restates an inherited
   *                          `needs-reconfirm` edge is dropped, so one region
   *                          never carries two rival descriptions of the same
   *                          influence
   */
  reconcileInfluenceGraph(options = {}) {
    const mapPath = options.previousPath || path.join(ARTIFACT_DIR, MAP_FILENAME);
    const previous = this.readGraphArtifact(mapPath, { archivePath: options.archivePath });
    if (!previous) {
      const graph = this.buildInfluenceGraph(options);
      return {
        graph,
        reconciled: false,
        reason: "no-previous-map",
        report: emptyReconcileReport({ at: new Date().toISOString() }),
      };
    }

    const at = new Date().toISOString();
    const ignoredSink = options.ignoredSink || [];
    const scanOpts = { ...options, ignoredSink };
    const sourceFiles = this.filterIgnoredPaths(this.collectRoots(options.sourceRoots, scanOpts));
    const targetFiles = this.filterIgnoredPaths(this.collectRoots(options.targetRoots, scanOpts));
    const universe = new Map();
    for (const f of [...sourceFiles, ...targetFiles]) universe.set(f.relPath, f);

    const graph = previous;
    const report = emptyReconcileReport({ at, previousGeneratedAt: previous.generatedAt });

    // -- 1. deleted files ---------------------------------------------------
    const knownPaths = new Set([...graph.fileHashes.keys(), ...graph.nodesByPath.keys()]);
    for (const relPath of knownPaths) {
      if (universe.has(relPath)) continue;
      const ids = graph.nodeIdsForPath(relPath);
      for (const id of ids) {
        const record = graph.retireNode(id, RETIRE_REASONS.FILE_DELETED, { at });
        if (record) report.retired.push(summarizeRetirement(record));
      }
      graph.fileHashes.delete(relPath);
      report.deletedFiles.push(relPath);
    }

    // -- 2. which files actually changed ------------------------------------
    const dirty = [];
    for (const file of universe.values()) {
      const currentHash = hashText(file.load());
      if (graph.fileHashes.get(file.relPath) !== currentHash) dirty.push({ file, currentHash });
    }

    // -- 3. verify / relocate / retire nodes in changed files ---------------
    const staleByPath = new Map();
    for (const { file, currentHash } of dirty) {
      const content = file.load();
      const totalLines = splitLines(content).length;

      for (const id of graph.nodeIdsForPath(file.relPath)) {
        const node = graph.nodes.get(id);
        if (!node) continue;

        if (node.scope === NODE_SCOPES.FILE) {
          // Identity is path-only: a content change can never retire this node.
          if (node.contentHash === currentHash) continue;
          node.contentHash = currentHash;
          node.lines = totalLines;
          const demoted = [];
          for (const edge of graph.edgesTouching(id)) {
            if (edge.state === EDGE_STATES.HINT) continue;
            graph.demoteEdge(edge.id, "source-file-content-changed", at);
            demoted.push(edge.id);
          }
          if (demoted.length) {
            report.demoted.push({ path: file.relPath, scope: NODE_SCOPES.FILE, nodeId: id, edges: demoted.length });
          }
          continue;
        }

        // Span: is its own text still exactly where we left it?
        const here = describeOccurrence(content, node.interval);
        if (here && spanNodeId(node.path, here.content, here.occurrence) === id) continue;

        // Did it simply move?
        const moved = relocateSpan(content, node.content, {
          occurrence: node.occurrence ?? 0,
          previousStart: node.interval?.start ?? null,
        });
        if (moved) {
          const from = node.interval;
          const migrated = graph.migrateNode(id, { ...moved, content: node.content });
          report.relocated.push({
            path: node.path,
            nodeId: id,
            newNodeId: migrated?.id ?? id,
            from,
            to: moved.interval,
            ambiguous: !!moved.ambiguous,
          });
          continue;
        }

        // Genuinely gone.
        if (!staleByPath.has(file.relPath)) staleByPath.set(file.relPath, []);
        staleByPath.get(file.relPath).push(node);
      }
    }

    // -- 4. cluster stale spans into bounding replacements ------------------
    for (const [relPath, staleNodes] of staleByPath) {
      const file = universe.get(relPath);
      if (!file) continue;
      const content = file.load();
      const totalLines = splitLines(content).length;
      const writeIntervals = this.writes.get(relPath)?.intervals || [];

      const clusters = clusterStaleNodes(staleNodes, writeIntervals);
      const replacement = new Map();

      for (const cluster of clusters) {
        const bounds = clampIntervals([cluster.interval], totalLines)[0];
        if (!bounds) continue;
        const { node: boundingNode } = graph.ensureSpanNode(relPath, bounds, content);
        // A bounding node that resolved back onto one of the stale nodes would
        // mean the text did not actually change — impossible here, but guard so
        // we never re-parent a node onto itself.
        if (cluster.nodes.some((n) => n.id === boundingNode.id)) continue;
        for (const stale of cluster.nodes) replacement.set(stale.id, boundingNode.id);
        report.bounded.push({
          path: relPath,
          interval: bounds,
          nodeId: boundingNode.id,
          scope: boundingNode.scope,
          absorbed: cluster.nodes.map((n) => ({ nodeId: n.id, interval: n.interval })),
          widenedByWrites: cluster.widenedByWrites,
        });
      }

      // Re-parent every edge of every stale node onto its replacement, in both
      // directions, as needs-reconfirm. Both endpoints are mapped first, so an
      // edge whose two sides changed at once survives as bounding->bounding
      // instead of being silently dropped.
      const staleIds = new Set(staleNodes.map((n) => n.id));
      for (const stale of staleNodes) {
        for (const edge of graph.edgesTouching(stale.id)) {
          const from = staleIds.has(edge.from) ? replacement.get(edge.from) : edge.from;
          const to = staleIds.has(edge.to) ? replacement.get(edge.to) : edge.to;
          if (!from || !to || from === to) continue;
          if (!graph.nodes.has(from) || !graph.nodes.has(to)) continue;
          graph.addEdge({
            from,
            to,
            state: EDGE_STATES.NEEDS_RECONFIRM,
            confidence: edge.confidence,
            priorState: edge.priorState || edge.state,
            priorConfidence: edge.priorConfidence ?? edge.confidence,
            reason: "target-content-rewritten",
            at,
          });
          report.reparented++;
        }
      }

      for (const stale of staleNodes) {
        const reason = replacement.has(stale.id) ? RETIRE_REASONS.SUPERSEDED : RETIRE_REASONS.CONTENT_CHANGED;
        const record = graph.retireNode(stale.id, reason, { at });
        if (record) report.retired.push(summarizeRetirement(record));
      }
    }

    // -- 5. scaffold re-run ------------------------------------------------
    //
    // Which targets to re-scan is a correctness question, not an optimization.
    // A dirty TARGET obviously needs re-detection. But a dirty SOURCE does too
    // — from the other side: a target that never changed can still gain or lose
    // a relationship because the source's text changed underneath it (or the
    // source only just appeared, in which case ANY target might cite it and
    // there is no prior edge to narrow it down). Restricting the rescan to the
    // changed files themselves silently loses those, and a source that was
    // deleted and later restored never gets re-mapped at all.
    const dirtyPaths = new Set(dirty.map((d) => d.file.relPath));
    const sourcePaths = new Set(sourceFiles.map((f) => f.relPath));
    const targetPaths = new Set(targetFiles.map((f) => f.relPath));
    const dirtySources = [...dirtyPaths].filter((p) => sourcePaths.has(p));
    const sourceSideChanged = dirtySources.length > 0 || report.deletedFiles.some((p) => sourcePaths.has(p));

    if (dirtyPaths.size > 0 || report.deletedFiles.length > 0) {
      const scaffoldTargets = sourceSideChanged ? [...targetPaths] : [...dirtyPaths].filter((p) => targetPaths.has(p));
      report.rescannedTargets = scaffoldTargets.length;
      report.rescanReason = sourceSideChanged ? "source-side-changed" : "dirty-targets-only";

      if (scaffoldTargets.length > 0) {
        // Unresolved references are re-derived by the rescan, so the previous
        // run's entries for these same files must go first. Without this they
        // accumulate: every reconcile that rescans a file appends a second copy
        // of every unresolvable reference in it, and the list grows without
        // bound while looking like new findings.
        const rescanning = new Set(scaffoldTargets);
        graph.unresolved = graph.unresolved.filter((entry) => !rescanning.has(entry.path));

        const edgesBefore = new Set(graph.edges.keys());
        this.runScaffold(graph, {
          sourceFiles,
          targetFiles,
          detectors: options.detectors,
          options: { ...options, onlyTargets: scaffoldTargets },
        });
        report.freshHints = [...graph.edges.keys()].filter((id) => !edgesBefore.has(id)).length;

        // -- 6. coalesce rival descriptions of one region ------------------
        report.coalesced = coalesceDuplicateHints(graph);
      }
    }

    for (const file of universe.values()) graph.fileHashes.set(file.relPath, hashText(file.load()));

    this.finalizeInfluenceGraph(graph, { options, ignoredSink, report });

    // Orphan housekeeping is not a change to what the map CLAIMS, so it must not
    // make an otherwise-quiet reconcile look eventful.
    report.unchanged =
      dirty.length === 0 &&
      report.deletedFiles.length === 0 &&
      report.retired.length === 0 &&
      report.relocated.length === 0 &&
      report.demoted.length === 0;
    report.changedFiles = [...dirtyPaths];
    report.needsReconfirm = [...graph.edges.values()].filter((e) => e.state === EDGE_STATES.NEEDS_RECONFIRM).length;
    graph.reconcileReport = report;

    return { graph, reconciled: true, unchanged: report.unchanged, report };
  }

  /**
   * Shared tail. The confidence floor may only ever drop `hint` edges — a
   * `confirmed` or `needs-reconfirm` edge is a judgment or a lead, and dropping
   * either to tidy the map destroys the only record of it. Nodes are never
   * deleted here: an orphan is RETIRED, so it stays recoverable.
   */
  finalizeInfluenceGraph(graph, { options = {}, ignoredSink = [], report = null } = {}) {
    if (options.minConfidence) {
      for (const [id, edge] of [...graph.edges]) {
        if (edge.state !== EDGE_STATES.HINT) continue;
        if (edge.confidence < options.minConfidence) graph.edges.delete(id);
      }
    }
    const at = new Date().toISOString();
    for (const [id] of [...graph.nodes]) {
      if (graph.edgesTouching(id).length > 0) continue;
      const record = graph.retireNode(id, RETIRE_REASONS.ORPHANED, { at });
      // Orphans are tracked apart from content-driven retirements: an edgeless
      // node carries no claim, so sweeping it is housekeeping, not news.
      if (record && report) report.orphaned.push(summarizeRetirement(record));
    }
    graph.ignored = this.buildIgnoredSummary(ignoredSink);
    return graph;
  }

  buildIgnoredSummary(ignoredSink) {
    const seen = new Map();
    for (const entry of ignoredSink) {
      const key = `${entry.path}|${entry.kind}`;
      if (!seen.has(key)) seen.set(key, entry);
    }
    const ignoredPathsRules = this.loadIgnoredPathsRules();
    return {
      hardIgnores: [...HARD_IGNORES].sort(),
      gitignore: this.readRootGitignorePatterns(),
      ignoredPathsFile: fs.existsSync(this.ignoredPathsFile())
        ? toPosix(path.relative(this.workspace, this.ignoredPathsFile()))
        : null,
      ignoredPathsPatterns: ignoredPathsRules ? ignoredPathsRules.rules.map((r) => r.raw) : [],
      resolved: [...seen.values()].sort((a, b) => a.path.localeCompare(b.path)),
    };
  }

  readRootGitignorePatterns() {
    let text;
    try {
      text = fs.readFileSync(path.join(this.workspace, ".gitignore"), "utf8");
    } catch {
      return [];
    }
    return text
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+#.*$/, "").trim())
      .filter((line) => line && !line.startsWith("#"));
  }

  collectRoots(roots, options = {}) {
    if (!roots?.length) return this.scan(options);
    const out = new Map();
    for (const root of roots) {
      const abs = path.resolve(this.workspace, root);
      let stat;
      try {
        stat = fs.statSync(abs);
      } catch {
        continue;
      }
      if (stat.isFile()) {
        if (isProbablyBinary(abs)) continue;
        const relPath = toPosix(path.relative(this.workspace, abs));
        const { lines, bytes } = statLines(abs);
        out.set(relPath, {
          relPath,
          absPath: abs,
          lines,
          bytes,
          load: memoize(() => readTextFile(abs, this.config.maxTextFileBytes).content),
        });
      } else {
        for (const file of this.scan({ ...options, scope: abs, respectGitignore: false, force: true })) {
          out.set(file.relPath, file);
        }
      }
    }
    this.scanCache = null; // scoped scans polluted the cache
    return [...out.values()];
  }

  // -- artifacts -------------------------------------------------------------

  archivePathFor(mapPath) {
    const dir = path.dirname(path.resolve(this.workspace, mapPath));
    const base = path.basename(mapPath).replace(/\.json$/, "");
    return toPosix(path.relative(this.workspace, path.join(dir, `${base}-archive.json`)));
  }

  /** Load a map plus its archive, or null if absent/foreign/incompatible. */
  readGraphArtifact(targetPath, { archivePath } = {}) {
    const abs = path.resolve(this.workspace, targetPath);
    if (!fs.existsSync(abs)) return null;
    let graph;
    try {
      const data = JSON.parse(fs.readFileSync(abs, "utf8"));
      if (data.kind !== "influence-graph") return null;
      if (data.schemaVersion && data.schemaVersion.split(".")[0] !== SCHEMA_VERSION.split(".")[0]) return null;
      graph = InfluenceGraph.fromJSON(data);
      graph.generatedAt = data.generatedAt;
    } catch {
      return null;
    }

    const archiveRel = archivePath || this.archivePathFor(targetPath);
    const archiveAbs = path.resolve(this.workspace, archiveRel);
    if (fs.existsSync(archiveAbs)) {
      try {
        graph.archive = GraphArchive.fromJSON(JSON.parse(fs.readFileSync(archiveAbs, "utf8")));
      } catch {
        /* a corrupt archive must not make the live map unreadable */
      }
    }
    return graph;
  }

  /** Write the live map and, separately, the retired archive. */
  saveGraphArtifact(graph, targetPath, { archivePath } = {}) {
    const mapDest = this.writeArtifact(
      targetPath,
      `${JSON.stringify(graph.toJSON({ workspace: this.workspace }), null, 2)}\n`,
    );
    let archiveDest = null;
    if (graph.archive && graph.archive.size > 0) {
      archiveDest = this.writeArtifact(
        archivePath || this.archivePathFor(targetPath),
        `${JSON.stringify(graph.archive.toJSON({ workspace: this.workspace, map: toPosix(mapDest) }), null, 2)}\n`,
      );
    }
    return { mapPath: mapDest, archivePath: archiveDest };
  }

  // -- review actions -------------------------------------------------------

  /**
   * Resolve a (file, interval) pair to a node. An explicit interval means span
   * scope; no interval means "this file as a whole" — file scope.
   */
  resolveNodeArg(graph, rawFile, rawInterval) {
    const { relative, absolute } = this.normalize(rawFile);
    const { content } = readTextFile(absolute, this.config.maxTextFileBytes);
    if (!content) return { ok: false, error: `cannot read ${relative}` };

    if (!rawInterval || !isValidInterval(rawInterval)) {
      return { ok: true, node: graph.ensureFileNode(relative, { content }) };
    }
    const totalLines = splitLines(content).length;
    const clamped = clampIntervals([rawInterval], totalLines)[0];
    if (!clamped) return { ok: false, error: `interval out of range for ${relative}` };
    const { node, demoted } = graph.ensureSpanNode(relative, clamped, content);
    return { ok: true, node, demoted };
  }

  /**
   * Confirm a hint, re-confirm a demoted edge, or assert a brand-new edge the
   * scaffold never proposed (`link` is the same operation — the action name is
   * only about why you called it).
   */
  confirmInfluence(args) {
    const mapPath = args.mapPath || path.join(ARTIFACT_DIR, MAP_FILENAME);
    const graph = this.readGraphArtifact(mapPath, { archivePath: args.archivePath }) || new InfluenceGraph();
    const from = this.resolveNodeArg(graph, args.sourceFile, args.sourceInterval);
    if (!from.ok) return from;
    const to = this.resolveNodeArg(graph, args.targetFile, args.targetInterval);
    if (!to.ok) return to;
    if (from.node.id === to.node.id) return { ok: false, error: "source and target resolve to the same location" };

    const edge = graph.addEdge({
      from: from.node.id,
      to: to.node.id,
      state: EDGE_STATES.CONFIRMED,
      confidence: args.confidence ?? 1,
    });

    // Confirming settles any retired record this pair re-derives.
    const resolvedRecords = [];
    for (const nodeId of args.resolves || []) {
      const record = graph.archive.resolve(nodeId, { into: [from.node.id, to.node.id], note: args.note });
      if (record) resolvedRecords.push(nodeId);
    }

    const written = this.saveGraphArtifact(graph, mapPath, { archivePath: args.archivePath });
    return { ok: true, edge, mapPath: written.mapPath, archivePath: written.archivePath, resolved: resolvedRecords, demoted: { source: from.demoted, target: to.demoted } };
  }

  /** Reject (delete outright — never tombstoned) an existing edge at this exact pair. */
  rejectInfluence(args) {
    const mapPath = args.mapPath || path.join(ARTIFACT_DIR, MAP_FILENAME);
    const graph = this.readGraphArtifact(mapPath, { archivePath: args.archivePath });
    if (!graph) return { ok: false, error: `no map at ${mapPath}` };
    const from = this.resolveNodeArg(graph, args.sourceFile, args.sourceInterval);
    if (!from.ok) return from;
    const to = this.resolveNodeArg(graph, args.targetFile, args.targetInterval);
    if (!to.ok) return to;
    const id = `${from.node.id}->${to.node.id}`;
    if (!graph.edges.has(id)) {
      return {
        ok: false,
        error:
          "no edge found for this exact source/target location (content may have drifted — reconcile first, or check the interval)",
      };
    }
    graph.removeEdge(id);
    const written = this.saveGraphArtifact(graph, mapPath, { archivePath: args.archivePath });
    return { ok: true, mapPath: written.mapPath };
  }

  /** Mark a retired record as answered, pointing at the live nodes that now carry its influence. */
  resolveRetired(args) {
    const mapPath = args.mapPath || path.join(ARTIFACT_DIR, MAP_FILENAME);
    const graph = this.readGraphArtifact(mapPath, { archivePath: args.archivePath });
    if (!graph) return { ok: false, error: `no map at ${mapPath}` };
    const record = graph.archive.resolve(args.nodeId, { into: args.into || [], note: args.note });
    if (!record) return { ok: false, error: `no retired record for node ${args.nodeId}` };
    const written = this.saveGraphArtifact(graph, mapPath, { archivePath: args.archivePath });
    return { ok: true, nodeId: args.nodeId, mapPath: written.mapPath, archivePath: written.archivePath };
  }

  // -- pending review --------------------------------------------------------

  /**
   * What still needs human/LLM judgment: this session's reads and writes that
   * no confirmed edge explains, plus every edge a content change demoted.
   */
  pendingReview(graph) {
    const overlaps = (a, b) => a.start <= b.end && b.start <= a.end;
    const bySide = (side) => {
      const map = new Map();
      for (const edge of graph.edges.values()) {
        if (edge.state !== EDGE_STATES.CONFIRMED) continue;
        const node = graph.nodes.get(edge[side]);
        if (!node) continue;
        if (!map.has(node.path)) map.set(node.path, []);
        map.get(node.path).push(node.interval || { start: 1, end: node.lines || Infinity });
      }
      return map;
    };
    const confirmedAsTarget = bySide("to");
    const confirmedAsSource = bySide("from");

    const staleWrites = [];
    for (const [relPath, write] of this.writes) {
      for (const interval of write.intervals) {
        const covered = (confirmedAsTarget.get(relPath) || []).some((iv) => overlaps(iv, interval));
        if (!covered) staleWrites.push({ path: relPath, interval, at: write.lastWriteAt });
      }
    }
    const staleReads = [];
    for (const [relPath, read] of this.reads) {
      for (const interval of read.intervals) {
        const covered = (confirmedAsSource.get(relPath) || []).some((iv) => overlaps(iv, interval));
        if (!covered) staleReads.push({ path: relPath, interval, at: read.lastReadAt });
      }
    }
    staleWrites.sort((a, b) => String(a.at).localeCompare(String(b.at)));
    staleReads.sort((a, b) => String(a.at).localeCompare(String(b.at)));

    const needsReconfirm = [...graph.edges.values()]
      .filter((e) => e.state === EDGE_STATES.NEEDS_RECONFIRM)
      .map((e) => ({
        edgeId: e.id,
        source: locationOf(graph, e.from),
        target: locationOf(graph, e.to),
        priorState: e.priorState,
        priorConfidence: e.priorConfidence,
        reason: e.reason,
        demotedAt: e.demotedAt,
      }));

    const retired = graph.reinvestigationQueue({ limit: 200 }).map((r) => ({
      nodeId: r.node.id,
      path: r.node.path,
      interval: r.node.interval ?? null,
      reason: r.reason,
      retiredAt: r.retiredAt,
      affectedTargets: r.affectedTargets.length,
    }));

    return { staleWrites, staleReads, needsReconfirm, retired };
  }

  // -- infer: content-driven provenance --------------------------------------

  /**
   * Propose provenance by CONTENT, not by mechanism — the pass that makes an
   * already-built repo mappable.
   *
   * The scaffold can only see what is mechanically visible: a literal path
   * string, an import, a verbatim phrase. Everything written before this tool
   * existed has no recorded read to pair with its write, and a page that
   * paraphrases its source without quoting or naming it is invisible to every
   * detector. This action does not guess an answer: it assembles the evidence a
   * model needs to decide — the target text itself, the candidate sources
   * ranked by shared content, and what is already claimed — and expects
   * `confirm`/`link` back.
   *
   * Three modes:
   *   - `sourceFile` that only exists in the archive -> re-investigation packet:
   *     the retired text, and every target it used to influence, with those
   *     targets' CURRENT content, so the model can re-derive where that
   *     influence went.
   *   - `targetFile` -> that file's unexplained regions plus ranked candidates.
   *   - neither -> repo-wide: the least-explained targets, plus the retired queue.
   */
  inferProvenance(options = {}) {
    const mapPath = options.mapPath || path.join(ARTIFACT_DIR, MAP_FILENAME);
    const graph = this.readGraphArtifact(mapPath, { archivePath: options.archivePath }) || new InfluenceGraph();
    const roles = this.loadRoles();
    const limit = options.limit ?? 12;

    const sourceRoots = options.sourceRoots?.length ? options.sourceRoots : roles.source.length ? roles.source : undefined;
    const targetRoots = options.targetRoots?.length ? options.targetRoots : roles.generated.length ? roles.generated : undefined;

    // -- retired-source re-investigation ---------------------------------
    if (options.sourceFile) {
      const { relative } = this.normalize(options.sourceFile);
      const records = graph.archive.forPath(relative);
      if (records.length > 0) {
        return {
          kind: "reinvestigation",
          mapPath,
          roles,
          source: relative,
          currentContentAvailable: fs.existsSync(path.resolve(this.workspace, relative)),
          packets: records.slice(0, limit).map((record) => ({
            nodeId: record.node.id,
            retiredAt: record.retiredAt,
            reason: record.reason,
            retiredInterval: record.node.interval ?? null,
            retiredContent: record.node.content ?? null,
            affectedTargets: record.affectedTargets.map((t) => ({
              ...t,
              currentContent: t.path ? this.readLocation(t.path, t.interval) : null,
              stillLive: t.nodeId ? graph.nodes.has(t.nodeId) : false,
            })),
          })),
        };
      }
    }

    // -- candidate sources for target regions ----------------------------
    const sourceFiles = this.filterIgnoredPaths(this.collectRoots(sourceRoots, options));
    const targetFiles = this.filterIgnoredPaths(this.collectRoots(targetRoots, options));

    const explained = new Map(); // targetPath -> intervals already confirmed
    for (const edge of graph.edges.values()) {
      if (edge.state !== EDGE_STATES.CONFIRMED) continue;
      const node = graph.nodes.get(edge.to);
      if (!node) continue;
      if (!explained.has(node.path)) explained.set(node.path, []);
      explained.get(node.path).push(node.interval || { start: 1, end: node.lines || 1 });
    }

    const wanted = options.targetFile ? [this.normalize(options.targetFile).relative] : null;
    const candidateIndex = new ShingleIndex({
      ...DEFAULT_OVERLAP_OPTIONS,
      // Deliberately looser than the scaffold: this pass is meant to surface
      // weak, paraphrased similarity for a human/LLM to judge, not to mint edges.
      minMatches: 1,
      ...(options.overlap || {}),
    });
    for (const file of sourceFiles) {
      const content = file.load();
      if (content) candidateIndex.addDocument(file.relPath, content);
    }
    candidateIndex.prune();
    const workspaceIndex = new WorkspaceIndex(this.workspace, [...sourceFiles, ...targetFiles]);

    const targets = [];
    for (const file of targetFiles) {
      if (wanted && !wanted.includes(file.relPath)) continue;
      const content = file.load();
      if (!content) continue;
      const alreadyExplained = mergeIntervals(explained.get(file.relPath) || []);
      const unexplained = options.interval
        ? clampIntervals([options.interval], file.lines)
        : invertIntervals(file.lines, alreadyExplained);
      if (unexplained.length === 0) continue;

      const matches = candidateIndex.match(file.relPath, content);
      const lines = splitLines(content);
      const mentions = workspaceIndex.findEntityMentions(content, lines, { directoryFanoutCap: 8 });
      const mentionCounts = new Map();
      for (const mention of mentions) {
        for (const relPath of mention.relPaths) {
          mentionCounts.set(relPath, (mentionCounts.get(relPath) || 0) + 1);
        }
      }

      const candidates = new Map();
      for (const match of matches) {
        if (match.sourcePath === file.relPath) continue;
        candidates.set(match.sourcePath, {
          path: match.sourcePath,
          sharedPhrases: match.distinctShingles ?? 0,
          mentions: mentionCounts.get(match.sourcePath) || 0,
          sampleSourceLines: [...new Set((match.pairs || []).map((p) => p.sourceLine))].slice(0, 6),
          sampleTargetLines: [...new Set((match.targetLines || []))].slice(0, 6),
        });
      }
      for (const [relPath, count] of mentionCounts) {
        if (relPath === file.relPath) continue;
        if (candidates.has(relPath)) continue;
        candidates.set(relPath, { path: relPath, sharedPhrases: 0, mentions: count, sampleSourceLines: [], sampleTargetLines: [] });
      }

      const ranked = [...candidates.values()]
        .sort((a, b) => b.sharedPhrases - a.sharedPhrases || b.mentions - a.mentions || a.path.localeCompare(b.path))
        .slice(0, limit);

      targets.push({
        path: file.relPath,
        lines: file.lines,
        explainedIntervals: alreadyExplained,
        unexplainedIntervals: unexplained,
        unexplainedLines: countIntervalLines(unexplained),
        candidates: ranked,
        preview: options.targetFile ? this.readLocation(file.relPath, unexplained[0]) : null,
      });
    }

    targets.sort((a, b) => b.unexplainedLines - a.unexplainedLines || a.path.localeCompare(b.path));

    return {
      kind: "inference",
      mapPath,
      roles,
      sourceRoots: sourceRoots || ["<workspace>"],
      targetRoots: targetRoots || ["<workspace>"],
      targets: targets.slice(0, wanted ? targets.length : limit),
      retiredQueue: graph.reinvestigationQueue({ limit: 10 }).map((r) => ({
        nodeId: r.node.id,
        path: r.node.path,
        interval: r.node.interval ?? null,
        reason: r.reason,
        affectedTargets: r.affectedTargets.length,
      })),
    };
  }

  /** Read exactly one location's current text (null when it no longer exists). */
  readLocation(relPath, interval) {
    const abs = path.resolve(this.workspace, relPath);
    if (!fs.existsSync(abs)) return null;
    const { content } = readTextFile(abs, this.config.maxTextFileBytes);
    if (!content) return null;
    if (!interval || !isValidInterval(interval)) return sliceLines(content);
    const clamped = clampIntervals([interval], splitLines(content).length)[0];
    return clamped ? sliceLines(content, clamped) : null;
  }

  // -- persistence ----------------------------------------------------------

  toState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      kind: "context-source-monitor-state",
      savedAt: new Date().toISOString(),
      workspace: this.workspace,
      active: this.active,
      config: this.config,
      sessions: this.sessions,
      reads: Object.fromEntries(this.reads),
      writes: Object.fromEntries(this.writes),
      annotations: Object.fromEntries(this.annotations),
      traceHistory: this.traceHistory,
    };
  }

  loadState(state) {
    if (!state || typeof state !== "object") return this;
    if (state.schemaVersion && state.schemaVersion.split(".")[0] !== SCHEMA_VERSION.split(".")[0]) {
      throw new Error(`incompatible state schema ${state.schemaVersion} (expected ${SCHEMA_VERSION})`);
    }
    this.active = !!state.active;
    this.config = { ...this.config, ...(state.config || {}) };
    this.sessions = state.sessions || [];
    this.reads = new Map(Object.entries(state.reads || {}));
    this.writes = new Map(Object.entries(state.writes || {}));
    this.annotations = new Map(Object.entries(state.annotations || {}));
    this.traceHistory = state.traceHistory || [];
    return this;
  }

  save(targetPath = this.statePath) {
    const dest = path.resolve(this.workspace, targetPath);
    writeFileAtomic(dest, `${JSON.stringify(this.toState(), null, 2)}\n`);
    return dest;
  }

  writeArtifact(targetPath, contents) {
    const hasDirectory = targetPath.includes("/") || path.isAbsolute(targetPath);
    const dest = hasDirectory
      ? path.resolve(this.workspace, targetPath)
      : path.join(this.workspace, ARTIFACT_DIR, targetPath);
    writeFileAtomic(dest, contents);
    return toPosix(path.relative(this.workspace, dest)) || dest;
  }

  load(sourcePath = this.statePath) {
    const src = path.resolve(this.workspace, sourcePath);
    if (!fs.existsSync(src)) return false;
    try {
      this.loadState(JSON.parse(fs.readFileSync(src, "utf8")));
      return true;
    } catch (error) {
      throw new Error(`failed to load monitor state from ${src}: ${error.message}`);
    }
  }

  static open(options = {}) {
    const engine = new ContextSourceMonitorEngine(options);
    if (options.load !== false) {
      try {
        engine.load();
      } catch {
        /* corrupt or foreign state: start clean rather than crash the session */
      }
    }
    return engine;
  }
}

// ---------------------------------------------------------------------------
// Reconcile helpers
// ---------------------------------------------------------------------------

function emptyReconcileReport(base) {
  return {
    ...base,
    unchanged: true,
    changedFiles: [],
    deletedFiles: [],
    relocated: [],
    demoted: [],
    bounded: [],
    retired: [],
    orphaned: [],
    reparented: 0,
    rescannedTargets: 0,
    rescanReason: null,
    freshHints: 0,
    coalesced: 0,
    needsReconfirm: 0,
  };
}

function summarizeRetirement(record) {
  return {
    nodeId: record.node.id,
    path: record.node.path,
    scope: record.node.scope,
    interval: record.node.interval ?? null,
    reason: record.reason,
    affectedTargets: record.affectedTargets.length,
    hadConfirmed: record.edges.some((e) => e.state === EDGE_STATES.CONFIRMED || e.priorState === EDGE_STATES.CONFIRMED),
  };
}

/**
 * Group stale spans into the regions that will replace them.
 *
 * Clustering is by the stale spans' OWN overlapping/adjacent intervals, so it
 * works with zero recorded writes — which is the normal case when adopting a
 * repo whose history predates this tool. Recorded write intervals only widen a
 * cluster when they happen to be available; they are never required for a
 * replacement to be produced.
 */
export function clusterStaleNodes(staleNodes, writeIntervals = []) {
  const sorted = [...staleNodes]
    .filter((n) => isValidInterval(n.interval))
    .sort((a, b) => a.interval.start - b.interval.start || a.interval.end - b.interval.end);
  if (sorted.length === 0) return [];

  const clusters = [];
  for (const node of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && intervalsTouch(last.interval, node.interval)) {
      last.interval = boundingInterval([last.interval, node.interval]);
      last.nodes.push(node);
    } else {
      clusters.push({ interval: { ...node.interval }, nodes: [node], widenedByWrites: false });
    }
  }

  for (const cluster of clusters) {
    for (const write of mergeIntervals(writeIntervals)) {
      if (!intervalsTouch(cluster.interval, write)) continue;
      cluster.interval = boundingInterval([cluster.interval, write]);
      cluster.widenedByWrites = true;
    }
  }
  return clusters;
}

/**
 * Drop a fresh scaffold hint when an inherited `needs-reconfirm` edge already
 * describes the same influence at the same place.
 *
 * Without this, a rewritten region ends up carrying two rival descriptions: the
 * bounding span that inherited the history, and a brand-new node the detectors
 * just proposed for the same text. The inherited edge is the one worth keeping
 * — it remembers what was previously believed — so the duplicate hint goes.
 */
export function coalesceDuplicateHints(graph) {
  const inherited = [];
  for (const edge of graph.edges.values()) {
    if (edge.state !== EDGE_STATES.NEEDS_RECONFIRM) continue;
    const from = graph.nodes.get(edge.from);
    const to = graph.nodes.get(edge.to);
    if (!from || !to) continue;
    inherited.push({ edge, from, to });
  }
  if (inherited.length === 0) return 0;

  let dropped = 0;
  for (const [id, edge] of [...graph.edges]) {
    if (edge.state !== EDGE_STATES.HINT) continue;
    const from = graph.nodes.get(edge.from);
    const to = graph.nodes.get(edge.to);
    if (!from || !to) continue;
    const covered = inherited.some(
      (claim) =>
        claim.from.path === from.path &&
        claim.to.path === to.path &&
        claim.edge.id !== id &&
        regionCovers(claim.to, to),
    );
    if (covered) {
      graph.edges.delete(id);
      dropped++;
    }
  }
  return dropped;
}

/**
 * Does `claim` describe a region that already includes `candidate`?
 *
 * A file-scope claim covers the whole file by definition, so a span inside it is
 * the same influence stated twice. The coarser inherited claim wins because it
 * is the one carrying the review history — and it is flagged `needs-reconfirm`,
 * so the precision is recovered when someone re-confirms it against a real
 * interval.
 */
function regionCovers(claim, candidate) {
  if (!claim.interval) return true;
  if (!candidate.interval) return false;
  return claim.interval.start <= candidate.interval.start && claim.interval.end >= candidate.interval.end;
}

function locationOf(graph, nodeId) {
  const node = graph.nodes.get(nodeId);
  if (!node) return { nodeId, path: null, interval: null };
  return { nodeId, path: node.path, interval: node.interval ?? null, scope: node.scope };
}

/** Write via temp file + rename so a crash cannot leave a half-written state. */
export function writeFileAtomic(destPath, contents) {
  const dir = path.dirname(destPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(destPath)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, contents, "utf8");
  fs.renameSync(tmp, destPath);
  return destPath;
}

function memoize(loadFn) {
  let cached;
  let done = false;
  return () => {
    if (!done) {
      cached = loadFn();
      done = true;
    }
    return cached;
  };
}

function loadAll(files) {
  return files.map((f) => ({ relPath: f.relPath, content: f.load() })).filter((f) => f.content && f.content.length > 0);
}
