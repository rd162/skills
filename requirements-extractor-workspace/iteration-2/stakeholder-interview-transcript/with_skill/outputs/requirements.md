# Requirements Specification: Internal Reporting Tool Replacement

**Input type:** Stakeholder meeting transcript
**Extracted:** 2026-04-08
**Method:** Requirements Extractor v3.0 (Phase 0 + Phase 1)

---

## Mission

Enable timely, reliable financial reporting so the organization can make sound financial decisions.

W-functor chain: replace reporting tool &rarr; unblock finance team from slow/unreliable legacy system &rarr; enable timely, reliable access to financial reports &rarr; support accurate and efficient financial decision-making &rarr; organizational viability (tautology)

## Goals

1. **Replace the legacy Access database** with a modern web-based reporting system -- delivered by Q3
2. **Support concurrent usage** by the full finance team (minimum 15 simultaneous users) without crashes or degradation
3. **Reduce monthly report generation time** from 45 minutes to under 2 minutes
4. **Provide in-app data filtering** so analysts can slice reports without exporting to Excel
5. **Enable scheduled report runs** with automatic email delivery (e.g., every Monday morning to the team)
6. **Maintain full audit trail** of every report execution -- who ran it, when, and what was generated

## Premises

| # | Premise | Source | Risk if false |
|---|---------|--------|---------------|
| P1 | SAP and Salesforce APIs will remain available and accessible from the new system | Dev lead (stated); PM confirmed integrations locked | **HIGH RISK** -- if APIs change or access is revoked, no data flows into the system at all; reporting is impossible |
| P2 | The finance team (~15 people) represents the full concurrent user base for the foreseeable future | PM (stated) | Capacity planning is wrong; system may need re-architecture for higher concurrency |
| P3 | Existing report logic/definitions from the Access database can be migrated or recreated | Inferred from "replace" language | If legacy report logic is undocumented or opaque, rebuild effort and timeline explode |
| P4 | On-premises infrastructure capable of hosting a web application + database is available or can be provisioned within budget | Inferred from on-prem constraint + budget cap | **HIGH RISK** -- if no suitable hardware exists, the $50K budget may be consumed by infrastructure alone |
| P5 | An internal SMTP relay or mail service is available for scheduled report email delivery | Inferred from CFO's email delivery requirement | Scheduled email feature is blocked; workaround needed |
| P6 | IT will support the new system's integration with SAP/Salesforce (same connectors, no new ones) | PM (stated -- "IT won't allow" changes to integrations) | If IT blocks even maintaining existing integrations in the new system, data access is jeopardized |
| P7 | Users have web browser access from their workstations | Inferred from web-only decision | If finance team uses locked-down terminals without modern browsers, delivery mechanism fails |

**HIGH RISK premises: P1, P4** -- falsification of either would invalidate the Mission itself, not just individual goals.

## Constraints

### Hard (violation = rejection)

| # | Constraint | Source |
|---|-----------|--------|
| C1 | Total budget must not exceed $50,000 including infrastructure | PM (stated -- budget cap from management) |
| C2 | System must run entirely on-premises -- no cloud hosting for financial data | Legal department (stated via PM) |
| C3 | Data sources limited to existing SAP and Salesforce integrations -- no new integrations permitted | IT policy (stated via PM) |
| C4 | Every report run must be logged with user identity and timestamp (audit trail) | Compliance department (stated via PM -- triggered by prior incident) |
| C5 | Delivery by Q3 | CTO directive (stated via PM) |
| C6 | Web-based interface only (no mobile) | PM (stated -- explicit scoping decision) |

### Soft (violation = penalty)

| # | Constraint | Source |
|---|-----------|--------|
| S1 | Monthly report should complete in under 2 minutes | PM (stated -- "ideally" not used, but this is a performance target, not a binary pass/fail) |
| S2 | System should support at least 15 concurrent users | PM (stated -- "at least" signals minimum, but exact concurrency ceiling is unspecified) |
| S3 | Scheduled reports should support email delivery to team distribution lists | CFO (stated via PM -- specific mechanism "email it to the team") |
| S4 | Filtering should be available within the application (no Excel export required) | Data analyst (stated -- unchallenged by other stakeholders) |

## Mission Space

### Evaluated Alternatives

| Approach | Fit against hard constraints | Notes |
|----------|------------------------------|-------|
| **Commercial BI tool (e.g., Metabase, Redash, Apache Superset)** | Good -- all support on-prem, SAP/Salesforce connectors, audit logging, scheduling | Open-source options fit budget; commercial licenses (Tableau Server, Power BI Report Server) may strain $50K cap |
| **Custom-built web application** | Possible but risky -- full-stack build within $50K and Q3 timeline is tight | Higher long-term control but schedule and budget risk; requires ongoing maintenance |
| **Upgraded Access / SharePoint-based solution** | Technically on-prem, but does not solve concurrency or performance problems | Poor fit -- repeats the architectural mistakes of the current system |
| **SSRS (SQL Server Reporting Services)** | Good on-prem fit, native scheduling + email, audit logging | Depends on existing SQL Server licensing; UI is dated but functional |

### Domain Context

- The current system is a single-user Access database from 2009 -- any multi-user web-based solution is a generational leap. Stakeholder expectations may be modest; exceeding them is realistic.
- Compliance's audit trail request was triggered by a specific incident. The requirement may expand over time (e.g., report content versioning, data lineage). Design for extensibility.
- "IT won't allow" new integrations signals a conservative IT governance culture. The new system must integrate via existing approved channels (likely SAP RFC/BAPI and Salesforce REST API with existing credentials).
- Legal's on-prem mandate for financial data may reflect regulatory obligations (SOX, internal policy, or data residency). This is unlikely to change.

### Knowledge Gaps

- **Data migration strategy** -- no one discussed migrating historical reports or data from the Access database. Is historical data needed in the new system?
- **Authentication method** -- audit trail requires user identity, but no one specified how users authenticate (Active Directory/SSO/local accounts). This must be resolved.
- **Report complexity** -- the "monthly report" was mentioned but no details on how many report types exist, how complex the queries are, or what output formats are needed (PDF, Excel, dashboard).
- **User roles and permissions** -- is everyone in finance an equal user, or are there admins, viewers, and editors? This affects RBAC design.
- **Backup and disaster recovery** -- on-prem deployment with financial data and no cloud fallback means DR planning is critical. Not discussed.
- **Browser/OS requirements** -- web-only was specified but not which browsers or versions must be supported.
- **Maintenance and support model** -- who maintains the system after delivery? Internal team or vendor?
- **Notification/alerting beyond scheduled reports** -- does anyone need alerts when reports fail or data is stale?

---

*Extracted using Requirements Extractor v3.0 -- Phase 0 (CoK saturation) + Phase 1 (W-functor intent inference)*
