# Refactoring System Rules into Skills

Detailed guide for decomposing monolithic system rule files
into system rules (always-on mandates) + extractable skills (on-demand procedures).

Loaded on demand — not part of the main SKILL.md context.

---

## The Core Principle

The applicability condition C from `S = (C, π, T, R)` is the classifier:

- **C = always true** → content is a system rule (behavioral mandate, style preference)
- **C = conditional** → content is an extractable skill (procedural methodology)

A system rule says "you MUST always do X."
A skill says "when the task involves Y, follow this procedure."

---

## Classification Decision Tree

```text
For each section in a system rule file, ask:

1. Does this section apply to EVERY request regardless of task?
   YES → system rule (keep in rule file)
   NO  → continue to question 2

2. Does this section describe a PROCEDURE with clear start/end?
   YES → candidate skill (extract)
   NO  → system rule (keep — it's a constraint or preference)

3. Is the procedure REUSABLE across different task types?
   YES → strong skill candidate (extract as standalone skill)
   NO  → weak candidate (may stay as rule subsection or become a reference file)

4. Can you define all four S=(C,π,T,R) components for it?
   C: When does it activate? (must be conditional, not always)
   π: Are the instructions self-contained?
   T: When is it done?
   R: What name and trigger phrases describe it?
   ALL FOUR → extract as skill
   MISSING ANY → keep as rule or merge into existing skill
```

---

## Classification Rubric

### Always System Rules (Never Extract)

| Content Type                        | Why It Stays                             | Example                                       |
| ----------------------------------- | ---------------------------------------- | --------------------------------------------- |
| Behavioral mandates                 | Applies to every action, not just some   | "Tool-first execution, never describe"        |
| Style/formatting preferences        | Always-on output constraint              | "Use CoD symbols, 3-8 words max"              |
| Safety constraints                  | Cannot be optional or on-demand          | "Never execute sudo in parallel"              |
| File creation restrictions          | Always-on resource constraint            | "No autonomous document generation"           |
| Configuration file restrictions     | Always-on write constraint               | "AGENTS.md: config only, no narratives"       |
| Enforcement checklists              | Meta-verification, applies to all output | "Before chat, verify: file ref? action verb?" |
| Anti-patterns (behavioral)          | Always-on behavioral boundary            | "Never print search results to chat"          |
| Decision flows (request routing)    | Always-on request classification         | "File context → file ops, not chat"           |
| Emergency protocols (unconditional) | Applies regardless of task context       | "If no verification possible → STOP"          |

### Always Skills (Always Extract)

| Content Type                       | Why It Extracts                          | Example                                    |
| ---------------------------------- | ---------------------------------------- | ------------------------------------------ |
| Multi-step procedural workflows    | On-demand, task-specific methodology     | "Δ1-Δ7 web search protocol"                |
| Research/analysis pipelines        | Only when research is needed             | "Deep research pattern (50+ refs)"         |
| Candidate generation + comparison  | Only for high-stakes decisions           | "3 divergent candidates → Condorcet"       |
| Iterative refinement loops         | Only when quality improvement is needed  | "Blind assertive critique → defense"       |
| Requirements discovery workflows   | Only when analyzing raw requests         | "CoK triples → MGPC inference"             |
| Session boundary management        | Only at natural breaks or context limits | "Continuation/handoff artifact generation" |
| Method/approach selection matrices | Only when choosing strategy              | "PE method selection by stakes/complexity" |
| Domain-specific knowledge matrices | Only when working in that domain         | "CoK patterns by domain + source tiers"    |

### Judgment Calls (Context Dependent)

| Content Type                   | Factors                                 | Lean Toward                        |
| ------------------------------ | --------------------------------------- | ---------------------------------- |
| Tool selection priority tables | Used on every tool call vs. on-demand?  | Rule (if always consulted)         |
| Verification protocols (ReAct) | Mandatory on every action vs. optional? | Rule (if mandatory)                |
| Token budget guidance          | Always applied vs. task-specific?       | Rule (always applied)              |
| Knowledge gathering patterns   | Always-first vs. only when uncertain?   | Skill (conditional on uncertainty) |
| SoT integration patterns       | Always-on structure vs. on-demand?      | Rule (if mandated always)          |

---

## Worked Example: Prompt_Optimization_Rules.md → 5 Skills

This is the actual decomposition performed in the PE_Library thread.

### Source File

`Prompt_Optimization_Rules.md` (~750 lines) — monolithic system rule containing
PE method reference, requirements inference, candidate generation,
self-refine protocol, Condorcet comparison, continuation/handoff templates,
and pipeline composition patterns.

### Section-by-Section Classification

| Section (approx lines)            | C=always?   | Classification  | Extracted As                           |
| --------------------------------- | ----------- | --------------- | -------------------------------------- |
| Core Mandate (L1-10)              | ✓ always    | System rule     | Kept (or moved to activation rule)     |
| PE Methods Reference (L12-155)    | Conditional | Skill           | `selecting-pe-methods`                 |
| Phase 0: Bottom-Up Saturation     | Conditional | Skill           | `inferring-requirements`               |
| Phase 0.5: Top-Down Intent        | Conditional | Skill           | (merged into inferring-requirements)   |
| Phase 2: Generate 3 Candidates    | Conditional | Skill           | `think-deeper`                         |
| Phase 2.5: Self-Refine Each       | Conditional | Skill           | `adversarial-self-refine`              |
| Phase 3: Condorcet Comparison     | Conditional | Skill           | (merged into think-deeper)             |
| Phase 4: Continuation Check       | Conditional | Skill           | `continuation-and-handoff`             |
| Phase 5: Continuation/Handoff     | Conditional | Skill           | (merged into continuation-and-handoff) |
| Pipeline Composition Patterns     | Conditional | Skill reference | `continuation-and-handoff/references/` |
| Final Output format               | Conditional | Skill           | (merged into think-deeper Phase 4)     |
| Appendix A: Self-Refine Reference | Conditional | Skill           | (merged into adversarial-self-refine)  |

### What Remained as System Rule

After extraction, `Prompt_Optimization_Rules.md` was effectively replaced by:

- `Skill_Activation_Rules.md` — the always-on mandate to evaluate and invoke skills
- The individual skills contain all procedural content

### Key Decisions Made

1. **Self-Refine appeared in two places** (Phase 2.5 + Appendix A) → merged into
   single `adversarial-self-refine` skill. The multi-candidate skill references it
   via sub-agent dispatch, not by duplicating it.

2. **Pipeline patterns** were too detailed for the main continuation skill →
   moved to `references/pipeline-patterns.md` (L3 progressive disclosure).

3. **Core Mandate** became a system rule (`Skill_Activation_Rules.md`)
   because it applies to EVERY request, not just prompt optimization.

4. **Method Selection** was extracted as its own skill because choosing a method
   is a distinct task from executing any specific method.

---

## Worked Example: Timeliness_Rules.md (Planned, Not Yet Executed)

### Current Structure (~300 lines)

| Section                       | C=always?   | Classification  | Extraction Target              |
| ----------------------------- | ----------- | --------------- | ------------------------------ |
| Core Mandate + Principle      | ✓ always    | System rule     | KEEP — the WHY of verification |
| CoK Methodology               | Conditional | Skill           | → `deep-research` skill        |
| Domain Knowledge Matrix       | Conditional | Skill reference | → `deep-research/references/`  |
| Source Tiers + Temporal Rules | Conditional | Skill reference | → `deep-research/references/`  |
| Tool Selection + CoK Depth    | Conditional | Skill reference | → `deep-research/references/`  |
| Query Patterns + Fallback     | Conditional | Skill reference | → `deep-research/references/`  |
| Δ1-Δ7 Web Search Protocol     | Conditional | Skill           | → `deep-research` skill        |
| Deep Research Pattern         | Conditional | Skill           | → `deep-research` skill        |
| Knowledge Sources table       | Conditional | Skill reference | → `deep-research/references/`  |
| LLM Pattern Files Protocol    | Conditional | Skill           | → `deep-research` skill        |
| Triggers (Execute If/Skip If) | ✓ always    | System rule     | KEEP — activation criteria     |
| Emergency Protocol            | ✓ always    | System rule     | KEEP — safety constraint       |
| Enforcement checklist         | ✓ always    | System rule     | KEEP — compliance verification |

### Residual Rule File After Extraction

```text
# RULE: Timeliness - Knowledge Saturation

Core Mandate: Training knowledge = baseline only → saturate with current knowledge.
Principle: External verification mandatory for temporal/verifiable claims.

Triggers:
  Execute If: Factual claims | Current knowledge | Comparisons | etc.
  Skip If: Pure logic | Math proofs | Creative writing | Opinion

Emergency Protocol:
  IF external verification impossible → STOP → STATE uncertainty → NEVER present as authoritative

Enforcement:
  - Always cite sources
  - Always note search date
  - Always separate found/inferred
  - Always expose contradictions

(Full methodology: invoke the knowledge saturation or deep research capability)
```

~30 lines remain. The 270+ lines of methodology move into skills.

---

## Worked Example: Tool_Execution_Rules.md (Planned, Not Yet Executed)

### Current Structure (~650 lines)

| Section                           | C=always?   | Classification | Extraction Target                        |
| --------------------------------- | ----------- | -------------- | ---------------------------------------- |
| §1 Anti-Patterns                  | ✓ always    | System rule    | KEEP                                     |
| §2 Configuration Files            | ✓ always    | System rule    | KEEP                                     |
| §3 Verified Tool Constraints      | ✓ always    | System rule    | KEEP                                     |
| §4 Tool Discovery Protocol        | ✓ always    | System rule    | KEEP                                     |
| §5 Tool Selection Priority        | ✓ always    | System rule    | KEEP                                     |
| §5a Knowledge Gathering Mandate   | Conditional | Skill          | → already in `deep-research`             |
| §6 Efficiency Patterns            | ✓ always    | System rule    | KEEP                                     |
| §7 ReAct Verification Protocol    | ✓ always    | System rule    | KEEP (mandatory on every action)         |
| §7a File Editing Protocol         | ✓ always    | System rule    | KEEP                                     |
| §8 On-The-Fly Script Execution    | Conditional | Skill          | → `ephemeral-analysis` skill (potential) |
| §9 File Creation Constraints      | ✓ always    | System rule    | KEEP                                     |
| §10-13 Request Interpretation     | ✓ always    | System rule    | KEEP                                     |
| §14-16 Failure & Recovery         | ✓ always    | System rule    | KEEP                                     |
| Decision Flow                     | ✓ always    | System rule    | KEEP                                     |
| Continuation Protocol Integration | Conditional | Skill          | → already in `continuation-and-handoff`  |
| Examples                          | ✓ always    | System rule    | KEEP (illustrate the mandate)            |
| CoD Application Surfaces          | ✓ always    | System rule    | KEEP                                     |

### Key Observation

Tool_Execution_Rules.md is mostly system rules (always-on mandates).
Only 2-3 sections are conditionally activated procedures.
After extraction, the file shrinks modestly (~550 lines → ~480 lines).

This is expected — tool execution rules ARE behavioral mandates.
The file's purpose is to enforce always-on behavior, not to teach procedures.

---

## Worked Example: Chain_of_Draft_Rules.md (No Extraction Needed)

### Current Structure (~500 lines)

| Section               | C=always? | Classification | Reason                              |
| --------------------- | --------- | -------------- | ----------------------------------- |
| Quick Reference       | ✓ always  | System rule    | Always-on formatting mandate        |
| Symbol Semantics      | ✓ always  | System rule    | Always-on symbol vocabulary         |
| Model-Tier Adaptation | ✓ always  | System rule    | Always-on tier-specific rules       |
| When to Apply         | ✓ always  | System rule    | Always-on activation criteria       |
| Verbosity Escalation  | ✓ always  | System rule    | Always-on escalation triggers       |
| Dual Purposes         | ✓ always  | System rule    | Always-on usage guidance            |
| Pattern Examples      | ✓ always  | System rule    | Always-on reference examples        |
| Confidence Markers    | ✓ always  | System rule    | Always-on claim annotation          |
| Anti-Patterns         | ✓ always  | System rule    | Always-on behavioral boundaries     |
| Contrastive CoD       | ✓ always  | System rule    | Always-on disambiguation method     |
| Thinking Traces       | ✓ always  | System rule    | Always-on internal trace formatting |
| Step-Back Abstraction | ✓ always  | System rule    | Always-on reasoning pattern         |
| SoT Integration       | ✓ always  | System rule    | Always-on structural recommendation |
| Token Budget          | ✓ always  | System rule    | Always-on cost awareness            |
| ASCII Diagrams        | ✓ always  | System rule    | Always-on formatting enforcement    |
| SemBr Markdown Style  | ✓ always  | System rule    | Always-on markdown formatting       |
| Enforcement           | ✓ always  | System rule    | Always-on compliance checklist      |

### Key Observation

**Chain_of_Draft_Rules.md extracts ZERO skills.**

CoD is a formatting/style preference — it applies to ALL output, ALL the time.
Every section has C=always. The entire file is a system rule.

This is the correct outcome. Not every system rule file contains extractable skills.
The classification criterion correctly identifies this as fully system-rule content.

---

## Extraction Plan Template

When refactoring a system rule file, produce this table:

```text
SOURCE FILE: [filename]
TOTAL LINES: [N]

| # | Section Name              | Lines   | C=always? | Classification | Target                     |
|---|---------------------------|---------|-----------|----------------|----------------------------|
| 1 | [section]                 | L1-L20  | ✓/✗       | rule/skill     | KEEP / → skill-name        |
| 2 | [section]                 | L21-L80 | ✓/✗       | rule/skill     | KEEP / → skill-name        |
...

EXTRACTION SUMMARY:
  Sections staying as rules: [N] ([M] lines)
  Sections extracting as skills: [N] ([M] lines)
  New skills to create: [list with names]
  Estimated residual rule file: [N] lines
```

---

## The Residual Rule Pattern

After extracting skills, the system rule file retains this structure:

```text
# RULE: [Name]

[1-2 line core mandate — the WHY]
[1-line principle — the philosophical basis]

---

## Triggers
[When this mandate activates — typically "always" for rules]

## Enforcement
[Checklist for compliance verification]

## Emergency Protocol (if applicable)
[What to do when the mandate cannot be satisfied]

(Full methodology: invoke the [capability name] as needed)
```

The residual file should be **dramatically shorter** than the original.
If it's not, re-examine whether you over-classified sections as "always."

---

## Handling Cross-References After Extraction

### Rule: No Cross-File References

System rules and skills must NOT reference each other by file path.

| Forbidden                               | Allowed                                    |
| --------------------------------------- | ------------------------------------------ |
| "See Tool_Execution_Rules.md §5a"       | "See the knowledge gathering mandate"      |
| "Run the adversarial-self-refine skill" | "Apply iterative blind assertive critique" |
| "Per Timeliness_Rules.md Δ3"            | "Per the web search execution protocol"    |

### Why

- System rules are loaded independently (no guaranteed load order)
- Skills are loaded on-demand (may not be in context)
- Cross-references create implicit dependencies
- Conceptual references work in any context

### The Bridge

The `Skill_Activation_Rules.md` system rule is the bridge:
it mandates that agents evaluate `[SKILL]`-labeled tools on every request.
This ensures skills are discovered and invoked without the system rule
needing to name them.

---

## Common Refactoring Mistakes

```text
✗ Extracting safety constraints as skills (they lose always-on enforcement)
✓ Safety constraints stay as system rules — they apply unconditionally

✗ Keeping 200-line procedural workflows in system rules (wastes always-on context)
✓ Procedural workflows extract as skills — loaded only when needed

✗ Creating skills for formatting preferences (CoD, SemBr, etc.)
✓ Formatting preferences are always-on — they stay as system rules

✗ Duplicating content in both the residual rule and the extracted skill
✓ Residual rule has brief conceptual reference; skill has full methodology

✗ Extracting everything, leaving an empty rule file
✓ The mandate/principle/enforcement MUST remain — that's the rule's purpose

✗ Creating one mega-skill from all extracted content
✓ Each distinct procedure with its own C becomes a separate skill

✗ Forgetting to update the activation rule when new skills are created
✓ New skills are auto-discovered via [SKILL] tag — but verify trigger phrases
```

---

## Metrics for Successful Refactoring

After refactoring a system rule file:

| Metric                           | Target             | Red Flag                          |
| -------------------------------- | ------------------ | --------------------------------- |
| Residual rule file length        | 20-40% of original | >70% means under-extracted        |
| Number of skills extracted       | 1-5 per file       | >8 means over-fragmented          |
| Skill body length                | ≤500 lines each    | >500 needs progressive disclosure |
| Cross-file references remaining  | 0                  | Any → violation                   |
| C=always sections in skills      | 0                  | Any → misclassified               |
| C=conditional sections in rules  | 0                  | Any → missed extraction           |
| Duplication between rule + skill | 0                  | Any → incomplete cleanup          |

---

## Thread Narrative: How PE_Library Decomposed Its System Rules

### Starting State

One monolithic file (`Prompt_Optimization_Rules.md`, ~750 lines) containing:

- Method selection matrices
- Requirements inference (CoK + MGPC)
- Candidate generation + divergence protocols
- Self-refine functor + termination detection
- Condorcet pairwise comparison
- Continuation/handoff templates + pipeline patterns
- Pipeline composition patterns + capability cascade

All loaded into system prompt on every request — 750 lines of context
consumed whether the task needed any of it or not.

### Classification Phase

Applied C=always vs C=conditional to each section:

- Method selection → conditional (only when choosing approach) → skill
- Requirements inference → conditional (only when analyzing requests) → skill
- Candidate generation + Condorcet → conditional (only for high-stakes decisions) → skill
- Self-refine → conditional (only when improving artifacts) → skill
- Continuation/handoff → conditional (only at session boundaries) → skill
- Core mandate ("always evaluate skills") → always → became a NEW system rule

### Extraction Phase

5 skills created, each with full S=(C,π,T,R):

- `selecting-pe-methods` (246 lines)
- `inferring-requirements` (243 lines)
- `think-deeper` (formerly multi-candidate-condorcet, 426 lines)
- `adversarial-self-refine` (169 lines)
- `continuation-and-handoff` (338 lines)

### Evolution Phase

Skills evolved through multiple iterations:

1. Initial extraction (v1.0) — basic functional skills
2. S=(C,π,T,R) audit — added missing When NOT to Use, Termination tables,
   Anti-Patterns, Environment Compatibility sections to all skills
3. Sub-agent dispatch patterns (v2.0) — added natural language sub-agent
   spawning patterns to think-deeper for Phase 1 (generation),
   Phase 2 (blind attack), Phase 3 (compare)
4. Compositional gates — added capability-based dependency enforcement
   between skills (e.g., multi-candidate requires self-refine)
5. Academic grounding — aligned with S=(C,π,T,R) formalization from
   Jiang et al. SoK paper, moved citations to References sections only

### New System Rule Created

`Skill_Activation_Rules.md` (193 lines) — the always-on mandate that:

- Identifies all `[SKILL]`-labeled tools at session init
- Evaluates every skill description against every substantive request
- Invokes all relevant skills and follows their instructions
- Handles sub-agent dispatch via sub-agents or sequential fallback

### Result

- **Before:** 1 monolithic rule file (750 lines, always loaded)
- **After:** 1 activation rule (193 lines, always loaded) +
  5 skills (1422 lines total, loaded only when relevant) +
  1 meta-skill for creating more skills (500 lines)
- **Context savings:** ~550 lines removed from always-on context
  (loaded on-demand only when task matches)

### What Stays as System Rules (Across All Files)

| File                            | Lines | Status       | Extractable?                    |
| ------------------------------- | ----- | ------------ | ------------------------------- |
| Chain_of_Draft_Rules.md         | ~500  | Fully rule   | No — all C=always (formatting)  |
| Skill_Activation_Rules.md       | ~193  | Fully rule   | No — all C=always (mandate)     |
| Tool_Execution_Rules.md         | ~650  | Mostly rule  | ~2-3 sections extractable       |
| Timeliness_Rules.md             | ~300  | Mostly skill | ~30 lines stay, rest extracts   |
| Workspace_Organization_Rules.md | ~?    | Fully rule   | No — all C=always (constraints) |
