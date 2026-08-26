/**
 * Binary sniffing and structural (block) extraction.
 *
 * Blocks are the unit of node-level provenance: a heading, class, function,
 * macro, YAML section, VTT cue, ... Each block is {name, kind, startLine, endLine}.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { splitLines } from "./text.mjs";

export const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp", ".tif", ".tiff", ".avif", ".heic",
  ".mp4", ".mov", ".mkv", ".avi", ".webm", ".mp3", ".wav", ".ogg", ".flac", ".m4a",
  ".pdf", ".zip", ".tar", ".gz", ".tgz", ".bz2", ".xz", ".7z", ".rar",
  ".exe", ".bin", ".dll", ".so", ".dylib", ".class", ".pyc", ".pyo", ".wasm", ".o", ".a",
  ".db", ".sqlite", ".sqlite3", ".parquet", ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".odt", ".ods", ".odp", ".rtf",
]);

/** Extensions whose content is text we can meaningfully cover/parse. */
export const TEXT_EXTENSIONS = new Set([
  ".md", ".markdown", ".mdx", ".txt", ".rst", ".adoc",
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".jsonc", ".json5",
  ".py", ".rb", ".go", ".rs", ".java", ".kt", ".cs", ".php", ".pl", ".pm", ".lua",
  ".sh", ".bash", ".zsh", ".fish", ".ps1",
  ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf", ".properties", ".env",
  ".sql", ".graphql", ".proto", ".xml", ".html", ".htm", ".css", ".scss", ".less",
  ".j2", ".jinja", ".jinja2", ".tmpl", ".tpl", ".mustache", ".hbs",
  ".vtt", ".srt", ".csv", ".tsv", ".drawio", ".svg", ".patch", ".diff", ".lock",
]);

export function isProbablyBinary(absPath, sniffBytes = 8192) {
  let fd;
  try {
    const st = fs.statSync(absPath);
    if (!st.isFile()) return true;
    if (st.size === 0) return false;

    const ext = path.extname(absPath).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) return true;
    if (TEXT_EXTENSIONS.has(ext)) return false;

    fd = fs.openSync(absPath, "r");
    const len = Math.min(sniffBytes, st.size);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, 0);

    let nulls = 0;
    let control = 0;
    for (let i = 0; i < len; i++) {
      const b = buf[i];
      if (b === 0) nulls++;
      else if (b < 32 && b !== 9 && b !== 10 && b !== 13) control++;
    }
    if (nulls > 0) return true;
    if (control / len > 0.08) return true;

    // Reject invalid UTF-8. Trim the tail so a split multi-byte char is not a false positive.
    const safe = len < st.size ? buf.subarray(0, Math.max(0, len - 4)) : buf;
    return safe.toString("utf8").includes("\uFFFD");
  } catch {
    return true;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }
}

function block(name, kind, startLine, endLine) {
  const end = Math.max(startLine, endLine);
  return { name, kind, startLine, endLine: end, lineCount: end - startLine + 1 };
}

/**
 * Brace/bracket matcher that ignores braces inside strings, template literals,
 * line comments and block comments. The naive version mis-sized most blocks.
 */
function findBlockEndByBraces(lines, startIndex) {
  let depth = 0;
  let opened = false;
  let inBlockComment = false;
  let stringChar = null;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      const next = line[c + 1];

      if (inBlockComment) {
        if (ch === "*" && next === "/") {
          inBlockComment = false;
          c++;
        }
        continue;
      }
      if (stringChar) {
        if (ch === "\\") c++;
        else if (ch === stringChar) stringChar = null;
        continue;
      }
      if (ch === "/" && next === "/") break; // rest of line is a comment
      if (ch === "/" && next === "*") {
        inBlockComment = true;
        c++;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        stringChar = ch;
        continue;
      }
      if (ch === "{") {
        depth++;
        opened = true;
      } else if (ch === "}") {
        depth--;
        if (opened && depth <= 0) return i + 1;
      }
    }
    if (opened && depth <= 0) return i + 1;
  }
  return lines.length;
}

function findIndentBlockEnd(lines, startIndex, baseIndent) {
  let lastContent = startIndex + 1;
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    const indent = line.search(/\S|$/);
    if (indent <= baseIndent) return lastContent;
    lastContent = i + 1;
  }
  return lines.length;
}

export function parseMarkdown(content) {
  const lines = splitLines(content);
  const blocks = [];
  const headings = [];
  let inFence = false;
  let fenceStart = 0;
  let fenceLang = "";
  let fenceMarker = "";

  if (lines[0]?.trim() === "---") {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        blocks.push(block("YAML frontmatter", "frontmatter", 1, i + 1));
        break;
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const trimmed = lines[i].trim();
    const fence = trimmed.match(/^(`{3,}|~{3,})(.*)$/);

    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceStart = lineNo;
        fenceMarker = fence[1][0];
        fenceLang = fence[2].trim();
      } else if (fence[1][0] === fenceMarker) {
        inFence = false;
        blocks.push(block(`code fence (${fenceLang || "text"})`, "code_block", fenceStart, lineNo));
      }
      continue;
    }
    if (inFence) continue;

    const atx = lines[i].match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (atx) {
      headings.push({ line: lineNo, level: atx[1].length, text: atx[2].trim() });
      continue;
    }
    // setext headings
    if (i > 0 && /^(=+|-{2,})\s*$/.test(trimmed) && lines[i - 1].trim() !== "") {
      headings.push({ line: i, level: trimmed.startsWith("=") ? 1 : 2, text: lines[i - 1].trim() });
    }
  }

  if (inFence) blocks.push(block(`code fence (${fenceLang || "text"})`, "code_block", fenceStart, lines.length));

  for (let h = 0; h < headings.length; h++) {
    const cur = headings[h];
    let end = lines.length;
    for (let n = h + 1; n < headings.length; n++) {
      if (headings[n].level <= cur.level) {
        end = headings[n].line - 1;
        break;
      }
    }
    blocks.push(block(`${"#".repeat(cur.level)} ${cur.text}`, "heading", cur.line, end));
  }

  return blocks.sort((a, b) => a.startLine - b.startLine || a.endLine - b.endLine);
}

export function parseJsTs(content) {
  const lines = splitLines(content);
  const blocks = [];
  const controlKeywords = /^(if|for|while|switch|catch|do|else|try|return|await|yield|new|typeof)\b/;

  let importStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i];
    const trimmed = raw.trim();

    if (/^(import|export)\s+.*\bfrom\b/.test(trimmed) || /^import\s+["']/.test(trimmed) || /^import\s*\(/.test(trimmed)) {
      if (importStart === -1) importStart = lineNo;
      blocks.push(block(`import ${trimmed.slice(0, 60)}`, "import", importStart, lineNo));
      importStart = -1;
      continue;
    }

    let m = trimmed.match(/^(?:export\s+)?(?:declare\s+)?interface\s+([A-Za-z0-9_$]+)/);
    if (m) {
      blocks.push(block(`interface ${m[1]}`, "interface", lineNo, findBlockEndByBraces(lines, i)));
      continue;
    }
    m = trimmed.match(/^(?:export\s+)?(?:declare\s+)?type\s+([A-Za-z0-9_$]+)/);
    if (m) {
      let end = lineNo;
      for (let j = i; j < lines.length; j++) {
        if (lines[j].includes(";") || lines[j].trim() === "") {
          end = j + 1;
          break;
        }
      }
      blocks.push(block(`type ${m[1]}`, "type", lineNo, end));
      continue;
    }
    m = trimmed.match(/^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/);
    if (m) {
      blocks.push(block(`class ${m[1]}`, "class", lineNo, findBlockEndByBraces(lines, i)));
      continue;
    }
    m = trimmed.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z0-9_$]*)/);
    if (m) {
      blocks.push(block(`function ${m[1] || "(anonymous)"}()`, "function", lineNo, findBlockEndByBraces(lines, i)));
      continue;
    }
    m = trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/);
    if (m) {
      blocks.push(block(`const ${m[1]} = () =>`, "function", lineNo, findBlockEndByBraces(lines, i)));
      continue;
    }
    // class members: `foo(...) {`, `static foo(...) {`, `async foo(...): T {`
    m = trimmed.match(
      /^(?:(?:public|private|protected|static|async|get|set|override|readonly)\s+)*([A-Za-z0-9_$]+)\s*\([^)]*\)\s*(?::[^{]+)?\{/,
    );
    if (m && !controlKeywords.test(trimmed) && /^\s+/.test(raw)) {
      const name = m[1];
      blocks.push(block(name === "constructor" ? "constructor()" : `method ${name}()`, "method", lineNo, findBlockEndByBraces(lines, i)));
      continue;
    }
  }

  return blocks.sort((a, b) => a.startLine - b.startLine || a.endLine - b.endLine);
}

export function parsePython(content) {
  const lines = splitLines(content);
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const indent = raw.search(/\S|$/);

    let m = trimmed.match(/^class\s+([A-Za-z0-9_]+)/);
    if (m) {
      blocks.push(block(`class ${m[1]}`, "class", i + 1, findIndentBlockEnd(lines, i, indent)));
      continue;
    }
    m = trimmed.match(/^(?:async\s+)?def\s+([A-Za-z0-9_]+)/);
    if (m) {
      blocks.push(block(`def ${m[1]}()`, indent > 0 ? "method" : "function", i + 1, findIndentBlockEnd(lines, i, indent)));
    }
  }
  return blocks.sort((a, b) => a.startLine - b.startLine || a.endLine - b.endLine);
}

export function parseShell(content) {
  const lines = splitLines(content);
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].trim().match(/^(?:function\s+)?([A-Za-z0-9_\-]+)\s*\(\)\s*\{/);
    if (m) blocks.push(block(`${m[1]}()`, "function", i + 1, findBlockEndByBraces(lines, i)));
  }
  return blocks;
}

export function parseJinja(content) {
  const lines = splitLines(content);
  const blocks = [];
  const openers = [
    { re: /\{%-?\s*macro\s+([A-Za-z0-9_]+)/, end: /\{%-?\s*endmacro/, kind: "macro" },
    { re: /\{%-?\s*block\s+([A-Za-z0-9_]+)/, end: /\{%-?\s*endblock/, kind: "block" },
  ];
  for (let i = 0; i < lines.length; i++) {
    for (const op of openers) {
      const m = lines[i].match(op.re);
      if (!m) continue;
      let end = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        if (op.end.test(lines[j])) {
          end = j + 1;
          break;
        }
      }
      blocks.push(block(`${op.kind} ${m[1]}`, op.kind, i + 1, end));
    }
  }
  return blocks.sort((a, b) => a.startLine - b.startLine);
}

export function parseJson(content) {
  const lines = splitLines(content);
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*"([^"]+)"\s*:\s*([{[])?/);
    if (!m) continue;
    const end = m[2] ? findBlockEndByBraces(lines, i) : i + 1;
    blocks.push(block(`"${m[1]}"`, "key", i + 1, end));
  }
  return blocks;
}

export function parseYaml(content) {
  const lines = splitLines(content);
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim() === "" || raw.trim().startsWith("#")) continue;
    const m = raw.match(/^(\s*)([A-Za-z0-9_.\-$]+):\s*(.*)$/);
    if (!m) continue;
    const indent = m[1].length;
    const hasInlineValue = m[3].trim() !== "" && !m[3].trim().startsWith("#");
    const end = hasInlineValue ? i + 1 : findIndentBlockEnd(lines, i, indent);
    blocks.push(block(`${m[2]}:`, indent === 0 ? "section" : "key", i + 1, end));
  }
  return blocks.sort((a, b) => a.startLine - b.startLine || a.endLine - b.endLine);
}

export function parseVtt(content) {
  const lines = splitLines(content);
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})/);
    if (!m) continue;
    let end = i + 1;
    let firstText = "";
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() === "") break;
      if (!firstText) firstText = lines[j].trim();
      end = j + 1;
    }
    blocks.push(block(`cue ${m[1]}→${m[2]}: ${firstText.slice(0, 40)}`, "cue", i + 1, end));
  }
  return blocks;
}

/** Paragraph blocks for formats we have no grammar for. */
export function parseParagraphs(content) {
  const lines = splitLines(content);
  const blocks = [];
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const blank = lines[i].trim() === "";
    if (!blank && start === -1) start = i + 1;
    if (blank && start !== -1) {
      blocks.push(block(`paragraph L${start}-${i}`, "paragraph", start, i));
      start = -1;
    }
  }
  if (start !== -1) blocks.push(block(`paragraph L${start}-${lines.length}`, "paragraph", start, lines.length));
  return blocks;
}

/** Dispatch on extension. `content` is required (callers already have it). */
export function parseStructure(relOrAbsPath, content) {
  if (!content) return [];
  const ext = path.extname(relOrAbsPath).toLowerCase();
  try {
    if ([".md", ".markdown", ".mdx"].includes(ext)) return parseMarkdown(content);
    if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) return parseJsTs(content);
    if (ext === ".py") return parsePython(content);
    if ([".sh", ".bash", ".zsh"].includes(ext)) return parseShell(content);
    if ([".j2", ".jinja", ".jinja2", ".tmpl", ".tpl"].includes(ext)) return parseJinja(content);
    if ([".json", ".jsonc", ".json5"].includes(ext)) return parseJson(content);
    if ([".yaml", ".yml"].includes(ext)) return parseYaml(content);
    if ([".vtt", ".srt"].includes(ext)) return parseVtt(content);
    return parseParagraphs(content);
  } catch {
    return [];
  }
}
