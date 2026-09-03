"""지융로그 네이버 블로그 전체 글을 수집한다.

목록 API로 logNo 를 모두 모으고, 각 글의 본문 HTML 을 받아
제목, 카테고리, 작성일, 본문 문단, 이미지 수, 태그를 JSON 으로 저장한다.

사용법:
    python3 collect_naver_posts.py --out ../data/posts
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, timedelta
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from bs4 import BeautifulSoup

BLOG_ID = "mywldbs"
LIST_URL = "https://blog.naver.com/PostTitleListAsync.naver"
VIEW_URL = "https://blog.naver.com/PostView.naver"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"


def fetch(url: str, params: dict, retries: int = 4) -> str:
    """429 는 네이버가 잠깐 막은 것이라 간격을 늘려가며 다시 요청한다."""
    query = urllib.parse.urlencode(params)
    req = urllib.request.Request(
        f"{url}?{query}",
        headers={"User-Agent": UA, "Referer": f"https://blog.naver.com/{BLOG_ID}"},
    )
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as exc:
            if exc.code != 429 or attempt == retries - 1:
                raise
            time.sleep(2 ** attempt * 1.5)
    raise RuntimeError("unreachable")


def resolve_date(add_date: str, today: date | None = None) -> str:
    """목록 API 는 최근 글의 날짜를 `23시간 전` 처럼 상대 표기로 준다.

    연도별 집계에서 빠지지 않도록 수집 시점을 기준으로 절대 날짜로 바꾼다.
    """
    today = today or date.today()
    text = add_date.strip()

    m = re.match(r"(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})", text)
    if m:
        return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"

    m = re.match(r"(\d+)\s*일 전", text)
    if m:
        return (today - timedelta(days=int(m.group(1)))).isoformat()

    if re.match(r"(\d+)\s*(시간|분|초) 전|방금", text):
        return today.isoformat()

    return ""


def parse_list_page(raw: str) -> list[dict]:
    """네이버 목록 응답은 JSON 규격을 벗어난 escape 를 포함해 정규식으로 읽는다."""
    posts = []
    for block in re.findall(r"\{[^{}]*?\"logNo\":\"\d+\".*?\}", raw):
        def field(name: str) -> str:
            m = re.search(rf'"{name}":"?(.*?)"?[,}}]', block)
            return m.group(1) if m else ""

        add_date = field("addDate")
        posts.append(
            {
                "logNo": field("logNo"),
                "title": urllib.parse.unquote_plus(field("title")),
                "categoryNo": field("categoryNo"),
                "addDate": add_date,
                "resolvedDate": resolve_date(add_date),
                "commentCount": field("commentCount"),
            }
        )
    return posts


def collect_list(count_per_page: int = 30) -> list[dict]:
    first = fetch(LIST_URL, {"blogId": BLOG_ID, "currentPage": 1, "countPerPage": count_per_page})
    total = int(re.search(r'"totalCount":"?(\d+)', first).group(1))
    pages = (total + count_per_page - 1) // count_per_page
    print(f"총 {total}건, {pages}페이지", file=sys.stderr)

    posts = parse_list_page(first)
    for page in range(2, pages + 1):
        raw = fetch(LIST_URL, {"blogId": BLOG_ID, "currentPage": page, "countPerPage": count_per_page})
        posts.extend(parse_list_page(raw))
        if page % 10 == 0:
            print(f"  목록 {page}/{pages}", file=sys.stderr)
        time.sleep(0.15)
    return posts


def parse_post(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    category_name = ""
    m = re.search(r'categoryName\s*=\s*"([^"]*)"', html)
    if m:
        category_name = urllib.parse.unquote_plus(m.group(1))
    container = soup.select_one(".se-main-container") or soup.select_one("#postViewArea")
    if container is None:
        return {"categoryName": category_name, "error": "본문 컨테이너 없음"}

    paragraphs = []
    for node in container.select(".se-text-paragraph, .se-fs-, p"):
        text = node.get_text(" ", strip=True).replace("​", "").strip()
        if text:
            paragraphs.append(text)

    seen, ordered = set(), []
    for text in paragraphs:
        if text not in seen:
            seen.add(text)
            ordered.append(text)

    blocks = []
    for module in container.select(".se-component"):
        classes = module.get("class", [])
        kind = next((c.replace("se-", "") for c in classes if c.startswith("se-") and c not in ("se-component",)), "unknown")
        blocks.append(kind)

    tags = [t.get_text(strip=True).lstrip("#") for t in soup.select(".post_tag, .item_tag, .tag_item")]
    date = soup.select_one(".se_publishDate, .date, .blog2_container .se_publishDate")

    return {
        "categoryName": category_name,
        "paragraphs": ordered,
        "block_sequence": blocks,
        "image_count": len(container.select(".se-image, .se-imageStrip img, img.se-image-resource")),
        "sticker_count": len(container.select(".se-sticker")),
        "map_count": len(container.select(".se-placesMap, .se-map")),
        "quote_count": len(container.select(".se-quotation")),
        "tags": tags,
        "published": date.get_text(strip=True) if date else "",
        "char_count": sum(len(p) for p in ordered),
    }


def fetch_post(entry: dict, out_dir: Path) -> str:
    target = out_dir / f"{entry['logNo']}.json"
    if target.exists():
        return "skip"
    try:
        html = fetch(
            VIEW_URL,
            {
                "blogId": BLOG_ID,
                "logNo": entry["logNo"],
                "redirect": "Dlog",
                "widgetTypeCall": "true",
                "directAccess": "false",
            },
        )
        record = {**entry, **parse_post(html)}
    except Exception as exc:  # 네트워크·파싱 실패는 기록만 남기고 계속 진행한다
        record = {**entry, "error": f"{type(exc).__name__}: {exc}"}
    target.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    return "ok"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="data/posts")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--limit", type=int, default=0, help="0 이면 전량")
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    index_path = out_dir.parent / "post-index.json"
    if index_path.exists():
        entries = json.loads(index_path.read_text(encoding="utf-8"))
        print(f"기존 목록 재사용: {len(entries)}건", file=sys.stderr)
    else:
        entries = collect_list()
        index_path.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.limit:
        entries = entries[: args.limit]

    done = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        for _ in pool.map(lambda e: fetch_post(e, out_dir), entries):
            done += 1
            if done % 50 == 0:
                print(f"  본문 {done}/{len(entries)}", file=sys.stderr)

    print(f"완료: {done}건", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
