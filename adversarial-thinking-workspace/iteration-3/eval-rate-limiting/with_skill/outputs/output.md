# API Rate Limiting — Adversarial Thinking Result
**Execution mode:** PARALLEL (7 isolated sub-agents — NOT DEGRADED)
**Depth:** Standard
**Pipeline:** Phase 0 → Phase 1 → Phase 2 (4 agents, parallel) → Phase 3 (3 Condorcet agents, parallel) → Phase 4

---

## RECOMMENDED → Sliding Window Counter + Adaptive Throttling Hybrid (B')

**Why it won:** B' beat both other candidates in head-to-head Condorcet comparison. It was selected over A' (Token Bucket + Lua) primarily because of stronger burst protection (hybrid design eliminates boundary-burst that pure token bucket cannot prevent), more defensible fail-open/fail-closed policy (per-endpoint-type rather than global), and more proactive abuse resistance (progressive backoff + auto-block vs. circuit-breaker-centric).

### Core Algorithm: Hybrid Sliding Window + Token Bucket

A request must pass **both** checks:
1. **Sliding window** — enforces the sustained quota (estimate = `current_count + prev_count × (1 - elapsed/window)`)
2. **Token bucket gate** — enforces a hard burst ceiling independent of window position

This eliminates boundary burst: at window rollover the sliding window resets favorably, but the token bucket has not refilled at the same rate, so a client cannot send N requests at the end of window W and immediately send N more at the start of W+1.

### Atomic Lua Script (per layer)

```lua
-- All 4 checks are Lua scripts — atomic by Redis guarantee
-- KEYS[1] = sliding window key, KEYS[2] = token bucket key
-- Uses Redis TIME for server-side clock (single authoritative source)
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)  -- ms

-- Sliding window estimate
local prev_count = tonumber(redis.call('GET', KEYS[1] .. ':prev') or '0')
local curr_count = tonumber(redis.call('GET', KEYS[1] .. ':curr') or '0')
local elapsed_frac = (now % window_ms) / window_ms
local estimate = curr_count + prev_count * (1 - elapsed_frac)

-- Token bucket
local bucket = redis.call('HMGET', KEYS[2], 'tokens', 'last_refill')
local tokens = tonumber(bucket[1] or cap)
local last_ts = tonumber(bucket[2] or now)
local new_tokens = math.min(cap, tokens + (now - last_ts) * rate)

-- Both must pass
if estimate >= sw_limit or new_tokens < 1 then
    local retry_ms = math.max(window_ms - (now % window_ms), (1 - new_tokens) / rate)
    return {0, math.ceil(estimate), math.floor(new_tokens), math.ceil(retry_ms)}
end

-- Commit atomically
redis.call('INCR', KEYS[1] .. ':curr')
redis.call('PEXPIRE', KEYS[1] .. ':curr', window_ms * 2)
redis.call('HMSET', KEYS[2], 'tokens', new_tokens - 1, 'last_refill', now)
return {1, math.ceil(estimate) + 1, math.floor(new_tokens - 1), 0}
```

### 4 Enforcement Layers

Checked in order, any rejection short-circuits:

| Layer | Key pattern | Example limit |
|-------|-------------|---------------|
| 1. Global | `rl:global:{window_bucket}` | 50k req/min total |
| 2. IP | `rl:ip:{hashed_ip}:{window_bucket}` | 10/sec, 500/min |
| 3. API key | `rl:key:{key_id}:{window_bucket}` | plan-based (100–10k/min) |
| 4. Endpoint | `rl:ep:{key_id}:{endpoint}:{window_bucket}` | e.g., 20/sec on /infer |

Hash tags force all layer keys for a given context to the same Redis Cluster shard.

### Redis Cluster Slot Affinity

```python
def make_keys(key_id: str, endpoint: str, window_bucket: int):
    tag = f"{key_id}:{endpoint}"
    return (
        f"rl:sw:{{{tag}}}:{window_bucket}",   # sliding window
        f"rl:tb:{{{tag}}}",                    # token bucket
    )
    # Braces force same hash slot → Lua executes on one node → atomic
```

### RFC 6585 Headers (every response)

```python
headers = {
    "Retry-After": str(retry_after_secs),           # integer delay-seconds
    "RateLimit-Limit": str(binding.limit),           # IETF draft
    "RateLimit-Remaining": str(max(0, remaining)),
    "RateLimit-Reset": str(retry_after_secs),
    "X-RateLimit-Layer": binding.layer_name,         # which layer is binding
    "X-RateLimit-Policy": f"{limit};w={window_secs}",
}
```

### Graduated Approaching-Limit Warnings

```python
# Warning fires at 80%, 90%, 95% consumed — not just at the wall
WARNING_THRESHOLDS = [0.80, 0.90, 0.95]

for threshold in reversed(WARNING_THRESHOLDS):
    if consumed >= threshold:
        headers["Warning"] = (
            f'199 - "RateLimit at {int(threshold*100)}% of quota; '
            f'{remaining} requests remaining; resets in {reset_secs}s"'
        )
        break
```

### Fail Policy (per endpoint type)

```python
def _fallback(self, endpoint_type: str) -> RateLimitResult:
    if endpoint_type in ("auth", "billing", "password_reset"):
        return RateLimitResult(allowed=False, fallback=True, retry_after=30)
        # Fail-closed on sensitive endpoints — avoid abuse during outage
    else:
        return RateLimitResult(allowed=True, fallback=True)
        # Fail-open on general endpoints — prefer availability
```

Circuit breaker: CLOSED → OPEN (after 5 failures) → HALF_OPEN (after 30s) with exponential backoff on recovery timeout.

### Retry Storm Detection + Auto-Block

```python
# Progressive backoff: 2^n seconds, capped 300s
THRESHOLDS = [(5, 10), (10, 30), (20, 60), (50, 300)]

# Top-N abuser sweep every minute
top = redis.zrevrange(f"rl:abusers:{window_bucket}", 0, 9, withscores=True)
for client_id, score in top:
    if score > AUTO_BLOCK_THRESHOLD:
        blocklist.add(client_id, ttl_secs=3600)
```

### Trusted Proxy IP Extraction

```python
def extract_client_ip(request) -> str:
    # Walk XFF right-to-left; stop at first non-trusted IP
    for candidate in reversed(xff.split(",")):
        if not any(parsed in net for net in TRUSTED_PROXIES):
            return candidate  # true client IP
    return request.remote_addr
    # TRUSTED_PROXIES refreshed from CDN JSON APIs every 6h
```

### Observability

```python
metrics.increment("rl_requests_total", layer=layer, result="allowed|rejected|fallback_allowed|fallback_rejected", plan=plan)
metrics.histogram("rl_check_duration_ms", layer=layer, backend="redis|local_fallback")
metrics.gauge("rl_circuit_breaker_state", value=0|1|2)
```

Alerts: rejection spike >10%, check latency p95 >5ms, circuit breaker open, fallback rate >100/s.

**Best for:** Teams building production APIs on conventional infrastructure with Redis. Strong fit where burst control, distributed abuse resistance, and granular fail policy across endpoint types are priorities.

**Trade-off:** Hybrid design is slightly more complex to reason about than a pure token bucket. The token bucket and sliding window can produce surprising interactions at the margin — document their independent behavior clearly for oncall.

---

## ALTERNATIVE → Token Bucket + Lua Atomicity Stack (A')

**Why it's the runner-up:** A' won its match against C' and came close in its match against B'. Its main differentiator is cross-layer atomic correctness — all 4 layers checked in a single Lua call rather than 4 sequential calls — and stronger distributed failure mode handling (shard run-id migration detection, quorum-aware emergency cap tightening).

### Core Mechanism

Single Redis Lua script checks all 4 layers atomically using integer-only refill:

```lua
local elapsed_us = now_us - last_us
if elapsed_us < 0 then elapsed_us = 0 end  -- monotonic guard on failover
local new_tokens = math.min(capacity, tokens + math.floor(elapsed_us * rate / 1000000))
-- math.floor: never overshoot; math.min: hard ceiling
```

Hash-tag pinning keeps all 4 layer keys on the same Redis Cluster shard so the single Lua call is atomic across all layers.

### Where A' is stronger than B'

- **Cross-layer atomicity:** One Lua call for all 4 layers vs. B's 4 sequential calls. A request can't slip through a layer gap during a concurrent write between B's sequential checks.
- **Shard migration safety:** Detects shard run-id change on failover and skips refill for that tick — prevents corruption burst during slot rebalancing.
- **Quorum-aware emergency cap:** If >50% of nodes are in OPEN breaker state (indicating coordinated attack on Redis), all nodes tighten emergency cap to 25% automatically.

### Where B' is stronger

- Hybrid design eliminates boundary burst that token bucket can't prevent
- Per-endpoint-type fail policy (B') vs. global fail-open (A')
- Graduated warnings at 80/90/95% (B') vs. single threshold at 10% (A')
- Progressive per-client backoff penalties (B') vs. circuit-breaker-centric defense (A')

**Best for:** Systems where absolute cross-layer atomicity and shard-migration correctness are paramount (e.g., strict financial APIs where even a single boundary-burst overshoot is unacceptable).

---

## SELECTION GUIDANCE

| Criterion | Use B' | Use A' |
|-----------|--------|--------|
| Need to eliminate boundary burst | ✓ | |
| Per-endpoint fail policy matters | ✓ | |
| Graduated client warnings important | ✓ | |
| Need all 4 layers checked in one atomic op | | ✓ |
| Redis Cluster with frequent rebalancing | | ✓ |
| Coordinated Redis-unavailability attack model | | ✓ |

**Both** require: Redis, RFC 6585 headers, XFF trusted-proxy validation, Lua atomicity, hash-tag slot pinning.

---

## TRACE

### Phase 0: Requirements
10 requirements (R1–R10) inferred from domain research. 6 implicit (not stated by user): R2 atomicity, R6 proxy extraction, R7 distributed correctness, R8 observability, R9 approaching warnings, R10 bypass resistance.

### Phase 1: Candidates
- A: Token Bucket + Lua Atomicity Stack
- B: Sliding Window Counter + Adaptive Throttling
- C: Policy-as-Configuration Gateway Pattern (Kong)
Divergence: A vs B ~7/10, A vs C ~9/10, B vs C ~9/10

### Phase 2: Critique (agent a71a7741aae5514ce)
A gaps: R1 float overshoot, R7 multi-master skew, R9 no warnings, R10 uncoordinated fail-open
B gaps: R1 boundary burst, R2 pipeline non-atomic, R3 only 2 layers, R4 missing headers, R5 no fallback, R6 no XFF, R7 skew + slot, R8 no metrics, R9 no warnings, R10 multi-gap
C gaps: R1 no algorithm, R2 unverifiable, R3 layers unverified, R4 gateway-dependent, R5 undocumented, R6 unconfigured, R7 hot-reload gap, R8 unspecified, R9 unconfigured, R10 hot-reload exploit

Authors A, B, C improved in parallel — all gaps addressed.

### Phase 3: Condorcet
- A' vs B' (agent ac8d58af2924510ba): B' wins — stronger on R1, R5, R9, R10
- A' vs C' (agent a9a26ce3a40b61833): A' wins — stronger on R5, R7, R10
- B' vs C' (agent aeadb80ba9dba0dc7): B' wins — stronger on R1, R5, R8, R9, R10

**Tally: B'=2, A'=1, C'=0**
