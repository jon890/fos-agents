#!/usr/bin/env python3
"""에이전트 사용량과 API 환산 비용을 집계한다.

세션 기록을 전수 읽어 월별 토큰과 비용을 낸다.
구독제로 결제했더라도 공개 API 단가로 환산하면 규모가 드러난다.

사용법:
    python3 agent_usage.py                 # 전체 기간
    python3 agent_usage.py --months 3      # 최근 3개월
    python3 agent_usage.py --json          # 기계 판독용
    python3 agent_usage.py --totals-json --source company  # 이 기기 기록을 합계 파일로 내보낸다
    python3 agent_usage.py --merge company.json  # 내보낸 다른 기기의 합계를 더한다

단가는 아래 표가 소유한다. 모델이 바뀌면 여기를 고친다.
Claude 단가는 Anthropic 공개 가격 페이지에서, OpenAI 단가는
`codex exec` 로 물어 공개 가격 페이지를 확인한 값이다.
"""
import json, os, glob, re, argparse, collections

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
CODEX_FIELDS = ("input", "cached", "output", "total")
MONTH = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
UNKNOWN_MODEL = "unknown"


def _int(value):
    """기록의 토큰 값. 정수가 아니면 0 으로 친다."""
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else 0


def claude_usage(u):
    """usage 한 줄을 칸별 토큰으로 나눈다. 1시간 cache 쓰기는 따로 센다."""
    cw = _int(u.get("cache_creation_input_tokens"))
    detail = u.get("cache_creation") if isinstance(u.get("cache_creation"), dict) else {}
    cw_1h = min(_int(detail.get("ephemeral_1h_input_tokens")), cw)
    return dict(
        input=_int(u.get("input_tokens")),
        cache_write_5m=cw - cw_1h,
        cache_write_1h=cw_1h,
        cache_read=_int(u.get("cache_read_input_tokens")),
        output=_int(u.get("output_tokens")),
    )


def claude_cost(model, t):
    """칸별 토큰의 환산 비용. 단가를 모르면 None. cache 쓰기는 5분 1.25배, 1시간 2배, 읽기 0.1배다."""
    p = claude_price(model)
    if not p:
        return None
    pi, po = p
    return (t["input"] * pi + t["cache_write_5m"] * pi * 1.25 + t["cache_write_1h"] * pi * 2.0
            + t["cache_read"] * pi * 0.1 + t["output"] * po) / 1_000_000


def codex_cost(model, t):
    """환산 비용. input 은 cached 를 포함한 값이다. 단가를 모르면 None."""
    p = OPENAI.get(model)
    if not p:
        return None
    fresh = max(t["input"] - t["cached"], 0)
    return (fresh * p[0] + t["cached"] * p[1] + t["output"] * p[2]) / 1_000_000


def empty_month():
    return dict(claude={}, codex={}, claude_sessions=0, codex_sessions=0)


def _add(models, model, t, fields):
    acc = models.setdefault(model, {f: 0 for f in fields})
    for f in fields:
        acc[f] += t[f]


def scan_claude(months):
    """~/.claude/projects 의 세션에서 달·모델별 칸 합계와 세션 수를 `months` 에 더한다.

    Claude Code 는 응답 하나를 여러 줄에 나눠 쓰고 줄마다 같은 usage 를 다시 적는다.
    그래서 응답 하나를 `message.id`(없으면 `requestId`)로 한 번만 세고, 칸마다 최댓값을 쓴다.
    뒤 줄일수록 output 만 늘어나기 때문이다. 둘 다 없는 줄은 줄마다 따로 센다.
    응답의 달은 처음 본 줄의 UTC 시각으로 정한다.
    세션 수는 `sessionId` 로 세고, 하위 에이전트 기록(`subagents/` 아래)은 세션으로 치지 않는다.
    """
    responses = {}  # 키 → [달, 모델, 칸별 토큰]
    sessions = collections.defaultdict(set)
    root = os.path.expanduser("~/.claude/projects")
    for fp in glob.glob(os.path.join(root, "**", "*.jsonl"), recursive=True):
        is_subagent = "subagents" in os.path.relpath(fp, root).split(os.sep)
        try:
            fh = open(fp, encoding="utf-8", errors="ignore")
        except OSError:
            continue
        with fh:
            for n, line in enumerate(fh):
                if '"usage"' not in line:
                    continue
                try:
                    d = json.loads(line)
                    msg = d.get("message") or {}
                    u = msg.get("usage")
                    if not isinstance(u, dict):
                        continue
                    ts = str(d.get("timestamp") or "")[:7]
                    if not is_subagent:
                        sessions[ts].add(d.get("sessionId") or fp)
                    key = msg.get("id") or d.get("requestId") or (fp, n)
                    t = claude_usage(u)
                    seen = responses.get(key)
                    if seen is None:
                        responses[key] = [ts, msg.get("model") or UNKNOWN_MODEL, t]
                    else:
                        seen[2] = {f: max(seen[2][f], t[f]) for f in CLAUDE_FIELDS}
                except Exception:
                    continue  # 깨진 줄 하나만 건너뛴다
    for ts, model, t in responses.values():
        _add(months.setdefault(ts, empty_month())["claude"], model, t, CLAUDE_FIELDS)
    for ts, ids in sessions.items():
        months.setdefault(ts, empty_month())["claude_sessions"] += len(ids)


def scan_codex(months):
    """~/.codex/sessions 의 세션마다 마지막 total_token_usage 를 달·모델별로 `months` 에 더한다."""
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
                            last, ts = t, str(d.get("timestamp") or "")[:7]
        except Exception:
            continue
        if not last:
            continue
        inp = _int(last.get("input_tokens"))
        out = _int(last.get("output_tokens"))
        t = dict(input=inp, cached=min(_int(last.get("cached_input_tokens")), inp), output=out,
                 total=max(_int(last.get("total_tokens")), inp + out))
        m = months.setdefault(ts or "?", empty_month())
        _add(m["codex"], model or UNKNOWN_MODEL, t, CODEX_FIELDS)
        m["codex_sessions"] += 1


def _count(value, where):
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f"{where} 는 0 이상 정수여야 한다")
    return value


def _exact(obj, keys, where):
    if not isinstance(obj, dict):
        raise ValueError(f"{where} 는 객체여야 한다")
    if set(obj) != set(keys):
        raise ValueError(f"{where} 의 키는 {', '.join(keys)} 여야 한다: {', '.join(sorted(obj))}")


def _models(value, fields, where):
    if not isinstance(value, dict):
        raise ValueError(f"{where} 는 모델별 객체여야 한다")
    out = {}
    for model, t in value.items():
        _exact(t, fields, f"{where}.{model}")
        out[model] = {f: _count(t[f], f"{where}.{model}.{f}") for f in fields}
    return out


def load_totals(fp):
    """`--totals-json` 이 내보낸 합계 파일을 읽어 (source, months) 를 돌려준다. 꼴이 다르면 ValueError.

    파일 하나는 한 기기의 기록이라는 전제다. 같은 기기의 세션을 여기서 다시 더하면 두 번 센다.
    """
    with open(fp, encoding="utf-8") as fh:
        d = json.load(fh)
    _exact(d, ("source", "months"), "합계 파일")
    if not isinstance(d["source"], str) or not d["source"]:
        raise ValueError("source 는 빈 값이 아닌 문자열이어야 한다")
    if not isinstance(d["months"], dict):
        raise ValueError("months 는 객체여야 한다")
    months = {}
    for month, m in d["months"].items():
        if not MONTH.match(month):
            raise ValueError(f"months 의 키는 YYYY-MM 이어야 한다: {month}")
        _exact(m, ("claude", "codex", "claude_sessions", "codex_sessions"), month)
        codex = _models(m["codex"], CODEX_FIELDS, f"{month}.codex")
        for model, t in codex.items():
            if t["cached"] > t["input"] or t["total"] < t["input"] + t["output"]:
                raise ValueError(f"{month}.codex.{model} 는 cached <= input, total >= input + output 이어야 한다")
        months[month] = dict(
            claude=_models(m["claude"], CLAUDE_FIELDS, f"{month}.claude"),
            codex=codex,
            claude_sessions=_count(m["claude_sessions"], f"{month}.claude_sessions"),
            codex_sessions=_count(m["codex_sessions"], f"{month}.codex_sessions"),
        )
    return d["source"], months


def merge_totals(months, extra):
    """합계 파일의 달별 값을 `months` 에 더한다."""
    for month, m in extra.items():
        acc = months.setdefault(month, empty_month())
        for model, t in m["claude"].items():
            _add(acc["claude"], model, t, CLAUDE_FIELDS)
        for model, t in m["codex"].items():
            _add(acc["codex"], model, t, CODEX_FIELDS)
        acc["claude_sessions"] += m["claude_sessions"]
        acc["codex_sessions"] += m["codex_sessions"]


def month_row(month, m):
    """달 하나의 칸 합계를 측정 계약의 한 줄로 바꾼다. 단가는 이 파일의 표로 환산한다."""
    tok = dict(claude=0, codex=0)
    cost = dict(claude=0.0, codex=0.0)
    unknown = 0
    for kind, fields, total_of, cost_of in (
        ("claude", CLAUDE_FIELDS, lambda t: sum(t[f] for f in CLAUDE_FIELDS), claude_cost),
        ("codex", CODEX_FIELDS, lambda t: t["total"], codex_cost),
    ):
        for model, t in m[kind].items():
            total = total_of(t)
            tok[kind] += total
            c = cost_of(model, t)
            if c is None:
                unknown += total
            else:
                cost[kind] += c
    return dict(
        month=month.replace("-", "."),
        claude_tokens=tok["claude"], codex_tokens=tok["codex"],
        claude_cost=round(cost["claude"], 2), codex_cost=round(cost["codex"], 2),
        sessions=m["claude_sessions"] + m["codex_sessions"],
        unpriced_tokens=unknown,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--months", type=int, default=0, help="최근 N개월만 (0이면 전체)")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--merge", action="append", default=[], metavar="FILE",
                    help="--totals-json 으로 내보낸 다른 기기의 합계를 더한다. 파일 하나는 한 기기의 기록이어야 한다")
    ap.add_argument("--totals-json", action="store_true",
                    help="이 기기 기록을 --merge 가 읽는 합계 파일 꼴로 낸다. --source 가 필요하다")
    ap.add_argument("--source", help="--totals-json 이 적을 기기 이름")
    args = ap.parse_args()

    if args.totals_json and (args.merge or args.json or not args.source):
        ap.error("--totals-json 은 --source 와 함께 쓰고 --merge, --json 과 같이 쓰지 않는다")
    extra, sources = [], set()
    for fp in args.merge:
        try:
            source, months_ = load_totals(fp)
        except (OSError, ValueError) as e:
            ap.error(f"--merge {fp}: {e}")
        if source in sources:
            ap.error(f"--merge: source 가 겹친다: {source}")
        sources.add(source)
        extra.append(months_)

    data = {}
    scan_claude(data)
    scan_codex(data)
    months = sorted(m for m in data if MONTH.match(m))
    if args.months:
        months = months[-args.months:]

    if args.totals_json:
        print(json.dumps(dict(source=args.source, months={m: data[m] for m in months}), ensure_ascii=False, indent=1))
        return

    for e in extra:
        merge_totals(data, e)
    months = sorted(m for m in data if MONTH.match(m))
    if args.months:
        months = months[-args.months:]

    rows, tt = [], dict(tok=0, cc=0.0, cx=0.0, sess=0, unknown=0)
    for m in months:
        row = month_row(m, data[m])
        rows.append(row)
        tt["tok"] += row["claude_tokens"] + row["codex_tokens"]
        tt["cc"] += row["claude_cost"]
        tt["cx"] += row["codex_cost"]
        tt["sess"] += row["sessions"]
        tt["unknown"] += row["unpriced_tokens"]

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
