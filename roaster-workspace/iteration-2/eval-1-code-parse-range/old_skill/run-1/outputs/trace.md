# Roaster v4.0 — Audit Trail
# Artifact: parse_range.py
# Task: "Review and harden this parse_range function — we use it to parse CLI range args like '1-5'."

## Spec (MASTER-only — never sent to reviewer)

Mission: Safely parse CLI range arguments like "1-5" or "3" into a list of integers,
         returning correct results for all valid inputs and raising clear errors on invalid ones.

Goals:
  G1: correctly parse single-integer specs ("3" -> [3])
  G2: correctly parse range specs ("1-5" -> [1,2,3,4,5], inclusive of end)
  G3: reject or raise meaningful errors on malformed input

Premises:
  P1: callers pass strings that are either a single integer or "N-M" form (N <= M)
  P2: returned list used for 1-based indexing (page/line numbers)

Constraints:
  CH1 (hard): end of range is inclusive — "1-5" must return [1,2,3,4,5]
  CH2 (hard): negative numbers must not cause silent corruption
  CH3 (hard): malformed input must raise an error, not silently return wrong results
  CS1 (soft): docstring and/or type annotations present
  CS2 (soft): error messages informative (include bad input, description of expected)

## Backend Detection

Mode: STATELESS (sub-agent tool available, no session continuity required across rounds)

## Step 1.5: AR-Inferrer

AR-Inferrer sub-agent spawned in isolation (received only Mission/Goals/Premises/Constraints).
Returned 12 anti-requirements. Key ones used in attack:
  AR1: off-by-one on end bound (range(N,M) not range(N,M+1))
  AR2: silent empty-list return on malformed input
  AR3: negative-number dash ambiguity (split on all dashes)
  AR4: over-eager split on all dashes ("1-2-3" silently truncated)
  AR5: accepting reversed ranges without error
  AR6: no whitespace/edge-character handling
  AR7: empty string accepted silently
  AR8: error message omits bad input string
  AR9: no type annotation or docstring

## Rounds

### s0 (original artifact)

```python
def parse_range(spec):
    # parse strings like "1-5" or "3" into a list of ints
    parts = spec.split("-")
    if len(parts) == 1:
        return [int(parts[0])]
    start = int(parts[0])
    end = int(parts[1])
    return list(range(start, end))
```

Known defects (verified by MASTER against spec):
  - range(start, end) — off-by-one, end excluded (violates CH1)
  - split("-") with no limit — "1-2-3" silently truncated (violates CH3)
  - "-5" splits to ["","5"] — silent crash with bare ValueError (violates CH2)
  - bare ValueError from int() — no input context (violates CS2)
  - no docstring, no annotations (violates CS1)
  - no reversed-range guard (AR5)

### Round 1

Attack style: literal inversion (Round 1 style)
PT variant: "submitted by a junior contributor using AI assistance — flagged for quality review"
Concerns sent: 9 items (spec inversions + AR inversions inlined)

Reviewer response: CAPITULATE
  - Confirmed: off-by-one (CH1), malformed-input truncation (CH3), empty string crash (CH3),
    negative-number mis-parse (CH2), reversed range returns [] (AR5),
    no docstring/annotations (CS1), no input in error messages (CS2)
  - Refuted (validly): single-value handling works correctly (G1 met)
  - Proposed s1: regex-based implementation with re.fullmatch, end+1, reversed-range guard,
    type annotations, full docstring, input-embedding error messages

MASTER classification: CAPITULATE (major structural revision)
MASTER applies s1.

### s1 (hardened artifact — proposed by reviewer, applied by MASTER)

```python
import re

def parse_range(spec: str) -> list[int]:
    """...(docstring with Args/Returns/Raises)..."""
    match = re.fullmatch(r"(-?\d+)(?:-(-?\d+))?", spec.strip())
    if match is None:
        raise ValueError(f"invalid range spec: {spec!r}")
    start = int(match.group(1))
    if match.group(2) is None:
        return [start]
    end = int(match.group(2))
    if end < start:
        raise ValueError(f"invalid range spec: {spec!r} — end ({end}) is less than start ({start})")
    return list(range(start, end + 1))
```

### Round 2

Attack style: consequence-focused (Round 2 style)
PT variant: "came out of a CI pipeline that doesn't actually validate anything"
Concerns sent: 8 items (re-asserting all original spec requirements + AR5 + AR8)
  Note: Concern 6 tested "1--2" behavior (potential regex edge case)
        Concern 8 tested large-range memory concern

Reviewer response: DEFENSE
  Refuted all 8 concerns with artifact-grounded evidence:
  1. CH1 — range(start, end+1): end IS included. Refutation: valid.
  2. CH2 — regex accepts leading minus: "-5" returns [-5]. Refutation: valid.
  3. CH3 — re.fullmatch blocks "1-2-3": fullmatch requires full match. Refutation: valid.
  4. CS2 — both raise sites use {spec!r}: input IS embedded. Refutation: valid.
  5. CS1 — docstring and annotations present. Refutation: valid.
  6. Regex edge "1--2" — reversed-range guard fires with clear message. Refutation: valid.
  7. AR5 — reversed-range guard fires: "5-1" raises ValueError. Refutation: valid.
  8. Size guard — operational concern, not a correctness defect. Contextual; accepted.

Genuine minor defects found by reviewer:
  D1: non-string input raises AttributeError (not TypeError) — defensive hardening gap
  D2: "N--M" form (range to negative) undocumented in docstring
  D3: whitespace stripping by .strip() undocumented

MASTER verification of defense: all 7 refutations confirmed against private spec.
DEFENSE is genuine — not sycophantic rationalization.

MASTER classification: DEFENSE — termination.

MASTER applies D1/D2/D3 minor corrections directly (no additional round needed):
  - Added isinstance(spec, str) type guard raising TypeError
  - Added "N--M" form to docstring accepted-forms section
  - Added whitespace-stripping note to docstring
  - Improved error message to include expected format hint

## Final State

Artifact: parse_range.py (final, in outputs/)
Termination: DEFENSE (Round 2)
Rounds: 2
Changes from s0: major structural revision
Changes from s1: 3 minor documentation/defensive-coding corrections (D1/D2/D3)

## Trace (compact notation)

spec[Mission, G×3, P×2, CH×3, CS×2] ARs×12 (isolated inferrer)
s0 → ATK(PT:junior-contributor) → reviewer → CAPITULATE: off-by-one, negative handling,
     malformed input, docstring/annotations all confirmed defects → s1
s1 → ATK+PT(CI-pipeline) → reviewer → defense:"re.fullmatch blocks 1-2-3", "range(start,end+1)
     inclusive", "regex handles -5", "reversed-range guard present", "error embeds input",
     "docstring+annotations present" → s1+D1D2D3 (DEFENSE, 3 minor doc fixes applied)
