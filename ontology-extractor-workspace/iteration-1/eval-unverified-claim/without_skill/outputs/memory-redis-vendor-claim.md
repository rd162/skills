# Memory: Redis Cluster Performance Claim

**Date recorded:** 2026-06-26

## Claim

Our vendor stated that our Redis cluster can handle **500,000 operations per second**.

## Verification Status

**UNVERIFIED** — This figure comes directly from the vendor and has not been independently tested or confirmed.

## Source

- **Origin:** Vendor communication
- **Verified by us:** No

## Notes

- Do not treat this number as a confirmed system characteristic until benchmarked internally.
- When benchmarking, consider operation type (GET, SET, LPUSH, etc.), payload size, network conditions, and cluster configuration.
- Vendor claims may reflect best-case or synthetic benchmark conditions.

## Action Items

- [ ] Run internal benchmark against the Redis cluster
- [ ] Compare results to the 500K ops/sec vendor claim
- [ ] Document actual measured throughput once verified
