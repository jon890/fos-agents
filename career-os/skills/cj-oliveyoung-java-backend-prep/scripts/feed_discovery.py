#!/usr/bin/env python3
"""RSS/Atom feed discovery for morning recommendation secondary categories.

ADR-013: tech-blog / AI / geek 카테고리 추천에 실제 최신 글 title + URL을
부착하기 위한 가벼운 RSS/Atom discovery 레이어.

설계 원칙:
- Python stdlib만 사용 (urllib, xml.etree). 신규 의존성 금지.
- 네트워크 실패는 표면화하지 않는다 — 항상 fallback(reservoir 원본)으로 복구 가능해야 한다.
- 디스크 캐시(`data/runtime/feed-cache/`)로 동일 cron 주기 내 중복 요청을 줄인다.
- 타임아웃은 보수적으로 짧게(default 8s).
"""
from __future__ import annotations

import hashlib
import json
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Iterable, Optional
from xml.etree import ElementTree as ET

USER_AGENT = (
    "career-os-morning/1.0 "
    "(+https://github.com/jon890/career-os; daily morning recommendation discovery)"
)
DEFAULT_TIMEOUT = 8
DEFAULT_CACHE_TTL = timedelta(hours=6)
ATOM_NS = {"a": "http://www.w3.org/2005/Atom"}


def _http_get(url: str, timeout: int) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": (
                "application/rss+xml, application/atom+xml, "
                "application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5"
            ),
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _strip_ns(tag: str) -> str:
    return tag.split("}", 1)[1] if "}" in tag else tag


def _atom_link(entry: ET.Element) -> str:
    best = ""
    for link in entry.findall("a:link", ATOM_NS):
        rel = link.attrib.get("rel", "alternate")
        href = link.attrib.get("href", "").strip()
        if not href:
            continue
        if rel == "alternate":
            return href
        if not best:
            best = href
    return best


def _parse_feed(xml_bytes: bytes) -> list[dict]:
    """Parse RSS 2.0 or Atom 1.0. Return list of {title, link, published}."""
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return []

    entries: list[dict] = []
    root_tag = _strip_ns(root.tag).lower()

    if root_tag == "rss":
        channel = root.find("channel")
        if channel is None:
            return entries
        for item in channel.findall("item"):
            entries.append(
                {
                    "title": (item.findtext("title") or "").strip(),
                    "link": (item.findtext("link") or "").strip(),
                    "published": (
                        item.findtext("pubDate")
                        or item.findtext("{http://purl.org/dc/elements/1.1/}date")
                        or ""
                    ).strip(),
                }
            )
        return entries

    if root_tag == "feed":  # Atom
        for entry in root.findall("a:entry", ATOM_NS):
            title = (entry.findtext("a:title", default="", namespaces=ATOM_NS) or "").strip()
            link = _atom_link(entry)
            published = (
                entry.findtext("a:published", default="", namespaces=ATOM_NS)
                or entry.findtext("a:updated", default="", namespaces=ATOM_NS)
                or ""
            ).strip()
            entries.append({"title": title, "link": link, "published": published})
        return entries

    return entries


def _parse_published_dt(s: str) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        pass
    try:
        return parsedate_to_datetime(s)
    except (TypeError, ValueError):
        return None


def _cache_path_for(cache_dir: Path, feed_url: str) -> Path:
    digest = hashlib.sha1(feed_url.encode("utf-8")).hexdigest()[:16]
    return cache_dir / f"{digest}.json"


def fetch_feed_cached(
    feed_url: str,
    cache_dir: Path,
    ttl: timedelta = DEFAULT_CACHE_TTL,
    timeout: int = DEFAULT_TIMEOUT,
) -> list[dict]:
    """Return parsed entries with disk cache. Empty list on hard failure.

    Falls back to stale cache on network/parse failure when available.
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_path = _cache_path_for(cache_dir, feed_url)
    now = datetime.now(timezone.utc)

    if cache_path.exists():
        try:
            cached = json.loads(cache_path.read_text(encoding="utf-8"))
            fetched_at = datetime.fromisoformat(cached.get("fetchedAt", ""))
            if now - fetched_at < ttl:
                return list(cached.get("entries", []))
        except (json.JSONDecodeError, ValueError, OSError):
            pass

    try:
        body = _http_get(feed_url, timeout=timeout)
        entries = _parse_feed(body)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError, ET.ParseError):
        # Network or parse failure → reuse stale cache if any.
        if cache_path.exists():
            try:
                cached = json.loads(cache_path.read_text(encoding="utf-8"))
                return list(cached.get("entries", []))
            except (json.JSONDecodeError, OSError):
                return []
        return []

    payload = {"fetchedAt": now.isoformat(), "feedUrl": feed_url, "entries": entries}
    try:
        cache_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    except OSError:
        pass
    return entries


GENERIC_BACKEND_RELEVANCE_KEYWORDS = [
    "backend", "백엔드", "server", "서버", "spring", "java", "kotlin",
    "mysql", "db", "database", "데이터베이스", "redis", "cache", "캐시",
    "kafka", "flink", "rocksdb", "starrocks", "stream", "streaming", "스트림",
    "transaction", "트랜잭션", "race condition", "경쟁 조건", "동시성",
    "distributed", "분산", "messaging", "메시징", "queue", "event", "이벤트",
    "architecture", "아키텍처", "scale", "scaling", "확장", "slo", "sli",
    "storage", "스토리지", "검색", "search", "운영", "성능", "performance",
    "batch", "배치", "eks", "kubernetes", "autoscaling", "오토스케일링",
]

LOW_SIGNAL_TITLE_KEYWORDS = [
    "세미나", "현장 스케치", "참가 신청", "사전 안내", "공채", "코딩테스트",
    "문제해설", "학생에서 개발자로", "직무", "디자인 직무", "프론트", "front",
]


def _keyword_score(title: str, keywords: Iterable[str]) -> int:
    lower_title = title.lower()
    return sum(1 for kw in keywords if kw and kw.lower() in lower_title)


def select_article(
    entries: Iterable[dict],
    filter_keywords: Optional[list[str]] = None,
    exclude_urls: Optional[Iterable[str]] = None,
) -> Optional[dict]:
    """Choose a non-excluded article from a feed.

    Prefer item-specific keyword matches, but do not fall back to a vague reservoir
    card when a real backend-relevant article exists. Broad company feeds often use
    titles such as "Flink 운영기" or "경쟁 조건 문제" that are useful even when they
    miss the narrow source card keywords.
    """
    excluded = set(exclude_urls or [])
    entries_list = [
        e for e in entries
        if e.get("link")
        and e.get("link") not in excluded
        and _keyword_score(e.get("title") or "", LOW_SIGNAL_TITLE_KEYWORDS) == 0
    ]
    if not entries_list:
        return None

    if filter_keywords:
        exact_matches = [
            e for e in entries_list
            if _keyword_score(e.get("title") or "", filter_keywords) > 0
        ]
        if exact_matches:
            return exact_matches[0]

        relevance_matches = [
            (_keyword_score(e.get("title") or "", GENERIC_BACKEND_RELEVANCE_KEYWORDS), e)
            for e in entries_list
        ]
        relevance_matches = [(score, e) for score, e in relevance_matches if score > 0]
        if relevance_matches:
            # Feed order is usually newest-first; Python sort is stable, so equal scores keep recency.
            relevance_matches.sort(key=lambda pair: pair[0], reverse=True)
            return relevance_matches[0][1]
        return None

    return entries_list[0]


def discover_for_item(
    item: dict,
    cache_dir: Path,
    exclude_urls: Optional[Iterable[str]] = None,
    ttl: timedelta = DEFAULT_CACHE_TTL,
    timeout: int = DEFAULT_TIMEOUT,
) -> Optional[dict]:
    """Run discovery for a reservoir item. Returns chosen article dict or None.

    Item schema additions:
      feedUrl: RSS/Atom URL (optional; absence → no discovery)
      filterKeywords: optional list of keywords to prefer (case-insensitive title match)
    """
    feed_url = item.get("feedUrl")
    if not feed_url:
        return None
    entries = fetch_feed_cached(feed_url, cache_dir, ttl=ttl, timeout=timeout)
    if not entries:
        return None
    return select_article(
        entries,
        filter_keywords=item.get("filterKeywords"),
        exclude_urls=exclude_urls,
    )
