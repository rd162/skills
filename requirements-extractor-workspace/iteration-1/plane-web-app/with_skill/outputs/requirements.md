# Plane — MGPC Requirements Specification

**Source:** https://github.com/makeplane/plane  
**Method:** requirements-extractor v2.0 (Phase 0: Bottom-Up CoK Saturation → Phase 1: Top-Down Intent Inference)  
**Date:** 2026-04-08  
**Version analyzed:** 0.24.0 (web app v1.3.0)

---

## Phase 0: Bottom-Up CoK Saturation

### L5 — Topics (Explicit + Implied)

Explicit topics from the repo:
- (repo, states, work-item-tracking) — issues/tasks with rich text, sub-issues, labels, priorities, assignees
- (repo, states, sprint-cycles) — time-boxed cycles with burn-down charts
- (repo, states, modules) — grouping of issues into deliverable units
- (repo, states, roadmap-views) — custom filtered views, saved and shareable
- (repo, states, pages) — collaborative rich-text wiki/notes with AI
- (repo, states, analytics) — real-time project data visualization
- (repo, states, open-source) — AGPL-3.0 license, self-hostable
- (repo, states, SaaS-cloud) — managed cloud at app.plane.so

Implied topics via expansion:
- (work-item-tracking, implies, state-machine) — configurable states per project
- (work-item-tracking, implies, estimates) — point/time estimates per issue
- (work-item-tracking, implies, relations) — blocking/duplicate/related links
- (work-item-tracking, implies, intake) — external issue submission funnel
- (work-item-tracking, implies, draft-issues) — staged pre-publish items
- (pages, requires, real-time-collaboration) — live app powered by Hocuspocus/Yjs
- (open-source, implies, self-hosting) — Docker + Kubernetes deployment paths
- (self-hosting, requires, instance-admin) — God Mode admin panel
- (self-hosting, requires, object-storage) — MinIO or S3-compatible bucket
- (SaaS-cloud, implies, multi-tenancy) — workspace isolation per organization
- (analytics, implies, export) — XLSX/CSV export via openpyxl
- (platform, implies, API) — REST API with token-based access + rate limiting
- (platform, implies, webhooks) — outbound event delivery
- (platform, implies, integrations) — Slack, GitHub, importers/exporters
- (platform, implies, notifications) — in-app + email notification system
- (platform, implies, i18n) — internationalization package with ICU message format
- (platform, implies, RBAC) — workspace and project role-based access
- (platform, implies, device-tracking) — session and device model in DB

### L4 — Areas + Patterns

| Area | Topics grouped | Patterns identified |
|---|---|---|
| work-item-management | issues, states, labels, estimates, relations, sub-issues, intake, draft | Kanban board, list view, spreadsheet view, Gantt chart |
| sprint-and-roadmap-planning | cycles, modules, roadmap views | Scrum sprint board, burn-down, milestone tracking |
| knowledge-management | pages, rich text editor, AI, notes | Collaborative wiki, AI-assisted writing |
| data-and-insights | analytics, export, real-time charts | BI dashboard, XLSX export |
| platform-extensibility | API, webhooks, integrations, importers | REST API-first, event-driven integrations |
| team-collaboration | notifications, mentions, real-time edits, activity feed | Async collaboration, presence indicators |
| access-and-governance | RBAC, workspace roles, instance admin, God Mode | Multi-tenant RBAC, self-service instance config |
| deployment-and-ops | Docker, Kubernetes, MinIO, RabbitMQ, Celery | Container-first, queue-backed async tasks |

Requirements from L4:
- Real-time collaborative editing requires CRDT/OT (Yjs) and a stateful live server
- Burn-down and analytics require persistent event/activity log
- Multi-workspace isolation requires tenant-scoped data access
- Intake funnel and deploy boards require publicly accessible (unauthenticated) endpoints

### L3 — Fields + Mechanisms

| Area | Implements via | Mechanisms required |
|---|---|---|
| work-item-management | React SPA (React Router v7, MobX state) | Client-side routing, optimistic UI, drag-and-drop |
| sprint-and-roadmap-planning | React SPA + REST API | Date-range filtering, aggregation queries |
| knowledge-management | Hocuspocus/Yjs live server + TipTap editor | WebSocket connections, CRDT merge, signed URL for assets |
| data-and-insights | Django REST API + Celery workers | Async aggregation, background job scheduling |
| platform-extensibility | Django REST API + webhooks | Token auth, rate limiting (60/min default), outbound HTTP delivery |
| team-collaboration | Redis pub/sub + Django Channels + live server | WebSocket fanout, async task notifications |
| access-and-governance | Django auth + JWT + RBAC middleware | Role enforcement at API layer, instance-level settings |
| deployment-and-ops | Docker Compose / Kubernetes + nginx proxy | Container orchestration, TLS termination, volume management |

Requirements from L3:
- WebSocket support required for live editing and notifications
- S3-compatible object store required for file uploads (5 MB default limit, configurable)
- Reverse proxy required to route web/admin/space/live on a single port
- Background task queue (Celery + RabbitMQ) required for email, analytics, imports
- PostgreSQL required as primary RDBMS (pg 14+ confirmed; pg 15 in production compose)

### L2 — Disciplines + Concerns

| Field | Grounded in | Mandates |
|---|---|---|
| web-platform + live-server | software-engineering | Testing (pytest, vitest), linting (OxLint/ruff), type safety (TypeScript/mypy) |
| distributed-system | systems-engineering | Service health, graceful restart, volume persistence, migration safety |
| data-management | information-science | Soft-delete patterns, hard-delete scheduling (60-day TTL), signed URL expiry |
| security | information-security | JWT auth, CSRF, CORS policy, API rate limiting, AGPL license compliance, responsible disclosure |
| i18n/l10n | linguistics/UX | ICU message format, per-language translation files, key parity across languages |
| observability | SRE | OpenTelemetry instrumentation, Scout APM, posthog analytics, structured JSON logging |
| open-source governance | software-law | AGPL-3.0 copyleft, copyright headers, contributor workflow, CLA-equivalent |

Requirements from L2:
- All features must have unit tests (stated in CONTRIBUTING)
- Security vulnerability reports go to security@plane.so (not public issues)
- AGPL-3.0 license: any deployment offering Plane as a service must publish source
- OpenTelemetry and structured logging are baked in, not optional
- Hard-delete of uploaded files enforced after 60 days (configurable)

### L1 — Domains

| Discipline | Part of | Disjoint from |
|---|---|---|
| software-engineering | technology | veterinary/physical-science |
| systems-engineering | technology | social-science |
| information-security | technology + law | arts |
| software-law (AGPL) | legal | engineering |
| UX/i18n | design + linguistics | — |

Domain: **technology** (primary) + **legal** (secondary, license constraint)
Classification: L1 → [technology] + [legal/licensing] — confirmed non-overlapping with irrelevant domains.

### Saturation Summary

```
L5→{work-items, cycles, modules, views, pages, analytics, API, webhooks,
    notifications, RBAC, i18n, intake, draft-issues, deploy-boards,
    real-time-collab, self-hosting, SaaS-cloud, instance-admin,
    object-storage, integrations}

L4→[work-item-management]+{Kanban, list, spreadsheet, Gantt}
   [sprint-and-roadmap]+{burn-down, milestones}
   [knowledge-management]+{collab-wiki, AI-writing}
   [data-and-insights]+{BI-dashboard, export}
   [platform-extensibility]+{REST-API-first, event-driven}
   [team-collaboration]+{async-collab, presence}
   [access-and-governance]+{multi-tenant-RBAC, instance-config}
   [deployment-and-ops]+{container-first, queue-backed}

L3→[React-SPA + React-Router-v7]+{optimistic-UI, drag-and-drop}
   [Django-REST-API]+{JWT-auth, rate-limiting, DRF-spectacular}
   [Hocuspocus/Yjs live server]+{WebSocket, CRDT}
   [Celery+RabbitMQ]+{async-tasks, beat-scheduler}
   [PostgreSQL 14+]+{migrations, soft-delete}
   [Redis/Valkey]+{caching, pub-sub, session}
   [MinIO/S3]+{file-upload, signed-URLs}
   [nginx proxy]+{TLS, routing}

L2→[software-engineering]+{unit-tests, linting, type-safety}
   [systems-engineering]+{graceful-restart, volume-persistence, migration}
   [information-security]+{JWT, CORS, rate-limiting, AGPL-compliance}
   [observability]+{OpenTelemetry, Scout-APM, structured-logging}
   [i18n]+{ICU-format, key-parity}

L1→[technology]✓ + [legal]✓ (disjoint: arts, social-science)

Requirements:
  L4: real-time CRDT editing, tenant-scoped data isolation,
      public intake/deploy-board endpoints, event/activity log
  L3: WebSocket, S3-store, reverse proxy, Celery queue,
      PostgreSQL, Redis, 60-day hard-delete TTL
  L2: unit tests required, AGPL source publication, OpenTelemetry,
      responsible disclosure, signed URL expiry

Solution Space:
  {Cloud SaaS + self-hosted Docker,
   Self-hosted Kubernetes,
   PWA-capable SPA,
   API-first headless usage,
   White-label via AGPL fork}
```

---

## Phase 1: Top-Down Intent Inference

### "Why?" Recursion (W-functor)

```
"Build an open-source project management tool"
  → why? "to track issues, run cycles, manage product roadmaps"
  → why? "to keep software teams organized and aligned"
  → why? "to reduce chaos and coordination overhead in product development"
  → why? "to ship better software products, on time, with less friction"
  → why? "to deliver value to end users of those software products"
  → why? "delivering value to users is the purpose of software teams"
  → why? "software teams exist to solve problems for people"
  → why? "solving problems for people is intrinsically valuable" ← tautology = Mission
```

The terminal value: **enabling software teams to deliver value to the people they serve, without the tool itself becoming an obstacle.**

---

## MGPC Specification

### M — Mission

Enable software teams to deliver value to the people they serve by providing a low-friction, fully controllable project management platform — one that stays out of the way of the work itself.

*"why?" fixed point: delivering value through software is intrinsically worthwhile; the tool must serve the team, not demand the team serve the tool.*

---

### G — Goals

The concrete objectives whose change would require a fundamentally different type of solution:

1. **Work-item tracking at scale** — Provide a full issue lifecycle (create, triage, estimate, assign, track, close) with rich metadata (labels, states, priorities, relations, sub-issues, custom types) for software projects of any size.

2. **Sprint and roadmap management** — Offer time-boxed Cycles (sprints) with burn-down charts and Modules (feature groupings) to plan, execute, and review delivery milestones.

3. **Collaborative knowledge capture** — Provide an AI-assisted rich-text Pages system for documentation, meeting notes, and idea capture that is tightly integrated with work items.

4. **Real-time insights and analytics** — Deliver live dashboards and exportable reports that let teams identify blockers, measure velocity, and track project health without leaving the tool.

5. **Open deployment model** — Support both a managed cloud (Plane Cloud) and a fully self-hosted path (Docker Compose, Kubernetes) so that teams with data-sovereignty or cost requirements are not excluded.

6. **API-first extensibility** — Expose a full REST API with token auth, webhooks, and an integration layer so that Plane can participate in any existing toolchain without forcing migration.

---

### P — Premises

Assumptions that, if false, make one or more goals impossible:

1. **Teams have internet-connected browsers** — The SPA delivery model assumes users can load a JavaScript application; air-gapped deployments require the self-hosted path plus local asset serving.

2. **Projects are primarily software development** — The data model (states, cycles, burn-down, code integration hooks) is optimized for engineering workflows; heavy use in non-technical domains (legal, manufacturing) is possible but not the primary design target.

3. **Workspaces map to organizations** — The multi-tenancy model assigns a workspace per organization; cross-workspace project sharing is not a core design principle.

4. **Persistent infrastructure is available for self-hosters** — Self-hosted deployments require PostgreSQL, Redis, a message broker (RabbitMQ), and an S3-compatible store; ephemeral or serverless infra is not supported.

5. **Celery background workers are always running** — Email notifications, analytics aggregation, file hard-deletion, and import/export depend on Celery workers and a beat scheduler being available.

6. **Real-time editing requires a live WebSocket server** — The Pages collaborative editor depends on the `apps/live` Hocuspocus/Yjs server; without it, collaborative editing degrades to last-write-wins.

7. **AGPL-3.0 is acceptable to deploying organizations** — Any organization hosting Plane and offering it as a service must be prepared to publish their source modifications; commercial editions (Plane Pro/Business) are separate offerings.

8. **Object storage is provisioned** — File attachments, page assets, and exported reports require an S3-compatible bucket (MinIO or AWS S3); the tool does not store binary assets in PostgreSQL.

---

### C — Constraints

#### Hard Constraints (violation = rejection)

| # | Constraint | Source |
|---|---|---|
| H1 | Authentication required for all non-public endpoints; public paths limited to intake forms and deploy boards | Architecture + RBAC model |
| H2 | AGPL-3.0 license must be preserved; copyright headers required in all source files | LICENSE.txt + COPYRIGHT_CHECK.md |
| H3 | API key rate limit enforced (default 60 requests/minute, configurable) | `.env.example` + throttles module |
| H4 | PostgreSQL 14+ as the only supported primary database; no SQLite or MySQL path | CONTRIBUTING.md + requirements |
| H5 | All new features and bug fixes must include unit tests (pytest for backend, vitest for live server) | CONTRIBUTING.md |
| H6 | Security vulnerabilities must be disclosed privately to security@plane.so; public CVE-style issues are prohibited | SECURITY.md |
| H7 | Uploaded files are hard-deleted after `HARD_DELETE_AFTER_DAYS` days (default 60); this cannot be disabled | API env config |
| H8 | Signed URL expiration enforced for all S3 asset access (default 3600s) | API env config |
| H9 | CORS origins must be explicitly whitelisted; wildcard CORS is not the default | API env config |
| H10 | All translation keys must exist in every supported language file with matching nested structure | CONTRIBUTING.md i18n section |

#### Soft Constraints (violation = penalty / degraded experience)

| # | Constraint | Penalty if violated |
|---|---|---|
| S1 | Minimum 12 GB RAM recommended for local development | Setup failures, memory crashes during Docker build |
| S2 | Real-time collaborative editing (Hocuspocus live server) is optional in architecture but expected by users | Pages editor degrades to non-collaborative |
| S3 | OxLint max-warnings threshold (11,957 for web app, 119 for live server) should not increase | CI lint gate failure |
| S4 | File upload size limit defaults to 5 MB; increasing requires proxy config changes | Larger uploads may bypass proxy limits silently |
| S5 | Gunicorn worker count defaults to 2; under-provisioning reduces API throughput under concurrent load | Performance degradation |
| S6 | Node.js 20+ LTS and Python 3.8+ are minimum runtime versions; older runtimes may work but are unsupported | Undefined behavior, missed security patches |
| S7 | God Mode instance admin setup must be completed before the main app is usable | New self-hosted installs blocked on first-run setup |
| S8 | RabbitMQ message broker is the preferred queue backend; Redis as a fallback is possible but not the standard setup | Celery reliability and delivery guarantees reduced |

---

### Solution Space

Derived from L4–L3 patterns in Phase 0:

| Alternative | Description | Trade-offs |
|---|---|---|
| **Plane Cloud (primary)** | Managed SaaS at app.plane.so; fastest onboarding, no infrastructure burden | Data residency outside user control; subscription cost |
| **Self-hosted Docker Compose** | Single-server deployment via `docker-compose.yml`; full data ownership | Requires DevOps capability; operator responsible for upgrades, backups |
| **Self-hosted Kubernetes** | Production-grade HA deployment; scales horizontally | Higher operational complexity; requires K8s expertise |
| **API-first headless usage** | Use only the Django REST API + webhooks; build custom frontend | Full flexibility but loses all UI features; AGPL still applies |
| **AGPL fork (white-label)** | Fork the repo, customize branding and features, publish modifications | Must publish all changes; no access to commercial Pro features |
| **Embedded via deploy boards** | Public read-only issue boards embeddable in external sites | Limited to public-view use cases; no write access |

---

## Saturation Trail (CoK Reasoning Log)

This section documents the chain of knowledge expansion for auditability.

```
(plane, is, open-source-project-management-tool)
(plane, tracks, work-items) → (work-items, require, state-machine)
(plane, provides, cycles) → (cycles, implement, sprint-methodology)
(plane, provides, modules) → (modules, group, work-items-by-feature)
(plane, provides, pages) → (pages, require, real-time-collab)
  → (real-time-collab, implements_via, Hocuspocus+Yjs)
  → (Hocuspocus, requires, WebSocket-server)
(plane, provides, analytics) → (analytics, require, activity-log)
  → (activity-log, persisted_in, PostgreSQL)
(plane, exposes, REST-API) → (REST-API, requires, JWT-auth)
  → (JWT, combined_with, rate-limiting)
(plane, supports, webhooks) → (webhooks, deliver_to, external-systems)
(plane, licensed_under, AGPL-3.0) → (AGPL, mandates, source-publication)
(plane, deployable_via, Docker) → (Docker, requires, PostgreSQL+Redis+S3)
(plane, deployable_via, Kubernetes) → (Kubernetes, requires, persistent-volumes)
(plane, has, God-Mode) → (God-Mode, is, instance-admin-panel)
  → (instance-admin, configures, authentication-providers)
(plane, uses, Celery) → (Celery, requires, RabbitMQ-broker)
  → (Celery-beat, schedules, hard-delete+analytics-jobs)
(plane, uses, MobX) → (MobX, manages, client-state)
(plane, uses, React-Router-v7) → (React-Router, implements, SPA-routing)
(plane, supports, i18n) → (i18n, uses, ICU-message-format)
  → (i18n, requires, key-parity-across-languages)
(plane, implements, RBAC) → (RBAC, scoped_to, workspace+project)
  → (RBAC, enforced_at, API-middleware-layer)
(plane, has, intake) → (intake, accepts, external-submissions)
  → (intake, is, unauthenticated-endpoint)
(plane, has, deploy-board) → (deploy-board, is, public-read-only-view)
(plane, integrates_with, Slack) → (Slack, requires, slack-sdk)
(plane, integrates_with, OpenAI) → (OpenAI, powers, AI-writing-in-pages)
(plane, tracks, notifications) → (notifications, delivered_via, in-app+email)
  → (email, processed_by, Celery-worker)
(plane, exports_to, XLSX) → (XLSX, generated_by, openpyxl+Celery)
(plane, instruments_with, OpenTelemetry) → (OTel, exports_to, OTLP-collector)
(plane, instruments_with, posthog) → (posthog, tracks, product-analytics)
```

Stop criteria met at L1: depth limit reached, no new triples generated beyond domain classification.
```
