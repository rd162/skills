# Migration Plan: Move User Sessions from Postgres to Redis

## Overview

We will migrate the user session store from Postgres to Redis to reduce login
latency and offload read/write traffic from the primary database.

Sessions are live authentication state, not a disposable cache: losing a session
logs a real user out. The migration is therefore designed so that **no logged-in
user is forcibly logged out, every step is reversible until a deliberate
point-of-no-return, and the benefit is measured rather than assumed.** It uses the
standard expand/contract (parallel-change) approach: run both stores side by side,
verify under real traffic, soak for several days, and only then decommission
Postgres.

This document is the plan to be reviewed and then executed. It is **not** a one-night
cutover.

> **Schedule note — read first.** The original ask was to run this "this Saturday."
> That is not achievable safely: this is a multi-day, phased program, and compressing
> it into one night would reintroduce exactly the mass-logout, un-soaked-cutover, and
> drop-before-verify risks it exists to prevent. Saturday can be used for an early,
> low-risk phase (e.g. provisioning, or enabling dual-write), but the full migration
> must run over roughly 1–2 weeks. Approving this plan means approving that timeline;
> do not silently shorten it.

## Guiding Decisions (read before the steps)

- **In-flight sessions are preserved.** We dual-write to both stores and backfill
  existing sessions (with their remaining expiry) before reads move to Redis. There
  is no moment where the application reads from an empty Redis. A "log everyone out"
  approach was explicitly considered and **rejected**; if leadership later decides a
  forced re-login is acceptable, that becomes a separate, explicitly-approved change.
- **Redis is run highly available.** A single instance is a single point of failure
  for all authentication and is *less* reliable than the Postgres it replaces, so it
  is not acceptable. We deploy a primary + at least one replica with automatic
  failover (Redis Sentinel or Redis Cluster, or a managed equivalent with Multi-AZ).
- **Redis is configured for durability appropriate to auth state, and its limits are
  stated honestly.** Out of the box Redis enables RDB snapshots (coarse — minutes of
  data at risk on an uncontrolled restart) and leaves AOF disabled. That default is
  too lossy for sessions, so we enable AOF with `appendfsync everysec` (turned on with
  `CONFIG SET appendonly yes` while running — **never** by editing the config and
  restarting, which can wipe the dataset) in addition to RDB. Redis durability is
  **materially weaker than Postgres's**, and we do not pretend otherwise:
  - Replication is asynchronous, so a failover can lose writes the promoted replica
    never received; `everysec` AOF can lose roughly 1–2 seconds of acknowledged writes
    on a hard crash; `WAIT` confirms replicas *received* a write, not that they
    *fsynced* it. Matching Postgres's synchronous guarantee would require
    `appendfsync always` plus `WAITAOF`/managed primitives at a real latency cost.
  - We set `min-replicas-to-write` / `min-replicas-max-lag` so an isolated primary
    refuses writes rather than silently accepting writes it will lose on failover, and
    we decide explicitly — before approval — whether auth state requires the stronger
    (`always` / `WAITAOF` / managed Multi-AZ) durability tier.
  - This residual durability gap is exactly why the old `sessions` table is retained
    through a multi-day soak rather than dropped at cutover.
- **Memory is bounded; there is no eviction policy that protects live sessions.** At
  `maxmemory` the choice is binary: `noeviction` rejects new writes (new logins fail —
  loud), or any eviction policy drops still-valid keys (forced logouts — silent). In a
  pure session store every key carries a TTL, so `volatile-ttl` and `allkeys-lru`
  evict from essentially the same set and victim selection is only approximate
  (sampled) — `volatile-ttl` is the least-bad eviction choice but it **does not** spare
  valid live sessions. The real protection is therefore **capacity, not policy**: size
  `maxmemory` from measured per-session bytes × peak concurrent session count × a
  stated headroom multiple (fill in the real number; do not leave it as "a safety
  factor"), alert on `used_memory` approaching `maxmemory`, and treat any
  `evicted_keys` > 0 on session keys as an incident. We choose `volatile-ttl` as the
  least-bad policy *and* size so it never fires; the stock default (`maxmemory 0` /
  `noeviction`) is not acceptable because it fails logins under pressure with no
  capacity guard.
- **Redis is secured.** Private network / security-group isolation, a strong
  `requirepass`/ACL credential, and TLS in transit. Session tokens are sensitive; an
  exposed or unauthenticated Redis is a session-theft and session-forgery surface.
- **Rollout is staged, not all-at-once.** Reads move to Redis behind a feature flag,
  ramped 1% → 10% → 50% → 100%, so any latent defect in the new read/write path is
  caught at small blast radius instead of hitting all traffic simultaneously.

## Roles

- **Migration lead / rollback decision-owner:** _<name>_ — sole authority to call
  abort/rollback. _<name>_ is backup.
- **Operator(s) executing steps:** _<name(s)>_.
- **On-call for app + datastores during each window:** _<name(s)>_.
- **Comms owner:** _<name>_ — posts start/step/abort/complete updates to
  _<#channel>_ and the status page.

(Names must be filled in before approval. A step with no owner is not approvable.)

## Prerequisites (complete and verified before any production change)

- [ ] Per-session size and peak concurrent active-session count measured; Redis
      `maxmemory` computed as (per-session bytes × peak count × a stated headroom
      multiple, e.g. ×1.5) — record the actual numbers, not a vague factor.
- [ ] HA Redis provisioned (primary + replica(s), automatic failover) in the private
      network; persistence (RDB + AOF `everysec`) enabled; `maxmemory` set to the
      computed value and `maxmemory-policy volatile-ttl` set; `min-replicas-to-write` /
      `min-replicas-max-lag` set; `requirepass`/ACL + TLS configured; failover tested
      by killing the primary in a non-prod environment and confirming promotion.
- [ ] **Security actively proven, not just configured:** from outside the app tier,
      confirm the connection is refused; without credentials, confirm `AUTH` is
      required; confirm non-TLS connections are rejected. (Redis ships with no auth and
      exposed instances are routinely compromised; session tokens are bearer
      credentials, so this is a hard gate, not a checkbox.)
- [ ] Application supports, behind independent flags: (a) dual-write to Postgres +
      Redis, (b) read-source = Postgres | Redis, (c) shadow-read compare.
- [ ] Session serialization format in Redis defined and tested; key naming and **TTL
      mapping** defined so each session's expiry matches today's Postgres-backed
      behavior (sessions must not live longer or expire earlier than they do now).
- [ ] Backfill tooling written and dry-run against a Postgres snapshot in staging.
      It must **preserve each session's remaining TTL exactly**, pinned to one method:
      read each key's `PTTL`, convert a `-1` (no expiry) result to `0`, and
      `RESTORE key <pttl-ms> <dump>` (`RESTORE`'s argument is absolute milliseconds and
      `0` means persist) — or use `MIGRATE`/`COPY`, which retain TTL; a plain
      `SET`/`RESTORE` that drops or resets the expiry is a defect. The backfill must be
      idempotent and fill-if-missing (never overwrite a newer session written by
      dual-write). **TTL parity is a blocking check** (see Phase 2), not best-effort.
- [ ] Dashboards live for: login success/error rate, login latency p50/p95/p99,
      session-lookup miss rate, Redis memory usage and `evicted_keys`, replication
      health, Postgres session-query load.
- [ ] **Baseline captured** for every metric above over a representative period
      *before* any change, so improvement can be proven and regression detected.
- [ ] Rollback procedure (below) rehearsed in staging, including a rollback *after*
      Redis has accepted new sessions.

## Success Criteria (objective, with thresholds)

The migration is judged against the captured baseline, not by feel. Every `_<…>_`
below is a placeholder that **must be replaced with a concrete number before approval**
— an unfilled threshold is not approvable, because it leaves the ramp gates and the
abort decision with nothing to compare against. The thresholds are wired into the
**automated** per-step gate (see Phase 4): the ramp advances only if the gate passes,
and trips an automatic hold/rollback if breached — promotion is data-driven, not
clock-driven or eyeballed.

- Login **error rate** does not rise above baseline by more than _<X — e.g. 0.5>_
  percentage points at any ramp step (hard abort at _<Y — e.g. 1>_ pp).
- Login latency **p95/p99** is ≤ baseline (target: a measurable reduction; abort if
  p99 worsens by more than _<Z — e.g. 10>_%).
- Session-lookup **miss rate** stays at or below baseline within _<margin>_ (a spike
  means sessions are being lost — abort).
- Redis **memory** stays below the `maxmemory` alert threshold and `evicted_keys`
  stays at **0** for session keys (any eviction = forced logouts → incident).
- Postgres session-query load **drops** after reads move to Redis (confirms the
  stated benefit; if it does not drop, the migration delivered nothing — investigate).

If any threshold is breached at any step, the automated gate halts the ramp and the
decision-owner rolls back per the procedure below.

## Phases and Steps

Each phase has an explicit entry check, the action, a verification, and an owner.
Phases are separated in time — this is **not** a single one-hour window.

### Phase 0 — Provision and prepare (before the migration windows)
- **Entry:** all Prerequisites checked.
- **Action:** stand up HA Redis as specified; deploy app build containing the
  (disabled) dual-write / read-source / shadow-read flags.
- **Verify:** Redis reachable only from the app tier; failover test passed; app
  healthy with all new flags off (still 100% Postgres). Owner: _<name>_.

### Phase 1 — Enable dual-write (low-risk window)
- **Entry:** Phase 0 verified.
- **Action:** turn on dual-write — every session create/update/delete writes to
  Postgres **and** Redis. Reads still come from Postgres.
- **Verify:** new sessions appear in both stores with matching TTLs; error rate and
  latency unchanged vs. baseline. Soak ≥ 24h. Owner: _<name>_.

### Phase 2 — Backfill existing sessions
- **Entry:** dual-write healthy (dual-write **must** already be on, so newer sessions
  are never overwritten by the backfill).
- **Action:** run the idempotent, fill-if-missing backfill to copy existing Postgres
  sessions into Redis with remaining TTL preserved exactly (per the pinned
  `PTTL → RESTORE` method in Prerequisites). Re-run/reconcile to close the gap for
  sessions created or refreshed during the backfill, so no recently-active session is
  missed.
- **Verify (blocking):** session counts reconcile and **TTL parity holds** on a
  statistically meaningful sample (remaining TTL in Redis equals remaining lifetime in
  Postgres within a small tolerance). Do not proceed until TTL parity passes. Owner:
  _<name>_.

### Phase 3 — Shadow-read and compare
- **Entry:** backfill reconciled.
- **Action:** enable shadow-read — serve from Postgres but also read from Redis and
  log mismatches (missing key, wrong value, divergent TTL).
- **Verify:** mismatch rate ≈ 0 over ≥ 24h. Investigate and fix any mismatch before
  proceeding. Owner: _<name>_.

### Phase 4 — Staged read cutover to Redis
- **Entry:** shadow-read clean (note: the Phase 3 shadow-read compare is the primary
  defense against a serialization or key-format bug — it catches such bugs *before*
  any user read is served from Redis; the ramp below is blast-radius containment, not
  the only safety net).
- **Action:** move the read source to Redis behind the flag, ramped **1% → 10% → 50%
  → 100%**, holding at each step. Reads that miss Redis fall back to Postgres (which
  is still being written) so a stray miss does not log anyone out.
- **Verify at each step (automated gate):** an automated check compares the
  success-criteria metrics for the ramped cohort against the captured baseline and
  only permits promotion to the next step if every threshold passes; a breach trips an
  automatic hold and pages the decision-owner. Promotion is data-driven, not
  time-driven. On breach the decision-owner aborts: flip the read source back to
  Postgres (instant, lossless — Postgres is still current via dual-write). Owner:
  _<name>_.

### Phase 5 — Soak on Redis reads
- **Entry:** 100% reads on Redis, all thresholds green.
- **Action:** continue dual-writing to Postgres and serving reads from Redis for a
  **soak period of several days** (recommend ≥ 1 week).
- **Verify:** metrics stable across the full soak; confirm the Postgres load
  reduction. During this entire period a full rollback to Postgres remains available
  and lossless. Owner: _<name>_.

### Phase 6 — Stop writing to Postgres (reversible)
- **Entry:** soak clean.
- **Action:** disable dual-write; Redis becomes the sole live store. **Do not drop
  the table.** Optionally take a final logical backup of `sessions`.
- **Verify:** stable for ≥ 48h. (Rollback after this point means accepting that
  sessions created since Phase 6 exist only in Redis — see Rollback.) Owner: _<name>_.

### Phase 7 — Decommission Postgres sessions (point of no return)
- **Entry:** Phase 6 stable for ≥ 48h **and** explicit sign-off from the
  decision-owner.
- **Action:** rename/quarantine the `sessions` table first; drop it only after a
  further holding period and a confirmed recent backup.
- **Verify:** no application references the table; backup restorable. Owner: _<name>_.

## Rollback

Rollback is expected to be routine, not improvised. The decision-owner may invoke it
at any phase against the abort thresholds.

- **Phases 1–5 (dual-write still on):** flip the read source back to Postgres (and, if
  needed, disable dual-write). **Lossless** — Postgres has been kept current the whole
  time, so all current sessions, including those created during the Redis window,
  survive. This directly avoids the trap where rolling back would otherwise drop every
  session created only in Redis.
- **Phase 6 (dual-write off, table still present):** re-enable dual-write and move
  reads back to Postgres. Sessions created while dual-write was off existed only in
  Redis; those specific users may need to re-authenticate. This window is kept short
  (≥ 48h verification) precisely to bound that exposure, and the table still exists to
  fall back to.
- **Phase 7 (table dropped):** no rollback to Postgres — this is why Phase 7 is gated
  behind sign-off and a confirmed backup. Recovery would mean restoring the backup,
  handled as an incident.

## Timeline

This spans **multiple windows over roughly 1–2 weeks**, not a single Saturday night:

- Phase 0: provisioning (ahead of time).
- Phase 1 (dual-write) → Phase 4 (staged read cutover): low-traffic windows on
  separate days, each with its own verification gate.
- Phase 5 soak: several days (≥ 1 week recommended).
- Phases 6–7: only after the soak, with explicit sign-off; the destructive drop is
  deliberately last and separated from the cutover.

A "finish it all in one hour on Saturday" schedule is explicitly out of scope: it
would force the mass logout, single-point-of-failure, no-rollback, and
drop-before-verification risks this plan is designed to eliminate.
