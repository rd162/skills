# Anti-Requirements — verbatim from isolated AR-inferrer
# Spec elements: 1 Mission + 4 Goals + 4 Premises + 5 Constraints = 14
# AR count: 14 (matches)

1. This is not a safe, executable migration plan; executing it would cause downtime or data loss during the Saturday deployment window.
2. The artifact does not eliminate session-related load on the primary Postgres database.
3. Login latency for end users is not reduced after the migration.
4. Active user sessions are not preserved across the cutover; active users are forcibly logged out.
5. The plan provides no rollback path if the migration fails during the deployment window.
6. The application cannot be updated to target Redis for session reads and writes without requiring a database schema migration.
7. Redis is not sufficiently reliable or persistent for session storage; persistence config, replication, and loss tolerance are not verified.
8. The migration team does not have operational runbook clarity; steps lack clear owners, acceptance tests, and go/no-go gates.
9. Saturday's deployment window is not sufficient in duration or risk tolerance for a production migration of this scope.
10. The migration causes a period where users cannot log in.
11. Sessions are silently dropped or corrupted without explicit communication or acknowledgment.
12. The old sessions table is dropped before the new store is confirmed healthy in production.
13. The plan does not include measurable success criteria beyond subjective performance impressions.
14. The plan does not address what happens to sessions already in Postgres at cutover time.
