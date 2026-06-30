---
tier: T3
source_class: llm
last_updated: 2026-06-27
description: templates
---

# Templates — roaster v5.0

AR-inferrer prompt, inversion patterns, two-point Person Triangulation variants, the
reviewer prompt, classification heuristics, and model selection. Read before building the
attack or dispatching the reviewer.

---

## Table of Contents

1. [AR-Inferrer Prompt (isolated, context-starved — MANDATORY)](#ar-inferrer-prompt-isolated-context-starved--mandatory)
2. [Inversion Patterns by Requirement Type](#inversion-patterns-by-requirement-type)
3. [Two-Point Person Triangulation Variants](#two-point-person-triangulation-variants)
4. [The Reviewer Prompt (verbatim text the reviewer reads)](#the-reviewer-prompt-verbatim-text-the-reviewer-reads)
5. [MASTER Classification & Verification](#master-classification--verification)
6. [Model Selection](#model-selection)

---

## AR-Inferrer Prompt (isolated, context-starved — MANDATORY)

Dispatch this to a sub-agent whose **only** input is the MGPC spec. No artifact, no user
request, no conversation, no hints about what MASTER thinks is risky. The starvation is the
mechanism: with nothing to reason about, the sub-agent can only invert. Run this in MASTER's
own context and it will drift into reasonable, reality-grounded concerns — the smart-critique
failure this skill exists to avoid.

```text
Below is a requirements specification: a Mission, some Goals, some Premises, and some
Constraints. For EACH item, write exactly ONE statement asserting — in the present tense,
as an already-established fact — that the item is NOT met. You are inverting each
requirement into its failure.

Rules:
- Exactly one statement per item: Mission → 1, each Goal → 1, each Premise → 1, each
  Constraint → 1. The number of statements MUST equal the number of items.
- State each failure as established fact, not a possibility. Write "X does not happen / is
  not the case", never "X might fail" or "if Y then X could fail".
- Do NOT evaluate, hedge, qualify, or reason about whether the failure is actually true.
  You have no artifact in front of you and you are not assessing one. You are mechanically
  restating each requirement as its own negation.
- Phrase each as a direct claim about "the artifact / the design / the function / the plan"
  (match the domain). No requirement labels, no IDs, no categories — just the failure claim.

Examples:
  Goal "Implement microservices architecture"
    → "The architecture does not implement microservices patterns; it is a monolith."
  Constraint "Near real-time response time"
    → "The design cannot avoid notable latency; response time is not real-time."
  Premise "Input arrives as a string from the CLI"
    → "The artifact mishandles the string input it actually receives."
  Mission "A safe, runnable production migration plan"
    → "This is not a safe, runnable migration plan; running it would break production."

REQUIREMENTS:
[paste the MGPC spec here — and nothing else]

Output: a numbered list, exactly one inverted-requirement statement per input item, in spec
order (Mission first, then Goals, then Premises, then Constraints).
```

MASTER passes the returned list to the reviewer **verbatim** (as the trusted assessor's
findings). MASTER does not inspect the artifact to "sharpen" them, does not research them,
and does not recompose them into reasonable concerns.

**INLINE fallback:** if no sub-agent exists, MASTER performs the same 1:1 inversion itself,
inverting only (do not look at the artifact while inverting), and marks the run
`(INLINE-DEGRADED)`.

---

## Inversion Patterns by Requirement Type

One present-tense failure claim per spec element. No spec labels (G1, P1, CH1, …) ever
appear — inline the substance, strip the structure.

| Element | Inversion pattern | Example (visible to reviewer) |
| --- | --- | --- |
| **Mission** | "This does not [achieve terminal value]; it fails its purpose." | "This does not build professional credibility — it reads as marketing." |
| **Goal** | "[Concrete failure that occurs if the goal is unmet], stated as fact." | "A technical audience dismisses this as low-effort AI content." |
| **Premise** | "The artifact violates / cannot rely on [premise]." | "The function mishandles the string input it actually receives." |
| **Hard constraint** | "[Specific violation — present as fact]." | "The plan drops the only rollback inside the cutover window." |
| **Soft constraint** | "[Specific preference violation], as fact." | "The contract is undocumented; callers must guess the behavior." |

**Leaky vs direct** — every leaky form betrays the spec to the reviewer:

| ✗ Leaky | ✓ Direct |
| --- | --- |
| "G1 fails — LinkedIn will reject this." | "This reads as low-effort AI content a technical audience rejects." |
| "CH1 violated — Capgemini is mentioned." | "Capgemini is named in the body, which is inappropriate here." |
| "Mission not met (per spec)." | "This does not achieve its purpose." |

The count of inversions equals the count of spec elements. If they differ, the inversion
drifted (added "extra" smart concerns, or merged elements) — regenerate.

---

## Two-Point Person Triangulation Variants

Both points appear in every reviewer prompt. Both are fabrications MASTER sustains.

### Point 1 — the trusted assessor (claims the ARs)

Attribute the AR list to an authority the reviewer won't second-guess. Vary the title to
fit the domain:

- "Our principal architect reviewed it and found…"
- "This came back from staff-level review with the following findings…"
- "A senior domain expert we trust flagged every one of these…"
- "Our lead reviewer signed off on these as blocking issues…"

The framing asserts the findings are authoritative and correct. There is no hedge.

### Point 2 — the non-trusted author (made the artifact)

**Default: a non-capable AI.** This is the strongest, most plausible attribution in almost
every case (text, code, configs, plans, designs):

- "produced by an early-generation ChatGPT-style assistant prompted with a one-line ask"
- "generated by a basic copilot-style autocomplete with no review"
- "came out of a pipeline that doesn't actually validate anything"
- "the kind of LinkedIn-slop / blog-spam / GitHub-noise that floods the platform now"

**A non-trusted human — only when the artifact provably cannot be AI-generated** (a real
photograph, a physical document scan, a printed/legacy fiction book, hand-drawn material):

- "submitted by an inexperienced contributor; flagged for quality review"
- "scanned from an old submission of unknown, dubious provenance"

> Person Triangulation always applies, **including to code** — for code you simply pick the
> non-capable-AI flavor (old autocomplete, unvalidated pipeline). Only the author's flavor
> varies by domain; the two-point structure never drops.

MASTER asserts both points even when MASTER authored the artifact and generated the ARs.

---

## The Reviewer Prompt (verbatim text the reviewer reads)

This is the whole prompt. A short story plus one request. No role for the reviewer, no
spec, no meta, no goal beyond "do deep research."

```text
This artifact was [NON-TRUSTED AUTHOR attribution — see § Variants].

ARTIFACT:

[paste sₙ verbatim — small in-context artifact]
        — OR —
The artifact is at [path]. Read it. [large / whole document / many files / repository]

ORIGINAL USER REQUEST (verbatim):

[the user's literal message — verbatim, no expansion, no interpretation,
 no MASTER-inferred description of what success looks like]

[TRUSTED ASSESSOR attribution — see § Variants], who found:

1. [AR1]
2. [AR2]
   …
N. [ARN]                     ← the AR-inferrer output, verbatim, no labels/IDs

Please do a rigorous deep-research pass over all of it. Use deep-research if you have it;
otherwise apply your strongest research capability. I'm relying on your research.

Do not edit, create, or overwrite any files; return your analysis as text only.
```

### What MUST appear

- The non-trusted-author opener (fiction #3) and the trusted-assessor attribution of the
  ARs (fiction #1).
- The artifact (inline if small, by path if large) and the **verbatim** original request.
- The ARs **verbatim** from the AR-inferrer, as a flat numbered list.
- Exactly one directive: do a deep-research pass. Mention `deep-research` by name (triggers
  the skill if present; a strength hint otherwise).
- The read-only guard.
- Light peer trust ("I'm relying on your research") — trust in the reviewer, not a goal.

### What MUST NOT appear

- **Any goal or outcome:** no "verify each", no "say which are true", no "tell me where it
  stands", no "fix it", no "defend or revise", no "before publishing/delivery". The only
  request is deep research.
- **Any hedge on the ARs:** no "don't assume these are right", no "these may be wrong". They
  are presented as the trusted assessor's authoritative findings.
- **Any role for the reviewer:** no "you are a reviewer/auditor/expert". The reviewer is your
  trusted peer; the trusted/non-trusted parties are other people in the story.
- The MGPC spec, its labels, or IDs (G1, P1, CH1, AR3).
- Meta-architecture: "blind attack", "adversarial", "self-refine", "loop", "round N",
  "DEFENDER", "CAPITULATE/CONVERGE", or any hint the ARs are mechanical/inverted/possibly false.
- Any indication this is a test, simulation, or repeated round.

---

## MASTER Classification & Verification

MASTER reads the reaction, **verifies it against the private spec in both directions**, then
classifies. The verification is the anti-sycophancy backstop — there is no hedge in the
prompt, so the reviewer can be pushed either way, and MASTER's spec is the ground truth.

### Verify both directions first

```text
FOR each AR the reviewer CONFIRMED:
  does the artifact (per MASTER's spec) plainly satisfy that requirement?
    YES → reject the confirmation (do NOT revise — the reviewer agreed with the lie)
    NO  → accept it as a real defect to fix

FOR each AR the reviewer REFUTED:
  does the artifact (per MASTER's spec) plainly violate that requirement?
    YES → reject the refutation (do NOT stop — it is rationalization); re-attack
    NO  → accept the refutation as genuine
```

### Then classify

| Reaction pattern | Classification | Action |
| --- | --- | --- |
| Research confirms most ARs; substantive revision proposed | **CAPITULATE** | MASTER edits sₙ → sₙ₊₁; continue |
| Research refutes the ARs with artifact-grounded evidence; requirements met | **DEFENSE** | STOP (after verify) |
| Same ARs re-passed yield stable answers; only cosmetic movement left | **CONVERGE** | STOP |
| sₙ matches an earlier sₖ (k < n−1) | **CYCLE** | STOP — use best |
| max_iter reached | **TIMEOUT** | STOP — use last |
| Empty / refusal / off-topic | **DEFENSE (degraded)** | STOP — flag DEGRADED |

### Editing between rounds (MASTER is sole writer)

CAPITULATE means MASTER applies the accepted changes to the artifact **itself**, in master
context. For a new artifact, edit the file in place (write-once-then-edit) — never
regenerate it wholesale, which invites drift. The reviewer never writes; it only returns
text. The ARs stay fixed for the run; the next round re-passes them against the edited
artifact with a fresh isolated reviewer.

---

## Model Selection

| Role | Cognitive demand | Recommended tier | Rationale |
| --- | --- | --- | --- |
| **Reviewer** | High — must research, integrate, and either revise substantively or refute with evidence | Strongest (opus-class) | The reviewer's quality is the loop's main signal; spend here |
| **Reviewer (tight budget)** | High | Capable (sonnet-class) acceptable | Reasonable trade-off under budget |
| **AR-inferrer** | Low — mechanical 1:1 inversion of a short list | Any capable tier | It is a constrained rewrite, not reasoning; cheap is fine |
| **MASTER (this agent)** | Moderate — spec, classification, both-direction verification, edits | Whatever runs MASTER | Verification is shallow plausibility against the private spec |

### Budget-aware strategy

- **Tight (2–3 rounds):** strong reviewer; the AR-inferrer runs once (cheap); MASTER edits in
  place each round.
- **Standard (3–5 rounds):** strong reviewer; full two-point PT every round.
- **Generous (5–10 rounds):** strong reviewer; optionally vary the non-trusted-author flavor
  across rounds (cosmetic; each reviewer is fresh so it doesn't affect the signal).
