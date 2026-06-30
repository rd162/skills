# Roaster Spec — Data Pipeline Module (MASTER-ONLY)

## Mission

Provide a production-ready data pipeline module (load → transform → report) that correctly, safely, and observably processes sales data.

## Goals

- G1: Load sales data correctly for the requested date range
- G2: Aggregate sales data accurately (revenue, avg order, top products)
- G3: Deliver reports reliably with observable error handling
- G4: Be deployable without configuration changes per environment

## Premises

- P1: The module is used in a production environment with multiple deployment targets
- P2: Sales data has variable quality (nulls, bad formats, partial rows)
- P3: Report delivery failures must be surfaced to operators

## Constraints

### Hard
- CH1: No credentials or secrets hardcoded in source
- CH2: No hardcoded absolute file paths
- CH3: Date filtering must match the documented contract (inclusive on both ends)
- CH4: Numeric aggregations must be arithmetically correct

### Soft
- CS1: Data loss (silently dropped rows) should be logged/observable
- CS2: Errors should propagate or be logged — not silently swallowed
- CS3: Exported public API should match what is documented/expected
- CS4: Functions exported publicly should include all functions in use

## Original defects identified (s₀)

| ID | File | Defect | Constraint violated |
|----|------|--------|---------------------|
| D1 | loader.py L3 | Hardcoded absolute path `/data/sales/sales_2025.csv` | CH2 |
| D2 | loader.py L10 | Silent `dropna()` with no logging | CS1 |
| D3 | loader.py L14 | End date exclusive (`<`) but docstring says inclusive | CH3 |
| D4 | report.py L4 | Hardcoded Slack webhook URL (credential in source) | CH1 |
| D5 | report.py L19 | `except Exception:` silently swallows all delivery errors | CS2 |
| D6 | transform.py L13 | Integer division `//` truncates avg_order cents | CH4 |
| D7 | transform.py L22 | `iloc[:n-1]` returns n-1 items, not n | CH4, G2 |
| D8 | __init__.py | `top_n_products` not in `__all__` | CS4 |
