# {{PROJECT_NAME}} — Clarification Questions

**Document Purpose:**
Questions identified during RFP analysis that require client clarification before finalizing the proposal.
Each question includes a default assumption that enables proposal work to proceed.

> **Instructions:**
> Please provide answers in the "Answer" column.
> If our default assumption is acceptable, simply write "Confirmed."
> If any question is not applicable, write "N/A."

---

## Business Questions

| ID  | Question                           | Rationale            | Default Assumption | Answer |
| --- | ---------------------------------- | -------------------- | ------------------ | ------ |
| B1  | **{{question}}** {{RFP_reference}} | {{why_this_matters}} | {{what_we_assume}} |        |
| B2  |                                    |                      |                    |        |
| B3  |                                    |                      |                    |        |

> **Guidance — Business questions typically cover:**
>
> - Commercial model (licensing, subscription, one-time)
> - Ownership and IP (who owns deliverables, code, documentation)
> - Post-delivery support model (who handles L1/L2/L3)
> - Stakeholder roles and decision authority
> - Budget constraints or pre-approved spending limits
> - Contract structure (T&M, fixed-price, milestone-based)
> - Vendor relationships and third-party dependencies

---

## Application Questions

| ID  | Question                           | Rationale            | Default Assumption | Answer |
| --- | ---------------------------------- | -------------------- | ------------------ | ------ |
| A1  | **{{question}}** {{RFP_reference}} | {{why_this_matters}} | {{what_we_assume}} |        |
| A2  |                                    |                      |                    |        |
| A3  |                                    |                      |                    |        |

> **Guidance — Application questions typically cover:**
>
> - Functional scope ambiguities (feature X included or excluded?)
> - User journey edge cases (multi-tenant, multi-role, offline)
> - Data volume and concurrency expectations
> - Integration scope (which systems, which direction, which format)
> - Migration requirements (data migration, cutover strategy)
> - Localization and internationalization
> - Accessibility requirements (WCAG level)
> - Performance expectations (response time, throughput)

---

## Technical Questions

| ID  | Question                           | Rationale            | Default Assumption | Answer |
| --- | ---------------------------------- | -------------------- | ------------------ | ------ |
| T1  | **{{question}}** {{RFP_reference}} | {{why_this_matters}} | {{what_we_assume}} |        |
| T2  |                                    |                      |                    |        |
| T3  |                                    |                      |                    |        |

> **Guidance — Technical questions typically cover:**
>
> - Infrastructure and hosting (cloud, on-premises, hybrid)
> - Existing technology stack and version constraints
> - API availability, documentation, and sandbox environments
> - Authentication and authorization model (SSO, LDAP, OAuth)
> - Database preferences or mandates
> - CI/CD and deployment pipeline expectations
> - Monitoring, logging, and observability requirements
> - Network topology and firewall constraints
> - SDK/library availability and known limitations
> - Development environment provisioning timeline

---

## Compliance Questions (Include Only If Applicable)

| ID  | Question                           | Rationale            | Default Assumption | Answer |
| --- | ---------------------------------- | -------------------- | ------------------ | ------ |
| C1  | **{{question}}** {{RFP_reference}} | {{why_this_matters}} | {{what_we_assume}} |        |
| C2  |                                    |                      |                    |        |

> **Guidance — Compliance questions apply ONLY when the domain requires it:**
>
> - **Pharma/Life Sciences:** GxP, FDA 21 CFR Part 11, EU Annex 11, ALCOA+
> - **Finance:** SOX, PCI-DSS
> - **Healthcare:** HIPAA, HITECH
> - **EU Data:** GDPR, Data Residency
> - **Security:** ISO 27001, SOC 2
> - **Government:** FedRAMP, IL levels
>
> **If no regulatory framework applies → delete this entire section.**

---

## Question Prioritization

| Priority              | Criteria                                                     | Action                                           |
| --------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| **P1 — Blocking**     | Answer changes scope, architecture, or team composition      | Must resolve before proposal finalization        |
| **P2 — Important**    | Answer affects effort estimation or risk assessment          | Should resolve; default assumption is reasonable |
| **P3 — Nice to have** | Answer improves proposal quality but doesn't change approach | Proceed with default; revisit during engagement  |

---

## Writing Effective Questions — Checklist

- [ ] Every question references a specific RFP section or requirement (`§2.1`, `Appendix 1`, etc.)
- [ ] Rationale explains **why** the answer matters (impact on scope, effort, risk, architecture)
- [ ] Default assumption is actionable (not "unknown" or "TBD")
- [ ] Default assumption represents the **safest reasonable interpretation**
- [ ] Questions are de-duplicated (no overlapping questions across categories)
- [ ] Questions are ordered by priority within each category
- [ ] Total questions kept to 15–25 (respect client's time; focus on what matters)

---

_Template version 1.0 — Generic RFP Response Pipeline._
