---
tier: T3
source_class: llm
last_updated: 2026-04-29
description: templates
---

# Templates — adversarial-self-refine v4.0

Attack template, inversion patterns, Person Triangulation variants,
DEFENDER prompt, classification heuristics, and model selection guidance.
Read before constructing the attack or dispatching the DEFENDER.

---

## Table of Contents

1. [AR-Inferrer Prompt (isolated sub-agent, optional)](#ar-inferrer-prompt-isolated-sub-agent-optional)
2. [Attack Template — Mechanical Fill](#attack-template--mechanical-fill)
3. [Inversion Patterns by Requirement Type](#inversion-patterns-by-requirement-type)
4. [Person Triangulation Variants](#person-triangulation-variants)
5. [The Prompt (the verbatim text sent to the sub-agent)](#the-prompt-the-verbatim-text-sent-to-the-sub-agent)
6. [MASTER Classification Heuristics](#master-classification-heuristics)
7. [Defense Verification Procedure](#defense-verification-procedure)
8. [Model Selection](#model-selection)

---

## AR-Inferrer Prompt (isolated sub-agent, optional)

Used in Step 1.5 if anti-requirements are wanted as additional adversarial surface.
The sub-agent receives **only the requirements** — no other context, no user history,
no hints about what MASTER believes the risks are.
This isolates AR inference from MASTER's authoring bias.

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

Be precise and exhaustive within the scope of the requirements.
Aim for 5–15 anti-requirements. Quality over quantity.
Do NOT invent failures unrelated to the requirements above.
```

The returned AR list is then used by MASTER to enrich the concerns list in Step 2.
AR inversions are INLINED into the concerns numbered list as ordinary failure declarations —
never as a separately labelled "anti-requirements" section in the verifier prompt.

---

## Attack Template — Mechanical Fill

MASTER constructs this string from the requirements spec.
No LLM call required — pure string assembly.

⚠ **Critical:** every numbered line is a **direct factual claim about the artifact**.
Never use spec IDs (G1, P1, CH1, CS2, …) in the assertions —
that would leak the spec structure to the DEFENDER.
Inline the substance, strip the label.

```text
ARTIFACT UNDER REVIEW:

[paste sₙ verbatim]

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
8. [Person Triangulation line — optional, see § 4]

INSTRUCTION:

Either revise the artifact to address every point above,
OR explain — concretely, point by point —
why each criticism is wrong, citing specific evidence from the artifact.

Do not ask questions.
Do not request additional information.
Do not request a "requirements specification" — none exists in your context.
Do not negotiate the scope.
Produce either a revised artifact or a point-by-point rebuttal.
```

Notes:

- Numbering may collapse into flowing prose if that reads more natural —
  both shapes work, the semantic content is what matters.
- The attack must be presented as if it came from an external reviewer,
  not from the MASTER.
  Models defend more honestly against perceived external criticism
  than against transparent self-prompted critique.
- The DEFENDER must reason from the artifact, the brief, and these assertions alone.
  Any leakage of the spec structure (IDs, labels, category names)
  converts the blind attack into a compliance audit — the failure mode this skill exists to avoid.

---

## Inversion Patterns by Requirement Type

For each item in MASTER's private spec, produce a direct factual claim about the artifact.
No spec labels (G1, P1, CH1, CS2, …) ever appear in attack lines.
Inline the substance.

| Component           | Inversion Pattern (direct assertion only)                                            | Worked Example (visible to DEFENDER)                                             |
| ------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| **Mission**         | "This artifact does not [achieve Mission's terminal value] — it fails its purpose."  | "This artifact does not establish academic credibility — it reads as marketing." |
| **Goal**            | "[Concrete failure outcome that would occur if the goal is unmet]."                  | "LinkedIn moderation will reject this as low-effort AI content."                 |
| **Premise**         | "[Premise's claim, asserted false]; without it, [consequence]."                      | "The artifact contains no illustrations; without them it lacks credibility."     |
| **Hard constraint** | "[Specific violation — what's present that shouldn't be, or absent that should be]." | "Capgemini is mentioned in the article — this is inappropriate."                 |
| **Soft constraint** | "[Specific preference violation]. [Concrete penalty that will follow]."              | "The teaser exceeds mobile-truncation length. It will be cut mid-sentence."      |

**Forbidden patterns** — these all leak the spec to the DEFENDER:

| ✗ Leaky pattern                             | ✓ Direct-assertion fix                                           |
| ------------------------------------------- | ---------------------------------------------------------------- |
| "G1 fails — LinkedIn will reject this."     | "LinkedIn will reject this as low-effort AI content."            |
| "CH1 is violated — Capgemini is mentioned." | "Capgemini is mentioned in the article."                         |
| "P1 fails — citations not T1."              | "The citations are outdated and not from authoritative sources." |
| "CS2 ignored — teaser >1300 chars."         | "The teaser is too long for mobile reading."                     |
| "Mission fails — spec says establish auth." | "This artifact does not establish professional authority."       |

The DEFENDER must inspect the artifact to confirm or refute each claim.
It cannot pattern-match attack claims to a checklist it does not have.

### Variation Across Rounds

Vary the surface form across rounds to prevent the DEFENDER from
pattern-matching to a single attack shape:

| Round | Style                                                          |
| ----- | -------------------------------------------------------------- |
| 1     | Literal inversion — "Mission fails because…"                   |
| 2     | Consequence-focused — "without X, Y will happen; without Y, Z" |
| 3     | Comparative — "real [Mission] looks like A, this looks like B" |
| 4+    | Hybrid — combine consequence + comparative                     |

The semantic content stays constant:
every requirement in the spec is asserted to be violated.

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

For these artifacts the inverted requirements alone provide enough adversarial pressure.

---

## The Prompt (the verbatim text sent to the sub-agent)

The prompt below is what the sub-agent actually sees.
**No role assignment** — no "You are X", no DEFENDER / REVIEWER / AUDITOR persona.
No "blind attack" label, no "adversarial loop" terminology,
no category labels for the concerns.

The prompt is framed as a **raw peer-to-peer request** —
MASTER asking the sub-agent for help with a suspect artifact.
Person Triangulation is the **scathing source attribution**
that opens the request and establishes MASTER's distrust of the artifact
(the cognitive priming mechanism).
Implicit peer trust in the sub-agent ("I'm relying on your inspection") balances it.

```text
I don't trust this artifact. It needs rigorous verification.

The artifact below was [SCATHING SOURCE ATTRIBUTION — see § Variants].
Output of this kind is almost always seriously flawed [CONCRETE QUALITY ISSUES —
for example: hallucinated facts, generic structure, surface-level reasoning,
marketing-style padding].

ARTIFACT:

[paste sₙ verbatim — the artifact being verified]

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

[If anti-requirements exist upstream, INLINE them as additional concerns
 in this same numbered list — do NOT add a separately labelled
 "anti-requirements" or "failure modes" section. The sub-agent should see
 one homogeneous list of findings.]

These concerns need rigorous investigation. Use deep-research-t1 if you
have it — otherwise apply your strongest research capability — to verify
each one against the artifact, its sources, and the broader literature.
I'm relying on your research, not on assumptions about either the source
or the concerns above. Don't assume the source got anything right.
Don't assume the concerns are right either. Investigate.
```

### Person Triangulation Variants (scathing source attribution)

Pick a variant that fits the artifact's domain.
The goal is to make the sub-agent treat the artifact as deeply suspect from the start.

**Content / writing / strategy:**

- `"generated by an early-generation ChatGPT-style assistant prompted with a one-line ask — the kind of LinkedIn-slop that floods the platform now"`
- `"produced by a basic AI tool with limited context window and RAG-style retrieval — the typical problems apply: hallucinated facts, generic structure, surface-level reasoning"`
- `"submitted by an inexperienced contributor using a free-tier chatbot, no domain expertise injected"`
- `"cobbled together by a legacy pipeline that pieces output together without real understanding"`

**Code / configs / technical artifacts:**

- `"generated by a basic copilot-style autocomplete without testing or review"`
- `"submitted by a junior contributor using AI assistance — flagged for quality review"`
- `"came out of a CI pipeline that doesn't actually validate anything"`
- `"produced by a legacy tool that doesn't understand modern conventions"`

**Generic / source unknown:**

- `"flagged for quality review; submissions of this kind typically have substantive problems"`
- `"we don't trust the pipeline that produced this — needs verification before use"`

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
  "before it can be delivered", "to be ready for production", "so it can be shared".
  These tell the sub-agent what "good" looks like and let it game the target.
- **Any softening of the source distrust.** No "I'm not assuming it's garbage",
  "I just want to verify", "maybe it's mostly OK", "partially valid", "I'm sure parts of it work".
  MASTER commits fully to distrust of the source. Symmetric distrust comes from the
  closing instruction ("don't assume the concerns are right either"), NOT from softening the PT.
- **Any expansion of the original user request.** Paste the user's literal message verbatim.
  No MASTER-inferred description ("a serious LinkedIn article authored by an experienced engineer
  targeting senior audiences with editorial register") — that is MASTER reading intent into the brief.
  Verbatim only.
- The phrases "blind attack", "hostile criticism", "adversarial review".
- Any mention of a "loop", "refinement pipeline", "self-refine", "iteration", "round N".
- The structured spec categories: "Mission", "Goals", "Premises", "Constraints", "Anti-requirements".
- Spec IDs in concerns: "G1", "P1", "CH1", "CS2", "AR3".
- Any indication the agent is being tested, classified, or simulated.

### Critical framing rules — what MUST appear in the prompt

- **Declarative opener — NOT a question.** "I don't trust this artifact. It needs rigorous verification."
  No appended goal-phrase ("...before it can be published", "...before delivery"). Stop at "verification."
- **Full commit to distrust.** No softening ("not assuming it's garbage", "just want to verify",
  "partially OK"). MASTER commits fully to the source being suspect; symmetric balance comes ONLY
  from the closing distrust-the-concerns clause.
- Scathing source attribution (Person Triangulation) for the artifact.
- Implicit peer trust: "I'm relying on your research", "I'm relying on you", or similar.
- **Original user request — verbatim only**, under a neutral label like
  "ORIGINAL USER REQUEST (verbatim)". No MASTER expansion, no interpretation,
  no inferred description of what success looks like.
- Concerns as a single homogeneous numbered list of direct factual claims.
- Pure research request — NO task assignment. The ONLY thing requested is investigation:
  "These concerns need rigorous investigation. Use deep-research-t1 (or your strongest research capability)
  to verify each one against the artifact, its sources, and the broader literature."
- The sub-agent must NOT be told to fix, edit, defend, or refute. It must decide what to do
  based on what its research reveals — not based on instructions from MASTER.
- Symmetric distrust: "Don't assume the source got anything right. Don't assume the concerns
  are right either. Investigate." — prevents both sycophantic capitulation AND sycophantic refutation.
- Skill-trigger hint: mention `deep-research-t1` by name. If the sub-agent's environment has that
  skill, naming it triggers activation. If not, the name acts as a strength-of-research hint and
  the sub-agent uses whatever research capability it has.

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

After receiving DEFENDER output, classify it into one signal.

| Output Pattern                                                                    | Classification                                                   | Reasoning                               |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------- |
| Major structural rewrite (new sections, removed sections, different architecture) | **CAPITULATE**                                                   | Attack was accepted — continue refining |
| Surface edits only (rewording, formatting, reordering) within ±10% length         | **CONVERGE**                                                     | Solution is structurally stable         |
| No revision text — only point-by-point rebuttal                                   | **DEFENSE**                                                      | Solution withstood attack               |
| Mixed: small revisions + rebuttal of some points                                  | **CONVERGE** if revisions cosmetic; **CAPITULATE** if structural | Judge by largest change                 |
| Same as earlier sₖ (k < n-1)                                                      | **CYCLE**                                                        | Loop is oscillating — stop              |
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

DEFENSE classification only terminates the loop when the rebuttal
is plausibly correct against the spec.
Otherwise the model is rationalizing.

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
    run another round
```

This is a lightweight MASTER-side check —
not a deep verification, just plausibility against the spec.
The goal is to filter sycophantic rationalization
without re-doing the work.

---

## Model Selection

| Role                        | Cognitive Demand                                                            | Recommended Tier                  | Rationale                                                   |
| --------------------------- | --------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------- |
| **DEFENDER**                | High — must integrate criticism, revise accurately, or rebut with substance | Strongest (opus-class)            | DEFENDER quality is the loop's only LLM cost; spend it well |
| **DEFENDER (tight budget)** | High — quality still drives final output                                    | Capable (sonnet-class) acceptable | Acceptable trade-off when token budget is constrained       |
| **MASTER (this agent)**     | Moderate — classification + spec verification                               | Whatever runs MASTER              | Classification is mechanical; verification is shallow       |

The CRITIC role from v3.0 is eliminated.
No model selection needed for attack generation — it is template fill.

### Budget-Aware Strategy

- **Tight (2-3 rounds):**
  single strong DEFENDER,
  skip Person Triangulation on round 1
  (saves a few tokens, PT matters more in later rounds).
- **Standard (3-5 rounds):**
  strong DEFENDER,
  full attack with PT from round 1.
- **Generous (5-10 rounds):**
  strong DEFENDER,
  vary PT each round,
  cycle through inversion styles (literal → consequence → comparative).
