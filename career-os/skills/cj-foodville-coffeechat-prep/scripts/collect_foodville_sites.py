#!/usr/bin/env python3
"""Collect public CJ Foodville related pages into text snapshots.

This intentionally avoids authenticated/browser actions. It fetches public URLs,
extracts conservative text from HTML, and stores both raw and text snapshots for
Claude-backed interview prep.
"""
from __future__ import annotations

import html
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable

import requests


@dataclass(frozen=True)
class Target:
    key: str
    url: str
    label: str


TARGETS = [
    Target("vips", "https://www.ivips.co.kr/", "VIPS"),
    Target("cheiljemyunso-menu", "https://www.cheiljemyunso.co.kr/menu?categoryIdx=4", "제일제면소 메뉴"),
    Target("cjfoodville-brand", "https://m.cjfoodville.co.kr:7443/brand/introduce.asp", "CJ푸드빌 브랜드 소개"),
]


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.skip_depth = 0
        self.title = ""
        self._in_title = False
        self.meta: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attrs_dict = {k.lower(): v or "" for k, v in attrs}
        if tag in {"script", "style", "noscript", "svg"}:
            self.skip_depth += 1
            return
        if tag == "title":
            self._in_title = True
        if tag == "meta":
            name = attrs_dict.get("name") or attrs_dict.get("property")
            content = attrs_dict.get("content")
            if name and content and name.lower() in {
                "description", "og:title", "og:description", "twitter:title", "twitter:description"
            }:
                self.meta.append(f"{name}: {content}")
        if tag in {"p", "div", "li", "br", "section", "article", "h1", "h2", "h3", "h4", "tr"}:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in {"script", "style", "noscript", "svg"} and self.skip_depth:
            self.skip_depth -= 1
        if tag == "title":
            self._in_title = False
        if tag in {"p", "div", "li", "section", "article", "h1", "h2", "h3", "h4", "tr"}:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self.skip_depth:
            return
        text = data.strip()
        if not text:
            return
        if self._in_title:
            self.title += text
        self.parts.append(text + " ")


def clean_text(raw: str) -> str:
    raw = html.unescape(raw)
    # Drop repeated whitespace while preserving paragraph-ish line breaks.
    lines = []
    for line in raw.splitlines():
        line = re.sub(r"\s+", " ", line).strip()
        if line:
            lines.append(line)
    # Remove consecutive duplicates that often come from nav/menu markup.
    deduped: list[str] = []
    prev = None
    for line in lines:
        if line != prev:
            deduped.append(line)
        prev = line
    return "\n".join(deduped)


def fetch(target: Target, outdir: Path) -> dict:
    headers = {
        "User-Agent": "Mozilla/5.0 OpenClaw career-os interview-prep bot",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
    }
    resp = requests.get(target.url, headers=headers, timeout=30, allow_redirects=True, verify=True)
    resp.raise_for_status()
    resp.encoding = resp.apparent_encoding or resp.encoding
    raw = resp.text

    parser = TextExtractor()
    parser.feed(raw)
    body = clean_text("\n".join([*parser.meta, "", *parser.parts]))

    raw_path = outdir / f"{target.key}.html"
    text_path = outdir / f"{target.key}.txt"
    raw_path.write_text(raw, encoding="utf-8", errors="replace")
    text_path.write_text(
        f"# {target.label}\n"
        f"url: {target.url}\n"
        f"final_url: {resp.url}\n"
        f"status: {resp.status_code}\n"
        f"fetched_at: {datetime.now(timezone.utc).isoformat()}\n"
        f"title: {parser.title.strip()}\n\n"
        f"{body}\n",
        encoding="utf-8",
    )
    return {
        "key": target.key,
        "label": target.label,
        "url": target.url,
        "final_url": resp.url,
        "status": resp.status_code,
        "raw_path": str(raw_path),
        "text_path": str(text_path),
        "text_chars": len(body),
    }


def main(argv: list[str]) -> int:
    outdir = Path(argv[1]) if len(argv) > 1 else Path.home() / "ai-nodes/career-os/data/source/cj-foodville-sites"
    outdir.mkdir(parents=True, exist_ok=True)
    results = []
    for target in TARGETS:
        try:
            results.append(fetch(target, outdir))
        except Exception as exc:  # keep partial collection usable
            results.append({"key": target.key, "label": target.label, "url": target.url, "error": repr(exc)})
    (outdir / "manifest.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 0 if all("error" not in r for r in results) else 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
