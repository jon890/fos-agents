#!/usr/bin/env python3
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) fos-agents stock-investing-morning-brief/1.0"


def fetch_text(url: str, timeout: int = 12) -> dict:
    headers = {"User-Agent": USER_AGENT}
    if "sec.gov" in url:
        # SEC requires a descriptive user-agent. Keep this non-secret and stable.
        headers["User-Agent"] = "fos-agents stock-investment monitor contact: local-user"
    req = urllib.request.Request(url, headers=headers)
    started = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read(700_000)
            text = raw.decode("utf-8", errors="replace")
            return {
                "ok": True,
                "status": getattr(resp, "status", None),
                "url": url,
                "elapsedMs": int((time.time() - started) * 1000),
                "text": text,
            }
    except Exception as e:
        return {
            "ok": False,
            "url": url,
            "elapsedMs": int((time.time() - started) * 1000),
            "error": repr(e),
        }


def sma(values, n: int):
    vals = [v for v in values if isinstance(v, (int, float))]
    if len(vals) < n:
        return None
    return sum(vals[-n:]) / n


def rsi(values, period: int = 14):
    vals = [v for v in values if isinstance(v, (int, float))]
    if len(vals) < period + 1:
        return None
    gains = []
    losses = []
    for prev, cur in zip(vals[-period - 1:-1], vals[-period:]):
        diff = cur - prev
        gains.append(max(diff, 0))
        losses.append(max(-diff, 0))
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    if avg_loss == 0:
        return 100.0 if avg_gain > 0 else 50.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def yahoo_chart(symbol: str, range_: str = "1mo", interval: str = "1d") -> dict:
    safe = urllib.parse.quote(symbol, safe="")
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{safe}?range={range_}&interval={interval}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        result = (data.get("chart", {}).get("result") or [None])[0]
        if not result:
            return {"symbol": symbol, "ok": False, "error": data.get("chart", {}).get("error")}
        meta = result.get("meta", {})
        quote = (result.get("indicators", {}).get("quote") or [{}])[0]
        ts = result.get("timestamp") or []
        closes = quote.get("close") or []
        opens = quote.get("open") or []
        highs = quote.get("high") or []
        lows = quote.get("low") or []
        volumes = quote.get("volume") or []
        points = []
        for i, t in enumerate(ts):
            points.append({
                "date": datetime.fromtimestamp(t, timezone.utc).date().isoformat(),
                "open": opens[i] if i < len(opens) else None,
                "high": highs[i] if i < len(highs) else None,
                "low": lows[i] if i < len(lows) else None,
                "close": closes[i] if i < len(closes) else None,
                "volume": volumes[i] if i < len(volumes) else None,
            })
        valid = [p for p in points if isinstance(p.get("close"), (int, float))]
        current = meta.get("regularMarketPrice")
        first = valid[0]["close"] if valid else None
        last = valid[-1]["close"] if valid else current
        pct_range = ((last / first - 1) * 100) if first and last else None
        high52 = meta.get("fiftyTwoWeekHigh")
        low52 = meta.get("fiftyTwoWeekLow")
        pct_from_high = ((current / high52 - 1) * 100) if current and high52 else None
        pct_from_low = ((current / low52 - 1) * 100) if current and low52 else None
        prev_valid_close = valid[-2]["close"] if len(valid) >= 2 else None
        last_valid_close = valid[-1]["close"] if valid else current
        day_change_pct = ((last_valid_close / prev_valid_close - 1) * 100) if last_valid_close and prev_valid_close else None
        closes_valid = [p.get("close") for p in valid if isinstance(p.get("close"), (int, float))]
        volumes_valid = [p.get("volume") for p in valid if isinstance(p.get("volume"), (int, float))]
        ma20 = sma(closes_valid, 20)
        vol20 = sma(volumes_valid, 20)
        last_volume = volumes_valid[-1] if volumes_valid else None
        return {
            "symbol": symbol,
            "ok": True,
            "name": meta.get("longName") or meta.get("shortName"),
            "currency": meta.get("currency"),
            "exchange": meta.get("fullExchangeName") or meta.get("exchangeName"),
            "regularMarketPrice": current,
            "previousClose": meta.get("chartPreviousClose"),
            "previousValidClose": prev_valid_close,
            "lastValidClose": last_valid_close,
            "lastDayChangePctByDailyClose": day_change_pct,
            "fiftyTwoWeekHigh": high52,
            "fiftyTwoWeekLow": low52,
            "range": range_,
            "rangeChangePct": pct_range,
            "pctFrom52WeekHigh": pct_from_high,
            "pctFrom52WeekLow": pct_from_low,
            "rsi14": rsi(closes_valid, 14),
            "sma20": ma20,
            "pctFromSma20": ((last_valid_close / ma20 - 1) * 100) if last_valid_close and ma20 else None,
            "lastVolume": last_volume,
            "avgVolume20": vol20,
            "volumeVsAvg20": (last_volume / vol20) if last_volume and vol20 else None,
            "recent": valid[-10:],
        }
    except Exception as e:
        return {"symbol": symbol, "ok": False, "error": repr(e), "url": url}


def strip_html(html: str) -> str:
    html = re.sub(r"(?is)<script.*?</script>|<style.*?</style>", " ", html)
    text = re.sub(r"(?s)<[^>]+>", " ", html)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&#39;", "'", text)
    text = re.sub(r"&quot;", '"', text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_news_items(source: dict, max_items: int = 8) -> dict:
    res = fetch_text(source["url"])
    base = {"id": source.get("id"), "url": source.get("url"), "topic": source.get("topic"), "ok": res["ok"]}
    if not res["ok"]:
        base["error"] = res.get("error")
        return base
    if source.get("type") == "sec-submissions-json":
        try:
            payload = json.loads(res.get("text", ""))
            recent = payload.get("filings", {}).get("recent", {})
            forms = recent.get("form", [])
            dates = recent.get("filingDate", [])
            accessions = recent.get("accessionNumber", [])
            primary_docs = recent.get("primaryDocument", [])
            descriptions = recent.get("primaryDocDescription", [])
            items = []
            for i, form in enumerate(forms[:max_items]):
                date = dates[i] if i < len(dates) else ""
                acc = accessions[i] if i < len(accessions) else ""
                doc = primary_docs[i] if i < len(primary_docs) else ""
                desc = descriptions[i] if i < len(descriptions) else ""
                items.append(f"{date} {form}: {desc or 'SEC filing'} acc={acc} doc={doc}")
            base.update({"status": res.get("status"), "elapsedMs": res.get("elapsedMs"), "items": items})
            return base
        except Exception as e:
            base.update({"ok": False, "error": f"SEC JSON parse failed: {e!r}"})
            return base
    text = strip_html(res.get("text", ""))
    # Keep compact snippets around likely relevant keywords across the full watchlist.
    keywords = [
        "Circle", "USDC", "stablecoin", "Bitcoin", "BTC", "ETF", "CLARITY", "SEC", "payment", "Payments", "Thunes", "Mesh",
        "Alphabet", "Google", "GOOGL", "GOOG", "Gemini", "AI", "I/O", "Google I/O", "Cloud", "TPU", "Search",
        "Nasdaq", "QQQ", "NDX", "technology", "growth stocks", "Magnificent", "semiconductor", "rates", "yields",
        "NVIDIA", "NVDA", "Blackwell", "Rubin", "GPU", "accelerator", "TSMC", "TSM", "CoWoS", "foundry",
        "Broadcom", "AVGO", "ASIC", "networking", "AMD", "MI300", "MI350", "ASML", "EUV", "High-NA",
        "Vertiv", "VRT", "data center", "datacenter", "power", "cooling", "infrastructure", "AI infrastructure",
    ]
    sentences = re.split(r"(?<=[.!?])\s+", text)
    hits = []
    seen = set()
    for s in sentences:
        s = s.strip()
        if len(s) < 40 or len(s) > 350:
            continue
        if any(k.lower() in s.lower() for k in keywords):
            key = s[:120]
            if key not in seen:
                seen.add(key)
                hits.append(s)
        if len(hits) >= max_items:
            break
    if not hits:
        hits = [text[:800]] if text else []
    base.update({"status": res.get("status"), "elapsedMs": res.get("elapsedMs"), "items": hits[:max_items]})
    return base


def main() -> int:
    if len(sys.argv) != 5:
        print("usage: collect_sources.py <watchlist.json> <sources.json> <market-data.json> <raw-news.json>", file=sys.stderr)
        return 2
    watchlist_path, sources_path, market_out, news_out = map(Path, sys.argv[1:])
    watchlist = json.loads(watchlist_path.read_text(encoding="utf-8"))
    sources_cfg = json.loads(sources_path.read_text(encoding="utf-8"))
    profile_key = watchlist.get("defaultProfile", "circle-bitcoin")
    profile = watchlist["profiles"][profile_key]

    symbols = []
    for group in ("primaryEquities", "crypto", "macroIndices", "expansionWatchlist"):
        for item in profile.get(group, []):
            if item.get("symbol") not in symbols:
                symbols.append(item["symbol"])

    ranges = sources_cfg.get("priceRanges", {})
    market = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "profile": profile_key,
        "symbols": {sym: yahoo_chart(sym, ranges.get(sym, "1mo")) for sym in symbols},
    }
    news = {
        "generatedAt": market["generatedAt"],
        "profile": profile_key,
        "sources": [extract_news_items(src) for src in sources_cfg.get("newsSources", [])],
    }
    Path(market_out).write_text(json.dumps(market, ensure_ascii=False, indent=2), encoding="utf-8")
    Path(news_out).write_text(json.dumps(news, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
