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
