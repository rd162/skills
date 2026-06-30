# MGPC Spec — parse_range

**Element count: 11** (1 Mission + 4 Goals + 3 Premises + 3 Constraints)

---

## Mission

Correctly and safely parse CLI range arguments (e.g., "1-5", "3") into lists of integers.

## Goals

G1: Parse single-integer inputs (e.g., "3") into a one-element list.
G2: Parse range inputs (e.g., "1-5") into the expected complete list of integers inclusive on both ends (e.g., "1-5" → [1,2,3,4,5]).
G3: Fail gracefully with a clear error on invalid input rather than raising unhandled exceptions or producing silently wrong output.
G4: Correctly handle edge cases: zero, negative numbers, reversed ranges, and multi-hyphen strings (e.g., "1-2-3").

## Premises

P1: The input is a string from CLI argument parsing.
P2: Range notation means inclusive on both endpoints (e.g., "1-5" yields [1,2,3,4,5]).
P3: The function is used as a library utility; callers depend on a documented, reliable contract.

## Constraints

CH1 (hard): The returned list must never be silently truncated, missing elements, or incorrect due to off-by-one.
CH2 (hard): Non-numeric or malformed input must not silently return garbage; behavior must be defined.
CS1 (soft): The function's contract (valid input forms, return values, error behavior) must be clearly documented.
