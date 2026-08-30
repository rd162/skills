/**
 * Influence graph: content-addressed identity, retirement instead of deletion.
 *
 * ---------------------------------------------------------------------------
 * Why identity is split into TWO scopes (2026-08-18 v4 correction)
 * ---------------------------------------------------------------------------
 * A single "hash the location's content" rule looks elegant and is wrong in
 * both directions at once:
 *
 *   - Hashing (path, interval, content) makes the interval load-bearing, so
 *     inserting a line ANYWHERE earlier in the file invalidates every node
 *     below it even though their text never changed. Worse, "same location,
 *     different content" then yields the same id with a different hash — two
 *     nodes claiming one identity, one retired, one live.
 *   - Hashing (path, content) alone collapses every identical piece of text in
 *     a file into ONE node. Blank lines, `---`, a repeated `## Notes` heading:
 *     the detectors emit single-line target nodes, so this is the common case,
 *     not a corner case. Edges from unrelated sources silently merge, and the
 *     node's `interval` becomes last-writer-wins.
 *
 * So:
 *   FILE scope  id = f_<hash(path)>            — one node per file, forever.
 *               Identity does NOT depend on content. A content edit therefore
 *               never retires a file node; it demotes the node's edges to
 *               `needs-reconfirm` and keeps every connection intact. This is
 *               what makes a corpus typo cost one review pass instead of
 *               mass-archiving hundreds of confirmed edges.
 *   SPAN scope  id = s_<hash(path, occurrence, content)> — a distinctive region.
 *               `occurrence` is the index among verbatim repeats of that exact
 *               text inside the file, so identity survives line drift: the
 *               span is RELOCATED (interval rewritten, id unchanged) rather
 *               than invalidated. `content` is stored in full, never truncated,
 *               so a node's id is always recomputable from its own payload —
 *               including after it lands in the archive.
 *
 * A span must clear MIN_SPAN_SIGNAL non-whitespace characters to be
 * identifiable by content at all; below that it is widened, and if it still
 * cannot clear the floor it is demoted to file scope instead of becoming an
 * ambiguous node.
 *
 * ---------------------------------------------------------------------------
 * Nothing is ever deleted
 * ---------------------------------------------------------------------------
 * A stale node is RETIRED, not dropped: it moves into the archive
 * (`inf-map-archive.json`) together with every edge that touched it, at
 * RETIRED_CONFIDENCE. The archive is the re-investigation queue — "this source
 * text once influenced these targets" is exactly the lead you need when
 * re-establishing provenance after the fact, so destroying it to keep the map
 * tidy is destroying the only copy of the answer. The main map stays clean of
 * retired records; the archive is never rendered to markdown.
 *
 * Retired records leave the queue only by being RESOLVED (a re-investigation
 * re-derived where that influence now lives) — and even then they move to the
 * archive's `resolvedNodes` section rather than being pruned.
 *
 * Edge review states: `hint` (scaffold guess, unverified) -> `confirmed` (a
 * reader checked both sides) -> `needs-reconfirm` (was settled, then one side
 * changed underneath it). `needs-reconfirm` is capped at
 * NEEDS_RECONFIRM_CEILING so a carried-forward belief can never outrank a real
 * confirmation, while `priorState`/`priorConfidence` remember what it was.
 */

import {
  hashText,
  splitLines,
  sliceLines,
  contentSignal,
  findBlockOccurrences,
  clampIntervals,
  isValidInterval,
} from "./text.mjs";

export const SCHEMA_VERSION = "4.0.0";
export const ARCHIVE_SCHEMA_VERSION = "1.0.0";

export const NODE_SCOPES = Object.freeze({ FILE: "file", SPAN: "span" });

/** Review state of an edge. */
export const EDGE_STATES = Object.freeze({
  HINT: "hint",
  CONFIRMED: "confirmed",
  NEEDS_RECONFIRM: "needs-reconfirm",
});

/** Why a node left the live map. */
export const RETIRE_REASONS = Object.freeze({
  CONTENT_CHANGED: "content-changed",
  FILE_DELETED: "file-deleted",
  SUPERSEDED: "superseded-by-bounding-span",
  ORPHANED: "orphaned",
});

/**
 * A belief carried across a content change is never allowed to compete with a
 * belief someone actually verified against the current text.
 */
export const NEEDS_RECONFIRM_CEILING = 0.2;
/** Retired records sort dead last everywhere. */
export const RETIRED_CONFIDENCE = 0.01;

/** Minimum non-whitespace characters for a span to be identifiable by its content. */
export const MIN_SPAN_SIGNAL = 24;
/** Widening a degenerate span never grows past this many lines. */
export const MAX_SPAN_WIDEN_LINES = 40;
/** A "span" larger than this is really the whole file — use file scope. */
export const MAX_SPAN_LINES = 400;

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export function fileNodeId(relPath) {
  return `f_${hashText(String(relPath)).slice(0, 24)}`;
}

export function spanNodeId(relPath, content, occurrence = 0) {
  return `s_${hashText(`${relPath}\n#${occurrence}\n${content ?? ""}`).slice(0, 24)}`;
}

/**
 * Which verbatim repeat of `interval`'s own text `interval` is, plus every
 * start line that text occurs at. Returns null when the interval is out of
 * range for this content.
 */
export function describeOccurrence(fileContent, interval) {
  const fileLines = splitLines(fileContent);
  if (!isValidInterval(interval) || interval.start > fileLines.length) return null;
  const clamped = clampIntervals([interval], fileLines.length)[0];
  if (!clamped) return null;
  const blockLines = fileLines.slice(clamped.start - 1, clamped.end);
  const starts = findBlockOccurrences(fileLines, blockLines);
  const index = starts.indexOf(clamped.start);
  return {
    interval: clamped,
    content: blockLines.join("\n"),
    occurrence: index === -1 ? 0 : index,
    occurrences: starts,
  };
}

/**
 * Where a span's text lives in `fileContent` now.
 *
 * Prefers the same occurrence index; falls back to the only match when the
 * text is unique, and otherwise to the match nearest the span's previous
 * position (deterministic: ties resolve to the smaller start line). Returns
 * null when the text is simply gone — that is the one case that retires a span.
 */
export function relocateSpan(fileContent, spanContent, { occurrence = 0, previousStart = null } = {}) {
  const fileLines = splitLines(fileContent);
  const blockLines = splitLines(spanContent);
  if (blockLines.length === 0) return null;
  const starts = findBlockOccurrences(fileLines, blockLines);
  if (starts.length === 0) return null;

  let chosenIndex;
  if (occurrence < starts.length) chosenIndex = occurrence;
  else if (starts.length === 1) chosenIndex = 0;
  else if (previousStart != null) {
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < starts.length; i++) {
      const distance = Math.abs(starts[i] - previousStart);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    chosenIndex = best;
  } else chosenIndex = starts.length - 1;

  const start = starts[chosenIndex];
  return {
    interval: { start, end: start + blockLines.length - 1 },
    occurrence: chosenIndex,
    occurrences: starts,
    ambiguous: starts.length > 1,
  };
}

/**
 * Grow `interval` until its text carries enough signal to be identifiable.
 * Returns null when even MAX_SPAN_WIDEN_LINES of context cannot clear the
 * floor (an all-whitespace region) — caller falls back to file scope.
 */
export function widenToSignal(fileContent, interval, minSignal = MIN_SPAN_SIGNAL) {
  const totalLines = splitLines(fileContent).length;
  if (totalLines === 0) return null;
  let current = clampIntervals([interval], totalLines)[0];
  if (!current) return null;

  for (let grown = 0; grown <= MAX_SPAN_WIDEN_LINES; grown++) {
    const text = sliceLines(fileContent, current);
    if (contentSignal(text) >= minSignal) return current;
    const canGrowDown = current.end < totalLines;
    const canGrowUp = current.start > 1;
    if (!canGrowDown && !canGrowUp) return null;
    // Grow downward first (a heading's body follows it), then upward.
    if (canGrowDown) current = { start: current.start, end: current.end + 1 };
    else current = { start: current.start - 1, end: current.end };
  }
  return null;
}

export function clampConfidence(value) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0.3;
  return Number(Math.min(1, Math.max(0, n)).toFixed(3));
}

// ---------------------------------------------------------------------------
// Archive
// ---------------------------------------------------------------------------

/**
 * Retired history, persisted separately from the live map.
 *
 * `retiredNodes` is a work queue, not a graveyard: each record keeps the node
 * exactly as it was (content included, so its id stays verifiable) plus the
 * edges it had, so a later pass can hand a model "this text used to influence
 * these targets — where did that influence go?". `resolvedNodes` holds records
 * a re-investigation has already answered.
 */
export class GraphArchive {
  constructor() {
    /** @type {Map<string, object>} nodeId -> retired record */
    this.retiredNodes = new Map();
    /** @type {Map<string, object>} nodeId -> resolved record */
    this.resolvedNodes = new Map();
  }

  get size() {
    return this.retiredNodes.size + this.resolvedNodes.size;
  }

  has(nodeId) {
    return this.retiredNodes.has(nodeId) || this.resolvedNodes.has(nodeId);
  }

  /**
   * File the node away. Re-retiring an id that is already archived appends to
   * its history rather than creating a second record for one identity. A node
   * that was retired, resurrected, and retired again carries that flip-flop
   * forward too (see `InfluenceGraph.#adoptRetiredHistory`) — a location whose
   * text keeps coming and going is itself worth seeing.
   */
  retire({ node, edges = [], reason, at = new Date().toISOString(), affectedTargets = [] }) {
    const existing = this.retiredNodes.get(node.id) || this.resolvedNodes.get(node.id);
    if (existing) {
      existing.history = existing.history || [];
      existing.history.push({ reason, at });
      for (const edge of edges) {
        if (!existing.edges.some((e) => e.id === edge.id)) existing.edges.push({ ...edge });
      }
      this.resolvedNodes.delete(node.id);
      this.retiredNodes.set(node.id, existing);
      return existing;
    }
    const { retiredHistory, ...cleanNode } = node;
    const record = {
      node: cleanNode,
      reason,
      retiredAt: at,
      affectedTargets: [...affectedTargets],
      edges: edges.map((e) => ({ ...e, confidence: RETIRED_CONFIDENCE })),
      history: [...(retiredHistory || [])],
    };
    this.retiredNodes.set(node.id, record);
    return record;
  }

  /** Take a record back out — the exact text reappeared on disk (revert, branch switch). */
  resurrect(nodeId) {
    const record = this.retiredNodes.get(nodeId) || this.resolvedNodes.get(nodeId);
    if (!record) return null;
    this.retiredNodes.delete(nodeId);
    this.resolvedNodes.delete(nodeId);
    return record;
  }

  /**
   * A re-investigation answered this record: move it out of the queue, keeping
   * which live nodes now carry the influence it used to.
   */
  resolve(nodeId, { into = [], note = null, at = new Date().toISOString() } = {}) {
    const record = this.retiredNodes.get(nodeId);
    if (!record) return null;
    this.retiredNodes.delete(nodeId);
    record.resolvedAt = at;
    record.resolvedInto = [...into];
    if (note) record.resolutionNote = note;
    this.resolvedNodes.set(nodeId, record);
    return record;
  }

  /**
   * Retired records for one path, most actionable first: a record that still
   * names the targets it influenced is a lead worth working, while an orphan
   * with nothing attached is only history. Ties break newest-first.
   */
  forPath(relPath) {
    return [...this.retiredNodes.values()]
      .filter((r) => r.node.path === relPath)
      .sort(
        (a, b) =>
          b.affectedTargets.length - a.affectedTargets.length ||
          String(b.retiredAt).localeCompare(String(a.retiredAt)),
      );
  }

  stats() {
    const byReason = {};
    for (const record of this.retiredNodes.values()) {
      byReason[record.reason] = (byReason[record.reason] || 0) + 1;
    }
    return {
      retiredNodes: this.retiredNodes.size,
      resolvedNodes: this.resolvedNodes.size,
      retiredEdges: [...this.retiredNodes.values()].reduce((n, r) => n + r.edges.length, 0),
      byReason,
    };
  }

  toJSON(meta = {}) {
    return {
      schemaVersion: ARCHIVE_SCHEMA_VERSION,
      kind: "influence-archive",
      generatedAt: new Date().toISOString(),
      ...meta,
      stats: this.stats(),
      retiredNodes: [...this.retiredNodes.values()].sort((a, b) =>
        String(a.retiredAt).localeCompare(String(b.retiredAt)) || a.node.id.localeCompare(b.node.id),
      ),
      resolvedNodes: [...this.resolvedNodes.values()].sort((a, b) =>
        String(a.resolvedAt).localeCompare(String(b.resolvedAt)) || a.node.id.localeCompare(b.node.id),
      ),
    };
  }

  static fromJSON(data) {
    const archive = new GraphArchive();
    if (!data) return archive;
    if (data.kind && data.kind !== "influence-archive") return archive;
    if (data.schemaVersion && data.schemaVersion.split(".")[0] !== ARCHIVE_SCHEMA_VERSION.split(".")[0]) {
      return archive;
    }
    for (const record of data.retiredNodes || []) {
      if (record?.node?.id) archive.retiredNodes.set(record.node.id, record);
    }
    for (const record of data.resolvedNodes || []) {
      if (record?.node?.id) archive.resolvedNodes.set(record.node.id, record);
    }
    return archive;
  }
}

// ---------------------------------------------------------------------------
// Live graph
// ---------------------------------------------------------------------------

export class InfluenceGraph {
  constructor() {
    /** @type {Map<string, object>} */
    this.nodes = new Map();
    /** @type {Map<string, object>} */
    this.edges = new Map();
    /** @type {object[]} */
    this.unresolved = [];
    /** @type {Map<string, string>} relPath -> sha256 of the whole file */
    this.fileHashes = new Map();
    /** @type {Map<string, Set<string>>} relPath -> node ids (maintained on every mutation) */
    this.nodesByPath = new Map();
    this.archive = new GraphArchive();
  }

  // -- node insertion ------------------------------------------------------

  /** One node per file, identity independent of content. */
  ensureFileNode(relPath, { content = null, contentHash = null, lines = null } = {}) {
    const id = fileNodeId(relPath);
    const existing = this.nodes.get(id);
    const hash = contentHash ?? (content != null ? hashText(content) : null);
    if (existing) {
      if (hash) existing.contentHash = hash;
      if (lines != null) existing.lines = lines;
      return existing;
    }
    const node = {
      id,
      scope: NODE_SCOPES.FILE,
      path: relPath,
      contentHash: hash,
      lines: lines ?? (content != null ? splitLines(content).length : null),
    };
    this.#adoptRetiredHistory(node);
    this.#insert(node);
    return node;
  }

  /**
   * A distinctive region of a file.
   *
   * Degenerate or oversized regions are NOT forced into span scope — they come
   * back as the file node, because an unidentifiable span is worse than a
   * coarser truthful one.
   *
   * @returns {{node: object, scope: string, demoted?: string}}
   */
  ensureSpanNode(relPath, interval, fileContent) {
    const totalLines = splitLines(fileContent).length;
    if (totalLines === 0) {
      return { node: this.ensureFileNode(relPath, { content: fileContent }), scope: NODE_SCOPES.FILE, demoted: "empty-file" };
    }

    const clamped = clampIntervals([interval], totalLines)[0];
    if (!clamped) {
      return { node: this.ensureFileNode(relPath, { content: fileContent }), scope: NODE_SCOPES.FILE, demoted: "interval-out-of-range" };
    }

    // A region that covers (nearly) everything, or is simply huge, IS the file.
    const spanLines = clamped.end - clamped.start + 1;
    if (spanLines > MAX_SPAN_LINES || (clamped.start === 1 && clamped.end >= totalLines)) {
      return { node: this.ensureFileNode(relPath, { content: fileContent }), scope: NODE_SCOPES.FILE, demoted: "whole-file" };
    }

    const widened = widenToSignal(fileContent, clamped);
    if (!widened) {
      return { node: this.ensureFileNode(relPath, { content: fileContent }), scope: NODE_SCOPES.FILE, demoted: "insufficient-signal" };
    }

    const described = describeOccurrence(fileContent, widened);
    if (!described) {
      return { node: this.ensureFileNode(relPath, { content: fileContent }), scope: NODE_SCOPES.FILE, demoted: "undescribable" };
    }

    const id = spanNodeId(relPath, described.content, described.occurrence);
    const existing = this.nodes.get(id);
    if (existing) {
      // Identity already matches; only the position may need refreshing. This
      // is deterministic (interval is DERIVED from the occurrence), so
      // re-running the scaffold cannot produce a different interval for the
      // same id — no last-writer-wins.
      existing.interval = described.interval;
      return { node: existing, scope: NODE_SCOPES.SPAN };
    }

    const node = {
      id,
      scope: NODE_SCOPES.SPAN,
      path: relPath,
      interval: described.interval,
      occurrence: described.occurrence,
      content: described.content,
      contentHash: hashText(described.content),
    };
    if (described.occurrences.length > 1) node.repeats = described.occurrences.length;
    this.#adoptRetiredHistory(node);
    this.#insert(node);
    return { node, scope: NODE_SCOPES.SPAN };
  }

  /**
   * Bringing a node back out of the archive must not erase that it was ever
   * retired: content that keeps vanishing and reappearing (a branch being
   * switched back and forth, a section repeatedly rewritten) is a signal, and a
   * fresh record with an empty history would hide it.
   */
  #adoptRetiredHistory(node) {
    const record = this.archive.resurrect(node.id);
    if (!record) return;
    node.retiredHistory = [
      ...(record.history || []),
      { reason: record.reason, at: record.retiredAt, resurrectedAt: new Date().toISOString() },
    ];
  }

  #insert(node) {
    this.nodes.set(node.id, node);
    if (!this.nodesByPath.has(node.path)) this.nodesByPath.set(node.path, new Set());
    this.nodesByPath.get(node.path).add(node.id);
  }

  #unindex(node) {
    const set = this.nodesByPath.get(node.path);
    if (set) {
      set.delete(node.id);
      if (set.size === 0) this.nodesByPath.delete(node.path);
    }
  }

  // -- edges ---------------------------------------------------------------

  /**
   * Add or upgrade an edge. Edge identity is `from|to`, so confirming a hint
   * upgrades it in place instead of creating a rival record.
   */
  addEdge(input) {
    const { from, to } = input;
    if (!from || !to) throw new Error("edge requires from and to");
    if (from === to) return null; // no self-influence
    if (!this.nodes.has(from) || !this.nodes.has(to)) {
      throw new Error(`edge references unknown node: ${!this.nodes.has(from) ? from : to}`);
    }
    const id = `${from}->${to}`;
    const state = input.state || EDGE_STATES.HINT;
    const existing = this.edges.get(id);

    if (existing) {
      const wasSettled = existing.state === EDGE_STATES.CONFIRMED;
      // A re-proposed hint must never quietly undo a human/LLM judgment, but a
      // confirmation always wins, and re-confirming clears a reconfirm flag.
      if (state === EDGE_STATES.CONFIRMED) {
        // A reader's judgment outranks an observation: never let a re-run of the
        // scaffold pull a judged edge back down to OBSERVED confidence, and never
        // let an observation overwrite the basis a reader recorded.
        const judged = existing.state === EDGE_STATES.CONFIRMED && !existing.basis;
        existing.state = EDGE_STATES.CONFIRMED;
        if (!(judged && input.basis)) {
          existing.confidence = clampConfidence(input.confidence ?? 1);
          if (input.basis) existing.basis = input.basis;
          else delete existing.basis;
          if (input.note) existing.note = input.note;
        }
        delete existing.priorState;
        delete existing.priorConfidence;
        delete existing.demotedAt;
      } else if (state === EDGE_STATES.NEEDS_RECONFIRM) {
        this.demoteEdge(id, input.reason);
      } else if (!wasSettled && existing.state !== EDGE_STATES.NEEDS_RECONFIRM) {
        existing.confidence = clampConfidence(input.confidence ?? existing.confidence);
      }
      return existing;
    }

    const edge = { id, from, to, state, confidence: clampConfidence(input.confidence) };
    if (input.basis) edge.basis = input.basis;
    if (input.note) edge.note = input.note;
    if (state === EDGE_STATES.NEEDS_RECONFIRM) {
      edge.confidence = Math.min(edge.confidence, NEEDS_RECONFIRM_CEILING);
      if (input.priorState) edge.priorState = input.priorState;
      if (input.priorConfidence != null) edge.priorConfidence = clampConfidence(input.priorConfidence);
      edge.demotedAt = input.at || new Date().toISOString();
      if (input.reason) edge.reason = input.reason;
    }
    this.edges.set(id, edge);
    return edge;
  }

  /**
   * "This was settled, and then the ground moved." Keeps the edge and what it
   * used to claim, but caps its confidence so it cannot pose as verified.
   */
  demoteEdge(id, reason = "content-changed", at = new Date().toISOString()) {
    const edge = this.edges.get(id);
    if (!edge) return null;
    if (edge.state === EDGE_STATES.NEEDS_RECONFIRM) {
      edge.reason = reason;
      return edge;
    }
    edge.priorState = edge.state;
    edge.priorConfidence = edge.confidence;
    edge.state = EDGE_STATES.NEEDS_RECONFIRM;
    edge.confidence = Math.min(edge.confidence, NEEDS_RECONFIRM_CEILING);
    edge.demotedAt = at;
    edge.reason = reason;
    return edge;
  }

  /** Remove an edge (reject deletes outright — never tombstoned). */
  removeEdge(id) {
    return this.edges.delete(id);
  }

  edgesTouching(nodeId) {
    return [...this.edges.values()].filter((e) => e.from === nodeId || e.to === nodeId);
  }

  edgesInto(nodeId) {
    return [...this.edges.values()].filter((e) => e.to === nodeId);
  }

  edgesOutOf(nodeId) {
    return [...this.edges.values()].filter((e) => e.from === nodeId);
  }

  nodeIdsForPath(relPath) {
    return [...(this.nodesByPath.get(relPath) || [])];
  }

  edgesIntoFile(relPath) {
    const ids = new Set(this.nodeIdsForPath(relPath));
    return [...this.edges.values()].filter((e) => ids.has(e.to));
  }

  edgesOutOfFile(relPath) {
    const ids = new Set(this.nodeIdsForPath(relPath));
    return [...this.edges.values()].filter((e) => ids.has(e.from));
  }

  // -- lifecycle -----------------------------------------------------------

  /**
   * The span's text moved and its occurrence index changed with it, so its id
   * changed too. That is a RENAME of one identity, not a death: carry the node
   * and every edge over to the new id.
   */
  migrateNode(oldId, { interval, occurrence, content }) {
    const node = this.nodes.get(oldId);
    if (!node) return null;
    const newId = spanNodeId(node.path, content ?? node.content, occurrence);
    if (newId === oldId) {
      node.interval = interval;
      node.occurrence = occurrence;
      return node;
    }

    const absorbing = this.nodes.get(newId);
    const migrated = absorbing || {
      ...node,
      id: newId,
      interval,
      occurrence,
      content: content ?? node.content,
      contentHash: hashText(content ?? node.content),
    };
    if (absorbing) {
      absorbing.interval = interval;
      absorbing.occurrence = occurrence;
    } else {
      this.#insert(migrated);
    }
    migrated.migratedFrom = [...(migrated.migratedFrom || []), oldId];

    for (const edge of this.edgesTouching(oldId)) {
      this.edges.delete(edge.id);
      const from = edge.from === oldId ? newId : edge.from;
      const to = edge.to === oldId ? newId : edge.to;
      if (from === to) continue;
      const rebuilt = { ...edge, id: `${from}->${to}`, from, to };
      const existing = this.edges.get(rebuilt.id);
      if (!existing) this.edges.set(rebuilt.id, rebuilt);
      else if (rebuilt.state === EDGE_STATES.CONFIRMED) {
        existing.state = EDGE_STATES.CONFIRMED;
        existing.confidence = Math.max(existing.confidence, rebuilt.confidence);
      }
    }

    this.nodes.delete(oldId);
    this.#unindex(node);
    return migrated;
  }

  /**
   * Retire a node: it and its edges leave the live map for the archive.
   * The ONLY removal path for a node — nothing else may delete one.
   *
   * @returns {object|null} the archive record
   */
  retireNode(id, reason = RETIRE_REASONS.CONTENT_CHANGED, { at = new Date().toISOString() } = {}) {
    const node = this.nodes.get(id);
    if (!node) return null;
    const edges = this.edgesTouching(id);
    const affectedTargets = [];
    for (const edge of edges) {
      const otherId = edge.from === id ? edge.to : edge.from;
      const other = this.nodes.get(otherId);
      affectedTargets.push({
        nodeId: otherId,
        direction: edge.from === id ? "influenced" : "influenced-by",
        path: other?.path ?? null,
        interval: other?.interval ?? null,
        state: edge.state,
        confidence: edge.confidence,
      });
    }
    const record = this.archive.retire({ node, edges, reason, at, affectedTargets });
    for (const edge of edges) this.edges.delete(edge.id);
    this.nodes.delete(id);
    this.#unindex(node);
    return record;
  }

  /** Retired records whose targets a re-investigation should look at. */
  reinvestigationQueue({ limit = Infinity } = {}) {
    return [...this.archive.retiredNodes.values()]
      .filter((r) => r.affectedTargets.length > 0)
      .sort((a, b) => b.affectedTargets.length - a.affectedTargets.length)
      .slice(0, limit);
  }

  // -- bookkeeping ---------------------------------------------------------

  addUnresolved(entry) {
    this.unresolved.push({ ...entry });
  }

  stats() {
    const byState = {};
    const byScope = {};
    let confidenceSum = 0;
    for (const e of this.edges.values()) {
      byState[e.state] = (byState[e.state] || 0) + 1;
      confidenceSum += e.confidence;
    }
    for (const n of this.nodes.values()) byScope[n.scope] = (byScope[n.scope] || 0) + 1;
    return {
      nodes: this.nodes.size,
      byScope,
      edges: this.edges.size,
      byState,
      averageConfidence: this.edges.size ? Number((confidenceSum / this.edges.size).toFixed(3)) : 0,
      unresolvedReferences: this.unresolved.length,
      archived: this.archive.stats(),
    };
  }

  /** The live map only. Retired records are serialized separately (see GraphArchive). */
  toJSON(meta = {}) {
    return {
      schemaVersion: SCHEMA_VERSION,
      kind: "influence-graph",
      generatedAt: new Date().toISOString(),
      ...meta,
      stats: this.stats(),
      nodes: [...this.nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
      edges: [...this.edges.values()].sort(
        (a, b) => b.confidence - a.confidence || a.from.localeCompare(b.from) || a.to.localeCompare(b.to),
      ),
      unresolvedReferences: this.unresolved,
      ignored: this.ignored ?? null,
      reconcile: this.reconcileReport ?? null,
      fileHashes: Object.fromEntries([...this.fileHashes].sort()),
    };
  }

  static fromJSON(data) {
    const graph = new InfluenceGraph();
    if (!data) return graph;
    for (const node of data.nodes || []) {
      if (!node?.id) continue;
      graph.nodes.set(node.id, node);
      if (!graph.nodesByPath.has(node.path)) graph.nodesByPath.set(node.path, new Set());
      graph.nodesByPath.get(node.path).add(node.id);
    }
    for (const edge of data.edges || []) if (edge?.id) graph.edges.set(edge.id, edge);
    graph.unresolved = data.unresolvedReferences || [];
    if (data.ignored) graph.ignored = data.ignored;
    graph.fileHashes = new Map(Object.entries(data.fileHashes || {}));
    // The previous run's reconcile report is history, not current state — a
    // fresh run must not re-publish a stale one as if it described this pass.
    return graph;
  }

  merge(other) {
    for (const node of other.nodes.values()) if (!this.nodes.has(node.id)) this.#insert({ ...node });
    for (const [relPath, hash] of other.fileHashes || []) this.fileHashes.set(relPath, hash);
    for (const edge of other.edges.values()) {
      const existing = this.edges.get(edge.id);
      if (!existing) this.edges.set(edge.id, { ...edge });
      else if (edge.state === EDGE_STATES.CONFIRMED) {
        existing.state = EDGE_STATES.CONFIRMED;
        existing.confidence = Math.max(existing.confidence, edge.confidence);
      }
    }
    this.unresolved.push(...other.unresolved);
    return this;
  }
}
