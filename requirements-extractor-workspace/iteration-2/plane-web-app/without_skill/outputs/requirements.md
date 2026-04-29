# Plane -- Structured Requirements Specification

**Source**: [github.com/makeplane/plane](https://github.com/makeplane/plane) (README, CONTRIBUTING.md, AGENTS.md, SECURITY.md, docker-compose.yml, .env.example, package.json, and repository structure analysis)

**Date extracted**: 2026-04-08

---

## Mission

Provide an open-source, self-hostable project management platform that lets teams track work items, run iterative cycles, manage product roadmaps, and collaborate on documents -- without the overhead of managing the tool itself.

> Core invariant: Teams must be able to plan, track, and ship work in one unified tool that they fully own and control, with zero lock-in and minimal operational burden.

---

## Goals

| ID | Goal | Measurability |
|----|------|---------------|
| G-1 | **Replace proprietary PM tools** (Jira, Linear, Monday, ClickUp) for all team sizes | Market adoption; feature parity tracked against named competitors |
| G-2 | **Enable full project lifecycle management** through Work Items, Cycles, Modules, Views, Pages, and Analytics | Coverage of plan-track-ship workflow; all six feature pillars operational |
| G-3 | **Offer cloud and self-hosted deployment** with equivalent functionality | Both paths documented and tested; feature flags separate edition capabilities |
| G-4 | **Deliver real-time collaboration** on documents and boards | Live service (`apps/live`) operational; concurrent editing without conflicts |
| G-5 | **Provide actionable analytics** across all project data | Analytics module surfaces burn-down charts, trend visualizations, and blocker identification |
| G-6 | **Support internationalization** for a global user base | i18n package with IntlMessageFormat; translations maintained per language via structured JSON |
| G-7 | **Maintain a healthy open-source ecosystem** with community contributions | Active GitHub issues, forum engagement, contributor growth (CONTRIBUTING.md workflow) |
| G-8 | **Enable AI-assisted workflows** (Pages with AI capabilities) | AI integration available in the rich text editor for content generation and transformation |
| G-9 | **Provide public-facing project spaces** for external stakeholders | `apps/space` deploy board allows published/shared views of project data |
| G-10 | **Support flexible work intake and triage** | Intake/inbox system for inbound requests before they become tracked work items |

---

## Premises

| ID | Premise | Evidence |
|----|---------|----------|
| P-1 | **Teams need a single tool, not a suite of disconnected ones.** | Monorepo design; unified data model spanning issues, cycles, modules, pages, and analytics |
| P-2 | **Self-hosting is a first-class deployment model, not an afterthought.** | Docker Compose and Kubernetes deployment guides; Minio for S3-compatible local storage; God Mode for instance administration |
| P-3 | **Data sovereignty matters.** | Self-host option exists explicitly so organizations retain full control over data and infrastructure |
| P-4 | **Project management tools should not require dedicated administrators.** | "Without the chaos of managing the tool itself"; setup.sh one-liner; minimal configuration surface |
| P-5 | **The backend is API-driven and service-oriented.** | Django REST API (`apps/api`) serves all frontends; separate worker and beat-worker services for async processing |
| P-6 | **Real-time collaboration is expected in modern PM tools.** | Dedicated `apps/live` service for WebSocket-based real-time features |
| P-7 | **Rich text and documents are integral to project management, not bolted on.** | Pages feature with AI capabilities and rich text editor built into the core product |
| P-8 | **The frontend is a modular monorepo with shared packages.** | Turborepo with 15+ shared packages (ui, types, shared-state, editor, hooks, i18n, etc.) |
| P-9 | **Background job processing is required for scalability.** | Celery workers + beat scheduler + RabbitMQ message queue in the architecture |
| P-10 | **Multiple user-facing apps serve distinct audiences.** | `web` (main app), `admin` (God Mode instance admin), `space` (public project views) |

---

## Constraints

### Licensing and Legal

| ID | Constraint |
|----|------------|
| C-1 | **AGPL-3.0 license** -- all derivative network services must release source code under the same license |
| C-2 | **Security vulnerabilities must be reported privately** to security@plane.so; no public disclosure until resolved |
| C-3 | Responsible disclosure policy: no automated scanning without consent, no exploitation of discovered vulnerabilities |

### Technical Architecture

| ID | Constraint |
|----|------------|
| C-4 | **PostgreSQL 15** as the sole relational database (no pluggable DB layer) |
| C-5 | **Valkey/Redis 7.2** required for caching and real-time pub/sub |
| C-6 | **RabbitMQ 3.13** required as message broker for async task processing |
| C-7 | **Django (Python)** backend -- all API logic lives in `apps/api/plane/` |
| C-8 | **React + React Router** frontend with Vite build tooling |
| C-9 | **MobX** for client-side state management (via `packages/shared-state`) |
| C-10 | **Node.js >= 22.18.0** required for frontend tooling |
| C-11 | **pnpm** as the exclusive package manager (enforced via `packageManager` field) |
| C-12 | **Turborepo** orchestrates all monorepo build/dev/check commands |
| C-13 | **Docker** required for full-stack local development and production deployment |
| C-14 | **Minimum 12 GB RAM** for development environment; 8 GB may cause crashes |

### Code Quality and Process

| ID | Constraint |
|----|------------|
| C-15 | **OxLint** for linting with shared `.oxlintrc.json` configuration; `--deny-warnings` enforced |
| C-16 | **oxfmt** for code formatting with shared `.oxfmtrc.json` configuration |
| C-17 | **TypeScript strict mode** enabled across all frontend packages |
| C-18 | **All features and bug fixes must have unit tests** |
| C-19 | **Husky + lint-staged** pre-commit hooks enforce formatting and linting on every commit |
| C-20 | **Workspace protocol** (`workspace:*`) for internal package references; `catalog:` for external dependency version management |

### Data and Storage

| ID | Constraint |
|----|------------|
| C-21 | **S3-compatible object storage** required for file uploads (AWS S3 or Minio) |
| C-22 | **Default file upload limit of 5 MB** (`FILE_SIZE_LIMIT=5242880`) |
| C-23 | **API key rate limiting** enforced at 60 requests/minute by default |

### Internationalization

| ID | Constraint |
|----|------------|
| C-24 | All new translation keys must exist in **every language file** simultaneously |
| C-25 | **ICU MessageFormat** syntax required for dynamic content (variables, pluralization) |
| C-26 | Nested JSON structure for translation keys must remain consistent across all languages |

---

## Appendix: Architecture Summary

```
Apps (user-facing):
  web        -- Main project management SPA (port 3000)
  admin      -- Instance administration / God Mode (port 3001)
  space      -- Public project sharing
  api        -- Django REST API backend
  live       -- Real-time collaboration service (WebSocket)
  proxy      -- Nginx reverse proxy / SSL termination

Infrastructure:
  PostgreSQL 15  -- Primary data store
  Valkey/Redis   -- Cache and pub/sub
  RabbitMQ       -- Message broker for Celery workers
  Minio          -- S3-compatible object storage (self-hosted default)

Shared Packages (15):
  types, ui, editor, shared-state, hooks, i18n, constants,
  utils, services, logger, propel, decorators, codemods,
  tailwind-config, typescript-config

Domain Models (from apps/api/plane/db/models/):
  workspace, project, issue, issue_type, cycle, module, page,
  view, state, label, estimate, intake, notification, webhook,
  analytics, asset, draft, deploy_board, favorite, user, session,
  api_token, integration, importer, exporter, sticky, recent_visit
```
