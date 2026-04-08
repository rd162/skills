# {ProjectName} — RFP Survey & Knowledge Base

**Document Purpose:**
Structured extraction of all RFP requirements, constraints, and context
from source documents (`__FRAGMENTS__/`).
This document serves as the single source of truth for proposal generation.

| Field                | Value         |
| -------------------- | ------------- |
| **Project**          | {ProjectName} |
| **Client**           | {ClientName}  |
| **RFP Date**         | {date}        |
| **Survey Author**    | {author}      |
| **Last Updated**     | {date}        |
| **Source Documents** | See §11       |

---

## Table of Contents

- [1. Client & Project Context](#1-client--project-context)
- [2. Executive Summary (RFP Intent)](#2-executive-summary-rfp-intent)
- [3. Glossary of Terms](#3-glossary-of-terms)
- [4. Use Cases & Business Requirements](#4-use-cases--business-requirements)
- [5. Functional Requirements](#5-functional-requirements)
- [6. Non-Functional Requirements](#6-non-functional-requirements)
- [7. Technical Architecture & Integration](#7-technical-architecture--integration)
- [8. Data Model & Interfaces](#8-data-model--interfaces)
- [9. Compliance & Regulatory Landscape](#9-compliance--regulatory-landscape)
- [10. Implementation Hints & Constraints](#10-implementation-hints--constraints)
- [11. Source Document Reference](#11-source-document-reference)
- [12. Open Questions & Gaps](#12-open-questions--gaps)

---

## 1. Client & Project Context

### 1.1 About the Client

<!-- MANDATORY: Populate using BOTH RFP documents AND external research.
     Use company_research_exa(), brave_web_search(), or web_search_exa()
     to enrich beyond what the RFP states.
     This context drives §1 Executive Summary and §1.2 Business Value in the proposal. -->

| Attribute                | Details                                      | Source         |
| ------------------------ | -------------------------------------------- | -------------- |
| **Company**              | {ClientName}                                 | RFP            |
| **Industry**             | {industry}                                   | RFP + Research |
| **Size / Revenue**       | {size_or_revenue}                            | Research       |
| **Headquarters**         | {hq_location}                                | Research       |
| **Geography**            | {regions_or_sites}                           | RFP + Research |
| **Key Business**         | {core_business_description}                  | RFP + Research |
| **Public/Private**       | {publicly_traded_or_private}                 | Research       |
| **Recent News**          | {relevant_recent_developments}               | Research       |
| **Strategic Priorities** | {stated_corporate_goals_or_digital_strategy} | Research       |
| **Competitive Position** | {market_position_or_competitors}             | Research       |

### 1.2 Target Sites / Environments

<!-- Repeat this block for each site, environment, or deployment target -->

#### {SiteName}

| Attribute                  | Details                     |
| -------------------------- | --------------------------- |
| **Location**               | {location}                  |
| **Function**               | {what_this_site_does}       |
| **Users**                  | {user_types_and_count}      |
| **Infrastructure**         | {existing_infra_notes}      |
| **Special Considerations** | {site_specific_constraints} |

### 1.3 Project Context

| Attribute             | Details                                        |
| --------------------- | ---------------------------------------------- |
| **Project Name**      | {project_name_from_rfp}                        |
| **Engagement Type**   | {pilot / full / phase / PoC / managed service} |
| **Business Driver**   | {why_this_project_exists}                      |
| **Expected Duration** | {from_rfp_if_stated}                           |
| **Budget Indication** | {from_rfp_if_stated, or "Not disclosed"}       |
| **Decision Timeline** | {when_client_decides}                          |
| **Competitive**       | {known_competitors_or_sole_source}             |

### 1.4 Company Research (External)

<!-- This section is populated ENTIRELY from external research tools.
     It provides context that the RFP documents rarely state explicitly
     but that shapes the proposal's executive summary, value proposition,
     and risk assessment.

     TOOLS TO USE (in priority order):
     1. company_research_exa("{ClientName}")  — best for structured company intel
     2. brave_web_search("{ClientName} {industry} strategy {current_year}")
     3. web_search_exa("{ClientName} annual report OR investor day OR digital transformation")
     4. brave_news_search("{ClientName}") — for recent developments

     SEARCH QUERIES (adapt to client):
     - "{ClientName} digital transformation strategy"
     - "{ClientName} IT modernization OR technology investment"
     - "{ClientName} {industry} competitive landscape"
     - "{ClientName} annual report key priorities {current_year}"
     - "{ClientName} {project_domain} initiative OR pilot OR program"
-->

#### Business Mission & Strategy

| Attribute               | Finding                       | Source       |
| ----------------------- | ----------------------------- | ------------ |
| **Corporate Mission**   | {mission_statement_or_vision} | {source_url} |
| **Strategic Pillars**   | {stated_strategic_priorities} | {source_url} |
| **Digital/IT Strategy** | {technology_or_digital_goals} | {source_url} |
| **Sustainability/ESG**  | {relevant_esg_commitments}    | {source_url} |

#### Industry Context

| Attribute                  | Finding                                    | Source       |
| -------------------------- | ------------------------------------------ | ------------ |
| **Industry Trends**        | {trends_affecting_this_rfp_domain}         | {source_url} |
| **Regulatory Environment** | {industry_regulations_that_may_apply}      | {source_url} |
| **Competitive Pressure**   | {what_competitors_are_doing_in_this_space} | {source_url} |
| **Market Position**        | {client_position_relative_to_peers}        | {source_url} |

#### Relevance to This RFP

<!-- Connect research findings to proposal strategy.
     This section directly feeds §1.1 Opportunity Statement
     and §1.2 Business Value Proposition in the proposal. -->

| Research Finding | Proposal Implication                       |
| ---------------- | ------------------------------------------ |
| {finding_1}      | {how_this_shapes_our_proposal_positioning} |
| {finding_2}      | {how_this_shapes_our_proposal_positioning} |
| {finding_3}      | {how_this_shapes_our_proposal_positioning} |

#### Research Sources

| #   | Source        | URL   | Date Accessed | Tier       |
| --- | ------------- | ----- | ------------- | ---------- |
| 1   | {source_name} | {url} | {date}        | {T1/T2/T3} |
| 2   | {source_name} | {url} | {date}        | {T1/T2/T3} |

> **Source Tiers:** T1 = Official (annual reports, press releases, investor decks),
> T2 = Expert (industry analysts, established publications),
> T3 = Community (news aggregators, forums)

---

## 2. Executive Summary (RFP Intent)

### 2.1 What the Client Wants

<!-- 3-5 sentences capturing the core ask from the RFP -->

{summary_of_rfp_objective}

### 2.2 Key Design Principles (from RFP)

<!-- Extract any stated principles, preferences, or constraints the client emphasizes -->

| #   | Principle   | Source Reference     |
| --- | ----------- | -------------------- |
| 1   | {principle} | {document § section} |
| 2   | {principle} | {document § section} |

### 2.3 Deployment Scenarios

<!-- If the RFP describes multiple deployment options or phasing -->

| Scenario     | Description   | Client Preference         |
| ------------ | ------------- | ------------------------- |
| {scenario_1} | {description} | {preferred / alternative} |
| {scenario_2} | {description} | {preferred / alternative} |

---

## 3. Glossary of Terms

### 3.1 Domain Terminology

<!-- Extract ALL domain-specific terms from the RFP documents -->

| Term   | Definition            | Source     |
| ------ | --------------------- | ---------- |
| {term} | {definition_from_rfp} | {document} |

### 3.2 Acronyms

| Acronym   | Expansion   | Context           |
| --------- | ----------- | ----------------- |
| {acronym} | {expansion} | {how_used_in_rfp} |

---

## 4. Use Cases & Business Requirements

### 4.1 Use Case Overview

<!-- One subsection per use case identified in the RFP -->

| UC#  | Name            | Sites/Users     | Priority                |
| ---- | --------------- | --------------- | ----------------------- |
| UC#1 | {use_case_name} | {where_and_who} | {must / should / could} |
| UC#2 | {use_case_name} | {where_and_who} | {must / should / could} |

### 4.2 Use Case Details

<!-- Repeat this block for each use case -->

#### UC#{N}: {Use Case Name}

**Current Situation (Pain Points):**

- {pain_point_1}
- {pain_point_2}

**Target Situation (Benefits):**

- {benefit_1}
- {benefit_2}

**Actors:** {who_interacts}

**Trigger:** {what_starts_the_process}

**Main Flow:**

1. {step_1}
2. {step_2}
3. {step_3}

**Acceptance Criteria (from RFP):**

- {criterion_1}
- {criterion_2}

### 4.3 Success Criteria (Overall)

| #   | Criterion   | Measurement    | Source               |
| --- | ----------- | -------------- | -------------------- |
| 1   | {criterion} | {how_measured} | {document § section} |

---

## 5. Functional Requirements

<!-- Group by functional area / module / capability -->

### 5.1 {Functional Area 1}

| ID           | Requirement        | Priority            | Source          | Notes            |
| ------------ | ------------------ | ------------------- | --------------- | ---------------- |
| FR-{area}-01 | {requirement_text} | {must/should/could} | {doc § section} | {clarifications} |
| FR-{area}-02 | {requirement_text} | {must/should/could} | {doc § section} | {clarifications} |

### 5.2 {Functional Area 2}

| ID           | Requirement        | Priority            | Source          | Notes            |
| ------------ | ------------------ | ------------------- | --------------- | ---------------- |
| FR-{area}-01 | {requirement_text} | {must/should/could} | {doc § section} | {clarifications} |

<!-- Continue for all functional areas -->

### 5.N Requirements Traceability Summary

| Area      | Must    | Should  | Could   | Total   |
| --------- | ------- | ------- | ------- | ------- |
| {area_1}  | {n}     | {n}     | {n}     | {n}     |
| {area_2}  | {n}     | {n}     | {n}     | {n}     |
| **Total** | **{n}** | **{n}** | **{n}** | **{n}** |

---

## 6. Non-Functional Requirements

| ID     | Category        | Requirement   | Target / SLA | Source          |
| ------ | --------------- | ------------- | ------------ | --------------- |
| NFR-01 | Performance     | {requirement} | {target}     | {doc § section} |
| NFR-02 | Availability    | {requirement} | {target}     | {doc § section} |
| NFR-03 | Security        | {requirement} | {target}     | {doc § section} |
| NFR-04 | Scalability     | {requirement} | {target}     | {doc § section} |
| NFR-05 | Usability       | {requirement} | {target}     | {doc § section} |
| NFR-06 | Maintainability | {requirement} | {target}     | {doc § section} |
| NFR-07 | Compliance      | {requirement} | {target}     | {doc § section} |

---

## 7. Technical Architecture & Integration

### 7.1 High-Level Architecture (from RFP)

<!-- Extract or describe the architecture presented in the RFP -->
<!-- Reference WEBP images if architecture diagrams exist -->

**Architecture Diagram Source:**
`__FRAGMENTS__/{doc}/images/{doc}_p{NNN}-{NNN}.webp`

**Description:**

{architecture_description_from_rfp}

### 7.2 System Components

| Component     | Description   | Owner                  | Technology (if stated) |
| ------------- | ------------- | ---------------------- | ---------------------- |
| {component_1} | {description} | {client / vendor / us} | {tech_if_stated}       |
| {component_2} | {description} | {client / vendor / us} | {tech_if_stated}       |

### 7.3 Integration Points

| Integration     | From → To               | Protocol            | Data Format    | Frequency         | Owner      |
| --------------- | ----------------------- | ------------------- | -------------- | ----------------- | ---------- |
| {integration_1} | {system_a} → {system_b} | {REST/MQTT/CSV/etc} | {JSON/XML/CSV} | {real-time/batch} | {who_owns} |

### 7.4 Technology Stack (RFP-Stated or Implied)

| Layer          | Technology | Stated / Inferred | Source          |
| -------------- | ---------- | ----------------- | --------------- |
| Frontend       | {tech}     | {stated/inferred} | {doc § section} |
| Backend        | {tech}     | {stated/inferred} | {doc § section} |
| Database       | {tech}     | {stated/inferred} | {doc § section} |
| Infrastructure | {tech}     | {stated/inferred} | {doc § section} |
| Integration    | {tech}     | {stated/inferred} | {doc § section} |

### 7.5 Communication Protocols

| Protocol   | Purpose            | Endpoints          | Notes         |
| ---------- | ------------------ | ------------------ | ------------- |
| {protocol} | {what_it_connects} | {endpoint_details} | {constraints} |

---

## 8. Data Model & Interfaces

### 8.1 Key Data Entities

| Entity     | Description   | Key Attributes | Source          |
| ---------- | ------------- | -------------- | --------------- |
| {entity_1} | {description} | {key_fields}   | {doc § section} |

### 8.2 API / Interface Contracts

<!-- Extract any API specifications, payload schemas, or interface definitions -->

#### {Interface Name}

| Attribute          | Value                      |
| ------------------ | -------------------------- |
| **Direction**      | {system_a → system_b}      |
| **Protocol**       | {REST / MQTT / SOAP / CSV} |
| **Authentication** | {method_if_stated}         |
| **Payload**        | See below                  |

**Payload Structure (if provided):**

```json
{
  "example_field": "from_rfp_docs"
}
```

### 8.3 Data Flow Overview

<!-- Describe how data moves through the system -->

```text
{Source} → {Processing} → {Storage} → {Consumption}
```

---

## 9. Compliance & Regulatory Landscape

> **⚠ Note:** This section is CONDITIONAL.
> Include ONLY if the RFP domain has regulatory requirements.
> Delete entirely if not applicable.

### 9.1 Applicable Frameworks

| Framework                                              | Applicability                    | Scope            | Source          |
| ------------------------------------------------------ | -------------------------------- | ---------------- | --------------- |
| {e.g., GxP / SOX / HIPAA / PCI-DSS / GDPR / ISO 27001} | {full / partial / informational} | {what_it_covers} | {doc § section} |

### 9.2 Validation Requirements (if applicable)

| Requirement       | Description   | Owner                  | Phase  |
| ----------------- | ------------- | ---------------------- | ------ |
| {validation_item} | {description} | {client / vendor / us} | {when} |

### 9.3 Compliance Decision Matrix

| Scenario     | Compliance Level | Rationale |
| ------------ | ---------------- | --------- |
| {scenario_1} | {level}          | {why}     |

---

## 10. Implementation Hints & Constraints

### 10.1 Timeline Hints (from RFP)

| Hint                | Detail   | Source          |
| ------------------- | -------- | --------------- |
| {stated_duration}   | {detail} | {doc § section} |
| {stated_phases}     | {detail} | {doc § section} |
| {stated_milestones} | {detail} | {doc § section} |

### 10.2 Team / Resource Hints (from RFP)

| Hint                    | Detail   | Source          |
| ----------------------- | -------- | --------------- |
| {client_team_available} | {detail} | {doc § section} |
| {vendor_expectations}   | {detail} | {doc § section} |

### 10.3 RACI Hints (from RFP)

<!-- Extract any stated responsibility assignments -->

| Activity   | Responsible | Accountable | Consulted | Informed | Source          |
| ---------- | ----------- | ----------- | --------- | -------- | --------------- |
| {activity} | {who}       | {who}       | {who}     | {who}    | {doc § section} |

### 10.4 Constraints & Limitations

| ID     | Constraint            | Impact               | Source          |
| ------ | --------------------- | -------------------- | --------------- |
| CON-01 | {constraint_from_rfp} | {impact_on_proposal} | {doc § section} |

### 10.5 Risks Identified in RFP

| ID      | Risk            | Probability | Impact  | Source          |
| ------- | --------------- | ----------- | ------- | --------------- |
| RFP-R01 | {risk_from_rfp} | {H/M/L}     | {H/M/L} | {doc § section} |

---

## 11. Source Document Reference

### 11.1 Documents Analyzed

| #   | Document        | Type                 | Pages | Fragment Location         |
| --- | --------------- | -------------------- | ----- | ------------------------- |
| 1   | {document_name} | {PDF/DOCX/XLSX/PPTX} | {n}   | `__FRAGMENTS__/{folder}/` |

### 11.2 Converter Coverage

| Document | markitdown | docling | WEBP Images | Notes           |
| -------- | ---------- | ------- | ----------- | --------------- |
| {doc_1}  | ✓ / ✗      | ✓ / ✗   | {n} images  | {quality_notes} |

### 11.3 Key Section Cross-Reference

<!-- Map important RFP sections to fragment locations -->

| RFP Topic | Document   | Section         | Fragment Reference              |
| --------- | ---------- | --------------- | ------------------------------- |
| {topic}   | {document} | {section_title} | `__FRAGMENTS__/{path}` L{lines} |

---

## 12. Open Questions & Gaps

### 12.1 Information Gaps

<!-- Issues discovered during survey extraction that need resolution -->

| ID     | Gap               | Impact on Proposal        | Recommended Action               |
| ------ | ----------------- | ------------------------- | -------------------------------- |
| GAP-01 | {what_is_missing} | {how_it_affects_proposal} | {ask_client / assume / research} |

### 12.2 Contradictions Found

<!-- Conflicting information between documents or sections -->

| ID     | Contradiction | Source A          | Source B          | Recommended Resolution    |
| ------ | ------------- | ----------------- | ----------------- | ------------------------- |
| CTR-01 | {description} | {doc_a § section} | {doc_b § section} | {which_to_follow_and_why} |

### 12.3 Ambiguities

<!-- Requirements that can be interpreted multiple ways -->

| ID     | Ambiguity     | Interpretation A   | Interpretation B   | Default Assumption     |
| ------ | ------------- | ------------------ | ------------------ | ---------------------- |
| AMB-01 | {description} | {interpretation_a} | {interpretation_b} | {which_we_will_assume} |

---

_This survey feeds directly into Stage 3 (Clarification Questions) and Stage 4 (Proposal Generation)._
_Gaps, contradictions, and ambiguities from §12 become clarification questions._
