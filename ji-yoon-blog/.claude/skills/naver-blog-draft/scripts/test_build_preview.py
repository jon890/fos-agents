"""미리보기 HTML 이 자기 폴더 안의 파일만 상대 경로로 부르는지 검증한다."""

import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("build_preview.py")
STICKER = "ogq_5db4314bac2f0-1"


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

    def test_missing_photo_still_fails(self):
        out = self.artifacts / "초안" / "index.html"
        result = self.run_preview("photos/없는사진.jpg", out)
        self.assertEqual(result.returncode, 1, result.stdout)


if __name__ == "__main__":
    unittest.main()
