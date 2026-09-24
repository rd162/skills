---
name: doc-export
description: Export documents to DOCX, PDF, PPTX, or XLSX — markdown to Word, reports to PDF, slides, spreadsheets. Use whenever the user wants to produce, convert, or polish a .docx, .pdf, .pptx, or .xlsx file, even if they only say "report", "memo", "slides", or "as Word". Do NOT use for reading or extracting content from documents (that is the ingestion pipeline's job).
source: https://github.com/anthropics/skills/tree/main/skills
compatibility: Requires pandoc, LibreOffice (soffice), python3; network access to github.com for reference fetch
metadata:
  author: rd162@hotmail.com
  scope: export-only
---

# Document Export Shim

Export-only skill for producing polished office documents. It carries no
upstream content itself: on every run it fetches the current reference recipes
from the upstream skills repo into `$TMPDIR` and follows them, so guidance
never goes stale and nothing proprietary is retained locally.

Why the fetch-per-run design: the reference skills are source-available, not
open source — keeping a local copy would violate their license. An ephemeral
`$TMPDIR` checkout, deleted after the run, keeps this skill a clean shim.
Document *import* (reading/extracting PDFs, scans, complex layouts) is
explicitly out of scope — that belongs to the ingestion pipeline
(Docling + visual windows), which beats naive text extraction on hostile
documents. If the user asks to read or extract, say so and stop.

## Procedure

Follow these steps in order, using the imperative.

1. **Determine the target.** Map the request to one of `docx`, `pdf`, `pptx`,
   `xlsx`. If the user named no format but asked for a "report/memo/letter",
   default to `docx`; "slides/deck" → `pptx`; "sheet/table workbook" → `xlsx`.
   Confirm the output path with the user when ambiguous, otherwise write next
   to the source file.
2. **Fetch references** by running the bundled script:
   ```bash
   bash <skill-dir>/scripts/fetch_refs.sh <format> [work-dir]
   ```
   It sparse-clones the upstream repo into `$TMPDIR` (or `work-dir`) and prints
   `REF_DIR=<path>`. Read `$REF_DIR/<format>/SKILL.md` first, then any
   additional file it points to for your operation (e.g. forms/deep-reference
   docs). These are the operating instructions — follow their recipes and
   heed their edge-case notes (tracked-changes quirks, auto-numbering ghosts).
3. **Execute with the local toolchain** (`pandoc`, `soffice --headless`,
   `python3` with `pypdf`/`python-docx`/`openpyxl` as the reference dictates).
   Prefer the reference's exact commands over improvisation; they encode
   production edge cases. Quick conversions that need no reference:
   - markdown → docx: `pandoc -f markdown -t docx -o out.docx in.md`
     (add `--reference-doc=template.dotx --toc` for branded output)
   - docx → pdf: `soffice --headless --convert-to pdf out.docx`
   - markdown → pptx/beamer-pdf: `pandoc -t pptx -o out.pptx in.md`
4. **Verify the artifact.** Re-open what you produced (docx→`pandoc -t plain`,
   pdf page count via `pypdf`, xlsx sheet list) and confirm the content
   survived: headings, tables, and images in place, no stray empty bullets.
5. **Clean up** with `rm -rf "$REF_DIR"` (the fetch script prints the exact
   path). On failure, print the path and keep it for debugging, and say so.

## Offline fallback

If the fetch fails (no network), proceed with step 3's embedded recipes only,
and tell the user the output skipped the reference edge-case checks. Never
reconstruct reference content from memory — minimal pandoc conversion or stop.

## Test cases

Functional checks for this skill (run after any edit):
1. `-produce out.docx from a markdown file with a heading, table, and list` —
   expect a valid docx whose plain-text round-trip contains all three.
2. `Convert that docx to PDF` — expect a PDF with the same page count ≥ 1.
3. `Ask to extract text from a scanned PDF` — expect refusal + reroute to
   the ingestion pipeline, no export attempted.
