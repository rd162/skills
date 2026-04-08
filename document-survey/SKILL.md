---
name: document-survey
version: "1.0"
description: >-
  Reads and cross-references document fragments from dual converters
  (MarkItDown + Docling), analyzes WEBP images via LLM vision,
  researches the subject entity via web tools,
  builds a structured survey/knowledge base with source traceability,
  identifies gaps/contradictions/ambiguities,
  and generates prioritized clarification questions with default assumptions.
  Use when user says 'analyze documents', 'build survey',
  'extract knowledge from fragments', 'generate clarification questions',
  'read the fragments', 'create knowledge base from documents',
  'what do the specs say', 'summarize the RFP',
  or when an __FRAGMENTS__/ directory exists with converted documents
  that need structured analysis.
  Also use after the document-ingestion skill completes
  and the user wants to extract structured knowledge.
metadata:
  author: rd162@hotmail.com
  tags: document-analysis, survey, knowledge-extraction, cross-reference, vision, clarification-questions
---

# Document Survey & Knowledge Extraction

Systematic methodology for extracting structured knowledge
from document fragments produced by dual converters,
enriched with external entity research and LLM vision analysis.
Produces a survey document and optional clarification questions.

## When to Use

- An `__FRAGMENTS__/` directory exists with converted documents
- User wants to extract structured knowledge from source documents
- User needs to understand what a set of documents contains
- Building a knowledge base or survey from technical/business documents
- Identifying gaps, contradictions, or ambiguities across documents
- Generating clarification questions before proceeding with deliverables
- After document-ingestion skill completes and analysis is needed
- Cross-referencing dual converter outputs for maximum content capture

## When NOT to Use

- Documents have not been converted yet (use document-ingestion first)
- User wants to generate a proposal or deliverable (use rfp-proposal-generation)
- Single-document reading with no cross-referencing needed (use read_file directly)
- Pure code analysis or repository exploration (use grep/find_path)

## Termination

| Signal   | Condition                                                                | Action                                         |
| -------- | ------------------------------------------------------------------------ | ---------------------------------------------- |
| COMPLETE | Survey written to file, gaps catalogued, questions generated (if needed) | ✓ STOP — report survey sections + gap count    |
| PARTIAL  | Survey partially populated, session boundary reached                     | ✓ STOP — save progress, report what remains    |
| NO_FRAGS | **FRAGMENTS**/ directory missing or empty                                | Degrade — attempt direct read of **SPECS**/    |
| BLOCKED  | No documents available in any location                                   | Ask user to provide documents or run ingestion |

## Graceful Degradation

This skill adapts to available tooling and context:

- **Full capability** (**FRAGMENTS**/ with dual MD + WEBP + web search tools):
  Complete pipeline — cross-reference converters, vision analysis,
  entity research, structured survey, clarification questions.
- **Partial fragments** (only one converter output per document):
  Proceed with single converter output.
  State: "Single converter only — cross-referencing unavailable."
- **No WEBP images** (markdown only):
  Skip vision analysis steps. Note diagram content may be missing.
- **No web search tools:**
  Skip entity research. Populate survey from document content only.
  State: "No external research tools. Entity context from documents only."
- **No **FRAGMENTS**/, but **SPECS**/ exists:**
  Read source documents directly via read_file.
  Quality is lower — no dual-converter cross-referencing.

---

## Reference Files

This skill bundles two templates in `references/`.
Load them on demand — not upfront:

| File                               | Load When                             | Purpose                               |
| ---------------------------------- | ------------------------------------- | ------------------------------------- |
| `references/survey-template.md`    | Phase 4 — before populating survey    | §1–§12 section structure + tables     |
| `references/questions-template.md` | Phase 6 — before generating questions | Question format + client instructions |

To load: `read_file("{skill-path}/references/{filename}")`
or use the MCP resource fetch mechanism if available.

---

## Phase 1: Inventory Fragments

Before reading any content, build a complete picture
of what the ingestion pipeline produced.

### Step 1.1 — Read the Master Index

```text
∆1: read_file("__FRAGMENTS__/INDEX.md") → document inventory
∆2: For each document, note:
    - Which converters succeeded (markitdown, docling, or both)
    - How many WEBP images exist
    - Document type and likely content category
∆3: Record as inventory table
```

### Step 1.2 — Classify Documents by Priority

Assign reading priority based on content type:

| Priority | Content Type                   | Read Method                           |
| -------- | ------------------------------ | ------------------------------------- |
| 1        | Requirements / scope documents | Full read (both converters)           |
| 2        | Architecture / technical specs | Targeted read + WEBP images           |
| 3        | Spreadsheets / data models     | markitdown preferred (table fidelity) |
| 4        | Presentations / slide decks    | Both converters + images for slides   |
| 5        | Supporting / reference docs    | Targeted read (grep for key terms)    |

---

## Phase 2: Entity Research (If Web Tools Available)

Before diving into fragments, build external context
about the subject entity (company, organization, project sponsor).
This enriches the survey with understanding
of the entity's mission, strategy, and market position.

### Step 2.1 — Get Current Date

```text
Use now(timezone="local") → extract current_year
NEVER hardcode years in search queries.
```

### Step 2.2 — Execute Research (3+ searches minimum)

| Search # | Tool Priority                                 | Purpose                              |
| -------- | --------------------------------------------- | ------------------------------------ |
| 1        | company_research_exa / web_search_exa         | Entity profile, products, strategy   |
| 2        | web_search_exa / firecrawl_search             | Strategic context, industry position |
| 3        | web_search_exa (news query)                   | Recent developments, announcements   |
| 4+       | web_search_exa (site-specific, if multi-site) | Site-specific intelligence           |

### Step 2.3 — Record Findings with Source Attribution

Every external claim must include:
source name, URL (if available), date accessed, source tier.

Source tiers follow the knowledge saturation methodology:

| Tier | Source Type                               | Weight  |
| ---- | ----------------------------------------- | ------- |
| T1   | Official docs, company IR, vendor specs   | Highest |
| T2   | Expert blogs, analyst reports, benchmarks | High    |
| T3   | Community forums, news articles           | Medium  |
| T4   | Opinions, unverified claims               | Low     |

**Degradation:** If no search tools are available,
state "Entity context populated from documents only — no external research."
Proceed with Phase 3.

---

## Phase 3: Read and Cross-Reference Fragments

This is the core extraction phase.
Read every document using the dual-converter cross-referencing technique.

### Step 3.1 — Read Each Document (Priority Order)

For each document, following the priority order from Step 1.2:

```text
∆1: read_file → get outline (large files return outline automatically)
∆2: Read markitdown version first (better for tables and structured data)
    → Use start_line/end_line for targeted section reads
∆3: Read docling version second (better for complex layouts and diagrams)
∆4: Cross-reference: note content captured by one but missed by the other
```

⚠ **Large file strategy (CRITICAL):**
Fragment files can be 2000+ lines.
NEVER read entire large files into context.

```text
Correct: read_file(path) → get outline → read_file(path, start_line=X, end_line=Y)
Wrong:   read_file(path) → attempt to load entire 2000-line file
```

### Step 3.2 — Cross-Reference Technique

When both markitdown and docling outputs exist:

```text
∆1: markitdown → tables, lists, structured sections (primary)
∆2: docling → complex layouts, multi-column, image captions (secondary)
∆3: grep for key terms across both → identify extraction gaps
∆4: Merge: take the best extraction from each converter
```

Content that commonly differs between converters:

- Tables (row/column alignment, merged cells)
- Section headers (nesting depth, numbering)
- Numerical data (OCR accuracy, decimal alignment)
- Footnotes and references
- Multi-column content ordering

### Step 3.3 — Analyze WEBP Images (If Available)

For PDF documents with WEBP images:

```text
∆1: Check markdown for references to "Figure", "Diagram", "Architecture"
∆2: Identify pages likely containing visual content
∆3: read_file("__FRAGMENTS__/{doc}/images/{doc}_p{NNN}-{NNN}.webp")
    → LLM receives WEBP image for vision analysis
∆4: Extract: system components, relationships, data flows, annotations
∆5: Record image reference in survey for traceability
```

Best for:

- Architecture diagrams and component relationships
- Complex tables that markdown converters missed
- Flowcharts and process diagrams
- Scanned annotations or handwritten notes
- Multi-column layouts

---

## Phase 4: Populate Survey Document

Write findings into a structured survey document.
The survey template has 12 sections — populate every one.

**Load `@references/survey-template.md` now** — use it as the structural guide.
Copy the template to `{Project}_Survey.md` and populate in place.

### Survey Structure

```text
§1  Entity & Project Context
    §1.1 About the Entity (enriched with external research)
    §1.2 Target Sites / Environments
    §1.3 Project Context
    §1.4 External Research Findings (with source attribution)

§2  Executive Summary (Document Intent)
    §2.1 What the Entity Wants
    §2.2 Key Design Principles
    §2.3 Deployment Scenarios

§3  Glossary of Terms
    §3.1 Domain Terminology
    §3.2 Acronyms

§4  Use Cases & Business Requirements
    §4.1 Use Case Overview
    §4.2 Use Case Details (actors, triggers, flows, criteria)
    §4.3 Success Criteria

§5  Functional Requirements (grouped by area, with IDs)

§6  Non-Functional Requirements

§7  Technical Architecture & Integration
    §7.1 High-Level Architecture
    §7.2 System Components
    §7.3 Integration Points
    §7.4 Technology Stack
    §7.5 Communication Protocols

§8  Data Model & Interfaces
    §8.1 Key Data Entities
    §8.2 API / Interface Contracts
    §8.3 Data Flow Overview

§9  Compliance & Regulatory Landscape
    §9.1 Applicable Frameworks
    §9.2 Validation Requirements
    §9.3 Compliance Decision Matrix

§10 Implementation Hints & Constraints
    §10.1 Timeline Hints
    §10.2 Team / Resource Hints
    §10.3 RACI Hints
    §10.4 Constraints & Limitations
    §10.5 Risks Identified in Documents

§11 Source Document Reference
    §11.1 Documents Analyzed
    §11.2 Converter Coverage
    §11.3 Key Section Cross-Reference

§12 Open Questions & Gaps
    §12.1 Information Gaps
    §12.2 Contradictions Found
    §12.3 Ambiguities
```

### Extraction Rules

For each extracted item:

- Record the **source document** and section reference
- Distinguish between **explicitly stated** requirements and **inferred** ones
- Merge external research (Phase 2) with document content — flag inferred insights
- Flag **contradictions** between documents
- Flag **ambiguities** with multiple possible interpretations
- Use MoSCoW priority (Must/Should/Could/Won't) where discernible

### §9 Compliance — Always Assess

Always include §9, even if the result is:
"N/A — no regulatory framework applies to this domain."
This explicit assessment prevents oversight.

| Domain             | Likely Frameworks                            |
| ------------------ | -------------------------------------------- |
| Pharma / Labs      | GxP, FDA 21 CFR Part 11, EU Annex 11, ALCOA+ |
| Medical Devices    | FDA QSR, ISO 13485, IEC 62304                |
| Financial Systems  | SOX, PCI-DSS                                 |
| Healthcare Data    | HIPAA, HITECH                                |
| EU Data Processing | GDPR                                         |
| General Software   | Typically N/A — state explicitly             |

---

## Phase 5: Identify Gaps and Open Questions

In §12 of the survey, catalogue everything
that could block or derail downstream work.

### Gap Categories

| Category        | Definition                                              | Example                                          |
| --------------- | ------------------------------------------------------- | ------------------------------------------------ |
| Information Gap | Required information not present in any source document | "No API documentation for System X"              |
| Contradiction   | Two documents state conflicting facts                   | "Doc A says 3-week timeline; Doc B says 6 weeks" |
| Ambiguity       | Statement has multiple valid interpretations            | "'Real-time' could mean seconds or minutes"      |
| External Gap    | RFP content contradicts external research findings      | "RFP claims 500 users; IR report says 5,000"     |

For each entry, provide:

- **ID:** Sequential (GAP-1, CON-1, AMB-1)
- **Source:** Document and section reference
- **Description:** What's missing, conflicting, or ambiguous
- **Impact:** How this affects downstream analysis or deliverables
- **Default Assumption:** What to assume if no clarification arrives
- **Recommended Action:** Ask client, research further, or proceed with assumption

---

## Phase 6: Generate Clarification Questions (If Needed)

If gaps and ambiguities warrant client clarification,
generate a structured questions document.

**Load `@references/questions-template.md` now** — use it as the structural guide.
Copy the template to `{Project}_Clarification_Questions.md` and populate.

### Question Format

Every question MUST include all four columns:

| Column                 | Requirement                                               |
| ---------------------- | --------------------------------------------------------- |
| **ID**                 | Category letter + number (B1, A1, T1, C1)                 |
| **Question**           | Specific, references source section (§N.N or doc name)    |
| **Rationale**          | Why the answer matters (impact on scope/effort/risk/arch) |
| **Default Assumption** | Actionable — NEVER "TBD" or "unknown"                     |

### Question Categories

- **B (Business):** ownership, licensing, support, commercial, contracts
- **A (Application):** functional scope, user journeys, data, integrations
- **T (Technical):** infrastructure, APIs, SDKs, protocols, environments
- **C (Compliance):** regulatory frameworks — ONLY if domain requires it

### Default Assumption Strategy

Choose defaults that are:

1. **Lower risk** — doesn't expand scope
2. **Lower complexity** — simpler technical approach
3. **More common** — industry-standard expectation
4. **Transparent** — states what changes if assumption is wrong

### Question Quality Rules

- Target: **15–25 questions** total (respect reader time)
- Every question references a specific source section
- No duplicate or overlapping questions across categories
- Questions ordered by priority within each category:
  - **P1 (Blocking):** Answer changes scope, architecture, or team
  - **P2 (Important):** Answer affects effort or risk assessment
  - **P3 (Nice to have):** Improves quality, doesn't change approach
- If no compliance questions apply → omit the Compliance section entirely

---

## Output Files

The skill produces these files:

| File                                   | Content                                  | Audience |
| -------------------------------------- | ---------------------------------------- | -------- |
| `{Project}_Survey.md`                  | Structured knowledge extraction (§1–§12) | Internal |
| `{Project}_Clarification_Questions.md` | Prioritized questions with defaults      | External |

Write to files using edit_file — do NOT output survey content to chat.
Report completion status in chat using CoD format:

```text
§1✓ | §2✓ | ... | §12✓ | gaps[N] | contradictions[N] | ambiguities[N]
```

---

## Session Strategy

### Small Document Sets (1–3 documents, <100 pages)

Single-session approach:

```text
∆1: Entity research → populate §1
∆2: Read all fragments sequentially
∆3: Populate survey in one pass
∆4: Review gaps → generate questions
∆5: Write complete documents
```

### Large Document Sets (4+ documents, 100+ pages)

Multi-session approach:

```text
Session 1: Entity research + inventory + read priority 1–2 docs → §1–§4
Session 2: Read remaining fragments → §5–§8
Session 3: WEBP analysis + §9–§12 + clarification questions

Checkpoint: save partial survey → note progress → resume next session
```

---

## Verification Checklist

After survey generation, verify:

```text
CHECK 1: §1 enriched with external research (if tools available)
CHECK 2: Every document in INDEX.md referenced in §11
CHECK 3: Every functional area has at least one requirement with an ID
CHECK 4: §12 gaps/contradictions/ambiguities populated (even if "None found")
CHECK 5: Architecture section references WEBP images (if PDFs exist)
CHECK 6: Compliance section has explicit assessment (even if "N/A")
CHECK 7: All tables have consistent column structure
CHECK 8: External research sources cited with date and tier
```

## Anti-Patterns

```text
✗ Reading entire large fragment files at once → context overflow
✓ Outline first → targeted line ranges

✗ Relying on single converter output → missing content
✓ Cross-reference both markitdown and docling

✗ Skipping WEBP image analysis for PDFs → missing diagrams
✓ Check for figure/diagram references → read relevant images

✗ Populating §1 from documents alone → shallow context
✓ Research entity externally first → richer understanding

✗ Leaving §12 empty because "nothing is missing" → false confidence
✓ Always catalogue gaps, contradictions, ambiguities explicitly

✗ Default assumptions that say "TBD" or "unknown" → useless
✓ Actionable defaults: lower risk, lower complexity, more common

✗ Writing survey content to chat instead of files → lost work
✓ Write to {Project}_Survey.md via edit_file → persistent output
```

## Composition

- **Upstream:** Receives fragments from the **document-ingestion** skill.
- **Downstream:** Feeds the survey into **rfp-proposal-generation**
  or any other deliverable-generation workflow.
- **Composes with:** **deep-research** skill for Phase 2 entity research.
- **Composes with:** **inferring-requirements** skill for deeper §5/§6 analysis.

## Environment Compatibility

- **Full capability:** Fragment directory + vision-capable LLM + web search → best results
- **Partial:** Fragments without WEBP → markdown analysis only, note missing visual content
- **Minimal:** No fragments, direct **SPECS**/ reading → degraded but functional
- **Any AI assistant:** Works with any assistant that supports read_file and edit_file
