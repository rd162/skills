# Next.js Authentication in 2025/2026: Current Approaches and Trade-offs

Based on 3 verified T1 sources (searched: 2026-03-26), supplemented with training knowledge on individual libraries (marked T4).

---

## The Landscape at a Glance

Next.js v16 (current as of March 2026) officially endorses twelve auth libraries:
**Auth0, Better Auth, Clerk, Descope, Kinde, Logto, NextAuth.js (Auth.js), Ory, Stack Auth, Supabase, Stytch, and WorkOS.**
There is no single "blessed" choice — Next.js endorses a category, not a winner. The decision comes down to hosting model, team size, budget, and how much control you want over your user data.

The key architectural shift from 2023 onward: **authentication logic belongs in Server Actions and a Data Access Layer (DAL), not in middleware/proxy**. Route-level protection in Proxy is explicitly described as "optimistic" and not a substitute for DAL-level checks.

---

## Critical Breaking Change: `middleware.ts` Renamed to `proxy.ts`

In Next.js v16.0.0, `middleware` was deprecated and renamed to **Proxy** (`proxy.ts`). The function export changes from `middleware()` to `proxy()`. A codemod is available:

```bash
npx @next/codemod@canary middleware-to-proxy .
```

This matters for auth because many auth libraries built their route-protection patterns on `middleware.ts`. If you're evaluating libraries today, check whether they've updated their Next.js integration to use `proxy.ts`.

Key behavior change: Proxy now **defaults to Node.js runtime** (stable since v15.5.0). This removes the previous Edge Runtime constraint that complicated some auth library integrations. If your auth library only supports Edge Runtime, Next.js docs now say you may need to use the legacy Middleware file convention instead of Proxy.

Source: [Next.js Proxy API Reference](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) (T1, 2026-03-20)

---

## The Three-Layer Auth Architecture Next.js Recommends

Regardless of which library you pick, Next.js recommends structuring auth as three separate concerns:

### 1. Authentication (who are you?)
Use Server Actions + form + `useActionState` for login/signup. Server Actions always run on the server, making them a secure place for credential handling. Validate form inputs with Zod before touching any database or auth provider API.

### 2. Session Management (are you still logged in?)
Two session types are supported:
- **Stateless (JWT/cookie-based):** Session data encrypted in a cookie. Simpler, lower infrastructure requirements. Use `jose` for JWT signing (Edge-compatible). Recommended for most apps.
- **Database sessions:** Session ID stored client-side, session data in database. More secure (supports instant revocation), higher infra cost. Recommended when you need device management, forced logout, or compliance requirements.

Recommended libraries for DIY session management: **iron-session** (simpler API), **jose** (Edge Runtime compatible, lower-level).

### 3. Authorization (what can you access?)
Two-tiered:
- **Optimistic checks in Proxy (`proxy.ts`):** Read session from cookie only. Used for fast redirects. Do not do database calls here — this runs on every request including prefetches.
- **Secure checks in the DAL:** Use `React.cache()` to memoize session verification per render pass. This is your real security layer. Never rely solely on Proxy.

The recommended DAL pattern:
```ts
// app/lib/dal.ts
import 'server-only'
export const verifySession = cache(async () => {
  const cookie = (await cookies()).get('session')?.value
  const session = await decrypt(cookie)
  if (!session?.userId) redirect('/login')
  return { isAuth: true, userId: session.userId }
})
```

Call `verifySession()` in every Server Component, Server Action, and Route Handler that touches protected data.

Source: [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication) (T1, 2026-03-20)

---

## Auth Library Comparison

### Auth.js (NextAuth v5)
**Type:** Open-source, self-hosted
**License:** ISC (free)

Auth.js (the rebranded NextAuth v5) is the most widely adopted open-source auth library for Next.js. It supports 80+ OAuth providers, email/password, and magic links out of the box. v5 was a major rewrite designed for the App Router:
- `auth()` helper works in Server Components, Server Actions, Route Handlers
- Middleware/Proxy integration for route protection
- Adapters for Drizzle, Prisma, MongoDB, Supabase, and others
- JWT sessions (default) and database sessions supported

**Real-world trade-offs:**
- v5 was in beta for an extended period; stability improved significantly in 2024-2025
- Custom credentials (username/password) require more configuration than OAuth
- Email/password flows need an adapter + database — not plug-and-play
- Large community, abundant tutorials and Stack Overflow answers
- Zero vendor lock-in; you own your data

**Best for:** Teams that want full control, no per-MAU costs, and primarily need OAuth social login. Strong choice for open-source projects or apps with uncertain scale.

Source for v5 features: Training knowledge (T4) — Auth.js docs were inaccessible during this research session.

### Clerk
**Type:** SaaS (hosted)
**License:** Proprietary; free tier available

Clerk provides a complete auth infrastructure as a service. It goes beyond what most libraries cover: it includes pre-built UI components, a user management dashboard, organization/team support, MFA, passkeys, device management, and session activity logs — all accessible via a dashboard, not code.

The Next.js integration is among the most polished available:
- `ClerkProvider` wraps your app
- `auth()` and `currentUser()` server helpers
- Proxy/middleware integration with `clerkMiddleware()`
- Pre-built `<SignIn>`, `<SignUp>`, `<UserButton>` components

**Real-world trade-offs:**
- Free tier: 10,000 monthly active users (generous for early-stage apps)
- Paid tiers kick in at scale — pricing is per-MAU, which can become significant for consumer apps
- You do not own user data directly; it lives in Clerk's infrastructure
- Fastest path to production auth (often under an hour)
- Passkeys and advanced MFA require paid plans
- Compliance and data residency needs can complicate Clerk usage

**Best for:** Startups, SaaS products, teams that want to ship fast and not maintain auth infrastructure. Particularly strong if you need organization/team features (B2B SaaS).

Source for Clerk features: Training knowledge (T4) — Clerk docs were inaccessible during this research session.

### Better Auth
**Type:** Open-source, self-hosted
**License:** MIT (free)

Better Auth is a newer entrant (2024) explicitly designed for the App Router era. It has gained significant adoption quickly due to frustrations with Auth.js v5's beta instability and Clerk's pricing at scale. Features include:
- Email/password with email verification built-in (simpler than Auth.js)
- OAuth providers
- Two-factor authentication
- Organization/team support (without SaaS pricing)
- Passkeys
- TypeScript-first with strong type inference
- Plugin architecture for extending functionality

Better Auth includes a built-in schema and handles database migrations for you (Drizzle and Prisma adapters available).

**Real-world trade-offs:**
- Newer project — smaller community and fewer tutorials than Auth.js
- Documentation is good but less extensive than established options
- Actively maintained and fast-moving; API may have more churn
- Zero cost at any scale; you own your data
- Handles email/password natively without requiring as much manual wiring as Auth.js

**Best for:** Teams that want Auth.js-level control but with better TypeScript ergonomics, built-in email/password, and modern features (passkeys, orgs) without paying Clerk prices.

Source for Better Auth features: Training knowledge (T4) — Better Auth site was inaccessible during this research session. Note that Better Auth is listed by name in the official Next.js v16 documentation auth libraries section.

### Auth0
**Type:** SaaS (hosted)
**License:** Proprietary; free tier available

Auth0 is the enterprise incumbent. It has the deepest feature set (SAML, SCIM provisioning, enterprise SSO, fine-grained authorization), the strongest compliance story (SOC2, HIPAA, GDPR), and the longest track record. The Next.js SDK is maintained but not quite as seamlessly integrated as Clerk's.

**Real-world trade-offs:**
- Free tier is limited (7,500 MAUs)
- Pricing jumps significantly for enterprise features
- More configuration overhead than Clerk
- Strongest choice if you need enterprise SSO (Okta, Azure AD) or complex compliance requirements

**Best for:** Enterprise apps, anything needing SAML/SCIM/enterprise SSO, or regulated industries.

### Supabase Auth
**Type:** Open-source / SaaS hybrid
**License:** Apache 2.0 (self-hosted), or hosted on Supabase

If you're already using Supabase for your database, its built-in auth is the pragmatic choice. Row-Level Security (RLS) integrates directly with auth state, making data access control clean and database-native. Supports email/password, OAuth, Magic Links, and phone.

**Real-world trade-offs:**
- Deep coupling to Supabase ecosystem (not portable if you switch databases)
- Hosted Supabase free tier is generous but has limits
- If you're not using Supabase's database, avoid this option

**Best for:** Apps already on Supabase; particularly strong for database-heavy applications with complex row-level access control.

---

## Decision Framework

| Need | Recommended choice |
|---|---|
| Ship fastest, don't maintain auth infra | Clerk |
| Open-source, primarily OAuth social login | Auth.js (NextAuth v5) |
| Open-source, need email/password + orgs + passkeys | Better Auth |
| B2B SaaS, need team/organization management | Clerk (easiest) or Better Auth (free) |
| Enterprise SSO (SAML, SCIM, Okta, Azure AD) | Auth0 or WorkOS |
| Already on Supabase | Supabase Auth |
| Maximum data sovereignty, on-premise | Ory (self-hosted) |
| High MAU consumer app, cost-sensitive | Auth.js or Better Auth (no per-MAU cost) |

---

## What to Avoid

**Do not put auth logic only in Proxy (`proxy.ts`).** The official Next.js docs are explicit: Proxy performs optimistic checks (cookie reads only), but your real security must live in the DAL. Proxy is bypassed if a user has a valid but stale cookie, and it doesn't run for Server Actions on protected pages.

**Do not do auth checks in Layout components.** Next.js layouts don't re-render on navigation due to partial rendering. Auth state checked in a layout won't update when a user navigates to a new route. Check auth in page components or in the DAL at data-fetch time.

**Do not pass entire user objects to Client Components.** Use DTOs that expose only what the component needs. Use `import 'server-only'` to enforce that auth/session code never leaks to the client bundle. React's experimental `taintUniqueValue` API adds an additional guard against token leakage.

---

## Security Patterns (from official Next.js guidance)

These apply regardless of which auth library you choose:

1. **Server Actions are public endpoints.** Anyone who obtains the action ID can invoke it. Always re-check auth inside every Server Action — do not rely on the calling UI component's access control.
2. **Validate all input in Server Actions.** TypeScript types are not enforced at runtime for Server Action arguments. Use Zod to validate.
3. **CSRF protection is built-in for Server Actions** (POST only, Origin/Host header comparison). Custom Route Handlers (`route.ts`) do NOT have this protection — add it manually.
4. **In production, errors are hashed** — stack traces with sensitive data don't leak to the client. Never run production workloads in dev mode.
5. **Use the DAL pattern for new projects.** For existing large codebases, the HTTP API pattern (treating Server Components like the client and calling your own API endpoints) is safer for incremental migration.

Source: [How to Think About Security in Next.js](https://nextjs.org/blog/security-nextjs-server-components-actions) (T1)

---

## Contradictions and Gaps

**Contradiction:** Next.js docs list 12 auth libraries without ranking or recommending any specific one. Community sentiment (T4) tends toward: Clerk for speed, Better Auth for full-stack open-source, Auth.js for OAuth-only. These community preferences were not directly verifiable against T1 sources in this session.

**Gap:** Individual library docs (Auth.js, Clerk, Better Auth) were not accessible for direct verification in this session. Library-specific details above are based on training knowledge (T4) and should be verified against current documentation before committing to an implementation.

**Note on Next.js version:** The official docs retrieved are for Next.js v16.2.1 (released before 2026-03-20). If you are on Next.js v14 or v15, the `middleware.ts` → `proxy.ts` rename does not apply yet. Check your installed version before migrating.

---

## Sources

- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication) — T1, version 16.2.1, last updated 2026-03-20
- [Next.js Proxy API Reference](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) — T1, version 16.2.1, last updated 2026-03-20
- [How to Think About Security in Next.js](https://nextjs.org/blog/security-nextjs-server-components-actions) — T1, published 2023-10-23 (patterns still current as of 2026)
- Auth.js, Clerk, Better Auth, Auth0, Supabase Auth: Training knowledge (T4) — direct doc access was unavailable during this session; verify library-specific claims before implementing

---

_Researched: 2026-03-26 | Protocol: Δ1-Δ7 | Next.js version at time of research: 16.2.1_
