# Tool Bridges — onboarding (new) + mapping (existing)

Principle: **`AGENTS.md` is SSOT. Bridge by reference, never duplicate. No symlinks** (git + Windows unsafe) —
use `@import` where the tool supports it, otherwise a one-line pointer. **One documented exception**: Claude
Code skills (see the Claude Code row below) — no `@import`/config redirect exists for skill folders, so
`.claude/skills` is a relative symlink to `../.agents/skills`, paired with a bundled Windows fallback script.

## Per-tool recipe

| Tool | Reads AGENTS.md natively? | Bridge to write (thin) | Where its memory/specs/rules live (recognize in existing repos) |
|---|---|---|---|
| **Claude Code** | No (reads `CLAUDE.md`) | `CLAUDE.md` = one line `@AGENTS.md` | memory: `.claude/memory/` or `~/.claude/projects/<hash>/memory/`; settings: `.claude/settings.json`; skills: `.claude/skills` = **relative symlink → `../.agents/skills`** (no @import equivalent for skills; Windows fallback: `scripts/fix_claude_skills_link.py`) |
| **OpenCode** | Yes (root) | none needed | skills: natively scans `.opencode/skills/`, `.claude/skills/`, AND `.agents/skills/` (project + global) — no bridge needed, but keep skill `name:` unique across those roots since the same file can be discovered via more than one path |
| **GitHub Copilot / VS Code** | Yes (`chat.useAgentsMdFile`) | optional `.github/copilot-instructions.md` = "Follow ./AGENTS.md (SSOT)" | instructions: `.github/instructions/*.instructions.md` |
| **Cursor** | Yes (root) | tool-specific globs only → `.cursor/rules/*.mdc` referencing AGENTS.md | rules: `.cursor/rules/`; memories: app store (machine-local) |
| **Codex** | Yes | none needed | nested `AGENTS.md` per package |
| **Gemini CLI** | partial | `GEMINI.md` = one-line pointer to `AGENTS.md` | `GEMINI.md` |
| **Windsurf / Devin** | Yes | tool rules only → `.devin/`\|`.windsurf/rules/` referencing AGENTS.md | rules: `.devin/`\|`.windsurf/rules/`; memories: `~/.codeium/windsurf/memories/` |
| **Kiro** | via AGENTS.md | `.kiro/steering/*.md` may reference AGENTS.md | specs: `.kiro/specs/<feature>/{requirements,design,tasks}.md`; steering: `.kiro/steering/` |
| **Cline / Roo / Kilo** | Yes | — | memory: `memory-bank/` (projectbrief, productContext, systemPatterns, techContext, activeContext, progress) |
| **Spec-Kit** | generates AGENTS.md | — | specs: `specs/NNN-feature/`; constitution: `.specify/memory/constitution.md` |

**OpenSpec is the default spec standard** for any project this skill touches (new or existing): brownfield-first delta specs (`## ADDED|MODIFIED|REMOVED` against a unified source of truth, merged on archive) beat fragmented per-feature static specs (Spec-Kit) and the requirements→design→tasks triad (Kiro) for AI-native change work — the canonical spec stays mergeable and machine-validated (`openspec validate`: every requirement needs SHALL/MUST + a `#### Scenario:` WHEN/THEN block). Pre-existing Spec-Kit (`specs/NNN-*` + `.specify/`) or Kiro (`.kiro/specs/`) footprints are **recognized, never moved**; only on an explicit convert request does their content migrate into an openspec change (proposal + delta specs — a content-level conversion, not a dir rename).
| **OpenSpec** (default spec standard) | uses AGENTS.md | — | `openspec/specs/<cap>/spec.md` (source of truth; starts empty, grows via archive), `openspec/changes/<change>/{proposal,design,tasks}.md` + delta `specs/`; run `openspec init --tools <ids>` only when spec work actually starts |

## NEW project — what to (not) create

- Write `AGENTS.md` (with the Onboarding Contract) + the canonical dirs.
- **Do** create the Claude Code bridge now (`CLAUDE.md`, `.claude/skills` symlink, `fix_claude_skills_link.py`,
  README note — see Bridge files below). It's the one deliberate exception: Claude Code has no
  `@import`/config redirect for skills.
- Do **not** pre-create anything else (`.cursor/`, `.github/`, `.kiro/` etc.). Each tool self-configures from the
  Onboarding Contract the first time it runs (thin bridge only).

## EXISTING project — adopt without disruption

1. Keep the tool's existing dirs where they are.
2. Make `AGENTS.md` SSOT: if a tool file holds the real instructions, move durable content into `AGENTS.md`
   (with user OK) and reduce the tool file to a thin reference; otherwise add `AGENTS.md` that cross-references.
3. Fill the **recognize-map** in `AGENTS.md` with this repo's actual locations (use the table above):
   e.g. `memory/ → .claude/memory/`, `spec work → .kiro/specs/ (existing; NEW spec work → openspec/)`, `rules → .cursor/rules/`.
4. Add only the canonical dirs the repo lacks (usually `data/intake/`, `data/corpus/`, `data/research/`, `.agents/skills/`). If there's no `.claude/` footprint yet, also add the Claude Code bridge (see NEW project above) — if `.claude/` already exists with real content, recognize/map it instead (step 3), don't touch it.
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
| `requirements/`, `design/`, `rfc/` | `openspec/` | spec work = OpenSpec changes (proposal + delta specs → design → tasks); a content-level conversion into a change folder, not a bare rename |
| `PROMPT.md`, `INSTRUCTIONS.md`, `AI_GUIDE.md`, `CONTRIBUTING-AI.md` | fold into `AGENTS.md` | one SSOT for instructions |

If a dir already has a canonical name (`memory/`, `scripts/`, `openspec/` …), keep it — just verify its
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

`.claude/skills` (Claude Code project-local skills bridge — the one symlink exception):
```bash
ln -s ../.agents/skills .claude/skills
```
Also copy `references/fix_claude_skills_link.py` into the project's `scripts/` and mention it in `README.md`
(Windows fallback for machines where Developer Mode isn't available).

`README.md` § Windows setup (only needed once the project has the `.claude/skills` bridge above):
```markdown
### Windows setup

This repo tracks a symlink (`.claude/skills` -> `.agents/skills`, see `AGENTS.md` Agent Tool Onboarding) so
Claude Code can see the same project skills as every other tool. Whether that checks out as a real link or
a placeholder text file depends on your machine's symlink support.

**One-time fix:** enable Developer Mode (Settings > Privacy & Security > For developers), then either clone
fresh or on an existing clone run:

    git config core.symlinks true
    git rm --cached -r .
    git reset --hard

**If Developer Mode is disabled by policy:** run `python3 scripts/fix_claude_skills_link.py` (stdlib-only,
no venv) — it swaps the placeholder for a no-privilege NTFS junction.
```
