/**
 * Text, line and interval primitives.
 *
 * Line-number contract used everywhere in this package:
 *   - lines are 1-based and inclusive on both ends
 *   - a file of N content lines has lines 1..N
 *   - a trailing newline does NOT create an extra line (the classic
 *     `content.split(/\r?\n/)` off-by-one that made 100% coverage unreachable)
 */

import * as fs from "node:fs";
import * as crypto from "node:crypto";

/** Split text into content lines without inventing a phantom trailing line. */
export function splitLines(content) {
  if (content === null || content === undefined || content === "") return [];
  const lines = content.split(/\r\n|\n|\r/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Count content lines in a string. */
export function countLinesInText(content) {
  return splitLines(content).length;
}

/**
 * Count lines of a file without loading it fully into memory.
 * Returns { lines, bytes, exists }.
 */
export function statLines(absPath, chunkSize = 1 << 16) {
  let fd;
  try {
    const st = fs.statSync(absPath);
    if (!st.isFile()) return { lines: 0, bytes: 0, exists: false };
    if (st.size === 0) return { lines: 0, bytes: 0, exists: true };

    fd = fs.openSync(absPath, "r");
    const buf = Buffer.alloc(Math.min(chunkSize, st.size));
    let newlines = 0;
    let position = 0;
    let lastByte = 0;

    for (;;) {
      const read = fs.readSync(fd, buf, 0, buf.length, position);
      if (read <= 0) break;
      for (let i = 0; i < read; i++) if (buf[i] === 10) newlines++;
      lastByte = buf[read - 1];
      position += read;
    }

    // A file not terminated by \n still has a final content line.
    const lines = lastByte === 10 ? newlines : newlines + 1;
    return { lines, bytes: st.size, exists: true };
  } catch {
    return { lines: 0, bytes: 0, exists: false };
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }
}

/** Read a text file, refusing anything above `maxBytes`. Returns { content, bytes, skipped }. */
export function readTextFile(absPath, maxBytes = 4 * 1024 * 1024) {
  try {
    const st = fs.statSync(absPath);
    if (!st.isFile()) return { content: "", bytes: 0, skipped: "not-a-file" };
    if (st.size > maxBytes) return { content: "", bytes: st.size, skipped: "too-large" };
    return { content: fs.readFileSync(absPath, "utf8"), bytes: st.size, skipped: null };
  } catch {
    return { content: "", bytes: 0, skipped: "unreadable" };
  }
}

export function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/** Short stable hash for identifiers. */
export function shortHash(text, length = 12) {
  return sha256(text).slice(0, length);
}

/** Content hash of a whole file/string. Reconcile compares this across runs to detect change. */
export function hashText(content) {
  return sha256(content ?? "");
}

/**
 * Content hash of exactly the lines a block/interval covers, so a change
 * elsewhere in the same file does not falsely dirty this block.
 *
 * @param {string} content  full file content
 * @param {{start:number,end:number}} [interval] 1-based inclusive; whole file when omitted
 */
export function hashInterval(content, interval) {
  if (!interval) return hashText(content);
  return hashText(sliceLines(content, interval));
}

/** Join exactly the given 1-based inclusive line range (whole file when interval is omitted). */
export function sliceLines(content, interval) {
  const lines = splitLines(content);
  if (!interval) return lines.join("\n");
  return lines.slice(Math.max(0, interval.start - 1), interval.end).join("\n");
}

/**
 * How much non-whitespace a piece of text actually carries — a span's "signal".
 *
 * Node identity is content-addressed, so a span whose text is blank, `---`, or
 * a lone fence is not identifiable by its content at all: the same text recurs
 * dozens of times in one file, and every occurrence would compete for the same
 * identity. Spans below a signal floor are widened or demoted to file scope
 * instead (see graph.mjs MIN_SPAN_SIGNAL).
 */
export function contentSignal(text) {
  if (!text) return 0;
  return (String(text).match(/\S/g) || []).length;
}

/**
 * Every 1-based start line at which `blockLines` occurs verbatim in `fileLines`.
 *
 * This is what makes a span node survive line drift: identity is
 * (path, occurrence-index, content), never the line numbers, so inserting or
 * deleting lines elsewhere in the file relocates the span (interval is
 * rewritten) instead of invalidating it.
 */
export function findBlockOccurrences(fileLines, blockLines) {
  const out = [];
  if (!blockLines?.length || !fileLines?.length) return out;
  if (blockLines.length > fileLines.length) return out;
  const first = blockLines[0];
  const last = fileLines.length - blockLines.length;
  for (let i = 0; i <= last; i++) {
    if (fileLines[i] !== first) continue;
    let match = true;
    for (let j = 1; j < blockLines.length; j++) {
      if (fileLines[i + j] !== blockLines[j]) {
        match = false;
        break;
      }
    }
    if (match) out.push(i + 1);
  }
  return out;
}

/** Does `a` overlap or touch `b`? (Adjacent counts — [1-5] and [6-9] are one region.) */
export function intervalsTouch(a, b, tolerance = 1) {
  return a.start <= b.end + tolerance && b.start <= a.end + tolerance;
}

/** Smallest interval containing every input interval. */
export function boundingInterval(intervals) {
  const valid = (intervals || []).filter(isValidInterval);
  if (valid.length === 0) return null;
  return {
    start: Math.min(...valid.map((iv) => iv.start)),
    end: Math.max(...valid.map((iv) => iv.end)),
  };
}

// ---------------------------------------------------------------------------
// Intervals: { start, end } inclusive, 1-based
// ---------------------------------------------------------------------------

export function isValidInterval(iv) {
  return (
    !!iv &&
    Number.isInteger(iv.start) &&
    Number.isInteger(iv.end) &&
    iv.start >= 1 &&
    iv.end >= iv.start
  );
}

/** Merge overlapping AND line-adjacent intervals ([1-5] + [6-9] => [1-9]). */
export function mergeIntervals(intervals) {
  const valid = (intervals || []).filter(isValidInterval).sort((a, b) => a.start - b.start || a.end - b.end);
  if (valid.length === 0) return [];

  const out = [{ start: valid[0].start, end: valid[0].end }];
  for (let i = 1; i < valid.length; i++) {
    const cur = valid[i];
    const last = out[out.length - 1];
    if (cur.start <= last.end + 1) last.end = Math.max(last.end, cur.end);
    else out.push({ start: cur.start, end: cur.end });
  }
  return out;
}

/** Clamp intervals into 1..totalLines, dropping anything fully outside. */
export function clampIntervals(intervals, totalLines) {
  if (totalLines <= 0) return [];
  const out = [];
  for (const iv of mergeIntervals(intervals)) {
    const start = Math.max(1, iv.start);
    const end = Math.min(totalLines, iv.end);
    if (start <= end) out.push({ start, end });
  }
  return out;
}

/** Complement of `covered` within 1..totalLines. */
export function invertIntervals(totalLines, covered) {
  if (totalLines <= 0) return [];
  const merged = clampIntervals(covered, totalLines);
  if (merged.length === 0) return [{ start: 1, end: totalLines }];

  const out = [];
  let cursor = 1;
  for (const iv of merged) {
    if (iv.start > cursor) out.push({ start: cursor, end: iv.start - 1 });
    cursor = Math.max(cursor, iv.end + 1);
  }
  if (cursor <= totalLines) out.push({ start: cursor, end: totalLines });
  return out;
}

/** Intersection of two interval lists. */
export function intersectIntervals(a, b) {
  const left = mergeIntervals(a);
  const right = mergeIntervals(b);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    const start = Math.max(left[i].start, right[j].start);
    const end = Math.min(left[i].end, right[j].end);
    if (start <= end) out.push({ start, end });
    if (left[i].end < right[j].end) i++;
    else j++;
  }
  return out;
}

export function countIntervalLines(intervals) {
  let total = 0;
  for (const iv of mergeIntervals(intervals)) total += iv.end - iv.start + 1;
  return total;
}

/** Group ascending line numbers into contiguous intervals, tolerating small gaps. */
export function linesToIntervals(lineNumbers, tolerance = 1) {
  const sorted = [...new Set(lineNumbers.filter((n) => Number.isInteger(n) && n >= 1))].sort((a, b) => a - b);
  if (sorted.length === 0) return [];

  const out = [{ start: sorted[0], end: sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    if (sorted[i] - last.end <= tolerance + 1) last.end = sorted[i];
    else out.push({ start: sorted[i], end: sorted[i] });
  }
  return out;
}

export function formatIntervals(intervals) {
  if (!intervals || intervals.length === 0) return "none";
  return intervals.map((iv) => (iv.start === iv.end ? `[${iv.start}]` : `[${iv.start}-${iv.end}]`)).join(", ");
}

export function percent(part, whole, digits = 1) {
  if (!whole || whole <= 0) return 100;
  return Number(((part / whole) * 100).toFixed(digits));
}
