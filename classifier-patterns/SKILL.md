---
name: classifier-patterns
description: >
  The official TypeSafe patterns and cookbooks for composing Jev (System One) judgments with code, from codemode
  with models.classify: the three primitives (Choice, Score, Noul), the four documented patterns (speculative
  fan-out, confidence-gated routing, composite scoring, intent routing) and the cookbook recipes (re-ranking,
  line-by-line search, structure recovery, function calling, skill suggestion, entity alignment, RAG passage
  classification, citation checks, guardrails, SDE cascade, date extraction, pre-parsed value extraction,
  hierarchical classification, feature discovery, classification using confidence, self-consistency, parallel
  questions). Each entry names its docs page and states the steps as the docs state them. Use when a check is
  more than a single `classify` tool call: several judgments composed with code, many candidates, ranking,
  routing, or verification against evidence.
source: https://docs.typesafe.ai/llms.txt (pages fetched 2026-10-06; official skill ~/.agents/skills/typesafe-ai/SKILL.md)
---

# Classifier patterns: the official TypeSafe recipes

Only what the TypeSafe docs describe is in this skill. The docs are the source of truth and change: read the cited
page before building (append `.md` to a docs URL for Markdown). Every threshold below is an **example to evaluate**
on your own data, not a rule (official skill: "Treat cookbook thresholds and demo results as examples to evaluate,
not universal rules or permanent model limitations"). Base URL: `https://docs.typesafe.ai`.

Sketches are adaptations: the docs give Python (`client.system_one(state=..., questions=...)`); the sketches use
pi's `models.classify` in codemode. Adaptation notes (pi, not from the docs): the model is
`await models.getModelOfType("classifier", "openrouter", "~typesafe/jev-latest")`; a `noul` question is written
`{type: "bool", instructions, criteria: {true, false}}`; answers read `{choice, probabilities, confidence}`,
`{score, confidence}`, `{probability}`; `r.stopReason !== "stop"` means failure.

## Principles (official skill, "Design the judgments" and "Compose and verify")

- Code owns the workflow; the model supplies semantic judgment. Keep known rules, calculations, exact lookups and
  execution in code.
- Ask one narrow, coherent judgment per question. Question IDs are for code and are not sent to the model: put the
  complete meaning in `instructions`. Reference nested state with backticked paths such as `ticket.messages[0].text`.
- Ask independent questions over the same state together, including speculative ones; they run in parallel and
  cannot see one another. A second request is warranted when an earlier answer is needed to fetch evidence, build
  new state or determine the next options.
- Include a no-match outcome when nothing may fit. For source-value selection, check candidate coverage: the model
  cannot choose an omitted value.
- Typed output guarantees the interface, not truth. Choice/Score confidence summarizes distribution concentration,
  not workflow correctness or permission to act. A Noul near 0.5 means similar probability for yes and no, not
  medium intensity.
- Keep policy explicit and raw judgments reusable: changing a weight or filter need not rerun inference. An
  "any serious violation" rule needs separate conditions, not a weighted score.

## Primitives

Pages: `/primitives.md`, `/primitives/choice.md`, `/primitives/score.md`, `/primitives/noul.md`, `/confidence.md`.

| Primitive | Use | Returns |
| --- | --- | --- |
| Choice | one of a defined set; options need descriptions that separate them; add `other`/`none` when the list may not cover the input; at most 255 options | `choice`, `probabilities`, `confidence` |
| Score | degree along a spectrum; levels are an ordered list described in words, numbered from 0; each level judged on its own | `score` (can fall between levels), `legend`, `probabilities`, `confidence` |
| Noul | a clean yes/no where the probability is the signal; `criteria` optionally says what yes and no mean | `noul` (0 to 1); no separate confidence |

- Every answer is constrained to the options supplied; every answer is independent of the other questions.
- Confidence is computed from the answer's own probabilities. The docs' starting pattern is three ranges: high →
  act automatically, medium → proceed with caution (confirm, flag, gather more), low → do not act. "Where you draw
  those boundaries depends on the stakes"; thresholds scale with risk.

## Patterns (`/patterns.md`)

### Speculative fan-out: `/patterns/fan-out.md`
- **For:** cost and speed. Send many questions in one call, including speculative ones; code decides what is
  relevant afterwards. All questions evaluate in parallel.
- **Steps (support-ticket example):** (1) one request with a Choice `category` (bug_report, billing,
  feature_request, account), a Score `bug_severity`, Nouls `has_reproducible_steps` and `refund_requested`, a Score
  `frustration`; (2) code routes: bug_report uses severity and repro answers, billing uses the refund answer,
  frustration is read whatever the category. Irrelevant answers are ignored.
- **Example thresholds (docs, to evaluate):** severity > 1.5 and repro > 0.6 escalate; refund > 0.7 flags billing;
  frustration > 1.5 flags priority response.

```js
// adaptation of the docs' triage example
const r = await models.classify(jev, { state: ticket, questions: {
  category: { type: "choice", instructions: "Determine the broad category of this support ticket", criteria: { bug_report: "...", billing: "...", feature_request: "...", account: "..." } },
  bug_severity: { type: "score", instructions: "How severe is the reported issue", criteria: ["Cosmetic; no impact", "Broken or degraded; workaround exists", "Blocking; no workaround"] },
  refund_requested: { type: "bool", instructions: "The user is explicitly asking for a refund or credit", criteria: { true: "...", false: "..." } },
} });
// code then reads only the answers relevant to r.answers.category.choice
```

### Confidence-gated routing: `/patterns/confidence-routing.md`
- **For:** reliability and safety. Confidence is a second axis: the answer says what, confidence says whether to act.
- **Steps (voice-banking example):** (1) a Choice `intent` (check_balance, approve_transfer, other); (2) gate in
  code: a floor catches genuine uncertainty, then each action has its own threshold by consequence.
- **Example thresholds (docs):** floor 0.6; checking a balance at 0.6 is fine; approving a transfer needs > 0.85,
  otherwise ask the user to confirm.

### Composite scoring: `/patterns/composite-scoring.md`
- **For:** ranking items on several criteria at once. Break the judgment into independent dimensions, score each
  separately, combine with weights you control in code.
- **Steps (resume-screening example):** (1) one Score per dimension (`python_depth`, `team_leadership`,
  `system_design`, `generalist`), each with five described levels; (2) each dimension normalized to 0–1, weighted in
  code; rank by the composite. Weights are adjustable (docs show different weight sets per role) and the individual
  scores stay visible.

```js
// adaptation: score dimensions once per item, then weights are plain code
const r = await models.classify(jev, { state: { resume }, questions: dims });  // dims: {name: {type:"score", ...}}
const composite = Object.entries(W).reduce((s, [d, w]) => s + w * r.answers[d].score / (dims[d].criteria.length - 1), 0);
```

### Intent routing: `/patterns/intent-routing.md`
- **For:** cost and speed. Classify first, route each request to the cheapest adequate handler: deterministic
  logic, a specialist LLM, or a human.
- **Steps (customer-service example):** (1) one request with a Choice `intent` (order_status, product_question,
  return_exchange, complaint) and a Score `complexity` (simple lookup, some judgment, edge case); (2) code routes:
  one intent to deterministic code, two to different specialist LLMs, one uses complexity to choose LLM or human,
  with an additional confidence check on the complexity score.

## Cookbooks, "Find and judge evidence"

### Re-ranking: `/cookbooks/rerank_typesafe.md`
- **For:** finding the one document that answers a query. Two steps: fast search (BM25, embeddings, any method)
  cuts the pile to a shortlist; re-ranking compares the query to each candidate individually and sorts by that
  score. Re-ranking only ever sees the shortlist.
- **Steps:** (1) fast search builds the shortlist (30 per query in the cookbook); (2) one **Noul** per
  query–candidate pair, state `{query, candidate}`, the same question and criteria for every candidate (example:
  "Could this candidate passage be from the cited precedent?", true = states the specific rule the query cites,
  false = only a similar topic); (3) sort by the noul, highest first. One request per candidate; no request sees
  another.
- **Docs result (example):** top-1 accuracy 5% → 18%, top-10 38% → 62% on 40 CLERC queries.

```js
const scored = await Promise.all(shortlist.map(async (c) => {
  const r = await models.classify(jev, { state: { query, candidate: c }, questions: { match: { type: "bool", instructions, criteria } } });
  return { c, p: r.answers.match.probability };
}));
scored.sort((a, b) => b.p - a.p);
```

### Line-by-line search: `/cookbooks/semantic_find.md`
- **For:** the lines of a document that answer a plain-language query, plus detecting when the document has no
  answer.
- **Steps:** (1) tag each line with an id (`L014| text`); the ids are ordinary text the model reads; (2) one
  **Choice** over the line ids ranks lines by how well they answer the query; (3) in the same request one **Noul**
  `exists` ("Does any line of the document address or answer: <query>?") checks whether an answer exists at all,
  because Choice probabilities sum to 1 so some line ranks first even when none answers; (4) code ranks lines and
  applies `exists` thresholds (missing / partial / answered).
- **Limit:** a Choice takes up to 255 options, so one request covers documents up to 255 lines; past that, search
  in two passes (one Choice picks a window, a second ranks lines inside it).

### Hierarchical classification: `/cookbooks/hierarchical_classification.md`
- **For:** reaching the correct leaf of a hierarchy (taxonomies, filesystems, codebases, ontologies, skills,
  policies). Cookbook hierarchies: CPC patents, Shopify categories, MeSH, the CookSafe file tree.
- **Steps:** every node is a **Choice** over its direct children (option keys `c0..cN` mapped to child labels); the
  probability distribution is the edges. **Greedy search:** take the top child at each node (one early mistake is
  unrecoverable). **Beam search:** keep the best `K` paths, classify every frontier in parallel, prune by
  `path_score = product(edge_probabilities) ** (1 / decisions)` (geometric mean, so shallow and deep leaves compare
  fairly); the leaf of the best path is the answer. `separation = top_path_score / second_path_score` is a useful
  ambiguity metric, not used for pruning (near 1× ambiguous). Docs note: `exp(mean(log(p)))` avoids precision errors
  past ~10 layers.
- **Stated benefits:** observability (which nodes misclassify), testability (unit-test hierarchy changes).

### Classifying RAG passages: `/cookbooks/classifying_rag_passages.md`
- **For:** a second stage between retrieval and generation. One request per retrieved passage carrying four
  **Nouls** about the query–passage pair: relevant, states something usable in an answer, contradicts something the
  query takes for granted, instructs the model. Code routes: evidence, conflicting information (separate block),
  or drop.
- **Example thresholds (docs):** injection_max 0.70, contradicts_min 0.70, relevant_min 0.45, evidence_min 0.55;
  first match wins.

## Cookbooks, "Select instead of generate" and "Turn judgments into reusable data"

### Pre-parsed value extraction: `/cookbooks/pre_parsed_value_extraction_cookbook.md`
- **For:** a verbatim value (email, phone, amount) the model cannot invent or mistype.
- **Steps:** (1) a regex finds candidate spans, tuned to over-find; (2) a **Choice** whose options are the spans
  (plus `none`) picks the one the question asks for, and companion Choices/Nouls read attributes (currency,
  country, credit vs charge); (3) code copies the pick and normalizes it.
- **Limits:** at most 255 options (narrow in two stages: section first, then span); finding candidates is the work:
  a name has no regex, so candidates come from a roster, an NER or an LLM that proposes them.

### Structure recovery: `/cookbooks/autoformat.md`
- **For:** rebuilding Markdown structure from text that lost it, without a model rewriting words.
- **Steps (two requests):** pass 1, one **Noul** per adjacent line pair ("does this line pick up mid-sentence?"),
  all in one request, merge continuing lines into blocks; pass 2, one **Choice** per block (heading, paragraph,
  list item, quote, code, callout) plus companion questions asked up front (heading level, step order, callout
  kind) whose answers are read only when the block type makes them relevant. Blank lines and explicit markers are
  read in code, never sent to the model. Code renders.
- **Example thresholds (docs):** merge at ≥ 0.2 after a dangling line, ≥ 0.5 after terminal punctuation; numbered
  list when the mean step probability ≥ 0.5.

### Autoresearch feature discovery: `/cookbooks/autoresearch_feature_discovery.md`
- **For:** turning free text into numeric features for a supervised model. An LLM proposes questions, TypeSafe
  answers them per row, CatBoost trains on the answers (a Score answer becomes two columns: expected level and
  spread; a Noul one column); CatBoost's used-feature and error report feeds the next proposal round.
- **Docs result (example):** 38 questions after five rounds, held-out RMSE 1.77 vs 1.87 from one proposal call.
  Needs labeled data, a proposer LLM and a trainer.

## Cookbooks, "Route and fill known arguments"

### Function calling: `/cookbooks/function_calling.md`
- **For:** natural language into calls to ordinary typed functions.
- **Steps:** closed-set arguments (`Literal`, `list[Literal]`, `bool`) get **Choice** questions over exactly those
  values; open arguments (int, free text, dates) get no question and keep defaults. A spec holds a question per
  argument, a line per option, a description per function, and one Choice picking the function. `stated` is a
  second yes/no question per argument; when no, the argument is omitted and the default applies. Set arguments ask
  once per member (`{}` = member name). Each command is one request carrying the function choice and every
  function's argument questions; only the chosen function's answers are read.
- **Docs guidance:** write questions about the idea, not the likely words; spell out roles when two arguments draw
  from the same set; call confidence = the **least** certain judgement behind the call, not the product.

### Skill suggestion: `/cookbooks/skill_suggestion.md`
- **For:** picking at most one skill for an agent turn out of a large roster, instead of loading truncated
  descriptions.
- **Steps (two requests):** (1) one **Choice** over every skill (one line each) plus **Nouls** "does the turn need a
  skill at all" (act on their stuff, follow written steps, just talk); gate on the mean of the three nouls; (2)
  re-read the top three with full description and the opening of each skill: a **Choice** `which` plus one Noul per
  candidate `fits::{name}`, free to reject all. Suggest the winner as one extra line.
- **Example thresholds (docs):** gate 0.30; fits 0.30. Docs result: wrong loads 16.8% → 7.3%.

## Cookbooks, "Verify and escalate"

### Double-checking citations: `/cookbooks/citation_check.md`
- **For:** catching wrong or hallucinated citations against a source.
- **Steps:** (1) code finds each quote in the source after normalizing whitespace and curly quotes; not found →
  `fabricated`, no model needed; a match also yields the section; a citation with no quote goes straight to step 2
  with its named section; (2) one **Choice** per surviving citation, "How does the section relate to the claim?":
  `supports` → verified, `contradicts` → contradicted, `says_nothing` → unsupported; (3) confidence ≥ 0.8 stands,
  below it a human confirms. "Start high, and lower the threshold as you see how the model does on your own
  documents."
- **Limits (docs):** exact match after normalization: a truncated or reworded quote reads as fabricated (fuzzy
  matching needed for that); the section splitter is written for one document layout.

### SDE cascade: `/cookbooks/sde_cascade.md`
- **For:** structured data extraction at most of a big model's quality for a fraction of the cost.
- **Steps:** (1) extract with a cheap model; (2) verify with per-field **Nouls** framed so `true` = something is
  wrong (does the value mismatch the field description, violate the type, is it unreasonable, hallucinated, pulled
  from off-target text, incomplete, a format violation; empty fields get only an "absence wrong" head); (3)
  escalate to the reasoning model if any per-field P(wrong) exceeds the threshold, else keep the cheap answer. A
  holistic whole-record head is shown but not used in the gate. Decomposition is "the TypeSafe way".
- **Example threshold (docs):** escalate at 0.7. Needs extractor and reasoning LLMs (not callable from codemode).

### Guardrails for LLMs: `/cookbooks/llm_guardrails.md`
- **For:** screening messages into and out of an LLM app with one request.
- **Steps:** a battery of **Nouls** (jailbreak, broke_policy, harmful_request, medical_advice, self_harm) plus a
  **Score** for harm severity; code applies two thresholds per Noul: ≥ action threshold triggers the configured
  action (block, review, support), ≥ review threshold goes to a human, below both passes; severity above its own
  threshold turns review into block; precedence support > block > review > pass. A policy is those numbers under a
  name.
- **Example thresholds (docs):** strict review 0.35 / action 0.70; permissive action 0.85; severity_block 2.0.

### Knowledge graph entity alignment: `/cookbooks/entity_alignment.md`
- **For:** deciding whether two entities are the same, with a third outcome for a human.
- **Steps:** one **Score** with a level per outcome (different product, related but possibly not the same, same
  product) so no fitted numeric threshold is needed; companion **Nouls** per field ride in the same request and
  tell the curator which fields disagree. Docs reason: a Noul would need thresholding, a Choice loses the order of
  the three outcomes.

### Date extraction: `/cookbooks/date_extraction_cookbook.md`
- **For:** absolute and relative dates. One call of **Choice** questions reads the parts the text names (kind,
  month, day, year, weekday); code assembles the date and does the calendar math; the date's confidence is the
  lowest confidence among the parts used; below the gate it goes to review.
- **Example threshold (docs):** review below 0.60.

### Classification using confidence: `/cookbooks/classification_using_confidence.md`
- **For:** telling hard cases from easy ones with no extra call. One **Choice** per document (75 industry groups);
  read the answer's own confidence; when unsure report the broader parent label the hierarchy already provides.
- **Docs result (example):** cutoff 0.9 splits 60 filings in half: the confident half 90% right, the other 40%;
  reported one level up that 40% becomes 70%.

## Cookbooks, "Self-consistency" and "Batching"

### Self-consistency: nouls: `/cookbooks/consistency_noul_cookbook.md`; choices: `/cookbooks/consistency_choice_cookbook.md`
- **For:** checking whether answers hold still across repeats, and routing uncertain ones to a human. Both run a
  rubric 15 times per condition and compare models. They add an explicit `uncertain` outcome: for nouls,
  probabilities from `0.30` through `0.70` become `uncertain` (example band), keeping the underlying values
  visible; for choices, a label whose top probability is below `0.60` becomes `uncertain` (example) and label agreement
  is compared with the share of automatic actions. The docs report that picked labels can flip inside a single condition,
  TypeSafe included.

### Parallel questions: `/cookbooks/parallel_questions.md`
- **For:** the case for batching. Each question is scored on its own against the document, so answers are the same
  batched or alone; batching pays for the document once. Docs result (13 questions over a 54,000-character
  article): 12.2× cheaper, 10.0× faster, no change in answers.
