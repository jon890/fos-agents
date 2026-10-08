"""촬영시각 파서와 순서 매기기를 합성한 JPEG 로 검증한다.

임시 디렉터리에 JPEG 를 만들어 두고 확인한다.
S3 를 흉내내지 않으므로 가짜 객체 저장소가 없다.

실행:
    python3 test_photo_set.py
"""

import struct
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from photo_set import photo_set, renumber, shot_at


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


def make_dir(root: Path, files: dict[str, bytes]) -> Path:
    """임시 디렉터리 아래에 파일을 만들고 그 경로를 돌려준다."""
    root.mkdir(parents=True, exist_ok=True)
    for name, blob in files.items():
        (root / name).write_bytes(blob)
    return root


def main() -> int:
    failures = []

    def check(label: str, got, want):
        if got != want:
            failures.append(f"{label}: {got!r} != {want!r}")

    check("작은 끝 EXIF", shot_at(build_jpeg("2026:09:04 18:21:03")), "2026-09-04 18:21:03")
    check(
        "큰 끝 EXIF",
        shot_at(build_jpeg("2024:01:02 03:04:05", big_endian=True)),
        "2024-01-02 03:04:05",
    )
    check("EXIF 없음", shot_at(build_jpeg(None)), "")
    check("JPEG 아님", shot_at(b"\x89PNG\r\n\x1a\n"), "")

    with tempfile.TemporaryDirectory() as temp:
        base = Path(temp)

        # 촬영시각이 뒤섞여 올라와도 순서를 다시 세운다
        mixed = make_dir(
            base / "mixed",
            {
                "IMG_0009.jpg": build_jpeg("2026:09:04 10:00:00"),
                "IMG_0002.jpg": build_jpeg("2026:09:04 09:00:00"),
                "note.txt": "사진이 아니다".encode("utf-8"),
            },
        )
        photos = photo_set(mixed)
        check("사진만 남는다", [p["baseName"] for p in photos], ["IMG_0002.jpg", "IMG_0009.jpg"])
        check("순서 번호", [p["order"] for p in photos], [1, 2])

        renumbered = renumber(mixed)
        check(
            "촬영시각 순서로 번호가 붙는다",
            [p["name"] for p in renumbered],
            ["001-IMG_0002.jpg", "002-IMG_0009.jpg"],
        )
        check(
            "디렉터리 이름이 바뀌었다",
            sorted(p.name for p in mixed.iterdir()),
            ["001-IMG_0002.jpg", "002-IMG_0009.jpg", "note.txt"],
        )

        # 같은 폴더를 다시 받아도 번호가 겹쳐 붙지 않는다
        again = renumber(mixed)
        check(
            "번호를 다시 붙여도 접두사가 겹치지 않는다",
            [p["name"] for p in again],
            ["001-IMG_0002.jpg", "002-IMG_0009.jpg"],
        )

        # 촬영시각이 없으면 이름 순서로 세운다
        plain = make_dir(
            base / "plain",
            {"b.jpg": build_jpeg(None), "a.jpg": build_jpeg(None)},
        )
        photos = photo_set(plain)
        check("이름 순서로 되돌아감", [p["baseName"] for p in photos], ["a.jpg", "b.jpg"])
        check("촬영시각이 비어 있다", [p["shotAt"] for p in photos], ["", ""])
        check(
            "이름 순서로 번호가 붙는다",
            [p["name"] for p in renumber(plain)],
            ["001-a.jpg", "002-b.jpg"],
        )

        # 이미지가 아닌 파일은 번호를 받지 않는다
        only_text = make_dir(base / "text", {"note.txt": b"hello", "draft.json": b"{}"})
        check("이미지가 없으면 빈 목록", photo_set(only_text), [])
        renumber(only_text)
        check(
            "이미지가 아닌 파일은 그대로다",
            sorted(p.name for p in only_text.iterdir()),
            ["draft.json", "note.txt"],
        )

    if failures:
        for f in failures:
            print("실패:", f)
        return 1
    print("모두 통과")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
