---
name: deep-research
version: "4.0"
description: >-
  Unified deep-research engine over BOTH the web and local raw sources. INGESTION: converts documents
  (PDF, DOCX, PPTX, XLSX), draw.io diagrams, and video (MP4, MKV, AVI, MOV) into an AI-readable corpus via
  Docling (MarkItDown fallback), WEBP sliding-window images, and Gemini video understanding through
  OpenRouter (VTT transcript, visual+audio analysis, smart cadres, auto-chaptering). RESEARCH:
  temporal-aware multi-angle web search with source tiering (T1-T4), tier-weighted conflict resolution,
  high-stakes escalation for medical/legal/financial topics, sub-agent fan-out, and gap-driven saturation
  rounds. SURVEY: builds a knowledge base with source traceability, gap and contradiction catalogue, and
  clarification questions. Use when the user says "research this", "verify this", "deep dive", "systematic
  review", "convert documents", "ingest documents", "process videos", "build survey",
  "what do the specs say", or needs authoritative current knowledge from the web or a
  raw-file corpus.
argument-hint: "<topic> [--file deep_research.md]"
allowed-tools: WebSearch, WebFetch, Read, Write, Edit, Grep, Glob, Bash, Task, AskUserQuestion
metadata:
  author: rd162@hotmail.com
  tags: web-search, source-tiering, deep-research, high-stakes, sub-agent-dispatch, graceful-degradation, playbook-generation, document-conversion, ingestion, survey, knowledge-extraction, docling, markitdown, drawio, webp, video, gemini, openrouter, vtt, smart-cadres, chaptering, iterative-saturation
tier: T3
source_class: llm
last_updated: 2026-07-22
---

# Deep Research — Web + Raw-Source Corpus

Gather, validate, and synthesize knowledge from the web AND from local raw
sources (documents, diagrams, videos) — with source tiering, temporal
awareness, iterative saturation rounds, and explicit contradiction handling.
One engine, four modes: the same gap-driven loop runs whether the source is a
search index, a PDF, or a 50-minute meeting recording.

## Mode Selection

| User intent                                        | Mode                     | Read further in                     |
| -------------------------------------------------- | ------------------------ | ----------------------------------- |
| Research/verify a topic against current sources    | **Web research**         | Core Protocol below                 |
| Convert raw documents/videos into corpus fragments | **Ingestion**            | Ingestion Channel below + `references/ingestion-pipeline.md` |
| Build a survey/knowledge base from fragments       | **Survey**               | `references/survey-mode.md`         |
| Exhaust what the sources can still teach           | **Iterative saturation** | Iterative Saturation Loop below     |
| "Ingest X and produce survey for Y"                | Ingestion → Survey       | Run in sequence                     |
| "Research X using the corpus and the web"          | Saturation loop          | All channels, shared gap register   |

All modes share `data/corpus/` as the canonical interchange format and the
T1-T4 tier contract below.

## Invocation

As a slash command (`/deep-research <topic> [--file path.md]`), parse arguments:
`--file <path>` (or a bare token ending in `.md`) → **file mode** (write a playbook);
everything else is the topic → **inline mode** (answer in conversation).
Empty arguments → show usage and stop. In other environments, infer topic and mode
from conversation context (see `references/invocation-context.md` for MCP setup).

**Disambiguate first** when the topic has multiple meanings, is too broad, or implies
unstated context (cloud provider, language, audience) — use AskUserQuestion.
In file mode, confirm update vs. overwrite if the file exists.

## When to Use

- Factual claims requiring verification against current sources
- Current knowledge needed (versions, APIs, best practices, pricing)
- Technical comparisons, benchmarks, contested topics
- Raw documents, diagrams, or videos need conversion into AI-readable fragments
- Specific facts must be extracted from project videos/documents ("what does the
  recording actually show", "what do the specs say")
- A knowledge base needs another extraction round before estimation,
  architecture freeze, or answering an open-question register

## When NOT to Use

- Pure logic or math (no external knowledge needed)
- All information already in project context and current
- User explicitly says to use training knowledge only
- Single file read (use read tools directly); already-markdown documents

## Termination and Degradation

| Signal    | Condition                                              | Action                                       |
| --------- | ------------------------------------------------------ | -------------------------------------------- |
| SATURATED | Core covered, or a round/iteration adds nothing new, or budget out | STOP — synthesize and present        |
| NO_TOOLS  | Zero search/fetch tools available                      | Training knowledge ONLY, explicit disclaimer |
| EMERGENCY | Verification becomes impossible mid-protocol           | Mark uncertainty — never present as authoritative |

The skill always produces output; only the confidence level varies.
Tight budget → strategy + execute only (skip the deep pipeline).
Ingestion-specific termination signals (COMPLETE/PARTIAL/NO_DEPS/VIDEO_PARTIAL/
BLOCKED) and the graceful-degradation ladder: `references/ingestion-pipeline.md`.

---

## Source Tiers (the contract)

| Tier | Description                                                                                                      | Confidence | Weight in Conflicts |
| ---- | ---------------------------------------------------------------------------------------------------------------- | ---------- | ------------------- |
| T1   | Peer-reviewed / official vendor docs / RFCs / standards bodies — **public sources only**                         | HIGH       | Strongest           |
| T2   | Expert blogs, established trade press, primary partner documents (`data/intake/`)                                | MED        | Strong              |
| T3   | Community forums, Stack Overflow, fragments/extracts (`data/corpus/`), summaries of prior tiers                  | LOW        | Weak                |
| T4   | Opinions, unverified claims, AI-generated content, project-internal generated docs (surveys, playbooks, memory)  | LOW        | Weakest             |

**T1 is reserved for true public sources** — internal documents never qualify, however
authoritative. When sources conflict: higher tier + more recent = stronger evidence.
Annotate every cited source with its tier. Expose contradictions; never silently resolve.

### Local document tier resolution

When citing a local file: (1) use its frontmatter `tier` if present; (2) else default
by path — specs `specs/<feature>/` → T2 · intake zone `data/intake/` (aliases:
`sources/`, `raw/`, `documents/`) → T2 · corpus zone `data/corpus/` (aliases:
`fragments/`, `knowledge/`, `processed/`) → T3 · generated research `data/research/`
and root-level generated docs → T4 · curated `memory/` → T3 · `.cache/` → never cite;
(3) else infer from git history and content (import/ingest commits → T3 fragment;
LLM-slop signals → T4; clearly human-authored → T2). Unclear → T4.

Full policy — `source_class` taxonomy, frontmatter schema, canonical layout,
cross-tool recognize-map, inference algorithm: `references/source-tiering.md`.

---

## Core Protocol (web research)

Seven steps. Skip none.

1. **Tools** — scan available search/fetch tools; zero → degraded mode.
2. **Strategy** — get the current date from `now()` (NEVER hardcode years). Check for
   high-stakes domain (below). Plan 3+ searches from different angles: official/primary,
   practitioner experience, comparative/benchmarks. 5-8 searches for high-stakes.
3. **Execute** — search with temporal qualifiers (`{current_year}`); record each
   finding with source URL + date + tier.
4. **Organize** — SOURCES (≥3, tier-annotated) · CONSENSUS · CONTRADICTIONS (and why)
   · GAPS.
5. **Iterate on gaps** — for each gap or newly-surfaced unknown, run a targeted
   follow-up search. Stop when an iteration adds nothing new, the core is covered,
   or budget runs out.
6. **Output** — answer with per-claim citations and tiers, dated
   ("Based on N sources, searched {current_date}"). If contested: say so and name the
   authority to consult. If degraded: state "training knowledge only".
7. **Validate** — current date dynamic? 3+ searches? 3+ tiered sources cited?
   contradictions exposed? high-stakes extras done? Fix any failure before presenting.

## High-Stakes Domain Escalation

Wrong answers in some domains cause death, imprisonment, poisoning, collapse, or ruin:
**medical, psychology, pharmacology, legal, structural/civil engineering, nutrition
(medical), childcare, financial (advisory)**. If the answer could plausibly influence
someone's health, legal standing, financial security, or physical safety — treat as
high-stakes. When uncertain, escalate (a false negative costs far more than tokens).

Mandatory when detected:

1. **Deepest research available** — strongest tool, or 5-8 searches constrained to T1.
2. **Forward-consequence queries** — actively search what could go wrong: interactions,
   contraindications, hidden assumptions, superseded/withdrawn guidance, failure modes.
3. **T1 only** for high-stakes claims — T2-T4 may inform direction, never override T1.
4. **Safety disclaimer always** ("consult a qualified [professional]"), confidence
   marked, contradictions exposed.

Domain-specific query patterns and tool selection: `references/domain-knowledge-matrix.md`.

## Knowledge Sources (priority order)

1. Local project docs and corpus fragments → 2. `llms*.txt` pattern files →
3. Library docs (Context7, official API refs) → 4. Web search → 5. Memory systems.
Check local sources before reaching for the web — and check whether the local
corpus is COMPLETE before trusting it (archives may have skipped members;
videos answer only the questions asked when they were analyzed).

---

## Ingestion Channel (raw sources → corpus)

Converts raw documents, draw.io diagrams, and videos into AI-readable fragments
under `data/corpus/` — the substrate every other mode reads. Domain-agnostic;
scans the project tree recursively (`data/intake/` auto-detected as scan root;
zone-name detection for non-canonical layouts is in the reference).

**Quickstart** (full workflow, flags, deps, degradation, checklist:
`references/ingestion-pipeline.md`):

```bash
mkdir -p {ProjectRoot}/scripts && cp {skill-path}/scripts/* {ProjectRoot}/scripts/
bash scripts/setup_converter.sh          # one-time venv + dependency check
scripts/.venv/bin/python scripts/doc_converter.py        # convert everything new
scripts/.venv/bin/python scripts/verify_images.py        # validate WEBP output
```

What each source type yields:

| Source                    | Fragment artifacts                                                        |
| ------------------------- | ------------------------------------------------------------------------- |
| PDF / DOCX / PPTX         | `markdown/{name}_docling.md` (markitdown on fallback) + 3-page sliding-window WEBP images |
| XLSX                      | markdown only                                                             |
| .drawio                   | parsed components/connections markdown + WEBP per page                    |
| Video (MP4/MKV/AVI/MOV/…) | `{stem}_gemini.vtt` transcript + `gemini_analysis.md` + `smart_cadre_NNN.jpg` (Gemini-selected frames); auto-chaptered >20 min; legacy Whisper/PySceneDetect offline fallbacks |

Hard rules (each learned from a real failure — details and anti-pattern table
in the reference):

- **WEBP images are mandatory** for page-producing formats — diagrams and
  complex tables are only readable via LLM vision. Empty `images/` after a run
  means LibreOffice is missing: install and re-run `--force`.
- **Paid video artifacts are durable** — transcripts, analyses, and smart
  cadres are never re-billed or silently overwritten (enforced in code); they
  belong in git. Flag new ones for commit; never auto-commit.
- **Audit archives** — only supported member types get converted; a ZIP's
  `.j2`/`.txt`/config members are silently skipped and may be the most
  valuable content in the corpus.
- **Spot-check the manifest after video runs** — transient API failures
  degrade silently to `images_only` while the summary still says `Failed: 0`.
- **Symlinked intake dirs need `followlinks`** — always use the converter
  script (or `find -L`), never a bare `os.walk`.

Fragments carry tier frontmatter (`tier` inherited from source — T2 for
`data/intake/`; `source_class: fragment`). Survey outputs are `T3/llm`.

## Survey Mode (fragments → knowledge base)

Reads corpus fragments plus optional web research and produces a targeted
knowledge base: structured sections, per-claim source traceability,
gap/contradiction catalogue, and clarification questions for stakeholders.
Full protocol: `references/survey-mode.md` · output skeletons:
`references/survey-template.md`, `references/questions-template.md`.

---

## Iterative Saturation Loop (all channels)

One pass over any source answers only the questions asked when it ran — a
video analysis, a document read, and a search sweep all share this property.
Knowledge saturates through ROUNDS: analyze → mine gaps → write targeted
prompts → analyze again. **Default budget: 3 rounds per session** (baseline →
targeted → verify), continuing past 3 only while the signal stays strong.
This loop generalizes `Core Protocol step 5` from web searches to every
channel, with the corpus as the shared substrate.

### Round structure

**Round 1 — broad baseline.** Ingestion's generic artifacts plus a WIDE themed
extraction per source. Prefer exhaustive themed sections over narrow yes/no
checklists — narrow prompts return walls of "NOT PRESENT" while wide ones
surface facts nobody thought to ask for (proven: a chronological screen
inventory found an on-screen estimation document that 15 targeted questions
had missed). For videos: screen/window inventory, people/systems rosters,
every number with units, verbatim quotes with timestamps, `[AUDIO]` vs
`[ON-SCREEN]` tags. For document sets: full fragment read + structure map.
For web: the 3+ angle sweep from the Core Protocol.

**Between rounds — gap mining.** Write the gap register down; rounds 2+ derive
from it, never from vibes:

- Open questions / decision registers the round left unanswered
- Contradictions between sources or between passes
- Grep sweeps: transcripts (`*.vtt`) and fragments for anchor keywords
  (estimat|version|how many|proper nouns) — hits locate WHERE to aim the next
  round; no hits ≠ absent (screens carry what audio doesn't)
- Corpus-completeness audit: archive members skipped by ingestion, intake
  files never processed, videos with only a generic first pass
- Classify each gap: answerable-by-source / answerable-by-web /
  answerable-only-by-stakeholder — never spend a round on the third class

**Round 2 — targeted extraction.** One question-specific prompt set per
source, built from the gap register:

- Videos: fresh `video_analyzer.py` pass per video with a topic-qualified
  `--output` (`gemini_analysis_{topic-slug}.md`) — passes accumulate, never
  overwrite. Prompt crafting rules: `references/video-analysis.md`.
- Documents: re-read originals against the specific questions — WEBP windows
  for tables/diagrams the markdown mangled; extract skipped archive members.
- Web: gap-driven follow-up searches, fresh angles (Core Protocol step 5);
  fan out sub-agents for independent subjects (`references/sub-agent-dispatch.md`).

**Phrase every verification prompt neutrally — NEVER quote the disputed
value.** An anchored pass can rationalize a fabrication into existence:
confirmed 2026-07-22, a verification prompt that mentioned a prior pass's
invented numbers got back a hallucinated document "containing" exactly those
numbers. Ask "read all visible cells of any planning document" — not "does it
say 3.5 months?".

**Round 3 — verify and saturate.** Settle what rounds 1-2 left disputed,
integrate, and measure yield:

- Apply the evidence ladder (below) to every load-bearing claim; for video
  alphanumerics use own-eye frame inspection:
  `ffmpeg -ss <vtt-derived-seconds> -i video.mp4 -frames:v 1 -q:v 3 f.jpg`,
  then READ the frame yourself (~30 s, zero API cost — settles what no number
  of AI passes can).
- Consistency sweep: grep the knowledge base for every corrected value; stale
  references may survive only inside explicit correction notes.
- Integrate into the corpus/KB/registers; mark residuals ⚠ explicitly.

### Continue or stop (after round 3)

Run another round only on **strong signal** — the latest round resolved open
register questions or produced substantial new load-bearing facts, AND
classified answerable gaps remain. Stop at SATURATED: a round adds nothing
new, remaining gaps are stakeholder-only, or budget is out. Record per-round
yield (facts added / questions resolved) so the stop decision is evidence,
not fatigue.

### Evidence ladder (conflicts between passes, rounds, sources)

```text
own-eye artifact inspection (extracted frame, raw file, literal grep)
  > T1 public document
    > independent multi-pass agreement (structural facts only)
      > single AI pass ⚠ (alphanumerics stay ⚠ even on agreement — passes
        fabricate hostnames/dates/IDs CONSISTENTLY)
        > inference
```

Never silently upgrade a claim's rung. Video execution mechanics — sequential
runs (parallel chaptered passes amplify 5xx rates), `--chapter-minutes 10`
payload sizing, the two-layer retry ladder, "hung" runs that are actually
retrying: `references/video-analysis.md`. Re-analysis of stale video sources
for new questions: `references/video-source-reanalysis.md`.

---

## Deep Pipeline and Fan-Out

For comprehensive research (novel/niche topic, systematic review, "deep dive",
high-stakes): broad sweep (20-50 references) → filter to top ~10 by relevance and
tier → summarize → select top 3-5 → extract full content → synthesize with citations.

**Multi-subject fan-out (MANDATORY when applicable):** research covering 2+ independent
subjects with a sub-agent mechanism available → dispatch one sub-agent per subject
(group into 3-5 agents by affinity when 4+ subjects). Each runs the full protocol
independently; master synthesizes and identifies gaps. Sub-agents can return empty —
verify the output file exists before counting a subject as covered; resume or
self-serve the decision-critical ones.
Dispatch patterns, output budgets, model selection: `references/sub-agent-dispatch.md`.

**Async research tools:** poll no more than every 30 seconds; run standard searches in
parallel while waiting. High-stakes → always the deepest/pro model.

**Video sources:** existing transcripts or AI descriptions answer only the questions
asked WHEN they were produced. Use them as a relevance filter only; run a NEW analysis
pass prompted with the CURRENT question; persist under a topic-qualified filename;
cross-check against text sources (video analysis is T3). Sub-agents RUN video passes
but never re-summarize the output — the dispatcher reads the raw markdown itself.
Protocol and proof case: `references/video-source-reanalysis.md`.

---

## File Output (file mode)

Write findings to a persistent markdown playbook instead of answering inline.
**Create:** run the protocol, group into sections, every claim with a source URL,
prepend tier frontmatter (`tier: T4, source_class: llm`), stamp `Captured:` date.
**Update:** target changes since the `Captured:` date, merge inline, preserve voice.
Full protocol and templates: `references/file-output-protocol.md`.

---

## Anti-Patterns

```text
✗ Hardcoded years in queries ("React 2024 …")     ✓ {current_year} from now()
✗ Single search/source presented as authoritative  ✓ 3+ searches, 3+ tiered sources
✗ Blog post treated same as official docs          ✓ T1-T4 annotation on every source
✗ Contradictions silently resolved                 ✓ Exposed, tier-weighted, named
✗ Halting when no search tools exist               ✓ Degrade: training knowledge + disclaimer
✗ Standard depth for medical/legal/financial       ✓ High-stakes: T1 only + consequences + disclaimer
✗ 3+ independent subjects researched sequentially  ✓ Fan-out: one sub-agent per subject
✗ Polling async research every 5 seconds           ✓ Minimum 30s between checks
✗ Trusting a stale transcript for a new question   ✓ Re-analyze video for the current question
✗ One extraction pass treated as "the source read" ✓ Saturation rounds until yield dies (default 3)
✗ Narrow yes/no checklist prompts on rich sources  ✓ Wide themed extraction, then targeted rounds
✗ Quoting the disputed value in a verify prompt    ✓ Neutral phrasing — anchoring breeds fabrication
✗ Two passes agree on a hostname → citable         ✓ Alphanumerics need own-eye/primary-doc proof
✗ Overwriting a paid analysis to "redo" it         ✓ Topic-qualified filenames; passes accumulate
```

Ingestion-specific anti-patterns (converter, WEBP, symlinks, archives, legacy
engines): `references/ingestion-pipeline.md`.

## References

- `references/ingestion-pipeline.md` — full ingestion workflow: zones, scripts, flags, video engines, degradation, checklist
- `references/video-analysis.md` — targeted video passes: decision rules, prompt crafting, retry ladder, reliability caveats
- `references/video-source-reanalysis.md` — re-analyzing stale video sources for new questions
- `references/survey-mode.md` + `survey-template.md` + `questions-template.md` — survey construction
- `references/source-tiering.md` — full tier/`source_class` policy
- `references/docx-pdf-strategies.md`, `references/change-tracking.md`, `references/troubleshooting.md` — converter internals
- `references/sub-agent-dispatch.md` — fan-out patterns and polling
- `references/domain-knowledge-matrix.md` — high-stakes query patterns
- `references/file-output-protocol.md` — playbook file mode
- `references/invocation-context.md` — MCP invocation setup
- `references/academic-references.md` — supporting literature (tiering per ISO 25012; high-stakes threshold per Signal Detection Theory, Green & Swets 1966)
