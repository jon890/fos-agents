"""실제 편집기에 넣을 초안의 스티커와 장소 계약을 검증한다."""

import copy
import unittest

from build_preview import validate


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


if __name__ == "__main__":
    unittest.main()
