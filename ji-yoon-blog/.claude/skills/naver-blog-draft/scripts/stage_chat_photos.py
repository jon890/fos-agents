"""대화에 첨부된 사진 중 지정한 파일만 한 장소의 초안 폴더로 복사한다.

번호는 `--file` 을 준 순서대로 붙인다. 지융이 보낸 순서가 곧 글의 순서이므로 촬영시각으로 다시 세우지 않는다.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import tempfile
from datetime import date
from pathlib import Path

from photo_set import shot_at_file

ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


def stage_photos(
    source_dir: Path,
    names: list[str],
    place: str,
    drafts_dir: Path,
    visit_date: str,
) -> dict:
    """명시한 첨부만 복사하고 names 의 순서대로 번호를 붙인다."""
    place = place.strip()
    if (
        not place
        or place in {".", ".."}
        or any(char in place for char in "/\\\0")
        or any(ord(char) < 32 for char in place)
    ):
        raise ValueError("장소 이름에 경로 구분자를 넣을 수 없다")
    if not names or len(names) != len(set(names)):
        raise ValueError("서로 다른 사진 이름을 하나 이상 지정한다")
    if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", visit_date):
        raise ValueError("방문 날짜는 YYYY-MM-DD 형식이어야 한다")
    try:
        date.fromisoformat(visit_date)
    except ValueError as exc:
        raise ValueError("방문 날짜는 YYYY-MM-DD 형식이어야 한다") from exc

    source_dir = source_dir.resolve(strict=True)
    if not source_dir.is_dir():
        raise ValueError("첨부 사진 디렉터리가 아니다")
    sources = []
    for name in names:
        if (
            Path(name).name != name
            or name.startswith(".")
            or any(char in name for char in "/\\\0")
        ):
            raise ValueError(f"사진 이름은 파일 이름만 지정한다: {name}")
        path = source_dir / name
        if path.is_symlink() or not path.is_file() or path.suffix.lower() not in ALLOWED_SUFFIXES:
            raise ValueError(f"읽을 수 있는 첨부 사진이 아니다: {name}")
        if path.stat().st_size == 0:
            raise ValueError(f"빈 사진이다: {name}")
        sources.append(path)

    drafts_dir.mkdir(parents=True, exist_ok=True)
    target = drafts_dir / f"{visit_date}-{place}"

    with tempfile.TemporaryDirectory(prefix=".chat-photos-", dir=drafts_dir) as temporary:
        staged_draft = Path(temporary) / "draft"
        photos_dir = staged_draft / "photos"
        photos_dir.mkdir(parents=True)
        photos = []
        for order, source in enumerate(sources, 1):
            name = f"{order:03d}-{source.name}"
            shutil.copyfile(source, photos_dir / name)
            photos.append(
                {"name": name, "source": source.name, "shotAt": shot_at_file(source)}
            )
        # mkdir 는 같은 장소를 동시에 처리해도 한 실행만 성공하게 한다.
        try:
            target.mkdir()
        except FileExistsError as exc:
            raise FileExistsError(f"초안 폴더가 이미 있다: {target}") from exc
        try:
            photos_dir.rename(target / "photos")
        except OSError:
            # 우리가 만든 빈 폴더일 때만 지운다. 다른 파일이 생겼으면 그대로 둔다.
            try:
                target.rmdir()
            except OSError:
                pass
            raise

    return {
        "place": place,
        "directory": str(target),
        "photos": [
            {
                "order": order,
                "path": f"photos/{photo['name']}",
                "source": photo["source"],
                "shotAt": photo["shotAt"],
            }
            for order, photo in enumerate(photos, 1)
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="대화 첨부 사진을 장소별 초안 폴더로 복사한다")
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument(
        "--file",
        action="append",
        required=True,
        dest="files",
        help="입력에 적힌 순번 순서대로 준다. 이 순서가 글의 사진 순서다",
    )
    parser.add_argument("--place", required=True)
    parser.add_argument("--date", default=date.today().isoformat())
    parser.add_argument("--drafts-dir", type=Path, default=Path("drafts"))
    args = parser.parse_args()
    try:
        result = stage_photos(
            args.source_dir, args.files, args.place, args.drafts_dir, args.date
        )
    except (OSError, ValueError) as exc:
        print(exc, file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
