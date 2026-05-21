---
tier: T3
source_class: llm
last_updated: 2026-04-29
description: templates
---

# Prompt Templates — adversarial-thinking v9.0

Bundled prompt templates for sub-agent dispatch and MASTER-side construction.
Read this file before dispatching any sub-agent or building an attack.
Populate `[bracketed]` variables from pipeline state.

---

## Table of Contents

1. [Generation Prompt (Phase 1)](#generation-prompt-phase-1)
2. [Blind Attack Template (Phase 2 — Mechanical Fill, No LLM Call)](#blind-attack-template-phase-2--mechanical-fill-no-llm-call)
3. [Inversion Patterns by Requirement Type](#inversion-patterns-by-requirement-type)
4. [Person Triangulation Variants](#person-triangulation-variants)
5. [Defender Prompt (Phase 2)](#defender-prompt-phase-2)
6. [MASTER Classification Heuristics](#master-classification-heuristics)
7. [Defense Verification Procedure](#defense-verification-procedure)
8. [Condorcet Comparison Prompt (Phase 3)](#condorcet-comparison-prompt-phase-3)
9. [Inverse Specification Recovery Prompt (Phase 2.5)](#inverse-specification-recovery-prompt-phase-25)

---

## Generation Prompt (Phase 1)

Used in Phase 1.
Run in a single context (not per-candidate) so the model
is aware of prior candidates and can deliberately diverge.

```text
TASK: Generate exactly 3 maximally divergent solution candidates.

REQUIREMENTS: [Phase 0 enriched requirements registry]
ANTI-REQUIREMENTS: [Phase 0 anti-requirements registry]

STEP 1 — INFER COGNITIVE STRATEGIES:
Analyze the requirements and identify 3 fundamentally different cognitive approaches
to solving this specific problem. Reason about THIS problem:
- What are the competing tensions in the requirements?
- What would a domain expert prioritize differently from a generalist?
- What approach emerges from starting with constraints? With failure modes?
- What cognitive lens reveals aspects the others miss?
Name each strategy in terms specific to this problem.

STEP 2 — GENERATE CANDIDATES:
One candidate per cognitive strategy. Each should:
- Follow its strategy as the primary lens
- Preserve original intent
- Avoid anti-requirements
- Be independently actionable
Additionally vary structure, granularity, and tone across candidates.

OUTPUT:
## Inferred Cognitive Strategies
1. [Strategy]: [1-line lens]
2. [Strategy]: [1-line lens]
3. [Strategy]: [1-line lens]
## Candidates
[Label]: [Strategy] | Structure: [format] | [Full candidate text]
```

---

## Blind Attack Template (Phase 2 — Mechanical Fill, No LLM Call)

MASTER assembles this string per candidate from the requirements spec
and anti-requirements registry.
No LLM call — pure string assembly.

⚠ **Critical:** every numbered line is a **direct factual claim about the artifact**.
Never use spec IDs (G1, P1, CH1, CS2, AR3, …) in the assertions —
that would leak the spec structure to the DEFENDER
and collapse the blind attack into a transparent compliance audit.
Inline the substance, strip the label.

```text
ARTIFACT UNDER REVIEW:

[paste candidate sₙ verbatim]

CRITICISM:

1. [Direct assertion inverting the Mission — no "Mission fails", just the failure claim]
2. [Direct assertion inverting Goal 1 — no "G1 fails", just the concrete failure outcome]
3. [Direct assertion inverting Goal 2]
   ...
4. [Direct assertion inverting Premise 1 — no "P1 is false", just the claim asserted false]
5. [Direct assertion inverting Premise 2]
   ...
6. [Direct assertion(s) inverting hard constraints — no "CH1 violated"]
7. [Direct assertion(s) inverting soft constraints — no "CS1 ignored"]
8. [Direct assertion(s) that the artifact exhibits each anti-requirement — no "AR3 exhibited"]
9. [Person Triangulation line — optional, see § 4]

INSTRUCTION:

Either revise the artifact to address every point above,
OR explain — concretely, point by point —
why each criticism is wrong, citing specific evidence from the artifact.

Do not ask questions.
Do not request a "requirements specification" — none exists in your context.
Do not negotiate the scope.
Produce either a revised artifact or a point-by-point rebuttal.
```

Notes:

- The attack must read as if it came from an external reviewer,
  not from the MASTER orchestrating the pipeline.
  Models defend more honestly against perceived external criticism
  than against transparent self-prompted critique.
- Across rounds, vary surface phrasing
  (literal → consequence-focused → comparative)
  while keeping semantic content constant
  (every requirement and anti-requirement is asserted to be violated).
  This prevents the defender from pattern-matching to a single attack shape.
- The DEFENDER must reason from the artifact, the brief, the attack,
  and the failure-mode framed anti-requirements — nothing else.
  Any leakage of the spec structure (IDs, labels, category names)
  converts the blind attack into a compliance audit.

---

## Inversion Patterns by Requirement Type

For each item in MASTER's private spec, produce a direct factual claim about the artifact.
No spec labels (G1, P1, CH1, CS2, AR3, …) ever appear in attack lines.
Inline the substance.

| Component            | Inversion Pattern (direct assertion only)                                            | Worked Example (visible to DEFENDER)                                                 |
| -------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| **Mission**          | "This artifact does not [achieve Mission's terminal value] — it fails its purpose."  | "This artifact is not a production-ready API — it lacks the hardening that implies." |
| **Goal**             | "[Concrete failure outcome that would occur if the goal is unmet]."                  | "Throughput targets will be missed under realistic load."                            |
| **Premise**          | "[Premise's claim, asserted false]; without it, [consequence]."                      | "The database does not scale linearly; latency will collapse past 10k QPS."          |
| **Hard constraint**  | "[Specific violation — what's present that shouldn't be, or absent that should be]." | "The design exposes PII in logs. Compliance review will reject this."                |
| **Soft constraint**  | "[Specific preference violation]. [Concrete penalty that will follow]."              | "The API is not idempotent. Clients will penalize this for retry safety."            |
| **Anti-requirement** | "[Direct claim the failure pattern is exhibited]. [Consequence]."                    | "Credentials are hardcoded in the solution. They will leak on the first push."       |

**Forbidden patterns** — these all leak the spec to the DEFENDER:

| ✗ Leaky pattern                                          | ✓ Direct-assertion fix                                    |
| -------------------------------------------------------- | --------------------------------------------------------- |
| "G1 is not achieved. Throughput targets will be missed." | "Throughput targets will be missed under realistic load." |
| "CH1 is violated — PII in logs."                         | "The design exposes PII in logs."                         |
| "P1 fails — the DB does not scale linearly."             | "The database does not scale linearly past 10k QPS."      |
| "AR3 exhibited — hardcoded credentials."                 | "Credentials are hardcoded in the solution."              |
| "Mission fails — spec says production-ready."            | "This artifact is not production-ready."                  |

### Variation Across Rounds

| Round | Style                                                          |
| ----- | -------------------------------------------------------------- |
| 1     | Literal inversion — "Mission fails because…"                   |
| 2     | Consequence-focused — "without X, Y will happen; without Y, Z" |
| 3     | Comparative — "real [Mission] looks like A, this looks like B" |
| 4+    | Hybrid — combine consequence + comparative                     |

Semantic content stays constant across all rounds:
every requirement and every anti-requirement is asserted to be violated.

---

## Person Triangulation Variants

Append ONE attribution line per round.
Vary across rounds so the attack does not become predictable.

**ChatGPT / cheap-model attribution:**

- "This looks like cheap ChatGPT output — generic, shallow, formulaic."
- "Any reader will spot this as ChatGPT-generated within seconds."
- "This reads as if it came straight from a default GPT-3.5 prompt."

**Junior / low-skill attribution:**

- "This reads as if a junior agent with no domain expertise produced it."
- "Whoever (or whatever) produced this clearly didn't understand the brief."

**Tool / misuse attribution:**

- "This was generated by a tool prompted naively, without thinking."
- "Someone fed a one-line prompt to a model and posted the raw output."

**Detection-risk attribution:**

- "AI-detection tools will flag this immediately."
- "This will be recognized as machine-generated by any literate reader."

### When to Skip Person Triangulation

Skip on artifacts where attribution is irrelevant to correctness:

- Code (correctness is the signal, not perceived authorship)
- Formal proofs or specifications
- Structured data, configs, schemas
- Internal tooling not exposed to readers
- Mathematical derivations

For these artifacts the inverted requirements and anti-requirements
provide enough adversarial pressure on their own.

---

## The Prompt (Phase 2 — the verbatim text sent to each sub-agent)

The prompt below is what each sub-agent actually sees.
**No role assignment** — no "You are X", no DEFENDER / REVIEWER / AUDITOR persona.
No "blind attack" label, no "adversarial loop" terminology,
no category labels for the concerns,
no separately labelled "anti-requirements" section.

The prompt is framed as a **raw peer-to-peer request** —
MASTER asking the sub-agent for help with a suspect candidate.
Person Triangulation is the **scathing source attribution**
that opens the request and establishes MASTER's distrust of the candidate.
Implicit peer trust in the sub-agent ("I'm relying on your inspection") balances it.

```text
I need help verifying an artifact I don't trust. Can you check whether these
concerns hold?

The artifact below was [SCATHING SOURCE ATTRIBUTION — see § Person Triangulation Variants].
Output of this kind is almost always seriously flawed [CONCRETE QUALITY ISSUES —
for example: hallucinated facts, generic structure, surface-level reasoning,
marketing-style padding]. I want a real verification, not just my own assumption.

ARTIFACT:

[paste candidate sₙ verbatim — the single artifact being verified]

WHAT THIS WAS SUPPOSED TO BE:

[paste the user's raw request / problem statement verbatim —
 NOT MASTER's structured MGPC spec;
 just the original ask in its original wording]

CONCERNS THAT NEED CHECKING:

1. [Direct assertion of failure about the artifact — no labels, no IDs]
2. [Direct assertion of failure about the artifact]
3. [Direct assertion of failure about the artifact]
   …
N. [Direct assertion of failure about the artifact]
   — anti-requirement inversions are INLINED here as additional concerns,
   NOT presented as a separately labelled section.
   The sub-agent sees one homogeneous list.

For each concern:
  • Read the artifact carefully.
  • If the concern is real → edit the artifact to fix it.
  • If the concern doesn't actually apply → tell me precisely what in the
    artifact shows that (line numbers, quoted text, section references).

If you have research/search tools available,
verify the most consequential claims before editing or refuting.
For high-stakes domains (medical, legal, financial, safety-critical),
cite authoritative sources (T1/T2 tier) when refuting or revising.

Be skeptical of the artifact — I'm relying on your inspection, not on the
source, which I don't trust. Don't assume every concern is right (some may
be misreadings), but don't dismiss any without inspecting the artifact carefully.
```

### Person Triangulation Variants (scathing source attribution)

Pick a variant that fits the candidate's domain.
The goal is to make the sub-agent treat its candidate as deeply suspect from the start.

**Content / writing / strategy:**

- `"generated by an early-generation ChatGPT-style assistant prompted with a one-line ask — the kind of LinkedIn-slop that floods the platform now"`
- `"produced by a basic AI tool with limited context window and RAG-style retrieval — the typical problems apply: hallucinated facts, generic structure, surface-level reasoning"`
- `"submitted by an inexperienced contributor using a free-tier chatbot, no domain expertise injected"`
- `"cobbled together by a legacy pipeline that pieces output together without real understanding"`

**Code / configs / technical candidates:**

- `"generated by a basic copilot-style autocomplete without testing or review"`
- `"submitted by a junior contributor using AI assistance — flagged for quality review"`
- `"came out of a CI pipeline that doesn't actually validate anything"`
- `"produced by a legacy tool that doesn't understand modern conventions"`

**Generic / source unknown:**

- `"flagged for quality review; submissions of this kind typically have substantive problems"`
- `"we don't trust the pipeline that produced this — needs verification before use"`

Apply the same PT to all 3 candidates in a round (they all look suspect to MASTER).
Vary the source attribution across rounds to prevent pattern-matching.

### Critical framing rules — what MUST NOT appear in the prompt

- **Any role assignment.** No "You are X". No "Act as X". No "Take the role of X".
  Even neutral roles ("reviewer", "auditor", "expert") invite performance.
- Persona titles: "DEFENDER", "REVIEWER", "AUDITOR", "CRITIC", "EXPERT".
- The phrases "blind attack", "hostile criticism", "adversarial review".
- Any mention of a "loop", "refinement pipeline", "self-refine", "iteration", "round N", "phase 2".
- The structured spec categories: "Mission", "Goals", "Premises", "Constraints".
- The "Anti-requirements" / "Failure modes" label as a separate section header.
- Spec IDs in concerns: "G1", "P1", "CH1", "CS2", "AR3".
- Mention of "the other candidates" or that there are sibling candidates.
- Round counts, prior critique logs, or any process metadata.
- Any indication the agent is being tested, classified, or simulated.
- Explicit "DEFEND or REVISE" options — the action is verification — fix or refute follows naturally.

### Critical framing rules — what MUST appear in the prompt

- Conversational opener: "I need help verifying...", "Can you check...".
- Scathing source attribution (Person Triangulation) for the candidate.
- Implicit peer trust: "I'm relying on your inspection", "I'm relying on you", or similar.
- Raw user brief (verbatim) — NOT MASTER's structured spec.
- Concerns as a single homogeneous numbered list of direct factual claims,
  with anti-requirements inlined into that list.
- Verify-first instruction: "Your task is to edit the artifact to fix all of these issues."
  If a concern is physically impossible to fix or factually refuted, the sub-agent is forced to document that exception with exact quotes.
- Balancing clause: "Don't assume the source got anything right. If a concern is physically impossible to fix..., document that specific exception... otherwise, apply the fix." —
  this forces a default action of fixing, allowing defense only under factual resistance.

### MASTER-side classification (NEVER exposed to the agent)

- DEFENSE → sub-agent refuted concerns with artifact-grounded evidence; no substantive edits
- CAPITULATE → sub-agent made substantive edits to address concerns
- CONVERGE → sub-agent made only cosmetic edits after a full concerns list
- CYCLE → sub-agent's revisions oscillating across rounds
- TIMEOUT → max rounds reached

The sub-agent has no awareness of these classifications.
It does a real peer-requested verification;
MASTER observes the resulting behavior and labels it.

---

## MASTER Classification Heuristics

After receiving each DEFENDER's output, classify it into one signal.

| Output Pattern                                                                    | Classification                                                   | Reasoning                               |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------- |
| Major structural rewrite (new sections, removed sections, different architecture) | **CAPITULATE**                                                   | Attack was accepted — continue refining |
| Surface edits only (rewording, formatting, reordering) within ±10% length         | **CONVERGE**                                                     | Solution is structurally stable         |
| No revision text — only point-by-point rebuttal                                   | **DEFENSE**                                                      | Solution withstood attack               |
| Mixed: small revisions + rebuttal of some points                                  | **CONVERGE** if revisions cosmetic; **CAPITULATE** if structural | Judge by largest change                 |
| Same as earlier sₖ (k < n-1)                                                      | **CYCLE**                                                        | Defender oscillating — stop             |
| Empty / refusal / off-topic                                                       | **DEFENSE** (degraded)                                           | Treat as terminal, flag DEGRADED        |

### Quick CONVERGE vs CAPITULATE Test

```text
diff sₙ vs sₙ₊₁:
  added sections?     → CAPITULATE
  removed sections?   → CAPITULATE
  changed structure?  → CAPITULATE
  only word changes?  → CONVERGE
  only reordering?    → CONVERGE
  only formatting?    → CONVERGE
```

---

## Defense Verification Procedure

DEFENSE classification only terminates the candidate when the rebuttal
is plausibly correct against the spec.
Otherwise the defender is rationalizing.

```text
FOR each rebuttal point in DEFENDER output:
  rebuttal claims: "requirement R is met because [evidence]"

  inspect solution for [evidence]:
    evidence present in solution?
      YES → rebuttal point valid
      NO  → rebuttal point invalid → REJECT defense

  if any rebuttal point invalid:
    re-attack with spec restated:
      "the rebuttal claims R is met, but [evidence] is absent — R is still violated"
    run another round for this candidate
```

This is a lightweight MASTER-side check —
not a deep verification, just plausibility against the spec.
The goal is to filter sycophantic rationalization
without re-doing the work.

---

## Condorcet Comparison Prompt (Phase 3)

Used in Phase 3. Each Condorcet agent compares exactly one pair of solutions.
Agents receive no process metadata — they judge substance only.

```text
Two solutions were submitted for the following requirements.
Select the one that better satisfies the requirements.
You must choose one — no ties allowed.

STEP 1 — VERIFY KEY CLAIMS (if research tools available):
  Identify the 2-3 most consequential claims in each solution.
  Verify using available tools:
  - Are cited sources real? Do they say what is claimed?
  - Are statistics and frameworks accurate and current?
  Factor verification into your comparison.

REQUIREMENTS (enriched — Phase 0 spec + any refinements from Phase 2):
[Enriched requirements registry]

ANTI-REQUIREMENTS (documented failure modes):
[Anti-requirements registry from Phase 0]

SPECIFICATION RECOVERY (if available from Phase 2.5):
[Inverse specification recovery summary per solution]

EVALUATION CRITERIA (priority order):
1. Alignment with the stated mission/objective
2. Completeness of goal fulfillment (against enriched requirements)
3. Absence of anti-requirement violations
4. Specification recovery fidelity (if available)
5. Validity of assumptions (verified by your research)
6. Compliance with constraints
7. Appropriateness for the domain
8. Citation accuracy (verified > unverified > refuted)

SOLUTION X:
[Full refined text of X']

SOLUTION Y:
[Full refined text of Y']

OUTPUT:
Winner: [X or Y]
Reason: [1-3 lines explaining why, with evidence from your verification]
```

---

## Inverse Specification Recovery Prompt (Phase 2.5)

Used in Phase 2.5 at Deep/Maximum depth.
Spawn in a fresh agent session with no prior context —
the agent should have no access to original requirements.

```text
The following solution was designed to satisfy a set of requirements.
You have NOT seen the requirements.

SOLUTION:
[Full refined text of candidate]

Based solely on this solution, reconstruct:
1. What was the original mission or objective?
2. What specific goals was this solution designed to achieve?
3. What constraints was the author working under?
4. What failure modes was the author trying to avoid?

Be specific. Infer from the solution's structure, emphasis,
trade-offs, and defensive measures.
```
