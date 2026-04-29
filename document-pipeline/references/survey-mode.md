# Survey Mode — document-pipeline

Targeted survey generation from `__FRAGMENTS__/`. Loaded on demand by the
parent skill when the user asks to build a survey, summarize specs, or
extract structured knowledge — typically after ingestion completes.

A **survey** is `tier: T3, source_class: generated`. Even though it synthesizes
T1–T2 sources, the survey itself is an LLM-produced derived artifact — not
a raw source. Use `tier: T4` only if the survey was produced by a weak model
or contains no cited sources. Emit the frontmatter when writing the output
file (see `source-tiering.md` in `deep-research-t1/references/`).

## When to Use This Mode

- An `__FRAGMENTS__/` directory exists with converted documents
- User asks: "build a survey", "analyze documents", "what do the specs
  say", "summarize the RFP", "extract knowledge from fragments",
  "create knowledge base from documents", "generate clarification
  questions"
- Building a knowledge base targeting a specific subject (e.g.,
  "ingest documents and produce a survey for Winslow") — ingestion can
  span many documents, the survey scopes to a subset.

## When NOT to Use This Mode

- Documents have not been converted yet — run ingestion mode first
- User wants a final deliverable like a proposal — use rfp-proposal-generation
- Single-document reading with no cross-referencing — use Read directly
- Pure code analysis — use Grep/Glob

## Termination

| Signal   | Condition                                                                | Action |
| -------- | ------------------------------------------------------------------------ | ------ |
| COMPLETE | Survey written, gaps catalogued, questions generated (if needed)         | STOP — report sections + gap count |
| PARTIAL  | Survey partially populated, session boundary reached                     | STOP — save progress, report what remains |
| NO_FRAGS | `__FRAGMENTS__/` missing or empty                                        | Degrade — read `__SPECS__/` directly |
| BLOCKED  | No documents available in any location                                   | Ask user to provide documents or run ingestion |

## Graceful Degradation

- **Full capability** (`__FRAGMENTS__/` with dual MD + WEBP + web search):
  cross-reference converters, vision analysis, entity research, structured
  survey, clarification questions.
- **Partial fragments** (single converter): proceed; state limitation.
- **No WEBP images**: skip vision analysis; note diagrams may be missing.
- **No web search**: skip entity research (Phase 2); state limitation.
- **No `__FRAGMENTS__/`, but `__SPECS__/` exists**: read source documents
  via Read directly; quality lower (no dual-converter cross-reference).

---

## Phase 1: Inventory Fragments

### 1.1 Read the Master Index

```text
∆1: read_file("__FRAGMENTS__/INDEX.md") → document inventory
∆2: For each document, note converters succeeded, WEBP image count, content type
∆3: Record as inventory table
```

### 1.2 Classify by Priority

| Priority | Content Type | Read Method |
| -------- | ------------ | ----------- |
| 1 | Requirements / scope | Full read (both converters) |
| 2 | Architecture / specs | Targeted read + WEBP |
| 3 | Spreadsheets / data | markitdown preferred |
| 4 | Slide decks | Both converters + slide images |
| 5 | Supporting / reference | Targeted read (grep) |

---

## Phase 2: Entity Research (If Web Tools Available)

Build external context about the subject entity (company, organization,
project sponsor) before diving into fragments. **Subject scoping matters
here:** if the user asked for a Winslow survey, research Winslow specifically
even though the fragment set may include other partners' documents.

### 2.1 Get Current Date

Use `now(timezone="local")` → extract `current_year`. NEVER hardcode years.

### 2.2 Execute Research (3+ searches minimum)

| # | Tool Priority | Purpose |
| - | ------------- | ------- |
| 1 | company_research_exa / web_search_exa | Entity profile, products, strategy |
| 2 | web_search_exa / firecrawl_search | Industry position |
| 3 | web_search_exa (news) | Recent developments |
| 4+ | Site-specific | Multi-site intelligence |

### 2.3 Record Findings with Tier

Every external claim must include source name, URL, date accessed, tier.
Apply T1–T4 from `source-tiering.md`. **T1 reserved for true public
sources** (peer-reviewed, official vendor docs, RFCs). Annotate every
citation.

---

## Phase 3: Read and Cross-Reference Fragments

### 3.1 Read Each Document (Priority Order)

```text
∆1: read_file → outline
∆2: markitdown first (better for tables/structured data)
    → use start_line/end_line for targeted section reads
∆3: docling second (better for complex layouts/diagrams)
∆4: Cross-reference: note content captured by one but missed by other
```

⚠ **Large file strategy:** Fragment files can exceed 2000 lines. Get the
outline first, then read targeted line ranges. Never load entire large
files into context.

### 3.2 Cross-Reference Technique

```text
∆1: markitdown → tables, lists, structured sections (primary)
∆2: docling → complex layouts, multi-column, image captions (secondary)
∆3: grep for key terms across both → identify extraction gaps
∆4: Merge: take the best extraction from each
```

Content that commonly differs: tables, section headers, numerical OCR,
footnotes, multi-column ordering.

### 3.3 Analyze WEBP Images (If Available)

For PDFs/DOCX with WEBP images:

```text
∆1: Check markdown for "Figure", "Diagram", "Architecture" mentions
∆2: Identify pages likely containing visual content
∆3: read_file("__FRAGMENTS__/{doc}/images/{doc}_p{NNN}-{NNN}.webp")
∆4: Extract: components, relationships, data flows, annotations
∆5: Record image reference in survey for traceability
```

---

## Phase 4: Populate Survey Document

Load `references/survey-template.md` and use it as the structural guide.
Copy to `{Project}_Survey.md` and populate in place. **Emit frontmatter:**

```yaml
---
tier: T4
source_class: generated
version: "1.0"
last_updated: YYYY-MM-DD
description: <one-line — e.g., "Winslow technical discovery survey">
---
```

If the destination file already has frontmatter, ADD missing keys only.

### Survey Structure (12 sections)

```text
§1  Entity & Project Context (with §1.4 External Research Findings)
§2  Executive Summary (Document Intent)
§3  Glossary of Terms
§4  Use Cases & Business Requirements
§5  Functional Requirements (grouped by area, with IDs)
§6  Non-Functional Requirements
§7  Technical Architecture & Integration
§8  Data Model & Interfaces
§9  Compliance & Regulatory Landscape
§10 Implementation Hints & Constraints
§11 Source Document Reference
§12 Open Questions & Gaps
```

### Extraction Rules

- Record source document and section reference for each item
- Distinguish **explicitly stated** vs **inferred** requirements
- Merge external research (Phase 2) — flag inferred insights
- Flag contradictions and ambiguities
- Use MoSCoW priority where discernible

### §9 Compliance — Always Assess

Always include §9, even if "N/A — no regulatory framework applies."
Explicit assessment prevents oversight.

| Domain | Likely Frameworks |
| ------ | ----------------- |
| Pharma / Labs | GxP, FDA 21 CFR Part 11, EU Annex 11, ALCOA+ |
| Medical Devices | FDA QSR, ISO 13485, IEC 62304 |
| Financial Systems | SOX, PCI-DSS |
| Healthcare Data | HIPAA, HITECH |
| EU Data Processing | GDPR |
| General Software | Typically N/A — state explicitly |

---

## Phase 5: Identify Gaps and Open Questions

In §12, catalogue everything that could block downstream work.

| Category | Definition | Example |
| -------- | ---------- | ------- |
| Information Gap | Required info absent from sources | "No API doc for System X" |
| Contradiction | Two documents conflict | "Doc A: 3 weeks; Doc B: 6 weeks" |
| Ambiguity | Multiple valid interpretations | "'Real-time' could mean seconds or minutes" |
| External Gap | RFP contradicts external research | "RFP: 500 users; IR report: 5,000" |

For each entry: ID (GAP-1, CON-1, AMB-1), Source, Description, Impact,
Default Assumption, Recommended Action.

---

## Phase 6: Generate Clarification Questions (If Needed)

Load `references/questions-template.md`. Copy to
`{Project}_Clarification_Questions.md` and populate.

### Question Format

| Column | Requirement |
| ------ | ----------- |
| ID | Category letter + number (B1, A1, T1, C1) |
| Question | Specific, references source section |
| Rationale | Why the answer matters |
| Default Assumption | Actionable — NEVER "TBD" or "unknown" |

### Categories

- **B (Business):** ownership, licensing, support, commercial
- **A (Application):** functional scope, journeys, data, integrations
- **T (Technical):** infrastructure, APIs, SDKs, protocols, environments
- **C (Compliance):** ONLY if domain requires it

### Quality Rules

- Target 15–25 questions total
- Every question references a specific source section
- No duplicates across categories
- Order by priority within each: P1 (Blocking), P2 (Important), P3 (Nice)
- Omit Compliance section if no compliance questions apply

### Default Assumption Strategy

Choose defaults that are: lower risk, lower complexity, more common,
transparent (state what changes if wrong).

---

## Output Files

| File | Content | Audience |
| ---- | ------- | -------- |
| `{Project}_Survey.md` | Structured knowledge extraction (§1–§12) | Internal |
| `{Project}_Clarification_Questions.md` | Prioritized questions + defaults | External |

Both files: `tier: T4, source_class: generated`. Emit frontmatter; never
overwrite existing frontmatter on a re-run — add missing keys only.

Write via Edit/Write — do NOT output survey content to chat. Report
completion in CoD format:

```text
§1✓ | §2✓ | ... | §12✓ | gaps[N] | contradictions[N] | ambiguities[N]
```

---

## Session Strategy

**Small (1–3 docs, <100 pages):** single session — entity research →
read all → populate → gaps → questions → write.

**Large (4+ docs, 100+ pages):** multi-session.
- Session 1: Entity research + inventory + priority 1–2 docs → §1–§4
- Session 2: Remaining fragments → §5–§8
- Session 3: WEBP + §9–§12 + clarification questions
- Save partial survey at each checkpoint.

---

## Verification Checklist

```text
CHECK 1: Frontmatter present (tier=T4, source_class=generated)
CHECK 2: §1 enriched with external research (if tools available)
CHECK 3: Every document in INDEX.md referenced in §11
CHECK 4: Every functional area has ≥1 requirement with ID
CHECK 5: §12 gaps/contradictions/ambiguities populated (even if "None")
CHECK 6: Architecture references WEBP images (if PDFs exist)
CHECK 7: §9 has explicit compliance assessment (even if "N/A")
CHECK 8: All tables have consistent column structure
CHECK 9: External research sources cited with date and tier
```

---

## Anti-Patterns

```text
✗ Reading entire large fragment files at once → context overflow
✓ Outline first → targeted line ranges

✗ Single converter output → missing content
✓ Cross-reference markitdown + docling

✗ Skipping WEBP for PDFs → missing diagrams
✓ Check figure/diagram references → read relevant images

✗ §1 from documents alone → shallow context
✓ External research first → richer understanding

✗ §12 left empty "nothing is missing" → false confidence
✓ Always catalogue gaps explicitly

✗ Default assumptions = "TBD" → useless
✓ Actionable defaults — lower risk, lower complexity, more common

✗ Survey content in chat → lost work
✓ Write to {Project}_Survey.md → persistent output

✗ Overwriting an existing frontmatter block on a re-run
✓ Additivity rule: ADD missing keys only; preserve existing values
```
