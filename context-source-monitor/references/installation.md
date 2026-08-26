# Installing this skill's tool integrations into a project

This is the mechanics reference for `install` (aliased `init`/`update`). Read `../SKILL.md` first for why
this exists at all (per-project, never global). This file covers: exactly what gets written where, how
the version/update/drift decisions are made, and how to add support for a new tool later.

## What `install` actually does

For each requested tool (default: every tool in `TOOL_REGISTRY`, currently just `opencode`):

1. Read this skill's own version from `SKILL.md`'s `metadata.version` frontmatter field — the single
   source of truth for "how new is the bundle."
2. For each `{src, dest}` pair the tool declares (`src` relative to the skill root, `dest` relative to the
   target project's workspace root):
   - Hash the **bundle template** (`src`) and, if it exists, the **currently installed file** (`dest`).
   - Classify the installed file — see "State machine" below.
   - `missing` / `outdated` → write the bundle content to `dest` (creating parent directories as needed).
   - `drifted` → **skip**, unless `force` was passed.
   - `current` → skip (nothing to do).
3. Write the outcome to a per-project manifest: `data/research/context-source-monitor/integrations.json`
   (next to `inf-map.json` and friends — see `../SKILL.md`'s artifact list).

Nothing here needs the target tool to already be usable: `install` is a plain file-copy operation with a
sha256 comparison, importable and runnable from a bare `node` process with zero dependencies. That is
deliberate — it is how a brand-new project bootstraps OpenCode support in the first place, before any
`context_source_monitor` tool exists there to call.

## State machine (per installed file)

```
                exists?
                 /    \
               no      yes
               |         |
           MISSING   current content == bundle content?
                          /              \
                        yes               no
                         |                 |
                     CURRENT      recorded hash present AND != current content?
                                        /                    \
                                      yes                     no
                                       |                       |
                                   DRIFTED                 OUTDATED
```

- **`missing`** — always safe to write. No history to lose.
- **`current`** — installed content is already byte-identical to what the bundle would install. Nothing to
  do, *regardless of what the manifest says* — the end state is correct however it got there (e.g. after a
  fresh `git clone` with no prior local manifest at all).
- **`outdated`** — content differs from the bundle, but either (a) there's no manifest record for this
  file yet, or (b) the manifest's last-known-installed hash for this file matches what's on disk right now
  (i.e. nobody touched it since we installed it) — safe to overwrite.
- **`drifted`** — content differs from the bundle **and** differs from what the manifest recorded as
  "what we last installed here." Someone (a person, or another tool) edited the installed file since. Never
  overwritten without `force: true`. This is the one state that survives repeated `install` runs unchanged
  — see "Why drift must not decay into outdated" below.

`checkTool`/`checkAll` (what `status` calls) run exactly this classification **read-only**, so "is an
update available / is anything drifted" can always be answered without writing anything.

## Why drift must not decay into "outdated"

The tempting-but-wrong implementation records `currentHash` (the hand-edited content) into the manifest
even when *skipping* a drifted file, on the theory that "this is what's actually on disk now." Don't do
that: on the *next* check, `recordedHash` would then equal `currentHash` by construction, so the file would
misclassify as `outdated` (safe to silently overwrite) instead of `drifted` (needs a human decision) —
the drift would vanish after exactly one `install` run, silently. The fix is to leave the file's manifest
entry untouched while skipping it, so `recordedHash` keeps pointing at what we actually last wrote, and the
comparison keeps coming out `drifted` for as long as the on-disk content stays hand-edited. `tests/test_install.mjs`
has a regression test for exactly this ("drift keeps being detected on every subsequent check/install").

## The manifest (`data/research/context-source-monitor/integrations.json`)

```json
{
  "schemaVersion": "1.0.0",
  "kind": "context-source-monitor-integrations",
  "tools": {
    "opencode": {
      "version": "1.0.0",
      "installedAt": "2026-08-26T18:00:00.000Z",
      "files": {
        ".opencode/plugins/context-source-monitor.ts": "<sha256 hex>",
        ".opencode/commands/context-source-monitor.md": "<sha256 hex>"
      }
    }
  }
}
```

Commit this file with the rest of the project's `data/research/context-source-monitor/` artifacts. It is
what lets a teammate's checkout, or a CI job, answer "is our installed integration current" without
re-deriving anything — and it is what makes drift detection survive across sessions and machines instead of
depending on file mtimes or in-memory state.

## Adding support for a new tool (e.g. Claude Code)

Nothing in `install.mjs` is tool-specific except `TOOL_REGISTRY`. To add a tool:

1. Create `references/integrations/<tool>/...` with whatever files that tool needs, following the same
   "thin loader, no embedded logic" pattern as `references/integrations/opencode/plugins/context-source-monitor.ts`
   (dynamically resolve this skill's root — `CONTEXT_SOURCE_MONITOR_HOME` env var, else
   `~/.agents/skills/context-source-monitor` — and delegate to the real implementation in `scripts/`; never
   duplicate engine logic into the installed file itself, or every project's copy goes stale independently
   the moment the engine changes).
2. Add one entry to `TOOL_REGISTRY` in `scripts/context_source_monitor/install.mjs`:
   ```js
   "claude-code": {
     label: "Claude Code",
     files: [
       { dest: ".claude/some-hook-file", src: "references/integrations/claude-code/some-hook-file" },
       // ...
     ],
   },
   ```
3. Update `compatibility` in `SKILL.md`'s frontmatter to list the new tool.
4. Nothing else changes: `install`/`status`/`checkAll`/`installAll` already iterate `TOOL_REGISTRY`
   generically, and the CLI's `--tools`/plugin's `tools` argument already accept any registered name.

## Bumping this skill's own version

Bump `metadata.version` in `SKILL.md` whenever a file under `references/integrations/**` changes in a way
that should propagate to installed projects. A version bump with **no** content change is harmless but
also invisible to `install` — the per-file content hash is what actually drives every decision (see
`tests/test_install.mjs`'s "a version bump with byte-identical template content reports nothing to
update"). The version number is a human-facing label, not the mechanism.
