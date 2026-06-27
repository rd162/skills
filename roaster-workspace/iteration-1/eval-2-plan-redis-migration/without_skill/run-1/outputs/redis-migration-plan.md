# Migration Plan: Move User Sessions to Redis

## Overview

We will migrate the user session store from Postgres to Redis to improve login
latency and reduce load on the primary database.

## Steps

1. Stand up a single Redis instance in production.
2. Update the application so it writes and reads sessions from Redis instead of
   Postgres.
3. Deploy the new application version to all servers at once.
4. Drop the old `sessions` table from Postgres to reclaim space.

## Timeline

The whole migration will be completed in a single deploy window on Saturday night.
We expect it to take about an hour.

## Success Criteria

Logins feel faster after the deploy.

---

# Review of the Migration Plan

**Reviewer's bottom line: Do not run this plan as written on Saturday.** It contains at least one change that is effectively irreversible (dropping the `sessions` table in the same window), a single point of failure for all authentication, and a cutover strategy that will log out every active user with no fallback. The risks below are ordered roughly by severity. Each is followed by a concrete recommendation.

## Blocking issues (must fix before the migration)

### 1. Dropping the `sessions` table in the same window destroys your only rollback (Step 4)
Once the table is dropped, there is no way to fall back to Postgres if Redis misbehaves. Reclaiming disk space is never urgent enough to justify this in the cutover window.
- **Recommendation:** Remove Step 4 from the migration entirely. Keep the Postgres `sessions` table intact and continue writing to it (see dual-write below) for a soak period of at least 1-2 weeks. Take a verified backup of the table before any later drop. Only drop it as a separate, scheduled change after Redis has proven stable in production.

### 2. A single Redis instance is a single point of failure for all logins (Step 1)
If that one instance crashes, restarts, runs out of memory, or its host fails, **100% of users are logged out and no one can log in.** This is strictly worse than the Postgres setup it replaces.
- **Recommendation:** Run Redis with high availability before cutover — at minimum a primary/replica pair with automatic failover (Redis Sentinel) or a managed offering (e.g., ElastiCache/MemoryDB, Redis Cloud, Memorystore) with HA enabled. Decide and document the failover behavior and expected failover time.

### 3. No data migration of existing sessions — every active user is logged out at cutover (Step 2)
Switching reads/writes to Redis without copying existing sessions means all currently-valid sessions instantly become invalid. Beyond the user-facing pain, the resulting re-authentication spike can overload your auth/login backend (a login stampede) at the exact moment you are making a risky change.
- **Recommendation:** Choose one of:
  - **Dual-write + read-with-fallback (preferred):** Deploy a version that writes sessions to *both* Postgres and Redis, and reads from Redis but falls back to Postgres on a miss. This makes the cutover seamless and the rollback trivial (just stop reading from Redis).
  - **Bulk pre-migration:** Copy existing non-expired sessions into Redis (with correct TTLs) immediately before cutover.
  - If a mass logout is genuinely acceptable, that must be an explicit, signed-off decision — not an accidental side effect — and it should be communicated to users and support in advance.

### 4. No rollback plan
The plan has no defined way to revert. Combined with issues 1-3, a problem during the window leaves you with no good options.
- **Recommendation:** Write an explicit rollback procedure (e.g., redeploy the previous app version / flip a feature flag back to Postgres), define who can trigger it, and define the go/no-go criteria and the hard abort time. Ideally gate the Redis path behind a feature flag so rollback is a config change, not a redeploy.

### 5. Big-bang deploy to all servers at once (Step 3)
Deploying to every server simultaneously means any bug in the new session code hits 100% of traffic instantly, with no early-warning blast-radius control.
- **Recommendation:** Roll out gradually — canary to a small percentage of servers/traffic first, watch error and latency metrics, then ramp. A feature flag with percentage rollout is the cleanest mechanism.

## Major gaps (should be resolved before the migration)

### 6. Redis durability/persistence is undefined
Redis is in-memory. Depending on configuration, a restart or failover can lose all sessions. The durability guarantees differ fundamentally from Postgres and must be a conscious decision.
- **Recommendation:** Decide the acceptable durability and configure accordingly: enable AOF (and/or RDB) persistence if session loss on restart is unacceptable, or accept that a restart logs everyone out and design around it (e.g., dual-write to Postgres as the durable store). Document the choice.

### 7. Memory sizing and eviction policy can silently delete live sessions
Without sizing, Redis can hit its memory limit; with the wrong `maxmemory-policy` (e.g., `allkeys-lru` or `allkeys-random`), Redis will silently **evict active user sessions**, logging people out unpredictably.
- **Recommendation:** Estimate peak memory (active sessions x average session size x safety margin), provision Redis with headroom, set an explicit `maxmemory`, and set `maxmemory-policy` to `noeviction` or `volatile-*` so non-expiring/critical keys are never evicted. Plan for clustering if the dataset can exceed a single node.

### 8. Session expiry/TTL strategy is missing
Postgres-backed sessions almost certainly have expiry logic. In Redis this must be implemented with per-key TTLs; otherwise sessions either never expire (memory leak + security/compliance problem) or expire inconsistently with the old behavior.
- **Recommendation:** Set a TTL on every session key matching the existing session-lifetime semantics, and confirm sliding-expiration behavior (refresh on activity) matches today's behavior.

### 9. Security of the session store is not addressed
Session tokens are sensitive. A default Redis install is unauthenticated and unencrypted.
- **Recommendation:** Require authentication (`requirepass`/ACLs), enable TLS in transit, restrict network access (private subnet/security groups, no public exposure), and confirm secrets are managed properly. Consider encryption at rest if required by policy.

### 10. Monitoring and alerting for the new dependency
You are introducing a new critical dependency with no stated observability.
- **Recommendation:** Before cutover, add dashboards and alerts for Redis memory usage, evictions, connected clients, command latency, replication health/lag, and persistence status — plus application-level session error rates.

### 11. No staging test, load test, or dry run
The first time this runs should not be in production on Saturday night.
- **Recommendation:** Exercise the full migration (including failover and rollback) in a staging environment, and load-test the Redis path at expected peak concurrency before scheduling production.

## Process and measurement issues

### 12. Success criteria are not measurable
"Logins feel faster" cannot be validated or used for a go/no-go decision.
- **Recommendation:** Define concrete, pre-baselined metrics, e.g.: login latency p50/p95/p99 at or below a target, session read/write error rate below threshold, Postgres load reduced by an expected amount, zero unexpected session evictions, and no increase in auth-related support tickets. Capture baselines *before* the change.

### 13. Timeline is optimistic and lacks checkpoints
A one-hour, single-window estimate with no buffer, checkpoints, or abort time is fragile for a change of this risk.
- **Recommendation:** Build the rollout as phased steps with go/no-go checkpoints and a defined hard abort time. Identify on-call owners and a communication/escalation path (engineering, DBA, and support/stakeholders aware of the potential session impact). Expect the safe version (HA + dual-write + canary + soak) to span more than one window — that is the correct trade-off.

### 14. Connection/client configuration is unspecified
Many app servers connecting to one Redis can exhaust connections or behave badly under timeouts.
- **Recommendation:** Configure client connection pooling, sensible timeouts, and retry/backoff; verify max client connections against server limits.

## Suggested safer sequence (high level)

1. Provision HA Redis (primary/replica + automatic failover) with auth, TLS, persistence, `maxmemory`, and a safe eviction policy. Add monitoring/alerts.
2. Ship app changes behind a feature flag: **dual-write** to Postgres + Redis, **read from Redis with Postgres fallback**, with correct TTLs.
3. Validate in staging, including failover and rollback; load-test at peak.
4. **Canary** the read-from-Redis path to a small percentage; watch metrics against baselines.
5. Ramp to 100% once metrics meet success criteria. Keep dual-write on.
6. **Soak** for 1-2 weeks. Keep Postgres as the safety net.
7. Stop dual-writing to Postgres; continue monitoring.
8. As a separate, later, scheduled change: back up and then drop the `sessions` table.
