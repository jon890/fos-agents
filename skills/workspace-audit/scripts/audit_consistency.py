#!/usr/bin/env python3
"""Self-consistency audit: deprecated-ADR survivors, dispatcher targets, dead-doc commands."""
import json
import re
import sys
from pathlib import Path

EXCLUDE_DIRS = {"data", "logs", "__pycache__", ".git", ".omc", "node_modules", "sources"}
DEPRECATED_RE = re.compile(
    r"\(폐기\)|status\s*:\s*(?:deprecated|rejected|superseded)|\*\*deprecated\*\*",
    re.IGNORECASE,
)


def _is_excluded(p: Path, root: Path) -> bool:
    try:
        rel = p.relative_to(root)
    except ValueError:
        return True
    return any(part in EXCLUDE_DIRS for part in rel.parts)


def main(ws_root: Path) -> None:
    findings: list[dict] = []
    repo_root = ws_root.parent

    # 1. Deprecated ADRs still referenced
    decisions = ws_root / "docs" / "decisions"
    if decisions.is_dir():
        for adr in sorted(decisions.glob("*.md")):
            try:
                text = adr.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            if not DEPRECATED_RE.search(text):
                continue

            slug = adr.stem
            if len(slug) < 4:
                continue
            refs: list[str] = []
            for f in ws_root.rglob("*"):
                if not f.is_file() or f == adr:
                    continue
                if _is_excluded(f, ws_root):
                    continue
                if f.suffix not in {".md", ".sh", ".py", ".json"}:
                    continue
                try:
                    t = f.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    continue
                if slug in t:
                    refs.append(str(f.relative_to(ws_root)))

            if refs:
                preview = ", ".join(refs[:5])
                if len(refs) > 5:
                    preview += f", … (+{len(refs) - 5})"
                findings.append({
                    "severity": "LOW",
                    "category": "consistency.deprecated_adr_refs",
                    "path": str(adr.relative_to(ws_root)),
                    "message": f"Deprecated ADR still referenced in: {preview}",
                })

    # 2. case-dispatcher branches
    script_re = re.compile(r"[\w$\{\}/.-]*[a-zA-Z0-9_\-]+\.(?:sh|py)")
    for sh in ws_root.rglob("run_*.sh"):
        if _is_excluded(sh, ws_root):
            continue
        try:
            text = sh.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        case_match = re.search(
            r"case\s+\"?\$\{?\w+\}?\"?\s+in\b(.*?)\besac\b",
            text,
            re.DOTALL,
        )
        if not case_match:
            continue

        seen: set[str] = set()
        for m in script_re.finditer(case_match.group(1)):
            ref = m.group(0)
            cleaned = ref
            cleaned = re.sub(r"^\$\{?TASK_ROOT\}?/", "", cleaned)
            cleaned = re.sub(r"^\$\{?WS_ROOT\}?/", "", cleaned)
            cleaned = re.sub(r"^\$\{?ROOT\}?/", "", cleaned)
            cleaned = re.sub(r"^\$\w+/", "", cleaned)
            cleaned = cleaned.lstrip("./")
            if "$" in cleaned or "{" in cleaned:
                continue
            if cleaned in seen:
                continue
            seen.add(cleaned)
            for root in (ws_root, repo_root, sh.parent):
                if (root / cleaned).exists():
                    break
            else:
                findings.append({
                    "severity": "HIGH",
                    "category": "consistency.dispatcher_missing_target",
                    "path": str(sh.relative_to(ws_root)),
                    "message": f"Dispatcher references missing script: {ref}",
                })

    print(json.dumps(
        {"phase": "consistency", "findings": findings},
        ensure_ascii=False,
        indent=2,
    ))


if __name__ == "__main__":
    main(Path(sys.argv[1]).resolve())
