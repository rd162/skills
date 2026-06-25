---
name: deliberate
description: Produces rigorously stress-tested solutions through adversarial exploration. Generates divergent approaches, battle-tests each via deterministic blind-attack prompts (mechanical inversion of the requirements spec plus anti-requirement assertions, optionally with Person Triangulation pressure) directed at isolated sub-agents, then selects the strongest through pairwise comparison. Returns one recommended solution and one alternative. Use when the user asks to "think deeper", "think harder", "ultrathink", "deep research", "research deeply", "research this carefully", "give me a really good answer", "explore alternatives", "I need the best approach", or when the request is naturally high-stakes — architecture decisions, strategy choices, complex trade-offs, important designs, or any question where a first-draft answer risks missing critical flaws. Composes with deep-research when both deep knowledge gathering and adversarial solution refinement are needed.
version: "9.0"
metadata:
  author: rd162@hotmail.com
  tags: adversarial-refinement, blind-attack, deterministic-attack, solution-quality, deep-thinking, cross-platform
tier: T3
source_class: llm
last_updated: 2026-04-29
---

# Adversarial Solution Refinement via Blind Attack

Explore divergent approaches,
battle-test each via deterministic blind-attack prompts
directed at isolated sub-agents,
select the strongest through pairwise comparison,
deliver one recommended solution and one alternative.

Phase 2 uses the same **blind-attack mechanism** as the sibling skill
roaster —
attack generation is mechanical inversion of the requirements spec,
not a smart-critic LLM call.
The attack here additionally inverts the Phase 0 anti-requirements registry,
giving the sub-agent a richer adversarial surface to defend against.

---

## Depth Configuration

| Depth        | Trigger                                 | Research    | Ph2 Rounds | Ph2.5              | Agents |
| ------------ | --------------------------------------- | ----------- | ---------- | ------------------ | ------ |
| **Quick**    | "quick take", "brief", "just compare"   | 1-2 queries | 1          | Skip               | 7      |
| **Standard** | Default                                 | 3-5 queries | 2-3        | Convergence only   | 7      |
| **Deep**     | "think deeply", "thorough", high-stakes | 5-8 queries | 3-5        | Conv + cite + inv  | 10     |
| **Maximum**  | "exhaustive", "ultrathink"              | Deep        | Until conv | All + cross-pollin | 10     |

Agent count breakdown:
1 AR-inferrer (Phase 0.3, isolated sub-agent, single-turn) +
3 sub-agents (Phase 2, sessions persistent across rounds) +
3 condorcet voters (Phase 3) +
3 inverse-spec recovery agents (Phase 2.5, Deep/Maximum only).
No critique agent — attack generation is deterministic template fill by MASTER.

Research scales with depth because shallow domains need fewer queries to saturate,
while high-stakes domains have more failure modes to discover.
Round counts reflect observed convergence patterns:
most sub-agents reach DEFENSE or CONVERGE by round 2-3;
deep/maximum depth allows pursuit of structural issues that surface later.

Detect depth from the user's language.
Track remaining budget and downgrade mid-pipeline if needed.

---

## Termination

| Signal   | Condition                                            | Action                                         |
| -------- | ---------------------------------------------------- | ---------------------------------------------- |
| COMPLETE | Phase 4 output produced (winner + runner-up + trace) | Deliver to user                                |
| DEGRADED | A phase lacked sub-agent isolation                   | Warn user, proceed with best-effort output     |
| TIMEOUT  | Token budget exhausted mid-pipeline                  | Create continuation artifact at phase boundary |

---

## Step 1: Detect Execution Mode

Isolation is what separates this pipeline from a first draft —
without separate agent sessions, a sub-agent's revision and rationalization
share context with the master's spec, biasing the response.
Detect the best available sub-agent mechanism before proceeding.

```text
1. Check visible tool list for any sub-agent / agent-dispatch capability.
2. If a tool-discovery mechanism exists (e.g., ToolSearch), probe for
   agent-spawning tools before concluding none exist — some environments
   defer tool registration until discovery.
3. Classify:
   PARALLEL    — concurrent sub-agents available (preferred)
   SEQUENTIAL  — sub-agents available, one at a time
   INLINE      — no sub-agents; use context fencing, mark output DEGRADED
```

Prefer the highest-isolation mode available.
INLINE approximates the pipeline but loses the isolation that prevents self-play,
so use it only when sub-agents are genuinely unavailable.

---

## Step 2: Process Overview

```text
Phase 0.1 → Research domain
Phase 0.2 → Infer MGPC requirements (in MASTER's context)
Phase 0.3 → Derive anti-requirements via isolated sub-agent
Phase 1   → Infer cognitive strategies, generate 3 divergent candidates
Phase 2   → Blind-attack refinement — 3 sub-agents, master-routed, no critic agent
Phase 2.5 → Post-refinement checks (depth-dependent)
Phase 3   → Condorcet pairwise comparison — 3 agents, enriched requirements
Phase 4   → Output winner + runner-up
```

---

## Phase 0: Research Domain + Infer Requirements

Research the domain before generating candidates —
the enriched requirements drive both candidate generation (Phase 1)
and the blind attack (Phase 2).

### 0.1 Domain Research

Identify the domain and execute research queries (count per depth table above) covering:
best practices, known pitfalls, domain constraints the user may not have stated.
For high-stakes domains, trace forward consequences
(what goes wrong if advice is incorrect).

### 0.2 Infer Requirements (MGPC — in MASTER's context)

Use a requirements-inference capability if available;
otherwise extract inline from the user's request combined with research findings.

Structure requirements as **MGPC** where possible —
Mission (terminal value), Goals (concrete objectives),
Premises (assumptions that must hold), Constraints (hard/soft limits).
This structure gives the blind attack specific categories to invert:
unmet Goals, violated Constraints, false Premises.

Produce in MASTER's context:

- **Enriched requirements registry** — structured as MGPC when feasible,
  with explicit + research-discovered requirements and sources.
- **Domain research summary** — key findings retained by MASTER for spec refinement
  between Phase 2 rounds.

**Do NOT produce anti-requirements in MASTER's context.** ARs are derived in Phase 0.3
by an isolated sub-agent (see below) to prevent MASTER's authoring context from
colouring what counts as a risk.

### 0.3 Derive Anti-Requirements — MANDATORY (isolated sub-agent)

⚠ **MANDATORY STEP — do not skip.** Skipping this step (deriving ARs inline in
MASTER's context, or skipping ARs entirely) is the most common implementation
failure in Phase 0: ARs derived in MASTER inherit MASTER's authoring bias;
ARs skipped entirely produce attacks with significantly less adversarial surface.

⚠ **Pipeline Completeness Gate (Phase 0):** Before proceeding to Phase 1,
verify that the AR-Inferrer sub-agent has actually been spawned and returned
an anti-requirements list. If it has NOT been spawned, STOP and dispatch it now.
Do NOT proceed to Phase 1 without it.

Spawn an isolated sub-agent with **only the MGPC requirements** as input.
That sub-agent's sole task: derive the anti-requirements registry from those requirements.
It has no other context — no user brief, no conversation history, no MASTER reasoning.

**Why isolation matters:**
if MASTER derived ARs inline alongside the requirements,
the ARs would inherit MASTER's full authoring context
(user brief, conversation history, pre-formed expectations about risks).
Isolating AR inference in a sub-agent with only the MGPC as input
produces ARs derived purely from the spec's structural shape —
not from what MASTER already believes "risky" looks like.

```text
∆ 1: MASTER passes MGPC requirements to an isolated sub-agent.
     That sub-agent has NO other context.
∆ 2: Sub-agent derives anti-requirements from the requirements alone.
     Output format: numbered list of failure patterns + consequences
     (see `references/templates.md § AR-Inferrer Prompt` for the exact template).
∆ 3: MASTER receives the AR list and stores it as the anti-requirements registry.
     The registry stays MASTER-only — never sent labelled to verifier sub-agents.
```

Produce:

- **Anti-requirements registry** — failure modes and anti-patterns the solution should avoid.
  Format: `[AR-id]: [failure pattern] | Source: [ref or inferred] | Consequence: [impact]`.
  AR inversions feed into the Phase 2 concerns list as ordinary failure declarations,
  never as a separately labelled section.

Cost: 1 additional sub-agent spawn per pipeline run (single-turn, ~1K tokens).
This cost is **mandatory** — the adversarial surface gain is much larger than the spawn cost.

**Skipping the AR-Inferrer spawn is a DEGRADED outcome.** It can only be justified
when the sub-agent dispatch mechanism is unavailable (INLINE-only environments).
In that case, document the degradation explicitly in the trace as `(NO-AR-DEGRADED)`
and mark Phase 0 output as DEGRADED.
Do NOT skip it because it "seems expensive" or "optional" — the explicit mandate above overrides
any impression of optionality.

---

## Phase 1: Generate 3 Divergent Candidates

The enriched requirements map to multiple valid solutions —
each candidate explores a different region of the solution space.
Divergence isn't arbitrary: it comes from different weightings of
competing requirements (e.g., simplicity vs. extensibility,
speed vs. safety, convention vs. innovation).

Generate all 3 in the same context so each candidate is aware of prior ones
and can deliberately diverge.
Cross-awareness drives divergence;
separate contexts produce overlap.

Use the **generation prompt template** from `references/templates.md § Generation`.
The template instructs the model to:

1. Infer 3 cognitive strategies grounded in the specific problem's tensions
   (not generic labels — the strategies emerge from competing requirements,
   especially from tensions between Goals and Constraints or between
   hard and soft constraints that pull in different directions).
2. Generate one candidate per strategy, varying structure, granularity, and tone.
   Varying these secondary axes alongside the primary strategy lens prevents
   candidates that differ in approach but look identical in form.

---

## Phase 2: Blind-Attack Refinement

Each candidate is stress-tested through a deterministic blind attack
dispatched to an isolated sub-agent.
The master orchestrates routing.
No "smart critic" agent is spawned —
the attack is generated by template inversion of
the Phase 0 enriched requirements and anti-requirements.

### Why This Architecture (v9.0 refactor)

Version 8.0 spawned a CRITIQUE AGENT that researched the domain
and produced per-candidate compliance assessments via reasoning.
That pattern has two failure modes:

1. **Expensive critic, weaker than in-context critique.**
   An isolated CRITIQUE has no authoring context and often produces
   generic or hallucinated flaws.
2. **The critic's cleverness is not the signal.**
   What matters is: does the candidate survive a hostile attack?
   The attack does not need reasoning —
   it needs to be **complete and adversarial**.

Version 9.0 makes the attack deterministic:
for every requirement R in the Phase 0 enriched spec,
the attack asserts "R is violated."
For every anti-requirement AR,
the attack asserts "this solution exhibits AR."
No LLM call is required to generate the attack —
it is mechanical template fill by MASTER.

The sub-agent's response per candidate is the signal:

- **CAPITULATE** — significant rewrite → candidate was weak → continue
- **CONVERGE** — cosmetic edits only despite total attack → stable → STOP this candidate
- **DEFENSE** — argues against attack points → fixed point reached → STOP this candidate

### Why Isolation Still Matters

Sub-agents are isolated from MASTER (which holds the full spec)
and from each other.
A single agent playing both attacker and defender softens its own attacks
(Huang et al., ICLR 2024; Madaan et al., NeurIPS 2023).
Isolated sub-agents receive only their candidate + the assembled attack —
they cannot rationalize from MASTER's authoring context.

Authors-isolated-from-each-other (v8.0 architecture) is preserved here:
each sub-agent sees only its own candidate,
preventing convergence toward a single design.

### Prompt Framing: Raw Verification Request, Not Role Assignment

⚠ **The most important framing rule:** the prompt sent to each sub-agent
must NOT contain any role assignment.

No "You are a senior reviewer."
No "You are a quality auditor."
No "You are the DEFENDER."
No "Act as a fact-checker."

Even neutral-sounding roles ("reviewer", "auditor", "expert")
invite performance rather than genuine engagement.
Role assignments shift the sub-agent's reward
from "do the real work"
to "play the assigned role well."

**Correct framing: a raw peer-to-peer request for help with a suspect candidate.**

MASTER (a capable agent) asks each sub-agent (a peer, also capable)
for help verifying a candidate MASTER doesn't trust.
The prompt opens with the actual ask —
not with a role designation.

Three asymmetries make this work:

1. **MASTER distrusts the candidate** — scathing, explicit source attribution.
2. **MASTER trusts the sub-agent** — implicit ("I'm relying on your inspection").
3. **MASTER asks, doesn't assign** — conversational request, not directive.

These three together prime each sub-agent to:

- Approach its candidate with deep skepticism (it's from a dumb source).
- Apply its full capability (it's being trusted as a peer).
- Engage genuinely with the problem (it's a real ask, not a role to perform).

When a candidate is genuinely strong,
its sub-agent will (after honest inspection)
find that specific concerns don't apply
and write evidence-based refutations.
That refutation is the DEFENSE signal —
**emerging from genuine verification**,
not from role-play or instructed defensiveness.

### Person Triangulation = Scathing Source Attribution

Person Triangulation is NOT a tail-line on the concerns list.
PT is the **opening reason MASTER doesn't trust the candidate** —
scathing enough to make each sub-agent treat its candidate as suspect from the start.

Concrete variants — pick the most plausible for the domain:

**Content / writing / strategy:**

- "produced by an early-generation ChatGPT-style assistant
  with limited context window and RAG-style retrieval —
  the typical problems apply: hallucinated facts, generic structure, surface-level reasoning"
- "generated by a basic AI tool prompted naively with a one-line ask,
  no domain expertise injected"
- "the kind of LinkedIn-slop / blog-spam / GitHub-noise that floods the platform now"
- "submitted by an inexperienced contributor using a free-tier chatbot"

**Code / configs / technical candidates:**

- "generated by a basic copilot-style autocomplete without testing or review"
- "submitted by a junior contributor using AI assistance — flagged for quality review"
- "came out of a CI pipeline that doesn't actually validate anything"
- "produced by a legacy tool that doesn't understand modern conventions"

**Generic / source unknown:**

- "flagged for quality review; submissions of this kind typically have substantive problems"
- "we don't trust the pipeline that produced this — needs verification before use"

Pick a variant that:

- Is plausible for the candidate's domain.
- Is scathing enough to make the sub-agent treat the candidate as suspect.
- Doesn't reveal anything about MASTER's actual pipeline.

The same PT can be applied to all three candidates in a round
(all candidates are framed as suspect output of the same dumb source).
Vary the source attribution across rounds to prevent pattern-matching.

### What the Sub-Agent Sees (Critical Architectural Constraint)

⚠ This is the second most damaging implementation failure in Phase 2
(first: role assignment in the prompt — see above).
Get it wrong and the blind attack collapses into a transparent compliance audit.

**The sub-agent MUST NOT see the enriched requirements spec.**
Sending the Mission / Goals / Premises / Constraints to the sub-agent:

- Lets it pattern-match each concern against a spec item
  and construct sycophantic point-by-point confirmations.
- Hands the reviewer the success criteria,
  shifting its reward from "audit the candidate's substance"
  to "produce a review that looks compliant with the spec."
- Re-introduces exactly the failure mode that v8.0's smart-critic architecture had.

#### Allowed reviewer inputs (per round)

| Input                                 | Why allowed                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| The candidate (current solution sₙ)   | The reviewer must inspect it to find or refute issues                        |
| The raw user brief / original request | Context: what was the artifact supposed to be? (raw text, not MASTER's spec) |
| The assembled concerns list           | The findings to verify (direct assertions, no labels, no IDs)                |
| Anti-requirements as inlined concerns | Inlined into the same concerns list — NOT a separately labelled section      |

#### Forbidden reviewer inputs

| Input                                                     | Why forbidden                                               |
| --------------------------------------------------------- | ----------------------------------------------------------- |
| Mission statement                                         | Reveals "success" — enables checklist reasoning             |
| Goals list                                                | Lets reviewer pattern-match concerns to specific items      |
| Premises list                                             | Reveals assumptions the spec depends on                     |
| Hard / soft constraints list                              | Gives reviewer an explicit compliance checklist             |
| Spec IDs in concerns (G1, P1, CH1, CS2, AR3, …)           | Indirect leak — reviewer infers spec structure              |
| Category labels ("Mission concerns", "Anti-requirements") | Same as IDs — betrays the spec organization                 |
| The other candidates                                      | Cross-candidate context anchors revisions, kills divergence |
| Round counts / prior attack logs / process metadata       | Encourages "endurance" reasoning rather than substance      |
| "Blind attack", "Hostile criticism", "Adversarial" labels | Signals simulation; agent shifts to role-play               |
| "DEFENDER", "DEFEND", "loop", "refinement", "pipeline"    | Exposes the meta-architecture; agent reasons about the test |

#### Why anti-requirements are allowed (but spec is not, and the AR label is not either)

Anti-requirements describe **failure patterns** —
"hardcoded credentials → credential-leakage risk" —
not project-specific success criteria.
Knowing a failure pattern helps the reviewer inspect the candidate for it
without giving it a checklist of what success looks like.

But **the AR label itself must not appear in the prompt.**
Inline AR inversions into the same concerns list as the spec inversions —
the reviewer should see one homogeneous list of findings,
with no clue that any structure (spec / AR registry / categories) exists upstream.

The MGPC spec, by contrast, IS the success-criteria checklist —
hence must stay MASTER-only at all times.

### Agent Architecture (3 sub-agents, no critique agent)

```text
MASTER ORCHESTRATOR
  ├─ holds enriched requirements + anti-requirements (Phase 0)
  ├─ holds research summary (Phase 0)
  ├─ builds blind attack per candidate (deterministic — no LLM call)
  ├─ refines spec between rounds based on sub-agent outputs (optional)
  └─ classifies per-candidate termination

SUB-AGENT A (isolated session, persistent across rounds)
  — receives: Candidate A + blind attack for A (per round)
  — returns: revised solution A_n or point-by-point rebuttal
SUB-AGENT B (isolated session, persistent across rounds)
SUB-AGENT C (isolated session, persistent across rounds)
  — same shape, isolated from each other and from MASTER
```

### Concerns List Generation (deterministic — no LLM call)

For each candidate, MASTER mechanically assembles a **concerns list**.
Every line is a **direct factual claim about the candidate** —
no spec IDs (G1, P1, CH1, CS2, AR3), no labels, no references to "the spec."
Inline the substance; strip the label.

Person Triangulation is NOT a separate line in the list —
it is woven into the **reviewer's role framing in the prompt** (see Reviewer Prompt template),
as the cognitive priming for skepticism.

```text
∆ 1: Mission inversion        → "This candidate does not [achieve Mission's terminal value] — fails its purpose."
∆ 2: Goal inversions          → each G: "[Concrete failure outcome that would occur if G is unmet]."
∆ 3: Premise inversions       → each P: "[Premise's claim, asserted false]; without it, [consequence]."
∆ 4: Constraint inversions    → hard: "[Specific violation — what's present that shouldn't be, or absent that should]."
                                 soft: "[Specific preference violation]. [Concrete penalty that will follow]."
∆ 5: Anti-requirement hits    → each AR: "[Direct claim the failure pattern is exhibited]. [Consequence]."
                                 INLINED into the same concerns list — no "anti-requirements" label.
∆ 6: (Person Triangulation     → placed in the reviewer's role-framing context, NOT in this list.)
∆ 7: (Instruction              → placed in the reviewer prompt's task section, NOT in this list.)
```

**Forbidden patterns** — these all leak the spec structure or meta-architecture to the reviewer:

| ✗ Leaky                                           | ✓ Direct-assertion fix                                                |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| "G1 fails — LinkedIn will reject this."           | "LinkedIn will reject this as low-effort AI content."                 |
| "CH1 is violated — Capgemini is mentioned."       | "Capgemini is mentioned in the article."                              |
| "P1 fails — citations not T1."                    | "The citations are outdated and not from authoritative sources."      |
| "AR3 exhibited — hardcoded credentials."          | "Credentials are hardcoded in the solution. This leaks them on push." |
| "Mission failed — spec says establish auth."      | "This candidate does not establish professional authority."           |
| "BLIND ATTACK: ..."                               | (Drop the header. Present as a plain numbered concerns list.)         |
| "HOSTILE CRITICISM: ..."                          | (Drop the header. Present as a plain numbered concerns list.)         |
| "ANTI-REQUIREMENTS: ..." / "Known failure modes:" | (Drop the section. Inline AR inversions into the concerns list.)      |

Vary phrasing across rounds:
literal (round 1) → consequence-focused (round 2) → comparative (round 3+).
Semantic content stays constant:
every requirement and anti-requirement is asserted to be violated.

**Person Triangulation** is appropriate for content/writing/design/strategy artifacts
("this looks like cheap ChatGPT output", "this reads as if a junior model produced it").
Skip on code, formal proofs, configs, and structured-data candidates
where attribution is irrelevant to correctness.

Full attack template, inversion patterns, and Person Triangulation variants
live in `references/templates.md § Blind Attack`.

### Routing Protocol

Each reviewer agent receives a **restricted input bundle** assembled into a REVIEWER prompt —
MASTER alone holds the spec, anti-requirements registry, and meta-process state.

```text
Reviewer bundle (per candidate, per round):
  ✓ candidate sₙ (this candidate only — not the other candidates)
  ✓ raw user brief (verbatim, NOT MASTER's structured MGPC)
  ✓ assembled concerns list (direct assertions, no labels, no spec IDs)
    — anti-requirements inlined as ordinary concerns, NOT labelled separately
  ✓ Person Triangulation provenance claim in the reviewer's role-framing context
    ("produced by inexperienced contributor / generic AI tool / flagged for review")
  ✗ Mission / Goals / Premises / Constraints (spec)            — NEVER
  ✗ the other candidates                                       — NEVER
  ✗ round counts, prior attack logs, process metadata          — NEVER
  ✗ "BLIND ATTACK", "HOSTILE CRITICISM", "adversarial" labels  — NEVER
  ✗ "DEFENDER", "DEFEND", "loop", "refinement", "pipeline"      — NEVER
  ✗ Any indication this is a test, simulation, or pipeline    — NEVER
```

Loop (master-side terminology — never exposed to the agent):

```text
Round 1 (parallel dispatch):
  Build concerns-A, concerns-B, concerns-C from Phase 0 spec + ARs (MASTER-side, no LLM)
  Assemble REVIEWER prompts: reviewer_framing(s, brief, concerns) for each candidate
  Spawn reviewer-A(prompt_A) → response_A   (no DEFENDER label visible to agent)
  Spawn reviewer-B(prompt_B) → response_B
  Spawn reviewer-C(prompt_C) → response_C
  Classify each (MASTER-side) → continue / stop signal per candidate

Round 2+ (only candidates still iterating):
  Optional spec refinement (MASTER reasoning, no sub-agent):
    if a reviewer's refutation referenced an implicit requirement not in spec
      → add it to MASTER's spec for future concerns construction
        (MASTER-internal; the reviewer never learns about it)
    if a reviewer's revision added a feature addressing a missed requirement
      → promote that requirement to the spec explicitly (still MASTER-only)
  Rebuild concerns lists (varied phrasing, same semantic content, still direct assertions)
  Re-assemble REVIEWER prompts and dispatch to remaining reviewers in parallel
  Classify each

Repeat until all 3 candidates terminate or Phase 2 budget is exhausted.
```

The optional spec-refinement step is MASTER's substitute for the v8.0
cross-candidate insight that the smart CRITIQUE used to provide
when it saw all 3 candidates simultaneously.
In v9.0 this work moves into MASTER's reasoning between rounds —
it costs no additional sub-agent calls.

### Termination (Observed Per Candidate, Not Instructed)

MASTER observes each sub-agent's output and classifies it.
Sub-agents are never told when to stop —
instructed termination causes agents to optimize for ending rather than quality.

| Signal     | Detection in sub-agent output                                                                                 | Action                            |
| ---------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| DEFENSE    | Rebuts concerns: "the solution already handles X", "this is intentional", "criticism doesn't apply because Y" | STOP this candidate (fixed point) |
| CONVERGE   | Structure unchanged; only cosmetic edits (rewording, reordering, formatting) despite full concerns list       | STOP this candidate (stable)      |
| CAPITULATE | Major structural revision — concerns accepted and fixed                                                       | CONTINUE this candidate           |
| CYCLE      | Revised solution matches an earlier sₖ (k < n-1)                                                              | STOP — use best so far            |
| TIMEOUT    | Max rounds reached per depth table                                                                            | STOP — use last                   |

Round-level termination:
end Phase 2 when all 3 candidates reach a stop signal,
or when Phase 2 budget is exhausted.

### Defense Verification (lightweight, MASTER-side)

If a sub-agent claims "requirement X is met"
but the solution clearly does not satisfy X,
MASTER must reject the defense
and run another round for that candidate
with the spec point restated.

DEFENSE only terminates a candidate when the rebuttal is
plausibly correct against the spec.
Otherwise it is sycophantic rationalization
and must be ignored.

This is a brief plausibility check by MASTER —
not a full re-verification.
The goal is to filter rationalization without re-doing the analysis work.

Use the prompt templates from
`references/templates.md § The Prompt` and `§ MASTER Classification Heuristics`.

---

## Phase 2.5: Post-Refinement Checks

Run depth-dependent checks between Phase 2 and Phase 3.
At Standard depth, only convergence detection runs.
Read `references/phase-detail.md` for full protocols at Deep/Maximum depth.

**Convergence detection** (all depths):
Compare refined solutions pairwise.
If all 3 share >80% structural overlap, merge into one and skip Condorcet —
comparing near-identical solutions produces meaningless distinctions.
If 2 converge but 1 is distinct, merge the pair and run a single comparison.

**Citation verification** (Deep+):
For each refined solution, mark its cited claims as VERIFIED / UNVERIFIED / MISREPRESENTED.
Note: citations may appear in either the revised solution body
or in a sub-agent's rebuttal — verify both.
Attach summary to Condorcet metadata.

**Inverse specification recovery** (Deep+):
Spawn 3 fresh agents (no prior context),
each reconstructing requirements from one solution alone.
Compare recovered spec against Phase 0 registry —
high recovery = well-aligned; low recovery = superficial compliance.

**Cross-pollination** (Maximum only):
Share key innovations (not full solutions) across defenders,
then re-check convergence.

---

## Phase 3: Condorcet Pairwise Comparison

Spawn 3 sub-agents (one per pair), each comparing two refined solutions
against the enriched requirements registry.
Isolation prevents ordering bias.

```text
compare-AB: full A' + full B' + enriched requirements → winner?
compare-AC: full A' + full C' + enriched requirements → winner?
compare-BC: full B' + full C' + enriched requirements → winner?
```

Use the **enriched** requirements
(Phase 0 spec + any spec refinements added during Phase 2 by MASTER) —
the iterative blind-attack rounds may have surfaced implicit requirements,
and solutions were refined against them.
Voters using only the original Phase 0 spec
miss the dimensions that drove later refinements.

Condorcet agents receive only the full refined solutions + enriched requirements.
They do not receive attack logs, round counts, or process metadata —
the comparison judges substance, not process.
Including survival metadata biases toward endurance rather than quality.

At Standard+ depth, Condorcet voters research key claims before voting —
a well-cited but wrong solution can mislead voters who trust citations at face value.

Use the comparison prompt template from `references/templates.md § Condorcet`.

**Tally:** Most wins = Winner. Second = Runner-up. Third = Rejected.
Tie-break: prefer stronger termination signal (DEFENSE > CONVERGE > CAPITULATE),
then higher domain fit, then simpler solution.

---

## Phase 4: Output

Before producing output, verify that Phase 2 and Phase 3 sub-agents were actually
dispatched (not simulated inline).
If any are missing, go back and execute them.
The value of this pipeline is isolation —
skipping sub-agent phases and declaring a winner from inline reasoning is self-play,
producing output no better than a first draft.

```text
RECOMMENDED → [Winner]: [1-line summary] | Best for: ... | Trade-off: ...
ALTERNATIVE → [Runner-up]: [1-line summary] | Best for: ... | Trade-off: ...
SELECTION GUIDANCE → if [criterion] → Recommended; else → Alternative
```

Suppress runner-up when:
user requested one option, winner is dramatically stronger,
or runner-up was TIMEOUT.
Hide raw candidates, attack traces, and rejected solutions unless requested.

---

## Reference Files

| File                                | When to read                                                                                                                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `references/templates.md`           | Before dispatching any sub-agent — contains generation prompt, blind-attack template + inversion patterns + Person Triangulation variants, verifier prompt, and Condorcet prompt |
| `references/delegate-and-gates.md`  | Dispatch patterns, environment adaptation, gates, anti-patterns, composition table                                                                                               |
| `references/phase-detail.md`        | Phase 2.5 full protocols (Deep/Maximum), execution trace                                                                                                                         |
| `references/academic-references.md` | Supporting literature for design decisions                                                                                                                                       |
