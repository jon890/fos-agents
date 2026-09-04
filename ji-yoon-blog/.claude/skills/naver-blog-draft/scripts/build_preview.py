"""초안 JSON 과 내려받은 사진으로 미리보기 HTML 을 만든다.

네이버 블로그 모바일 화면 폭으로 그려서 실제로 올라갔을 때의 흐름을 본다.
사진은 파일을 그대로 참조하므로 내려받은 디렉터리를 지우면 안 보인다.

초안 JSON 형식:

    {
      "title": "불향 가득한 군산 곱창 맛집 순돌이곱창 메뉴, 웨이팅 후기",
      "category": "맛집로그",
      "tags": ["군산맛집", "내돈내산"],
      "blocks": [
        {"type": "sticker"},
        {"type": "text", "lines": ["안녕하세요 지융입니다 😋", "오늘은 ..."]},
        {"type": "image", "path": "tmp/001-IMG_0001.jpg", "caption": ""},
        {"type": "map", "address": "전북특별자치도 군산시 ..."}
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
        return f'<div class="sticker">{html.escape(block.get("emoji", "🌿"))}</div>'

    if kind == "map":
        return f'<div class="map">📍 {html.escape(block.get("address", ""))}</div>'

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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("draft")
    parser.add_argument("--out", default="preview.html")
    args = parser.parse_args()

    draft_path = Path(args.draft)
    draft = json.loads(draft_path.read_text(encoding="utf-8"))
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
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
