# Anti-Requirements — Data Pipeline Module

Derived by isolated AR-Inferrer sub-agent from MGPC spec only (no other context).

1. **Hardcoded credentials or secrets in source** — credentials embedded directly in code or committed config files → credential leakage on first push to version control, compromising all deployment targets simultaneously.

2. **Hardcoded absolute file paths** — paths like `/home/user/data/sales.csv` baked into source → module fails on every deployment target except the original author's machine, breaking the "deployable without configuration changes" premise.

3. **Off-by-one in date range filtering** — using exclusive upper bound (`< end_date` instead of `<= end_date`) → last day of range silently excluded, understating revenue for any report that includes the boundary date; violates the documented inclusive contract.

4. **Silent row drops on bad input** — malformed, null, or partial rows discarded without logging → data loss is invisible to operators; aggregations undercount without any signal, making the error undetectable until an audit.

5. **Swallowed exceptions in report delivery** — `try/except` blocks that catch delivery failures and return success or log nothing → operators never learn a report failed to reach its destination; violates the "report delivery failures must be surfaced" premise.

6. **Floating-point accumulation for currency aggregation** — summing revenue using native floats across thousands of rows → rounding drift produces arithmetically incorrect totals.

7. **Integer truncation in average order calculation** — computing `total_revenue / order_count` using integer division → average is systematically understated; failure is silent and plausible-looking.

8. **Undocumented or missing public API exports** — functions used by callers not included in the module's public export list → consumers import successfully in development but break on interface changes.

9. **Environment-specific configuration baked into logic** — hard-selecting a path or connection string from a magic constant → the module requires source edits to deploy to a new environment.

10. **No propagation of load-phase errors** — failures during data loading caught and replaced with an empty dataset → downstream aggregation runs on zero rows and produces a zero-revenue report that looks valid.

11. **Top-products ranking with off-by-one slice** — computing "top N products" with `iloc[:n-1]` → consistently returns n-1 results; any ranking-based business decision is made on an incomplete list.

12. **Aggregation applied before date filtering** — computing revenue totals across the full dataset then filtering → out-of-range data contaminates aggregations.

13. **Logging that reveals secrets at runtime** — debug-level logging that prints connection strings or API keys → secrets absent from source but present in runtime logs.
