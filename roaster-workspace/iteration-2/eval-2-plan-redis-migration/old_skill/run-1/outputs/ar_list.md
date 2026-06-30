# Anti-Requirements — Redis Session Migration Plan

Returned by isolated AR-Inferrer sub-agent (no artifact context, spec only).

1. **Silent session abandonment during store switchover.** Existing Postgres sessions are neither migrated to Redis nor explicitly invalidated before the cutover — they become phantom sessions that the new code cannot find, forcing unexpected re-authentication for all active users mid-session.

2. **Simultaneous all-server cutover without a dual-read/dual-write bridge.** All application servers switch to Redis at once before any sessions have been moved, creating a window where valid Postgres sessions are invisible to the new store and appear expired.

3. **Redis configured without AOF or RDB persistence.** The single Redis instance restarts (OOM kill, kernel reboot, deploy artifact) and loses the entire session keyspace, forcing a full user re-authentication event.

4. **No tested rollback path to Postgres.** A Redis failure post-deploy has no documented or exercised recovery procedure. The team attempts ad-hoc Postgres reactivation under production pressure, extending the outage.

5. **Postgres `sessions` table dropped before session migration is confirmed complete.** The drop executes as part of the deploy script before a validation step confirms all live sessions were migrated or expired, making rollback permanently impossible and causing data loss.

6. **Capacity and connectivity of Redis unverified before the deploy window opens.** The migration starts inside the one-hour window only to discover Redis `maxmemory` is set too low, the application's security group cannot reach Redis, or TLS certificate mismatch blocks connections — consuming the entire window in remediation.

7. **Migration step runtime exceeds the one-hour deploy window.** A full-table copy of a large `sessions` table into Redis is not benchmarked beforehand; the migration script is still running when the window closes, leaving the system in a partially migrated, undefined state.

8. **Success criteria remain subjective and unmeasured.** The deploy is declared successful based on "no one complained" rather than a concrete threshold. A latent degradation goes undetected until it becomes a user-visible incident.

9. **Single Redis instance treated as inherently reliable without a failure budget.** The premise that one instance is "sufficient and reliable" is accepted without defining what happens when it is not. No circuit-breaker or fallback read from Postgres exists.

10. **Canary traffic routed to Redis-backed servers without monitoring Redis hit/miss rates.** The staged rollout proceeds on a timer rather than on signal — even if the Redis-backed canary cohort is silently returning session-miss errors, the deploy continues.

11. **Session TTLs not replicated from Postgres to Redis during migration.** Sessions migrated to Redis receive a default TTL (or no TTL) rather than the remaining lifetime from Postgres, causing sessions to expire earlier than expected or to become immortal.

12. **Race condition between migration script and live write traffic.** The migration script reads Postgres sessions in batches while the application is still writing new sessions to Postgres. Sessions created after the batch boundary are never copied and are silently dropped when the cutover completes.

13. **Redis connection pool exhausted under peak login load.** The application is configured with a connection pool sized for Postgres rather than Redis. Under the first post-migration peak, connection exhaustion causes session lookup timeouts.
