"""초안으로 사람이 직접 붙여넣을 수 있는 등록용 묶음을 만든다.

브라우저 자동화가 막혀도 글은 나가야 한다.
네이버 세션이 없거나 편집기 조작이 실패하면 이 묶음을 지융에게 준다.

붙여넣는 순서를 그대로 적고, 사진은 어느 문단 뒤에 오는지를 파일 이름과 함께 적는다.
본문은 `lines` 를 줄 그대로 낸다.
줄을 합치면 지융의 문단 나눔이 무너지므로 여기서 손대지 않는다.

사용법:
    python3 build_package.py draft.json --out package.md
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_preview import validate  # noqa: E402


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
            out.append(f"<< 스티커: {block.get('emoji', '')} >>")
            out.append("")
        elif kind == "map":
            out.append(f"<< 장소 지도: {block.get('address', '')} >>")
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
    out.append(f"- 사진 {photos}장, 본문 {letters}자, 태그 {len(draft.get('tags') or [])}개")
    out.append("- 임시저장까지만 한다. 발행은 지융이 따로 누른다.")
    out.append("")

    return "\n".join(out)


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
    out.write_text(build(draft), encoding="utf-8")
    print(f"{out} 생성")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
