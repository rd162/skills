# MGPC Requirements — Internal Reporting Tool Replacement

**Source:** Stakeholder meeting transcript (PM, Dev Lead, Data Analyst)
**Date extracted:** 2026-04-08

---

## Mission

Replace the legacy Access-based internal reporting tool with a reliable, performant web application that enables the finance team to generate, filter, schedule, and audit reports against existing SAP and Salesforce data sources — delivering this by Q3 within approved budget and infrastructure constraints.

---

## Goals

Measurable outcomes the system must achieve:

| # | Goal | Measure |
|---|------|---------|
| G1 | Monthly report execution is fast | Runs complete in under 2 minutes (down from ~45 min) |
| G2 | Finance team can work concurrently | Supports at least 15 simultaneous users without degradation or crash |
| G3 | Users can filter reports in-app | No manual Excel export required for standard filtering operations |
| G4 | Reports can be scheduled and delivered automatically | CFO can schedule recurring reports (e.g., every Monday AM) with automatic email delivery to defined recipients |
| G5 | Every report execution is fully auditable | Compliance log captures report runner identity and timestamp for every run |
| G6 | Replacement is delivered on time | System is live and accepted by Q3 |

---

## Premises

Assumptions the system operates under (treated as fixed inputs, not to be challenged during this phase):

| # | Premise |
|---|---------|
| P1 | SAP and Salesforce are the only data sources; no new integrations will be added |
| P2 | The finance team currently has approximately 15 members — this is the baseline for concurrent user capacity planning |
| P3 | The primary user base is desktop/web; no mobile usage has been requested or anticipated |
| P4 | Stakeholders are web-literate but not technical; the tool must be self-service for scheduling and filtering |
| P5 | The compliance audit requirement was triggered by a prior incident, making it a pre-existing organisational need rather than a new feature ask |
| P6 | Email is the expected delivery mechanism for scheduled reports |

---

## Constraints

Non-negotiable boundaries that cannot be traded off:

| # | Constraint | Source |
|---|------------|--------|
| C1 | Total budget cap: $50,000 (including infrastructure) | PM / Finance |
| C2 | Deployment must be on-premises — no cloud hosting permitted for financial data | Legal |
| C3 | SAP and Salesforce integrations must be preserved exactly as-is — IT will not approve changes | IT policy |
| C4 | No mobile interface in scope | Explicit PM decision |
| C5 | Must go live by Q3 | CTO directive |
