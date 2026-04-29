# OpenTelemetry Architecture Specification — MGPC Requirements

**Source:** https://opentelemetry.io/docs/specs/otel/overview/
**Method:** Requirements Extractor v2.0 (Phase 0: CoK Bottom-Up + Phase 1: Top-Down Intent Inference)
**Date:** 2026-04-08

---

## Phase 0: Bottom-Up Requirements Saturation

### Level 5 — Topics (Explicit and Implied)

Explicit topics from the specification:
- Signals (tracing, metrics, logs, baggage)
- Context propagation
- API / SDK / Semantic Conventions / Contrib package structure
- Spans, SpanContext, TraceId, SpanId, TraceFlags, Tracestate
- Metrics instruments (counters, gauges, histograms), MeterProvider, Meter, Views
- Log Data Model
- Baggage (name/value pair propagation)
- Resources (entity identification)
- Propagators (TextMapPropagator)
- Collector (Agent mode, Collector mode)
- Instrumentation Libraries
- Versioning and stability

Expansion triples — implied topics:
- (tracing, requires, distributed context identity) → TraceId/SpanId uniqueness
- (API, implies, vendor-neutrality) → zero-dependency API contract
- (cross-cutting concern, requires, separation of API from SDK) → instrumentation authors must not reference SDK
- (signals, share, context propagation subsystem) → unified context model
- (collector, enables, backend-agnosticism) → multi-backend export
- (semantic conventions, implies, interoperability standards) → YAML-sourced code generation
- (instrumentation library, implies, wrapping/hook mechanisms) → non-invasive integration patterns
- (versioning, requires, backward compatibility) → stability guarantees

---

### Level 4 — Areas and Patterns

| Topic Cluster | Area | Patterns |
|---|---|---|
| Signals (trace, metrics, logs, baggage) | Observability Signal Architecture | signal isolation, shared context substrate |
| API/SDK separation | Package Layering | cross-cutting API, application-owned SDK, plugin interfaces |
| SpanContext, TraceId, SpanId, TraceFlags | Distributed Identity | globally-unique IDs, sampling bit, vendor tracestate |
| Collector (Agent + Collector modes) | Telemetry Pipeline | local sidecar agent, centralized collector, aggregation, sampling, export |
| Semantic Conventions (YAML-sourced) | Interoperability Standards | code-generated constants, stability gating |
| Instrumentation Libraries | Non-Invasive Observability | wrapping, callback hooks, telemetry translation |
| Resources | Entity Attribution | hierarchical entity identity (host → container → process) |
| Propagators | Wire Encoding | TextMap injection/extraction, W3C TraceContext, vendor extension via Tracestate |
| Versioning/Stability | API Contract Management | semver, backwards compatibility, stability lifecycle |

Area-level constraints surfaced:
- API must be importable without pulling in SDK (L4 constraint: zero-SDK-dependency API)
- Signals must be independently functional despite sharing context propagation
- Metric data model must be a superset, not lowest common denominator
- Collector must accept telemetry from non-OTel sources (Jaeger, Prometheus)

---

### Level 3 — Fields and Mechanisms

| Area | Field | Mechanisms |
|---|---|---|
| Observability Signal Architecture | Distributed Systems Observability | DAG-based trace model, event timestamping, attribute key-value model |
| Package Layering | Software Architecture / API Design | stable public API surface, constructor/plugin interface split, semver |
| Distributed Identity | Cryptographic / Probabilistic Identity | 128-bit random TraceId, 64-bit random SpanId, bitmap flags |
| Telemetry Pipeline | Data Engineering / Stream Processing | aggregation, smart sampling, enrichment, scrubbing, multi-sink export |
| Interoperability Standards | Schema Engineering | YAML as source of truth, code generation per language, stability gating before stable packages |
| Non-Invasive Observability | Middleware / AOP | interface wrapping, library callbacks, telemetry translation layer |
| Entity Attribution | Metadata Management | hierarchical resource descriptors (cloud → k8s → container → process) |
| Wire Encoding | Protocol / Serialization | TextMap carrier injection/extraction, W3C header format, Tracestate key-value list |
| API Contract Management | Release Engineering | stability guarantees, backwards compatibility mandate |

Field-level constraints surfaced:
- TraceId must be 16 bytes randomly generated (128-bit)
- SpanId must be 8 bytes randomly generated (64-bit)
- SpanContext MUST be propagated to child spans and across process boundaries
- YAML semantic convention files MUST be the source of truth for code generation
- Instrumentation authors MUST NOT directly reference any SDK package
- Generated semantic convention values SHOULD NOT be in stable packages until conventions are stable

---

### Level 2 — Disciplines and Cross-Cutting Concerns

| Field | Discipline | Mandates |
|---|---|---|
| Distributed Systems Observability | Systems Engineering | full-stack telemetry coverage (traces + metrics + logs), causality modeling |
| API Design | Software Engineering | separation of concerns, zero-coupling API, plugin extensibility |
| Data Engineering | Data Integrity | minimal data validation at collection layer; defer to backend |
| Schema Engineering | Interoperability | language-agnostic schema definition, stable generation pipeline |
| Release Engineering | Compatibility | no breaking changes to API, stability lifecycle gating |
| Security / Privacy | Data Governance | PII scrubbing in collector, Baggage scope limited to OTel observability systems |
| Protocol Design | Standards Compliance | W3C TraceContext compatibility, Tracestate for vendor interop |

---

### Level 1 — Domains

| Discipline | Domain | Disjoint From |
|---|---|---|
| Systems Engineering | Distributed Systems | (disjoint: embedded/real-time systems) |
| Software Engineering | Platform Engineering | (disjoint: end-user application logic) |
| Data Engineering | Observability / Telemetry | (disjoint: business intelligence) |
| Standards Compliance | Open Standards | (disjoint: proprietary monitoring ecosystems) |

Domain classification: **Distributed Systems Observability + Open Platform Engineering** ✓

---

### Phase 0 Saturation Summary

```
L5→{signals, context-propagation, API/SDK/contrib/semconv packages, spans, spancontext,
    traceid/spanid, metrics-instruments, log-data-model, baggage, resources,
    propagators, collector, instrumentation-libraries, versioning}

L4→[observability-signal-architecture]+{signal isolation, shared context}
   [package-layering]+{zero-SDK API, application-owned SDK, plugin interfaces}
   [telemetry-pipeline]+{agent/collector modes, aggregation, sampling, multi-sink}
   [interoperability-standards]+{YAML source-of-truth, code generation}
   [distributed-identity]+{globally unique IDs, sampling bit}

L3→[distributed-systems-observability]+{DAG trace model, event timestamping}
   [api-design]+{stable surface, constructor/plugin split}
   [data-engineering]+{superset data model, backend-deferred validation}
   [schema-engineering]+{YAML→codegen pipeline, stability gating}
   [wire-encoding]+{TextMap, W3C, Tracestate}

L2→[software-engineering]+{separation of concerns, zero-coupling, extensibility}
   [data-governance]+{PII scrubbing, Baggage scope limits}
   [standards-compliance]+{W3C TraceContext, backward compatibility}
   [data-integrity]+{minimal validation at collection, defer to backend}

L1→[Distributed Systems / Open Platform Engineering]✓
   (disjoint: proprietary monitoring, business intelligence, end-user application logic)

Requirements surfaced:
  L4: API must be importable with zero SDK dependency | signals must be independently functional
      collector must accept non-OTel sources
  L3: 128-bit TraceId, 64-bit SpanId | SpanContext MUST propagate across boundaries
      YAML is MUST source-of-truth for semconv | instrumentation authors MUST NOT reference SDK
  L2: PII scrubbing in collector | Baggage scoped to OTel observability | backward compatibility mandate
      data model must be superset (not LCD)

Solution Space:
  {Agent-sidecar + centralized-collector, direct-OTLP-export, multi-backend fan-out,
   auto-instrumentation via wrapping, manual SDK instrumentation, hybrid OTel+legacy bridging}
```

---

## Phase 1: Top-Down Intent Inference

### The "Why?" Recursion (W-Functor Chain)

Starting from the specification's stated purpose:

> "Make every library and application observable out of the box."

- Why make libraries observable? → To understand system behavior in production.
- Why understand system behavior? → To diagnose failures, measure performance, and improve reliability.
- Why improve reliability? → To deliver dependable software systems.
- Why deliver dependable software? → To enable people and organizations to trust and rely on software.
- Why enable trust in software? → Trust and reliability in technology are intrinsically valuable to society.
- Why is that intrinsically valuable? → (tautology — this is terminal value)

**Mission fixed point:** Universal observability as infrastructure — enabling software systems of any origin or vendor to be understood, debugged, and improved, without lock-in.

---

## MGPC Specification

### M — Mission

> Provide a universal, vendor-neutral observability infrastructure that makes any software system — regardless of language, framework, or backend — fully observable through standardized, composable telemetry primitives, without requiring lock-in to any proprietary monitoring ecosystem.

The terminal "why?" value: observability as an open, portable, infrastructure-level capability that every software system can depend on by default.

---

### G — Goals

What the system is concretely designed to do (changing any of these would require a fundamentally different system type):

1. **Define a portable, multi-signal telemetry API** covering traces, metrics, logs, and baggage as independent but composable signals sharing a unified context propagation substrate.

2. **Enforce strict API/SDK separation** so that instrumentation code (libraries, frameworks) depends only on the zero-cost API, while applications control which SDK implementation is installed — preventing instrumentation from imposing SDK choices on end users.

3. **Standardize distributed trace identity** through globally unique TraceId (128-bit) and SpanId (64-bit) that propagate causally across process and network boundaries, enabling end-to-end trace reconstruction in distributed systems.

4. **Define a superset metrics data model** that is not constrained to the lowest common denominator of existing backends, preserving full measurement fidelity at collection time and deferring aggregation/export decisions to the SDK and exporters.

5. **Establish semantic conventions as a shared vocabulary** — YAML-defined, code-generated per language — so that telemetry data from different libraries and services uses consistent attribute names and values enabling cross-system correlation.

6. **Enable non-invasive instrumentation** of libraries and frameworks that have no native OTel integration, via Instrumentation Libraries using wrapping, hooks, and telemetry translation.

7. **Provide a vendor-neutral Collector** capable of ingesting telemetry from both OTel-instrumented and legacy sources (Jaeger, Prometheus), performing enrichment, sampling, and scrubbing, and exporting to multiple backends simultaneously.

8. **Guarantee API stability and backward compatibility** so that instrumentation investments in libraries and applications are durable across OpenTelemetry versions.

---

### P — Premises

Assumptions that must hold for the Goals to be achievable. If any premise is false, one or more Goals become impossible.

1. **Distributed systems produce causally-linked telemetry events** — Traces can only be reconstructed if spans are emitted and their parent/child relationships are preserved across services. This requires that instrumented systems reliably propagate SpanContext.

2. **The API can be made dependency-free at the library level** — It is technically feasible to define a cross-cutting API package that carries zero runtime cost when no SDK is installed (no-op behavior), so that libraries can safely take a dependency on the API without harming applications that do not use OTel.

3. **A shared context propagation mechanism is sufficient across all signals** — Traces, metrics, baggage, and future signals can all share a single `Context` model without signal-to-signal interference.

4. **YAML is a stable, language-agnostic schema format** — Semantic conventions defined in YAML can be reliably parsed and code-generated into idiomatic constants for all target languages.

5. **Backends can be abstracted behind an exporter interface** — The diversity of monitoring backends (Jaeger, Zipkin, Prometheus, OTLP-native, etc.) is manageable through a plugin exporter model rather than requiring protocol-specific changes to the core data model.

6. **Non-OTel telemetry formats (Jaeger, Prometheus, etc.) can be translated** — The Collector's ingest layer can faithfully convert legacy telemetry formats into the OTel data model without significant data loss.

7. **Instrumentation libraries can observe library behavior non-invasively** — Wrapping interfaces, callback hooks, and library-specific subscription mechanisms are available in most language ecosystems to enable OTel instrumentation without requiring upstream source changes.

8. **Unique random IDs at 128-bit and 64-bit scales are practically collision-free** — Globally unique trace and span identity can be achieved through random generation without centralized coordination.

9. **Sampling decisions can be encoded in a 1-byte flag** — The `TraceFlags` bitmap (currently using only the sampling bit, `0x1`) is sufficient to carry the sampling state that must be propagated with span context.

10. **PII and sensitive data can be identified and scrubbed at the Collector layer** — Data governance requirements can be satisfied without burdening instrumentation authors, by delegating scrubbing to the Collector pipeline.

---

### C — Constraints

#### Hard Constraints (violation = rejection — the system does not conform to the spec)

| ID | Constraint | Source |
|---|---|---|
| H1 | Instrumentation authors MUST NOT directly reference any SDK package — only the API. | Spec: SDK section |
| H2 | SpanContext MUST be propagated to child Spans and across process boundaries. | Spec: SpanContext section |
| H3 | TraceId MUST be 16 randomly generated bytes (128-bit). | Spec: SpanContext section |
| H4 | SpanId MUST be 8 randomly generated bytes (64-bit). | Spec: SpanContext section |
| H5 | YAML semantic convention files MUST be used as the source of truth for code generation. | Spec: Semantic Conventions section |
| H6 | Generated semantic convention values MUST NOT be distributed in stable packages until the semantic conventions themselves are stable. | Spec: Semantic Conventions section |
| H7 | The API must behave as a no-op (zero cost) when no SDK is installed, enabling safe use in libraries. | Implied by cross-cutting concern design principle |
| H8 | Required plugins (OTLP Exporters, TraceContext Propagators) MUST be included as part of the SDK, not as optional Contrib packages. | Spec: Contrib Packages section |
| H9 | Baggage MUST be propagated as `Baggage` when using the OpenTracing bridge (backward compatibility). | Spec: Baggage section |
| H10 | The Metrics data model MUST be treated as a superset — code dealing with Metrics data MUST avoid validation and sanitization, passing data to the backend and relying on the backend for validation. | Spec: Metrics data model section |

#### Soft Constraints (violation = penalty — reduced quality, compliance, or interoperability)

| ID | Constraint | Source |
|---|---|---|
| S1 | Both the Collector and client libraries SHOULD autogenerate semantic convention keys and enum values into language-idiomatic constants. | Spec: Semantic Conventions section |
| S2 | Each language implementation SHOULD provide language-specific support to the semantic conventions code generator. | Spec: Semantic Conventions section |
| S3 | Instrumentation libraries SHOULD follow naming conventions of the instrumented library (e.g. 'middleware' for a web framework). | Spec: Instrumentation Libraries section |
| S4 | OTel-hosted instrumentation packages SHOULD be prefixed with "opentelemetry-instrumentation-" followed by the library name. | Spec: Instrumentation Libraries section |
| S5 | Third-party instrumentation packages SHOULD avoid naming collisions with OTel-hosted packages (e.g., prefix with company/project name). | Spec: Instrumentation Libraries section |
| S6 | Scatter/gather (fork/join) Spans SHOULD use Links rather than parent/child relationships, since parent semantically implies full enclosure. | Spec: Links between spans section |
| S7 | Baggage SHOULD be limited to conveying values for OTel observability systems; new cross-cutting concerns with different criteria SHOULD create a new mechanism rather than overloading Baggage. | Spec: Baggage section |
| S8 | Some process identification information SHOULD be automatically associated with telemetry by the OTel SDK (not requiring manual resource attribution). | Spec: Resources section |

---

### Solution Space

Viable approaches to implementing or deploying OpenTelemetry, derived from Phase 0 L4-L3 patterns:

| Approach | Description | Trade-offs |
|---|---|---|
| Agent-sidecar + centralized Collector | Local OTel Collector agent per host, forwarding to a central Collector service | High operational control, good for enrichment/sampling; adds infrastructure complexity |
| Direct OTLP export | Application SDK exports directly to OTLP-compatible backend | Simpler deployment; less flexibility for scrubbing/enrichment |
| Multi-backend fan-out via Collector | Single Collector pipeline exporting to multiple backends simultaneously | Vendor diversification; Collector becomes critical path |
| Auto-instrumentation via library wrapping | Instrumentation Libraries inject OTel calls via hooks without source changes | Zero upstream code changes; depends on hook availability per language/framework |
| Manual SDK instrumentation | Application code calls OTel API directly | Maximum control and precision; requires developer effort and API knowledge |
| Hybrid OTel + legacy bridging | Collector accepts Jaeger/Prometheus/etc. alongside OTLP | Gradual migration path; translation fidelity varies by source format |
| OpenTracing/OpenCensus bridge | Existing OT/OC instrumented code routed through OTel bridge layer | Backward compatibility for existing investments; bridge adds abstraction layer |

---

## Summary

The OpenTelemetry architecture specification describes a **universal observability framework** whose non-negotiable design constraints are:

1. **API/SDK hard separation** — the API is a zero-cost cross-cutting concern; the SDK is an application-owned implementation detail.
2. **Mandatory context propagation** — SpanContext (TraceId + SpanId + TraceFlags + Tracestate) must propagate faithfully across all process and network boundaries.
3. **Superset data model** — the metrics and telemetry data model must preserve full fidelity; validation is deferred to backends.
4. **YAML as semantic convention source of truth** — all attribute naming is schema-driven and code-generated, not hand-rolled per language.
5. **Vendor neutrality** — the API, SDK, Collector, and Semantic Conventions are all open and backend-agnostic by design mandate.

The system's mission is not merely "telemetry collection" — it is to make observability a universal, portable infrastructure primitive that any software, in any language, against any backend, can depend on without lock-in.
