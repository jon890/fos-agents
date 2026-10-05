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
            "tags": ["예시시맛집", "고등어김치찜맛집"],
            "blocks": [
                {"type": "sticker", "stickerCode": "ogq_5db4314bac2f0-1"},
                {"type": "text", "lines": ["테스트 글입니다."]},
                {"type": "sticker", "stickerCode": "ogq_5db4314bac2f0-6"},
                {"type": "image", "path": "photos/menu.jpg", "role": "menu"},
                {"type": "map", "name": "샘플가게", "address": "샘플로 145"},
                {"type": "sticker", "stickerCode": "ogq_5db4314bac2f0-23"},
                {"type": "sticker", "stickerCode": "ogq_5db4314bac2f0-4"},
            ],
        }

    def test_confirmed_non_sponsored_draft(self):
        self.assertEqual(validate(self.draft()), [])

    def test_photos_follow_sent_order(self):
        draft = self.draft()
        draft["blocks"][3]["path"] = "photos/003-menu.jpg"
        draft["blocks"][4:4] = [
            {"type": "image", "path": "photos/004-dish.jpg"},
            {"type": "text", "lines": ["다음 사진"]},
            {"type": "image", "path": "photos/010-close.jpg"},
        ]
        self.assertEqual(validate(draft), [])

        # 카테고리의 사진 순서에 맞춘다고 앞에 보낸 사진을 뒤로 옮기면 막는다.
        moved = copy.deepcopy(draft)
        moved["blocks"][4]["path"] = "photos/002-exterior.jpg"
        self.assertTrue(any("002-exterior.jpg" in p and "번호 순서" in p for p in validate(moved)))

        twice = copy.deepcopy(draft)
        twice["blocks"][6]["path"] = "photos/004-dish.jpg"
        self.assertTrue(any("번호 순서" in p for p in validate(twice)))

    def test_photo_order_edges(self):
        draft = self.draft()
        # 사진을 받기 전 자리표시자도 번호가 늘면 통과한다.
        draft["blocks"][3]["path"] = "photos/001-<나중에>.jpg"
        draft["blocks"].insert(4, {"type": "image", "path": "photos/002-<나중에>.jpg"})
        self.assertEqual(validate(draft), [])
        # 앞에 ./ 가 붙어도 같은 번호로 본다.
        dotted = copy.deepcopy(draft)
        dotted["blocks"][4]["path"] = "./photos/001-dup.jpg"
        self.assertTrue(any("번호 순서" in p for p in validate(dotted)))
        # 번호 없는 경로는 순서를 알 수 없어 보지 않는다.
        unnumbered = copy.deepcopy(draft)
        unnumbered["blocks"][4]["path"] = "photos/extra.jpg"
        self.assertEqual(validate(unnumbered), [])
        noted = copy.deepcopy(draft)
        noted["blocks"][3]["note"] = ["메뉴판"]
        self.assertTrue(any("note" in p for p in validate(noted)))

    def test_missing_menu_photo_does_not_require_fake_menu(self):
        draft = self.draft()
        draft["menuPhotoUnavailable"] = True
        del draft["blocks"][2:4]
        draft["blocks"].insert(2, {"type": "image", "path": "photos/dish.jpg", "role": "dish"})
        self.assertEqual(validate(draft), [])
        with_price = copy.deepcopy(draft)
        with_price["blocks"].insert(2, {"type": "sticker", "stickerCode": "ogq_5db4314bac2f0-6"})
        self.assertTrue(any("메뉴판 사진이 없으면" in p for p in validate(with_price)))
        with_menu = copy.deepcopy(draft)
        with_menu["blocks"].insert(2, {"type": "image", "path": "photos/menu.jpg", "role": "menu"})
        self.assertTrue(any("메뉴판 사진이 없으면" in p for p in validate(with_menu)))
        del draft["menuPhotoUnavailable"]
        self.assertTrue(any("가격표" in p for p in validate(draft)))

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
        draft["tags"] = ["#예시시맛집"]
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
            "type": "map", "name": "샘플가게", "address": "경기 예시시 샘플로 145",
            "mapUrl": "https://map.naver.com/p/entry/place/1234567890",
        }
        with tempfile.TemporaryDirectory() as temp:
            markup = render_block(block, Path(temp))
            self.assertIn("네이버 지도에서 보기", markup)
            self.assertIn("map.naver.com/p/entry/place/1234567890", markup)
            self.assertNotIn("<img", markup)


if __name__ == "__main__":
    unittest.main()
