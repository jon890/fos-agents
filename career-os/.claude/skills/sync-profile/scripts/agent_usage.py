#!/usr/bin/env python3
"""에이전트 사용량과 API 환산 비용을 집계한다.

세션 기록을 전수 읽어 월별 토큰과 비용을 낸다.
구독제로 결제했더라도 공개 API 단가로 환산하면 규모가 드러난다.

사용법:
    python3 agent_usage.py                 # 전체 기간
    python3 agent_usage.py --months 3      # 최근 3개월
    python3 agent_usage.py --json          # 기계 판독용

단가는 아래 표가 소유한다. 모델이 바뀌면 여기를 고친다.
Claude 단가는 Anthropic 공개 가격 페이지에서, OpenAI 단가는
`codex exec` 로 물어 공개 가격 페이지를 확인한 값이다.
"""
import json, os, glob, re, argparse, collections
from datetime import datetime

CLAUDE = {  # $/1M — input, output. 캐시 쓰기 1.25배, 캐시 읽기 0.1배
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


def scan_claude():
    """~/.claude/projects 의 세션에서 usage 를 모은다."""
    out = collections.defaultdict(lambda: dict(tok=0, cost=0.0, sessions=set(), unknown=0))
    for fp in glob.glob(os.path.expanduser("~/.claude/projects/**/*.jsonl"), recursive=True):
        try:
            with open(fp, encoding="utf-8", errors="ignore") as fh:
                for line in fh:
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
                    inp = u.get("input_tokens", 0) or 0
                    cw = u.get("cache_creation_input_tokens", 0) or 0
                    cr = u.get("cache_read_input_tokens", 0) or 0
                    out_t = u.get("output_tokens", 0) or 0
                    total = inp + cw + cr + out_t
                    ts = (d.get("timestamp") or "")[:7]
                    a = out[ts]
                    a["tok"] += total
                    a["sessions"].add(fp)
                    p = claude_price(msg.get("model"))
                    if p:
                        pi, po = p
                        a["cost"] += (inp * pi + cw * pi * 1.25 + cr * pi * 0.1 + out_t * po) / 1_000_000
                    else:
                        a["unknown"] += total
        except Exception:
            continue
    return out


def scan_codex():
    """~/.codex/sessions 의 세션마다 마지막 total_token_usage 를 쓴다."""
    out = collections.defaultdict(lambda: dict(tok=0, cost=0.0, sessions=set(), unknown=0))
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
        a["tok"] += last.get("total_tokens", 0) or 0
        a["sessions"].add(fp)
        p = OPENAI.get(model)
        if p:
            inp = last.get("input_tokens", 0) or 0
            cached = last.get("cached_input_tokens", 0) or 0
            fresh = max(inp - cached, 0)
            a["cost"] += (fresh * p[0] + cached * p[1] + (last.get("output_tokens", 0) or 0) * p[2]) / 1_000_000
        else:
            a["unknown"] += last.get("total_tokens", 0) or 0
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--months", type=int, default=0, help="최근 N개월만 (0이면 전체)")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    cc, cx = scan_claude(), scan_codex()
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
            sessions=len(a.get("sessions", set())) + len(b.get("sessions", set())),
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
