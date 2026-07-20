---
name: memory-manager
description: >-
  Maintains and retrieves durable agent memory as a wiki-linked, typed
  markdown knowledge base (Fact, Concept, Procedure, Narrative, Ontology)
  in the project memory/ layout or any markdown store. WRITE path:
  materializes session context into typed, tagged, cross-linked artifacts
  with verification discipline (unverified claims never become Facts).
  READ path: retrieves memory at session start or on demand — INDEX first,
  grep tags and links, load only relevant pages. Use when the user says
  'materialize knowledge', 'save memory', 'update memory', 'remember this',
  'document the context', 'document this decision', 'summarize progress',
  'what do we know about X', or at session start when a memory/ directory
  exists, or whenever durable cross-session knowledge should be captured
  or consulted.
version: "3.0"
metadata:
  author: rd162@hotmail.com
  tags: memory, knowledge-base, wiki-links, artifacts, verification, retrieval, source-tiering
tier: T3
source_class: llm
last_updated: 2026-07-20
---

# Memory Manager

Maintain durable agent memory as a wiki-linked, typed markdown knowledge base —
and retrieve from it. Memory that is written but never read is ritual;
this skill owns both halves:

- **WRITE** — materialize what happened, what was decided, and what was learned
  into typed, tagged, cross-linked artifacts.
- **READ** — at session start or on demand, load the right pages (and only those)
  via the INDEX, tags, and links.

**Lineage note.** The typed-artifact wiki pattern here predates and is compatible
with the filesystem-first "LLM wiki" pattern that the ecosystem later converged on
(plain markdown + `[[wiki-links]]`, agent-maintained, sessions/decisions/procedures
as pages). This skill is a superset: it adds artifact types, greppable observation
tags, and a verification chain. Type names map to the common agent-memory taxonomy:
Fact/Concept/Ontology ≈ semantic, Procedure ≈ procedural, Narrative ≈ episodic.

## When to Use

- Materializing knowledge from context ("document this", "save memory", "summarize progress")
- Recording decisions, learned patterns, procedures, or session outcomes
- Session start in a project with a `memory/` directory (READ path)
- Answering "what do we know / what did we decide about X" (READ path)
- Verifying a recorded claim and promoting it to a Fact
- Consolidating, superseding, or archiving stale memory

## When NOT to Use

- Simple note-taking with no cross-session value (just answer)
- External knowledge gathering (use deep-research; store its *conclusions* here)
- Ephemeral task state within one session (use the task list)

## Termination

| Signal       | Condition                                              | Action                           |
| ------------ | ------------------------------------------------------ | -------------------------------- |
| MATERIALIZED | Requested artifacts written, linked, INDEX updated     | STOP — memory current            |
| RETRIEVED    | Relevant pages loaded and applied to the task          | STOP — proceed with task         |
| VERIFIED     | Claim verified; Fact promoted with verification trail  | STOP — chain complete            |
| MAINTAINED   | Consolidation / supersession / archive complete        | STOP — report what changed       |

## Storage Resolution

Detect where memory lives, in this order:

1. Project `memory/` (canonical: `INDEX.md` + topic files — brief, patterns,
   decisions, preferences, active-context, glossary). Artifacts created by this
   skill live beside them: `memory/<topic-or-artifact>.md`.
2. Recognized alternates: `memory-bank/`, `.claude/memory/`, an Obsidian vault,
   Basic-Memory (use its native create/edit/move operations).
3. No store at all → output artifacts as structured text in chat for the user to
   save. The structure never changes; only the storage does.

---

## READ Path — retrieval protocol

Memory pays for itself only at read time. Retrieval is cheap and layered:

```text
∆1: Read memory/INDEX.md ONLY (progressive disclosure — never bulk-load the dir)
∆2: Match the current task against INDEX entries + artifact titles
∆3: Need more precision? grep the store:
      by tag:        grep -rn "#auth" memory/
      by category:   grep -rn "\[decision\]" memory/
      by link:       grep -rn "\[\[Fact - " memory/
∆4: Read ONLY the matched pages; follow [[links]] one hop when directly relevant
∆5: Unresolved [[links]] found along the way = known gaps — say so rather than guess
```

At session start in a memory-enabled project: run ∆1-∆2 silently; mention retrieved
constraints/decisions only when they affect the task at hand.

---

## WRITE Path

### Choosing the artifact type

| Test                                                   | Yes →         | No →                 |
| ------------------------------------------------------ | ------------- | -------------------- |
| Can it be verified true/false independently?           | **Fact**      | Concept or Narrative |
| Does it explain how multiple facts relate?             | **Concept**   | Fact                 |
| Does it give step-by-step instructions?                | **Procedure** | Narrative            |
| Remove all imperative verbs — still valuable?          | **Narrative** | Procedure            |
| Does it define vocabulary other artifacts must follow? | **Ontology**  | Concept              |

Rules of thumb: production outage → Narrative first; deployment process →
Procedure; "what does X mean in this org" → Concept; recurring term collisions
across artifacts → Ontology (rare — only at critical mass).

### Materialization protocol

**Principle: Narrative-first.** Write what happened, then derive structure from it.

```text
1. Synthesize Narrative(s) — one per storyline in the context, past tense.
   Mark unverified claims [assumption] #unverified.
   Embed [[future-forward]] links for implied-but-undocumented knowledge.
2. Materialize Facts / Concepts / Procedures selectively — create when the item is
   central, explanatory, actionable, or a dependency of another artifact.
   Defer when briefly mentioned or tangential → leave a [[future-forward]] link.
   Scope guard: "am I still answering the original request?" — if not, defer.
3. Link everything — every artifact relates to at least one other.
4. Update INDEX.md — one line per new/changed artifact (title + 1-line what-for).
   The INDEX is the retrieval entry point; an unindexed artifact is invisible.
```

**Bulk materialization (3+ artifacts)** with a sub-agent mechanism available:
one sub-agent per artifact (group by type at 6+); master writes the Narratives
(needs full context) and stitches relations (needs all artifacts).
See `references/sub-agent-guide.md`.

### Observations — greppable knowledge lines

Each artifact carries tagged one-line observations. The tags are **retrieval keys**
(the READ path greps them), not decoration:

```text
- [category] Concise statement #tags
```

Categories (infer from context):
`[fact] [requirement] [assumption] [constraint]` · `[decision] [rationale] [plan] [action]`
· `[insight] [problem] [solution] [hypothesis]` · `[technique] [tool] [metric]`
· `[verified] [unverified] [deprecated]` · `[risk] [impact] [tradeoff]`

```text
- [decision] GraphQL chosen for flexible queries #api
- [problem] Login takes 2-3 seconds #perf
- [solution] Index users.email, reduced to <100ms #perf
- [unverified] Scales to 100K req/sec — needs load test #untested
```

### Relations and the gap backlog

Link with typed relations; link to **not-yet-existing** artifacts freely:

```text
## Relations
- requires [[Procedure - Database Backup Protocol]]     # exists
- seeds [[Fact - Verified Throughput Ceiling]]           # doesn't exist yet
```

Standard relations: `implements` `requires` `supports` `is_a` `derived_from`
`verified_by` `supersedes` `superseded_by` `alternative_to` `seeds`.
Use `seeds` (never `derived_from`) when pointing forward at an artifact that
doesn't exist yet.

**Unresolved `[[links]]` are the gap backlog** — a greppable list of what the
project knows it doesn't know:

```bash
grep -rhn "\[\[" memory/ | # extract targets, diff against existing titles
```

Surface the backlog during MAINTAINED runs and when the user asks "what's missing".

### Verification pattern — unverified claims never become Facts

```text
1. Unverified claim → record in a Narrative with [assumption] #unverified
2. Verify it (test, measurement, deep-research pass, authoritative source)
3. Record the verification as an immutable Narrative with the evidence
4. Create/update the Fact with `verified_by [[the verification Narrative]]`
```

This is the memory-side counterpart of deep-research source tiering: a claim's
confidence travels with it, and promotion requires a trail.

---

## Artifact Template

Artifacts emit source-tier frontmatter (`tier: T3, source_class: llm` by default;
T4 for weak-model output — see the deep-research skill's source-tiering policy).
On revision, ADD missing tier keys; never overwrite existing ones.

```markdown
---
title: [Type] - [Name]
type: [fact|concept|procedure|narrative|ontology]
tier: T3
source_class: llm
last_updated: YYYY-MM-DD
description: <one line — what this captures>
tags: [domain, topic]
---

# [Type] - [Name]

[1-2 sentence definition]

## [Type-specific section]
Fact → Evidence (verified sources) · Concept → Definition · Procedure →
Objective + numbered Steps · Narrative → past-tense story (immutable) ·
Ontology → terms with ids + definitions

## Observations
- [category] statement #tag

## Relations
- relation_type [[Target Artifact]]
```

**Revision discipline (slimmed):** bump `last_updated` on any edit. Add a
`## Changelog` line (`- YYYY-MM-DD — what changed and why`) **only when the
meaning changes** (a Fact corrected, a Procedure's steps altered) — not for
typos or formatting. **Narratives are immutable** — new events get new Narratives.

Full per-type templates and examples: `references/extended-artifact-guide.md`.

---

## Maintenance

| Situation                    | Action                                                                 |
| ---------------------------- | ---------------------------------------------------------------------- |
| Better replacement exists    | New artifact `supersedes [[Old]]`; old gets `superseded_by [[New]]`    |
| Partially stale              | Add `[deprecated]` observation on the stale parts                      |
| Overlapping artifacts        | Merge into one; supersede the originals                                |
| Whole domain obsolete        | Move to `memory/archive/`; drop from INDEX                             |
| INDEX drift                  | Re-sync INDEX to actual pages (every MAINTAINED run)                   |

---

## Anti-Patterns

```text
✗ Recording unverified claims as Facts
✓ [assumption] #unverified in a Narrative → verify → promote with a trail

✗ Editing a Narrative after creation
✓ Narratives are immutable — new events, new Narratives

✗ Writing artifacts without updating INDEX.md
✓ Unindexed memory is invisible to the READ path — always index

✗ Isolated artifacts with no relations
✓ Every artifact links to at least one other; gaps become [[future-forward]] links

✗ Bulk-loading the whole memory/ dir at session start
✓ INDEX first; grep tags/links; read only matched pages

✗ Materializing every tangent mentioned in a session
✓ Central/explanatory/actionable/dependency → create; tangential → [[link]] and defer

✗ Changelog ceremony on every touch
✓ last_updated always; Changelog line only when meaning changes
```

---

## Composition

- **deep-research** — verification passes for claim promotion; tier frontmatter policy.
- **init-project** — installs the `memory/` layout this skill maintains.
- **roaster** — REFINE a high-stakes Concept/Procedure before it becomes canonical memory.
- **Basic-Memory / Obsidian** — native storage backends when present.

## Basis

Artifact types map to declarative/procedural/episodic knowledge (Anderson 1983,
ACT-R; Nonaka & Takeuchi 1995, SECI); observations-as-slots after Minsky 1975;
type-per-situation after Snowden & Boone 2007 (Cynefin). Independent prior design
(2025) of the pattern later popularized as the filesystem-first LLM wiki.
See `references/academic-references.md`.
