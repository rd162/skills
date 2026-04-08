# Bun vs Deno: Greenfield TypeScript Backend Evaluation

> **⚠ Degraded Mode — Training Knowledge Only**
> Web search tools were unavailable during this research session (permission denied).
> All claims below are based on training knowledge with a cutoff of August 2025.
> External verification was not possible. Treat version-specific claims and benchmark
> numbers as potentially outdated. Re-verify against official documentation and current
> benchmarks before making a final decision.
>
> _Researched: 2026-03-26 | Protocol: Δ1-Δ7 (degraded — no external tools)_

---

## Executive Summary

**For a greenfield TypeScript backend in 2026, Bun is the stronger choice on raw performance and tooling speed, while Deno 2.x is the stronger choice on security, standards compliance, and long-term ecosystem stability.** The decision hinges on your team's risk tolerance and operational profile:

- **Choose Bun** if: raw throughput and developer iteration speed are paramount, your team is already deep in the npm ecosystem, and you're comfortable with a younger runtime that moves fast.
- **Choose Deno** if: you prioritize security-by-default, Web API standards alignment, and a more mature governance model — and you're willing to accept slightly lower raw performance in exchange.

Both are production-viable in 2025. Neither is a clear-cut winner across all four dimensions you specified.

---

## 1. Runtime Performance

### Bun

Bun is built on JavaScriptCore (JSC, the WebKit engine) rather than V8. This architectural choice gives it a distinctive performance profile:

- **HTTP throughput**: In widely-cited benchmarks (TechEmpower, custom HTTP server benchmarks), Bun's native `Bun.serve()` consistently outperforms Deno's native HTTP server by 1.5–3x in requests-per-second for simple JSON endpoints. (Source: bun.sh/benchmarks, T2; TechEmpower composite, T1-adjacent)
- **Startup time**: Bun starts faster than Deno for small scripts — measured in milliseconds vs. tens of milliseconds for cold-start scenarios. This matters for serverless/edge deployments.
- **TypeScript transpilation**: Bun strips types natively (no separate compilation step) using its internal Zig-based transpiler, which is significantly faster than both `tsc` and `esbuild` for simple transpilation tasks.
- **I/O**: File I/O benchmarks favor Bun, attributed to its Zig-level system call integration.

**Caveats**: JSC vs. V8 means different JIT behavior at scale. For long-running, compute-intensive workloads (e.g., CPU-bound algorithms, large object churn), V8's JIT may outperform JSC in specific patterns. Bun's benchmarks are strongest for I/O-bound, network-heavy workloads — exactly what a typical backend service looks like.

### Deno

Deno runs on V8 (same engine as Node.js and Chrome), which means:

- Battle-tested JIT compilation with years of optimization
- Predictable performance characteristics in production
- `Deno.serve()` (introduced in Deno 1.35, stabilized in Deno 2.x) is performant, though trails Bun's native server
- Deno 2.x introduced significant performance improvements; the gap vs. Bun narrowed but did not close as of mid-2025

**Performance verdict**: Bun wins on raw throughput and startup latency for I/O-bound workloads. Deno wins on predictability and long-running compute due to V8's mature JIT. For a typical REST/GraphQL backend, Bun's advantage is real and measurable.

---

## 2. npm Ecosystem Compatibility

### Bun

Bun's explicit design goal is Node.js compatibility. It ships with:

- A built-in Node.js-compatible module resolver (`require`, `import`, `node_modules`)
- `bun install` — a drop-in replacement for `npm install`, significantly faster (often 10–25x) due to a binary lockfile format and aggressive caching
- Built-in support for `.env` files, `package.json` scripts, and most Node.js built-in modules (`fs`, `path`, `http`, `crypto`, etc.)
- `node:` prefix support
- Compatibility with Express, Fastify, Hapi, Prisma, Drizzle, TypeORM, and most major npm packages

**Known gaps** (as of mid-2025): Some packages that rely on native Node.js addons (`.node` files built with `node-gyp`) may not work. Packages using obscure Node.js internals or undocumented APIs have occasional issues. Bun tracks Node.js compatibility very aggressively, and gaps shrink with each release.

**Practical compatibility**: For the vast majority of npm packages used in a greenfield TypeScript backend (ORMs, HTTP frameworks, validation libs, auth libs, cloud SDKs), Bun works without modification.

### Deno

Deno's compatibility story changed dramatically with Deno 2.0 (released October 2024):

- **`npm:` specifiers**: `import express from "npm:express"` works without a separate install step
- **node_modules support**: Deno 2.x can use a `node_modules` directory when `nodeModulesDir` is enabled in `deno.json`
- **Node.js built-in compatibility**: Substantially improved; `node:fs`, `node:path`, `node:crypto` etc. work
- **`package.json` support**: Deno 2.x reads `package.json` for dependency management, enabling a hybrid workflow

**Known gaps**: Some packages still fail due to Deno's stricter security model (require explicit permissions) or Node.js API gaps. The compatibility is good but not as seamless as Bun's. Heavy npm-centric toolchains (e.g., some monorepo tools) may need configuration.

**Practical compatibility**: Deno 2.x is a major improvement over 1.x. Most production npm packages work. But "Bun just works" more consistently than "Deno just works" for arbitrary npm packages.

**npm ecosystem verdict**: Bun wins. Its Node.js compatibility is more complete and more seamless. Deno 2.x is competitive but requires more configuration for complex npm dependency trees.

---

## 3. Tooling Maturity

### Bun

Bun ships as an all-in-one toolkit:

- **Runtime**: `bun run`
- **Package manager**: `bun install` (fast, binary lockfile)
- **Test runner**: `bun test` (Jest-compatible API, no config needed)
- **Bundler**: `bun build` (fast, ESM/CJS output, tree-shaking)
- **TypeScript support**: Native (no `tsc` required for running; `bun --hot` for hot reload)
- **Watch mode**: `--watch` / `--hot` flags built-in
- **Shell scripting**: `bun shell` (cross-platform shell built-in)

**Strengths**: Bun's integrated toolchain eliminates the need to configure separate tools. A new project can go from zero to running TypeScript with tests in minutes with zero config.

**Weaknesses**:
- Bun is a younger project (v1.0 shipped September 2023). Its bundler and test runner have had more breaking changes than Node.js equivalents
- Plugin ecosystem for `bun build` is less mature than Webpack/Vite/esbuild
- `bun test` lacks some advanced Jest features (e.g., code coverage integration is improving but not at par with Jest + c8/v8)
- Official Bun-specific documentation and community tutorials are thinner than Node.js/Deno equivalents

### Deno

Deno also ships an integrated toolkit but with a longer track record:

- **Runtime**: `deno run`
- **Package manager**: `deno install` / `npm:` specifiers / JSR (Deno's own registry)
- **Test runner**: `deno test` (mature, permission-aware, built-in coverage)
- **Bundler**: `deno compile` (produces standalone executables), `deno bundle` (deprecated in favor of esbuild/Rollup integration)
- **Formatter**: `deno fmt` (opinionated, no config)
- **Linter**: `deno lint` (built-in, fast)
- **Type checker**: `deno check` (runs full `tsc` type checking — a genuine differentiator)
- **LSP**: `deno lsp` (first-class VS Code extension)

**Strengths**:
- `deno lint` and `deno fmt` are more mature and opinionated than Bun equivalents
- `deno test` has stronger coverage tooling (`deno coverage`)
- JSR (JavaScript Registry) is a new package registry designed for TypeScript-first packages with built-in type information and provenance
- Deno's VS Code extension and LSP are highly polished
- `deno check` catches type errors without a separate build step — genuinely useful in CI

**Weaknesses**:
- `deno bundle` was deprecated, leaving bundling to external tools — a gap
- JSR adoption is early; most packages are still on npm

**Tooling verdict**: Draw, with different strengths. Bun wins on speed (install, test execution, transpilation). Deno wins on linting, formatting, type checking integration, and LSP quality. For a team that wants zero-config opinionated tooling, Deno's built-in `fmt`/`lint`/`check` is more mature. For a team that wants speed above all, Bun wins.

---

## 4. Production Readiness in 2025

### Bun

**Maturity signals**:
- v1.0 released September 2023; v1.1 released April 2024; active release cadence
- Used in production by several startups and smaller companies
- Cloudflare Workers does NOT support Bun (uses V8-based runtime)
- Fly.io, Railway, and Render support Bun via Docker
- AWS Lambda: works via Docker container images
- No dedicated Bun-managed cloud hosting (unlike Deno Deploy)

**Stability concerns**:
- Semantic versioning adopted but patch releases sometimes contain behavior changes
- The JSC engine is less battle-tested than V8 at scale for server-side workloads
- Bun's SQLite integration and other bundled features are convenient but add attack surface
- Windows support improved significantly in 2024 but Linux/macOS remain primary targets

**Production signals**: Bun is used in production but predominantly by early adopters. It is production-ready for services with: moderate traffic, teams comfortable debugging at the runtime level, non-critical financial/medical workloads.

### Deno

**Maturity signals**:
- Deno 1.0 released May 2020; Deno 2.0 released October 2024; 5+ years of development
- Ryan Dahl (Node.js creator) and a dedicated team at Deno Land Inc.
- **Deno Deploy**: Managed edge hosting, globally distributed, stable service
- Used in production by more organizations than Bun, including some enterprises
- Cloudflare Workers: partial compatibility (uses V8, similar APIs)
- AWS Lambda, Fly.io, Railway, GCP Cloud Run: all supported

**Stability signals**:
- 2.0 was a breaking change release, but the upgrade path was well-documented
- V8 engine means predictable, well-understood performance characteristics
- Security model (explicit permissions) is a genuine production advantage — no accidental network or filesystem access
- Deno's permission model surfaces configuration errors early rather than at runtime

**Production signals**: Deno 2.x is production-ready with a track record. Larger organizations (including some enterprises) are running Deno in production. Deno Deploy removes infrastructure concerns for edge scenarios.

**Production readiness verdict**: Deno wins on overall maturity, governance, security model, and managed hosting options. Bun wins on raw performance and developer experience speed. For a greenfield service where correctness and security are important, Deno's production track record is stronger.

---

## 5. CoK Graph Summary (Key Triples)

```
(Bun, built_on, JavaScriptCore)
(Deno, built_on, V8)
(Bun, performance_for_IO_workloads, higher_than_Deno)
(Deno, security_model, permission-based_sandboxing)
(Bun, npm_compatibility, seamless)
(Deno_2x, npm_compatibility, good_but_requires_configuration)
(Bun, all_in_one_toolchain, faster_but_younger)
(Deno, all_in_one_toolchain, slower_but_more_mature)
(Deno, managed_hosting, Deno_Deploy_available)
(Bun, managed_hosting, DIY_Docker_only)
(Deno, production_track_record, 5_years)
(Bun, production_track_record, 2_years)
(Bun, v1.0_release, September_2023)
(Deno, v2.0_release, October_2024)
```

---

## 6. Decision Matrix

| Dimension                    | Bun          | Deno         | Winner     |
|-----------------------------|--------------|--------------|------------|
| Raw HTTP throughput          | ★★★★★        | ★★★★☆        | Bun        |
| Startup latency              | ★★★★★        | ★★★★☆        | Bun        |
| npm ecosystem compatibility  | ★★★★★        | ★★★★☆        | Bun        |
| Package install speed        | ★★★★★        | ★★★☆☆        | Bun        |
| Type checking integration    | ★★★☆☆        | ★★★★★        | Deno       |
| Linting / formatting         | ★★★☆☆        | ★★★★★        | Deno       |
| Test runner maturity         | ★★★★☆        | ★★★★★        | Deno       |
| Security model               | ★★★☆☆        | ★★★★★        | Deno       |
| Production track record      | ★★★☆☆        | ★★★★★        | Deno       |
| Managed hosting options      | ★★★☆☆        | ★★★★★        | Deno       |
| LSP / IDE experience         | ★★★☆☆        | ★★★★★        | Deno       |
| Standards compliance         | ★★★★☆        | ★★★★★        | Deno       |
| Community / ecosystem size   | ★★★☆☆        | ★★★★☆        | Deno       |
| Developer velocity (speed)   | ★★★★★        | ★★★★☆        | Bun        |

**Score: Bun 5 wins, Deno 9 wins** (across these 14 dimensions)

---

## 7. Recommendation

### Primary recommendation: **Deno 2.x**

For a greenfield TypeScript backend service prioritizing production readiness in 2025-2026, Deno 2.x is the more defensible choice:

1. **Longer track record** (5 years vs. 2 years) with documented upgrade paths
2. **Security-by-default** eliminates entire classes of supply-chain and misconfiguration risks
3. **Deno Deploy** provides a managed, zero-infrastructure deployment path
4. **Standards compliance** means skills and code are more portable (to Cloudflare Workers, other Web API-compatible environments)
5. **Tooling maturity** — `deno fmt`, `deno lint`, `deno check`, `deno test` are more robust for team use

The performance gap vs. Bun is real but often irrelevant: most backend bottlenecks are database I/O or external API latency, not runtime throughput. The difference between 80,000 req/s (Deno) and 160,000 req/s (Bun) rarely matters when your PostgreSQL query takes 10ms.

### When to choose Bun instead

- Your team is already heavily invested in the npm/Node.js ecosystem and wants zero migration friction
- Raw performance is a hard requirement (e.g., a high-frequency trading system, a real-time game server)
- You're building something where fast iteration speed and zero-config tooling outweigh governance stability
- You need the fastest possible `npm install` in CI (Bun's package manager alone may justify it even if you use another runtime)

### Risk mitigation for either choice

- **Bun**: Pin versions strictly. Use a Docker-based deployment to avoid host dependency issues. Test your specific npm dependencies before committing.
- **Deno**: Audit your permission grants. Keep `deno.json` under version control. Test npm package compatibility early in the project.

---

## 8. Sources and Evidence Quality

**⚠ All sources below are training-knowledge references, not live-verified URLs.**
Web search was unavailable. These claims should be verified against current documentation.

| Claim | Source (training ref) | Tier |
|-------|----------------------|------|
| Bun built on JavaScriptCore | bun.sh official documentation | T1 |
| Deno built on V8 | deno.land official documentation | T1 |
| Bun v1.0 released September 2023 | Bun announcement blog | T2 |
| Deno 2.0 released October 2024 | Deno announcement blog | T2 |
| Bun HTTP benchmarks vs Deno | bun.sh/benchmarks | T2 (self-reported) |
| Deno 2.x npm compatibility improvements | Deno 2.0 release notes | T1 |
| Deno permission model | deno.land/manual | T1 |
| Deno Deploy availability | deno.com/deploy | T1 |
| JSR registry launched | jsr.io | T1 |
| `deno bundle` deprecated | Deno changelog | T1 |

---

## CONTRADICTIONS NOTED

1. **Benchmark trustworthiness**: Bun's self-reported benchmarks (T2, bun.sh/benchmarks) show dramatic performance leads. Independent benchmarks (TechEmpower, community) show smaller gaps. Trust independent sources over vendor benchmarks.

2. **"Production ready" framing**: Both projects' official documentation claims production readiness. Independent evidence (community adoption, incident reports, enterprise usage) is harder to verify without live search. Deno's longer existence provides more evidence by default.

3. **npm compatibility**: Bun claims "Node.js compatibility" broadly; in practice some edge cases exist. Deno 2.x claims npm compatibility as a new feature, which may be under-tested for complex dependency graphs.

---

## GAPS (what remains unclear without live search)

- Specific benchmark numbers as of 2026 (performance gap may have narrowed or widened)
- Deno 2.1+ release contents and any changes since August 2025 training cutoff
- Bun versions beyond 1.1 and any stability improvements
- Real-world production incident reports for both runtimes
- Current enterprise adoption data
- JSR ecosystem growth since mid-2025

---

_Researched: 2026-03-26 | Protocol: Δ1-Δ7 degraded (training knowledge only) | CoK levels: L0-L2 | Confidence: MEDIUM-LOW (no external verification)_
