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
    if "/" in value:
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


def extract_title(html):
    m = re.search(r"<title>(.*?)</title>", html, re.I | re.S)
    return compact(m.group(1)) if m else ""


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


def extract_json_ld_blocks(html):
    matches = re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.I | re.S)
    return [compact(x)[:2000] for x in matches[:5] if compact(x)]


def build_text(html):
    stripped = re.sub(r"<script.*?</script>|<style.*?</style>", " ", html, flags=re.I | re.S)
    stripped = re.sub(r"<[^>]+>", " ", stripped)
    return compact(stripped)


def extract_type_profiles(text):
    pattern = re.compile(
        r"(\d+(?:\.\d+)?)m²\s*\((\d+)세대\)\s*공급/전용\s*([^\s]+)\s*방/욕실\s*([^\s]+)\s*전용률\s*(\d+(?:\.\d+)?)%\s*매매\s*(\d+)\s*전세\s*(\d+)\s*월세\s*(\d+)",
        re.S,
    )
    profiles = []
    for match in pattern.finditer(text):
        supply_area = float(match.group(1))
        exclusive_ratio = float(match.group(5))
        exclusive_area_estimate = round(supply_area * exclusive_ratio / 100, 2)
        profiles.append({
            "typeLabel": f"{int(supply_area) if supply_area.is_integer() else supply_area}m²",
            "supplyAreaM2": supply_area,
            "households": int(match.group(2)),
            "supplyExclusiveText": compact(match.group(3)),
            "roomBath": compact(match.group(4)),
            "exclusiveRatePercent": exclusive_ratio,
            "exclusiveAreaEstimateM2": exclusive_area_estimate,
            "listingCounts": {
                "매매": int(match.group(6)),
                "전세": int(match.group(7)),
                "월세": int(match.group(8)),
            },
        })
    return profiles


def extract_price_block(text, label):
    pattern = re.compile(
        rf"{label}\s+KB시세(?:\s+일반가\s+([0-9억,\s]+?)\s+\d{{2}}\.\d{{2}}\.\d{{2}})?(?:\s+상위평균가\s+([0-9억,\s]+?))?(?:\s+하위평균가\s+([0-9억,\s]+?))?(?:\s+최근 실거래가\s+([0-9억,\s]+?)\s+(\d{{2}}\.\d{{2}}\.\d{{2}}/[^\s]+))?(?:\s+매물평균가\s+([0-9억,\s]+?))?(?=\s+(?:매매|전세|월세)\s+KB시세|\s+KB부동산 제공|$)"
    )
    m = pattern.search(text)
    if not m:
        return None
    out = {}
    if m.group(1):
        out["general"] = compact(m.group(1))
        out["generalManwon"] = parse_amount_to_manwon(m.group(1))
    if m.group(2):
        out["upperAvg"] = compact(m.group(2))
        out["upperAvgManwon"] = parse_amount_to_manwon(m.group(2))
    if m.group(3):
        out["lowerAvg"] = compact(m.group(3))
        out["lowerAvgManwon"] = parse_amount_to_manwon(m.group(3))
    if m.group(4):
        out["recentTransaction"] = compact(m.group(4))
        out["recentTransactionManwon"] = parse_amount_to_manwon(m.group(4))
    if m.group(5):
        out["recentTransactionMeta"] = compact(m.group(5))
    if m.group(6):
        out["listingAverage"] = compact(m.group(6))
        out["listingAverageManwon"] = parse_amount_to_manwon(m.group(6))
    return out or None


def main():
    url = sys.argv[1]
    r = requests.get(url, headers=HEADERS, timeout=20)
    html = r.text
    title = extract_title(html)
    description = extract_description(html)
    text = build_text(html)

    result = {
        "name": "KB Land",
        "url": url,
        "finalUrl": r.url,
        "status": "ok" if r.status_code == 200 else f"http-{r.status_code}",
        "host": urlparse(url).netloc,
        "title": title,
        "description": description,
        "signals": [kw for kw in ["실거래가", "시세", "매매", "전세", "월세", "매물", "대출", "학군", "교통", "커뮤니티", "AI예측시세"] if kw in (title + " " + description + " " + text)],
        "numericSignals": {},
        "jsonLd": extract_json_ld_blocks(html),
        "note": "KB부동산 HTML 기반 구조화 추출, 시세/최근 실거래/매물평균가 요약 포함",
    }

    m = re.search(r"매매\s*(\d+)\s*전세\s*(\d+)\s*월세\s*(\d+)", text)
    if m:
        result["numericSignals"]["listingCounts"] = {"매매": int(m.group(1)), "전세": int(m.group(2)), "월세": int(m.group(3))}
    m = re.search(r"(\d+)세대", text)
    if m:
        result["numericSignals"]["households"] = int(m.group(1))
    m = re.search(r"(\d{2})\.(\d{2})\s*\((\d+)년차\)", text)
    if m:
        result["numericSignals"]["completionInfo"] = {"yy_mm": f"{m.group(1)}.{m.group(2)}", "ageYears": int(m.group(3))}
    m = re.search(r"([0-9.]+~[0-9.]+m²)", text)
    if m:
        result["numericSignals"]["areaRange"] = m.group(1)

    pricing = {}
    for label in ["매매", "전세", "월세"]:
        block = extract_price_block(text, label)
        if block:
            pricing[label] = block
    if pricing:
        result["numericSignals"]["pricing"] = pricing

    type_profiles = extract_type_profiles(text)
    if type_profiles:
        result["numericSignals"]["typeProfiles"] = type_profiles

    snippets = []
    for kw in ["매매 KB시세", "전세 KB시세", "월세 KB시세"]:
        idx = text.find(kw)
        if idx >= 0:
            snippet = compact(text[max(0, idx - 60): idx + 280])
            if snippet and snippet not in snippets:
                snippets.append(snippet)
    result["snippets"] = snippets[:5]

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
