#!/usr/bin/env python3
"""
Video Analyzer Script (Gemini native video understanding via OpenRouter)
==========================================================================
Sends a local video file directly to a video-capable multimodal model
(default: google/gemini-3.5-flash) through the OpenRouter API and returns
the model's answer to a text prompt about the video.

Unlike scripts/doc_converter.py's default cadre-extraction step (PySceneDetect
scene-change images, analyzed separately from the transcript), this script
gives the model the actual video — frames AND audio, temporally correlated —
in a single pass, and can ask the model itself to pick out the frames worth
keeping as images ("smart cadres") instead of mechanically firing on every
pixel change.

Three modes, all in this one script:

1. **Single-pass analysis** (`analyze_video`) — one video, one prompt, one
   response. Use for short-to-medium videos and targeted questions.
2. **Smart cadre extraction** (`--smart-cadres`) — asks the model to name the
   N most visually important moments (timestamp + why it matters), then uses
   ffmpeg to extract exactly those frames as images. Produces far fewer,
   far higher-value images than PySceneDetect's mechanical scene-change
   detection, which fires on any pixel change (cursor moves, animations)
   and can produce hundreds of near-duplicate, low-value frames for a single
   recording.
3. **Chaptered multi-turn analysis** (`--chapter-minutes`) — for long videos
   that would otherwise exceed practical size/context limits in one call.
   Splits the video into N-minute chapters via ffmpeg, then runs a genuine
   multi-turn OpenRouter conversation: each chapter is sent as a new user
   message in the SAME conversation, so the model can build on what it
   already learned from earlier chapters. Chapter-relative timestamps
   (including smart cadre timestamps) are converted to global video time
   before frames are extracted from the ORIGINAL uncut file.

Recommended for: screen recordings / meeting videos where the existing
pipeline's cadre-sampling analysis is ambiguous, inconclusive, or a
sub-agent hits context-size limits trying to sample too many frames; and
for videos that have accumulated large numbers of low-value PySceneDetect
cadres that should be replaced with a smaller, curated set.

Usage:
    export OPENROUTER_API_KEY=sk-or-...

    # Ask a free-form question about a video:
    scripts/.venv/bin/python scripts/video_analyzer.py \\
        "data/intake/.../My Video.mp4" "What does this video show?"

    # Use a prompt from a file (for long, detailed instructions):
    scripts/.venv/bin/python scripts/video_analyzer.py video.mp4 --prompt-file prompt.txt

    # Save the response instead of printing to stdout:
    scripts/.venv/bin/python scripts/video_analyzer.py video.mp4 "Summarize this" \\
        --output data/corpus/My Video/markdown/gemini_analysis.md

    # Extract smart cadres (up to 15) as images instead of/alongside a description:
    scripts/.venv/bin/python scripts/video_analyzer.py video.mp4 \\
        --smart-cadres 15 --images-dir "data/corpus/My Video/images" \\
        --output "data/corpus/My Video/markdown/gemini_analysis.md"

    # Long video: chapter into 10-minute segments, multi-turn conversation,
    # smart cadres extracted with correct global timestamps:
    scripts/.venv/bin/python scripts/video_analyzer.py video.mp4 \\
        --chapter-minutes 10 --smart-cadres 20 \\
        --images-dir "data/corpus/My Video/images" \\
        --output "data/corpus/My Video/markdown/gemini_analysis.md"

    # Replace an existing video fragment's old PySceneDetect cadres with the
    # newly extracted smart cadres (deletes cadre_*.jpg in --images-dir first).
    # --overwrite is required here since gemini_analysis.md already exists —
    # this is a deliberate approach replacement, not a routine re-run:
    scripts/.venv/bin/python scripts/video_analyzer.py video.mp4 \\
        --smart-cadres 15 --images-dir "data/corpus/My Video/images" \\
        --replace-cadres --overwrite \\
        --output "data/corpus/My Video/markdown/gemini_analysis.md"

    # A NEW targeted question about a video that already has an analysis file—
    # use a topic-qualified name instead of --overwrite (the script refuses
    # the bare name if it already exists, precisely to nudge toward this):
    scripts/.venv/bin/python scripts/video_analyzer.py video.mp4 \\
        "Does the config screen show field X? Quote any relevant on-screen text verbatim." \\
        --output "data/corpus/My Video/markdown/gemini_analysis_field-x-check.md"

    # Use a different OpenRouter video-capable model:
    scripts/.venv/bin/python scripts/video_analyzer.py video.mp4 "..." \\
        --model google/gemini-3-pro-preview

Supported video formats (per OpenRouter): .mp4, .mpeg, .mpg, .mov, .webm

Requirements:
    pip install requests
    OPENROUTER_API_KEY environment variable (https://openrouter.ai/keys)
    ffmpeg + ffprobe on PATH (for --smart-cadres and --chapter-minutes)

Notes:
- Local files are sent as base64 data URLs (OpenRouter/Gemini only accept
  plain video URLs for YouTube links, not arbitrary hosted files).
- OpenRouter does not publish a universal hard size limit for inline base64
  video; this script warns above SIZE_WARNING_MB and refuses above
  SIZE_HARD_CAP_MB as a practical safety guardrail. If a large file is
  rejected by the API, compress/trim it first (e.g. with ffmpeg) rather
  than raising the hard cap.
- Empirically confirmed 2026-07-02: a 90MB file (~120MB base64 payload) hit a
  Cloudflare 502 Bad Gateway in front of OpenRouter's API — this is an
  infrastructure/proxy limit, not a documented model limit, and it is BELOW
  the original 100MB hard cap this script used. SIZE_HARD_CAP_MB was lowered
  to 60 as a result, so failures are caught locally with a clear message
  instead of a confusing remote 502. Compressing a 90MB/720p recording to
  9.8MB/480p (`ffmpeg -vf scale=-2:480 -c:v libx264 -crf 30 -c:a aac -b:a 96k`)
  still preserved exact on-screen text for Gemini to read — prefer this over
  raising the cap again.
- Smart cadre timestamps are the model's own estimate from watching the
  video, not a frame-exact seek — ffmpeg's fast keyframe-based `-ss` (before
  `-i`) is used, which is more than precise enough for that purpose.
- Never commit an API key. Set OPENROUTER_API_KEY in your shell profile or
  a gitignored .env file — never hardcode it in this script or any tracked file.
"""

import argparse
import base64
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "google/gemini-3.5-flash"
DEFAULT_PROMPT = (
    "Describe in detail what happens in this video, including any on-screen "
    "text, UI elements, application/window names, and spoken content. "
    "Be specific and factual — note timestamps for key moments if possible."
)

SUPPORTED_MIME_TYPES = {
    ".mp4": "video/mp4",
    ".mpeg": "video/mpeg",
    ".mpg": "video/mpeg",
    ".mov": "video/mov",
    ".webm": "video/webm",
}

# OpenRouter's docs do not publish a universal size limit for base64 video —
# these are practical, conservative guardrails, not documented API limits.
# SIZE_HARD_CAP_MB was lowered from 100 to 60 on 2026-07-02 after a 90MB file
# empirically failed with a Cloudflare 502 in front of OpenRouter (see module
# docstring "Notes" above) — 60 leaves comfortable headroom below that.
SIZE_WARNING_MB = 20
SIZE_HARD_CAP_MB = 60

# Long videos default to this many minutes per chapter when --chapter-minutes
# is used without an explicit value. Small enough to comfortably clear the
# compression pipeline every time; large enough to keep the number of API
# calls (and conversation turns) reasonable for a typical 30-90 min recording.
DEFAULT_CHAPTER_MINUTES = 10

# Videos longer than this (in minutes) get a warning if chaptering wasn't
# requested — not a hard requirement, since a single long call may still
# work, but the model's attention to later content tends to degrade and the
# base64 payload grows large. Purely advisory.
LONG_VIDEO_WARNING_MINUTES = 20

SMART_CADRE_INSTRUCTION = """
In addition to the above, identify the most visually important moments in this video — \
screens that show meaningful content such as: a key result, an error message, a completed \
configuration, a data table, a diagram, code, or any other moment a viewer would want to see \
as a still image rather than just read a description of. Select between {min_n} and {max_n} \
moments depending on how content-dense the video is — fewer for simple/repetitive content, \
more for content-rich technical walkthroughs. Do not pick moments that are visually redundant \
with each other (e.g. two timestamps a few seconds apart showing the same static screen) — \
prefer diverse, distinct moments across the video's timeline.

Output these moments as a fenced JSON block, using this EXACT format, at the END of your \
response, after any other text:

```json
{{"key_moments": [{{"timestamp": "MM:SS", "reason": "short 5-15 word description of what makes \
this moment worth capturing"}}, ...]}}
```

Use "MM:SS" or "HH:MM:SS" format for each timestamp, matching where in THIS video clip the \
moment occurs. Include the JSON block exactly once, even if you found zero suitable moments \
(in that case use an empty array).
"""


def encode_video_to_data_url(video_path: Path) -> str:
    """Read a local video file and return a base64 `data:` URL for the OpenRouter API."""
    suffix = video_path.suffix.lower()
    mime_type = SUPPORTED_MIME_TYPES.get(suffix)
    if not mime_type:
        raise ValueError(
            f"Unsupported video extension '{suffix}'. Supported: "
            f"{', '.join(sorted(SUPPORTED_MIME_TYPES))}"
        )

    size_mb = video_path.stat().st_size / (1024 * 1024)
    if size_mb > SIZE_HARD_CAP_MB:
        raise ValueError(
            f"Video is {size_mb:.1f} MB, exceeding the {SIZE_HARD_CAP_MB} MB safety cap "
            f"for base64 inlining. Compress or trim the video first (e.g. with ffmpeg: "
            f"`ffmpeg -i input.mp4 -vf scale=-2:720 -crf 28 output.mp4`)."
        )
    if size_mb > SIZE_WARNING_MB:
        logger.warning(
            f"Video is {size_mb:.1f} MB — base64 inlining may be slow or hit provider "
            f"limits. If the request fails, compress/trim with ffmpeg and retry."
        )

    logger.info(f"Encoding {video_path.name} ({size_mb:.1f} MB) as base64...")
    with open(video_path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def analyze_video(
    video_path: Path,
    prompt: str,
    model: str = DEFAULT_MODEL,
    api_key: Optional[str] = None,
    timeout: int = 300,
) -> str:
    """Send a local video + text prompt to an OpenRouter video-capable model.

    Returns the model's text response. Raises RuntimeError on API/auth errors.
    Single-turn convenience wrapper around analyze_video_turn() for callers
    that don't need conversation history (the common case).
    """
    content, _history = analyze_video_turn(
        video_path, prompt, model=model, api_key=api_key, timeout=timeout
    )
    return content


def analyze_video_turn(
    video_path: Optional[Path],
    prompt: str,
    model: str = DEFAULT_MODEL,
    api_key: Optional[str] = None,
    timeout: int = 300,
    history: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[str, List[Dict[str, Any]]]:
    """Send one turn of a (possibly multi-turn) conversation to OpenRouter.

    `history` is the prior messages list (from a previous call's returned
    history) — pass None or [] for the first turn. `video_path` may be None
    for a turn that's pure text (e.g. a final consolidation request after
    all video chapters have already been sent).

    Returns (response_text, updated_history) — the updated_history includes
    this turn's user message and the model's assistant reply, ready to pass
    into the next call to continue the same conversation.
    """
    api_key = api_key or os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENROUTER_API_KEY not set. Get a key at https://openrouter.ai/keys and "
            "export it, e.g.: export OPENROUTER_API_KEY=sk-or-... "
            "(never commit this value to a tracked file)."
        )

    messages: List[Dict[str, Any]] = list(history) if history else []

    tmp_compressed: Optional[Path] = None
    if video_path is not None:
        source = video_path
        size_mb = video_path.stat().st_size / (1024 * 1024)
        if size_mb > SIZE_HARD_CAP_MB:
            logger.warning(
                f"{video_path.name} is {size_mb:.1f} MB — auto-compressing before sending to Gemini..."
            )
            tmp_compressed = compress_video_for_gemini(video_path)
            source = tmp_compressed
        try:
            data_url = encode_video_to_data_url(source)
        finally:
            if tmp_compressed is not None:
                tmp_compressed.unlink(missing_ok=True)
        user_content: Any = [
            {"type": "text", "text": prompt},
            {"type": "video_url", "video_url": {"url": data_url}},
        ]
    else:
        user_content = prompt

    messages.append({"role": "user", "content": user_content})

    payload = {"model": model, "messages": messages}

    # Transient-failure retry: OpenRouter under load can return 429/5xx, HTML
    # error pages (JSON decode failure), read timeouts, or a null message
    # content. Retry those up to 3 times with backoff; fail fast on 4xx.
    last_err: Optional[Exception] = None
    for attempt in range(1, 4):
        logger.info(
            f"Sending request to OpenRouter (model={model}, turn {len(messages) // 2 + 1}"
            + (f", attempt {attempt}" if attempt > 1 else "")
            + ")..."
        )
        try:
            response = requests.post(
                OPENROUTER_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=timeout,
            )
            if response.status_code != 200:
                err = RuntimeError(
                    f"OpenRouter API error {response.status_code}: {response.text[:2000]}"
                )
                if response.status_code in (408, 429) or response.status_code >= 500:
                    raise err  # retryable
                raise SystemExit(str(err))  # non-retryable client error

            result = response.json()  # JSONDecodeError -> retryable
            try:
                content = result["choices"][0]["message"]["content"]
            except (KeyError, IndexError) as e:
                raise RuntimeError(
                    f"Unexpected response shape from OpenRouter: {json.dumps(result)[:2000]}"
                ) from e
            if not content or not str(content).strip():
                raise RuntimeError("OpenRouter returned empty/null message content")

            messages.append({"role": "assistant", "content": content})
            return content, messages
        except SystemExit:
            raise
        except Exception as e:  # noqa: BLE001 — deliberate broad retry on transient errors
            last_err = e
            if attempt < 3:
                wait_s = 20 * attempt
                logger.warning(
                    f"Turn failed ({e.__class__.__name__}: {e}) — retrying in {wait_s}s..."
                )
                time.sleep(wait_s)
    raise RuntimeError(f"OpenRouter request failed after 3 attempts: {last_err}")


# ---------------------------------------------------------------------------
# ffmpeg/ffprobe helpers — duration, compression, chapter splitting, frame grab
# ---------------------------------------------------------------------------


def _require_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        raise RuntimeError(
            "ffmpeg/ffprobe not found on PATH — required for --smart-cadres and "
            "--chapter-minutes. Install with `brew install ffmpeg` (macOS) or "
            "`apt install ffmpeg` (Linux)."
        )


def get_video_duration_seconds(video_path: Path) -> float:
    """Return a video's duration in seconds via ffprobe."""
    _require_ffmpeg()
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(video_path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return float(result.stdout.strip())


def compress_video_for_gemini(
    video_path: Path, output_path: Optional[Path] = None
) -> Path:
    """Compress a video to ~480p for reliable Gemini/OpenRouter delivery.

    Validated 2026-07-02: a 90MB/720p recording compressed to 9.8MB/480p via
    this exact profile still preserved exact on-screen text. Returns the
    output path (a temp file if output_path is not given — caller should
    delete it when done).
    """
    _require_ffmpeg()
    if output_path is None:
        fd, tmp_path = tempfile.mkstemp(suffix=".mp4")
        os.close(fd)
        output_path = Path(tmp_path)

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-vf",
        "scale=-2:480",
        "-c:v",
        "libx264",
        "-crf",
        "30",
        "-preset",
        "veryfast",
        "-c:a",
        "aac",
        "-b:a",
        "96k",
        str(output_path),
    ]
    subprocess.run(cmd, check=True, capture_output=True, timeout=600)
    return output_path


def split_into_chapters(
    video_path: Path,
    chapter_minutes: float,
    tmp_dir: Path,
) -> List[Tuple[Path, float]]:
    """Split a video into fixed-length chapters, compressed for Gemini delivery.

    Returns a list of (chapter_file_path, start_offset_seconds) in order.
    Each chapter is already compressed (480p) so it clears SIZE_HARD_CAP_MB
    regardless of the source video's original size — chapters are typically
    a few MB each even for a 10-minute segment.
    """
    _require_ffmpeg()
    duration = get_video_duration_seconds(video_path)
    chapter_seconds = chapter_minutes * 60
    chapters: List[Tuple[Path, float]] = []

    start = 0.0
    idx = 0
    tmp_dir.mkdir(parents=True, exist_ok=True)
    while start < duration:
        out_path = tmp_dir / f"chapter_{idx:03d}.mp4"
        cmd = [
            "ffmpeg",
            "-y",
            "-ss",
            str(start),
            "-i",
            str(video_path),
            "-t",
            str(chapter_seconds),
            "-vf",
            "scale=-2:480",
            "-c:v",
            "libx264",
            "-crf",
            "30",
            "-preset",
            "veryfast",
            "-c:a",
            "aac",
            "-b:a",
            "96k",
            str(out_path),
        ]
        logger.info(
            f"  Cutting chapter {idx} ({start:.0f}s - {min(start + chapter_seconds, duration):.0f}s)..."
        )
        subprocess.run(cmd, check=True, capture_output=True, timeout=600)
        chapters.append((out_path, start))
        start += chapter_seconds
        idx += 1

    return chapters


def timestamp_to_seconds(ts: str) -> Optional[float]:
    """Parse 'MM:SS', 'HH:MM:SS', or seconds-with-decimals into total seconds."""
    ts = ts.strip()
    parts = ts.split(":")
    try:
        parts_f = [float(p) for p in parts]
    except ValueError:
        return None
    if len(parts_f) == 1:
        return parts_f[0]
    if len(parts_f) == 2:
        return parts_f[0] * 60 + parts_f[1]
    if len(parts_f) == 3:
        return parts_f[0] * 3600 + parts_f[1] * 60 + parts_f[2]
    return None


def parse_smart_cadres(text: str) -> List[Dict[str, str]]:
    """Extract the `key_moments` JSON block from a model response.

    Robust to the model wrapping it in a ```json fence, adding surrounding
    prose, or (rarely) returning slightly malformed JSON — falls back to a
    regex scan for {"timestamp": ..., "reason": ...} pairs if strict
    json.loads fails. Returns [] if nothing usable is found (logged, not
    raised — a missing/broken smart-cadre block should not fail the whole
    analysis run).
    """
    fence_match = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
    candidate = fence_match.group(1) if fence_match else None

    if candidate is None:
        # Fallback: look for a bare {"key_moments": [...]} object anywhere in the text
        brace_match = re.search(
            r'\{\s*"key_moments"\s*:\s*\[.*?\]\s*\}', text, re.DOTALL
        )
        candidate = brace_match.group(0) if brace_match else None

    if candidate:
        try:
            data = json.loads(candidate)
            moments = data.get("key_moments", [])
            if isinstance(moments, list):
                return [m for m in moments if isinstance(m, dict) and "timestamp" in m]
        except json.JSONDecodeError:
            logger.warning(
                "Smart cadre JSON block found but failed to parse — trying regex fallback."
            )

    # Last-resort fallback: scan for individual {"timestamp": "...", "reason": "..."} objects
    pairs = re.findall(
        r'\{\s*"timestamp"\s*:\s*"([^"]+)"\s*,\s*"reason"\s*:\s*"([^"]*)"\s*\}',
        text,
    )
    if pairs:
        logger.info(f"Recovered {len(pairs)} smart cadre(s) via regex fallback.")
        return [{"timestamp": ts, "reason": reason} for ts, reason in pairs]

    logger.warning("No smart cadre JSON block found in the response.")
    return []


def extract_frame_at(video_path: Path, seconds: float, output_path: Path) -> bool:
    """Extract a single frame at the given timestamp via ffmpeg. Returns success."""
    _require_ffmpeg()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-ss",
        str(max(0.0, seconds)),
        "-i",
        str(video_path),
        "-frames:v",
        "1",
        "-q:v",
        "2",
        str(output_path),
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=60)
        return output_path.exists()
    except subprocess.CalledProcessError as e:
        logger.warning(
            f"  Frame extraction failed at {seconds:.1f}s: {e.stderr[:300] if e.stderr else e}"
        )
        return False


def strip_smart_cadre_json(text: str) -> str:
    """Remove the trailing ```json key_moments fence from a response, for clean transcript text."""
    return re.sub(
        r"```json\s*\{.*?\"key_moments\".*?\}\s*```", "", text, flags=re.DOTALL
    ).strip()


# ---------------------------------------------------------------------------
# High-level orchestration: single-pass or chaptered, with optional smart cadres
# ---------------------------------------------------------------------------


def analyze_video_full(
    video_path: Path,
    prompt: str,
    model: str = DEFAULT_MODEL,
    timeout: int = 300,
    smart_cadres: Optional[int] = None,
    chapter_minutes: Optional[float] = None,
    images_dir: Optional[Path] = None,
    replace_cadres: bool = False,
) -> Dict[str, Any]:
    """Run a full analysis pass — single-shot or chaptered — with optional
    smart cadre extraction. This is the recommended entry point for anything
    beyond a simple one-off question (use `analyze_video` for that).

    Returns a dict:
        {
          "description": str,       # concatenated model narrative (JSON blocks stripped)
          "smart_cadres": [ {"timestamp": "MM:SS", "seconds": float,
                              "reason": str, "image_path": str|None}, ... ],
          "chapters": int,          # how many chapters were used (1 if single-pass)
        }

    If smart_cadres is given and images_dir is provided, frames are actually
    extracted to disk (data/corpus/{Video}/images/smart_cadre_NNN.jpg by
    convention — caller decides the exact path via images_dir). If
    replace_cadres is True, any existing `cadre_*.jpg` files in images_dir
    are deleted first (the PySceneDetect "dumb cadre" replacement behavior).
    """
    _require_ffmpeg() if (smart_cadres or chapter_minutes) else None

    duration = None
    try:
        duration = get_video_duration_seconds(video_path)
    except Exception:
        pass  # duration is advisory only; proceed without it if ffprobe unavailable

    if duration and not chapter_minutes and duration > LONG_VIDEO_WARNING_MINUTES * 60:
        logger.warning(
            f"Video is {duration / 60:.1f} minutes — consider --chapter-minutes for "
            f"more reliable coverage of the full runtime in one call."
        )

    full_prompt = prompt
    if smart_cadres:
        full_prompt = (
            prompt
            + "\n"
            + SMART_CADRE_INSTRUCTION.format(
                min_n=max(3, smart_cadres // 3), max_n=smart_cadres
            )
        )

    descriptions: List[str] = []
    all_moments: List[Dict[str, Any]] = []  # with global "seconds" already applied

    if chapter_minutes:
        with tempfile.TemporaryDirectory(prefix="video_chapters_") as tmp_dir_str:
            tmp_dir = Path(tmp_dir_str)
            chapters = split_into_chapters(video_path, chapter_minutes, tmp_dir)
            logger.info(
                f"Split into {len(chapters)} chapter(s) of ~{chapter_minutes} min each."
            )

            history: Optional[List[Dict[str, Any]]] = None
            for idx, (chapter_path, offset_seconds) in enumerate(chapters):
                chapter_prompt = (
                    full_prompt
                    if idx == 0
                    else (
                        f"This is chapter {idx + 1} of {len(chapters)}, continuing directly after "
                        f"the previous chapter you just analyzed (this chapter starts at "
                        f"{offset_seconds:.0f} seconds into the full video). "
                        + full_prompt
                    )
                )
                try:
                    content, history = analyze_video_turn(
                        chapter_path,
                        chapter_prompt,
                        model=model,
                        timeout=timeout,
                        history=history,
                    )
                except Exception as exc:
                    # Confirmed 2026-07-03: a growing multi-turn history (every prior
                    # chapter's video re-sent each turn) can hit a Cloudflare 502/504
                    # gateway error on a later turn even though no single chapter is
                    # oversized — the CUMULATIVE payload is the problem, not this
                    # chapter alone. Retry once as an independent, history-free turn
                    # (same recovery this project used manually: cut chapters and
                    # analyze each on its own). This chapter loses cross-chapter
                    # continuity but the run still completes instead of losing every
                    # already-successful chapter's work.
                    logger.warning(
                        f"Chapter {idx + 1}/{len(chapters)} failed with accumulated "
                        f"history ({exc}) — retrying as an independent turn (no prior "
                        f"chapter context) before giving up on this chapter."
                    )
                    content, history = analyze_video_turn(
                        chapter_path,
                        full_prompt,
                        model=model,
                        timeout=timeout,
                        history=None,
                    )
                moments = parse_smart_cadres(content) if smart_cadres else []
                for m in moments:
                    local_s = timestamp_to_seconds(m["timestamp"])
                    if local_s is not None:
                        all_moments.append(
                            {
                                "timestamp": m["timestamp"],
                                "seconds": local_s + offset_seconds,
                                "reason": m.get("reason", ""),
                            }
                        )
                descriptions.append(
                    strip_smart_cadre_json(content) if smart_cadres else content
                )

            # Optional consolidation turn — leverages the full accumulated history
            if len(chapters) > 1:
                consolidation_prompt = (
                    "You have now seen all chapters of this video, in order. Write one "
                    "consolidated, chronological summary of the ENTIRE video (not per-chapter) "
                    "covering everything notable, with approximate global timestamps."
                )
                try:
                    final_summary, _ = analyze_video_turn(
                        None,
                        consolidation_prompt,
                        model=model,
                        timeout=timeout,
                        history=history,
                    )
                    descriptions.append(
                        "\n## Consolidated summary (all chapters)\n\n" + final_summary
                    )
                except Exception as e:
                    logger.warning(f"Consolidation turn failed (non-fatal): {e}")
    else:
        source_for_analysis = video_path
        tmp_compressed_single: Optional[Path] = None
        size_mb = video_path.stat().st_size / (1024 * 1024)
        if size_mb > SIZE_HARD_CAP_MB:
            logger.warning(
                f"{video_path.name} is {size_mb:.1f} MB — compressing before sending to Gemini…"
            )
            tmp_compressed_single = compress_video_for_gemini(video_path)
            source_for_analysis = tmp_compressed_single
        try:
            content, _ = analyze_video_turn(
                source_for_analysis, full_prompt, model=model, timeout=timeout
            )
        finally:
            if tmp_compressed_single is not None:
                tmp_compressed_single.unlink(missing_ok=True)
        moments = parse_smart_cadres(content) if smart_cadres else []
        for m in moments:
            s = timestamp_to_seconds(m["timestamp"])
            if s is not None:
                all_moments.append(
                    {
                        "timestamp": m["timestamp"],
                        "seconds": s,
                        "reason": m.get("reason", ""),
                    }
                )
        descriptions.append(
            strip_smart_cadre_json(content) if smart_cadres else content
        )

    # Deduplicate near-identical timestamps (model sometimes repeats a moment
    # across consolidation + chapter passes) — keep the first occurrence.
    seen_seconds: List[float] = []
    deduped_moments: List[Dict[str, Any]] = []
    for m in sorted(all_moments, key=lambda x: x["seconds"]):
        if any(abs(m["seconds"] - s) < 2.0 for s in seen_seconds):
            continue
        seen_seconds.append(m["seconds"])
        deduped_moments.append(m)

    if images_dir and deduped_moments:
        images_dir.mkdir(parents=True, exist_ok=True)
        if replace_cadres:
            removed = 0
            for old in images_dir.glob("cadre_*.jpg"):
                old.unlink()
                removed += 1
            if removed:
                logger.info(
                    f"Removed {removed} old PySceneDetect cadre(s) from {images_dir}"
                )

        # Never silently overwrite a prior smart-cadre pass: continue numbering
        # after the highest existing smart_cadre_NNN.jpg instead of always
        # restarting at 000 (each pass's images are as durable/paid-for as the
        # markdown analysis they accompany).
        start_index = 0
        existing_indices = []
        for existing in images_dir.glob("smart_cadre_*.jpg"):
            digits = existing.stem.replace("smart_cadre_", "")
            if digits.isdigit():
                existing_indices.append(int(digits))
        if existing_indices:
            start_index = max(existing_indices) + 1
            logger.info(
                f"{len(existing_indices)} smart cadre(s) already in {images_dir} — "
                f"continuing numbering from {start_index:03d} rather than overwriting them."
            )

        for offset, m in enumerate(deduped_moments):
            out_path = images_dir / f"smart_cadre_{start_index + offset:03d}.jpg"
            ok = extract_frame_at(video_path, m["seconds"], out_path)
            m["image_path"] = str(out_path) if ok else None

    return {
        "description": "\n\n---\n\n".join(descriptions),
        "smart_cadres": deduped_moments,
        "chapters": len(chapters) if chapter_minutes else 1,
    }


def format_smart_cadre_index(moments: List[Dict[str, Any]], video_name: str) -> str:
    """Render a markdown index of extracted smart cadres for the analysis output file."""
    if not moments:
        return ""
    lines = [f"## Smart Cadres — {video_name}\n"]
    for m in moments:
        img = m.get("image_path")
        img_ref = f"`{Path(img).name}`" if img else "(extraction failed)"
        lines.append(f"- **{m['timestamp']}** ({img_ref}) — {m.get('reason', '')}")
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Analyze a local video file directly via Gemini native video "
            "understanding (through OpenRouter), with optional smart cadre "
            "extraction and chaptering for long videos."
        ),
    )
    parser.add_argument("video_path", type=Path, help="Path to the local video file")
    parser.add_argument(
        "prompt",
        nargs="?",
        default=None,
        help="Text prompt/question about the video (default: general description). "
        "Ignored if --prompt-file is given.",
    )
    parser.add_argument(
        "--prompt-file",
        type=Path,
        help="Read the prompt from a file instead of the CLI arg",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"OpenRouter model slug (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--output", type=Path, help="Write the response to this file instead of stdout"
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow --output to overwrite an existing file. Without this flag, the script "
        "refuses to write over an existing analysis file — every video-analysis pass costs "
        "real API tokens and is treated as a durable artifact, never silently replaced. Pick "
        "a new topic-qualified filename (e.g. gemini_analysis_{topic-slug}.md) for a new "
        "targeted pass instead of overwriting; pass --overwrite only when deliberately "
        "superseding a prior pass (e.g. replacing mechanical cadres with smart ones).",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=300,
        help="Request timeout in seconds per API call (default: 300)",
    )
    parser.add_argument(
        "--smart-cadres",
        type=int,
        nargs="?",
        const=15,
        default=None,
        metavar="N",
        help="Ask the model to identify up to N visually important moments and extract them "
        "as images via ffmpeg (default N=15 if flag given with no value). Requires --images-dir "
        "to actually save the extracted frames (otherwise timestamps are reported but no "
        "images are written).",
    )
    parser.add_argument(
        "--images-dir",
        type=Path,
        help="Directory to save extracted smart cadre images to (e.g. "
        "'data/corpus/{VideoName}/images')",
    )
    parser.add_argument(
        "--replace-cadres",
        action="store_true",
        help="Delete existing cadre_*.jpg files in --images-dir before saving smart cadres "
        "(replaces PySceneDetect's mechanically-extracted frames with the curated set). "
        "Destructive — only used when explicitly requested.",
    )
    parser.add_argument(
        "--chapter-minutes",
        type=float,
        nargs="?",
        const=DEFAULT_CHAPTER_MINUTES,
        default=None,
        metavar="N",
        help=f"Split long videos into N-minute chapters and analyze via a multi-turn "
        f"conversation (default N={DEFAULT_CHAPTER_MINUTES} if flag given with no value). "
        f"Use for videos too long/large for a reliable single-pass call.",
    )
    args = parser.parse_args()

    if not args.video_path.exists():
        logger.error(f"Video file not found: {args.video_path}")
        sys.exit(1)

    if args.output and args.output.exists() and not args.overwrite:
        siblings = (
            sorted(p.name for p in args.output.parent.glob("gemini_analysis*.md"))
            if args.output.parent.exists()
            else []
        )
        logger.error(
            f"REFUSING to overwrite existing analysis file: {args.output}\n"
            f"Every video-analysis pass costs real API tokens and is a durable artifact — "
            f"never silently replaced. Existing passes in this fragment's markdown/ dir: "
            f"{siblings or '(none found)'}.\n"
            f"Either: (1) pick a new topic-qualified filename, e.g. "
            f"gemini_analysis_{{topic-slug}}.md, for this new targeted pass — CoK-style, "
            f"multiple passes per video are expected, not redundant; or "
            f"(2) pass --overwrite if you are deliberately superseding the existing pass "
            f"(e.g. replacing an approach, not just adding detail)."
        )
        sys.exit(1)

    if args.prompt_file:
        prompt = args.prompt_file.read_text(encoding="utf-8")
    elif args.prompt:
        prompt = args.prompt
    else:
        prompt = DEFAULT_PROMPT
        logger.info("No prompt given — using default general-description prompt.")

    use_full_pipeline = bool(args.smart_cadres or args.chapter_minutes)

    try:
        if use_full_pipeline:
            result = analyze_video_full(
                args.video_path,
                prompt,
                model=args.model,
                timeout=args.timeout,
                smart_cadres=args.smart_cadres,
                chapter_minutes=args.chapter_minutes,
                images_dir=args.images_dir,
                replace_cadres=args.replace_cadres,
            )
            output_text = result["description"]
            if result["smart_cadres"]:
                output_text += "\n\n" + format_smart_cadre_index(
                    result["smart_cadres"], args.video_path.stem
                )
            if result["chapters"] > 1:
                logger.info(f"Analyzed across {result['chapters']} chapters.")
            if args.smart_cadres:
                extracted = sum(
                    1 for m in result["smart_cadres"] if m.get("image_path")
                )
                logger.info(
                    f"Smart cadres: {len(result['smart_cadres'])} identified, "
                    f"{extracted} image(s) extracted."
                )
        else:
            output_text = analyze_video(
                args.video_path, prompt, model=args.model, timeout=args.timeout
            )
    except Exception as e:
        logger.error(f"FAILED: {e}")
        sys.exit(1)

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output_text, encoding="utf-8")
        logger.info(f"Response written to {args.output}")
    else:
        print(output_text)


if __name__ == "__main__":
    main()
