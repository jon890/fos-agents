"""초안 JSON 과 내려받은 사진으로 미리보기 HTML 을 만든다.

네이버 블로그 모바일 화면 폭으로 그려서 실제로 올라갔을 때의 흐름을 본다.
HTML 은 자기 폴더 안의 파일만 상대 경로로 부른다.
사진과 스티커가 그 폴더 밖에 있으면 폴더 안으로 복사한다. 원본은 옮기지 않는다.
복사하는 JPEG 사진은 긴 변 1600px 로 줄이고 촬영 위치가 든 EXIF 를 뺀다. `preview_photos.py` 가 한다.
초안 폴더 밖의 사진(절대 경로나 `../`)은 `external/` 아래에 두고, 이름이 겹치면 번호를 붙인다.
fos-assistant 의 결과물 화면은 스크립트와 외부 이미지, 외부 CSS 를 막으므로
인라인 스타일과 같은 폴더의 이미지만 쓴다.

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
    python3 build_preview.py draft.json --out <결과물 폴더>/초안/index.html
"""

from __future__ import annotations

import argparse
import html
import json
import sys
from pathlib import Path
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).parent))
from draft_contract import validate  # noqa: E402
from preview_photos import LONG_EDGE, display_size, preview_bytes  # noqa: E402

# fos-assistant 결과물 화면이 내어 주는 이미지 형식이다. HEIC 와 SVG 는 여기에 없다.
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp"}

STICKER_LABELS = {
    "ogq_5db4314bac2f0-1": "안녕하세요 스티커",
    "ogq_5db4314bac2f0-4": "위치정보 스티커",
    "ogq_5db4314bac2f0-6": "가격표 스티커",
    "ogq_5db4314bac2f0-23": "내돈내산 스티커",
}

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
.photo img { width:100%; height:auto; border-radius:8px; display:block; }
.photo .cap { font-size:12px; color:var(--muted); padding-top:6px; }
.missing { padding:40px 12px; text-align:center; background:var(--tag); border-radius:8px;
           color:var(--muted); font-size:13px; }
.sticker { text-align:center; font-size:26px; margin:0 0 18px; }
.sticker img { display:block; width:min(100%, 370px); height:auto; margin:0 auto;
               background:#fff; border-radius:8px; }
.map { border:1px solid var(--line); border-radius:8px; padding:14px;
       font-size:13px; color:var(--muted); margin:0 0 18px; }
.map a { color:var(--tagink); text-decoration:none; }
.tags { padding:16px 20px 24px; border-top:1px solid var(--line); }
.tags span { display:inline-block; background:var(--tag); color:var(--tagink);
             border-radius:12px; padding:4px 10px; font-size:12px; margin:0 6px 6px 0; }
.count { padding:10px 20px; font-size:12px; color:var(--muted); }
"""


def place_asset(
    source: Path, base: Path, out_dir: Path, fallback: str, data: bytes | None = None
) -> str:
    """source 를 out_dir 안에서 부를 상대 경로를 돌려준다.

    out_dir 밖에 있으면 초안 폴더 안의 상대 위치를 유지해 복사한다.
    data 를 주면 원본 대신 그 바이트를 쓴다. 줄인 사진을 넣을 때 쓴다.
    초안 폴더 밖의 파일은 fallback 자리에 두고, 그 자리에 내용이 다른 파일이 있으면
    `이름-2.jpg` 처럼 번호를 붙여 덮어쓰지 않는다.
    """
    source = source.resolve()
    out_dir = out_dir.resolve()
    if source.is_relative_to(out_dir):
        return quote(source.relative_to(out_dir).as_posix())
    data = source.read_bytes() if data is None else data
    base = base.resolve()
    if source.is_relative_to(base):
        rel = source.relative_to(base)
    else:
        rel = free_slot(data, out_dir, Path(fallback))
    target = out_dir / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return quote(rel.as_posix())


def free_slot(data: bytes, out_dir: Path, rel: Path) -> Path:
    """rel 이 비었거나 같은 내용이면 그대로, 아니면 번호를 붙인 빈 자리를 돌려준다."""
    candidate, number = rel, 1
    while (out_dir / candidate).exists() and (out_dir / candidate).read_bytes() != data:
        number += 1
        candidate = rel.with_name(f"{rel.stem}-{number}{rel.suffix}")
    return candidate


def image_tag(
    target: Path, base: Path, out_dir: Path, copied: list[tuple[str, bool]] | None
) -> str:
    """사진을 결과물 폴더에 넣고 크기를 적은 `<img>` 를 만든다.

    HTML 옆에 이미 있는 사진은 그대로 부른다. 그 밖의 사진은 줄이고 촬영 정보를 뺀 사본을 넣는다.
    copied 에는 사본을 넣은 사진의 이름과 줄였는지를 더한다.
    """
    if target.resolve().is_relative_to(out_dir.resolve()):
        data = target.read_bytes()
        src = place_asset(target, base, out_dir, f"external/{target.name}")
    else:
        data, shrunk = preview_bytes(target)
        src = place_asset(target, base, out_dir, f"external/{target.name}", data)
        if copied is not None:
            copied.append((target.name, shrunk))
    size = display_size(data)
    dims = f' width="{size[0]}" height="{size[1]}"' if size else ""
    return f'<img src="{html.escape(src, quote=True)}" alt="" loading="lazy"{dims}>'


def render_block(
    block: dict, base: Path, out_dir: Path | None = None, copied: list[tuple[str, bool]] | None = None
) -> str:
    out_dir = base if out_dir is None else out_dir
    kind = block.get("type")

    if kind == "text":
        lines = block.get("lines") or []
        rows = "".join(f"<p>{html.escape(line)}</p>" for line in lines)
        return f'<div class="text">{rows}</div>'

    if kind == "image":
        path = block.get("path", "")
        cap = block.get("caption", "")
        target = (base / path) if path and not Path(path).is_absolute() else Path(path)
        if path and target.is_file() and target.suffix.lower() not in IMAGE_SUFFIXES:
            body = f'<div class="missing">미리보기에 넣을 수 없는 형식<br>{html.escape(path)}</div>'
        elif path and target.is_file():
            body = image_tag(target, base, out_dir, copied)
        else:
            body = f'<div class="missing">사진 없음<br>{html.escape(path or "경로 없음")}</div>'
        caption = f'<div class="cap">{html.escape(cap)}</div>' if cap else ""
        return f'<div class="photo">{body}{caption}</div>'

    if kind == "sticker":
        code = block.get("stickerCode", "")
        label = STICKER_LABELS.get(code, "스티커")
        image = base / "stickers" / f"{code}.png"
        if code in STICKER_LABELS and image.is_file():
            src = html.escape(place_asset(image, base, out_dir, f"stickers/{code}.png"), quote=True)
            return f'<div class="sticker"><img src="{src}" alt="{html.escape(label, quote=True)}"></div>'
        return f'<div class="sticker">{html.escape(label)}</div>'

    if kind == "map":
        name = html.escape(block.get("name", ""))
        address = html.escape(block.get("address", ""))
        url = block.get("mapUrl", "")
        if isinstance(url, str) and url.startswith("https://map.naver.com/"):
            href = html.escape(url, quote=True)
            return f'<div class="map"><a href="{href}" target="_blank" rel="noopener noreferrer">📍 {name} · {address}<br>네이버 지도에서 보기 ↗</a></div>'
        return f'<div class="map">📍 {name} · {address}</div>'

    return f'<div class="missing">모르는 블록: {html.escape(str(kind))}</div>'


def build(
    draft: dict, base: Path, out_dir: Path | None = None, copied: list[tuple[str, bool]] | None = None
) -> str:
    blocks = draft.get("blocks") or []
    body = "".join(render_block(b, base, out_dir, copied) for b in blocks)
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
<div class="meta">{category} · 글 미리보기</div>
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
    out.parent.mkdir(parents=True, exist_ok=True)
    copied: list[tuple[str, bool]] = []
    out.write_text(build(draft, draft_path.parent, out.parent, copied), encoding="utf-8")

    blocks = draft.get("blocks") or []
    missing = [
        b.get("path", "")
        for b in blocks
        if b.get("type") == "image" and not (draft_path.parent / b.get("path", "")).exists()
    ]
    unsupported = [
        b.get("path", "")
        for b in blocks
        if b.get("type") == "image"
        and (draft_path.parent / b.get("path", "")).is_file()
        and Path(b.get("path", "")).suffix.lower() not in IMAGE_SUFFIXES
    ]
    print(f"{out} 생성")
    shrunk = sum(1 for _name, done in copied if done)
    kept = [name for name, done in copied if not done]
    if shrunk:
        print(f"사진 {shrunk}장을 긴 변 {LONG_EDGE}px 로 줄이고 촬영 정보를 뺐다. 원본은 초안 폴더에 그대로 있다.")
    if kept:
        print(f"줄이지 못한 사진 {len(kept)}장은 원본 크기로 넣고 촬영 정보만 뺐다: {kept[:3]}")
    if unsupported:
        # 네이버 편집기는 원본 파일을 올리므로 미리보기에서만 빠진다. 실패로 두지 않는다.
        print(f"미리보기에 넣지 못한 형식 {len(unsupported)}장: {unsupported[:3]}")
    if missing:
        print(f"사진 {len(missing)}장을 찾지 못했다: {missing[:3]}")
        if not args.allow_missing_photos:
            return 1
        print("--allow-missing-photos 로 넘어간다. 네이버에 넣기 전에 사진을 채운다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
