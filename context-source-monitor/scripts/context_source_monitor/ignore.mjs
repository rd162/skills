/**
 * Workspace discovery: .gitignore-aware file walking.
 *
 * Deliberate leniency vs. real git: a trailing ` # comment` on a pattern line is
 * stripped. Real git treats it as part of the pattern, which silently breaks
 * rules; here the author's intent wins.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** Directories/files never worth walking, even when not gitignored. */
export const HARD_IGNORES = new Set([
  ".git",
  "node_modules",
  ".venv",
  "venv",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".cache",
  ".DS_Store",
  ".Trash",
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".turbo",
  ".output",
  ".svelte-kit",
]);

function globToRegExpSource(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") i++;
        out += "(?:.*/)?";
      } else {
        out += "[^/]*";
      }
    } else if (ch === "?") {
      out += "[^/]";
    } else if ("\\^$.|+()[]{}".includes(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Ordered gitignore rule set. Later rules win (so `!negation` can re-include).
 */
export class IgnoreRules {
  constructor() {
    this.rules = [];
  }

  /** Load a .gitignore file whose scope is `baseRel` (workspace-relative dir, "" for root). */
  addFile(absGitignorePath, baseRel = "") {
    let text = "";
    try {
      text = fs.readFileSync(absGitignorePath, "utf8");
    } catch {
      return this;
    }
    return this.addPatterns(text.split(/\r?\n/), baseRel);
  }

  addPatterns(patterns, baseRel = "") {
    for (const rawLine of patterns) {
      let line = String(rawLine ?? "");
      line = line.replace(/\s+#.*$/, "").trim(); // lenient inline-comment strip
      if (line === "" || line.startsWith("#")) continue;

      let negate = false;
      if (line.startsWith("!")) {
        negate = true;
        line = line.slice(1);
      }

      let dirOnly = false;
      if (line.endsWith("/")) {
        dirOnly = true;
        line = line.slice(0, -1);
      }
      if (line === "") continue;

      const anchored = line.startsWith("/") || line.slice(0, -1).includes("/");
      const pattern = line.replace(/^\//, "");
      const prefix = baseRel ? `${baseRel.replace(/\/+$/, "")}/` : "";
      const body = globToRegExpSource(pattern);
      const head = anchored ? `^${prefix}${body}` : `^${prefix}(?:.*/)?${body}`;

      this.rules.push({
        // matches the entry itself and anything beneath it
        regex: new RegExp(`${head}(?:/.*)?$`),
        // matches only the entry itself
        exact: new RegExp(`${head}$`),
        negate,
        dirOnly,
        raw: rawLine,
      });
    }
    return this;
  }

  /** @returns {boolean} whether `relPath` (workspace-relative, POSIX separators) is ignored. */
  isIgnored(relPath, isDir) {
    return this.matchRule(relPath, isDir).ignored;
  }

  /**
   * Same verdict as `isIgnored`, plus which rule (raw .gitignore line) decided it —
   * so a caller can explain *why* a path was skipped, not just that it was.
   *
   * @returns {{ignored: boolean, rule: string|null}}
   */
  matchRule(relPath, isDir) {
    let ignored = false;
    let rule = null;
    for (const r of this.rules) {
      if (!r.regex.test(relPath)) continue;
      // `dir/` must not ignore a plain file at exactly that path
      if (r.dirOnly && !isDir && r.exact.test(relPath)) continue;
      ignored = !r.negate;
      rule = r.raw;
    }
    return { ignored, rule };
  }
}

export function toPosix(p) {
  return p.replace(/\\/g, "/");
}

/**
 * Walk a directory tree collecting files.
 *
 * @param {object} options
 * @param {string} options.workspace           absolute workspace root
 * @param {string} [options.root]              absolute dir to walk (defaults to workspace)
 * @param {boolean} [options.respectGitignore] honor .gitignore files (default true)
 * @param {string[]} [options.extraIgnores]    additional gitignore-style patterns
 * @param {(relPath: string) => boolean} [options.filter]
 * @param {number} [options.maxFiles]
 * @param {object[]} [options.ignoredSink]     if given, every skipped entry is pushed here as
 *   `{ path, kind: "file"|"directory", reason: "hard-ignore"|"gitignore", rule: string|null }` —
 *   skipped directories are recorded once and never descended into, so this stays compact.
 * @returns {{ relPath: string, absPath: string }[]}
 */
export function walkFiles(options) {
  const workspace = path.resolve(options.workspace);
  const root = path.resolve(options.root || workspace);
  const respectGitignore = options.respectGitignore !== false;
  const maxFiles = options.maxFiles ?? 100000;
  const ignoredSink = options.ignoredSink;

  const rules = new IgnoreRules();
  if (respectGitignore) {
    // Root .gitignore applies to the whole workspace, including nested roots.
    rules.addFile(path.join(workspace, ".gitignore"), "");
  }
  if (options.extraIgnores?.length) rules.addPatterns(options.extraIgnores, "");

  const out = [];
  const recordIgnored = (relPath, isDir, reason, rule) => {
    if (ignoredSink) ignoredSink.push({ path: relPath, kind: isDir ? "directory" : "file", reason, rule });
  };

  const walk = (absDir, localRules) => {
    if (out.length >= maxFiles) return;

    let entries;
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }

    let dirRules = localRules;
    if (respectGitignore && entries.some((e) => e.isFile() && e.name === ".gitignore")) {
      const baseRel = toPosix(path.relative(workspace, absDir));
      dirRules = new IgnoreRules();
      dirRules.rules = [...localRules.rules];
      dirRules.addFile(path.join(absDir, ".gitignore"), baseRel === "." ? "" : baseRel);
    }

    for (const entry of entries) {
      if (out.length >= maxFiles) return;

      const absPath = path.join(absDir, entry.name);
      const relPath = toPosix(path.relative(workspace, absPath));
      if (relPath.startsWith("..")) continue; // never escape the workspace
      const isDir = entry.isDirectory();

      if (HARD_IGNORES.has(entry.name)) {
        recordIgnored(relPath, isDir, "hard-ignore", null);
        continue;
      }

      const match = dirRules.matchRule(relPath, isDir);
      if (match.ignored) {
        recordIgnored(relPath, isDir, "gitignore", match.rule);
        continue;
      }

      if (isDir) {
        walk(absPath, dirRules);
      } else if (entry.isFile()) {
        if (options.filter && !options.filter(relPath)) continue;
        out.push({ relPath, absPath });
      }
    }
  };

  try {
    if (fs.statSync(root).isDirectory()) walk(root, rules);
    else {
      const relPath = toPosix(path.relative(workspace, root));
      if (!relPath.startsWith("..")) out.push({ relPath, absPath: root });
    }
  } catch {
    return [];
  }

  out.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return out;
}
