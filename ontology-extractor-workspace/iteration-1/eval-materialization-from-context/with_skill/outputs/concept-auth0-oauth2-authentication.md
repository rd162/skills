---
title: Concept - Auth0-Based OAuth2 Authentication
type: concept
tier: T3
source_class: llm
version: "1.0"
last_updated: 2026-06-26
description: The authentication model adopted after migration — OAuth2 flows managed by Auth0 replacing custom JWT issuance and validation.
tags:
  - auth
  - oauth2
  - auth0
  - architecture
---

## Revision Management

- [r1] 2026-06-26T00:00:00Z — initial creation, derived from migration context

---

# Concept - Auth0-Based OAuth2 Authentication

Auth0-Based OAuth2 Authentication is the authentication architecture used post-migration, where Auth0 acts as the identity provider and authorization server, issuing OAuth2-compliant tokens that replace the previous custom JWT implementation.

## Definition

In this system, authentication is delegated entirely to Auth0. Clients (web and mobile) obtain access tokens via Auth0's OAuth2 flows. The backend middleware validates these tokens against Auth0's public keys. Token refresh is handled via Auth0's refresh token rotation, and session lifecycle is governed by Auth0's token TTL configuration rather than custom application logic.

## Observations

- [fact] Auth0 replaced an in-house JWT implementation that had a token expiry vulnerability #migration
- [fact] The system covers web clients and mobile app clients, each with distinct token format handling needs #scope
- [decision] Middleware was the first component updated (week 1 of migration) #implementation-order
- [technique] Token refresh flow was handled in week 2, establishing the full OAuth2 lifecycle #implementation
- [fact] Existing sessions were migrated in week 3, completing the cutover #migration
- [problem] Mobile app clients required special handling for the new OAuth2 token format #mobile #compatibility
- [action] Automated session cleanup for expired tokens is still pending (backlog) #backlog
- [constraint] Session cleanup must handle OAuth2 token lifecycle, not JWT-style expiry #requirement

## Relations

- supersedes [[Concept - Custom JWT Authentication]]
- implements [[Fact - JWT Token Expiry Vulnerability]] 
- illustrated_by [[Narrative - JWT-to-OAuth2 Migration Execution]]
- requires [[Procedure - Automated Session Cleanup]]
- requires [[Procedure - Mobile Client OAuth2 Token Handling]]
