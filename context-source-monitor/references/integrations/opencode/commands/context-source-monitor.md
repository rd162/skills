---
description: "Context Source Monitor: read-coverage audit and source-to-artifact influence (provenance) mapping"
---

<!--
  Installed INTO this project by the context-source-monitor skill's installer
  (`node <skill>/scripts/context_source_monitor.mjs install`). Do not
  hand-edit — re-run the installer to update; see the skill's
  references/installation.md for the version/drift-detection mechanics.
-->

Manage the Context Source Monitor: audit which workspace lines have actually been read, and build the
provenance map linking sources (converted intake/corpus fragments, or whatever this project's own `roles.txt`
calls `source:`) to the artifacts derived from them (memory, specs, docs, code — whatever `roles.txt` calls
`generated:`).

**Command arguments:** `$ARGUMENTS`

### Instructions for the AI assistant

Call the `context_source_monitor` tool (installed for this project by the context-source-monitor skill).
Only `action` is required.

| argument | applies to | meaning |
| :-- | :-- | :-- |
| `action` | all | `status`, `coverage`, `influence`, `reconcile`, `confirm`, `reject`, `pending`, `infer`, `resolve`, `explain`, `link`, `annotate`, `install`, `enable`, `disable`, `reset` |
| `scope` | coverage/status | limit to one directory |
| `sources` | influence/reconcile/infer | comma-separated roots treated as influencers |
| `targets` | influence/reconcile/infer | comma-separated roots treated as influenced |
| `detectors` | influence/reconcile | subset of `path-reference,entity-mention,content-overlap` |
| `minConfidence` | influence/reconcile | drop weak **hint** edges below this (never touches confirmed or needs-reconfirm) |
| `mapFile` | most actions | map to read/refresh (default `data/research/context-source-monitor/inf-map.json`, inside the current project) |
| `archiveFile` | most actions | retired history (default `inf-map-archive.json` beside the map) |
| `outFile` | coverage/influence/reconcile/infer | write here; a bare filename lands in `data/research/context-source-monitor/` |
| `sourceFile`, `sourceInterval` | confirm/reject/link, infer | the influencing side. Omit the interval to mean the whole file |
| `targetFile`, `targetInterval` | confirm/reject/link, infer | the influenced side. Omit the interval to mean the whole file |
| `confidence` | confirm/link | default 1 |
| `resolves` | confirm/link | comma-separated retired node ids this edge re-derives |
| `nodeId`, `into`, `note` | resolve | the retired record being answered, and what now carries it |
| `filePath` | explain/annotate | the target file |
| `description`, `blockName`, `blockDocumentation` | annotate | free-form documentation |
| `tools`, `force` | install | which tool integrations to (re)install (default: all supported); `force` overwrites local edits to installed files |

Map the user's arguments as follows.

1. **`enable` / `disable` / `reset`** — the corresponding action. On `enable`, state that reads must go
   through the built-in `read` tool and edits through `edit`/`write`: shell access (`cat`, `head`, `sed -i`,
   `echo >`) is still recorded, but only approximately, because exact line intervals are known only for the
   built-in tools. `reset` clears reads, writes and history (not the influence map).

2. **`status`** — tracking state, line coverage, file counts, unread intervals, writes, the current map's
   edge/node counts, how much sits in the archive, **and this project's installed-integration status**
   (up to date / update available / drifted — see `install` below).

3. **`coverage [path]`** — plus `outFile` when a path is given, `scope` when a directory is named. Present
   line/file coverage, each partially read file with its exact unread intervals **and the literal
   `read(...)` call that closes each one**, completely unread files, and which structural blocks remain unread.

4. **`influence [path]`** — builds from scratch, e.g.:
   `{ "action": "influence", "sources": "data/corpus", "targets": "memory,openspec" }`
   (adjust the roots to whatever this project's own source/generated directories actually are — check for a
   `data/research/context-source-monitor/roles.txt` first). Report node counts by scope, edge counts by
   state, and unresolved references. Edge direction is always **source → target**. Never point
   `sources`/`targets` at a raw, externally-mutable intake/drop folder — point at the durable, converted,
   committed form instead.

5. **`reconcile [path]`** — **use this for every run after the first.** Same arguments as `influence`.
   Report what actually happened from the result's report, not just the final edge count: `relocated`
   (text moved, identity and edges kept), `demoted` (a source file changed, its settled edges now need
   re-confirmation), `bounded` + `reparented` (a rewritten region replaced by a bounding span that inherited
   the old edges), `retired` (text gone, archived), `coalesced`, `needsReconfirm`, and `rescanReason`.

6. **`pending`** — the four review queues, in the order worth working: `needs-reconfirm` (already verified
   once, only needs re-checking), `retired` (text gone, needs re-deriving via `infer`), stale writes, stale
   reads. Answer them with `confirm` / `link` / `reject`.

7. **`infer`** — provenance by **content**, for what the scaffold structurally cannot see: paraphrase with
   no verbatim quote, and any work done before this tool existed (no recorded read to pair against the write).
   - `{ "action": "infer", "targets": "memory" }` → each target's unexplained regions plus candidate
     sources ranked by shared rare phrases and name mentions.
   - `{ "action": "infer", "sourceFile": "<path with archive records>" }` → the retired text plus every
     target it influenced, with those targets' **current** content, to re-derive where the influence went.

   It never writes an edge. Read both sides, then `confirm`/`link` (passing `resolves` when it settles a
   retired record). Direction comes from `roles.txt`, never from similarity.

8. **`confirm` / `link`** — identical operation; `link` is the name to use for an edge no detector could
   propose. Confidence 1 unless told otherwise. Omit an interval to mean the whole file.

9. **`reject`** — deletes that one edge outright, never tombstoned. If the exact pair is not found, the
   content has probably drifted: `reconcile` first.

10. **`resolve`** — mark a retired record as re-derived; it moves to the archive's `resolvedNodes` rather
    than being pruned.

11. **`explain <file>`** — which sources that file's content came from, by state, with intervals on both sides.

12. **`annotate`** — only annotate what you have actually read.

13. **`install`** — (re)install this project's OpenCode integration files from the skill bundle. Report
    what happened per file: `installed` (was missing), `updated` (bundle version was newer, no local edits
    detected), `unchanged` (already current), or `drifted` (installed file was hand-edited since last
    install — skipped; pass `force: true` to overwrite anyway). This is also what `status` checks
    read-only, and what to suggest running when `status` reports an update is available.

14. **`saturate`** — not an action; a procedure: run `coverage`, `read` every reported unread interval using
    the exact `offset`/`limit` given, repeat until 0 unread intervals remain.

### How to read an edge

| state | meaning |
| :-- | :-- |
| `hint` (0.3) | the scaffold found a literal path citation, an import, or verbatim phrase overlap. Uniform confidence on purpose: once a hint is not ground truth, *how* it was found stops mattering. **Unverified.** |
| `confirmed` (default 1) | a human or an LLM read both locations and settled it. The only settled state. |
| `needs-reconfirm` (≤0.2) | was `confirmed`, then one side's content changed underneath it. Carries `priorState`/`priorConfidence`. Capped so it can never pose as verified. |

A reference that looks path-shaped but resolves to no real file goes to `unresolvedReferences` — it never
becomes an edge. A resolution fanning out past 6 files produces **zero** hints, because it carries no
file-specific signal.

### Node scopes

- **file** (`f_…`, no interval) — identity is the path alone, so editing the file never re-identifies it;
  its settled edges get demoted instead. Citation *sources* are file-scope for exactly this reason.
- **span** (`s_…`, with interval) — identity is path + occurrence + content, so text that moves is
  relocated rather than invalidated. A region too thin to identify by content is widened, or falls back to
  file scope.

### Configuration files (per project)

- `data/research/context-source-monitor/ignored-paths.txt` — gitignore-syntax, influence-only. For files
  whose hints are *structurally* uninformative (manifests, lock files, generated indexes enumerate paths, so
  every path they list looks cited). Files whose hints are merely wrong should be `reject`ed individually.
- `data/research/context-source-monitor/roles.txt` — `source:` / `generated:` roots. Gives `infer` the
  direction that content similarity alone cannot provide.
- `data/research/context-source-monitor/integrations.json` — records which tool integrations are installed,
  at what skill version, and the content hash of each installed file (for update/drift detection). Managed
  by the installer; do not hand-edit.

### Equivalent CLI

Everything above is also a plain CLI, usable outside OpenCode (`<skill-dir>` = wherever the
`context-source-monitor` skill is installed, typically `~/.agents/skills/context-source-monitor`):

```
node <skill-dir>/scripts/context_source_monitor.mjs status
node <skill-dir>/scripts/context_source_monitor.mjs install
node <skill-dir>/scripts/context_source_monitor.mjs coverage --scope data/corpus --out coverage.md
node <skill-dir>/scripts/context_source_monitor.mjs influence --sources data/corpus --targets memory,openspec
node <skill-dir>/scripts/context_source_monitor.mjs reconcile --sources data/corpus --targets memory,openspec
node <skill-dir>/scripts/context_source_monitor.mjs pending
node <skill-dir>/scripts/context_source_monitor.mjs infer --targets memory --limit 5
node <skill-dir>/scripts/context_source_monitor.mjs confirm --source A --target "B:12-34" --resolves s_abc123
node <skill-dir>/scripts/context_source_monitor.mjs explain memory/some-file.md
```

State and artifacts live in `<project>/data/research/context-source-monitor/` and persist across sessions,
so coverage and provenance accumulate rather than resetting each time.

Full procedures (building, reconciling, interpreting a report, re-establishing provenance for existing
work, diagnosing noise, the install/update mechanism) and the full CLI/argument reference: load the
**`context-source-monitor`** skill (`skill({ name: "context-source-monitor" })`), or read its `SKILL.md` /
`references/cli-reference.md` / `references/installation.md` directly wherever it is installed.

### A live-session caveat

The plugin caches one engine per workspace for the life of the OpenCode process; it does **not** hot-reload
if the skill's `scripts/context_source_monitor/*.mjs` or `scripts/opencode-plugin.ts` changes on disk
mid-session. If this tool's own source was just edited and the live output looks stale (old
`schemaVersion`, missing field), fall back to the CLI (always a fresh process) and tell the user a session
restart is needed.
