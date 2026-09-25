"""실제 편집기에 넣을 초안의 스티커와 장소 계약을 검증한다."""

import copy
import tempfile
import unittest
from pathlib import Path

from build_preview import render_block
from draft_contract import validate


class DraftContractTest(unittest.TestCase):
    def draft(self):
        return {
            "title": "[자동화 테스트] 메뉴판",
            "category": "맛집로그",
            "sponsored": False,
            "tags": ["구리맛집", "고등어김치찜맛집"],
            "blocks": [
                {"type": "sticker", "stickerCode": "ogq_5db4314bac2f0-1"},
                {"type": "text", "lines": ["테스트 글입니다."]},
                {"type": "sticker", "stickerCode": "ogq_5db4314bac2f0-6"},
                {"type": "image", "path": "photos/menu.jpg", "role": "menu"},
                {"type": "map", "name": "어랑추", "address": "동구릉로 145"},
                {"type": "sticker", "stickerCode": "ogq_5db4314bac2f0-23"},
                {"type": "sticker", "stickerCode": "ogq_5db4314bac2f0-4"},
            ],
        }

    def test_confirmed_non_sponsored_draft(self):
        self.assertEqual(validate(self.draft()), [])

    def test_sponsored_draft_rejects_self_paid_sticker(self):
        draft = self.draft()
        draft["sponsored"] = True
        self.assertTrue(any("내돈내산" in problem for problem in validate(draft)))
        draft["blocks"].pop(-2)
        self.assertEqual(validate(draft), [])

    def test_requires_confirmed_sponsorship_and_exact_menu_position(self):
        draft = self.draft()
        del draft["sponsored"]
        draft["blocks"].insert(3, {"type": "text", "lines": ["다른 줄"]})
        problems = validate(draft)
        self.assertTrue(any("sponsored" in problem for problem in problems))
        self.assertTrue(any("가격표" in problem for problem in problems))

    def test_map_and_tags_require_searchable_values(self):
        draft = copy.deepcopy(self.draft())
        draft["tags"] = ["#구리맛집"]
        draft["blocks"][4]["address"] = ""
        problems = validate(draft)
        self.assertTrue(any("tags" in problem for problem in problems))
        self.assertTrue(any("address" in problem for problem in problems))

    def test_sticker_preview_uses_existing_image_and_falls_back_to_label(self):
        block = {"type": "sticker", "stickerCode": "ogq_5db4314bac2f0-1"}
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            self.assertIn("안녕하세요 스티커", render_block(block, base))
            stickers = base / "stickers"
            stickers.mkdir()
            (stickers / "ogq_5db4314bac2f0-1.png").write_bytes(b"png")
            markup = render_block(block, base)
            self.assertIn("<img", markup)
            self.assertIn("ogq_5db4314bac2f0-1.png", markup)

    def test_map_preview_links_to_naver(self):
        block = {
            "type": "map", "name": "어랑추", "address": "경기 구리시 동구릉로 145",
            "mapUrl": "https://map.naver.com/p/entry/place/19882103",
        }
        with tempfile.TemporaryDirectory() as temp:
            markup = render_block(block, Path(temp))
            self.assertIn("네이버 지도에서 보기", markup)
            self.assertIn("map.naver.com/p/entry/place/19882103", markup)
            self.assertNotIn("<img", markup)


if __name__ == "__main__":
    unittest.main()
