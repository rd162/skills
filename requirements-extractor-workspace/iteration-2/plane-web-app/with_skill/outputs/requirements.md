# Plane Project Management Tool -- Requirements Specification

**Input type:** Repository (open-source monorepo)
**Source:** https://github.com/makeplane/plane
**Extracted:** 2026-04-08
**Skill:** requirements-extractor v3.0

---

## Phase 0: Bottom-Up Requirements Saturation

### CoK Expansion

```text
L5 (Topics):
  Explicit: work-items, cycles, modules, pages, views, analytics,
            epics, initiatives, milestones, inbox, time-tracking,
            workflows, automations, integrations, importers,
            i18n, real-time-collaboration, public-spaces
  Implicit: multi-tenancy, workspace-isolation, role-based-access,
            file-storage, notifications, audit-trail,
            API-key-management, rate-limiting, search,
            data-migration, SSL-termination, reverse-proxy

L4 (Areas) + Patterns:
  [project-planning]      +{kanban, list, calendar, gantt, spreadsheet}
  [knowledge-management]  +{wiki-pages, rich-editor, inline-comments, templates}
  [workflow-execution]     +{state-machines, automations, approvals, recurring-items}
  [collaboration]          +{real-time-editing, comments, activity-feeds, notifications}
  [analytics-reporting]    +{dashboards, burn-down-charts, custom-queries, PQL}
  [platform-integration]   +{GitHub, GitLab, Slack, Sentry, webhooks, MCP-servers, API}
  [data-portability]       +{importers: Jira/Linear/Asana/Notion/ClickUp/CSV, exports}

L3 (Fields) + Mechanisms:
  [web-platform]       +{React 18, React Router 7, Vite 7, MobX, TipTap editor}
  [backend-api]        +{Django/Python, DRF, Gunicorn, Celery workers}
  [real-time-service]  +{Node.js live server, WebSocket/collaborative editing}
  [infrastructure]     +{Docker Compose, Kubernetes/Helm, PostgreSQL 15, Valkey/Redis,
                         RabbitMQ, MinIO/S3, reverse proxy}
  [build-system]       +{Turborepo monorepo, pnpm workspaces, OxLint, oxfmt, Husky}

L2 (Disciplines) + Concerns:
  [software-engineering]  +{TypeScript strict mode, test coverage, CI linting,
                            monorepo dependency management, copyright headers}
  [security]              +{authentication (OAuth/OIDC/SAML/LDAP), CORS,
                            API key rate limiting, vulnerability disclosure,
                            signed URL expiration, SSL/TLS}
  [data-engineering]      +{database migrations, backup/restore, hard-delete retention,
                            S3-compatible object storage}
  [operations]            +{Docker orchestration, airgapped deployment,
                            Sentry error tracking, session recording,
                            12GB+ RAM requirement, max_connections=1000}
  [compliance]            +{AGPL-3.0 copyleft, GDPR/HIPAA data residency,
                            responsible vulnerability disclosure}
  [internationalization]  +{IntlMessageFormat ICU, multi-language JSON locale files,
                            pluggable language packs}

L1 (Domains):
  [software-product-management] checkmark
  (disjoint: veterinary-science, finance -- not applicable)
```

### Saturation Summary

```text
L5->{work-items, cycles, modules, pages, views, analytics, epics, initiatives,
     milestones, inbox, time-tracking, workflows, automations, integrations,
     importers, i18n, real-time-collab, spaces, multi-tenancy, RBAC, search}
L4->[project-planning]+{kanban,list,calendar,gantt,spreadsheet}
    [knowledge-mgmt]+{wiki,editor,templates}
    [workflow-exec]+{state-machines,automations,approvals}
    [collaboration]+{real-time,comments,notifications}
    [analytics]+{dashboards,burn-down,PQL}
    [integration]+{GitHub,GitLab,Slack,Sentry,webhooks,API,MCP}
    [portability]+{Jira,Linear,Asana,Notion,ClickUp,CSV importers}
L3->[web:React18+Vite7+MobX] [api:Django+DRF+Celery] [live:Node.js]
    [infra:Postgres15+Valkey+RabbitMQ+MinIO+Docker/K8s]
L2->[security]+{OAuth/OIDC/SAML/LDAP,rate-limit,CORS}
    [compliance]+{AGPL-3.0,GDPR,HIPAA}
    [ops]+{12GB-RAM,Docker,K8s,airgapped}
    [i18n]+{ICU,multi-lang}
L1->[software-product-management] checkmark
Requirements: L4[multi-layout views, import/export, integration ecosystem]
            + L3[monorepo build chain, dual-runtime FE+BE, real-time server]
            + L2[AGPL copyleft, data residency, auth matrix, rate limiting]
```

---

## Phase 1: Top-Down Intent Inference

### Why? Recursion (W-functor)

```text
"Build an open-source project management tool"
  -> why? "To let teams track issues, run cycles, and manage roadmaps"
  -> why? "To replace chaotic, expensive, or locked-in PM tools"
  -> why? "To give teams autonomy over how they plan and ship work"
  -> why? "To maximize team effectiveness while preserving freedom of choice"
  -> why? "Effective, autonomous teams are intrinsically valuable"
         <- tautology (fixed point)
```

### Mission Quality Gate

1. **Single sentence:** Yes -- one statement.
2. **Invariant test:** Changing any Goal (e.g., swap "cycles" for "sprints," drop "pages") does not invalidate the Mission. Teams can be effective and autonomous via many feature configurations.
3. **Tautology test:** Asking "why is team effectiveness with freedom of choice valuable?" yields a restatement -- confirmed fixed point.

---

## Mission

Maximize team effectiveness in planning and shipping work while preserving freedom of choice over tools, data, and process.

W-functor chain: open-source PM tool -> track/plan/ship work -> replace chaotic/locked-in tools -> team autonomy in planning -> effective autonomous teams -> intrinsic value (tautology)

---

## Goals

1. **Flexible work tracking** -- Provide multi-layout (Kanban, list, calendar, Gantt, spreadsheet) work item management with customizable properties, states, labels, types, and templates.
2. **Iterative planning** -- Enable time-boxed Cycles with burn-down charts, feature-scoped Modules, Epics, Initiatives, and Milestones for hierarchical planning.
3. **Collaborative knowledge capture** -- Offer rich-text Pages with inline comments, wiki hierarchies, AI-assisted editing, and real-time collaborative editing.
4. **Actionable analytics** -- Deliver dashboards, custom queries (Plane Query Language), and real-time performance insights across all project data.
5. **Ecosystem integration** -- Connect natively with developer tools (GitHub, GitLab, Sentry, Slack) and expose API, webhooks, and MCP servers for custom integrations.
6. **Zero-lock-in data portability** -- Support import from Jira, Linear, Asana, Notion, ClickUp, Confluence, CSV, and Flatfile; support export of all data.
7. **Self-hostable with full data sovereignty** -- Provide Docker Compose, Kubernetes, Swarm, Podman, and airgapped deployment options so organizations own their data.
8. **Internationalization** -- Support multiple languages with ICU message formatting and community-contributed translation packs.
9. **Workflow automation** -- Provide configurable automations, approval workflows, recurring items, and intake channels (forms, email, inbox).

---

## Premises

| # | Premise | Source | Risk if false |
|---|---------|--------|---------------|
| P1 | Target users are software/product teams already familiar with issue-tracking paradigms (Kanban, sprints, epics) | Inferred from README tagline "track issues, run cycles, manage product roadmaps" and feature set | If users are non-technical, the UX complexity (PQL, state machines, modules vs. cycles distinction) becomes a barrier to adoption |
| P2 | Self-hosting users have access to infrastructure capable of running Docker with at least 12 GB RAM, PostgreSQL 15, Redis/Valkey, and RabbitMQ | CONTRIBUTING.md explicit requirement; docker-compose.yml service definitions | **HIGH RISK** -- If false, self-hosting fails entirely; the "data sovereignty" Goal (G7) becomes unachievable for resource-constrained teams |
| P3 | The AGPL-3.0 license is acceptable to the target audience, including enterprises evaluating self-hosting | LICENSE.txt (AGPL-3.0); inferred from open-source positioning | If enterprises cannot accept AGPL copyleft obligations (network use = source disclosure), adoption in regulated/proprietary environments collapses; undermines Mission |
| P4 | A Django + React monorepo architecture can scale to serve the full feature surface (real-time collab, analytics, automations) without excessive operational complexity | Inferred from tech stack: apps/api (Django), apps/web (React), apps/live (Node.js live server), Turborepo build | If false, architectural refactoring (microservices split, separate real-time service scaling) becomes necessary; delays feature delivery |
| P5 | Community contributors will maintain translation packs for non-English languages | CONTRIBUTING.md translation guidelines; packages/i18n locale structure | If false, i18n coverage remains English-only or stale; limits global adoption |
| P6 | S3-compatible object storage (MinIO or AWS S3) is available for file uploads | .env.example AWS/MinIO configuration; docker-compose.yml minio service | If false, file upload functionality (attachments, page images) is non-functional; degrades core work-item and pages experience |
| P7 | Users migrating from other PM tools (Jira, Linear, etc.) have exportable data in supported formats | Inferred from importer feature set on docs.plane.so | If false, data migration path breaks; adoption friction increases significantly |
| P8 | Real-time collaboration requires a dedicated Node.js live server alongside the Django API | docker-compose.yml "live" service; apps/live directory | If false (e.g., Django handles real-time via Django Channels), the live service is redundant overhead; if true and the live server fails, collaborative editing degrades |

**HIGH RISK premises:** P2 (infrastructure requirements gate self-hosting viability) and P3 (AGPL-3.0 acceptance gates enterprise adoption). Both can invalidate the Mission if false.

---

## Constraints

### Hard (violation = rejection)

| # | Constraint | Source |
|---|-----------|--------|
| C1 | Licensed under AGPL-3.0; all modifications exposed over a network must provide source code to users | LICENSE.txt -- legal mandate |
| C2 | Backend must run on Python 3.8+ with Django and Django REST Framework | CONTRIBUTING.md system requirements; apps/api/pyproject.toml |
| C3 | Frontend must use React 18 with TypeScript in strict mode | AGENTS.md code style; pnpm-workspace.yaml catalog |
| C4 | PostgreSQL 15 is the sole supported RDBMS (max_connections=1000 configured) | docker-compose.yml postgres:15.7-alpine; .env.example |
| C5 | All frontend code must pass OxLint and oxfmt checks before merge | AGENTS.md; package.json lint-staged; .oxlintrc.json, .oxfmtrc.json |
| C6 | API key rate limit enforced at 60 requests/minute by default | .env.example API_KEY_RATE_LIMIT="60/minute" |
| C7 | File upload limit capped at 5 MB by default (FILE_SIZE_LIMIT=5242880) | .env.example; docker-compose.yml proxy environment |
| C8 | Authentication required for all non-public operations; supports OAuth (Google, GitHub, GitLab), OIDC, SAML, and LDAP | Inferred from developer docs SSO/auth section; .env.example CORS settings |
| C9 | CORS restricted to explicitly allowed origins | apps/api/.env.example CORS_ALLOWED_ORIGINS |
| C10 | Node.js >= 22.18.0 required for frontend builds | package.json engines field |
| C11 | pnpm 10.32.1 is the mandatory package manager | package.json packageManager field |
| C12 | Copyright headers required on all source files | COPYRIGHT_CHECK.md; inferred from repo structure |
| C13 | Hard-delete of files enforced after 60-day retention period | apps/api/.env.example HARD_DELETE_AFTER_DAYS=60 |
| C14 | Responsible vulnerability disclosure required; no public disclosure before investigation | SECURITY.md policy |

### Soft (violation = penalty)

| # | Constraint | Source |
|---|-----------|--------|
| S1 | Minimum 12 GB RAM recommended for local development/self-hosting | CONTRIBUTING.md warning; 8 GB may cause crashes |
| S2 | All features should have unit test coverage | CONTRIBUTING.md coding guidelines ("must be tested by one or more specs") |
| S3 | Real-time collaborative editing preferred via dedicated live server (Node.js) | docker-compose.yml live service; inferred from apps/live |
| S4 | Internationalization: all new UI strings must be added to every language file, even if untranslated (English placeholder) | CONTRIBUTING.md translation quality checklist |
| S5 | Signed URL expiration defaults to 1 hour (3600s) for S3 object access | apps/api/.env.example SIGNED_URL_EXPIRATION |
| S6 | Gunicorn workers default to 2; should scale with deployment size | apps/api/.env.example GUNICORN_WORKERS=2 |
| S7 | Sentry integration for error tracking and session recording strongly recommended | turbo.json globalEnv SENTRY_* variables |
| S8 | Turborepo used as build orchestrator with concurrency=18 for dev | package.json scripts; turbo.json configuration |
| S9 | MobX is the state management pattern; reactive stores live in packages/shared-state | AGENTS.md state management guidance |
| S10 | Deployment behind a reverse proxy recommended for production (SSL termination, HTTPS) | docker-compose.yml proxy service; .env.example CERT_* variables |

---

## Mission Space

### Evaluated Alternatives

| Alternative | Fit Against Hard Constraints | Notes |
|------------|------------------------------|-------|
| **Microservices architecture** (split API into domain services) | Compatible with C1-C14 | Would increase operational complexity but improve independent scaling of work-items, pages, analytics. Current monolith-with-sidecar (live server) is simpler. |
| **Next.js/SSR instead of React SPA + Vite** | Violates C3 (React Router 7 is committed) | Would enable SSR for SEO on public spaces but conflicts with current build system commitments. |
| **GraphQL API instead of REST** | Compatible | Would reduce over-fetching for complex dashboard views; current REST + SWR approach is simpler and well-established. |
| **SQLite for lightweight self-hosting** | Violates C4 (PostgreSQL mandated) | Would lower the self-hosting bar dramatically but sacrifices concurrent write performance and advanced query features. |
| **MIT/Apache-2.0 license** | Violates C1 (AGPL-3.0 chosen) | Would increase enterprise adoption but removes copyleft protection that incentivizes community contribution. |
| **Electron desktop app** | Compatible | Would address offline-first use case but adds significant maintenance burden; current web-only approach covers most users. |

### Domain Context

- **Competitive landscape:** Plane competes directly with Jira, Linear, Asana, ClickUp, and Notion's project features. Its differentiators are open-source availability, self-hosting with full data sovereignty, and the AGPL license ensuring community benefit.
- **Ecosystem dynamics:** The importers (Jira, Linear, Asana, Notion, ClickUp) signal that Plane positions itself as a migration target rather than a greenfield-only tool. Data portability is a strategic moat.
- **AGPL implications:** The AGPL-3.0 license means any organization running a modified Plane instance as a network service must offer source code to its users. This is a deliberate strategic choice to prevent proprietary forks while allowing commercial self-hosting (Plane Cloud exists as the SaaS offering).
- **Infrastructure weight:** The 12 GB RAM minimum, PostgreSQL, Redis, RabbitMQ, and MinIO stack is heavy for a "simple" PM tool. This reflects the breadth of features (real-time editing, background workers, message queues, file storage) rather than inefficiency.
- **Monorepo trade-offs:** The Turborepo + pnpm workspace approach with 15+ packages ensures code sharing but demands Node.js 22+ and careful dependency management. The dual-runtime (Python backend + Node.js frontend/live) adds operational surface.

### Knowledge Gaps

1. **Monetization model** -- The repo does not describe how Plane Cloud pricing works or what features are gated behind a commercial license vs. the AGPL community edition.
2. **Horizontal scaling guidance** -- No explicit documentation on scaling beyond a single Docker Compose instance (e.g., read replicas, worker auto-scaling, Redis clustering).
3. **Offline/local-first capability** -- No evidence of offline support or local-first data sync; unclear if this is a non-goal or a future roadmap item.
4. **Performance benchmarks** -- No stated targets for concurrent users, work item volume, or API response times.
5. **Accessibility (WCAG) compliance** -- No mention of accessibility standards in CONTRIBUTING.md or AGENTS.md; unclear if the UI meets WCAG 2.1 AA.
6. **Backup/disaster recovery procedures** -- Developer docs reference backup/restore but the repo contains no concrete backup scripts or documented RPO/RTO targets.
7. **Plugin/extension architecture** -- Integrations exist (GitHub, Slack, etc.) but no formal plugin SDK or extension API beyond webhooks and the MCP server.
8. **Mobile experience** -- No native mobile app in the repo (only web/admin/space/live/proxy apps). Unknown whether a responsive PWA or native app is planned.
