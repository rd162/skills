---
tier: T3
source_class: llm
last_updated: 2026-07-20
description: domain knowledge matrix
---

# Domain Knowledge Matrix

Reference tables for the deep-research skill.
Maps domains to follow-up question patterns, source tiers,
tool selection, and query strategies.

Loaded on demand — not part of the main SKILL.md context.

---

## Follow-Up Question Patterns by Domain

After the first round of findings, expand along the domain's natural chain of
questions until an iteration adds nothing new:

| Domain     | Question chain                                                              | Focus                                |
| ---------- | ---------------------------------------------------------------------------- | ------------------------------------ |
| Technical  | what does the tool require? → which versions? → what configuration?          | Dependencies, configuration          |
| Scientific | has the finding been replicated? → what contradicts it?                      | Replication, contradictions          |
| Historical | what caused the event? → what context? → what era dynamics?                  | Causation, context                   |
| Debug      | what causes the error? → what fixes the cause? → does the fix hold?          | Root cause, solution chain           |
| ML/AI      | what was it trained on? → what does it outperform? → on which benchmarks?    | Training, benchmarks                 |
| Compare    | how do X and Y differ? → what is each better at?                             | Trade-offs, use cases                |
| Psychology | what causes the behavior? → what modulates the mechanism? → what intervenes? | Mechanisms, interventions            |
| Physics    | what model describes it? → what does it predict? → what confirms it?         | Models, experimental evidence        |
| Culinary   | what does the technique produce? → what reacts with what?                    | Techniques, chemistry, substitutions |
| Business   | what drives the market? → how do competitors differentiate? → what trends?   | Drivers, competition, trends         |
| Creative   | what influenced the style? → what does the principle achieve?                | Influences, principles, constraints  |
| Education  | what are the prerequisites? → which methods improve outcomes?                | Prerequisites, pedagogy              |
| Policy     | what does the regulation mandate? → what does compliance require?            | Mandates, compliance, precedent      |
| Medical    | what treats the condition? → what contraindicates the treatment? → outcomes? | Treatments, contraindications        |

---

## Source Tiers + Temporal Rules

| Domain     | T1 Sources                          | T2 Sources                 | Temporal Rule     |
| ---------- | ----------------------------------- | -------------------------- | ----------------- |
| Technical  | Official docs, RFCs                 | Expert blogs               | `{current_year}`  |
| Scientific | Peer-reviewed journals              | Preprints, conf            | NO temporal       |
| Historical | Primary archives                    | Scholarly consensus        | `[era]` NOT year  |
| SW-Current | Release notes, changelog            | Production forums          | `{current_year}`  |
| SW-Legacy  | Archive docs                        | Migration guides           | version# only     |
| Debug      | Issue trackers, docs                | Stack Overflow             | recent 2 years    |
| ML/AI      | Papers, official repos              | GitHub, benchmarks         | `{current_year}`  |
| Legal      | Statutes, case law                  | Legal analysis             | jurisdiction+date |
| Medical    | Clinical trials, systematic reviews | Clinical guidelines        | NO temporal       |
| Financial  | SEC filings, annual reports         | Analyst coverage           | quarter/year      |
| Psychology | APA journals, meta-analyses         | Textbooks, review papers   | NO temporal       |
| Physics    | Physical Review, Nature Physics     | arXiv preprints, CERN      | NO temporal       |
| Culinary   | Food science journals, USDA         | Professional chef guides   | NO temporal       |
| Business   | SEC filings, industry reports       | HBR, analyst reports       | `{current_year}`  |
| Creative   | Design systems, style guides        | Award archives, portfolios | trend+year        |
| Education  | Ed research journals, ERIC          | Practitioner guides        | NO temporal       |
| Policy     | Legislation text, court rulings     | Policy analysis orgs       | jurisdiction+date |

---

## Tool Selection

### Tool Categories

Tools are grouped by **capability**, not by name.
At the tool-scan step, identify which capabilities are available
and map to the best available tool per category.

| Capability          | Preferred Tools (if available)                                  | Fallback                                          |
| ------------------- | --------------------------------------------------------------- | ------------------------------------------------- |
| **Code search**     | `get_code_context_exa()`, `query-docs()` (Context7)             | `grep`, `firecrawl_search()` site-scoped          |
| **Library docs**    | `query-docs()` (Context7), `resolve-library-id()`               | `firecrawl_scrape()` on docs URL                  |
| **Web search**      | `web_search_exa()`, `firecrawl_search()`, `kagi_search_fetch()` | Any tool with web search capability               |
| **Academic search** | `web_search_advanced_exa(category="research paper")`            | `firecrawl_search()` site:arxiv.org, site:nih.gov |
| **Company/market**  | `company_research_exa()`                                        | `web_search_exa(category="company")`              |
| **People/experts**  | `people_search_exa()`                                           | `web_search_exa(category="people")`               |
| **Page content**    | `firecrawl_scrape()`, `crawling_exa()`                          | `fetch()`, `kagi_summarizer()`                    |
| **Summarize**       | `kagi_summarizer()`, `deep_researcher_start()`                  | Manual extraction from scrape                     |
| **Deep research**   | `deep_researcher_start()` (exa-research-pro)                    | Multi-query web search + scrape                   |
| **News/current**    | `firecrawl_search(sources: news)`, `web_search_exa()`           | Any search tool with date filter                  |
| **Embedded search** | Built-in `web_search` (Claude), `search` (Copilot)              | Always available as last resort                   |

### High-Stakes Domain Protocol

**⚠ CRITICAL: Some domains carry life-affecting consequences.**

A wrong answer in medicine can cause death.
A wrong answer in psychology can contribute to suicide.
A wrong answer in legal advice can result in imprisonment.
A wrong answer in structural engineering can cause building collapse.
A wrong answer in pharmacology can cause poisoning.

For these domains, standard search is **insufficient**.
Deep research is **mandatory**, not optional.

**High-stakes domains (deep research ALWAYS required):**

| Domain               | Risk                                      | Why deep research is mandatory                                          |
| -------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| Medical              | Harm, death                               | Treatments evolve, drug interactions are complex, guidelines change     |
| Psychology           | Self-harm, suicide, trauma                | Interventions can backfire, debunked therapies persist in popular media |
| Pharmacology         | Poisoning, adverse reactions              | Dosage errors, contraindications, recall notices                        |
| Legal (advisory)     | Imprisonment, financial ruin              | Jurisdiction-specific, precedent changes, statutory amendments          |
| Structural/Civil     | Building collapse, infrastructure failure | Load calculations, material properties, code compliance                 |
| Nutrition (medical)  | Allergic reaction, dietary harm           | Allergen interactions, condition-specific dietary requirements          |
| Childcare/Parenting  | Developmental harm                        | Debunked practices persist (e.g., outdated sleep/feeding guidance)      |
| Financial (advisory) | Bankruptcy, fraud exposure                | Regulatory changes, tax law, investment suitability                     |

**High-stakes detection heuristic:**
If the answer could plausibly influence a decision that affects
someone's physical health, mental health, legal standing, financial security,
or physical safety — treat as high-stakes.
When uncertain whether a domain is high-stakes, **escalate to deep research**.

**Mandatory protocol for high-stakes domains:**

```text
∆1: Detect high-stakes domain (from table above or heuristic)
∆2: Use deep research tool (MANDATORY, not optional)
    → deep_researcher_start(model="exa-research-pro") or equivalent
    → If deep research tool unavailable → run 5-8 targeted searches
      across T1 academic sources with explicit safety focus
∆3: Cross-validate against T1 sources ONLY
    → Peer-reviewed journals, clinical guidelines, official regulatory text
    → T2-T4 sources may inform but NEVER override T1 for high-stakes claims
∆4: Ask the forward-consequence questions:
    → What does this interact or conflict with?
    → Who should NOT receive this advice / treatment / design?
    → What assumptions must hold for this to be safe — and might they be wrong here?
    → Has this been updated, superseded, or withdrawn?
∆5: Always include safety disclaimers in output:
    → "Consult a qualified [professional] before acting on this information."
    → Mark confidence level explicitly
    → Expose contradictions between sources — NEVER silently resolve them
```

**Forward-consequence question patterns:**

Standard research asks what IS the case.
High-stakes research ALSO asks what could go WRONG:

```text
Standard:
  what does medication X treat? what are condition Y's symptoms?

Forward-consequence (HIGH-STAKES — always add):
  what does X interact with?          → drug interactions
  who is X contraindicated for?       → who should NOT take this
  what has superseded X?              → newer alternatives
  has X been withdrawn anywhere?      → regulatory actions
  what does this advice assume?       → conditions that must be true
  what happens if this is wrong?      → consequence of error
```

This pattern applies to ALL high-stakes domains:

```text
Psychology:
  when does the intervention backfire?    → when it makes things worse
  has the therapy been debunked?          → disproven practices persist
  who should NOT receive this advice?     → contraindications

Legal:
  has the statute been amended?           → is the law current
  has the precedent been overturned?      → is it still valid
  which jurisdictions does this cover?    → where it applies

Engineering:
  what does the calculation assume?       → what must be true to hold
  under what conditions does it fail?     → failure modes
  does the design meet current codes?     → regulatory compliance
```

---

### Domain → Tool Capability Mapping

| Domain     | Primary Capability       | Secondary Capability  | Deep Research | Iteration Depth |
| ---------- | ------------------------ | --------------------- | ------------- | --------- |
| Code/API   | Code search              | Library docs          | Optional      | shallow   |
| Technical  | Web search               | Page content          | Optional      | standard  |
| Research   | Academic search          | Page content          | Recommended   | deep      |
| Current    | News/current             | Web search            | Optional      | shallow   |
| Debug      | Code search              | Web search            | Optional      | shallow   |
| Visual     | Web search (images)      | Page content (vision) | Optional      | minimal   |
| Deep       | Deep research            | Multi-tool sweep      | **YES**       | deep      |
| Psychology | Academic search          | Deep research         | **MANDATORY** | deep      |
| Physics    | Academic search          | Page content          | Recommended   | deep      |
| Culinary   | Web search               | Page content          | Optional      | shallow   |
| Business   | Company/market           | News/current          | Situational   | standard  |
| Creative   | Web search               | Page content          | Optional      | shallow   |
| Education  | Academic search          | Web search            | Recommended   | standard  |
| Policy     | Web search (site-scoped) | Deep research         | **MANDATORY** | deep      |
| Medical    | Academic search          | Deep research         | **MANDATORY** | deep      |
| Financial  | Company/market           | Deep research         | **MANDATORY** | deep      |
| Legal      | Academic search          | Deep research         | **MANDATORY** | deep      |

**Tool availability varies by session.**
Always scan available tools first, before planning.
Map domain to capability, then capability to best available tool.
If preferred tool unavailable, use the fallback from the capability table.
If no external tools at all, use embedded search or training knowledge with disclaimer.

**⚠ For MANDATORY deep research domains:**
If deep research tool is unavailable,
compensate with 5-8 targeted searches on T1 sources,
ask the forward-consequence questions above,
and always include safety disclaimers.
Never present high-stakes answers without explicit T1 source citations.

---

## Query Patterns + Fallback

| Domain       | Primary Query                       | Fallback Query                   | Broaden Strategy   |
| ------------ | ----------------------------------- | -------------------------------- | ------------------ |
| Technical    | `"[X] docs"`                        | `"[X] tutorial guide"`           | parent_category    |
| Scientific   | `"[X] peer-reviewed"`               | `"[X] preprint meta"`            | related_field      |
| Historical   | `"[X] primary source [era]"`        | `"[X] scholarly consensus"`      | broader_period     |
| Debug        | `"[Error] exact message"`           | `"[Error] similar type"`         | error_category     |
| Compare      | `"[X] vs [Y] benchmark"`            | `"[X] alternative to [Y]"`       | solution_space     |
| ML/AI        | `"[X] paper implementation"`        | `"[X] benchmark {year}"`         | model_family       |
| SW-Implement | `"[X] guide production"`            | `"[X] examples real"`            | framework_category |
| Psychology   | `"[X] meta-analysis APA"`           | `"[X] systematic review"`        | broader_construct  |
| Physics      | `"[X] Physical Review arXiv"`       | `"[X] experiment measurement"`   | related_phenomenon |
| Culinary     | `"[X] technique food science"`      | `"[X] recipe professional chef"` | cuisine_family     |
| Business     | `"[X] market analysis {year}"`      | `"[X] industry report"`          | adjacent_market    |
| Creative     | `"[X] design principles examples"`  | `"[X] style guide portfolio"`    | design_system      |
| Education    | `"[X] pedagogy evidence-based"`     | `"[X] teaching method research"` | learning_theory    |
| Policy       | `"[X] regulation legislation text"` | `"[X] compliance guide"`         | jurisdiction       |
| Medical      | `"[X] clinical trial systematic"`   | `"[X] treatment guidelines"`     | condition_category |
| Financial    | `"[X] SEC filing annual report"`    | `"[X] analyst coverage {year}"`  | sector             |
| Legal        | `"[X] case law statute"`            | `"[X] legal analysis precedent"` | jurisdiction       |

**Broadening Chain:** topic → synonyms → parent_category → domain

---

## LLM Pattern Files Protocol

Always check for `llms*.txt` files in current directory first.

```text
⚠ WARNING: llms*.txt files can be EXTREMELY LARGE
  → NEVER read entire file
  → NEVER attempt to outline contents
  → NEVER load into context directly

PROTOCOL:
1. Check existence: ls llms*.txt
2. Build/use section index:
   → grep "^##" llms*.txt > llms_sections_index.json
   → Parse ## headings into JSON structure
3. Search for matching patterns:
   → Use grep with L2-L3 heading breakdown
   → Match query against section titles
4. Extract ONLY relevant sections:
   → Read specific section by line range
   → Never exceed token budget
```

**Index Structure:**

```json
{
  "file": "llms.txt",
  "sections": [
    { "level": 2, "title": "Section Name", "line": 42 },
    { "level": 3, "title": "Subsection", "line": 58 }
  ]
}
```

**Pattern Matching Flow:**

```text
Query → grep sections index → identify L2/L3 matches → extract targeted section only
```
