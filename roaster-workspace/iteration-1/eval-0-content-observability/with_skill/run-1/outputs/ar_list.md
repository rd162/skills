# Anti-Requirements — returned by isolated AR-Inferrer sub-agent

> Step 1.5. Inferred in an isolated sub-agent (general-purpose) whose ONLY input
> was the requirements spec — no user history, no authoring context, no MASTER
> hints. Backend: real isolated sub-agent (Agent tool). Agent id: a5ac573314f7fc1f8.
> These ARs are inlined as ordinary concerns in the reviewer prompt — never as a
> labelled "anti-requirements" section.

1. **Fabricated or rounded "industry" statistic stated as fact** (e.g., "73% of
   outages are caused by poor observability," "teams reduce MTTR by 60%") with no
   source, no link, no attribution → instant credibility collapse with a technical
   audience; worse than no number at all.

2. **The monitoring-vs-observability distinction rendered as a vibe** — defined via
   "observability is a mindset / culture / journey" or "monitoring tells you *that*,
   observability tells you *why*" with no mechanism → SRE readers flag it as hollow;
   misses the real distinction (monitoring = predefined metrics/dashboards for known
   failure modes; observability = ability to ask arbitrary, unanticipated questions
   of high-cardinality telemetry to debug unknown-unknowns).

3. **Technically wrong or sloppy core claim** — e.g., conflating the three pillars
   (logs/metrics/traces) *as* observability rather than as inputs, claiming high
   cardinality is "just expensive," misusing cardinality/sampling/SLO → one
   defensible error read by practitioners torpedoes the credibility goal.

4. **Buzzword-stack opening** — hook is a cliche ("In today's fast-paced
   cloud-native world...", "Observability isn't just a tool, it's a culture") →
   reader pattern-matches to AI/marketing filler in the first line and scrolls past.

5. **Generic AI-prose tells** — em-dash-and-tricolon cadence, "It's not just X, it's
   Y" antithesis, "Let's dive in," "game-changer," "the bottom line," "unlock,"
   emoji bullet headers, tidy "Key takeaways:" list → reads as machine-generated;
   violates the authentic-human hard constraint and embarrasses the named author.

6. **No concrete point of view or takeaway** — surveys "what observability is" in
   neutral encyclopedia tone with no opinion, no example, nothing a reader couldn't
   get from a vendor landing page → fails substantive-value goal; no reason to react.

7. **Absence of lived specificity** — zero concrete artifacts (a real debugging
   story, a specific tool, a particular failure shape, an actual query, a
   cardinality/cost number from experience) → nothing signals the author did the
   work; indistinguishable from someone who only read marketing copy.

8. **Hard-sell / CTA close** — ends with "DM me to learn how we can transform your
   observability strategy," "Follow for more!", or a product link → trips the
   salesy-tone constraint; reframes a credibility post as an ad.

9. **Engagement-bait framing** — manufactured controversy or fill-in-the-blank
   prompt ("Hot take: dashboards are dead. Agree?") the body doesn't support →
   reads as algorithm-gaming; technical readers downgrade trust.

10. **Wall-of-text or essay length** — multi-paragraph blocks, no white space, 600+
    words → fails concise/skimmable for the feed; the idea drowns and the post is
    abandoned before the payoff.

11. **Vendor-neutral to vacuity, OR uncritical single-tool evangelism** — either
    never naming any concrete technology (nothing grounded/verifiable) or shilling
    one product as a silver bullet → first reads as abstract filler, second as a
    paid plug.

12. **Source cited but mischaracterized** — a real report/study is linked but its
    finding is overstated or misquoted (vendor self-reported survey passed off as
    neutral data, narrow result stretched to a universal claim) → a reader who
    clicks through catches the gap; more damaging than the original unsourced claim.

13. **"Make it solid" satisfied by polish only** — just tightening grammar and
    swapping synonyms on existing buzzword prose without adding substance, accuracy,
    or authentic voice → violates the premise; the post stays hollow under a cleaner
    coat.
