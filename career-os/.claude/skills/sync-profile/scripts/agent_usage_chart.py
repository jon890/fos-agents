#!/usr/bin/env python3
"""GitHub 프로필에 넣는 월별 토큰 막대 차트(SVG)를 그린다.

사용법:
    agent_usage_chart.py --month 2026.07=1.3,11.6 --month 2026.08=19.0,5.7 --out agent-usage.svg

`--month` 는 `<월>=<Claude Code>,<Codex>` 이고 단위는 십억(B) 토큰이다.
값은 `library/profiles/github-agent-usage-snapshots.md` 의 측정 기록에서 가져온다.
지난 달을 `agent_usage.py` 로 다시 세어 넣지 않는다. 세션 기록이 지워져 값이 줄어든다.

합계는 표준 출력에 한 줄로 낸다. 프로필의 Tokens 배지에 그 값을 쓴다.
"""

import argparse

WIDTH, HEIGHT = 760, 236
LEFT, RIGHT, TOP, BASE = 64, 740, 44.0, 192.0
BAR_WIDTH = 94.6
FONT = 'font-family="ui-monospace,monospace"'


def parse_month(value: str) -> tuple[str, float, float]:
    try:
        month, numbers = value.split("=", 1)
        claude, codex = (float(part) for part in numbers.split(","))
    except ValueError as error:
        raise argparse.ArgumentTypeError(f"<월>=<Claude>,<Codex> 모양이 아니다: {value}") from error
    if claude < 0 or codex < 0:
        raise argparse.ArgumentTypeError(f"음수는 받지 않는다: {value}")
    return month, claude, codex


def billions(value: float) -> str:
    return f"{value:.1f}B"


def render(months: list[tuple[str, float, float]]) -> str:
    peak = max(claude + codex for _, claude, codex in months)
    span = BASE - TOP
    slot = (RIGHT - LEFT) / len(months)
    head = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-label="Tokens processed per month">',
        f'<rect width="{WIDTH}" height="{HEIGHT}" fill="#0d1117" rx="8"/>',
        f'<text x="64" y="25" fill="#c9d1d9" font-size="13" font-weight="700" {FONT}>Tokens processed / month</text>',
        f'<rect x="528" y="15" width="9" height="9" fill="#26d0ce" rx="2"/><text x="542" y="24" fill="#8b949e" font-size="11" {FONT}>Claude Code</text>',
        f'<rect x="644" y="15" width="9" height="9" fill="#7b61ff" rx="2"/><text x="658" y="24" fill="#8b949e" font-size="11" {FONT}>Codex</text>',
    ]
    body, labels = [], []
    for fraction, label in ((0, "0"), (0.5, billions(peak / 2)), (1, billions(peak))):
        y = BASE - span * fraction
        body.append(
            f'<line x1="{LEFT}" y1="{y:.1f}" x2="{RIGHT}" y2="{y:.1f}" stroke="#21262d" stroke-width="1"/>'
            f'<text x="54" y="{y + 4:.1f}" fill="#6e7681" font-size="10" text-anchor="end" {FONT}>{label}</text>'
        )
    for index, (month, claude, codex) in enumerate(months):
        center = LEFT + slot * (index + 0.5)
        x = center - BAR_WIDTH / 2
        claude_height, codex_height = span * claude / peak, span * codex / peak
        claude_y = BASE - claude_height
        codex_y = claude_y - codex_height
        if codex_height > 0.05:
            body.append(
                f'<rect x="{x:.1f}" y="{codex_y:.1f}" width="{BAR_WIDTH}" height="{codex_height:.1f}" fill="#7b61ff" rx="4">'
                f'<animate attributeName="height" from="0" to="{codex_height:.1f}" dur="1s" fill="freeze"/>'
                f'<animate attributeName="y" from="{claude_y:.1f}" to="{codex_y:.1f}" dur="1s" fill="freeze"/></rect>'
            )
        if claude_height > 0.05:
            body.append(
                f'<rect x="{x:.1f}" y="{claude_y:.1f}" width="{BAR_WIDTH}" height="{claude_height:.1f}" fill="#26d0ce" rx="4">'
                f'<animate attributeName="height" from="0" to="{claude_height:.1f}" dur="1s" fill="freeze"/>'
                f'<animate attributeName="y" from="{BASE:.0f}" to="{claude_y:.1f}" dur="1s" fill="freeze"/></rect>'
            )
        labels.append(
            f'<text x="{center:.1f}" y="{codex_y - 10:.1f}" fill="#e6edf3" font-size="15" font-weight="700" text-anchor="middle" {FONT}>{billions(claude + codex)}</text>'
            f'<text x="{center:.1f}" y="213" fill="#8b949e" font-size="12" text-anchor="middle" {FONT}>{month}</text>'
        )
    return "\n".join(head + ["".join(body) + "".join(labels), "</svg>"]) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--month", action="append", type=parse_month, required=True, metavar="<월>=<Claude>,<Codex>")
    parser.add_argument("--out", required=True, help="SVG 를 쓸 경로")
    args = parser.parse_args()
    with open(args.out, "w", encoding="utf-8") as handle:
        handle.write(render(args.month))
    total = sum(claude + codex for _, claude, codex in args.month)
    print(f"total={billions(total)} months={len(args.month)} out={args.out}")


if __name__ == "__main__":
    main()
