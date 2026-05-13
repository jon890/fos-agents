#!/usr/bin/env python3
"""Merge phase JSON outputs into a single markdown audit report."""
import json
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

SEVERITY_ORDER = ["HIGH", "MED", "LOW", "INFO"]
SEVERITY_MARK = {
    "HIGH": "[HIGH]",
    "MED":  "[MED ]",
    "LOW":  "[LOW ]",
    "INFO": "[INFO]",
}


def _load(p: Path) -> dict | None:
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def _section(lines: list[str], title: str, phase: dict | None) -> None:
    lines.append(f"## {title}")
    lines.append("")
    if not phase:
        lines.append("_phase did not run_")
        lines.append("")
        return
    findings = phase.get("findings", [])
    summary = phase.get("summary")
    if summary:
        bits = ", ".join(f"{k}={v}" for k, v in summary.items())
        lines.append(f"_summary: {bits}_")
        lines.append("")
    if not findings:
        lines.append("_No issues._")
        lines.append("")
        return
    findings = sorted(
        findings,
        key=lambda f: (SEVERITY_ORDER.index(f.get("severity", "INFO")), f.get("category", "")),
    )
    for f in findings:
        mark = SEVERITY_MARK.get(f.get("severity", "INFO"), "[?   ]")
        path = f.get("path", "")
        msg = f.get("message", "")
        lines.append(f"- {mark} `{path}` — {msg}")
    lines.append("")


def main(ws_root: Path, tmp_dir: Path, out_path: Path) -> None:
    phases = {name: _load(tmp_dir / f"{name}.json") for name in ("static", "health", "consistency")}

    all_findings: list[dict] = []
    for data in phases.values():
        if data:
            all_findings.extend(data.get("findings", []))
    counts = Counter(f.get("severity", "INFO") for f in all_findings)

    lines: list[str] = []
    lines.append(f"# Workspace audit — {ws_root.name}")
    lines.append("")
    lines.append(f"- Generated: {datetime.now().isoformat(timespec='seconds')}")
    lines.append(f"- Workspace: `{ws_root}`")
    lines.append("")

    lines.append("## Summary")
    lines.append("")
    if not all_findings:
        lines.append("- No structural findings. Workspace looks healthy.")
    else:
        for sev in SEVERITY_ORDER:
            n = counts.get(sev, 0)
            if n:
                lines.append(f"- {SEVERITY_MARK[sev]} {sev}: {n}")
    lines.append("")

    _section(lines, "1. Static structure", phases["static"])
    _section(lines, "2. Operational health", phases["health"])
    _section(lines, "3. Self-consistency", phases["consistency"])

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"audit report → {out_path}")


if __name__ == "__main__":
    main(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve(), Path(sys.argv[3]))
