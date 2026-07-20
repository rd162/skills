---
name: requirements-extractor
description: >-
  Extracts structured requirements from raw knowledge context —
  documents, codebases, briefs, user requests, or transcripts —
  producing a Mission, Goals, Premises, Constraints (MGPC) specification.
  Classifies input type (repo, spec, brief, transcript) and reads where
  implicit requirements actually hide. Every Premise carries a risk
  assessment; every Constraint cites its source.
  Use when you have unstructured input and need formal requirements
  before implementation, architecture, or candidate generation —
  the MGPC spec is the standard input for the roaster skill.
version: "4.0"
metadata:
  author: rd162@hotmail.com
  tags: requirements, discovery, MGPC, prompt-engineering
tier: T3
source_class: llm
last_updated: 2026-07-20
---

# Requirements Extractor

Turn any unstructured input into a compact, auditable requirements
specification: **Mission, Goals, Premises, Constraints (MGPC)**.
Discovery first (broaden — surface what the input implies but doesn't say),
then intent inference (narrow — collapse into the spec). Broadening before
narrowing prevents both tunnel vision and scope creep.

## When to Use

- Analyzing a raw prompt, brief, or user request before implementation
- Uncovering hidden requirements, implicit constraints, cross-cutting concerns
- Preparing structured input for candidate generation, architecture decisions, or the roaster skill
- Any task where "what the user said" likely understates "what the user needs"

## When NOT to Use

- Pure logic or math proofs (problem fully stated, nothing hidden)
- Simple factual lookups
- The user already provided a complete specification
- Creative writing where open-endedness is the goal

## Termination

| Signal   | Condition                                          | Action                     |
| -------- | -------------------------------------------------- | -------------------------- |
| COMPLETE | All four MGPC components + Mission Space produced  | STOP — specification ready |
| BLOCKED  | Input too ambiguous to extract even basic topics   | Ask user for clarification |

Depth scales with budget: full discovery scan on a generous budget;
explicit topics + a short "why?" chain on a minimal one.
The output is always the same MGPC structure.

---

## Step 1: Classify the Input

Different input types bury requirements in different places. Read accordingly.

| Input Type | What to Read | Where Implicit Requirements Hide |
| ---------- | ------------ | -------------------------------- |
| **Repository** | README, CONTRIBUTING, docker-compose, .env.example, CI configs, package manifests, Makefile, architecture docs | Runtime dependencies, deployment constraints, build mandates, code style rules, license terms |
| **Specification** | Main spec + linked normative sections, conformance clauses, MUST/SHALL language, appendices | Implementor constraints, backwards-compatibility guarantees, interop assumptions |
| **Product brief** | Surface text + read between the lines for team/budget/timeline signals | Ecosystem dependencies, regulatory obligations, unstated market assumptions |
| **Transcript** | Explicit statements + who says what, what goes unchallenged, hedging language ("ideally", "if possible") | Hedging = negotiable; who has veto power; assumed context |
| **Mixed** | Classify each source separately, then merge | Cross-source contradictions; stakeholders assuming different things |

For repositories, read beyond the README: the README describes what the project
*wants to be*; the config files describe what it *actually requires to run*.

## Step 2: Discovery Scan (broaden)

Surface the implicit before writing the spec. No formal notation needed —
just three passes over the classified input:

1. **Explicit topics** — list every subject the input states outright.
2. **Implications** — for each topic ask: what does this *imply, require, or enable*
   that the input never mentions? (e.g. "user accounts" implies auth, PII handling,
   account recovery.) Add the answers as candidate requirements.
3. **Cross-cutting mandates** — scan the standard concerns that apply to this class
   of problem regardless of what the input says: security, privacy/regulatory,
   testing, operations, accessibility, licensing, budget/team capacity.

Stop when a pass adds nothing new. Note viable solution alternatives and open
questions as you go — they feed the Mission Space (Step 4).

## Step 3: Infer the Specification (narrow)

### Mission — the "why?" recursion

Start with the stated request and ask "why?" repeatedly until the answer becomes
circular. That tautology is the Mission — the terminal value justifying all goals.
This separates what the user ASKED for from what the user NEEDS.

```text
"build a todo app" → why? "manage tasks" → why? "increase productivity"
→ why? "improve well-being" → why? "well-being is intrinsically valuable" ← Mission
```

**Quality gate:** (1) one sentence — a list or "two parts" means the recursion isn't
done; (2) invariant test — change any Goal and the Mission must still hold, otherwise
it's really a Goal; (3) ask "why?" once more — a circular answer confirms the fixed point.

### Goals, Premises, Constraints

| Component       | Litmus Test                                        | Source                    |
| --------------- | -------------------------------------------------- | ------------------------- |
| **Mission**     | Asking "why?" yields a tautology                   | "Why?" fixed point        |
| **Goals**       | Changing the goal changes the solution type        | Frozen from the request   |
| **Premises**    | If false, a goal becomes impossible                | Discovery scan            |
| **Constraints** | A limit the solution must respect                  | User-stated + discovery   |

- **Goals:** freeze the concrete objectives from the request. 3–7 items.
- **Premises:** each MUST carry a **Source** (stated / inferred from [file/section] /
  industry standard) and a **Risk if false** (what breaks). Flag **HIGH RISK** when
  falsification would invalidate the Mission itself, not just one Goal.
- **Constraints:** one flat list — do not tier them. Each MUST cite its **Source**
  (who or what imposed it: `Legal (stated)`, `IT policy`, `inferred from [context]`,
  `regulatory`, …). Sourcing makes the spec auditable and challengeable.

### Output Template

When writing the spec to a file, prepend source-tier frontmatter
(`tier: T3, source_class: llm` — see the deep-research skill's source-tiering policy).

```text
## Mission

[Single sentence — the terminal "why?" value]

## Goals

1. [Concrete objective] — [measurable criterion if available]

## Premises

| # | Premise | Source | Risk if false |
|---|---------|--------|---------------|
| P1 | [assumption] | [where it comes from] | [consequence; flag HIGH RISK] |

## Constraints

| # | Constraint | Source |
|---|-----------|--------|
| C1 | [limit] | [who imposed it] |

## Mission Space

[see below]
```

## Step 4: Mission Space

A compact map of the solution terrain that doesn't fit into MGPC:

1. **Evaluated alternatives** — viable approaches found during discovery, with fit
   assessment against the Constraints
2. **Domain context** — critical knowledge any implementor needs (regulatory
   landscape, ecosystem dynamics)
3. **Knowledge gaps** — what the input didn't answer, flagged for follow-up

Not a recommendation — a map. It lets downstream consumers (architects, candidate
generators, roaster EXPLORE mode) navigate alternatives without redoing the analysis.

---

## Partial Input

Real requests are incomplete. Never fail — expand: if the Mission is missing, run the
"why?" recursion on the strongest Goal; fill missing Premises/Constraints from the
discovery scan. Run all steps regardless of what the input already provides.

If exploring alternatives downstream: Goals, Premises, and Constraints may be
challenged one at a time (each challenge cascades — changing a Goal forces Premise and
Constraint updates); the Mission is never challenged — it is the fixed point.

---

## Anti-Patterns

```text
✗ Skipping discovery and jumping straight to the spec (misses hidden requirements)
✓ Always scan first — implications and cross-cutting mandates feed the spec

✗ Writing Mission as a list or multi-sentence paragraph
✓ Mission is ONE sentence — if it needs a list, the "why?" recursion isn't done

✗ Premises without risk assessment ("Users have internet" — so what?)
✓ Every Premise states what breaks if false: "P fails → offline-first arch needed"

✗ Constraints without source citation ("Must be on-prem" — says who?)
✓ Every Constraint cites its source: "On-prem only — Legal (stated)"

✗ Treating Premises as Goals
✓ Litmus: if false → goal impossible (premise) vs. changing it → different solution (goal)

✗ Reading only the README of a repo input
✓ Read docker-compose, .env, CI configs, CONTRIBUTING — that's where real constraints live
```

## Basis

Mission recursion adapts Toyota's 5 Whys (Ohno, 1988); the component structure adapts
goal-oriented requirements engineering (van Lamsweerde, 2001; Pohl, 2010).
See `references/academic-references.md`.
