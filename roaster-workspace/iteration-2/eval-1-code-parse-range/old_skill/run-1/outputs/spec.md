# Spec — parse_range

*(MASTER-only — never sent to reviewer)*

## Mission

Safely parse CLI range arguments like "1-5" or "3" into a list of integers,
returning correct results for all valid inputs and raising clear errors on invalid ones.

## Goals

- G1: correctly parse single-integer specs (e.g. "3" → [3])
- G2: correctly parse range specs (e.g. "1-5" → [1,2,3,4,5], inclusive of end)
- G3: reject or raise meaningful errors on malformed input (empty string, letters, extra dashes, etc.)

## Premises

- P1: callers pass strings that are either a single integer or "N-M" form (N ≤ M)
- P2: the returned list is intended for 1-based indexing (page numbers, line numbers) —
      so "1-5" means pages 1 through 5, all five included

## Constraints

### Hard

- CH1: end of range is inclusive — "1-5" must return [1,2,3,4,5] (not [1,2,3,4])
- CH2: negative numbers must not cause silent corruption (e.g. "1-5" parsed with split("-")
       gives ["1", "5"] but "-5" gives ["", "5"] — this must not silently "work"
- CH3: malformed input ("", "abc", "1-2-3", "1-", "-5") must raise an error, not return
       silently wrong or empty results

### Soft

- CS1: function has a docstring and/or type annotations for maintainability
- CS2: raised errors are informative (include the bad input and a description of what was expected)
