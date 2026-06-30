# AR List — returned by AR-Inferrer sub-agent

1. **Insight diluted to received wisdom** — the post's central claim is something every engineer already knows ("you should instrument your code", "logs help debugging", "metrics matter") with no novel framing, concrete trade-off, or non-obvious implication. → A technically literate reader extracts zero new information and stops reading; credibility is not built, it is consumed.

2. **Buzzword load-bearing structure** — the argument depends on words like "observability journey", "holistic visibility", "game-changing insights", or "proactive mindset" to carry weight that only concrete reasoning can support. → The post reads as vendor marketing; engineers pattern-match this immediately and disengage or dismiss the author.

3. **Fabricated or unverifiable quantitative claim** — a statistic such as "teams with observability reduce MTTR by 73%" appears without a citable source, or is sourced to a vendor white paper presented as independent research. → A single engineer who asks for the source destroys the post's credibility in the comments; the author looks either careless or dishonest.

4. **False specificity** — the post names a real tool, metric, or technique (e.g., "use p99 latency") but uses it incorrectly or in a context where it does not apply, creating an illusion of expertise while containing a detectable error. → A domain expert corrects it publicly; the correction becomes the post's defining signal.

5. **Observation without prescription or consequence** — the post states a problem or phenomenon clearly but never lands on a claim: what should be done differently, what trade-off is involved, or what the cost of ignoring it is. → The post feels like a preamble with no argument; technically literate readers are left asking "so what?"

6. **Generic call-to-action appended without earning it** — the post ends with "follow me for more observability insights", "drop a comment below", or "what do you think?" without having delivered enough specific value to make the reader want more or have something concrete to react to. → The CTA exposes that the post was written to generate engagement rather than communicate; it retroactively cheapens whatever substance preceded it.

7. **Scope collapse to a single tool or vendor** — the insight is implicitly or explicitly scoped to one product (Datadog, Prometheus, OpenTelemetry) in a way that makes the post read as product advocacy rather than architectural or operational reasoning. → Engineers not using that tool stop reading; engineers who are using it read it as an ad, not expertise.

8. **Structure optimized for scroll-stopping over clarity** — the post uses aggressive line breaks, emoji as section headers, or a provocative first line that misrepresents the actual content in order to game LinkedIn's engagement algorithm. → Technically literate readers recognize the formatting as low-signal bait; the professional context penalty applies immediately.

9. **Expertise performed through jargon density** — the post accumulates domain terms (cardinality, exemplars, golden signals, RED method, DORA metrics) without demonstrating that the author understands the relationships between them or when each applies. → The post signals surface-level familiarity, not depth; a reader who tests one term against context finds it used decoratively.

10. **Anecdote generalized without qualification** — a single team's experience or the author's one project is presented as a universal pattern ("what we found was...therefore you should...") without acknowledging scope, context, or conditions under which the result might not hold. → Engineers with different contexts immediately find counterexamples; the post's credibility collapses to "this person had one experience and drew a large conclusion."

11. **Conflict-avoidant framing that eliminates the insight** — to avoid controversy or seeming negative, the post softens every claim until nothing distinguishable remains ("it depends", "every team is different", "there are trade-offs"). → No actionable point survives; the post is technically inoffensive and completely worthless to a technically literate reader.

12. **Length mismatch to claim weight** — a trivial observation is padded to 600 words with restatements, qualifications, and context that existed only to reach a perceived target length; or a genuinely complex argument is compressed to three lines that omit the reasoning needed to evaluate it. → In the first case, readers feel their time was wasted; in the second, the claim appears asserted rather than argued, and the author looks overconfident.
