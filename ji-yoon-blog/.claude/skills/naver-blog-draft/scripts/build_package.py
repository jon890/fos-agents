"""초안으로 사람이 직접 붙여넣을 수 있는 등록용 묶음을 만든다.

브라우저 자동화가 막혀도 글은 나가야 한다.
네이버 세션이 없거나 편집기 조작이 실패하면 이 묶음을 지융에게 준다.

붙여넣는 순서를 그대로 적고, 사진은 어느 문단 뒤에 오는지를 파일 이름과 함께 적는다.
본문은 `lines` 를 줄 그대로 낸다.
줄을 합치면 지융의 문단 나눔이 무너지므로 여기서 손대지 않는다.

`--out` 이 `.html` 이면 지융이 열어 볼 수 있는 HTML 로 만든다.
fos-assistant 의 `[결과물 폴더]` 아래에 두면 답 아래에 붙는다.
초안 폴더의 `package.md` 는 지융이 열 수 없으므로 그 경로를 답에 쓰지 않는다.
HTML 은 사진 파일 이름 대신 줄인 사진을 그 자리에 보여 준다.

사용법:
    python3 build_package.py draft.json --out package.md
    python3 build_package.py draft.json --out <결과물 폴더>/<장소>-수동등록/index.html
"""

from __future__ import annotations

import argparse
import html
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_preview import IMAGE_SUFFIXES, STICKER_LABELS, STYLE, image_tag  # noqa: E402
from draft_contract import validate  # noqa: E402

PACKAGE_STYLE = """
.step { margin:0 0 18px; padding:10px 12px; border:1px dashed var(--line); border-radius:8px;
        font-size:13px; color:var(--muted); }
.step img { margin-top:8px; }
.meta-list { margin:0; padding:16px 20px 20px 36px; font-size:14px; line-height:1.8; }
h2 { font-size:15px; margin:0; padding:18px 20px 0; }
.tags p { margin:0; font-size:14px; }
"""


def build(draft: dict) -> str:
    blocks = draft.get("blocks") or []
    out: list[str] = []

    out.append("# 네이버에 붙여넣을 것")
    out.append("")
    out.append("아래 순서대로 편집기에 넣는다. 다 넣은 뒤 임시저장한다. 발행하지 않는다.")
    out.append("")

    candidates = draft.get("titleCandidates") or [draft.get("title", "")]
    out.append("## 제목")
    out.append("")
    for i, candidate in enumerate(candidates, 1):
        mark = " (고른 것)" if candidate == draft.get("title") else ""
        out.append(f"{i}. {candidate}{mark}")
    out.append("")

    out.append("## 본문")
    out.append("")
    step = 0
    for block in blocks:
        kind = block.get("type")
        if kind == "text":
            for line in block.get("lines") or []:
                out.append(line)
            out.append("")
        elif kind == "image":
            step += 1
            out.append(f"<< 사진 {step}: {block.get('path', '')} >>")
            out.append("")
        elif kind == "sticker":
            out.append(f"<< 스티커: {block.get('stickerCode', '')} >>")
            out.append("")
        elif kind == "map":
            out.append(f"<< 장소 지도: {block.get('name', '')} · {block.get('address', '')} >>")
            out.append("")

    out.append("## 태그")
    out.append("")
    out.append(" ".join(f"#{tag}" for tag in draft.get("tags") or []))
    out.append("")

    photos = sum(1 for b in blocks if b.get("type") == "image")
    letters = sum(
        len(line) for b in blocks if b.get("type") == "text" for line in (b.get("lines") or [])
    )
    out.append("## 확인")
    out.append("")
    out.append(f"- 카테고리: {draft.get('category', '')}")
    out.append(f"- 협찬 여부: {'협찬' if draft.get('sponsored') else '비협찬'}")
    out.append(f"- 사진 {photos}장, 본문 {letters}자, 태그 {len(draft.get('tags') or [])}개")
    out.append("- 임시저장까지만 한다. 발행은 지융이 따로 누른다.")
    out.append("")

    return "\n".join(out)


def build_html(draft: dict, base: Path, out_dir: Path) -> str:
    """붙여넣을 순서를 HTML 로 만든다. 사진은 줄인 사본을 그 자리에 보여 준다."""
    blocks = draft.get("blocks") or []
    parts: list[str] = []
    step = 0
    for block in blocks:
        kind = block.get("type")
        if kind == "text":
            rows = "".join(f"<p>{html.escape(line)}</p>" for line in block.get("lines") or [])
            parts.append(f'<div class="text">{rows}</div>')
        elif kind == "image":
            step += 1
            path = block.get("path", "")
            target = base / path
            shown = ""
            if path and target.is_file() and target.suffix.lower() in IMAGE_SUFFIXES:
                shown = image_tag(target, base, out_dir, None)
            parts.append(f'<div class="step">사진 {step} 넣기{shown}</div>')
        elif kind == "sticker":
            label = STICKER_LABELS.get(block.get("stickerCode", ""), "스티커")
            parts.append(f'<div class="step">{html.escape(label)} 넣기</div>')
        elif kind == "map":
            place = f"{block.get('name', '')} · {block.get('address', '')}"
            parts.append(f'<div class="step">장소 지도 넣기: {html.escape(place)}</div>')

    candidates = draft.get("titleCandidates") or [draft.get("title", "")]
    titles = "".join(
        f"<li>{html.escape(c)}{' (고른 것)' if c == draft.get('title') else ''}</li>"
        for c in candidates
    )
    tags = " ".join(f"#{tag}" for tag in draft.get("tags") or [])
    sponsored = "협찬" if draft.get("sponsored") else "비협찬"
    title = html.escape(draft.get("title", "제목 없음"))
    return f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} 붙여넣기</title><style>{STYLE}{PACKAGE_STYLE}</style></head>
<body><div class="wrap">
<div class="meta">네이버에 직접 붙여넣을 순서 · 임시저장까지만 하고 발행하지 않는다</div>
<div class="post">
<h2>제목</h2><ol class="meta-list">{titles}</ol>
<h2>본문</h2><div class="body">{"".join(parts)}</div>
<h2>태그</h2><div class="tags"><p>{html.escape(tags)}</p></div>
<h2>확인</h2><ul class="meta-list">
<li>카테고리: {html.escape(draft.get("category", ""))}</li><li>협찬 여부: {sponsored}</li>
</ul>
</div></div></body></html>
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("draft")
    parser.add_argument("--out", default="package.md")
    args = parser.parse_args()

    draft_path = Path(args.draft)
    draft = json.loads(draft_path.read_text(encoding="utf-8"))

    problems = validate(draft)
    if problems:
        print(f"{draft_path} 가 초안 계약을 지키지 않는다:")
        for problem in problems:
            print(f"  - {problem}")
        return 2

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.suffix.lower() == ".html":
        out.write_text(build_html(draft, draft_path.parent, out.parent), encoding="utf-8")
        print(f"수동 등록용 묶음을 만들었다: {out.parent.name}/{out.name}")
        print("이 경로는 답에 옮기지 않는다. 결과물 폴더에 만들었으면 답 아래에 자동으로 붙는다.")
        return 0
    out.write_text(build(draft), encoding="utf-8")
    print(f"수동 등록용 묶음을 만들었다: {out.name}")
    print("지융은 이 파일을 열 수 없다. 경로를 답에 옮기지 말고, 결과물 폴더가 있으면 HTML 로 만들고 없으면 본문을 답에 보여 준다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
