#!/usr/bin/env python3
import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) fos-agents stock-investment issue-analysis/1.0"


def fetch_text(url: str, timeout: int = 15) -> dict:
    headers = {"User-Agent": USER_AGENT}
    if "sec.gov" in url:
        headers["User-Agent"] = "fos-agents stock-investment issue analysis contact: local-user"
    req = urllib.request.Request(url, headers=headers)
    started = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            text = resp.read(900_000).decode("utf-8", errors="replace")
            return {"ok": True, "status": getattr(resp, "status", None), "url": url, "elapsedMs": int((time.time()-started)*1000), "text": text}
    except Exception as e:
        return {"ok": False, "url": url, "elapsedMs": int((time.time()-started)*1000), "error": repr(e)}


def strip_html(html: str) -> str:
    html = re.sub(r"(?is)<script.*?</script>|<style.*?</style>", " ", html)
    text = re.sub(r"(?s)<[^>]+>", " ", html)
    entities = {"&nbsp;": " ", "&amp;": "&", "&#39;": "'", "&quot;": '"', "&rsquo;": "'", "&ldquo;": '"', "&rdquo;": '"'}
    for k, v in entities.items():
        text = text.replace(k, v)
    return re.sub(r"\s+", " ", text).strip()


def sec_items(text: str, max_items: int) -> list[str]:
    payload = json.loads(text)
    recent = payload.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    dates = recent.get("filingDate", [])
    accessions = recent.get("accessionNumber", [])
    docs = recent.get("primaryDocument", [])
    descs = recent.get("primaryDocDescription", [])
    out = []
    for i, form in enumerate(forms[:max_items]):
        out.append(f"{dates[i] if i < len(dates) else ''} {form}: {descs[i] if i < len(descs) else 'SEC filing'} acc={accessions[i] if i < len(accessions) else ''} doc={docs[i] if i < len(docs) else ''}")
    return out


def extract_source(source: dict, max_items: int = 12) -> dict:
    res = fetch_text(source["url"])
    base = {"id": source.get("id"), "url": source.get("url"), "topic": source.get("topic"), "ok": res.get("ok")}
    if not res.get("ok"):
        base["error"] = res.get("error")
        return base
    try:
        if source.get("type") == "sec-submissions-json":
            base.update({"status": res.get("status"), "elapsedMs": res.get("elapsedMs"), "items": sec_items(res.get("text", ""), max_items)})
            return base
    except Exception as e:
        base.update({"ok": False, "error": f"special parser failed: {e!r}"})
        return base

    text = strip_html(res.get("text", ""))
    keywords = [
        "CLARITY", "Digital Asset", "digital asset", "CFTC", "SEC", "stablecoin", "USDC", "Circle", "Bitcoin", "crypto", "market structure", "DeFi", "commodity", "security",
        "Google", "Alphabet", "GOOGL", "GOOG", "Gemini", "AI", "I/O", "Google I/O", "Cloud", "TPU", "Search", "advertising", "antitrust", "DOJ", "CapEx", "developer",
        "Nasdaq", "QQQ", "technology", "growth stocks",
    ]
    sentences = re.split(r"(?<=[.!?])\s+", text)
    hits, seen = [], set()
    for s in sentences:
        s = s.strip()
        if len(s) < 45 or len(s) > 500:
            continue
        if any(k.lower() in s.lower() for k in keywords):
            key = s[:160]
            if key not in seen:
                seen.add(key)
                hits.append(s)
        if len(hits) >= max_items:
            break
    if not hits and text:
        hits = [text[:1200]]
    base.update({"status": res.get("status"), "elapsedMs": res.get("elapsedMs"), "items": hits[:max_items]})
    return base


def main() -> int:
    if len(sys.argv) != 5:
        print("usage: collect_issue_sources.py <current-issues.json> <issue-key> <raw-sources.json> <issue-meta.json>", file=sys.stderr)
        return 2
    cfg_path = Path(sys.argv[1])
    issue_key = sys.argv[2]
    raw_out = Path(sys.argv[3])
    meta_out = Path(sys.argv[4])
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    issue = cfg["issues"][issue_key]
    generated_at = datetime.now(timezone.utc).isoformat()
    raw = {
        "generatedAt": generated_at,
        "issueKey": issue_key,
        "title": issue.get("title"),
        "sources": [extract_source(s) for s in issue.get("sources", [])],
    }
    meta = {
        "generatedAt": generated_at,
        "issueKey": issue_key,
        "title": issue.get("title"),
        "description": issue.get("description"),
        "focusQuestions": issue.get("focusQuestions", []),
    }
    raw_out.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
    meta_out.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
