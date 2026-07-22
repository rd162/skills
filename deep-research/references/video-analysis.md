# Video Analysis — Gemini-Native Understanding & Targeted Re-Analysis Protocol

Operational knowledge for `scripts/video_analyzer.py` and the video half of
`scripts/doc_converter.py`. Distilled from production use (2026-06/07): dozens of
meeting recordings, demos, and KT walkthroughs analyzed; every rule below was
learned from a real success or a real failure.

---

## The two methods

1. **Ingestion pipeline** (`doc_converter.py`, default) — runs once per new video:
   - `{stem}_gemini.vtt` — Gemini transcription (audio, WebVTT; grep-able full text)
   - `gemini_analysis.md` — one generic Gemini visual+audio pass (chronological
     description + constraints/identifiers section)
   - `smart_cadre_NNN.jpg` — frames Gemini itself selected as the most visually
     important moments (extracted via ffmpeg at those timestamps)
   - Legacy fallbacks when no `OPENROUTER_API_KEY`: local Whisper VTT +
     PySceneDetect mechanical `cadre_NNN.jpg` images.
2. **Targeted analysis** (`video_analyzer.py`, on demand) — a fresh, question-specific
   pass over one video: frames + audio analyzed TOGETHER, temporally correlated, in
   one native Gemini call via OpenRouter. Costs API credits per call.

## Decision rule — when to run a fresh targeted pass

For ad hoc "what does this video actually show/say" investigation, **prefer a native
targeted pass over eyeballing cadre images** whenever:

- A specific claim needs verification ("does this recording actually show screen X doing Y").
- A cadre-based review returned something surprising or absolute — "static screen
  throughout", "total mismatch with narration". Treat that as a HYPOTHESIS, not a fact,
  until verified natively.
- The video is long relative to its cadre count (rule of thumb: fewer than ~1 cadre per
  30 s of runtime means long stretches were never sampled at all).
- A sub-agent sampling cadre frames repeatedly hits context-size limits.

**Proof case (2026-07-02):** a 10-cadre sample of an 11-minute demo concluded "static
IDE window throughout, total mismatch with narration." A native pass on the same video
showed the window switching between IDE and browser 8+ times, closely tracking the
narration (4.0/5.0 alignment). The sampled cadres had clustered in one long static
segment. Sparse, unlucky sampling of a temporally uneven video produced a confident but
wrong conclusion — never report such a finding without native verification.

Cadre+transcript review remains fine as a first pass for routine browsing and for
short/static videos (slide decks, single-screen demos).

## Targeted re-analysis protocol (deep research)

Any existing `gemini_analysis*.md` was produced for whatever question was asked AT THAT
TIME — it will not contain detail nobody asked about yet. This protocol is the video
channel of the Iterative Saturation Loop (main SKILL.md): round budgeting (default 3
rounds), gap mining between rounds, wide-themed round-1 prompts, neutral verification
phrasing (never quote the disputed value — anchoring breeds self-consistent
fabrication), and the own-eye evidence ladder all live there. When research needs
specific video-derived facts:

1. **Find candidate videos** — `grep` across `data/corpus/**/markdown/*.vtt` and
   `gemini_analysis*.md` for the topic keywords (cheap; every video has a full-text
   transcript).
2. **Treat existing artifacts as a relevance filter, never as the final answer** to a
   new question.
3. **Read the video's full transcript BEFORE writing the follow-up prompt.** It shows
   which segments carry real density vs filler, and can surface constraints the original
   prompt never asked about (confirmed: an API pagination limit mentioned mid-video was
   missed by a narrowly-scoped pass and caught by a transcript-informed one). A narrow
   prompt gets a narrow answer — for technical completeness, ask for an exhaustive
   chronological log PLUS a dedicated "numeric constraints / limits / identifiers"
   section.
4. **Run a fresh `video_analyzer.py` pass with a prompt written for the CURRENT
   question.** Name the exact fields/systems/claims to confirm or refute; ask it to
   quote on-screen text verbatim; ask it to explicitly say if the target does NOT appear.
5. **Persist under a topic-qualified filename** —
   `data/corpus/{Video}/markdown/gemini_analysis_{topic-slug}.md` — so one research
   session's pass never overwrites a different question's pass. Enforced in code: the
   script refuses to overwrite an existing `--output` unless `--overwrite` is passed.
6. **Cross-reference against text sources before treating a claim as confirmed** —
   video analysis is T3 (same tier as a transcript), never automatically authoritative
   over a T1/T2 document.

**Chain-of-Knowledge framing:** existing analysis files are accumulated triples; a
question they don't answer is a gap; a new targeted pass is the forward-fill. A video
accumulating 3-5+ analysis files over its lifetime is the intended steady state — do
not merge them "for tidiness"; each is independently citable and dated. Reserve
`--overwrite` for when the APPROACH changed (e.g. replacing mechanical cadres with
smart ones), never as a default way to "redo" an analysis.

## Paid artifacts are durable knowledge — protect and commit them

Every `gemini_analysis*.md` and `smart_cadre_*.jpg` cost a real API call — treat like a
paid research report:

- Overwrite protection is enforced in code (`--overwrite` required; smart cadre
  numbering continues after the highest existing index instead of restarting at 000).
- The ingestion pipeline never re-bills: existing transcripts, `gemini_analysis.md`,
  and smart cadres are reused even on `--force` re-runs. Delete the files to
  deliberately regenerate.
- These files belong in git (`data/corpus/` is typically tracked precisely because it
  is expensive to regenerate). Never auto-commit, but flag new untracked analysis
  artifacts for the user to commit before the session ends — an untracked file is one
  `git clean -fd` away from losing paid-for work.

## Sub-agent division of labor — run, never re-summarize

Multi-video smart-cadre/chaptering work fits sub-agents (1 video = inline; 2-3 = one
sub-agent per video; 4+ = group by affinity). But **a sub-agent's job ends at "ran this
exact command, output written to this path"** — it must NOT read the output and relay
its own summary. `video_analyzer.py` output is already a targeted AI inference;
stacking a second summarization layer loses precision with no benefit. Confirmed case:
three sub-agent relays each silently "settled" a workspace name that the raw outputs
spelled three different ways — a real source-level ambiguity the relays had smoothed
over. The dispatching agent must read the raw markdown itself for synthesis.

## Specific alphanumeric strings are unreliable

Independent passes over the SAME video produce CONSISTENT structural findings (trigger
mechanisms, field names, business logic) but INCONSISTENT literal strings — the same
trigger phrase was read as 7 different strings across passes; workspace names, PO
numbers, and class names varied similarly. Treat every PATTERN as reliable and every
SPECIFIC example value as illustrative until corroborated by a non-AI source (a
document's literal text, or your own visual inspection of an extracted frame). Never
hardcode an AI-read string into config, docs, or code without confirming it.

**Confirming case (2026-07-22):** a technical POC recording produced a hostname read
three different ways across two chaptered passes, a port number read two ways, and an
on-screen date read as four years off from the recording's actual date — while the
package/module names, trigger logic, and verbatim decision quotes stayed identical
across both passes. Rule of thumb: **two-pass agreement upgrades an alphanumeric to
citable; single-pass strings stay flagged ⚠ and out of any spec/decision doc.** The
same session also caught a first-pass FABRICATION this way: a generic visual pass
invented an on-screen "3.5 months / 8-week phase-1" planning-sheet reading and
misread an on-screen model-name abbreviation; a dedicated verification pass over the
same footage found no such sheet in any chapter and read the abbreviation correctly.
**Any load-bearing claim sourced from a single generic video pass needs a targeted
verification pass before it drives a decision, an estimate, or a spec.**

## Practical mechanics

- **Locate the real source file first.** Manifest/fragment paths are a snapshot from
  ingestion time; intake files get moved/renamed between sessions (OneDrive symlinks
  especially). If the recorded path doesn't resolve, `find -L` the surrounding intake
  directory before concluding the file is gone — and check for new, not-yet-ingested
  siblings while there.
- **Size limits are practical, not documented.** A 90 MB file (~120 MB base64) hit a
  Cloudflare 502 in front of OpenRouter — infrastructure, not model. Hard cap is 60 MB
  file size; both scripts auto-compress above it (`ffmpeg scale=-2:480 -crf 30`,
  validated to preserve exact on-screen class names and UI labels at 480p).
- **Containers OpenRouter can't take inline** (mkv/avi/wmv/m4v) are routed through the
  chaptered mp4 re-encode path automatically.
- **Chaptering** (`--chapter-minutes N`, auto above 20 min in the ingestion pipeline)
  runs a genuine multi-turn conversation — each chapter a new message, so the model
  builds on earlier chapters, plus a final consolidation turn. Chapter-relative
  timestamps are converted to global time before frames are extracted from the ORIGINAL
  uncut file.
- **Known chaptering failure mode, auto-recovered:** the cumulative multi-turn payload
  (every prior chapter re-sent each turn) can hit a Cloudflare 502/504 on a later turn
  even though no single chapter is oversized. The script retries that chapter once as
  an independent, history-free call — the run completes; that chapter just loses
  cross-chapter continuity. If the SAME chapter still fails across repeated runs,
  investigate directly rather than retrying.
- **OpenRouter transient-failure retry ladder (hardened 2026-07-22):** under sustained
  load, OpenRouter/the Gemini backend can return far more failure shapes than a clean
  502/504 — observed in one multi-hour, multi-video session: `ConnectionResetError`,
  read timeouts, HTML error pages where JSON was expected (`JSONDecodeError`), a `524`
  wrapped inside a valid JSON error envelope (so it looked like a normal response, not
  an HTTP error), and a null/empty `message.content` on an otherwise-200 response. Every
  request in `analyze_video_turn()` now retries up to 3 times (20 s/40 s backoff) on any
  of: HTTP 408/429/5xx, `requests` exceptions (timeout, connection reset), JSON-decode
  failure, malformed response shape, or empty/null content. Non-retryable 4xx errors
  (e.g. bad API key) still fail fast via `SystemExit`. This sits BENEATH the
  chapter-level history-free retry above — so a single video run now has two retry
  layers: per-request (inner) and per-chapter (outer).
- **Prefer smaller chapters and sequential runs when the backend is degraded.** Larger
  chapters (~9–15 MB base64 payloads from 15-min segments) hit the failure modes above
  far more often than smaller ones (~6 MB from 10-min segments) in the same session.
  Launching 2-3 chaptered video passes in parallel also visibly increased the failure
  rate. When a pass is struggling: drop to `--chapter-minutes 10` and run passes
  **sequentially, one at a time**, rather than backgrounding several concurrently.
- **A pass "hanging" on the same log line for minutes is often just the retry ladder
  working, not a stall.** Before killing a long-running pass, check the log for
  `retrying in Ns...` / `attempt N` lines — those indicate active, expected recovery.
  Only intervene (kill + relaunch with smaller chapters) if the SAME turn/chapter fails
  repeatedly even through the full retry ladder.
- **Transient API failures happen for well-within-limits files.** A degraded video
  lands as `status: images_only` with an empty `vtt` field while the run summary still
  says `Failed: 0` (that counter tracks exceptions, not degradations). After a bulk run,
  spot-check manifest entries for `status` and a non-empty `vtt` rather than trusting
  the summary line.
- **Duplicate videos:** sync tools sometimes deposit duplicate copies of a recording at
  a parent-folder level. Same filename + same size = duplicate; delete the stray copy
  and run `doc_converter.py --clean` afterwards.

## Legacy cadre sets (PySceneDetect)

For fragments that still carry mechanical `cadre_NNN.jpg` sets: webcam-only frames
(video-call face grids with no screen content) have zero analytical value — filter them
with a cheap vision model (KEEP: any application UI, slides, spreadsheets, code,
terminal, browser, or screen share with webcam thumbnails; DELETE: faces-only grids and
unreadable transitional frames). Or simply replace the whole set with a smart-cadre
pass: `video_analyzer.py --smart-cadres 15 --images-dir <images> --replace-cadres`
(validated: 143 mechanical cadres across 5 videos → 39 curated ones, 73% fewer, each
on-topic).
