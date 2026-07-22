---
tier: T3
source_class: llm
last_updated: 2026-07-03
description: video source re-analysis for deep research
---

# Video Source Re-Analysis — deep-research

Extended reference for handling video material (recordings, demos, walkthroughs) as a
knowledge source during deep research. Loaded on demand — not part of the main SKILL.md
context. Complements this skill's video ingestion pipeline (`ingestion-pipeline.md`;
Whisper/Gemini transcript + cadre images) — this file is about how to RE-USE and RE-VERIFY
that material during a research task, not how to produce it in the first place. Round
budgeting and the evidence ladder for repeated passes: the Iterative Saturation Loop
in the main SKILL.md.

---

## Table of Contents

1. [Why a generic pass is not enough](#why-a-generic-pass-is-not-enough)
2. [Proof case](#proof-case)
3. [Protocol](#protocol)
4. [Smart cadre extraction](#smart-cadre-extraction)
5. [Chaptering long videos](#chaptering-long-videos)
6. [Sub-agent dispatch](#sub-agent-dispatch)
7. [Practical mechanics](#practical-mechanics)

---

## Why a generic pass is not enough

Any pre-existing video-derived artifact — a Whisper or Gemini transcript, a prior AI-generated
description — was produced by a pass written for whatever question was being asked AT THAT
TIME. It necessarily omits detail that only matters for a question nobody had asked yet: an
exact field name, a specific UI label, whether a particular config screen even appears, a value
shown for three seconds in a ten-minute recording. Reading only the existing generic artifact
risks missing exactly the detail the CURRENT research question needs — the model producing that
artifact was never asked about it, so it had no reason to mention it.

This applies even to a careful visual-sampling pass (a sub-agent looking at a handful of
extracted frames): a sparse sample of a long video can miss entire segments and produce a
confident but wrong conclusion, simply because the sampled moments happened to cluster in one
part of the timeline.

## Proof case

Investigating a screen recording via a cadre-sampling sub-agent (10 frames + a full transcript,
read separately), the sub-agent concluded: narration describes browser/application actions
throughout, but the video track shows only a static code-editor window — implying the recording
captured the wrong window for its entire duration.

Re-running the SAME video through a native, single-pass video-understanding model (watching the
actual video+audio together, not a frame sample) found the opposite: the window switched
between the editor and several browser tabs at least 8 times across the recording, closely
tracking the narration at every transition (rated 4.0/5.0 alignment on manual review, no
functional mismatch found).

Root cause of the false conclusion: the sub-agent's 10 sampled frames happened to cluster inside
the first half of the video (a long, visually static segment); none landed in the later, more
dynamic segments. Sparse, unlucky sampling of a temporally uneven recording produced a confident
but wrong conclusion — the kind of error that native video analysis, watching the whole
timeline, does not make.

**Lesson:** treat a cadre-sub-agent's absolute-sounding conclusion ("static screen throughout,"
"total mismatch") as a hypothesis to verify with a native pass before reporting it as fact,
especially when the sampled-frame count is low relative to the video's duration (rule of thumb:
fewer than ~1 frame per 30 seconds of runtime means long stretches were never sampled at all).

## Protocol

1. **Find candidate videos.** Search across any existing transcripts or fragment indices for
   the research topic's keywords — this is cheap and reliable whenever every video already has
   a full-text transcript (from either engine).
2. **Do not stop at an existing generic artifact.** Treat it only as a relevance filter (does
   this video even touch the topic?), never as the final answer to the CURRENT question.
3. **For each relevant candidate, run a NEW analysis pass with a prompt written specifically for
   the current research question.** Name the exact fields, systems, or claims you need
   confirmed or refuted; ask for verbatim on-screen text; ask the model to explicitly say if the
   thing you're looking for does NOT appear at all.
4. **Persist under a topic-qualified filename** — e.g. `{video-fragment}/gemini_analysis_{topic-slug}.md`
   — so a different research session's pass on the same video doesn't overwrite (and lose) this
   one. **This is enforced in code, not just convention:** `video_analyzer.py` refuses to write
   to an existing `--output` path unless `--overwrite` is explicitly passed, reporting the
   sibling analysis files already on disk so you pick a new name instead. Frame each pass as a
   gap-driven expansion (see the core protocol's iterate-on-gaps step): the existing
   passes on a video are its accumulated triples, a question they don't answer is a gap, and a
   new targeted pass is the fill action. A video collecting several analysis files over its
   lifetime is the intended steady state, not redundancy to tidy up — do not merge them into
   one file. Reserve `--overwrite` for when the APPROACH itself changed (e.g. replacing
   mechanical cadres with smart ones), never as a default way to redo a pass.
5. **Cross-reference against text sources** before treating a video-derived claim as confirmed.
   Video analysis is the same evidentiary tier as a transcript (T3 per this skill's tiering) —
   it is not automatically authoritative over a T1/T2 document, even when it directly contradicts
   one; expose the contradiction rather than silently picking a side.

## Smart cadre extraction

Mechanical scene-change detection (fires on any pixel change — cursor movement, animations) can
produce hundreds of near-duplicate, low-value frames for a single recording. If the tooling
available supports it (e.g. this skill's `scripts/video_analyzer.py --smart-cadres N`), prefer asking
the video-understanding model itself to name the N most visually important moments (timestamp +
why it matters) and extracting exactly those via a frame-seek tool (e.g. ffmpeg), rather than
either (a) analyzing a mechanical scene-change sample or (b) not extracting any images at all.
Validated result from one real deployment: 143 mechanically-extracted frames across 5 videos
replaced with 39 curated ones (73% fewer), each spot-checked as accurate and on-topic against
its generated description.

## Chaptering long videos

A single video-understanding call has practical size/context limits, and very long recordings
risk attention degrading toward the end. For videos too long for one reliable pass, split into
fixed-length chapters and run a genuine multi-turn conversation with the model: send chapter 1,
let the model's reply become part of the conversation history, then send chapter 2 as a NEW
message in the SAME conversation (so the model can build on what it already learned), and so on.
An optional final consolidation turn can then produce one chronological summary leveraging the
full accumulated context. When extracting anything timestamped (a transcript segment, a smart
cadre), remember to convert chapter-relative timestamps to global video time
(`local_timestamp + chapter_start_offset`) and extract frames from the ORIGINAL uncut file, not
the temporary per-chapter clips.

**Known failure mode, confirmed on a real 40-minute video, now auto-recovered in
this skill's `scripts/video_analyzer.py`:** because every chapter turn resends the FULL prior
conversation history (every earlier chapter's video content, not just its text reply), the
CUMULATIVE payload can hit an infrastructure gateway timeout (Cloudflare 502/504) on a later turn
even though no single chapter exceeds the tool's own size cap. This showed up as the exact same
turn failing 3/3 times while earlier turns always succeeded — a reproducible pattern, not
transient bad luck. The tool now retries a failing chapter once as an independent, history-free
turn automatically (that chapter loses cross-chapter continuity but the run completes instead of
losing every already-succeeded chapter to one later failure). If a tool without this auto-recovery
is ever used instead, the manual equivalent is: cut chapters with ffmpeg outside the tool and
analyze each independently (no shared history) — this is what confirmed the root cause in the
first place, resolving 3/3 previously-failing calls immediately with zero code changes.

## Sub-agent dispatch

**Critical: a sub-agent's job is to RUN the analysis command, never to RE-SUMMARIZE its
output.** A video-understanding model's response is already a targeted, AI-inferred analysis —
a direct answer to a specific prompt — not noisy raw data (a wall of base64, a huge scraped
page) that genuinely needs digesting before it's useful. If a sub-agent reads that response and
writes its OWN summary of it as a "final reply," that is a second AI-inference layer stacked on
the first, with no compensating benefit (the expensive work already happened server-side and
never touched anyone's context either way) and a real risk of losing precision or drifting from
the source. Confirmed in practice: after several sub-agents each relayed their own summary of a
video analysis, reading the raw output files directly surfaced that the SAME system's name had
been read by the model as several genuinely different spellings across different videos — a
real, worth-flagging ambiguity the smoothed-over relays had obscured by each just picking one
spelling and presenting it as settled.

**Correct division of labor:** if dispatching a sub-agent at all, scope it strictly to "run this
exact command, confirm it wrote the output file, report the exact file path (and any error,
verbatim, if it failed)" — nothing more. The master (or whoever is synthesizing the research)
must always read the raw output file(s) directly for the actual synthesis, cross-referencing,
and any downstream decision-making. This changes what sub-agent dispatch is FOR here: it's purely
about parallelizing wall-clock time across several API calls, not about protecting context from
noise (there isn't any at this step) or offloading interpretation (that stays with whoever needs
the answer).

Apply this skill's existing subject-count dispatch heuristic (see the main SKILL.md's
"Sub-Agent Dispatch for Multi-Subject Research"), with **video** as the unit instead of
**research subject**, remembering the above constraint on what the sub-agent is actually for:

| Video count | Strategy                               |
| ----------- | --------------------------------------- |
| 1           | Inline, in the master context           |
| 2-3         | One sub-agent per video                 |
| 4-6         | Group related videos (2-3 per agent)    |
| 7+          | Group into 3-5 agents by affinity       |

Each video-processing pass (especially a chaptered one) is a self-contained, moderately noisy
sequence of tool calls (frame extraction, model calls) whose only useful output is a short
description plus an image/timestamp index — exactly the profile that belongs in a sub-agent
rather than the master context. A single very long video needing many chapters is itself a good
candidate for its own sub-agent even when it's the only video in scope, since the chapter loop
alone can be many tool calls for a small net result.

## Artifacts are paid and durable — commit them

Every video-understanding API call costs real money, in the same way a paid research report
does — the resulting `gemini_analysis*.md` files and any extracted smart-cadre images are
durable corpus artifacts, not scratch output. Two practical consequences:

- **Never overwrite silently.** Covered above — now enforced by the tooling itself, not just a
  filename convention to remember.
- **Get them into git.** A fragment/corpus directory is typically tracked specifically because
  it is expensive to regenerate; a newly-produced analysis file sitting untracked in the working
  tree is one accidental clean/reset/disk failure away from silently vanishing with no recovery
  path. Do not auto-commit on the user's behalf (that decision belongs to the user), but do
  explicitly flag what is new and untracked at the end of any session that produced analysis
  artifacts, so the user can review and commit deliberately.

## Practical mechanics

- **Locate the real source file first.** A corpus/fragment index or manifest entry is a snapshot
  from ingestion time, not a live pointer — the underlying video file can be moved, renamed, or
  superseded between sessions with zero signal. If a recorded path doesn't resolve, search the
  surrounding source directory before concluding the file is unavailable — and check for
  new, not-yet-processed sibling files while you're there (a source reorganization sometimes
  adds better replacement recordings alongside the one you were looking for).
- **Size limits are practical, not documented.** Video-understanding APIs rarely publish a
  universal size limit for inline video; in practice, very large files can fail at an
  infrastructure layer (a proxy timeout or gateway error) well below any documented model limit.
  Compress large files before sending (e.g. downscale + re-encode) rather than assuming a
  documented cap is the real ceiling.
- **This has a per-call API cost**, unlike a free/local transcription tool. Use it deliberately
  — targeted questions, curated cadre replacement — rather than as a blanket default for every
  video in a project.
