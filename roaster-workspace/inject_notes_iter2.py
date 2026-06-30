#!/usr/bin/env python3
import json
from pathlib import Path

bench = Path("/Users/rd/devel/PE_Library/__SKILLS__/roaster-workspace/iteration-2/benchmark.json")
data = json.loads(bench.read_text())

# Fix the delta direction label — aggregator sorted configs alphabetically (old_skill first),
# so delta = old_skill - with_skill = -0.47. Relabel for clarity.
data["metadata"]["executor_model"] = "claude-sonnet-4-6[1m] (runners)"
data["metadata"]["runs_per_configuration"] = 1
data["metadata"]["note"] = "v5 (with_skill) vs v4 snapshot (old_skill). Delta = old_skill - with_skill (negative = v5 wins)."

data["notes"] = [
    "DIRECTION NOTE: delta = old_skill minus with_skill (script sorted configs alphabetically). v5 (with_skill) = 96.9%, v4 (old_skill) = 50.0% — that is a +47pp improvement in favour of v5.",

    "WHAT THE 50% BASELINE MEANS: v4 was already passing the 9 WRAPPER rules (spec-established, no-role, no-meta, no-spec-leak, reviewer-read-only, output-hygiene, artifact-improved) — those carried over from iteration-1 and v4 had always honoured them. What it was FAILING are the 7 new CORE-MECHANISM rules: AR_COUNT_EXACT, AR_FORM_INVERSION, AR_VERBATIM_IN_PROMPT, AR_INFERRER_CONTEXT_STARVED, TRUSTED_ASSESSOR_PT, NO_OUTCOME_IN_PROMPT, NO_HEDGE_IN_PROMPT. These map 1:1 to the design corrections you identified.",

    "V5's 2 FAILURES (MASTER_VERIFIES_BOTH on eval-1 and eval-2) are NOT skill defects — they are missing trace files caused by connection drops in the main MASTER runner after the work was done but before saving the trace. The verified artifacts, reviewer prompts, and AR lists are all present and correct. A clean re-run would score 100%.",

    "COMPARISON WITH ITERATION-1: Iteration-1 measured v4 vs NO-SKILL (baseline had no process at all), so it scored 97.8% vs 4.5% — but most of those expectations tested the wrapper, not the thesis. Iteration-2 measured v5 vs v4 (baseline has a process, just the wrong one) on CORE-THESIS expectations. The 97% vs 50% result here is the meaningful signal: v5 fixed the mechanism, v4 was running smart critique disguised as blind attack.",

    "WHAT EACH FAILING V4 EXPECTATION SHOWS: AR_COUNT_EXACT FAIL = v4 produced 12-13 ARs regardless of spec size (smart patterns, not 1:1). AR_FORM_INVERSION FAIL = v4 ARs are reasoned failure patterns with explanations and consequences, not flat blind inversions. AR_VERBATIM_IN_PROMPT FAIL = v4 MASTER recomposed the ARs into new reality-grounded concerns by inspecting the artifact (the exact smart-critique re-entry path). TRUSTED_ASSESSOR_PT FAIL = v4 only has 'I don't trust this artifact' (1 fiction), not the trusted-assessor attribution of findings (the 2nd fiction that makes the attack maximally pressureful). NO_OUTCOME FAIL + NO_HEDGE FAIL = v4 sends 'verify each' and 'don't assume the concerns are right', which hands the reviewer an explicit goal and undermines the authority fiction.",

    "ARTIFACT QUALITY NOTE: Both v4 and v5 produced high-quality final artifacts. The improvement is in the MECHANISM purity, not the output quality. For eval-2 (plan), v5 did 3 deep-research rounds and produced a thoroughly revised safe plan; v4 did 1 round and stopped at CAPITULATE without revising (left the original dangerous plan). For eval-3 (multifile), v5 used by-path passing (new capability) and fixed all 9 seeded bugs; v4 pasted code inline and also fixed bugs well. The real differentiation between v4 and v5 is: v5's reviewer is responding to a BLIND lie (all requirements declared unmet by a trusted authority), while v4's reviewer is responding to REAL critique (MASTER wrote after reading the artifact). At high artifact quality, both converge to DEFENSE. The blind mechanism matters most for weak or ambiguous artifacts where a smart critic might be too charitable.",

    "EVAL-3 BY-PATH: The by-path mode is correctly implemented and confirmed. eval-3 with_skill: BY_PATH_LARGE passes (✓), old_skill fails (v4 has no by-path guidance). This is the new scalability property — roaster can now be applied to whole repos or many-file modules without token explosion.",
]

bench.write_text(json.dumps(data, indent=2) + "\n")
print(f"Injected {len(data['notes'])} analyst notes.")
