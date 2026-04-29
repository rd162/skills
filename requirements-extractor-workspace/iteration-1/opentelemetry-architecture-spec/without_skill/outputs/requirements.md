# OpenTelemetry Architecture Specification — MGPC Requirements

**Source:** https://opentelemetry.io/docs/specs/otel/overview/
**Extracted:** 2026-04-08

---

## Mission

Make every library and application observable out of the box by providing a vendor-neutral, language-agnostic instrumentation framework that can be mixed into any codebase as a cross-cutting concern — enabling distributed traces, metrics, logs, and baggage to be collected, propagated, and exported without locking users into any single observability backend.

---

## Goals

1. **Unified observability signals.** Provide a coherent set of signals — tracing, metrics, logs, and baggage — that share a common context propagation subsystem while operating independently, so instrumentors need only one framework to cover all signal types.

2. **Zero instrumentation lock-in for library authors.** Library and application code that calls the OpenTelemetry API must remain decoupled from any specific SDK implementation, so that instrumentation authors can ship instrumented libraries that work regardless of what SDK the application owner installs.

3. **Application-owner control over data pipeline.** Application owners must be able to install, configure, and replace the SDK (constructors, exporters, samplers, views) independently of the instrumented library code, retaining full authority over how telemetry is processed and where it is sent.

4. **Vendor and backend portability.** Telemetry collected through OpenTelemetry must be exportable to any monitoring or tracing backend (Jaeger, Prometheus, proprietary SaaS, etc.) without re-instrumenting the source code.

5. **End-user aggregation flexibility.** Raw measurements recorded via the Metrics API must remain unaggregated at the point of recording, so end-users can choose aggregation algorithms (averages, histograms, etc.) independently of the library that produced the data.

6. **Causal correlation across service boundaries.** Baggage and context propagation must carry identifying attributes across process, network, and security boundaries so that observability events in downstream services can be causally linked to upstream request context.

7. **Stability and backwards compatibility.** All signals and packages must be versioned with explicit stability guarantees, allowing the ecosystem to depend on stable APIs without breakage from future additions.

8. **Extensibility through contrib.** Optional integrations (web frameworks, database clients, exporters, propagators) must be separable from the core SDK, enabling a plugin ecosystem without bloating the required distribution.

---

## Premises

1. **Cross-cutting concern reality.** Observability code will necessarily violate separation-of-concerns by being mixed into many other codebases. This is accepted as inherent to the problem, not a design flaw to be eliminated.

2. **Heterogeneous instrumentation environments.** Not all libraries will natively adopt OpenTelemetry. Instrumentation libraries (wrappers, callbacks, bridge adapters) are a permanent, first-class mechanism — not a temporary workaround.

3. **Multiple runtime roles exist.** The ecosystem contains distinct roles — instrumentation authors, plugin authors, and application owners — each with different access rights to different package layers. Design decisions about API vs. SDK visibility flow from this role separation.

4. **Distributed systems span trust boundaries.** Traces cross process, network, and security boundaries. Services may operate under policies that require generating a new trace rather than trusting incoming trace context, so the model must accommodate both continuation and fresh-start tracing.

5. **Backend diversity is permanent.** There is no single dominant observability backend. The system assumes it will always need to support multiple, incompatible export targets simultaneously, including legacy systems (OpenTracing, Prometheus, Jaeger).

6. **Semantic conventions require centralized governance.** Meaningful interoperability of telemetry data depends on shared attribute naming. This requires a canonical, machine-readable source of truth (YAML in the semantic-conventions repository) that implementations generate code from — rather than each language defining its own conventions ad hoc.

7. **Collector deployment topology varies.** The Collector runs as a local agent (daemon collocated with the application) or as a standalone service, and the architecture must support both without requiring changes to instrumented code.

8. **Metrics data should not be prematurely constrained.** Because different exporters have different capabilities and character restrictions, Metrics is intentionally a superset of what backends support. Validation belongs at the backend, not at the collection layer.

---

## Constraints

1. **Instrumentation authors MUST NOT reference the SDK.** Any code intended for use inside instrumented libraries must depend only on the API packages. Importing SDK packages from instrumentation code is prohibited — it would bind library users to a specific SDK implementation.

2. **API and SDK MUST be separately importable packages.** The split between API (cross-cutting, safe for library dependencies) and SDK (application-managed, full implementation) is a structural requirement, not a guideline. They cannot be merged into a single distribution.

3. **SpanContext MUST propagate to all child spans and across process boundaries.** The TraceId (16 bytes), SpanId (8 bytes), TraceFlags, and Tracestate fields are mandatory propagation data. Dropping or truncating them breaks distributed trace integrity.

4. **Semantic convention values MUST be generated from the canonical YAML source.** The YAML files in the semantic-conventions repository are the single source of truth. Language implementations are not permitted to define their own authoritative attribute names independently.

5. **Generated semantic convention constants MUST NOT be distributed in stable packages until the underlying conventions are marked stable.** Shipping unstable conventions in stable packages would break the backwards-compatibility guarantee.

6. **Required plugins (OTLP Exporters, TraceContext Propagators) MUST be included in the SDK.** These are not optional contrib packages — they are part of the SDK distribution. Removing them from the SDK would leave implementations non-conformant with the specification.

7. **Signals MUST share the same context propagation subsystem.** Traces, metrics, and baggage cannot maintain independent, incompatible context mechanisms. The shared `Context` is the integration point that enables cross-signal correlation.

8. **Baggage is a propagation primitive, not a general-purpose transport.** It is primarily intended to carry values for OpenTelemetry's own observability systems. New cross-cutting concerns with different semantics must define new mechanisms (potentially with new HTTP headers) rather than overloading Baggage.

9. **Span links (not parent fields) MUST be used for scatter/gather and batch patterns.** When a span aggregates multiple upstream spans (fan-in), using the parent field is semantically incorrect because it implies a single enclosing parent. The Links mechanism is the required modeling choice for these topologies.

10. **The Collector MUST support both agent and standalone service deployment modes.** The architecture cannot require one deployment topology. Applications must be able to emit telemetry without knowing or caring which Collector mode is in use.
