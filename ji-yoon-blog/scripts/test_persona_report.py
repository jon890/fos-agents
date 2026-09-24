"""페르소나 보고서가 새 글 10개 기준과 비교 표를 지키는지 검증한다."""

import json
import tempfile
import unittest
from pathlib import Path

from analyze_persona import load, overall
from build_persona_report import build_report


class PersonaReportTest(unittest.TestCase):
    def test_reports_only_after_ten_new_posts_since_last_report(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            posts = base / "posts"
            posts.mkdir()
            stats = base / "persona-stats.json"
            report = base / "report.html"
            state = base / "report-state.json"

            def add_post(number):
                record = {
                    "logNo": str(number), "title": f"구리 카페 {number}",
                    "resolvedDate": "2026-09-24", "categoryName": "카페로그",
                    "paragraphs": ["안녕하세요 지융입니다", "오늘은 카페에 다녀왔어요"],
                    "block_sequence": ["sticker", "text", "placesMap", "sticker"],
                    "image_count": 1, "sticker_count": 2, "tagsFetched": True,
                    "tags": ["구리카페"], "char_count": 28,
                }
                (posts / f"{number}.json").write_text(json.dumps(record, ensure_ascii=False), encoding="utf-8")

            def analyze():
                records = load(posts)
                stats.write_text(json.dumps({"전체": overall(records)}, ensure_ascii=False), encoding="utf-8")

            for number in range(1, 10):
                add_post(number)
            analyze()
            self.assertEqual(build_report(posts, stats, report, state), (9, 0))
            self.assertFalse(report.exists())

            add_post(10)
            analyze()
            self.assertEqual(build_report(posts, stats, report, state), (10, 10))
            self.assertIn("최근 10개와 전체 10개 비교", report.read_text(encoding="utf-8"))
            self.assertEqual(build_report(posts, stats, report, state), (0, 0))

            for number in range(11, 20):
                add_post(number)
            analyze()
            self.assertEqual(build_report(posts, stats, report, state), (9, 0))
            add_post(20)
            analyze()
            self.assertEqual(build_report(posts, stats, report, state), (10, 20))


if __name__ == "__main__":
    unittest.main()
