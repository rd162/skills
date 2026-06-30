# Anti-Requirements — parse_range

*(Returned by isolated AR-Inferrer sub-agent; used by MASTER to enrich concerns list)*

1. **Off-by-one on the end bound** — using `range(N, M)` instead of `range(N, M+1)` when generating the integer list. → "1-5" silently returns [1,2,3,4], dropping the last element; callers miss the final page or line.

2. **Silent empty-list return on malformed input** — catching parse exceptions (e.g., `ValueError` from `int()`) and returning `[]` instead of re-raising. → Callers receive an empty result with no indication that the input was invalid; downstream iteration silently processes nothing.

3. **Negative-number silent acceptance via the dash ambiguity** — splitting on the first `-` without anchoring, so "-5" parses as N="" and M="5", or "1--5" parses without error. → A negative range endpoint produces a logically nonsensical list (e.g., `range(-5, 2)`) that passes type checks but corrupts 1-based index lookups.

4. **Over-eager split on all dashes** — using `str.split("-")` (no limit) on "1-2-3", producing three tokens instead of two, and then silently taking only the first two or crashing uncontrolled. → "1-2-3" either silently parses as "1-2" (dropping the third segment) or raises an unhandled `IndexError` with no informative message.

5. **Accepting reversed ranges without error** — no guard for N > M, so "5-1" returns `range(5, 2)` which is empty, or a reversed list if `range` is called with a negative step. → Caller receives [] or a backwards list for an input that looks valid but violates the N ≤ M premise; silent data loss.

6. **Stripping only the happy path — no whitespace/edge-character handling** — `int("1 ")` raises `ValueError` in Python, so "1 -5" or " 3" crash with a raw, uninformative `ValueError` traceback rather than a domain-specific message. → Error message exposes implementation internals ("invalid literal for int() with base 10") instead of telling the caller what was expected.

7. **Accepting the empty string silently** — no early guard for `spec == ""`, allowing `split("-")` on `""` to produce `[""]`, which then hits `int("")` and raises a raw `ValueError` rather than a clear domain error. → Callers that pass an uninitialized or missing argument get a cryptic crash with no actionable guidance.

8. **Informative error message omits the bad input** — raising `ValueError("invalid range spec")` without embedding the original string. → Developers and operators cannot distinguish which of many CLI arguments failed; debugging requires reproducing the exact invocation.

9. **No type annotation or docstring** — the function signature is `def parse_range(s):` with no indication of input/output types or contract. → The next maintainer cannot infer that the return type is `list[int]`, that `s` must be `str`, or that `ValueError` is the expected exception; defensive coding around the function becomes guesswork.

10. **Integer overflow / large-range DoS** — no upper bound check on M - N, so "1-10000000" materializes a ten-million-element list in memory unconditionally. → A single malformed or adversarial CLI argument exhausts heap memory; acceptable in a toy script but a latent denial-of-service in any server-adjacent context.

11. **Float-like strings accepted silently** — `int("1.5")` raises `ValueError` in Python, but a regex-only implementation that strips non-digits before casting could silently coerce "1.5" → 1 and "2.5" → 2. → "1.5-3.5" returns [1,2,3] with no error, masking a likely user typo and producing a plausibly correct but wrong result.

12. **Leading-zero ambiguity treated as octal** — in languages (C, Go, older JS) where `int("08")` is a parse error or silently octal-decoded, "08-10" fails or returns the wrong range. Even in Python this is a non-issue at runtime, but a regex that rejects leading zeros would silently reject valid inputs like "01-05" that some callers expect to work. → Behavior depends on undocumented assumptions about whether leading zeros are permitted, creating portability and interoperability bugs.
