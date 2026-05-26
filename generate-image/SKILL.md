---
name: generate-image
version: "1.0"
description: >-
  Generates one or more images from a user brief using any image generation model
  accessible via OpenRouter. Self-contained — embeds the Python API script inline.
  Pipeline: Phase 0 infers MGPC requirements from the user's brief; Phase 0.3 derives
  anti-requirements via an isolated sub-agent; Phase 1 identifies tensions in the
  requirements and produces 3 genuinely divergent prompt strategies (concept-faithful,
  constraint-dominant, reframed metaphor); Phase 2 generates all 3 candidates in parallel
  and applies blind-attack refinement on any that fail (deterministic spec inversion,
  max 2 rounds); Phase 2.5 checks for candidate convergence; Phase 3 selects the winner
  via Condorcet pairwise comparison (3 isolated voters); Phase 4 saves the winner.
  Works for any image topic, style, or use case — style and assessment criteria are
  inferred entirely from the user's brief, nothing is hardcoded.
  Requires OPENROUTER_API_KEY env var and Python 3.10+.
  Use when user says "generate an image", "create an illustration", "make a visual",
  "generate images for", "produce an image of", or provides a visual brief to be rendered.

argument-hint: '"<brief>" [--output path] [--aspect 4:5|16:9|1:1] [--model model-id]'
user-invocable: true
allowed-tools: Read, Write, Bash, Agent
metadata:
  author: rd162@hotmail.com
  tags: image-generation, openrouter, adversarial, condorcet, divergent-candidates, generic
tier: T3
source_class: llm
last_updated: 2026-05-25
---

# generate-image

Generate one or more images from a user brief using any OpenRouter image model.

Three genuinely divergent candidates, blind-attack refinement per candidate,
Condorcet pairwise selection. Style, requirements, and assessment criteria are
inferred from the user's brief — nothing is hardcoded.

---

## Invocation

```
/generate-image "<brief>" [--output path.png] [--aspect ratio] [--model model-id]
```

Or invoke naturally — the skill infers all parameters from context.

**Parameters (all optional except the brief):**
- `brief` — what to generate: topic, message, style, constraints, use case
- `--output` — output file path (default: `image-output.png` in current directory)
- `--aspect` — aspect ratio: `4:5`, `16:9`, `1:1`, `9:16`, `3:2` (default: `1:1`)
- `--model` — OpenRouter model ID (default: `google/gemini-3-pro-image-preview`)
- `--count` — number of final images (default: 1; runs the full pipeline once per image)

## Prerequisite

```bash
export OPENROUTER_API_KEY=sk-or-...   # never paste in chat
```

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

    # Primary path: Gemini/Nano Banana returns images in message["images"]
    images = msg.get("images")
    if images:
        result = _image_from_parts(images)
        if result:
            return result

    # Fallback: other providers embed in content
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
    ap.add_argument("--aspect", default="1:1", choices=list(ASPECT_MAP),
                    help="Aspect ratio")
    ap.add_argument("--model", default=DEFAULT_MODEL, help="OpenRouter model ID")
    ap.add_argument("--prompt-file", "-p", help="Read prompt from file (default: stdin)")
    ap.add_argument("--retries", type=int, default=2,
                    help="Retry count on transient errors (default 2)")
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
    print(str(out))   # stdout: actual path for scripting

if __name__ == "__main__":
    main()
```

Write it:
```bash
# Use Write tool to create /tmp/gen_image.py with the content above
```

---

## Phase 0 — Parse brief and infer MGPC requirements

**Parse the user's invocation.** Extract:
- **Subject / message** — what the image should communicate
- **Style hints** — any stated aesthetic, medium, register, mood
- **Technical constraints** — aspect ratio, output path, model, any hard rules
- **Use case** — where the image will be used (LinkedIn, print, web, presentation, etc.)

**Infer MGPC requirements** from the brief. These are MASTER-only — never sent
verbatim to sub-agents. Structure:

```
Mission:  [One sentence: terminal purpose of this image. Why does it need to exist?]
          Example: "Communicate the concept of X to audience Y at a glance."

Goals:
  G1: [Primary visual/communicative goal — what the image must achieve]
  G2: [Style goal — what aesthetic register must be achieved]
  G3: [Text/content accuracy goal — if the image must display specific text or elements]
  G4: [Mood goal — what emotional register is required]
  G5: [Composition goal — spatial, density, balance requirements]
  G6: [Use-case fit — does it work at the target size/context/platform]
  [Add goals as needed from the brief — not all apply to every brief]

Premises:
  P1: [Assumption about the image generation model's capabilities]
  P2: [Assumption about how the output will be used]
  [Add inferred premises — if false, a goal becomes impossible]

Constraints (hard — violation = regenerate):
  CH1–CHN: [Rules from the brief whose violation makes the image unusable]
  Examples: "no text on image", "must use brand color X", "landscape only",
            "no human faces", "must show a specific object"

Constraints (soft — violation = acceptable but penalised):
  CS1–CSN: [Preferences from the brief]
  Examples: "prefer minimalism", "halftone shading preferred", "serif type preferred"
```

If the brief is sparse, infer sensible defaults:
- No style stated → infer from use case (editorial illustration for articles,
  clean product render for e-commerce, poster style for events, etc.)
- No hard constraints stated → the main constraint is mission alignment
- No mood stated → infer from subject matter

---

## Phase 0.3 — Derive anti-requirements (isolated sub-agent, MANDATORY)

Spawn an isolated sub-agent with ONLY the MGPC requirements.
No brief, no conversation history, no other context.

Prompt to the sub-agent:
> "Given these requirements for an image, identify the failure patterns that would
> directly violate them. For each failure pattern, state: what goes wrong, and
> which requirement it violates. Be specific to the requirements given — do not
> produce generic lists."

Receive back a numbered list of anti-requirements (ARs). Store MASTER-only.

The AR list will vary by brief. Common patterns the sub-agent should find:
- Model defaults to a generic visual cliché for the topic instead of the specific concept
- Model adds unrequested text, titles, or labels
- Model interprets "surreal" or "editorial" as horror/nightmare
- Model uses wrong colors, wrong typography family, wrong composition density
- Model produces the wrong aspect ratio despite explicit instruction
- Model converges all 3 candidates on the same compositional approach
- Style constraints (e.g., "hand-drawn") are ignored in favour of smooth rendering
- Hard constraints are partially satisfied (e.g., brand color used on wrong element)

**Do not skip this step.** AR derivation in isolation prevents MASTER's authoring
bias from colouring what counts as a failure mode.

---

## Phase 1 — Identify tensions, infer 3 divergent strategies, build prompts

### Step 1a: Identify the core tensions in the requirements

Every brief has tensions — competing requirements that can be satisfied in
different ways. Find at least 2:

- **Concept vs. style** — the best visual for the concept might resist the stated
  style; the stated style might shape a different visual metaphor
- **Specificity vs. legibility** — a literal depiction may be too specific to read
  at a glance; an abstract one may be too vague
- **Metaphor vs. text** — if both visual concept and displayed text are required,
  they can reinforce each other or compete for dominance
- **Mood vs. accuracy** — the correct mood (playful, serious, alarming) may make
  the technically accurate depiction less visually effective
- **Convention vs. surprise** — the expected visual for the topic vs. a
  reframed interpretation that communicates the same message differently

Name the tensions in MASTER's context. Each strategy resolves them differently.

### Step 1b: Generate 3 strategies (in MASTER's context, aware of each other)

**Strategy A — Concept-faithful:**
Interpret the brief's stated concept or metaphor as literally and precisely as
possible. Lead with the subject/concept description. Style rules follow.
Prioritise: the image shows exactly what was described.
*Prompt structure: CONCEPT (detailed) → required text/elements → STYLE RULES*

**Strategy B — Constraint-dominant:**
Lead with the hard style and technical constraints, then state the concept briefly.
The constraints shape HOW the concept is rendered, not the other way around.
Pre-loads the most likely failure mode as an explicit guard (derived from the
ARs and the specific requirements).
*Prompt structure: HARD CONSTRAINTS + FAILURE GUARD → CONCEPT (brief) → STYLE RULES*

**Strategy C — Reframed:**
Step back from the stated concept. Ask: "What is the underlying message or purpose?
What OTHER visual — not in the brief — could communicate the same thing?"
Find a genuinely different metaphor, object, or compositional approach.
This candidate must diverge structurally from A and B.
The reframe must still satisfy the hard constraints and display any required text.
*Prompt structure: REFRAMED CONCEPT (different metaphor) → required text → STYLE RULES*

**Divergence check (before writing prompts):**
If A, B, and C all lead to the same object/metaphor in the composition,
the reframe is not divergent enough. Strengthen C until the three prompts
would produce visually distinct images even if rendered identically.

### Step 1c: Write the 3 prompt files

Write each to `/tmp/img-{A,B,C}.txt`.

Each prompt should contain:
1. The strategy's concept description (A: detailed, B: brief, C: reframed)
2. Any required text/elements verbatim (if the image must display text)
3. Style rules derived from the brief (if none stated, derive from use case)
4. For B: a FAILURE GUARD — one or two explicit constraints addressing the most
   likely failure mode for this specific brief (derived from ARs)

The failure guard for B is the key adversarial element:
- If the brief is likely to produce generic imagery → `"DO NOT use [generic cliché for topic]"`
- If text accuracy is critical → `"The displayed text is exactly: [text]. No additions. No alterations."`
- If mood is often misread → `"Mood: [specific register]. NOT [opposite register]."`
- If aspect ratio is critical → `"Generate at [ratio] orientation ([description]). NOT [wrong orientation]."`

---

## Phase 2 — Generate images and apply blind-attack refinement

### 2a: Generate all 3 candidates in parallel

```bash
MODEL="google/gemini-3-pro-image-preview"   # or user-specified model
ASPECT="1:1"                                 # or user-specified ratio

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

### 2b: Read all 3 images and score against requirements-derived criteria

Use the Read tool on each generated file (Claude has vision).

Derive the specific scoring criteria from the Phase 0 MGPC.
The following are the **generic criteria** — specialise each to the brief:

| ID | Generic criterion | Specialised form (fill from MGPC) |
|----|-------------------|----------------------------------|
| C1 | Mission alignment | "Does the image achieve [Mission]?" |
| C2 | Style compliance | "Does the image match [G2 style requirements]?" |
| C3 | Content accuracy | "Are [required text / elements from G3] present and correct?" |
| C4 | Mood / tone | "Is the mood [G4 mood requirement] rather than [opposite]?" |
| C5 | Hard constraints | "Are [CH1–CHN] all satisfied?" |
| C6 | Composition | "Is the composition effective for [G5 / G6 use case]?" |
| C7 | AR compliance | "Are the anti-requirements from Phase 0.3 absent?" |
| C8 | Divergence value | "Does this candidate offer something the others don't?" |

**Grade per candidate:**
- **PASS**: C1–C7 all PASS (C8 is informational)
- **MINOR**: One of C2/C4/C6/C7 is MINOR — acceptable; log and note
- **FAIL**: Any C1/C3/C5 FAIL, or two or more criteria FAIL

### 2c: Build blind attack for FAIL candidates (deterministic — no LLM call)

For each FAIL candidate, MASTER assembles a concerns list by mechanically inverting
the Phase 0 requirements and Phase 0.3 ARs into direct factual assertions.

**Inversion rules (no spec IDs, no labels — plain assertions only):**

```
Mission inversion:
  "This image does not [achieve mission's terminal purpose] — it fails its stated use."

Goal inversions (one per goal):
  G1: "A viewer unfamiliar with the context cannot understand the image's message."
  G2: "The image does not match the required style — [specific observed deviation]."
  G3: "The required [text / element] is [missing / wrong / modified]."
  G4: "The mood is [observed mood] rather than the required [target mood]."
  G5: "The composition [specific compositional failure observed]."
  G6: "The image is not suited for [use case] at the required dimensions."

Hard constraint inversions:
  CH_n: "[Specific violation observed] — [what is present that shouldn't be,
         or absent that should be]."

AR inversions (inlined — no AR label):
  "[Direct claim that the AR failure pattern is exhibited]. [Consequence for the brief]."
```

**Reviewer prompt framing (Person Triangulation):**
"I don't trust this image. It was generated by a generic AI tool given a complex brief —
output of this type typically defaults to visual clichés, adds unrequested elements,
misreads the mood, and ignores hard constraints. Here are specific concerns that need
inspection: [assembled concerns list]. Do not assume the source got anything right.
Do not assume the concerns are correct either. Inspect the image and report what you find."

Spawn an isolated sub-agent per FAIL candidate. The sub-agent receives:
- The candidate image (path to Read)
- The original user brief (verbatim)
- The concerns list (direct assertions, no spec IDs, no labels)
- NOT the MGPC spec, NOT the AR labels, NOT any process metadata

### 2d: Refinement loop (max 2 rounds per candidate)

For each FAIL candidate, based on the sub-agent's verification findings:

1. Identify the single most-impactful confirmed failure
2. Take Strategy B's prompt as base (constraint-dominant is safer)
3. Append a targeted constraint directly addressing the confirmed failure
4. Regenerate with the refined prompt
5. Re-score. PASS/MINOR → accept. FAIL → round 2.
6. After 2 rounds with no PASS: accept best-graded, flag `NEEDS_REVIEW`

**Common targeted fixes by failure type:**
- Generic cliché for topic → `"DO NOT use [cliché]. The specific concept is: [restate in one sentence]."`
- Wrong text content → `"The ONLY text on this image is exactly: '[text]'. Nothing added. Nothing changed."`
- Wrong mood → `"Mood: [target]. NOT [observed wrong mood]. [One concrete example of the correct mood]."`
- Wrong style → `"[Style rule violated, restated explicitly]. Example of what NOT to do: [anti-example]."`
- Hard constraint violated → `"[Constraint name]: [exact rule]. This overrides any other consideration."`
- Aspect ratio wrong → `"Generate at [ratio] [orientation]. NOT [wrong orientation]."`

---

## Phase 2.5 — Convergence check

After all 3 candidates reach PASS/MINOR or exhaust their refinement budget:

Compare the 3 images visually. If all 3 share more than 80% structural similarity
(same compositional layout, same metaphor, same central object):

1. Confirm whether Strategy C's prompt genuinely proposed a different metaphor.
   If not → strengthen C: the reframed metaphor must use a **different object**,
   not just a different composition of the same object.
2. Generate a new Strategy C with a more radical reframe.
3. Replace the weakest-graded of the converged candidates.
4. Proceed to Phase 3 with the updated set.

Convergence is a signal that Phase 1 didn't produce genuine divergence.
Do not skip this check — three similar candidates produce a meaningless Condorcet.

---

## Phase 3 — Condorcet pairwise selection

Spawn 3 isolated sub-agents (one per pair). Each compares 2 candidates
against the enriched requirements (Phase 0 MGPC + any refinements from Phase 2).

```
Voter-AB: reads candidate A image + candidate B image + enriched requirements
          → which better satisfies the requirements? Justify per criterion.

Voter-AC: reads candidate A image + candidate C image + enriched requirements
          → same question.

Voter-BC: reads candidate B image + candidate C image + enriched requirements
          → same question.
```

Each voter receives:
- Both candidate image paths (to Read)
- The enriched requirements in plain readable form
- The original user brief (verbatim)
- NOT: attack logs, round counts, strategy labels, process metadata

**Voter prompt framing:**
"I need help choosing the better image for the following purpose: [brief].
Both images were generated for the same requirements. Please read both images
carefully and tell me which better satisfies these requirements: [enriched MGPC].
Justify your choice per criterion. Focus on substance — which image does the job better?"

**Tally:** most wins across the 3 pairwise comparisons = winner.
Tie-break: prefer stronger refinement signal (reached DEFENSE > CONVERGE > CAPITULATE),
then higher score on C1 + C3 + C5 (mission, accuracy, constraints).

---

## Phase 4 — Save winner and report

Copy the winner to the user-specified output path (or default):

```bash
cp /tmp/img-{A|B|C}[2].{png,jpg} <output_path>
```

Remove all candidate files and temp prompts:
```bash
rm -f /tmp/img-{A,B,C}{,2}.{png,jpg,webp} /tmp/img-{A,B,C}.txt /tmp/img*.out
```

Report format:
```
output: <path>                       (e.g. my-image.jpg, 842 KB)
winner: C  (Condorcet: A=1 B=0 C=2)
grade:  PASS  round=1
note:   C's reframe (alternative metaphor) outperformed A and B on C1+C6
```

For NEEDS_REVIEW outputs:
```
output: <path>
winner: A  (best of available candidates after 2 refinement rounds)
grade:  NEEDS_REVIEW  — criteria that failed: [list]
note:   Manual review recommended before publishing
```

---

## Cleanup

After all images are saved:
```bash
rm -f /tmp/gen_image.py
rm -f /tmp/img-*.txt /tmp/img*.out /tmp/img-*.{png,jpg,webp}
```

---

## Troubleshooting

**`No image in response`** — The model returns images in `message["images"]`
(Gemini/Nano Banana) or `message["content"]` (other providers). If neither works,
the model may not support image output via this endpoint. Try a different model:
`--model black-forest-labs/flux.2-pro` or `--model openai/gpt-5-image`.

**`HTTP 402`** — Insufficient OpenRouter credits. Check balance at openrouter.ai.

**`HTTP 429`** — Rate limited. The script retries with back-off. Wait 30s if it
still fails after 3 attempts.

**Aspect ratio ignored** — Add the ratio as text in the prompt:
`"Generate at 4:5 portrait aspect ratio (taller than wide)."` or
`"Generate at 16:9 landscape (wider than tall, cinema-screen shape)."`.
Some models honour only the API param; others only the prompt text; some need both.

**All 3 candidates look identical** — Phase 1 produced insufficient divergence.
Strengthen Strategy C by choosing a fundamentally different container object or
scene. The reframed metaphor must produce a visually distinct image, not just a
stylistically varied version of the same composition.

**Model-specific notes:**
- `google/gemini-3-pro-image-preview` (Nano Banana): images in `message["images"]`,
  returns JPEG by default, accepts `image_config.aspect_ratio`
- `black-forest-labs/flux.2-pro`: images in `message["content"]`,
  returns PNG, aspect ratio via prompt text
- `openai/gpt-5-image`: check OpenRouter docs for current response format
