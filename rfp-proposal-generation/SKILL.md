---
name: rfp-proposal-generation
version: "1.0"
description: >-
  Generates professional RFP/RFI proposal documents from a survey knowledge base,
  auto-detecting composition profile (A/B/C/D) from source documents,
  following business→application→technical document flow with specific writing order.
  Includes system context decomposition, team composition with man-day arithmetic,
  WBS generation, timeline/Gantt charts, mandatory feasibility assessment
  (5-area Go/No-Go), requirements coverage analysis (C/PC/NC+A codes),
  competitive positioning, professional writing guidelines,
  and 15-check consistency verification.
  Use when user says 'generate proposal', 'write RFP response',
  'create proposal from survey', 'write the proposal',
  'start S4', 'proposal generation', 'build the proposal document',
  or when a completed survey document exists
  and the user needs to produce a professional proposal.
  Also use for proposal editing, consistency verification,
  or when the user asks to 'verify the proposal',
  'check consistency', or 'run the 15 checks'.
metadata:
  author: PE_Library
  tags: rfp, proposal, feasibility, requirements-coverage, wbs, gantt, team-composition, consistency
---

# RFP Proposal Generation

Generate professional RFP/RFI response documents from a structured survey,
with mandatory feasibility assessment and requirements coverage analysis.
Auto-detects how much to generate vs. challenge
based on what the source documents already contain.

## When to Use

- A completed survey document (`{Project}_Survey.md`) exists
- User needs to produce a professional proposal from analyzed requirements
- User wants to generate, edit, or verify an RFP/RFI response
- Clarification questions have been sent and answers received (or defaults accepted)
- User asks to run consistency verification on an existing proposal
- User needs to write feasibility assessment or requirements coverage appendices

## When NOT to Use

- Documents have not been analyzed yet (use document-survey skill first)
- User only needs to convert raw documents (use document-ingestion skill)
- The deliverable is not a proposal (report, presentation, summary)
- User needs a simple document without team/WBS/timeline structure

## Termination

| Signal   | Condition                                                          | Action                                            |
| -------- | ------------------------------------------------------------------ | ------------------------------------------------- |
| COMPLETE | Proposal passes all 15 consistency checks                          | ✓ STOP — report verification results              |
| PARTIAL  | Proposal partially written, session boundary reached               | ✓ STOP — save progress, report sections remaining |
| VERIFIED | Consistency verification run on existing proposal, all checks pass | ✓ STOP — report check results                     |
| NO_SURV  | No survey document available                                       | Degrade — guide user to run document-survey first |
| BLOCKED  | Critical information missing, no defaults possible                 | HITL — present inferences for user confirmation   |

## Graceful Degradation

- **Full inputs** (Survey + Answers + Fragments):
  Complete pipeline — profile detection, full proposal, appendices, verification.
- **Survey only** (no clarification answers):
  Use default assumptions from all questions.
  All defaults become §3.1 Assumptions.
  Add risk: "Clarification questions unanswered."
- **Partial survey:**
  Generate what's possible, mark incomplete sections, note gaps.
- **No survey, but fragments exist:**
  Invoke document-survey skill first, then proceed.
  State: "Survey required before proposal generation."
- **Editing existing proposal:**
  Read proposal + companion .llms.md → apply targeted edits.

---

## Reference Files

This skill bundles two templates in `references/`.
Load them on demand — not upfront:

| File                               | Load When                                | Purpose                                        |
| ---------------------------------- | ---------------------------------------- | ---------------------------------------------- |
| `references/proposal-template.md`  | STEP 1 — before writing first section    | §1–§8 + Appendix structure, CSS, Mermaid style |
| `references/presentation-guide.md` | STEP 9 — before writing Mermaid diagrams | Color palette, PDF export, page break strategy |

To load: `read_file("{skill-path}/references/{filename}")`
or use the MCP resource fetch mechanism if available.

Copy the proposal template to `{Project}_Proposal.md` at STEP 1
and populate sections in writing order (not document order).

---

## STEP 0: Composition Profile Detection (ALWAYS FIRST)

Before writing a single word, determine what source documents
already contain and what must be generated or challenged.

### Part A — Inventory Source Elements

Read the Survey and **FRAGMENTS**/INDEX.md.
For each element, classify as PRESENT / PARTIAL / ABSENT:

```text
Business requirements / functional specs   → ?
Non-functional requirements                → ?
Proposed architecture (components, stack)  → ?
Work Breakdown Structure / phases          → ?
Team composition / roles / staffing        → ?
Timeline / Gantt / schedule                → ?
Cost estimate / investment summary         → ?
Assumptions / constraints / risks          → ?
Integration requirements                   → ?
Regulatory / compliance requirements       → ?
```

### Part B — Derive Composition Profile

Compute a profile score from the inventory:

| Element Present   | Score |
| ----------------- | ----- |
| Architecture      | +1    |
| WBS               | +2    |
| Team              | +2    |
| Timeline          | +2    |
| Cost / investment | +1    |

| Score | Profile                    | Pipeline Action                                       |
| ----- | -------------------------- | ----------------------------------------------------- |
| 0–1   | **A — Pure Requirements**  | GENERATE everything from scratch                      |
| 2–3   | **B — Architecture-Led**   | GENERATE delivery; CHALLENGE architecture             |
| 4–5   | **C — Partial Plan**       | GENERATE missing; CHALLENGE present elements          |
| 6–8   | **D — Near-Complete Plan** | CHALLENGE everything; reassemble into proposal format |

### Part C — Per-Element Instructions

For every proposal element, assign one instruction:

| Instruction   | When               | Action                                                   |
| ------------- | ------------------ | -------------------------------------------------------- |
| **GENERATE**  | Element is ABSENT  | Create from scratch using the survey                     |
| **COMPLETE**  | Element is PARTIAL | Expand; challenge assumptions; make actionable           |
| **CHALLENGE** | Element is PRESENT | Adopt as basis; assess critically; flag infeasible items |

### Part D — Require-Challenge Rule

For EVERY constraint encountered (timeline, team size, technology, budget):

```text
Realistic?  → YES: accept and plan to it
            → PROBABLY: note enablers that must hold
            → NO: flag explicitly; propose realistic alternative
                  (in Appendix D or §3.3 — NOT vague hedging in body)
```

Never silently accept an infeasible constraint.

---

## STEP 0b: System Context Decomposition

This drives §5 Team, §6 WBS, and §7 Timeline.

1. **Identify all bounded system contexts**
   (Frontend, BFF/Integration, Backend, Mobile, Infrastructure, Compliance, etc.)

2. **Assign one owner per context** (R/A in RACI)

3. **Map supplemental roles** (C = consulting, R-only = responsible)

4. **Identify parallel vs sequential contexts**

5. **Record as context map:**

```text
Context 1: {name} → Owner: {role} (R/A) | Support: {roles} (C/R)
Context 2: {name} → Owner: {role} (R/A) | Support: {roles} (C/R)
Parallel groups: [C1 + C2] can run in parallel
Sequential deps:  C3 depends on C1 completion
```

This decomposition determines:

- Team composition (§5): one owner per context
- WBS structure (§6): deliverables grouped by context
- Timeline parallelism (§7): parallel contexts = parallel Gantt bars
- Scope clarity (§2): each context maps to scope items

---

## Proposal Document Structure (Canonical)

Business → Application → Technical flow.
A reader can stop at any section
and have coherent understanding of everything above.

```text
§1  Executive Summary           ← Business dimension (WHY)
    1.1 Opportunity Statement
    1.2 Business Value Proposition
    1.3 Solution Overview (+ simplified architecture diagram)
    1.4 Feasibility Verdict     ← one-liner from Appendix D verdict box
    1.5 Investment Summary

§2  Scope Definition            ← Business/Application boundary (WHAT)
    2.1 In-Scope (delivery responsibilities)
    2.2 Out-of-Scope (each item names its owner)
    2.3 Scope Boundaries
    2.4 Regulatory Considerations (CONDITIONAL — only if domain requires)

§3  Assumptions, Constraints & Risks  ← Constraints (GUARDRAILS)
    3.1 Assumptions (ID, assumption, owner, impact-if-false)
    3.2 Constraints (ID, constraint, enforcement)
    3.3 Risks & Mitigations (risk, probability, impact, mitigation)
    3.4 Critical Dependencies (dependency, source, required-by, impact)

§4  Use Cases & Functional Specifications  ← Application dimension (FEATURES)
    4.1 Use Case Overview (MANDATORY for all project types)
    4.2 Use Case Details (actors, triggers, flows, acceptance criteria)
    4.3 Functional Requirements by Area (domain-specific)
    4.4 Non-Functional Requirements Summary
    4.5 Data Requirements
    4.6 Configuration / Customization

§5  Team Composition            ← Delivery dimension (WHO)
    5.1 Team Structure (role, total-MD, engagement-period, responsibilities)
    5.2 Team Rationale (decision, justification)
    5.3 Client Resource Requirements
    5.4 External Dependencies / Vendor Coordination

§6  Work Breakdown Structure    ← Delivery dimension (HOW MUCH)
    6.1–N Phase deliverables (deliverable, MD, owner, activities)
    6.N+1 WBS Summary (phase, duration, total-MD, milestone)

§7  Timeline & Gantt Chart      ← Delivery dimension (WHEN)
    7.1 Project Timeline (Mermaid Gantt)
    7.2 Team Allocation Timeline
    7.3 Detailed Week-by-Week table
    7.4 Development Strategy
    7.5 Timeline Enablers / Accelerators

§8  Next Steps                  ← Action items (NOW WHAT)
    8.1 Recommended Actions (step, action, owner, timeline)
    8.2 Key Contacts Required

Appendix A: Technical Architecture  ← Technical dimension (HOW)
Appendix B: Technology Stack        ← Technical dimension (WITH WHAT)
Appendix C: Glossary                ← Reference
Appendix D: Feasibility Assessment  ← MANDATORY (Go/No-Go, plain language)
Appendix E: Requirements Coverage   ← MANDATORY (C/PC/NC+A, plain language)
Appendix F: AI-Assisted Development ← ALWAYS INCLUDE
```

---

## Writing Order (NOT Document Order)

Follow this exact sequence. Do NOT write in document order.

| Step | Section                     | Why This Order                                |
| ---- | --------------------------- | --------------------------------------------- |
| 0    | Context decomposition       | Drives everything                             |
| 1    | §2 Scope Definition         | Clarity before anything else                  |
| 2    | §5 Team Composition         | Driven by context decomposition               |
| 3    | §6 WBS                      | Arithmetic MUST balance with §5               |
| 4    | §7 Timeline & Gantt         | Capacity MUST fit                             |
| 5    | §3 Assumptions, Constraints | Informed by scope + team + timeline decisions |
| 6    | §4 Use Cases & Specs        | Application detail after delivery is planned  |
| 7    | §1 Executive Summary        | Write LAST — summarize what exists            |
| 8    | §8 Next Steps               | Action items after full picture is clear      |
| 9    | Appendices A–F              | Technical detail + mandatory assessments      |
| 10   | Consistency Verification    | MANDATORY before delivery                     |

---

## Team Composition Rules

### Role Categories

| Category        | Roles                                           | Allocation                      |
| --------------- | ----------------------------------------------- | ------------------------------- |
| **Advisory**    | Engagement Manager, Architect, BA (if needed)   | Fractional (~10–20%) throughout |
| **Development** | TL, BE/FE/Desktop/Mobile/AI devs, QA, UI Design | 100% from their start week      |

### Development Roles — Full-Time Only

Dev roles CANNOT be partial allocation. Must be 100% from their start week.
To reduce cost, adjust **start and end week** — not allocation percentage.

```text
CORRECT: TL 100% Weeks 1–6 (30 MD) | Dev 100% Weeks 1–5 (25 MD)
WRONG:   TL 80% Weeks 1–6 | Dev 50% Weeks 1–6
```

### Team Sizing from Context Decomposition

Each bounded system context maps to one dev role owner.
Two contexts requiring different specialist skills → two roles.
Two contexts requiring the same skill → one role owns both.

### MD Arithmetic Rule

All MD values must be WHOLE NUMBERS.
Sum of all role MDs = project total MD.
Record this number — it must match §6 WBS total and §1.5 Investment Summary.

---

## WBS Arithmetic (CRITICAL)

After writing §6, verify before proceeding:

```text
§1.5 Total MD = §5.1 Σ(role.MD) = §6.N Σ(phase.MD)

∀ phase ∈ §6:  Σ(deliverable.MD) = phase.stated_total
∀ role ∈ §5.1: Σ(owned_deliverable.MD) ≈ role.total_MD
```

If mismatch → adjust deliverable MDs until balanced.
Do NOT proceed to §7 Timeline until this check passes.
Source of truth hierarchy: WBS deliverables → Phase totals → Team total → Investment.

---

## Feasibility Assessment (Appendix D — MANDATORY)

Five areas evaluated in every proposal:

| Area                   | Core Question                                                         | Verdict                         |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------- |
| **Technology**         | Can the proposed technology be built with available tools and skills? | GO / GO with conditions / NO-GO |
| **Schedule**           | Can the scope be delivered within the stated timeline?                | GO / GO with conditions / NO-GO |
| **Legal & Compliance** | Does the project comply with applicable laws and standards?           | GO / GO with conditions / NO-GO |
| **Operations**         | Can the CLIENT's organisation absorb and maintain the system?         | GO / GO with conditions / NO-GO |
| **Economics**          | Is the investment justified by expected outcomes?                     | GO / GO with conditions / NO-GO |

### Appendix D Structure (Plain Business Language)

```text
D.1 Overview (one paragraph)
D.2 Technology & Architecture (2–4 sentences + prerequisites + verdict)
D.3 Schedule (grounded in WBS effort numbers, not intuition)
D.4 Legal & Compliance (frameworks + verdict)
D.5 Operations & Handover (client capacity assessment)
D.6 Economics & Value (outcomes + verdict)
D.7 Feasibility Verdict (summary box: all five areas + overall + prerequisites)
```

NO-GO on any area → stop; flag what must change; do NOT write Appendix E.
"GO with conditions" is normal — list each prerequisite explicitly.
The overall verdict one-liner is copied into **§1.4** of the proposal body.

### Language Rule

The proposal uses **plain business language only**.
Academic framework names, paper citations, and formal methodology names
are FORBIDDEN in the proposal body and appendices.

```text
FORBIDDEN: "TELOS framework", "Compliance Matrix", "Misfit taxonomy",
           author citations, academic set-theory notation
PERMITTED: Plain section headings (D.2 Technology & Architecture),
           C/PC/NC+A codes (standard procurement notation)
```

Academic sources inform pipeline reasoning internally
but must never appear in generated documents.

---

## Requirements Coverage (Appendix E — MANDATORY)

Maps every stated requirement to the proposed delivery approach.

### Coverage Codes

| Code     | Label in Document    | Definition                                                      |
| -------- | -------------------- | --------------------------------------------------------------- |
| **C**    | Met                  | Requirement delivered exactly as stated                         |
| **PC**   | Partially Met        | Requirement substantially delivered; deviation documented       |
| **NC+A** | Alternative Proposed | Literal delivery is not the right approach; better one proposed |

### Appendix E Structure

```text
E.1 How to Read This Appendix (codes explained plainly)
E.2 Architecture
E.3 Functional Requirements (grouped by domain/module)
E.4 Non-Functional Requirements
E.5 Integration Requirements
E.6 Regulatory & Compliance Requirements (if applicable)
E.7 Standard Software Requirements (if applicable)
E.8 Deviations & Alternative Approaches
    Per deviation: requirement (verbatim), reason, code, our approach, impact
E.9 Coverage Summary Table
    | Area | Met (C) | Partial (PC) | Alternative (NC+A) | Total |
```

Every NC+A in E.9 MUST have a deviation entry in E.8 with effort + timeline impact.
Deviation entries use **confident business language**:

```text
WRONG:   "We cannot do X because the technology is too complex."
CORRECT: "The proposed approach delivers the same outcome
          with better maintainability. Impact: within existing allocation."
```

---

## Competitive Positioning Rules

A proposal is a professional confidence document.
Every sentence must demonstrate capability without making promises.

### Signal Expertise, Not Learning

```text
WRONG:  "Week 1: Validate SDK behavior and discover runtime model"
CORRECT: "Week 1: Establish integration baseline in client environment"
```

Week 1 validates the CLIENT's environment, not the team's capability.

### Frame Risks as Environmental

```text
WRONG:  "SDK documentation gaps may block development"
CORRECT: "Client environment access delays" / "Defensive parsing built in"
```

### No Fallback Timelines in Proposals

Fallback timelines signal lack of expertise.
Fallbacks belong in Survey and .llms.md only.

### No Vendor Comparisons

Never mention competitors or "other vendors."
Present value as factual position, not contrast.

### Facts Over Promises

```text
WRONG:  "We understand the complexity..."
CORRECT: "The team composition reflects the integration complexity..."
```

### Technology Weaknesses — Internal Only

Research findings go in Survey and .llms.md.
Proposal reflects confidence and readiness.

| Content Type              | Proposal | Survey     | .llms.md   |
| ------------------------- | -------- | ---------- | ---------- |
| Vendor comparisons        | ✗ Never  | ✓ OK       | ✓ OK       |
| Technology challenges     | ✗ Never  | ✓ Fully    | ✓ Required |
| Customer financials       | ✗ Never  | ✓ Required | ✓ OK       |
| Fallback timelines        | ✗ Never  | ✓ As risk  | ✓ OK       |
| "We" promises             | ✗ Avoid  | ✓ OK       | ✓ OK       |
| Research source citations | ✗ Never  | ✓ Required | ✓ OK       |

---

## Companion .llms.md File

Every proposal gets: `{Project}_Proposal.llms.md`

This file holds everything that must NOT appear in the exported PDF:

- Document identity (client, project, total MD, version)
- Content rules specific to this proposal
- Arithmetic invariants and cross-check tables
- Per-phase role allocation breakdown matrices
- Inferences from unanswered clarification questions
- Technology research evidence mapped to risk IDs
- Diagram color scheme reference
- Post-edit verification protocol

The proposal itself contains ZERO HTML comments, ZERO hidden content.

---

## Presentation Rules

### Diagrams — Mermaid Only

ZERO ASCII art in final proposals.
Use Mermaid with ArchiMate-inspired colors:

| Layer            | Fill      | Stroke    | Use For                     |
| ---------------- | --------- | --------- | --------------------------- |
| Users / Business | `#FFFFB5` | `#D4A017` | End users, business actors  |
| Our Scope        | `#B5D8FF` | `#2171B5` | Our deliverables            |
| External         | `#C9E7B7` | `#41AB5D` | Client systems, third-party |
| Auth / Security  | `#F3E5F5` | `#9C27B0` | Authentication              |
| Data / Storage   | `#FFF3E0` | `#EF6C00` | Databases, data stores      |
| Infrastructure   | `#D4EDDA` | `#28A745` | Deployment, containers      |

### Content Placement

§1–§8 (main body) is read by managers, sponsors, and procurement.
Engineering detail goes to Appendices only.

FORBIDDEN in main body:
REST/GraphQL endpoints, JSON/XML schemas, code snippets,
database schemas, CI/CD details, algorithm pseudocode.

### Regulatory Section (Conditional)

Include §2.4 ONLY when domain requires it:

- Pharma/Labs → GxP, FDA, EU Annex 11
- Finance → SOX, PCI-DSS
- Healthcare → HIPAA
- EU Data → GDPR
- General Software → OMIT §2.4 entirely

---

## Gen AI Appendix (Always Include)

Every proposal includes an AI-assisted development appendix
with two variants:

| Variant              | Description                           | Primary Benefit               |
| -------------------- | ------------------------------------- | ----------------------------- |
| **A: AI Ramp-Up**    | AI in early phases, then conventional | Increases delivery confidence |
| **B: AI Throughout** | AI across all phases                  | Reduces cost or timeline      |

### Timeline Impact Rules

| Duration   | Impact                                |
| ---------- | ------------------------------------- |
| ≤ 8 weeks  | NO reduction (physically constrained) |
| 8–12 weeks | 1–2 week reduction possible           |
| 12+ weeks  | 20–25% reduction feasible             |

Default pricing: ~$100/day per developer for heavy AI-assisted coding.

---

## Consistency Verification (15 Checks — MANDATORY)

Run ALL checks before delivery. No proposal ships without passing.

```text
CHECK  1: §1.5 Total MD = §5.1 Σ(role.MD) = §6.N Σ(phase.MD)
CHECK  2: Each phase total = Σ(its deliverable MDs)
CHECK  3: Every §2.1 in-scope item appears in at least one §6 deliverable
CHECK  4: Every §6 "Owner" exists as a role in §5.1
CHECK  5: No role overallocated in any week (§7.2 capacity check)
CHECK  6: Every §3.4 critical dependency has a mitigation in §3.3
CHECK  7: All acronyms defined in Appendix C
CHECK  8: §2.4 exists ONLY if domain requires it
CHECK  9: §2.2 out-of-scope items do NOT appear in §6 WBS
CHECK 10: Version table at document top reflects current state
CHECK 11: Appendix D exists with §D.7 verdict box; all five areas assessed
CHECK 12: Appendix E exists with §E.9 Coverage Summary table
CHECK 13: Feasibility verdict one-liner appears in §1.4
CHECK 14: Every NC+A in §E.9 has deviation entry in §E.8 with impact
CHECK 15: No academic framework names or citations in proposal body
```

### Report Format

```text
Checks: 1✓ 2✓ 3✓ 4✓ 5✓ 6✓ 7✓ 8✓ 9✓ 10✓ 11✓ 12✓ 13✓ 14✓ 15✓
If any ✗ → fix → re-verify → report again.
```

### Fix Protocol

1. **Arithmetic mismatches** → Fix upstream to downstream
   (WBS deliverables → Phase totals → Team total → Investment)
2. **Missing scope coverage** → Add WBS deliverable or note in existing
3. **Role name inconsistencies** → Standardize to §5.1 names
4. **Missing glossary entries** → Add to Appendix C
5. **Overallocation** → Redistribute or adjust effort
6. **Out-of-scope leakage** → Remove from WBS or move to in-scope

---

## Missing Answers — HITL Protocol

When clarification answers are missing:

### Partially Answered

1. Infer most reasonable answer (industry standard, lower risk, simpler approach)
2. Record inference as Assumption in §3.1 (with source question ID)
3. Flag in proposal: "Based on default assumption from Q#{ID}"

### Completely Unanswered

Present inferences to user for confirmation BEFORE writing proposal:

```text
HITL CONFIRMATION REQUEST:
══════════════════════════
| Q# | Inference | Reasoning | Confirm? |
|----|-----------|-----------|----------|
| T1 | [inference] | [why] | ✓ / correct to: ___ |
```

Wait for user confirmation. Do NOT generate full proposal on unchecked inferences.

---

## §4 Adaptation by Project Type

Use cases (§4.1–4.2) are MANDATORY regardless of type.
Functional requirements subsections adapt to domain:

| Project Type           | §4.3 Focus                                      |
| ---------------------- | ----------------------------------------------- |
| Web Applications       | Screens, navigation, RBAC, form validation      |
| IoT / Engineering      | Sensor flows, edge processing, telemetry        |
| Enterprise Integration | Interface contracts, mapping rules, retry logic |
| Mobile Applications    | Platform capabilities, offline sync, push       |
| Data Platforms         | Dashboards, KPIs, ETL/ELT, data quality         |
| Managed Services       | SLA definitions, monitoring, DR procedures      |
| Low-Code / Dashboards  | Widget types, filters, real-time updates        |
| Proof of Concept       | Minimum viable feature set, success metrics     |

---

## Multi-Session Handling

Proposals often span multiple sessions.
Output documents serve as checkpoints.

### Session Boundary Protocol

```text
SESSION CHECKPOINT
══════════════════
Stage: S4 ({step_name})
Done: {sections completed}
Next: {what to resume}
Resume: read {Project}_Proposal.md + {Project}_Proposal.llms.md → continue
```

### Typical Session Breakdown

| Session | Steps     | Deliverables                                             |
| ------- | --------- | -------------------------------------------------------- |
| 1       | STEP 0–4  | Context decomposition + scope + team + WBS + timeline    |
| 2       | STEP 5–10 | Risks + specs + exec summary + appendices + verification |

For small RFPs (short survey, ≤ 3 documents): often fits in one session.

---

## Output Files

| File                         | Shared with Client? | Content                              |
| ---------------------------- | ------------------- | ------------------------------------ |
| `{Project}_Proposal.md`      | ✓ Yes (PDF export)  | Complete proposal document           |
| `{Project}_Proposal.llms.md` | ✗ Never             | LLM companion (arithmetic, research) |

Write to files using edit_file — do NOT output proposal content to chat.
Report section progress in chat using CoD format:

```text
§2✓ | §5✓ | §6✓ arithmetic✓ | §7∆ | §3 pending | ...
```

---

## Anti-Patterns

```text
✗ Writing sections in document order (§1 first) → §1 depends on everything
✓ Writing in STEP order: §2→§5→§6→§7→§3→§4→§1→§8→Appendices

✗ Partial allocation for dev roles (Dev 50% Weeks 1–6)
✓ Full-time for shorter period (Dev 100% Weeks 1–3)

✗ Accepting infeasible timeline silently
✓ Challenge every constraint; flag in Appendix D if unrealistic

✗ Academic terms in proposal body ("TELOS", "Misfit taxonomy")
✓ Plain business language only; academic terms in Survey/.llms.md

✗ ASCII art diagrams in proposals
✓ Mermaid only with ArchiMate-inspired color scheme

✗ Technology research findings in proposal ("SDK has poor docs")
✓ Confident language ("Version-specific code paths handle compatibility")

✗ Fallback timelines ("8-week fallback if...")
✓ Primary timeline committed; prerequisites confirmed before start

✗ MD arithmetic mismatch between §1.5, §5.1, §6.N
✓ All three numbers identical — verified before delivery

✗ Writing content to chat instead of proposal file
✓ Write to {Project}_Proposal.md; chat for status only
```

## Composition

- **Upstream:** Receives survey from **document-survey** skill.
- **Composes with:** **deep-research** for Phase B technology verification.
- **Composes with:** **think-deeper** for 2–3 high-stakes decisions
  (team shape, architecture pattern, timeline strategy).
- **Composes with:** **continuation-and-handoff** at session boundaries.
- **Internal:** Feasibility assessment uses Ssegawa & Muzinda (2021) framework.
  Requirements coverage uses Lahlou et al. (2022) fit-gap methodology.
  Deviation classification uses Soh, Kien & Tay-Yap (2000) taxonomy.
  These are pipeline-internal — never exposed in generated documents.

## Environment Compatibility

- **Full capability:** File ops + web search + vision → best results
- **Partial:** File ops only → proposal generation works, skip tech verification
- **Mermaid rendering:** Requires Typora, VS Code preview, or compatible renderer
- **PDF export:** Typora recommended (A4, Calibri/Segoe UI, 11pt body)
- **Any AI assistant:** Works with Claude Code, Cursor, Copilot, Codex, Zed, Aider

## References (Pipeline-Internal Only)

- Ssegawa & Muzinda (2021).
  Feasibility Assessment Framework (FAF).
  Procedia Computer Science 181:377–385.
  Informs the 5-area Go/No-Go structure.
- Lahlou et al. (2022).
  Fit-Gap Analysis: Pre-Fit-Gap Recommendations.
  IJACSA Vol. 13 No. 7.
  Informs requirements coverage methodology.
- Soh, Kien & Tay-Yap (2000).
  Enterprise resource planning: cultural fits and misfits.
  ACM CACM 43(4):47–51.
  Informs deviation classification.
