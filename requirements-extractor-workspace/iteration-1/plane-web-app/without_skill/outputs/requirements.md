# Plane Web App — MGPC Requirements Specification

**Source:** GitHub repo at https://github.com/makeplane/plane, official docs at https://docs.plane.so, marketing site at https://plane.so, developer docs at https://developers.plane.so  
**Extracted:** 2026-04-08  
**Version basis:** Plane `master` branch (post-v1.0, current release)

---

## Mission

Plane's core invariant purpose is to provide an **open-source, AI-native project management platform** that unifies work tracking, documentation, and automated workflows into a single, self-hostable workspace — enabling teams to plan, execute, and stay aligned without depending on closed, opaque, or infrastructure-locked tooling.

The mission has two inseparable halves:
1. **Product utility**: Give every team — regardless of size, methodology, or domain — a single place where work items, knowledge, and collaboration live together.
2. **Structural openness**: Remain open-source (AGPL-3.0) and deployable by anyone on their own infrastructure, so that adoption never requires surrendering data sovereignty.

---

## Goals

Goals are measurable outcomes the system actively pursues. They are ordered from broadest to most specific.

### G1 — Replace fragmented tooling with a unified workspace
Teams should be able to manage projects (work items, cycles, modules, epics, milestones), documentation (pages, wikis, inline comments), and communication (updates, inbox, intake forms) entirely within Plane, reducing the number of external tools required for day-to-day project execution.

*Proxy measure: A team migrating from Jira, Linear, Asana, ClickUp, Notion, or Confluence imports all prior data and operates solely within Plane within one sprint.*

### G2 — Make work visible in real time across all stakeholders
The system must provide live, role-appropriate views (Board, List, Spreadsheet, Gantt, Calendar) and analytics dashboards so that status reports, blockers, and velocity can be read off the tool rather than assembled from meetings or email.

*Proxy measure: Workspace analytics are current to within seconds; no "Friday status meeting" artefacts are necessary to answer "what shipped this week?"*

### G3 — Support any team's workflow without enforced methodology
The platform must be configurable enough — custom work-item types, custom properties, custom states, custom labels, flexible role-based permissions — that product, DevOps, marketing, and operations teams can all use it natively without mapping their vocabulary onto a foreign model.

*Proxy measure: A team can rename, retype, and restructure every first-class object in a project without code changes.*

### G4 — Provide a credible self-hosting path for data-sovereign organizations
Any organization that cannot or will not store data on a third-party cloud must be able to deploy, operate, and upgrade the full Plane feature set on their own infrastructure.

*Proxy measure: A fully airgapped, Kubernetes-hosted deployment supports 100% of the feature set available on Plane Cloud (modulo external OAuth providers).*

### G5 — Deliver AI-powered workflow automation as a first-class capability
AI must be designed into the core data model — able to read across projects, cycles, documents, and threads — so that agents can take real assignments, generate insights, and reduce manual coordination without requiring separate integrations or retrofitting.

*Proxy measure: An AI agent can be assigned a work item, read all project context, and produce a substantive draft or action with no human copy-paste of context.*

### G6 — Grow adoption through community, ecosystem, and contributor momentum
Plane must remain easy to contribute to, easy to integrate with (REST API, webhooks, MCP, SDKs), and easy to extend (plugins, importers, translations), so that the open-source community continuously expands capability and reach.

*Proxy measure: Pull requests from external contributors are merged monthly; the ecosystem includes importers from all major competitors and integrations with GitHub, GitLab, Slack, and Sentry.*

---

## Premises

Premises are assumptions the system operates under — things treated as true that could, in principle, be false but are held stable for design purposes.

### P1 — Teams are the primary unit of use, not individual contributors
Plane is designed for collaborative work: permissions, notifications, views, and inbox features are all optimized for a multi-person, multi-role team context. Solo use is permitted but not the driving design case.

### P2 — Projects are scoped and finite; workspaces are persistent
A workspace is a durable organizational container (company, department, team). Projects within it have defined scope, states, and lifecycle. Work items exist inside projects; cross-project coordination happens via epics, initiatives, teamspaces, and dashboards — not by collapsing the project boundary.

### P3 — Users have reliable internet connectivity (or choose to manage without it)
The web application and most features assume continuous connectivity. Self-hosted airgapped deployments are a supported special case, not the default. There is no offline-first local client.

### P4 — State, labels, types, and priorities are meaningful, not decorative
The system assumes that teams will configure and maintain metadata fields so that filters, analytics, and automation can derive real meaning from them. If teams ignore metadata hygiene, analytics and AI features degrade gracefully but produce less value.

### P5 — AI capabilities require external model access (or licensed credits)
AI-powered features depend on Plane AI credits backed by LLM providers. Self-hosted instances that wish AI features must configure external model access. The core project management functionality is fully available without any AI credits.

### P6 — Data import fidelity is achievable from major competitors
Plane assumes it is technically possible to import work items, statuses, attachments, and history from Jira, Asana, Linear, ClickUp, Confluence, and Notion at sufficient fidelity for teams to migrate without rebuilding from scratch.

### P7 — The AGPL-3.0 license governs redistribution; hosted SaaS requires commercial terms
Anyone running Plane for their own internal use may do so freely. Organizations wishing to offer Plane as a hosted service to third parties are bound by AGPL-3.0 copyleft obligations. Commercial plans (Pro, Business, Enterprise) exist for organizations that need features beyond the open-source tier.

### P8 — Infrastructure components (Postgres, Redis, object storage) are commodities
Plane does not manage its own database or cache layer. It assumes operators provide a compatible PostgreSQL database (v14+), Redis (v6.2.7+), and S3-compatible object storage. These dependencies are treated as stable, available, and operator-managed.

---

## Constraints

Constraints are non-negotiable boundaries — the system must not violate them regardless of feature pressure.

### C1 — License: AGPL-3.0 (copyleft, open-source)
The entire codebase is released under the GNU Affero General Public License v3.0. No proprietary re-licensing, no closed-source forks distributed as a service, no removal of attribution. Enterprise features may be gated behind paid plans but the license type does not change.

### C2 — Security baseline: AES-256 at rest, TLS 1.3 in transit, enforced HTTPS
All data stored must be encrypted at rest using AES-256. All data in transit must use TLS 1.3 over enforced HTTPS. No plaintext data paths are permitted in production deployments. Self-hosted operators are responsible for configuring SSL; the application refuses to operate in production mode without it.

### C3 — Role-based access control is mandatory and non-bypassable
Every action on every resource must be gated by the workspace/project permissions matrix. There is no "superuser shortcut" in normal operation. Workspace Admins can delete workspaces; they cannot bypass project-level visibility restrictions on projects they are not members of. This constraint applies equally to API access.

### C4 — Self-hosting must be a fully supported, fully featured path
Plane must not ship features that are architecturally impossible to self-host. Features requiring external cloud infrastructure (e.g., AI credits) must degrade gracefully or be configurable to use operator-supplied alternatives. Plane Cloud and self-hosted instances must run the same codebase.

### C5 — Monorepo integrity: shared packages govern the frontend contract
The frontend is a pnpm monorepo. All UI components must be built in `@plane/ui` with Storybook coverage. All shared state must live in `packages/shared-state` using MobX reactive patterns. Applications (`apps/web`, `apps/admin`, `apps/space`) may not implement their own parallel component systems.

### C6 — API stability: public REST API endpoints are versioned and backward-compatible
The 180+ REST API endpoints are public contracts. Breaking changes to existing endpoints require a version bump. Webhooks, OAuth apps, and MCP integrations built against the documented API must not be silently broken by platform updates.

### C7 — TypeScript strict mode is enforced across all packages
All TypeScript packages run with strict mode enabled. No `any` escapes, no untyped surface areas in shared packages. OxLint and oxfmt are the linting and formatting tools; CI blocks merges that do not pass `pnpm check`.

### C8 — All features require unit tests before merge
No feature or bug fix may be merged without one or more unit tests that cover the new behavior. This is a hard gate in the contribution process, not a recommendation.

### C9 — Minimum runtime requirements set a hard floor for self-hosting support
Plane guarantees functionality only on: Node.js 20 LTS+, Python 3.8+, PostgreSQL 14+, Redis 6.2.7+. Deployments on older versions are unsupported and may silently corrupt data or produce incorrect results. Operators below the floor receive no bug-fix support.

### C10 — Data sovereignty: no telemetry or phone-home without explicit opt-in
Self-hosted instances must not transmit workspace data, work item content, or usage telemetry to Plane's cloud infrastructure without explicit administrator opt-in. Instance identity registration (for license management) is the only mandatory outbound call, and it must carry no user-generated content.
