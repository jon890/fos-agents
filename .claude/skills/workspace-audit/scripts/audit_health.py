#!/usr/bin/env python3
"""Operational health audit from logs/task-runs.jsonl and data/YYYY-MM-DD/."""
import json
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

RECENT_WINDOW = 14
TOKEN_WINDOW = 30


def _safe_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return None


def _token_total(entry: dict) -> int:
    ti = entry.get("tokens_in_delta") or 0
    to = entry.get("tokens_out_delta") or 0
    return int(ti) + int(to)


def main(ws_root: Path) -> None:
    findings: list[dict] = []
    summary: dict = {"task_count": 0, "total_runs": 0}

    run_log = ws_root / "logs" / "task-runs.jsonl"
    if not run_log.exists():
        # Travel-style workspaces don't have logs/ — INFO, not a problem.
        findings.append({
            "severity": "INFO",
            "category": "health.no_log",
            "path": "logs/task-runs.jsonl",
            "message": "No task-runs.jsonl (workspace may not use the tracker)",
        })
    else:
        entries: list[dict] = []
        for line in run_log.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except Exception:
                pass

        summary["total_runs"] = len(entries)

        if not entries:
            findings.append({
                "severity": "INFO",
                "category": "health.empty_log",
                "path": "logs/task-runs.jsonl",
                "message": "Log file exists but is empty",
            })
        else:
            by_task: dict[str, list[dict]] = defaultdict(list)
            for e in entries:
                by_task[e.get("task_name", "?")].append(e)
            summary["task_count"] = len(by_task)

            now = datetime.now().astimezone()

            for task, runs in sorted(by_task.items()):
                runs_sorted = sorted(runs, key=lambda r: r.get("start_time", ""))
                last_success = next(
                    (r for r in reversed(runs_sorted) if r.get("status") == "success"),
                    None,
                )

                success_dates = {
                    _safe_iso(r.get("start_time")).date()
                    for r in runs_sorted
                    if r.get("status") == "success" and _safe_iso(r.get("start_time")) is not None
                }
                is_one_shot = len(success_dates) <= 1

                if last_success is None:
                    if len(runs_sorted) >= 3:
                        findings.append({
                            "severity": "HIGH",
                            "category": "health.no_success",
                            "path": f"task:{task}",
                            "message": f"No successful run on record ({len(runs_sorted)} attempts)",
                        })
                    # else: probably a one-shot that failed once — not worth flagging
                elif not is_one_shot:
                    ts = _safe_iso(last_success.get("start_time"))
                    if ts is not None:
                        age_days = (now - ts).days
                        if age_days > 7:
                            findings.append({
                                "severity": "HIGH",
                                "category": "health.stale",
                                "path": f"task:{task}",
                                "message": f"Last success {age_days}d ago ({ts.date()})",
                            })
                        elif age_days > 2:
                            findings.append({
                                "severity": "MED",
                                "category": "health.aging",
                                "path": f"task:{task}",
                                "message": f"Last success {age_days}d ago ({ts.date()})",
                            })

                window = runs_sorted[-RECENT_WINDOW:]
                fails = [r for r in window if r.get("status") != "success"]
                if len(window) >= 5 and len(fails) / len(window) >= 0.3:
                    findings.append({
                        "severity": "MED",
                        "category": "health.failure_rate",
                        "path": f"task:{task}",
                        "message": f"{len(fails)}/{len(window)} recent runs failed",
                    })

                token_runs = runs_sorted[-TOKEN_WINDOW:]
                toks = [_token_total(r) for r in token_runs]
                toks = [t for t in toks if t > 0]
                if len(toks) >= 5:
                    mean = sum(toks) / len(toks)
                    var = sum((t - mean) ** 2 for t in toks) / len(toks)
                    std = var ** 0.5
                    last_tok = _token_total(runs_sorted[-1])
                    if last_tok > 0 and std > 0 and abs(last_tok - mean) > 2 * std:
                        findings.append({
                            "severity": "LOW",
                            "category": "health.token_outlier",
                            "path": f"task:{task}",
                            "message": f"Last run tokens={last_tok} vs mean={mean:.0f} (±{std:.0f})",
                        })

    # data/YYYY-MM-DD/ analysis
    data_dir = ws_root / "data"
    if data_dir.is_dir():
        date_dirs: list[tuple[datetime, Path]] = []
        for d in data_dir.iterdir():
            if not d.is_dir() or len(d.name) != 10 or d.name[4] != "-" or d.name[7] != "-":
                continue
            try:
                date_dirs.append((datetime.strptime(d.name, "%Y-%m-%d"), d))
            except Exception:
                pass

        if date_dirs:
            date_dirs.sort()
            most_recent = date_dirs[-1][0]
            gap_days = (datetime.now() - most_recent).days
            if gap_days >= 7:
                findings.append({
                    "severity": "HIGH",
                    "category": "health.data_gap",
                    "path": "data/",
                    "message": f"Most recent data dir is {gap_days}d old ({most_recent.date()})",
                })
            elif gap_days >= 3:
                findings.append({
                    "severity": "MED",
                    "category": "health.data_gap",
                    "path": "data/",
                    "message": f"Most recent data dir is {gap_days}d old ({most_recent.date()})",
                })

            cutoff = datetime.now() - timedelta(days=14)
            for dt, d in date_dirs:
                if dt < cutoff:
                    continue
                try:
                    if not any(d.iterdir()):
                        findings.append({
                            "severity": "LOW",
                            "category": "health.empty_data_dir",
                            "path": str(d.relative_to(ws_root)),
                            "message": "Recent date directory is empty",
                        })
                except Exception:
                    pass

    print(json.dumps(
        {"phase": "health", "findings": findings, "summary": summary},
        ensure_ascii=False,
        indent=2,
    ))


if __name__ == "__main__":
    main(Path(sys.argv[1]).resolve())
