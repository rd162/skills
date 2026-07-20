---
name: deep-research
version: "3.0"
description: >-
  Systematically gathers, validates, and synthesizes external knowledge:
  temporal-aware multi-angle searching, domain-specific source tiering
  (T1-T4) with tier-weighted conflict resolution, gap-driven iteration
  until saturation, and sub-agent fan-out for multi-subject research.
  Escalates depth for high-stakes domains (medical, legal, pharmacology,
  psychology, engineering, financial) with T1-only evidence and
  forward-consequence queries. Exposes contradictions rather than
  silently resolving them; degrades gracefully to training-knowledge-only
  mode. Use when the user asks to "research this", "verify this",
  "deep dive", "systematic review", or needs authoritative current
  knowledge. Can write findings to a persistent playbook file.

argument-hint: "<topic> [--file deep_research.md]"
allowed-tools: WebSearch, WebFetch, Read, Write, Edit, Grep, Glob, AskUserQuestion
metadata:
  author: rd162@hotmail.com
  tags: web-search, source-tiering, deep-research, high-stakes, sub-agent-dispatch, graceful-degradation, playbook-generation
tier: T3
source_class: llm
last_updated: 2026-07-20
---

# Deep Research

Gather, validate, and synthesize external knowledge with source tiering,
temporal awareness, and explicit contradiction handling.

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
- Implementation or debugging with unfamiliar tools/APIs

## When NOT to Use

- Pure logic or math (no external knowledge needed)
- All information already in project context
- User explicitly says to use training knowledge only

## Termination and Degradation

| Signal    | Condition                                              | Action                                       |
| --------- | ------------------------------------------------------ | -------------------------------------------- |
| SATURATED | Core covered, or an iteration adds nothing new, or budget out | STOP — synthesize and present          |
| NO_TOOLS  | Zero search/fetch tools available                      | Training knowledge ONLY, explicit disclaimer |
| EMERGENCY | Verification becomes impossible mid-protocol           | Mark uncertainty — never present as authoritative |

The skill always produces output; only the confidence level varies.
Tight budget → strategy + execute only (skip the deep pipeline).

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

## Core Protocol

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

1. Local project docs and READMEs → 2. `llms*.txt` pattern files → 3. Library docs
(Context7, official API refs) → 4. Web search → 5. Memory systems.
Check local sources before reaching for the web.

---

## Deep Pipeline and Fan-Out

For comprehensive research (novel/niche topic, systematic review, "deep dive",
high-stakes): broad sweep (20-50 references) → filter to top ~10 by relevance and
tier → summarize → select top 3-5 → extract full content → synthesize with citations.

**Multi-subject fan-out (MANDATORY when applicable):** research covering 2+ independent
subjects with a sub-agent mechanism available → dispatch one sub-agent per subject
(group into 3-5 agents by affinity when 4+ subjects). Each runs the full protocol
independently; master synthesizes and identifies gaps.
Dispatch patterns, output budgets, model selection: `references/sub-agent-dispatch.md`.

**Async research tools:** poll no more than every 30 seconds; run standard searches in
parallel while waiting. High-stakes → always the deepest/pro model.

**Video sources:** when the topic touches project video material, existing transcripts
or AI descriptions answer only the questions asked WHEN they were produced. Use them as
a relevance filter only; run a NEW analysis pass prompted with the CURRENT question;
persist under a topic-qualified filename; cross-check against text sources (video
analysis is T3). Protocol and proof case: `references/video-source-reanalysis.md`.

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
```

## References

`references/academic-references.md` — full citations
(source tiering operationalizes ISO 25012 accuracy; high-stakes threshold per
Signal Detection Theory, Green & Swets 1966).
