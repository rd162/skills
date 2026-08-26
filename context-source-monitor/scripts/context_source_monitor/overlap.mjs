/**
 * Content-overlap detection via IDF-filtered word shingles.
 *
 * Why this exists: in most repos only a minority of generated files cite a
 * source path explicitly, and many cite only a *directory*. A citation-only
 * detector therefore produces a near-empty provenance map even though the
 * prose is demonstrably derived from source fragments. Overlap detection
 * recovers those links.
 *
 * Method
 *   1. normalize text to tokens (keeps hyphenated ids like ACME-CORE-01, path
 *      fragments like data/corpus, and dotted values like 10.0.0.1 intact)
 *   2. hash every k-token window (shingle) to a 32-bit int
 *   3. drop shingles whose document frequency is high — that is boilerplate
 *      (frontmatter, licence headers, nav tables), not evidence of influence
 *   4. for each target, group surviving matches per source into line intervals
 *   5. score by number of DISTINCT rare shingles shared
 */

import { splitLines } from "./text.mjs";

export const DEFAULT_OVERLAP_OPTIONS = Object.freeze({
  shingleSize: 8,
  minMatches: 3,
  maxDocFrequency: 6,
  maxDocFrequencyRatio: 0.25,
  maxPostingsPerShingle: 40,
  maxEdgesPerTarget: 20,
  maxSnippets: 3,
  intervalTolerance: 2,
  minConfidence: 0.35,
  maxPairsPerSource: 600,
});

const TOKEN_RE = /[a-z0-9][a-z0-9._\-/]*/g;

/** Lowercase, strip markdown/punctuation noise, keep technical identifiers whole. */
export function tokenize(text) {
  const out = [];
  const lowered = text.toLowerCase();
  let match;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(lowered)) !== null) {
    const token = match[0].replace(/[._\-/]+$/, "");
    if (token.length >= 2) out.push({ token, index: match.index });
  }
  return out;
}

/** FNV-1a 32-bit. */
export function hashString(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Build shingles for one document.
 * @returns {{hash: number, line: number}[]}
 */
export function shingleDocument(content, shingleSize) {
  const lines = splitLines(content);
  // token -> line map via cumulative offsets
  const lineStarts = [];
  let offset = 0;
  for (const line of lines) {
    lineStarts.push(offset);
    offset += line.length + 1;
  }

  const tokens = tokenize(content);
  if (tokens.length < shingleSize) return [];

  const lineOf = (charIndex) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= charIndex) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };

  const out = [];
  for (let i = 0; i + shingleSize <= tokens.length; i++) {
    let joined = tokens[i].token;
    for (let k = 1; k < shingleSize; k++) joined += " " + tokens[i + k].token;
    out.push({ hash: hashString(joined), line: lineOf(tokens[i].index) });
  }
  return out;
}

/**
 * Inverted shingle index over source documents.
 */
export class ShingleIndex {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OVERLAP_OPTIONS, ...options };
    /** @type {Map<number, {doc: number, line: number}[]>} */
    this.postings = new Map();
    /** @type {string[]} */
    this.docs = [];
    /** @type {Map<number, Set<number>>} */
    this.docFrequency = new Map();
  }

  addDocument(relPath, content) {
    const doc = this.docs.length;
    this.docs.push(relPath);

    const shingles = shingleDocument(content, this.options.shingleSize);
    for (const { hash, line } of shingles) {
      let df = this.docFrequency.get(hash);
      if (!df) {
        df = new Set();
        this.docFrequency.set(hash, df);
      }
      df.add(doc);

      let list = this.postings.get(hash);
      if (!list) {
        list = [];
        this.postings.set(hash, list);
      }
      if (list.length < this.options.maxPostingsPerShingle) list.push({ doc, line });
    }
    return doc;
  }

  /** Remove boilerplate shingles. Call once after all documents are added. */
  prune() {
    // A ratio-only cap collapses on small source sets: with 2 dual-conversion
    // documents it would prune every shingle they share, i.e. all the evidence.
    // Never prune below 2 documents.
    const maxDf = Math.max(
      2,
      Math.min(this.options.maxDocFrequency, Math.max(2, Math.ceil(this.docs.length * this.options.maxDocFrequencyRatio))),
    );
    for (const [hash, docs] of this.docFrequency) {
      if (docs.size > maxDf) {
        this.postings.delete(hash);
        this.docFrequency.delete(hash);
      }
    }
    this.prunedAt = { maxDf, remainingShingles: this.postings.size };
    return this;
  }

  /**
   * Match one target document against the index.
   *
   * `pairs` keeps the (targetLine, sourceLine) correspondence so callers can
   * attribute a specific target section to the specific source lines it echoes.
   *
   * @returns {{sourcePath: string, distinctShingles: number, confidence: number,
   *            sourceLines: number[], targetLines: number[],
   *            pairs: {targetLine: number, sourceLine: number}[]}[]}
   */
  match(targetRelPath, content) {
    const shingles = shingleDocument(content, this.options.shingleSize);
    /** @type {Map<number, {hashes: Set<number>, sourceLines: Set<number>, targetLines: Set<number>, pairs: object[]}>} */
    const perDoc = new Map();

    for (const { hash, line } of shingles) {
      const postings = this.postings.get(hash);
      if (!postings) continue;
      for (const posting of postings) {
        if (this.docs[posting.doc] === targetRelPath) continue; // never self-match
        let agg = perDoc.get(posting.doc);
        if (!agg) {
          agg = { hashes: new Set(), sourceLines: new Set(), targetLines: new Set(), pairs: [] };
          perDoc.set(posting.doc, agg);
        }
        agg.hashes.add(hash);
        agg.sourceLines.add(posting.line);
        agg.targetLines.add(line);
        if (agg.pairs.length < this.options.maxPairsPerSource) {
          agg.pairs.push({ targetLine: line, sourceLine: posting.line });
        }
      }
    }

    const results = [];
    for (const [doc, agg] of perDoc) {
      const distinct = agg.hashes.size;
      if (distinct < this.options.minMatches) continue;
      const confidence = scoreOverlap(distinct);
      if (confidence < this.options.minConfidence) continue;
      results.push({
        sourcePath: this.docs[doc],
        distinctShingles: distinct,
        confidence,
        sourceLines: [...agg.sourceLines].sort((a, b) => a - b),
        targetLines: [...agg.targetLines].sort((a, b) => a - b),
        pairs: agg.pairs,
      });
    }

    results.sort((a, b) => b.distinctShingles - a.distinctShingles);
    return results.slice(0, this.options.maxEdgesPerTarget);
  }
}

/**
 * Confidence from the count of distinct rare shingles shared.
 * 3 -> 0.42, 8 -> 0.60, 30 -> 0.79, 100+ -> capped 0.90.
 */
export function scoreOverlap(distinctShingles) {
  const raw = 0.3 + 0.12 * Math.log2(Math.max(1, distinctShingles));
  return Number(Math.min(0.9, raw).toFixed(3));
}
