# Tool Bridges — onboarding (new) + mapping (existing)

Principle: **`AGENTS.md` is SSOT. Bridge by reference, never duplicate. No symlinks** (git + Windows unsafe) —
use `@import` where the tool supports it, otherwise a one-line pointer.

## Per-tool recipe

| Tool | Reads AGENTS.md natively? | Bridge to write (thin) | Where its memory/specs/rules live (recognize in existing repos) |
|---|---|---|---|
| **Claude Code** | No (reads `CLAUDE.md`) | `CLAUDE.md` = one line `@AGENTS.md` | memory: `.claude/memory/` or `~/.claude/projects/<hash>/memory/`; settings: `.claude/settings.json`; skills: `.claude/skills/` |
| **GitHub Copilot / VS Code** | Yes (`chat.useAgentsMdFile`) | optional `.github/copilot-instructions.md` = "Follow ./AGENTS.md (SSOT)" | instructions: `.github/instructions/*.instructions.md` |
| **Cursor** | Yes (root) | tool-specific globs only → `.cursor/rules/*.mdc` referencing AGENTS.md | rules: `.cursor/rules/`; memories: app store (machine-local) |
| **Codex** | Yes | none needed | nested `AGENTS.md` per package |
| **Gemini CLI** | partial | `GEMINI.md` = one-line pointer to `AGENTS.md` | `GEMINI.md` |
| **Windsurf / Devin** | Yes | tool rules only → `.devin/`\|`.windsurf/rules/` referencing AGENTS.md | rules: `.devin/`\|`.windsurf/rules/`; memories: `~/.codeium/windsurf/memories/` |
| **Kiro** | via AGENTS.md | `.kiro/steering/*.md` may reference AGENTS.md | specs: `.kiro/specs/<feature>/{requirements,design,tasks}.md`; steering: `.kiro/steering/` |
| **Cline / Roo / Kilo** | Yes | — | memory: `memory-bank/` (projectbrief, productContext, systemPatterns, techContext, activeContext, progress) |
| **Spec-Kit** | generates AGENTS.md | — | specs: `specs/NNN-feature/`; constitution: `.specify/memory/constitution.md` |
| **OpenSpec** | uses AGENTS.md | — | `openspec/specs/`, `openspec/changes/<change>/{proposal,design,tasks}.md` |

## NEW project — what to (not) create

- Write `AGENTS.md` (with the Onboarding Contract) + the canonical dirs.
- Do **not** pre-create `CLAUDE.md`, `.cursor/`, `.github/`, `.kiro/` etc. Each tool self-configures from the
  Onboarding Contract the first time it runs (thin bridge only).

## EXISTING project — adopt without disruption

1. Keep the tool's existing dirs where they are.
2. Make `AGENTS.md` SSOT: if a tool file holds the real instructions, move durable content into `AGENTS.md`
   (with user OK) and reduce the tool file to a thin reference; otherwise add `AGENTS.md` that cross-references.
3. Fill the **recognize-map** in `AGENTS.md` with this repo's actual locations (use the table above):
   e.g. `memory/ → .claude/memory/`, `specs/ → .kiro/specs/`, `rules → .cursor/rules/`.
4. Add only the canonical dirs the repo lacks (usually `data/intake/`, `data/corpus/`, `data/research/`, `.agents/skills/`).
5. Document that both flows coexist; `AGENTS.md` remains SSOT.

## Custom / legacy layout → canonical (Mode C conversion)

For a repo with its **own ad-hoc structure and no recognized tool footprint**, converting = physically
moving/renaming dirs into canonical names (Mode C). Map by PURPOSE, not name alone; confirm the plan
before moving (destructive — git is the undo). Typical mappings:

| Found in the repo (examples) | Move/rename to | Why |
|---|---|---|
| `docs/`, `notes/`, `wiki/`, `knowledge/` | `memory/` | durable curated memory (read INDEX first) |
| `research/`, `surveys/`, `reports/` | `data/research/` | generated research, lower confidence |
| `raw/`, `inputs/`, `incoming/`, `sources/` | `data/intake/` | unprocessed external originals |
| `processed/`, `fragments/`, `chunks/` | `data/corpus/` | LLM-friendly processed material |
| `bin/`, `tools/`, `automation/` | `scripts/` | reusable committed automation |
| `requirements/`, `design/`, `rfc/` | `specs/<feature>/` | requirements → design → tasks triad |
| `PROMPT.md`, `INSTRUCTIONS.md`, `AI_GUIDE.md`, `CONTRIBUTING-AI.md` | fold into `AGENTS.md` | one SSOT for instructions |

If a dir already has a canonical name (`memory/`, `scripts/`, `specs/` …), keep it — just verify its
contents fit the canonical purpose. Anything that doesn't map cleanly: leave it in place and list it for
the user — never guess-move.

⚠ This table is for CUSTOM layouts only. A recognized-tool dir (`.claude/`, `.cursor/`, `.kiro/`,
`.github/`, `memory-bank/` as an active Cline/Roo store, …) is **bridged in place** (Mode B), never moved.

## Bridge files (copy-paste)

`CLAUDE.md` (Claude Code):
```text
@AGENTS.md
```

`.github/copilot-instructions.md` (only if a file is required):
```text
Follow ./AGENTS.md as the single source of truth for this repository.
```

`GEMINI.md` (Gemini CLI):
```text
See ./AGENTS.md — the single source of truth for this repository.
```
