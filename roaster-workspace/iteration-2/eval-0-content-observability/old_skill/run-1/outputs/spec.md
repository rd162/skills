# Requirements Spec — observability-post

## Mission
Produce a polished LinkedIn post that establishes the author's credibility on observability and is worth publishing.

## Goals
- G1: Communicate a clear, substantive point about observability that a technically literate audience finds valuable
- G2: Survive LinkedIn's quality bar for professional content (not flagged/ignored as low-effort AI content)
- G3: Reflect genuine expertise rather than marketing-speak

## Premises
- P1: The audience is technically literate (engineers, architects, tech leads)
- P2: The post will be read in a professional context where vague hype damages rather than builds credibility

## Constraints

### Hard
- CH1: No fabricated or unverifiable statistics (e.g. "87% of teams...")
- CH2: No hollow buzzwords/filler phrases as the core of the argument ("mindset", "culture", "journey", "synergistic value", "game-changer", "paradigm shift")

### Soft
- CS1: Post should have a concrete, specific insight — not just "observability is good"
- CS2: Call-to-action, if present, should earn its place with specifics, not just hype
- CS3: Length and structure appropriate for LinkedIn (short-to-medium, readable)

## Anti-Requirements (from AR-Inferrer sub-agent)

AR1: Insight diluted to received wisdom — central claim is something every engineer already knows with no novel framing → technically literate reader extracts zero new information; credibility consumed not built.

AR2: Buzzword load-bearing structure — argument depends on terms like "observability journey", "holistic visibility", "game-changing insights" to carry weight that only concrete reasoning can support → reads as vendor marketing; engineers disengage.

AR3: Fabricated or unverifiable quantitative claim — a statistic without a citable source, or sourced to a vendor white paper presented as independent research → one engineer asking for the source destroys the post's credibility.

AR4: False specificity — names a real tool or metric incorrectly, creating an illusion of expertise while containing a detectable error → domain expert corrects it publicly; correction becomes the defining signal.

AR5: Observation without prescription or consequence — states a problem clearly but never lands on a claim, trade-off, or cost → feels like preamble with no argument; readers ask "so what?"

AR6: Generic call-to-action appended without earning it — "follow me for more", "drop a comment", "what do you think?" without delivered value → exposes that the post was written for engagement, not communication.

AR7: Scope collapse to a single tool or vendor — insight scoped to one product reads as product advocacy → engineers not using that tool stop reading; engineers who are using it read it as an ad.

AR8: Structure optimized for scroll-stopping over clarity — aggressive line breaks, emoji headers, or a provocative first line that misrepresents content → technically literate readers recognize formatting as low-signal bait.

AR9: Expertise performed through jargon density — accumulates domain terms without demonstrating understanding of relationships between them → signals surface-level familiarity, not depth.

AR10: Anecdote generalized without qualification — single team's experience presented as universal pattern → engineers with different contexts find immediate counterexamples; credibility collapses.

AR11: Conflict-avoidant framing that eliminates the insight — softens every claim until nothing distinguishable remains → no actionable point survives; technically inoffensive and worthless.

AR12: Length mismatch to claim weight — trivial observation padded to reach target length, or complex argument compressed to three lines omitting needed reasoning → readers feel time was wasted, or claim appears asserted rather than argued.
