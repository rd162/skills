# Project Memory — Index

Durable, committed, file-based memory. **Read this file + `active-context.md` at session start**,
then pull deeper files **on demand** (progressive disclosure — do not load everything at once).

## Reading protocol

1. Always read: `INDEX.md` + `active-context.md`.
2. Read on trigger only:
   - `brief.md` — starting a feature / clarifying scope or goals
   - `patterns.md` — writing core code, architecture, conventions, stack limits
   - `decisions.md` — before changing an established choice (records ADRs + learned corrections/feedback)
   - `preferences.md` — to match owner style, tools, and anti-patterns
   - `glossary.md` — on unknown domain terms / acronyms

## Files

| File | Holds |
|---|---|
| `brief.md` | project foundation: goals, scope, success signals |
| `patterns.md` | architecture, conventions, tech stack & constraints |
| `decisions.md` | decision log (ADRs) + learned feedback / corrections |
| `preferences.md` | durable owner/user preferences + anti-patterns |
| `active-context.md` | current focus, recent changes, next steps |
| `glossary.md` | domain terms / jargon |

## Rules

- **Curate, don't dump** — short, high-signal entries; outcomes over transcripts.
- **Settings/config are NOT memory** — keep those in tool-native files / XDG `~/.config`.
- Keep `active-context.md` current; promote durable facts into the right topic file.
- Recognized equivalents in other tools (read these if present): `memory-bank/` (Cline/Roo/Kilo),
  `.claude/memory/`, `~/.claude/.../memory/`, `~/.codeium/windsurf/memories/`.
