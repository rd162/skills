/**
 * Context Source Monitor — OpenCode plugin loader (installed copy).
 *
 * This file was installed INTO this project by the context-source-monitor
 * skill's installer (`node <skill>/scripts/context_source_monitor.mjs
 * install`). Do not hand-edit it — re-run the installer to update; hand
 * edits are detected (by content hash) and preserved, never silently
 * clobbered, but they also mean you stop getting updates for this file until
 * you resolve the conflict (see the skill's `references/installation.md`).
 *
 * It intentionally contains NO engine or hook logic, and imports nothing from
 * `@opencode-ai/plugin` itself, so a stale or misconfigured skill install can
 * never be the reason OpenCode fails to start in THIS project. The real
 * implementation — engine, CLI, OpenCode hooks, docs, dev history, tests —
 * lives once in the `context-source-monitor` skill so every project that
 * installs this loader stays current automatically when the skill's engine
 * changes, without re-running the installer. The installer only needs
 * re-running when this LOADER file itself changes (rare — see the skill's
 * `SKILL.md` version and `references/development-history.md`).
 *
 * Default skill location: ~/.agents/skills/context-source-monitor
 * Override: set CONTEXT_SOURCE_MONITOR_HOME to a different skill directory
 * (e.g. while developing the skill itself) before starting OpenCode.
 */

import { homedir } from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

function resolveSkillRoot(): string {
  const override = process.env.CONTEXT_SOURCE_MONITOR_HOME?.trim();
  if (override) return path.resolve(override);
  return path.join(homedir(), ".agents", "skills", "context-source-monitor");
}

const skillRoot = resolveSkillRoot();
const entryPoint = path.join(skillRoot, "scripts", "opencode-plugin.ts");

/** A plugin that only warns once, for when the skill isn't installed/set up yet. */
function unavailablePlugin(reason: unknown) {
  let warned = false;
  const warn = async (log?: (msg: string) => void) => {
    if (warned) return;
    warned = true;
    const message =
      `[context-source-monitor] Could not load the skill from ${entryPoint} ` +
      `(set CONTEXT_SOURCE_MONITOR_HOME if it lives elsewhere, and run \`npm install\` ` +
      `inside the skill directory at least once). Cause: ${(reason as Error)?.message ?? reason}`;
    if (log) log(message);
    else console.error(message);
  };
  return async ({ client }: { client?: { app?: { log?: (args: unknown) => Promise<unknown> } } } = {}) => ({
    event: async () => {
      await warn(
        client?.app?.log
          ? (message: string) =>
              client.app!.log!({ body: { service: "context-source-monitor", level: "warn", message } })
          : undefined,
      );
    },
  });
}

let plugin: unknown;
try {
  const real: any = await import(pathToFileURL(entryPoint).href);
  plugin = real.default ?? real.ContextSourceMonitorPlugin;
  if (typeof plugin !== "function") throw new Error("skill module has no usable plugin export");
} catch (error) {
  plugin = unavailablePlugin(error);
}

export const ContextSourceMonitorPlugin = plugin as any;
export default plugin as any;
