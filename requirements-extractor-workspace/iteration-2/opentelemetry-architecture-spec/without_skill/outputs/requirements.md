# OpenTelemetry Architecture Specification -- Requirements Document

**Source:** https://opentelemetry.io/docs/specs/otel/overview/ (and linked sub-specifications)
**Specification Version:** 1.55.0
**Extraction Date:** 2026-04-08

---

## 1. Mission (Core Invariant Purpose)

OpenTelemetry exists to provide a single, vendor-neutral, open standard for observability telemetry -- enabling the generation, collection, and export of traces, metrics, and logs from software systems -- so that no organization is locked into a proprietary observability backend and every library author can instrument once for all consumers.

The system treats observability as a **cross-cutting concern** that must be embedded pervasively in application code without coupling that code to any specific telemetry backend, analysis tool, or vendor.

---

## 2. Goals (Measurable Outcomes for Implementors)

### 2.1 Universal Instrumentation
- Provide API packages that any library author can depend on to instrument their code, without forcing end users to adopt any particular SDK or backend.
- Every signal (traces, metrics, logs, baggage) must be independently usable; adopting one signal must not require adopting another.

### 2.2 Vendor Neutrality
- Telemetry data must be exportable to any backend. The specification defines the OTLP wire protocol as the primary interchange format, plus compatibility bridges to Prometheus, Zipkin, OpenTracing, and OpenCensus.
- Vendor-specific exporters must NOT be included in core client packages; they must be placed in separate contrib/vendor packages.

### 2.3 Zero-Cost When Unused
- An application that includes instrumented libraries but does not install an OpenTelemetry SDK must incur no meaningful performance penalty.
- The API's minimal/no-op implementation must return valid, non-null objects and must never fail.

### 2.4 Backward Compatibility and Long-Term Stability
- It must always be possible to upgrade to the latest minor SDK version without compilation or runtime errors.
- API stability: minimum 3 years of support after the next major release.
- SDK stability: minimum 1 year of support after the next major release.
- Semantic Conventions stability: schema-based transformations must enable evolution without breaking analysis tools.

### 2.5 Interoperability Across Language Ecosystems
- The specification must be implementable in any programming language.
- Context propagation must work across process, network, and security boundaries using standardized wire formats (W3C Trace Context, B3).

### 2.6 Extensibility
- The SDK must expose plugin interfaces (SpanProcessor, Exporter, Sampler, Views) that third parties can implement.
- The Collector must support aggregation, smart sampling, enrichment, transformation, and multi-backend export.

---

## 3. Premises (Assumptions the System Operates Under)

### 3.1 Observability Is a Cross-Cutting Concern
The specification assumes that telemetry instrumentation will be embedded throughout application code, in libraries the application author does not control. Therefore the instrumentation API must be safe to depend on universally, with no side effects when no SDK is present.

### 3.2 Application Owner Controls the Backend
The architecture assumes a separation of roles: **instrumentation authors** (library developers) write telemetry calls against the API; **application owners** choose and configure the SDK, exporters, and backend. These are different people/teams with different needs.

### 3.3 Distributed Systems Are the Primary Domain
The specification assumes telemetry must cross process, network, and security boundaries. Traces are directed acyclic graphs of Spans that span multiple services. Context propagation via HTTP headers (and other carriers) is a first-class requirement.

### 3.4 Telemetry Volume Exceeds Processing Capacity
The specification assumes that raw telemetry volume will be too high to export in full. Sampling, aggregation, and filtering are built into the architecture at multiple levels (SDK Samplers, Collector pipelines, Views for metrics).

### 3.5 Multiple Languages, One Specification
Each language implementation is independently versioned and may differ in idiom, but all must implement the same specification. RFC 2119/8174 normative language governs compliance.

### 3.6 Existing Ecosystems Must Be Bridged
The specification assumes prior investments in OpenTracing, OpenCensus, Prometheus, Zipkin, and Jaeger. Compatibility layers and bridge components are part of the architecture, not afterthoughts.

---

## 4. Constraints (Non-Negotiable Design Boundaries)

### 4.1 API/SDK Separation (Architectural Constraint)

| Rule | Level |
|------|-------|
| API and SDK MUST be provided as independent artifacts (separate packages/libraries). | MUST |
| Instrumentation authors MUST depend only on the API package, never on the SDK. | MUST |
| The API package MUST be self-sufficient -- it must function without an SDK installed. | MUST |
| The API's minimal (no-op) implementation MUST return valid, non-null objects and MUST NOT require callers to perform extra checks. | MUST |
| Methods like `createSpan()` MUST NOT fail; they must return valid Span objects even in no-op mode. | MUST |
| Applications MUST remain fully usable when instrumented libraries are present but no SDK is selected. | MUST |

### 4.2 Error Handling Constraints

| Rule | Level |
|------|-------|
| Implementations MUST NOT throw unhandled exceptions at runtime. | MUST NOT |
| API methods MUST NOT throw unhandled exceptions when used incorrectly by end users. | MUST NOT |
| The SDK MUST NOT cause the application to fail at runtime (even if initialization fails due to bad configuration). | MUST NOT |
| The SDK MUST NOT throw unhandled exceptions for errors in its own operations (e.g., exporter cannot reach endpoint). | MUST NOT |
| API methods that accept external callbacks MUST handle all errors from those callbacks. | MUST |
| When errors occur in processing logic, the SDK MUST return a no-op or default object, never null. | MUST |
| SDK implementations MUST allow end users to change default error handling behavior for relevant errors. | MUST |
| Suppressed errors SHOULD be logged using language-specific conventions. | SHOULD |

### 4.3 Performance Constraints

| Rule | Level |
|------|-------|
| The library MUST NOT block the end-user application by default. | MUST NOT |
| The library MUST NOT consume unbounded memory resources. | MUST NOT |
| Implementations MUST offer users a choice between information preservation (retain all data) and blocking prevention (drop data under load). | MUST |
| Data dropping under load MUST emit warning logs, support configurable thresholds, and expose effective sampling ratio metrics. | MUST |
| Shutdown and flush operations MUST support user-configurable timeouts to prevent indefinite blocking. | MUST |
| The no-op/minimal API implementation must incur as little performance penalty as possible. | SHOULD |

### 4.4 Context and Propagation Constraints

| Rule | Level |
|------|-------|
| A Context MUST be immutable; write operations MUST create a new Context. | MUST |
| The Context API MUST provide CreateKey, Get, and Set operations. | MUST |
| Propagators MUST define both Inject and Extract operations. | MUST |
| Extract MUST NOT throw exceptions if values cannot be parsed from the carrier. | MUST NOT |
| Extract MUST NOT store new values in Context if extraction fails (preserving previously valid values). | MUST NOT |
| TextMapPropagator key/value pairs MUST consist only of valid US-ASCII HTTP header characters per RFC 9110. | MUST |
| Getter MUST be case-insensitive for HTTP request objects. | MUST |
| Composite propagators MUST invoke contained propagators in specified order. | MUST |
| The API MUST provide global get/set methods for propagators and MUST default to no-op propagators. | MUST |
| W3C Trace Context: implementations MUST parse and validate `traceparent` and `tracestate` headers per W3C Trace Context Level 2. | MUST |

### 4.5 Versioning and Stability Constraints

| Rule | Level |
|------|-------|
| API and SDK MUST use Semantic Versioning (SemVer). | MUST |
| Every release MUST clearly state which Specification version it implements. | MUST |
| Backward-incompatible changes MUST trigger a major version increment. | MUST |
| It MUST always be possible to upgrade to the latest minor SDK version without compilation or runtime errors. | MUST |
| Development-stage signals MUST NOT break existing stable signals when transitioning to Stable. | MUST NOT |
| Deprecated features MUST continue to receive the same support guarantees as stable code. | MUST |
| A replacement MUST be stable before an existing feature can be deprecated. | MUST |
| Removal of deprecated features MUST trigger a major version bump. | MUST |
| API packages: minimum 3 years of long-term support after next major release. | MUST |
| SDK packages: minimum 1 year of long-term support after next major release. | MUST |

### 4.6 Configuration Constraints

| Rule | Level |
|------|-------|
| The SDK MUST provide a programmatic interface for ALL configuration. | MUST |
| The programmatic interface SHOULD be written in the language of the SDK. | SHOULD |
| All other configuration mechanisms (environment variables, declarative files) SHOULD be built on top of the programmatic interface. | SHOULD |
| SDKs MUST extract and merge `OTEL_RESOURCE_ATTRIBUTES` environment variable as secondary resource data (user-provided takes priority). | MUST |

### 4.7 Resource Constraints

| Rule | Level |
|------|-------|
| Resources MUST be associable with TracerProvider/MeterProvider at creation time; this association MUST NOT change afterward. | MUST |
| All Spans from a provider MUST be associated with that provider's Resource. | MUST |
| Resource merge: the resulting resource MUST have all attributes from both inputs; the updating resource takes precedence on key conflicts. | MUST |
| Cloud vendor resource detection packages MUST be implemented outside the SDK. | MUST |
| Resources are immutable after creation. | MUST |

### 4.8 Required Exporter Support

| Signal | Required Exporters |
|--------|-------------------|
| All signals (traces, metrics, logs) | OTLP, standard output (stdout), in-memory mock |
| Metrics only | Prometheus (additional) |
| Traces only | Zipkin (additional) |

### 4.9 Normative Compliance

An implementation is **not compliant** if it fails to satisfy one or more of the MUST, MUST NOT, or REQUIRED requirements defined in the specification. The specification uses RFC 2119 / RFC 8174 keyword semantics throughout.

---

## 5. Signal Architecture Summary

### 5.1 Traces
- **Structure:** Directed acyclic graph of Spans connected by parent-child relationships.
- **Span contents:** operation name, start/finish timestamps, attributes (key-value), events (timestamped tuples), parent span ID, links to causally-related spans, SpanContext.
- **SpanContext:** TraceId (16 bytes), SpanId (8 bytes), TraceFlags (1-byte bitmap), Tracestate (W3C vendor-specific key-value pairs).
- **Links:** Enable causal relationships across traces (batch operations, scatter/gather patterns).

### 5.2 Metrics
- **Components:** MeterProvider, Meter, Instrument, Measurement.
- **Instrument types:** Counter (incrementing), Gauge (current value), Histogram (distribution). Each can be synchronous or asynchronous (callback-based).
- **Data Model:** Three semantic layers -- Event model (API), in-flight data model (SDK/OTLP), TimeSeries model (exporter interpretation).
- **Views:** Configure how instrument data is processed, aggregated, and exported.

### 5.3 Logs
- Defined by the Log Data Model specification.
- Integrated into the same context propagation and resource framework as traces and metrics.

### 5.4 Baggage
- Name-value pairs propagated across service boundaries within a transaction.
- Establishes causal relationships between observability events across services.
- Can augment metrics, logs, and traces with upstream context.

### 5.5 Context Propagation
- Shared underlying mechanism for all signals.
- Context is immutable; all modifications produce new Context instances.
- Propagators serialize/deserialize context for cross-process transport.
- TextMapPropagator is the primary propagator type (HTTP header compatible).

### 5.6 Resources
- Capture the identity of the entity producing telemetry (host, container, service, process).
- Immutable after creation; bound to providers at initialization.
- Hierarchical: can represent cloud -> host -> container -> process.

---

## 6. Roles and Responsibilities

| Role | Responsibilities | Package Dependencies |
|------|-----------------|---------------------|
| **Instrumentation Author** | Writes telemetry calls into libraries using the API. | API only (never SDK). |
| **Application Owner** | Installs and configures the SDK, selects exporters and backends. | API + SDK + exporters. |
| **Plugin Author** | Implements SDK extension points (exporters, samplers, processors). | SDK plugin interfaces. |

---

## 7. Package Taxonomy

| Package Type | Purpose | Example |
|-------------|---------|---------|
| **API** | Cross-cutting public interfaces for instrumentation. | `opentelemetry-api` |
| **SDK** | Reference implementation managed by application owners. | `opentelemetry-sdk` |
| **Semantic Conventions** | Standard keys/values for common concepts. | `opentelemetry-semantic-conventions` |
| **Contrib** | Optional integrations with third-party tools. | `opentelemetry-instrumentation-flask` |
| **Exporter** | Protocol-specific telemetry export. | `opentelemetry-exporter-otlp` |

---

## 8. Collector Architecture

The OpenTelemetry Collector operates in two modes:

- **Agent mode:** Local daemon running alongside the application, receiving telemetry from instrumented processes.
- **Collector mode:** Standalone service performing aggregation, sampling, enrichment, transformation, and multi-backend export.

The Collector accepts telemetry from OpenTelemetry-instrumented processes and from other monitoring systems (Jaeger, Prometheus), serving as a universal telemetry pipeline.

---

## 9. Compliance Checklist (Summary)

For an implementation to be considered compliant with the OpenTelemetry specification:

1. API and SDK are separate, independently distributable artifacts.
2. API functions without an SDK (no-op behavior, no failures, no null returns).
3. No unhandled exceptions at runtime, ever.
4. No unbounded memory consumption; no blocking of the host application.
5. Context is immutable; propagation follows W3C Trace Context Level 2.
6. Semantic Versioning with stated specification version per release.
7. OTLP, stdout, and in-memory exporters are included for all signals.
8. Programmatic configuration interface exists for all settings.
9. Resources are immutable and bound to providers at initialization.
10. All RFC 2119 MUST/MUST NOT/REQUIRED clauses are satisfied.
