#!/usr/bin/env python3
import json
import re
import sys
from html import unescape
from urllib.parse import urlparse

import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
}


def compact(text):
    if not text:
        return ""
    return re.sub(r"\s+", " ", unescape(text)).strip()


def parse_amount_to_manwon(text):
    value = compact(text)
    if not value:
        return None
    value = value.replace("만원", "").replace(" ", "")
    total = 0
    m = re.search(r"(\d+)억", value)
    if m:
        total += int(m.group(1)) * 10000
    rest = re.sub(r"\d+억", "", value)
    m = re.search(r"([\d,]+)", rest)
    if m:
        total += int(m.group(1).replace(",", ""))
    return total or None


def extract_description(html):
    patterns = [
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']',
        r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\'](.*?)["\']',
    ]
    for p in patterns:
        m = re.search(p, html, re.I | re.S)
        if m:
            return compact(m.group(1))
    return ""


def build_text(html):
    stripped = re.sub(r"<script.*?</script>|<style.*?</style>", " ", html, flags=re.I | re.S)
    stripped = re.sub(r"<[^>]+>", " ", stripped)
    return compact(stripped)


def extract_complex_info(text):
    info = {}
    m = re.search(r"(\d+)세대\s*\|\s*(\d{4})년\s*(\d+)월\((\d+)년차\)", text)
    if m:
        info.update({
            "households": int(m.group(1)),
            "builtYear": int(m.group(2)),
            "builtMonth": int(m.group(3)),
            "ageYears": int(m.group(4)),
        })
    for key, pattern in {
        "floorAreaRatio": r"용적률\s*(\d+)%",
        "buildingCoverage": r"건폐율\s*(\d+)%",
        "groundParking": r"지상주차\s*(\d+)대",
        "undergroundParking": r"지하주차\s*(\d+)대",
    }.items():
        m = re.search(pattern, text)
        if m:
            info[key] = int(m.group(1))
    return info


def extract_area_trade_summary(text):
    m = re.search(r"매매\s+전월세\s+(\d+평)\s+최근 실거래 기준\s*1개월 평균\s*([0-9억,\s]+)", text)
    if not m:
        return None
    amount = compact(m.group(2))
    return {
        "areaLabel": m.group(1),
        "monthlyAverage": amount,
        "monthlyAverageManwon": parse_amount_to_manwon(amount),
    }


def extract_recent_transactions(text):
    start = text.find("계약일 면적(공급) 가격")
    if start < 0:
        return []
    window = text[start:start + 1200]
    pattern = re.compile(r"(\d{2}\.\d{2}\.\d{2})\s+(\d+)\s+(등기\s+)?([0-9억,\s]+)\s+((?:\d+동/)?\d+층)")
    rows = []
    seen = set()
    for match in pattern.finditer(window):
        supply_area = int(match.group(2))
        row = {
            "date": match.group(1),
            "supplyAreaApprox": supply_area,
            "unit": f"{supply_area}㎡",
            "price": compact(match.group(4)),
            "priceManwon": parse_amount_to_manwon(match.group(4)),
            "floor": compact(match.group(5)),
            "registeredLater": bool(match.group(3)),
        }
        key = tuple(row.items())
        if key not in seen:
            seen.add(key)
            rows.append(row)
    return rows[:5]


def main():
    url = sys.argv[1]
    r = requests.get(url, headers=HEADERS, timeout=20)
    html = r.text
    text = build_text(html)
    desc = extract_description(html)

    result = {
        "name": "Hogangnono",
        "url": url,
        "finalUrl": r.url,
        "status": "ok" if r.status_code == 200 else f"http-{r.status_code}",
        "host": urlparse(url).netloc,
        "title": "",
        "description": desc,
        "signals": [kw for kw in ["실거래가", "시세", "매매", "전세", "월세", "매물", "학군", "교통", "주변정보", "전세가율", "거래량", "신고가"] if kw in (desc + " " + text)],
        "numericSignals": {},
        "jsonLd": [],
        "note": "호갱노노 HTML 기반 구조화 추출, 기본 단지정보와 대표 평형 최근 거래 추출",
    }

    complex_info = extract_complex_info(text)
    if complex_info:
        result["numericSignals"]["complexInfo"] = complex_info

    area_trade_summary = extract_area_trade_summary(text)
    if area_trade_summary:
        result["numericSignals"]["areaTradeSummary"] = area_trade_summary

    recent_transactions = extract_recent_transactions(text)
    if recent_transactions:
        result["recentTransactions"] = recent_transactions

    snippets = []
    for kw in ["최근 실거래 기준", "용적률", "건폐율", "관리비"]:
        idx = text.find(kw)
        if idx >= 0:
            snippet = compact(text[max(0, idx - 80): idx + 260])
            if snippet and snippet not in snippets:
                snippets.append(snippet)
    result["snippets"] = snippets[:5]

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
