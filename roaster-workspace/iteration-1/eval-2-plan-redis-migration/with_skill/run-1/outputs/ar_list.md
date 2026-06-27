# Anti-Requirements — Redis Session Migration Plan

> Inferred by an isolated sub-agent (general-purpose, fresh context) given ONLY the
> requirements spec. Backend mode: STATELESS sub-agent (real isolation). NOT degraded.
> These are MASTER-only; they are INLINED (de-labelled) into the reviewer concerns list,
> never sent as a labelled "anti-requirements" section.

## Returned list (verbatim from sub-agent)

1. **Big-bang cutover that points all servers at empty Redis without dual-read/dual-write or pre-migration of existing session keys** → every currently-logged-in user is forcibly logged out at the cutover instant (violates G1/CH1; triggered by PR3's concurrent active population).

2. **Asymmetric rollback that abandons sessions written only to Redis after cutover** → rolling back to Postgres silently logs out (or loses the auth state of) every user who logged in during the Redis window, so the "safe" rollback itself causes the data loss it was meant to prevent (violates G3; the inverse failure of CH1).

3. **Migration snapshot with a write-gap — copying existing keys at time T while sessions created/refreshed between T and cutover are never re-synced** → a band of recently-active users is dropped despite a "complete" migration (violates G1/CH1; a race the dual-write must close).

4. **Copying session keys to Redis without preserving each key's remaining TTL (resetting to a full/default expiry or no expiry)** → either every migrated session gets its lifetime extended/reset (immortal sessions, security drift) or expiry semantics diverge from Postgres behavior (violates CS3; corrupts G1's "not forcibly logged out" once the wrong TTL fires).

5. **Single standalone Redis instance with no replica and no failover** → one node death or restart takes down all authentication, making the new store strictly less reliable than the Postgres it replaced (violates CH2/G4; direct consequence of PR2).

6. **No persistence configured (neither RDB nor AOF), or persistence assumed but never stated/verified** → a Redis restart or crash evaporates 100% of live sessions with no recovery, logging out everyone simultaneously (violates G4/CH2; direct consequence of PR2 — sessions are not a disposable cache per PR1).

7. **Default/unbounded memory behavior — no `maxmemory` plus an LRU/random eviction policy (e.g. `allkeys-lru`)** → Redis silently evicts valid live sessions under memory pressure, logging out random active users with no error surfaced (violates CS1; a quiet variant of the G1 violation).

8. **`maxmemory` set with `noeviction` but no headroom/capacity plan for the concurrent session population** → once memory fills, new session writes are rejected, so logins start failing mid-window even though existing sessions survive (the opposite-edge failure of #7; violates CS1/G4 and breaks G2's "faster logins" claim).

9. **Single deploy to 100% of servers with no canary or staged rollout** → a latent bug in the new read/write path (serialization mismatch, key-format error, missing TTL) hits all traffic at once with no blast-radius containment (violates PR4; converts any code defect into a total auth outage).

10. **DROP TABLE on the old sessions table inside, or immediately adjacent to, the cutover window — before a soak/verification period** → destroys the only fallback the instant it's most likely to be needed, leaving the system unrecoverable if the cutover is later found broken (violates CH3/G3; direct consequence of PR5).

11. **Success declared by subjective feel ("seems faster," "no complaints") with no pre-cutover baseline and no post-cutover measurement** → the latency/DB-load improvement is assumed rather than proven, and a silent regression (e.g. higher error rate, p99 latency increase) goes undetected (violates G2/CH4).

12. **No defined success/abort metrics — error rate, login latency percentiles, session-loss count, Redis memory & eviction counters — with thresholds** → the operator has no objective trigger to decide "proceed vs. roll back" and ends up deciding by gut feel under pressure (violates CH4/G5; couples with #11).

13. **Redis reachable without authentication (no ACL/`requirepass`), without TLS, or without network isolation from untrusted networks** → live session tokens are exposed for sniffing or an unauthenticated attacker can read/forge sessions, i.e. a full auth-bypass surface (violates CS2; severe given PR1's stateful auth data).

14. **A plan with under-specified steps — missing per-step preconditions, verification checks, named owners, and timings** → the on-call engineer must improvise decisions live on Saturday, and the reviewer cannot meaningfully approve it (violates G5; the explicit "run it and trust it" mission failure).

15. **No named rollback decision-owner, abort criteria, or comms plan for the maintenance window** → when something goes wrong mid-cutover, nobody is authorized to call the rollback and there's decision paralysis while sessions degrade (violates CS4/G5; turns a recoverable incident into a prolonged outage).

## Sub-agent's own emphasis

- #2 (asymmetric rollback) and #3 (migration write-gap) flagged as highest-severity-yet-most-overlooked (second-order races a plan can believe it handled).
- #7 and #8 are paired opposite-edge failures (eviction drops sessions vs. noeviction blocks new logins) — a plan must avoid both.
