#!/usr/bin/env python3
"""
Add tier/source_class/last_updated to all skill markdown files.
Additivity rule: only adds missing keys, never overwrites existing values.
Appends new keys at the END of the existing frontmatter block.

Targets:
- ~/.claude/skills/*/SKILL.md
- ~/.claude/skills/*/references/*.md
- ~/.claude/skills/*/agents/*.md

All skill docs default to tier: T3, source_class: llm.
"""

import sys
import re
from pathlib import Path
from datetime import datetime

SKILLS_DIR = Path.home() / ".claude" / "skills"
TODAY = datetime.now().date().isoformat()
REQUIRED_KEYS = {"tier", "source_class", "last_updated"}


def parse_frontmatter(lines: list[str]) -> tuple[dict, int, int]:
    """Parse YAML frontmatter. Returns (dict, start_idx, end_idx).
    start_idx is always 0; end_idx is the line index of the closing ---.
    Returns ({}, 0, -1) if no frontmatter.
    """
    if not lines or lines[0].rstrip() != "---":
        return {}, 0, -1

    end_idx = -1
    for i in range(1, len(lines)):
        if lines[i].rstrip() == "---":
            end_idx = i
            break

    if end_idx == -1:
        return {}, 0, -1

    fm: dict = {}
    for line in lines[1:end_idx]:
        if ":" in line:
            key, _, val = line.partition(":")
            key = key.strip()
            val = val.strip().strip("\"'")
            if key and not key.startswith("#"):
                fm[key] = val

    return fm, 0, end_idx


def update_file(filepath: Path, dry_run: bool = False) -> str:
    """Add missing tier/source_class/last_updated. Returns action taken."""
    try:
        text = filepath.read_text(encoding="utf-8")
    except Exception as e:
        return f"ERROR reading: {e}"

    lines = text.splitlines(keepends=True)
    if not lines:
        return "skip (empty)"

    fm, _, fm_end = parse_frontmatter([l.rstrip("\n") for l in lines])

    if fm_end == -1:
        # No frontmatter — prepend minimal block
        missing = REQUIRED_KEYS
        stem_desc = filepath.stem.replace("_", " ").replace("-", " ")
        new_fm = "---\n"
        new_fm += f"tier: T3\n"
        new_fm += f"source_class: llm\n"
        new_fm += f"last_updated: {TODAY}\n"
        # Add description only if not already present (it won't be, no FM)
        new_fm += f"description: {stem_desc}\n"
        new_fm += "---\n\n"
        new_content = new_fm + text
        action = "prepended frontmatter"
    else:
        missing = REQUIRED_KEYS - set(fm.keys())
        if not missing:
            return "skip (complete)"

        # Inject missing keys just before the closing ---
        # Find the closing --- line index in the original lines list
        closing_line = fm_end  # 0-indexed in stripped list, same index in lines

        new_lines = list(lines)
        insert_pos = closing_line  # insert before this line (which is "---\n")
        insert_text = ""
        if "tier" in missing:
            insert_text += f"tier: T3\n"
        if "source_class" in missing:
            insert_text += f"source_class: llm\n"
        if "last_updated" in missing:
            insert_text += f"last_updated: {TODAY}\n"

        new_lines.insert(insert_pos, insert_text)
        new_content = "".join(new_lines)
        action = f"added {', '.join(sorted(missing))}"

    if not dry_run:
        filepath.write_text(new_content, encoding="utf-8")

    return action


def main():
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        print("DRY RUN — no files modified\n")

    targets: list[Path] = []

    for skill_dir in sorted(SKILLS_DIR.iterdir()):
        if not skill_dir.is_dir() or skill_dir.name.startswith("."):
            continue

        skill_md = skill_dir / "SKILL.md"
        if skill_md.exists():
            targets.append(skill_md)

        for subdir in ("references", "agents"):
            ref_dir = skill_dir / subdir
            if ref_dir.is_dir():
                targets.extend(sorted(ref_dir.glob("*.md")))

    print(f"Found {len(targets)} skill markdown files\n")

    updated = 0
    skipped = 0
    errors = 0

    for filepath in targets:
        action = update_file(filepath, dry_run)
        rel = filepath.relative_to(Path.home() / ".claude")
        if action.startswith("skip"):
            skipped += 1
        elif action.startswith("ERROR"):
            errors += 1
            print(f"  ERROR  {rel}: {action}")
        else:
            updated += 1
            verb = "would update" if dry_run else "updated"
            print(f"  {verb}  {rel} — {action}")

    print(f"\nDone: {updated} updated, {skipped} skipped, {errors} errors")
    if dry_run:
        print("Run without --dry-run to apply.")


if __name__ == "__main__":
    main()
