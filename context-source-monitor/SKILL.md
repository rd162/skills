---
name: context-source-monitor
description: Build and keep current a source-to-artifact influence map (inf-map.json) that links source/intake material (e.g. data/corpus) to the generated files it shaped (e.g. memory, openspec, docs), plus a read/write coverage audit for the current session, using the context_source_monitor tool/CLI. Use when the user asks to "build the influence map", "start monitoring"/"stop monitoring", "enable"/"disable tracking", "reset tracking state", "which source document influenced which file", "what corresponds to what", "is any source document unprocessed", "refresh/reconcile the inf-map", "update the influence map after an edit", "re-establish provenance for this repo", "what have I not read yet"/"show read coverage", "install/update the context source monitor integration", "check pending reviews"/"what needs re-confirming", or when source/generated content has changed and the persisted map may be stale.
compatibility: opencode
metadata:
  version: "1.0.1"
---

Build, read, and keep current the source-to-artifact **influence map** produced by the
`context_source_monitor` tool (OpenCode plugin action) / `node context_source_monitor.mjs` (CLI) — same
engine, two entry points, usable in any project.

## This is a global skill that installs itself per-project

The **engine lives once**, globally, wherever this skill is installed. Each AI coding tool (OpenCode today;
Claude Code and others later — see `compatibility` above and `references/installation.md`) needs a small
adapter physically present *inside* a given project before that tool will load it, so the skill **installs
that adapter into the project on first use**, and updates it later if the skill's bundle changes. Nothing
tool-specific ever goes into a global config directory (`~/.config/opencode/`, `~/.claude/`, …) — a global
install would mean every session in every project gets it whether that project wants it or not, with no
way to opt out per project. A per-project install is opt-in, travels with the project's own repo (commit
the installed files, same as generated-but-committed config from other tools in this ecosystem — e.g. how
OpenSpec's CLI commits `.opencode/commands/opsx-*.md`), and each project can independently defer an update.

- **Engine + CLI** (this skill, never copied anywhere): `scripts/context_source_monitor.mjs` +
  `scripts/context_source_monitor/`. Pure Node, zero dependencies, workspace-relative (it operates on
  whatever directory you run it from, or `--workspace DIR`). Invoke it from any project by absolute path:
  ```
  node ~/.agents/skills/context-source-monitor/scripts/context_source_monitor.mjs status
  node ~/.agents/skills/context-source-monitor/scripts/context_source_monitor.mjs install
  ```
  (adjust the path to wherever you actually installed this skill folder — see `references/cli-reference.md`
  for every command).
- **Per-tool integration bundle** (this skill): `references/integrations/<tool>/...` — e.g.
  `references/integrations/opencode/plugins/context-source-monitor.ts` and `.../commands/context-source-monitor.md`.
  These are templates, not live code; `install` copies them into the *target project's* own tool-config
  directory (e.g. `<project>/.opencode/plugins/`). Only OpenCode is implemented so far; adding another tool
  later means adding one more `references/integrations/<tool>/` bundle plus one registry entry in
  `scripts/context_source_monitor/install.mjs` — see `references/installation.md`.
- **`install` (also aliased `init`/`update`)**: the CLI command (and mirrored OpenCode tool action) that
  performs the copy. First run in a project = fresh install. Later runs after the skill's own version bumps
  (`metadata.version` above) = update. It tells "safe to update" from "you hand-edited the installed file"
  by **content hash**, not by trusting a version number alone — a locally modified file is never silently
  overwritten (`skippedDrift` in the report; pass `force` to overwrite anyway). Full mechanics:
  `references/installation.md`.
- **Per-project artifacts** (created by the tool, not shipped by the skill): `data/research/context-source-monitor/`
  inside *whatever repo you run it against* — `inf-map.json` (live map), `inf-map-archive.json` (retired
  history), `inf-map.md` (human rendering), `state.json` (coverage/session state), `ignored-paths.txt`,
  `roles.txt`, and `integrations.json` (which tool adapters are installed, at what skill version, with what
  content hash — what `install`/`update` reads and writes). These belong to that project, are committed
  with it, and are what make coverage and provenance accumulate across sessions instead of resetting each
  time. Nothing here is specific to this skill's own code.
- **This skill's own build history** (how *this tool* got designed — not project decisions): `references/development-history.md`.
  Read it only if you are modifying the engine itself; it is irrelevant to using the tool on a project's content.

## The one thing to understand first

**The tool does not know what influenced what. It narrows the search and remembers your answers.**

The scaffold is mechanical: it finds literal path citations, imports, and verbatim phrase overlap. That
is a *starting guess* at uniform low confidence (0.3), explicitly labelled `hint`. It cannot see
paraphrase, and it cannot see anything written before the tool existed. Your job is to read both sides
and settle it — `confirm` or `reject`. An edge only means something once it says `confirmed`.

Never build a competing "correspondence" answer by grepping and summarizing files yourself and present
that as the map. Drive the tool, then narrate its edges.

## Node identity: why some nodes have line ranges and some do not

| scope | id | when | staleness behaviour |
| :-- | :-- | :-- | :-- |
| `file` | `f_<hash(path)>` | a whole cited document | content edits **never** re-identify it; its settled edges get demoted to `needs-reconfirm` and the node lives on |
| `span` | `s_<hash(path, occurrence, content)>` | a distinctive region | text that **moved** is relocated (interval rewritten, edges kept); text that is **gone** retires into the archive |

Consequences worth knowing before you interpret anything:

- A source file being edited is **cheap**: one demotion pass, nothing lost. That is deliberate — file
  identity is path-only precisely so a typo in a source document cannot mass-archive its edges.
- `occurrence` is what keeps two identical passages in one file from collapsing into one node, and it is
  why identity survives line drift (insertions elsewhere shift the interval, not the id).
- A span always carries enough non-whitespace to be findable by content. A region too thin to identify
  (blank line, `---`, a lone fence) is **widened**, or represented at file scope instead. So a citation's
  target may legitimately come back as a whole-file node.

## Nothing is ever deleted

A location whose text is gone is **retired**, not dropped: it moves to `inf-map-archive.json` with the
edges it had and the targets it influenced. That record is the lead you need to re-establish provenance —
deleting it to keep the map tidy destroys the only remaining copy of the answer. Retired records leave the
queue only by being **resolved** (you re-derived where that influence went), and even then they move to the
archive's `resolvedNodes`, never out of the file.

The live map stays clean of retired records. The archive is never rendered to markdown — read it through
`pending` and `infer`.

The one deliberate exception: a retired record with **zero edges and zero history** (pure orphan
housekeeping — see `dropOrphanNodes`) carries no provenance lead at all. It is safe to prune by hand if it
turns out to embed content you specifically do not want persisted in a project's map (e.g. this skill's own
build notes accidentally captured as a span before you added it to `ignored-paths.txt`) — but confirm
`edges: []` and `history: []` first; anything else is a real lead, not noise.

## Building from scratch

1. **Never point `sources`/`targets` at a raw intake/drop folder directly** if your project has one (e.g. a
   symlink into a live-synced OneDrive/SharePoint/Drive folder, or anything gitignored and externally
   mutable). Point at the **durable, committed, converted form** instead (this user's projects call it
   `data/corpus/`) — the tool needs stable content to hash and diff, and a live external folder can change
   or vanish outside any session. If a project also round-trips its own generated deliverables back through
   that same drop folder (e.g. publishing specs as `.docx` for a client), exclude those explicitly — citing
   your own output as if it were external intake corrupts provenance (a file would appear to derive from
   outside material when it actually derives from itself).
2. `roles.txt` (if present in the project's `data/research/context-source-monitor/`) declares
   `source: <dir>` and `generated: <dir>|<dir>`, so `infer` needs no arguments. `influence`/`reconcile`
   still want `--sources`/`--targets` explicitly.
3. Build (adjust roots to the project's actual layout — `data/corpus` → `memory,openspec` is this user's
   common convention, not a requirement):
   ```
   { "action": "influence", "sources": "data/corpus", "targets": "memory,openspec" }
   ```
   ```
   node ~/.agents/skills/context-source-monitor/scripts/context_source_monitor.mjs influence \
     --sources data/corpus --targets memory,openspec \
     --md data/research/context-source-monitor/inf-map.md
   ```
4. Read the summary: `nodes` (by scope), `edges` (by state), `unresolved`. Then `explain --filePath <target>`
   for one file's sources. Node/edge counts vary entirely by repo size and citation density — there is no
   universal "healthy" baseline; run `status` once to establish this project's own.

## Keeping it current: `reconcile`

Use `reconcile` for every run after the first. It degrades to a fresh build when there is no map yet.

```
node ~/.agents/skills/context-source-monitor/scripts/context_source_monitor.mjs reconcile \
  --sources data/corpus --targets memory,openspec
```

What it does, in order — each step exists because the previous one cannot cover it:

1. **Deleted files** → their nodes retire as `file-deleted`.
2. **Changed files** are found by whole-file hash. Unchanged files are not examined at all.
3. Per changed file: a **file node** keeps its identity, updates its hash, and has its settled edges
   demoted. A **span** is verified at its own interval; if its text moved, it is **relocated**; only if the
   text is genuinely gone is it stale.
4. Stale spans are **clustered** into the bounding region that replaced them, and their edges are
   **re-parented** onto that replacement as `needs-reconfirm` — in both directions, so an edge whose two
   sides changed at once survives instead of vanishing. Then they retire.
5. The **scaffold re-runs**. If any *source* changed, every target is rescanned — a target that did not
   change can still gain or lose a relationship because the source moved underneath it, and a source that
   was deleted and restored would otherwise never be re-mapped.
6. **Coalescing** drops a fresh hint that merely restates an inherited `needs-reconfirm` edge, so one
   region never carries two rival descriptions of the same influence.

Report fields worth quoting to the user: `relocated`, `demoted`, `bounded`, `reparented`, `retired`,
`coalesced`, `needsReconfirm`, `rescanReason`. `orphaned` is housekeeping — edgeless nodes swept to the
archive; it deliberately does not make `unchanged` false.

**Fall back to a fresh `influence` build when** you changed the roots themselves, or changed detector
logic/weights (reconcile compares content, so it cannot tell "the rules changed" from "nothing changed"),
or the map's schema major version is older than the engine's (it refuses and rebuilds for you anyway).

## The four review queues (`pending`)

Work them in this order — each one resolved shrinks the next:

1. **needs-reconfirm** — was `confirmed`, then one side's content changed. Cheapest: someone already
   verified this relationship once. Re-read both sides, `confirm` again, or `reject` if the change broke it.
   Capped at confidence 0.2 so it can never pose as verified; `priorState`/`priorConfidence` say what it was.
2. **retired** — text is gone. Use `infer` with the path as `sourceFile` to get the old text plus every
   target it influenced, decide where that influence lives now, then `confirm`/`link` and pass `resolves`
   with the retired node id.
3. **stale writes** — this session wrote here and no confirmed edge explains it. Answer from your own
   recollection with `link`.
4. **stale reads** — this session read here and nothing used it. Process writes first; a read explained
   while accounting for a write needs no separate entry.

## `infer`: provenance by content

This is the pass that makes an already-built repo mappable, and the answer to "there are no writes after
reads because the work already happened."

- **Target-driven** (`targetFile`, or nothing for repo-wide): returns each target's unexplained regions
  and candidate sources ranked by shared rare phrases and by name mentions.
  ```
  node ~/.agents/skills/context-source-monitor/scripts/context_source_monitor.mjs infer --targets memory --limit 5
  ```
- **Retired-source re-investigation** (`sourceFile` that has archive records): returns the retired text,
  and every target it used to influence **with that target's current content**, so you can compare old
  against new and re-derive.

`infer` never writes an edge. It assembles evidence; you decide. When ranking is empty but you know a page
is derived from something, `link` it anyway — an unmeasurable relationship is still real.

**Reasoning discipline for `infer`:** direction comes from `roles.txt`, not from similarity (shared wording
says two files are related, never which came first). Beyond the ranking, use what the scaffold structurally
cannot: cross-referenced identifiers (ticket ids, section numbers, requirement ids), terminology that
only one source introduces, and structural echoes (same ordering of the same concepts). Read the actual
intervals on both sides before confirming — a high phrase count between two *dual conversions of the same
document* (e.g. a `_docling.md` and a `_markitdown.md` of one source, if your ingestion pipeline produces
both) is an artifact of the pipeline, not evidence.

## `ignored-paths.txt`: suppressing structural noise

Influence-only; a listed path is still walked and still counted for coverage. Populate it when a file's
hints are **structurally uninformative** — it would hint at the same thing regardless of content. Pipeline
manifests, lock files and generated indexes enumerate paths, so every path they list looks cited.

How to find them: run `influence`, then look for one file responsible for a disproportionate share of the
hint count, or one source that hints into nearly every target. Check whether the "citation" is the file
merely *listing* the path. If yes, add it here. If instead the hints are simply **wrong**, `reject` them
individually — this list is for hints that could never be right, not for hints that happen to be bad.

Always list the map's own artifact directory (`data/research/context-source-monitor/`, or wherever you
point `--map`) — mapping the map is circular — and any pipeline manifest that enumerates every converted
path by construction (e.g. `data/corpus/.manifest.json`).

## Known limitations (verified — check before re-litigating)

- **Bare directory citations of a multi-word folder name don't resolve.** A citation like `` `data/corpus/Client
  Kickoff Notes/` `` (no extension, several words) fails `isPathShaped()`'s prose-vs-path heuristic and
  produces neither an edge nor an `unresolvedReferences` entry — silently never attempted. A *file* path
  with an extension resolves fine regardless of spaces. Grep for the exact title before concluding
  "unprocessed", or use `infer`.
- **Generic directory fan-out is dropped entirely.** A resolution reaching more than
  `GENERIC_FANOUT_THRESHOLD` (6) files carries no file-specific signal, so it produces **zero** hints
  rather than a low-confidence edge to every sibling. A bare `data/corpus/` mention therefore contributes
  nothing — by design; in the repo this tool was first built against, that pattern was ~97% of raw
  path-reference edges.
- **Heavy paraphrase scores near zero on the scaffold.** Overlap needs shared 8-token shingles and mentions
  need the literal title. This is exactly what `infer` exists for; do not read a zero as "unused."
- **Repeated identical text can relocate to the wrong twin.** When several verbatim copies of a span exist
  in one file and one is deleted, the occurrence index shifts and the survivor nearest the old position is
  chosen. Reported as `ambiguous` in the reconcile report's `relocated` entries.
- **Bounding intervals after a rewrite are best-effort.** Old line numbers are mapped into new content
  approximately (widened by recorded write intervals when a session happens to have them). That is why
  re-parented edges are `needs-reconfirm`: the interval is a place to look, not a verified claim.
- **The live OpenCode plugin can run stale code.** The engine module is loaded once per OpenCode process;
  editing this skill's `scripts/` does not hot-reload a running session (confirmed: the tool kept returning
  a pre-edit `schemaVersion`). If you just changed this tool's own source and its output looks stale, use
  the CLI (always a fresh process) and tell the user a restart is needed.

## Quick reference

```
install [--tools t1,t2] [--force]  install/update this project's tool integrations from the skill bundle
                                    (aliases: init, update — all the same idempotent operation)
enable | disable | reset          toggle tracking / clear state
status                            coverage + influence summary + installed-integration status
coverage [--scope DIR]            read-coverage report with the exact read(...) calls to close gaps
influence --sources A --targets B build from scratch (hints only)
reconcile --sources A --targets B refresh in place (relocate / demote / retire / re-scaffold / coalesce)
pending                           the four review queues
infer [--target F | --source F]   provenance by content; re-investigate retired history
confirm --source A[:S-E] --target B[:S-E] [--resolves ID]   settle it (confidence 1)
reject  --source A[:S-E] --target B[:S-E]                   delete that edge outright
link                              alias of confirm, for edges no detector could find
resolve --node ID [--into ID,ID]  mark a retired record re-derived
explain <path>                    provenance of one file
```
Full argument tables and worked examples: `references/cli-reference.md`. The install/update/drift-detection
mechanism and how to add support for a new tool: `references/installation.md`.

---

## Reconcile in the agent that did the work, as its final step

**Default rule: whichever agent read the sources and wrote the outputs reconciles the map before it
finishes.** Not a later session, not a dedicated reconciliation pass, not the user.

This is not a stylistic preference. Provenance is a claim about *derivation* — this document says
what it says because that source said something — and the agent that just did the work knows that
directly. Every later reader, model or human, is reduced to comparing content and guessing at
direction, which is exactly what the detectors do and exactly what they cannot do well. Content
comparison recovers resemblance; only the writer knows causation. **Deferring reconciliation converts
knowledge into inference, permanently.**

Three rules follow, and they matter more than the general principle:

1. **Confirm only what you wrote yourself.** An edge into a file authored in an earlier session is
   not yours to confirm however plausible it looks. Confirming it records inference at the confidence
   reserved for judgment, which is worse than leaving an honest hint. Leave it.
2. **State how you know, in the note.** "Authored in this session from this guide, all nine page
   images included" is provenance. "The wording is similar" is a guess wearing provenance's clothes,
   and the note is the only place that distinction survives.
3. **Scope the scaffold and protect existing judgments.** Build to a separate map file when a
   populated map exists — rebuilding from scratch discards other sessions' work.

### When no detector can propose the edge — use `link`

Some deliverables are required to be **self-contained**: they may not carry a path into the
repository that produced them, and they cite a source-register identifier plus a section title
instead. For those, the citation mechanism cannot fire — there is no path in the text to match, and
there never will be.

Measured on a real pair of sibling documents: the one whose sources were two intake documents drew
**zero** proposed edges, while its sibling drew twelve — and those twelve came from content overlap on
shared command strings, not from any citation. The zero is not a coverage gap to close later. It is
structural, and `link` is the only instrument that reaches it.

So the split is:

| Artifact | Cites | Detector proposes? | Provenance recorded by |
|---|---|---|---|
| Working notes, research reports, docs | repository-relative paths | **Yes** — settles automatically under tracking | nothing; spot-check the observed section |
| Self-contained deliverable | register id + locator | **No, structurally** | `link`, by the authoring agent, at authoring time |

**If tracking was off for part of the session, say so and `link` the edges anyway.** Disabling
tracking is legitimate — during a noisy refactor of the tooling itself, for instance — but it silently
costs the observed provenance of every write in that window, and no tool recovers it afterwards.
`link` is the repair, and only the agent that was there can perform it.
