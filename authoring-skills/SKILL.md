---
name: authoring-skills
description: Guide for creating well-structured agent skills and refactoring monolithic system rules into reusable skills following the S=(C,π,T,R) formalization. Use when designing a new skill, improving an existing skill, reviewing skill quality, restructuring skill instructions, refactoring system rule files into skills, extracting reusable procedures from monolithic prompts, or when user says "create a skill", "write a skill", "new SKILL.md", "extract skills from", "refactor rules into skills", or "decompose this system prompt".
version: "2.0"
metadata:
  author: PE_Library
  tags: meta-skill, skill-authoring, S-CPTR, agent-skills, best-practices, refactoring
---

# Authoring Skills

Create effective, well-structured agent skills
that trigger reliably, execute correctly, terminate cleanly,
and degrade gracefully when dependencies are unavailable.

## When to Use

- Creating a new skill from scratch
- Improving or restructuring an existing skill
- Reviewing a skill for quality and completeness
- Ensuring a skill follows the S=(C,π,T,R) formalization
- Standardizing skills across a library or team
- **Refactoring system rule files** into system rules + extractable skills
- Decomposing monolithic system prompts into modular, reusable components
- Deciding what stays as a system rule vs. what becomes a skill

## When NOT to Use

- Creating MCP tool definitions (skills are instructions, not tool schemas)
- Tasks where the user already has a complete, validated SKILL.md
- Simple prompt templates with no procedural logic (a skill adds C, T, R — not just π)
- Converting pure style/formatting preferences into skills (those stay as system rules)

## Termination

| Signal   | Condition                                                   | Action                            |
| -------- | ----------------------------------------------------------- | --------------------------------- |
| COMPLETE | SKILL.md produced and passes S=(C,π,T,R) completeness check | ✓ STOP — skill ready for testing  |
| REVIEW   | Existing skill audited, all gaps identified and documented  | ✓ STOP — gaps reported to user    |
| REFACTOR | Extraction plan produced: system-rule vs skill per section  | ✓ STOP — plan ready for execution |
| BLOCKED  | Insufficient information to define C or π (domain unclear)  | Ask user for clarification        |
| ITERATE  | Skill produced but user requests changes                    | Re-enter at relevant step (1–6)   |

## The Skill Formalization: S = (C, π, T, R)

Every skill is a four-tuple.
Each component serves a distinct purpose.
Removing any one degrades the skill:

| Component | Name                        | Purpose                                      | Without It                                                 |
| --------- | --------------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| **C**     | Applicability condition     | Predicate: should this skill activate now?   | Skill cannot self-select → wrong activation                |
| **π**     | Executable policy           | The instructions: what to do and how         | Metadata without executability → useless                   |
| **T**     | Termination condition       | When is the skill done?                      | Skill cannot compose → callers don't know when to resume   |
| **R**     | Reusable callable interface | Name, params, return contract for invocation | Internal knowledge that cannot be invoked programmatically |

**Design every skill with all four components.**
They need not appear as literal section headers,
but the information each encodes must be present.

### The Fifth Principle: Graceful Degradation

Beyond S=(C,π,T,R), every skill MUST degrade gracefully.
If a skill depends on another skill or capability,
it must define a fallback for when that capability is absent.

**Rule:** A skill must NEVER halt because a dependency is unavailable.
It must always produce output — the quality may vary, but the pipeline continues.

```text
Preferred: Use dedicated capability (skill, sub-agent, tool)
Fallback:  Apply the pattern inline with best-effort quality
Minimal:   Skip the step, document what was skipped, continue

Example — a comparison skill that prefers structured requirements:
  Preferred: Invoke requirements-inference skill → structured MGPC
  Fallback:  Extract requirements inline from the raw request
  Minimal:   Use the raw request directly as evaluation criteria
```

**In the Termination table**, replace `BLOCKED → HALT` with
`DEGRADED → warn user, continue with fallback` for any dependency gap.
Only BLOCK when the skill literally cannot produce any output
(e.g., a file-creation skill with no file system AND no chat output).

---

## Step 1: Define the Callable Interface (R)

R is the YAML frontmatter.
It is the first thing any agent reads — the skill's public API.

### Required Fields

```yaml
---
name: kebab-case-name
description: What it does. Use when [specific trigger phrases].
---
```

### Frontmatter Rules

| Field           | Constraint                        | Notes                                     |
| --------------- | --------------------------------- | ----------------------------------------- |
| `name`          | ≤64 chars, lowercase+hyphens only | Must match folder name                    |
| `description`   | ≤1024 chars, non-empty            | No XML angle brackets                     |
| `metadata`      | Optional key-value pairs          | author, version, tags, mcp-server         |
| `license`       | Optional                          | MIT, Apache-2.0 if open-source            |
| `allowed-tools` | Optional, experimental            | Restrict tool access when skill is active |

### Writing the Description (Critical)

The description is the applicability condition expressed in natural language.
It is the single most important line in the entire skill.
If the description is wrong, nothing else matters — the skill will not trigger.

**Structure:** `[What it does] + [When to use it with trigger phrases]`

```text
✗ "Helps with documents."
✗ "Creates sophisticated multi-page documentation with advanced formatting."
✓ "Creates professional README.md files for software projects. Use when
   user asks to 'write a README', 'document this project', or
   'generate project documentation'."
```

**Rules for descriptions:**

- Write in third person (injected into system prompt)
- Include 3-5 specific trigger phrases users would actually say
- Include relevant file types or domain terms
- Add negative triggers if overtriggering is a risk:
  "Do NOT use for simple data exploration"

---

## Step 2: Define the Applicability Condition (C)

C determines WHEN the skill activates.
In the Agent Skills standard, C is implemented through two mechanisms:

1. **The description field** (primary): The agent matches user intent
   against all skill descriptions at session start.
   Only ~100 tokens per skill are loaded at this stage.

2. **The "When to Use" section** (secondary): Loaded at Level 2
   when the skill is triggered. Provides finer-grained activation logic.

### When to Use Section Template

```markdown
## When to Use

- [Positive trigger 1: specific scenario]
- [Positive trigger 2: specific scenario]
- [Positive trigger 3: specific scenario]

## When NOT to Use

- [Negative trigger: when another skill or approach is better]
```

**C must be narrow enough to avoid overtriggering,
broad enough to avoid undertriggering.**

Test: Ask the agent "When would you use the [skill-name] skill?"
If the answer misses your intended use cases, revise C.

---

## Step 3: Write the Executable Policy (π)

π is the body of SKILL.md — the actual instructions.
This is what the agent follows when the skill activates.

### Progressive Disclosure (Three-Level Loading)

Skills use a three-level system to minimize token cost:

| Level | What                  | When Loaded            | Token Budget   |
| ----- | --------------------- | ---------------------- | -------------- |
| L1    | name + description    | Session start (always) | ~100 per skill |
| L2    | SKILL.md body         | When skill triggers    | ≤500 lines     |
| L3    | references/, scripts/ | On-demand within skill | Unlimited      |

**Implication:** Keep SKILL.md body ≤500 lines.
Move detailed reference material to `references/` files.
Link from SKILL.md with: `@references/detail.md`

### Policy Structure Template

Required sections (adapt to your skill's needs):

```text
# Skill Name                ← 1-2 sentence overview
## When to Use              ← positive triggers (Step 2)
## When NOT to Use          ← negative triggers (Step 2)
## Termination              ← signal table (Step 4)
## Graceful Degradation     ← preferred/fallback/minimal paths
## Instructions             ← Step 1…N with actionable instructions
## Examples                 ← 1-2 concrete input→output pairs
## Anti-Patterns            ← ✗ wrong / ✓ correct pairs
## Environment Compatibility ← which platforms this works with
## References               ← academic citations (if any, at end only)
```

### Policy Authoring Rules

**Conciseness:** Frontier models are already smart.
Only add context the model does not already have.
Challenge each paragraph: "Does this justify its token cost?"

**But maintain cross-model portability:** Skills must work across
Claude Code, Cursor, Codex, Gemini CLI, Kimi, and other agents.
Mid-tier models need more context than frontier models.
Keep enough explanation that a capable (non-frontier) model
can follow the instructions without external knowledge.
The target is "concise but complete" — not "minimal for experts only."

**Degrees of freedom:** Match specificity to task fragility:

- **High freedom** (heuristic tasks): General guidance, multiple valid approaches
- **Medium freedom** (parameterized tasks): Preferred pattern with escape hatches
- **Low freedom** (fragile tasks): Exact scripts, no deviation

**Actionable instructions:** Every step must be executable.

```text
✗ "Validate the data before proceeding."
✓ "Run: python scripts/validate.py --input {filename}
   If validation fails, common issues include:
   - Missing required fields (add them to the CSV)
   - Invalid date formats (use YYYY-MM-DD)"
```

**No deeply nested references:**
All reference files should link directly from SKILL.md (one level deep).
Nested references (file A → file B → file C) cause incomplete reads.

---

## Step 4: Define the Termination Condition (T)

T specifies when the skill is done.
Without T, composing skills is impossible — callers cannot know when to resume.

### Termination Section Template

```markdown
## Termination

| Signal   | Condition                        | Action                             |
| -------- | -------------------------------- | ---------------------------------- |
| COMPLETE | [What "done" looks like]         | ✓ STOP — output ready              |
| DEGRADED | [Dependency unavailable]         | Warn user — continue with fallback |
| [custom] | [Domain-specific terminal state] | [Domain action]                    |
```

**Avoid BLOCKED → HALT for dependency gaps.**
Use DEGRADED → continue with fallback instead.
Reserve BLOCKED only for truly impossible situations
(no input at all, completely ambiguous request after clarification attempt).

### Common Termination Patterns

**Single-output skills** (e.g., method selection):
Terminates when the recommendation is produced.

**Iterative skills** (e.g., self-refine):
Terminates on DEFENSE, CONVERGE, CYCLE, or TIMEOUT.

**Multi-phase skills** (e.g., multi-candidate):
Each phase has its own gate; the skill terminates
when the final phase produces output.

**Workflow skills** (e.g., continuation/handoff):
Terminates when the continuation or handoff artifact is written.

### Compositional Gates (Soft Gates)

When a skill's policy (π) benefits from another skill's output,
use a **soft compositional gate** to prefer the dependency
while providing a fallback:

```text
⚠ GATE(label):
  REQUIRES: [capability description — WHAT is needed, not which tool]
  EVIDENCE: [specific output artifact that proves the capability ran]
  FALLBACK: [what to do if the capability is unavailable — NEVER "halt"]
```

Gates describe capabilities and evidence, never specific tool names.
The agent scans available `[SKILL]`-labeled tools to find a match.
If no match is found, the FALLBACK path executes.
The pipeline always continues.

See the think-deeper skill for a worked example.

---

## Step 5: Validate and Test

### S=(C,π,T,R) + Degradation Completeness Check

Before finalizing, verify all components:

```text
- [ ] R: Frontmatter has name + description with trigger phrases?
- [ ] C: Description + "When to Use" cover activation scenarios?
- [ ] π: Instructions are actionable, concise, progressively disclosed?
- [ ] T: Termination conditions are explicit and detectable?
- [ ] D: Graceful degradation defined for every external dependency?
- [ ] D: No BLOCKED → HALT for dependency gaps (use DEGRADED → fallback)?
- [ ] D: Skill produces output even when all optional dependencies are absent?
```

### Trigger Testing

Run these tests against the skill:

```text
Should trigger (3-5 queries):
- "[exact trigger phrase from description]"
- "[paraphrased version of trigger]"
- "[related but different wording]"

Should NOT trigger (2-3 queries):
- "[unrelated topic]"
- "[similar domain but wrong skill]"
```

If explicit invocation works but automatic activation fails,
the description needs more specific trigger phrases.

### Functional Testing

```text
- [ ] Skill produces expected output for canonical use case?
- [ ] Error handling covers common failure modes?
- [ ] Termination signals are actually produced?
- [ ] Progressive disclosure works (references load on demand)?
```

### Quality Checklist

```text
- [ ] SKILL.md body ≤500 lines?
- [ ] Description ≤1024 chars, includes WHAT + WHEN?
- [ ] No XML angle brackets in frontmatter?
- [ ] Consistent terminology throughout?
- [ ] No time-sensitive information (dates, versions)?
- [ ] Reference files are one level deep from SKILL.md?
- [ ] Examples are concrete, not abstract?
- [ ] Anti-patterns section included?
- [ ] Graceful Degradation section included?
- [ ] No BLOCKED → HALT for optional dependencies?
- [ ] Cross-model portable (works beyond frontier models)?
- [ ] Forward slashes in all file paths (no backslash)?
- [ ] Folder name matches skill name, kebab-case?
```

---

## File Structure

```text
skill-name/
├── SKILL.md              # Required: R (frontmatter) + C + π + T
├── references/           # Optional: L3 material loaded on demand
│   ├── detailed-guide.md
│   └── examples.md
├── scripts/              # Optional: executable code
│   └── validate.py
└── assets/               # Optional: templates, data files
    └── template.md
```

**Rules:**

- Folder name = skill name (kebab-case)
- SKILL.md must be exactly `SKILL.md` (case-sensitive)
- No README.md inside the skill folder
- No deeply nested directory structures
- Link to supporting files with `@references/filename.md` syntax
  (triggers on-demand loading in Claude Code CLI;
  portable across MCP bridges)
- Link to executable scripts with `@scripts/filename.sh` syntax

---

## Worked Example (Brief)

**Request:** "Create a skill for generating changelog entries from git history"

```text
R: name=generating-changelogs | description includes "write a changelog",
   "generate release notes", "summarize recent changes"
C: When to Use = preparing release, summarizing commits, updating CHANGELOG.md
   When NOT to Use = writing commit messages, reviewing code
π: ∆1 identify commit range → ∆2 categorize by conventional prefix → ∆3 generate entry
T: COMPLETE (entry written) | EMPTY (no commits) | BLOCKED (no git)
```

For the full worked example with complete YAML, markdown sections,
and policy details, see @references/conventions.md

---

## Step 6: Refactor System Rules into Skills

When given a monolithic system rule file, decompose it into
**system rules** (always-on mandates) + **extractable skills** (on-demand procedures).

### The Classification Criterion

The C component of `S = (C, π, T, R)` determines the boundary:

| If C is…        | Then it's a…      | Stays where?     |
| --------------- | ----------------- | ---------------- |
| **Always true** | System rule       | System rule file |
| **Conditional** | Extractable skill | New SKILL.md     |

**System rule** = applies to EVERY request regardless of task type.
**Skill** = applies only when the task matches the applicability condition.

### Refactoring Workflow

1. Read the system rule file end-to-end
2. For each section, classify: C=always → rule | C=conditional → skill
3. For extractable sections: define C, π, T, R per Steps 1-5
4. Produce extraction plan (table: section → stays/extracts → skill name)
5. Residual rule keeps: core mandate + triggers + enforcement checklist
6. Extracted skill gets: full methodology as SKILL.md

For classification examples, residual rule patterns, and worked examples,
see @references/refactoring-system-rules.md

---

## Anti-Patterns

```text
✗ Description says "Helps with things" (too vague → never triggers)
✓ Description includes specific trigger phrases users actually say

✗ All content in SKILL.md (500+ lines, context overflow)
✓ Core instructions in SKILL.md, details in references/

✗ No termination condition (callers cannot compose with this skill)
✓ Explicit termination table with signals and conditions

✗ BLOCKED → HALT when an optional dependency is unavailable
✓ DEGRADED → warn user, continue with inline fallback

✗ Skill halts because a referenced skill is absent
✓ Every dependency has a fallback: preferred → inline → skip-and-document

✗ Writing instructions only for frontier models (too terse for mid-tier)
✓ Cross-model portable: concise but complete enough for capable models

✗ Inline academic citations in policy instructions (pollutes context)
✓ Academic references in a References section at end of file

✗ Hardcoded tool names in compositional gates (breaks portability)
✓ Gates describe capabilities, evidence, AND fallbacks — not specific tools

✗ Nested file references (A→B→C causes incomplete reads)
✓ All references one level deep from SKILL.md

✗ Writing description in first/second person ("I help you...")
✓ Writing description in third person ("Generates structured...")

✗ Missing "When NOT to Use" (causes overtriggering)
✓ Explicit negative triggers when skill scope is ambiguous

✗ Cross-file references between system rules and skills
✓ Conceptual references only ("the iterative refinement capability")
```

## Environment Compatibility

This skill is pure methodology — no tooling dependencies.
Works with any agent that supports the SKILL.md format:

- **Claude Code / Claude API**: Native skill support
- **OpenAI Codex**: Supports Agent Skills standard
- **Cursor / VS Code**: Via skill directories
- **Gemini CLI**: Via skill directories or MCP
- **Kimi / other agents**: Via SKILL.md file loading
- **MCP Skillz**: Via skill server
- **Any agent**: The S=(C,π,T,R) framework applies universally

## References

- Jiang et al.,
  "SoK: Agentic Skills — Beyond Tool Use in LLM Agents"
  (arXiv:2602.20867v1, 2026).
  Source for the `S = (C, π, T, R)` formalization:
  applicability condition, executable policy,
  termination condition, reusable callable interface.
  Design patterns (P1-P7) and skill lifecycle model.
- Agent Skills Open Standard (agentskills.io, 2025).
  SKILL.md format specification, YAML frontmatter fields,
  progressive disclosure (three-level loading).
- Anthropic, "Skill Authoring Best Practices"
  (platform.claude.com/docs, 2026).
  Conciseness principles, degrees of freedom,
  testing methodology, progressive disclosure patterns.
- Poudel, "The SKILL.md Pattern: How to Write AI Agent Skills
  That Actually Work" (Medium, 2026).
  Practitioner guide: trigger phrases, three-level loading,
  debugging undertriggering, allowed-tools field.
