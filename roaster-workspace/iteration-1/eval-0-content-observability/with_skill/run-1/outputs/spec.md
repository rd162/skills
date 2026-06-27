# Requirements Specification — Observability LinkedIn Post

> MASTER-only internal state. NEVER sent to the reviewer sub-agent.
> Spec source: inline enumeration (Step 1, ∆3). `requirements-extractor` was
> available but the artifact is a short single-page post; inline enumeration
> yields a complete, compact spec (Mission + Goals present), so it was used.

## Verbatim User Request

"Here's a draft LinkedIn post I wrote about observability. Make it solid before I publish it."

## Mission

Produce a LinkedIn post about observability that the author can publish to build
genuine professional credibility with a technical/engineering audience — a post
that says something true and worth reading, not generic AI-style buzzword filler.

## Goals

- **G1** — Be publishable on LinkedIn as a credible, genuine post that survives
  technical-reader scrutiny and is not perceived as low-effort AI content.
- **G2** — Convey something substantive and accurate about observability that a
  technical audience finds genuinely valuable (a real idea, not a slogan).
- **G3** — Engage the reader: give a concrete reason to read, react, and comment;
  open with a hook that is not a cliche.
- **G4** — Reflect well on the author's professional credibility (sounds like a
  practitioner who has actually done the work).

## Premises

- **P1** — The audience is professional/technical LinkedIn readers (engineers,
  SREs, eng leaders) who readily detect hollow buzzword content. (Source: inferred
  from "LinkedIn post about observability" + "make it solid".)
- **P2** — Any factual claim, especially a statistic, must be real and
  attributable; an unsourced/fabricated number damages credibility more than
  having no number at all. (Source: standard for credible technical writing.)
- **P3** — "Make it solid" means add substance, accuracy, and an authentic voice —
  not merely polish the existing prose. (Source: inferred from "solid".)
- **P4** — The author wants to publish under their own name, so authenticity and
  not-embarrassing-the-author matter. (Source: inferred from "before I publish it".)

## Constraints

### Hard (violation = rejection)

- **CH1** — No fabricated or unverifiable statistics presented as established fact.
  (The draft's "Studies show that 87% ..." with no source is the prime offender.)
- **CH2** — Technical claims about observability must be accurate and defensible
  (e.g., the monitoring-vs-observability distinction must be stated correctly, not
  as an empty "it's a mindset / culture / journey").
- **CH3** — Must read as authentic human practitioner writing, not as generic
  AI-generated filler.

### Soft (violation = penalty)

- **CS1** — Concise and skimmable for the LinkedIn feed; appropriate length
  (substantial enough to be credible, short enough to be read).
- **CS2** — Avoid cliches and buzzword-stacking: "game-changer", "paradigm shift",
  "synergistic value", "cutting-edge / best-in-class", "at the end of the day",
  "the bottom line", "the future is now", "left behind in the dust", "what are you
  waiting for".
- **CS3** — Carry a concrete, specific point of view or takeaway — ideally a real
  example or a crisp definition the reader can use.
- **CS4** — Have a genuine hook and a non-salesy close; avoid hard-CTA marketing tone.
