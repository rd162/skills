import re

_RANGE_RE = re.compile(r"^(-?\d+)-(-?\d+)$")


def parse_range(spec):
    """Parse a CLI range argument into a list of integers.

    Accepted formats:
      - Single integer:  "3"   → [3]
      - Forward range:   "1-5" → [1, 2, 3, 4, 5]  (both endpoints inclusive)
      - Reversed range:  "5-1" → [5, 4, 3, 2, 1]  (both endpoints inclusive)
      - Negative values: "-3"  → [-3]
                         "-5--1" → [-5, -4, -3, -2, -1]
                         "-1--5" → [-1, -2, -3, -4, -5]

    Args:
        spec: A string containing a single integer or an M-N range expression.

    Returns:
        A list of integers.

    Raises:
        ValueError: If spec is not a str, is empty, or does not match any
                    accepted format.
    """
    if not isinstance(spec, str):
        raise ValueError(
            f"Expected str, got {type(spec).__name__!r}: {spec!r}"
        )
    spec = spec.strip()
    if not spec:
        raise ValueError("Range string must not be empty.")

    m = _RANGE_RE.match(spec)
    if m:
        start, end = int(m.group(1)), int(m.group(2))
        if start <= end:
            return list(range(start, end + 1))
        else:
            return list(range(start, end - 1, -1))

    try:
        return [int(spec)]
    except ValueError:
        raise ValueError(
            f"Invalid range string {spec!r}: expected an integer or 'M-N' format."
        )


if __name__ == "__main__":
    print(parse_range("1-5"))    # [1, 2, 3, 4, 5]
    print(parse_range("3"))      # [3]
    print(parse_range("-3"))     # [-3]
    print(parse_range("-5--1"))  # [-5, -4, -3, -2, -1]
    print(parse_range("5-1"))    # [5, 4, 3, 2, 1]
