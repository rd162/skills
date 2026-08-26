/**
 * Self-install / self-update for this skill's per-project tool integrations.
 *
 * Why this exists: the engine (this whole `context_source_monitor/` package)
 * lives ONCE, globally, wherever this skill is installed — but each AI coding
 * tool (OpenCode today; Claude Code and others later) needs a small adapter
 * file physically present INSIDE a given project's own tool-config directory
 * (e.g. `.opencode/plugins/`) before that tool will load it at all. This
 * module is what copies those adapter files from the skill's own bundle
 * (`references/integrations/<tool>/...`) into a target project, and knows how
 * to tell "never installed" from "bundle updated, safe to refresh" from "you
 * hand-edited the installed file, don't touch it" — by content hash, not by
 * trusting a version number alone.
 *
 * Deliberately NOT global: installing into `~/.config/opencode/` would mean
 * every OpenCode session in every project on the machine gets this tool
 * whether that project wants it or not, with one shared, un-scoped on/off
 * switch. A per-project install is opt-in, travels with the project's own
 * repo (commit the installed files + the manifest below, same as any other
 * generated-but-committed tool config in this ecosystem — see how OpenSpec's
 * CLI does the same for `.opencode/commands/opsx-*.md`), and lets each
 * project independently decide to skip an update it isn't ready for.
 *
 * Extending to a new tool (e.g. Claude Code): add one entry to TOOL_REGISTRY
 * below pointing at bundle files under `references/integrations/<tool>/...`
 * with their project-relative install destinations. Nothing else in this
 * module is tool-specific.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { hashText } from "./text.mjs";
import { ARTIFACT_DIR, writeFileAtomic } from "./engine.mjs";

export const INTEGRATIONS_FILENAME = "integrations.json";
export const MANIFEST_SCHEMA_VERSION = "1.0.0";

/**
 * One entry per supported tool. `dest` is relative to the TARGET project's
 * workspace root; `src` is relative to THIS SKILL's own root.
 */
export const TOOL_REGISTRY = Object.freeze({
  opencode: Object.freeze({
    label: "OpenCode",
    files: Object.freeze([
      Object.freeze({
        dest: ".opencode/plugins/context-source-monitor.ts",
        src: "references/integrations/opencode/plugins/context-source-monitor.ts",
      }),
      Object.freeze({
        dest: ".opencode/commands/context-source-monitor.md",
        src: "references/integrations/opencode/commands/context-source-monitor.md",
      }),
    ]),
  }),
});

export function supportedTools() {
  return Object.keys(TOOL_REGISTRY);
}

export function listToolFiles(toolName) {
  const entry = TOOL_REGISTRY[toolName];
  if (!entry) {
    throw new Error(`unknown tool integration "${toolName}" (supported: ${supportedTools().join(", ")})`);
  }
  return entry.files;
}

/** This skill's own root directory, self-located — correct regardless of how/where it's invoked from. */
export function getSkillRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url)); // <root>/scripts/context_source_monitor
  return path.resolve(here, "..", "..");
}

/**
 * The skill's own version, read from SKILL.md's `metadata.version` frontmatter
 * field — the single source of truth this whole install/update mechanism
 * compares against. Deliberately a tiny hand-rolled scan, not a YAML
 * dependency: the frontmatter this skill controls is always flat `key: value`
 * (optionally one level deep under `metadata:`), so a general parser buys
 * nothing but a dependency.
 */
export function getSkillVersion(skillRoot = getSkillRoot()) {
  let content;
  try {
    content = fs.readFileSync(path.join(skillRoot, "SKILL.md"), "utf8");
  } catch {
    return null;
  }
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)?.[1];
  if (!frontmatter) return null;
  let inMetadata = false;
  for (const line of frontmatter.split("\n")) {
    if (/^metadata:\s*$/.test(line)) {
      inMetadata = true;
      continue;
    }
    if (!inMetadata) continue;
    if (/^\S/.test(line)) break; // dedented back to a top-level key: metadata block ended
    const m = line.match(/^\s+version:\s*["']?([^"'#\n]+?)["']?\s*$/);
    if (m) return m[1].trim();
  }
  return null;
}

export function manifestPath(workspace) {
  return path.join(workspace, ARTIFACT_DIR, INTEGRATIONS_FILENAME);
}

function emptyManifest() {
  return { schemaVersion: MANIFEST_SCHEMA_VERSION, kind: "context-source-monitor-integrations", tools: {} };
}

export function readManifest(workspace) {
  const p = manifestPath(workspace);
  if (!fs.existsSync(p)) return emptyManifest();
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf8"));
    if (!data || typeof data !== "object" || typeof data.tools !== "object" || data.tools === null) {
      throw new Error("malformed integrations manifest");
    }
    return { ...emptyManifest(), ...data };
  } catch {
    return emptyManifest();
  }
}

export function writeManifest(workspace, manifest) {
  const normalized = { ...emptyManifest(), ...manifest };
  writeFileAtomic(manifestPath(workspace), `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}

/**
 * Classify one installed file against the bundle template and this project's
 * own history with it. Order matters: an installed file that already matches
 * the current bundle is "current" regardless of what the manifest says (the
 * end state is correct, however it got there) — only once content actually
 * differs from the bundle do we need to ask "did WE leave it that way, or did
 * someone else touch it since."
 */
function classifyFile({ exists, currentHash, bundleHash, recordedHash }) {
  if (!exists) return "missing";
  if (currentHash === bundleHash) return "current";
  if (recordedHash != null && recordedHash !== currentHash) return "drifted";
  return "outdated";
}

function readBundleFile(skillRoot, relSrc) {
  return fs.readFileSync(path.resolve(skillRoot, relSrc), "utf8");
}

/** Read-only: what WOULD happen, and the current state of every file. Never writes anything. */
export function checkTool(workspace, toolName, { skillRoot = getSkillRoot() } = {}) {
  const bundleVersion = getSkillVersion(skillRoot);
  const manifest = readManifest(workspace);
  const recorded = manifest.tools[toolName];
  const files = listToolFiles(toolName).map(({ dest, src }) => {
    const absDest = path.resolve(workspace, dest);
    const exists = fs.existsSync(absDest);
    const currentHash = exists ? hashText(fs.readFileSync(absDest, "utf8")) : null;
    const bundleHash = hashText(readBundleFile(skillRoot, src));
    const recordedHash = recorded?.files?.[dest] ?? null;
    const state = classifyFile({ exists, currentHash, bundleHash, recordedHash });
    return { dest, src, state, exists, currentHash, bundleHash, recordedHash };
  });
  return {
    tool: toolName,
    label: TOOL_REGISTRY[toolName]?.label ?? toolName,
    bundleVersion,
    installedVersion: recorded?.version ?? null,
    upToDate: files.every((f) => f.state === "current"),
    hasDrift: files.some((f) => f.state === "drifted"),
    files,
  };
}

export function checkAll(workspace, { skillRoot = getSkillRoot(), tools = supportedTools() } = {}) {
  return tools.map((tool) => checkTool(workspace, tool, { skillRoot }));
}

/**
 * Copy every file for one tool from the bundle into the workspace, skipping
 * (not overwriting) anything `drifted` unless `force` is set, then record the
 * new state in the manifest. Never throws for a normal drift — that is the
 * expected, safe outcome; it throws only for an unknown tool name or an
 * unreadable bundle file (a real bug in the skill install itself).
 */
export function installTool(workspace, toolName, { skillRoot = getSkillRoot(), force = false } = {}) {
  const bundleVersion = getSkillVersion(skillRoot);
  const manifest = readManifest(workspace);
  const recorded = manifest.tools[toolName];
  const report = { tool: toolName, installed: [], updated: [], forced: [], unchanged: [], skippedDrift: [] };
  const fileHashes = {};

  for (const { dest, src } of listToolFiles(toolName)) {
    const absDest = path.resolve(workspace, dest);
    const bundleContent = readBundleFile(skillRoot, src);
    const bundleHash = hashText(bundleContent);
    const exists = fs.existsSync(absDest);
    const currentHash = exists ? hashText(fs.readFileSync(absDest, "utf8")) : null;
    const recordedHash = recorded?.files?.[dest] ?? null;
    const state = classifyFile({ exists, currentHash, bundleHash, recordedHash });

    if (state === "current") {
      fileHashes[dest] = currentHash;
      report.unchanged.push(dest);
      continue;
    }
    if (state === "drifted" && !force) {
      // Deliberately do NOT record currentHash here. `state === "drifted"` only
      // happens when recordedHash is non-null and differs from currentHash, so
      // preserving the OLD recordedHash keeps the next check correctly seeing
      // "this still differs from what we last installed" instead of adopting
      // the hand-edited content as the new baseline and forgetting the drift.
      fileHashes[dest] = recordedHash;
      report.skippedDrift.push(dest);
      continue;
    }

    writeFileAtomic(absDest, bundleContent);
    fileHashes[dest] = bundleHash;
    if (state === "missing") report.installed.push(dest);
    else if (state === "drifted") report.forced.push(dest);
    else report.updated.push(dest);
  }

  manifest.tools[toolName] = {
    version: bundleVersion,
    installedAt: new Date().toISOString(),
    files: fileHashes,
  };
  writeManifest(workspace, manifest);
  return report;
}

export function installAll(workspace, { skillRoot = getSkillRoot(), tools = supportedTools(), force = false } = {}) {
  return tools.map((tool) => installTool(workspace, tool, { skillRoot, force }));
}

/** One line per tool, for `status`-style summaries. */
export function summarizeCheck(results) {
  return results
    .map((r) => {
      if (!r.files.length) return `${r.label}: no files declared`;
      if (r.upToDate) return `${r.label}: up to date (v${r.installedVersion ?? "?"})`;
      const missing = r.files.filter((f) => f.state === "missing").length;
      const outdated = r.files.filter((f) => f.state === "outdated").length;
      const drifted = r.files.filter((f) => f.state === "drifted").length;
      const parts = [];
      if (missing) parts.push(`${missing} not installed`);
      if (outdated) parts.push(`${outdated} update available (v${r.installedVersion ?? "?"} -> v${r.bundleVersion})`);
      if (drifted) parts.push(`${drifted} locally modified (needs --force to overwrite)`);
      return `${r.label}: ${parts.join(", ")}`;
    })
    .join("\n");
}

/** Multi-line, per-file detail — for the `install` action/command's own report. */
export function summarizeInstall(reports) {
  const lines = [];
  for (const r of reports) {
    const label = TOOL_REGISTRY[r.tool]?.label ?? r.tool;
    const bits = [];
    if (r.installed.length) bits.push(`installed ${r.installed.join(", ")}`);
    if (r.updated.length) bits.push(`updated ${r.updated.join(", ")}`);
    if (r.forced.length) bits.push(`force-overwrote ${r.forced.join(", ")}`);
    if (r.unchanged.length) bits.push(`unchanged ${r.unchanged.join(", ")}`);
    if (r.skippedDrift.length) {
      bits.push(`SKIPPED (locally modified, use force) ${r.skippedDrift.join(", ")}`);
    }
    lines.push(`${label}: ${bits.join("; ") || "nothing to do"}`);
  }
  return lines.join("\n");
}
