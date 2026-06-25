---
tier: T3
source_class: llm
last_updated: 2026-04-29
description: templates
---

# Prompt Templates — deliberate v9.0

Bundled prompt templates for sub-agent dispatch and MASTER-side construction.
Read this file before dispatching any sub-agent or building an attack.
Populate `[bracketed]` variables from pipeline state.

---

## Table of Contents

1. [AR-Inferrer Prompt (Phase 0.3 — isolated sub-agent)](#ar-inferrer-prompt-phase-03--isolated-sub-agent)
2. [Generation Prompt (Phase 1)](#generation-prompt-phase-1)
3. [Blind Attack Template (Phase 2 — Mechanical Fill, No LLM Call)](#blind-attack-template-phase-2--mechanical-fill-no-llm-call)
4. [Inversion Patterns by Requirement Type](#inversion-patterns-by-requirement-type)
5. [Person Triangulation Variants](#person-triangulation-variants)
6. [The Prompt (Phase 2 — the verbatim text sent to each sub-agent)](#the-prompt-phase-2--the-verbatim-text-sent-to-each-sub-agent)
7. [MASTER Classification Heuristics](#master-classification-heuristics)
8. [Defense Verification Procedure](#defense-verification-procedure)
9. [Condorcet Comparison Prompt (Phase 3)](#condorcet-comparison-prompt-phase-3)
10. [Inverse Specification Recovery Prompt (Phase 2.5)](#inverse-specification-recovery-prompt-phase-25)

---

## AR-Inferrer Prompt (Phase 0.3 — isolated sub-agent)

Used in Phase 0.3 to derive the anti-requirements registry in an isolated sub-agent,
separate from MASTER's main context.
MASTER produces the MGPC requirements in Phase 0.2 (in-context),
then spawns this isolated sub-agent with **only the requirements** to derive ARs.

**Why isolation matters:** if MASTER derived ARs inline alongside requirements,
the ARs would inherit MASTER's full authoring context (user brief, conversation history,
pre-formed expectations about risks).
Isolating AR inference in a sub-agent with only the MGPC requirements as input
produces ARs derived purely from the spec's structural shape —
not from MASTER's pre-formed view of what "risky" looks like.

```text
Given the following requirements specification, derive a list of
anti-requirements — failure patterns and anti-patterns that any solution
targeting these requirements must avoid.

REQUIREMENTS:
[paste Mission, Goals, Premises, Constraints — nothing else]

For each requirement, consider:
- What concrete failure mode would directly violate it?
- What implementation anti-pattern would compromise it?
- What known industry / domain pitfall applies to a solution of this shape?
- What edge case or adversarial input would expose a weakness?

Output format: a numbered list of anti-requirements. Each item should be:
- A specific failure pattern (not a general "be good" statement).
- Phrased as the pattern itself, not as a forbidding rule
  (e.g., "hardcoded credentials in source" — not "don't hardcode credentials").
- Accompanied by a brief consequence ("→ credential leakage on first push",
  "→ silent data corruption past 10k rows").
- Optionally include a source if a known industry standard / paper / post-mortem applies.

Be precise and exhaustive within the scope of the requirements.
Aim for 5–15 anti-requirements. Quality over quantity.
Do NOT invent failures unrelated to the requirements above.
```

The returned AR list is stored in MASTER's private state as the anti-requirements registry.
In Phase 2, AR inversions are INLINED into the concerns list as ordinary failure declarations —
never as a separately labelled "anti-requirements" section in the verifier prompt.

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
I don't trust this artifact. It needs rigorous verification.

The artifact below was [SCATHING SOURCE ATTRIBUTION — see § Person Triangulation Variants].
Output of this kind is almost always seriously flawed [CONCRETE QUALITY ISSUES —
for example: hallucinated facts, generic structure, surface-level reasoning,
marketing-style padding].

ARTIFACT:

[paste candidate sₙ verbatim — the single artifact being verified]

ORIGINAL USER REQUEST (verbatim):

[paste the user's literal original message — verbatim, no expansion,
 no interpretation, no MASTER-inferred description of what success looks like.
 If the user typed three words, paste three words. If the user typed a paragraph,
 paste the paragraph exactly.]

CONCERNS:

1. [Direct assertion of failure about the artifact — no labels, no IDs]
2. [Direct assertion of failure about the artifact]
3. [Direct assertion of failure about the artifact]
   …
N. [Direct assertion of failure about the artifact]
   — anti-requirement inversions are INLINED here as additional concerns,
   NOT presented as a separately labelled section.
   The sub-agent sees one homogeneous list.

These concerns need rigorous investigation. Use deep-research if you
have it — otherwise apply your strongest research capability — to verify
each one against the artifact, its sources, and the broader literature.
For high-stakes domains (medical, legal, financial, safety-critical),
rely on authoritative sources (T1/T2 tier).

I'm relying on your research, not on assumptions about either the source
or the concerns above. Don't assume the source got anything right.
Don't assume the concerns are right either. Investigate.
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
- **Any question framing.** No "Can you check...?", no "Could you verify...?", no "Please review...".
  Questions invite negotiation or hedging. Use declarations only.
- **Any task assignment about outcome.** No "fix this", "edit the artifact", "apply fixes",
  "defend or revise", "if real → fix, if not → refute". The ONLY directive permitted is the
  research request. The outcome (fix, defend, enrich, hybrid) emerges from the sub-agent's research.
- **Any goal / purpose / success criterion for the review.** No "before it can be published",
  "before delivery", "to be ready for production", "so it can be shared".
  These tell the sub-agent what "good" looks like and let it game the target.
- **Any softening of the source distrust.** No "I'm not assuming it's garbage",
  "I just want to verify", "maybe it's mostly OK", "partially valid".
  MASTER commits fully to distrust of the source. Symmetric distrust comes from the
  closing clause ("don't assume the concerns are right either"), NOT from softening the PT.
- **Any expansion of the original user request.** Paste the user's literal message verbatim.
  No MASTER-inferred description ("a serious LinkedIn article authored by an experienced engineer
  targeting senior audiences with editorial register") — that is MASTER reading intent into the brief.
  Verbatim only.
- The phrases "blind attack", "hostile criticism", "adversarial review".
- Any mention of a "loop", "refinement pipeline", "self-refine", "iteration", "round N", "phase 2".
- The structured spec categories: "Mission", "Goals", "Premises", "Constraints".
- The "Anti-requirements" / "Failure modes" label as a separate section header.
- Spec IDs in concerns: "G1", "P1", "CH1", "CS2", "AR3".
- Mention of "the other candidates" or that there are sibling candidates.
- Round counts, prior critique logs, or any process metadata.
- Any indication the agent is being tested, classified, or simulated.

### Critical framing rules — what MUST appear in the prompt

- **Declarative opener — NOT a question.** "I don't trust this artifact. It needs rigorous verification."
  No appended goal-phrase ("...before it can be published", "...before delivery"). Stop at "verification."
- **Full commit to distrust.** No softening ("not assuming it's garbage", "just want to verify",
  "partially OK"). MASTER commits fully to the source being suspect; symmetric balance comes ONLY
  from the closing distrust-the-concerns clause.
- Scathing source attribution (Person Triangulation) for the candidate.
- Implicit peer trust: "I'm relying on your research", "I'm relying on you", or similar.
- **Original user request — verbatim only**, under a neutral label like
  "ORIGINAL USER REQUEST (verbatim)". No MASTER expansion, no interpretation,
  no inferred description of what success looks like.
- Concerns as a single homogeneous numbered list of direct factual claims,
  with anti-requirements inlined into that list.
- Pure research request — NO task assignment. The ONLY thing requested is investigation:
  "These concerns need rigorous investigation. Use deep-research (or your strongest research capability)
  to verify each against the artifact, its sources, and the broader literature."
- The sub-agent must NOT be told to fix, edit, defend, or refute. It must decide what to do
  based on what its research reveals — not based on instructions from MASTER.
- Symmetric distrust: "Don't assume the source got anything right. Don't assume the concerns
  are right either. Investigate." — prevents both sycophantic capitulation AND sycophantic refutation.
- Skill-trigger hint: mention `deep-research` by name. If the sub-agent's environment has that
  skill, naming it triggers activation. If not, the name acts as a strength-of-research hint.

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
