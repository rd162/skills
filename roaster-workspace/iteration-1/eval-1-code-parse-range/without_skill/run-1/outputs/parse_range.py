"""Parse CLI range arguments such as "1-5" or "3" into a list of ints.

The grammar accepted is intentionally small and strict so that malformed
CLI input fails loudly with an actionable message instead of silently
producing surprising output.

Accepted forms:
    "3"      -> [3]            (single value)
    "1-5"    -> [1, 2, 3, 4, 5]  (inclusive range; end is included)
    "-3--1"  -> [-3, -2, -1]   (negative bounds are allowed)
    "5-5"    -> [5]            (degenerate range)

Rejected (raise RangeParseError):
    ""        empty / whitespace-only input
    "a-b"     non-integer bounds
    "1-2-3"   too many components
    "5-1"     descending range (start > end)
    a step exceeding MAX_RANGE_SIZE elements (guards against e.g. "1-100000000")
"""

from __future__ import annotations

import re
from typing import List

__all__ = ["parse_range", "RangeParseError", "MAX_RANGE_SIZE"]

# Upper bound on how many integers a single range spec may expand to.
# This protects callers from accidental or hostile input like "1-2000000000"
# that would otherwise try to materialize a huge list and exhaust memory.
MAX_RANGE_SIZE = 1_000_000

# A bound is an optional leading minus sign followed by one or more digits.
# Using an explicit pattern (rather than int() alone) lets us reject inputs
# that int() would otherwise accept but that are not valid CLI tokens, such
# as "+5", " 5", "5_0" (underscore grouping), or unicode digits.
_BOUND = r"-?\d+"
_SINGLE_RE = re.compile(rf"^(?P<value>{_BOUND})$")
_RANGE_RE = re.compile(rf"^(?P<start>{_BOUND})-(?P<end>{_BOUND})$")


class RangeParseError(ValueError):
    """Raised when a range spec is malformed.

    Subclasses ValueError so existing ``except ValueError`` handlers and
    argparse ``type=`` callbacks keep working, while callers that want to
    distinguish range errors specifically still can.
    """


def parse_range(spec: str) -> List[int]:
    """Parse a CLI range spec into an inclusive list of integers.

    Args:
        spec: A string of the form ``"N"`` or ``"START-END"``. Surrounding
            whitespace is ignored. ``START`` and ``END`` may be negative.

    Returns:
        A list of ints. For ``"START-END"`` the range is *inclusive* of both
        ends, so ``"1-5"`` yields ``[1, 2, 3, 4, 5]``.

    Raises:
        RangeParseError: If ``spec`` is not a string, is empty, contains
            non-integer bounds, has the wrong number of components, describes
            a descending range, or would expand to more than
            ``MAX_RANGE_SIZE`` elements.
    """
    if not isinstance(spec, str):
        raise RangeParseError(
            f"range spec must be a string, got {type(spec).__name__}"
        )

    token = spec.strip()
    if not token:
        raise RangeParseError("range spec is empty")

    # Single value, e.g. "3" or "-3".
    single = _SINGLE_RE.match(token)
    if single:
        return [int(single.group("value"))]

    # Range, e.g. "1-5" or "-3--1".
    match = _RANGE_RE.match(token)
    if not match:
        raise RangeParseError(
            f"invalid range spec {spec!r}; expected 'N' or 'START-END' "
            "with integer bounds"
        )

    start = int(match.group("start"))
    end = int(match.group("end"))

    if start > end:
        raise RangeParseError(
            f"invalid range {spec!r}: start ({start}) is greater than "
            f"end ({end})"
        )

    size = end - start + 1
    if size > MAX_RANGE_SIZE:
        raise RangeParseError(
            f"range {spec!r} expands to {size} values, exceeding the "
            f"maximum of {MAX_RANGE_SIZE}"
        )

    # +1 because the range is inclusive of `end`; this fixes the original
    # off-by-one bug where range(start, end) dropped the final value.
    return list(range(start, end + 1))


if __name__ == "__main__":
    # Demonstrate the happy path and a couple of error cases.
    for example in ("1-5", "3", "-3--1", "5-5"):
        print(f"{example!r:>10} -> {parse_range(example)}")

    for bad in ("", "a-b", "1-2-3", "5-1"):
        try:
            parse_range(bad)
        except RangeParseError as exc:
            print(f"{bad!r:>10} -> error: {exc}")
