"""에디터를 열기 전 초안 검사와 저장 차단을 확인한다."""

import argparse
import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import naver_editor


class EditorGateTest(unittest.TestCase):
    def test_place_address_matches_naver_country_prefix_and_short_province(self):
        entered = "경기 구리시 동구릉로 145"
        result = "대한민국 경기도 구리시 동구릉로 145"
        self.assertEqual(
            naver_editor.normalize_place_address(entered),
            naver_editor.normalize_place_address(result),
        )

    def test_map_search_switches_from_overseas_to_domestic(self):
        class Page:
            mode = "해외"

            def js(self, expression):
                return self.mode

        page = Page()

        def click(_page, selector):
            if selector == "label[for=popup-select-option-domestic]":
                page.mode = "국내"
            return True

        with patch.object(naver_editor, "click", side_effect=click) as pressed:
            self.assertEqual(naver_editor.ensure_domestic_map(page), "")
        self.assertEqual(pressed.call_count, 2)
        with patch.object(naver_editor, "click") as pressed:
            self.assertEqual(naver_editor.ensure_domestic_map(page), "")
        pressed.assert_not_called()

    def test_domestic_map_ignores_stale_overseas_result(self):
        class Page:
            def js(self, expression):
                return "국내"

        results = [
            {"index": 0, "name": "어랑추", "address": "대한민국 경기도 구리시 동구릉로 145"},
            {"index": 1, "name": "어랑추", "address": "경기도 구리시 동구릉로 145"},
        ]
        with patch.object(naver_editor, "place_candidates", return_value=results):
            self.assertEqual(naver_editor.domestic_place_candidates(Page()), results[1:])

    def test_component_check_requires_exact_stickers_and_map(self):
        draft = {"blocks": [
            {"type": "sticker", "stickerCode": "ogq_5db4314bac2f0-1"},
            {"type": "map", "name": "어랑추", "address": "경기 구리시 동구릉로 145"},
        ]}
        state = {"stickers": ["ogq_5db4314bac2f0-1"],
                 "maps": ["어랑추\n\n경기도 구리시 동구릉로 145"]}
        self.assertEqual(naver_editor.component_problems(draft, state, []), [])
        self.assertTrue(naver_editor.component_problems(draft, state, ["[장소 자리: 어랑추]"]))
        state["stickers"] = ["ogq_5db4314bac2f0-4"]
        self.assertTrue(naver_editor.component_problems(draft, state, []))

    def test_open_cancels_only_resume_prompt(self):
        class Page:
            def js(self, expression):
                if expression == "document.title":
                    return "지융로그 : 네이버 블로그"
                return True

        prompt = "작성 중인 글이 있습니다. 이어서 작성하시겠습니까? 취소 확인"
        args = argparse.Namespace(target_id="new-tab")
        with patch.object(naver_editor.time, "sleep"), \
                patch.object(naver_editor, "blocking_popup", side_effect=[prompt, ""]), \
                patch.object(naver_editor, "dismiss_popup", return_value=True) as dismiss:
            self.assertEqual(naver_editor.cmd_open(Page(), args), 0)
        dismiss.assert_called_once_with(unittest.mock.ANY, "취소")

    def test_old_draft_is_rejected_before_new_tab(self):
        old_draft = {
            "title": "[자동화 테스트] 옛 초안",
            "category": "맛집로그",
            "tags": ["구리맛집"],
            "blocks": [
                {"type": "sticker", "emoji": "😋"},
                {"type": "text", "lines": ["테스트"]},
            ],
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "draft.json"
            path.write_text(json.dumps(old_draft, ensure_ascii=False), encoding="utf-8")
            stderr = io.StringIO()
            with patch.object(sys, "argv", ["naver_editor.py", "open", str(path)]), \
                    patch.object(naver_editor, "http_json") as browser, \
                    contextlib.redirect_stderr(stderr):
                self.assertEqual(naver_editor.main(), 1)
            browser.assert_not_called()
            self.assertIn("stickerCode", stderr.getvalue())

    def test_save_refuses_failed_stage_without_clicking(self):
        draft = {"title": "[자동화 테스트]", "blocks": []}
        args = argparse.Namespace(draft_data=draft, draft_hash="same")
        page = object()
        with patch.object(naver_editor, "settings_open", return_value=False), \
                patch.object(naver_editor, "progress", return_value={
                    "draftHash": "same", "passed": ["fill", "photos"]
                }), \
                patch.object(naver_editor, "click_button") as click, \
                contextlib.redirect_stderr(io.StringIO()) as stderr:
            self.assertEqual(naver_editor.cmd_save(page, args), 1)
        click.assert_not_called()
        self.assertIn("components, settings", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
