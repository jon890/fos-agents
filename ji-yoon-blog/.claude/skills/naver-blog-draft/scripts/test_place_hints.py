"""장소 실마리 수집을 합성한 JPEG 로 검증한다.

GPS 가 든 JPEG 와 들지 않은 JPEG 를 직접 만들어 확인한다.
아이폰도 홈서버도 부르지 않는다.

실행:
    python3 test_place_hints.py
"""

import struct
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from place_hints import collect, gps_of, name_hint  # noqa: E402


def build_jpeg(latitude: tuple[int, int, int] | None, reference: bytes = b"N") -> bytes:
    """GPS IFD 하나만 담은 최소 JPEG 를 만든다. 경도는 위도와 같은 값을 쓴다."""
    if latitude is None:
        return b"\xff\xd8" + b"\xff\xd9"

    order = "<"
    ifd0_at = 8
    # IFD0 은 항목 하나(GPS 포인터)
    gps_ifd_at = ifd0_at + 2 + 12 + 4
    # GPS IFD 는 항목 넷이고, 그 뒤에 RATIONAL 값 둘이 이어 붙는다
    values_at = gps_ifd_at + 2 + 12 * 4 + 4

    tiff = bytearray()
    tiff += b"II\x2a\x00"
    tiff += struct.pack(f"{order}I", ifd0_at)
    tiff += struct.pack(f"{order}H", 1)
    tiff += struct.pack(f"{order}HHII", 0x8825, 4, 1, gps_ifd_at)
    tiff += struct.pack(f"{order}I", 0)

    reference_value = reference + b"\x00"
    tiff += struct.pack(f"{order}H", 4)
    tiff += struct.pack(f"{order}HHI", 0x0001, 2, 2) + reference_value + b"\x00\x00"
    tiff += struct.pack(f"{order}HHII", 0x0002, 5, 3, values_at)
    tiff += struct.pack(f"{order}HHI", 0x0003, 2, 2) + b"E\x00" + b"\x00\x00"
    tiff += struct.pack(f"{order}HHII", 0x0004, 5, 3, values_at)
    tiff += struct.pack(f"{order}I", 0)
    assert len(tiff) == values_at, (len(tiff), values_at)

    for part in latitude:
        tiff += struct.pack(f"{order}II", part, 1)

    app1 = b"Exif\x00\x00" + bytes(tiff)
    return b"\xff\xd8" + b"\xff\xe1" + struct.pack(">H", len(app1) + 2) + app1 + b"\xff\xd9"


def main() -> int:
    failures = []

    def check(label: str, got, want):
        if got != want:
            failures.append(f"{label}: {got!r} != {want!r}")

    check(
        "북반구 GPS 를 읽는다",
        gps_of(build_jpeg((35, 58, 48))),
        {"latitude": 35.98, "longitude": 35.98},
    )
    check(
        "남반구는 음수가 된다",
        gps_of(build_jpeg((35, 58, 48), reference=b"S")),
        {"latitude": -35.98, "longitude": 35.98},
    )
    check("GPS 가 없으면 None", gps_of(build_jpeg(None)), None)
    check("JPEG 가 아니면 None", gps_of(b"\x89PNG\r\n\x1a\n"), None)

    check("기기가 붙인 이름은 단서가 아니다", name_hint("001-IMG_9331.jpg"), "")
    check("촬영 앱 이름도 단서가 아니다", name_hint("PXL_20240101_120000.jpg"), "")
    check("사람이 붙인 이름은 단서다", name_hint("002-순돌이곱창-간판.jpg"), "순돌이곱창-간판")

    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        (root / "001-IMG_9331.jpg").write_bytes(build_jpeg(None))
        (root / "002-순돌이곱창.jpg").write_bytes(build_jpeg((35, 58, 48)))
        (root / "note.txt").write_text("사진이 아니다", encoding="utf-8")

        hints = collect(root)
        check("사진만 센다", [h["name"] for h in hints], ["001-IMG_9331.jpg", "002-순돌이곱창.jpg"])
        check("실마리 없는 사진", (hints[0]["gps"], hints[0]["nameHint"]), (None, ""))
        check("실마리 있는 사진의 이름", hints[1]["nameHint"], "순돌이곱창")
        check("실마리 있는 사진의 위치", hints[1]["gps"]["latitude"], 35.98)

    if failures:
        for f in failures:
            print("실패:", f)
        return 1
    print("모두 통과")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
