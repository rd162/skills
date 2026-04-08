---
name: inferring-requirements
description: Discovers hidden requirements bottom-up using Chain of Knowledge triples and infers intent top-down into Mission, Goals, Premises, Constraints (MGPC). Use when analyzing a raw request, prompt, or brief to uncover implicit requirements, broaden the solution space, and produce a structured requirements specification before implementation or candidate generation.
version: "2.0"
metadata:
  author: rd162@hotmail.com
  tags: requirements, discovery, CoK, MGPC, prompt-engineering
---

# Inferring Requirements

Systematic requirements discovery combining bottom-up knowledge expansion
with top-down intent inference.
Produces an MGPC specification from any raw request.

The unique value of this approach:
bottom-up broadens the solution space BEFORE top-down narrows it.
This prevents both tunnel vision (narrowing too early)
and scope creep (never focusing).

## When to Use

- Analyzing a raw prompt, brief, or user request before implementation
- Uncovering hidden requirements, implicit constraints, cross-cutting concerns
- Broadening the solution space before committing to an approach
- Preparing structured input for candidate generation or architecture decisions
- Any task where "what the user said" likely understates "what the user needs"

## When NOT to Use

- Pure logic or math proofs (no hidden requirements — problem is fully stated)
- Simple factual lookups (no solution space to broaden)
- Tasks where the user has already provided a complete specification
- Creative writing where open-endedness is the goal, not a gap

## Termination

| Signal    | Condition                                             | Action                       |
| --------- | ----------------------------------------------------- | ---------------------------- |
| COMPLETE  | MGPC output produced with M, G, P, C + Solution Space | ✓ STOP — specification ready |
| SATURATED | Phase 0 stop criteria met (see below)                 | Proceed to Phase 1           |
| BLOCKED   | Request too ambiguous to extract even basic topics    | Ask user for clarification   |

## Graceful Degradation

This skill is self-contained methodology — no external dependencies.
However, the depth of each phase scales with available context budget:

- **Full budget:** Complete L5→L1 expansion + recursive "why?" chain
- **Tight budget:** L5→L3 expansion (skip L2-L1) + 2-3 "why?" steps
- **Minimal budget:** Extract explicit topics + single "why?" pass → lightweight MGPC

The output is always an MGPC specification.
The depth varies; the structure does not.

---

## Two-Phase Process

**Phase 0** (Bottom-Up): Expand the knowledge space using CoK triples.
**Phase 1** (Top-Down): Collapse into structured MGPC intent.

Always run Phase 0 before Phase 1.
Phase 0 feeds saturation data into Phase 1.

---

## Phase 0: Bottom-Up Requirements Saturation

Broaden the solution space before narrowing intent.
Uncover hidden requirements, alternatives, and cross-cutting concerns.

### Method

Build Chain of Knowledge (CoK) triples from the request,
expanding from specific topics upward through areas, fields, disciplines, and domains.

**Triple structure:** `(subject, relation, object)` — linked knowledge units.

### Hierarchy

```text
L5: Topics      → explicit and implied subjects from the request
L4: Areas       → solution patterns that group topics
L3: Fields      → delivery mechanisms and implementation approaches
L2: Disciplines → cross-cutting concerns and mandates
L1: Domains     → top-level classification and disjointness verification
```

### Level 5 — Topics

Extract explicit topics, then expand implicit ones.

```text
Explicit:  (request, states, topic)
Expansion: (topic, implies|requires|enables, topic)

Example: "social network" → profiles → connections → auth → messaging → notifications
```

### Level 4 — Areas

Group topics into solution areas and identify patterns.

```text
(topic, belongs_to, area) | (area, has_pattern, pattern)

Example: {profiles, messaging} → user-engagement → {forums, communities}
```

### Level 3 — Fields

Map areas to delivery mechanisms.

```text
(area, implements_via, field) | (field, requires, mechanism)

Example: user-engagement → web-apps → {SPA, APIs}
```

### Level 2 — Disciplines

Identify cross-cutting concerns and mandates.

```text
(field, grounded_in, discipline) | (discipline, mandates, concern)

Example: web-apps → software-engineering → {security, testing}
```

### Level 1 — Domains

Verify classification and confirm disjointness.

```text
(discipline, part_of, domain) | (domain, disjoint_from, domain)

Example: software-engineering → technology ✓ (disjoint: arts)
```

### Saturation Output

Produce this summary after completing all levels:

```text
L5→{topics} | L4→[area]+{patterns} | L3→[field]+{mechanisms}
L2→[discipline]+{concerns} | L1→[domain]✓
Requirements: L4[constraints] + L3[constraints] + L2[mandates]
Solution Space: {patterns from L4-L3}
```

### Stop Criteria

Stop expanding when ANY is true:

- Relevance drops below 0.3
- Depth reaches 5 levels
- No new triples generated at current level
- Token budget exhausted

---

## Phase 1: Top-Down Intent Inference

Collapse the broadened space into a structured MGPC specification.

### The "Why?" Recursion

Start with the stated request and ask "why?" repeatedly
until the answer becomes circular (a tautology).
The tautology is the Mission — the terminal value
that justifies all downstream goals.

This is a simple but powerful technique:
it separates what the user ASKED for from what the user NEEDS.

```text
Example: "build a todo app"
  → why? "to manage tasks"
  → why? "to increase productivity"
  → why? "to improve well-being"
  → why? "well-being is intrinsically valuable" ← tautology = Mission
```

**Note on terminology:** This skill calls the recursive "why?" process
the "W-functor" — original notation from PE_Library
inspired by category theory's concept of functors as structure-preserving maps.
The "W" stands for "Why." It is not established academic terminology;
it is a practical shorthand for this specific recursion pattern.

### MGPC Components

| Component       | Litmus Test                                         | Source              |
| --------------- | --------------------------------------------------- | ------------------- |
| **Mission**     | Asking "why?" yields a tautology (circular answer)  | "Why?" fixed point  |
| **Goals**       | Changing the goal changes the solution type         | Frozen from request |
| **Premises**    | If false, the goal becomes impossible               | L4-L2 saturation    |
| **Constraints** | Violation causes rejection (hard) or penalty (soft) | User stated + L3-L2 |

### Inferring Each Component

**Mission:** The terminal value from "why?" recursion.

**Goals:** Freeze the concrete objectives from the original request.
Changing a goal should change the type of solution entirely.

**Premises:** Extract from L4-L2 saturation data.
Each premise is an assumption that, if false, makes the goal impossible.

**Constraints:** Combine user-stated constraints with mandates from L2-L3.
Mark each as hard (violation = rejection) or soft (violation = penalty).

### MGPC Output Template

```text
M: [terminal_value — the "why?" tautology]
G: [concrete objectives from the request]
P: [assumptions that must hold for goals to be achievable]
C: [hard: violation = reject | soft: violation = penalty]
Solution Space: {alternative approaches from Phase 0}
```

---

## Worked Example

**Raw request:** "Build a social network for dog owners"

### Phase 0 Output

```text
L5→{profiles, connections, messaging, photos, dog-breeds, events, location}
L4→[social-engagement]+{feeds, groups, matching} | [pet-mgmt]+{health, breeding}
L3→[web-platform]+{SPA, REST API, real-time} | [mobile]+{native, PWA}
L2→[software-engineering]+{security, testing, scalability}
   [data-science]+{recommendations, moderation}
L1→[technology]✓ (disjoint: veterinary-science→separate domain)

Requirements: L4[real-time messaging, media storage] + L3[auth, API rate limiting]
             + L2[GDPR compliance, content moderation, load testing]
Solution Space: {PWA + REST, native + GraphQL, hybrid + real-time}
```

### Phase 1 Output

```text
M: Foster community and well-being among dog owners
   (why? chain: social network → connect owners → build community
    → improve well-being → intrinsic value)
G: Digital platform connecting dog owners via profiles, messaging, and events
P: Users have internet access | Users own or care for dogs | Mobile-first usage
C: Hard: authentication required, content moderation, GDPR compliance
   Soft: real-time messaging preferred, location services optional
Solution Space: {PWA + REST, native + GraphQL, hybrid + real-time}
```

---

## Integration with Other Skills

This skill's MGPC output is consumed by downstream skills,
but it can also be used standalone for requirements analysis.

- **Candidate generation:** MGPC provides evaluation criteria
  and Solution Space ensures divergent alternatives
- **Pairwise comparison:** Goals and Constraints become scoring criteria
- **Verification:** Premises become testable assumptions
- **Audit:** The CoK saturation output documents the reasoning trail

## Anti-Patterns

```text
✗ Skipping Phase 0 and jumping straight to MGPC (misses hidden requirements)
✓ Always run Phase 0 before Phase 1 — saturation feeds intent inference

✗ Expanding CoK triples beyond relevance 0.3 (token waste, noise)
✓ Stop when relevance drops, depth maxes, or no new triples emerge

✗ Treating Premises as Goals (premises are assumptions, goals are objectives)
✓ Litmus: if false → goal impossible (premise) vs. changing it → different solution (goal)

✗ Producing MGPC without Solution Space (narrows too early)
✓ Always include alternatives from L4-L3 patterns in output

✗ Using the "why?" recursion only once (stops at surface intent)
✓ Recurse until tautology — the circular answer is the Mission

✗ Listing every L5 topic without grouping into L4 areas
✓ Group topics → areas → fields → disciplines → domains (hierarchy matters)
```

## Environment Compatibility

This skill is pure methodology — no tooling dependencies.
Works with any agent or LLM:

- **Claude Code / Claude API**: Use thinking tool for CoK expansion
- **GitHub Copilot / VS Code**: Apply as analysis framework before implementation
- **Cursor / Codex / Gemini CLI**: Same two-phase process applies
- **Kimi / other agents**: Works in any conversational context
- **Bare LLMs**: Run Phase 0 + Phase 1 manually in conversation
- **Programmatic**: Implement as CoK graph builder → MGPC extractor pipeline

## References

- Li et al.,
  "Chain-of-Knowledge: Grounding Large Language Models
  via Dynamic Knowledge Adapting over Heterogeneous Sources"
  (arXiv:2305.13269, 2023).
  Foundation for CoK triple structure and graph-based expansion.
- Pohl, K.,
  "Requirements Engineering: Fundamentals, Principles, and Techniques"
  (Springer, 2010).
  Source for goal-oriented requirements engineering.
  The MGPC structure (Mission, Goals, Premises, Constraints)
  adapts Pohl's requirements framework for prompt engineering use.
  The specific adaptation and "W-functor" notation are original to PE_Library.
