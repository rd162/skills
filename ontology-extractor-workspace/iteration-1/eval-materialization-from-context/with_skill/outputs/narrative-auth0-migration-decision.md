---
title: Narrative - Auth0 Migration Decision
type: narrative
tier: T3
source_class: llm
version: "1.0"
last_updated: 2026-06-26
description: The decision story behind migrating from a custom JWT implementation to Auth0 OAuth2, triggered by a token expiry security vulnerability.
tags:
  - auth
  - security
  - decision
  - jwt
  - auth0
---

## Revision Management

- [r1] 2026-06-26T00:00:00Z — initial creation (immutable from this point)

---

# Narrative - Auth0 Migration Decision

## Story

The team discovered a security vulnerability in the in-house JWT authentication system: tokens were not expiring as configured. This meant sessions could remain active indefinitely beyond their intended lifetime, posing an unacceptable security risk.

Faced with this vulnerability, the team evaluated options. Rather than patching the custom JWT implementation — which would require identifying and fixing the root cause in bespoke token expiry logic — the team decided to migrate to Auth0, a managed identity provider that handles OAuth2 flows including token lifecycle management externally. This decision offloaded the responsibility for secure token expiry, rotation, and refresh to a specialized, maintained platform.

The migration was scoped and planned as a 3-week effort. The decision represented a strategic shift from owning authentication infrastructure to delegating it to a managed service.

## Observations

- [decision] Team chose Auth0 over patching the custom JWT implementation #strategic
- [rationale] Auth0 delegates token lifecycle responsibility to a managed, audited service #make-vs-buy
- [problem] Custom JWT tokens were not expiring correctly, leaving sessions open indefinitely #security-trigger
- [assumption] The vulnerability was assessed as severe enough to warrant a full migration rather than a targeted fix #unverified
- [fact] Migration was planned as a 3-week phased effort after the decision was made #scope
- [unverified] Whether the vulnerability was actively exploited before discovery is not documented #risk-gap

## Relations

- triggered [[Narrative - JWT-to-OAuth2 Migration Execution]]
- documented_fact [[Fact - JWT Token Expiry Vulnerability]]
- resulted_in [[Concept - Auth0-Based OAuth2 Authentication]]
- requires [[Procedure - JWT Vulnerability Post-Mortem]]
