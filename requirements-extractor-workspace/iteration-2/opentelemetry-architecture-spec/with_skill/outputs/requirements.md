# OpenTelemetry Architecture Specification: Requirements Extraction

**Source:** OpenTelemetry Specification v1.55.0 — https://opentelemetry.io/docs/specs/otel/overview/
**Input Type:** Specification (normative, with RFC 2119/8174 compliance keywords)
**Extraction Date:** 2026-04-08
**Method:** Requirements Extractor Skill v3.0 (Phase 0 Bottom-Up + Phase 1 Top-Down)

---

## Phase 0: Bottom-Up Requirements Saturation

### CoK Expansion

```
L5→{traces, metrics, logs, baggage, context-propagation, spans, instruments,
     exporters, collectors, resources, semantic-conventions, SDK, API,
     TracerProvider, MeterProvider, LoggerProvider, SpanContext, TraceState,
     sampling, auto-instrumentation, log-bridges}

L4→[signal-architecture]+{independent signals, shared context layer, API/SDK split}
   [telemetry-pipeline]+{collection, processing, export, batching, filtering}
   [instrumentation-model]+{auto-instrumentation, manual instrumentation, library bridges}
   [data-model]+{trace DAGs, metric time-series, log records, resource attributes}

L3→[library-engineering]+{semantic versioning, package separation, plugin interfaces}
   [distributed-systems]+{context propagation, W3C TraceContext, wire protocols, OTLP}
   [SDK-runtime]+{thread safety, concurrency, immutability, no-op defaults}
   [collector-deployment]+{agent mode, standalone mode, pipeline configuration}

L2→[software-engineering]+{backwards compatibility, API stability, deprecation policy}
   [systems-reliability]+{non-blocking I/O, bounded memory, graceful degradation}
   [standards-compliance]+{RFC 2119, W3C TraceContext, Semantic Versioning 2.0.0}
   [vendor-neutrality]+{pluggable exporters, extensibility, no vendor lock-in}

L1→[observability-infrastructure]✓
   (disjoint: application-business-logic → separate domain;
    vendor-specific-backends → separate domain)
```

### Saturation Summary

```
L5→{20+ explicit topics across 4 signals + cross-cutting infrastructure}
L4→[signal-architecture, telemetry-pipeline, instrumentation-model, data-model]
    +{API/SDK split, shared context, plugin interfaces}
L3→[library-engineering, distributed-systems, SDK-runtime, collector-deployment]
    +{SemVer, OTLP, thread safety, agent/standalone modes}
L2→[software-engineering, systems-reliability, standards-compliance, vendor-neutrality]
    +{backwards compatibility, bounded memory, RFC 2119, pluggable exporters}
L1→[observability-infrastructure]✓

Requirements:
  L4[API/SDK separation mandatory, signals must be independent, context shared]
  L3[SemVer required, OTLP required, thread safety for all public APIs]
  L2[never break user applications, bounded resource consumption, vendor-neutral]
```

---

## Phase 1: Top-Down Intent Inference

### W-Functor Chain

```
OpenTelemetry specification
  → why? To standardize how telemetry (traces, metrics, logs) is generated, collected, and exported
  → why? To enable portable, vendor-neutral observability across distributed systems
  → why? To let operators understand and debug production systems regardless of implementation choices
  → why? To maintain reliable, performant software systems
  → why? Reliable systems that serve their users are intrinsically valuable ← tautology
```

---

## Mission

Enable portable, vendor-neutral generation, collection, and export of telemetry data so that any distributed system can be observed and understood regardless of language, framework, or backend choice.

**Quality gate:**
- Single sentence: Yes.
- Invariant test: Changing any individual goal (e.g., dropping metrics support) does not invalidate the mission — the mission holds for any subset of signals. Pass.
- Tautology test: Asking "why?" yields "because understanding production systems is inherently necessary for reliable operation" — circular. Pass.

---

## Goals

1. **Define a universal telemetry data model** — Provide normative data models for traces (span DAGs), metrics (instrument-based time series), logs (structured log records), and baggage (cross-service key-value propagation) that any backend can consume.

2. **Separate API from implementation** — Ensure instrumentation authors depend only on a stable, minimal API package while application owners independently choose and configure SDK implementations.

3. **Enable zero-cost instrumentation when disabled** — The API's minimal/no-op implementation must incur negligible performance overhead, so libraries can instrument unconditionally without penalizing applications that don't enable telemetry.

4. **Provide a pluggable, extensible SDK** — The SDK must separate wire-protocol-independent logic (batching, enrichment, sampling) from protocol-dependent exporters, enabling vendors to add support with minimal code.

5. **Guarantee backwards compatibility across versions** — API and SDK packages must follow Semantic Versioning 2.0.0, with stable APIs getting minimum 3-year long-term support after the next major version.

6. **Support all major languages and runtimes** — Each language implementation must conform to the same specification while adapting to language-specific idioms (implicit vs. explicit context, error handling conventions).

7. **Correlate signals across the distributed system** — Traces, metrics, and logs must share context propagation so they can be correlated by TraceId, SpanId, and Resource attributes in any backend.

8. **Embrace existing ecosystems rather than replacing them** — Especially for logs, the specification must interoperate with established logging libraries rather than requiring greenfield adoption.

---

## Premises

| # | Premise | Source | Risk if false |
|---|---------|--------|---------------|
| P1 | Distributed systems produce telemetry in three fundamental signal types: traces, metrics, and logs | Spec architecture (stated) | Entire signal taxonomy is wrong; additional signal types would require spec redesign |
| P2 | Instrumentation authors and application owners are distinct roles with different dependency needs | Library Guidelines (stated) | API/SDK separation loses its rationale; single-package model would suffice |
| P3 | Third-party libraries will accept a dependency on a stable, minimal API package | Library Guidelines Req. 2 (stated) | No ecosystem adoption; instrumentation remains ad-hoc and vendor-specific |
| P4 | Application owners control their deployment environment and can configure SDK/exporters | Library Guidelines Req. 3 (stated) | SDK plug-in model breaks; instrumentation must be self-configuring |
| P5 | Context can be propagated across service boundaries via text-based carriers (HTTP headers, message metadata) | Context spec + W3C TraceContext (stated) | Cross-service correlation fails; traces break at service boundaries |
| P6 | **HIGH RISK** — Languages provide sufficient runtime mechanisms for implicit or explicit context propagation (thread-locals, async context, coroutine context) | Context spec (inferred from language-specific guidance) | Context propagation is impossible in some runtimes; entire correlation model fails |
| P7 | Performance overhead from telemetry is acceptable if bounded and configurable | Performance spec (stated) | Production systems refuse to enable telemetry; spec becomes academic |
| P8 | Existing logging libraries dominate and will not be replaced | Logs spec (stated) | Log bridge/appender approach is unnecessary; clean-sheet log API would be simpler |
| P9 | Backends can consume a common data model (OTLP) regardless of vendor | Spec architecture (inferred from vendor-neutrality goal) | Each vendor needs a custom exporter; pluggability promise is hollow |
| P10 | Semantic conventions can be standardized across the industry and kept current via YAML-driven code generation | Semantic Conventions section (stated) | Attribute sprawl; inconsistent naming across implementations defeats correlation |
| P11 | **HIGH RISK** — Implementations can guarantee thread safety for all public API surfaces without unacceptable performance cost | Trace API, Metrics API (stated as MUST) | Concurrency bugs in production telemetry code; or excessive locking destroys performance |

---

## Constraints

### Hard (violation = rejection)

| # | Constraint | Source |
|---|-----------|--------|
| C1 | API and SDK MUST be provided as independent artifacts; instrumentation authors MUST NOT depend on SDK packages | Library Guidelines Req. 1-2 (stated) |
| C2 | Implementations MUST NOT throw unhandled exceptions at runtime; telemetry failure MUST NOT crash the application | Error Handling spec (stated) |
| C3 | All stable API packages MUST version together across all signals; all SDK packages MUST version together across all signals | Versioning spec (stated) |
| C4 | Backward-incompatible changes to stable API packages MUST NOT occur without a major version bump | Versioning spec (stated) |
| C5 | Stable API major versions require minimum 3-year long-term support after the next major version; SDK and contrib require minimum 1-year | Versioning spec (stated) |
| C6 | Context MUST be immutable; write operations MUST produce a new Context instance | Context spec (stated) |
| C7 | All public API surfaces (TracerProvider, Tracer, Span, MeterProvider, Meter, Instruments) MUST be safe for concurrent use | Trace API, Metrics API (stated) |
| C8 | Spans MUST only be created via a Tracer; instruments MUST only be created via a Meter — no alternative construction paths | Trace API, Metrics API (stated) |
| C9 | SpanContext, Events, and Links MUST be immutable | Trace API (stated) |
| C10 | The SDK MUST include OTLP, stdout, and in-memory exporters for all signals; plus Prometheus for metrics and Zipkin for traces | Library Guidelines Req. 5 (stated) |
| C11 | The Span End operation MUST NOT perform blocking I/O on the calling thread | Trace API (stated) |
| C12 | The library MUST NOT block the end-user application by default; MUST NOT consume unbounded memory | Performance spec (stated) |
| C13 | SDK MAY fail fast during initialization for bad configuration, but MUST NOT cause application failure at runtime due to dynamic configuration | Error Handling spec (stated) |
| C14 | When no SDK is installed, the API's minimal/no-op implementation MUST return valid, non-null values requiring no special caller checks | Library Guidelines + Error Handling (stated) |
| C15 | Resource detectors for generic/vendor-specific platforms MUST be implemented as separate packages from the SDK | Resource SDK spec (stated) |
| C16 | Signal lifecycle transitions from Development to Stable MUST NOT break existing users | Versioning spec (stated) |
| C17 | TraceState MUST remain valid per W3C Trace Context specification at all times; all mutating operations MUST validate input | Trace API (stated) |
| C18 | Logs MUST be correlatable with traces and metrics via TraceId, SpanId, and Resource fields | Logs spec (stated) |
| C19 | The specification uses RFC 2119/8174 compliance keywords; conformance requires satisfying all MUST, MUST NOT, and REQUIRED requirements | Spec notation conventions (stated) |
| C20 | Semantic convention keys and enum values SHOULD be autogenerated from YAML source-of-truth files | Semantic Conventions section (stated) |

### Soft (violation = penalty)

| # | Constraint | Source |
|---|-----------|--------|
| S1 | API and SDK package version numbers SHOULD be decoupled and each SHOULD clearly state the specification version they implement | Library Guidelines (stated) |
| S2 | Language implementations SHOULD adopt the single widely-used Context implementation if one exists; otherwise OpenTelemetry MUST provide its own | Context spec (stated) |
| S3 | Adding attributes at span creation is preferred over calling SetAttribute later; adding links at creation is preferred over AddLink later | Trace API (stated) |
| S4 | Span names SHOULD identify a statistically interesting class of spans, prioritizing generality over human-readability | Trace API (stated) |
| S5 | Instrumentation libraries SHOULD NOT set span status to Ok unless explicitly configured to do so | Trace API (stated) |
| S6 | Asynchronous instrument callbacks SHOULD be reentrant-safe and SHOULD NOT take indefinite time | Metrics API (stated) |
| S7 | All OpenTelemetry libraries SHOULD expose self-troubleshooting metrics and diagnostics, filtered out by default | Error Handling spec (stated) |
| S8 | Error suppression by the library SHOULD be logged using language-specific conventions | Error Handling spec (stated) |
| S9 | SDK implementations SHOULD allow end users to change the library's default error handling behavior | Error Handling spec (stated) |
| S10 | Vendor-specific exporters SHOULD be kept as simple as possible, leveraging SDK helpers for queuing and retrying | Library Guidelines (stated) |
| S11 | Cloud vendors are encouraged to provide resource detection packages implemented outside the SDK | Library Guidelines (stated) |
| S12 | Resource detection logic SHOULD complete quickly since it runs during application initialization | Resource SDK spec (stated) |
| S13 | Auto-instrumentation for logging libraries SHOULD automatically inject trace context without manual code changes | Logs spec (stated) |
| S14 | New APIs SHOULD be addable to existing components without breaking changes; optional parameters SHOULD be addable to existing APIs without breaking changes | Metrics API (stated) |
| S15 | Major version bumps SHOULD NOT occur for changes that do not result in a drop of support | Versioning spec (stated) |

---

## Mission Space

### Evaluated Alternatives

| Alternative | Description | Fit Assessment |
|-------------|-------------|----------------|
| **Single-package monolith** | Ship API + SDK as one artifact | Violates C1 (API/SDK separation); forces instrumentation authors to depend on full SDK |
| **Signal-specific versioning** | Version each signal independently | Violates C3 (unified versioning); increases combinatorial complexity for implementors |
| **Clean-sheet logging API** | Replace existing logging libraries with OTel-native logger | Violates P8 and the "embrace existing ecosystems" goal; adoption barrier too high |
| **Vendor-specific wire protocols** | Each vendor defines its own export format | Violates the vendor-neutrality premise (P9); fragments the ecosystem |
| **Mutable context model** | Allow in-place context mutation for performance | Violates C6 (immutability); creates race conditions in concurrent systems |
| **Lazy/deferred SDK loading** | Load SDK only when first telemetry call occurs | Compatible with spec; some implementations do this. Risk: initialization errors surface late |
| **Compile-time instrumentation** | Generate telemetry code at build time instead of runtime hooks | Compatible for some languages; not universal. Doesn't work for dynamic languages or auto-instrumentation |

### Domain Context

- **Standards ecosystem:** OpenTelemetry subsumes OpenCensus and OpenTracing (both deprecated). The spec includes explicit compatibility sections for migration from both predecessors plus Prometheus/OpenMetrics.
- **W3C dependency:** Context propagation relies on W3C Trace Context and Baggage specifications. Changes to these W3C specs would cascade into OpenTelemetry.
- **OTLP as lingua franca:** The OpenTelemetry Protocol (OTLP) is the canonical wire format. All conformant SDKs must include OTLP exporters, making it the de facto industry standard for telemetry transport.
- **Collector as aggregation point:** The OpenTelemetry Collector operates in agent or standalone mode, handling aggregation, sampling, enrichment, and multi-destination export. It decouples application instrumentation from backend choice.
- **Semantic Conventions governance:** Attribute naming is centrally governed via YAML source-of-truth files with autogeneration. This is critical for cross-vendor correlation but creates a single-point-of-governance bottleneck.
- **Language SIG autonomy:** Each language has a Special Interest Group (SIG) that adapts the specification to language idioms. This means conformance is spec-level, not code-level — implementations vary significantly in API surface.

### Knowledge Gaps

1. **Sampling strategy specification depth** — The overview and trace API reference sampling but the detailed sampling specification (head sampling, tail sampling, probability sampling) was not fully extracted. Implementors need this for production-grade SDKs.
2. **Configuration specification** — The spec index lists a Configuration section (likely declarative/file-based config). The exact schema and requirements were not extracted.
3. **Profiles signal** — The spec mentions Profiles in the protocol section. This appears to be a newer signal type whose maturity status and requirements are unclear from the extracted sources.
4. **Collector specification depth** — The Collector's internal architecture, pipeline model, and extension points are referenced but not specified in the pages extracted.
5. **SDK-specific processing requirements** — Span processors, metric readers, log record processors, and their batching/export pipelines have detailed SDK specs not fully covered here.
6. **Security model** — No explicit security specification was found in the extracted pages. Authentication, encryption, and access control for telemetry transport are not addressed in the architecture overview.
7. **Schema migration** — The spec references Schema URLs (since v1.4.0) for telemetry evolution, but the schema migration/transformation specification was not extracted.
8. **Quota and rate limiting** — How implementations should handle backend-imposed rate limits or quota exhaustion is not addressed in the extracted material.
