"""수집한 글에 카테고리 이름과 태그를 채운다.

카테고리 이름은 카테고리 번호마다 대표 글 한 건의 본문 페이지에서 얻고,
태그는 태그 목록 API 로 글마다 따로 받는다.

태그를 받지 못한 글은 태그가 없는 글과 구분해 `tagsFetched` 를 거짓으로 남긴다.
이 구분이 없으면 통계가 결측을 태그 없음으로 세어 값이 어긋난다.

사용법:
    python3 enrich_naver_posts.py --out data/posts
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from collect_naver_posts import BLOG_ID, VIEW_URL, fetch

TAG_URL = "https://blog.naver.com/BlogTagListInfo.naver"


def category_names(entries: list[dict]) -> dict[str, str]:
    """카테고리 번호마다 글 하나만 다시 받아 이름을 읽는다."""
    representative: dict[str, str] = {}
    for entry in entries:
        representative.setdefault(entry["categoryNo"], entry["logNo"])

    names: dict[str, str] = {}
    for category_no, log_no in representative.items():
        html = fetch(VIEW_URL, {"blogId": BLOG_ID, "logNo": log_no, "redirect": "Dlog"})
        m = re.search(r'categoryName\s*=\s*"([^"]*)"', html)
        names[category_no] = urllib.parse.unquote_plus(m.group(1)) if m else ""
        time.sleep(0.3)
    return names


def tags_for(log_no: str) -> tuple[list[str], bool]:
    """태그 API 는 여러 건을 한 번에 받지 못해 글마다 따로 요청한다.

    돌려주는 두 번째 값은 응답을 실제로 받았는지다.
    거짓이면 태그가 없는 것이 아니라 조회에 실패한 것이다.
    """
    try:
        raw = fetch(TAG_URL, {"blogId": BLOG_ID, "logNoList": log_no, "logType": "mylog"})
    except Exception:
        return [], False
    m = re.search(r'"tagName":"([^"]*)"', raw)
    if m is None:
        return [], "taglist" in raw
    return [t for t in urllib.parse.unquote_plus(m.group(1)).split(",") if t], True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="data/posts")
    args = parser.parse_args()

    out_dir = Path(args.out)
    files = sorted(out_dir.glob("*.json"))
    records = {f.stem: json.loads(f.read_text(encoding="utf-8")) for f in files}
    print(f"{len(records)}건 로드", file=sys.stderr)

    names = category_names(list(records.values()))
    print(f"카테고리 {len(names)}개: {sorted(names.values())}", file=sys.stderr)

    log_nos = list(records)
    with ThreadPoolExecutor(max_workers=4) as pool:
        tag_map = dict(zip(log_nos, pool.map(tags_for, log_nos)))
    fetched = sum(1 for _, ok in tag_map.values() if ok)
    print(f"태그 응답 {fetched}건, 실패 {len(log_nos) - fetched}건", file=sys.stderr)

    for log_no, record in records.items():
        record["categoryName"] = names.get(record.get("categoryNo", ""), record.get("categoryName", ""))
        tags, ok = tag_map.get(log_no, ([], False))
        if ok or not record.get("tagsFetched"):
            record["tags"] = tags
            record["tagsFetched"] = ok
        (out_dir / f"{log_no}.json").write_text(
            json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    unfetched = sum(1 for r in records.values() if not r.get("tagsFetched"))
    empty = sum(1 for r in records.values() if r.get("tagsFetched") and not r["tags"])
    print(f"완료. 조회 실패 {unfetched}건, 태그가 없는 글 {empty}건", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
