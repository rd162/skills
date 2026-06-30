# Migration Plan: Move User Sessions to Redis

## Overview

We will migrate the user session store from Postgres to Redis to improve login
latency and reduce load on the primary database. The migration uses a continuous
catch-up sync, a dual-write bridge, and a canary cutover to preserve all active
sessions, and retains a config-flag rollback path until Redis is confirmed healthy
and the Postgres sessions table is explicitly retired.

## Prerequisites

Before the Saturday deployment window begins, the following must be completed and
signed off:

- Redis instance provisioned with AOF persistence enabled (`appendonly yes`,
  `appendfsync everysec`). Acknowledged loss tolerance: up to 1 second of session
  writes in the event of a hard crash before fsync. Confirm this is acceptable for
  this application's session loss tolerance before proceeding.
- At least one Redis replica configured. Note: replication is asynchronous; a
  primary crash after acknowledging a write but before replication completes may
  lose that write. If zero-loss replication is required, specify `WAIT 1 0` on
  session writes or use Redis Cluster / Sentinel with `min-replicas-to-write 1`.
  Redis Sentinel (or Cluster) must be configured for automatic failover; without
  it, a primary failure requires manual promotion and causes session unavailability
  until an operator acts.
- Eviction policy set to `noeviction` (under memory pressure Redis returns an
  explicit error on new session writes rather than silently dropping existing
  sessions; capacity must be sized for peak session load before Saturday).
- Application ships three modes selectable via `SESSION_STORE` env var:
    - `postgres` — Postgres only (current production state).
    - `dual-write` — writes to both Postgres and Redis; reads Redis first,
      falls back to Postgres on miss, and promotes the session to Redis on
      fallback hit. This fallback-and-promote behavior covers sessions created
      in Postgres during the pre-population-to-dual-write transition window.
    - `redis-primary` — reads Redis; on miss, falls back to Postgres and
      promotes. Session writes go to Redis only.
  Rollback to `postgres` or `dual-write` is a config change; no redeploy required.
- Load test of Redis at expected peak session volume completed; confirm p99 session
  read latency is below the Postgres baseline captured in production.
- Rollback procedure rehearsed end-to-end in staging: toggle `SESSION_STORE`,
  verify sessions remain valid, confirm latency returns to baseline within 5 minutes.
- Baseline metrics captured in production: p50 and p99 session read latency,
  session error rate, and Postgres session query count.
- Phase 4 on-call coverage confirmed: at least one engineer on-call from Saturday
  through the end of the 24-hour observation window (Sunday). Pager rotation must
  be active for session error rate alerts.

## Deployment Steps

### Phase 1 — Pre-populate Redis and begin continuous catch-up (before cutover)

1. Start the session sync job: continuously read sessions from Postgres (ordered by
   `updated_at DESC`) and write each to Redis, preserving the session's remaining
   TTL from Postgres (do not assign a fixed TTL; compute
   `TTL = session_expires_at - now()` and set it on the Redis key). The sync job
   runs continuously until Phase 2 dual-write is fully deployed across all servers,
   ensuring no session created after the initial snapshot is missed.
   - Owner: [name]
   - Acceptance gate: Redis session count ≥ 95% of Postgres active session count
     AND the sync job lag (Postgres sessions written in the last 60 seconds that
     are not yet in Redis) is < 50.
   - Go/no-go: if either condition is not met within 30 minutes, abort.

### Phase 2 — Dual-write validation (30–60 min observation window)

2. Deploy `SESSION_STORE=dual-write` to a canary (10–20% of servers). The
   fallback-and-promote behavior means any session not yet in Redis (from the
   pre-population window) is transparently recovered from Postgres on first access
   and written to Redis, preventing any forced logout. Observe for 15 minutes:
   - Session error rate: target < 0.1%.
   - Redis hit rate: target > 90% (first-access misses are expected and handled by
     fallback-and-promote; hit rate should climb toward 99% within 15 minutes as
     the promote path runs).
   - Forced logout rate: target 0%.
   - Owner: [name]
   - Go/no-go: if any metric is outside target or forced logout count > 0, rollback
     canary and abort.
3. Roll `SESSION_STORE=dual-write` to all remaining servers. Stop the Phase 1 sync
   job — the fallback-and-promote path on dual-write servers now covers any
   remaining Postgres-only sessions. Observe for 15 minutes with the same metrics.
   - Go/no-go: if any metric is outside target, toggle all servers to
     `SESSION_STORE=postgres` (no redeploy required) and abort.

### Phase 3 — Cutover to Redis-primary (after dual-write validation passes)

4. Toggle all servers to `SESSION_STORE=redis-primary` via config update. Because
   `redis-primary` retains the Postgres read-fallback-and-promote path, any session
   not yet promoted to Redis is recovered transparently on first access — no forced
   logouts, and no split-brain between server groups during the config propagation
   window. Wait for config to propagate across the entire fleet before observing.
   - Owner: [name]
   - Acceptance gate: session error rate < 0.1%, Redis hit rate > 99%,
     p99 session read latency < 20ms for 15 consecutive minutes.
   - Go/no-go: if gate is not met within 30 minutes, toggle back to `dual-write`
     via config flag.

### Phase 4 — Observation window (minimum 24 hours post-cutover)

5. Monitor continuously until all criteria have been met for 24 hours:
   - Session error rate < 0.1%.
   - Redis hit rate > 99%.
   - p99 session read latency < 20ms.
   - Postgres session table write count = 0 (verify via `pg_stat_statements`
     after a reset at the Phase 3 start time).
   - No on-call alerts or user-facing authentication failures.
   - On-call engineer available throughout this window with active pager alerts.

### Phase 5 — Postgres cleanup (not before 24-hour observation passes)

6. Archive the `sessions` table contents to cold storage (for audit/compliance).
7. Drop the `sessions` table from Postgres.
   - Owner: [name]
   - Gate: all Phase 4 criteria met for 24 consecutive hours; Postgres session
     write count = 0 for the entire observation window.
   - Warning: once this step runs, rollback to Postgres sessions is not possible.
     Rollback after Phase 5 means users must re-authenticate.

## Rollback Procedure

At any point through Phase 4, the full rollback is:
1. Toggle `SESSION_STORE=postgres` (no redeploy required). Config propagation
   time on the fleet is [specify: e.g., < 30 seconds with current config management].
2. All application instances fall back to Postgres session reads. Sessions written
   to Redis only (during Phase 3) will be lost if rollback occurs; users whose
   sessions were created after Phase 3 cutover will need to re-authenticate.
   Sessions that existed in Postgres at the start of Phase 3 remain valid.
3. Verify session error rate returns to pre-migration baseline within 5 minutes.

Phase 5 is irreversible. Do not execute it until all Phase 4 criteria are met.

## Communication Plan

- Before Phase 1: notify the support team that a session migration is in progress.
  No user action is expected; active sessions will be preserved throughout the
  migration.
- If rollback from Phase 3 is invoked: sessions created after Phase 3 start are
  lost; notify support that some users may need to re-authenticate. Sessions from
  before Phase 3 are preserved in Postgres.
- If rollback before Phase 3 (during Phases 1-2): no session loss, no forced
  logouts, no user-facing impact.
- If Phase 5 is skipped or postponed: communicate the deferral and revised timeline
  to the team.

## Success Criteria (measurable)

| Metric | Baseline (pre-migration) | Target (post-migration) |
|---|---|---|
| p50 session read latency | [capture before Saturday] | < 10ms |
| p99 session read latency | [capture before Saturday] | < 20ms |
| Session error rate | < 0.1% | < 0.1% |
| Redis hit rate | N/A | > 99% (stable after Phase 3) |
| Forced logout count | 0 | 0 |
| Postgres session write count | [capture before Saturday] | 0 (after Phase 3) |

## Timeline

| Phase | Estimated duration | Start condition |
|---|---|---|
| Phase 1 (sync + pre-populate) | 15–30 min | Prerequisites signed off |
| Phase 2 (dual-write validation) | 30–60 min | Phase 1 gate passed |
| Phase 3 (Redis-primary cutover) | 30 min | Phase 2 gate passed |
| Phase 4 (observation) | 24 hours | Phase 3 gate passed |
| Phase 5 (cleanup) | 15 min | Phase 4 complete |

Total Saturday window: approximately 2–3 hours for Phases 1–3. Phases 4 and 5
run after the Saturday window. Do not schedule the Phase 3 config toggle later
than [Saturday close time − 90 min] to preserve abort capacity.

## Existing Session Handling

Sessions in Postgres at the time of Phase 1 are pre-populated to Redis with their
remaining TTL preserved. Sessions created after pre-population begins but before
the dual-write adapter reaches all servers are covered by the fallback-and-promote
path in the dual-write and redis-primary modes: on first access post-cutover, a
Redis miss triggers a Postgres lookup, the session is found, the response is served,
and the session is written to Redis for subsequent requests. No session created in
Postgres before Phase 5 can be silently lost without a user-visible error.
