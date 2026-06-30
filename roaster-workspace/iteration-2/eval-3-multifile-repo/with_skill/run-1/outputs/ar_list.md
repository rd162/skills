# AR-Inferrer Output — verbatim (11 statements, matches 11 spec elements)

1. This is not a production-ready pipeline; it does not reliably load, transform, and report on sales data.
2. The pipeline does not load sales data accurately for a caller-specified date range; one or both endpoints are excluded or mishandled.
3. The aggregations are incorrect; total revenue is wrong, average order value loses decimal precision, and the top-N product rankings are incomplete.
4. Results are not reliably reported to Slack, and error information is not observable by the caller.
5. The artifact mishandles the file I/O it is actually responsible for, despite receiving valid date strings from the caller.
6. The pipeline silently discards missing and NaN values rather than applying an explicit handling policy.
7. Configuration values such as file paths and webhook URLs are hardcoded constants rather than injected or configurable.
8. Credentials, tokens, or secrets are hardcoded directly in the source files.
9. Errors are silently swallowed and not surfaced to the caller.
10. The public API contract — function signatures and docstrings — does not match the actual behavior of the implementation.
11. Numerical computations use lossy integer arithmetic rather than appropriate precision types.
