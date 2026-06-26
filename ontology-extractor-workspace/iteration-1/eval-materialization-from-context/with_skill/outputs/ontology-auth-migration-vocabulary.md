---
title: Ontology - Auth Migration Vocabulary
type: ontology
tier: T3
source_class: llm
version: "1.0"
last_updated: 2026-06-26
description: Vocabulary governing terms used across the JWT-to-OAuth2 migration knowledge graph, including token types, system components, and migration phase labels.
tags:
  - auth
  - oauth2
  - jwt
  - auth0
  - vocabulary
  - ontology
---

## Revision Management

- [r1] 2026-06-26T00:00:00Z — initial creation, derived from auth migration artifact set

---

# Ontology - Auth Migration Vocabulary

Canonical vocabulary for the auth migration knowledge graph. All artifacts in this graph must use these terms consistently.

## Terms

### Core Domain Terms

| ID | Label | Definition | Scope |
|----|-------|------------|-------|
| `auth:jwt` | JWT (JSON Web Token) | A compact, URL-safe token format encoding claims as a signed JSON payload, used for stateless authentication. In this context refers specifically to the *legacy custom JWT implementation* that had the expiry vulnerability. | Project |
| `auth:oauth2` | OAuth2 | The authorization framework (RFC 6749) used post-migration. In this system, OAuth2 flows are managed by Auth0 and produce access tokens + refresh tokens. | Domain |
| `auth:auth0` | Auth0 | The managed identity provider and authorization server adopted to replace the custom JWT system. Handles token issuance, expiry, and refresh rotation. | Project |
| `auth:access-token` | Access Token | Short-lived credential issued by Auth0 that clients present to access protected API resources. Replaces the JWT in the new system. | Domain |
| `auth:refresh-token` | Refresh Token | Long-lived credential used to obtain a new access token without re-authentication. Introduced as part of the OAuth2 migration. | Domain |
| `auth:token-expiry` | Token Expiry | The configured lifetime of a token after which it is invalid. The failure of token expiry in the legacy JWT system was the security vulnerability that triggered the migration. | Project |
| `auth:session` | Session | A user's authenticated state, spanning one or more access token issuances. Sessions persist beyond individual token lifetimes via refresh tokens. | Domain |
| `auth:middleware` | Auth Middleware | The backend component that intercepts requests to validate authentication tokens. Was the first component updated in week 1 of the migration. | Project |
| `auth:token-refresh-flow` | Token Refresh Flow | The client-server protocol for exchanging an expired access token for a new one using a refresh token. Implemented in week 2 of the migration. | Domain |
| `auth:session-migration` | Session Migration | The process of converting active user sessions from the legacy JWT format to the new Auth0 OAuth2 token format. Completed in week 3. | Project |
| `auth:session-cleanup` | Session Cleanup | Automated process to remove expired or invalid session records from the data store. Currently pending on backlog. | Project |

### Migration Phase Labels

| ID | Label | Definition |
|----|-------|------------|
| `phase:middleware` | Middleware Phase (Week 1) | Backend middleware updated to validate Auth0 tokens instead of legacy JWTs. |
| `phase:refresh` | Refresh Flow Phase (Week 2) | OAuth2 token refresh lifecycle implemented across clients and server. |
| `phase:session-migration` | Session Migration Phase (Week 3) | Existing user sessions migrated to Auth0 OAuth2 token format. |

### Client Types

| ID | Label | Definition |
|----|-------|------------|
| `client:web` | Web Client | Browser-based client. Handled the token format change without special accommodation. |
| `client:mobile` | Mobile Client | Native mobile application. Required special handling for the new OAuth2 token format during migration. |

## Observations

- [fact] This ontology governs a single migration project; terms are project-scoped unless marked Domain #scope
- [fact] `auth:jwt` in this graph always refers to the *legacy vulnerable implementation*, not JWT as a general technology #disambiguation
- [constraint] New artifacts must reference `auth:auth0` (not "Auth0" freeform) and `auth:oauth2` (not "OAuth2" freeform) in relation types when precision matters #governance
- [action] If Auth0 is replaced in future, this ontology should be versioned and the project terms revised #lifecycle

## Relations

- governs [[Fact - JWT Token Expiry Vulnerability]]
- governs [[Concept - Auth0-Based OAuth2 Authentication]]
- governs [[Narrative - Auth0 Migration Decision]]
- governs [[Narrative - JWT-to-OAuth2 Migration Execution]]
- requires [[Procedure - Automated Session Cleanup]]
