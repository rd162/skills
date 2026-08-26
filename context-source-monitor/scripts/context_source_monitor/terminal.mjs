/**
 * Shell command parsing — fallback tracking when file access bypasses the
 * built-in read/edit/write tools.
 *
 * Only *file arguments that actually exist* are reported, so `sed -i 's/a/b/'`
 * expressions, flags and redirect targets stop being mistaken for paths (the
 * previous "anything with a dot is a file" heuristic produced constant noise).
 */

import * as fs from "node:fs";
import * as path from "node:path";

const READ_UTILITIES = new Set([
  "cat", "bat", "batcat", "glow", "head", "tail", "sed", "awk", "less", "more",
  "nl", "tac", "rev", "strings", "fold", "cut", "od", "hexdump", "xxd", "dd", "wc", "grep", "rg",
]);

const WRAPPERS = new Set(["sudo", "nohup", "time", "env", "command", "exec", "nice", "ionice", "xargs", "stdbuf"]);

/** Split a command line on |, ;, &&, || honouring quotes and escapes. */
export function splitPipeline(commandLine) {
  const segments = [];
  let current = "";
  let single = false;
  let double = false;
  let escaped = false;

  for (let i = 0; i < commandLine.length; i++) {
    const ch = commandLine[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      current += ch;
      escaped = true;
      continue;
    }
    if (ch === "'" && !double) {
      single = !single;
      current += ch;
      continue;
    }
    if (ch === '"' && !single) {
      double = !double;
      current += ch;
      continue;
    }
    if (!single && !double && (ch === "|" || ch === ";" || ch === "&" || ch === "\n")) {
      if ((ch === "&" || ch === "|") && commandLine[i + 1] === ch) i++;
      if (current.trim()) segments.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) segments.push(current.trim());
  return segments;
}

/** Tokenize one segment, removing quotes. */
export function tokenize(segment) {
  const tokens = [];
  let current = "";
  let single = false;
  let double = false;
  let escaped = false;
  let started = false;

  const flush = () => {
    if (started) tokens.push(current);
    current = "";
    started = false;
  };

  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];
    if (escaped) {
      current += ch;
      started = true;
      escaped = false;
      continue;
    }
    if (ch === "\\" && !single) {
      escaped = true;
      started = true;
      continue;
    }
    if (ch === "'" && !double) {
      single = !single;
      started = true;
      continue;
    }
    if (ch === '"' && !single) {
      double = !double;
      started = true;
      continue;
    }
    if (!single && !double && /\s/.test(ch)) {
      flush();
      continue;
    }
    current += ch;
    started = true;
  }
  flush();
  return tokens;
}

/**
 * Redirections found in a segment, plus the segment with them removed.
 *
 * The lookbehind/lookahead guards matter: `=>` (an arrow function inside an
 * inline `node -e '...'` script) contains a bare `>` with nothing shell-like
 * about it, and would otherwise be read as "redirect output to the next
 * token" — which is exactly how a JS expression like `.map(f => f.relPath)`
 * used to turn into a fabricated write to a file named `f.relPath`.
 */
function extractRedirects(segment) {
  const targets = [];
  const stripped = segment.replace(/(?<!=)(\d?)(>>|>)(?!=)\s*("[^"]*"|'[^']*'|[^\s|;&<>]+)/g, (all, fd, op, target) => {
    const clean = target.replace(/^["']|["']$/g, "");
    if (clean !== "/dev/null" && clean !== "/dev/stderr" && clean !== "/dev/stdout" && !clean.startsWith("&")) {
      targets.push({ target: clean, append: op === ">>" });
    }
    return " ";
  });
  return { targets, stripped: stripped.replace(/(?<!=)\d?<(?!=)\s*("[^"]*"|'[^']*'|[^\s|;&<>]+)/g, " ") };
}

function commandOf(tokens) {
  let i = 0;
  while (i < tokens.length && (tokens[i].includes("=") || WRAPPERS.has(path.basename(tokens[i])))) i++;
  if (i >= tokens.length) return null;
  return { utility: path.basename(tokens[i]).toLowerCase(), args: tokens.slice(i + 1) };
}

function existingFile(candidate, workspace) {
  if (!candidate || candidate.startsWith("-")) return null;
  if (/[*?\[\]$]/.test(candidate)) return null;
  const abs = path.isAbsolute(candidate) ? path.resolve(candidate) : path.resolve(workspace, candidate);
  try {
    return fs.statSync(abs).isFile() ? abs : null;
  } catch {
    return null;
  }
}

function parseIntSafe(value) {
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Reads implied by a shell command.
 * @returns {{filePath: string, utility: string, offset?: number, limit?: number, tailLines?: number, wholeFile: boolean}[]}
 */
export function extractReads(commandLine, workspace) {
  if (!commandLine || typeof commandLine !== "string") return [];
  const out = [];

  for (const segment of splitPipeline(commandLine)) {
    const { stripped } = extractRedirects(segment);
    const tokens = tokenize(stripped);
    const cmd = commandOf(tokens);

    // inline script reads: open("x"), readFileSync('y')
    for (const m of segment.matchAll(/(?:open|readFileSync|readFile|read_text|load)\s*\(\s*["']([^"']+)["']/g)) {
      const abs = existingFile(m[1], workspace);
      if (abs) out.push({ filePath: m[1], utility: "inline-script", wholeFile: true });
    }

    if (!cmd || !READ_UTILITIES.has(cmd.utility)) continue;
    const { utility, args } = cmd;

    if (utility === "dd") {
      for (const arg of args) {
        if (arg.startsWith("if=")) {
          const value = arg.slice(3);
          if (existingFile(value, workspace)) out.push({ filePath: value, utility, wholeFile: true });
        }
      }
      continue;
    }

    let limit = null;
    let offset = null;
    let tailLines = null;
    const files = [];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (utility === "head" || utility === "tail") {
        if (arg === "-n" && args[i + 1] !== undefined) {
          const next = args[++i];
          if (next.startsWith("+")) offset = parseIntSafe(next.slice(1));
          else if (utility === "head") limit = parseIntSafe(next);
          else tailLines = parseIntSafe(next);
          continue;
        }
        const attached = arg.match(/^-n?(\+?)(\d+)$/);
        if (attached) {
          if (attached[1] === "+") offset = parseIntSafe(attached[2]);
          else if (utility === "head") limit = parseIntSafe(attached[2]);
          else tailLines = parseIntSafe(attached[2]);
          continue;
        }
      }

      if (utility === "sed") {
        const range = arg.match(/^'?(\d+),(\d+)p'?$/) || arg.match(/^'?(\d+),(\d+)!?d'?$/);
        if (range) {
          offset = parseIntSafe(range[1]);
          limit = Math.max(1, Number(range[2]) - Number(range[1]) + 1);
          continue;
        }
        const single = arg.match(/^'?(\d+)p'?$/);
        if (single) {
          offset = parseIntSafe(single[1]);
          limit = 1;
          continue;
        }
      }

      if (arg.startsWith("-")) continue;
      if (existingFile(arg, workspace)) files.push(arg);
    }

    for (const file of files) {
      const entry = { filePath: file, utility, wholeFile: !offset && !limit && !tailLines };
      if (offset) entry.offset = offset;
      if (limit) entry.limit = limit;
      if (tailLines) entry.tailLines = tailLines;
      // head/tail with no explicit count default to 10 lines
      if ((utility === "head" || utility === "tail") && !offset && !limit && !tailLines) {
        entry.wholeFile = false;
        if (utility === "head") entry.limit = 10;
        else entry.tailLines = 10;
      }
      out.push(entry);
    }
  }
  return out;
}

/**
 * Writes implied by a shell command.
 * @returns {{filePath: string, utility: string, append: boolean}[]}
 */
export function extractWrites(commandLine, workspace) {
  if (!commandLine || typeof commandLine !== "string") return [];
  const out = [];
  const seen = new Set();
  const add = (filePath, utility, append) => {
    const key = `${filePath}|${utility}|${append}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ filePath, utility, append });
  };

  for (const segment of splitPipeline(commandLine)) {
    const { targets, stripped } = extractRedirects(segment);
    for (const t of targets) {
      if (/[*?$]/.test(t.target)) continue;
      add(t.target, t.append ? "redirect-append" : "redirect-overwrite", t.append);
    }

    const cmd = commandOf(tokenize(stripped));
    if (!cmd) continue;
    const { utility, args } = cmd;

    if (utility === "tee") {
      const append = args.includes("-a") || args.includes("--append");
      for (const arg of args) if (!arg.startsWith("-")) add(arg, "tee", append);
      continue;
    }
    if (utility === "sed" && args.some((a) => a === "-i" || /^-i\S*$/.test(a) || a === "--in-place")) {
      for (const arg of args) if (!arg.startsWith("-") && existingFile(arg, workspace)) add(arg, "sed -i", false);
      continue;
    }
    if (utility === "cp" || utility === "mv" || utility === "install" || utility === "rsync") {
      const positional = args.filter((a) => !a.startsWith("-"));
      if (positional.length >= 2) add(positional[positional.length - 1], utility, false);
      continue;
    }
    if (utility === "touch" || utility === "truncate") {
      for (const arg of args) if (!arg.startsWith("-")) add(arg, utility, false);
      continue;
    }
    if (utility === "mkdir" || utility === "rm" || utility === "rmdir") continue;

    for (const m of segment.matchAll(
      /(?:writeFileSync|appendFileSync|writeFile|appendFile|write_text|\.write)\s*\(\s*["']([^"']+)["']/g,
    )) {
      add(m[1], `${utility}:write`, /append/i.test(m[0]));
    }
  }
  return out;
}

export const TerminalCommandParser = { splitPipeline, tokenize, extractReads, extractWrites };
