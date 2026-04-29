# FreshRoute -- Requirements Specification

Extracted using Requirements Extractor v3.0 (bottom-up CoK expansion + top-down intent inference).

**Input type:** Product brief (informal)

---

## Mission

Enable sustainable local food ecosystems by connecting surplus restaurant food with nearby customers through efficient last-mile delivery.

**W-functor chain:** Build FreshRoute platform -> reduce food waste and delivery costs for independent restaurants -> help small restaurants survive economically while reducing environmental harm -> sustainable local food ecosystems are intrinsically valuable (tautology)

---

## Goals

1. **Surplus listing marketplace** -- Enable independent restaurants to list surplus ingredients and prepared dishes at a discount, with time-bounded availability (up to 60 minutes before close).
2. **Piggyback delivery network** -- Allow gig delivery drivers (Uber Eats, DoorDash) to opt into FreshRoute deliveries as add-ons to their existing routes, without switching apps.
3. **Customer last-hour feed** -- Provide customers a real-time, location-aware feed of discounted surplus items available for immediate order.
4. **Frictionless restaurant onboarding** -- Achieve sub-10-minute setup for restaurants with zero training required.
5. **Three-city launch in six months** -- Go live in 3 dense urban markets within 6 months to meet Series A milestones.

---

## Premises

| # | Premise | Source | Risk if false |
|---|---------|--------|---------------|
| P1 | Independent restaurants in target cities have meaningful surplus inventory at end of day | Inferred from founder observation | **HIGH RISK** -- No supply = no marketplace; invalidates the Mission |
| P2 | Gig drivers can and will opt into secondary delivery platforms alongside Uber Eats/DoorDash | Inferred from "add-on to existing runs" model | **HIGH RISK** -- No drivers = no delivery; may violate driver exclusivity clauses in gig platform ToS |
| P3 | Customers will buy discounted surplus food from unfamiliar restaurants with short notice | Inferred from marketplace demand assumption | No demand = marketplace fails; requires trust/safety signals |
| P4 | A 4-person team can build, launch, and operate a two-sided marketplace with delivery logistics in 3 cities within 6 months | Inferred from team size + timeline stated | Scope must be ruthlessly cut to MVP; any overengineering breaks timeline |
| P5 | React Native + Python/FastAPI stack is sufficient for real-time geospatial matching and time-sensitive inventory | Stated (tech stack) | Wrong stack choice forces costly rewrite mid-launch |
| P6 | Stripe supports the marketplace payment model needed (multi-party payouts to restaurants and drivers) | Inferred from "use Stripe" + marketplace structure | Stripe Connect handles this, but integration complexity may exceed estimates |
| P7 | Food safety regulations in initial 3 cities permit resale of surplus prepared food via a platform intermediary | Inferred from "food safety regulations vary by city" | **HIGH RISK** -- Regulatory block in any city reduces launch count; may require per-city legal review before city selection |
| P8 | Restaurants are willing to list surplus publicly at a discount (no brand/reputation concern) | Inferred from target market (independents, not chains) | Restaurants may resist visible discounting; may need anonymized or "surprise bag" model |
| P9 | Dense urban areas provide sufficient geographic overlap between restaurant surplus, available drivers, and customers | Inferred from urban density targeting | Sparse overlap = high delivery cost, negating the value proposition |

**HIGH RISK premises: P1, P2, P7** -- If any of these is false, the Mission itself is threatened, not just individual goals.

---

## Constraints

### Hard (violation = rejection)

| # | Constraint | Source |
|---|-----------|--------|
| C1 | No storage of payment card data -- all payment processing via Stripe | Stated explicitly; PCI-DSS regulatory |
| C2 | GDPR compliance required (EU-based company) | Stated explicitly; EU regulatory |
| C3 | Food safety regulation compliance per city | Stated explicitly; local regulatory |
| C4 | React Native for mobile apps | Stated (tech stack mandate) |
| C5 | Python/FastAPI for backend | Stated (tech stack mandate) |
| C6 | Live in 3 cities within 6 months | Stated (Series A requirement) |
| C7 | Target only independent restaurants, not chains | Stated (market scope) |
| C8 | Restaurant setup must take under 10 minutes with no training | Stated (onboarding requirement) |
| C9 | Orders limited to 60 minutes before restaurant closing time | Stated (operational rule) |

### Soft (violation = penalty)

| # | Constraint | Source |
|---|-----------|--------|
| S1 | Drivers should not need to switch apps to accept FreshRoute deliveries | Stated ("without switching apps"); may require deep-link or overlay approach |
| S2 | Dense urban areas only for initial launch | Stated (targeting); could expand if supply justifies |
| S3 | Minimal infrastructure complexity (4-person team) | Inferred from team size; managed services preferred over self-hosted |
| S4 | Real-time or near-real-time feed updates for last-hour inventory | Inferred from time-sensitive marketplace model |
| S5 | Multi-timezone and multi-locale support for 3-city rollout | Inferred from multi-city requirement; severity depends on city selection |
| S6 | Data residency within EU or adequacy-decision countries | Inferred from GDPR; hosting in EU simplifies compliance |

---

## Mission Space

### Evaluated Alternatives

| Alternative | Description | Fit vs. Hard Constraints |
|---|---|---|
| **Surprise-bag model (a la Too Good To Go)** | Restaurants list a "surprise bag" at fixed discount rather than individual items | Avoids brand-discount stigma (P8 risk); simpler UX; proven model. Fits all hard constraints. |
| **Driver-independent pickup model** | Customers pick up surplus themselves (no delivery) | Eliminates driver dependency (P2 risk) and delivery cost; reduces scope dramatically. Conflicts with Goal 2 but simplifies 6-month timeline. |
| **Scheduled batch delivery** | Drivers collect from multiple restaurants on a fixed evening route | Reduces real-time matching complexity; better unit economics. Fits constraints but weakens "last-hour" immediacy. |
| **Platform-integrated driver API** | Integrate directly with Uber/DoorDash driver APIs for dispatch | Cleanest driver experience (S1). Risk: those APIs may not exist publicly or ToS may prohibit (P2 risk). |
| **Deep-link / notification overlay** | Drivers get push notifications with deep-links to accept FreshRoute jobs | No app-switching required (S1); lighter integration. Weaker driver experience than native integration. |

### Domain Context

- **Regulatory landscape:** Food surplus resale is regulated differently across EU cities. France has anti-food-waste legislation (Loi Garot) that may help; Germany has strict prepared-food resale rules. City selection should be regulation-aware, not just density-aware.
- **Competitive landscape:** Too Good To Go dominates the surplus food space in EU with a surprise-bag model and customer pickup. FreshRoute's delivery angle is the differentiator but also the complexity multiplier.
- **Gig platform ToS risk:** Uber Eats and DoorDash driver agreements may restrict drivers from using competing platforms simultaneously. This is the single largest external dependency risk.
- **Cold-start problem:** Two-sided marketplace needs simultaneous supply (restaurants) and demand (customers). Standard playbook: seed one side first (likely restaurants via direct sales outreach, given 4-person team).
- **Payment complexity:** Marketplace payments require split payouts (platform fee, restaurant payout, driver payout). Stripe Connect supports this but adds integration time.

### Knowledge Gaps

1. **City selection criteria** -- Which 3 cities? Regulation, density, and competitive landscape all matter but are not specified.
2. **Monetization model** -- Commission percentage, delivery fee structure, subscription vs. transaction-based -- not stated.
3. **Driver compensation model** -- Per-delivery fee, distance-based, or tip-only? Affects driver supply.
4. **Food safety liability** -- Who bears liability if a customer gets sick: restaurant, platform, or driver? Legal structure not addressed.
5. **Insurance requirements** -- Product liability, delivery liability, cyber insurance -- not discussed.
6. **Customer acquisition strategy** -- How customers discover the app in each city. Marketing budget and channels unknown.
7. **Restaurant churn management** -- What happens when restaurants stop listing surplus regularly? Marketplace reliability depends on consistent supply.
8. **Data processing agreements** -- GDPR requires DPAs with Stripe, hosting providers, analytics tools. Not addressed.
9. **Accessibility requirements** -- EU accessibility directives (EAA 2025) may apply to the mobile apps.
10. **Dispute resolution process** -- What happens when food quality is poor, delivery is late, or items are unavailable? No process defined.

---

## Phase 0 Saturation Trace

```
L5->{surplus-food-listing, discounted-pricing, delivery-routing, customer-ordering,
     restaurant-onboarding, multi-city-launch, React-Native, FastAPI, Stripe,
     food-safety, GDPR, last-hour-feed, driver-add-on, inventory-mgmt, geolocation,
     notifications, dashboards, analytics, order-expiration, restaurant-hours}
L4->[marketplace]+{two-sided, supply-demand-matching, dynamic-pricing}
    [logistics]+{last-mile-delivery, gig-worker-integration, route-optimization}
    [restaurant-ops]+{inventory-tracking, time-based-availability}
    [customer-experience]+{mobile-ordering, real-time-feed, proximity-search}
L3->[mobile-dev]+{React Native, push notifications, offline handling}
    [backend]+{FastAPI, async queues, caching}
    [geospatial]+{geofencing, proximity queries, mapping APIs}
    [3rd-party]+{Stripe Connect, driver-platform integration}
L2->[software-engineering]+{security, scalability, API design, release management}
    [regulatory-compliance]+{GDPR, food-safety-per-jurisdiction, consumer-protection}
    [product-management]+{MVP scoping, Series A milestones, go-to-market}
L1->[technology]+(food-regulation, financial-services) disjoint verified
Requirements: L4[cold-start, expiration-logic] + L3[stack-mandated, team-size-limit,
             driver-platform-ToS-risk] + L2[GDPR, food-safety-per-city, Series-A-timeline]
```
