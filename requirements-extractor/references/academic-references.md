---
tier: T3
source_class: llm
last_updated: 2026-07-20
description: academic references
---

# Academic References — requirements-extractor

Supporting literature for the skill's design decisions.
Loaded on demand — not part of the main SKILL.md context.

## Version 4.0 Note — Formalism Removed

v4.0 removed the Chain of Knowledge (CoK) triple notation, the L5→L1 expansion
hierarchy, relevance-threshold pseudo-metrics, the Applied Category Theory framing
(Requirements Category, W-functor, challenge functors), and the hard/soft constraint
tiers. Rationale: the notation was scaffolding around behaviors a capable model
performs natively when instructed plainly ("list implications, scan cross-cutting
mandates, stop when a pass adds nothing new"). The surviving mechanics — discovery
before specification, "why?" recursion to a fixed-point Mission, sourced Premises with
risk assessment, sourced flat Constraints — retain the value. Constraints are a single
sourced list; negotiability is a property downstream consumers judge from the source,
not a tier baked into the spec.

---

## Requirements Engineering Foundations

- Pohl, Klaus.
  _Requirements Engineering: Fundamentals, Principles, and Techniques._
  Springer, 2010.
  Source for requirements layering; the MGPC structure
  (Mission, Goals, Premises, Constraints) adapts Pohl's layers
  for prompt-engineering use.

- van Lamsweerde, Axel.
  "Goal-Oriented Requirements Engineering: A Guided Tour."
  _RE'01_, pp. 249–262, 2001.
  Goal decomposition and obstacle analysis; grounds the
  Goal/Premise litmus tests and the challenge-with-cascade rule.

## Root Cause Analysis and the "Why?" Recursion

- Ohno, Taiichi.
  _Toyota Production System: Beyond Large-Scale Production._
  Productivity Press, 1988.
  The 5 Whys method; the Mission recursion is its adaptation —
  iterate "why?" until the answer is circular; the tautology is
  the terminal value.

- Tarski, Alfred.
  "A Lattice-Theoretical Fixpoint Theorem and Its Applications."
  _Pacific Journal of Mathematics_, 5(2), 285–309, 1955.
  The Mission as the fixed point of the "why?" recursion:
  further iteration returns the same answer.

## Original Contributions

- **MGPC specification shape** — Mission (terminal value), Goals (frozen objectives),
  Premises (assumptions with source + risk-if-false), Constraints (flat, sourced).
  Designed as the shared contract consumed by the roaster skill (AR inversion,
  candidate generation, Condorcet voting).
- **Mission quality gate** — one-sentence test, Goal-invariance test, tautology test.
- **Input-type classification table** — where implicit requirements hide per input
  class (repo / spec / brief / transcript / mixed).
