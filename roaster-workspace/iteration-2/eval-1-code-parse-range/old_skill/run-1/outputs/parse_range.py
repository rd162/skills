import re


def parse_range(spec: str) -> list[int]:
    """Parse a CLI range string into an inclusive list of integers.

    Accepted forms:
        "N"    -> [N]                single integer (may be negative, e.g. "-3")
        "N-M"  -> [N, N+1, ..., M]  inclusive range (N and M may be negative,
                                     e.g. "-5--1" -> [-5, -4, -3, -2, -1])

    Leading and trailing whitespace in *spec* is stripped before parsing.

    Args:
        spec: The range string to parse (must be a str).

    Returns:
        A list of integers representing the range.

    Raises:
        ValueError: if *spec* is not a recognised range string or if end < start,
                    with the bad input string embedded in the message.
        TypeError: if *spec* is not a str.
    """
    if not isinstance(spec, str):
        raise TypeError(f"expected str, got {type(spec).__name__!r}")
    match = re.fullmatch(r"(-?\d+)(?:-(-?\d+))?", spec.strip())
    if match is None:
        raise ValueError(
            f"invalid range spec: {spec!r} — expected 'N' or 'N-M' (integers)"
        )
    start = int(match.group(1))
    if match.group(2) is None:
        return [start]
    end = int(match.group(2))
    if end < start:
        raise ValueError(
            f"invalid range spec: {spec!r} — end ({end}) is less than start ({start})"
        )
    return list(range(start, end + 1))


if __name__ == "__main__":
    print(parse_range("1-5"))   # [1, 2, 3, 4, 5]
    print(parse_range("3"))     # [3]
