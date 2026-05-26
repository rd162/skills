---
name: generate-image
version: "2.0"
description: >-
  Generates one or more images from a user brief using any image generation model
  accessible via OpenRouter. Self-contained — embeds the Python API script inline.
  Pipeline: Phase 0 infers ONE shared MGPC requirements set; Phase 1 generates 3
  divergent prompts FROM those shared requirements; Phase 2 generates 3 images from
  the 3 prompts in parallel; Phase 3 runs an isolated quality-gate sub-agent per
  image (sees image + requirements, NEVER the prompt) producing PASS/MINOR/FAIL;
  Phase 4 refines FAIL candidates via prompt-blind sub-agent inspection; Phase 5
  runs isolated Condorcet pairwise voters (each sees two images + requirements,
  NEVER the prompts); Phase 6 saves the winner. The defining invariant: every
  assessment of an image is performed by a sub-agent that has the image and the
  shared requirements only — never the prompt that produced it.
  Requires OPENROUTER_API_KEY env var and Python 3.10+.
  Use when user says "generate an image", "create an illustration", "make a visual",
  "generate images for", "produce an image of", or provides a visual brief to be rendered.

argument-hint: '"<brief>" [--output path] [--aspect 4:5|16:9|1:1|4:3] [--model model-id]'
user-invocable: true
allowed-tools: Read, Write, Bash, Agent
metadata:
  author: rd162@hotmail.com
  tags: image-generation, openrouter, adversarial, condorcet, divergent-candidates, prompt-blind-assessment
tier: T3
source_class: llm
last_updated: 2026-05-26
---

# generate-image

Generate one or more images from a user brief using any OpenRouter image model.

**The defining invariant of this skill:** every assessment of a generated image
is performed by an isolated sub-agent that receives the image file and the
shared requirements set — never the prompt that produced the image.

Three genuinely divergent prompts from ONE shared requirements set. Quality gate
in isolation. Pairwise selection in isolation. Style, requirements, and
assessment criteria are inferred entirely from the brief — nothing is hardcoded.

---

## Invocation

```
/generate-image "<brief>" [--output path.png] [--aspect ratio] [--model model-id]
```

Or invoke naturally — the skill infers all parameters from context.

**Parameters (all optional except the brief):**
- `brief` — what to generate: topic, message, style, constraints, use case
- `--output` — output file path (default: `image-output.png` in current directory)
- `--aspect` — aspect ratio: `4:5`, `16:9`, `1:1`, `9:16`, `3:2`, `4:3` (default: `1:1`)
- `--model` — OpenRouter model ID (default: `google/gemini-3-pro-image-preview`)
- `--count` — number of final images (default: 1; runs the full pipeline once per image)

## Prerequisite

```bash
export OPENROUTER_API_KEY=sk-or-...   # never paste in chat
```

---

## Architectural invariant — READ THIS FIRST

The skill exists to prevent prompt-knowledge from contaminating image assessment.
A judge who has seen the prompt evaluates the image against their own intention
for the image, not against the brief's actual requirements. The result is that
prompts get optimised, not images.

This skill enforces the opposite:

```
   ┌─────────────────┐
   │  shared reqs    │ ────────────────────────────────────┐
   │  (Phase 0)      │                                     │
   └─────────────────┘                                     │
            │                                              │
            ▼                                              ▼
   ┌─────────────────┐    ┌──────────────┐    ┌─────────────────────┐
   │  3 divergent    │───▶│  3 images    │───▶│ assessment sub-agents│
   │  prompts        │    │              │    │  see: image + reqs   │
   │  (Phase 1)      │    │  (Phase 2)   │    │  do NOT see: prompts │
   │  (NEVER reused  │    │              │    │  (Phases 3, 4, 5)    │
   │  in assessment) │    │              │    └─────────────────────┘
   └─────────────────┘    └──────────────┘
```

**Hard rule:** Sub-agents in Phases 3, 4, and 5 receive image files and the
shared requirements ONLY. They do NOT receive:
- the prompt that generated the image
- the divergent-strategy label (A / B / C)
- any process metadata, round counts, or score history
- the other candidates' prompts

MASTER may inspect images informally for coordination (e.g., logging),
but MASTER never decides PASS/FAIL or selects the winner.

---

## Embedded Python script

Write this script to `/tmp/gen_image.py` ONCE before generating anything.
Reuse it across all candidates and all images in the session.

```python
#!/usr/bin/env python3
"""
gen_image.py — generate one image via any OpenRouter image model.

Usage:
    python3 /tmp/gen_image.py --output out.png --aspect 4:5 < prompt.txt
    python3 /tmp/gen_image.py --output out.png --aspect 16:9 --prompt-file p.txt
    python3 /tmp/gen_image.py --output out.png --model flux/flux-1.1-pro < prompt.txt

Environment:
    OPENROUTER_API_KEY  required

Stdout: actual saved file path (extension may differ from --output).
Stderr: progress and error messages.
Exit 0 = success, 1 = failure.
"""
import sys, os, json, base64, pathlib, argparse, time, urllib.request, urllib.error

DEFAULT_MODEL = "google/gemini-3-pro-image-preview"
ASPECT_MAP = {
    "4:5": "4:5", "5:4": "5:4", "16:9": "16:9", "9:16": "9:16",
    "1:1": "1:1", "3:2": "3:2", "2:3": "2:3", "4:3": "4:3", "3:4": "3:4",
    "1.91:1": "16:9",   # LinkedIn banner — closest supported
}

def _post(url, payload, headers, timeout=180):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()[:600]}") from e

def _image_from_parts(parts):
    for p in parts:
        if not isinstance(p, dict):
            continue
        if p.get("type") == "image_url":
            url = p.get("image_url", {}).get("url", "")
            if "," in url:
                hdr, b64 = url.split(",", 1)
                mime = hdr.split(":")[1].split(";")[0] if ":" in hdr else "image/jpeg"
                return base64.b64decode(b64), mime
        if p.get("type") == "image":
            return base64.b64decode(p["data"]), p.get("mime_type", "image/jpeg")
    return None

def generate(prompt, aspect="1:1", model=DEFAULT_MODEL):
    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set")
    mapped = ASPECT_MAP.get(aspect, aspect)
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "modalities": ["image"],
        "image_config": {"aspect_ratio": mapped},
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/anthropics/claude-code",
        "X-Title": "generate-image skill",
    }
    data = _post("https://openrouter.ai/api/v1/chat/completions", payload, headers)
    msg = data["choices"][0]["message"]

    images = msg.get("images")
    if images:
        result = _image_from_parts(images)
        if result:
            return result

    content = msg.get("content")
    if isinstance(content, list):
        result = _image_from_parts(content)
        if result:
            return result
    if isinstance(content, str) and content.startswith("data:image"):
        hdr, b64 = content.split(",", 1)
        return base64.b64decode(b64), hdr.split(":")[1].split(";")[0]

    raise ValueError(
        f"No image in response — images={type(images).__name__}, "
        f"content={type(content).__name__}, preview: {str(content)[:300]}"
    )

def main():
    ap = argparse.ArgumentParser(description="Generate image via OpenRouter")
    ap.add_argument("--output", "-o", required=True, help="Output file path")
    ap.add_argument("--aspect", default="1:1", choices=list(ASPECT_MAP), help="Aspect ratio")
    ap.add_argument("--model", default=DEFAULT_MODEL, help="OpenRouter model ID")
    ap.add_argument("--prompt-file", "-p", help="Read prompt from file (default: stdin)")
    ap.add_argument("--retries", type=int, default=2, help="Retry count on transient errors")
    args = ap.parse_args()

    prompt = (pathlib.Path(args.prompt_file).read_text(encoding="utf-8")
              if args.prompt_file else sys.stdin.read())
    if not prompt.strip():
        print("ERROR: empty prompt", file=sys.stderr)
        sys.exit(1)

    last_err = None
    for attempt in range(1, args.retries + 2):
        try:
            print(f"[{attempt}/{args.retries+1}] model={args.model} aspect={args.aspect}",
                  file=sys.stderr)
            img_bytes, mime = generate(prompt, args.aspect, args.model)
            last_err = None
            break
        except Exception as e:
            last_err = e
            print(f"  ERROR: {e}", file=sys.stderr)
            if attempt <= args.retries:
                wait = 6 * attempt
                print(f"  retry in {wait}s…", file=sys.stderr)
                time.sleep(wait)

    if last_err:
        print(f"FAILED after {args.retries + 1} attempts: {last_err}", file=sys.stderr)
        sys.exit(1)

    out = pathlib.Path(args.output)
    ext_map = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
    correct_ext = ext_map.get(mime, out.suffix)
    if out.suffix.lower() not in (".jpg", ".jpeg") and correct_ext == ".jpg":
        out = out.with_suffix(".jpg")

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(img_bytes)
    print(f"saved: {out}  ({len(img_bytes)//1024} KB, {mime})", file=sys.stderr)
    print(str(out))

if __name__ == "__main__":
    main()
```

Write it once per session:
```bash
# Use Write tool to create /tmp/gen_image.py with the content above
```

---

## Phase 0 — Infer ONE shared requirements set

This is the only place where requirements are inferred. All 3 candidates share
exactly the same requirements; divergence happens at the prompt level, not the
requirements level. The shared requirements are what every downstream sub-agent
will see (without ever seeing the prompts).

**Parse the user's invocation.** Extract:
- **Subject / message** — what the image should communicate
- **Style hints** — any stated aesthetic, medium, register, mood
- **Technical constraints** — aspect ratio, output path, model, any hard rules
- **Use case** — where the image will be used (academic journal, magazine,
  LinkedIn, print figure, presentation, etc.)

**Critical use-case classification (affects everything downstream):**

| Use case signal | Default register |
|-----------------|------------------|
| "academic", "journal", "paper", "technical figure" | **Technical diagram** — boxes, arrows, labels, structured. NOT metaphorical, NOT surrealist, NOT artistic. |
| "magazine article", "editorial", "blog post" | Editorial illustration — clean conceptual visuals, light metaphor acceptable |
| "LinkedIn", "social", "marketing" | Bolder conceptual visuals, metaphor encouraged |
| "poster", "ad", "campaign" | Strong visual hook, metaphor central |

If the brief mentions an academic / paper / journal / technical-figure context,
the requirements MUST forbid surrealist, abstract-art, metaphor-only outputs.
Academic readers expect labelled diagrams, not visual poetry.

**Infer MGPC requirements** from the brief. These are the shared spec that
every Phase 3/4/5 sub-agent will see. Structure:

```
Mission:  [One sentence: terminal purpose of this image. Why does it need to exist?]
          Example: "Communicate the four-step asymmetric modernization flow to readers
          of an academic engineering journal at a glance."

Goals:
  G1: [Primary visual/communicative goal — what the image must achieve]
  G2: [Style goal — what aesthetic register must be achieved]
  G3: [Text/content accuracy goal — labels, captions, displayed elements]
  G4: [Mood goal — what emotional register is required]
  G5: [Composition goal — spatial, density, balance requirements]
  G6: [Use-case fit — does it work at the target size/context/platform]
  [Add goals as needed from the brief]

Premises:
  P1: [Assumption about the image generation model's capabilities]
  P2: [Assumption about how the output will be used]

Constraints (hard — violation = regenerate):
  CH1–CHN: [Rules from the brief whose violation makes the image unusable]
  Examples: "no text on image" (for art briefs), "must use brand color X",
  "landscape only", "no human faces", "must be a labelled technical diagram"

Constraints (soft — violation = acceptable but penalised):
  CS1–CSN: [Preferences from the brief]
```

**Document this shared spec in MASTER's context, then write it to
`/tmp/img-requirements.txt`** — this file is what Phase 3/4/5 sub-agents
will read. Use plain prose, no spec IDs needed in the file (readability for
the voters matters more than ID tracking).

Example file content:
```
This image is for an academic engineering journal figure. The image must be
a clean technical diagram, not an artistic illustration. It must:
- Clearly show the four-step flow: source code → architecture documents → decisions → modernization specs
- Use deep navy #0A1F44 background, white text/lines, muted red #C0392B accents only
- Use clear labels on every box or node
- Be readable as a single-glance diagram in print at ~900px width
- Aspect ratio: 4:3 landscape

The image MUST NOT be:
- Surrealist, abstract, or metaphor-only
- A nature scene, prism refraction, or other artistic interpretation
- Photographic, 3D-rendered, or isometric
- A comparison showing a "rejected" alternative alongside the correct path
```

---

## Phase 1 — Generate 3 divergent prompts from the SHARED requirements

The three prompts diverge in HOW they realise the same shared requirements —
not in what they require. All three target the same Mission, same Goals, same
Constraints. They differ only in compositional / structural strategy.

### Identify the tensions in the requirements

Every brief has tensions. For each tension, the three prompts will resolve it
in three structurally different ways. Examples of tensions:

- **Layout direction** — horizontal flow vs. vertical stack vs. radial/centered
- **Labelling density** — minimal labels vs. comprehensive labels vs. label-free
  (only if requirements permit)
- **Visual emphasis** — equal-weight nodes vs. one node prominent vs. transformation
  step prominent
- **Spatial composition** — symmetric vs. left-heavy vs. right-heavy
- **Diagram convention** — boxes-and-arrows vs. swimlanes vs. Sankey/flow vs.
  matrix/grid (for technical diagrams) — pick from CONVENTIONS that match the
  use-case register

For academic/technical figures, prefer divergence across recognised diagram
conventions (boxes-and-arrows, swimlanes, Sankey, matrix, layered architecture
diagram). For editorial/magazine, divergence may include compositional metaphors
(provided the requirements allow it).

### Three prompts, same requirements

**Prompt A — Convention 1 (most canonical for the use case):**
The most expected, conventional rendering of the shared requirements. Lead
with the concept exactly as the requirements describe. No reinterpretation.
For academic figures: boxes-and-arrows. For editorial: clean editorial illustration.

**Prompt B — Convention 2 (different layout/composition):**
The same content, organised differently. Different orientation, different
emphasis, different visual hierarchy. Same conceptual elements, different
arrangement. Pre-loads a failure guard against the most likely defect.

**Prompt C — Convention 3 (different visual convention or richer presentation):**
A different recognised diagram convention OR a richer presentation of the
same content. For academic: if A is boxes-and-arrows, C might be a layered
architecture diagram. For editorial: a more detailed scene that adds context.
C must NOT reinterpret the concept metaphorically when the requirements forbid it.

**Divergence-without-deviation rule:**
All three prompts must produce images that pass the same Phase 3 quality gate.
Divergence is in HOW the requirements are visually realised — never in WHAT
is realised. If a strategy would require reinterpreting the concept beyond
what the requirements describe, that strategy is wrong for this brief.

Write the three prompts to `/tmp/img-A.txt`, `/tmp/img-B.txt`, `/tmp/img-C.txt`.

Each prompt should contain:
1. The shared concept (drawn from requirements, possibly with the strategy's
   compositional choice)
2. Any required labels, text, or specific elements verbatim
3. Style rules from the requirements (verbatim — do not paraphrase, do not
   reinterpret)
4. For Prompt B specifically: an explicit failure guard against the most
   likely defect, derived from common image-generation failure patterns
   relevant to this brief

---

## Phase 2 — Generate the 3 images in parallel

```bash
MODEL="google/gemini-3-pro-image-preview"   # or user-specified model
ASPECT="4:3"                                 # or from requirements / user

python3 /tmp/gen_image.py --output /tmp/img-A.png --aspect $ASPECT --model $MODEL \
    --prompt-file /tmp/img-A.txt > /tmp/imgA.out 2>&1 &
PID_A=$!

python3 /tmp/gen_image.py --output /tmp/img-B.png --aspect $ASPECT --model $MODEL \
    --prompt-file /tmp/img-B.txt > /tmp/imgB.out 2>&1 &
PID_B=$!

python3 /tmp/gen_image.py --output /tmp/img-C.png --aspect $ASPECT --model $MODEL \
    --prompt-file /tmp/img-C.txt > /tmp/imgC.out 2>&1 &
PID_C=$!

wait $PID_A; wait $PID_B; wait $PID_C
cat /tmp/imgA.out /tmp/imgB.out /tmp/imgC.out | grep -E "saved|FAILED|ERROR"
```

After the three images exist at `/tmp/img-A.png`, `/tmp/img-B.png`, `/tmp/img-C.png`,
the prompts are NEVER referenced again until cleanup. MASTER may look at the
images for coordination, but every formal assessment happens in sub-agents.

---

## Phase 3 — Quality gate (isolated sub-agent per image, prompt-blind)

Spawn 3 isolated sub-agents — one per image. Each sub-agent receives:
- The path to ONE image (to Read with vision)
- The path to `/tmp/img-requirements.txt` (the shared requirements)
- NOTHING ELSE — no prompt, no strategy label, no other candidates

**Sub-agent prompt template:**

> You are evaluating a single image against a set of requirements for an
> image-generation task. You have NOT seen the prompt that produced this
> image — only the image and the requirements matter.
>
> Read the image at `/tmp/img-X.png` using your vision capability.
> Read the requirements at `/tmp/img-requirements.txt`.
>
> For each requirement (Mission, every Goal, every Hard Constraint), report:
> - PASS — the requirement is fully satisfied
> - MINOR — the requirement is mostly satisfied, with a small acceptable defect
> - FAIL — the requirement is not satisfied
>
> Then give an overall verdict:
> - PASS if all requirements are PASS (MINOR allowed on style/composition goals only)
> - MINOR if one of G2/G4/G5/G6 is MINOR and everything else is PASS
> - FAIL if any of Mission/G1/G3/CH* is FAIL, OR if two or more requirements are FAIL
>
> Report findings as a structured list. Be specific about WHAT you see in
> the image that earns each grade — not what you assume the requirements
> wanted, but what is actually present or absent.

Three sub-agents run in parallel. Collect their verdicts:
- All PASS or PASS+MINOR → proceed to Phase 5 (no refinement needed)
- One or more FAIL → proceed to Phase 4 for that candidate only

---

## Phase 4 — Refinement (max 2 rounds per FAIL candidate, prompt-blind)

For each FAIL candidate, spawn a refinement-recommender sub-agent. This
sub-agent receives:
- The FAIL image
- The shared requirements
- The list of specific failures from Phase 3 (the sub-agent's own report)
- NOT the prompt that produced the image
- NOT the strategy label

**Refinement-recommender prompt template:**

> An image was produced that fails the following requirements:
> [list of FAIL findings from Phase 3, with what's wrong]
>
> Read the image at `/tmp/img-X.png` and the requirements at
> `/tmp/img-requirements.txt`.
>
> Describe — in image-generation prompt language — exactly what should be
> different in the regenerated image to fix these specific failures.
> Be concrete: "the central element should be a rectangle with the label
> 'Architecture Documents' instead of an abstract triangle shape" not
> "make it more like a diagram".
>
> Do NOT rewrite the entire prompt. Output ONLY the targeted corrections
> needed, in the form of explicit visual instructions.

MASTER then takes Prompt B (constraint-dominant) as the base, appends the
sub-agent's targeted corrections, and regenerates ONLY the FAIL candidate
with the corrected prompt. Re-run Phase 3 on the new image. If it still FAILs
after 2 rounds, accept the best-graded version and flag `NEEDS_REVIEW`.

---

## Phase 5 — Condorcet pairwise selection (isolated sub-agents, prompt-blind)

After all 3 candidates have reached PASS / MINOR (or exhausted refinement),
spawn 3 isolated sub-agents — one per pair: (A,B), (A,C), (B,C).

Each pairwise voter receives:
- The paths to the TWO images for this pair
- The path to `/tmp/img-requirements.txt` (shared requirements)
- NOT any prompt
- NOT any strategy label
- NOT any process history (Phase 3 verdicts, refinement rounds, etc.)
- NOT the third image (each voter sees only their assigned pair)

**Voter prompt template:**

> You are choosing the better of two images for an image-generation task.
> Both images were produced for the same shared requirements. You have NOT
> seen the prompts that produced either image — only the images and the
> requirements matter.
>
> Read both images:
> - Image 1: `/tmp/img-X.png`
> - Image 2: `/tmp/img-Y.png`
>
> Read the requirements at `/tmp/img-requirements.txt`.
>
> For each requirement (Mission, every Goal, every Hard Constraint), state
> which image better satisfies it (Image 1, Image 2, or tie).
>
> Then give an overall winner: Image 1 or Image 2.
>
> Justify the overall choice in 3–5 sentences, referencing specific visual
> properties of each image. Focus on substance: which image does the job
> better for the stated requirements?

Each voter outputs a winner. MASTER tallies the three pairwise outcomes:
- Image with the most wins across (A,B), (A,C), (B,C) → final winner
- Tie → prefer the candidate with the strongest Phase 3 verdict (PASS over MINOR)
- Tie after that → MASTER may inspect images directly and pick, noting this

---

## Phase 6 — Save winner and report

```bash
cp /tmp/img-{A|B|C}{,2}.{png,jpg} <output_path>
```

Cleanup:
```bash
rm -f /tmp/img-{A,B,C}{,2}.{png,jpg,webp} /tmp/img-{A,B,C}.txt /tmp/img*.out /tmp/img-requirements.txt
```

Report format:
```
output: <path>                       (e.g. my-image.jpg, 842 KB)
winner: A  (Condorcet: A=2, B=1, C=0)
grade:  PASS  (Phase 3 verdict)
note:   <one-line summary of why this image won — substance, not process>
```

For NEEDS_REVIEW outputs:
```
output: <path>
winner: A  (best after 2 refinement rounds; one or more requirements still FAIL)
grade:  NEEDS_REVIEW  — failed requirements: [list]
note:   Manual review recommended before publishing
```

---

## Cleanup (end of session)

```bash
rm -f /tmp/gen_image.py
rm -f /tmp/img-*.txt /tmp/img*.out /tmp/img-*.{png,jpg,webp}
```

---

## Troubleshooting

**`No image in response`** — The model returns images in `message["images"]`
(Gemini/Nano Banana) or `message["content"]` (other providers). If neither works,
try a different model: `--model black-forest-labs/flux.2-pro` or
`--model openai/gpt-5-image`.

**`HTTP 402`** — Insufficient OpenRouter credits. Check balance at openrouter.ai.

**`HTTP 429`** — Rate limited. The script retries with back-off. Wait 30s if it
still fails after 3 attempts.

**Aspect ratio ignored** — Add the ratio as text in the prompt:
`"Generate at 4:3 landscape (wider than tall)."`. Some models honour only the
API param; others only the prompt text; some need both.

**All 3 candidates look identical** — Phase 1 produced insufficient divergence
in compositional convention. Try again with three structurally distinct
conventions (e.g. for an architecture diagram: boxes-and-arrows, swimlane,
layered stack).

**Image is too abstract / surrealist for an academic figure** — The requirements
in Phase 0 did not classify the use case as academic. Re-do Phase 0 with the
academic register: forbid metaphors, require labelled diagrams, require all
nodes to be visually distinct rectangles or labelled containers.

**Model-specific notes:**
- `google/gemini-3-pro-image-preview` (Nano Banana): images in `message["images"]`,
  returns JPEG/PNG, accepts `image_config.aspect_ratio`. Good text-in-image accuracy.
- `black-forest-labs/flux.2-pro`: images in `message["content"]`, returns PNG,
  aspect ratio via prompt text. Strong photographic / illustrative output.
- `openai/gpt-5-image`: check OpenRouter docs for current response format.
