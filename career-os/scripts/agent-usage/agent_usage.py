#!/usr/bin/env python3
"""에이전트 사용량과 API 환산 비용을 집계한다.

세션 기록을 전수 읽어 월별 토큰과 비용을 낸다.
구독제로 결제했더라도 공개 API 단가로 환산하면 규모가 드러난다.

사용법:
    python3 agent_usage.py                 # 전체 기간
    python3 agent_usage.py --months 3      # 최근 3개월
    python3 agent_usage.py --json          # 기계 판독용
    python3 agent_usage.py --merge company.json  # 다른 기기의 월별 합계를 더한다

단가는 아래 표가 소유한다. 모델이 바뀌면 여기를 고친다.
Claude 단가는 Anthropic 공개 가격 페이지에서, OpenAI 단가는
`codex exec` 로 물어 공개 가격 페이지를 확인한 값이다.
"""
import json, os, glob, re, argparse, collections
from datetime import datetime

CLAUDE = {  # $/1M — input, output. 캐시 쓰기 5분 1.25배, 1시간 2배, 캐시 읽기 0.1배
    "claude-opus-5": (5.0, 25.0), "claude-opus-4-8": (5.0, 25.0),
    "claude-opus-4-7": (5.0, 25.0), "claude-opus-4-6": (5.0, 25.0),
    "claude-sonnet-5": (2.0, 10.0), "claude-sonnet-4-6": (3.0, 15.0),
    "claude-haiku-4-5": (1.0, 5.0),
}
OPENAI = {  # $/1M — input, cached input, output
    "gpt-5.6-sol": (4.0, 0.40, 20.0), "gpt-5.6-terra": (2.0, 0.20, 12.0),
    "gpt-5.6-luna": (0.20, 0.02, 1.20), "gpt-5.5": (5.0, 0.50, 30.0),
    "gpt-5.4-mini": (0.75, 0.075, 4.50), "gpt-6-astra": (10.0, 1.0, 50.0),
    "gpt-5.1-codex-max": (1.25, 0.125, 10.0),
}


def claude_price(model):
    m = (model or "").lower()
    for k, v in CLAUDE.items():
        if m.startswith(k):
            return v
    for key, v in (("opus", (5.0, 25.0)), ("sonnet", (2.0, 10.0)), ("haiku", (1.0, 5.0))):
        if key in m:
            return v
    return None


CLAUDE_FIELDS = ("input", "cache_write_5m", "cache_write_1h", "cache_read", "output")


def claude_usage(u):
    """usage 한 줄을 칸별 토큰으로 나눈다. 1시간 cache 쓰기는 따로 센다."""
    cw = u.get("cache_creation_input_tokens", 0) or 0
    detail = u.get("cache_creation") if isinstance(u.get("cache_creation"), dict) else {}
    cw_1h = min(detail.get("ephemeral_1h_input_tokens", 0) or 0, cw)
    return dict(
        input=u.get("input_tokens", 0) or 0,
        cache_write_5m=cw - cw_1h,
        cache_write_1h=cw_1h,
        cache_read=u.get("cache_read_input_tokens", 0) or 0,
        output=u.get("output_tokens", 0) or 0,
    )


def claude_cost(model, t):
    """칸별 토큰의 환산 비용. 단가를 모르면 None. cache 쓰기는 5분 1.25배, 1시간 2배, 읽기 0.1배다."""
    p = claude_price(model)
    if not p:
        return None
    pi, po = p
    return (t["input"] * pi + t["cache_write_5m"] * pi * 1.25 + t["cache_write_1h"] * pi * 2.0
            + t["cache_read"] * pi * 0.1 + t["output"] * po) / 1_000_000


def scan_claude():
    """~/.claude/projects 의 세션에서 usage 를 모은다.

    Claude Code 는 응답 하나를 여러 줄에 나눠 쓰고 줄마다 같은 usage 를 다시 적는다.
    그래서 `message.id` 와 `requestId` 를 묶은 키로 응답 하나를 한 번만 세고, 칸마다 최댓값을 쓴다.
    뒤 줄일수록 output 만 늘어나기 때문이다. 키가 없는 줄은 줄마다 따로 센다.
    세션 수는 `sessionId` 로 세고, 하위 에이전트 기록(`subagents/` 아래)은 세션으로 치지 않는다.
    """
    responses = {}  # 키 → [달, 모델, 칸별 토큰]
    sessions = collections.defaultdict(set)
    root = os.path.expanduser("~/.claude/projects")
    for fp in glob.glob(os.path.join(root, "**", "*.jsonl"), recursive=True):
        is_subagent = "subagents" in os.path.relpath(fp, root).split(os.sep)
        try:
            with open(fp, encoding="utf-8", errors="ignore") as fh:
                for n, line in enumerate(fh):
                    if '"usage"' not in line:
                        continue
                    try:
                        d = json.loads(line)
                    except Exception:
                        continue
                    msg = d.get("message") or {}
                    u = msg.get("usage")
                    if not isinstance(u, dict):
                        continue
                    ts = (d.get("timestamp") or "")[:7]
                    if not is_subagent:
                        sessions[ts].add(d.get("sessionId") or fp)
                    mid, rid = msg.get("id"), d.get("requestId")
                    key = (mid, rid) if mid or rid else (fp, n)
                    t = claude_usage(u)
                    seen = responses.get(key)
                    if seen is None:
                        responses[key] = [ts, msg.get("model"), t]
                    else:
                        seen[2] = {f: max(seen[2][f], t[f]) for f in CLAUDE_FIELDS}
        except Exception:
            continue

    out = collections.defaultdict(lambda: dict(tok=0, cost=0.0, sessions=0, unknown=0))
    for ts, model, t in responses.values():
        a = out[ts]
        total = sum(t.values())
        a["tok"] += total
        c = claude_cost(model, t)
        if c is None:
            a["unknown"] += total
        else:
            a["cost"] += c
    for ts, ids in sessions.items():
        out[ts]["sessions"] = len(ids)
    return out


def codex_cost(model, inp, cached, output):
    """환산 비용. input 은 cached 를 포함한 값이다. 단가를 모르면 None."""
    p = OPENAI.get(model)
    if not p:
        return None
    fresh = max(inp - cached, 0)
    return (fresh * p[0] + cached * p[1] + output * p[2]) / 1_000_000


def scan_codex():
    """~/.codex/sessions 의 세션마다 마지막 total_token_usage 를 쓴다."""
    out = collections.defaultdict(lambda: dict(tok=0, cost=0.0, sessions=0, unknown=0))
    for fp in glob.glob(os.path.expanduser("~/.codex/sessions/**/*.jsonl"), recursive=True):
        last, ts, model = None, None, None
        try:
            with open(fp, encoding="utf-8", errors="ignore") as fh:
                for line in fh:
                    if model is None and '"model"' in line:
                        m = re.search(r'"model"\s*:\s*"([^"]+)"', line)
                        if m:
                            model = m.group(1)
                    if '"total_token_usage"' in line:
                        try:
                            d = json.loads(line)
                        except Exception:
                            continue
                        t = ((d.get("payload") or {}).get("info") or {}).get("total_token_usage")
                        if isinstance(t, dict):
                            last, ts = t, (d.get("timestamp") or "")[:7]
        except Exception:
            continue
        if not last:
            continue
        a = out[ts or "?"]
        total = last.get("total_tokens", 0) or 0
        a["tok"] += total
        a["sessions"] += 1
        c = codex_cost(model, last.get("input_tokens", 0) or 0, last.get("cached_input_tokens", 0) or 0,
                       last.get("output_tokens", 0) or 0)
        if c is None:
            a["unknown"] += total
        else:
            a["cost"] += c
    return out


MONTH = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
TOTALS_CODEX_FIELDS = ("input", "cached", "output", "total")


def _count(value, where):
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f"{where} 는 0 이상 정수여야 한다")
    return value


def _models(value, fields, where):
    if not isinstance(value, dict):
        raise ValueError(f"{where} 는 모델별 객체여야 한다")
    out = {}
    for model, t in value.items():
        if not isinstance(t, dict):
            raise ValueError(f"{where}.{model} 는 객체여야 한다")
        out[model] = {f: _count(t.get(f), f"{where}.{model}.{f}") for f in fields}
    return out


def load_totals(fp):
    """다른 기기에서 뽑은 월별 합계 파일을 읽는다. 꼴이 다르면 ValueError.

    파일 하나는 한 기기의 기록이라는 전제다. 같은 기기의 세션을 여기서 다시 더하면 두 번 센다.
    """
    with open(fp, encoding="utf-8") as fh:
        d = json.load(fh)
    if not isinstance(d, dict) or not isinstance(d.get("source"), str) or not isinstance(d.get("months"), dict):
        raise ValueError("합계 파일은 source 문자열과 months 객체를 가져야 한다")
    months = {}
    for month, m in d["months"].items():
        if not MONTH.match(month) or not isinstance(m, dict):
            raise ValueError(f"months 의 키는 YYYY-MM, 값은 객체여야 한다: {month}")
        months[month] = dict(
            claude=_models(m.get("claude", {}), CLAUDE_FIELDS, f"{month}.claude"),
            codex=_models(m.get("codex", {}), TOTALS_CODEX_FIELDS, f"{month}.codex"),
            claude_sessions=_count(m.get("claude_sessions", 0), f"{month}.claude_sessions"),
            codex_sessions=_count(m.get("codex_sessions", 0), f"{month}.codex_sessions"),
        )
    return months


def merge_totals(cc, cx, months):
    """합계 파일의 달별 값을 측정값에 더한다. 단가는 이 파일의 표로 다시 환산한다."""
    for month, m in months.items():
        a, b = cc[month], cx[month]
        for model, t in m["claude"].items():
            total = sum(t.values())
            a["tok"] += total
            c = claude_cost(model, t)
            if c is None:
                a["unknown"] += total
            else:
                a["cost"] += c
        for model, t in m["codex"].items():
            b["tok"] += t["total"]
            c = codex_cost(model, t["input"], t["cached"], t["output"])
            if c is None:
                b["unknown"] += t["total"]
            else:
                b["cost"] += c
        a["sessions"] += m["claude_sessions"]
        b["sessions"] += m["codex_sessions"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--months", type=int, default=0, help="최근 N개월만 (0이면 전체)")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--merge", action="append", default=[], metavar="FILE",
                    help="다른 기기의 월별 합계 JSON 을 더한다. 파일 하나는 한 기기의 기록이어야 한다")
    args = ap.parse_args()

    try:
        extra = [load_totals(fp) for fp in args.merge]
    except (OSError, ValueError) as e:
        ap.error(f"--merge: {e}")
    cc, cx = scan_claude(), scan_codex()
    for months in extra:
        merge_totals(cc, cx, months)
    months = sorted({m for m in list(cc) + list(cx) if m and m != "?"})
    if args.months:
        months = months[-args.months:]

    rows, tt = [], dict(tok=0, cc=0.0, cx=0.0, sess=0, unknown=0)
    for m in months:
        a, b = cc.get(m, {}), cx.get(m, {})
        row = dict(
            month=m.replace("-", "."),
            claude_tokens=a.get("tok", 0), codex_tokens=b.get("tok", 0),
            claude_cost=round(a.get("cost", 0.0), 2), codex_cost=round(b.get("cost", 0.0), 2),
            sessions=a.get("sessions", 0) + b.get("sessions", 0),
            unpriced_tokens=a.get("unknown", 0) + b.get("unknown", 0),
        )
        rows.append(row)
        tt["tok"] += row["claude_tokens"] + row["codex_tokens"]
        tt["cc"] += row["claude_cost"]
        tt["cx"] += row["codex_cost"]
        tt["sess"] += row["sessions"]
        tt["unknown"] += a.get("unknown", 0) + b.get("unknown", 0)

    if args.json:
        print(json.dumps(dict(months=rows, total=dict(
            tokens=tt["tok"], claude_cost=round(tt["cc"], 2), codex_cost=round(tt["cx"], 2),
            total_cost=round(tt["cc"] + tt["cx"], 2), sessions=tt["sess"],
            unpriced_tokens=tt["unknown"],
        )), ensure_ascii=False, indent=1))
        return

    print(f"{'월':9s} {'Claude':>14s} {'Codex':>14s} {'세션':>7s} {'환산 비용':>12s}")
    for r in rows:
        cost = r["claude_cost"] + r["codex_cost"]
        print(f"{r['month']:9s} {r['claude_tokens']:>14,} {r['codex_tokens']:>14,} {r['sessions']:>7,} ${cost:>11,.0f}")
    print()
    print(f"총 토큰      {tt['tok']:,} ({tt['tok']/1e9:.1f}B)")
    print(f"총 세션      {tt['sess']:,}")
    print(f"환산 비용    ${tt['cc']+tt['cx']:,.0f}  (Claude ${tt['cc']:,.0f} + Codex ${tt['cx']:,.0f})")
    if tt["unknown"]:
        print(f"단가 미상    {tt['unknown']:,} 토큰 ({tt['unknown']/tt['tok']*100:.1f}%) — 비용에서 제외")


if __name__ == "__main__":
    main()
