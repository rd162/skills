#!/usr/bin/env bash
# fetch_refs.sh — ephemeral reference fetch for the doc-export skill.
# Usage: fetch_refs.sh <docx|pdf|pptx|xlsx> [work-dir]
# Sparse-clones anthropics/skills into $TMPDIR (or work-dir), checks out only
# the requested format directory, and prints REF_DIR=<path>.
# No upstream content is retained: the caller deletes REF_DIR after the run.
set -u
FORMAT="${1:-}"
WORK="${2:-${TMPDIR:-/tmp}}"
case "$FORMAT" in
  docx|pdf|pptx|xlsx) ;;
  *) echo "fetch_refs.sh: want format docx|pdf|pptx|xlsx, got '$FORMAT'" >&2; exit 2 ;;
esac
command -v git >/dev/null 2>&1 || { echo "fetch_refs.sh: git required" >&2; exit 3; }
REF_DIR="$WORK/doc-export-ref-$$"
rm -rf "$REF_DIR"
git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/anthropics/skills.git "$REF_DIR" >/dev/null 2>&1 \
  || { echo "fetch_refs.sh: clone failed (offline?)" >&2; exit 4; }
(cd "$REF_DIR" && git sparse-checkout set "skills/$FORMAT" >/dev/null 2>&1) \
  || { echo "fetch_refs.sh: sparse checkout failed" >&2; rm -rf "$REF_DIR"; exit 5; }
[ -f "$REF_DIR/skills/$FORMAT/SKILL.md" ] \
  || { echo "fetch_refs.sh: SKILL.md missing after checkout" >&2; rm -rf "$REF_DIR"; exit 6; }
echo "REF_DIR=$REF_DIR"
