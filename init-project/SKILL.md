---
name: init-project
description: >-
  Initialize a new project, or adopt/convert an existing one, to the cross-platform agent standard with
  AGENTS.md as the single source of truth (specs/, memory/, data/, .agents/skills/, scripts/). New
  projects get the scaffolded layout plus an AGENTS.md whose Tool Onboarding Contract lets any agent tool
  (Claude Code, Copilot, Cursor, Codex, Gemini, Kiro) self-configure by reference, not duplication.
  Existing tool projects are adopted additively (bridge files, never move the tool's dirs); when
  explicitly asked to convert/migrate a CUSTOM non-tool layout, physically rename/move its dirs into the
  canonical ones. Use when the user says initialize / scaffold / standardize / agentize / onboard a
  project, set up AGENTS.md, bootstrap agent structure, or convert / migrate / restructure into the
  AGENTS.md layout.
metadata:
  author: rd162@hotmail.com
  tags: project-init, agents-md, cross-platform, scaffolding, onboarding, single-source-of-truth, specs, memory
tier: T3
source_class: llm
last_updated: 2026-06-25
---

# Init Project — cross-platform agent standard initializer

Make any repo work with **every** agent tool from one source of truth. `AGENTS.md` is the
single source of truth (SSOT); every other tool references it, never duplicates it.

## When to use

- Setting up a new repo for AI agents.
- Adopting an existing repo (any tool — Claude Code / Cursor / Copilot / Codex / Gemini / Kiro / Windsurf) to the standard.
- Converting / migrating a custom (non-tool) repo into the standard by renaming/moving its dirs (explicit request only).
- Adding `AGENTS.md` as SSOT + the canonical dirs.

## When NOT to use

- A one-off instruction tweak (just edit `AGENTS.md`).
- The repo is already standardized and complete (re-running only fills gaps — see Idempotency).

## The standard this installs (what-for-what)

```text
AGENTS.md                      SSOT: instructions/steering + the Tool Onboarding Contract   [commit]
llms.txt                       optional doc-map for agents (llmstxt.org)                    [commit]
.agents/skills/<n>/SKILL.md    skills (Agent Skills open standard; Zed reads here)          [commit]
specs/<feature>/               SDD triad: requirements.md · design.md · tasks.md  [T2·commit]
memory/                        durable memory; INDEX.md first, progressive disclosure  [T3·commit]
    INDEX.md · brief.md · patterns.md · decisions.md · preferences.md · active-context.md · glossary.md
data/intake/                   raw external docs            [T2 · gitignore if symlinks/large]
data/corpus/                   processed LLM-friendly        [T3 · commit]
data/research/                 generated research / surveys  [T4 · commit]
scripts/                       persistent, reusable automation scripts (committed)  [commit]
.agents/rules/*.md             ONLY for monorepos: glob/path-scoped rules (else keep rules in AGENTS.md)
```

Tiers/aliases and the full recognize-map live in `deep-research-t1/references/source-tiering.md` §8.

**No scratch dirs.** Never create `.cache/`, `.cache/agents/`, or `tmp/` in a project. `.cache/` belongs to
third-party tools (pip/pytest/mypy/build) and stays gitignored — agents never author there. Reusable code →
`scripts/`; ephemeral code → run via the interpreter or the OS temp dir (`$TMPDIR`), never persisted in the tree.

## Step 0 — Detect mode & tools (MANDATORY, do first)

```text
∆ Scan repo root. Is there code already? any agent files?
∆ Detect tool footprints present:
    AGENTS.md · CLAUDE.md · .claude/ · .cursor/ · .github/copilot-instructions.md
    · .kiro/ · .windsurf/ · .devin/ · GEMINI.md · memory-bank/ · openspec/ · .specify/ · _bmad/
∆ Classify:
    NEW             = greenfield / no agent files                      → Mode A
    EXISTING-TOOL   = a recognized footprint above is present          → Mode B (additive)
    EXISTING-CUSTOM = has code + its own ad-hoc dirs, no known tool     → Mode B default
∆ Convert gate: did the user EXPLICITLY ask to convert / migrate / restructure / reorganize
    (not merely onboard / adopt / standardize)?  yes + EXISTING-CUSTOM → Mode C.
⚠ NEVER overwrite an existing file. Extend/merge; confirm before any replacement; no .bak (git is the net).
⚠ Moving/renaming is destructive → Mode C needs the explicit request AND a confirmed move plan.
```

Routing: NEW → A · recognized tool → B (always additive — never move tool dirs) ·
custom + explicit convert → C (move/rename) · custom without convert → B (additive).
Read `references/tool-bridges.md` before writing tool-facing instructions or a Mode C move plan.

## Mode A — NEW project (greenfield)

1. Create dirs: `.agents/skills/`, `specs/`, `memory/`, `data/intake/`, `data/corpus/`, `data/research/`, `scripts/` (add `.gitkeep` to empty committed dirs). Do **not** create `.cache/` or any other scratch dir.
2. Write `AGENTS.md` from `references/AGENTS.template.md` — fill `{{PROJECT_NAME}}` / overview; keep the **layout map + Tool Onboarding Contract + recognize-map** intact.
3. Write `memory/INDEX.md` from `references/memory-INDEX.template.md`; create the 6 topic stubs (`brief, patterns, decisions, preferences, active-context, glossary`).
4. Append `references/gitignore.snippet` to `.gitignore` (create if missing).
5. Optional: add `llms.txt` if the project will expose docs to agents.
6. **Do NOT pre-create** `CLAUDE.md` / `.cursor/` / `.github/` etc. The Onboarding Contract in `AGENTS.md` tells each tool to self-configure by reference the first time it runs.
7. If no git repo: offer to `git init` (ask first; never auto-commit).

## Mode B — EXISTING project (adopt — don't duplicate)

1. From Step 0, identify the project's current instruction file + tool dirs.
2. Establish `AGENTS.md` as SSOT **without duplication**:
   - **No AGENTS.md, but a tool file with real content** (e.g. `CLAUDE.md`): with user OK, move the durable content into `AGENTS.md` and reduce the tool file to a thin reference (`CLAUDE.md` → `@AGENTS.md`). If the user prefers minimal disruption, instead create `AGENTS.md` that cross-references the existing file and mark which is authoritative.
   - **AGENTS.md already exists**: extend it with the standard sections (layout map, Onboarding Contract, recognize-map) — do not rewrite their content.
3. Write a **project-specific recognize-map** into `AGENTS.md`: our concept → where it actually lives here. Example for a Claude project:
   `memory/ → .claude/memory/ · specs/ → .kiro/specs/ (if present) · rules → .cursor/rules/ (if present)`.
   Use `references/tool-bridges.md` for the exact per-tool mappings.
4. **Add only the canonical dirs the project lacks** (commonly `data/intake/`, `data/corpus/`, `data/research/`, `scripts/`, `.agents/skills/`) so the cross-platform flow works — **without moving** the tool's existing dirs.
5. **No symlinks** (git + Windows unsafe). Bridge with `@import` where supported (Claude `CLAUDE.md`) and otherwise with explicit instruction lines ("memory lives in `.claude/memory/` in this project").
6. Keep the original tool flow intact; document the mapping so both flows coexist and AGENTS.md stays SSOT.

## Mode C — CONVERT a custom / legacy layout (move/rename; explicit request only)

Use ONLY when the user explicitly asks to convert/migrate a repo that has its **own ad-hoc structure**
(no recognized tool footprint) into the standard. There is no tool flow to preserve, so the project's
dirs/files are physically **moved/renamed** into the canonical names and the repo becomes natively
standard — no recognize-map needed.
⚠ A recognized-tool project (`.claude/` `.cursor/` `.kiro/` `CLAUDE.md` …) is NEVER converted this way
even if the user says "convert" — moving its dirs breaks the tool → use Mode B (additive, bridge files
only). Move-vs-create is decided by tool-footprint presence, not by the word "convert".

1. Inventory the current layout; map each dir/file to its canonical home by PURPOSE
   (`references/tool-bridges.md § Custom/legacy layout → canonical`). Typical:
       docs|notes|wiki → memory/ · research|surveys → data/research/ · raw|inputs → data/intake/
       processed|fragments → data/corpus/ · bin|tools|automation → scripts/
       requirements|design → specs/<feature>/ · PROMPT.md|INSTRUCTIONS.md|AI_GUIDE.md → fold into AGENTS.md
2. Present the plan as a `from → to` table, one-line rationale each. **Confirm before moving** (destructive).
   Anything ambiguous stays put and is listed for the user to decide — never guess-move.
3. Execute with `move_path` (one per mapping; git detects renames, history preserved). Create any canonical
   dir lacking a source (`.gitkeep` empty committed ones). Never `.bak`.
4. Repair references the move broke: `grep` old paths → patch with `edit_file`.
5. Write/extend `AGENTS.md` (Mode A step 2 template): SSOT + layout map + Onboarding Contract. Fold any
   custom instruction file's durable content in, then thin it to a pointer or delete it.
6. Add `memory/INDEX.md` + topic stubs if absent; append the gitignore snippet. Offer to commit (never auto).

## The Tool Onboarding Contract (the core artifact)

Every generated `AGENTS.md` MUST embed the **Tool Onboarding Contract** (in `references/AGENTS.template.md`).
It is addressed to *any* future agent tool and instructs it to:

1. Read `AGENTS.md` as the single source of truth — do **not** duplicate it.
2. Map its native files onto our dirs (per `references/tool-bridges.md`).
3. Create **only a thin bridge** that references `AGENTS.md` (e.g. `CLAUDE.md` = `@AGENTS.md`; `.github/copilot-instructions.md` = "Follow ./AGENTS.md").
4. Put new specs in `specs/<feature>/`, memory in `memory/`, data in `data/…` — never invent parallel dirs.

This is what makes `AGENTS.md` self-bootstrapping: a new tool reads it, understands what-for-what, and wires itself in by reference.

## Safety / idempotency

- Never clobber existing files; extend or add a thin bridge. Confirm before replacing any non-trivial file.
- Re-running must be idempotent: detect what already exists, only fill gaps, don't re-append duplicate blocks.
- Mode C only: moves/renames are destructive — show the `from → to` plan and get confirmation first; git is the undo.
- Never auto-commit; never create `.bak` files.

## Verification checklist

```text
- [ ] AGENTS.md exists with: overview · layout map · Tool Onboarding Contract · recognize-map
- [ ] Canonical dirs exist (NEW) or are mapped to the project's actual dirs (EXISTING)
- [ ] memory/INDEX.md present (+ topic stubs for NEW)
- [ ] .gitignore covers .cache/ + .venv/ (third-party caches) (+ data/intake/ if it holds symlinks/large originals)
- [ ] No duplicated instruction content: tool files REFERENCE AGENTS.md, never copy it
- [ ] EXISTING-TOOL: original tool flow intact + mapping documented (nothing moved)
- [ ] Mode C (convert): move plan confirmed first · canonical tree clean · broken refs repaired · no tool dirs moved
```

## References

| File | Use |
|---|---|
| `references/AGENTS.template.md` | The project `AGENTS.md` to write (SSOT + Onboarding Contract + recognize-map) |
| `references/memory-INDEX.template.md` | `memory/INDEX.md` bootstrap (progressive-disclosure protocol + topic stubs) |
| `references/tool-bridges.md` | Per-tool onboarding (new) + existing-project mapping + custom→canonical move map (Mode C) |
| `references/gitignore.snippet` | Lines to append to `.gitignore` |
