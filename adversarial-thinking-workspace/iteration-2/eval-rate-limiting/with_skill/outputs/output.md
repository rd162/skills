# API Rate Limiting: Best Approach

> **DEGRADED OUTPUT** — Execution mode: INLINE (no sub-agent tool available).
> Phases 2 and 3 were executed with context fencing in the master thread,
> not with isolated sub-agents. Self-play risk present. See process log.

---

## RECOMMENDED → Layered Defense Architecture (Concentric Rings)

**Best for:** Teams building production APIs, any API that must handle volumetric abuse *and* per-user enforcement, systems with multiple services (CDN, gateway, application layer).

**Trade-off:** More infrastructure to configure upfront; requires understanding which ring handles what.

---

The correct model is **not** "one rate limiter" — it is concentric rings of control, each operating at different timescales, granularities, and costs.

### RING 1 — NETWORK EDGE (millisecond response, near-zero cost per request)

**Tool:** CDN (Cloudflare Rate Limiting, CloudFront WAF) or nginx/HAProxy
**Purpose:** Absorb volumetric abuse before it reaches your infrastructure
**Limit type:** Per-IP, connection rate, global request rate
**Algorithm:** Token bucket at kernel/OS level

```nginx
limit_req_zone $binary_remote_addr zone=ip_zone:10m rate=100r/m;
limit_req zone=ip_zone burst=20 nodelay;
```

**Trade-off:** Coarse (IP-only, no user context), but nearly free per-request cost. Accepts some false positives (blocking shared NAT) — this is acceptable at this layer.

---

### RING 2 — API GATEWAY (lightweight, plan-aware)

**Tool:** Kong, AWS API Gateway, Apigee, Traefik
**Purpose:** Per-API-key limits, plan-based quotas, endpoint routing rules
**Limit types:** Per-key, per-plan (free/pro/enterprise tiers), daily/monthly quotas
**State:** Shared Redis cluster or gateway-native storage

---

### RING 3 — APPLICATION MIDDLEWARE (full business context, higher per-request cost)

**Tool:** express-rate-limit (Node.js), slowapi (Python/FastAPI), rack-attack (Rails), bucket4j (Java)
**Purpose:** Per-user, per-feature, cost-based limits

**Algorithm choice:**
- Token bucket: best for burst-tolerant general-purpose APIs. Set burst B = 2–5x refill rate R. For APIs with fragile downstream dependencies, set B = R (no burst allowed).
- Sliding window counter: best for strict SLAs without boundary artifacts. ~1–2% error acceptable in the approximate implementation.
- Fixed window: only for internal/non-public APIs. Has a 2x burst vulnerability at window boundaries.

**Sliding window implementation (Redis Lua — atomic):**
```lua
local now = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - window_ms)
local count = redis.call('ZCARD', KEYS[1])
if count < limit then
  redis.call('ZADD', KEYS[1], now, now .. ':' .. math.random(1, 1000000))
  redis.call('PEXPIRE', KEYS[1], window_ms)
  return 1  -- allowed
end
return 0  -- rejected
```

**CRITICAL — atomicity:** Never use check-then-increment. Under concurrent load, 50 threads can all read count=99, all pass, all increment → 149 requests served against a 100-request limit. Redis `INCR` is atomic for simple counters; use Lua scripts for multi-step sliding window operations.

**Cost-based limiting (for AI, exports, bulk operations):**
```lua
local key = KEYS[1]
local cost = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local window = tonumber(ARGV[3])
local current = tonumber(redis.call('GET', key) or '0')
if current + cost <= limit then
  redis.call('INCRBY', key, cost)
  redis.call('EXPIRE', key, window)
  return current + cost
end
return -1  -- rejected
```
Assign costs: `cheap_get=1`, `write=5`, `ai_generate=20`, `bulk_export=50`. This prevents one expensive call from consuming disproportionate quota.

---

### RING 4 — DOWNSTREAM PROTECTION

**Purpose:** Rate limit your own calls to external dependencies (databases, third-party APIs).
**Tool:** Circuit breakers (resilience4j, Polly, pybreaker), connection pool limits.
**Pattern:** If downstream error rate > threshold → open circuit → fail fast.

---

### Key Implementation Details

**Redis key pattern:**
```
ratelimit:{ring}:{identifier_type}:{identifier}:{window_bucket}
```

**Identifier layers (use all, don't pick one):**
- Edge: Per-IP (X-Forwarded-For trusted only from verified proxy IPs — never from arbitrary clients)
- Gateway: Per-API-key (cryptographically random tokens, never sequential IDs)
- Application: Per-user-ID for authenticated endpoints
- Application: Per-endpoint (GET=1000/min, POST=100/min, AI=cost-based)

**HTTP response compliance (IETF standard):**
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45
RateLimit-Policy: "100;w=60"
RateLimit: limit=100, remaining=0, reset=45
Content-Type: application/json

{"error": "rate_limit_exceeded", "retry_after": 45}
```

Send `RateLimit` headers on **all** responses (not just 429s) — this lets well-behaved clients throttle themselves proactively.

**Failure posture (explicit, per endpoint type, tested):**
```python
# Fail-open (default for general endpoints)
try:
    count = redis.incr(key)
    if count > limit:
        return Response(429)
except RedisException:
    log_metric("rate_limit_backend_error")
    pass  # allow the request — availability-first

# Fail-closed (auth/billing/high-abuse-risk endpoints)
except RedisException:
    return Response(503)  # safety-first
```

Wrap Redis calls in a circuit breaker: if error rate > 5% in 10s → trip → apply failure posture. Health check every 5s. Reset when healthy.

**Observability:**
```
rate_limit_requests_total{ring, endpoint, identifier_type, result="allowed|rejected"}
rate_limit_backend_latency_ms{ring}  # alert if >5ms — limiter is becoming a bottleneck
rate_limit_backend_errors_total{ring, backend="redis"}
```

**Tuning process (do not skip this):**
1. Deploy metrics before limits. Instrument first.
2. Baseline: measure p50/p95/p99 requests per identifier per window (1 week minimum).
3. Set initial limits at 5–10x p99 (permissive start).
4. Monitor for abuse patterns (top rate-limited identifiers, 429 rate by endpoint).
5. Tighten to 2–3x p99 after 2–4 weeks of data.
6. Review quarterly or after major traffic changes.

---

## ALTERNATIVE → Anti-Pattern Inversion (Failure-Mode Checklist)

**Best for:** Developers auditing an existing implementation, teams doing implementation review, anyone who learns better from failure modes than from prescriptive steps.

**Trade-off:** Negative-first framing requires reading all patterns before seeing the positive synthesis; doesn't provide the multi-ring architectural model.

The 8 most common rate limiting failures (and their fixes):

1. **Client-side rate limiting** → always server-side; client hints are supplemental only.
2. **Fixed window counters** → use sliding window (Redis sorted set + Lua) or token bucket; fixed window has a 2x burst boundary vulnerability.
3. **Non-atomic check-then-increment** → Redis INCR is atomic for simple counters; use Lua scripts for sliding window; never check, then increment separately.
4. **IP-only rate limiting** → layer identifiers: IP at edge, API-key at gateway, user-ID in app; trust X-Forwarded-For only from verified proxy IPs.
5. **Fail-closed on limiter outage** → define explicit posture per endpoint; most APIs should fail-open with logging; auth/billing endpoints should fail-closed with circuit breaker.
6. **429 without retry guidance** → always include Retry-After and RateLimit headers (IETF draft); send proactive headers on all responses.
7. **Uniform limits across endpoints** → per-endpoint limits; cost-based budgets for expensive operations.
8. **Set-and-forget limits** → rate limiting is operational; instrument, baseline, tune, and review on a regular cadence.

Full implementation checklist:
```
[ ] Algorithm: token bucket or sliding window (not fixed window for public APIs)
[ ] Atomicity: Redis INCR for simple counters, Lua script for sliding window
[ ] Granularity: IP at edge, API key at gateway, user ID in app
[ ] Per-endpoint limits with cost weighting for expensive operations
[ ] Failure posture: documented, circuit-breaker-implemented, tested
[ ] Response: 429 + Retry-After + RateLimit-Policy + RateLimit (IETF draft)
[ ] Proactive headers: send RateLimit on all responses (not just 429s)
[ ] Metrics: requests_total (allowed/rejected), backend_latency, backend_errors
[ ] Tuning: baseline → permissive → tighten → quarterly review cycle
```

---

## SELECTION GUIDANCE

- If you are **designing a system from scratch** or **advising a team on architecture** → use the Layered Architecture (Recommended). The ring model is the harder, more important insight.
- If you are **auditing an existing implementation** or **debugging why your rate limiter isn't working** → use the Anti-Pattern Checklist (Alternative). The failure-mode framing will quickly surface what's wrong.
- For **most developers implementing rate limiting for the first time**: start with the Alternative's checklist (to avoid the most common mistakes), then use the Recommended's ring architecture to structure where each limit lives.

---

*Selection basis: Condorcet pairwise comparison (3 pairs). Tally: B''=2 wins, C'=1 win, A'=0 wins.*
*Execution: INLINE (DEGRADED) — no sub-agent isolation. See process log.*
