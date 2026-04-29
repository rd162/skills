# MGPC Requirements Specification
**Source:** Stakeholder meeting transcript — internal reporting tool replacement
**Method:** Requirements Extractor v2.0 (CoK bottom-up saturation + W-functor top-down inference)
**Date:** 2026-04-08

---

## Phase 0 — CoK Saturation Summary

```
L5→{reporting-tool-replacement, concurrent-user-access, report-performance,
     in-app-filtering, scheduled-reports, email-delivery, SAP-integration,
     Salesforce-integration, audit-trail, compliance-logging, budget-cap,
     on-prem-hosting, web-interface, authentication, RBAC,
     ETL-layer, backup-recovery, email-infrastructure, report-templating}

L4→[reporting-platform]+{BI dashboards, batch schedulers, report builders}
   [data-integration]+{connector frameworks, API adapters, CDC}
   [compliance-governance]+{immutable audit logs, RBAC, access control}
   [infrastructure]+{on-prem VM/container, bare-metal servers}
   [user-access]+{SSO, session management, fine-grained permissions}

L3→[web-app + scheduler]+{SPA or SSR UI, cron/job scheduler, PDF/CSV export}
   [ETL middleware]+{SAP BAPI/JDBC connector, Salesforce REST API, connection pooling}
   [audit logging]+{append-only log table, structured logging pipeline}
   [IAM]+{LDAP/AD integration, JWT sessions, role tables}
   [on-prem infra]+{Docker/VM, TLS termination, reverse proxy, monitoring}

L2→[software-engineering]+{security, testing, fault-tolerance, maintainability}
   [data-engineering]+{idempotency, consistency, versioned connectors}
   [infosec]+{tamper-evidence, log retention, encryption at rest and in transit}
   [systems/DevOps]+{capacity planning, server monitoring, patching, HA}

L1→[Technology] ✓  (disjoint: finance-operations, legal-compliance)

Requirements surfaced:
  L4: concurrent session handling (≥15 users), scheduler engine, role-based access
  L3: SAP + Salesforce connectors must be preserved, SMTP email delivery,
      exportable report formats, browser-based UI only
  L2: audit log tamper-evidence, TLS in transit, session authentication,
      on-prem capacity/monitoring, connector fault-tolerance and retry logic

Solution Space:
  {Metabase / Redash on-prem + lightweight ETL adapter,
   Custom web app (Python/Node) + reporting engine (pg, DuckDB),
   JasperReports / BIRT on-prem deployment,
   Apache Superset + Airflow scheduler on-prem,
   Power BI Report Server (on-prem edition)}
```

---

## Phase 1 — MGPC Specification

### M — Mission

Enable the organization to operate, govern, and make decisions with
reliable, timely, and compliant access to its financial data.

*W-functor chain:*
replace reporting tool
→ give finance reliable/fast report access
→ support financial operations and decision-making
→ keep the organization operationally sound and compliant
→ operational soundness is intrinsically necessary for the organization to exist
← **tautology → Mission**

---

### G — Goals

1. Replace the 2009 Access-based reporting tool with a modern, web-based system
   before Q3 deadline.
2. Deliver monthly financial reports in under 2 minutes (down from 45 minutes).
3. Support the full finance team (~15 users) working simultaneously without
   degradation or crashes.
4. Provide in-application report filtering, eliminating manual Excel exports.
5. Enable CFO and authorized users to schedule reports (e.g., every Monday
   morning) with automatic email delivery to a distribution list.
6. Maintain existing SAP and Salesforce data source integrations unchanged.
7. Record a tamper-evident audit log of every report execution (who ran it, when).

---

### P — Premises

| # | Premise | Consequence if false |
|---|---------|----------------------|
| P1 | SAP and Salesforce connectors expose stable APIs/JDBC interfaces that the new system can query | Data pipeline is impossible without renegotiating IT constraints |
| P2 | On-prem hardware can be provisioned within the $50k budget with sufficient CPU/RAM to meet the <2 min report target | Performance goal becomes unachievable without cloud or additional budget |
| P3 | Finance team users have assigned organizational identities (e.g., Active Directory / LDAP) that the system can authenticate against | User audit trail and RBAC cannot be reliably implemented |
| P4 | An SMTP relay is available on-premises for scheduled report email delivery | Automated email delivery goal cannot be met |
| P5 | The compliance audit requirement is for read-only log access by auditors, not a full SOX-grade immutable data store | Audit implementation complexity is dramatically underestimated |
| P6 | "Web-based" is acceptable as the sole access modality (no mobile, no thick client) | Scope must expand; currently out of scope by PM direction |
| P7 | 15 concurrent users represents the realistic peak load for the finance team | Capacity planning is based on this ceiling; burst beyond it is unhandled |

---

### C — Constraints

#### Hard Constraints (violation = rejection)

| # | Constraint | Source |
|---|-----------|--------|
| C1 | Must run entirely on-premises — no cloud hosting of financial data | Legal (stated) |
| C2 | Total cost (infrastructure + development) must not exceed $50,000 | PM/Finance (stated) |
| C3 | SAP and Salesforce integrations must not be changed or replaced | IT policy (stated) |
| C4 | Every report execution must be logged with user identity and timestamp | Compliance (stated) |
| C5 | Must be web-based (browser UI); no mobile scope | PM direction (stated) |
| C6 | System must be delivered and operational before Q3 | CTO mandate (stated) |
| C7 | Must support at least 15 simultaneous users without crashing or blocking | PM (derived from team size + current failure mode) |

#### Soft Constraints (violation = penalty / demotion)

| # | Constraint | Source |
|---|-----------|--------|
| S1 | Monthly report should complete in under 2 minutes | PM performance target (stated as "ideally") |
| S2 | Filtering should be available in-application, not requiring Excel export | Data analyst request (stated as scope item, not hard requirement) |
| S3 | Scheduled reports should support flexible recurrence (e.g., weekly Monday) | CFO request (stated; exact recurrence syntax unspecified) |
| S4 | Audit log should be tamper-evident (append-only, no deletes) | Inferred from compliance context; not explicitly stated |
| S5 | Authentication should leverage existing organizational identity (SSO/LDAP) | Inferred from audit trail + user management minimization; not stated |
| S6 | System should include basic monitoring/alerting for scheduled job failures | Inferred from operational reliability; not stated |

---

### Solution Space

From L4–L3 saturation, the following implementation approaches are viable within
the hard constraints (on-prem, $50k, SAP+Salesforce connectors preserved):

| Approach | Fit | Notes |
|----------|-----|-------|
| **Metabase / Redash on-prem** + ETL adapter layer | High | Low cost, proven SAP/SF connectors, built-in scheduling + email; audit trail requires custom plugin or wrapper |
| **Apache Superset + Airflow** on-prem | High | Strong filtering, Airflow scheduling; higher ops complexity; audit trail plugin needed |
| **JasperReports / BIRT** on-prem | Medium | Mature scheduling/email; dated UI; heavy Java stack; steeper dev cost |
| **Custom web app** (Python/Node + DuckDB/pg) | Medium | Full control over audit trail and RBAC; highest dev time; risky against Q3 budget/deadline |
| **Power BI Report Server** (on-prem edition) | Medium | Strong filtering/scheduling; licensing may consume significant budget share; SAP connector available |

**Recommended first-pass candidate:** Metabase or Superset on-prem,
with a thin ETL adapter preserving SAP/Salesforce read paths,
and a custom audit-log middleware layer to satisfy C4.

---

*Specification produced by requirements-extractor v2.0*
*Methodology: CoK L5→L1 bottom-up saturation + W-functor top-down intent inference*
