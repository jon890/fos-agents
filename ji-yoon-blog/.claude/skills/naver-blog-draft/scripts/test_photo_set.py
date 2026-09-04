"""EXIF 촬영시각 파서를 합성한 JPEG 로 검증한다.

실행:
    python3 test_photo_set.py
"""

import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from photo_set import photo_set, shot_at


def build_jpeg(datetime_original: str | None, big_endian: bool = False) -> bytes:
    """EXIF 의 DateTimeOriginal 만 담은 최소 JPEG 를 만든다."""
    order = ">" if big_endian else "<"
    if datetime_original is None:
        return b"\xff\xd8" + b"\xff\xd9"

    value = datetime_original.encode("ascii") + b"\x00"
    # TIFF 헤더 8바이트, IFD0 은 항목 하나(EXIF 포인터), EXIF IFD 는 항목 하나
    ifd0_at = 8
    exif_ifd_at = ifd0_at + 2 + 12 + 4
    value_at = exif_ifd_at + 2 + 12 + 4

    tiff = bytearray()
    tiff += (b"MM\x00\x2a" if big_endian else b"II\x2a\x00")
    tiff += struct.pack(f"{order}I", ifd0_at)
    tiff += struct.pack(f"{order}H", 1)
    tiff += struct.pack(f"{order}HHI I".replace(" ", ""), 0x8769, 4, 1, exif_ifd_at)
    tiff += struct.pack(f"{order}I", 0)
    tiff += struct.pack(f"{order}H", 1)
    tiff += struct.pack(f"{order}HHII", 0x9003, 2, len(value), value_at)
    tiff += struct.pack(f"{order}I", 0)
    assert len(tiff) == value_at, (len(tiff), value_at)
    tiff += value

    app1 = b"Exif\x00\x00" + bytes(tiff)
    return b"\xff\xd8" + b"\xff\xe1" + struct.pack(">H", len(app1) + 2) + app1 + b"\xff\xd9"


class FakeS3:
    def __init__(self, blobs: dict[str, bytes]):
        self.blobs = blobs

    def list(self, prefix: str, delimiter: str = ""):
        return [
            {"key": k, "size": len(v), "modified": ""}
            for k, v in self.blobs.items()
            if k.startswith(prefix)
        ], []

    def get(self, key: str) -> bytes:
        return self.blobs[key]


def main() -> int:
    failures = []

    def check(label: str, got, want):
        if got != want:
            failures.append(f"{label}: {got!r} != {want!r}")

    check("작은 끝 EXIF", shot_at(build_jpeg("2026:09:04 18:21:03")), "2026-09-04 18:21:03")
    check("큰 끝 EXIF", shot_at(build_jpeg("2024:01:02 03:04:05", big_endian=True)), "2024-01-02 03:04:05")
    check("EXIF 없음", shot_at(build_jpeg(None)), "")
    check("JPEG 아님", shot_at(b"\x89PNG\r\n\x1a\n"), "")

    # 촬영시각이 뒤섞여 올라와도 순서를 다시 세운다
    blobs = {
        "photos/set/IMG_0009.jpg": build_jpeg("2026:09:04 10:00:00"),
        "photos/set/IMG_0002.jpg": build_jpeg("2026:09:04 09:00:00"),
        "photos/set/note.txt": "사진이 아니다".encode("utf-8"),
    }
    photos = photo_set(FakeS3(blobs), "photos/set/")
    check("사진만 남는다", [p["name"] for p in photos], ["IMG_0002.jpg", "IMG_0009.jpg"])
    check("순서 번호", [p["order"] for p in photos], [1, 2])

    # 촬영시각이 없으면 이름 순서로 세운다
    blobs = {
        "photos/plain/b.jpg": build_jpeg(None),
        "photos/plain/a.jpg": build_jpeg(None),
    }
    photos = photo_set(FakeS3(blobs), "photos/plain/")
    check("이름 순서로 되돌아감", [p["name"] for p in photos], ["a.jpg", "b.jpg"])

    if failures:
        for f in failures:
            print("실패:", f)
        return 1
    print("모두 통과")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
