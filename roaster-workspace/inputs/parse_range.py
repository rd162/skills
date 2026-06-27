def parse_range(spec):
    # parse strings like "1-5" or "3" into a list of ints
    parts = spec.split("-")
    if len(parts) == 1:
        return [int(parts[0])]
    start = int(parts[0])
    end = int(parts[1])
    return list(range(start, end))


if __name__ == "__main__":
    print(parse_range("1-5"))
    print(parse_range("3"))
