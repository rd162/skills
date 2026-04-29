# FreshRoute MGPC Requirements Specification

Extracted via: requirements-extractor v2.0 (Phase 0 CoK + Phase 1 Intent Inference)
Input: FreshRoute product brief
Date: 2026-04-08

---

## Phase 0: Chain of Knowledge Saturation

### L5 — Topics

**Explicit topics (stated in brief):**
- Surplus ingredient and prepared-dish listing
- Discount pricing on near-close inventory
- Driver add-on delivery model (opt-in, alongside Uber Eats / DoorDash runs)
- Last-hour feed (60-minute order window before restaurant close)
- Restaurant close-time enforcement
- Stripe payment integration (no card data stored by FreshRoute)
- React Native mobile apps
- Python / FastAPI backend
- GDPR compliance (EU-based company)
- Food safety regulation variance by city
- 3-city launch in 6 months (Series A milestone)
- 4-person engineering team
- Independent restaurants only, dense urban areas
- Sub-10-minute restaurant onboarding (no training)

**Implied topics (expansion via requires / enables):**
- Real-time inventory availability and countdown
- Restaurant close-time data ingestion and enforcement
- Geofencing / proximity filtering (match customers and drivers to nearby listings)
- Driver route awareness (to know which drivers are already near a restaurant)
- Push notifications (availability alerts, order status)
- Restaurant app role vs. driver app role vs. consumer app role (multi-role UX)
- Order fulfillment coordination (pickup window, handoff protocol)
- Allergen and food labeling information (implied by food safety)
- Perishability window enforcement (items expire when restaurant closes)
- Refund and dispute handling (no-show driver, quality issues)
- Trust and reputation signals (restaurant rating, driver reliability)
- Driver opt-in mechanism (without requiring app switch from Uber Eats / DoorDash)
- Multi-city operations and city-specific regulatory configuration
- Small-team deployment velocity (CI/CD, infrastructure choices)
- Data minimization and consent flows (GDPR)

### L4 — Areas + Patterns

| Area | Grouped Topics | Patterns Surfaced |
|---|---|---|
| Time-bound marketplace | Listing, pricing, 60-min window, close-time, expiry enforcement | Flash-sale feed, perishable inventory auction |
| Last-mile add-on logistics | Driver opt-in, route overlay, pickup/handoff coordination | Parasitic delivery (piggyback on existing routes), gig add-on model |
| Restaurant operations tooling | Onboarding, inventory input, close-time management, labeling | Zero-training self-serve kiosk pattern |
| Payments and regulatory compliance | Stripe, GDPR, PCI, food safety by jurisdiction | Tokenized payments, jurisdiction-scoped rule engine |
| Consumer discovery | Geo-filtered last-hour feed, browsing, order placement | Proximity feed, countdown urgency UX |
| Trust and reliability | Driver reputation, restaurant rating, dispute handling | Lightweight reputation graph |

**L4 Requirements surfaced:**
- Real-time listing expiry tied to restaurant close time (hard clock dependency)
- Geo-proximity filtering for both consumer feed and driver matching
- Regulatory rule engine that is city-configurable (not hardcoded)
- Allergen/labeling data capture at listing creation

### L3 — Fields + Mechanisms

| Area | Field | Mechanisms |
|---|---|---|
| Time-bound marketplace | Mobile + REST API | WebSocket or SSE for live feed updates; server-side expiry enforcer |
| Last-mile logistics | Mobile (driver-side) + push | Deep-link or in-app opt-in; geolocation polling; push notification dispatch |
| Restaurant tooling | Mobile (React Native) | Minimal-step onboarding wizard; close-time picker; photo upload for listings |
| Payments | Stripe API (Elements / Payment Intents) | Stripe-hosted card fields; webhook-driven order confirmation; no PAN storage |
| Consumer discovery | Mobile (React Native) | Geo-filtered feed sorted by proximity + time remaining; countdown timers |
| Multi-city ops | FastAPI + config layer | Per-city configuration records (food safety rules, launch flags, timezone) |

**L3 Requirements surfaced:**
- Live feed requires push or streaming mechanism — polling alone insufficient at scale
- Driver opt-in must not require leaving current delivery app (deep link / notification acceptable)
- Stripe Payment Intents with webhooks for async confirmation (prevents double-charge)
- Per-city config table in backend (regulatory flags, time-zone handling for close-time)
- React Native with shared codebase across consumer, driver, and restaurant roles (team size constraint)

### L2 — Disciplines + Cross-Cutting Concerns

| Discipline | Mandate / Concern |
|---|---|
| Software engineering | Security (auth, API hardening); automated testing (4-person team cannot afford regressions); CI/CD pipeline for rapid 3-city rollout; observability (errors and order failures are time-critical) |
| Regulatory / legal | GDPR: data minimization, explicit consent, right to erasure, processor agreements with Stripe; PCI DSS: no card data on FreshRoute servers; Food safety: per-city labeling, temperature handling disclosure, prepared food handling rules |
| Operations / reliability | Close-time window is a hard real-time constraint — expired listings must not be purchasable; driver add-on model creates a dependency on external app availability (Uber Eats / DoorDash uptime is not FreshRoute-controlled) |
| Product velocity | 4-person team + 6-month deadline → technology choices must minimize operational overhead; managed infrastructure preferred; avoid building what Stripe / notification services already provide |

**L2 Mandates:**
- GDPR consent and erasure flows are non-negotiable (EU-based company)
- PCI DSS compliance is non-negotiable (Stripe tokenization, no card storage)
- Food safety labeling data must be captured and surfaced per-city
- Close-time enforcement must be server-side (client clock is untrusted)
- Observability / alerting is mandatory given the real-time order window

### L1 — Domains

| Discipline | Domain | Disjoint From |
|---|---|---|
| Software engineering | Technology | Veterinary science, fine arts |
| Regulatory / legal | Law & compliance | Engineering (separate concern layer) |
| Last-mile logistics | Logistics & operations | — |
| Food service / sustainability | Food industry | — |

Domains are non-overlapping; no single domain dominates. The platform sits at the intersection of Technology, Logistics, and Regulatory compliance.

### Saturation Summary

```
L5 → {surplus listing, discount pricing, driver add-on, last-hour feed, close-time window,
       Stripe, React Native, FastAPI, GDPR, food safety, 3-city/6-month launch, 4-person team,
       geofencing, real-time expiry, push notifications, allergen labeling, multi-role UX,
       dispute handling, driver opt-in, GDPR consent/erasure, per-city config}

L4 → [time-bound marketplace]+{flash-sale feed, perishable auction}
     [last-mile add-on]+{parasitic delivery, gig add-on}
     [restaurant tooling]+{zero-training self-serve}
     [payments/compliance]+{tokenized payments, jurisdiction rule engine}
     [consumer discovery]+{proximity feed, countdown urgency}
     [trust/reliability]+{reputation graph}

L3 → [mobile+REST API]+{WebSocket/SSE, server-side expiry}
     [driver mobile+push]+{deep-link opt-in, geo polling}
     [React Native shared codebase]+{multi-role app}
     [Stripe Payment Intents]+{webhook confirmation, no PAN storage}
     [FastAPI per-city config]+{regulatory flags, timezone handling}

L2 → [software-engineering]+{auth security, CI/CD, observability, testing}
     [regulatory]+{GDPR consent/erasure, PCI DSS no-storage, food-safety labeling}
     [operations]+{server-side clock enforcement, external dependency risk}
     [product velocity]+{managed infra, minimal custom build}

L1 → [Technology] [Law & compliance] [Logistics] [Food industry] ✓

Requirements surfaced:
  L4: real-time listing expiry, geo-proximity filtering, city-configurable rule engine, allergen capture
  L3: streaming feed mechanism, Stripe webhooks, per-city config records, shared RN codebase
  L2: GDPR consent+erasure, PCI no-card-storage, server-side close-time enforcement, observability

Solution Space:
  {single React Native multi-role app | three separate RN apps | RN + web admin}
  {WebSocket live feed | SSE | polling with aggressive TTL}
  {driver deep-link opt-in | in-app notification opt-in | standalone driver app}
  {fully managed cloud (Railway/Render/Fly.io) | AWS/GCP with IaC | bare VPS}
```

---

## Phase 1: MGPC Specification

### "Why?" Recursion (W-functor)

```
"List surplus restaurant food at a discount for nearby delivery"
  → why? → help restaurants recover value from unsold end-of-day inventory
  → why? → reduce the economic loss restaurants suffer from food waste
  → why? → make independent restaurants financially viable and reduce environmental waste
  → why? → food sustainability and the viability of independent food businesses
             are intrinsically valuable to communities
  → [tautology reached] ← Mission
```

---

### M — Mission

Reduce food waste and strengthen independent restaurant viability by connecting surplus end-of-day inventory to nearby customers through existing delivery infrastructure — turning a daily loss into value for restaurants, drivers, and communities.

---

### G — Goals

1. **Surplus marketplace:** Enable independent restaurants to list surplus ingredients or prepared dishes at a discount within 60 minutes of closing, visible to nearby customers in a real-time last-hour feed.

2. **Driver add-on model:** Allow delivery drivers already active on Uber Eats or DoorDash to opt into FreshRoute pickup-and-delivery tasks without switching apps.

3. **Zero-friction restaurant onboarding:** Deliver a setup experience completable in under 10 minutes with no training required.

4. **Series A launch milestone:** Go live in 3 cities within 6 months with a 4-person team.

5. **Compliant payment processing:** Accept payments via Stripe without storing card data on FreshRoute infrastructure.

> Litmus check: changing any goal changes the solution type entirely (e.g., removing driver add-on model forces building a dedicated driver network — a fundamentally different product).

---

### P — Premises

Premises are assumptions that, if false, make one or more Goals impossible.

| # | Premise | Goal(s) it supports | Falsification risk |
|---|---|---|---|
| P1 | Independent restaurants in target cities have internet-connected smartphones available during service | G1, G3 | Low — smartphones near-universal in dense urban areas |
| P2 | Delivery drivers on Uber Eats / DoorDash are physically near independent restaurants in dense urban areas during the close-time window | G2 | Medium — depends on driver density and routing patterns by city |
| P3 | Restaurants can accurately predict and input their close time and surplus inventory 60 minutes in advance (or close to it) | G1 | Medium — kitchen operations are dynamic; close times shift |
| P4 | Customers in target cities are willing to purchase discounted near-close food items for same-hour delivery | G1 | Medium — behavior change required; discount magnitude is a key lever |
| P5 | Stripe's API and fee structure support the FreshRoute transaction model (low-value, high-frequency, EU-based) | G5 | Low — Stripe operates in EU and supports this model |
| P6 | Food safety regulations in the 3 target cities do not prohibit resale of prepared restaurant surplus via a third-party platform | G1, G4 | Medium-High — must be validated per city before launch |
| P7 | A 4-person team can ship consumer, driver, and restaurant apps plus a backend API to production quality within 6 months | G4 | High risk — depends on scope discipline; see Constraints |
| P8 | GDPR compliance is achievable with standard Stripe data processing agreements and a lean EU-hosted backend | G5 | Low — established pattern for EU SaaS |

---

### C — Constraints

#### Hard Constraints (violation = rejection / non-launch)

| # | Constraint | Source |
|---|---|---|
| C1 | FreshRoute must not store, process, or transmit raw payment card data — all card handling via Stripe-hosted fields and tokenization | PCI DSS + brief |
| C2 | GDPR compliance required: explicit consent at signup, data minimization in collection, right-to-erasure flow, processor agreement with Stripe | EU legal + brief |
| C3 | Food safety labeling information (ingredients, allergens, preparation method) must be captured at listing creation and surfaced to customers — specific rules must be validated per city before launch | Regulatory + L2 |
| C4 | Listing expiry must be enforced server-side at restaurant close time — expired items must not be purchasable regardless of client state | Operational integrity |
| C5 | The platform targets independent restaurants only (not chains) — onboarding must validate or gate chain accounts | Brief |
| C6 | Customer order window closes 60 minutes before restaurant close — orders outside this window must be rejected by the backend | Brief |
| C7 | Stripe must be the sole payment processor — no fallback card processor may be added without re-evaluating PCI scope | PCI DSS |

#### Soft Constraints (violation = penalty / degraded experience)

| # | Constraint | Source | Penalty if violated |
|---|---|---|---|
| C8 | Restaurant setup must be completable in under 10 minutes with zero training | Brief | Adoption failure — restaurants abandon during onboarding |
| C9 | Driver opt-in mechanism must not require the driver to leave their primary delivery app mid-run | Brief | Driver adoption failure |
| C10 | React Native shared codebase for all three app roles (consumer, driver, restaurant) | Team size + L3 | Exceeds team capacity if separate codebases |
| C11 | Backend infrastructure should use managed/PaaS services to minimize ops burden on a 4-person team | L2 velocity mandate | Ops overhead consumes dev capacity needed for launch |
| C12 | Per-city regulatory configuration must be data-driven (not hardcoded) to allow city #4+ rollout without code changes | L3 + Series A growth | City expansion requires engineering effort instead of config |
| C13 | Real-time feed updates (new listings, expiry countdowns) should use push or server-sent events rather than polling alone | L3 mechanism | Feed staleness degrades time-sensitive UX |
| C14 | Observability (error tracking, order failure alerting) must be in place before city launch | L2 mandate | Silent failures in a real-time order window cause user harm and reputation damage |

---

### Solution Space

Alternative approaches surfaced during Phase 0 that remain consistent with the Mission:

| Dimension | Option A | Option B | Option C |
|---|---|---|---|
| App architecture | Single React Native app with role-switching (restaurant / driver / consumer) | Three separate RN apps per role | RN consumer + driver apps; web-only restaurant dashboard |
| Live feed mechanism | WebSocket (bidirectional, lower latency) | Server-Sent Events (simpler, unidirectional) | Aggressive short-poll (simplest, highest server load) |
| Driver integration | In-app FreshRoute notification opt-in during active run | Deep link from push notification to FreshRoute task | Standalone driver app (abandons add-on model premise) |
| Infrastructure | Fully managed PaaS (Railway, Render, Fly.io) — minimizes ops | AWS/GCP with managed services (RDS, ECS) — more control | Bare VPS — cheapest, highest ops burden |
| City onboarding | Config-table-driven (C12) with admin UI | Hard-coded city configs — faster initially, costly to scale | Per-city feature flags via existing flag service |

> Recommended starting point: Option A (single multi-role RN app) + SSE (Option B for live feed) + managed PaaS (Option A for infra) + config-table city onboarding (C12). This maximizes team velocity given P7 risk while satisfying all Hard Constraints.

---

## Requirements Traceability Summary

| MGPC Element | Count | Key items |
|---|---|---|
| Goals | 5 | Surplus marketplace, driver add-on, zero-friction onboarding, 3-city launch, compliant payments |
| Premises | 8 | Driver proximity (P2), food safety legality per city (P6), team capacity (P7) are highest-risk |
| Hard Constraints | 7 | PCI no-storage (C1), GDPR (C2), food labeling (C3), server-side expiry (C4), order window (C6) |
| Soft Constraints | 7 | <10min onboarding (C8), driver no-app-switch (C9), shared RN codebase (C10), observability (C14) |
| Solution Space options | 5 dimensions | App architecture, feed mechanism, driver integration, infra, city config |

**Highest-risk items requiring early validation:**
- P6: Confirm food safety regulations permit this model in all 3 target cities before committing to launch cities
- P7: Validate team capacity against scope — the single multi-role RN app recommendation directly mitigates this
- P2: Pilot driver density study in city #1 before committing to cities #2 and #3
