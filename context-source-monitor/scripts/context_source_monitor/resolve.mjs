/**
 * Workspace index + generic reference resolution.
 *
 * Every influence edge must point at a REAL file. Anything that cannot be
 * resolved to a workspace file goes to `unresolvedReferences` instead of being
 * fabricated as an edge (the previous implementation emitted `sourceFile: "VPN"`,
 * which is a token, not a file).
 */

import * as path from "node:path";

/** Path components too generic to identify a source by name. */
export const GENERIC_COMPONENTS = new Set([
  "src", "lib", "libs", "app", "apps", "bin", "docs", "doc", "documentation",
  "data", "images", "image", "img", "assets", "static", "public", "media",
  "markdown", "md", "text", "txt", "out", "output", "outputs", "tmp", "temp",
  "test", "tests", "spec", "specs", "changes", "archive", "scripts", "script",
  "memory", "index", "readme", "main", "utils", "util", "common", "core",
  "config", "configs", "settings", "types", "node_modules", "dist", "build",
  "research", "corpus", "intake", "openspec", "agents", "skills", "plugins",
]);

const CODE_EXTENSION_CANDIDATES = [
  "", ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs",
  ".json", ".py", ".md", ".yaml", ".yml",
];

const INDEX_CANDIDATES = [
  "/index.ts", "/index.tsx", "/index.js", "/index.mjs", "/index.py", "/index.md", "/README.md",
];

function normalizePhrase(text) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export class WorkspaceIndex {
  /**
   * @param {string} workspace absolute workspace root
   * @param {{relPath: string, absPath: string, lines?: number, bytes?: number}[]} files
   */
  constructor(workspace, files) {
    this.workspace = path.resolve(workspace);
    this.files = files;
    this.byRelPath = new Map();
    this.byBasename = new Map();
    this.byStem = new Map();
    this.directories = new Map(); // relDir -> relPath[]
    this.dirsByName = new Map(); // lowercased last component -> relDir[]
    this.phrases = new Map(); // normalized component phrase -> relPath[]

    for (const file of files) {
      this.byRelPath.set(file.relPath, file);

      const base = path.posix.basename(file.relPath);
      const stem = base.replace(/\.[^.]+$/, "");
      push(this.byBasename, base, file.relPath);
      push(this.byBasename, base.toLowerCase(), file.relPath);
      push(this.byStem, stem.toLowerCase(), file.relPath);

      // register every ancestor directory
      const parts = file.relPath.split("/");
      for (let i = parts.length - 1; i > 0; i--) {
        const dir = parts.slice(0, i).join("/");
        push(this.directories, dir, file.relPath);
        push(this.dirsByName, parts[i - 1].toLowerCase(), dir);
      }

      // phrase index: directory names and file stems that are distinctive enough
      // to identify a source when merely *named* in prose (e.g. a report id
      // like "RPT-4021" mentioned in running text with no path around it).
      for (const component of [...parts.slice(0, -1), stem]) {
        const phrase = normalizePhrase(component);
        if (phrase.length < 4) continue;
        if (GENERIC_COMPONENTS.has(phrase)) continue;
        push(this.phrases, phrase, file.relPath);
      }
    }

    // Longest phrases first so "Customer Onboarding - Q3 Plan" wins over a shorter overlap.
    this.sortedPhrases = [...this.phrases.keys()].sort((a, b) => b.length - a.length);
  }

  has(relPath) {
    return this.byRelPath.has(relPath);
  }

  filesUnder(relDir) {
    return this.directories.get(relDir.replace(/\/+$/, "")) || [];
  }

  /**
   * Resolve a raw reference string found inside `fromRelPath`.
   *
   * @returns {{ok: true, relPaths: string[], kind: string} | {ok: false, reason: string}}
   */
  resolveReference(rawRef, fromRelPath, options = {}) {
    const directoryFanoutCap = options.directoryFanoutCap ?? 12;
    const cleaned = cleanReference(rawRef);
    if (!cleaned) return { ok: false, reason: "empty-after-cleaning" };
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned) || /^(mailto|tel|data):/i.test(cleaned)) {
      return { ok: false, reason: "external-uri" };
    }
    if (cleaned.startsWith("#")) return { ok: false, reason: "anchor-only" };

    const fromDir = path.posix.dirname(fromRelPath === "." ? "" : fromRelPath);
    const bases = [];
    if (cleaned.startsWith("/")) bases.push("");
    else {
      if (fromDir && fromDir !== ".") bases.push(fromDir);
      bases.push("");
    }
    const bare = cleaned.replace(/^\//, "");

    for (const base of bases) {
      const joined = base ? path.posix.normalize(`${base}/${bare}`) : path.posix.normalize(bare);
      if (joined.startsWith("..")) continue;

      // exact file
      if (this.byRelPath.has(joined)) return { ok: true, relPaths: [joined], kind: "exact" };

      // directory citation -> fan out to its files
      const dirFiles = this.filesUnder(joined);
      if (dirFiles.length > 0) {
        return {
          ok: true,
          relPaths: dirFiles.slice(0, directoryFanoutCap),
          kind: "directory",
          truncated: dirFiles.length > directoryFanoutCap,
          totalInDirectory: dirFiles.length,
        };
      }

      // extensionless / index resolution (code imports)
      if (!path.posix.extname(joined)) {
        for (const ext of CODE_EXTENSION_CANDIDATES) {
          if (!ext) continue;
          if (this.byRelPath.has(joined + ext)) return { ok: true, relPaths: [joined + ext], kind: "extension" };
        }
        for (const suffix of INDEX_CANDIDATES) {
          if (this.byRelPath.has(joined + suffix)) return { ok: true, relPaths: [joined + suffix], kind: "index" };
        }
      }
    }

    // unique basename anywhere in the workspace
    const base = path.posix.basename(bare);
    const byBase = this.byBasename.get(base) || this.byBasename.get(base.toLowerCase());
    if (byBase?.length === 1) return { ok: true, relPaths: [byBase[0]], kind: "basename" };
    if (byBase?.length > 1) return { ok: false, reason: "ambiguous-basename" };

    // A cited source that is not itself in the tree may have been ingested into a
    // directory named after it (data/intake/RPT-4021.docx -> data/corpus/RPT-4021/).
    // This is the generic form of "converted fragments of the same document".
    const stem = base.replace(/\.[^.]+$/, "").toLowerCase();
    if (stem.length >= 4 && !GENERIC_COMPONENTS.has(stem)) {
      const dirs = this.dirsByName.get(stem);
      if (dirs?.length === 1) {
        const dirFiles = this.filesUnder(dirs[0]);
        if (dirFiles.length > 0) {
          return {
            ok: true,
            relPaths: dirFiles.slice(0, directoryFanoutCap),
            kind: "derived-directory",
            truncated: dirFiles.length > directoryFanoutCap,
            totalInDirectory: dirFiles.length,
            resolvedVia: dirs[0],
          };
        }
      }
      const byStem = this.byStem.get(stem);
      if (byStem?.length === 1) return { ok: true, relPaths: [byStem[0]], kind: "stem" };
    }

    return { ok: false, reason: "no-matching-file" };
  }

  /**
   * Is this string plausibly a file path (worth reporting when unresolved)?
   * Rejects slash-separated prose like "Create iEVC Static/Direct/BGP" and
   * protocol paths like "/devices/device/config".
   */
  isPathShaped(raw) {
    const ref = cleanReference(raw);
    if (!ref) return false;
    // extension must start with a letter, so "3.3/4.4" (version numbers) is not a path
    const hasExtension = /\.[A-Za-z][A-Za-z0-9]{0,7}$/.test(ref);
    const firstSegment = ref.replace(/^\.{0,2}\//, "").split("/")[0];
    const knownRoot = this.dirsByName.has(firstSegment.toLowerCase()) || this.directories.has(firstSegment);
    return hasExtension || knownRoot;
  }

  /**
   * Find distinctive path-component phrases named inside `text`.
   * Generic replacement for a hardcoded entity list.
   *
   * @returns {{phrase: string, relPaths: string[], line: number, snippet: string}[]}
   */
  findEntityMentions(text, lines, options = {}) {
    const fanoutCap = options.directoryFanoutCap ?? 12;
    const maxHitsPerPhrase = options.maxHitsPerPhrase ?? 3;
    const haystack = text.toLowerCase();
    const results = [];

    for (const phrase of this.sortedPhrases) {
      if (haystack.indexOf(phrase) === -1) continue;
      const relPaths = this.phrases.get(phrase) || [];
      if (relPaths.length === 0 || relPaths.length > fanoutCap) continue;

      let hits = 0;
      for (let i = 0; i < lines.length && hits < maxHitsPerPhrase; i++) {
        if (lines[i].toLowerCase().includes(phrase)) {
          results.push({ phrase, relPaths, line: i + 1, snippet: lines[i].trim().slice(0, 200) });
          hits++;
        }
      }
    }
    return results;
  }
}

/** Strip decoration around a captured reference. Returns "" if it cannot be a path. */
export function cleanReference(raw) {
  let ref = String(raw ?? "").trim();
  ref = ref.replace(/^[`'"(<[\s]+/, "").replace(/[`'")>\]\s]+$/, "");
  ref = ref.split("#")[0].split("?")[0];
  ref = ref.replace(/[.,;:!]+$/, "");
  ref = ref.replace(/\\ /g, " ");
  ref = ref.trim();

  // Sanity guards: prose fragments and table cells are not paths. Paths in this
  // repo legitimately contain spaces, so spaces are allowed but bounded.
  if (ref.length === 0 || ref.length > 200) return "";
  if (/[|<>*?\n\t]/.test(ref)) return "";
  if ((ref.match(/ /g) || []).length > 8) return "";
  if (/^[.\/]+$/.test(ref)) return "";
  return ref;
}

function push(map, key, value) {
  const list = map.get(key);
  if (list) {
    if (!list.includes(value)) list.push(value);
  } else {
    map.set(key, [value]);
  }
}
