# FreshRoute — MGPC Requirements Spec

---

## Mission

Connect independent urban restaurants with nearby customers and opportunistic delivery drivers to redistribute surplus food before it is discarded, reducing restaurant food waste while lowering last-mile delivery costs.

---

## Goals

| # | Goal | Success Metric |
|---|------|----------------|
| G1 | Achieve market presence required for Series A | Live and transacting in 3 cities within 6 months of development start |
| G2 | Minimise restaurant onboarding friction | Any restaurant can complete setup and list their first item in under 10 minutes, with zero formal training |
| G3 | Enable driver adoption without workflow disruption | Drivers can accept FreshRoute add-on deliveries from within their existing Uber Eats or DoorDash session, without switching apps |
| G4 | Deliver a viable customer purchase window | Customers can discover and order available surplus items up to 60 minutes before the listing restaurant's closing time |
| G5 | Reduce restaurant food waste | Measurable reduction in end-of-night unsold inventory for participating restaurants (baseline to be defined per city launch) |

---

## Premises

| # | Premise | Implication |
|---|---------|-------------|
| P1 | Target restaurants are small independents in dense urban areas — not chains | No multi-location or franchise management features needed at launch; density assumption supports short delivery radii |
| P2 | Drivers are already active on Uber Eats or DoorDash when they accept FreshRoute jobs | Integration model is add-on / side-channel, not a standalone driver dispatch system |
| P3 | Customers are motivated by discounted last-hour pricing, not scheduled or next-day ordering | The core demand signal is urgency and proximity; the product does not need future-order or subscription flows |
| P4 | The team is 4 people building on React Native (mobile) and Python/FastAPI (backend) | Architecture decisions must prioritise simplicity and lean operational overhead; extensive bespoke infrastructure is not viable |
| P5 | Payment processing complexity can be fully outsourced to Stripe | No internal payment card infrastructure, reconciliation engine, or fraud stack needs to be built from scratch |
| P6 | Food safety regulations differ meaningfully across target cities | Compliance work must be treated as a per-city variable, not a single global ruleset |
| P7 | The company is EU-based | GDPR compliance governs all personal data handling from day one, regardless of which cities are targeted |

---

## Constraints

| # | Constraint | Source | Non-Negotiable Because |
|---|-----------|--------|------------------------|
| C1 | Must not store payment card data on FreshRoute infrastructure | Product decision + PCI DSS risk | Explicitly ruled out; Stripe handles card data and tokenisation |
| C2 | Must comply with GDPR for all personal data collection, processing, storage, and deletion | EU company registration | Legal obligation; violation risk is existential for a funded startup |
| C3 | Must comply with applicable food safety regulations in each launch city | Regulatory environment | Non-compliance blocks operations; regulations vary and must be assessed city by city |
| C4 | Mobile apps must be built in React Native | Existing tech stack decision | Team expertise and time-to-market are already committed to this stack |
| C5 | Backend must be built on Python/FastAPI | Existing tech stack decision | Same as C4 |
| C6 | Must be live in 3 cities within 6 months | Series A fundraising milestone | Investor commitment; missing this window likely forecloses the funding round |
| C7 | Restaurant setup must require no training and complete in under 10 minutes | Target user segment (time-poor independent operators) | Restaurants that require onboarding support will not adopt; the segment has no IT staff |
| C8 | Customer ordering window closes 60 minutes before restaurant closing time | Operational logistics and food safety | Orders placed later than this cannot be reliably prepared, picked up, and delivered before close |
