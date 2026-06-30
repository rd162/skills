# s₁ (after Round 1)

Last quarter, we deployed a change that silently degraded our checkout latency for 12% of users. Our dashboards showed green. Error rates were nominal. The on-call engineer saw nothing.

We found out 40 minutes later, from a customer complaint.

---

This is the problem monitoring was never designed to solve. Monitoring tells you when something you predicted would go wrong, did go wrong. It answers questions you thought to ask in advance.

Observability — in the control-theory sense Kalman described in 1960 — is the ability to determine the internal state of a system from its external outputs alone. The critical word is "alone." You shouldn't need to redeploy, add an instrument, or already know what broke.

Most "observability" tooling doesn't meet this bar. Dashboards, pre-defined alerts, and aggregated metrics answer a closed question set. When something novel goes wrong — the failure mode you didn't anticipate — they give you nothing to work with.

What actually helps is being able to ask an open question against raw event data. Who was affected? What distinguished affected requests from unaffected ones? Where in the call graph did it diverge? The DORA research (2024, ~39,000 respondents) consistently shows that elite-performing teams resolve incidents significantly faster than low performers — and the gap widens as systems grow more complex, which is exactly the domain where closed-question monitoring struggles.

---

The difference between teams that find these failures quickly and teams that don't isn't tooling budget. It's whether they structured their telemetry to answer questions they haven't thought of yet.

That means wide, structured events — not metrics and logs as separate streams. It means high cardinality: user ID, request ID, feature flag state, deployment version, all as queryable dimensions. It means your storage and query layer can slice across arbitrary combinations of those dimensions in seconds.

It's a different instrumentation discipline than what most teams have inherited.
