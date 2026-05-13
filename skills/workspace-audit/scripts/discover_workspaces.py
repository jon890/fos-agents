#!/usr/bin/env python3
"""List ai-nodes workspaces by AGENTS.md or skills/ marker."""
import sys
from pathlib import Path

EXCLUDE = {"_shared", "skills", "docs", ".git", ".claude", ".omc", "node_modules"}


def main(root: Path) -> None:
    for d in sorted(root.iterdir()):
        if not d.is_dir():
            continue
        if d.name in EXCLUDE or d.name.startswith("."):
            continue
        if (d / "AGENTS.md").exists() or (d / "skills").is_dir():
            print(d.name)


if __name__ == "__main__":
    main(Path(sys.argv[1]).resolve())
