# Knowledge Artifact: User Auth Migration — JWT to OAuth2 via Auth0

**Date materialized:** 2026-06-26
**Source:** Engineering context summary (verbal debrief)
**Type:** Mixed — Narrative + Procedure + Fact

---

## 1. Facts

| # | Fact | Confidence |
|---|------|------------|
| F1 | The legacy auth system used JWT tokens with a security vulnerability: tokens were not expiring properly. | High |
| F2 | Auth0 was selected as the OAuth2 provider to replace the in-house JWT implementation. | High |
| F3 | The migration duration was 3 weeks. | High |
| F4 | Week 1 covered middleware updates. | High |
| F5 | Week 2 covered the token refresh flow. | High |
| F6 | Week 3 covered migration of existing sessions. | High |
| F7 | Mobile app clients required special handling for the new token format. | High |
| F8 | The system is currently live on OAuth2/Auth0. | High |
| F9 | Automated cleanup of expired tokens is not yet implemented; it is on the backlog. | High |

---

## 2. Concepts

### Auth Migration Pattern
Replacing an in-house authentication mechanism (JWT) with a managed identity provider (Auth0/OAuth2) is a standard pattern when:
- The in-house implementation carries a security flaw (here: non-expiring tokens).
- Long-term maintenance cost of rolling one's own auth is judged too high.

### OAuth2 vs JWT (as used here)
- JWT was used as a self-contained bearer token; the flaw was token lifetime not being enforced server-side.
- OAuth2 via Auth0 offloads token issuance, expiry, and refresh to the provider, reducing the surface for this class of bug.

### Token Refresh Flow
A refresh flow allows a client to obtain a new access token using a long-lived refresh token, without requiring the user to re-authenticate. Implementing this (Week 2) is necessary to replace the previous implicit "never-expire" behavior with proper short-lived access tokens.

### Session Migration
Existing authenticated sessions had to be transitioned to the new token format without logging all users out (Week 3). This is one of the higher-risk steps in an auth migration.

### Mobile Client Token Handling
Mobile clients (iOS/Android) typically cache tokens and may have stricter parsing of token formats. A format change between JWT and Auth0-issued tokens (e.g., issuer claim, audience, key IDs) can break mobile auth flows, requiring client-side updates or adapter logic.

---

## 3. Procedures

### 3.1 Migration Procedure (as executed)

**Goal:** Replace JWT-based authentication with OAuth2 via Auth0 without service interruption.

**Steps:**
1. **Week 1 — Middleware update**
   - Update server-side auth middleware to validate Auth0-issued tokens instead of self-issued JWTs.
   - Run both validation paths in parallel if dual-write/parallel mode was used (inferred).

2. **Week 2 — Token refresh flow**
   - Implement the OAuth2 refresh token grant.
   - Ensure clients (web, mobile) can silently obtain new access tokens.
   - Validate short token lifetimes are enforced end-to-end.

3. **Week 3 — Session migration**
   - Migrate active sessions from the legacy JWT format to Auth0 tokens.
   - Handle mobile client edge cases (special token format handling).
   - Validate production traffic on the new auth path.
   - Cut over fully; decommission or disable legacy JWT issuance.

### 3.2 Remaining Procedure (Backlog)

**Goal:** Automated cleanup of expired tokens.

**Steps (not yet implemented):**
1. Identify the token/session store that may accumulate expired records.
2. Implement a scheduled job (cron / background worker) to purge expired tokens.
3. Add monitoring/alerting to confirm cleanup is running.
4. Test that cleanup does not affect active sessions.

---

## 4. Narrative

The user auth team identified a security vulnerability in the JWT implementation where tokens were not expiring as intended. The root cause was in the in-house token validation logic rather than the JWT standard itself. The decision was made to migrate to Auth0 (an OAuth2-compliant managed identity provider) rather than patch the existing implementation, trading short-term migration effort for long-term reduction in auth maintenance overhead.

The migration was structured as a 3-week phased rollout:

- **Week 1** addressed the backend — updating middleware so the server could accept and validate Auth0-issued tokens.
- **Week 2** addressed the lifecycle of tokens — implementing the refresh flow so that clients could renew short-lived access tokens without user friction.
- **Week 3** was the highest-risk phase: migrating existing live sessions. A complication arose from mobile app clients, which needed special handling because the Auth0 token format differed from the legacy JWT in ways that the mobile clients did not tolerate out of the box.

The migration is now complete and the system is live. One open item remains: automated cleanup of expired tokens in the session store. While Auth0 handles token expiry at the provider level, residual records in the application's own session store need a background sweep job. This work is deferred to the backlog.

---

## 5. Open Items / Risks

| ID | Item | Priority | Status |
|----|------|----------|--------|
| OI-1 | Automated session cleanup for expired tokens | Medium | Backlog |
| OI-2 | Confirm mobile client edge-case coverage is complete | Low | Assumed closed (system live) |
| OI-3 | Decommissioning / disabling legacy JWT issuance path | Unknown | Status not stated in context |

---

## 6. Knowledge Gaps

- **KG-1:** Was a parallel/dual-write mode used during migration, or was there a hard cutover? (Risk to session continuity.)
- **KG-2:** What is the token/session store (Redis, DB table, etc.)? Needed to implement OI-1.
- **KG-3:** What specific handling was added for mobile clients — client-side fix, server-side adapter, or both?
- **KG-4:** Are there other non-mobile client types (desktop apps, third-party integrations) that may also have token format sensitivity?
- **KG-5:** Has the original JWT vulnerability been documented in a security post-mortem or CVE?

---

## 7. Relations

```
[JWT Vulnerability] --caused--> [Auth Migration Decision]
[Auth Migration Decision] --selected--> [Auth0 (OAuth2 Provider)]
[Auth Migration] --phase-1--> [Middleware Update]
[Auth Migration] --phase-2--> [Token Refresh Flow]
[Auth Migration] --phase-3--> [Session Migration]
[Session Migration] --complication--> [Mobile Client Token Handling]
[Auth Migration] --status--> [Live / Complete]
[Expired Token Cleanup] --status--> [Backlog / Open]
```
