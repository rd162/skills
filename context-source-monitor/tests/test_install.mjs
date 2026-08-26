#!/usr/bin/env node

/**
 * Tests for the per-project tool-integration installer
 * (scripts/context_source_monitor/install.mjs).
 *
 * Covers:
 *   - fresh install creates the declared files + a manifest with matching hashes
 *   - re-running install with nothing changed reports "unchanged", writes nothing
 *   - a bundle content change (version bump) is detected and applied cleanly
 *   - a hand-edited installed file is detected as "drifted" and left alone
 *     WITHOUT --force, and the drift is still detected on every subsequent
 *     check (the manifest must not adopt the drifted hash as its new baseline)
 *   - --force overwrites a drifted file and clears the drift
 *   - a missing skill version (malformed/absent SKILL.md) degrades to null,
 *     not a throw
 *   - installing an unknown tool name fails loudly instead of silently no-op
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  TOOL_REGISTRY,
  supportedTools,
  getSkillRoot,
  getSkillVersion,
  manifestPath,
  readManifest,
  checkTool,
  checkAll,
  installTool,
  installAll,
  summarizeCheck,
  summarizeInstall,
} from "../scripts/context_source_monitor/install.mjs";
import { hashText } from "../scripts/context_source_monitor/text.mjs";
import { ARTIFACT_DIR } from "../scripts/context_source_monitor/engine.mjs";

let passed = 0;
let failed = 0;
const failures = [];
const queue = [];

function check(name, fn) {
  queue.push({ type: "check", name, fn });
}

function group(title, fn) {
  queue.push({ type: "group", title });
  fn();
}

async function runQueue() {
  for (const item of queue) {
    if (item.type === "group") {
      process.stdout.write(`\n${item.title}\n`);
      continue;
    }
    try {
      await item.fn();
      passed++;
      process.stdout.write(`  ok   ${item.name}\n`);
    } catch (error) {
      failed++;
      failures.push({ name: item.name, error });
      process.stdout.write(`  FAIL ${item.name}\n         ${error.message}\n`);
    }
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "assertion failed");
}

function equal(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${message || "not equal"}: got ${a}, expected ${b}`);
}

// ---------------------------------------------------------------------------
// A tiny fake skill bundle, independent of the real one, so these tests never
// depend on (or risk corrupting) this skill's own SKILL.md or templates.
// ---------------------------------------------------------------------------

const realSkillRoot = getSkillRoot();

function makeFakeSkill({ version = "1.0.0", pluginBody = "export default async () => ({});" } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "csm-fake-skill-"));
  fs.writeFileSync(
    path.join(root, "SKILL.md"),
    [
      "---",
      "name: context-source-monitor",
      "description: fake, for tests only",
      "metadata:",
      `  version: "${version}"`,
      "---",
      "",
      "test fixture",
      "",
    ].join("\n"),
  );
  const pluginDir = path.join(root, "references/integrations/opencode/plugins");
  const cmdDir = path.join(root, "references/integrations/opencode/commands");
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.mkdirSync(cmdDir, { recursive: true });
  fs.writeFileSync(path.join(pluginDir, "context-source-monitor.ts"), pluginBody);
  fs.writeFileSync(path.join(cmdDir, "context-source-monitor.md"), "---\ndescription: fake\n---\nfake command\n");
  return root;
}

function makeWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "csm-install-test-"));
}

const cleanupDirs = [];
function track(dir) {
  cleanupDirs.push(dir);
  return dir;
}

// ---------------------------------------------------------------------------

group("getSkillRoot / getSkillVersion", () => {
  check("getSkillRoot resolves to a directory containing this skill's own SKILL.md", () => {
    assert(fs.existsSync(path.join(realSkillRoot, "SKILL.md")), `no SKILL.md under ${realSkillRoot}`);
  });

  check("getSkillVersion reads metadata.version from a real SKILL.md frontmatter", () => {
    const v = getSkillVersion(realSkillRoot);
    assert(typeof v === "string" && /^\d+\.\d+\.\d+$/.test(v), `expected a semver string, got ${JSON.stringify(v)}`);
  });

  check("getSkillVersion degrades to null for a missing SKILL.md", () => {
    const empty = track(fs.mkdtempSync(path.join(os.tmpdir(), "csm-no-skillmd-")));
    equal(getSkillVersion(empty), null);
  });

  check("getSkillVersion degrades to null when frontmatter has no metadata.version", () => {
    const root = track(fs.mkdtempSync(path.join(os.tmpdir(), "csm-noversion-")));
    fs.writeFileSync(path.join(root, "SKILL.md"), "---\nname: x\ndescription: y\n---\nbody\n");
    equal(getSkillVersion(root), null);
  });
});

group("registry", () => {
  check("opencode is a supported tool with its two files declared", () => {
    assert(supportedTools().includes("opencode"));
    const files = TOOL_REGISTRY.opencode.files;
    assert(files.some((f) => f.dest === ".opencode/plugins/context-source-monitor.ts"));
    assert(files.some((f) => f.dest === ".opencode/commands/context-source-monitor.md"));
  });

  check("installing/checking an unknown tool throws, not a silent no-op", () => {
    const ws = track(makeWorkspace());
    let threw = false;
    try {
      installTool(ws, "definitely-not-a-real-tool", { skillRoot: realSkillRoot });
    } catch {
      threw = true;
    }
    assert(threw, "expected installTool to throw for an unknown tool");
  });
});

group("fresh install", () => {
  check("creates every declared file and a manifest with matching hashes", () => {
    const skillRoot = track(makeFakeSkill());
    const ws = track(makeWorkspace());
    const report = installTool(ws, "opencode", { skillRoot });
    equal(report.installed.sort(), [".opencode/commands/context-source-monitor.md", ".opencode/plugins/context-source-monitor.ts"].sort());
    equal(report.updated, []);
    equal(report.skippedDrift, []);

    for (const { dest, src } of TOOL_REGISTRY.opencode.files) {
      const installedContent = fs.readFileSync(path.join(ws, dest), "utf8");
      const bundleContent = fs.readFileSync(path.join(skillRoot, src), "utf8");
      equal(installedContent, bundleContent, `${dest} should be byte-identical to the bundle template`);
    }

    const manifest = readManifest(ws);
    equal(manifest.tools.opencode.version, "1.0.0");
    assert(fs.existsSync(manifestPath(ws)), "manifest file should exist on disk");
    assert(manifestPath(ws).startsWith(path.join(ws, ARTIFACT_DIR)), "manifest lives under the tool's own artifact dir");
  });

  check("check() reports missing before install, and current after", () => {
    const skillRoot = track(makeFakeSkill());
    const ws = track(makeWorkspace());

    const before = checkTool(ws, "opencode", { skillRoot });
    assert(before.files.every((f) => f.state === "missing"));
    assert(!before.upToDate);

    installTool(ws, "opencode", { skillRoot });

    const after = checkTool(ws, "opencode", { skillRoot });
    assert(after.files.every((f) => f.state === "current"), JSON.stringify(after.files));
    assert(after.upToDate);
    equal(after.installedVersion, "1.0.0");
    equal(after.bundleVersion, "1.0.0");
  });

  check("installAll/checkAll cover every supported tool by default", () => {
    const skillRoot = track(makeFakeSkill());
    const ws = track(makeWorkspace());
    const reports = installAll(ws, { skillRoot });
    equal(reports.map((r) => r.tool).sort(), supportedTools().sort());
    const checks = checkAll(ws, { skillRoot });
    assert(checks.every((c) => c.upToDate));
  });
});

group("idempotency", () => {
  check("re-running install with nothing changed reports unchanged and touches no file content", () => {
    const skillRoot = track(makeFakeSkill());
    const ws = track(makeWorkspace());
    installTool(ws, "opencode", { skillRoot });
    const mtimesBefore = TOOL_REGISTRY.opencode.files.map(({ dest }) => fs.statSync(path.join(ws, dest)).mtimeMs);

    const report = installTool(ws, "opencode", { skillRoot });
    equal(report.installed, []);
    equal(report.updated, []);
    equal(report.unchanged.sort(), [".opencode/commands/context-source-monitor.md", ".opencode/plugins/context-source-monitor.ts"].sort());

    const mtimesAfter = TOOL_REGISTRY.opencode.files.map(({ dest }) => fs.statSync(path.join(ws, dest)).mtimeMs);
    equal(mtimesAfter, mtimesBefore, "unchanged files must not be rewritten");
  });
});

group("bundle update (no local drift)", () => {
  check("a real content+version change is detected as outdated and applied without --force", () => {
    const skillRoot = track(makeFakeSkill({ version: "1.0.0", pluginBody: "// v1\nexport default async () => ({});" }));
    const ws = track(makeWorkspace());
    installTool(ws, "opencode", { skillRoot });

    // Simulate a skill update: bump the version AND change the actual template content.
    fs.writeFileSync(
      path.join(skillRoot, "SKILL.md"),
      fs.readFileSync(path.join(skillRoot, "SKILL.md"), "utf8").replace('version: "1.0.0"', 'version: "1.1.0"'),
    );
    fs.writeFileSync(
      path.join(skillRoot, "references/integrations/opencode/plugins/context-source-monitor.ts"),
      "// v2 — behavior changed\nexport default async () => ({});",
    );

    const before = checkTool(ws, "opencode", { skillRoot });
    assert(!before.upToDate);
    const outdated = before.files.find((f) => f.dest === ".opencode/plugins/context-source-monitor.ts");
    equal(outdated.state, "outdated");
    equal(before.bundleVersion, "1.1.0");
    equal(before.installedVersion, "1.0.0");

    const report = installTool(ws, "opencode", { skillRoot }); // no force needed — no drift
    equal(report.updated, [".opencode/plugins/context-source-monitor.ts"]);
    equal(report.skippedDrift, []);

    const installedContent = fs.readFileSync(path.join(ws, ".opencode/plugins/context-source-monitor.ts"), "utf8");
    assert(installedContent.includes("v2 — behavior changed"));

    const after = checkTool(ws, "opencode", { skillRoot });
    assert(after.upToDate);
    equal(after.installedVersion, "1.1.0");
  });

  check("a version bump with byte-identical template content reports nothing to update", () => {
    // The version number is informational; the content hash is authoritative.
    const skillRoot = track(makeFakeSkill({ version: "1.0.0" }));
    const ws = track(makeWorkspace());
    installTool(ws, "opencode", { skillRoot });

    fs.writeFileSync(
      path.join(skillRoot, "SKILL.md"),
      fs.readFileSync(path.join(skillRoot, "SKILL.md"), "utf8").replace('version: "1.0.0"', 'version: "1.1.0"'),
    );

    const before = checkTool(ws, "opencode", { skillRoot });
    assert(before.upToDate, "identical content must read as up to date regardless of the version label");

    const report = installTool(ws, "opencode", { skillRoot });
    equal(report.installed, []);
    equal(report.updated, []);
    equal(report.unchanged.length, 2);

    // The recorded version still advances, purely as a label — per-file hash state is what matters.
    const manifest = readManifest(ws);
    equal(manifest.tools.opencode.version, "1.1.0");
  });
});

group("drift protection", () => {
  check("a hand-edited installed file is left alone without --force, and reported as drifted", () => {
    const skillRoot = track(makeFakeSkill());
    const ws = track(makeWorkspace());
    installTool(ws, "opencode", { skillRoot });

    const pluginPath = path.join(ws, ".opencode/plugins/context-source-monitor.ts");
    fs.appendFileSync(pluginPath, "\n// hand edit by the project\n");
    const editedContent = fs.readFileSync(pluginPath, "utf8");

    const report = installTool(ws, "opencode", { skillRoot });
    equal(report.skippedDrift, [".opencode/plugins/context-source-monitor.ts"]);
    equal(fs.readFileSync(pluginPath, "utf8"), editedContent, "drifted file content must be untouched");

    const status = checkTool(ws, "opencode", { skillRoot });
    assert(status.hasDrift);
    assert(!status.upToDate);
  });

  check("drift keeps being detected on every subsequent check/install — the skip must not adopt the drifted hash as the new baseline", () => {
    const skillRoot = track(makeFakeSkill());
    const ws = track(makeWorkspace());
    installTool(ws, "opencode", { skillRoot });
    const pluginPath = path.join(ws, ".opencode/plugins/context-source-monitor.ts");
    fs.appendFileSync(pluginPath, "\n// hand edit\n");

    installTool(ws, "opencode", { skillRoot }); // first skip
    const check1 = checkTool(ws, "opencode", { skillRoot });
    assert(check1.hasDrift, "drift must still be visible after one skipped install");

    installTool(ws, "opencode", { skillRoot }); // second skip — this is the regression this test guards
    const check2 = checkTool(ws, "opencode", { skillRoot });
    assert(check2.hasDrift, "drift must still be visible after a second skipped install");
    const driftedFile = check2.files.find((f) => f.dest === ".opencode/plugins/context-source-monitor.ts");
    equal(driftedFile.state, "drifted", "must stay classified as drifted, not decay into merely outdated");
  });

  check("--force overwrites a drifted file and clears the drift", () => {
    const skillRoot = track(makeFakeSkill());
    const ws = track(makeWorkspace());
    installTool(ws, "opencode", { skillRoot });
    const pluginPath = path.join(ws, ".opencode/plugins/context-source-monitor.ts");
    fs.appendFileSync(pluginPath, "\n// hand edit\n");
    installTool(ws, "opencode", { skillRoot }); // skipped once

    const report = installTool(ws, "opencode", { skillRoot, force: true });
    equal(report.forced, [".opencode/plugins/context-source-monitor.ts"]);

    const bundleContent = fs.readFileSync(
      path.join(skillRoot, "references/integrations/opencode/plugins/context-source-monitor.ts"),
      "utf8",
    );
    equal(fs.readFileSync(pluginPath, "utf8"), bundleContent);

    const status = checkTool(ws, "opencode", { skillRoot });
    assert(status.upToDate);
    assert(!status.hasDrift);
  });

  check("a missing installed file is always safe to (re)install, never treated as drift", () => {
    const skillRoot = track(makeFakeSkill());
    const ws = track(makeWorkspace());
    installTool(ws, "opencode", { skillRoot });
    fs.rmSync(path.join(ws, ".opencode/plugins/context-source-monitor.ts"));

    const status = checkTool(ws, "opencode", { skillRoot });
    const missing = status.files.find((f) => f.dest === ".opencode/plugins/context-source-monitor.ts");
    equal(missing.state, "missing");
    assert(!status.hasDrift);

    const report = installTool(ws, "opencode", { skillRoot }); // no --force needed
    equal(report.installed, [".opencode/plugins/context-source-monitor.ts"]);
  });
});

group("manifest robustness", () => {
  check("a corrupt manifest file is treated as absent, not thrown", () => {
    const skillRoot = track(makeFakeSkill());
    const ws = track(makeWorkspace());
    fs.mkdirSync(path.dirname(manifestPath(ws)), { recursive: true });
    fs.writeFileSync(manifestPath(ws), "{ not valid json");
    const manifest = readManifest(ws);
    equal(manifest.tools, {});
    // and installing over a corrupt manifest must still work cleanly
    const report = installTool(ws, "opencode", { skillRoot });
    equal(report.installed.length, 2);
  });
});

group("human-readable summaries", () => {
  check("summarizeCheck / summarizeInstall render without throwing for every state", () => {
    const skillRoot = track(makeFakeSkill());
    const ws = track(makeWorkspace());
    const fresh = summarizeInstall(installAll(ws, { skillRoot }));
    assert(/installed/.test(fresh));
    const upToDate = summarizeCheck(checkAll(ws, { skillRoot }));
    assert(/up to date/.test(upToDate));
  });
});

// ---------------------------------------------------------------------------

async function run() {
  await runQueue();

  process.stdout.write("\n");
  if (failed === 0) {
    process.stdout.write(`All ${passed} checks passed.\n`);
  } else {
    process.stdout.write(`${passed} passed, ${failed} FAILED\n`);
    for (const f of failures) process.stdout.write(`  - ${f.name}: ${f.error.message}\n`);
  }
  for (const dir of cleanupDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
  process.exit(failed === 0 ? 0 : 1);
}

run();
