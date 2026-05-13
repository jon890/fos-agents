#!/usr/bin/env python3
"""Static structure audit: orphan configs, dead scripts, broken symlinks, doc-code drift."""
import json
import re
import sys
from pathlib import Path

EXCLUDE_DIRS = {"data", "logs", "__pycache__", ".git", ".omc", "node_modules", "sources"}
TEXT_SUFFIXES = {".sh", ".py", ".md", ".json", ".yaml", ".yml", ".toml", ".txt"}
ENTRY_PREFIXES = ("run_", "notify_")


def _is_excluded(p: Path, root: Path) -> bool:
    try:
        rel = p.relative_to(root)
    except ValueError:
        return True
    return any(part in EXCLUDE_DIRS for part in rel.parts)


def _load_haystack(root: Path) -> dict[Path, str]:
    haystack: dict[Path, str] = {}
    for suf in TEXT_SUFFIXES:
        for f in root.rglob(f"*{suf}"):
            if _is_excluded(f, root) or not f.is_file():
                continue
            try:
                haystack[f] = f.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                pass
    return haystack


def _count_refs(target: Path, name: str, stem: str, haystack: dict[Path, str]) -> int:
    count = 0
    for f, text in haystack.items():
        if f == target:
            continue
        if name in text or (stem and stem in text and len(stem) > 3):
            count += 1
    return count


def main(ws_root: Path) -> None:
    findings: list[dict] = []
    haystack = _load_haystack(ws_root)

    # 1. Orphan configs
    config_dir = ws_root / "config"
    if config_dir.is_dir():
        for cfg in sorted(config_dir.glob("*.json")):
            refs = _count_refs(cfg, cfg.name, cfg.stem, haystack)
            if refs == 0:
                findings.append({
                    "severity": "MED",
                    "category": "static.orphan_config",
                    "path": str(cfg.relative_to(ws_root)),
                    "message": "Config not referenced by any script or doc in workspace",
                })

    # 2. Dead scripts
    skills_dir = ws_root / "skills"
    if skills_dir.is_dir():
        scripts: list[Path] = []
        for pat in ("scripts/*.sh", "scripts/*.py"):
            scripts.extend(skills_dir.rglob(pat))
        for script in sorted(scripts):
            if any(script.name.startswith(pfx) for pfx in ENTRY_PREFIXES):
                continue
            if script.name.startswith("_"):
                continue
            refs = _count_refs(script, script.name, script.stem, haystack)
            if refs == 0:
                findings.append({
                    "severity": "MED",
                    "category": "static.dead_script",
                    "path": str(script.relative_to(ws_root)),
                    "message": "Script not referenced by any other script or doc",
                })

    # 3. Broken .claude/skills symlinks
    claude_skills = ws_root / ".claude" / "skills"
    if claude_skills.is_dir():
        for entry in sorted(claude_skills.iterdir()):
            if entry.is_symlink():
                target = entry.readlink()
                resolved = (entry.parent / target).resolve()
                if not resolved.exists():
                    findings.append({
                        "severity": "HIGH",
                        "category": "static.broken_symlink",
                        "path": str(entry.relative_to(ws_root)),
                        "message": f"Symlink target missing: {target}",
                    })

    # 4. Doc-mentioned paths that don't exist
    path_re = re.compile(r"`([a-zA-Z0-9_./-]+\.(?:sh|py|json|md|txt|jsonl|yaml|yml))`")
    repo_root = ws_root.parent
    for doc, text in haystack.items():
        if doc.suffix != ".md":
            continue
        seen: set[str] = set()
        for m in path_re.finditer(text):
            ref = m.group(1)
            if ref in seen:
                continue
            seen.add(ref)
            if "/" not in ref or ref.startswith("/") or "://" in ref:
                continue
            if "<" in ref or ">" in ref or "{" in ref:
                continue
            # Skip docstring template placeholders.
            if any(token in ref for token in ("YYYY-MM-DD", "YYYY", "NNNN", "...")):
                continue
            candidates = [ws_root / ref, repo_root / ref, doc.parent / ref]
            if not any(c.exists() for c in candidates):
                findings.append({
                    "severity": "LOW",
                    "category": "static.doc_path_missing",
                    "path": f"{doc.relative_to(ws_root)} → `{ref}`",
                    "message": "Doc references nonexistent path",
                })

    print(json.dumps(
        {"phase": "static", "findings": findings},
        ensure_ascii=False,
        indent=2,
    ))


if __name__ == "__main__":
    main(Path(sys.argv[1]).resolve())
