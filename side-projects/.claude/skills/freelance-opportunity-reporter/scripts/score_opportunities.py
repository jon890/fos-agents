#!/usr/bin/env python3
"""JSON 외주 공고 목록에 일관된 점수를 매긴다."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def clamp(value: float, low: float = 0, high: float = 100) -> float:
    return max(low, min(high, value))


def budget_score(budget_krw: int | float | None) -> float:
    if not budget_krw:
        return 8
    if budget_krw < 1_000_000:
        return 10
    if budget_krw < 3_000_000:
        return 16
    if budget_krw < 10_000_000:
        return 22
    if budget_krw < 30_000_000:
        return 24
    return 18


def competition_score(applicants: int | None) -> float:
    if applicants is None:
        return 10
    if applicants == 0:
        return 18
    if applicants <= 3:
        return 16
    if applicants <= 10:
        return 12
    if applicants <= 25:
        return 7
    return 3


def duration_score(days: int | None) -> float:
    if not days:
        return 6
    if days <= 21:
        return 12
    if days <= 60:
        return 10
    if days <= 120:
        return 7
    return 3


def score(item: dict, remote_only: bool = False) -> dict:
    fit = float(item.get("fit", 3))
    risk = float(item.get("risk", 3))
    portfolio = float(item.get("portfolio", 3))
    remote = float(item.get("remote", 3))

    total = (
        budget_score(item.get("budget_krw"))
        + competition_score(item.get("applicants"))
        + duration_score(item.get("duration_days"))
        + fit * 7
        + portfolio * 4
        + remote * 2
        - risk * 6
    )
    total = round(clamp(total), 1)

    remote_only_pass = item.get("remote_only_pass")
    remote_blocked = remote_only_pass is False or remote <= 1

    if remote_only and remote_blocked:
        total = min(total, 49)
        action = "avoid"
    elif remote_only and remote_only_pass is None and total >= 80:
        action = "clarify-first"
    elif total >= 80:
        action = "apply-now"
    elif total >= 65:
        action = "clarify-first"
    elif total >= 50:
        action = "clarify-first"
    else:
        action = "avoid"

    return {**item, "score": total, "action": action}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("--pretty", action="store_true")
    parser.add_argument("--remote-only", action="store_true")
    args = parser.parse_args()

    items = json.loads(args.input.read_text(encoding="utf-8"))
    scored = sorted(
        (score(item, remote_only=args.remote_only) for item in items),
        key=lambda row: row["score"],
        reverse=True,
    )
    print(json.dumps(scored, ensure_ascii=False, indent=2 if args.pretty else None))


if __name__ == "__main__":
    main()
