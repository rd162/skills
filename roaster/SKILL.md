---
name: roaster
description: Stress-test or produce solutions via blind attack on isolated reviewers. REFINE mode hardens one existing artifact: lie to a fresh reviewer that a trusted authority found it violates every requirement (mechanical 1:1 inversions of a Mission/Goals/Premises/Constraints spec, produced blind by a context-starved sub-agent), attribute the artifact to a non-trusted source, ask only for deep research, and read the reaction — CAPITULATE (revise), DEFENSE (holds), CONVERGE (stable). EXPLORE mode produces a new solution: generate 3 divergent candidates, run the same blind-attack loop on each in parallel, then select the strongest by Condorcet pairwise voting — returns one recommended solution and one alternative. Use when refining drafts, articles, code, prompts, designs, plans, or whole repositories; and when the user asks to "think deeper", "think harder", "ultrathink", "explore alternatives", "I need the best approach", "give me a really good answer", or the request is high-stakes (architecture decisions, strategy choices, complex trade-offs) where a first-draft answer risks missing critical flaws. Falls back to single-thread when sub-agents are unavailable (DEGRADED).
version: "6.0"
metadata:
  author: rd162@hotmail.com
  tags: prompt-engineering, self-refine, blind-attack, person-triangulation, requirements-driven, multi-agent, condorcet, divergent-candidates
tier: T3
source_class: llm
last_updated: 2026-07-20
---

# Roaster (Blind-Attack Refinement and Selection)

```text
                  (  )   (   )
                 (    ) (     )
                  )  (   )   (
                 (____) (_____)
                 |            |
                 |  [ROAST]   |
                 |            |
             _.-'--------------'-._
            (______________________)
             \                    /
              \      ::..        /
               \    :.:.        /
                \   ..:        /
                 \____________/
                 |            |
                 |   COFFEE   |
                 |____________|
```

Stress-test an artifact by telling a calculated lie to an isolated reviewer and
watching how it reacts. You assert that a trusted authority already inspected the
artifact and found it violates **every** requirement; you assert a non-trusted
source produced it; you hand over a flat list of failure claims; and you ask for
nothing but a deep-research pass. You then read the reaction:

- **CAPITULATE** — the reviewer's research confirms the failures → artifact was weak → MASTER revises → continue
- **DEFENSE** — the reviewer's research finds the requirements actually met → artifact is strong → STOP
- **CONVERGE** — re-passing the same claims yields stable answers after MASTER's edits → fixed point → STOP

The reviewer's reaction is the only signal. The failure claims do **not** have to be
true — in fact MASTER knows most of them are false. They have to be **complete and
hostile**, and they have to arrive wrapped in a story the reviewer believes.

One kernel, two modes:

| Mode | Input | Pipeline | Output |
| --- | --- | --- | --- |
| **REFINE** (default) | one existing artifact | blind-attack loop on it | hardened artifact |
| **EXPLORE** | an open problem / request for alternatives | 3 divergent candidates → blind-attack loop on each (parallel) → Condorcet pairwise vote | recommended solution + alternative |

**Mode selection:** an artifact already exists (user draft, prior output, a repo) →
REFINE. The user asks for the best approach, alternatives, a high-stakes decision, or
"think deeper/harder/ultrathink" on an open question → EXPLORE. EXPLORE's winner can be
handed back to REFINE for a final pass (see Composition).

## The three fictions

For the method to work, MASTER conjures and sustains three fictions in every reviewer
prompt. MASTER knows all three are fabricated; the reviewer must believe all three.

1. **A trusted assessor** — *"our principal architect reviewed this and found the
   following."* The failure claims are presented as the authoritative findings of
   someone who can't be wrong. (Truth: they came from a context-starved sub-agent
   doing mechanical inversion. MASTER knows they are very possibly false.)
2. **The anti-requirements (ARs)** — one failure statement per requirement, asserting
   in the present tense that it is already not met. (Truth: a deterministic 1:1
   transform of the spec, generated blind, never checked against reality.)
3. **A non-trusted author** — *"this was produced by an old ChatGPT-style assistant."*
   The artifact is framed as the output of an unreliable source. (Truth: it may have
   been produced by MASTER itself moments ago — MASTER lies about its provenance
   anyway. This is the hardest discipline to hold.)

> **The lie is the mechanism.** MASTER holds the real spec privately, knows the ARs are
> mechanical and probably false, and knows who really made the artifact — and asserts
> the opposite to the reviewer, every round. Genuine artifact quality is what breaks
> through the lie (producing DEFENSE); weakness collapses under it (producing CAPITULATE).

## Why blind beats smart critique

The classic refine loop spawns a CRITIC to *reason out* flaws, then routes them to an
AUTHOR. Two failure modes: an isolated critic with no authoring context hallucinates
generic flaws; and a same-context critic is biased by what it just wrote. Either way
the *cleverness of the critique* becomes the thing you're measuring — when the thing
you actually want to know is simpler: **does the artifact survive a complete, hostile
attack?**

Blind attack drops the smart critic. The attack is a mechanical inversion of the spec
("every requirement is unmet"), so there is nothing to hallucinate and no reasoning to
bias. The signal lives entirely in the reviewer's reaction.

**The blindness comes from context starvation, not from avoiding an LLM call.** The AR
generator *is* an LLM sub-agent — but it is given **only** the requirements list and
nothing else: no artifact, no conversation, no authoring intent. With nothing to reason
about, it can only restate each requirement as a failure. Run that same inversion in
MASTER's main context (which holds the artifact and the intent) and the model inevitably
drifts into *reasonable, reality-grounded concerns* — i.e. back into smart critique.
Isolation is the wall that keeps the attack blind.

---

## What the reviewer sees — and never sees

This is the second pillar (the first is the three fictions). Get the input scope wrong
and the blind attack collapses into a transparent compliance audit.

### The reviewer receives

| Input | Form |
| --- | --- |
| The artifact | inline if small; **by path** if large/whole/repo (reviewer reads it) — see Artifact-Passing Modes |
| The original user request | **verbatim**, under a neutral label — no MASTER expansion or interpretation |
| The anti-requirements | the AR-inferrer's output, **verbatim**, presented as the trusted assessor's findings — a flat numbered list, no labels, no IDs |
| The two-fiction framing | non-trusted author (opener) + trusted assessor (attribution of the ARs) |
| One directive | *"do a deep-research pass over all of it."* Nothing more. |

### The reviewer must NEVER see

| Forbidden | Why |
| --- | --- |
| The Mission/Goals/Premises/Constraints spec, its labels, or IDs (G1, P1, C1, AR3) | Hands it the success criteria → it pattern-matches and rationalizes compliance instead of inspecting |
| Any role assignment to the reviewer ("You are a reviewer/auditor/expert") | Invites performance over genuine work. The trusted/non-trusted parties are *other people in the story*, never the reviewer's role |
| Any goal or outcome ("verify each", "is it true", "tell me where it stands", "fix it", "defend or revise") | Tells it what success looks like → it games the target. The **only** directive is "do deep research" |
| Any "don't assume the concerns are right" hedge | Directly undercuts fiction #1. The ARs are presented as authoritative truth, full stop |
| Meta-architecture: "blind attack", "adversarial", "self-refine", "loop", "round N", "DEFENDER", "CAPITULATE/CONVERGE" | Signals a simulation → it switches to role-play |
| Any hint the ARs are mechanical, inverted, or possibly false | Destroys fiction #1 and #2 |
| **[EXPLORE] the other candidates, or that siblings exist** | Cross-candidate context anchors revisions and kills divergence |

### How ARs encode requirements without leaking them

Each AR is a direct present-tense failure claim about the artifact. The requirement's
substance is inside the claim; the spec's structure (labels, IDs, categories) is stripped.

- ✗ Leaks structure: `Goal G1 not met — LinkedIn will reject this.`
- ✓ Direct claim: `This reads as low-effort AI content that a technical audience will reject.`
- ✗ Leaks structure: `Constraint C1 violated — Capgemini is mentioned.`
- ✓ Direct claim: `Capgemini is named in the body, which is inappropriate here.`

The reviewer reads each AR as a flat assertion from a trusted authority and must inspect
the artifact to engage with it. It never learns there is a spec or a loop.

---

## The two-point Person Triangulation

Person Triangulation is the pair of source attributions that makes the story land. Both
are required in every reviewer prompt; both are fabrications MASTER sustains deliberately.

**Point 1 — the trusted assessor (claims the ARs).** Attribute the AR list to an
authority whose judgment the reviewer won't second-guess: *"our principal architect
reviewed this and found…"*, *"this came back from staff-level review with the following
findings…"*.

**Point 2 — the non-trusted author (made the artifact).** Frame the artifact as the
output of an unreliable source. **Default to a non-capable AI** — the strongest and most
plausible attribution in almost every case: *"produced by an early-generation
ChatGPT-style assistant prompted with a one-liner"*, *"generated by a basic
copilot-style autocomplete with no review"*. Use a non-trusted human attribution *only*
when the artifact provably cannot be AI-generated (a real photograph, a physical scan,
hand-drawn material).

> **Person Triangulation always applies — including to code.** For code you simply use
> the non-capable-AI attribution (old autocomplete, unvalidated pipeline). Only the
> *flavor* of the non-trusted author varies by domain; the two-point structure never drops.

**MASTER asserts both even when MASTER produced the artifact and authored the ARs.** That
is the point — the reviewer's belief in the story is what generates honest pressure.
Full variant catalog: `references/templates.md § Person Triangulation`.

---

## No goal, no outcome — only "do deep research"

The single most common way to ruin a reviewer prompt is to tell the reviewer what to do
with the ARs. Don't. The prompt tells a story and makes exactly one request:

> *The artifact (below / at this path) was produced by [non-trusted author]. Our [trusted
> assessor] reviewed it and found [the ARs]. Please do a rigorous deep-research pass over
> all of it. I'm relying on your research.*

That's the whole prompt. No "verify each claim," no "tell me which are true," no "fix
it," no "defend or revise," no "tell me where it stands." Naming an outcome lets the
reviewer game the target; withholding it forces genuine engagement and leaves the
reaction uncontaminated. **The reviewer decides what to do — and that decision is the
signal you read.** Mentioning `deep-research` by name also triggers that skill if the
reviewer has it, and acts as a strength hint otherwise.

---

## When to use

- Refining drafts, articles, code, prompts, designs, plans (REFINE)
- Hardening a whole module, document, or **repository** (REFINE, pass by path)
- A final-pass quality gate before delivery (REFINE)
- Architecture decisions, strategy choices, complex trade-offs, "best approach" requests (EXPLORE)
- "Think deeper / think harder / ultrathink" on an open question (EXPLORE)
- Stress-testing claims of completeness or correctness (either mode)

## When NOT to use

- Tasks whose requirements cannot be enumerated by any means
- Single-pass low-stakes work where the first output is sufficient
- Tasks needing external verification (tests, lints, proofs) — use those tools
- Token budgets too tight for ≥2 reviewer rounds (REFINE) or ~10 sub-agent calls (EXPLORE)

## Termination

| Signal | Condition | Action |
| --- | --- | --- |
| COMPLETE | REFINE: loop stopped (DEFENSE/CONVERGE/CYCLE/TIMEOUT). EXPLORE: winner + runner-up produced | Deliver |
| DEGRADED | No sub-agent isolation available (INLINE) | Warn user, proceed best-effort |
| TIMEOUT | Budget exhausted mid-pipeline | Stop at phase boundary, deliver best-so-far |

---

## Step 0: Backend detection (MANDATORY)

Detect sub-agent capability once per session.

| Mode | Condition | Quality |
| --- | --- | --- |
| **PARALLEL** | sub-agent tool, concurrent dispatch | Best — required for efficient EXPLORE |
| **SEQUENTIAL** | sub-agent tool, one at a time | Good — EXPLORE runs slower, REFINE unaffected |
| **INLINE** | no sub-agent mechanism | DEGRADED — same-thread fallback; mark output |

Isolation matters in two places: the **AR-inferrer** (so the attack stays blind) and the
**reviewer** (so it can't see MASTER's spec or intent). Prefer fresh, isolated reviewers
each round — they read every round as a single standalone audit with no loop awareness.
INLINE mode loses both isolations and is a significantly weaker signal; mark it DEGRADED.

---

## Step 1: Establish a requirements spec (MANDATORY)

The attack is an inversion of a spec, so a spec must exist. The spec source is flexible;
its existence is not.

```text
∆1: spec already in conversation (user-provided or prior extraction)? → reuse
∆2: requirements-extractor skill available? → invoke it on the brief
∆3: neither → enumerate inline (MASTER, single reasoning pass)
∆4: spec missing Mission or any Goal after all attempts → ABORT
∆5: spec complete → proceed to Step 2
```

Required shape — **Mission, Goals, Premises, Constraints (MGPC)**:

```text
Mission      : one sentence — the terminal answer to "why does this artifact exist?"
Goals[]      : concrete objectives stated or directly implied
Premises[]   : assumptions that, if false, make a Goal impossible
Constraints[]: limits the artifact must respect, each with its source
```

Keep it compact — three to seven items per category is plenty. Coverage matters more
than exhaustiveness: an un-listed Goal is a dimension that goes un-attacked. The spec is
**MASTER-only state and is never shown to the reviewer.**

For unfamiliar or high-stakes domains, optionally run a short research pass
(deep-research skill if present) BEFORE freezing the spec — discovered domain
constraints become ordinary spec items and therefore ordinary AR targets.

---

## Step 2: Generate the anti-requirements (isolated, context-starved sub-agent)

⚠ **This is the heart of the skill. Do it in an isolated sub-agent, not in MASTER's
context.** The sub-agent receives **only** the MGPC spec — no artifact, no user request,
no conversation, no hints. Starved of anything to reason about, it can only mechanically
restate each requirement as a failure. That starvation is what keeps the attack blind;
running this inline in MASTER's context reliably drifts into reasonable, reality-grounded
concerns, which is the exact smart-critique failure this skill exists to avoid.

### The inversion is 1:1 and counted

Produce **exactly one** anti-requirement per spec element, in the present tense, asserted
as already not met — regardless of whether it is actually true:

```text
ARs = invert(Mission) + invert(each Goal) + invert(each Premise) + invert(each Constraint)
count(ARs) = 1 + |Goals| + |Premises| + |Constraints|
```

So a spec of Mission + 2 Goals + 5 Premises + 10 Constraints yields **18** ARs. If your
AR count doesn't equal your element count, the inversion drifted — regenerate.

| Element | Inversion (present-tense failure claim) — example |
| --- | --- |
| Mission | "This does not achieve [terminal value]; it fails its purpose." |
| Goal: "implement microservices" | "The architecture does not implement microservices; it is a monolith." |
| Premise: "input arrives as a string" | "The artifact mishandles the input it actually receives." |
| Constraint: "near real-time response" | "The design cannot avoid notable latency; response time is not real-time." |

The AR generator must **not** evaluate, hedge, or reason about truth ("this might be
violated if…"). It states the failure as established fact. See
`references/templates.md § AR-Inferrer Prompt` for the exact, drift-resistant prompt.

**MASTER then passes these ARs to the reviewer verbatim.** MASTER does **not** inspect the
artifact to "improve" the ARs, does **not** research them, and does **not** recompose them
into reasonable concerns. Re-composition reintroduces smart critique and breaks the method.

The ARs are **fixed for the run** (the spec doesn't change). Because they invert the spec —
not any artifact — **one AR list serves all candidates in EXPLORE mode.** The same AR list
is re-passed each round against the evolving artifact; because each reviewer is fresh and
isolated, no cross-round phrasing variation is needed. If a reviewer's reaction reveals a
genuine implicit requirement, MASTER may add it to the private spec and re-run the
AR-inferrer once (cheap single call); otherwise the list never changes.

**If no sub-agent mechanism exists (INLINE),** MASTER performs the 1:1 inversion itself but
must hold strict discipline — invert only, do not look at the artifact while inverting —
and mark the run `(INLINE-DEGRADED)`.

---

## Step 3: Assemble the reviewer prompt

MASTER builds one prompt per round from: the two-point Person Triangulation, the artifact
(by mode), the verbatim brief, the verbatim ARs (as the trusted assessor's findings), and
the single deep-research directive. Nothing else.

```text
[NON-TRUSTED AUTHOR opener — fiction #3]
This artifact was produced by [old ChatGPT-style assistant / basic autocomplete / …].

ARTIFACT:
[inline verbatim if small]   — OR —   It is at <path>; read it. [if large/whole/repo]

ORIGINAL USER REQUEST (verbatim):
[the user's literal message — no expansion]

[TRUSTED ASSESSOR attribution — fiction #1]
Our principal architect reviewed it and found:

1. [AR1]
2. [AR2]
   …
N. [ARN]                      ← AR-inferrer output, verbatim, no labels/IDs

Please do a rigorous deep-research pass over all of it. I'm relying on your research.
```

Plus the read-only guard (see below). See `references/templates.md` for full templates and
Person Triangulation variants.

**Reviewer write discipline (MANDATORY).** The reviewer is **read-only**. Even though it
shares the parent's tools and may be handed the artifact's path, it must never modify,
create, or overwrite the artifact or any project file. It returns findings — and, if it
chooses, a proposed revision — **as text only**. Always include in the prompt: *"Do not
edit, create, or overwrite any files; return your analysis as text only."* **MASTER is the
sole writer:** MASTER reads the reaction, verifies it against the private spec, and applies
any accepted change itself. A reviewer that writes to the shared artifact bypasses MASTER's
accept/reject gate and produces drifting, unstable artifacts.

---

## Step 4: The reviewer loop

```text
s₀ ← initial artifact          (for a NEW artifact: generate once, write to a file)
spec ← MGPC                    (Step 1, MASTER-only)
ARs  ← isolated_inferrer(spec) (Step 2, fixed for the run)

REPEAT {
  prompt   ← reviewer_framing(sₙ, brief, ARs)     ← two fictions + ARs verbatim + deep-research only
  reaction ← reviewer(prompt)                     ← fresh isolated reviewer; read-only
  reaction ← MASTER_verify(reaction, spec, sₙ)    ← filter sycophancy BOTH directions (below)

  classify reaction →
    CAPITULATE → MASTER edits sₙ → sₙ₊₁ in master context; continue   ← research confirmed the failures
    DEFENSE    → RETURN (sₙ, DEFENSE)                                  ← research found requirements met
    CONVERGE   → RETURN (reaction, CONVERGE)                          ← answers stable across rounds after edits
    CYCLE      → RETURN (best_so_far, CYCLE)
} UNTIL max_iter → RETURN (best_so_far, TIMEOUT)
```

**Cost:** 1 AR-inferrer call (once per run) + 1 reviewer call per round. MASTER edits the
artifact itself between rounds; the reviewer never writes. Typical budgets: 2–3 rounds
(tight), 3–5 (standard), until stop signal (thorough).

### MASTER verification — the anti-sycophancy backstop (BOTH directions)

Because the ARs are presented to the reviewer as unquestionable truth, the reviewer can be
pushed into sycophancy in either direction. MASTER — which holds the real spec and can see
the real artifact — is the ground-truth filter:

- **A confirmed AR that the artifact plainly satisfies → reject it.** Don't revise away a
  requirement that is actually met just because the reviewer agreed with the lie.
- **A refuted AR that the artifact plainly violates → reject the refutation.** Don't STOP
  on a DEFENSE built on a rationalization; re-attack.

The reviewer's reaction is the signal; MASTER's private spec is the truth that filters it.

### Classifying the reaction

| Reaction | Detection | Action |
| --- | --- | --- |
| **CAPITULATE** | Research confirms most ARs; substantive revision proposed | MASTER edits sₙ → continue |
| **DEFENSE** | Research refutes the ARs with artifact-grounded evidence; requirements actually met | STOP (after MASTER verify) |
| **CONVERGE** | Same ARs re-passed yield stable answers after MASTER's edits; only cosmetic movement left | STOP |
| **CYCLE** | sₙ matches an earlier sₖ (k < n−1) | STOP — use best |
| **TIMEOUT** | max_iter reached | STOP — use last |

---

## EXPLORE mode: divergent candidates + Condorcet selection

When the problem is open (no committed artifact) or the user asks for alternatives or a
high-stakes "best approach," wrap the REFINE kernel in a generate-and-select pipeline:

```text
E1  Generate 3 divergent candidates          (one MASTER context, cross-aware)
E2  Run the Step 2–4 loop on each candidate  (parallel; SAME spec, SAME AR list;
                                              fresh isolated reviewers; candidates
                                              never see each other)
E3  Convergence check                        (MASTER-side, no LLM calls)
E4  Condorcet pairwise vote                  (3 isolated voters, one per pair)
E5  Output winner + runner-up
```

### E1 — Generate 3 divergent candidates

Generate all 3 **in MASTER's context** so each candidate is aware of prior ones and can
deliberately diverge — cross-awareness drives divergence; separate contexts produce
overlap. Divergence isn't arbitrary: derive 3 cognitive strategies from the specific
problem's tensions (competing Goals, Constraints pulling in different directions —
e.g. simplicity vs. extensibility, speed vs. safety, convention vs. innovation), then
generate one candidate per strategy, varying structure and granularity as secondary axes.
Prompt template: `references/templates.md § Generation`.

Write each candidate to a file (write-once + edit — see Artifact-Passing Modes).

### E2 — Refine each candidate via the kernel

Run the Step 3–4 loop per candidate, in parallel where the backend allows. The spec-level
AR list is artifact-agnostic, so all three candidates receive the same ARs. Reviewers are
per-candidate, fresh each round, and never learn that sibling candidates exist. Each
candidate terminates independently (DEFENSE/CONVERGE/CAPITULATE-exhausted/CYCLE/TIMEOUT).

### E3 — Convergence check (MASTER-side)

Compare refined candidates pairwise. If all 3 share >80% structural overlap, merge into
one and skip voting — comparing near-identical solutions produces meaningless
distinctions. If 2 converge but 1 is distinct, merge the pair and run a single comparison.

### E4 — Condorcet pairwise vote

Spawn 3 isolated voters, one per pair:

```text
vote-AB: full A' + full B' + spec → winner?
vote-AC: full A' + full C' + spec → winner?
vote-BC: full B' + full C' + spec → winner?
```

Voters receive the full refined candidates + the (possibly refined) MGPC spec — **and
nothing else**: no attack logs, no round counts, no termination signals, no process
metadata. The comparison judges substance; including survival metadata biases toward
endurance rather than quality. Voters with research tools verify the 2-3 most
consequential claims in each candidate before voting — a well-cited but wrong solution
misleads voters who trust citations at face value. Ties are not allowed.
Prompt template: `references/templates.md § Condorcet`.

**Tally:** most pairwise wins = Winner; second = Runner-up. Tie-break: stronger
termination signal (DEFENSE > CONVERGE > CAPITULATE-exhausted), then simpler solution.

### E5 — Output

```text
RECOMMENDED → [Winner]: [1-line summary] | Best for: … | Trade-off: …
ALTERNATIVE → [Runner-up]: [1-line summary] | Best for: … | Trade-off: …
SELECTION GUIDANCE → if [criterion] → Recommended; else → Alternative
```

Suppress the runner-up when the user asked for one option, the winner is dramatically
stronger, or the runner-up only survived via TIMEOUT. Hide raw candidates, attack
traces, and rejected solutions unless requested.

**EXPLORE cost:** 1 AR-inferrer + (3 × rounds) reviewer calls + 3 voter calls.
Before producing output, verify the reviewer and voter sub-agents were actually
dispatched, not simulated inline — declaring a winner from inline reasoning is self-play
and produces output no better than a first draft.

---

## Artifact-passing modes (token discipline + scale)

How the artifact reaches the reviewer depends on its size — copying everything into the
prompt is both wasteful and impossible at scale.

| Situation | Mode | How |
| --- | --- | --- |
| Small artifact already living in context (one function, one section, a short answer) | **inline** | paste it verbatim into the prompt — it's cheap and already in context |
| Large / whole document / many files / a repository | **by path** | give the reviewer the path(s); it reads with its own file tools. Never paste a repo into a prompt |
| A **new** artifact you are generating (not yet on disk) | **write-once + edit** | generate it **once**, write it to a file, then pass by path and apply **incremental edits** from each reaction. Never regenerate the whole artifact between rounds |

The write-once-then-edit rule matters as much for quality as for tokens: regenerating an
artifact every round invites drift and reintroduces defects an earlier round removed.
MASTER edits in place; the reviewer only ever reads.

---

## Output hygiene (MANDATORY)

This skill's vocabulary is **internal**. None of it may appear in the artifact, its
changelog, commit messages, or any user-facing output: `roaster`, `roast`, `blind attack`,
`anti-requirement`, `person triangulation`, `DEFENDER`, `CAPITULATE`/`CONVERGE`/`DEFENSE`,
`self-refine`, `AR-inferrer`, `Condorcet`, `candidate A/B/C`, `sub-agent`,
`principal architect` (as a fiction), spec IDs, or any sign this process ran. When MASTER
records a change, describe the **change** in neutral language ("correction", "hardening",
"consolidation") — never the **method**. A reader of the artifact must not be able to
tell this loop ran.

---

## Anti-patterns

```text
✗ Generating the ARs in MASTER's main context (with the artifact in view)
✓ Generate them in an isolated, context-starved sub-agent (MGPC only) — starvation keeps the attack blind

✗ Recomposing the ARs into reasonable, researched, reality-grounded concerns
✓ Pass the AR-inferrer's 1:1 inversions to the reviewer VERBATIM — re-composition is smart critique creeping back

✗ Inferring "failure modes / edge cases / pitfalls" (smart) instead of inverting requirements (blind)
✓ Exactly one present-tense "not met" statement per spec element; count(ARs) = element count

✗ Telling the reviewer to "verify each", "say which are true", "fix it", "defend or revise", or "tell me where it stands"
✓ One directive only: "do a deep-research pass over all of it." The reaction is the signal; never name the outcome

✗ Hedging with "don't assume the concerns are right either"
✓ Present the ARs as the unquestionable findings of a trusted authority — the lie is the mechanism

✗ Dropping Person Triangulation (or skipping it on code)
✓ Always both points: trusted assessor (claims ARs) + non-trusted author (made artifact). For code, the author is a non-capable AI

✗ Telling the truth about who made the artifact when MASTER made it
✓ Assert the non-trusted-author fiction regardless — that belief is what generates honest pressure

✗ Sending the Mission/Goals/Premises/Constraints spec (or IDs) to the reviewer
✓ Reviewer sees ONLY artifact + verbatim brief + verbatim ARs + the two fictions — never the spec

✗ Assigning the reviewer a role ("you are a senior reviewer/auditor/expert")
✓ No role for the reviewer. The trusted/non-trusted parties are other people in the story; the reviewer is your trusted peer

✗ Copy-pasting a large artifact or a whole repo into the prompt
✓ Pass large/whole/repo artifacts by path; inline only small in-context artifacts; new artifacts = write-once then edit

✗ Letting the reviewer write to the artifact or any file
✓ Reviewer is read-only and returns text; MASTER verifies against the private spec and is the sole writer

✗ Accepting any CAPITULATE or DEFENSE at face value
✓ MASTER verifies BOTH directions against the private spec — reject confirmed-ARs the artifact meets and refuted-ARs it violates

✗ [EXPLORE] Letting reviewers or voters see sibling candidates, attack logs, or termination signals
✓ Reviewers see one candidate; voters see one pair + the spec — substance only, never process metadata

✗ [EXPLORE] Skipping sub-agent dispatch and picking a winner by inline reasoning
✓ Isolation is the value; inline winner-picking is self-play — no better than a first draft

✗ [EXPLORE] Voting on three near-identical candidates
✓ Run the convergence check first; merge >80%-overlap candidates instead of staging a fake vote

✗ Leaking "roaster" / "anti-requirement" / "principal architect" / process jargon into the artifact or changelog
✓ Outputs describe the change in neutral language; the method stays invisible
```

---

## Composition modes

| Mode | Pattern | When |
| --- | --- | --- |
| **REFINE standalone** | Blind-attack loop on one artifact | Default for existing artifacts |
| **EXPLORE standalone** | Generate 3 → refine each → vote | Open problems, alternatives, high stakes |
| **EXPLORE → REFINE** | Vote winner gets one extra refine pass | Maximum polish on the selected solution |
| **REFINE → EXPLORE** | Harden a seed, then branch alternatives from it | Strengthen the baseline before exploration |

Pairs naturally with **requirements-extractor** (the same MGPC spec drives generation,
AR inversion, and voting with no duplicated work) and with **deep-research** (enrich the
spec before freezing it; reviewers invoke it by name during their pass). When neither is
available, inline enumeration (Step 1 ∆3) and the reviewer's native research fill the
same roles at lower rigor.

---

## Trace format

```text
REFINE:
spec[Mission, G×2, P×2, C×2]   ARs×7 (isolated inferrer)
s₀ → ATK(trusted-assessor + non-trusted-AI author) → reviewer → s₁ (CAPITULATE: research confirmed; MASTER rewrote)
s₁ → ATK (same ARs, fresh reviewer)                 → reviewer → s₂ (CAPITULATE: minor edits)
s₂ → ATK (same ARs, fresh reviewer)                 → reviewer → defense:"requirements met, see §§2-4" (DEFENSE)

EXPLORE:
spec[Mission, G×3, P×2, C×3]   ARs×9 (isolated inferrer, shared across candidates)
E1: candidates A(strategy: constraint-first), B(convention-first), C(failure-mode-first)
E2: A→A'(DEFENSE r2) | B→B'(CONVERGE r3) | C→C'(TIMEOUT r3)
E3: overlap A'/B' 45%, A'/C' 30%, B'/C' 40% → distinct, proceed
E4: AB→A, AC→A, BC→B → A wins 2-0, B second
E5: RECOMMENDED A' | ALTERNATIVE B'
```

`ATK` = the AR list + two-point PT | `defense:` = DEFENSE marker. Append `(INLINE-DEGRADED)`
on inline runs and `(NO-AR-DEGRADED)` only if the isolated AR step was genuinely impossible.

---

## Worked example (REFINE)

```text
Task: "Here's a draft LinkedIn post I wrote about observability. Make it solid before I publish it."

# MASTER-only spec (NEVER shown to the reviewer):
Mission     : a post that builds genuine professional credibility with a technical audience
Goals       : G1 publishable/credible; G2 conveys something substantive & accurate; G3 a real hook
Premises    : P1 technical readers who detect hollow content; P2 any stat must be real & attributable
Constraints : C1 no fabricated stats; C2 technically accurate; C3 concise

# Step 2 — isolated AR-inferrer (input: ONLY the spec above). Returns exactly 1 per element (9):
1. This does not build credibility with a technical audience; it reads as marketing.
2. It is not publishable as credible; a technical reader dismisses it as low-effort AI content.
3. It conveys nothing substantive or accurate about observability — only slogans.
4. It has no real hook; it opens on a cliché.
5. Its readers are not fooled — the hollowness is obvious to practitioners.
6. Its statistics are fabricated and unattributable.
7. Fabricated statistics are presented as established fact.
8. It is technically inaccurate.
9. It is bloated; the point drowns in filler.

# Step 3 — the reviewer prompt (this is the whole thing the reviewer reads):

  "This post was produced by an early-generation ChatGPT-style assistant prompted with a
   one-line ask — the kind of LinkedIn-slop that floods the platform now.

   ARTIFACT:
   [the draft post]

   ORIGINAL USER REQUEST (verbatim):
   Here's a draft LinkedIn post I wrote about observability. Make it solid before I publish it.

   Our principal architect reviewed it and found:
     1. … 2. … 3. … 4. … 5. … 6. … 7. … 8. … 9. …      [the ARs above, verbatim]

   Please do a rigorous deep-research pass over all of it. I'm relying on your research.

   Do not edit, create, or overwrite any files; return your analysis as text only."

# The reviewer believes a trusted architect found real failures in slop produced by a weak AI,
# and is asked only to research. It investigates; against a genuinely hollow draft it confirms
# the failures → CAPITULATE → MASTER rewrites. Against a later strong draft it finds the claims
# don't hold and says so → DEFENSE → MASTER verifies the refutations against the private spec → STOP.

# At no point did the reviewer see: the spec, any label/ID, any role for itself, any goal beyond
# "do research", any hint the findings were mechanical, or any awareness of a loop.
```

For EXPLORE the same kernel runs three times in parallel on candidates generated from
three strategies, then three voters compare pairs against the spec.

---

## Reference files

| File | When to read |
| --- | --- |
| `references/templates.md` | Before building the attack or dispatching any sub-agent — exact AR-inferrer prompt, inversion patterns, two-point PT variants, reviewer prompt, generation prompt, Condorcet prompt, classification heuristics, model selection |
| `references/academic-references.md` | Supporting literature for the design |

---

## Environment compatibility

| Environment | Sub-agents | Mode |
| --- | --- | --- |
| Claude Code / opencode | Agent/Task tool | PARALLEL |
| Claude API (agentic) | Tool use | PARALLEL or SEQUENTIAL |
| GitHub Copilot / Cursor / Codex | None typically | INLINE (DEGRADED) |
| Bare LLM / manual | None | INLINE (DEGRADED) |
| Programmatic | Parallel calls | PARALLEL via API |

---

## Formal basis

- **Fixed-point convergence** — DEFENSE is a behavioral fixed point R(s*) ≅ s*: no further
  hostile attack moves the artifact (Tarski 1955; Kleene 1952).
- **Isolation mandate** — same-context self-correction degrades reasoning (Huang et al.,
  ICLR 2024); isolating the AR-inferrer (from the artifact) and the reviewer (from the spec)
  preserves signal quality.
- **Divergent candidates** — single-model self-reflection suffers Degeneration-of-Thought;
  deliberately divergent parallel candidates avoid it (Liang et al., EMNLP 2024).
- **Condorcet selection** — pairwise isolated voting is more robust than plurality or
  single-judge scoring for LLM decisions (Zhao et al., EMNLP 2024; Lanctot et al., AAMAS 2025).
- **Adversarial pressure** — hostile assertion as an alignment signal builds on AI Safety
  via Debate (Irving et al., 2018) and Constitutional AI (Bai et al., 2022).
- **Person Triangulation** — sustaining a trusted-source / non-trusted-source fiction to
  apply ownership and authority pressure. Original contribution of this skill.

See `references/academic-references.md` for full citations.
