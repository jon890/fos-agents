#!/usr/bin/env python3
"""Build 7-day Naver listing price-band trend from collected apartment snapshots.

Inputs are the existing data/*-guri-buy-search/naver-<complexNo>.json files.
Outputs by default:
- weekly-price-trend.json
- weekly-price-trend.md
- weekly-price-trend.png

Use --prefix monthly-price-trend --days 30 for the monthly asking-price table/chart.

The chart is intentionally generated with Pillow only so the cron task does not
need matplotlib/seaborn.
"""

from __future__ import annotations

import argparse
import json
import math
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from statistics import median
from typing import Any

from PIL import Image, ImageDraw, ImageFont

DEFAULT_COMPLEXES = ["1649", "24858", "1652", "1642", "1659", "1660", "1661", "1662"]
DEFAULT_LABELS = {
    "1649": "LG원앙",
    "24858": "럭키",
    "1652": "대림한숲",
    "1642": "덕현",
    "1659": "인창1주공",
    "1660": "인창2주공",
    "1661": "인창4주공",
    "1662": "인창6주공",
}

PRICE_RE = re.compile(r"(?:(\d+)억)?\s*(?:(\d{1,3}(?:,\d{3})*)\s*)?$")
DATE_PREFIX_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})")


@dataclass
class DailyBand:
    day: str
    complex_no: str
    complex_name: str
    area_key: str
    count: int
    min_price: int
    median_price: int
    max_price: int


def parse_price_manwon(value: Any) -> int | None:
    if isinstance(value, (int, float)):
        return int(value)
    text = str(value or "").strip().replace(" ", "")
    if not text:
        return None
    # Examples: 7억 9,000 / 10억 / 6억7000 / 69000
    if "억" in text:
        eok_part, _, rest = text.partition("억")
        try:
            eok = int(re.sub(r"\D", "", eok_part) or "0")
        except ValueError:
            return None
        rest_digits = re.sub(r"\D", "", rest)
        rest_manwon = int(rest_digits) if rest_digits else 0
        return eok * 10000 + rest_manwon
    digits = re.sub(r"\D", "", text)
    if not digits:
        return None
    return int(digits)


def format_price(manwon: int | float | None) -> str:
    if manwon is None:
        return "-"
    manwon = int(round(manwon))
    eok, rest = divmod(manwon, 10000)
    if eok and rest:
        return f"{eok}억 {rest:,}"
    if eok:
        return f"{eok}억"
    return f"{rest:,}만"


def pct_change(now: int | None, before: int | None) -> float | None:
    if now is None or before in (None, 0):
        return None
    return (now - before) / before * 100


def fmt_pct(value: float | None) -> str:
    if value is None or math.isnan(value):
        return "-"
    sign = "+" if value > 0 else ""
    return f"{sign}{value:.1f}%"


def find_snapshots(data_root: Path, end_day: date, lookback_days: int) -> list[Path]:
    start_day = end_day - timedelta(days=lookback_days - 1)
    paths: list[Path] = []
    for p in data_root.iterdir():
        if not p.is_dir():
            continue
        m = DATE_PREFIX_RE.match(p.name)
        if not m:
            continue
        try:
            d = datetime.strptime(m.group(1), "%Y-%m-%d").date()
        except ValueError:
            continue
        if start_day <= d <= end_day:
            paths.extend(sorted(p.glob("naver-*.json")))
    return paths


def load_daily_bands(paths: list[Path], complexes: set[str]) -> dict[tuple[str, str, str], DailyBand]:
    # Several ad-hoc runs can exist for the same date. Use one snapshot per
    # day/complex to avoid multiplying listing counts. Sorting by parent name is
    # enough for our YYYY-MM-DD-HHMM directory convention; later runs win.
    latest_path: dict[tuple[str, str], Path] = {}
    for path in sorted(paths, key=lambda p: (p.parent.name, p.name)):
        m = DATE_PREFIX_RE.match(path.parent.name)
        if not m:
            continue
        day = m.group(1)
        complex_no = path.stem.replace("naver-", "")
        if complexes and complex_no not in complexes:
            continue
        latest_path[(day, complex_no)] = path

    grouped: dict[tuple[str, str, str], list[int]] = defaultdict(list)
    names: dict[str, str] = {}
    for (day, complex_no), path in latest_path.items():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if data.get("status") != "api-ok":
            continue
        name = (
            data.get("numericSignals", {}).get("complexInfo", {}).get("complexName")
            or data.get("complexName")
            or DEFAULT_LABELS.get(complex_no)
            or complex_no
        )
        names[complex_no] = name
        for article in (data.get("articles", {}) or {}).get("매매", []) or []:
            if article.get("tradeType") not in (None, "매매"):
                continue
            price = parse_price_manwon(article.get("price"))
            if price is None or price <= 0:
                continue
            area = article.get("areaExclusiveM2") or article.get("areaName") or article.get("areaSupplyM2")
            try:
                area_num = int(round(float(area)))
                # Keep the default view focused on the user's practical buy-side
                # band. Larger units can be added later, but they swamp the chart.
                if area_num < 45 or area_num > 70:
                    continue
                area_key = f"전용{area_num}㎡"
            except Exception:
                area_key = f"면적{area}"
            grouped[(day, complex_no, area_key)].append(price)

    out: dict[tuple[str, str, str], DailyBand] = {}
    for (day, complex_no, area_key), prices in grouped.items():
        prices = sorted(prices)
        out[(day, complex_no, area_key)] = DailyBand(
            day=day,
            complex_no=complex_no,
            complex_name=names.get(complex_no) or DEFAULT_LABELS.get(complex_no) or complex_no,
            area_key=area_key,
            count=len(prices),
            min_price=prices[0],
            median_price=int(round(median(prices))),
            max_price=prices[-1],
        )
    return out


def build_series(bands: dict[tuple[str, str, str], DailyBand], end_day: date, lookback_days: int) -> list[dict[str, Any]]:
    days = [(end_day - timedelta(days=i)).isoformat() for i in range(lookback_days - 1, -1, -1)]
    latest_day = days[-1]
    latest = [b for (d, _, _), b in bands.items() if d == latest_day]
    # Focus on useful 45~70m2-ish bands, sorted by known complex order and count.
    order = {c: i for i, c in enumerate(DEFAULT_COMPLEXES)}
    latest.sort(key=lambda b: (order.get(b.complex_no, 99), -b.count, b.area_key))
    picked_keys = [(b.complex_no, b.area_key) for b in latest[:10]]

    rows: list[dict[str, Any]] = []
    for complex_no, area_key in picked_keys:
        points = []
        for day in days:
            b = bands.get((day, complex_no, area_key))
            points.append({
                "day": day,
                "count": b.count if b else 0,
                "min": b.min_price if b else None,
                "median": b.median_price if b else None,
                "max": b.max_price if b else None,
            })
        first = next((p for p in points if p["min"] is not None), None)
        last = next((p for p in reversed(points) if p["min"] is not None), None)
        if not last:
            continue
        sample = bands.get((last["day"], complex_no, area_key))
        rows.append({
            "complexNo": complex_no,
            "complexName": sample.complex_name if sample else DEFAULT_LABELS.get(complex_no, complex_no),
            "areaKey": area_key,
            "days": points,
            "change": {
                "minPct": pct_change(last["min"], first["min"] if first else None),
                "medianPct": pct_change(last["median"], first["median"] if first else None),
                "maxPct": pct_change(last["max"], first["max"] if first else None),
                "countDelta": (last["count"] or 0) - (first["count"] if first else 0),
            },
            "latest": last,
            "baseline": first,
        })
    return rows


def period_label(lookback_days: int) -> str:
    if lookback_days >= 28:
        return "월간 호가표"
    if lookback_days >= 14:
        return f"최근 {lookback_days}일 호가 밴드"
    return "주간 호가 밴드"


def write_markdown(rows: list[dict[str, Any]], out_path: Path, end_day: date, lookback_days: int) -> None:
    label = period_label(lookback_days)
    lines = [
        f"**{label} ({(end_day - timedelta(days=lookback_days - 1)).isoformat()}~{end_day.isoformat()})**",
        "기준: 네이버 매매 호가 스냅샷 · 최저/중앙/최대 · 실거래가 아님",
        "",
    ]
    if not rows:
        lines.append("- 주간 비교 가능한 네이버 매물 스냅샷이 아직 부족해.")
    for row in rows[:8]:
        latest = row["latest"]
        ch = row["change"]
        lines.append(
            f"- {row['complexName']} {row['areaKey']}: "
            f"최저 {format_price(latest['min'])} ({fmt_pct(ch['minPct'])}), "
            f"중앙 {format_price(latest['median'])} ({fmt_pct(ch['medianPct'])}), "
            f"최대 {format_price(latest['max'])} ({fmt_pct(ch['maxPct'])}), "
            f"매물 {latest['count']}건 ({ch['countDelta']:+d})"
        )
    lines.extend([
        "",
        "주의: 최대값은 특수/희망가 1건에 흔들릴 수 있어서 판단은 최저+중앙값 위주로 봐야 해.",
    ])
    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in [
        "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()


def draw_chart(rows: list[dict[str, Any]], out_path: Path, end_day: date, lookback_days: int) -> None:
    rows = rows[:6]
    width = 1200
    row_h = 150
    top = 110
    left = 230
    right = 70
    bottom = 70
    height = top + max(1, len(rows)) * row_h + bottom
    img = Image.new("RGB", (width, height), "#0f172a")
    d = ImageDraw.Draw(img)
    font_title = load_font(34)
    font = load_font(22)
    font_small = load_font(18)
    font_tiny = load_font(15)

    title = f"{period_label(lookback_days)} · 네이버 매매 ({(end_day - timedelta(days=lookback_days - 1)).strftime('%m/%d')}~{end_day.strftime('%m/%d')})"
    d.text((40, 28), title, fill="#f8fafc", font=font_title)
    d.text((40, 72), "최저(초록) · 중앙(노랑) · 최대(빨강) / 호가 기준, 실거래 아님", fill="#cbd5e1", font=font_small)

    all_vals = []
    for row in rows:
        for p in row["days"]:
            all_vals.extend(v for v in [p["min"], p["median"], p["max"]] if v is not None)
    if not all_vals:
        d.text((40, top), "비교 가능한 데이터가 아직 부족해.", fill="#f8fafc", font=font)
        img.save(out_path)
        return
    vmin = min(all_vals)
    vmax = max(all_vals)
    pad = max(1000, int((vmax - vmin) * 0.12))
    vmin -= pad
    vmax += pad
    if vmax <= vmin:
        vmax = vmin + 1000

    plot_w = width - left - right
    days = [(end_day - timedelta(days=i)).isoformat() for i in range(lookback_days - 1, -1, -1)]

    def x_for(i: int) -> int:
        if lookback_days == 1:
            return left + plot_w // 2
        return int(left + plot_w * i / (lookback_days - 1))

    def y_for(value: int, y0: int, h: int) -> int:
        return int(y0 + h - (value - vmin) / (vmax - vmin) * h)

    colors = {"min": "#22c55e", "median": "#facc15", "max": "#fb7185"}
    for idx, row in enumerate(rows):
        y0 = top + idx * row_h
        h = 92
        d.rounded_rectangle((30, y0 - 8, width - 30, y0 + row_h - 18), radius=18, fill="#111827", outline="#1e293b")
        label = f"{row['complexName']} {row['areaKey']}"
        d.text((50, y0 + 8), label, fill="#f8fafc", font=font)
        latest = row["latest"]
        ch = row["change"]
        summary = f"최저 {format_price(latest['min'])} {fmt_pct(ch['minPct'])} · 중앙 {format_price(latest['median'])} {fmt_pct(ch['medianPct'])} · 최대 {format_price(latest['max'])} {fmt_pct(ch['maxPct'])} · {latest['count']}건"
        d.text((50, y0 + 42), summary, fill="#cbd5e1", font=font_tiny)

        # grid/date labels
        for i, day in enumerate(days):
            x = x_for(i)
            d.line((x, y0 + 12, x, y0 + h + 12), fill="#1e293b", width=1)
            if idx == len(rows) - 1 and (lookback_days <= 10 or i in {0, lookback_days - 1} or i % 7 == 0):
                d.text((x - 24, y0 + h + 18), day[5:].replace("-", "/"), fill="#94a3b8", font=font_tiny)
        d.line((left, y0 + h + 12, width - right, y0 + h + 12), fill="#334155", width=1)

        for metric in ["max", "median", "min"]:
            pts = []
            for i, p in enumerate(row["days"]):
                val = p.get(metric)
                if val is not None:
                    pts.append((x_for(i), y_for(val, y0 + 12, h)))
            if len(pts) >= 2:
                d.line(pts, fill=colors[metric], width=4)
            for x, y in pts:
                d.ellipse((x - 5, y - 5, x + 5, y + 5), fill=colors[metric])

    # y-scale labels
    d.text((width - 58, top + 2), format_price(vmax), fill="#94a3b8", font=font_tiny)
    d.text((width - 58, height - bottom - 50), format_price(vmin), fill="#94a3b8", font=font_tiny)
    img.save(out_path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-root", default="/home/bifos/ai-nodes/apartment/data")
    parser.add_argument("--outdir", required=True)
    parser.add_argument("--end-date", default=date.today().isoformat())
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--complex", dest="complexes", action="append", help="complexNo to include; repeatable")
    parser.add_argument("--prefix", default="weekly-price-trend", help="output filename prefix")
    args = parser.parse_args()

    data_root = Path(args.data_root)
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    end_day = datetime.strptime(args.end_date, "%Y-%m-%d").date()
    complexes = set(args.complexes or DEFAULT_COMPLEXES)

    paths = find_snapshots(data_root, end_day, args.days)
    bands = load_daily_bands(paths, complexes)
    rows = build_series(bands, end_day, args.days)

    payload = {
        "generatedAt": datetime.now().isoformat(),
        "period": {
            "start": (end_day - timedelta(days=args.days - 1)).isoformat(),
            "end": end_day.isoformat(),
            "days": args.days,
        },
        "basis": "Naver Land sale listing asking prices, not actual transaction prices",
        "rows": rows,
    }
    prefix = re.sub(r"[^A-Za-z0-9_.-]+", "-", args.prefix).strip("-") or "weekly-price-trend"
    (outdir / f"{prefix}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_markdown(rows, outdir / f"{prefix}.md", end_day, args.days)
    draw_chart(rows, outdir / f"{prefix}.png", end_day, args.days)
    print(outdir / f"{prefix}.md")
    print(outdir / f"{prefix}.png")


if __name__ == "__main__":
    main()
