# Requirements Specification — `parse_range`

> MASTER-only state. This spec is NEVER sent to the reviewer sub-agent. It exists to
> drive deterministic attack generation (Step 2) and DEFENSE verification.

## Source of spec

Established via the skill's inline enumeration procedure (Step 1, path ∆3). The
`requirements-extractor` helper skill was available, but the artifact is a 14-line
single-purpose CLI helper; inline enumeration yields a complete spec (Mission + Goals
present) at proportionate cost. Spec grounded by empirical execution of the original
artifact (observed outputs recorded in `trace.md`).

## Mission

`parse_range` exists to convert a user-supplied CLI range argument (e.g. `"1-5"`, `"3"`)
into the exact, correct, inclusive list of integers the user intends — reliably and with
clear errors on bad input — so that downstream CLI logic operates on the right set of
items.

(Recursive "why" termination: parse range string → so the CLI acts on the right items →
so the user gets the result they asked for → terminal user value.)

## Goals

- **G1 — Inclusive range semantics.** `"1-5"` must yield `[1, 2, 3, 4, 5]`. A CLI range
  `a-b` is universally understood as inclusive of both endpoints (cf. `seq`, `cut -f`,
  page-range conventions). Changing this changes what the function fundamentally is.
- **G2 — Single value.** `"3"` must yield `[3]`.
- **G3 — Robust validation of malformed input.** Garbage input (`""`, `"abc"`, `"1-2-3"`,
  `"1-"`, `"-"`, trailing junk) must raise a clear, typed, actionable error — never crash
  with a cryptic stdlib message and never silently return a wrong/empty list.
- **G4 — Predictable handling of reversed ranges.** `"5-1"` must not silently return `[]`.
  Either reject it with a clear error or define a documented, deterministic behavior.
- **G5 — Correct handling of negative integers.** If negatives are in scope for a range
  arg, `"-3"` (single) and a negative-endpoint range must be handled deterministically;
  if out of scope, they must be rejected with a clear message rather than crashing.

## Premises

- **P1 — Input is a string.** `spec` arrives as a `str` from CLI argv. (Source: stated in
  brief / standard argparse behavior.) If false, type handling is needed.
- **P2 — `-` is the range separator.** The separator between endpoints is a hyphen.
  (Source: stated by the `"1-5"` example.) This collides with the unary minus of negative
  numbers — a known parsing hazard that must be resolved, not ignored.
- **P3 — Endpoints are base-10 integers.** Range bounds are decimal integers, not floats
  or hex. (Source: inferred from `int()` usage and `"1-5"` shape.)
- **P4 — Callers expect a `list[int]` return.** Downstream code iterates the result as a
  concrete list. (Source: inferred from `list(range(...))` and `print` usage.)

## Constraints

### Hard (violation = rejection)

- **CH1 — No off-by-one.** The endpoint must be included. `range(start, end)` without
  `+1` is a defect.
- **CH2 — No silent wrong answers.** Malformed or reversed input must never silently
  produce an empty or truncated list that the caller mistakes for valid data.
- **CH3 — Errors must be typed and clear.** Bad input raises `ValueError` (or a documented
  subtype) with a message naming the offending input — not a bare stdlib
  `invalid literal for int()` leak.
- **CH4 — Pure / no side effects.** The function returns a value; it does not print, exit
  the process, mutate globals, or perform I/O. (The `__main__` demo may print.)
- **CH5 — Original function name and call shape preserved.** It must remain
  `parse_range(spec)` returning a `list[int]`, since "we use it to parse CLI range args" —
  callers already depend on the signature.

### Soft (violation = penalty)

- **CS1 — Tolerate surrounding whitespace.** `" 1 - 5 "` from sloppy shell quoting should
  parse rather than crash. (Preference, not strictly required.)
- **CS2 — Readable, maintainable code.** Clear naming, a docstring documenting the
  contract (inclusive semantics, accepted forms, error behavior), and reasonable structure.
- **CS3 — Self-tests / examples that demonstrate the correct contract.** The `__main__`
  block (or tests) should exercise the inclusive semantics and at least one error path, so
  the contract is self-evident and regression-protected.
- **CS4 — Type hints.** Signature annotated (`spec: str -> list[int]`) for clarity and
  tooling. (Preference.)
