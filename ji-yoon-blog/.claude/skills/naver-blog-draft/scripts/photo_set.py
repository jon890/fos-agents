"""한 글에 쓸 사진 묶음을 읽어 순서를 잡는다.

사진은 홈서버의 `photos/<날짜>-<장소>/` 아래에 있다.
올린 순서는 뒤섞일 수 있으므로 촬영시각으로 다시 세운다.
촬영시각이 없으면 파일 이름 순서를 쓴다.

Pillow 없이 JPEG 의 EXIF 만 직접 읽는다.
이 워크스페이스의 다른 스크립트가 모두 의존성 없는 파이썬이라 맞춘다.

사용법:
    python3 photo_set.py                                # 폴더 목록
    python3 photo_set.py photos/2026-09-04-순돌이곱창/    # 그 묶음의 사진 순서
    python3 photo_set.py photos/2026-09-04-순돌이곱창/ --download ./tmp
"""

from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from seaweed_s3 import S3ConfigError, SeaweedS3, load_env  # noqa: E402

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"}
DATETIME_ORIGINAL = 0x9003
DATETIME_DIGITIZED = 0x9004
EXIF_IFD_POINTER = 0x8769


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


def photo_set(s3: SeaweedS3, prefix: str, need_shot_time: bool = True) -> list[dict]:
    objects, _ = s3.list(prefix)
    photos = [o for o in objects if Path(o["key"]).suffix.lower() in IMAGE_SUFFIXES]

    for p in photos:
        p["name"] = Path(p["key"]).name
        p["shotAt"] = ""
        if need_shot_time and Path(p["key"]).suffix.lower() in (".jpg", ".jpeg"):
            try:
                p["shotAt"] = shot_at(s3.get(p["key"]))
            except Exception:
                p["shotAt"] = ""

    # 촬영시각이 있으면 그것으로, 없으면 이름으로 세운다.
    photos.sort(key=lambda p: (p["shotAt"] or "9999", p["name"]))
    for i, p in enumerate(photos, 1):
        p["order"] = i
    return photos


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("prefix", nargs="?", default="")
    parser.add_argument("--download", help="사진을 이 디렉터리에 내려받는다")
    parser.add_argument("--no-exif", action="store_true", help="촬영시각을 읽지 않는다")
    args = parser.parse_args()

    try:
        s3 = SeaweedS3()
    except S3ConfigError as exc:
        print(exc, file=sys.stderr)
        return 2

    if not args.prefix:
        base = load_env().get("JI_YOON_BLOG_PHOTO_PREFIX", "photos/")
        _, folders = s3.list(base, delimiter="/")
        if not folders:
            print(f"{base} 아래에 사진 묶음이 없다", file=sys.stderr)
            return 1
        for f in sorted(folders):
            objects, _ = s3.list(f)
            print(f"{f}  사진 {len(objects)}장")
        return 0

    photos = photo_set(s3, args.prefix, need_shot_time=not args.no_exif)
    if not photos:
        print(f"{args.prefix} 아래에 사진이 없다", file=sys.stderr)
        return 1

    if args.download:
        out = Path(args.download)
        out.mkdir(parents=True, exist_ok=True)
        for p in photos:
            target = out / f"{p['order']:03d}-{p['name']}"
            target.write_bytes(s3.get(p["key"]))
            p["localPath"] = str(target)

    print(json.dumps(photos, ensure_ascii=False, indent=2))
    print(f"사진 {len(photos)}장", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
