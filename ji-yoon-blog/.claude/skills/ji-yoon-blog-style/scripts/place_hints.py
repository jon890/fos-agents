"""내려받은 사진에서 장소를 짐작할 실마리를 모은다.

사진만 있고 지융이 장소를 말하지 않았을 때 쓴다.
여기서 나온 것은 제안의 근거일 뿐이고 사실이 아니다.
본문에 넣기 전에 반드시 지융에게 확인받는다.

두 가지를 본다.

| 실마리 | 어디서 | 한계 |
| --- | --- | --- |
| 촬영 위치 | JPEG EXIF 의 GPS IFD | 아이폰이 지우고 올리면 남지 않는다 |
| 파일 이름 | 원본 이름 | `IMG_9331` 처럼 기기가 붙인 이름은 단서가 아니다 |

간판과 메뉴판 글자는 이 스크립트가 읽지 못한다.
사진을 직접 보는 것은 사람이나 에이전트의 몫이다.

Pillow 없이 JPEG 의 EXIF 만 직접 읽는다.
이 워크스페이스의 다른 스크립트가 모두 의존성 없는 파이썬이라 맞춘다.

사용법:
    python3 place_hints.py ./drafts/2026-09-04-순돌이곱창/photos
    python3 place_hints.py ./drafts/2026-09-04-순돌이곱창/photos --json

종료 코드:
    0  실마리를 하나 이상 찾았다. 제안하고 확인받는다
    1  실마리가 없다. 짐작하지 말고 어디인지 묻는다
    2  디렉터리가 없거나 사진이 없다
"""

from __future__ import annotations

import argparse
import json
import re
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from photo_set import IMAGE_SUFFIXES, base_name, shot_at_file  # noqa: E402

GPS_IFD_POINTER = 0x8825
GPS_LATITUDE_REF = 0x0001
GPS_LATITUDE = 0x0002
GPS_LONGITUDE_REF = 0x0003
GPS_LONGITUDE = 0x0004

TYPE_SIZE = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8}

# 기기가 자동으로 붙인 이름이다. 장소와 무관하므로 단서로 세지 않는다.
CAMERA_NAMES = [
    re.compile(r"^img[_-]?\d+$", re.IGNORECASE),
    re.compile(r"^dsc[_-]?\d+$", re.IGNORECASE),
    re.compile(r"^dscf\d+$", re.IGNORECASE),
    re.compile(r"^pxl[_-]\d+", re.IGNORECASE),
    re.compile(r"^\d{8}[_-]\d{6}$"),
    re.compile(r"^photo[_-]?\d*$", re.IGNORECASE),
    re.compile(r"^image[_-]?\d*$", re.IGNORECASE),
    re.compile(r"^kakaotalk[_-]", re.IGNORECASE),
    re.compile(r"^screenshot", re.IGNORECASE),
    re.compile(r"^\d+$"),
]


def _exif_block(image: bytes) -> bytes:
    """JPEG 에서 EXIF 의 TIFF 부분만 떼어낸다. 없으면 빈 바이트열이다."""
    if not image.startswith(b"\xff\xd8"):
        return b""
    i = 2
    while i + 4 <= len(image):
        if image[i] != 0xFF:
            return b""
        marker = image[i + 1]
        (size,) = struct.unpack_from(">H", image, i + 2)
        if marker == 0xE1 and image[i + 4 : i + 10] == b"Exif\x00\x00":
            return image[i + 10 : i + 2 + size]
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        i += 2 + size
    return b""


def _entries(tiff: bytes, offset: int, order: str) -> dict[int, tuple[int, int, int]]:
    """IFD 한 장을 읽어 태그마다 (자료형, 개수, 값 위치) 를 돌려준다."""
    found: dict[int, tuple[int, int, int]] = {}
    if offset <= 0 or offset + 2 > len(tiff):
        return found
    (count,) = struct.unpack_from(f"{order}H", tiff, offset)
    for i in range(count):
        entry = offset + 2 + i * 12
        if entry + 12 > len(tiff):
            break
        tag, kind, length = struct.unpack_from(f"{order}HHI", tiff, entry)
        value_at = entry + 8
        if length * TYPE_SIZE.get(kind, 0) > 4:
            (value_at,) = struct.unpack_from(f"{order}I", tiff, value_at)
        found[tag] = (kind, length, value_at)
    return found


def _rationals(tiff: bytes, order: str, spot: tuple[int, int, int]) -> list[float]:
    """RATIONAL 값을 실수 목록으로 돌려준다."""
    kind, length, value_at = spot
    if kind != 5:
        return []
    values = []
    for i in range(length):
        at = value_at + i * 8
        if at + 8 > len(tiff):
            return []
        top, bottom = struct.unpack_from(f"{order}II", tiff, at)
        values.append(top / bottom if bottom else 0.0)
    return values


def _ascii(tiff: bytes, spot: tuple[int, int, int]) -> str:
    """ASCII 값을 문자열로 돌려준다."""
    kind, length, value_at = spot
    if kind != 2:
        return ""
    raw = tiff[value_at : value_at + length]
    return raw.split(b"\x00")[0].decode("ascii", errors="replace")


def gps_of(image: bytes) -> dict[str, float] | None:
    """JPEG 의 촬영 위치를 돌려준다. 없으면 None 이다."""
    tiff = _exif_block(image)
    if len(tiff) < 8:
        return None
    order = ">" if tiff[:2] == b"MM" else "<"
    (first,) = struct.unpack_from(f"{order}I", tiff, 4)
    ifd0 = _entries(tiff, first, order)
    pointer = ifd0.get(GPS_IFD_POINTER)
    if not pointer or pointer[0] != 4:
        return None
    (gps_at,) = struct.unpack_from(f"{order}I", tiff, pointer[2])
    gps = _entries(tiff, gps_at, order)

    def degrees(value_tag: int, ref_tag: int, negative: str) -> float | None:
        spot = gps.get(value_tag)
        if not spot:
            return None
        parts = _rationals(tiff, order, spot)
        if len(parts) != 3:
            return None
        value = parts[0] + parts[1] / 60 + parts[2] / 3600
        ref = _ascii(tiff, gps[ref_tag]) if ref_tag in gps else ""
        return -value if ref.upper() == negative else value

    latitude = degrees(GPS_LATITUDE, GPS_LATITUDE_REF, "S")
    longitude = degrees(GPS_LONGITUDE, GPS_LONGITUDE_REF, "W")
    if latitude is None or longitude is None:
        return None
    return {"latitude": round(latitude, 6), "longitude": round(longitude, 6)}


def gps_of_file(path: Path) -> dict[str, float] | None:
    """파일에서 촬영 위치를 읽는다. 읽지 못하면 None 이다."""
    if path.suffix.lower() not in {".jpg", ".jpeg"}:
        return None
    try:
        with path.open("rb") as handle:
            # EXIF 는 파일 앞쪽에 있으므로 앞부분만 읽는다
            return gps_of(handle.read(256 * 1024))
    except OSError:
        return None


def name_hint(name: str) -> str:
    """파일 이름에서 장소 단서를 돌려준다. 기기가 붙인 이름이면 빈 문자열이다."""
    stem = Path(base_name(name)).stem.strip()
    if not stem or any(pattern.match(stem) for pattern in CAMERA_NAMES):
        return ""
    return stem


def collect(directory: Path | str) -> list[dict]:
    """디렉터리의 사진마다 실마리를 모은다."""
    root = Path(directory)
    hints = []
    for path in sorted(root.iterdir(), key=lambda p: p.name):
        if not path.is_file() or path.suffix.lower() not in IMAGE_SUFFIXES:
            continue
        hints.append(
            {
                "name": path.name,
                "gps": gps_of_file(path),
                "nameHint": name_hint(path.name),
                "shotAt": shot_at_file(path),
            }
        )
    return hints


def report(hints: list[dict]) -> list[str]:
    """사람이 읽을 줄 목록을 만든다."""
    lines = [f"사진 {len(hints)}장을 봤다."]

    located = [h for h in hints if h["gps"]]
    if located:
        lines.append("")
        lines.append("촬영 위치가 남아 있는 사진")
        for h in located:
            gps = h["gps"]
            lines.append(f"  {h['name']}  {gps['latitude']}, {gps['longitude']}")
    else:
        lines.append("촬영 위치가 남아 있는 사진이 없다.")

    named = [h for h in hints if h["nameHint"]]
    if named:
        lines.append("")
        lines.append("파일 이름에 남은 단서")
        for h in named:
            lines.append(f"  {h['name']}  {h['nameHint']}")
    else:
        lines.append("파일 이름은 기기가 붙인 것뿐이라 단서가 없다.")

    shot = [h["shotAt"] for h in hints if h["shotAt"]]
    if shot:
        lines.append("")
        lines.append(f"촬영시각은 {min(shot)} 부터 {max(shot)} 까지다.")

    lines.append("")
    if located or named:
        lines.append("여기 나온 것은 짐작의 근거일 뿐이다.")
        lines.append("간판과 메뉴판 글자를 사진에서 직접 확인하고, 장소를 지융에게 물어 확인받는다.")
    else:
        lines.append("장소를 짐작할 실마리가 없다.")
        lines.append("억지로 추측하지 말고 어디에 다녀왔는지 지융에게 묻는다.")
    return lines


def main() -> int:
    parser = argparse.ArgumentParser(description="사진에서 장소 실마리를 모은다")
    parser.add_argument("directory", help="내려받은 사진이 들어 있는 디렉터리")
    parser.add_argument("--json", action="store_true", help="사람이 읽는 글 대신 JSON 을 낸다")
    args = parser.parse_args()

    root = Path(args.directory)
    if not root.is_dir():
        print(f"디렉터리가 없다: {root}", file=sys.stderr)
        return 2

    hints = collect(root)
    if not hints:
        print(f"{root} 아래에 사진이 없다", file=sys.stderr)
        return 2

    if args.json:
        print(json.dumps(hints, ensure_ascii=False, indent=2))
    else:
        print("\n".join(report(hints)))

    return 0 if any(h["gps"] or h["nameHint"] for h in hints) else 1


if __name__ == "__main__":
    raise SystemExit(main())
