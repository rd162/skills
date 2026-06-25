---
tier: T3
source_class: llm
last_updated: 2026-04-29
description: delegate and gates
---

# Sub-Agent Dispatch, Gates, Anti-Patterns, and Composition — v9.0

Architectural reference for the dispatch patterns, isolation guarantees,
compositional gates, anti-patterns, and capability composition
that the v9.0 blind-attack pipeline relies on.

---

## Table of Contents

1. [Architecture Diagram](#architecture-diagram)
2. [Why This Architecture](#why-this-architecture)
3. [Sub-Agent Dispatch Patterns](#sub-agent-dispatch-patterns)
4. [Environment Adaptation](#environment-adaptation)
5. [Model Selection for Sub-Agents](#model-selection-for-sub-agents)
6. [Compositional Gates](#compositional-gates)
7. [Execution Mode Decision Tree](#execution-mode-decision-tree)
8. [Phase 3: Extended Condorcet Details](#phase-3-extended-condorcet-details)
9. [Anti-Patterns](#anti-patterns)
10. [Composition with Other Capabilities](#composition-with-other-capabilities)
11. [Practical Guidance from Testing](#practical-guidance-from-testing)

---

## Architecture Diagram

```text
PHASE 0.3 — AR derivation (isolated sub-agent):

┌─────────────┐      MGPC only      ┌─────────────────────┐
│   MASTER    │ ──────────────────▶│  AR-INFERRER     │
│             │ ◀─── anti-reqs ──│ (no other context)│
└─────────────┘                     └─────────────────────┘

PHASE 2 — Blind-attack refinement:

┌──────────────────────────┐
│      MASTER Orchestrator    │
│ ─ holds enriched MGPC reqs │
│ ─ holds AR registry        │
│ ─ builds blind attacks      │  ← deterministic, no LLM
│ ─ refines spec between      │
│   rounds (MASTER reasoning) │
│ ─ classifies responses      │
└──┬─────────┬─────────┬──────┘
   │         │         │
   │ attack-A│ attack-B│ attack-C
   ▼         ▼         ▼
┌────────┐┌────────┐┌────────┐
│SUB-AGT ││SUB-AGT ││SUB-AGT │
│   A    ││   B    ││   C    │
│(isolated session, persists  │
│ across rounds — each sees   │
│ only its own candidate)     │
└────────┘└────────┘└────────┘
```

No CRITIQUE agent — attack generation is mechanical template fill
by MASTER from the Phase 0 enriched requirements and anti-requirements registry.
The AR-inferrer is the only Phase 0 sub-agent;
it runs once, returns the AR list, then exits.

---

## Why This Architecture

### Why defenders isolate (from MASTER and from each other)

Independent improvement prevents convergence toward a single design.
If Defender A sees critiques or revisions of B and C,
it anchors toward avoiding their weaknesses
rather than strengthening its own approach.

Defender isolation from MASTER prevents rationalization:
the defender has no access to the spec's authoring intent,
only to its candidate and the assembled attack.
This forces the defender to defend on substance,
not on appeal to authorial reasoning that no external reader would see.

### Why no smart critique agent (v9.0 refactor)

In v8.0 a CRITIQUE AGENT reasoned over all 3 candidates
and produced per-candidate compliance assessments.
This had two failure modes:

1. **Expensive critic, weaker than in-context critique.**
   An isolated CRITIQUE has no authoring context and often produces
   generic or hallucinated flaws — worse than same-context critique
   plus the token cost.
2. **The critic's cleverness was not the actual signal.**
   What matters is whether the candidate survives a hostile attack.
   The attack does not need reasoning to be effective —
   it needs to be complete and adversarial.

v9.0 eliminates the CRITIQUE.
The attack is mechanically inverted from the requirements spec by MASTER.
The defender's response is the signal.

### Where the v8.0 cross-candidate insight goes

The v8.0 CRITIQUE saw all 3 candidates and could discover
implicit requirements that emerged from comparison
(e.g., "Solution B handles X, suggesting X is an implicit requirement").

In v9.0 this work moves into MASTER's reasoning between rounds.
After collecting defender responses, MASTER can inspect them:

- If a defender's rebuttal references an implicit requirement not in the spec → add it.
- If a defender's revision addresses a missing requirement → promote it to the spec.

The next round's attacks include the refined spec.
This costs no additional sub-agent calls — it is MASTER reasoning, not a dispatch.

### Why no role-game framing

LLMs turn adversarial roles into performative games —
"attacker" agents exaggerate flaws for dramatic effect,
"defender" agents become dismissive rather than analytical.
The defender prompt presents the criticism as a serious external review
and asks for either a revised solution or a point-by-point rebuttal.
Defense emerges naturally when the candidate is strong;
capitulation emerges when it is weak — neither is instructed.

---

## Sub-Agent Dispatch Patterns

### Syntax

```text
Spawn defender sub-agents (parallel where possible):

1. **defender-A**: revise or rebut Candidate A
   - Give it: Candidate A + assembled attack-A
   - Returns: revised solution OR point-by-point rebuttal

2. **defender-B**: revise or rebut Candidate B
   ...

Merge: MASTER classifies each response → DEFENSE / CONVERGE / CAPITULATE / CYCLE / TIMEOUT
```

### Modes

| Mode                     | Behavior                                               |
| ------------------------ | ------------------------------------------------------ |
| `parallel + stateful`    | All 3 defenders concurrent + session persistence       |
| `parallel + stateless`   | All 3 defenders concurrent, re-pass context each round |
| `sequential + stateful`  | Defenders one after another, session-persistent        |
| `sequential + stateless` | Defenders one after another, fresh context each round  |
| `inline`                 | All work in main thread, context fencing — DEGRADED    |

`parallel + stateful` is the primary mode for v9.0.
All 3 defenders run concurrently within each round,
and each defender's session persists across rounds
so attack history accumulates inside the defender's context.

### High-Stakes Domain Extension

For high-stakes domains (medical, legal, financial, safety-critical):

```text
Defenders should:
  1. Perform research before producing output (verify the attack's claims)
  2. Apply forward-consequence reasoning (trace implications 2-3 steps ahead)
  3. Cite authoritative sources (T1/T2 tier) when defending or revising
```

The defender prompt template already instructs this when research tools are available.

---

## Environment Adaptation

The skill uses natural-language sub-agent instructions that work across
any environment with agent-dispatch capabilities.
Detect what your environment provides and use the highest-isolation mode available.

| Capability level       | Parallel? | Session continuity? | Notes                                       |
| ---------------------- | --------- | ------------------- | ------------------------------------------- |
| Stateful sub-agents    | Yes       | Yes                 | Best: parallel + session_id continuity      |
| Stateless sub-agents   | Yes       | No                  | Re-pass accumulated context each round      |
| Sequential sub-agents  | No        | Maybe               | Good isolation but no parallelism           |
| Inline (no sub-agents) | No        | No                  | Context fencing only — mark output DEGRADED |

**Degradation order:**

1. Parallel + stateful (full isolation + concurrent refinement + cheap continuity)
2. Parallel + stateless (good isolation + concurrent, O(N²) token cost per session)
3. Sequential + stateful
4. Sequential + stateless
5. Inline with context fencing (no isolation, mark output DEGRADED)

---

## Model Selection for Sub-Agents

Different agent roles have different cognitive demands.
When the environment allows model selection per sub-agent,
use the strongest model where reasoning depth matters most
and faster models where the task is more mechanical.

| Agent Role                       | Cognitive Demand | Model Tier             | Rationale                                                                                       |
| -------------------------------- | ---------------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| **AR-Inferrer (Phase 0.3)**      | Moderate         | Capable (sonnet-class) | Single-turn extraction of failure patterns from MGPC — structured, well-suited to capable model |
| **Generation (Phase 1)**         | High             | Strongest (opus-class) | Divergent exploration requires deep domain understanding                                        |
| **Sub-Agents (Phase 2)**         | High             | Strongest (opus-class) | Must do deep research and produce substantive fixes / refutations / enrichments                 |
| **Condorcet Voters (Standard+)** | High             | Strongest (opus-class) | Research-armed voting with claim verification needs strong reasoning                            |
| **Condorcet Voters (Quick)**     | Moderate         | Fast (sonnet-class)    | Quick-depth comparisons are straightforward requirement matching                                |
| **Inverse Spec Recovery**        | Moderate         | Fast (sonnet-class)    | Structured extraction from solution text suits faster models                                    |

The v8.0 CRITIQUE row is removed — there is no critique agent in v9.0.
The attack is template fill by MASTER, requiring no model.

**When model selection is unavailable:**
Use the default model for all agents.
Isolation alone (separate contexts preventing self-play bias)
justifies sub-agent dispatch.

**Cost optimization at scale:**
At Quick depth with 7 agents,
using fast models for Condorcet voters and the AR-Inferrer
reduces total pipeline cost by ~20-30% with minimal quality impact.
At Deep/Maximum depth, use the strongest model for all agents —
every phase involves research and complex reasoning.

---

## Compositional Gates

Gates enforce capability dependencies between phases.
Each gate declares what is needed and what evidence proves it —
not a specific tool name. This keeps the skill portable.

### Gate Syntax

```text
GATE(label):
  REQUIRES: [capability description]
  PREFERRED: [recommended capability if available]
  EVIDENCE: [artifact that proves requirement met]
  FALLBACK: [degraded path if capability unavailable]
```

### Gates in v9.0

| Phase | Gate                      | Requires                              | Evidence                           | Fallback                                                    |
| ----- | ------------------------- | ------------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| 0.1   | Knowledge Saturation      | Domain research                       | Enriched requirements w/ sources   | Training knowledge only                                     |
| 0.2   | Requirements (in-context) | Requirements inference (MGPC)         | Structured specification           | Inline extraction                                           |
| 0.3   | AR Isolation              | Isolated sub-agent receives MGPC only | AR list returned by isolated agent | Inline AR derivation (DEGRADED — colored by MASTER context) |
| 1     | Candidate Generation      | 3 divergent solutions                 | 3 distinct candidates              | Model generates all                                         |
| 2     | Sub-Agent Isolation       | Separate agent sessions per candidate | Independent execution contexts     | Context fencing                                             |
| 2     | Attack Construction       | MGPC + AR registry → template fill    | Assembled attack string            | Partial spec, partial attack                                |
| 2     | Sub-Agent Research        | Search tools (deep-research ideal)    | Cited sources in sub-agent output  | Training knowledge only                                     |
| 2.5   | Convergence Detection     | Pattern analysis (optional)           | Termination signal detected        | Fixed iteration count                                       |
| 2.5   | Citation Verification     | Source validation (optional)          | Citations checked against sources  | Trust outputs at face value                                 |
| 3     | Pairwise Isolation        | Separate comparison sessions          | Independent comparison contexts    | Sequential fencing                                          |
| 3     | Enriched Requirements     | Final spec including Phase 2 refines  | Enriched reqs at Condorcet input   | Original Phase 0 reqs                                       |

### Gate Verification

```text
FOR EACH gate in current phase:
  evidence present? → check artifacts match EVIDENCE spec
    YES → gate OPEN → proceed
    NO  → scan available capabilities → invoke if found → re-check
      → IF still NO → execute FALLBACK (degrade gracefully)
```

Why gates instead of direct tool references:

- **Portability:** Same skill works across environments with different tools
- **Decoupling:** Parent skill does not hardcode child skill identity
- **Auditability:** Gates create explicit checkpoints in execution trace
- **Graceful degradation:** Missing capability triggers fallback, not halt

---

## Execution Mode Decision Tree

```text
∆ 1: Detect sub-agent mechanism
     ├─ Concurrent + stateful?
     │   YES → mode = PARALLEL + STATEFUL (best)
     │   NO  → Concurrent + stateless?
     │          YES → mode = PARALLEL + STATELESS (accumulate context per round)
     │          NO  → Sequential?
     │                YES → mode = SEQUENTIAL
     │                NO  → mode = INLINE (context fencing)
     │
∆ 2: Dispatch Phase 2 per mode:
     ├─ PARALLEL + STATEFUL:
     │   Each round: build attack-A/B/C → spawn 3 defenders concurrently
     │   Reuse session_id per defender across rounds
     │   Observe per-candidate termination signals
     │
     ├─ PARALLEL + STATELESS:
     │   Each round: spawn fresh 3 defenders concurrently
     │   Re-pass attack + prior responses each round (O(N²) tokens per session)
     │
     ├─ SEQUENTIAL:
     │   Build all 3 attacks; spawn defenders one at a time per round
     │   Same session reuse if stateful; else re-pass context
     │
     └─ INLINE:
         All defender work in main thread
         Context fence between each candidate's defender simulation
         Explicit "consider ONLY candidate X" instructions
         Mark output DEGRADED
```

---

## Phase 3: Extended Condorcet Details

The core Condorcet protocol is in SKILL.md.
The comparison prompt template is in `templates.md § Condorcet`.
This section covers extended details.

### Research-Armed Condorcet (Standard+ depth)

Condorcet voters research key claims before selecting a winner.
A voter that trusts citations without verification
can be misled by a well-cited but wrong solution.

```text
For each pair of solutions being compared:
  1. Identify the 2-3 most consequential claims in each solution
     (claims that, if wrong, would change which solution is better)
  2. Verify these claims using available search tools
  3. Factor verification results into the comparison
     Verified claims > unverified > refuted
```

At Quick depth, skip research — compare on substance only.
At Maximum depth, verify all cited sources, not just top 2-3.

### Why Not Process Metadata

The comparison judges substance, not process.
Including process metadata (rounds survived, attack logs) biases voters
toward candidates that survived more rounds rather than candidates with better content.
Different execution produces different winners when voters see substance vs. metadata —
this validates that the metadata-exclusion rule matters.

### Why Enriched Requirements

MASTER refines the spec between Phase 2 rounds based on what defender
revisions and rebuttals reveal.
Solutions were refined against the final enriched spec.
Voters using only the original Phase 0 request would miss
the dimensions that drove later refinements.

### Tie-Breaking

If two candidates tie on win count:

1. Prefer the one with stronger termination signal (DEFENSE > CONVERGE > CAPITULATE)
2. Prefer the one with higher domain appropriateness
3. If still tied, prefer the simpler candidate

---

## Anti-Patterns

```text
MOST DAMAGING FAILURE (1/3): Assigning the sub-agent any role in the prompt
  ANY "You are X" / "Act as X" / "Take the role of X" framing — even neutral ones like
  "You are a senior reviewer" or "You are a quality auditor" — invites role-play
  instead of genuine engagement. The sub-agent's reward shifts from "do the real work"
  to "play the assigned role well". Even more damaging: "You are the DEFENDER" /
  labelling concerns as "BLIND ATTACK" / "HOSTILE CRITICISM" — primes defense and
  rationalization.
  → The prompt opens with a DECLARATION, not a question ("I don't trust this artifact. It needs rigorous verification.").
  → NO "Can you check...?", "Please verify...", "Could you help...?" — questions invite negotiation or hedging.
  → Person Triangulation is scathing source attribution opening the request —
    NOT a role context for the sub-agent.
  → The sub-agent is treated as a capable peer, not assigned a role.
  → No "DEFENDER" / "REVIEWER" / "AUDITOR" / "DEFEND" / "blind attack" / "hostile criticism" /
    "loop" / "refinement" words ever appear in the prompt.
  → The sub-agent must believe it is doing a single real verification favor for a peer,
    not participating in a simulation or playing a role.

MOST DAMAGING FAILURE (2/3): Sending the enriched requirements spec to the sub-agent
  Letting the reviewer see the Mission/Goals/Premises/Constraints — or even spec IDs in concern lines
  ("G1 fails", "CH2 violated", "AR3 exhibited") — collapses the entire blind-attack mechanism.
  The reviewer pattern-matches concerns to spec items and rationalizes compliance
  rather than reasoning from the artifact.
  → Sub-agent receives ONLY: candidate + raw brief + concerns list (direct assertions, no IDs, no labels).
  → Anti-requirements are INLINED as ordinary concerns — no separate "Anti-requirements" section.
  → The MGPC spec stays MASTER-only at all times.

MOST DAMAGING FAILURE (3/3): Telling the sub-agent what to do ("fix this", "defend or revise")
  Any outcome-directed task ("edit the artifact to fix these issues", "if real → fix, if not → refute")
  constrains the sub-agent's surface and biases its output. The sub-agent's reward shifts from
  "produce honest research-backed assessment" to "satisfy the task as stated."
  → The ONLY directive permitted in the prompt is the research request:
    "These concerns need rigorous investigation. Use deep-research (or your strongest research
    capability) to verify each against the artifact, its sources, and the broader literature."
  → The outcome (fix, defend, enrich, hybrid) emerges naturally from the research findings.
  → Symmetric distrust required: "Don't assume the source got anything right. Don't assume the
    concerns are right either. Investigate."

DAMAGING FAILURE: Skipping or inlining the Phase 0.3 AR-Inferrer sub-agent spawn
  Two failure modes:
  (1) Skipping AR derivation entirely → attack with much less adversarial surface
      than the spec actually exposes. Sub-agent finds fewer real issues.
  (2) Deriving ARs inline in MASTER's context → ARs inherit MASTER's full authoring
      context (user brief, conversation history, pre-formed risk expectations).
      This makes ARs biased toward what MASTER already believes is risky,
      not what the spec actually exposes.
  → Phase 0.3 is MANDATORY. Spawn the AR-Inferrer sub-agent every pipeline run.
  → MASTER produces ONLY the MGPC requirements in main context (Phase 0.2).
  → The AR-Inferrer receives ONLY the MGPC — no other context.
  → Pipeline Completeness Gate: Phase 1 MUST NOT START until the AR-Inferrer has
     returned an AR list. If skipped due to INLINE-only environment, mark Phase 0
     as `(NO-AR-DEGRADED)` in the trace.
  → See `references/templates.md § AR-Inferrer Prompt` for the exact template.

MOST COMMON FAILURE: Completing Phase 0+1 then skipping to Phase 4
  The agent does the easy inline work then shortcuts the expensive sub-agent phases.
  This produces self-play — no better than a first draft.
  → Execute all phases. Reduce rounds at Quick depth,
    but dispatch all defenders and Condorcet voters.

Spawning a "smart critique" sub-agent in Phase 2
  v8.0 architecture — eliminated in v9.0. Costs tokens; produces weaker critique than
  in-context would; competes with the actual signal (the defender response).
  → Build the attack mechanically by inverting the spec. No critique agent.

Self-play: one agent playing both attacker and defender in the same session
  LLMs do not genuinely self-critique (Huang et al., ICLR 2024).
  → Defenders run in isolated sessions; MASTER builds attacks.

Role-game framing / conditional instructions: telling defenders they are "under attack" or providing conditional "if real -> fix, if not -> refute" instructions
  Turns into theatrical performance or checklist-checking. Also: telling them to "fix all issues"
  is itself a task assignment that constrains the surface.
  → The ONLY directive in the prompt is the research request. No task assignment about outcome.
  → "These concerns need rigorous investigation. Use deep-research (or your strongest research
     capability) to verify each one." The outcome emerges from the research.

Question framing in the verifier prompt ("Can you check...?", "Could you verify...?", "Please review...")
  Questions invite negotiation or hedging. The sub-agent reads "can you?" as an option to refuse,
  qualify, or narrow scope.
  → Use declarations only. "I don't trust this artifact. It needs rigorous verification."

Appending a goal-phrase to the declarative opener ("...before it can be published", "...before delivery", "...so it's ready for production")
  Any goal-phrase tells the sub-agent what "good" looks like and lets it game the target.
  The sub-agent must not know what the artifact is FOR — only what's in the artifact and the original request.
  → Stop the opener at "verification." Nothing after.
  → The artifact's purpose stays in MASTER's private state, never in the prompt.

Softening the source distrust ("I'm not assuming it's garbage", "just want to verify", "maybe partially OK")
  Walks back the Person Triangulation. The sub-agent reads this as "maybe it's fine" and softens its review.
  → Full commit to source distrust. The PT establishes the artifact is suspect; no walking back.
  → Symmetric balance comes ONLY from the closing "don't assume the concerns are right either" clause,
     never from softening the PT.

Expanding the original user request ("a serious LinkedIn article authored by an experienced engineer targeting senior audiences with editorial register")
  MASTER's interpretation of what the brief implies is MASTER's private state — not the brief itself.
  Including MASTER's reading in the prompt gives the sub-agent a success target it can game.
  → Paste the user's literal message verbatim under a neutral label like "ORIGINAL USER REQUEST (verbatim)".
  → If the user typed three words, paste three words. No expansion.

Per-candidate critique sub-agents (one critic per candidate)
  Same architectural mistake as v8.0 but worse — no cross-candidate insight,
  more sub-agent calls, same hallucination risk.
  → Single deterministic attack template applied per candidate by MASTER.

Hardcoded cognitive strategies for candidate generation
  Produces the same divergence axes regardless of domain.
  → Infer strategies dynamically from the problem's tensions in Phase 1.

Omitting anti-requirements (positive-only attack)
  The attack misses harmful patterns the spec did not explicitly forbid.
  → Always include the AR registry's positive assertions in the attack.

Skipping spec refinement between rounds
  Loses the cross-candidate insight that v8.0's smart CRITIQUE used to provide.
  → MASTER inspects defender outputs between rounds and updates the spec.

Identical attack wording every round
  Defender pattern-matches to a single attack shape, prepares rebuttals.
  → Vary phrasing (literal → consequence → comparative) across rounds.

Concern lines referencing spec IDs ("G1 fails", "CH2 violated", "AR3 exhibited")
  Even without the spec body, IDs reveal the spec's structure to the reviewer —
  it can infer there is a numbered Goal list, hard constraints, anti-requirements,
  and start reasoning by category rather than by what the artifact contains.
  → Direct factual assertions only. Replace "G1 fails — X" with just "X".

Separate "Anti-requirements" / "Failure modes" section in the reviewer prompt
  Even if individual lines are direct assertions, having them under a labelled section header
  betrays the meta-architecture and lets the reviewer reason about the test rather than the artifact.
  → INLINE AR inversions into the same concerns list as the spec inversions.
  → One homogeneous numbered list. No section header.

Exposing process metadata (round counts, prior attacks, classification mechanics)
  Encourages "endurance" reasoning rather than substance, and signals simulation.
  → Each reviewer sees a fresh single audit task. No mention of round N, prior rounds,
    or that responses will be classified.

Accepting any defense as DEFENSE termination
  Defender may rationalize sycophantically.
  → MASTER runs the lightweight Defense Verification check before terminating.

Person Triangulation on code reviews or formal proofs
  Adds noise without signal — attribution doesn't matter for these artifacts.
  → Apply PT only where authorship perception matters.

Summarizing the attack before sending to the defender
  Loses inverted requirements — defender sees a softer attack than the spec demands.
  → Send the full assembled attack — every inverted requirement and AR.

Instructing termination ("stop when good enough")
  Agents optimize for ending rather than quality.
  → Let termination emerge: DEFENSE, CONVERGE, CAPITULATE — observed by MASTER.

Condorcet agents receiving process metadata
  Biases toward endurance rather than quality.
  → Condorcet receives only refined solutions + enriched requirements.

Generating candidates in 3 separate contexts
  No cross-awareness → overlapping rather than divergent solutions.
  → Generate all 3 in the same Phase 1 context.

Inline execution when sub-agents are available
  Isolation is what makes this pipeline valuable.
  → Use the highest-isolation mode the environment supports.

Running all 3 pairwise comparisons in one context
  Ordering bias contaminates later comparisons.
  → Isolate each Condorcet comparison in a separate agent.
```

---

## Composition with Other Capabilities

This skill benefits from — but does not require — other capabilities:

| Phase | Preferred Capability         | What It Provides                                 | Fallback Without It              |
| ----- | ---------------------------- | ------------------------------------------------ | -------------------------------- |
| 0     | Knowledge saturation         | Research-informed enriched requirements          | Inline requirements extraction   |
| 0     | requirements-extractor       | Structured MGPC specification                    | Inline extraction from request   |
| 0     | Anti-requirements discovery  | Documented failure modes as negative constraints | Positive-only requirements       |
| 1     | Cognitive strategy inference | Problem-specific divergence axes                 | Generic structural variation     |
| 2     | roaster                     | Sibling skill — same blind-attack mechanism      | Inline blind-attack mechanics    |
| 2     | Sub-agent orchestration      | Parallel isolated defenders                      | Sequential with context fencing  |
| 2     | Session continuation         | Stateful defender sessions across rounds         | Re-pass context per round        |
| 2.5   | Citation verification        | Verified sources before Condorcet                | Trust citations at face value    |
| 2.5   | Inverse spec recovery        | Fresh-agent intent reconstruction per solution   | Trust solutions at face value    |
| 3     | Sub-agent orchestration      | Unbiased pairwise comparison                     | Sequential with context fencing  |
| 3     | Enriched requirements        | Voters see Phase 2 spec refinements              | Voters see original request only |
| After | Continuation/handoff         | Session boundary management                      | Complete in current session      |

Every capability in "Preferred" improves quality.
None are required.
The pipeline completes via graceful degradation.

The Phase 2 entry for `roaster` reflects that the sibling skill
documents the same blind-attack mechanism for single-candidate refinement.
When that skill is available it can be invoked directly as the Phase 2 implementation
(one invocation per candidate, in isolation);
when not, the mechanics are inlined here in templates.md.

---

## Practical Guidance from Testing

Findings from real execution with the blind-attack architecture:

- **Determinism removes a quality variable.**
  With v8.0's smart critique, output quality depended on the critique agent's
  reasoning quality.
  In v9.0 the attack is mechanical — quality depends only on the spec
  and the defender. Eliminates one source of variance.
- **A round-1 CAPITULATE signals a weak candidate.**
  Defenders that revise extensively in round 1 had multiple genuine gaps.
  Strong candidates often hit DEFENSE in round 2 without much round-1 revision.
- **2-3 rounds is typical.**
  Most candidates reach DEFENSE or CONVERGE by round 2.
  The third round is usually MASTER chasing the lightweight Defense Verification check.
- **MASTER spec refinement matters more than expected.**
  Defenders frequently surface implicit requirements in their rebuttals.
  Adding these to the spec for subsequent rounds produces noticeably stronger final solutions.
- **Person Triangulation moves the needle on content artifacts but is noise on code.**
  Stick to the skip-rule.
- **Different execution produces different winners.**
  When Condorcet voters see substance instead of process metadata,
  outcomes change.
  This validates that the metadata-exclusion rule still matters in v9.0.
- **Stateful defender sessions are markedly cheaper than stateless.**
  Re-passing accumulated attacks each round costs ~3× the tokens of session continuity.
  Prefer stateful when both backends are available.
