# Context Source Monitor — CLI / tool reference

Full argument tables and worked examples for the `context_source_monitor` engine. Read `../SKILL.md`
first for the concepts (node identity, edge states, the review queues, `infer`); this file is the
exhaustive reference once you know what you are trying to do.

Two entry points, one engine (`../scripts/context_source_monitor/`):

- **CLI**: `node <skill-dir>/scripts/context_source_monitor.mjs <action> [flags]` — works in any
  project, zero setup, zero dependencies beyond Node itself. This is also how a project gets its OpenCode
  integration in the first place (`install`, below) — no chicken-and-egg problem, since the CLI needs no
  prior setup in the target project at all.
- **OpenCode tool** (`context_source_monitor`): same actions as named arguments, available in a project
  once its own `.opencode/plugins/context-source-monitor.ts` is installed (see "Installing into a project"
  below; mechanics in `installation.md`). This tool file is a thin loader that always delegates to this
  skill's own `scripts/`, so ordinary engine changes reach every project with this installed with zero
  action — `install`/`update` only need re-running when the loader file itself changes, which is rare.

`<skill-dir>` below means wherever you installed this skill, typically `~/.agents/skills/context-source-monitor`
(also reachable as `~/.claude/skills/context-source-monitor` or `~/.config/opencode/skills/context-source-monitor`
if those are the same physical location on your machine, per the Agent Skills discovery locations).

## Installing into a project

```
node <skill-dir>/scripts/context_source_monitor.mjs install
```
Run once, from inside the target project's root. Copies this skill's bundled OpenCode adapter files into
that project's own `.opencode/plugins/` and `.opencode/commands/`, and records what was installed (version
+ content hash per file) in `data/research/context-source-monitor/integrations.json`. Safe to re-run any
time — `init` and `update` are aliases of the exact same idempotent operation:

- Nothing installed yet → installs.
- Skill bundle changed since your last install → updates (only the files that actually changed).
- You hand-edited an installed file → **left alone**, reported as needing `--force` to overwrite. This is
  detected by content hash, not by a version number, so it survives repeated runs correctly (see
  `installation.md` for exactly why that distinction matters).
- Nothing changed → reports `unchanged`, writes nothing.

`status` includes a read-only version of the same check (`integrations:` section) — run it any time to see
whether an update is available or a file has drifted, without writing anything. Options: `--tools t1,t2`
(default: every supported tool — currently just `opencode`), `--force` (overwrite drifted files anyway).
Full mechanics, the manifest schema, and how to add a new tool integration: `installation.md`.

## Action → argument table

| argument | applies to | meaning |
| :-- | :-- | :-- |
| `action` | all | `status`, `coverage`, `influence`, `reconcile`, `confirm`, `reject`, `pending`, `infer`, `resolve`, `explain`, `link`, `annotate`, `install`, `enable`, `disable`, `reset` |
| `tools`, `force` | install | which tool integrations to (re)install (default: all); `force` overwrites locally-modified installed files |
| `scope` | coverage/status | limit to one directory |
| `sources` | influence/reconcile/infer | comma-separated roots treated as influencers |
| `targets` | influence/reconcile/infer | comma-separated roots treated as influenced |
| `detectors` | influence/reconcile | subset of `path-reference,entity-mention,content-overlap` |
| `minConfidence` | influence/reconcile | drop weak **hint** edges below this (never touches confirmed or needs-reconfirm) |
| `mapFile` | most actions | map to read/refresh (default `data/research/context-source-monitor/inf-map.json`, resolved inside the **target project's** workspace, not this skill folder) |
| `archiveFile` | most actions | retired history (default `inf-map-archive.json` beside the map) |
| `outFile` | coverage/influence/reconcile/infer | write here; a bare filename lands in `data/research/context-source-monitor/` |
| `sourceFile`, `sourceInterval` | confirm/reject/link, infer | the influencing side. Omit the interval to mean the whole file |
| `targetFile`, `targetInterval` | confirm/reject/link, infer | the influenced side. Omit the interval to mean the whole file |
| `confidence` | confirm/link | default 1 |
| `resolves` | confirm/link | comma-separated retired node ids this edge re-derives |
| `nodeId`, `into`, `note` | resolve | the retired record being answered, and what now carries it |
| `filePath` | explain/annotate | the target file |
| `description`, `blockName`, `blockDocumentation` | annotate | free-form documentation |

Map the user's request onto these:

1. **`enable` / `disable` / `reset`** — the corresponding action. On `enable`, state that reads must go
   through the built-in `read` tool and edits through `edit`/`write`: shell access (`cat`, `head`, `sed -i`,
   `echo >`) is still recorded, but only approximately, because exact line intervals are known only for the
   built-in tools. `reset` clears reads, writes and history (not the influence map).

2. **`status`** — tracking state, line coverage, file counts, unread intervals, writes, plus the current
   map's edge/node counts and how much sits in the archive.

3. **`coverage [path]`** — plus `outFile` when a path is given, `scope` when a directory is named. Present
   line/file coverage, each partially read file with its exact unread intervals **and the literal
   `read(...)` call that closes each one**, completely unread files, and which structural blocks remain unread.

4. **`influence [path]`** — builds from scratch. Typical shape for a project using this user's common
   layout (`data/corpus` = converted source material, `memory`/`openspec` = generated):
   `{ "action": "influence", "sources": "data/corpus", "targets": "memory,openspec" }`
   Report node counts by scope, edge counts by state, and unresolved references. Edge direction is always
   **source → target**. Never point `sources`/`targets` at a raw, externally-mutable intake/drop folder
   directly (see `../SKILL.md` § "Building from scratch") — point at the durable, committed, converted form.

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

13. **`saturate`** — not an action; a procedure: run `coverage`, `read` every reported unread interval using
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

### What else the map carries

- **`ignored`** — what the walk skipped and why: `hardIgnores`, the active root `.gitignore` verbatim, the
  influence-only `ignored-paths.txt` patterns, and the exact `{path,kind,reason,rule}` list for this run.
- **`fileHashes`** — sha256 per scanned file regardless of edge participation; this is what `reconcile`
  diffs against.
- **`reconcile`** — what the last pass changed (see § 5 above).
- **`stats.archived`** — counts only. The retired records themselves live in `inf-map-archive.json` and are
  never rendered to markdown.

### Configuration files (per project, under that project's `data/research/context-source-monitor/`)

- **`ignored-paths.txt`** — gitignore-syntax, influence-only. For files whose hints are *structurally*
  uninformative (manifests, lock files, generated indexes enumerate paths, so every path they list looks
  cited). Files whose hints are merely wrong should be `reject`ed individually.
- **`roles.txt`** — `source:` / `generated:` roots. Gives `infer` the direction that content similarity
  alone cannot provide. Format:
  ```
  source: data/corpus
  generated: memory
  generated: openspec
  ```

## Equivalent CLI (paths shown relative to a project root; `<skill-dir>` is where you installed this skill)

```
node <skill-dir>/scripts/context_source_monitor.mjs install
node <skill-dir>/scripts/context_source_monitor.mjs status
node <skill-dir>/scripts/context_source_monitor.mjs coverage --scope data/corpus --out coverage.md
node <skill-dir>/scripts/context_source_monitor.mjs influence --sources data/corpus --targets memory,openspec
node <skill-dir>/scripts/context_source_monitor.mjs reconcile --sources data/corpus --targets memory,openspec
node <skill-dir>/scripts/context_source_monitor.mjs pending
node <skill-dir>/scripts/context_source_monitor.mjs infer --targets memory --limit 5
node <skill-dir>/scripts/context_source_monitor.mjs infer --source memory/some-file.md
node <skill-dir>/scripts/context_source_monitor.mjs confirm --source A --target "B:12-34" --resolves s_abc123
node <skill-dir>/scripts/context_source_monitor.mjs explain memory/some-file.md
```

Run these **from the target project's root** (the CLI defaults `--workspace` to `process.cwd()`), or pass
`--workspace /path/to/project` explicitly from anywhere.

State and artifacts land in `<project>/data/research/context-source-monitor/` and persist across sessions,
so coverage and provenance accumulate rather than resetting each time.

## OpenCode integration

`install` (see "Installing into a project" above) writes two files **into the target project itself** —
never into `~/.config/opencode/`, deliberately: a global install would mean every OpenCode session in every
project on the machine gets this tool whether that project wants it or not:

- `.opencode/plugins/context-source-monitor.ts` — a thin loader (no engine logic) that dynamically
  resolves this skill's own root (`CONTEXT_SOURCE_MONITOR_HOME` env var if set, else
  `~/.agents/skills/context-source-monitor`) and delegates to `scripts/opencode-plugin.ts` there. Because
  it only delegates, ordinary engine changes reach this project automatically the next time OpenCode starts
  — no reinstall needed. Reinstall/update is only needed when the *loader file itself* changes.
- `.opencode/commands/context-source-monitor.md` — lets a user type `/context-source-monitor`.

Both are meant to be **committed** with the rest of the project (same as OpenSpec's own generated
`.opencode/commands/opsx-*.md`), and re-copied by `install`/`update` — never hand-edited (hand edits are
detected by content hash and preserved, not clobbered, but that also means the file stops receiving updates
until you resolve the conflict; see `installation.md`).

One-time dependency install for the *skill itself* (only needed to run the OpenCode plugin or its tests
from inside the skill's own directory — a project that only has the installed loader copy needs nothing
extra):
```
cd <skill-dir> && npm install
```
This materializes `node_modules/@opencode-ai/plugin`, declared in this skill's own `package.json`.

If you need to point an installed loader at a *different* copy of this skill (e.g. testing a local change
before it lands in the canonical install), set, before starting OpenCode:
```
export CONTEXT_SOURCE_MONITOR_HOME=/path/to/your/context-source-monitor
```

### A live-session caveat

The plugin caches one engine per workspace for the life of the OpenCode process; it does **not** hot-reload
if this skill's `scripts/context_source_monitor/*.mjs` or `scripts/opencode-plugin.ts` changes on disk
mid-session. If you edited this tool's own source and the live output looks stale (old `schemaVersion`,
missing field), fall back to the CLI (always a fresh process) and tell the user a session restart is needed.
