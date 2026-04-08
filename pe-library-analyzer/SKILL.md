---
name: pe-library-analyzer
description: Deep analysis of PE_Library-style repositories — prompt engineering knowledge bases containing skills, primers, system prompts, and methodology docs. Produces a structured report covering Purpose, Skills Inventory, PE Methodologies, Tools & Integrations, Project Status, and Key Files. Use this skill whenever the user asks "what is this project about?", "analyze this repo", "give me an overview", "explain this codebase", "what skills are available?", "summarize this PE library", or any question about understanding the contents or structure of a prompt engineering repository. Also trigger when the user opens a new session and seems to need orientation in a PE-style project.
metadata:
  author: rd162@hotmail.com
---

# PE Library Analyzer

You are performing a deep structural analysis of a PE_Library-style repository — a prompt engineering knowledge base. Your job is to explore it thoroughly and produce a clear, structured report.

## What a PE_Library-style repo looks like

These repos typically contain some combination of:
- `__SKILLS__/` or skills at `~/.claude/skills/` — reusable Claude Code agent skills
- `__SPECS__/` or `__FRAGMENTS__/` — raw and converted documents for analysis
- System prompt files — agent configuration templates
- Primers and methodology guides — Chain of Thought, ReAct, Chain of Draft, etc.
- Knowledge management files — AGENTS.md, CLAUDE.md, MEMORY.md, continuation narratives
- Prompt collections — curated prompts organized by domain
- Integration mappings, validation reports, test plans

## Exploration protocol (5 levels deep)

Work through these steps in order. Use parallel tool calls wherever the steps are independent.

### Level 1 — Root inventory
- List the project root directory
- Read every top-level markdown file you find (AGENTS.md, CLAUDE.md, README.md, MEMORY.md, etc.)
- Note the directory structure: which folders exist, which look like PE artifacts vs generic project files

### Level 2 — Key directory exploration
Explore these directories if present (list contents of each):
- `__SKILLS__/` — skill folders
- `~/.claude/skills/` — if referenced or relevant
- `System Prompts/` or similar
- `prompts/` or `pe-library/`
- `publications/`, `reports/`, `Documentation/`

### Level 3 — Skills deep-dive
For each skill directory found:
- Read its `SKILL.md` frontmatter and first 30 lines
- Note: name, trigger description, what it does

### Level 4 — Methodology & primer coverage
- Read the first 50–80 lines of each primer/methodology document found (Chain of Thought, ReAct, Chain of Draft, Tree of Thoughts, etc.)
- Note what PE frameworks are documented and at what depth

### Level 5 — Integration & status
- Read integration mapping files (INTEGRATION_MAPPING.md or similar)
- Read any phase/status tracking in AGENTS.md or project docs
- Check for test plans, validation reports, continuation narratives
- Note current project phase and readiness

## Output format

Produce a structured report with these sections:

---

## Project Overview
One paragraph: what this repo is, what it's for, who it's for.

## Skills Inventory
Table or list of all skills found: name, what it does, trigger context.

## PE Methodologies Covered
List of reasoning frameworks documented (CoT, ToT, GoT, ReAct, CoD, CoK, etc.) with a brief note on depth of coverage for each.

## Tools & Integrations
What external tools, MCPs, APIs, or platforms are covered (Exa, Zed, Basic-Memory, etc.).

## Project Status
Current phase, what's complete, what's in progress, what's pending.

## Key Files
A quick-reference map of the most important files and what they contain.

---

## Tips

- If a directory has more than 20 files, list the first 10 and note "and N more" rather than reading every one.
- For large files (>200 lines), read just the first 60–80 lines unless a specific section is clearly relevant.
- If `__FRAGMENTS__/` exists, note it but don't read fragments — just report the count and source documents.
- If you can't find a standard structure, adapt: explore what's there and map it to the output sections as best you can.
- Be concrete: name specific files, quote key phrases from docs, list actual skill names. Don't be vague.
