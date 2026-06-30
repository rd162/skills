# Requirements Spec — Redis Session Migration Plan

## Mission

Safely migrate user session storage from Postgres to Redis with zero data loss and no user-visible disruption.

## Goals

- G1: Reduce login latency by offloading session lookups from the primary Postgres database to Redis.
- G2: Preserve session data continuity — no users are forced to re-authenticate during or after migration.
- G3: Maintain production stability throughout the Saturday deploy window and beyond.
- G4: Establish operational readiness of the Redis instance (persistence, capacity, connectivity) before migration begins.

## Premises

- P1: A single Redis instance (no replica, no cluster) is sufficient and reliable for the expected production session load.
- P2: A one-hour deploy window is sufficient to complete all migration steps safely.
- P3: Session data in the Postgres `sessions` table can be safely discarded or migrated to Redis before the table is dropped.

## Constraints

### Hard

- CH1: No period exists during deployment where sessions are lost due to simultaneous or sequential store switchover without a migration/invalidation strategy.
- CH2: Existing active sessions in Postgres must be explicitly handled (migrated or cleanly invalidated) — not silently abandoned.
- CH3: The Redis instance must be configured with persistence (AOF or RDB snapshots) to survive restarts without losing all sessions.
- CH4: A rollback path must be defined and tested — if Redis becomes unavailable post-deploy, the application must be recoverable.

### Soft

- CS1: Success criteria must be measurable (e.g., latency percentiles, error rates), not subjective ("logins feel faster").
- CS2: The deployment strategy should be staged or canary, not a simultaneous all-server cutover.
