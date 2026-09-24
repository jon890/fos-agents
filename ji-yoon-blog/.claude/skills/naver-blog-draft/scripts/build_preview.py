"""초안 JSON 과 내려받은 사진으로 미리보기 HTML 을 만든다.

네이버 블로그 모바일 화면 폭으로 그려서 실제로 올라갔을 때의 흐름을 본다.
사진은 파일을 그대로 참조하므로 내려받은 디렉터리를 지우면 안 보인다.

초안 JSON 형식:

    {
      "title": "불향 가득한 군산 곱창 맛집 순돌이곱창 메뉴, 웨이팅 후기",
      "category": "맛집로그",
      "sponsored": false,
      "tags": ["군산맛집", "내돈내산"],
      "blocks": [
        {"type": "sticker", "stickerCode": "ogq_5db4314bac2f0-1"},
        {"type": "text", "lines": ["안녕하세요 지융입니다 😋", "오늘은 ..."]},
        {"type": "image", "path": "tmp/001-IMG_0001.jpg", "caption": ""},
        {"type": "map", "name": "순돌이곱창", "address": "전북특별자치도 군산시 ..."}
      ]
    }

사용법:
    python3 build_preview.py draft.json --out preview.html
"""

from __future__ import annotations

import argparse
import html
import json
from pathlib import Path

STYLE = """
:root { color-scheme: light dark; --bg:#f2f3f5; --card:#fff; --ink:#1a1a1a; --muted:#767676;
        --line:#e5e5e5; --tag:#eef3fb; --tagink:#2f6ecb; }
@media (prefers-color-scheme: dark) {
  :root { --bg:#16171a; --card:#1f2023; --ink:#e8e8e8; --muted:#9a9a9a; --line:#33343a;
          --tag:#232b3a; --tagink:#7aa7ee; }
}
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--ink);
       font-family:-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif; }
.wrap { max-width:480px; margin:0 auto; padding:24px 0 64px; }
.meta { padding:12px 20px; color:var(--muted); font-size:12px; }
.post { background:var(--card); border-radius:14px; overflow:hidden;
        box-shadow:0 1px 3px rgba(0,0,0,.08); }
h1 { font-size:19px; line-height:1.45; margin:0; padding:24px 20px 16px;
     border-bottom:1px solid var(--line); font-weight:700; }
.body { padding:20px; }
.text { margin:0 0 18px; }
.text p { margin:0; font-size:15px; line-height:1.85; }
.photo { margin:0 0 18px; }
.photo img { width:100%; border-radius:8px; display:block; }
.photo .cap { font-size:12px; color:var(--muted); padding-top:6px; }
.missing { padding:40px 12px; text-align:center; background:var(--tag); border-radius:8px;
           color:var(--muted); font-size:13px; }
.sticker { text-align:center; font-size:26px; margin:0 0 18px; }
.map { border:1px solid var(--line); border-radius:8px; padding:14px;
       font-size:13px; color:var(--muted); margin:0 0 18px; }
.tags { padding:16px 20px 24px; border-top:1px solid var(--line); }
.tags span { display:inline-block; background:var(--tag); color:var(--tagink);
             border-radius:12px; padding:4px 10px; font-size:12px; margin:0 6px 6px 0; }
.count { padding:10px 20px; font-size:12px; color:var(--muted); }
"""


def render_block(block: dict, base: Path) -> str:
    kind = block.get("type")

    if kind == "text":
        lines = block.get("lines") or []
        rows = "".join(f"<p>{html.escape(line)}</p>" for line in lines)
        return f'<div class="text">{rows}</div>'

    if kind == "image":
        path = block.get("path", "")
        cap = block.get("caption", "")
        target = (base / path) if path and not Path(path).is_absolute() else Path(path)
        if path and target.exists():
            src = html.escape(target.resolve().as_uri())
            body = f'<img src="{src}" alt="">'
        else:
            body = f'<div class="missing">사진 없음<br>{html.escape(path or "경로 없음")}</div>'
        caption = f'<div class="cap">{html.escape(cap)}</div>' if cap else ""
        return f'<div class="photo">{body}{caption}</div>'

    if kind == "sticker":
        labels = {
            "ogq_5db4314bac2f0-1": "안녕하세요 스티커",
            "ogq_5db4314bac2f0-4": "위치정보 스티커",
            "ogq_5db4314bac2f0-6": "가격표 스티커",
            "ogq_5db4314bac2f0-23": "내돈내산 스티커",
        }
        return f'<div class="sticker">{html.escape(labels.get(block.get("stickerCode"), "스티커"))}</div>'

    if kind == "map":
        return f'<div class="map">📍 {html.escape(block.get("name", ""))} · {html.escape(block.get("address", ""))}</div>'

    return f'<div class="missing">모르는 블록: {html.escape(str(kind))}</div>'


def build(draft: dict, base: Path) -> str:
    blocks = draft.get("blocks") or []
    body = "".join(render_block(b, base) for b in blocks)
    tags = "".join(f"<span>#{html.escape(t)}</span>" for t in draft.get("tags") or [])
    photos = sum(1 for b in blocks if b.get("type") == "image")
    letters = sum(
        len(line) for b in blocks if b.get("type") == "text" for line in (b.get("lines") or [])
    )
    title = html.escape(draft.get("title", "제목 없음"))
    category = html.escape(draft.get("category", ""))

    return f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title><style>{STYLE}</style></head>
<body><div class="wrap">
<div class="meta">{category} · 미리보기. 아직 네이버에 올라가지 않았다.</div>
<div class="post">
<h1>{title}</h1>
<div class="body">{body}</div>
<div class="tags">{tags}</div>
</div>
<div class="count">사진 {photos}장 · 본문 {letters}자 · 태그 {len(draft.get("tags") or [])}개</div>
</div></body></html>
"""


BLOCK_FIELDS = {
    "sticker": "stickerCode",
    "text": "lines",
    "image": "path",
    "map": "name",
}
STICKER_CODES = {
    "hello": "ogq_5db4314bac2f0-1",
    "location": "ogq_5db4314bac2f0-4",
    "price": "ogq_5db4314bac2f0-6",
    "self_paid": "ogq_5db4314bac2f0-23",
}


def validate(draft: dict) -> list[str]:
    """초안이 `data-schema.md` 의 계약을 지키는지 본다. 어긋난 것을 문장으로 돌려준다.

    `lines` 에 문자열 하나를 넣는 실수가 가장 잦다.
    그대로 두면 미리보기가 글자 하나를 한 문단으로 그리고 종료 코드는 0 이라
    줄 나눔이 무너진 것을 사람이 알아채지 못한다.
    """
    problems: list[str] = []

    if not isinstance(draft.get("title"), str) or not draft["title"].strip():
        problems.append("title 이 비어 있다")
    if not isinstance(draft.get("category"), str) or not draft["category"].strip():
        problems.append("category 가 비어 있다")

    tags = draft.get("tags")
    if not isinstance(tags, list) or not tags or not all(isinstance(t, str) and t.strip() and not t.startswith("#") for t in tags):
        problems.append("tags 는 # 없는 비어 있지 않은 문자열 배열이어야 한다")
    if not isinstance(draft.get("sponsored"), bool):
        problems.append("sponsored 는 지융에게 확인한 참 또는 거짓이어야 한다")

    blocks = draft.get("blocks")
    if not isinstance(blocks, list) or not blocks:
        problems.append("blocks 는 비어 있지 않은 배열이어야 한다")
        return problems

    for i, block in enumerate(blocks):
        where = f"blocks[{i}]"
        if not isinstance(block, dict):
            problems.append(f"{where} 가 객체가 아니다")
            continue
        kind = block.get("type")
        if kind not in BLOCK_FIELDS:
            problems.append(f"{where} 의 type 이 모르는 값이다: {kind!r}")
            continue
        field = BLOCK_FIELDS[kind]
        if field not in block:
            problems.append(f"{where}({kind}) 에 {field} 가 없다")
            continue
        value = block[field]
        if kind == "text":
            if not isinstance(value, list):
                problems.append(f"{where}(text) 의 lines 가 배열이 아니다. 한 줄도 배열로 넣는다")
            elif not all(isinstance(line, str) for line in value):
                problems.append(f"{where}(text) 의 lines 에 문자열이 아닌 원소가 있다")
            elif not value:
                problems.append(f"{where}(text) 의 lines 가 비어 있다")
        elif not isinstance(value, str) or not value.strip():
            problems.append(f"{where}({kind}) 의 {field} 가 비어 있다")
        if kind == "sticker" and value not in STICKER_CODES.values():
            problems.append(f"{where}(sticker) 의 stickerCode 를 모른다: {value!r}")
        if kind == "map" and (not isinstance(block.get("address"), str) or not block["address"].strip()):
            problems.append(f"{where}(map) 의 address 가 없다")

    if draft.get("category") in ("맛집로그", "카페로그"):
        codes = [b.get("stickerCode") for b in blocks if isinstance(b, dict) and b.get("type") == "sticker"]
        if not isinstance(blocks[0], dict) or blocks[0].get("stickerCode") != STICKER_CODES["hello"]:
            problems.append("첫 블록은 안녕하세요 스티커여야 한다")
        if not isinstance(blocks[-1], dict) or blocks[-1].get("stickerCode") != STICKER_CODES["location"]:
            problems.append("마지막 블록은 위치정보 스티커여야 한다")
        menu_images = [i for i, b in enumerate(blocks) if isinstance(b, dict) and b.get("type") == "image" and b.get("role") == "menu"]
        if len(menu_images) != 1 or menu_images[0] == 0 or not isinstance(blocks[menu_images[0] - 1], dict) or blocks[menu_images[0] - 1].get("stickerCode") != STICKER_CODES["price"]:
            problems.append("메뉴판 사진 하나 바로 앞에 가격표 스티커를 둔다")
        if codes.count(STICKER_CODES["self_paid"]) != (0 if draft.get("sponsored") else 1):
            problems.append("비협찬 글에만 내돈내산 스티커를 하나 둔다")
        if not any(isinstance(b, dict) and b.get("type") == "map" and b.get("name") and b.get("address") for b in blocks):
            problems.append("상호명과 주소가 있는 지도 블록을 둔다")

    return problems


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("draft")
    parser.add_argument("--out", default="preview.html")
    parser.add_argument(
        "--allow-missing-photos",
        action="store_true",
        help="사진을 아직 받지 않은 초안도 통과시킨다. 문체만 먼저 볼 때 쓴다",
    )
    args = parser.parse_args()

    draft_path = Path(args.draft)
    draft = json.loads(draft_path.read_text(encoding="utf-8"))

    problems = validate(draft)
    if problems:
        print(f"{draft_path} 가 초안 계약을 지키지 않는다:")
        for problem in problems:
            print(f"  - {problem}")
        print("계약은 ji-yoon-blog/docs/data-schema.md 의 초안 절이 소유한다.")
        return 2

    out = Path(args.out)
    out.write_text(build(draft, draft_path.parent), encoding="utf-8")

    blocks = draft.get("blocks") or []
    missing = [
        b.get("path", "")
        for b in blocks
        if b.get("type") == "image" and not (draft_path.parent / b.get("path", "")).exists()
    ]
    print(f"{out} 생성")
    if missing:
        print(f"사진 {len(missing)}장을 찾지 못했다: {missing[:3]}")
        if not args.allow_missing_photos:
            return 1
        print("--allow-missing-photos 로 넘어간다. 네이버에 넣기 전에 사진을 채운다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
