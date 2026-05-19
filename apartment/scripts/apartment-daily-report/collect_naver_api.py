#!/usr/bin/env python3
"""Naver Land API 기반 단지 수집기 (ADR-001).

호출 인터페이스(다른 collector와 동일):
  python3 collect_naver_api.py <url>

환경변수:
  NAVER_COOKIE   (필수)  로그인 세션 포함 전체 쿠키 문자열. 비어있으면 skip.
  NAVER_BEARER   (선택)  JWT Bearer 토큰. 비어있으면 articles/prices는 호출 시도하되
                         401/403/429 발생 시 status=auth-failed/rate-limited으로 분류.
  COMPLEX_NO     (선택)  단지 번호. 기본 1649.

표준 출력 JSON: {name, url, status, numericSignals, recentTransactions, note, ...}
status 값: api-ok / skipped-no-cookie / auth-failed / rate-limited / no-data
"""

import json
import os
import re
import subprocess
import sys
import tempfile
import time
from urllib.parse import urlparse

import requests

API_BASE = "https://new.land.naver.com/api"
DEFAULT_COMPLEX_NO = "1649"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"
)
SLEEP_BETWEEN = 2.0
BACKOFFS = [2, 4, 8]


def extract_bearer_via_har(cookie, complex_no):
    """agent-browser HAR 캡처로 Naver SPA가 발급하는 JWT를 자동 추출.

    NAVER_BEARER 환경변수가 비어있을 때만 호출한다. Naver SPA는 페이지가 /404로
    리다이렉트되더라도 백그라운드 JS가 첫 API 호출에 Authorization: Bearer ...
    헤더를 자동 inject한다. HAR 기록을 켜둔 채 잠시 대기하면 그 헤더를 회수할 수
    있다. 실패 시 None을 반환해 호출자가 폴백 처리하도록 한다.
    """
    if not cookie:
        return None
    session = f"naver-bearer-{os.getpid()}"
    env = os.environ.copy()
    env.setdefault("AGENT_BROWSER_ARGS", "--no-sandbox")
    env.setdefault("AGENT_BROWSER_USER_AGENT", USER_AGENT)
    headers_json = json.dumps({"Cookie": cookie})
    har_fd, har_path = tempfile.mkstemp(suffix=".har", prefix="naver-bearer-")
    os.close(har_fd)

    def run(*args, timeout=30):
        return subprocess.run(
            ["agent-browser", *args],
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
        )

    try:
        run("open", "about:blank", "--session", session)
        run("network", "har", "start", "--session", session)
        url = f"https://new.land.naver.com/complexes/{complex_no}"
        run("open", url, "--session", session, "--headers", headers_json)
        time.sleep(8)
        run("network", "har", "stop", har_path, "--session", session)
        with open(har_path, encoding="utf-8") as f:
            har = json.load(f)
        for entry in har.get("log", {}).get("entries", []):
            req = entry.get("request", {})
            if "new.land.naver.com/api" not in (req.get("url") or ""):
                continue
            for h in req.get("headers") or []:
                if (h.get("name") or "").lower() == "authorization":
                    val = h.get("value") or ""
                    if val.lower().startswith("bearer "):
                        return val.split(None, 1)[1].strip()
        return None
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError, json.JSONDecodeError, KeyError):
        return None
    finally:
        try:
            os.unlink(har_path)
        except OSError:
            pass


def build_headers(cookie, bearer, referer):
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "*/*",
        "Accept-Language": "ko,en-US;q=0.9",
        "Referer": referer,
        "sec-ch-ua": '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "Cookie": cookie,
    }
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"
    return headers


def call_api(session, url, headers):
    last_status = None
    last_err = None
    for attempt in range(len(BACKOFFS) + 1):
        try:
            r = session.get(url, headers=headers, timeout=20)
        except requests.RequestException as e:
            return None, 0, f"{type(e).__name__}: {e}"
        last_status = r.status_code
        if r.status_code == 200:
            try:
                return r.json(), 200, None
            except ValueError as e:
                return None, 200, f"json-decode: {e}"
        if r.status_code == 429 and attempt < len(BACKOFFS):
            time.sleep(BACKOFFS[attempt])
            continue
        last_err = (r.text or "")[:300]
        break
    return None, last_status, last_err or "no-response"


def normalize_overview(payload):
    if not payload:
        return {}
    out = {
        "complexNo": payload.get("complexNo"),
        "complexName": payload.get("complexName"),
        "complexType": payload.get("complexTypeName"),
        "totalHouseHoldCount": payload.get("totalHouseHoldCount"),
        "totalDongCount": payload.get("totalDongCount"),
        "useApproveYmd": payload.get("useApproveYmd"),
        "minAreaM2": payload.get("minArea"),
        "maxAreaM2": payload.get("maxArea"),
        "minPriceManwon": payload.get("minPrice"),
        "maxPriceManwon": payload.get("maxPrice"),
        "minLeasePriceManwon": payload.get("minLeasePrice"),
        "maxLeasePriceManwon": payload.get("maxLeasePrice"),
        "latitude": payload.get("latitude"),
        "longitude": payload.get("longitude"),
    }
    rp = payload.get("realPrice") or {}
    if rp:
        out["realPrice"] = {
            "tradeType": rp.get("tradeTypeName") or rp.get("tradeType"),
            "tradeYearMonth": rp.get("formattedTradeYearMonth"),
            "tradeDate": rp.get("tradeDate"),
            "dealPriceManwon": rp.get("dealPrice"),
            "dealPriceFormatted": rp.get("formattedPrice"),
            "floor": rp.get("floor"),
            "supplyAreaM2": rp.get("representativeArea"),
            "exclusiveAreaM2": rp.get("exclusiveArea"),
        }
    profiles = []
    for p in payload.get("pyeongs") or []:
        try:
            supply = p.get("supplyAreaDouble")
            if supply is None and p.get("supplyArea"):
                supply = float(p["supplyArea"])
            exclusive = float(p["exclusiveArea"]) if p.get("exclusiveArea") else None
            profiles.append({
                "typeLabel": p.get("pyeongName") or p.get("pyeongName2"),
                "supplyAreaM2": supply,
                "exclusiveAreaEstimateM2": exclusive,
                "exclusivePyeong": p.get("exclusivePyeong"),
            })
        except (TypeError, ValueError):
            continue
    out["typeProfiles"] = profiles
    return out


def normalize_prices(payload, label):
    if not payload:
        return {}
    mp = payload.get("marketPrice") or {}
    return {
        "tradeType": label,
        "baseDate": mp.get("baseYearMonthDay"),
        "dealPriceManwon": {
            "upper": mp.get("dealUpperPriceLimit"),
            "average": mp.get("dealAveragePrice"),
            "low": mp.get("dealLowPriceLimit"),
        },
        "leasePriceManwon": {
            "upper": mp.get("leaseUpperPriceLimit"),
            "average": mp.get("leaseAveragePrice"),
            "low": mp.get("leaseLowPriceLimit"),
        },
        "leasePerDealRate": mp.get("leasePerDealRate"),
        "priceChangeAmount": mp.get("priceChangeAmount"),
        "provider": payload.get("provider"),
    }


def normalize_articles(payload):
    if not payload:
        return []
    items = []
    for a in payload.get("articleList") or []:
        items.append({
            "articleNo": a.get("articleNo"),
            "articleName": a.get("articleName"),
            "tradeType": a.get("tradeTypeName"),
            "price": a.get("dealOrWarrantPrc"),
            "areaSupplyM2": a.get("area1"),
            "areaExclusiveM2": a.get("area2"),
            "areaName": a.get("areaName"),
            "floor": a.get("floorInfo"),
            "direction": a.get("direction"),
            "verification": a.get("verificationTypeCode"),
            "priceChange": a.get("priceChangeState"),
            "confirmDate": a.get("articleConfirmYmd"),
            "featureDesc": a.get("articleFeatureDesc"),
            "tags": a.get("tagList") or [],
        })
    return items


def classify_occupancy(article, detail_payload=None):
    """Classify whether a sale listing looks owner-occupancy friendly.

    Naver's list endpoint often omits occupancy/tenant deposit fields. The detail
    endpoint exposes `articlePrice.allWarrantPrice`, which corresponds to the UI's
    기전세금. For the user's mortgage-backed 실거주 purchase flow, any positive
    기전세금 should be treated as tenant-occupied / 전세 끼고 매매 and filtered out.
    """
    detail = (detail_payload or {}).get("articleDetail") or {}
    addition = (detail_payload or {}).get("articleAddition") or {}
    price = (detail_payload or {}).get("articlePrice") or {}

    text_parts = [
        article.get("featureDesc"),
        detail.get("articleFeatureDescription"),
        addition.get("articleFeatureDesc"),
        " ".join(article.get("tags") or []),
        " ".join(detail.get("tagList") or []),
        " ".join(addition.get("tagList") or []),
    ]
    text = " ".join(str(x) for x in text_parts if x).strip()
    all_warrant = price.get("allWarrantPrice")
    all_rent = price.get("allRentPrice")

    negative_keywords = [
        "세안고", "전세안고", "전세 안고", "전세승계", "월세승계", "갭투자",
        "투자", "임차인", "세입자", "만기", "갱신권",
    ]
    positive_keywords = [
        "입주", "즉시입주", "즉시 입주", "입주가능", "입주 가능", "입주협의",
        "공실", "주인거주", "주인 거주", "집주인거주", "집주인 거주",
    ]

    risk = "unknown"
    reason = "occupancy detail unavailable"
    if isinstance(all_warrant, (int, float)) and all_warrant > 0:
        risk = "tenant-occupied"
        reason = f"기전세금 {all_warrant}만원"
    elif isinstance(all_rent, (int, float)) and all_rent > 0:
        risk = "tenant-occupied"
        reason = f"기월세 {all_rent}만원"
    elif any(k in text for k in negative_keywords):
        risk = "tenant-occupied"
        reason = "tenant/gap keyword in listing text"
    elif any(k in text for k in positive_keywords):
        risk = "owner-occupancy-friendly"
        reason = "occupancy-friendly keyword in listing text"
    elif detail_payload:
        risk = "phone-check-needed"
        reason = "no tenant deposit/negative keyword found in detail"

    return {
        "risk": risk,
        "reason": reason,
        "allWarrantPriceManwon": all_warrant,
        "allRentPriceManwon": all_rent,
        "text": text,
    }


def enrich_articles_with_details(session, headers, articles, errors, label, max_details=80):
    enriched = []
    for idx, article in enumerate(articles):
        if idx >= max_details:
            article["occupancy"] = classify_occupancy(article)
            enriched.append(article)
            continue
        article_no = article.get("articleNo")
        if not article_no:
            article["occupancy"] = classify_occupancy(article)
            enriched.append(article)
            continue
        payload, code, err = call_api(session, f"{API_BASE}/articles/{article_no}", headers)
        if err:
            errors.append({"endpoint": f"{label}.detail.{article_no}", "code": code, "error": err[:200]})
            article["occupancy"] = classify_occupancy(article)
        else:
            article["occupancy"] = classify_occupancy(article, payload)
        enriched.append(article)
        time.sleep(0.2)
    return enriched


def build_recent_from_realprice(overview_norm):
    rp = overview_norm.get("realPrice") or {}
    if not rp.get("dealPriceManwon"):
        return []
    date_label = ""
    ym = rp.get("tradeYearMonth") or ""
    day = rp.get("tradeDate")
    if ym and day:
        m = re.match(r"(\d{4})\.(\d{1,2})$", ym)
        if m:
            date_label = f"{m.group(1)[2:]}.{int(m.group(2)):02d}.{int(day):02d}"
        else:
            date_label = f"{ym}.{day}"
    elif ym:
        date_label = ym
    supply = rp.get("supplyAreaM2")
    return [{
        "date": date_label,
        "supplyAreaApprox": int(round(supply)) if supply else None,
        "exclusiveAreaApprox": rp.get("exclusiveAreaM2"),
        "unit": f"{int(round(supply))}㎡" if supply else None,
        "price": rp.get("dealPriceFormatted"),
        "priceManwon": rp.get("dealPriceManwon"),
        "floor": f"{rp['floor']}층" if rp.get("floor") is not None else None,
        "tradeType": rp.get("tradeType"),
        "source": "naver-api/overview.realPrice",
    }]


def main():
    url = sys.argv[1] if len(sys.argv) > 1 else ""
    cookie = os.environ.get("NAVER_COOKIE", "").strip()
    bearer = os.environ.get("NAVER_BEARER", "").strip()
    complex_no = (os.environ.get("COMPLEX_NO") or "").strip()
    if not complex_no:
        m = re.search(r"complexes/(\d+)", url or "")
        complex_no = m.group(1) if m else DEFAULT_COMPLEX_NO

    base_result = {
        "name": "Naver Land",
        "url": url,
        "complexNo": complex_no,
        "host": "new.land.naver.com",
        "title": "",
        "description": "",
        "signals": [],
        "numericSignals": {},
        "snippets": [],
    }

    if not cookie:
        base_result.update({
            "status": "skipped-no-cookie",
            "note": "NAVER_COOKIE 환경변수가 비어 있어 Naver API 수집을 건너뛰었다.",
        })
        print(json.dumps(base_result, ensure_ascii=False))
        return

    bearer_source = "env" if bearer else "none"
    if not bearer:
        extracted = extract_bearer_via_har(cookie, complex_no)
        if extracted:
            bearer = extracted
            bearer_source = "auto"

    referer = f"https://new.land.naver.com/complexes/{complex_no}"
    headers = build_headers(cookie, bearer, referer)
    session = requests.Session()
    errors = []

    def hit(label, path):
        payload, code, err = call_api(session, f"{API_BASE}{path}", headers)
        if err:
            errors.append({"endpoint": label, "code": code, "error": err[:200]})
        return payload, code

    def hit_article_pages(label, trade_type, max_pages=5):
        combined = {"articleList": [], "isMoreData": False, "pagesFetched": 0}
        for page in range(1, max_pages + 1):
            path = f"/articles/complex/{complex_no}?tradeType={trade_type}&order=rank&complexNo={complex_no}&type=list&page={page}"
            payload, code, err = call_api(session, f"{API_BASE}{path}", headers)
            if err:
                errors.append({"endpoint": f"{label}.page{page}", "code": code, "error": err[:200]})
                break
            if not payload:
                break
            combined["pagesFetched"] = page
            combined["articleList"].extend(payload.get("articleList") or [])
            if not payload.get("isMoreData"):
                combined["isMoreData"] = False
                break
            combined["isMoreData"] = True
            time.sleep(SLEEP_BETWEEN)
        return combined if combined["articleList"] else None

    overview_raw, _ = hit("overview", f"/complexes/overview/{complex_no}?complexNo={complex_no}")
    time.sleep(SLEEP_BETWEEN)
    prices_a1, _ = hit("prices.A1", f"/complexes/{complex_no}/prices?complexNo={complex_no}&tradeType=A1&year=5&priceChartChange=false&type=summary")
    time.sleep(SLEEP_BETWEEN)
    prices_b1, _ = hit("prices.B1", f"/complexes/{complex_no}/prices?complexNo={complex_no}&tradeType=B1&year=5&priceChartChange=false&type=summary")
    time.sleep(SLEEP_BETWEEN)
    articles_a1 = hit_article_pages("articles.A1", "A1")
    time.sleep(SLEEP_BETWEEN)
    articles_b1 = hit_article_pages("articles.B1", "B1")

    auth_failed = any(e.get("code") in (401, 403) for e in errors)
    rate_limited = any(e.get("code") == 429 for e in errors)

    overview_norm = normalize_overview(overview_raw)
    sale_articles = normalize_articles(articles_a1)
    lease_articles = normalize_articles(articles_b1)
    if sale_articles and os.environ.get("NAVER_ARTICLE_DETAIL_ENABLED", "1") != "0":
        max_details = int(os.environ.get("NAVER_ARTICLE_DETAIL_MAX", "80"))
        sale_articles = enrich_articles_with_details(
            session, headers, sale_articles, errors, "articles.A1", max_details=max_details
        )
    pricing = {}
    if prices_a1:
        pricing["매매"] = normalize_prices(prices_a1, "매매")
    if prices_b1:
        pricing["전세"] = normalize_prices(prices_b1, "전세")

    listing_counts = {"매매": len(sale_articles), "전세": len(lease_articles)}
    listing_more = {
        "매매": bool(articles_a1 and articles_a1.get("isMoreData")),
        "전세": bool(articles_b1 and articles_b1.get("isMoreData")),
    }

    if overview_raw or pricing or sale_articles or lease_articles:
        status = "api-ok"
    elif auth_failed:
        status = "auth-failed"
    elif rate_limited:
        status = "rate-limited"
    else:
        status = "no-data"

    if status == "api-ok":
        more_a = "+" if listing_more["매매"] else ""
        more_b = "+" if listing_more["전세"] else ""
        note = (
            f"Naver API 수집 성공 — overview: {'O' if overview_raw else 'X'}, "
            f"prices(매매/전세): {'O' if prices_a1 else 'X'}/{'O' if prices_b1 else 'X'}, "
            f"매물 매매 {listing_counts['매매']}{more_a}건 / 전세 {listing_counts['전세']}{more_b}건."
        )
    elif status == "auth-failed":
        note = "Naver API 인증 실패 (401/403). NAVER_COOKIE 또는 NAVER_BEARER 갱신 필요."
    elif status == "rate-limited":
        note = "Naver API rate limit 지속 (429). 잠시 후 재시도하거나 토큰을 갱신하라."
    else:
        note = "Naver API에서 데이터를 받지 못했다."

    signals = [k for k, v in (
        ("overview", overview_raw),
        ("prices.A1", prices_a1),
        ("prices.B1", prices_b1),
        ("articles.A1", articles_a1),
        ("articles.B1", articles_b1),
    ) if v]

    area_range = None
    if overview_norm.get("minAreaM2") and overview_norm.get("maxAreaM2"):
        area_range = f"{overview_norm['minAreaM2']}㎡ ~ {overview_norm['maxAreaM2']}㎡"

    base_result.update({
        "finalUrl": referer,
        "status": status,
        "signals": signals,
        "numericSignals": {
            "complexInfo": {
                "complexName": overview_norm.get("complexName"),
                "households": overview_norm.get("totalHouseHoldCount"),
                "buildingCount": overview_norm.get("totalDongCount"),
                "useApproveYmd": overview_norm.get("useApproveYmd"),
                "latlng": [overview_norm.get("latitude"), overview_norm.get("longitude")]
                          if overview_norm.get("latitude") else None,
            },
            "pricing": pricing,
            "typeProfiles": overview_norm.get("typeProfiles") or [],
            "listingCounts": listing_counts,
            "listingMoreData": listing_more,
            "areaRange": area_range,
            "priceRangeManwon": [
                overview_norm.get("minPriceManwon"),
                overview_norm.get("maxPriceManwon"),
            ] if overview_norm.get("minPriceManwon") else None,
            "leasePriceRangeManwon": [
                overview_norm.get("minLeasePriceManwon"),
                overview_norm.get("maxLeasePriceManwon"),
            ] if overview_norm.get("minLeasePriceManwon") else None,
        },
        "recentTransactions": build_recent_from_realprice(overview_norm),
        "articles": {"매매": sale_articles, "전세": lease_articles},
        "errors": errors,
        "note": note,
    })
    print(json.dumps(base_result, ensure_ascii=False))


if __name__ == "__main__":
    main()
