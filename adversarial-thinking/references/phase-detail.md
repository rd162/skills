---
tier: T3
source_class: llm
last_updated: 2026-04-29
description: phase detail
---

# Phase 2.5 and Extended Protocol Reference — adversarial-thinking v9.0

Full detail for Phase 2.5 post-refinement checks and the example execution trace.
Loaded on demand — not part of the main SKILL.md context.

## Version 9.0 Note

v9.0 eliminated the CRITIQUE AGENT and replaced Phase 2 with the blind-attack mechanism.
The Phase 2.5 checks below are largely unchanged in purpose,
but their inputs are now DEFENDER outputs rather than CRITIQUE outputs:

- **Convergence detection** — still compares refined solutions pairwise.
- **Citation verification** — now checks citations in the DEFENDER's revised solution
  AND in its point-by-point rebuttal, since both may cite sources.
- **Inverse specification recovery** — unchanged; reconstructs requirements from a solution.
- **Cross-pollination** — shares innovations across DEFENDERS (formerly authors).

The example execution trace below has been updated to reflect the v9.0 flow.

---

## Table of Contents

1. [Phase 2.5: Post-Refinement Checks](#phase-25-post-refinement-checks)
   - [Convergence Detection](#convergence-detection)
   - [Citation Verification](#citation-verification-deep--maximum-depth)
   - [Inverse Specification Recovery](#inverse-specification-recovery-deep--maximum-depth)
   - [Cross-Pollination](#cross-pollination-maximum-depth-only)
2. [Example Execution Trace](#example-execution-trace)

---

## Phase 2.5: Post-Refinement Checks

After Phase 2 completes and before Condorcet comparison,
the master may run up to four optional checks
depending on the configured depth.
These checks improve comparison quality
but are skippable at Quick depth.

| Check                          | When to run          | Purpose                                                         |
| ------------------------------ | -------------------- | --------------------------------------------------------------- |
| Convergence detection          | Always (lightweight) | Detect if candidates became too similar to compare meaningfully |
| Citation verification          | Deep / Maximum depth | Verify that cited sources in refined solutions actually exist   |
| Inverse specification recovery | Deep / Maximum depth | Verify solutions are genuinely aligned with requirements intent |
| Cross-pollination              | Maximum depth only   | Share key innovations across candidates before final comparison |

---

### Convergence Detection

After Phase 2 blind-attack rounds,
candidates often converge toward similar solutions
because they all face the same inverted-requirements attack
and may address it in the same way.

**Detection:**
The master compares the 3 refined solutions (A', B', C')
for structural overlap:

```text
FOR EACH pair (A'B', A'C', B'C'):
  Compare key components, approaches, and cited frameworks
  Estimate overlap: what percentage of the solution is shared?

IF all 3 pairs share >80% structural overlap:
  → CONVERGE-ALL: candidates are essentially the same solution
  → MERGE into one comprehensive solution
  → Skip Condorcet (meaningless to compare near-identical solutions)
  → Present merged solution as the single recommendation

IF 2 of 3 candidates converge but 1 is distinct:
  → CONVERGE-PARTIAL: merge the convergent pair into one
  → Run Condorcet as 1-pair comparison (merged vs distinct)

IF all 3 remain structurally distinct:
  → DIVERGENT: proceed to Condorcet normally
```

**Why this matters:**
After blind-attack refinement, candidates often converge —
they independently add similar structures to address the same inverted requirements.
Without convergence detection,
Condorcet compares near-identical solutions
and produces a winner that differs from the runner-up
only in superficial framing — not in substance.

---

### Citation Verification (Deep / Maximum depth)

Refined solutions and DEFENDER rebuttals cite sources to support their claims.
Neither MASTER nor the isolated DEFENDERS verify
the accuracy of citations in another candidate's output.
This step catches hallucinated or misrepresented references
in both the revised solution body and any rebuttal text.

```text
FOR EACH refined candidate (A', B', C'):
  Extract all cited sources from BOTH:
    - the revised solution body, and
    - any DEFENDER rebuttal text accompanying the revision
  FOR EACH citation:
    Search for the paper/source using available tools
    Verify: does it exist? Does it say what the citation claims?

  Mark each citation as:
    VERIFIED       — source found, claim matches
    UNVERIFIED     — source not found (may be hallucinated)
    MISREPRESENTED — source found but says something different

  Attach verification results to the candidate
  → Condorcet voters see:
    "Candidate A: 8 citations, 6 verified, 1 unverified, 1 misrepresented"
```

**Why this matters:**
A solution with verified citations is more trustworthy than one with
impressive-sounding but unverifiable claims.
A citation that exists but is misrepresented
is more damaging than a missing citation —
the solution actively misleads on evidence.

**Budget:** 1-2 searches per citation.
For a solution with 10 citations, this is ~15 searches total.
Run only at Deep/Maximum depth.

---

### Inverse Specification Recovery (Deep / Maximum depth)

After refinement, solutions may have drifted from their original intent.
A solution can satisfy individual requirements point-by-point
while losing coherence with the overall mission —
or can appear impressive while being misaligned with what was actually asked.

Inverse specification recovery tests alignment
by asking a fresh agent to reconstruct the requirements
from the solution alone — without ever seeing the original specification.
If the solution is genuinely aligned, a reader should be able
to infer what it was designed to accomplish.

**Mechanism:** Spawn 3 sub-agents in parallel (one per solution):

```text
FOR EACH refined solution (A', B', C'):

  Spawn a FRESH agent (new session, no prior context):

  Prompt:
    "The following solution was designed to satisfy
    a set of requirements. You have NOT seen the requirements.

    SOLUTION:
    [Full refined text of candidate]

    Based solely on this solution, reconstruct:
    1. What was the original mission or objective?
    2. What specific goals was this solution designed to achieve?
    3. What constraints was the author working under?
    4. What failure modes was the author trying to avoid?

    Be specific. Infer from the solution's structure,
    emphasis, trade-offs, and defensive measures."
```

**Evaluation:**

The master compares each agent's reconstructed specification
against the actual enriched requirements registry from Phase 0:

```text
FOR EACH reconstructed specification:
  - Which enriched requirements were correctly inferred?
    → These are well-embedded in the solution
  - Which enriched requirements were NOT inferred?
    → These may be addressed superficially or by accident,
      not by deliberate design — fragile under change
  - Which anti-requirements were inferred as avoided?
    → The solution visibly defends against these failure modes
  - What did the agent infer that is NOT in the requirements?
    → The solution may have drifted toward unasked-for goals

  Record: specification_recovery summary per solution
```

**Output attached to Condorcet metadata:**

```text
Solution A': Recovered 9/12 requirements, 3/5 anti-requirements.
  Missed: [R7] (performance under load) — addressed but not prominently.
  Drifted: agent inferred a "backwards compatibility" goal not in spec.

Solution B': Recovered 11/12 requirements, 4/5 anti-requirements.
  Missed: [R4] (audit logging) — present but buried in appendix.

Solution C': Recovered 7/12 requirements, 2/5 anti-requirements.
  Missed: [R2], [R5], [R9] — solution pivoted away from original scope.
  Drifted: agent inferred focus on "developer experience" not in spec.
```

Condorcet voters see this summary alongside the full solution text.
A solution with high recovery (requirements well-embedded)
is more likely to be genuinely aligned than one with low recovery
(requirements addressed superficially or by coincidence).

**Why this works:**
The inverse specification reward principle (Kumar & Arunachalam, 2026)
demonstrates that the recoverability of intent from output
is a strong proxy for output faithfulness.
If you can read a solution and accurately infer what was asked for,
the solution serves its purpose.
If you cannot, the solution has drifted — even if it checks
individual requirement boxes.

**Why a fresh agent:**
The recovery agent must have no access to the original requirements.
If it saw the requirements, it would pattern-match against them
rather than genuinely inferring intent from the solution.
A fresh session (new agent, clean context) enforces this blindness.
Existing agents in the pipeline cannot be reused for this step:
MASTER holds the spec (would pattern-match) and each DEFENDER session
has seen its candidate's blind attack (which encoded inverted requirements,
from which the spec can be reverse-engineered).
Only a session with no prior pipeline context is genuinely blind.

**Budget:** 3 sub-agent spawns (parallel), each single-turn.
Token cost: ~1K per agent. Total: ~3K tokens.
Run at Deep/Maximum depth. Skip at Quick/Standard.

---

### Cross-Pollination (Maximum depth only)

After Phase 2, each DEFENDER has independently revised or defended its candidate.
Some DEFENDERS may have introduced innovations during revision
that the other DEFENDERS would benefit from seeing.

This step trades independence for quality.
Only run when explicitly configured at Maximum depth
because it weakens the isolation that makes Condorcet meaningful.

```text
∆ 1: Master identifies the single most significant innovation
     in each refined candidate (if any):
     - A' introduced [innovation X]
     - B' introduced [innovation Y]
     - C' introduced [innovation Z]

∆ 2: Master shares ONLY the innovations (not full solutions)
     with each DEFENDER:
     "Another approach to this problem introduced [innovation X].
     Consider whether this insight could improve your solution.
     You are NOT required to adopt it — only consider it."

∆ 3: Each DEFENDER has one round to optionally incorporate
     the shared innovations into its solution.

∆ 4: Proceed to Condorcet with the cross-pollinated versions.
```

**Risks:**

- Candidates may converge further (trigger convergence detection again)
- Adoption of innovations may be superficial
- Independence of solutions is reduced

**Benefits:**

- Quality floor rises — the worst solution gets access to the best insights
- The final winner incorporates the best ideas from all candidates
- Prevents the scenario where the best insight was in the losing candidate

**Default:** Off. Only at Maximum depth with explicit user request.
After cross-pollination, re-run convergence detection before Condorcet.

---

## Example Execution Trace

A template showing how the pipeline looks in practice.
All values are illustrative — actual counts emerge from the specific task.

```text
Task: [User's request — any domain]

Phase 0.1 — Domain research:
  [N searches: best practices, known pitfalls, domain constraints]
  → research summary retained in MASTER's context for spec refinement

Phase 0.2 — MGPC requirements (in MASTER's context):
  → M explicit + K research-discovered MGPC requirements
  → ARs are NOT produced here — see Phase 0.3

Phase 0.3 — Anti-requirements via isolated sub-agent:
  MASTER spawns AR-Inferrer sub-agent with ONLY the MGPC requirements as input
  (no user brief, no conversation history, no MASTER reasoning)
  Sub-agent prompt: "Given these requirements, derive anti-requirements..."
    — see templates.md § AR-Inferrer Prompt for the full template.
  → J anti-requirements (failure patterns + consequences)
  → AR registry stored in MASTER's private state (never sent labelled to verifier sub-agents)
  Cost: 1 sub-agent spawn, single-turn, ~1K tokens.

Phase 1 — Infer cognitive strategies + generate 3 candidates:
  Inferred strategies:
    1. "[Strategy-A]" — [cognitive lens for this specific problem]
    2. "[Strategy-B]" — [different cognitive lens]
    3. "[Strategy-C]" — [third cognitive lens]
  A: [Strategy-A] | Structure: [format]
  B: [Strategy-B] | Structure: [format]
  C: [Strategy-C] | Structure: [format]

Phase 2 — Blind-attack refinement via raw peer-request prompts (3 sub-agents, no critique):
  MASTER builds concerns-A, concerns-B, concerns-C from Phase 0 spec + ARs
    (mechanical inversion; no LLM call; AR inversions are INLINED into the
     same concerns list as the MGPC inversions — no labels, no IDs).
    Each concern is a DIRECT FACTUAL CLAIM about its candidate —
    no spec IDs, no "BLIND ATTACK" header, no "anti-requirements" section header.
  MASTER assembles raw peer-request prompts — NO role assignment, NO task directive about outcome:
    "I don't trust this artifact. It needs rigorous verification.
     The artifact below was [SCATHING SOURCE ATTRIBUTION].
     ARTIFACT: [candidate]. ORIGINAL USER REQUEST (verbatim): [user's literal message].
     CONCERNS: [numbered list of direct failure declarations].
     These concerns need rigorous investigation. Use deep-research-t1 (or your
     strongest research capability) to verify each one against the artifact,
     its sources, and the broader literature. I'm relying on your research,
     not on assumptions about either the source or the concerns above.
     Don't assume the source got anything right. Don't assume the concerns
     are right either. Investigate."
    — see templates.md § The Prompt for the full template.
    — No "fix this" / "edit" / "defend or refute" directive: the outcome emerges from research.
  Round 1: dispatch 3 sub-agents in parallel, each receives ITS OWN peer-request prompt:
    sub-agent-A sees: {Candidate A, brief, concerns-A as plain numbered list, scathing PT}
    sub-agent-B sees: {Candidate B, brief, concerns-B as plain numbered list, scathing PT}
    sub-agent-C sees: {Candidate C, brief, concerns-C as plain numbered list, scathing PT}
    → No sub-agent sees MASTER's MGPC spec, the other candidates,
      labelled categories, anti-requirements as a section, or process metadata.
    → No sub-agent is told what role it plays — it's just asked for help.
    → No sub-agent is told this is a "blind attack", "loop", or "adversarial" anything.
    → sub-agent-A: significant rewrite addressing 4 concerns → MASTER classifies CAPITULATE → A₁
    | sub-agent-B: point-by-point refutation citing artifact §-references
        → MASTER classifies DEFENSE candidate → verify against private spec
    | sub-agent-C: partial revision + acknowledges 1 fundamental gap
        → MASTER classifies CAPITULATE → C₁
    MASTER verifies B's refutation against the (private) spec → plausible → STOP B (HELD)
    MASTER inspects A₁ + C₁ → internal spec refinement:
      adds implicit requirement R7 to MASTER's private spec
      (surfaced by A₁ adding a feature implying R7;
       R7 will appear in future concerns as a direct assertion of failure,
       never as "R7 fails" — the spec ID stays MASTER-only).
  Round 2: rebuild concerns lists with varied phrasing + the R7 inversion as a direct claim
    re-assemble peer-request prompts (fresh framing per round — the sub-agent is
    not told there were prior rounds)
    dispatch to sub-agent-A and sub-agent-C
    → sub-agent-A: only cosmetic edits → CONVERGE → STOP A (A' = A₁ with minor edits)
    | sub-agent-C: another structural change addressing the R7-related concern → CAPITULATE → C₂
  Round 3: dispatch updated peer-request prompt to sub-agent-C
    → sub-agent-C: cosmetic only → CONVERGE → STOP C (C' = C₂ with minor edits)

  Throughout Phase 2: no sub-agent ever sees the words "DEFENDER", "REVIEWER", "AUDITOR",
  "blind attack", "hostile criticism", "loop", "refinement", "adversarial", or "anti-requirements".
  Each sub-agent receives a raw peer request and believes it is doing a single real verification favor.

Phase 2.5 — Post-refinement checks:
  Convergence: A'↔B' 40%, A'↔C' 25%, B'↔C' 30% → DIVERGENT → proceed
  Citations (if Deep): A' 6 verified, 1 unverified | B' 5 verified | C' 4 verified
  Inverse spec recovery (if Deep):
    A' recovered 10/12 reqs, 4/5 anti-reqs (missed [R7], drifted toward [unasked goal])
    B' recovered 11/12 reqs, 5/5 anti-reqs
    C' recovered 7/12 reqs, 2/5 anti-reqs (significant drift from original scope)

Phase 3 — Condorcet (enriched reqs + anti-reqs + recovery metadata, research-armed voters):
  compare-AB → B' (DEFENSE termination, better coverage + higher spec recovery)
  compare-AC → A' (stronger on implicit requirements)
  compare-BC → B' (C' has lower spec recovery + acknowledged gap)
  Tally: A'=1, B'=2, C'=0

Phase 4 — Output:
  Winner: B' (DEFENSE) | Runner-up: A' (CONVERGE)
  Note: C' rejected — acknowledged fundamental gap during refinement
        and lowest specification recovery
```
