#!/usr/bin/env python3
import json, math, re, sys, time, urllib.parse, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

UA = "Mozilla/5.0 OpenClaw daily-stock-analysis-note/1.0"


def fetch(url, timeout=12, max_bytes=800_000):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    started = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return {"ok": True, "status": getattr(r, "status", None), "elapsedMs": int((time.time()-started)*1000), "text": r.read(max_bytes).decode("utf-8", errors="replace")}
    except Exception as e:
        return {"ok": False, "elapsedMs": int((time.time()-started)*1000), "error": repr(e)}


def yahoo_chart(symbol, range_="3mo", interval="1d"):
    safe = urllib.parse.quote(symbol, safe="")
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{safe}?range={range_}&interval={interval}"
    res = fetch(url)
    if not res["ok"]:
        return {"symbol": symbol, "ok": False, "error": res.get("error"), "url": url}
    try:
        data = json.loads(res["text"])
        result = (data.get("chart", {}).get("result") or [None])[0]
        if not result:
            return {"symbol": symbol, "ok": False, "error": data.get("chart", {}).get("error"), "url": url}
        meta = result.get("meta", {})
        quote = (result.get("indicators", {}).get("quote") or [{}])[0]
        ts = result.get("timestamp") or []
        closes = quote.get("close") or []
        volumes = quote.get("volume") or []
        points = []
        for i, t in enumerate(ts):
            c = closes[i] if i < len(closes) else None
            v = volumes[i] if i < len(volumes) else None
            if isinstance(c, (int, float)):
                points.append({"date": datetime.fromtimestamp(t, timezone.utc).date().isoformat(), "close": c, "volume": v})
        cur = meta.get("regularMarketPrice") or (points[-1]["close"] if points else None)
        first = points[0]["close"] if points else None
        prev = points[-2]["close"] if len(points) >= 2 else None
        high52, low52 = meta.get("fiftyTwoWeekHigh"), meta.get("fiftyTwoWeekLow")
        closes_valid = [p["close"] for p in points]
        vols = [p["volume"] for p in points if isinstance(p.get("volume"), (int, float))]
        def pct(a,b): return (a/b-1)*100 if a and b else None
        def sma(vals,n): return sum(vals[-n:])/n if len(vals)>=n else None
        def rsi(vals, period=14):
            if len(vals) < period+1: return None
            gains=[]; losses=[]
            for a,b in zip(vals[-period-1:-1], vals[-period:]):
                d=b-a; gains.append(max(d,0)); losses.append(max(-d,0))
            ag=sum(gains)/period; al=sum(losses)/period
            if al == 0: return 100.0 if ag>0 else 50.0
            return 100 - 100/(1+ag/al)
        ma20 = sma(closes_valid,20)
        vol20 = sma(vols,20)
        return {
            "symbol": symbol, "ok": True, "name": meta.get("longName") or meta.get("shortName"),
            "currency": meta.get("currency"), "exchange": meta.get("fullExchangeName") or meta.get("exchangeName"),
            "regularMarketPrice": cur, "previousClose": meta.get("chartPreviousClose"), "previousValidClose": prev,
            "lastDayChangePct": pct(cur, prev), "rangeChangePct": pct(cur, first),
            "fiftyTwoWeekHigh": high52, "fiftyTwoWeekLow": low52,
            "pctFrom52WeekHigh": pct(cur, high52), "pctFrom52WeekLow": pct(cur, low52),
            "sma20": ma20, "pctFromSma20": pct(cur, ma20), "rsi14": rsi(closes_valid),
            "lastVolume": vols[-1] if vols else None, "avgVolume20": vol20, "volumeVsAvg20": (vols[-1]/vol20 if vols and vol20 else None),
            "recent": points[-10:], "url": url
        }
    except Exception as e:
        return {"symbol": symbol, "ok": False, "error": repr(e), "url": url}


def google_news(query, market="US", max_items=8):
    locales = [("ko", "KR", "KR:ko")]
    if market == "US":
        locales = [("en-US", "US", "US:en"), ("ko", "KR", "KR:ko")]
    all_items=[]; urls=[]; errors=[]
    for hl, gl, ceid in locales:
        url = "https://news.google.com/rss/search?q=" + urllib.parse.quote(query) + f"&hl={hl}&gl={gl}&ceid={ceid}"
        urls.append(url)
        res = fetch(url)
        if not res["ok"]:
            errors.append({"url": url, "error": res.get("error")})
            continue
        try:
            root = ET.fromstring(res["text"])
            for item in root.findall(".//item"):
                title = re.sub(r"\s+", " ", item.findtext("title") or "").strip()
                if not title or any(x.get("title") == title for x in all_items):
                    continue
                all_items.append({"title": title, "link": item.findtext("link") or "", "published": item.findtext("pubDate") or "", "locale": gl})
                if len(all_items) >= max_items:
                    break
        except Exception as e:
            errors.append({"url": url, "error": repr(e)})
        if len(all_items) >= max_items:
            break
    return {"ok": bool(all_items), "urls": urls, "items": all_items[:max_items], "errors": errors}


def score(symbol, chart, rotation_index, item, history):
    if not chart.get("ok"):
        return -999, {"base": -999, "historyPenalty": 0, "marketBalanceBoost": 0}
    s = 0.0
    r = chart.get("rangeChangePct")
    d = chart.get("lastDayChangePct")
    vh = chart.get("pctFrom52WeekHigh")
    rsi = chart.get("rsi14")
    vol = chart.get("volumeVsAvg20")
    if isinstance(r,(int,float)): s += max(min(r,30),-20) * 0.35
    if isinstance(d,(int,float)): s += max(min(d,8),-8) * 0.8
    if isinstance(vh,(int,float)): s += max(-abs(vh), -35) * 0.08  # near high gets less penalty
    if isinstance(rsi,(int,float)):
        if 45 <= rsi <= 72: s += 7
        elif rsi > 82: s -= 6
        elif rsi < 35: s -= 3
    if isinstance(vol,(int,float)) and vol > 1.3: s += min((vol-1)*4, 8)
    s += (rotation_index % 11) * 0.15
    base = s

    entries = list(reversed(history.get("entries", [])))
    recent_tickers = [e.get("ticker") for e in entries[:14]]
    history_penalty = 0
    if symbol in recent_tickers[:3]:
        history_penalty = -100  # avoid immediate repeats unless explicitly requested
    elif symbol in recent_tickers[:7]:
        history_penalty = -18
    elif symbol in recent_tickers[:14]:
        history_penalty = -8
    s += history_penalty

    recent_markets = [e.get("market") for e in entries[:4]]
    market_boost = 0
    if item.get("market") == "KR" and recent_markets and all(m == "US" for m in recent_markets[:3]):
        market_boost = 5
    elif item.get("market") == "US" and recent_markets and all(m == "KR" for m in recent_markets[:3]):
        market_boost = 3
    s += market_boost

    return round(s, 3), {"base": round(base, 3), "historyPenalty": history_penalty, "marketBalanceBoost": market_boost}


def main():
    if len(sys.argv) != 6:
        print("usage: collect_daily_note_inputs.py <universe.json> <selected.json> <raw.json> <optional_ticker_or_-> <history.json>", file=sys.stderr); return 2
    universe_path, selected_out, raw_out, requested, history_path = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), sys.argv[4], Path(sys.argv[5])
    cfg = json.loads(universe_path.read_text(encoding="utf-8"))
    history = {"entries": []}
    if history_path.exists():
        try:
            history = json.loads(history_path.read_text(encoding="utf-8"))
        except Exception:
            history = {"entries": []}
    symbols = cfg["symbols"]
    charts = {}
    ranked = []
    requested_norm = None if requested == "-" else requested.upper()
    for i, item in enumerate(symbols):
        t = item["ticker"]
        c = yahoo_chart(t)
        charts[t] = c
        final_score, score_parts = score(t, c, i, item, history)
        ranked.append({"ticker": t, "name": item["name"], "market": item["market"], "theme": item["theme"], "score": final_score, "scoreParts": score_parts, "chartOk": c.get("ok")})
    ranked.sort(key=lambda x: x["score"], reverse=True)
    if requested_norm:
        selected = next((x for x in ranked if x["ticker"].upper() == requested_norm), None)
        if not selected:
            raise SystemExit(f"unknown ticker: {requested_norm}")
    else:
        selected = next((x for x in ranked if x["chartOk"]), ranked[0])
    q = f'{selected["name"]} {selected["ticker"]} earnings guidance AI data center semiconductor stock'
    if selected["market"] == "KR":
        q = f'{selected["name"]} {selected["ticker"]} 실적 전망 AI 반도체 데이터센터 주가'
    news = google_news(q, selected["market"])
    generated = datetime.now(timezone.utc).isoformat()
    selected_payload = {"generatedAt": generated, "selected": selected, "chart": charts.get(selected["ticker"]), "selectionPolicy": cfg.get("policy"), "selectionHistory": history.get("entries", [])[-14:], "topCandidates": ranked[:10]}
    raw_payload = {"generatedAt": generated, "universeCount": len(symbols), "charts": charts, "newsQuery": q, "news": news, "ranked": ranked, "selectionHistory": history.get("entries", [])[-30:]}
    selected_out.write_text(json.dumps(selected_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    raw_out.write_text(json.dumps(raw_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
