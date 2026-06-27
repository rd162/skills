# Process Trace — Redis Session Migration Plan refinement

## Backend mode

**STATELESS sub-agents (real isolation).** The `Agent` tool is available and was used
for every sub-agent step. Each `Agent` call starts a fresh agent with no session
continuity, so full context (artifact + brief + concerns) was re-passed each round.
This is the STATELESS row of the skill's Step 0 table — "Good" quality. **NOT
DEGRADED**: all three sub-agent dispatches (AR-Inferrer, Round 1 reviewer, Round 2
reviewer) ran as genuine isolated sub-agents; INLINE fallback was never needed.

Compact notation:

```
spec[Mission, G×5, P×5, CH×4, CS×4]  (+ 15 anti-requirements, isolated sub-agent)
s₀ → ATK(literal inversion, light source-distrust) → reviewer R1
     → R1 confirms 13/15 concerns valid, 2 imprecise; artifact genuinely deficient
     → MASTER classifies CAPITULATE → MASTER authors s₁ (full expand/contract rewrite)
s₁ → ATK+PT(consequence-focused, "papers-over-hard-parts" attribution) → reviewer R2
     → R2 DEFENDS core design (majority of concerns refuted w/ primary sources),
       accepts 5 targeted corrections (eviction error, durability, placeholders/gates,
       TTL+security blocking, schedule conflict)
     → MASTER classifies CONVERGE/DEFENSE (structure stable + design defended)
     → MASTER applies 5 corrections in-place → s₂ → STOP
```

## Step 0 — Backend detection
- Agent tool present → sub-agent mode. No session_id continuity → STATELESS. Decision:
  use isolated sub-agents for AR inference and each reviewer round, re-passing context.

## Step 1 — Requirements spec (inline enumeration by MASTER)
- No spec in conversation; `requirements-extractor` helper not invoked (artifact is a
  short ops plan with strongly-implied requirements; inline enumeration — the skill's
  floor — is sufficient and the environment directed sub-agents specifically at the AR
  and reviewer steps).
- Produced Mission + 5 Goals + 5 Premises + 4 hard + 4 soft constraints. Saved to
  `spec.md`. Mission and ≥1 Goal present → ∆4 passes → proceed. Spec is MASTER-only,
  never sent to any reviewer.

## Step 1.5 — Anti-requirements inference (MANDATORY, isolated sub-agent)
- Dispatched a fresh `general-purpose` sub-agent with ONLY the requirements (exact
  AR-Inferrer template from references/templates.md). Prompt saved verbatim to
  `ar_inferrer_prompt.txt`.
- Returned **15 anti-requirements**, each spec-grounded with a consequence. Saved to
  `ar_list.md`. Pipeline Completeness Gate satisfied (AR sub-agent spawned + returned).
- Notable ARs the sub-agent flagged as highest-severity-yet-overlooked: #2 asymmetric
  rollback (rollback after Redis-only writes loses those sessions) and #3 backfill
  write-gap; plus the #7/#8 paired eviction-vs-noeviction edge.

## Step 2 — Blind attack assembly (deterministic inversion)
- Round 1 concerns = direct-assertion inversion of each spec item, with the 15 ARs
  inlined (de-labelled) and de-duplicated → a single homogeneous 15-item numbered list.
- No spec IDs, no category labels, no meta-architecture wording. Source attribution
  ("junior contributor using AI assistance, flagged for quality review") used as the
  scathing opener; PT down-weighted per skill guidance for technical artifacts, but a
  light source-distrust line retained as required.

## Round 1 — reviewer (isolated sub-agent)
- Prompt saved verbatim to `reviewer_prompt_round_1.txt`. Framing: declarative opener
  "I don't trust this artifact. It needs rigorous verification." (stops at
  "verification"), full source distrust, verbatim user request, plain concerns list,
  symmetric distrust closing clause, deep-research hint, read-only discipline ("Do not
  edit, create, or overwrite any files; return your analysis as text only"). No role
  assignment, no spec, no loop/round wording.
- **Sub-agent response (summary):** Ran T1/T2 research (redis.io, AWS, Google SRE,
  Stripe online-migrations, Fowler expand/contract, OWASP, Hootsuite session-migration
  case study). Verdict: plan genuinely unsafe; **13/15 concerns fully confirmed**;
  concerns 4, 10, 12 correct-in-substance but imprecise about Redis *defaults*
  (RDB-on-by-default, `noeviction` default, protected-mode since 3.2); concern 11 valid
  as conditional. Supplied the corrective path (expand/contract: dual-write → backfill
  w/ TTL preservation → verified dual-read → staged cutover → multi-day soak → only then
  drop). Made no edits (read-only, as instructed).
- **MASTER classification:** CAPITULATE-class for the artifact. The artifact cannot
  defend itself because it is genuinely deficient on essentially every requirement; the
  reviewer validated the concerns rather than refuting them.
- **MASTER accept/reject:** ACCEPT findings. DEFENSE-verification of the 3 precisions
  against the spec/known Redis behavior → all plausibly correct (Redis defaults are
  well-documented; reviewer cited primary sources; concurs with training knowledge), so
  bake them in rather than re-attack.
- **Change applied:** MASTER (sole writer) authored **s₁** — a complete expand/contract
  plan: guiding decisions, roles w/ named rollback owner, prerequisites, objective
  success thresholds, 8 phases (0–7) with entry/action/verify/owner, phase-scoped
  rollback (incl. the asymmetric-rollback trap), and a multi-week timeline. Technical
  precisions (RDB-on, `noeviction` default, TTL via `KEEPTTL`/`PTTL`) incorporated.

## Round 2 — reviewer (isolated sub-agent)
- Prompt saved verbatim to `reviewer_prompt_round_2.txt`. Same framing rules; **varied**
  per skill variation rule: consequence-focused concern phrasing and a different source
  attribution ("polished docs that paper over the hard parts — treat confident tone as a
  warning sign"). Full s₁ re-passed (STATELESS). 15 concerns now assert the *new* plan
  fails (cosmetic safety, gap still logs everyone out, HA doesn't help, persistence
  doesn't hold, rollback illusory, drop still dangerous, placeholders hollow, ramp is
  theater, eviction confused, TTL hand-wavy, security a wish-list, not executable, blank
  owner, over-engineered/will-be-compressed).
- **Sub-agent response (summary):** Split verdict from primary sources. **DEFENDED the
  core design** — explicitly found the plan "materially stronger than the concerns
  claim" and "unusually honest"; refuted concerns 2 (correct dual-write-before-backfill
  ordering), 5 (losslessness correctly conditioned to Phases 1–5), 6 (drop properly
  gated), 15-as-engineering (phased is the *lower*-risk option, not over-engineering),
  and the concern-1 "cosmetic" framing — all with artifact-grounded, sourced evidence.
  Concerns 3/4/9/11 judged overstated-but-partly-right. **Accepted as genuinely
  blocking:** (10) the `volatile-ttl` "won't evict valid sessions" claim is *factually
  wrong* — any eviction = forced logout; (3/4) durability framing too soft (async-
  failover loss window, `everysec` ~1–2s, `WAIT`≠fsync, missing `min-replicas-*`);
  (7/8/13/14) unfilled placeholders make it non-approvable/non-executable and gates
  non-binding; (11/12) TTL-parity and security should be *blocking* checks (pin
  `PTTL→RESTORE` incl. `-1→0` conversion; actively prove Redis refuses off-tier/
  unauth/non-TLS connections); (15-real-half) the "this Saturday" expectation will
  compress the plan and must be resolved head-on.
- **MASTER classification:** **CONVERGE / DEFENSE.** No sections added/removed/
  restructured — the phase architecture, rollback logic, and overall approach survived
  and were affirmatively defended with evidence. The required changes are targeted
  corrections-in-place, not a structural rewrite → the structure is stable (CONVERGE)
  and the design held against attack (DEFENSE).
- **MASTER accept/reject:** ACCEPT the 5 corrections (verified plausibly correct vs.
  spec: the `volatile-ttl` correction is unambiguously right and fixes a real error in
  MASTER's own s₁; async-failover loss is a documented Redis property; placeholders are
  objectively present). REJECT (do not act on) the refuted/overstated concerns — acting
  on them would degrade a correct design.
- **Changes applied (MASTER, sole writer) → s₂:**
  1. Rewrote the eviction bullet: removed the false "`volatile-ttl` spares valid
     sessions" distinction; stated the binary noeviction-vs-eviction reality; protection
     is capacity not policy; size from measured numbers; `evicted_keys`>0 = incident.
  2. Hardened durability bullet: async-replication failover loss, `everysec` window,
     `WAIT`≠fsync, `min-replicas-to-write`/`-max-lag`, explicit decision on
     `always`/`WAITAOF`/Multi-AZ, AOF enabled via `CONFIG SET` not config-flip+restart.
  3. Success Criteria: stated placeholders must be filled before approval; thresholds
     wired into an automated, baseline-comparison per-step gate.
  4. Prerequisites/Phase 2/Phase 4: TTL preservation pinned to `PTTL→RESTORE` with the
     `-1→0` conversion and made a *blocking* parity check; security made a hard
     "actively proven" prerequisite (refuses off-tier/unauth/non-TLS); ramp step made an
     automated gate; Phase 3 shadow-read named as the primary serialization-bug defense.
  5. Added a top-of-doc Schedule note: "this Saturday" is not safely achievable; commit
     to the multi-week timeline, do not silently compress it.
  6. Tightened the first prerequisite to require concrete sizing numbers (consistency
     with the rewritten eviction section).

## Termination
- **Signal: CONVERGE + DEFENSE → STOP.** The design reached a behavioral fixed point in
  Round 2 (structure unchanged, core approach defended with primary-sourced evidence);
  the only outstanding items were specific factual/specificity corrections, now applied.
  A third round would re-confirm an already-defended design without adding signal and
  risks artifact drift, so the loop terminates at s₂.
- Two rounds total.

## Output hygiene
- Final artifact checked for skill jargon (roaster/blind-attack/DEFENDER/CAPITULATE/
  CONVERGE/self-refine/adversarial/Person-Triangulation/sub-agent/Mission/Premise/
  anti-requirement). Only hit: the ordinary English word "defense" ("primary defense
  against a serialization bug") — domain language, not the classification marker. Clean.
- The artifact reads as a normal migration plan; nothing reveals this process ran.

## Files saved (this directory)
- `redis-migration-plan.md` — final refined artifact (s₂).
- `spec.md` — MASTER-only requirements spec.
- `ar_inferrer_prompt.txt` — verbatim AR-Inferrer sub-agent prompt.
- `ar_list.md` — 15 anti-requirements returned.
- `reviewer_prompt_round_1.txt` — verbatim Round 1 reviewer prompt.
- `reviewer_prompt_round_2.txt` — verbatim Round 2 reviewer prompt.
- `trace.md` — this file.

## Original-input integrity
- The source at `roaster-workspace/inputs/redis-migration-plan.md` was treated read-only;
  it was copied into this directory and all refinement was done on the copy. The original
  was never modified.
