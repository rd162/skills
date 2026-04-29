# Source Tiering Policy

Authoritative reference for tier (T1–T4) assignment and `source_class`
taxonomy used by `deep-research-t1` and any skill that produces or
consumes structured knowledge. Other skills MAY inline the relevant
short summary; this file is the source of truth.

## 1. Tier Scale

| Tier | Description | Default Confidence | Weight in Conflicts |
| ---- | ----------- | ------------------ | ------------------- |
| T1 | Peer-reviewed papers, official vendor docs, RFCs, standards bodies | HIGH | Strongest |
| T2 | Expert blogs, established trade press, primary partner documents (`__SPECS__/`), authoritative books | MED | Strong |
| T3 | Community forums, Stack Overflow, fragments/extracts (`__FRAGMENTS__/`), summaries of prior tiers | LOW | Weak |
| T4 | Opinions, unverified claims, AI-generated content, project-internal generated docs (surveys, playbooks, memory) | LOW | Weakest |

**T1 is reserved for true public sources.** Internal/closed documents
never qualify as T1, even if authoritative inside the organization.

When sources conflict, higher tier + more recent = stronger evidence.

## 2. `source_class` Taxonomy

Every generated or curated markdown document declares one of:

| Class | Meaning | Typical Tier |
| ----- | ------- | ------------ |
| `public` | Unmodified content from external sources (web, vendor docs, GitHub, Confluence, Jira) — kept verbatim with link | T1–T2 (rarely worth saving lower) |
| `specs` | Internal/closed primary documents — partner-supplied PDFs, RFPs, contracts, transcripts, screenshots (`__SPECS__/`) | T2 default |
| `fragment` | Extract, index, summary, or transform of `public` + `specs` — no new intent, just restructured prior tiers (`__FRAGMENTS__/`) | T3 default |
| `generated` | Final-for-purpose product of a job — surveys, blueprints, playbooks, discovery reports, memory entries | T4 default |

**Pipeline:** `external (public) + internal (specs) → fragments → generated`

## 3. Default Tier by Path

When a frontmatter `tier` is missing, apply these defaults — in order:

1. Path under `__SPECS__/` → `tier: T2`, `source_class: specs`
2. Path under `__FRAGMENTS__/` → `tier: T3`, `source_class: fragment`
3. Path under `.agents/memory/` (or `.claude/memory/`) → `tier: T4`, `source_class: generated`
4. Project-root generated docs (surveys, discovery reports, playbooks) → `tier: T4`, `source_class: generated`
5. Anything else → run inference (§5)

## 4. Frontmatter Schema (additive)

A skill that creates or updates a markdown file MUST emit at least:

```yaml
---
tier: T4                       # T1 | T2 | T3 | T4
source_class: generated        # public | specs | fragment | generated
version: "1.0"                 # bump on substantive content change
last_updated: 2026-04-29       # ISO date
description: <one-line>        # human-readable purpose
---
```

**Additivity rule (NEVER violate):** If a file already has frontmatter
(any keys), the skill ADDS missing keys only. It does not replace or
reorder existing keys, and it does not change values the human or
another skill already set.

If the doc uses a domain-specific frontmatter format (e.g., spec-kit,
Jekyll/Hugo, JSON-LD), keep that format intact and append the tier
keys at the end of the frontmatter block.

## 5. Inference Algorithm — Missing Tier

When a local document has no `tier` and §3 default doesn't apply:

```text
1. git log --diff-filter=A -- <file>
   → first-add commit message + author + date
2. If commit message says "import", "ingest", "convert"
   → likely fragment; tier = T3, class = fragment
3. If file content has > 90% LLM-slop indicators
   (markdown bullets, em dashes, "It's important to note", "In summary",
    no concrete data, no source links)
   → likely AI-generated; downgrade by inferred model quality:
   - weak/old model output (verbose, generic) → T4
   - premium model output (concise, sourced, structured) → T3
4. Else if content is clearly human-authored
   (rough notes, typos, idiosyncratic voice, references to people/dates)
   → T2 by default; T1 only if it cites external authority
5. If still unclear → T4 (safe default; conservative for conflicts)
```

The inference is heuristic; mark inferred tier as `tier_inferred: true`
in the frontmatter when a skill writes it, so future passes know it
was guessed and can be refined.

## 6. Conflict Resolution

When two sources disagree on a fact:

1. Compare `tier` — higher wins
2. If equal — compare `last_updated` — newer wins
3. If still tied — prefer `public` > `specs` > `fragment` > `generated`
4. If still tied — surface the contradiction in the output; do not
   silently resolve

## 7. What This Policy Does NOT Cover

- Cross-vendor markdown frontmatter standard (none exists; this is a
  project + skill convention, not a standards-body schema)
- Per-claim provenance inside a document (use inline `(Source: …, T#)`
  citations for that)
- Automatic tier escalation — tiers only go up via human review
