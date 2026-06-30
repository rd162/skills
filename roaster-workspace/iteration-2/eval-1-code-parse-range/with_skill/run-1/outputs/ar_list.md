# Anti-Requirements — AR-Inferrer Output (verbatim)

Spec elements: 11 | ARs returned: 11 — COUNT MATCHES

1. The artifact does not correctly and safely parse CLI range arguments into lists of integers; it produces wrong or unsafe results.
2. Single-integer inputs are not parsed into a one-element list; the function mishandles them.
3. Range inputs are not expanded into the complete inclusive list of integers; elements are missing or the bounds are wrong.
4. Invalid input does not produce a clear, graceful error; the function either raises unhandled exceptions or returns silently wrong output.
5. Edge cases — zero, negative numbers, reversed ranges, and multi-hyphen strings — are not correctly handled; the function produces wrong or broken results for them.
6. The artifact mishandles the string input it actually receives from CLI argument parsing.
7. The function does not treat range notation as inclusive on both endpoints; the actual values returned do not match the documented contract.
8. The function does not fulfill a documented, reliable contract; callers cannot depend on consistent behavior.
9. The returned list is silently truncated, contains missing elements, or is incorrect due to off-by-one errors.
10. Non-numeric or malformed input silently returns garbage; behavior for such input is undefined.
11. The function's contract — valid input forms, return values, and error behavior — is not documented.
