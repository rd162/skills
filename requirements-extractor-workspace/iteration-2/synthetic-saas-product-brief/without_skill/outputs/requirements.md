# FreshRoute Requirements Specification

## 1. Mission

Reduce food waste and delivery costs for independent restaurants by connecting surplus inventory with nearby customers through drivers already on the road.

## 2. Goals

### 2.1 Business Goals

- **G-B1**: Launch in 3 cities within 6 months to meet Series A milestone.
- **G-B2**: Acquire independent restaurants (non-chain) in dense urban areas as supply-side users.
- **G-B3**: Generate revenue through discounted surplus food transactions (marketplace commission model implied).

### 2.2 Product Goals

- **G-P1**: Enable restaurants to list surplus ingredients or prepared dishes at a discount before closing time.
- **G-P2**: Allow delivery drivers to accept FreshRoute deliveries as add-ons to existing Uber Eats/DoorDash runs without switching apps.
- **G-P3**: Provide customers with a "last hour" feed of available surplus items, orderable up to 60 minutes before restaurant close.
- **G-P4**: Achieve restaurant onboarding in under 10 minutes with zero training required.

### 2.3 User Experience Goals

- **G-UX1**: Frictionless restaurant setup -- no training, minimal steps, under 10 minutes end-to-end.
- **G-UX2**: Seamless driver experience -- opt-in add-on model, no app switching.
- **G-UX3**: Simple customer browsing -- time-limited feed with clear availability windows.

## 3. Premises

These are assumptions and contextual facts taken as given.

- **P1**: Independent restaurants in urban areas regularly discard unsold inventory at end of day.
- **P2**: A meaningful number of restaurants will list surplus at a discount rather than discard it.
- **P3**: Delivery drivers on existing gig platforms (Uber Eats, DoorDash) will opt into additional FreshRoute pickups for incremental earnings.
- **P4**: Customers exist who will purchase discounted surplus food with short availability windows.
- **P5**: The team size is 4 people.
- **P6**: The tech stack is React Native (mobile apps) and Python/FastAPI (backend).
- **P7**: Stripe will be used for payment processing.
- **P8**: The company is EU-based.
- **P9**: Dense urban areas provide sufficient geographic density of restaurants, drivers, and customers for the model to work.

## 4. Constraints

### 4.1 Regulatory Constraints

- **C-R1**: **GDPR compliance is mandatory** -- the company is EU-based; all personal data collection, storage, processing, and deletion must comply with GDPR.
- **C-R2**: **City-specific food safety regulations must be respected** -- regulations vary by city; the platform must accommodate per-city compliance rules (e.g., labeling, temperature handling, shelf-life disclosure, permitted food types).
- **C-R3**: **No storage of payment card data** -- PCI DSS scope must be avoided entirely; all payment processing delegated to Stripe.

### 4.2 Technical Constraints

- **C-T1**: Mobile apps must be built in **React Native**.
- **C-T2**: Backend must be built in **Python/FastAPI**.
- **C-T3**: Payment processing must use **Stripe** exclusively (no self-hosted card storage).

### 4.3 Resource Constraints

- **C-RS1**: **4-person team** -- architecture, scope, and velocity must be realistic for this team size.
- **C-RS2**: **6-month deadline** -- must be live in 3 cities within 6 months (Series A dependency).

### 4.4 Business Constraints

- **C-B1**: **Target market is independent restaurants only** -- no chain restaurants.
- **C-B2**: **Dense urban areas only** -- geographic focus required for delivery economics to work.
- **C-B3**: **Driver integration model is add-on, not dedicated** -- drivers use existing gig platform apps; FreshRoute is supplementary, not primary.

## 5. Functional Requirements

### 5.1 Restaurant App

- **FR-R1**: Restaurant owners can create an account and complete setup in under 10 minutes.
- **FR-R2**: Restaurants can list surplus ingredients or prepared dishes with description, quantity, discount price, and availability window.
- **FR-R3**: Listings automatically expire at restaurant closing time.
- **FR-R4**: Restaurants can update or remove listings in real time.
- **FR-R5**: Restaurants receive notifications when an order is placed against their listing.

### 5.2 Customer App

- **FR-C1**: Customers can browse a "last hour" feed showing available surplus items from nearby restaurants.
- **FR-C2**: Customers can place orders up to 60 minutes before the listing restaurant's closing time.
- **FR-C3**: Customers pay through Stripe-integrated checkout (no card data touches FreshRoute servers).
- **FR-C4**: Customers receive order confirmation and delivery status updates.

### 5.3 Driver Experience

- **FR-D1**: Drivers can opt into FreshRoute delivery requests as add-ons to their current gig platform routes.
- **FR-D2**: The system must not require drivers to switch away from Uber Eats/DoorDash apps (integration via notifications, overlay, or lightweight companion interface).
- **FR-D3**: Drivers receive pickup and drop-off details for accepted FreshRoute deliveries.

### 5.4 Platform / Backend

- **FR-P1**: Match available surplus listings to nearby customers based on location and restaurant closing time.
- **FR-P2**: Route FreshRoute deliveries to drivers who are already near the restaurant or on a compatible route.
- **FR-P3**: Process all payments through Stripe; never store, transmit, or log raw payment card data.
- **FR-P4**: Support per-city configuration for food safety compliance rules.
- **FR-P5**: Implement GDPR-compliant data handling: consent management, data access requests, right to deletion, data portability.
- **FR-P6**: Support multi-city deployment (minimum 3 cities at launch).

## 6. Non-Functional Requirements

- **NFR-1**: **Onboarding speed** -- Restaurant account creation and first listing must be completable in under 10 minutes.
- **NFR-2**: **Availability** -- The platform must support real-time listing updates and order placement during peak evening hours.
- **NFR-3**: **Latency** -- Driver matching and order routing should occur in near-real-time to remain viable within the closing-time window.
- **NFR-4**: **Scalability** -- Architecture must support expansion to 3 cities without re-architecture.
- **NFR-5**: **Security** -- GDPR-compliant data protection; Stripe-only payment flow; no PCI DSS self-assessment required.
- **NFR-6**: **Maintainability** -- Must be operable and evolvable by a 4-person team.

## 7. Open Questions and Risks

- **OQ-1**: What is the specific driver integration mechanism? (API integration with Uber Eats/DoorDash, standalone notification system, or browser overlay?) -- This affects feasibility given gig platform API restrictions.
- **OQ-2**: Which 3 cities are targeted for launch? City selection determines which food safety regulations must be implemented first.
- **OQ-3**: How is driver compensation structured? (Per-delivery fee, commission, tip-based?)
- **OQ-4**: What food safety metadata must accompany each listing per city? (Allergen info, preparation time, temperature requirements?)
- **OQ-5**: What happens if a driver accepts but fails to pick up? Cancellation and fallback routing policy is undefined.
- **OQ-6**: Is there liability coverage or insurance for food safety incidents?
- **OQ-7**: How does the 60-minute ordering cutoff interact with real-time inventory -- can items sell out before the window closes?
