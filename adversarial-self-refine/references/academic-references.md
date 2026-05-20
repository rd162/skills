---
tier: T3
source_class: llm
last_updated: 2026-04-29
description: academic references
---

# Academic References — adversarial-self-refine

Supporting literature for the adversarial-self-refine skill's design decisions.
Loaded on demand — not part of the main SKILL.md context.

## Version 4.0 Note — Blind Attack Refactor

Version 4.0 evolves the skill's architecture significantly.
The CRITIC sub-agent role is eliminated.
Attack generation becomes deterministic template inversion
of a requirements spec —
enumerated inline by the MASTER
or optionally produced by the requirements-extractor helper skill when available.
The LLM cost per round drops from 2 sub-agents (CRITIC + AUTHOR)
to 1 (DEFENDER only).
The requirements-extractor skill is a preferred helper, not a hard dependency:
the blind-attack loop runs equally well on an inline-enumerated spec,
just at lower spec rigor.

Most of the literature below remains directly relevant —
the foundational claims about isolation, self-correction limits,
fixed-point convergence, and adversarial pressure still apply.
What changes is the location of the adversarial signal:
in v3.0 the CRITIC produced it via reasoning;
in v4.0 the attack is mechanical and the DEFENDER's response is the signal.
See § Original Contributions for the deltas specific to v4.0.

---

## Table of Contents

1. [Iterative Self-Refinement](#iterative-self-refinement)
2. [Self-Correction Limitations](#self-correction-limitations)
3. [Debate and Adversarial Approaches](#debate-and-adversarial-approaches)
4. [Sycophancy in Language Models](#sycophancy-in-language-models)
5. [Fixed-Point Theory and Convergence](#fixed-point-theory-and-convergence)
6. [Cognitive Architecture](#cognitive-architecture)
7. [Skill Formalization](#skill-formalization)
8. [Original Contributions](#original-contributions)

---

## Iterative Self-Refinement

- Madaan, Aman, Niket Tandon, Prakhar Gupta, Skyler Hallinan,
  Luyu Gao, Sarah Wiegreffe, Uri Alon, et al.
  "Self-Refine: Iterative Refinement with Self-Feedback."
  NeurIPS 2023. arXiv:2303.17651.
  Foundation for the generate-feedback-refine loop.
  ~20% improvement across 7 diverse tasks without additional training.
  Also documents failure modes: the model rarely identifies
  its own reasoning errors when critiquing in the same context —
  motivates the isolated CRITIC/AUTHOR architecture.

- Chen, Xinyun, Maxwell Lin, Nathanael Scharli,
  and Denny Zhou.
  "Teaching Large Language Models to Self-Debug."
  ICLR 2024. arXiv:2304.05128.
  Self-debugging through code execution feedback.
  Demonstrates that external verification signals
  (test results, execution traces) produce stronger correction
  than intrinsic self-assessment — supports the principle
  that AUTHOR improvement benefits from external CRITIC input.

---

## Self-Correction Limitations

- Huang, Jie, Xinyun Chen, Swaroop Mishra,
  Huaixiu Steven Zheng, Adams Wei Yu, Xinying Song,
  and Denny Zhou.
  "Large Language Models Cannot Self-Correct Reasoning Yet."
  ICLR 2024. arXiv:2310.01798.
  Definitive evidence that intrinsic self-correction
  degrades accuracy without external feedback.
  Core justification for the mandatory CRITIC/AUTHOR isolation:
  same-context critique is biased by authoring memory.

- Kamoi, Ryo, Yusen Zhang, Nan Zhang, Jiawei Han,
  and Rui Zhang.
  "When Can LLMs Actually Correct Their Own Mistakes?
  A Critical Survey of Self-Correction of LLMs."
  _Transactions of the ACL_, vol. 12, pp. 1417–1440, 2024.
  Survey establishing that self-correction works only when
  verification is substantially easier than generation.
  Grounds the assertive critique design: the CRITIC's task
  (identifying non-compliance) is easier than the AUTHOR's task
  (generating a compliant solution).

---

## Debate and Adversarial Approaches

- Irving, Geoffrey, Paul Christiano, and Dario Amodei.
  "AI Safety via Debate."
  arXiv:1805.00899, 2018.
  Foundational proposal for using adversarial debate
  to align AI systems. Two agents argue opposing positions;
  a human judge selects the winner.
  Grounds the adversarial architecture: CRITIC and AUTHOR
  serve analogous roles to debaters, with MASTER as judge.

- Liang, Tian, Zhiwei He, Wenxiang Jiao, Xing Wang,
  Yan Wang, Rui Wang, Yujiu Yang, Shuming Shi,
  and Zhaopeng Tu.
  "Encouraging Divergent Thinking in Large Language Models
  through Multi-Agent Debate."
  EMNLP 2024. arXiv:2305.19118.
  Coins Degeneration-of-Thought (DoT) — single-model
  self-reflection degenerates into self-reinforcement.
  Multi-agent debate with isolated agents avoids DoT.
  Motivates the CRITIC/AUTHOR isolation pattern.

- Du, Yilun, Shuang Li, Antonio Torralba,
  Joshua B. Tenenbaum, and Igor Mordatch.
  "Improving Factuality and Reasoning in Language Models
  through Multiagent Debate."
  ICML 2023. arXiv:2305.14325.
  Multi-agent debate improves mathematical and factual reasoning.
  Multiple rounds of debate produce convergence toward correct answers.
  Supports the iterative loop design: multiple CRITIC/AUTHOR rounds
  converge toward a fixed point.

- Bai, Yuntao, Saurav Kadavath, Sandipan Kundu,
  Amanda Askell, Jackson Kernion, Andy Jones, et al.
  "Constitutional AI: Harmlessness from AI Feedback."
  arXiv:2212.08073, 2022.
  Self-critique guided by explicit principles (a "constitution").
  The enriched requirements registry serves an analogous role
  to constitutional principles — giving the CRITIC
  specific criteria to assess against.

---

## Sycophancy in Language Models

- Sharma, Mrinank, Meg Tong, Tomasz Korbak,
  David Duvenaud, Amanda Askell, Samuel R. Bowman, et al.
  "Towards Understanding Sycophancy in Language Models."
  ICLR 2024. arXiv:2310.13548.
  Defines answer/feedback/mimicry sycophancy typologies.
  Shows preference model complicity in rewarding sycophancy.
  Grounds the sycophancy watch mechanism: CRITIC may begin
  accommodating the solution rather than genuinely assessing it.

- Yao, Binwei, Chao Shang, Wanyu Du, Jianfeng He,
  Ruixue Lian, Yi Zhang, Hang Su, Sandesh Swamy,
  and Yanjun Qi.
  "Peacemaker or Troublemaker: How Sycophancy Shapes
  Multi-Agent Debate."
  arXiv:2509.23055, 2025.
  Inter-agent sycophancy collapses debates into premature consensus.
  Yields lower accuracy than single-agent baselines.
  Grounds the MASTER's sycophancy detection and reset protocol.

---

## Fixed-Point Theory and Convergence

- Tarski, Alfred.
  "A Lattice-Theoretical Fixpoint Theorem
  and Its Applications."
  _Pacific Journal of Mathematics_, 5(2), 285–309, 1955.
  Fixed-point theorem for monotone functions on complete lattices.
  The defense signal is a behavioral fixed point:
  R(s₊) ≅ s₊ — the DEFENDER (v4.0) arguing FOR its solution means
  the refinement functor R has reached a fixed point.
  Historical v3.0 framing used "AUTHOR" in the same role.

- Kleene, Stephen Cole.
  _Introduction to Metamathematics._
  North-Holland, 1952.
  Kleene's fixed-point theorem and iterative approximation.
  The DEFENDER loop (v4.0) computes successive approximations
  s₀, s₁, ..., sₙ converging to a fixed point s₊
  (defense or output stabilization).
  Historical v3.0 used a CRITIC/AUTHOR loop with the same convergence property.

---

## Cognitive Architecture

- Anderson, John R.
  _The Architecture of Cognition._
  Harvard University Press, 1983.
  ACT-R cognitive architecture: declarative vs. procedural knowledge.
  In v3.0 the CRITIC operated on declarative assessment
  while the AUTHOR applied procedural revision.
  In v4.0 the declarative role is moved out of the LLM entirely —
  the attack is a deterministic template fill over a declarative spec
  (Mission, Goals, Premises, Constraints).
  The DEFENDER retains the procedural role: integrating criticism,
  revising the artifact, or producing a substantive rebuttal.
  Isolation between MASTER (which holds the spec)
  and DEFENDER (which transforms the artifact)
  still prevents cross-contamination of these cognitive modes.

---

## Skill Formalization

- Jiang et al.
  "SoK: Agentic Skills — Beyond Tool Use in LLM Agents."
  arXiv:2602.20867v1, 2026.
  Skill formalization S = (C, pi, T, R):
  C = applicability condition,
  pi = executable policy,
  T = termination condition,
  R = reusable callable interface.

---

## Original Contributions

The following elements are original to this skill ecosystem,
built on the academic foundations listed above.
Marked **v4.0** for items new or reframed in the blind-attack refactor.

- **Deterministic blind attack via requirements inversion (v4.0):**
  Mechanical template inversion of a Mission/Goals/Premises/Constraints spec
  produces the adversarial prompt with zero LLM calls.
  Eliminates the CRITIC sub-agent role entirely.
  The spec source is decoupled from the inversion mechanism:
  inline MASTER enumeration is the floor,
  requirements-extractor is the preferred-when-available ceiling.
  Builds on Self-Refine (Madaan et al.) and Constitutional AI (Bai et al.) —
  the constitutional principles become the requirements spec,
  but inversion replaces principle-guided critique with assertion of total failure.
  The specific deterministic-fill architecture is original to this skill.

- **Person Triangulation (v4.0):**
  Adding attribution-based pressure ("this looks like cheap ChatGPT output")
  on top of the inverted-requirement attack.
  Exploits the model's tendency to either own and defend, or disown and rewrite,
  attributed work — surfacing weakness faster than pure content critique.
  Original contribution.

- **Defense-based termination:**
  The DEFENDER arguing FOR its solution as a natural convergence signal —
  a behavioral fixed point.
  Inspired by Tarski's fixed-point theory and debate convergence
  (Du et al., Irving et al.).
  Carried over from v3.0; the specific detection mechanism is original.

- **Defense verification against spec (v4.0):**
  Lightweight MASTER-side check that the DEFENDER's rebuttal claims
  are plausibly correct against the requirements spec.
  Filters sycophantic rationalization without re-doing the work.
  Reframes v3.0's sycophancy collapse detection (which monitored CRITIC drift)
  to the new architecture (which monitors DEFENDER rationalization).
  Motivated by sycophancy research (Sharma et al., Yao et al.).

- **MASTER / DEFENDER isolation pattern (v4.0):**
  In v3.0 the pattern was CRITIC / AUTHOR isolation.
  In v4.0 the CRITIC is gone — the relevant isolation is between MASTER
  (which holds the spec and authoring context)
  and DEFENDER (which sees only the artifact + the assembled attack).
  Motivated by self-correction limitations (Huang et al.)
  and Degeneration-of-Thought (Liang et al.).
