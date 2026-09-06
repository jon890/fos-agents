"""내려받은 사진 묶음을 촬영시각 순서로 세우고 번호를 붙인다.

사진은 `photos.py pull` 이 내려놓은 로컬 디렉터리에 있다.
아이폰에서 올린 순서는 뒤섞일 수 있으므로 촬영시각으로 다시 세운다.
촬영시각을 읽지 못하면 파일 이름 순서를 쓴다.

S3 에 직접 붙지 않는다.
맥북에 credential 을 내려놓지 않으려고 입력을 로컬 디렉터리로 한정했다.

Pillow 없이 JPEG 의 EXIF 만 직접 읽는다.
이 워크스페이스의 다른 스크립트가 모두 의존성 없는 파이썬이라 맞춘다.

사용법:
    python3 photo_set.py ./drafts/2026-09-04-순돌이곱창
    python3 photo_set.py ./drafts/2026-09-04-순돌이곱창 --renumber
"""

from __future__ import annotations

import argparse
import json
import re
import struct
import sys
from pathlib import Path

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"}
EXIF_SUFFIXES = {".jpg", ".jpeg"}
DATETIME_ORIGINAL = 0x9003
DATETIME_DIGITIZED = 0x9004
EXIF_IFD_POINTER = 0x8769

ORDER_PREFIX = re.compile(r"^\d{3}-")


def _read_ifd(data: bytes, offset: int, big: bool, wanted: set[int], found: dict[int, str]) -> None:
    """EXIF 의 태그 표를 훑어 원하는 태그만 담는다."""
    order = ">" if big else "<"
    if offset + 2 > len(data):
        return
    (count,) = struct.unpack_from(f"{order}H", data, offset)
    for i in range(count):
        entry = offset + 2 + i * 12
        if entry + 12 > len(data):
            return
        tag, kind, length = struct.unpack_from(f"{order}HHI", data, entry)
        value_at = entry + 8
        if tag == EXIF_IFD_POINTER and kind == 4:
            (sub,) = struct.unpack_from(f"{order}I", data, value_at)
            _read_ifd(data, sub, big, wanted, found)
            continue
        if tag not in wanted or kind != 2:
            continue
        if length > 4:
            (value_at,) = struct.unpack_from(f"{order}I", data, value_at)
        raw = data[value_at : value_at + length]
        found[tag] = raw.split(b"\x00")[0].decode("ascii", errors="replace")


def shot_at(image: bytes) -> str:
    """JPEG 의 촬영시각을 돌려준다. 없으면 빈 문자열이다."""
    if not image.startswith(b"\xff\xd8"):
        return ""
    i = 2
    while i + 4 <= len(image):
        if image[i] != 0xFF:
            break
        marker, size = image[i + 1], struct.unpack_from(">H", image, i + 2)[0]
        if marker == 0xE1 and image[i + 4 : i + 10] == b"Exif\x00\x00":
            tiff = image[i + 10 : i + 2 + size]
            if len(tiff) < 8:
                return ""
            big = tiff[:2] == b"MM"
            order = ">" if big else "<"
            (first,) = struct.unpack_from(f"{order}I", tiff, 4)
            found: dict[int, str] = {}
            _read_ifd(tiff, first, big, {DATETIME_ORIGINAL, DATETIME_DIGITIZED}, found)
            value = found.get(DATETIME_ORIGINAL) or found.get(DATETIME_DIGITIZED) or ""
            # EXIF 는 2026:09:04 18:21:03 형태로 준다
            return value.replace(":", "-", 2) if value else ""
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        i += 2 + size
    return ""


def shot_at_file(path: Path) -> str:
    """파일에서 촬영시각을 읽는다. 읽지 못하면 빈 문자열이다."""
    if path.suffix.lower() not in EXIF_SUFFIXES:
        return ""
    try:
        with path.open("rb") as handle:
            # EXIF 는 파일 앞쪽에 있으므로 앞부분만 읽는다
            return shot_at(handle.read(256 * 1024))
    except OSError:
        return ""


def base_name(name: str) -> str:
    """이미 붙어 있는 번호 접두사를 떼어낸 이름을 돌려준다."""
    return ORDER_PREFIX.sub("", name, count=1)


def photo_set(directory: Path | str, need_shot_time: bool = True) -> list[dict]:
    """디렉터리의 사진을 촬영시각 순서로 세워 번호를 매긴 목록을 돌려준다."""
    root = Path(directory)
    photos = []
    for path in root.iterdir():
        if not path.is_file() or path.suffix.lower() not in IMAGE_SUFFIXES:
            continue
        photos.append(
            {
                "name": path.name,
                "baseName": base_name(path.name),
                "path": str(path),
                "size": path.stat().st_size,
                "shotAt": shot_at_file(path) if need_shot_time else "",
            }
        )

    # 촬영시각이 있으면 그것으로, 없으면 이름으로 세운다.
    photos.sort(key=lambda p: (p["shotAt"] or "9999", p["baseName"]))
    for i, p in enumerate(photos, 1):
        p["order"] = i
    return photos


def renumber(directory: Path | str, need_shot_time: bool = True) -> list[dict]:
    """사진 이름 앞에 순서 번호를 붙인다. 이미 붙은 번호는 새 번호로 바꾼다."""
    root = Path(directory)
    photos = photo_set(root, need_shot_time=need_shot_time)

    # 목표 이름이 다른 사진의 현재 이름과 겹칠 수 있으므로 임시 이름을 거친다.
    staged = []
    for p in photos:
        current = root / p["name"]
        temporary = root / f".renumber-{p['order']:03d}-{p['baseName']}"
        current.rename(temporary)
        staged.append((temporary, p))

    for temporary, p in staged:
        target = root / f"{p['order']:03d}-{p['baseName']}"
        temporary.rename(target)
        p["name"] = target.name
        p["path"] = str(target)
    return photos


def main() -> int:
    parser = argparse.ArgumentParser(description="사진 묶음을 촬영시각 순서로 세운다")
    parser.add_argument("directory", help="사진이 들어 있는 디렉터리")
    parser.add_argument("--renumber", action="store_true", help="순서 번호를 파일 이름에 붙인다")
    parser.add_argument("--no-exif", action="store_true", help="촬영시각을 읽지 않는다")
    args = parser.parse_args()

    root = Path(args.directory)
    if not root.is_dir():
        print(f"디렉터리가 없다: {root}", file=sys.stderr)
        return 2

    need_shot_time = not args.no_exif
    photos = renumber(root, need_shot_time) if args.renumber else photo_set(root, need_shot_time)
    if not photos:
        print(f"{root} 아래에 사진이 없다", file=sys.stderr)
        return 1

    print(json.dumps(photos, ensure_ascii=False, indent=2))
    print(f"사진 {len(photos)}장", file=sys.stderr)

    if need_shot_time:
        missing = [p["name"] for p in photos if not p["shotAt"]]
        if missing:
            print(
                f"촬영시각을 읽지 못한 사진이 {len(missing)}장이다. 이름 순서로 세웠다.",
                file=sys.stderr,
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
