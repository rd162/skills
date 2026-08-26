#!/usr/bin/env python3
"""Repair .claude/skills -> .agents/skills if the symlink didn't check out as a real link.

Context (AGENTS.md § Agent Tool Onboarding): Claude Code hard-scans .claude/skills/
with no @import/config redirect, so this repo bridges it to .agents/skills/ (the
project's Agent-Skills-open-standard SSOT) via a relative symlink tracked in git.

git only checks that symlink out as a real link on Windows if the machine can create
symlinks (Developer Mode, or admin+elevation) -- see gitforwindows.org/symbolic-links.
The RECOMMENDED fix is enabling Developer Mode once (Settings > Privacy & Security >
For developers), then either re-cloning or, on an existing clone:

    git config core.symlinks true && git rm --cached -r . && git reset --hard

This script is the FALLBACK for machines where Developer Mode is unavailable (e.g.
disabled by policy): it replaces the placeholder text file git leaves behind with a
real NTFS directory junction (mklink /J), which needs no special privilege, and marks
the path --skip-worktree so `git status` doesn't flag it as locally modified.

Stdlib only -- runs with any python3, no scripts/.venv needed.

Safety: only ever touches the path if it is exactly the expected git-for-windows
placeholder (a plain file). An existing link or a real directory is left alone with
a message -- never auto-deleted. Safe to re-run.
"""
from __future__ import annotations

import os
import platform
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
LINK = REPO_ROOT / ".claude" / "skills"
TARGET = (REPO_ROOT / ".agents" / "skills").resolve()


def already_linked() -> bool:
    return LINK.is_dir() and LINK.resolve() == TARGET


def main() -> int:
    if not TARGET.is_dir():
        print(f"ERROR: {TARGET} not found -- run this from a full clone of the repo.", file=sys.stderr)
        return 1

    if already_linked():
        print(f"OK: {LINK} already resolves to {TARGET}. Nothing to do.")
        return 0

    if LINK.is_symlink():
        print(
            f"NOT TOUCHING {LINK}: it's already some kind of link, just not pointing "
            f"at {TARGET}. Fix manually.",
            file=sys.stderr,
        )
        return 1

    if LINK.is_dir():
        print(
            f"NOT TOUCHING {LINK}: it's a real directory, not the expected git "
            "placeholder file. Fix manually.",
            file=sys.stderr,
        )
        return 1

    if LINK.exists():
        placeholder = LINK.read_text(encoding="utf-8", errors="ignore").strip()
        LINK.unlink()
        print(f"Removed git-for-windows placeholder file at {LINK} (contained: {placeholder!r}).")
    else:
        LINK.parent.mkdir(parents=True, exist_ok=True)

    if platform.system() == "Windows":
        subprocess.run(["cmd", "/c", "mklink", "/J", str(LINK), str(TARGET)], check=True)
        subprocess.run(
            ["git", "update-index", "--skip-worktree", ".claude/skills"],
            cwd=REPO_ROOT,
            check=False,  # not fatal if git isn't resolvable here; the junction still works
        )
        print(f"Created NTFS junction {LINK} -> {TARGET} (no admin/Developer Mode needed).")
        print("Marked .claude/skills --skip-worktree so `git status` stays clean.")
        print("Prefer the real fix when you can: enable Developer Mode, then re-run")
        print("  git config core.symlinks true && git rm --cached -r . && git reset --hard")
    else:
        rel_target = os.path.relpath(TARGET, LINK.parent)
        os.symlink(rel_target, LINK)
        print(f"Created symlink {LINK} -> {rel_target}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
