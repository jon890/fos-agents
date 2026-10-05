"""대화 첨부 사진을 장소별 초안 폴더에 복사할 때의 경계를 확인한다."""

from __future__ import annotations

import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from stage_chat_photos import stage_photos
from test_photo_set import build_jpeg


class StageChatPhotosTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        root = Path(self.temporary.name)
        self.source = root / "attachments" / "42"
        self.source.mkdir(parents=True)
        self.drafts = root / "drafts"
        for name in ("a.png", "b.png", "other.png"):
            (self.source / name).write_bytes(b"\x89PNG\r\n\x1a\nphoto")

    def test_copies_only_explicit_photos_into_new_place(self):
        result = stage_photos(
            self.source, ["b.png", "a.png"], "가상빵집", self.drafts, "2026-09-27"
        )

        target = self.drafts / "2026-09-27-가상빵집"
        self.assertEqual(result["directory"], str(target))
        self.assertEqual(
            [photo["path"] for photo in result["photos"]],
            ["photos/001-b.png", "photos/002-a.png"],
        )
        self.assertEqual(len(list((target / "photos").iterdir())), 2)
        self.assertFalse((target / "photos" / "other.png").exists())
        self.assertTrue((self.source / "a.png").exists())

    def test_sent_order_wins_over_shot_time_and_name(self):
        # 지융이 늦게 찍은 사진을 먼저 보냈다. 촬영시각이나 이름으로 다시 세우면 글의 순서가 바뀐다.
        sent = {
            "205.jpg": "2026:09:27 19:40:00",
            "201.jpg": "2026:09:27 18:05:00",
            "230.jpg": "",
            "203.jpg": "2026:09:27 18:30:00",
        }
        for name, taken in sent.items():
            (self.source / name).write_bytes(build_jpeg(taken or None))

        result = stage_photos(
            self.source, list(sent), "가상식당", self.drafts, "2026-09-27"
        )

        self.assertEqual(
            [(photo["order"], photo["path"], photo["source"]) for photo in result["photos"]],
            [
                (1, "photos/001-205.jpg", "205.jpg"),
                (2, "photos/002-201.jpg", "201.jpg"),
                (3, "photos/003-230.jpg", "230.jpg"),
                (4, "photos/004-203.jpg", "203.jpg"),
            ],
        )
        self.assertEqual(result["photos"][0]["shotAt"], "2026-09-27 19:40:00")
        self.assertEqual(result["photos"][2]["shotAt"], "")
        on_disk = sorted(p.name for p in (self.drafts / "2026-09-27-가상식당" / "photos").iterdir())
        self.assertEqual(on_disk, ["001-205.jpg", "002-201.jpg", "003-230.jpg", "004-203.jpg"])

    def test_keeps_thirty_photos_in_sent_order(self):
        # 한 번에 30장까지 받는다. 이름 정렬로는 "10.jpg" 가 "9.jpg" 앞에 온다.
        names = [f"{n}.jpg" for n in range(30, 0, -1)]
        for name in names:
            (self.source / name).write_bytes(build_jpeg(None))

        result = stage_photos(self.source, names, "가상식당", self.drafts, "2026-09-27")

        self.assertEqual([photo["source"] for photo in result["photos"]], names)
        self.assertEqual(result["photos"][-1]["path"], "photos/030-1.jpg")

    def test_keeps_chat_supported_gif(self):
        (self.source / "motion.gif").write_bytes(b"GIF89aexample")
        result = stage_photos(
            self.source, ["motion.gif"], "샘플 장소", self.drafts, "2026-09-27"
        )
        self.assertEqual(result["photos"][0]["path"], "photos/001-motion.gif")
        self.assertTrue(
            (self.drafts / "2026-09-27-샘플 장소" / "photos" / "001-motion.gif").exists()
        )

    def test_rejects_missing_photo_without_creating_draft(self):
        with self.assertRaises(ValueError):
            stage_photos(
                self.source, ["a.png", "missing.png"], "가상빵집", self.drafts,
                "2026-09-27",
            )
        self.assertFalse(self.drafts.exists())

    def test_rejects_path_traversal_and_symlink(self):
        (self.source / "linked.png").symlink_to(self.source / "a.png")
        for filename in ("../other.png", "..\\other.png", "linked.png"):
            with self.subTest(filename=filename), self.assertRaises(ValueError):
                stage_photos(
                    self.source, [filename], "가상빵집", self.drafts, "2026-09-27"
                )
        with self.assertRaises(ValueError):
            stage_photos(self.source, ["a.png"], "../other", self.drafts, "2026-09-27")
        self.assertFalse(self.drafts.exists())

    def test_existing_draft_is_preserved(self):
        target = self.drafts / "2026-09-27-가상빵집"
        target.mkdir(parents=True)
        (target / "draft.json").write_text("keep", encoding="utf-8")

        with self.assertRaises(FileExistsError):
            stage_photos(
                self.source, ["a.png"], "가상빵집", self.drafts, "2026-09-27"
            )

        self.assertEqual((target / "draft.json").read_text(encoding="utf-8"), "keep")

    def test_requires_calendar_date_in_documented_format(self):
        for invalid in ("20260927", "2026-W39-7", "2026-02-30"):
            with self.subTest(date=invalid), self.assertRaises(ValueError):
                stage_photos(
                    self.source, ["a.png"], "샘플 장소", self.drafts, invalid
                )
        self.assertFalse(self.drafts.exists())

    def test_concurrent_imports_do_not_replace_the_same_draft(self):
        ready = threading.Barrier(2)

        def import_once():
            ready.wait()
            try:
                stage_photos(
                    self.source, ["a.png"], "샘플 장소", self.drafts, "2026-09-27"
                )
                return "created"
            except FileExistsError:
                return "exists"

        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(lambda _: import_once(), range(2)))

        self.assertCountEqual(outcomes, ["created", "exists"])
        self.assertEqual(
            len(list((self.drafts / "2026-09-27-샘플 장소" / "photos").iterdir())), 1
        )


if __name__ == "__main__":
    unittest.main()
