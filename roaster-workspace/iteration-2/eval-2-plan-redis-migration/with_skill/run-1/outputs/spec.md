# MGPC Spec — Redis Session Migration Plan
# MASTER-ONLY — never shown to the reviewer

Mission     : A safe, executable plan for migrating user sessions from Postgres to Redis that improves performance without causing downtime or data loss during the Saturday deployment window.

Goals:
  G1: Eliminate session-related load on the primary Postgres database.
  G2: Reduce login latency for end users after the migration.
  G3: Preserve all active user sessions across the cutover (zero forced logouts of active users).
  G4: Provide a rollback path if the migration fails during the deployment window.

Premises:
  P1: The application can be updated to target Redis for session reads and writes without requiring a database schema migration.
  P2: Redis is assumed to be sufficiently reliable and persistent for session storage (persistence config, replication, or acceptable loss tolerance is verified).
  P3: The migration team has operational runbook clarity — each step has a clear owner, acceptance test, and go/no-go gate.
  P4: Saturday's deployment window is sufficient in duration and risk window for a production migration of this scope.

Constraints:
  CH1 (hard): No production outage — the migration must not cause a period where users cannot log in.
  CH2 (hard): No silent data loss — sessions must not be silently dropped or corrupted; any loss must be explicit and communicated.
  CH3 (hard): The old sessions table must not be dropped until the new store is confirmed healthy in production.
  CS1 (soft): The plan should include measurable success criteria beyond "logins feel faster."
  CS2 (soft): The plan should address what happens to sessions already in Postgres at cutover time.

# Element count:
# 1 Mission + 4 Goals + 4 Premises + 5 Constraints = 14 total spec elements
# Required ARs: 14
