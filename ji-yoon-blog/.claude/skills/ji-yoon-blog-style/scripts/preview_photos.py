"""미리보기 결과물 폴더에 넣을 사진을 줄이고 촬영 정보를 뺀다.

아이폰 원본 12장은 약 28MB 다. 폰 화면이 그 사진을 받아 그리는 동안 미리보기가 비어 보였다.
그래서 결과물 폴더에는 긴 변을 1600px 로 줄인 JPEG 를 넣는다.
네이버 편집기는 초안 폴더의 원본을 올리므로 원본은 건드리지 않는다.

줄이는 일은 `ffmpeg` 가 한다. Hermes 컨테이너의 `python3` 에는 Pillow 가 없고 `ffmpeg` 는 있다.
`ffmpeg` 가 없거나 읽지 못한 사진은 줄이지 않고 원본 크기로 넣는다.
그때도 촬영 위치가 든 EXIF 는 빼고, 사진 방향만 최소한의 EXIF 로 다시 적는다.

EXIF 와 JPEG 구조는 이미지 라이브러리 없이 직접 읽는다.
"""

from __future__ import annotations

import shutil
import struct
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from place_hints import _entries, _exif_block  # noqa: E402

LONG_EDGE = 1600
SHRINK_SUFFIXES = {".jpg", ".jpeg"}
ORIENTATION = 0x0112

# EXIF 방향 값마다 픽셀을 바로 세우는 ffmpeg 필터다. 5~8 은 가로와 세로가 바뀐다.
UPRIGHT = {
    2: "hflip",
    3: "hflip,vflip",
    4: "vflip",
    5: "transpose=0",
    6: "transpose=1",
    7: "transpose=3",
    8: "transpose=2",
}

# 크기가 들어 있는 SOF 마커다. DHT(C4), JPG(C8), DAC(CC) 는 SOF 가 아니다.
SOF_MARKERS = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}


def orientation(image: bytes) -> int:
    """EXIF 의 방향 값을 읽는다. 없거나 읽지 못하면 1 이다."""
    tiff = _exif_block(image)
    if len(tiff) < 8:
        return 1
    order = "<" if tiff[:2] == b"II" else ">"
    (ifd0,) = struct.unpack_from(f"{order}I", tiff, 4)
    spot = _entries(tiff, ifd0, order).get(ORIENTATION)
    if not spot or spot[0] != 3 or spot[2] + 2 > len(tiff):
        return 1
    (value,) = struct.unpack_from(f"{order}H", tiff, spot[2])
    return value if 1 <= value <= 8 else 1


def _segments(image: bytes):
    """SOS 앞까지의 마커 구간을 (마커, 시작, 끝) 으로 낸다. 마지막은 SOS 다."""
    i = 2
    while i + 4 <= len(image) and image[i] == 0xFF:
        marker = image[i + 1]
        if marker == 0xFF:
            i += 1
            continue
        (size,) = struct.unpack_from(">H", image, i + 2)
        yield marker, i, i + 2 + size
        if marker == 0xDA:
            return
        i += 2 + size


def jpeg_size(image: bytes) -> tuple[int, int] | None:
    """SOF 에 적힌 픽셀 크기를 (가로, 세로) 로 읽는다. 방향은 반영하지 않는다."""
    if not image.startswith(b"\xff\xd8"):
        return None
    for marker, start, _end in _segments(image):
        if marker in SOF_MARKERS and start + 9 <= len(image):
            height, width = struct.unpack_from(">HH", image, start + 5)
            return (width, height)
    return None


def display_size(image: bytes) -> tuple[int, int] | None:
    """화면에 보이는 크기를 읽는다. JPEG 는 방향을, PNG 와 GIF 는 머리를 본다."""
    size = jpeg_size(image)
    if size:
        return (size[1], size[0]) if orientation(image) >= 5 else size
    if image.startswith(b"\x89PNG\r\n\x1a\n") and len(image) >= 24:
        return struct.unpack_from(">II", image, 16)
    if image[:6] in (b"GIF87a", b"GIF89a") and len(image) >= 10:
        return struct.unpack_from("<HH", image, 6)
    return None


def orientation_segment(value: int) -> bytes:
    """방향 값 하나만 담은 APP1 EXIF 구간을 만든다."""
    tiff = b"MM\x00\x2a" + struct.pack(">I", 8)
    tiff += struct.pack(">H", 1) + struct.pack(">HHIHH", ORIENTATION, 3, 1, value, 0)
    tiff += struct.pack(">I", 0)
    body = b"Exif\x00\x00" + tiff
    return b"\xff\xe1" + struct.pack(">H", len(body) + 2) + body


def strip_metadata(image: bytes, keep_orientation: int = 1) -> bytes:
    """촬영 정보를 뺀 JPEG 를 돌려준다. JPEG 가 아니면 그대로 돌려준다.

    APP0(JFIF)과 색 공간(APP2 ICC_PROFILE)만 남기고 EXIF, XMP, 제조사 구간, 주석을 뺀다.
    아이폰이 EOI 뒤에 덧붙이는 보조 이미지에도 EXIF 가 있어 EOI 뒤는 버린다.
    keep_orientation 이 1 이 아니면 그 값만 담은 EXIF 를 새로 적는다.
    """
    if not image.startswith(b"\xff\xd8"):
        return image
    kept: list[bytes] = []
    scan_at = None
    for marker, start, end in _segments(image):
        if marker == 0xDA:
            scan_at = start
            break
        if 0xE1 <= marker <= 0xEF and not (
            marker == 0xE2 and image[start + 4 : start + 16] == b"ICC_PROFILE\x00"
        ):
            continue
        if marker == 0xFE:
            continue
        kept.append(image[start:end])
    if scan_at is None:
        return image
    if keep_orientation != 1:
        # JFIF 는 SOI 바로 뒤에 와야 하므로 방향 구간은 그 뒤에 둔다.
        at = 1 if kept and kept[0][1] == 0xE0 else 0
        kept.insert(at, orientation_segment(keep_orientation))
    # 압축 데이터 안의 0xFF 는 0x00 이나 RST 가 뒤따르므로 FFD9 는 EOI 에만 나온다.
    eoi = image.find(b"\xff\xd9", scan_at)
    scan = image[scan_at : eoi + 2 if eoi >= 0 else len(image)]
    return b"\xff\xd8" + b"".join(kept) + scan


def shrink(source: Path, long_edge: int = LONG_EDGE) -> bytes | None:
    """ffmpeg 로 긴 변을 줄이고 방향을 픽셀에 반영한 JPEG 를 만든다. 못 하면 None 이다."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return None
    filters = [
        f"scale=w='min({long_edge},iw)':h='min({long_edge},ih)':force_original_aspect_ratio=decrease"
    ]
    turn = UPRIGHT.get(orientation(source.read_bytes()))
    if turn:
        filters.append(turn)
    command = [
        ffmpeg, "-v", "error", "-noautorotate", "-i", str(source),
        "-vf", ",".join(filters), "-map_metadata", "-1", "-frames:v", "1",
        "-q:v", "3", "-threads", "1", "-f", "image2pipe", "-c:v", "mjpeg", "-",
    ]
    try:
        result = subprocess.run(command, capture_output=True, check=False, timeout=60)
    except (OSError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0 or not result.stdout.startswith(b"\xff\xd8"):
        return None
    return strip_metadata(result.stdout)


def preview_bytes(source: Path) -> tuple[bytes, bool]:
    """결과물 폴더에 넣을 바이트와 줄였는지를 돌려준다."""
    if source.suffix.lower() in SHRINK_SUFFIXES:
        small = shrink(source)
        if small:
            return small, True
    image = source.read_bytes()
    return strip_metadata(image, orientation(image)), False
