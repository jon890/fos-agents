#!/usr/bin/env python3
"""Print a one-line cost summary for the latest run of a task in a workspace's
`logs/task-runs.jsonl`. Intended to be appended to a Discord/Slack/console
completion notification.

Usage:
    format_cost_summary.py <workspace-root> <task-name>

Output:
    " · $0.5157 · opus-4-7[1m] · 0→6k tokens · cache 55k · 93s"

If no entry is found or required fields are missing, prints an empty string —
safe to concatenate unconditionally:

    COST_LINE="$(format_cost_summary.py "$TASK_ROOT" "$TASK")"
    notify "[완료] ${TOPIC}${COST_LINE}"

Errors (missing args, malformed JSONL, etc.) result in empty output, never a
non-zero exit, so the calling notification cannot be broken by this helper.
"""
import json
import sys
from pathlib import Path


def _short_tokens(n) -> str | None:
    try:
        n = int(n)
    except (TypeError, ValueError):
        return None
    if n <= 0:
        return "0"
    if n >= 1000:
        s = f"{n / 1000:.1f}k"
        if s.endswith(".0k"):
            s = s[:-3] + "k"
        return s
    return str(n)


def _short_model(model: str | None) -> str | None:
    if not model:
        return None
    # claude-sonnet-4-6 → sonnet-4-6, claude-opus-4-7[1m] → opus-4-7[1m]
    if model.startswith("claude-"):
        return model[len("claude-"):]
    return model


def _latest_entry(log_path: Path, task_name: str) -> dict | None:
    latest = None
    try:
        text = log_path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return None
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
        except Exception:
            continue
        if entry.get("task_name") == task_name:
            latest = entry
    return latest


def format_summary(entry: dict) -> str:
    parts: list[str] = []

    cost = entry.get("cost_usd")
    if isinstance(cost, (int, float)) and cost > 0:
        parts.append(f"${cost:.4f}")

    model = _short_model(entry.get("model"))
    if model:
        parts.append(model)

    ti = _short_tokens(entry.get("tokens_in_delta"))
    to = _short_tokens(entry.get("tokens_out_delta"))
    if ti is not None and to is not None and (ti != "0" or to != "0"):
        parts.append(f"{ti}→{to} tokens")

    cached = _short_tokens(entry.get("cache_read_input_tokens"))
    if cached and cached != "0":
        parts.append(f"cache {cached}")

    dur = entry.get("duration_sec")
    if isinstance(dur, (int, float)) and dur > 0:
        parts.append(f"{int(dur)}s")

    if not parts:
        return ""
    return " · " + " · ".join(parts)


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        return 0  # silent — empty output
    ws_root = Path(argv[1])
    task_name = argv[2]
    log_path = ws_root / "logs" / "task-runs.jsonl"
    entry = _latest_entry(log_path, task_name)
    if entry is None:
        return 0
    sys.stdout.write(format_summary(entry))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv))
    except Exception:
        # Never break the caller's notification on a helper bug.
        sys.exit(0)
