# Adversarial Thinking: API Rate Limiting
**Execution mode: INLINE (DEGRADED — no sub-agent isolation available)**
**Depth: Standard**
**Pipeline: Phase 0 → Phase 1 → Phase 2 (inline fenced) → Phase 2.5 → Phase 3 (inline fenced) → Phase 4**

---

## ⚠ DEGRADED NOTICE

This output was produced in INLINE execution mode. Sub-agent spawning was not available in this environment. Context fencing was applied between all role phases, but true agent isolation was not possible. The adversarial critique and Condorcet comparison may reflect softer self-critique than a fully isolated pipeline would produce. Results should be treated as high-quality inline reasoning, not fully isolated adversarial output.

---

## RECOMMENDED → Layered Policy Architecture (A')

**Summary:** Implement rate limiting as a multi-layer token bucket system backed by Redis, with all layers checked atomically in a single Lua script using server-side timestamps.

**Core implementation:**

```lua
-- Single Redis Lua script checks ALL layers atomically
-- Redis TIME command used for server-side clock (eliminates node clock skew)
local now_ms = redis.call('TIME')
local now = tonumber(now_ms[1]) + tonumber(now_ms[2]) / 1000000
local health_factor = tonumber(redis.call('GET', 'global:health_factor') or '1.0')

local layers = {
  {key=KEYS[1], capacity=tonumber(ARGV[1])*health_factor, rate=tonumber(ARGV[2])},  -- IP layer
  {key=KEYS[2], capacity=tonumber(ARGV[3])*health_factor, rate=tonumber(ARGV[4])},  -- API key layer
  {key=KEYS[3], capacity=tonumber(ARGV[5])*health_factor, rate=tonumber(ARGV[6])},  -- Endpoint layer
}
for _, layer in ipairs(layers) do
  local data = redis.call('HMGET', layer.key, 'tokens', 'last_refill')
  local tokens = tonumber(data[1]) or layer.capacity
  local last = tonumber(data[2]) or now
  local elapsed = now - last
  tokens = math.min(layer.capacity, tokens + elapsed * layer.rate)
  if tokens < 1 then return {0, layer.key} end
  tokens = tokens - 1
  redis.call('HSET', layer.key, 'tokens', tokens, 'last_refill', now)
  redis.call('EXPIRE', layer.key, 86400)
end
return {1, 'ok'}
```

**Architecture (4 enforcement layers):**
```
Request → [IP limit] → [API Key limit] → [Endpoint limit] → [Global cap] → Handler
```

- **Layer 1 (IP):** Protects against unauthenticated scraping. 100 req/min, generous burst.
- **Layer 2 (API Key):** Primary business limit by plan tier (e.g., 1000 req/hr for free, 10000 for paid).
- **Layer 3 (Endpoint):** Independent limits on expensive endpoints (e.g., 10 req/min for /search).
- **Layer 4 (Global):** Hard system ceiling, applied as health_factor in Lua script.

**Distributed correctness:**
- All state in Redis. Lua script is atomic (no race conditions).
- Use Redis TIME command inside the Lua script — eliminates inter-node clock skew at the source.
- For Redis Cluster: hash-tag all bucket keys to the same slot (`{user:123}:tokens`) to keep Lua atomic across shards.

**Adaptive health factor:**
- Background job (every 5 seconds) writes `global:health_factor` (0.5–1.0) to Redis.
- Triggers: CPU load > 85% → 0.8; P95 latency > 500ms → 0.7; error rate > 5% → 0.5.
- Lua script reads health_factor and applies to all layer capacities in the same atomic call.

**Security (trusted proxy handling):**
- Maintain `config:trusted_proxies` as a Redis SET, cached in-memory with 60-second TTL.
- Derive client IP: walk `X-Forwarded-For` right-to-left, stop at first non-trusted IP.
- If `REMOTE_ADDR` is not a trusted proxy, use `REMOTE_ADDR` directly (safe default).

**RFC 6585 compliant response:**
```
HTTP/1.1 429 Too Many Requests
Retry-After: 30
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1711234567
RateLimit-Policy: 1000;w=3600
```
- At 80% of limit: add `X-RateLimit-Warning: approaching-limit` to response.
- Never drop silently — always return 429 with actionable headers.

**Redis unavailability (fail-open with local cap):**
- Redis connection timeout: 5ms.
- On timeout/failure: allow request, increment local in-memory counter.
- Local counter threshold: 10x normal limit (emergency cap).
- Log all Redis failures to alerting system.
- Document the fail-open choice explicitly in runbook — fail-closed is a valid alternative for high-security APIs.

**Best for:** Teams building a production API on conventional infrastructure with Redis available. Standard SaaS, REST APIs, B2B platforms with tiered access control.

**Trade-off:** Requires Redis as an operational dependency. The single Lua script approach is efficient but harder to debug/test layer-by-layer — mitigate by adding dry-run mode and per-layer metrics.

---

## ALTERNATIVE → Sliding Window Counter + Adaptive Throttling (B')

**Summary:** Use the sliding window counter algorithm (near-accurate, O(1), no thundering herd) with a rich adaptive throttling layer that adjusts limits based on real-time system health.

**Core algorithm:**
```
estimate = current_window_count + prev_window_count × (1 - elapsed/window_size)
if estimate > effective_limit: return 429
```

**Why this algorithm:**
- Token bucket (A') has ~1% burst overshoot — each refill is calculated from elapsed time with floating-point precision.
- Fixed window has thundering herd problem: up to 2× burst at window boundary.
- Sliding window log is O(n) memory per user (Redis sorted set).
- Sliding window counter: O(1) memory, 2 simple Redis ops (INCR + GET), ~0.3% error vs true sliding window.

**Redis implementation:**
```python
pipe = redis.pipeline()
pipe.incr(f"user:{id}:window:{current_window}")
pipe.get(f"user:{id}:window:{prev_window}")
pipe.expire(f"user:{id}:window:{current_window}", window_size * 2)
current, prev, _ = pipe.execute()

estimate = int(current) + int(prev or 0) * (1 - elapsed/window_size)
effective_limit = base_limit * health_factor
if estimate > effective_limit:
    return 429
```

**Adaptive throttling (richer than A'):**
- Monitors: app-server CPU (via host metrics), P95 response latency (via APM), error rate.
- Updates `global:health_factor` every 5 seconds.
- Specific thresholds: CPU > 85% → 0.8; P95 > 500ms → 0.7; error rate > 5% → 0.5.
- If metrics unavailable: health_factor = 1.0 (fail-open for adaptive component).

**Correct Retry-After for sliding window:**
```
retry_after = ceil(window_size - elapsed_in_current_window)
```
Conservative estimate (actual recovery may be sooner as previous window weight decreases). Appropriate: better to tell clients to wait a bit longer than to have them retry too early.

**Granularity:** IP-level (unauthenticated) + API-key-level (authenticated), checked via Redis pipeline in a single round-trip.

**Best for:** Systems where thundering herd prevention is critical (e.g., APIs with tight SLAs that see bursty traffic at period boundaries), or teams that prefer simpler Redis operations over Lua scripts.

**Trade-off:** Only 2 enforcement layers (vs A's 4). Less fine-grained than A' for endpoint-specific limiting. The ~0.3% approximation error is theoretically exploitable by sophisticated clients.

---

## SELECTION GUIDANCE

- **Use A' (Recommended)** if you need multi-layer enforcement (IP + key + endpoint + global), have Redis, and want atomic correctness with server-side clock. Suitable for most production APIs.

- **Use B' (Alternative)** if thundering herd prevention is a priority, you prefer simpler Redis operations without Lua scripting, or you need richer adaptive throttling based on system health signals.

- **Both** should be combined with: RFC 6585 HTTP 429 responses, `X-RateLimit-*` headers, `RateLimit-Policy` header per IETF draft, trusted proxy IP validation, and Redis fail-open fallback.

---

## TRACE / REASONING

### Phase 0: Domain Research
- Source: training knowledge (web search denied in this environment)
- Key findings: token bucket vs sliding window counter trade-offs; RFC 6585 (429 status); IETF draft-ietf-httpapi-ratelimit-headers; Redis Lua atomicity; distributed clock skew problem; trusted proxy handling; fail-open vs fail-closed; adaptive throttling patterns
- Enriched requirements: 10 requirements (R1-R10), 6 domain-implicit (not stated by user)

### Phase 1: Candidate Generation
- A: Layered Policy Architecture (token bucket, 4 layers, Lua, prescriptive)
- B: Sliding Window Counter + Adaptive Throttling (near-accurate algorithm, rich health monitoring)
- C: Contextual Decision Framework (meta-approach, selection guidance across 5 dimensions)
- Divergence score: A vs B ~7/10, A vs C ~9/10, B vs C ~8/10

### Phase 2: Blind Attack (INLINE, DEGRADED)
**Round 1 critique findings:**
- A: 4 unmet requirements (clock skew handling, latency, adaptive throttling, trusted proxy implementation)
- B: 3 unmet requirements (granularity layering, adaptive throttle race/metric source, Retry-After formula for sliding window)
- C: 2 unmet requirements (multi-region implementation gap, tarpitting without caveat)
- Cross-cutting: Redis unavailability handling, circuit breaker integration, IETF RateLimit-Policy header — all 3 solutions missed these

**Author revisions:**
- A' resolved all 4 issues (Redis TIME in Lua, single-Lua-all-layers, health factor in script, trusted proxy implementation, fail-open)
- B' resolved all 3 issues (2-layer pipeline, metric source clarified, Retry-After corrected, fail-open added)
- C' resolved both issues (multi-region CRDT + two-tier design, tarpitting caveat, Redis failure dimension added, circuit breaker guidance)

**Round 2:** CRITIQUE-DRIFTING for A' and B' (operational edge-cases only), AUTHOR-HELD for C'. Terminated.

### Phase 2.5: Convergence Detection
- A' vs B': ~40% overlap (different algorithm, different granularity depth)
- A' vs C': ~20% overlap (implementation vs framework)
- B' vs C': ~30% overlap
- Result: DIVERGENT → proceed to Condorcet

### Phase 3: Condorcet (INLINE, DEGRADED)
- compare-AB: A' wins (4-layer architecture more complete; single Lua call more elegant)
- compare-AC: A' wins (more actionable for the primary use case; C' is educational but requires follow-through)
- compare-BC: B' wins (concrete implementation with adaptive throttling differentiator; C' is not directly implementable)

**Tally: A'=2, B'=1, C'=0**

**Winner: A' | Runner-up: B' | Rejected: C'**

---

*Pipeline completed in INLINE/DEGRADED mode. True adversarial isolation requires sub-agent spawning capability not available in this execution environment.*
