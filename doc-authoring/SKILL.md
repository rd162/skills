---
name: doc-authoring
description: >-
  House style for writing and reviewing technical design documents, specifications, notes and
  runbooks: complete design content with minimal prose, one fact stated once, tables reserved for
  records, plain noun-label captions, and evidence traceable to a real source. Use when drafting or
  reviewing a design document, specification, technical note or runbook, or when a document reads as
  bloated, repetitive, narrated, or padded with unsourced examples. `scripts/voice_check.py` enforces
  what a machine can check.
metadata:
  tags: technical-writing, house-style, documentation, specification, voice-check
tier: T3
source_class: llm
---

# Document Authoring House Style

Paste this page verbatim into every writing brief. `scripts/voice_check.py` enforces what a machine can.

1. **Complete design, minimal prose.** Keep every piece of design content the reader needs — schemas, field
   tables, real examples, diagrams, the model listing, names and rules. Cut the prose around it: restatement,
   narration, explanation of what a table already shows, textbook background.
2. **State the fact.** Never tell objects as a story: no "first / then / finally", no "two records, two
   monitors", no object as the actor of a little narrative.
3. **One fact, once.** No restatement, no paragraph summarising the table beside it, no section repeating another.
4. **Tables only for records:** schema fields, API fields and bodies, attribute mappings. Rules, steps,
   guarantees and options are an unnumbered bullet list.
5. **Captions and diagram titles are noun labels.** `**Figure — Storage map.**` and nothing after the label.
6. **Diagrams:** only where they show something a table cannot — structure top-down with at most eight boxes;
   component calls as a sequence diagram with at most eight participants. Short labels. Render, look at the image,
   and reject it if its text needs zooming (a structure diagram also if it is wider than tall).
7. **No textbook.** No glossary or terms table; no explanation of a vendor or standard concept — cite it.
8. **Listings:** at most one code or model listing per document, only if the design needs it; full models live in
   the interface files.
9. **Names:** the standard name (vendor, RFC, open data model, standards body) over a coined one; never
   invent an abbreviation.
10. **Real values only**, each traceable to a cited source. With no real value, show the field, not an example.
11. **Size:** the brief sets a line budget per section and in total; the draft fits it.
12. **Short units:** a paragraph has at most three sentences; a sentence at most thirty words.

## Design content

- A position that contradicts the client's source document is stated as a departure and listed for the client,
  never absorbed into the design.
- A source requirement keeps its own modal in every document; never strengthen or weaken it.
- The body links every design chapter and interface file at least once.
- Each operation is walked step by step with its guards, failure path and rollback path.
- Every boundary-crossing parameter appears in the mapping table; every transition has a trigger, a guard and
  an outcome.
- A figure never carries a rule, guard or mapping that the text does not state.
- A measured value carries its unit; no adjective stands in its place.
- State the obligation; retry counts, timeouts and pool sizes are left to the estate.
- Before deleting a passage, move any fact it alone holds to its owning section.
- No internal identifier or path appears inside a figure.
- One diagram label names one real thing across the whole document set.

## Evidence and names

- Only the RFC 2119/8174 keywords, in capitals, carry normative force; the body carries the declaration verbatim.
- Use the source document's own words for what it names; a sharper definition follows in the same sentence.
- One term per sense and one verb per operation; never rotate synonyms.
- Never mention a missing source, link or acquisition in a delivered document.
- A sentence about what a source says goes in a reconstruction appendix, never the specification.
- A value observed on a test rig, emulator or proof holds only for that scope.
- Only components the source document or the estate names appear in the design.

## Reference

- `scripts/voice_check.py <doc.md> [--images DIR] [--max-lines N] [--against DRAFT.md]` — mechanical check;
  exits 1 on any FAIL.
