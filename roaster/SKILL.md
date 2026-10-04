---
name: roaster
description: >-
  Stress-test or produce solutions via blind attack on isolated reviewers. REFINE mode hardens one
  artifact: a context-starved sub-agent inverts a Mission/Goals/Premises/Constraints spec, a fresh reviewer
  is told a trusted authority found the artifact violates every requirement, and its reaction is read as
  CAPITULATE (revise), DEFENSE (holds), or CONVERGE (stable). EXPLORE mode runs a tournament: 3 divergent
  candidates, winner by Condorcet pairwise voting; later
  iterations keep winner and runner-up and admit one new challenger until the budget (1-3) is spent,
  returning one recommendation plus one alternative. Use when refining drafts, articles, code, prompts,
  designs, plans, or repositories, when the user says "think deeper", "think harder", "ultrathink",
  "explore alternatives", "I need the best approach", or for high-stakes architecture, strategy, and
  trade-off decisions. Degrades to single-thread without sub-agents.
version: "6.2"
metadata:
  author: rd162@hotmail.com
  tags: prompt-engineering, self-refine, blind-attack, person-triangulation, requirements-driven, multi-agent, condorcet, divergent-candidates
tier: T3
source_class: llm
last_updated: 2026-09-07
---

# Roaster (Blind-Attack Refinement and Selection)

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
| **EXPLORE** | an open problem / request for alternatives | iterative tournament — it.1: 3 divergent candidates → Condorcet vote; it.2+: winner + runner-up keep seats + ONE genuinely new challenger, repeat; stop on exhaustion or budget (default 1–3 iterations) | recommended solution + alternative |

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
| The Mission/Goals/Premises/Constraints spec, its section labels, or any handle used to enumerate its entries | Hands it the success criteria → it pattern-matches and rationalizes compliance instead of inspecting |
| Any role assignment to the reviewer ("You are a reviewer/auditor/expert") | Invites performance over genuine work. The trusted/non-trusted parties are *other people in the story*, never the reviewer's role |
| Any goal or outcome ("verify each", "is it true", "tell me where it stands", "fix it", "defend or revise") | Tells it what success looks like → it games the target. The **only** directive is "do deep research" |
| Any "don't assume the concerns are right" hedge | Directly undercuts fiction #1. The ARs are presented as authoritative truth, full stop |
| Meta-architecture: "blind attack", "adversarial", "self-refine", "loop", "round N", "DEFENDER", "CAPITULATE/CONVERGE" | Signals a simulation → it switches to role-play |
| Any hint the ARs are mechanical, inverted, or possibly false | Destroys fiction #1 and #2 |
| **[EXPLORE] the other candidates, or that siblings exist** | Cross-candidate context anchors revisions and kills divergence |

### How ARs encode requirements without leaking them

Each AR is a direct present-tense failure claim about the artifact. The requirement's
substance is inside the claim; the spec's structure (section names, ordering, categories)
is stripped. The spec itself carries no entry handles — see the requirements-extractor
skill, whose entries are plain bullets precisely so nothing handle-shaped can leak here.

- ✗ Leaks structure: `The second goal is not met — LinkedIn will reject this.`
- ✓ Direct claim: `This reads as low-effort AI content that a technical audience will reject.`
- ✗ Leaks structure: `A constraint is violated — Capgemini is mentioned.`
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
- Token budgets too tight for ≥2 reviewer rounds (REFINE) or ~10 sub-agent calls per EXPLORE iteration

## Termination

| Signal | Condition | Action |
| --- | --- | --- |
| COMPLETE | REFINE: loop stopped (DEFENSE/CONVERGE/CYCLE/TIMEOUT). EXPLORE: iteration loop stopped (budget / novelty exhaustion / stable winner) with best-ever winner + runner-up | Deliver |
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
not any artifact — **one AR list serves all candidates in every EXPLORE iteration.** The same
AR list is re-passed each round against the evolving artifact; because each reviewer is fresh
and isolated, no cross-round phrasing variation is needed. If a reviewer's reaction reveals a
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

## EXPLORE mode: divergent candidates + Condorcet selection (iterative tournament)

When the problem is open (no committed artifact) or the user asks for alternatives or a
high-stakes "best approach," run an **iterative tournament**.
Every iteration seats exactly 3 candidates — a voting quorum that yields a winner, a
runner-up, and one eliminated. From iteration 2 on, the winner and runner-up defend
their seats against exactly ONE genuinely new challenger, and the cycle repeats until
the strategy space is exhausted or the iteration budget is spent.

```text
sketch       Strategy-space sketch + iteration budget   (MASTER, once per run)
LOOP (iteration k = 1, 2, …):
  seats          k=1 → generate 3 divergent candidates
                 k>1 → carry winner + runner-up (artifacts kept)
                       + generate exactly ONE genuinely new challenger
  convergence    Convergence check                  (MASTER-side, no LLM calls)
  vote           Condorcet pairwise vote            (3 isolated voters, one per pair)
      → iteration winner + runner-up; ledger += all 3 seats
  control        Iteration control                  → next iteration, or STOP
output  Best-ever winner + runner-up
```

### Strategy-space sketch and iteration budget

Before generating any candidate, sketch the strategy space cheaply in MASTER's context:
a compact list of plausible strategy NAMES with one-line summaries — never full
candidates (full enumeration is exactly the token cost the tournament avoids). The
sketch drives the iteration budget, the novelty gate, and exhaustion detection (see Iteration control).

| Domain variability | Signs | Default budget |
| --- | --- | --- |
| Low | 2–4 plausible strategies, settled trade-offs (e.g. "which database: Postgres vs. a proprietary managed engine") | 1 iteration |
| Medium | 5–8 strategies, some unexplored combinations | 2 iterations |
| High | 8+ strategies, fast-moving ecosystem (e.g. "which coding agent" — new entrants monthly) | 3 iterations |

The user's explicit iteration request always overrides the default. Extend past 3 only
on explicit request — the ledger shows diminishing returns well before then.

### Seats per iteration

**Iteration 1:** generate 3 divergent candidates **in a single context that already holds the spec and the strategy sketch** — by default MASTER's own context — so each
candidate is aware of prior ones and can deliberately diverge — cross-awareness drives
divergence; separate contexts produce overlap. Divergence isn't arbitrary: derive 3
cognitive strategies from the specific problem's tensions (competing Goals, Constraints
pulling in different directions — e.g. simplicity vs. extensibility, speed vs. safety,
convention vs. innovation), then generate one candidate per strategy, varying structure
and granularity as secondary axes.
Where the environment can fork a single child context that inherits MASTER's current state, that fork MAY host the generation instead, to keep full candidate text out of MASTER's window: fork once, generate all three there under the same divergence rule, write each to a file, and return only names, one-line strategies, and paths. Never split the work across three parallel generators — one per candidate with none seeing the others repeats the overlap failure even when it looks cheaper.
Prompt template: `references/templates.md § Generation`.

Write each candidate to a file (write-once + edit — see Artifact-Passing Modes).

**Iteration k > 1:** the previous winner and runner-up keep their seats and their
artifacts. MASTER generates exactly ONE new challenger, gated for novelty:

- **Novelty gate.** The challenger must implement a strategy genuinely distinct from
  EVERY variant-ledger entry — not a rephrasing, re-skin, or trivial recombination of
  anything already seen (including eliminated variants). Check against the ledger and
  the strategy sketch; prefer unexplored sketch regions.
- **Eliminated variants may return** in a later iteration — but only re-armed: new
  evidence, a new angle, or a hybrid that makes the re-entry genuinely different from
  the form that lost.
- **No challenger passes the gate → that IS the exhaustion signal.** Skip to iteration control → STOP.

### Variant ledger (MASTER-only state)

An append-only record accumulated across iterations: candidate name, strategy
one-liner, iteration introduced, pairwise vote record, iteration
eliminated (if any). Running in ONE master context with the full ledger in view is what
makes exhaustion detectable — when every new "idea" is a re-skin of a ledger entry, the
space is spent. The ledger feeds the novelty gate, exhaustion detection, and
the best-ever pick (see Output). Like the spec, it is **never shown to voters**.

### Optional hardening (compose REFINE explicitly)

Skip by default: the tournament votes on candidates as generated.

To harden before voting, run REFINE explicitly — per seat before the vote or once on the winner after it (see Composition modes). A per-seat pass follows Steps 2–4 verbatim: one shared AR list, fresh isolated reviewers per seat, candidates never seeing each other, independent termination per seat; carried-over seats MAY skip re-attack on a tight budget when their previous termination was DEFENSE (mark the trace `carried-skip`).

Why a separate step: refinement and selection answer different questions — *does this artifact survive hostile pressure* versus *which of three compares best* — and bundling them forces every tournament to pay the attack cost even when the decision is already clear.

### Convergence check (MASTER-side)

Compare candidates pairwise. If all 3 share >80% structural overlap, merge into
one and skip voting — comparing near-identical solutions produces meaningless
distinctions. If 2 converge but 1 is distinct, merge the pair and run a single comparison.

### Condorcet pairwise vote

Spawn 3 isolated voters, one per pair:

```text
vote-AB: full A + full B + spec → winner?
vote-AC: full A + full C + spec → winner?
vote-BC: full B + full C + spec → winner?
```

Voters receive the full candidates + the MGPC spec — **and
nothing else**: no iteration numbers, no variant ledger, no process metadata. The comparison judges substance;
including survival metadata biases toward endurance rather than quality. Voters with
research tools verify the 2-3 most consequential claims in each candidate before
voting — a well-cited but wrong solution misleads voters who trust citations at face
value. Ties are not allowed.
Prompt template: `references/templates.md § Condorcet`.

**Tally:** most pairwise wins = iteration Winner; second = Runner-up. Tie-break:
the simpler
solution. Append all 3 seats with their vote records to the variant ledger.

### Iteration control and exhaustion

STOP the loop and move to output when ANY of:

1. **Budget reached** — the sketch budget (or the user's explicit iteration count) is spent.
2. **Novelty exhausted** — no challenger passes the novelty gate: every strategy in
   the strategy sketch (plus any discovered mid-run) already sits in the ledger, and remaining
   "new ideas" are only re-skins of ledger entries.
3. **Stable winner** — the same candidate has won two consecutive iterations against
   genuinely new challengers AND the sketch holds no obviously stronger unexplored
   region; a further confirmation round is rarely worth the tokens.

Otherwise → iteration k+1 (back to seats).

### Output

The final pair is the **best-ever by ledger** — normally the last iteration's winner +
runner-up, since they defended their seats against every challenger.

```text
RECOMMENDED → [Winner]: [1-line summary] | Best for: … | Trade-off: …
ALTERNATIVE → [Runner-up]: [1-line summary] | Best for: … | Trade-off: …
SELECTION GUIDANCE → if [criterion] → Recommended; else → Alternative
```

Suppress the runner-up when the user asked for one option, the winner is dramatically
stronger. Hide raw candidates, the ledger, and rejected solutions unless requested.

**EXPLORE cost:** 3 voter calls per iteration. Before producing output, verify the voter sub-agents
were actually dispatched, not simulated inline — declaring a winner
from inline reasoning is self-play and produces output no better than a first draft.

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

✗ [EXPLORE] Letting voters see sibling pairs, iteration numbers, or the variant ledger
✓ Voters see one pair + the spec — substance only, never process or tournament metadata

✗ [EXPLORE] Skipping sub-agent dispatch and picking a winner by inline reasoning
✓ Isolation is the value; inline winner-picking is self-play — no better than a first draft

✗ [EXPLORE] Voting on three near-identical candidates
✓ Run the convergence check first; merge >80%-overlap candidates instead of staging a fake vote

✗ [EXPLORE] Trying to enumerate ALL conceivable candidates in one generation pass
✓ Sketch strategy NAMES cheaply, then tournament 3 seats at a time — winner + runner-up + ONE new challenger per iteration

✗ [EXPLORE] Iteration k's "new" challenger is a re-skin of a variant-ledger entry
✓ Novelty gate against ledger + sketch; no genuine challenger left → exhaustion → STOP with best-ever

✗ [EXPLORE] Iterating past the point where new challengers add nothing
✓ Stop on budget, novelty exhaustion, or a 2-iteration stable winner — then deliver best-ever from the ledger

✗ Leaking "roaster" / "anti-requirement" / "principal architect" / process jargon into the artifact or changelog
✓ Outputs describe the change in neutral language; the method stays invisible
```

---

## Composition modes

| Mode | Pattern | When |
| --- | --- | --- |
| **REFINE standalone** | Blind-attack loop on one artifact | Default for existing artifacts |
| **EXPLORE standalone** | Iterative tournament: 3 seats → vote; +ONE new challenger per iteration (default 1–3) | Open problems, alternatives, high stakes |
| **REFINE inside EXPLORE** | Per-seat REFINE on each candidate before the vote (Steps 2–4 verbatim, one shared AR list) | Vote must choose among hardened candidates; worth the attack cost |
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

EXPLORE (iterative tournament):
spec[Mission, G×3, P×2, C×3]
sketch: {9 strategies} → variability HIGH → budget 3
it1 seats: A(constraint-first), B(convention-first), C(failure-mode-first)
it1 convergence: overlap A/B 45%, A/C 30%, B/C 40% → distinct, proceed
it1 vote: AB→A, AC→A, BC→B → win A, ru B                  ledger: A,B,C
it2 seats: carry A, B + NEW D(ecosystem-first; novelty ✓ vs ledger)
it2 vote: AB→A, AD→A, BD→D → win A, ru D                  ledger: A,B,C,D
it2 control: stable winner ×2 + sketch coverage 7/9, no stronger region → STOP
output: RECOMMENDED A | ALTERNATIVE D
```

`ATK` = the AR list + two-point PT | `defense:` = DEFENSE marker. Append `(INLINE-DEGRADED)`
on inline runs and `(NO-AR-DEGRADED)` only if the isolated AR step was genuinely impossible.

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

See `references/academic-references.md` for full citations.
