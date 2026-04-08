---
name: deep-research-t1
version: "2.1"
description: >-
  Systematically gathers, validates, and synthesizes external knowledge
  using graph-based knowledge expansion until saturation is reached,
  combining a structured web search protocol with temporal-aware querying,
  domain-specific source tiering, deep research pipelines with sub-agent
  fan-out, and agentic search-enhanced reasoning.
  Automatically escalates research depth for high-stakes domains
  (medical, psychology, pharmacology, legal, structural engineering,
  financial advisory) using mandatory future forward disclosure knowledge fills,
  top-tier evidence constraints, and safety disclaimers.
  Resolves source conflicts via tier-weighted recency ranking,
  explicitly exposes contradictions rather than silently resolving them,
  and degrades gracefully from full multi-tool research
  down to training-knowledge-only mode with explicit disclaimers.
  Use when user asks factual questions,
  requests current information,
  needs technical comparisons or benchmarks,
  asks to 'research this',
  'verify this claim',
  'find current best practices',
  'what is the latest on',
  'deep dive',
  'systematic review',
  or any task requiring authoritative external knowledge
  before proceeding.
  Also use when user says 'think deeper', 'best approach',
  'explore alternatives', 'adversarial thinking', or 'ultrathink'
  — pairs with adversarial-thinking skill for stress-tested,
  knowledge-saturated recommendations.
  Supports multi-subject parallel research via sub-agent dispatch
  (one agent per subject, master synthesizes),
  asynchronous deep research agent polling with mandatory wait intervals,
  and persistent markdown playbook generation with create/update modes.
  Optionally writes findings to a persistent markdown file
  when invoked as /deep-research <topic> [--file deep_research.md].
  Works across native slash command environments, MCP-compatible editors,
  and bare LLM/API (degraded mode).

argument-hint: "<topic> [--file deep_research.md]"
allowed-tools: WebSearch, WebFetch, Read, Write, Edit, Grep, Glob, AskUserQuestion
metadata:
  author: rd162@hotmail.com
  tags: knowledge-gathering, chain-of-knowledge, web-search, source-tiering, deep-research, verification, high-stakes, documentation, best-practices, adversarial-thinking, question-answering, research-agent, multi-source, synthesis, contradictions, consensus, fact-checking, current-information, technical-comparison, benchmarks, systematic-review, parallel-research, domain-escalation, future-forward-disclosure, safety-critical, academic-research, medical-research, legal-research, deep-research-pipeline, knowledge-saturation, source-citation, tiered-evidence, chain-of-knowledge-graph-expansion, delta-protocol, web-fetch, playbook-generation, disambiguation, sub-agent-dispatch, graceful-degradation, forward-consequence-cok, high-stakes-escalation, temporal-aware-search, agentic-search, polling-protocol, mcp-compatible, context-engineering, multi-environment
---

# Deep Research

Systematic methodology for gathering, validating, and synthesizing
external knowledge using Chain of Knowledge (CoK) graph-based expansion
until saturation, executed via the Δ1-Δ7 web search protocol
with domain-specific source tiering.

## Invocation Context

This skill runs in two distinct environments with different activation mechanics:

### Claude Code (native runtime)

`/deep-research` is a first-class slash command with argument parsing.

```text
/deep-research swift concurrency
/deep-research kubernetes cost optimization --file infra.md
/deep-research --file existing-playbook.md   (re-researches and updates)
```

`argument-hint`, `user-invocable`, and `$ARGUMENTS` only work here.
All other environments ignore these frontmatter fields.

**Argument Parsing** — parse `$ARGUMENTS` before doing anything:

1. If `$ARGUMENTS` contains `--file <path>` — extract as output path.
   Everything else is the topic.
2. Else if a token ends in `.md` or contains `/` — treat as output path.
   Everything else is the topic.
3. Else treat ALL of `$ARGUMENTS` as the topic.
   Auto-generate path: `<topic-slug>.md` in the current working directory.
4. If `$ARGUMENTS` is empty — show help and stop:

```text
Usage:
  /deep-research swift concurrency
  /deep-research kubernetes cost optimization --file infra.md
  /deep-research --file existing-playbook.md   (re-researches and updates)
```

**Output mode:**

- File path resolved → `mode = file` (write playbook, see File Output section)
- No file path → `mode = inline` (answer in conversation, standard Δ1-Δ7)

### MCP environments (Zed, Cursor, Windsurf, Claude Desktop, etc.)

In environments without native skill support, this skill is delivered via an
MCP bridge such as **SkillPort** (`skillport-mcp`) or **Skillz**.
There is no `/deep-research` slash command and no `$ARGUMENTS`.

**How it works:**

- **SkillPort** (recommended): exposes `search_skills` + `load_skill` tools.
  The agent searches for "deep research" → loads this skill on demand.
  Progressive disclosure: metadata only until `load_skill` is called.
- **Skillz**: exposes each skill as one MCP Tool named after the skill.
  Simpler but loads all skill tools into every prompt (context bloat at scale).

**Zed setup (SkillPort):**

```json
{
  "context_servers": {
    "skillport": {
      "source": "custom",
      "command": "uvx",
      "args": ["skillport-mcp"],
      "env": {
        "SKILLPORT_SKILLS_DIR": "/path/to/your/skills"
      }
    }
  }
}
```

**Zed setup (Skillz, simpler):**

```json
{
  "context_servers": {
    "skillz": {
      "source": "custom",
      "command": "uvx",
      "args": ["skillz@latest", "/path/to/your/skills"]
    }
  }
}
```

**In MCP mode, topic and output mode are inferred from the conversation.**
The agent reads the full skill body and applies the Disambiguation Step,
Δ1-Δ7 protocol, and File Output section based on what the user asked for —
no argument parsing required. `$ARGUMENTS` blocks are simply skipped.

## Disambiguation Step

_(Applies in all environments. In Claude Code, runs after argument parsing.
In MCP environments, runs based on conversation context.)_

Before executing, use **AskUserQuestion** if ANY of these apply:

- Topic has multiple common meanings (e.g., "swift", "python", "spring",
  "agent", "mercury") — ask which one.
- Topic is too broad to research well without focus
  (e.g., "machine learning", "AI safety") — ask what aspect matters.
- Topic implies context the user hasn't stated
  (e.g., cloud provider, programming language, audience level).
- `mode = file` and file already exists — confirm update or overwrite.

Skip if the topic is specific and unambiguous.

## When to Use

- Factual claims requiring verification against current sources
- Current knowledge needed (versions, APIs, best practices, pricing)
- Technical comparisons or benchmarks
- Contested topics needing multiple authoritative sources
- Implementation or debugging with unfamiliar tools/APIs
- Any task where training knowledge may be stale or insufficient
- User explicitly asks to research, verify, or find current information

## When NOT to Use

- Pure logic or mathematical proofs (no external knowledge needed)
- Creative writing or opinion pieces
- Tasks where all information is already in project context
- Simple file operations with no external knowledge dependency
- User explicitly says to use training knowledge only

## Termination

| Signal    | Condition                                                                              | Action                                                    |
| --------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| SATURATED | All core requirements covered, or depth ≥ max, or relevance < 0.3, or budget exhausted | ✓ STOP — synthesize and present findings                  |
| NO_TOOLS  | Zero search/fetch tools available after Δ1 scan                                        | Degrade — use training knowledge with explicit disclaimer |
| EMERGENCY | External verification becomes impossible mid-protocol                                  | Mark uncertainty — never present as authoritative         |

## Graceful Degradation

This skill adapts to available tooling rather than halting:

- **Full tooling** (search + scrape + summarize + library docs):
  Run the complete Δ1-Δ7 protocol with deep research pipeline.
- **Partial tooling** (any single search tool):
  Run Δ1-Δ7 with reduced coverage. One search tool is enough.
- **No external tools available:**
  Use training knowledge ONLY. Always state this explicitly:
  "Based on training knowledge only. No external verification available.
  Treat all claims as unverified."
  This is a degraded mode, not a failure.
- **Limited budget:**
  Run Δ1-Δ3 only (strategy + execute), skip deep research pipeline.

The skill always produces output. The confidence level varies.

---

## High-Stakes Domain Escalation

**⚠ CRITICAL: Some domains carry life-affecting consequences.**

A wrong answer in medicine can cause death.
A wrong answer in psychology can contribute to suicide.
A wrong answer in legal advice can result in imprisonment.
A wrong answer in pharmacology can cause poisoning.
A wrong answer in structural engineering can cause building collapse.

**High-stakes domains (deep research ALWAYS required):**
Medical, Psychology, Pharmacology, Legal (advisory),
Structural/Civil engineering, Nutrition (medical),
Childcare/Parenting, Financial (advisory).

**Detection heuristic:**
If the answer could plausibly influence a decision that affects
someone's physical health, mental health, legal standing,
financial security, or physical safety — treat as high-stakes.
When uncertain, **escalate**.

**Mandatory protocol when high-stakes detected:**

1. **Deep research is MANDATORY, not optional.**
   Use the strongest available research tool
   (deep research agents, comprehensive multi-query search).
   If no deep research tool exists, compensate with 5-8 targeted searches
   constrained to T1 sources (peer-reviewed journals,
   clinical guidelines, regulatory text, official standards).

2. **Forward-consequence CoK is MANDATORY.**
   Standard CoK fills knowledge gaps: `(subject, relation, ?)`.
   High-stakes CoK ALSO fills consequence and contraindication gaps:
   - `(recommendation, interacts_with, ?)` — what conflicts exist?
   - `(advice, contraindicated_for, ?)` — who should NOT follow this?
   - `(solution, assuming, ?)` — what must be true for this to hold?
   - `(approach, if_wrong, ?)` — what happens if this is incorrect?
   - `(recommendation, superseded_by, ?)` — has this been updated?
   - `(treatment, withdrawn_in, ?)` — any regulatory actions?

3. **T1 sources ONLY for high-stakes claims.**
   T2-T4 sources may inform research direction
   but NEVER override T1 for life-affecting recommendations.

4. **Safety disclaimers ALWAYS in output.**
   "Consult a qualified [professional] before acting on this information."
   Mark confidence level explicitly.
   Expose contradictions between sources —
   NEVER silently resolve them for high-stakes domains.

5. **CoK depth minimum L0-L4.**
   High-stakes domains require full expansion depth.
   Do not stop at L2 even if surface requirements appear covered —
   the forward-consequence fills often reveal critical gaps at L3-L4.

See @references/domain-knowledge-matrix.md for domain-specific
high-stakes protocol details and forward-fill patterns.

---

## Chain of Knowledge (CoK) Methodology

CoK is systematic knowledge expansion
using graph-based reasoning until saturation.
Build linked triples `(subject, relation, object)`,
identify gaps, and fill them via targeted search.

### Forward-Fill Pattern

```text
Known triples:
  (Next.js, supports, SSR)
  (SSR, improves, SEO)

Gaps (? = unknown → each becomes a search query):
  (SSR, requires, ?)         → search: server configuration
  (SEO, measured_by, ?)      → search: metrics, tools
  (Next.js, competes_with, ?) → search: alternatives

Action: Fill each ? via targeted search → expand graph → repeat
```

### Forward-Consequence Fill (High-Stakes Domains)

Standard forward-fill discovers what IS.
Forward-consequence fill discovers what COULD GO WRONG.
This pattern is MANDATORY for high-stakes domains
and recommended for any domain where consequences matter.

```text
Standard fill:
  (medication X, treats, condition Y)
  (condition Y, symptoms, ?)              → fill: what symptoms

Forward-consequence fill:
  (medication X, interacts_with, ?)       → fill: drug interactions
  (medication X, contraindicated_for, ?)  → fill: who should NOT take this
  (medication X, superseded_by, ?)        → fill: newer alternatives
  (medication X, withdrawn_in, ?)         → fill: regulatory actions
  (treatment, assuming, ?)                → fill: what must be true
  (advice, if_wrong, ?)                   → fill: consequences of error
```

This pattern generalizes across all domains:

```text
Any domain:
  (recommendation, interacts_with, ?)     → conflicts and side effects
  (approach, contraindicated_for, ?)      → who/what should NOT use this
  (solution, assuming, ?)                 → hidden preconditions
  (advice, superseded_by, ?)              → newer knowledge
  (method, fails_when, ?)                 → failure conditions
```

### Expansion Levels and Stop Criteria

```text
L0: Initial topic → direct triples (relevance 1.0)
L1: First expansion → related concepts (relevance ~0.7)
L2: Second expansion → supporting details (relevance ~0.5)
L3: Third expansion → peripheral context (relevance ~0.3)
L4: Predicted relevance < 0.3 → STOP expanding

Stop when ANY is true:
  - All core requirements covered
  - Depth ≥ max (3-5 levels depending on budget)
  - Relevance drops below 0.3
  - Token budget exhausted
  - Circular references detected (triples repeat)
```

---

## Source Tiers

| Tier | Description                          | Default Confidence | Weight in Conflicts |
| ---- | ------------------------------------ | ------------------ | ------------------- |
| T1   | Peer-reviewed / official docs / RFCs | HIGH               | Strongest           |
| T2   | Expert blogs / established sources   | MED                | Strong              |
| T3   | Community forums / Stack Overflow    | LOW                | Weak                |
| T4   | Opinions / unverified claims         | LOW                | Weakest             |

When sources conflict, higher tier + more recent = stronger evidence.
Annotate every cited source with its tier.

---

## Web Search Protocol (Δ1-Δ7)

Seven steps from tool discovery to validated output.
Each step builds on the previous. Skip none.

### Δ1: Tool Availability

Scan available tools and identify search/fetch capabilities.
If zero external tools are available, switch to degraded mode
(training knowledge with explicit disclaimer — see Graceful Degradation).

### Δ2: Strategy

Get the current date (mandatory — NO hardcoded years):

```text
current_date = now(timezone="local")
current_year = extract year from current_date
```

**Check for high-stakes domain** (see High-Stakes Domain Escalation above).
If high-stakes detected:

- Escalate to deep research (MANDATORY)
- Plan 5-8 searches (not 3+)
- Constrain to T1 sources for core claims
- Include forward-consequence CoK queries

Plan 3+ searches covering different angles
(5-8 for high-stakes domains):

- **Primary:** Official / peer-reviewed sources
- **Practitioner:** Real-world usage and experience
- **Comparative:** Benchmarks / analysis / alternatives
- **[HIGH-STAKES] Consequences:** Contraindications, interactions, failure modes
- **[HIGH-STAKES] Superseded:** Updated guidelines, retracted findings

Select tools per domain.
See @references/domain-knowledge-matrix.md for domain-specific
tool selection, query patterns, and CoK depth guidance.

### Δ3: Execute

For each planned search:
execute with temporal qualifiers (use `{current_year}`, never hardcode),
record each finding with source URL + date + tier (T1-T4).

### Δ4: Organize

```text
SOURCES: [Source]:[Finding](T#) — at least 3
CONSENSUS: [What sources agree on]
CONTRADICTIONS: [Where sources disagree and why]
GAPS: [What remains unclear]
```

### Δ5: Weight

Resolve conflicts using source tier priority.
Higher tier + more recent = stronger evidence.

### Δ6: Output

```text
Based on [N] sources (searched: {current_date}):

[ANSWER]

Evidence:
- [Claim] (Source: [cite], T#)
- [Claim] (Source: [cite], T#)

[IF contested] ⚠ Sources vary. Consult [authority].
[IF degraded] ⚠ Training knowledge only. No external verification.
```

### Δ7: Validation Checklist

Before presenting results, verify:

- Current date obtained (not hardcoded)?
- 3+ searches executed (5+ for high-stakes)?
- 3+ sources cited with URLs and tiers?
- Contradictions explicitly exposed?
- [HIGH-STAKES] Deep research tool used (or 5-8 T1-targeted searches)?
- [HIGH-STAKES] Forward-consequence CoK completed?
- [HIGH-STAKES] Safety disclaimer included?
- [HIGH-STAKES] No T2-T4 source overriding T1 for life-affecting claims?

If any item fails, fix before presenting.

---

## Deep Research Pipeline

For comprehensive research requiring broad coverage (20-50+ references).
Use when: novel/niche topic, systematic review needed, user says "deep dive,"
or HIGH-STAKES domain where deep research is mandatory.
For well-known topics or single questions, standard Δ1-Δ7 is sufficient.

```text
1. Broad sweep: 20-50 references via multiple search tools
2. Filter: top 10 candidates by relevance and tier
3. Summarize: extract key points from each candidate
4. Select: top 3-5 highest-quality sources
5. Extract: full content from each selected source
6. Synthesize: build CoK triples → produce comprehensive cited answer
```

Use whatever search, summarize, and scrape tools are available.
The pipeline adapts to available tooling — if only one search tool exists,
use it for the broad sweep and skip the multi-tool parallelism.

### Sub-Agent Dispatch for Multi-Subject Research

**⚠ MANDATORY:** When research covers **2+ independent subjects**
and a sub-agent mechanism is available (see orchestration rules),
dispatch each subject to a dedicated sub-agent
rather than researching sequentially in the master context.

**Why — Context Engineering:**

- Each sub-agent gets a **clean, isolated context window**
  free from cross-subject noise.
- Raw web content (scraped HTML, search results, API docs)
  stays in the sub-agent's context and never pollutes the master.
- The master receives only the **synthesized report** from each sub-agent,
  dramatically reducing token consumption.
- Quality improves because each sub-agent can go deep
  without competing for context space with other subjects.
- The master retains context budget for **synthesis and comparison**
  across all subjects — the highest-value reasoning step.

**Decision gate:**

```text
Research request received →
  How many independent subjects?
    1 subject  → run Δ1-Δ7 inline (standard)
    2+ subjects, NO dependencies between them →
      sub-agent available? → YES → fan-out (one agent per subject or group)
                           → NO  → sequential with context fencing
    2+ subjects, WITH dependencies →
      sequential chain (output of A feeds B)
```

**Dispatch pattern:**

```text
FOR EACH independent subject (or logical group of 2-3 related subjects):
  spawn_agent(
    label = "[subject-name] research"
    message = "Research [subject]. Report on: [dimensions].
               Use web search and scraping tools.
               Cite sources with tiers (T1-T4).
               Max [N] words per section.
               Return structured findings only."
  )
→ collect all reports
→ master synthesizes: compare, rank, identify gaps, produce unified answer
```

**Grouping heuristic:**

| Subject count | Strategy                                                       |
| ------------- | -------------------------------------------------------------- |
| 1             | Inline Δ1-Δ7 in master context                                 |
| 2-3           | One sub-agent per subject                                      |
| 4-6           | Group related subjects (2-3 per agent)                         |
| 7+            | Group into 3-5 agents by affinity; set per-section word limits |

**Output budget per sub-agent:**
Target ~3,000 words per agent report.
When a single subject is expected to produce >3,000 words,
constrain with explicit section word limits in the prompt
(e.g., "max 500 words per section").
When grouping 2-3 subjects per agent,
the natural constraint of covering multiple subjects
produces balanced output without explicit limits.

**Token savings estimate:**

| Approach                         | Master context consumed                                |
| -------------------------------- | ------------------------------------------------------ |
| Sequential inline (all subjects) | Raw HTML + search results + synthesis = 80-150K tokens |
| Sub-agent dispatch               | Only synthesized reports = 10-25K tokens               |
| Savings                          | 70-85% reduction in master context usage               |

**Integration with Δ1-Δ7:**
Each sub-agent independently executes the full Δ1-Δ7 protocol
for its assigned subject(s).
The master does NOT re-run Δ1-Δ7 on the same subjects.
The master's role is synthesis, comparison, and gap identification.

### Deep Research Agent Polling Protocol

When using asynchronous deep research tools
(e.g., `deep_researcher_start` → `deep_researcher_check`),
the research runs in the background and must be polled for results.

**⚠ MANDATORY: Wait minimum 30 seconds between status checks.**

```text
∆1: Start deep research with clear, specific instructions
    → receives research_id immediately

∆2: Wait AT LEAST 30 seconds before first status check
    → do NOT poll immediately — the research needs time to run
    → use this wait time productively (run other searches in parallel)

∆3: Check status with research_id
    → status: "processing" → wait another 30+ seconds, check again
    → status: "completed" → extract results
    → status: "failed" → fall back to multi-query manual search

∆4: Keep polling with 30+ second intervals until completed or failed
    → typical completion times:
       fast model:  15-30 seconds
       balanced:    30-60 seconds
       pro/deep:    60-180 seconds (be patient!)
    → do NOT give up after 1-2 checks — research takes time
    → maximum patience: 3-5 minutes for complex queries

∆5: On completion → extract findings, integrate into CoK graph
```

**Why 30 seconds minimum:**
Polling too frequently wastes API calls without accelerating results.
Deep research agents need time to search, read, and synthesize.
Premature polling produces "still processing" responses
that consume tokens without providing value.

**Parallel work during wait:**
While waiting for deep research results,
run standard Δ3 searches in parallel.
The deep research results will supplement — not replace —
standard search findings. Both contribute to saturation.

**Model selection guidance:**

| Research need               | Model to use        | Expected wait |
| --------------------------- | ------------------- | ------------- |
| Simple factual lookup       | fast (~15s)         | 15-30 seconds |
| Multi-source comparison     | balanced (~30-45s)  | 30-60 seconds |
| HIGH-STAKES / comprehensive | pro/deep (~60-180s) | 1-3 minutes   |
| Novel/niche topic           | pro/deep            | 1-3 minutes   |

For HIGH-STAKES domains, ALWAYS use the deepest/pro model.
The extra wait time is justified by the quality of evidence gathered.

---

## Knowledge Sources (Priority Order)

1. **Local docs** — project files, READMEs (project-specific context)
2. **LLM pattern files** — `llms*.txt` in current directory (domain patterns)
3. **Library docs** — Context7, official API references (authoritative)
4. **Web search** — any available search/scrape tools (current/external)
5. **Memory systems** — session memory, notes (cross-session continuity)

Check local sources before reaching for the web.
For LLM pattern file handling and domain-specific tool selection,
see @references/domain-knowledge-matrix.md.

---

## Example

```text
User: "What's the best state management for React?"

Δ1: Available tools: web search ✓, scrape ✓
Δ2: Strategy (date from now()):
  - S1: "React state management {current_year} comparison"
  - S2: "React state management production usage"
  - S3: "Redux vs Zustand vs Jotai benchmark {current_year}"
Δ3: Execute → 6 sources gathered (T1: 2, T2: 3, T3: 1)
Δ4: Consensus: Zustand growing rapidly, Redux dominant in enterprise
    Contradictions: T3 "Redux is dead" vs T1 official adoption data
Δ5: Weight: T1 > T3 → Redux dominant, Zustand rising fastest
Δ6: Output with 6 cited sources, tiers annotated
Δ7: Validation checks pass ✓
```

---

## File Output (mode = file)

When a file path is resolved from `$ARGUMENTS`, write findings to a persistent
markdown playbook instead of answering inline.

### Create mode (file does not exist)

1. Run Δ1-Δ7 with sub-agent fan-out if 2+ research angles needed.
2. Group findings into 5-10 logical sections.
3. Write the file:

```markdown
# [Title derived from topic]

## [Section Name]

[Tight synthesis paragraph + bullet insights]
[Claim]. — [Source Name](URL)

---

## Sources

- [URL 1]
- [URL 2]

---

_Captured: YYYY-MM-DD_
```

Rules:

- Every claim MUST have a source URL — drop findings without one.
- Voice: direct, concise, practitioner-focused. No hedging, no filler.
- Example — BAD: "It is generally recommended to consider caching for performance."
- Example — GOOD: "Cache aggressively. Redis for shared state, in-memory for hot paths."

### Update mode (file already exists)

1. Read the existing file. Note section headings, Sources list, and voice/style.
2. Run Δ1-Δ7 targeted to what has changed since the `*Captured:*` date.
3. For each new finding:
   - Locate the correct existing section.
   - Use Edit to merge inline — NEVER create a "New Findings" subsection.
   - Match the existing voice exactly (re-read a paragraph to internalize it first).
   - Format: `[Insight]. — [Source Name](URL)`
   - If a finding contradicts existing content AND has HIGH confidence (T1):
     update the existing claim, keep the old source for comparison.
   - If Medium confidence only: add as "alternative perspective", do not replace.
4. Add new source URLs to the Sources list at the bottom.
5. Update the `*Captured:*` date.

Rules:

- NEVER change the voice or restructure sections.
- NEVER add a claim without a source URL.
- ALWAYS preserve existing content unless explicitly superseded by a T1 source.

### Verification step (both modes)

After writing, read the file and verify:

- Every claim has a source URL.
- No duplicate entries.
- New content reads cohesively with existing content.
- Sources list is complete.

Then report:

```text
## Playbook [Created | Updated]

File: [absolute path]
Mode: [create | update]
Topic: [what was researched]
Sections [created | modified]: N
Sources: N
Findings integrated: N
Findings dropped (no source / duplicate): N
```

---

## Anti-Patterns

```text
✗ Hardcoded years in search queries ("React 2024 state management")
✓ Dynamic year from now() ("React {current_year} state management")

✗ Single search, single source → presenting as authoritative
✓ 3+ searches, 3+ sources with tier annotations

✗ Skipping source tiers → treating blog post same as official docs
✓ T1-T4 tier annotation on every cited source

✗ Ignoring contradictions between sources
✓ Explicitly exposing contradictions with tier-weighted resolution

✗ Halting because no search tools are available
✓ Degrade gracefully: use training knowledge with explicit disclaimer

✗ Deep research pipeline for simple factual lookups
✓ Deep research only when comprehensive coverage needed

✗ Reading entire llms*.txt file into context
✓ Index sections first → extract targeted section only

✗ Presenting training knowledge as current fact without verification
✓ Search first, cite sources, mark uncertainty when present

✗ Polling deep research status every 5 seconds (wastes API calls, no faster results)
✓ Wait minimum 30 seconds between deep research status checks

✗ Giving up on deep research after 1-2 polling attempts
✓ Be patient — pro/deep research can take 1-3 minutes. Keep polling at 30s intervals

✗ Blocking on deep research instead of doing parallel work
✓ Run standard Δ3 searches while waiting for deep research results

✗ Standard-depth search for medical, psychology, or legal questions
✓ HIGH-STAKES: deep research mandatory, T1 only, forward-consequence CoK,
  safety disclaimers — a wrong answer can cause real-world harm

✗ Skipping forward-consequence CoK for high-stakes domains
✓ Always ask: what goes wrong if this advice is followed incorrectly?
  Who should NOT follow this? Has this been superseded?

✗ Silently resolving contradictions in high-stakes domains
✓ EXPOSE all contradictions — let the human decide, with professional guidance

✗ Treating all domains equally — culinary ≠ medical
✓ Detect domain stakes early, escalate research depth accordingly

✗ Researching 3+ independent subjects sequentially in master context
✓ Fan-out to sub-agents: one per subject, each runs Δ1-Δ7 independently

✗ Loading raw scraped HTML from 5+ subjects into master context
✓ Sub-agents consume raw content; master receives only synthesized reports

✗ No word limits on sub-agent prompts → unbounded output floods master
✓ Set explicit per-section word limits (~500 words) or per-agent budget (~3K words)

✗ Grouping dependent subjects into parallel agents
✓ Only independent subjects parallelize; dependent chains go sequential
```

---

## Environment Compatibility

This skill adapts to available tooling:

- **Full capability:** Multiple search + scrape + summarize tools → best results
- **Partial:** Any single web search tool → reduced coverage, protocol still applies
- **No external tools:** Training knowledge with explicit disclaimer → degraded but functional
- **Claude Code / Cursor / Codex / Gemini CLI / Kimi:** Works with any available search tools
- **Bare LLM / API:** Degraded mode only (training knowledge + disclaimer)

## References

- Li et al.,
  "Chain of Knowledge: A Framework for Grounding
  Large Language Models with Structured Knowledge Bases"
  (arXiv:2305.13269, 2023).
  Foundation for CoK triple structure and graph-based expansion.
- Xu et al.,
  "Search-o1: Agentic Search-Enhanced
  Large Reasoning Models"
  (arXiv:2501.05366, 2025).
  Agentic search integration patterns
  and multi-step verification workflows.
