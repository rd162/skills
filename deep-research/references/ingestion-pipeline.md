# Ingestion Pipeline — Full Operational Reference

Complete operational detail for the ingestion channel of the deep-research
skill: converting raw documents, draw.io diagrams, and video files into the
AI-readable corpus (`data/corpus/`). SKILL.md carries the condensed workflow;
this file carries everything needed to actually run, verify, and debug it.

## Table of Contents

1. [Zone naming conventions — directory detection](#zone-naming-conventions--directory-detection)
2. [Fragment frontmatter](#fragment-frontmatter)
3. [Bundled scripts](#bundled-scripts)
4. [System dependencies](#system-dependencies)
5. [Step-by-step workflow](#step-by-step-workflow)
6. [Converter strategy](#converter-strategy)
7. [WEBP sliding window](#webp-sliding-window)
8. [Change tracking](#change-tracking)
9. [Video processing details](#video-processing-details)
10. [Graceful degradation](#graceful-degradation)
11. [Termination signals](#termination-signals)
12. [Ingestion anti-patterns](#ingestion-anti-patterns)
13. [Environment compatibility](#environment-compatibility)
14. [Post-ingestion checklist](#post-ingestion-checklist)

---

## Zone naming conventions — directory detection

Different projects (and different eras of the same project) use different
directory names for the two pipeline zones. **Detect the actual names before
assuming canonical paths.**

### Zone 1 — Source / Intake layer (T2; gitignored when it contains symlinks)

Raw, externally-supplied originals: OneDrive/SharePoint symlinks, downloaded PDFs,
official API documentation, web index files, raw recordings.

| Name | Convention |
| --- | --- |
| `data/intake/` | **Canonical** — `data/` is the conventional base (LlamaIndex, CCDS); `intake` = raw zone |
| `data/raw/` / `data/external/` | CCDS-strict (immutable dump / third-party) |
| `sources/` | Generic data-engineering |
| `raw/` | Medallion Architecture (Databricks Bronze) |
| `intake/` | Project-root variant |
| `documents/` | Document-heavy projects (⚠ avoid `docs/` — API/human docs) |
| `upstream/` | Data-mesh projects |
| `ingest/` / `ingestion/` | ETL-oriented naming |
| `.agents/intake/`, `.agents/external-refs/` | Legacy self-invented base (pre-2026-06-24) — still recognized |
| `__SPECS__/` | Very legacy — dunder names mangle in Markdown editors |

### Zone 2 — Corpus / Processed layer (T3 fragment; committed to git)

Expensive pipeline-owned artifacts: markdown extractions, WEBP cadres,
transcripts, manifests, INDEX files.

| Name | Convention |
| --- | --- |
| `data/corpus/` | **Canonical** — `data/` base + `corpus` (NLP/RAG curated collection) |
| `data/processed/` | CCDS-strict (final, canonical sets); pairs with `data/raw/` |
| `corpus/` | NLP/AI standard — curated processed document collection |
| `fragments/` | Original name; still used in manifest/index keys |
| `knowledge/` | Knowledge-management tools |
| `artifacts/` | Build-system metaphor (CI/CD adjacent projects) |
| `extracted/` | Process-oriented |
| `derived/` | Data-engineering (derived tables) |
| `enriched/` | Medallion Silver layer |
| `processed/` | Generic; pairs with `raw/` |
| `index/` | RAG pipeline projects |
| `.agents/corpus/`, `.agents/kb-cache/` | Legacy self-invented base (pre-2026-06-24) — still recognized |
| `__FRAGMENTS__/` | Very legacy — dunder names mangle |

### Quick detection (run at session start on any new project)

```bash
# Show pipeline dirs under data/ (plus any root-level or legacy .agents/ variants)
ls -d data/*/ .agents/*/ 2>/dev/null
ls -d */ 2>/dev/null | grep -E 'intake|corpus|sources|raw|fragments|knowledge|__SPECS__|__FRAGMENTS__'
```

Then map to canonical names when reading paths in this skill:

- Zone 1 found at any name above → treat as `data/intake/`
- Zone 2 found at any name above → treat as `data/corpus/`

**Manifest and index files** (inside Zone 2, regardless of dir name):

- `INDEX.md` — partner/document → fragment mapping
- `.manifest.json` — SHA256 change-tracking manifest
- `_ALL_MEETING_NOTES_CONSOLIDATED.md` — merged meeting corpus

---

## Fragment frontmatter

`scripts/doc_converter.py` writes this YAML block at the top of every fragment
markdown. The `tier` key is inherited from the source document — T2 for sources
under `data/intake/`, T1 for saved public official docs, etc.:

```yaml
---
tier: T2 # inherits source tier (T2 for data/intake/, T1 for public docs, etc.)
source_class: fragment
version: "1.0"
last_updated: <ISO date>
description: <converter> output for <source filename>
source_file: <relative path to source under data/intake/ or scan root>
converter: docling | markitdown | drawio-xml-parser | gemini-video-analyzer
---
```

If a fragment file is regenerated, `last_updated` is bumped but pre-existing
`tier`/`source_class`/manually-edited keys are preserved (additivity rule from
`source-tiering.md`).

---

## Bundled scripts

Six scripts ship in `scripts/`. Copy them into every target project before
running the pipeline.

| Script                               | Purpose                                                       |
| ------------------------------------ | ------------------------------------------------------------- |
| `scripts/doc_converter.py`           | Main converter: docling markdown (markitdown fallback) + WEBP + Gemini video transcription/analysis/smart cadres |
| `scripts/video_analyzer.py`          | Targeted Gemini video understanding via OpenRouter: question-specific analysis passes, smart cadre extraction, chaptered multi-turn analysis for long videos |
| `scripts/video_extract.py`           | Standalone LEGACY video extractor: Whisper VTT + scene-change cadres (kept for offline/no-API-key use) |
| `scripts/setup_converter.sh`         | One-time setup: creates `.venv/`, installs Python deps (`--legacy-video` adds offline video engines) |
| `scripts/verify_images.py`           | Post-conversion: validates WEBP images for LLM vision         |
| `scripts/requirements_converter.txt` | Pinned dependency list for reproducible installs              |

### What `doc_converter.py` does

1. **Recursive project scanning** — walks the project tree with `followlinks=True`,
   auto-excluding `.git`, `node_modules`, `.venv`, `corpus`, `__pycache__`, etc.
   If `data/intake/` exists it is auto-detected and used as the scan root.
   **`data/intake/` entries are often symlinks** (e.g. pointing to OneDrive/SharePoint
   folders) — `followlinks=True` is required or every file under them is silently missed.
   Video files (MP4, MKV, AVI, MOV, WEBM, M4V, WMV) are routed to the Gemini-native
   video pipeline automatically during normal scanning runs.
2. **Archive extraction** — auto-detects ZIP, TAR, TAR.GZ, TGZ, 7Z.
   ⚠ Only supported member types are converted — audit archives for skipped members
   (`.j2`, `.txt`, configs) that may carry the most valuable content; extract those
   manually into the corpus when they matter.
3. **Single-converter markdown strategy** (default since v4.0) — every document is
   converted ONCE:
   - **Docling** (IBM): the default converter — ML-based layout detection,
     multi-column, diagrams
   - **MarkItDown** (Microsoft): automatic fallback ONLY when docling fails,
     times out, or produces an empty body
   - `--dual-convert` restores the legacy both-converters output for
     cross-referencing when a corpus warrants it
4. **draw.io support** — XML parsing → components (with shape types), connections
   (with labels), multi-page diagram names → structured markdown + CLI→WEBP export.
5. **WEBP sliding-window images** — Office docs converted to PDF via the
   three-strategy chain (LibreOffice → Chrome+mammoth → docx2pdf), then
   rendered as 3-page overlapping WEBP windows via pdftoppm + Pillow.
   **Never skipped for page-producing formats.**
6. **Collision-safe fragment naming** — detects files with the same name from
   different subdirectories and automatically prepends the first distinguishing
   ancestor directory as a context prefix, so fragment directories never collide.
7. **Incremental manifest** — `.manifest.json` saved after every file.
   Interrupted batch runs resume cleanly without re-processing completed files.
8. **Master index** — `data/corpus/INDEX.md` lists every document and output.

Full DOCX→PDF strategy details and anti-patterns: `docx-pdf-strategies.md`.

### What `video_analyzer.py` does

Sends a video directly to a Gemini model via OpenRouter for native, single-pass
video+audio understanding — frames and speech analyzed TOGETHER, unlike the
separated transcript+cadre approach. The ingestion pipeline calls it internally
for every new video; it is ALSO the tool for **targeted, question-specific
re-analysis passes** during deep research (decision rules, protocol, sub-agent
usage, reliability caveats: `video-analysis.md`). Three modes:

1. **Single-pass analysis** — one video, one prompt, one response. Best for
   short-to-medium videos and targeted questions ("does this recording
   actually show X").
2. **Smart cadre extraction** (`--smart-cadres N`) — asks the model to name
   the N most visually important moments (timestamp + why it matters), then
   uses ffmpeg to extract exactly those frames. Produces far fewer, far
   higher-value images than PySceneDetect's mechanical scene-change detection
   (validated: 143 mechanical cadres across 5 videos → 39 curated ones, 73%
   fewer). `--replace-cadres` deletes existing `cadre_*.jpg` files first.
3. **Chaptered multi-turn analysis** (`--chapter-minutes N`) — for long
   videos: splits into N-minute chapters via ffmpeg, then runs a genuine
   multi-turn OpenRouter conversation (each chapter a new message, so the
   model builds on earlier chapters). Chapter-relative timestamps are
   converted to global video time before frames are extracted from the
   original uncut file. A chapter that fails on cumulative payload
   (Cloudflare 502/504) is auto-retried once as an independent, history-free
   call so one late failure never loses the whole run; beneath that, every
   request retries up to 3 times with backoff on transient failures
   (408/429/5xx, connection resets, JSON-decode failures, null content).

All three modes auto-compress files over ~60MB (ffmpeg, 480p/crf30 — validated
to preserve exact on-screen text) since inline base64 video has a practical
size ceiling well below any documented model limit (see script docstring).

**Overwrite protection (enforced in code, not just convention):** the script
refuses to write to an existing `--output` path unless `--overwrite` is
explicitly passed — it exits with an error listing the sibling
`gemini_analysis*.md` files already on disk for that fragment. Every analysis
pass costs a real API call and is a durable artifact; pick a new
topic-qualified filename (`gemini_analysis_{topic-slug}.md`) for a new targeted
question rather than overwriting, and reserve `--overwrite` for when the
approach itself changed. A single video accumulating several analysis files
over its lifetime is expected — each pass is an accumulated, independently
citable artifact; an unanswered question is a gap; a new targeted pass fills
it (see the Iterative Saturation Loop in SKILL.md). These files (and any
`smart_cadre_*.jpg`) belong in git — `data/corpus/` is typically tracked
precisely because it's expensive to regenerate; flag new ones for the user to
commit rather than leaving them untracked indefinitely.

```bash
# Targeted question about a specific video:
scripts/.venv/bin/python scripts/video_analyzer.py video.mp4 "What does this show?"

# Topic-qualified targeted pass (deep research — never overwrite a prior pass):
scripts/.venv/bin/python scripts/video_analyzer.py video.mp4 \
    "Does the recording show the pagination limit configuration? Quote on-screen text." \
    --output data/corpus/MyVideo/markdown/gemini_analysis_pagination-limits.md

# Extract 15 smart cadres, replacing PySceneDetect's legacy output:
scripts/.venv/bin/python scripts/video_analyzer.py video.mp4 \
    --smart-cadres 15 --images-dir data/corpus/MyVideo/images \
    --replace-cadres --output data/corpus/MyVideo/markdown/gemini_analysis.md

# Long video: chapter + smart cadres together:
scripts/.venv/bin/python scripts/video_analyzer.py long_video.mp4 \
    --chapter-minutes 10 --smart-cadres 20 \
    --images-dir data/corpus/MyVideo/images --replace-cadres \
    --output data/corpus/MyVideo/markdown/gemini_analysis.md
```

Requires `OPENROUTER_API_KEY` (https://openrouter.ai/keys) and `requests`;
`ffmpeg`/`ffprobe` for `--smart-cadres` and `--chapter-minutes`. Costs
OpenRouter credits per call. The ingestion pipeline already produces the
generic first-pass artifacts — reserve direct invocations for TARGETED
questions the generic pass doesn't answer.

### What `video_extract.py` does

Standalone LEGACY video processor (Whisper + PySceneDetect only, no Gemini) —
kept for offline use or when `OPENROUTER_API_KEY` is unavailable:

1. **Whisper VTT** — transcribes audio to `_whisper.vtt` subtitle files
2. **Scene-change cadres** — extracts `cadre_NNN.jpg` images at scene boundaries
3. Uses the same `data/corpus/` structure and `.manifest.json` change tracking
4. Supports `--whisper-model` (tiny/base/small/medium/large) and `--threshold`

Usage: `scripts/.venv/bin/python scripts/video_extract.py`

### What `setup_converter.sh` does

- Detects best available Python (prefers 3.11, warns on 3.13+)
- Creates `.venv/` with docling, markitdown, Pillow, PyMuPDF, mammoth, requests, and all deps
- Checks pdftoppm/poppler, LibreOffice, Chrome, draw.io, ffmpeg, and `OPENROUTER_API_KEY`;
  reports which DOCX→PDF strategy and which video engine will be active
- Does NOT install the heavy legacy video engines by default (openai-whisper
  pulls in multi-GB torch) — pass `--legacy-video` to add openai-whisper,
  scenedetect, and opencv for offline/zero-API-cost fallback use

### What `verify_images.py` does

- Scans `data/corpus/` for all generated WEBP files
- Validates format, dimensions, and decodability via Pillow
- Checks LLM vision constraints (min 10KB, max 20MB, 100–8192px)
- Generates `IMAGE_VERIFICATION_REPORT.md`

---

## System dependencies

| Dependency             | Required        | macOS                             | Linux                                        |
| ---------------------- | --------------- | --------------------------------- | -------------------------------------------- |
| Python 3.10–3.12       | Yes             | `brew install python@3.11`        | `sudo apt install python3.11`                |
| poppler (pdftoppm)    | Yes             | `brew install poppler`            | `sudo apt install poppler-utils`             |
| **LibreOffice**        | **Recommended** | `brew install --cask libreoffice` | `sudo apt install libreoffice`               |
| Google Chrome/Chromium | Fallback        | Usually pre-installed             | `sudo apt install chromium-browser`          |
| draw.io                | Optional        | `brew install --cask drawio`      | [download .deb from jgraph/drawio-desktop]   |
| ffmpeg                 | For video       | `brew install ffmpeg`             | `sudo apt install ffmpeg`                    |
| `OPENROUTER_API_KEY`   | For video       | https://openrouter.ai/keys — export in shell profile, never commit | same |

**LibreOffice is strongly recommended.** Without it, the converter falls back
to mammoth+Chrome (lower fidelity) then docx2pdf/Word (unreliable on macOS).
LibreOffice is also required for `.doc` (Word 97-2003) and PPTX/PPT.

On macOS use `brew install --cask libreoffice` — the `--cask` flag is required.
The bare formula (`brew install libreoffice`) does not install `soffice`.

---

## Step-by-step workflow

### Step 0: Prerequisites

```text
which soffice && soffice --version
# if missing:  macOS: brew install --cask libreoffice   Linux: sudo apt install libreoffice
```

### Step 1: Deploy scripts to project

**Option A — Scripts at project root:**

```text
cp {skill-path}/scripts/* {ProjectRoot}/
chmod +x {ProjectRoot}/setup_converter.sh
```

**Option B — Scripts in `scripts/` subdirectory (cleaner):**

```text
mkdir -p {ProjectRoot}/scripts
cp {skill-path}/scripts/* {ProjectRoot}/scripts/
chmod +x {ProjectRoot}/scripts/setup_converter.sh
```

Always run converter commands from the project root.
Documents do not need to be in `data/intake/` — the converter scans the whole tree.

### Step 2: One-time setup

```text
Option A: ./setup_converter.sh
Option B: bash scripts/setup_converter.sh
```

Verify:

```text
command -v pdftoppm && scripts/.venv/bin/python -c "import docling, markitdown, mammoth, requests; from PIL import Image; print('OK')"
soffice --version
```

### Step 3: Run the converter

```text
Option A: .venv/bin/python doc_converter.py
Option B: scripts/.venv/bin/python scripts/doc_converter.py
```

#### Command-line flags

| Flag                    | Effect                                                           |
| ----------------------- | ---------------------------------------------------------------- |
| _(no flags)_            | Scan CWD recursively (or `data/intake/` if it exists)         |
| `--scan-dir PATH`       | Scan only this directory (recursively)                           |
| `--force`               | Reprocess everything (ignore change tracking; existing paid Gemini artifacts still reused) |
| `--file "name.pdf"`     | Process a specific file only (searched recursively)              |
| `--clean`               | Remove fragments for deleted/moved source documents              |
| `--no-recurse`          | Only scan top-level of the scan directory                        |
| `--fragments-dir PATH`  | Override `data/corpus/` output location                       |
| `--dual-convert`        | Run BOTH markdown converters (legacy behavior; default is docling only + markitdown fallback) |
| `--smart-cadres N`      | Max smart cadres per video (default: 12; 0 disables → legacy PySceneDetect) |
| `--gemini-model SLUG`   | OpenRouter model for video work (default: `google/gemini-3.5-flash`) |
| `--legacy-cadres`       | Force PySceneDetect mechanical cadres instead of Gemini smart cadres |
| `--legacy-whisper`      | Fully local video run: Whisper transcription + PySceneDetect cadres, zero API cost |
| `--no-whisper`          | No transcription AND no paid Gemini work (legacy cadres only)    |
| `--whisper-model MODEL` | Whisper model for `--legacy-whisper`: tiny/base/small/medium/large (default: base) |
| `--scene-threshold N`   | Legacy cadre sensitivity — lower = more cadres (default: 5.0)    |

#### Directory exclusions

Automatically excluded: `corpus` `.venv` `venv` `.env` `node_modules`
`.git` `.svn` `.tmp` `.cache` `__pycache__` `dist` `build` `.tox` `.idea` `.vscode`
and any directory starting with `.`

### Step 4: Verify output

```text
∆1: list_directory("data/corpus/") → confirm fragment directories exist
∆2: read_file("data/corpus/INDEX.md") → check master index
∆3: scripts/.venv/bin/python scripts/verify_images.py
∆4: Spot-check one docling output for quality (markitdown only exists where docling failed)
∆5: For DOCX/PPTX: confirm images/ dir is non-empty
    (if empty → LibreOffice missing; install and re-run --force)
∆6: For videos: confirm non-empty vtt field + gemini_analysis in .manifest.json
    (transient API failures degrade silently to images_only — the summary line
    only counts exceptions, so spot-check the manifest, not just "Failed: 0")
```

#### Expected output structure

```text
data/corpus/
├── INDEX.md                              # Master index of all documents
├── .manifest.json                        # SHA256 change tracking (saved per-file)
├── IMAGE_VERIFICATION_REPORT.md
│
├── {Document Name}/
│   ├── markdown/
│   │   └── {name}_docling.md             # single converter (default)
│   │       # {name}_markitdown.md exists only where docling failed,
│   │       # or alongside docling when --dual-convert was used
│   └── images/                           # Non-empty for PDF/DOCX/PPTX
│       ├── {name}_p001-003.webp          # Pages 1–3 (3-page sliding window)
│       ├── {name}_p002-004.webp
│       └── ...
│
├── {Video Name}/                         # Video files (Gemini-native default)
│   ├── markdown/
│   │   ├── {name}_gemini.vtt             # Gemini transcript (or _whisper.vtt legacy)
│   │   ├── gemini_analysis.md            # Gemini visual+audio analysis + cadre index
│   │   ├── gemini_analysis_{topic}.md    # later targeted passes (video_analyzer.py)
│   │   └── {name}.vtt                    # Manual subtitle (if found in data/intake)
│   └── images/
│       ├── smart_cadre_000.jpg           # Gemini-selected key moments (default)
│       ├── smart_cadre_001.jpg
│       └── cadre_NNN.jpg                 # legacy PySceneDetect output (fallback)
```

XLSX produces `markdown/` only (spreadsheets have no renderable pages).
Video files produce a transcript + Gemini analysis + smart cadres (no markdown conversion).

### Step 5: Report completion

```text
docs[N] → docling[N] | markitdown_fallback[N] | webp_images[N] | failures[N]
videos[N] → vtt[N] | gemini_analysis[N] | smart_cadres[N] | legacy_cadres[N] | manual_subs[N]
DOCX→PDF strategy used: LibreOffice | Chrome+mammoth | docx2pdf
Video engine used: Gemini (model slug) | legacy Whisper+PySceneDetect
Per-doc: {name}→md✓ webp✓ | {name}→md✓(markitdown fallback) webp✗(no converter) | ...
Per-video: {name}→vtt✓ analysis✓ cadres[smart] | {name}→vtt✗(transient) cadres[scenedetect] | ...
```

---

## Converter strategy

### Standard documents

**Single-converter strategy (default since v4.0):** every document is converted
once by **docling**; **markitdown** runs only as the automatic fallback:

| Role         | Converter      | Notes                                                          |
| ------------ | -------------- | -------------------------------------------------------------- |
| **Default**  | **Docling**    | ML layout detection, multi-column, tables, diagrams; runs in an isolated subprocess (a docling crash can't kill the batch) |
| **Fallback** | **MarkItDown** | Fires automatically when docling fails, times out (300 s), or emits an empty body |

Fallback triggers are logged, and empty-body outputs from either converter are
discarded so they never mask a conversion failure. `--dual-convert` restores the
legacy both-converters output when cross-referencing two extractions is
genuinely useful (e.g. auditing table fidelity on a critical contract).

### draw.io diagrams

1. **XML parser** → components (with shape types), connections (with labels),
   multi-page diagram names → structured markdown
2. **draw.io CLI** → each page → PDF → WEBP (requires draw.io app; optional)

### Reading guide per document type

| Document Type               | Best for reading | Reason                          |
| --------------------------- | ---------------- | ------------------------------- |
| Most documents              | docling output   | Single authoritative extraction |
| Docs where docling failed   | markitdown output| Automatic fallback              |
| Diagrams / visuals          | WEBP images      | LLM vision analysis             |
| draw.io diagrams            | drawio_parsed.md | Components + connections + WEBP |
| Videos                      | `_gemini.vtt` + `gemini_analysis.md` + smart cadres | Transcript is grep-able; analysis is temporally correlated |

---

## WEBP sliding window

Pages are rendered as 3-page overlapping WEBP windows:

```text
p001-003: Page 1 │ Page 2 │ Page 3
p002-004: Page 2 │ Page 3 │ Page 4
...continues to last 3 pages
```

Overlapping windows preserve context across page boundaries.
Typical size: 300KB–2MB per image (LibreOffice output).

Read with: `read_file("data/corpus/{doc}/images/{doc}_p010-012.webp")`

WEBP is essential for architecture diagrams, complex tables, multi-column layouts,
cover pages, and any visual content requiring LLM vision analysis.
**Never voluntarily skip WEBP.** If `images/` is empty after processing
a DOCX or PPTX, install LibreOffice and re-run `--force`.

### Image settings

| Constant          | Default | Range | Description                   |
| ----------------- | ------- | ----- | ----------------------------- |
| `IMAGE_DPI`       | 150     | 0–600 | Resolution (150 = balanced)   |
| `PAGES_PER_IMAGE` | 3       | 1–5   | Pages per WEBP sliding window |
| `WEBP_QUALITY`    | 85      | 0–100 | Encoder quality (85 = good)   |

---

## Change tracking

The manifest is written after every file — interrupted batch runs
resume cleanly from the next unprocessed file.

Decision logic per file:

```text
File found → SHA256 → check manifest:
  ├─ Not in manifest           → PROCESS  (new)
  ├─ Hash differs              → PROCESS  (changed)
  ├─ Previous run failed       → PROCESS  (retry)
  ├─ Hash matches              → SKIP     (unchanged)
  └─ --force flag              → PROCESS  (override)
```

Full manifest format, orphan detection, incremental workflow patterns, and
summary report format: `change-tracking.md`.

---

## Video processing details

### Gemini native video understanding (default engine)

Every newly-ingested video gets, by default (requires `OPENROUTER_API_KEY`):

1. **Transcription** (`generate_vtt_via_gemini()`, since 2026-07-02) — the video is
   sent to `google/gemini-3.5-flash` via OpenRouter, producing `{stem}_gemini.vtt`
   — a drop-in replacement for the legacy Whisper VTT (same manifest slot, same
   `.vtt` companion-detection logic downstream). The transcription prompt is kept
   deliberately strict (ONLY WebVTT output) so the transcript stays parseable and
   grep-able.
2. **Analysis + smart cadres** (`extract_smart_cadres_via_gemini()`, since
   2026-07-22) — a second Gemini pass watches the whole video and writes
   `gemini_analysis.md` (chronological visual+audio description + a dedicated
   constraints/identifiers section) plus `smart_cadre_NNN.jpg` — the model names
   the N most visually important moments (default max 12, `--smart-cadres N`) and
   ffmpeg extracts exactly those frames. This REPLACES PySceneDetect's mechanical
   scene-change cadres as the default.
3. **Auto-chaptering** — videos over 20 minutes (and containers OpenRouter can't
   take inline: MKV/AVI/WMV/M4V) are split into 10-minute 480p mp4 chapters and
   analyzed as a genuine multi-turn conversation with a final consolidation turn.
   A chapter that fails on cumulative payload (Cloudflare 502/504) is auto-retried
   history-free so one late failure never loses the whole run.
4. **Auto-compression** — files over 60 MB are compressed (ffmpeg 480p/crf30 —
   validated to preserve exact on-screen text) before inline upload.

**Billing and reuse:** each pass costs an OpenRouter API call. Existing
transcripts, `gemini_analysis.md`, and smart cadres are treated as durable paid
artifacts — reused on re-runs (even `--force`), never silently overwritten;
delete them to deliberately regenerate. For cost-conscious bulk batches use
`--legacy-whisper` (fully local run) or `--no-whisper` (no paid work at all).

**Consent gating:** interactive runs prompt per-video before transcription;
declining a video skips ALL paid Gemini work for it (legacy cadres still
extracted). `--no-whisper` is the zero-API-spend contract for videos.

### Targeted re-analysis (deep research)

The ingestion artifacts are a GENERIC first pass. When research needs specific
video-derived facts, run a fresh question-specific `video_analyzer.py` pass and
persist it under a topic-qualified filename (`gemini_analysis_{topic-slug}.md`).
Full protocol — decision rules, transcript-first prompt crafting, sub-agent
division of labor, alphanumeric reliability caveats: `video-analysis.md`.
Round budgeting and the evidence ladder: the Iterative Saturation Loop in SKILL.md.

### Legacy Whisper speech-to-text (`--legacy-whisper`)

Generates `_whisper.vtt` subtitle files locally, for free — kept for offline use
or cost-conscious bulk runs (also switches cadres to PySceneDetect: fully local
pipeline). Requires `setup_converter.sh --legacy-video`. Model selection:

| Model    | Size   | ~Time (30-min video, CPU)  | Accuracy |
| -------- | ------ | -------------------------- | -------- |
| `tiny`   | 39 MB  | ~30 min                    | Good     |
| `base`   | 74 MB  | ~90 min                    | Better   |
| `small`  | 244 MB | ~3 hours                   | Good+    |
| `medium` | 769 MB | ~6 hours                   | High     |
| `large`  | 1.5 GB | GPU only (impractical CPU) | Highest  |

**Recommendation:** `--whisper-model tiny` for fast iteration; `base` (default)
for production quality on CPU.

### Legacy scene-change cadres (`--legacy-cadres` / automatic fallback)

PySceneDetect extracts the first frame of each new scene as JPEG — free and
local, but mechanical: it fires on ANY pixel change and can produce hundreds of
near-duplicate, low-value frames. Used automatically when the Gemini smart pass
is unavailable; requires scenedetect+opencv (`setup_converter.sh --legacy-video`).
`--scene-threshold` controls sensitivity: lower (3.0) = more cadres; default
5.0 = good for 30-min meetings; higher (27.0) = only major changes. If no scene
changes are detected, the first frame is saved as a fallback. Legacy cadre sets
benefit from webcam-frame filtering, or wholesale replacement via
`video_analyzer.py --smart-cadres N --replace-cadres` — see `video-analysis.md`.

### Manual subtitle preservation

When video files in `data/intake/` have companion `.vtt` or `.srt` files
(e.g. from Microsoft Teams), these are automatically copied into the fragment's
`markdown/` directory and transcription is skipped for that video (no API cost).
Both manual and generated subtitles are preserved — they complement each other
(manual may have speaker labels).

---

## Graceful degradation

- **Full tooling** (Python 3.10–3.12 + poppler/pdftoppm + LibreOffice + `OPENROUTER_API_KEY` + ffmpeg):
  Complete pipeline — docling markdown + WEBP images + Gemini video
  (VTT + gemini_analysis.md + smart cadres) + change tracking.
- **docling fails on a document:** markitdown runs automatically as the fallback
  for that document. Empty-body outputs count as failures too — the fallback still fires.
- **LibreOffice missing, Chrome present:** mammoth + Chrome headless handles
  DOCX→PDF→WEBP. Good fidelity; DOCX themes not preserved.
- **No LibreOffice, no Chrome:** docx2pdf (Word via AppleScript on macOS) as last
  resort. May show permission dialogs or time out — unreliable.
- **Python only, no poppler:** Markdown conversion works; WEBP generation is
  skipped. Report "WEBP unavailable — install poppler (pdftoppm)".
- **No OPENROUTER_API_KEY:** Video transcription falls back to local Whisper,
  smart cadres fall back to PySceneDetect — both only if installed
  (`setup_converter.sh --legacy-video`). Existing Gemini artifacts still reused.
- **ffmpeg missing:** No compression/chaptering/smart-cadre frame extraction.
  Transcription of small inline-supported files may still work.
- **Legacy Whisper missing (no API key):** VTT generation skipped. Report
  "no transcription engine available."
- **scenedetect/opencv missing (no API key):** Cadre images skipped.
- **No Python:** Fall back to direct `read_file` on source documents.
- **Terminal unavailable:** Guide user through manual setup steps in chat.

---

## Termination signals

| Signal        | Condition                                                            | Action                                              |
| ------------- | -------------------------------------------------------------------- | --------------------------------------------------- |
| COMPLETE      | All documents processed, INDEX.md exists, manifest shows no failures | ✓ STOP — report fragment inventory                  |
| PARTIAL       | Some documents processed, others failed                              | ✓ STOP — report successes and failures with actions |
| NO_DEPS       | Python, poppler/pdftoppm, or required libraries unavailable after setup | Degrade — attempt manual read_file fallback         |
| VIDEO_PARTIAL | No OPENROUTER_API_KEY and legacy engines missing — video partially processed | Degrade — report which video outputs are available  |
| BLOCKED       | No `data/intake/` directory and user cannot provide documents     | Ask user to place documents in `data/intake/`    |

---

## Ingestion anti-patterns

| Approach                                             | Why it fails                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PyMuPDF` DOCX→PDF                                   | Silently drops all embedded images — diagram pages render blank in WEBP output                                                                                                                                                                                                                         |
| Opening DOCX directly in an image renderer        | Neither pdftoppm nor pyvips has a DOCX loader: "not a known file format" — PDF is always required                                                                                                                                                          |
| Skipping WEBP for Office docs                        | Architecture diagrams and visual tables are only readable via LLM vision on WEBP                                                                                                                                                                                                                       |
| `brew install libreoffice` (no `--cask`)             | Installs the formula, not the app — `soffice` is never linked                                                                                                                                                                                                                                          |
| `docx2pdf` as primary strategy                       | Word AppleScript is unreliable: permission dialogs, 2-min timeouts, silent drops                                                                                                                                                                                                                       |
| Reintroducing pyvips/VIPS for PDF rendering        | VIPS was removed deliberately: its pdfload is a dynamic module (vips-poppler.dylib) that segfaults on macOS and needs ctypes pre-loading hacks. pdftoppm (poppler) renders directly with no middleman layer. Do not add the dependency back. |
| `os.walk(data/intake)` without `followlinks=True` | `data/intake/` entries are symlinks — walk stops at the symlink, finds zero files. Always use the converter script or pass `followlinks=True` / `find -L` explicitly.                                                                                                                               |
| Ad-hoc manifest cross-check via custom scan          | Writing a custom file scanner to check what's in the manifest bypasses the converter's symlink handling. Run `doc_converter.py` (dry-run or normal) to get an authoritative view.                                                                                                                      |
| Trusting archive ingestion to be complete            | Only supported member types are converted — a ZIP's `.j2`/`.txt`/config members are silently skipped and may be the most valuable content. Audit `unzip -l` against the manifest.                                                                                                                      |
| Whisper `large` model on CPU                         | Extremely slow (~6h for 30-min video on ARM Mac). Use `tiny` or `base` for CPU; reserve `large` for GPU.                                                                                                                                                                                               |
| Trusting sparse cadre samples for video conclusions  | Cadres cluster unevenly; a 10-frame sample concluded "static screen, total mismatch" on a video whose screen switched 8+ times. Verify any surprising cadre-based conclusion with a native `video_analyzer.py` pass before reporting it. See `video-analysis.md`.                                       |
| Sub-agents re-summarizing `video_analyzer.py` output | The output is already a targeted AI inference; a second summarization layer loses precision (confirmed: smoothed over a real source ambiguity). Sub-agents run the command and report the path — the dispatcher reads the raw markdown.                                                                 |
| Overwriting `gemini_analysis*.md` to "redo" a pass   | Each pass is a paid, durable, independently-citable artifact. Use topic-qualified filenames for new questions; `--overwrite` only when the approach itself changed.                                                                                                                                     |
| Hardcoding AI-read strings from video analysis       | Literal alphanumeric values (trigger phrases, workspace names, PO numbers) vary across passes on the SAME video. Patterns are reliable; specific values need non-AI corroboration.                                                                                                                     |

Full troubleshooting table, diagnostic commands, and strategy chain failure
analysis: `troubleshooting.md`. Most common fix for empty `images/` directories:
`brew install --cask libreoffice && scripts/.venv/bin/python scripts/doc_converter.py --force`.

---

## Environment compatibility

| Capability                  | Requirement                             | Degradation if missing                        |
| --------------------------- | --------------------------------------- | --------------------------------------------- |
| Markdown conversion (default) | Python 3.10–3.12 + docling            | markitdown fallback (per-document, automatic) |
| Markdown fallback           | markitdown                              | No markdown when docling also fails           |
| WEBP from PDF               | poppler (pdftoppm) + Pillow             | No WEBP — install poppler                     |
| WEBP from DOCX/PPTX         | LibreOffice (preferred) or Chrome       | No WEBP for Office docs — install LibreOffice |
| DOCX themes / cover pages   | LibreOffice                             | Themes lost with Chrome fallback              |
| Legacy `.doc` / `.ppt`      | LibreOffice                             | Skipped without LibreOffice                   |
| draw.io XML markdown        | Python only                             | Always available                              |
| draw.io WEBP images         | draw.io desktop CLI                     | No diagram images; XML markdown still works   |
| Video transcription (default) | `OPENROUTER_API_KEY` + requests       | Falls back to legacy Whisper (if installed)   |
| Video analysis + smart cadres (default) | `OPENROUTER_API_KEY` + ffmpeg | Falls back to legacy PySceneDetect (if installed) |
| Video transcription (legacy)  | openai-whisper + ffmpeg (`setup --legacy-video`) | VTT skipped; cadres may still extract |
| Video cadres (legacy)       | scenedetect + opencv (`setup --legacy-video`) | Cadres skipped; transcript still generated |
| Long-video chaptering       | ffmpeg + ffprobe                        | Single-pass with compression (attention may degrade late in video) |
| Incremental resume on crash | doc_converter.py v1.4+                  | Full restart on interruption (old versions)   |
| Any AI assistant            | —                                       | Works with Claude Code, Cursor, Copilot, etc. |
| Any OS                      | poppler available                       | macOS + Linux native; Windows needs WSL       |

---

## Post-ingestion checklist

```text
- [ ] All scanned documents have folders in data/corpus/
- [ ] Each document has at least one markdown output
      (docling by default; markitdown only where docling failed)
- [ ] PDF documents have non-empty images/ directories
- [ ] DOCX/PPTX documents have non-empty images/ directories
      (if empty: LibreOffice/Chrome missing — install and re-run --force)
- [ ] Archives audited: no valuable unsupported members (.j2/.txt/configs) left unextracted
- [ ] .drawio files have parsed markdown (components + connections)
- [ ] Video files have _gemini.vtt (default) or _whisper.vtt (legacy) in markdown/
- [ ] Video files have gemini_analysis.md + smart_cadre_NNN.jpg (default),
      or legacy cadre_NNN.jpg where the Gemini pass was unavailable
- [ ] Manifest video entries spot-checked: status + non-empty vtt field
      (transient API failures degrade silently — "Failed: 0" is not proof)
- [ ] Manual VTT/SRT files from data/intake are preserved in markdown/
- [ ] INDEX.md lists all processed documents
- [ ] verify_images.py reports no critical issues
- [ ] No "status": "failed" entries in .manifest.json
- [ ] Noted which DOCX→PDF strategy was used (LibreOffice > Chrome > docx2pdf)
- [ ] New gemini_analysis*.md / smart_cadre_*.jpg flagged for git commit
      (paid artifacts — do not leave untracked; never auto-commit)
```
