"""수동 등록용 묶음이 지융이 열 수 있는 자리와 모양으로 만들어지는지 검증한다."""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from test_build_preview import draft

SCRIPT = Path(__file__).with_name("build_package.py")


class BuildPackageTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.draft_dir = root / "drafts" / "2026-09-27-샘플가게"
        (self.draft_dir / "photos").mkdir(parents=True)
        (self.draft_dir / "photos" / "001-menu.jpg").write_bytes(b"jpg")
        self.draft_path = self.draft_dir / "draft.json"
        self.draft_path.write_text(
            json.dumps(draft("photos/001-menu.jpg"), ensure_ascii=False), encoding="utf-8"
        )
        self.artifacts = root / "artifacts" / "42"

    def tearDown(self):
        self.temp.cleanup()

    def run_package(self, out: Path) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, str(SCRIPT), str(self.draft_path), "--out", str(out)],
            capture_output=True, text=True, check=False,
        )

    def test_html_package_goes_to_artifact_folder_with_photos(self):
        out = self.artifacts / "샘플가게-수동등록" / "index.html"
        result = self.run_package(out)
        self.assertEqual(result.returncode, 0, result.stdout)
        markup = out.read_text(encoding="utf-8")
        self.assertIn("<p>테스트 글입니다.</p>", markup)
        self.assertIn("사진 1 넣기", markup)
        self.assertIn('src="photos/001-menu.jpg" alt="" loading="lazy"', markup)
        self.assertIn("#예시시맛집", markup)
        self.assertNotIn("<script", markup)
        self.assertTrue((out.parent / "photos" / "001-menu.jpg").is_file())
        self.assertNotIn(self.temp.name, result.stdout)
        self.assertIn("샘플가게-수동등록/index.html", result.stdout)
        self.assertIn("답에 옮기지 않는다", result.stdout)

    def test_markdown_package_output_hides_folder(self):
        out = self.draft_dir / "package.md"
        result = self.run_package(out)
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn("<< 사진 1: photos/001-menu.jpg >>", out.read_text(encoding="utf-8"))
        self.assertNotIn("drafts/", result.stdout)
        self.assertIn("경로를 답에 옮기지 말고", result.stdout)


if __name__ == "__main__":
    unittest.main()
