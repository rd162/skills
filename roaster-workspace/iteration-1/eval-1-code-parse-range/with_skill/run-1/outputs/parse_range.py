"""Parse a CLI range argument into an inclusive list of ints.

Surrounding whitespace is stripped (str.strip(), which removes Unicode
whitespace too); interior whitespace is NOT allowed ("1 - 5" is rejected).

Accepted (single argv token; quote if it contains spaces for stripping):
    "3"       -> [3]
    "1-5"     -> [1, 2, 3, 4, 5]     inclusive of both endpoints
    "-3--1"   -> [-3, -2, -1]        negative bounds allowed
    "5-5"     -> [5]

Note on negatives: '-' is both sign and separator. The grammar resolves this
deterministically — the first '-' after a (signed) integer is the separator.
So "-5-3" means -5..3; to express -5..-3 write "-5--3". Descending specs
(start > end), e.g. "5-1" or "5--3", are rejected rather than reversed.

Rejected with RangeParseError (a ValueError subclass, so existing
`except ValueError` handlers and argparse `type=` callbacks keep working):
    ""  "abc"  "1-2-3"  "1-"/"-"  "1-5x"  "5-1"  "1 - 5"
    "+5", "5_0", and non-ASCII-decimal tokens (e.g. "٣", "१") that int()
    would otherwise accept; any spec expanding to more than MAX_RANGE_SIZE.
"""
from __future__ import annotations

import re

__all__ = ["parse_range", "RangeParseError", "MAX_RANGE_SIZE"]

MAX_RANGE_SIZE = 1_000_000  # max elements one spec may expand to (anti-DoS)

# ASCII-only token. [0-9] (not \d) is a literal codepoint class U+0030..U+0039
# and never matches Unicode digits like "५"/"٣" that int() would accept.
_BOUND = r"-?[0-9]+"
_SINGLE_RE = re.compile(rf"^({_BOUND})$")
_RANGE_RE = re.compile(rf"^(?P<start>{_BOUND})-(?P<end>{_BOUND})$")


class RangeParseError(ValueError):
    """Raised when a range spec is malformed. Subclasses ValueError for
    backwards compatibility with existing handlers and argparse callbacks."""


def parse_range(spec: str) -> list[int]:
    if not isinstance(spec, str):
        raise RangeParseError(
            f"range spec must be a string, got {type(spec).__name__}"
        )
    token = spec.strip()
    if not token:
        raise RangeParseError("range spec is empty")

    single = _SINGLE_RE.match(token)
    if single:
        return [int(single.group(1))]

    match = _RANGE_RE.match(token)
    if not match:
        raise RangeParseError(
            f"invalid range spec {spec!r}; expected 'N' or 'START-END' "
            "with integer bounds and no interior spaces"
        )

    start = int(match.group("start"))
    end = int(match.group("end"))
    if start > end:
        raise RangeParseError(
            f"invalid range {spec!r}: start ({start}) > end ({end})"
        )

    size = end - start + 1  # checked BEFORE building the list (range is lazy)
    if size > MAX_RANGE_SIZE:
        raise RangeParseError(
            f"range {spec!r} expands to {size} values, exceeding the "
            f"maximum of {MAX_RANGE_SIZE}"
        )
    return list(range(start, end + 1))  # +1: inclusive endpoint


if __name__ == "__main__":
    # Real assertions: a regression now fails with a non-zero exit code.
    assert parse_range("1-5") == [1, 2, 3, 4, 5]      # inclusive
    assert parse_range("5-5") == [5]
    assert parse_range("3") == [3]
    assert parse_range("-3--1") == [-3, -2, -1]
    assert parse_range("  3  ") == [3]                 # surrounding ws ok
    assert len(parse_range(f"1-{MAX_RANGE_SIZE}")) == MAX_RANGE_SIZE
    for bad in ["", "abc", "1-2-3", "1-", "-", "1-5x", "5-1", "1 - 5",
                "+5", "5_0", "٣", "१"]:
        try:
            parse_range(bad)
        except RangeParseError:
            pass
        else:
            raise AssertionError(f"expected rejection for {bad!r}")
    print("all parse_range self-tests passed")
