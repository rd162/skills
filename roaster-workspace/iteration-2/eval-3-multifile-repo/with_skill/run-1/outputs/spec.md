# MGPC Spec — data_pipeline module (MASTER-only, never shown to reviewer)

## Element Count: 11 (Mission×1 + Goals×3 + Premises×3 + Constraints×4)

---

Mission: A production-ready Python data pipeline that reliably loads, transforms, and reports on sales data.

Goals:
G1: Load sales data accurately for a caller-specified date range (inclusive on both ends)
G2: Compute correct aggregations — total revenue, average order value (with decimal precision), and complete top-N product rankings
G3: Report results to Slack reliably, with caller-observable error information

Premises:
P1: The caller provides valid date strings; the pipeline handles the file I/O
P2: Input CSV may contain missing/NaN values that require explicit handling policy (not silent discard)
P3: Configuration (file paths, webhook URLs) is injected or configurable — not hardcoded constants

Constraints:
C1 (hard): No credentials, tokens, or secrets hardcoded in source files
C2 (hard): All errors must be surfaced to the caller — silent swallowing is prohibited
C3 (hard): The public API contract (function signatures, docstrings) must match actual behavior
C4 (soft): Numerical computations must use appropriate precision (no lossy integer arithmetic)

---
spec_element_count: 11
ar_count_expected: 11
