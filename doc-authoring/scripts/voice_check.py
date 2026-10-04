#!/usr/bin/env python3
"""Mechanical voice check for a markdown document (house-style.md).

    python3 voice_check.py <doc.md> [--images DIR] [--max-lines N] [--against DRAFT.md]

FAIL on: a caption with text after its label; a paragraph over three sentences; a sentence over
thirty words (WARN); narration markers; a terms/glossary table; more than one tree/code listing;
a diagram image wider than tall (needs --images, PNG only); the document over --max-lines;
with --against, any backticked token or number absent from the earlier draft (a rewrite may cut
and rephrase, never add facts). Exit 1 on any FAIL.
"""
import argparse
import re
import struct
import sys
from pathlib import Path

NARRATION = re.compile(
    r"\b(first|then|finally|next|afterwards|subsequently)\b,|\b(two|three) \w+, (two|three) \w+",
    re.I)
CAPTION = re.compile(r"^\*\*(Figure|Table)\s+[—-]\s+[^*]+\.\*\*(.*)$")
TERMS_HDR = re.compile(r"^\|\s*(term|terms|glossary|word)\s*\|", re.I)
TOKEN = re.compile(r"`([^`]+)`|\b\d[\d.:/-]*\d\b")


def png_size(p: Path):
    with p.open("rb") as h:
        head = h.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return struct.unpack(">II", head[16:24])


def paragraphs(lines):
    buf, fence = [], False
    for i, l in enumerate(lines, 1):
        if l.startswith("```"):
            fence = not fence
            continue
        plain = l.strip() and not fence and not l.lstrip().startswith(("|", "#", "-", "*", ">", "<", "!"))
        plain = plain and not re.match(r"^\s*\d+\.\s", l)
        if plain:
            buf.append((i, l.strip()))
        elif buf:
            yield buf
            buf = []
    if buf:
        yield buf


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("doc")
    ap.add_argument("--images")
    ap.add_argument("--max-lines", type=int)
    ap.add_argument("--against")
    a = ap.parse_args()
    text = Path(a.doc).read_text(encoding="utf-8")
    lines = text.splitlines()
    fails, warns = [], []

    if a.max_lines and len(lines) > a.max_lines:
        fails.append(f"size: {len(lines)} lines > {a.max_lines}")

    fence, listings, in_tree = False, 0, False
    for i, l in enumerate(lines, 1):
        tree = bool(re.match(r"^\s*(\|\s*)*\+--", l)) and not fence
        if tree and not in_tree:
            listings += 1
        in_tree = tree
        if l.startswith("```"):
            if not fence and l.strip().lower() not in ("```json", "```http"):
                listings += 1
            fence = not fence
            continue
        if fence:
            continue
        m = CAPTION.match(l.strip())
        if m and m.group(2).strip():
            fails.append(f"{i}: caption has text after its label")
        if TERMS_HDR.match(l.strip()):
            fails.append(f"{i}: terms/glossary table")
        if NARRATION.search(l) and not l.lstrip().startswith("|"):
            fails.append(f"{i}: narration: {NARRATION.search(l).group(0)!r}")
    if listings > 1:
        fails.append(f"listings: {listings} code/model blocks > 1")

    for para in paragraphs(lines):
        body = " ".join(t for _, t in para)
        sents = [s for s in re.split(r"(?<=[.!?])\s+(?=[A-Z`*(])", body) if s.strip()]
        if len(sents) > 3:
            fails.append(f"{para[0][0]}: paragraph of {len(sents)} sentences")
        for s in sents:
            if len(s.split()) > 30:
                warns.append(f"{para[0][0]}: sentence of {len(s.split())} words")

    if a.images:
        for p in sorted(Path(a.images).rglob("*.png")):
            if "banner" in p.parts:
                continue
            src = p.parent.parent / (p.stem + ".mmd")
            if src.exists() and "sequenceDiagram" in src.read_text(encoding="utf-8"):
                continue  # component calls run left to right by nature
            wh = png_size(p)
            if wh and wh[0] > wh[1]:
                fails.append(f"diagram wider than tall: {p} {wh[0]}x{wh[1]}")

    if a.against:
        old = Path(a.against).read_text(encoding="utf-8")
        have = {m.group(1) or m.group(0) for m in TOKEN.finditer(old)}
        new = {m.group(1) or m.group(0) for m in TOKEN.finditer(text)}
        for t in sorted(new - have):
            fails.append(f"new token not in the earlier draft: {t!r}")

    for w in warns:
        print("WARN", w)
    for f in fails:
        print("FAIL", f)
    print(f"voice check {a.doc}: {len(lines)} lines · {len(fails)} FAIL · {len(warns)} WARN")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
