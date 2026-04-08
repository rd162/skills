# PE_Library Skill Conventions

Extended reference for authoring skills within the PE_Library ecosystem.
Loaded on demand — not part of the main SKILL.md context.

**Note:** Per-skill S=(C,π,T,R) mappings are NOT maintained here.
Each skill's own SKILL.md is the authoritative source for its C, π, T, R.
Duplicating them in a reference file causes staleness.
To audit a skill's four-tuple, read its SKILL.md directly.

---

## PE_Library Frontmatter Conventions

Beyond the Agent Skills standard, PE_Library skills use:

```yaml
---
name: kebab-case-name
description: [what + when, ≤1024 chars]
metadata:
  author: PE_Library
  version: "X.Y"
  tags: comma, separated, terms
---
```

### Version Scheme

- Major (X): Breaking changes to skill interface or output format
- Minor (Y): Additions, refinements, gate additions, reference updates
- Examples: 1.0 → 1.1 (added termination section), 2.0 → 2.1 (added compositional gate)

### Tag Conventions

Use lowercase, hyphenated tags from this vocabulary:

- **Domain:** prompt-engineering, decision-making, requirements, quality
- **Method:** CoT, ToT, CoD, SoT, ReAct, CoK, condorcet, self-refine
- **Role:** meta-skill, sub-agents, multi-session, cross-vendor
- **Scope:** iterative-improvement, method-selection, continuation, handoff

---

## Graceful Degradation Convention

**Mandate:** Every PE_Library skill MUST degrade gracefully.
If a dependency is unavailable, the skill continues with a fallback.
Skills NEVER halt because an optional capability is absent.

### Degradation Levels

```text
Preferred: Use dedicated capability (skill, sub-agent, specialized tool)
Fallback:  Apply the pattern inline with best-effort quality
Minimal:   Skip the step, document what was skipped, continue
```

### Degradation in Practice

| Scenario               | Preferred                                           | Fallback                                        |
| ---------------------- | --------------------------------------------------- | ----------------------------------------------- |
| Requirements inference | Invoke requirements skill → structured MGPC         | Extract requirements inline from raw request    |
| Iterative refinement   | Invoke self-refine skill → defense/converge signals | Single round of inline critique-and-revise      |
| Sub-agent delegation   | Spawn isolated sub-agents for parallelism           | Sequential execution with context fencing       |
| File system access     | Write artifacts as project files                    | Output as structured text in chat               |
| Search tools           | Run Δ1-Δ7 web search protocol                       | Use training knowledge with explicit disclaimer |

### Termination Convention

Replace `BLOCKED → HALT` with `DEGRADED → warn and continue` for dependency gaps.
Reserve BLOCKED only for truly impossible situations:
no input at all, or ambiguous request after clarification attempt.

---

## Soft Compositional Gate Convention

When a skill benefits from another skill's output,
use a **soft gate** that prefers the dependency but provides a fallback.

### Gate Declaration

```text
⚠ GATE(label):
  REQUIRES: [capability description — abstract, not a tool name]
  EVIDENCE: [specific output artifact proving the capability ran]
  FALLBACK: [what to do if the capability is unavailable — NEVER "halt"]
```

### Gate Design Rules

1. **Describe capability, not tool:** "Iterative blind assertive critique"
   not "adversarial-self-refine tool"
2. **Require evidence, not invocation:** Check for termination signals,
   output artifacts, trace lines — not tool call logs
3. **Always provide a FALLBACK:** The gate must never halt the pipeline.
   If the preferred capability is absent, the fallback executes.
4. **Report degradation:** When falling back, warn the user
   that quality may be reduced compared to the preferred path.

### When to Use Soft Gates

- Skill A's output improves Skill B's quality (quality dependency)
- Skill A must complete before Skill B for best results (ordering preference)
- The pipeline should still work without Skill A (graceful degradation)

### When NOT to Use Gates

- Skill is standalone with no dependencies
- Dependency is on a primitive tool, not another skill
- The dependency adds negligible value

---

## Progressive Disclosure in PE_Library

### SKILL.md Body Guidelines

- **Target:** ≤500 lines, ≤5000 tokens when loaded
- **Content:** Core instructions, termination conditions, examples, anti-patterns
- **Tone:** Concise, actionable, third-person for descriptions

### Reference Files (references/)

- **Purpose:** Extended examples, detailed patterns, domain-specific guidance
- **Loading:** On-demand only, when SKILL.md references them
- **Linking:** One level deep: `See [references/file.md]` from SKILL.md
- **No nesting:** references/a.md must NOT link to references/b.md

### Scripts (scripts/)

- **Purpose:** Executable validation, generation, or analysis code
- **Execution:** Run without loading into context (only output consumed)
- **Documentation:** Self-documenting constants, no magic numbers

---

## Academic References in Skills

### Rule: No Inline Citations in Policy Instructions

Academic references provide provenance and credibility
but must not pollute the executable policy (π) with paper metadata.

**Placement hierarchy:**

1. **References section** (bottom of SKILL.md): Full citations with arXiv IDs
2. **Formal Basis subsection** (within a conceptual section): Plain-language
   description of the formalism without inline paper references
3. **Never inline** in step-by-step instructions or templates

### Honest Attribution

When PE_Library introduces original notation or methodology,
document it as such — do not imply it comes from published literature.

Examples of PE_Library original contributions:

- **W-functor:** The recursive "why?" process for finding Mission (tautology)
- **MGPC as PE framework:** Adapting requirements engineering for prompt optimization
- **Blind assertive critique:** Asserting flaws rather than asking "what could improve?"
- **Defense-based termination:** Model arguing FOR its solution = convergence signal
- **Sub-agent dispatch:** Natural language parallel/isolated sub-agent spawning patterns
- **Soft compositional gates:** Capability-based preconditions with mandatory fallbacks

These should be cited as "original to PE_Library" in References sections,
with acknowledgment of the academic foundations they build on.

---

## Skill Composition Patterns in PE_Library

Common chains observed across PE_Library skills:

### Requirements → Candidates → Winner

```text
inferring-requirements → MGPC (or inline requirements extraction as fallback)
  → think-deeper → 3 candidates
    → blind-attack refinement × 3 (or inline critique as fallback) → refined candidates
    → Condorcet pairwise → winner
```

### Method Selection → Execution

```text
selecting-pe-methods → recommended method
  → [chosen method skill] → result
    → adversarial-self-refine → polished result (optional)
```

### Any Chain → Continuation

```text
[any skill chain] → output
  → continuation-and-handoff (if session boundary reached)
```

### Meta Pattern

```text
authoring-skills → new skill SKILL.md
  → adversarial-self-refine (or manual review) → refined SKILL.md
  → [test in environment]
```

**Degradation note:** Every arrow in these chains represents a preferred path.
If a skill in the chain is unavailable, the previous skill's output
is used directly by the next step — the chain never breaks.

---

## Testing Conventions

### Trigger Tests (3+5 pattern)

For every skill, define at minimum:

- 3 queries that SHOULD trigger the skill
- 5 queries that should NOT trigger the skill

### S=(C,π,T,R) + Degradation Completeness Audit

Run this check on every skill annually or on major version bumps:

```text
- [ ] R: Frontmatter has name, description, version, tags?
- [ ] C: Description covers activation scenarios (positive + negative)?
- [ ] π: Instructions are actionable and ≤500 lines?
- [ ] T: Termination signals are explicit and detectable?
- [ ] D: Graceful Degradation section present?
- [ ] D: No BLOCKED → HALT for optional dependency gaps?
- [ ] D: Skill produces output even when all optional dependencies absent?
- [ ] Gates: Dependencies declared as soft gates with FALLBACK?
- [ ] References: Academic citations in References section only?
- [ ] References: Original PE_Library contributions honestly attributed?
- [ ] Progressive disclosure: Body ≤500 lines, details in references/?
- [ ] Cross-model: Works beyond frontier models (enough context for mid-tier)?
```
