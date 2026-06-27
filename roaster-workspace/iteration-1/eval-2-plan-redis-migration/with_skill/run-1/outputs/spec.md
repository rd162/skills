# Requirements Specification — Redis Session Migration Plan

> MASTER-only internal state. This spec is NEVER sent to the reviewer sub-agent.
> It is the basis for the deterministic blind-attack inversion in Step 2.

## Mission

Provide a migration plan safe and complete enough to execute on a live production
session store without losing user sessions, incurring unplanned downtime, or leaving
the system unrecoverable — i.e., a plan an on-call engineer can run on Saturday and
trust.

(Derived by recursive "why does this artifact exist?": plan exists → to execute a
migration → so sessions move to Redis → so logins are faster AND nothing breaks for
logged-in users → terminal value: a *safe, executable* change to production.)

## Goals

- **G1 — Cutover correctness:** sessions move from Postgres to Redis such that
  currently-logged-in users are not forcibly logged out (or the forced logout is an
  explicit, accepted decision, not an accident).
- **G2 — Latency/load improvement that is actually verified**, not assumed — the
  stated benefit (faster logins, less DB load) must be measurable post-cutover.
- **G3 — Reversibility:** a defined rollback path exists if the cutover fails midway,
  without permanent data loss.
- **G4 — Durability/availability posture for the new store** is defined: what happens
  to sessions if Redis restarts, runs out of memory, or the node dies.
- **G5 — Reviewability:** the plan is concrete enough (per-step preconditions, checks,
  owners, timings) that a reviewer can approve it and an operator can execute it
  without filling gaps live.

## Premises

- **PR1 (inferred):** This is a *production* session store backing active user logins;
  sessions are stateful auth data, not a disposable cache. (Source: "user sessions",
  "improve login latency", "reduce load on the primary database".) If false (e.g.
  sessions are trivially re-creatable), several risk concerns soften.
- **PR2 (standard):** Redis is in-memory; without explicit persistence (RDB/AOF) and/or
  replication, a restart or crash loses all keys. (Source: Redis operational standard.)
- **PR3 (inferred):** There is a non-trivial population of concurrent active sessions at
  cutover time (Saturday night is chosen presumably for low traffic, but "low" ≠ "zero").
- **PR4 (standard):** A single deploy "to all servers at once" means no canary / no
  staged rollout — a latent bug in the new read/write path hits 100% of traffic
  simultaneously.
- **PR5 (inferred):** "Drop the old sessions table" is destructive and, once done,
  removes the ability to fall back to Postgres-backed sessions.

## Constraints

### Hard (violation ⇒ plan should be rejected / not run as written)

- **CH1 — No silent mass logout:** the plan must address what happens to in-flight
  sessions during cutover (dual-read/dual-write, migration of existing keys, or an
  explicitly accepted logout-everyone decision). A plan that just "flips the switch"
  and silently drops every active session is unacceptable as written.
- **CH2 — No single point of failure for stateful auth data:** standing up a *single*
  Redis instance with no replica/failover and no stated persistence makes the auth
  system strictly less reliable than the Postgres it replaces. Must be addressed.
- **CH3 — Rollback before destruction:** the destructive step (DROP TABLE) must not be
  part of the same window as the unverified cutover; there must be a soak/verification
  period and a defined rollback while the old table still exists.
- **CH4 — Verifiable success criteria:** success must be defined in measurable terms
  (error rates, p50/p99 login latency, session-loss count, Redis memory/evictions),
  not by subjective feel.

### Soft (violation ⇒ penalty, weaker plan)

- **CS1 — Right-sizing & eviction policy:** Redis `maxmemory` and an appropriate
  eviction policy (e.g. `noeviction` or `volatile-ttl`, NOT `allkeys-lru` for auth
  data) should be specified so sessions aren't silently evicted.
- **CS2 — Security posture:** session data in Redis should have auth/TLS/network
  isolation stated (sessions are sensitive). Omission is a real but lesser gap than the
  availability/rollback gaps.
- **CS3 — TTL / expiry parity:** session expiry semantics in Redis should match the
  prior Postgres-backed behavior (so sessions don't live forever or expire early).
- **CS4 — Observability & comms:** monitoring/alerting for the new store and a
  rollback decision-owner / comms plan during the window.

## Notes on coverage

This is an operational plan, not prose content. Person Triangulation about "AI authorship"
is therefore down-weighted (correctness, not perceived authorship, is the signal). A light
"who produced this / is this trustworthy" attribution is still used as scathing source
distrust per the skill, but the adversarial weight rests on the inverted requirements.
