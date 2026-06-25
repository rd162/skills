---
tier: T3
source_class: llm
last_updated: 2026-06-24
description: source tiering
---

# Source Tiering Policy

Authoritative reference for tier (T1–T4) assignment and `source_class`
taxonomy used by `deep-research-t1` and any skill that produces or
consumes structured knowledge. Other skills MAY inline the relevant
short summary; this file is the source of truth.

## 1. Tier Scale

| Tier | Description | Default Confidence | Weight in Conflicts |
| ---- | ----------- | ------------------ | ------------------- |
| T1 | Peer-reviewed papers, official vendor docs, RFCs, standards bodies | HIGH | Strongest |
| T2 | Expert/established sources, primary partner documents (`data/intake/`), authoritative books | MED | Strong |
| T3 | Syntheses and generated artifacts — surveys, playbooks, discovery reports, memory entries, LLM-produced structured output | LOW | Weak |
| T4 | Low-quality materials: opinions, unverified claims, weak-model AI output, outdated sources, draft scratchpads | VERY LOW | Weakest |

**T1 is reserved for true public sources.** Internal/closed documents
never qualify as T1, even if authoritative inside the organization.

**T4 is reserved for genuinely low-quality material.** Most LLM-generated
structured output from capable models is T3, not T4. Use T4 only when
there is a specific quality reason: weak/old model, no sources cited,
known-outdated, or explicitly unverified claim.

When sources conflict, higher tier + more recent = stronger evidence.

**Below T4 — ephemeral (not citable):** regenerable/scratch artifacts (`.cache/`, legacy `.agents/scratch/`, `.agents/cache/`) rank *below* T4 and are **never cited as evidence**. T1–T4 is the full citable scale — do not invent a numeric tier below T4; treat these as lowest-trust working files only.

## 2. `source_class` Taxonomy

Every generated or curated markdown document declares one of:

| Class | Meaning | Typical Tier |
| ----- | ------- | ------------ |
| `public` | Unmodified content from external sources (web, vendor docs, GitHub, Confluence, Jira) — kept verbatim with link | T1–T2 (rarely worth saving lower) |
| `specs` | Internal/closed primary documents — partner-supplied PDFs, RFPs, contracts, transcripts, screenshots (`data/intake/`) | T2 default |
| `fragment` | Extract or machine transform of `public` + `specs` — produced by a converter (MarkItDown, Docling), not an LLM; **inherits the tier of its source** (`data/corpus/`) | Inherits source tier (usually T2) |
| `llm` | Final-for-purpose artifact produced by an LLM — surveys, blueprints, playbooks, discovery reports, memory entries | T3 default; T4 if low quality |
| `llm_human` | Same origin as `llm`, subsequently read, corrected, and validated by a human | T3 (higher confidence) |
| `human` | Human-authored content — rough notes, transcripts, emails, decisions written by people | T2 default |

**Pipeline:** `external (public) + internal (specs) → fragments (inherit source tier) → llm (T3) → llm_human (T3, human-validated)`

**These labels are best-effort approximations, not forensic classifications.** A file marked
`human` may still contain quoted LLM output; `llm` may have been manually edited. Use the
labels to weight evidence in conflicts — not as hard provenance guarantees.

**Why fragments inherit tier:** fragments are machine-produced restructurings of the source
(MarkItDown, Docling, XML parse) — they carry no new claims. A fragment of a T2 spec is
T2. A fragment of a T1 public RFC is T1. The converter is a lossless transform, not a
knowledge generation step.

## 3. Default Tier by Path

When a frontmatter `tier` is missing, apply these defaults — in order:

1. Path under `specs/<feature>/` (requirements/design/tasks) → `tier: T2`, `source_class: human` (human-vetted spec)
2. Path under `data/intake/` → `tier: T2`, `source_class: specs`
3. Path under `data/corpus/` → `tier: inherits from source_file frontmatter` (fall back to T2 if source is `data/intake/`, else run inference); `source_class: fragment`
4. Path under `data/research/` (generated research, surveys, playbooks) → `tier: T4`, `source_class: llm`
5. Path under `memory/` (curated, progressive-disclosure; recognize `memory-bank/`, `.claude/memory/`; legacy `.agents/memory/`) → `tier: T3`, `source_class: llm_human` (T4 if raw/uncurated)
6. Project-root generated docs (surveys, discovery reports, playbooks) → `tier: T3`, `source_class: llm`
7. Path under `.cache/` (or legacy `.agents/cache/`, `.agents/scratch/`) → **below T4 — ephemeral/regenerable, never cite as evidence**
8. Anything else → run inference (§5)

## 4. Frontmatter Schema (additive)

A skill that creates or updates a markdown file MUST emit at least:

```yaml
---
tier: T3                       # T1 | T2 | T3 | T4  (fragments inherit source tier; generated = T3 default)
source_class: llm              # public | specs | fragment | llm | llm_human | human
version: "1.0"                 # bump on substantive content change
last_updated: 2026-04-29       # ISO date
description: <one-line>        # human-readable purpose
---
```

`source_class: llm_human` is the signal that an LLM-produced doc was read and corrected by a human.
Change `source_class: llm` → `source_class: llm_human` manually after review. Never set it automatically.
`source_class: human` is for documents primarily authored by a person (notes, transcripts, decisions).

**Additivity rule (NEVER violate):** If a file already has frontmatter
(any keys), the skill ADDS missing keys only. It does not replace or
reorder existing keys, and it does not change values the human or
another skill already set.

If the doc uses a domain-specific frontmatter format (e.g., spec-kit,
Jekyll/Hugo, JSON-LD), keep that format intact and append the tier
keys at the end of the frontmatter block.

## 5. Inference Algorithm — Missing Tier

When a local document has no `tier` and §3 default doesn't apply:

```text
1. git log --diff-filter=A -- <file>
   → first-add commit message + author + date
2. If commit message says "import", "ingest", "convert"
   → likely fragment; tier = T3, class = fragment
3. If file content has > 90% LLM-slop indicators
   (markdown bullets, em dashes, "It's important to note", "In summary",
    no concrete data, no source links)
   → likely AI-generated; downgrade by inferred model quality:
   - weak/old model output (verbose, generic, no sources) → T4
   - premium model output (concise, sourced, structured) → T3 (default for capable-model output)
4. Else if content is clearly human-authored
   (rough notes, typos, idiosyncratic voice, references to people/dates)
   → T2 by default; T1 only if it cites external authority
5. If still unclear → T4 (safe default; conservative for conflicts)
```

Tier inference is implicit — no flag is written. If you later review and
correct an inferred document, change `source_class: llm` →
`source_class: llm_human`. That is the signal. No secondary flag needed.

## 6. Conflict Resolution

When two sources disagree on a fact:

1. Compare `tier` — higher wins
2. If equal — compare `last_updated` — newer wins
3. If still tied — prefer `public` > `specs` > `fragment` > `reviewed` > `generated`
4. If still tied — surface the contradiction in the output; do not
   silently resolve

## 7. What This Policy Does NOT Cover

- Cross-vendor markdown frontmatter standard (none exists; this is a
  project + skill convention, not a standards-body schema)
- Per-claim provenance inside a document (use inline `(Source: …, T#)`
  citations for that)
- Automatic tier escalation — tiers only go up via human review

---

## 8. Directory Naming Conventions — Cross-Project Variants

The two-zone pipeline pattern (raw source → processed corpus) is
universal, but projects use many different directory names for each zone.
When working in an unfamiliar project, detect the actual names before
assuming canonical paths.

### Canonical layout (write here) + cross-tool recognize-map

Project standard. **Write** to the canonical path; **recognize** (read) the legacy and
other-tool equivalents when working in an existing project authored by another tool.

| Concept | Canonical (write) | Tier | Legacy (ours) | Other tools (recognize) |
|---|---|---|---|---|
| Instructions / steering | `AGENTS.md` (+ nested) | T2 | — | `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.github/copilot-instructions.md`, `.windsurfrules` |
| Skills | `.agents/skills/<n>/SKILL.md` | n/a | — | `.claude/skills/`, `.cursor/skills/` |
| Specs (per feature) | `specs/<feature>/{requirements,design,tasks}.md` | T2 | `.agents/spec/` | `.kiro/specs/`, Spec-Kit `specs/NNN-*`, OpenSpec `openspec/changes/` |
| Memory (curated) | `memory/` (INDEX + topic files) | T3 | `.agents/memory/` | `memory-bank/` (Cline/Roo/Kilo), `.claude/memory/`, `~/.claude/…/memory/`, `~/.codeium/windsurf/memories/` |
| Raw external docs | `data/intake/` | T2 | `.agents/intake/`, `__SPECS__/` | `sources/`, `raw/`, `data/raw/`, `data/external/` |
| Processed corpus | `data/corpus/` | T3 | `.agents/corpus/`, `__FRAGMENTS__/` | `fragments/`, `data/processed/`, `knowledge/`, `index/` |
| Generated research | `data/research/` | T4 | `.agents/research/` | loose `research/`, root playbooks |
| Path-scoped rules (monorepo only) | `.agents/rules/*.md` | n/a | — | `.cursor/rules/*.mdc`, `.claude/rules/`, `.windsurf`/`.devin/rules/` |
| Reusable scripts | `scripts/` | n/a (code) | — | `bin/` (often gitignored build output), `tools/` (monorepo tooling) |
| Ephemeral cache/scratch | `.cache/` (third-party tool cache; agents never author here) | below T4 | `.agents/cache/`, `.agents/scratch/` | `tmp/` |

Rule: **author once in the canonical path; read any recognized variant.** When a project
already uses another tool's layout, work with it in place — do not forcibly migrate unless asked.

### Zone 1 — Source / Intake layer (T2 by default)

Raw, externally-supplied materials.
Character: **not generated by this pipeline; read-only in practice;
typically gitignored when it contains symlinks or sensitive originals.**

| Directory name | Convention / origin |
|---|---|
| `data/intake/` | **Canonical** — `data/` is the conventional base (LlamaIndex, Cookiecutter Data Science); `intake` = raw zone |
| `data/raw/` | CCDS-strict name (DrivenData "original, immutable dump"); use `data/external/` for third-party sources |
| `sources/` | Generic data-engineering convention |
| `raw/` | Medallion Architecture (Databricks/Delta Lake) "Bronze" layer |
| `intake/` | Same as `data/intake/` but at project root |
| `documents/` | Document-heavy projects (avoid `docs/` — that is human/API docs) |
| `upstream/` | Data-mesh projects |
| `ingest/` or `ingestion/` | ETL-oriented naming |
| `.agents/intake/`, `.agents/external-refs/` | Legacy self-invented base (pre-2026-06-24) — still recognized |
| `__SPECS__/` | Very legacy — dunder names mangle in Markdown editors |

### Zone 2 — Corpus / Processed layer (T3 fragment by default)

Expensive-to-generate, pipeline-owned knowledge artifacts.
Character: **derived from Zone 1; committed to version control;
contains transcripts, markdown extractions, WEBP cadres, manifests.**

| Directory name | Convention / origin |
|---|---|
| `data/corpus/` | **Canonical** — `data/` base + `corpus` (NLP/RAG term for a curated document collection) |
| `data/processed/` | CCDS-strict name ("final, canonical data sets"); pairs with `data/raw/` |
| `corpus/` | NLP/AI standard term, at project root |
| `fragments/` | Original name in this pipeline (still used in index/manifest keys) |
| `knowledge/` | Semantic variant; found in knowledge-management tools |
| `artifacts/` | Build-system metaphor; found in CI/CD adjacent projects |
| `extracted/` | Process-oriented name |
| `derived/` | Data-engineering term (derived tables, derived features) |
| `enriched/` | Medallion Architecture "Silver" layer |
| `processed/` | Generic; pairs with `raw/` |
| `index/` | RAG pipeline focused projects (document index) |
| `.agents/corpus/`, `.agents/kb-cache/` | Legacy self-invented base (pre-2026-06-24) — still recognized |
| `__FRAGMENTS__/` | Very legacy — dunder names mangle in Markdown editors |

### Detection algorithm (use at session start)

```text
DETECT Zone 1 (source layer):
  1. check data/intake/ (or data/raw/, data/external/)  → canonical; use this
  2. check sources/ raw/ intake/ documents/ upstream/ ingest/  → project-root variant
  3. check .agents/intake/ .agents/external-refs/  → legacy self-invented base; still valid
  4. check __SPECS__/          → very legacy; warn and migrate
  5. if none found → ask user where source documents live

DETECT Zone 2 (corpus layer):
  1. check data/corpus/ (or data/processed/)  → canonical; use this
  2. check fragments/ corpus/ knowledge/ artifacts/ extracted/ processed/ index/  → root variant
  3. check .agents/corpus/ .agents/kb-cache/  → legacy self-invented base; still valid
  4. check __FRAGMENTS__/      → very legacy; warn and migrate
  5. if none found → run ingestion to create it, or ask user

QUICK CHECK command (bash):
  ls -d data/*/ 2>/dev/null; ls -d */ 2>/dev/null | grep -E 'intake|corpus|sources|raw|fragments|knowledge'
```

### Manifest and index files

Regardless of the Zone 2 directory name, look for:
- `INDEX.md` — canonical partner/document → fragment mapping
- `.manifest.json` — change-tracking manifest (SHA256 per source file)
- `_ALL_MEETING_NOTES_CONSOLIDATED.md` — merged meeting note corpus

These are created by `doc_converter.py` inside whatever Zone 2 directory
the project uses.
