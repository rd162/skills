# {{PROJECT_NAME}} — Agent Instructions

> **`AGENTS.md` is the single source of truth (SSOT)** for every AI agent tool in this repo.
> Any tool must **reference** this file, never duplicate it. See **Agent Tool Onboarding** below.

## Overview

{{ONE_PARAGRAPH: what this project is, the stack, and how to build / test / run it.}}

## Conventions

- Build / test / lint: {{commands}}
- Code style & boundaries: {{notes}}

## Project layout (what-for-what)

| Path | What it holds | Notes |
|---|---|---|
| `AGENTS.md` | instructions / steering (this file) | **SSOT** |
| `.agents/skills/<name>/SKILL.md` | reusable agent skills | Agent Skills open standard |
| `specs/<feature>/` | `requirements.md` → `design.md` → `tasks.md` | spec-driven dev (Spec-Kit / Kiro / OpenSpec) |
| `memory/` | durable agent memory | read `memory/INDEX.md` first (progressive disclosure) |
| `data/intake/` | raw external documents | ingested source material |
| `data/corpus/` | processed, LLM-friendly fragments | derived from `intake/` |
| `data/research/` | generated research / surveys | lower confidence than `corpus/` |
| `scripts/` | persistent, reusable automation scripts | committed; promote useful temp scripts here |
| `.cache/` | third-party tool cache (pip/pytest/…); gitignored | agents never author here — reusable code → `scripts/` |

<!-- EXISTING-PROJECT RECOGNIZE-MAP (the skill fills this only when adopting a repo that already
     uses another tool's layout — map our concept → where it actually lives here, e.g.:
| Concept | In this repo |
|---|---|
| memory/ | `.claude/memory/` (existing) |
| specs/  | `.kiro/specs/` (existing) |
| rules   | `.cursor/rules/` (existing) |
-->

## Agent Tool Onboarding (read first if you are an AI coding tool)

This repo is tool-agnostic. **Configure yourself BY REFERENCE — do not duplicate `AGENTS.md`.**

1. Treat `AGENTS.md` as the single source of truth for instructions and project layout.
2. Do your work in the canonical dirs above (`specs/`, `memory/`, `data/…`) — never invent parallel dirs.
3. Create at most a **thin bridge** that points back here:
   - **Claude Code** → `CLAUDE.md` = one line `@AGENTS.md`. Use `memory/` for durable memory (not `.claude/memory/`); keep `.claude/settings.json` for tool-only settings.
   - **GitHub Copilot / VS Code** → reads `AGENTS.md` natively (`chat.useAgentsMdFile`). If a `.github/copilot-instructions.md` is needed, make it one line: "Follow `./AGENTS.md` as the single source of truth."
   - **Cursor** → reads `AGENTS.md` natively. Put only tool-specific glob rules in `.cursor/rules/*.mdc`, each pointing at `AGENTS.md`.
   - **Codex / Gemini CLI** → read `AGENTS.md` natively. For Gemini, `GEMINI.md` may be a one-line pointer to `AGENTS.md`.
   - **Windsurf / Devin** → read `AGENTS.md` natively; `.windsurf/`|`.devin/rules/` only for tool-specific rules that reference `AGENTS.md`.
   - **Kiro** → use `specs/<feature>/` for the requirements→design→tasks triad; `.kiro/steering/` may reference `AGENTS.md`.
   - **Any other tool** → read `AGENTS.md`; create only a thin reference, never a copy.
4. When you learn durable facts, write them to `memory/` (curated) — don't fork instructions into your own dir.

> One source of truth, many tools, zero duplication. New tools self-onboard from this file.

## Skills

Project skills live in `.agents/skills/`; personal/global skills in `~/.agents/skills/`. {{list key skills or "see directory"}}

## Memory

Durable memory in `memory/` — start at `memory/INDEX.md`, pull topic files on demand. Curate; don't dump transcripts.
Settings/config are **not** memory (keep those in tool-native files / XDG `~/.config`).

## Scripts & token economy

- Reusable automation lives in `scripts/` (committed). **Never write scratch into the repo** (`.cache/`, `tmp/`, …).
- **Before writing a temporary script, ask: could this be reusable, even generalized?** If yes, after it works,
  generalize it and move it to `scripts/` — regenerate a tool once, not every session (saves output tokens).
- Ephemeral code: run via the interpreter or the OS temp dir (`$TMPDIR`) — never persisted in the tree.
