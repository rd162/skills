---
tier: T3
source_class: llm
last_updated: 2026-04-29
description: academic references
---

# Academic References — roaster

Supporting literature for the roaster skill's design decisions.
Loaded on demand — not part of the main SKILL.md context.

## Version 6.0 Note — Merge with `deliberate` (EXPLORE mode)

Version 6.0 absorbs the sibling skill `deliberate` (v9.0, retired). The blind-attack
kernel — isolated context-starved AR inversion, two-point Person Triangulation,
deep-research-only directive, MASTER both-direction verification — is unchanged from
v5.0 and now also drives EXPLORE mode: 3 divergent candidates generated cross-aware in
MASTER's context, refined in parallel by the same kernel (shared AR list, per-candidate
fresh reviewers), then selected by 3 isolated Condorcet pairwise voters.

Deliberate mechanics superseded by the v5.0 kernel and NOT carried over: MASTER-side
concerns-list assembly (replaced by AR-inferrer verbatim output), persistent reviewer
sessions and cross-round phrasing variation (replaced by fresh reviewers per round),
the symmetric-distrust hedge ("don't assume the concerns are right either" — forbidden;
it undercuts fiction #1), skip-PT-on-code (corrected in v5.0), the smart failure-pattern
AR registry (replaced by counted 1:1 inversion), and the Phase 2.5 extras
(citation-verification pass, inverse-specification recovery, cross-pollination — the
Condorcet voter's verify-key-claims step retains the useful portion). Hard/soft
constraint tiers were dropped in favor of a single sourced Constraints list.

## Version 5.0 Note — Isolated Inversion + Two-Point Person Triangulation

Version 5.0 corrects two drifts that had accumulated in the v4.0 description.

1. **The attack is blind by context starvation, not by avoiding an LLM call.** v4.0 claimed
   a "deterministic, zero-LLM-call" attack via MASTER-side template inversion. In practice,
   inverting the spec inside MASTER's own context — which holds the artifact and the authoring
   intent — drifts into reasonable, reality-grounded "smart critique," the exact failure mode
   this skill exists to avoid. v5.0 generates the anti-requirements in an **isolated,
   context-starved sub-agent** given ONLY the Mission/Goals/Premises/Constraints spec: with
   nothing to reason about, it can only invert each requirement 1:1 into a present-tense
   failure. The blindness is enforced by input starvation; the list is passed to the reviewer
   verbatim, never recomposed into reasoned concerns.

2. **Person Triangulation is a two-point sustained fiction.** v4.0 treated it as a single
   scathing attribution of the artifact. v5.0 makes it two coupled lies MASTER sustains every
   round: (a) the anti-requirements are attributed to a *trusted assessor* who "can't be wrong"
   (in truth they are mechanical and very possibly false); (b) the artifact is attributed to a
   *non-trusted author* — a non-capable AI by default — even when MASTER produced it. The
   reviewer is given no goal beyond a deep-research request; its reaction (CAPITULATE /
   DEFENSE / CONVERGE) is the only signal, and MASTER filters sycophancy in both directions
   against its private spec.

Most of the literature below remains directly relevant — isolation, self-correction limits,
fixed-point convergence, and adversarial pressure all still apply. What changed is where the
adversarial signal lives (the reviewer's reaction to a believed lie) and how blindness is
enforced (context starvation of the inverter). The historical v3.0 (CRITIC/AUTHOR) and v4.0
(MASTER-side template fill) framings are superseded. See § Original Contributions for the
v5.0 deltas.

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

## Condorcet and Ranked Voting (EXPLORE mode)

- Zhao, Xiutian, Ke Wang, and Wei Peng.
  "An Electoral Approach to Diversify LLM-based
  Multi-Agent Collective Decision-Making."
  EMNLP 2024. arXiv:2410.15168.
  Condorcet and ordinal voting for LLM agent decisions;
  surveys 52 multi-agent systems and identifies heavy reliance
  on dictatorial and plurality voting as a diversity failure.
  Grounds the pairwise-voter design over a single judge.

- Wang, Weiqin, Yile Wang, and Hui Huang.
  "Ranked Voting based Self-Consistency of Large Language Models."
  Findings of ACL 2025. arXiv:2505.10772.
  Ranked voting improves chain-of-thought reasoning
  over majority-vote self-consistency.

- Lanctot, Marc, Kate Larson, Michael Kaisers, Quentin Berthet,
  Ian Gemp, Manfred Diaz, Roberto-Rafael Maura-Rivero,
  Yoram Bachrach, Anna Koop, and Doina Precup.
  "Soft Condorcet Optimization for Ranking of General Agents."
  AAMAS 2025. arXiv:2411.00119.
  Condorcet-optimal ranking under noisy pairwise comparisons;
  robust to >40% missing preference data.

- Kim, Sungwon, and Daniel Khashabi.
  "Challenging the Evaluator: LLM Sycophancy Under User Rebuttal."
  Findings of EMNLP 2025. arXiv:2509.16533.
  Sequential vs. simultaneous evaluation paradox —
  grounds voter isolation (one pair per voter, no shared context)
  and the exclusion of process metadata from voter inputs.

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

- **Blind attack via context-starved isolated inversion (v5.0):**
  The anti-requirements are produced by an isolated sub-agent given ONLY the
  Mission/Goals/Premises/Constraints spec — no artifact, no intent, no context.
  Starved of anything to reason about, it can only restate each requirement 1:1 as a
  present-tense failure. Blindness is enforced by input starvation rather than by the
  (false) claim of avoiding an LLM call, and the inversions are passed to the reviewer
  verbatim — never recomposed into reasoned concerns, which would reintroduce smart
  critique. Builds on Self-Refine (Madaan et al.) and Constitutional AI (Bai et al.):
  the constitutional principles become the spec, but inversion replaces principle-guided
  critique with an asserted total failure the reviewer must research against.

- **Two-point Person Triangulation (v5.0):**
  A pair of sustained fictions in every reviewer prompt: the anti-requirements are
  attributed to a *trusted assessor* who "can't be wrong," and the artifact to a
  *non-trusted author* (a non-capable AI by default). MASTER knows both are false —
  the ARs are mechanical, and MASTER may have authored the artifact itself — and asserts
  them anyway. Exploits the model's tendency to defer to authority and to disown and
  rewrite low-status work, maximizing the pressure a genuinely strong artifact must
  survive to produce DEFENSE. The reviewer is given no outcome goal; only a deep-research
  request. Original contribution.

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
