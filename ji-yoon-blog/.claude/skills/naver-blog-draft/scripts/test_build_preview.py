"""미리보기 HTML 이 자기 폴더 안의 파일만 상대 경로로 부르고, 넣는 사진을 줄이는지 검증한다.

사진은 ffmpeg 로 만든 단색 이미지에 촬영 위치와 방향을 담은 EXIF 를 직접 붙여 쓴다.
"""

import json
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from place_hints import gps_of  # noqa: E402
from preview_photos import jpeg_size, orientation, strip_metadata  # noqa: E402

SCRIPT = Path(__file__).with_name("build_preview.py")
STICKER = "ogq_5db4314bac2f0-1"
FFMPEG = shutil.which("ffmpeg")


def exif_segment(turn: int) -> bytes:
    """방향과 촬영 위치를 담은 APP1 구간을 만든다."""
    order = "<"
    ifd0_at = 8
    gps_ifd_at = ifd0_at + 2 + 12 * 2 + 4
    values_at = gps_ifd_at + 2 + 12 * 4 + 4
    tiff = bytearray(b"II\x2a\x00" + struct.pack(f"{order}I", ifd0_at))
    tiff += struct.pack(f"{order}H", 2)
    tiff += struct.pack(f"{order}HHIHH", 0x0112, 3, 1, turn, 0)
    tiff += struct.pack(f"{order}HHII", 0x8825, 4, 1, gps_ifd_at)
    tiff += struct.pack(f"{order}I", 0)
    tiff += struct.pack(f"{order}H", 4)
    tiff += struct.pack(f"{order}HHI", 0x0001, 2, 2) + b"N\x00\x00\x00"
    tiff += struct.pack(f"{order}HHII", 0x0002, 5, 3, values_at)
    tiff += struct.pack(f"{order}HHI", 0x0003, 2, 2) + b"E\x00\x00\x00"
    tiff += struct.pack(f"{order}HHII", 0x0004, 5, 3, values_at)
    tiff += struct.pack(f"{order}I", 0)
    for part in (35, 58, 48):
        tiff += struct.pack(f"{order}II", part, 1)
    body = b"Exif\x00\x00" + bytes(tiff)
    return b"\xff\xe1" + struct.pack(">H", len(body) + 2) + body


def camera_jpeg(width: int, height: int, turn: int) -> bytes:
    """촬영 위치와 방향이 든 JPEG 를 만든다. EOI 뒤에 EXIF 가 든 덧붙은 이미지도 흉내 낸다."""
    made = subprocess.run(
        [FFMPEG, "-v", "error", "-f", "lavfi", "-i", f"color=c=orange:s={width}x{height}",
         "-frames:v", "1", "-f", "image2pipe", "-c:v", "mjpeg", "-"],
        capture_output=True, check=True,
    ).stdout
    return made[:2] + exif_segment(turn) + made[2:] + b"\xff\xd8" + exif_segment(1) + b"\xff\xd9"


def draft(photo: str, *more: str) -> dict:
    return {
        "title": "[자동화 테스트] 미리보기",
        "category": "맛집로그",
        "sponsored": False,
        "tags": ["예시시맛집"],
        "blocks": [
            {"type": "sticker", "stickerCode": STICKER},
            {"type": "text", "lines": ["테스트 글입니다."]},
            {"type": "sticker", "stickerCode": "ogq_5db4314bac2f0-6"},
            {"type": "image", "path": photo, "role": "menu"},
            *({"type": "image", "path": extra} for extra in more),
            {"type": "map", "name": "샘플가게", "address": "샘플로 145"},
            {"type": "sticker", "stickerCode": "ogq_5db4314bac2f0-23"},
            {"type": "sticker", "stickerCode": "ogq_5db4314bac2f0-4"},
        ],
    }


class BuildPreviewTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.draft_dir = root / "drafts" / "2026-09-27-샘플가게"
        (self.draft_dir / "photos").mkdir(parents=True)
        (self.draft_dir / "stickers").mkdir()
        (self.draft_dir / "photos" / "001-메뉴 판.jpg").write_bytes(b"jpg")
        (self.draft_dir / "stickers" / f"{STICKER}.png").write_bytes(b"png")
        self.artifacts = root / "artifacts" / "42"

    def tearDown(self):
        self.temp.cleanup()

    def run_preview(self, photo: str, out: Path, *more: str) -> subprocess.CompletedProcess:
        path = self.draft_dir / "draft.json"
        path.write_text(json.dumps(draft(photo, *more), ensure_ascii=False), encoding="utf-8")
        return subprocess.run(
            [sys.executable, str(SCRIPT), str(path), "--out", str(out)],
            capture_output=True, text=True, check=False,
        )

    def sources(self, out: Path) -> list[str]:
        return re.findall(r'src="([^"]+)"', out.read_text(encoding="utf-8"))

    def test_preview_next_to_draft_uses_relative_paths_without_copy(self):
        out = self.draft_dir / "preview.html"
        result = self.run_preview("photos/001-메뉴 판.jpg", out)
        self.assertEqual(result.returncode, 0, result.stdout)
        sources = self.sources(out)
        self.assertEqual(len(sources), 2)
        self.assertTrue(all(not s.startswith(("file:", "/", "http")) for s in sources), sources)
        self.assertEqual(
            sorted(p.name for p in self.draft_dir.rglob("*") if p.is_file()),
            sorted(["001-메뉴 판.jpg", f"{STICKER}.png", "draft.json", "preview.html"]),
        )

    def test_artifact_folder_gets_copies_and_draft_keeps_originals(self):
        out = self.artifacts / "초안" / "index.html"
        result = self.run_preview("photos/001-메뉴 판.jpg", out)
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertTrue((out.parent / "photos" / "001-메뉴 판.jpg").is_file())
        self.assertTrue((out.parent / "stickers" / f"{STICKER}.png").is_file())
        self.assertTrue((self.draft_dir / "photos" / "001-메뉴 판.jpg").is_file())
        markup = out.read_text(encoding="utf-8")
        self.assertNotIn("file:", markup)
        self.assertNotIn("<script", markup)
        self.assertNotIn("<link", markup)
        self.assertIn("photos/001-%EB%A9%94%EB%89%B4%20%ED%8C%90.jpg", self.sources(out))

    def test_outside_photos_with_same_name_do_not_overwrite_each_other(self):
        root = Path(self.temp.name)
        (root / "chat").mkdir()
        (root / "chat" / "001-메뉴 판.jpg").write_bytes(b"chat")
        other = root / "other" / "001-메뉴 판.jpg"
        other.parent.mkdir()
        other.write_bytes(b"other")
        out = self.artifacts / "초안" / "index.html"
        for _ in range(2):
            result = self.run_preview(
                "photos/001-메뉴 판.jpg", out, "../../chat/001-메뉴 판.jpg", str(other),
            )
            self.assertEqual(result.returncode, 0, result.stdout)
        name = "001-%EB%A9%94%EB%89%B4%20%ED%8C%90"
        self.assertEqual(
            [s for s in self.sources(out) if not s.startswith("stickers/")],
            [f"photos/{name}.jpg", f"external/{name}.jpg", f"external/{name}-2.jpg"],
        )
        self.assertEqual((out.parent / "photos" / "001-메뉴 판.jpg").read_bytes(), b"jpg")
        self.assertEqual((out.parent / "external" / "001-메뉴 판.jpg").read_bytes(), b"chat")
        self.assertEqual((out.parent / "external" / "001-메뉴 판-2.jpg").read_bytes(), b"other")
        self.assertEqual(len(list((out.parent / "external").iterdir())), 2)

    def test_unsupported_format_is_left_out_without_failing(self):
        (self.draft_dir / "photos" / "002-IMG.HEIC").write_bytes(b"heic")
        out = self.artifacts / "초안" / "index.html"
        result = self.run_preview("photos/002-IMG.HEIC", out)
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn("미리보기에 넣지 못한 형식", result.stdout)
        self.assertFalse((out.parent / "photos" / "002-IMG.HEIC").exists())
        self.assertIn("미리보기에 넣을 수 없는 형식", out.read_text(encoding="utf-8"))

    def photo_in_artifact(self, image: bytes, env: dict | None = None):
        (self.draft_dir / "photos" / "002-camera.jpg").write_bytes(image)
        out = self.artifacts / "초안" / "index.html"
        path = self.draft_dir / "draft.json"
        path.write_text(json.dumps(draft("photos/002-camera.jpg"), ensure_ascii=False), encoding="utf-8")
        result = subprocess.run(
            [sys.executable, str(SCRIPT), str(path), "--out", str(out)],
            capture_output=True, text=True, check=False, env=env,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return result, out, (out.parent / "photos" / "002-camera.jpg").read_bytes()

    @unittest.skipUnless(FFMPEG, "ffmpeg 가 없다")
    def test_artifact_photo_is_shrunk_upright_and_without_exif(self):
        original = camera_jpeg(4000, 3000, turn=6)
        result, out, copied = self.photo_in_artifact(original)
        # 방향 6 은 오른쪽으로 돌려 세우는 값이라 가로와 세로가 바뀐다
        self.assertEqual(jpeg_size(copied), (1200, 1600))
        self.assertNotIn(b"Exif", copied)
        self.assertIsNone(gps_of(copied))
        self.assertLess(len(copied), len(original))
        self.assertEqual((self.draft_dir / "photos" / "002-camera.jpg").read_bytes(), original)
        self.assertIn('loading="lazy" width="1200" height="1600"', out.read_text(encoding="utf-8"))
        self.assertIn("1600px 로 줄이고", result.stdout)

    @unittest.skipUnless(FFMPEG, "ffmpeg 가 없다")
    def test_small_photo_is_not_enlarged(self):
        _result, _out, copied = self.photo_in_artifact(camera_jpeg(800, 600, turn=1))
        self.assertEqual(jpeg_size(copied), (800, 600))
        self.assertNotIn(b"Exif", copied)

    @unittest.skipUnless(FFMPEG, "ffmpeg 가 없다")
    def test_without_ffmpeg_photo_keeps_size_and_orientation_but_loses_location(self):
        original = camera_jpeg(640, 480, turn=6)
        env = {**os.environ, "PATH": ""}
        result, out, copied = self.photo_in_artifact(original, env)
        self.assertEqual(jpeg_size(copied), (640, 480))
        self.assertEqual(orientation(copied), 6)
        self.assertIsNone(gps_of(copied))
        self.assertEqual(copied.count(b"Exif"), 1)
        self.assertIn('width="480" height="640"', out.read_text(encoding="utf-8"))
        self.assertIn("줄이지 못한 사진 1장", result.stdout)

    def test_strip_keeps_image_data_and_drops_trailing_image(self):
        scan = b"\xff\xda\x00\x02" + b"\x12\xff\x00\x34" + b"\xff\xd9"
        app0 = b"\xff\xe0\x00\x06JFIF"
        comment = b"\xff\xfe\x00\x06note"
        image = b"\xff\xd8" + app0 + exif_segment(3) + comment + scan + b"\xff\xd8" + exif_segment(1)
        self.assertEqual(strip_metadata(image), b"\xff\xd8" + app0 + scan)
        kept = strip_metadata(image, keep_orientation=3)
        self.assertTrue(kept.startswith(b"\xff\xd8" + app0 + b"\xff\xe1"))
        self.assertEqual(orientation(kept), 3)
        self.assertIsNone(gps_of(kept))
        self.assertEqual(strip_metadata(b"not a jpeg"), b"not a jpeg")

    def test_missing_photo_still_fails(self):
        out = self.artifacts / "초안" / "index.html"
        result = self.run_preview("photos/없는사진.jpg", out)
        self.assertEqual(result.returncode, 1, result.stdout)


if __name__ == "__main__":
    unittest.main()
