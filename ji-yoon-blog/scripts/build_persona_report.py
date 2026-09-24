"""새 공개 글이 충분할 때 최근 30개와 전수를 비교한 HTML 보고서를 만든다.

수집 원본과 집계 JSON은 기존 스크립트가 만든다. 이 스크립트는 문서 갱신을 하지 않는다.
"""

from __future__ import annotations

import argparse
import html
import json
from collections import Counter
from datetime import date
from pathlib import Path

from analyze_persona import load, overall
from collect_naver_posts import BLOG_ID


def _value(data: dict, *keys):
    for key in keys:
        if not isinstance(data, dict):
            return None
        data = data.get(key)
    return data


def comparison_rows(all_stats: dict, recent_stats: dict) -> list[tuple[str, str, str]]:
    fields = [
        ("글당 사진 중앙값", ("분량", "글당 사진", "median")),
        ("글당 본문 글자 중앙값", ("분량", "글당 본문 글자", "median")),
        ("글당 태그 중앙값", ("분량", "글당 태그(조회 성공분)", "median")),
        ("첫 문단 인사", ("인사", "첫 문단이 인사로 시작", "비율")),
        ("첫 블록 스티커", ("블록 구조", "첫 블록이 스티커")),
        ("마지막 블록 스티커", ("블록 구조", "마지막 블록이 스티커")),
        ("지도 포함", ("블록 구조", "지도 블록 포함", "비율")),
        ("협찬 표기", ("협찬", "전체", "비율")),
    ]
    return [(label, str(_value(recent_stats, *keys) or "자료 없음"), str(_value(all_stats, *keys) or "자료 없음")) for label, keys in fields]


def top_tags(records: list[dict], limit: int = 10) -> list[tuple[str, int]]:
    return Counter(tag for record in records if record.get("tagsFetched") for tag in record.get("tags", [])).most_common(limit)


def render(records: list[dict], all_stats: dict, new_count: int) -> str:
    recent = sorted(
        records,
        key=lambda record: (record.get("resolvedDate", ""), int(record.get("logNo", "0"))),
        reverse=True,
    )[:30]
    recent_stats = overall(recent)
    rows = "".join(
        f"<tr><th>{html.escape(label)}</th><td>{html.escape(recent_value)}</td><td>{html.escape(all_value)}</td></tr>"
        for label, recent_value, all_value in comparison_rows(all_stats, recent_stats)
    )
    categories = "".join(
        f"<tr><th>{html.escape(name)}</th><td>{count}</td></tr>"
        for name, count in recent_stats["카테고리"][:10]
    )
    regions = sorted(recent_stats["지역"].items(), key=lambda item: -item[1]["전체"])
    region_list = ", ".join(f"{html.escape(name)} {item['전체']}건" for name, item in regions[:6] if item["전체"]) or "확인된 지역 없음"
    tag_list = ", ".join(f"#{html.escape(tag)} {count}건" for tag, count in top_tags(recent)) or "조회된 태그 없음"
    expressions = ", ".join(f"{html.escape(name)} {count}건" for name, count, _ in recent_stats["표현 출현율"][:8]) or "집계된 표현 없음"
    recent_posts = "".join(
        f'<li><a href="https://blog.naver.com/{BLOG_ID}/{html.escape(str(record["logNo"]))}">{html.escape(record.get("title", "제목 없음"))}</a> '
        f'<small>{html.escape(record.get("resolvedDate", ""))}</small></li>'
        for record in recent
    )
    return f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>지융로그 페르소나 갱신 검토 · {date.today().isoformat()}</title>
<style>
body{{font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;margin:0;background:#f5f3ee;color:#262521;line-height:1.6}}
main{{max-width:840px;margin:0 auto;padding:44px 24px 80px}}h1{{font-size:30px;margin:0 0 10px}}h2{{font-size:21px;margin-top:38px}}
p{{margin:8px 0 18px}}.meta{{color:#6c6860}}table{{width:100%;border-collapse:collapse;background:#fff}}
th,td{{padding:11px 14px;border-bottom:1px solid #e6e2d9;text-align:left}}th{{font-weight:600}}
thead{{background:#e9e4d9}}.note{{background:#fff;border-left:4px solid #9a7654;padding:14px 18px}}
</style></head><body><main>
<h1>지융로그 페르소나 갱신 검토</h1>
<p class="meta">{date.today().isoformat()} · 새 글 {new_count}개 · 최근 {len(recent)}개와 전체 {len(records)}개 비교</p>
<p class="note">공개 글에서 자동 집계한 값이다. 글의 뉘앙스와 협찬 여부는 표본을 직접 읽고 확인한다. 이 보고서는 페르소나 문서를 자동으로 고치지 않는다.</p>
<h2>최근 글과 전체 비교</h2><table><thead><tr><th>항목</th><th>최근 {len(recent)}개</th><th>전체 {len(records)}개</th></tr></thead><tbody>{rows}</tbody></table>
<h2>최근 글의 카테고리</h2><table><thead><tr><th>카테고리</th><th>글 수</th></tr></thead><tbody>{categories}</tbody></table>
<h2>최근 글에서 나온 표현</h2><p>{expressions}</p>
<h2>지역과 태그</h2><p>지역: {region_list}</p><p>태그: {tag_list}</p>
<h2>검토할 최근 글</h2><ol>{recent_posts}</ol>
<h2>검토 순서</h2><p>최근 글 30개의 문체와 사진·스티커·지도 배치를 읽고, 집계와 다른 예외를 기록한다. 바꿀 내용이 확인되면 사람이 references/ji-yung-persona.md와 references/category-style-map.md를 검토해 수정한다.</p>
</main></body></html>"""


def build_report(posts: Path, stats_path: Path, out: Path, state_path: Path, min_new: int = 10) -> tuple[int, int]:
    records = load(posts)
    if not records:
        raise ValueError("분석할 공개 글이 없다")
    current_ids = {str(record.get("logNo", "")) for record in records}
    previous_ids = set(json.loads(state_path.read_text(encoding="utf-8")).get("reportedIds", [])) if state_path.exists() else set()
    new_count = len(current_ids - previous_ids)
    if new_count < min_new:
        return new_count, 0
    stats = json.loads(stats_path.read_text(encoding="utf-8"))
    if stats.get("전체", {}).get("전체 글") != len(records):
        raise ValueError("집계 JSON이 수집한 글 수와 다르다. analyze_persona.py를 다시 실행한다")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render(records, stats["전체"], new_count), encoding="utf-8")
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps({"reportedIds": sorted(current_ids)}, ensure_ascii=False, indent=2), encoding="utf-8")
    return new_count, len(records)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--posts", default="data/posts")
    parser.add_argument("--stats", default="data/persona-stats.json")
    parser.add_argument("--out", default=f"reports/persona-refresh-{date.today().isoformat()}.html")
    parser.add_argument("--state", default="data/persona-report-state.json")
    parser.add_argument("--min-new", type=int, default=10)
    args = parser.parse_args()
    try:
        new_count, total = build_report(Path(args.posts), Path(args.stats), Path(args.out), Path(args.state), args.min_new)
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(f"보고서를 만들지 못했다: {exc}")
        return 2
    if not total:
        print(f"새 글 {new_count}개라 보고서를 만들지 않았다. 기준은 {args.min_new}개다")
        return 0
    print(f"새 글 {new_count}개, 전체 {total}개 분석. 보고서: {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
