# Proposal Presentation Guide — Diagrams, PDF Export & Content Placement

> **Scope:** This guide governs the visual presentation of the **final proposal document** only.
> Internal documents (Survey, Questions, architecture notes) are exempt.

---

## Content Placement Rules

### Main Body (§1–§8): Business-Readable

The proposal body is read by managers, sponsors, and procurement.
It must be free of implementation detail.

**ALLOWED in main body:**

- Business outcomes and value propositions
- Scope tables (what's in / out)
- Team structure and effort tables (role, MD, period)
- WBS deliverable tables (name, MD, owner, activities)
- Gantt timelines (Mermaid — schedule bars, not code)
- High-level solution overview diagrams (Mermaid — simplified)
- Risk/assumption/constraint tables
- Core technology names ONLY when they are the proposal's central enabler
  (e.g., "Node-RED Dashboard 2.0", "AWS Step Functions", "Azure IoT Hub")

**FORBIDDEN in main body — move to Appendices:**

| Content Type                                     | Where It Goes                                  |
| ------------------------------------------------ | ---------------------------------------------- |
| REST / GraphQL API endpoints                     | Appendix A: Technical Architecture             |
| JSON / XML payload examples                      | Appendix A or dedicated Appendix D: Data Model |
| Code snippets (any language)                     | Appendix A or Appendix B                       |
| Database schemas / SQL                           | Appendix A: Data Model section                 |
| Detailed component architecture diagrams         | Appendix A                                     |
| Protocol details (MQTT topics, WebSocket frames) | Appendix A                                     |
| Configuration parameters                         | Appendix B: Technology Stack                   |
| SDK / library version tables                     | Appendix B: Technology Stack                   |
| CI/CD pipeline details                           | Appendix A: Deployment Architecture            |
| Infrastructure specs (CPU, RAM, disk)            | Appendix A: Deployment Architecture            |
| Algorithm pseudocode                             | Appendix A or dedicated appendix               |
| Integration sequence diagrams (detailed)         | Appendix A                                     |

**Rule of thumb:** If a reader needs engineering knowledge to understand it,
it belongs in an appendix.

### Technology Mentions — When Allowed in Body

Technology names may appear in the main body ONLY when:

1. **Core enabler:** The technology IS the proposal
   (e.g., "Node-RED Dashboard 2.0 frontend", "AWS Lambda serverless backend")
2. **Scope boundary:** Clarifies what's in/out
   (e.g., "Client provides the middleware layer", "{Vendor} SDK handles authentication")
3. **Investment driver:** Explains why the effort estimate is what it is
   (e.g., "Low-code platform reduces development effort by 40%")

Technology names MUST NOT appear when:

- Listing internal libraries or dependencies
- Describing implementation architecture
- Specifying versions, configurations, or parameters

### Appendix Structure for Technical Content

```text
Appendix A: Technical Architecture
   A.1 System Context Diagram (detailed Mermaid — all components)
   A.2 Component / Internal Architecture
   A.3 Integration Flow (sequence diagrams, data flows)
   A.4 Deployment Architecture (infrastructure, containers)
   A.5 API Contracts (endpoints, payloads, auth)

Appendix B: Technology Stack
   B.1 Core Technologies (table: tech, version, purpose, license)
   B.2 Dependencies & Libraries
   B.3 Infrastructure Requirements

Appendix C: Glossary

Appendix D+: Additional as needed
   Data Model / Schema
   Compliance Framework Details
   Cost Optimization Options
```

---

## Diagram Rules

### ⚠ No ASCII Art in Final Proposals

**FORBIDDEN in proposal documents:**

```text
❌  ┌────────┐     ┌────────┐
    │  Auth  │ ──→ │  API   │
    └────────┘     └────────┘

❌  +----------+    +----------+
    | Frontend | -> | Backend  |
    +----------+    +----------+
```

**ASCII art is acceptable ONLY in:**

- Internal survey documents (`{Project}_Survey.md`)
- Internal architecture notes
- Chat / thinking traces
- AGENTS.md configuration files

**Final proposal → Mermaid diagrams ONLY.**

### Mermaid Diagram Standards

All diagrams in the proposal must be:

1. **Mermaid syntax** — renders as SVG (clean, scalable, colorful)
2. **Colored** — using the ArchiMate-inspired palette (see below)
3. **Shaped** — rounded nodes, clear boundaries, readable labels
4. **Sized for PDF** — fit within one A4/Letter page when exported
5. **Labeled** — include legends for abbreviations

### ArchiMate-Inspired Color Palette for Mermaid

The ArchiMate standard defines layer-based coloring.
Adapted for Mermaid `style` directives:

| Layer / Concept                | Fill Color              | Stroke Color | Text Color | Mermaid Style                                                  |
| ------------------------------ | ----------------------- | ------------ | ---------- | -------------------------------------------------------------- |
| **Users / Business Actors**    | `#FFFFB5` (yellow)      | `#D4A017`    | `#000`     | `style Users fill:#FFFFB5,stroke:#D4A017,stroke-width:2px`     |
| **Our Scope / Application**    | `#B5D8FF` (blue)        | `#2171B5`    | `#000`     | `style OurScope fill:#B5D8FF,stroke:#2171B5,stroke-width:2px`  |
| **External / Technology**      | `#C9E7B7` (green)       | `#41AB5D`    | `#000`     | `style External fill:#C9E7B7,stroke:#41AB5D,stroke-width:2px`  |
| **Motivation / Strategy**      | `#E0D4F5` (purple)      | `#7B52AB`    | `#000`     | `style Strategy fill:#E0D4F5,stroke:#7B52AB,stroke-width:2px`  |
| **Implementation / Migration** | `#FFD4E5` (pink)        | `#D63384`    | `#000`     | `style Migration fill:#FFD4E5,stroke:#D63384,stroke-width:2px` |
| **Infrastructure / Physical**  | `#D4EDDA` (light green) | `#28A745`    | `#000`     | `style Infra fill:#D4EDDA,stroke:#28A745,stroke-width:2px`     |
| **Auth / Security**            | `#F3E5F5` (lavender)    | `#9C27B0`    | `#000`     | `style Auth fill:#F3E5F5,stroke:#9C27B0,stroke-width:2px`      |
| **Data / Storage**             | `#FFF3E0` (peach)       | `#EF6C00`    | `#000`     | `style Data fill:#FFF3E0,stroke:#EF6C00,stroke-width:2px`      |
| **Alerts / Critical**          | `#FFEBEE` (red tint)    | `#C62828`    | `#000`     | `style Alerts fill:#FFEBEE,stroke:#C62828,stroke-width:2px`    |

**Mapping to proposal scope boundaries:**

| Scope Boundary                   | Use This Layer Color          |
| -------------------------------- | ----------------------------- |
| End users, business stakeholders | Users / Business (yellow)     |
| Our deliverables                 | Application (blue)            |
| Client systems, third-party      | External / Technology (green) |
| Authentication / security        | Auth / Security (lavender)    |
| Databases, storage               | Data / Storage (peach)        |
| Infrastructure, deployment       | Infrastructure (light green)  |

### Subgraph Title Styling

Use HTML bold tags for subgraph titles (supported in Mermaid 10.1+):

```text
subgraph Users["<b>Users</b>"]
subgraph OurScope["<b>Our Deliverables</b>"]
subgraph ClientScope["<b>Client Systems</b>"]
```

Avoid emoji in subgraph titles for PDF reliability.
If emoji are used in node labels, test PDF rendering first —
some PDF exporters do not render emoji correctly.

### Mermaid Diagram Template — System Context

```text
flowchart LR
    subgraph Users["<b>End Users</b>"]
        U1(["User Type 1"])
        U2(["User Type 2"])
    end

    subgraph OurScope["<b>Our Scope</b>"]
        direction TB
        C1["Component 1"]
        C2["Component 2"]
        C3["Component 3"]
    end

    subgraph External["<b>Client / Third-Party</b>"]
        direction TB
        E1["External System 1"]
        E2["External System 2"]
    end

    U1 --> C1
    U2 --> C1
    C1 --> C2
    C2 --> C3
    C3 -->|Protocol| E1
    E1 --> E2

    style Users fill:#FFFFB5,stroke:#D4A017,stroke-width:2px
    style OurScope fill:#B5D8FF,stroke:#2171B5,stroke-width:2px
    style External fill:#C9E7B7,stroke:#41AB5D,stroke-width:2px
    style U1 fill:#FFF8DC,stroke:#D4A017,color:#000
    style U2 fill:#FFF8DC,stroke:#D4A017,color:#000
    style C1 fill:#6BAED6,stroke:#2171B5,color:#fff
    style C2 fill:#4292C6,stroke:#2171B5,color:#fff
    style C3 fill:#2171B5,stroke:#08519C,color:#fff
    style E1 fill:#A1D99B,stroke:#41AB5D,color:#000
    style E2 fill:#74C476,stroke:#238B45,color:#000
```

### Mermaid Diagram Template — Gantt Timeline

```text
gantt
    title Project Timeline (N Weeks)
    dateFormat YYYY-MM-DD
    excludes weekends

    section PHASE 1 - Name (N MD)
    D1.1 Deliverable (N MD)   :a1, 2026-01-05, 5d
    D1.2 Deliverable (N MD)   :a2, 2026-01-05, 3d
    PHASE 1 COMPLETE          :milestone, m1, 2026-01-09, 0d

    section PHASE 2 - Name (N MD)
    D2.1 Deliverable (N MD)   :b1, 2026-01-12, 10d
    D2.2 Deliverable (N MD)   :b2, 2026-01-12, 8d
    PHASE 2 COMPLETE          :milestone, m2, 2026-01-23, 0d
```

Gantt rules:

- Bars represent **schedule duration** (calendar days), NOT effort (MD)
- Effort shown in labels: `D1.1 Deliverable Name (5 MD)`
- Use `excludes weekends` for realistic scheduling
- Use `:milestone, mN, date, 0d` for phase gates
- Use `:crit, id, date, duration` for critical path items
- Use `:active, id, date, duration` for currently active items

### Node Shape Guide

| Shape     | Mermaid Syntax | Best For                         |
| --------- | -------------- | -------------------------------- |
| Rectangle | `A["Label"]`   | Components, services, modules    |
| Rounded   | `A(["Label"])` | Users, actors, external entities |
| Cylinder  | `A[("Label")]` | Databases, storage               |
| Stadium   | `A(["Label"])` | Start/end points, triggers       |
| Diamond   | `A{"Label"}`   | Decision points                  |
| Hexagon   | `A{{"Label"}}` | Preparation, setup steps         |

### Diagram Sizing for PDF

**Target:** Each diagram fits within one printed page.

- **Max nodes per diagram:** 12–15 (beyond this, split into sub-diagrams)
- **Max subgroups:** 3–4 per diagram
- **Label length:** Keep node labels under 25 characters (use `<br/>` for line breaks)
- **Direction:** Use `LR` (left-right) for overview diagrams, `TB` (top-bottom) for hierarchies
- **Connection labels:** Short (1–3 words): `-->|REST API|`, `-->|MQTT|`

If a diagram is too complex for one page:

1. Put a **simplified overview** in §1.3 (main body)
2. Put the **detailed version** in Appendix A

---

## PDF Export Settings (Typora)

### Recommended Theme

Use a **light, professional theme** for PDF export.
Recommended: `github`, `newsprint`, or a custom theme.

### Page Setup

| Setting        | Recommended Value                                |
| -------------- | ------------------------------------------------ |
| **Paper Size** | A4 (210 × 297 mm)                                |
| **Margins**    | Top: 20mm, Bottom: 25mm, Left: 20mm, Right: 20mm |
| **Header**     | Document title (left) — Page number (right)      |
| **Footer**     | "Confidential" or company name                   |

### Font Recommendations

| Element                    | Font Family                            | Size | Weight  |
| -------------------------- | -------------------------------------- | ---- | ------- |
| **Body text**              | Calibri, Segoe UI, or Helvetica Neue   | 11pt | Regular |
| **H1 (§ titles)**          | Same family                            | 18pt | Bold    |
| **H2 (subsections)**       | Same family                            | 14pt | Bold    |
| **H3**                     | Same family                            | 12pt | Bold    |
| **Tables**                 | Same family                            | 10pt | Regular |
| **Code (appendices only)** | JetBrains Mono, Fira Code, or Consolas | 9pt  | Regular |

### Page Break Strategy

Proposals have deep heading hierarchies (H1 → H2 → H3 → H4).
Breaking only on H1/H2 is rarely enough — sections like §5.1, §5.2, §6.1, §6.2
are all H3 and can span 2–3 pages each without a break.

#### Break Levels

| Level           | Example                       | Break Behavior              | Rationale                                                 |
| --------------- | ----------------------------- | --------------------------- | --------------------------------------------------------- |
| **H1** (`#`)    | `# Appendix A: Architecture`  | **Always break**            | Chapter-level separation                                  |
| **H2** (`##`)   | `## 5. Team Composition`      | **Always break**            | Major section separation                                  |
| **H3** (`###`)  | `### 5.1 Team Structure`      | **Always break**            | Subsections are substantial — each has tables/diagrams    |
| **H4** (`####`) | `#### UC#1: Sample Reception` | **Selective** — manual only | Some H4 are short (2–3 lines), breaking would waste pages |

#### Manual Page Break (for H4 or anywhere)

Insert before any heading or content that should start a fresh page:

```html
<div style="page-break-before: always;"></div>

#### UC#1: Sample Reception
```

Use this for:

- Long H4 sections (use cases, individual deliverable details)
- Before large tables that need a full page
- Before Mermaid diagrams that are wide or tall
- Between appendix subsections (A.1, A.2, etc.)

Do NOT use for:

- Short H4 sections (2–5 lines) — let them flow naturally
- Bullet lists under an H3 — they belong with their heading

#### Automatic Page Breaks (CSS)

```css
@media print {
  /* H1: always break — chapter level (Appendices, major parts) */
  h1 {
    page-break-before: always;
    break-before: page;
  }

  /* H2: always break — major sections (§1 Executive Summary, §2 Scope, etc.) */
  h2 {
    page-break-before: always;
    break-before: page;
  }

  /* H3: always break — subsections (§5.1 Team Structure, §6.1 Phase 1, etc.)
     This is the key difference from H1/H2-only breaking.
     Most proposal subsections have tables, diagrams, or 15+ lines —
     they deserve their own page start. */
  h3 {
    page-break-before: always;
    break-before: page;
  }

  /* H4: NO automatic break — too granular.
     Use manual <div style="page-break-before: always;"></div> when needed. */

  /* First h1 should not force a break (it's the document title) */
  h1:first-of-type {
    page-break-before: avoid;
    break-before: avoid;
  }

  /* Prevent ANY heading from being orphaned at page bottom */
  h1,
  h2,
  h3,
  h4 {
    page-break-after: avoid;
    break-after: avoid;
  }

  /* Keep tables together on one page */
  table {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* Keep Mermaid diagrams together */
  .md-diagram-panel,
  .md-fences[lang="mermaid"] {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* Keep blockquotes together (often used for Notes and Warnings) */
  blockquote {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* Prevent widows and orphans */
  p {
    orphans: 3;
    widows: 3;
  }

  /* Keep list items with their heading */
  ul,
  ol {
    page-break-before: avoid;
    break-before: avoid;
  }
}
```

#### When H3 Breaks Create Too Many Pages

If a section has many short H3 subsections (e.g., §4.3 with 5 component descriptions
of 3 lines each), the automatic H3 break wastes pages.

**Fix:** Demote those short items to H4 (no auto-break) or merge them into one H3 section.

```text
Structure that wastes pages:
  ### 4.3.1 Component A    ← 3 lines, then page break
  ### 4.3.2 Component B    ← 3 lines, then page break
  ### 4.3.3 Component C    ← 3 lines, then page break

Better structure:
  ### 4.3 Component Descriptions    ← one H3 break
  #### Component A                  ← H4, no auto-break
  #### Component B
  #### Component C
```

**Rule of thumb:**

- H3 for sections with tables, diagrams, or 10+ lines → auto-break is good
- H4 for short subsections under an H3 → no auto-break, manual if needed

#### Where to Add the CSS in Typora

**Option 1 — Theme-level (applies to all documents):**

1. Open Typora → Preferences → Appearance → Open Theme Folder
2. Create or edit `{theme-name}.user.css` (e.g., `github.user.css`)
3. Paste the `@media print { ... }` block above
4. Restart Typora

**Option 2 — Document-level (applies to this document only):**

The proposal template already embeds a `<style>` block at the top.
This overrides the theme for that specific document.
Edit the `<style>` block in the proposal `.md` file directly.

**Option 3 — Export-level (applies during PDF export only):**

Typora Preferences → Export → PDF → "Append Extra Content":
paste the `@media print { ... }` block.

### Typora Export Workflow

```text
1. Open {Project}_Proposal.md in Typora
2. Verify: Preferences → Export → PDF → Paper Size = A4
3. Verify: Mermaid diagrams render correctly in preview
4. File → Export → PDF
5. Review PDF:
   - [ ] Each §(H1/H2/H3) starts on a new page
   - [ ] Short H4 sections flow naturally (no wasted half-pages)
   - [ ] Long H4 sections have manual page breaks where needed
   - [ ] All Mermaid diagrams fit within their page (no overflow)
   - [ ] Tables are not split across pages
   - [ ] No orphaned headings at page bottom
   - [ ] Blockquotes (Notes, Warnings) stay together
   - [ ] Page numbers are sequential
   - [ ] Fonts are consistent throughout
   - [ ] No raw Mermaid source code visible (rendering worked)
6. If too many blank half-pages → demote short H3s to H4
7. If diagram overflows → simplify or split (overview in body, detail in appendix)
```

### Table of Contents

Typora supports `[TOC]` for auto-generated table of contents.
Place `[TOC]` after the document title and version table.

In PDF export, `[TOC]` renders as a clickable, formatted table of contents.
Ensure it appears on its own page (add page break after).

---

## Section-to-Page Mapping

Target: each section occupies complete pages with no awkward breaks.

| Section                  | Expected Pages | Break Level                 | Notes                                            |
| ------------------------ | -------------- | --------------------------- | ------------------------------------------------ |
| Title + Version + TOC    | 1–2            | H1                          | TOC on its own page                              |
| §1 Executive Summary     | 2–3            | H2 + H3 per subsection      | §1.3 diagram gets its own page                   |
| §2 Scope Definition      | 2–3            | H2 + H3 per subsection      | Each scope table (in/out/boundaries) on own page |
| §3 Assumptions & Risks   | 2–4            | H2 + H3 per subsection      | Each table (assumptions/risks/deps) on own page  |
| §4 Use Cases & Specs     | 3–6            | H2 + H3 per area, H4 per UC | Manual break before long use cases               |
| §5 Team Composition      | 2–3            | H2 + H3 per subsection      | Team table + rationale + client reqs             |
| §6 WBS                   | 3–5            | H2 + H3 per phase           | One page per phase + summary page                |
| §7 Timeline & Gantt      | 3–4            | H2 + H3 per subsection      | Gantt diagram needs full page width              |
| §8 Next Steps            | 1              | H2                          | Short — one page                                 |
| Appendix A: Architecture | 4–6            | H1 + H3 per diagram         | Each diagram on its own page                     |
| Appendix B: Tech Stack   | 1              | H1                          | Single table page                                |
| Appendix C: Glossary     | 1              | H1                          | Single table page                                |

**Total target:** 15–30 pages depending on project complexity.

### Gantt Diagram Page Fitting

Gantt charts are the widest diagrams. For PDF fitting:

- Use `LR` direction (default for Gantt — horizontal timeline)
- Limit to 3–4 sections (phases)
- Keep task labels short: `D1.1 Name (N MD)` — not full descriptions
- If >20 tasks, split into two Gantts: overview (phases) + detail (per phase)
- Test in Typora preview at 100% zoom before export

### Mermaid Diagram Page Fitting

For flowcharts and system context diagrams:

- Prefer `LR` (landscape feel) for system overviews
- Prefer `TB` for hierarchies and decompositions
- If a diagram exceeds ~60% of page width in preview, simplify:
  - Reduce node count (combine related items)
  - Shorten labels (use abbreviations + glossary)
  - Split into overview + detail diagrams

---

## Proposal Checklist — Presentation Quality

Before PDF export, verify:

```text
CONTENT PLACEMENT:
- [ ] No API endpoints, JSON, or code in §1–§8
- [ ] No detailed architecture diagrams in §1–§8 (only simplified overview in §1.3)
- [ ] Technology names in body only for core enablers
- [ ] All technical detail is in Appendices A/B

DIAGRAMS:
- [ ] Zero ASCII art diagrams in proposal
- [ ] All diagrams are Mermaid syntax
- [ ] Diagrams use ArchiMate-inspired color palette
- [ ] Subgraph titles are bold (<b> tags)
- [ ] Node shapes match their type (cylinder for DB, rounded for actors, etc.)
- [ ] Each diagram fits one PDF page
- [ ] Legends/abbreviation explanations included

PDF QUALITY:
- [ ] Each major section (§1–§8, each Appendix) starts on a new page
- [ ] Tables not split across pages
- [ ] No orphaned headings at page bottom
- [ ] Mermaid diagrams render as SVG (not raw source)
- [ ] Fonts consistent throughout (11pt body, 10pt tables)
- [ ] Page numbers present
- [ ] TOC is generated and accurate
- [ ] Total page count is reasonable (15–30 pages)
```

---

## Quick Reference — Mermaid Style Copy-Paste

### Scope Boundary Colors (most common)

```text
%% Users / Business layer (ArchiMate yellow)
style Users fill:#FFFFB5,stroke:#D4A017,stroke-width:2px

%% Our scope / Application layer (ArchiMate blue)
style OurScope fill:#B5D8FF,stroke:#2171B5,stroke-width:2px

%% External / Technology layer (ArchiMate green)
style External fill:#C9E7B7,stroke:#41AB5D,stroke-width:2px

%% Auth / Security (lavender)
style Auth fill:#F3E5F5,stroke:#9C27B0,stroke-width:2px

%% Data / Storage (peach)
style Data fill:#FFF3E0,stroke:#EF6C00,stroke-width:2px
```

### Node Colors Within Scope Boundaries

```text
%% Blue gradient for our components (light → dark = layer depth)
style C1 fill:#9ECAE1,stroke:#2171B5,color:#000
style C2 fill:#6BAED6,stroke:#2171B5,color:#000
style C3 fill:#4292C6,stroke:#08519C,color:#fff
style C4 fill:#2171B5,stroke:#08519C,color:#fff

%% Green gradient for external systems
style E1 fill:#A1D99B,stroke:#41AB5D,color:#000
style E2 fill:#74C476,stroke:#238B45,color:#000

%% Yellow for user nodes
style U1 fill:#FFF8DC,stroke:#D4A017,color:#000

%% Peach for databases
style DB fill:#FFE0B2,stroke:#EF6C00,color:#000
```

### Gantt Section Styling

Mermaid Gantt does not support per-bar colors via `style`,
but you can use these built-in markers:

```text
:done, id, date, duration     %% Completed (greyed out)
:active, id, date, duration   %% In progress (highlighted)
:crit, id, date, duration     %% Critical path (red)
:milestone, id, date, 0d      %% Milestone marker (diamond)
```

---

_Presentation guide v1.0 — ArchiMate-inspired palette, Typora PDF export, Mermaid standards._
_For final proposal documents only. Internal documents are exempt._
