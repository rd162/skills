# Development history

This is the changelog and design-rationale record for **this tool's own engine**, not a project's
content. Read it only if you are modifying `scripts/context_source_monitor/`, deciding whether a bug is
new or already-known, or wondering why an API shape looks the way it does. It has no bearing on how to
*use* the tool against a project — that is `../SKILL.md` and `cli-reference.md`.

Provenance: this tool was designed and built end-to-end inside a client engagement repository (as an
internal productivity tool for that engagement, unrelated to the engagement's own subject matter), then
extracted into this standalone, reusable global skill once it had proven itself. The extraction moved the
engine, CLI, OpenCode plugin, and tests verbatim (all 165 tests passed before and after the move); it did
not change behavior. The version numbers, dates, and bug narratives below are carried over from that
project's own commit history and decision log so the reasoning is not lost, with anything specific to that
engagement's subject matter left behind.

## v1 — coverage tracking + code-structure annotation (initial)

The tool started as a session-coverage auditor, not an influence mapper: an OpenCode plugin + CLI engine
that tracks which lines of a workspace an agent has actually read, records unread intervals, and lets an
agent annotate file/block structure it has read and understood. Read/write tool calls were hooked via
`tool.execute.before` / `tool.execute.after`; shell (`bash`) access was parsed heuristically as a fallback
since exact line intervals are only knowable for the built-in `read`/`edit`/`write` tools.

## v2.0.0 → v2.1.0 — influence mapping added, then modularized and made incremental

- **Influence mapping added.** A `--inf-map`/`--influence-map` action built a source→target provenance
  graph (`inf-map.json`) on top of the same engine, plus write-influence-flow tracking through edits.
- **Modularized.** The original monolithic script was split into the current module set —
  `engine.mjs` (orchestration + coverage + reconcile), `graph.mjs` (node/edge model), `detectors.mjs`
  (the mechanical scaffold), `overlap.mjs` (shingle-based content overlap), `resolve.mjs` (reference →
  real-file resolution), `ignore.mjs` (`.gitignore`-aware walking), `structure.mjs` (block extraction),
  `terminal.mjs` (shell-command read/write parsing), `text.mjs` (line/interval primitives), `report.mjs`
  (markdown rendering). The test suite was rewritten around interval algebra, coverage, and overlap as
  first-class invariants rather than end-to-end behavior only.
- **Incremental `reconcile` added (v2.1.0).** Sha256 content hashes (whole-file and per-block) let the
  engine detect exactly what changed and re-detect edges only for dirty targets and the sources
  transitively affected through content-overlap, instead of rebuilding from scratch every time. The active
  `.gitignore` rules and the exact ignored-path list for a run started being captured in the map itself, so
  a reader never has to re-derive "what was skipped and why."
  - **Bug found while building this, not by a test:** `dropOrphanNodes()` dropped a file's own node
    whenever all of its edges had landed on a child block, which would have made every such file look "new"
    on every future reconcile. Fixed by keeping a file node as a hash anchor whenever a same-path block
    survives, and by tracking `fileHashes` for the whole scanned universe regardless of node survival.
  - **Bug found the same way:** the shell-redirect extractor's `(\d?)(>>|>)` regex had no guard against
    `=`, so a JS arrow function (`=>`) inside an inline `node -e '...'` debug one-liner was misread as an
    output redirect, fabricating phantom writes. Fixed with an `(?<!=)...(?!=)` lookaround.
  - Both were caught by dogfooding: reconciling a just-built map against itself with nothing changed should
    report zero changes, and didn't — which is what surfaced both root causes instead of shipping them
    silently.

## v3.0.0 — lean content-addressing (superseded same day)

Removed `detector`/`evidence`/`relation` bookkeeping from edges (an edge became just
`{from, to, state, confidence}`), collapsed a three-way staleness taxonomy
(`citationDirty`/`overlapDirty`/`transitivelyAffected`) into one rule, dropped generic directory fan-out
entirely instead of down-weighting it (a bare `data/corpus/`-style directory mention had been ~97% of raw
path-reference edges and carried no file-specific signal), added `confirm`/`reject`/`link`/`pending` as the
real human-judgment layer, and introduced the influence-only `ignored-paths.txt`.

**This version's core mechanic was rejected on review, same day:** it identified nodes by
`hash(path, content)`, meaning a changed file lost and had to re-derive its connections from scratch. For
work that predates the tool (no recorded read ever paired with the write that produced it), re-deriving a
lost connection is not just expensive — the read that would justify it never happened and cannot be
replayed. **Stale nodes must never be removed by identity change alone.**

## v4.0.0 — two node scopes + retirement (the correction, and how it was checked)

The fix, still current:

- **`file`-scope nodes**: `id = hash(path)`. Identity is independent of content, so a source file changing
  — even a one-character typo in a cited document — demotes its settled edges to `needs-reconfirm` instead
  of destroying them. Citation *sources* are always file-scope for exactly this reason: a citation names a
  whole document, and the document's identity should not depend on today's exact bytes.
- **`span`-scope nodes**: `id = hash(path, occurrence, content)`, with the content itself stored so the id
  stays independently verifiable. Text that **moves** (line drift from an unrelated edit elsewhere) is
  **relocated** — same id, corrected interval, edges kept. Text that is genuinely **gone** is **retired**
  into a separate `inf-map-archive.json` (`retiredNodes` → `resolvedNodes` once re-investigated); the live
  map stays clean and is never polluted with historical noise, and the archive is deliberately never
  rendered to markdown (read it through `pending`/`infer` only, so a stale claim can never be mistaken for
  a current one).
- **Bounding-span replacement**: when a rewritten region replaces a retired span, that region's edges get
  **re-parented** onto it in both directions as `needs-reconfirm`, so an edge whose *two* sides changed at
  once survives as a lead instead of silently vanishing.
- **`infer` added**: provenance by CONTENT for what no mechanical detector can see — heavy paraphrase with
  no verbatim quote, and any work that predates the tool entirely (target-driven candidate ranking, and
  retired-source re-investigation that returns old text next to a target's current content). Direction
  comes from a `roles.txt` prior (`source:`/`generated:` roots), never from similarity — shared wording
  proves two files are related, never which one came first.

**Design was audited before implementation**, at the reviewer's explicit insistence ("audit for critical
bugs before writing code"): 15 were found and fixed pre-commit. The most consequential — hashing
`(path, content)` alone (without an occurrence index) collapses every identical piece of text in a file
into ONE node, and detectors routinely emit single-line targets, so blank lines, `---` rules, and repeated
headings would have silently merged unrelated edges onto one node. Fixed with an occurrence index plus a
`MIN_SPAN_SIGNAL` floor that widens or demotes indistinctive spans instead of hashing them as-is.

**Two more reconcile-reliability bugs surfaced by dogfooding v4 on a real, populated repo — not by unit
tests:**

1. Restricting the scaffold's rescan to files that changed is wrong in one direction: when a **source**
   changes, unchanged **targets** still need rescanning, because a target can gain or lose a relationship
   purely because the source moved underneath it — and a source that was deleted and then restored would
   otherwise never be re-mapped at all. Fixed by rescanning every target whenever any source changed,
   surfaced in the report as `rescanReason`.
2. `unresolvedReferences` was being *appended to* instead of *replaced for* rescanned files, so the count
   silently doubled on every reconcile that triggered a rescan (observed live: 61 → 123) while looking like
   new findings. Fixed by pruning entries for files about to be rescanned before re-adding them.

Verification for both was done on live data with a controlled before/after, not just re-running the suite:
a controlled source edit produced `demoted-files 1, needs-reconfirm 1` with the file node intact and
nothing archived; a controlled target rewrite produced `relocated 19, bounded 1, re-parented 11, retired 6,
coalesced 5` with a separate archive whose new records all carried their old text, zero ids simultaneously
live-and-retired, and zero dangling edges.

**Known, accepted (not fixed) detector-precision gaps found the same way** — running the built tool
against a large, real, populated repository rather than synthetic test fixtures — are documented as
current, load-bearing limitations in `../SKILL.md` § "Known limitations": bare multi-word directory
citations don't resolve, and heavy paraphrase without a verbatim quote or exact title scores near zero on
the mechanical scaffold (which is precisely why `infer` exists). Treat both as "known", not as "someone
should file a bug."

## v4.x — file/span scopes generalized, pending queues, `roles.txt`

The v4.0.0 design landed with pending-review queues (`needs-reconfirm` / `retired` / stale-writes /
stale-reads, see `../SKILL.md` § "The four review queues") and the `roles.txt` source/generated
configuration file as first-class parts of the workflow, rounding out the tool described in the current
`../SKILL.md` and `cli-reference.md`. No further engine redesigns have happened since; changes from here
are additive.

## Extraction to a global skill

The tool, its OpenCode plugin adapter, and its 165-check test suite were relocated verbatim out of the
originating project into this skill (engine/CLI/tests byte-identical apart from import-path fixups for the
new directory layout; only doc comments that used that project's own file names as illustrative examples
were genericized). The originating project kept only what it needs to *use* the tool going forward — its
own `roles.txt`/`ignored-paths.txt` configuration and the resulting `inf-map.json`/`.md` for its own
content — not this history.

**One real bug surfaced by the move itself, not a test:** the CLI's "am I the main module, or just
imported as a library" self-check compared `path.resolve(process.argv[1])` against
`path.resolve(fileURLToPath(import.meta.url))`. Inside the originating project this was always invoked via
a real, non-symlinked path, so it always matched. A global skill install is commonly reached through a
symlink (e.g. `~/.claude/skills` / `~/.agents/skills/context-source-monitor` pointing at a real directory
elsewhere), and Node resolves the *entry module's* symlink to its real path before setting
`import.meta.url` without doing the same for `process.argv[1]` — so the two sides silently stopped
matching, and `node ~/.agents/skills/context-source-monitor/scripts/context_source_monitor.mjs status`
exited 0 with **no output at all**, while the identical invocation via the real, non-symlinked path worked
fine. Fixed by comparing `fs.realpathSync()` of both sides (falling back to `path.resolve` if realpath
fails, e.g. a not-yet-existing path). Caught by actually running the documented global-install invocation
against a scratch workspace before trusting the docs, not by re-running the existing suite (which never
exercised a symlinked entry point). If you add new self-referential entry-point checks to this CLI, test
them through a symlink, not just the real path — that gap is exactly how this one shipped invisibly for the
tool's entire life inside the originating project.

## Redesign: per-project self-install instead of a global OpenCode plugin

The first cut of the extraction (above) installed the OpenCode adapter **globally**
(`~/.config/opencode/plugins/`), reasoning that one install should cover every project. Reconsidered
immediately, before any real use: a global plugin has one shared on/off switch for every OpenCode session
on the machine, in every project, with no per-project opt-out — wrong for a tool whose whole point is
auditing one specific project's own content. It also does not generalize: a future Claude Code (or other
tool) integration would need its own global install path, duplicating the problem per tool instead of
solving it once.

Corrected design: the tool-specific adapter files live in the skill's own bundle
(`references/integrations/<tool>/...`) and get **copied into the target project's own tool-config
directory** (e.g. `<project>/.opencode/plugins/`) by a new `install` command (aliased `init`/`update`),
the same way OpenSpec's own CLI generates `.opencode/commands/opsx-*.md` per project rather than globally.
The copied file stays a thin loader (dynamically resolves and delegates to this skill's `scripts/`, exactly
like the reverted global shim did), so the *engine* still lives once — only the tiny loader is duplicated
per project, and only the loader itself (rarely) needs re-installing.

This needed a real update mechanism, not just a one-time copy: `scripts/context_source_monitor/install.mjs`
adds a per-project manifest (`data/research/context-source-monitor/integrations.json`) recording, per
installed file, the content hash of what was actually written. `metadata.version` in `SKILL.md`'s
frontmatter is the single source of truth for "how new is the bundle"; content hash (not the version
number) is what actually decides whether a file needs installing, updating, or leaving alone — a file
whose on-disk hash no longer matches what the manifest recorded as "what we installed" was edited by
someone since, and is never silently overwritten without `force: true`. See `../references/installation.md`
for the full state machine and **why the drift/skip path must never adopt the hand-edited hash as the new
baseline** — an early implementation did exactly that, and a targeted regression test
(`tests/test_install.mjs`, "drift keeps being detected on every subsequent check/install") now guards it
after it was caught by hand during a scratch-workspace smoke test, not by the first pass of unit tests.

`TOOL_REGISTRY` in `install.mjs` is deliberately the only tool-specific part of the whole mechanism, so
adding Claude Code or another tool later is one bundle directory plus one registry entry — see
`installation.md` § "Adding support for a new tool."
