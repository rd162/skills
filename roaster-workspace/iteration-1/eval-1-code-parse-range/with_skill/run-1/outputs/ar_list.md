# Anti-Requirements — `parse_range`

Returned by an isolated AR-Inferrer sub-agent (real sub-agent backend, STATEFUL).
The sub-agent received ONLY the requirements spec (see `ar_inferrer_prompt.txt`) — no
artifact, no user history, no MASTER bias. agentId: aeb25181b6ad4dcc8.

These are failure patterns any solution must avoid. MASTER inlines selected inversions of
these into the round concerns lists (never as a labelled "anti-requirements" section to
the reviewer).

1. **Exclusive-end range arithmetic (`range(a, b)` or `b - a` without `+ 1`)** — treating
   "1-5" as Python's half-open `range(1, 5)` yields `[1, 2, 3, 4]`. → off-by-one
   truncation; the final item the user explicitly named is silently dropped from all
   downstream processing.

2. **Naive `split("-")` as the parsing primitive** — using `spec.split("-")` collapses the
   range-separator and the unary-minus ambiguity into one operator, so "1-5" →
   `["1","5"]` but "-3" → `["","3"]` and "5--1" → `["5","","1"]`. → negative endpoints and
   single negatives are misparsed or crash; the central documented parsing hazard goes
   unresolved.

3. **Unbounded-split acceptance of multi-hyphen input** — "1-2-3" passing through
   `split("-")` produces `["1","2","3"]` and either a swallowed `[1,2]` (ignoring the third
   token) or an unhandled unpack error. → malformed multi-separator input is silently
   truncated to a plausible-looking wrong range, or crashes cryptically.

4. **Leaking the bare `ValueError: invalid literal for int() with base 10: 'abc'`** —
   letting `int()` raise its stdlib message instead of catching and re-raising a typed,
   input-naming error. → caller and end-user get a cryptic library-internal message that
   does not name the offending spec or explain the contract.

5. **Empty / whitespace-only input resolving to `[]` or `[0]`** — `""` or `"   "` slipping
   through to return an empty list (mistaken for "no items") or coercing to a single zero.
   → silent wrong answer; downstream logic operates on nothing or on a spurious item 0 with
   no error signal.

6. **Reversed range silently yielding `[]`** — computing "5-1" as `list(range(5, 1+1))` →
   `[]` because start exceeds stop, and returning that empty list as if valid. → the
   explicitly-forbidden silent-empty case; caller mistakes "no items" for legitimate data.

7. **Trailing/embedded junk accepted by lenient integer coercion** — relying on parsing
   that tolerates "3x", "1 - 5 foo", or "1-5;" by extracting leading digits, or per-token
   `strip()` that masks interior garbage. → malformed specs with trailing junk parse to a
   wrong-but-plausible range rather than being rejected.

8. **Dangling-endpoint specs ("1-", "-", "-5" when negatives are out of scope) treated as
   valid** — "1-" parsed as open-ended/zero, "-" parsed as 0-to-0 or empty, an isolated "-"
   not rejected. → incomplete specs produce fabricated ranges instead of a clear error.

9. **Undocumented, non-deterministic negative-number policy** — neither rejecting negatives
   with a clear message nor defining their inclusive semantics, so "-3", "-5--1", or "1--2"
   behave by accident of the parser. → behavior the contract cannot state; identical-looking
   inputs yield ints, errors, or empty lists unpredictably.

10. **Side effects inside the parser (`print`, `sys.exit`, `logging`, global mutation,
    file/stdout I/O on error)** — handling bad input by printing a message and/or calling
    `sys.exit(1)` instead of raising and returning. → function is impure and untestable in
    isolation; an embedded/library caller has its process killed or its stdout polluted.

11. **Signature drift from `parse_range(spec) -> list[int]`** — renaming the function,
    adding required params, returning a generator/tuple/set/`range` object, or returning
    `None` on error instead of raising. → existing callers that depend on the exact name,
    call shape, and concrete list return break at the boundary.

12. **Stringly-typed or wrong-typed elements in the result** — returning `["1","2"]`
    (unconverted strings) or floats from a `float()`-based parse. → caller expecting
    `list[int]` gets silently mistyped data that fails or misbehaves downstream.

13. **Whitespace intolerance on otherwise-valid specs** — rejecting `" 1-5 "` or `"3 "`
    from sloppy shell quoting as malformed because no outer `strip()` is applied. →
    legitimate quoted CLI input is spuriously rejected (inverse of #7).

14. **Single bare integer routed through range logic** — handling "3" by forcing it into
    the `a-b` branch (e.g. defaulting the missing endpoint), yielding `[]`, `[3, 3]`, or an
    error. → the simplest valid case is mishandled.

15. **Self-tests / examples that exercise only the happy path** — docstring examples and
    tests covering "1-5" and "3" but never an error path, a reversed range, or a negative.
    → the contract's hardest guarantees silently regress.

---

**Hazard clusters identified by the sub-agent:** (a) off-by-one in range expansion (#1);
(b) the hyphen / unary-minus parsing collision (#2, #3, #8, #9); (c) silent wrong answers —
empty/truncated/mistyped results passed off as valid (#5, #6, #7, #12, #14); (d) contract
violations around typed errors, purity, signature, and demonstrated behavior (#4, #10, #11,
#13, #15). Deliberate tension between #7 (reject interior junk) and #13 (tolerate surrounding
whitespace): a correct solution strips the outer boundary only, then validates strictly.
