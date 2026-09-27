"""에디터를 열기 전 초안 검사와 저장 차단을 확인한다."""

import argparse
import contextlib
import io
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import naver_editor
import naver_editor_components
import naver_editor_core
import naver_editor_photos
import naver_editor_settings


class EditorGateTest(unittest.TestCase):
    def test_place_address_matches_naver_country_prefix_and_short_province(self):
        entered = "경기 구리시 동구릉로 145"
        result = "대한민국 경기도 구리시 동구릉로 145"
        self.assertEqual(
            naver_editor.normalize_place_address(entered),
            naver_editor.normalize_place_address(result),
        )

    def test_place_address_matches_observed_gwangju_map_label(self):
        entered = "광주 광산구 송정로8번길 11"
        result = "전남광주통합특별시 광산구 송정로8번길 11"
        self.assertEqual(
            naver_editor.normalize_place_address(entered),
            naver_editor.normalize_place_address(result),
        )

    def test_place_candidates_remove_repeated_name_after_address(self):
        class Page:
            def js(self, _expression):
                return json.dumps([{
                    "index": 0,
                    "name": "또아식빵",
                    "address": "전남광주통합특별시 광산구 송정로8번길 11 또아식빵",
                }], ensure_ascii=False)

        self.assertEqual(naver_editor_components.place_candidates(Page())[0]["address"],
                         "전남광주통합특별시 광산구 송정로8번길 11")

    def test_component_check_accepts_observed_gwangju_map_label(self):
        draft = {"blocks": [{
            "type": "map", "name": "또아식빵", "address": "광주 광산구 송정로8번길 11"
        }]}
        state = {"stickers": [], "maps": [
            "또아식빵\n전남광주통합특별시 광산구 송정로8번길 11"
        ]}
        self.assertEqual(naver_editor.component_problems(draft, state, []), [])

    def test_component_check_ignores_name_repeated_after_map_address(self):
        draft = {"blocks": [{
            "type": "map", "name": "또아식빵", "address": "광주 광산구 송정로8번길 11"
        }]}
        state = {"stickers": [], "maps": [
            "또아식빵\n\n전남광주통합특별시 광산구 송정로8번길 11 또아식빵\n\n\t"
        ]}
        self.assertEqual(naver_editor.component_problems(draft, state, []), [])

    def test_component_state_reveals_sticker_before_reading_code(self):
        class Page:
            calls = [0, 0]

            def js(self, expression):
                if "se-sticker\").length" in expression:
                    return 2
                if "scrollIntoView" in expression:
                    index = 1 if "[1]" in expression else 0
                    self.calls[index] += 1
                    if index == 1 and self.calls[index] == 1:
                        return ""
                    return f"ogq-test-{index}"
                return "[]"

        page = Page()
        self.assertEqual(naver_editor_components.component_state(page), {
            "stickers": ["ogq-test-0", "ogq-test-1"], "maps": []
        })
        self.assertGreaterEqual(page.calls[1], 2)

    def test_sticker_waits_for_placeholder_after_editor_rerender(self):
        class Page:
            def js(self, _expression):
                return True

        page = Page()
        block = {"type": "sticker", "stickerCode": next(iter(naver_editor.STICKER_CODES.values()))}
        counts = iter([0, 1])
        with patch.object(naver_editor_components, "focus_placeholder", side_effect=[False, True]) as focus, \
                patch.object(naver_editor_components, "component_count", side_effect=lambda *_: next(counts)), \
                patch.object(naver_editor_components, "mouse_click", return_value=True), \
                patch.object(naver_editor_components, "wait_until", side_effect=
                             lambda check, seconds=3.0: check() or check()):
            self.assertEqual(naver_editor_components.insert_sticker(page, block), "")
        self.assertEqual(focus.call_count, 2)

    def test_components_wait_for_final_editor_state(self):
        class Page:
            pass

        args = argparse.Namespace(draft_data={"blocks": []}, draft_hash="same")
        with patch.object(naver_editor_components, "set_stage"), \
                patch.object(naver_editor_components, "require_clear_screen", return_value=""), \
                patch.object(naver_editor_components, "component_state", return_value={}), \
                patch.object(naver_editor_components, "paragraphs", return_value=[]), \
                patch.object(naver_editor_components, "component_problems", side_effect=[
                    ["처음 대조에서 미완료"], ["편집기 반영 중"], [], []
                ]):
            self.assertEqual(naver_editor_components.cmd_components(Page(), args), 0)

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

        with patch.object(naver_editor_components, "click", side_effect=click) as pressed:
            self.assertEqual(naver_editor.ensure_domestic_map(page), "")
        self.assertEqual(pressed.call_count, 2)
        with patch.object(naver_editor_components, "click") as pressed:
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
        with patch.object(naver_editor_components, "place_candidates", return_value=results):
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

    def test_failed_stage_invalidates_itself_and_following_stages(self):
        class Page:
            expression = ""

            def js(self, expression):
                self.expression = expression

        page = Page()
        args = argparse.Namespace(draft_hash="same")
        passed = {
            "draftHash": "same",
            "passed": ["fill", "photos", "components", "settings"],
        }
        with patch.object(naver_editor_core, "progress", return_value=passed):
            naver_editor.set_stage(page, args, "photos", False)
        encoded = page.expression.split(", ", 1)[1][:-1]
        stored = json.loads(json.loads(encoded))
        self.assertEqual(stored["passed"], ["fill"])

    def test_body_lines_preserve_block_order_with_exact_placeholders(self):
        draft = {"blocks": [
            {"type": "text", "lines": ["첫 문단"]},
            {"type": "image", "path": "photos/001-menu.jpg"},
            {"type": "sticker", "label": "맛있음", "stickerCode": "ogq_5db4314bac2f0-1"},
            {"type": "map", "name": "어랑추", "address": "경기 구리시 동구릉로 145"},
        ]}
        self.assertEqual(naver_editor.body_lines(draft), [
            "첫 문단",
            "",
            "[사진 자리: 001-menu.jpg]",
            "[스티커 자리: 맛있음]",
            "[장소 자리: 어랑추 | 경기 구리시 동구릉로 145]",
        ])

    def test_photo_paths_preserve_draft_order_for_local_and_remote_browser(self):
        draft = {"blocks": [
            {"type": "image", "path": "photos/002.jpg"},
            {"type": "text", "lines": ["사이 문단"]},
            {"type": "image", "path": "photos/001.jpg"},
        ]}
        root = Path("/tmp/draft")
        self.assertEqual(naver_editor.photo_paths(draft, root, ""), [
            "/tmp/draft/photos/002.jpg",
            "/tmp/draft/photos/001.jpg",
        ])
        self.assertEqual(naver_editor.photo_paths(draft, root, "/srv/photos/"), [
            "/srv/photos/002.jpg",
            "/srv/photos/001.jpg",
        ])

    def test_attach_photos_passes_files_to_intercepted_chooser(self):
        class Page:
            def __init__(self):
                self.calls = []

            def call(self, method, **params):
                self.calls.append((method, params))

            def wait_event(self, method, seconds):
                self.calls.append(("wait_event", {"method": method, "seconds": seconds}))
                return {"backendNodeId": 41}

        page = Page()
        files = ["/srv/photos/001.jpg", "/srv/photos/002.jpg"]
        with patch.object(naver_editor_photos, "click", return_value=True):
            self.assertEqual(naver_editor.attach_photos(page, files), "")
        self.assertIn(
            ("DOM.setFileInputFiles", {"files": files, "backendNodeId": 41}),
            page.calls,
        )

    def test_photos_refuse_existing_image_before_upload_finishes(self):
        draft = {"blocks": [{"type": "image", "path": "photos/001.jpg"}]}
        args = argparse.Namespace(
            draft="/tmp/draft/draft.json",
            draft_data=draft,
            draft_hash="same",
            remote_base="",
        )

        class Page:
            def js(self, _expression):
                return 1

        with patch.object(naver_editor_photos, "set_stage"), \
                patch.object(naver_editor_photos, "require_clear_screen", return_value=""), \
                patch.object(naver_editor_photos, "image_count", return_value=1), \
                patch.object(naver_editor_photos, "incomplete_images", return_value=[0]), \
                patch.object(naver_editor_photos, "attach_photos") as attach, \
                contextlib.redirect_stderr(io.StringIO()) as stderr:
            self.assertEqual(naver_editor.cmd_photos(Page(), args), 1)
        attach.assert_not_called()
        self.assertIn("전송이 끝나지 않은 것", stderr.getvalue())

    def test_photos_wait_for_remote_image_after_layout_change(self):
        draft = {"blocks": [{"type": "image", "path": "photos/001.jpg"}]}
        args = argparse.Namespace(
            draft="/tmp/draft/draft.json", draft_data=draft,
            draft_hash="same", remote_base="",
        )

        class Page:
            count = 0
            scrolled = 0

            def js(self, expression):
                if "scrollIntoView" in expression:
                    self.scrolled += 1
                    return True
                return 0

        page = Page()

        def attach(_page, _files):
            page.count = 1
            return ""

        with patch.object(naver_editor_photos, "set_stage"), \
                patch.object(naver_editor_photos, "require_clear_screen", return_value=""), \
                patch.object(naver_editor_photos, "blocking_popup", return_value=""), \
                patch.object(naver_editor_photos, "image_count", side_effect=lambda _page: page.count), \
                patch.object(naver_editor_photos, "paragraphs", return_value=[]), \
                patch.object(naver_editor_photos, "focus_placeholder", return_value=True), \
                patch.object(naver_editor_photos, "attach_photos", side_effect=attach), \
                patch.object(naver_editor_photos, "fit_image", return_value=True), \
                patch.object(naver_editor_photos, "image_uploaded", side_effect=[False, True, True]), \
                patch.object(naver_editor_photos, "incomplete_images", return_value=[]), \
                patch.object(naver_editor_photos, "wait_until", side_effect=
                             lambda check, seconds: check() or check()):
            self.assertEqual(naver_editor_photos.cmd_photos(page, args), 0)
        self.assertGreater(page.scrolled, 0)

    def test_offscreen_preview_recovers_after_image_is_scrolled_into_view(self):
        class Page:
            def __init__(self):
                self.visible = [True, False]
                self.scrolled = []

            def js(self, expression):
                index = 1 if "[1]" in expression else 0
                if "scrollIntoView" in expression:
                    self.visible[index] = True
                    self.scrolled.append(index)
                    return True
                return self.visible[index]

        page = Page()
        self.assertEqual(naver_editor_photos.incomplete_images(page, 2), [])
        self.assertEqual(page.scrolled, [0, 1])

    def test_offscreen_preview_that_does_not_recover_blocks_save(self):
        class Page:
            def js(self, expression):
                return "scrollIntoView" in expression

        with patch.object(naver_editor_photos, "wait_until", side_effect=lambda check, seconds: check()):
            self.assertEqual(naver_editor_photos.incomplete_images(Page(), 1), [0])

    @unittest.skipUnless(shutil.which("node"), "JavaScript 런타임이 없다")
    def test_photo_is_uploaded_only_when_remote_image_has_loaded(self):
        class Page:
            def __init__(self, src, complete, natural_width):
                self.image = {
                    "src": src, "complete": complete, "naturalWidth": natural_width
                }

            def js(self, expression):
                setup = (
                    f"const img = {json.dumps(self.image)};"
                    "globalThis.document = {querySelectorAll: () => "
                    "[{querySelector: () => img}]};"
                )
                output = subprocess.check_output(
                    ["node", "-e", setup + f"console.log(JSON.stringify({expression}));"],
                    text=True,
                )
                return json.loads(output)

        remote = "https://blogfiles.pstatic.net/photo.jpg"
        cases = [
            ("data:image/jpeg;base64,a", True, 100, False),
            (remote, False, 0, False),
            (remote, True, 0, False),
            (remote, True, 100, True),
        ]
        for src, complete, natural_width, expected in cases:
            with self.subTest(src=src, complete=complete, natural_width=natural_width):
                page = Page(src, complete, natural_width)
                self.assertEqual(naver_editor_photos.image_uploaded(page, 0), expected)

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
                patch.object(naver_editor, "require_clear_screen", return_value=""), \
                patch.object(naver_editor, "dismiss_popup", return_value=True) as dismiss:
            self.assertEqual(naver_editor.cmd_open(Page(), args), 0)
        dismiss.assert_called_once_with(unittest.mock.ANY, "취소")

    def test_settings_select_exact_category_before_adding_tags(self):
        draft = {"category": "맛집로그", "tags": ["구리맛집"]}
        args = argparse.Namespace(draft_data=draft, draft_hash="same")

        class Page:
            def js(self, _expression):
                return "구리맛집"

            def type_text(self, _text):
                pass

            def enter(self):
                pass

        page = Page()
        state = {"category": "맛집로그", "tags": ["구리맛집"]}
        with patch.object(naver_editor_settings, "set_stage"), \
                patch.object(naver_editor_settings, "require_clear_screen", return_value=""), \
                patch.object(naver_editor_settings, "open_settings", return_value=True), \
                patch.object(naver_editor_settings, "close_settings", return_value=True), \
                patch.object(naver_editor_settings, "click_stable_settings_control", return_value=True) as click_control, \
                patch.object(naver_editor_settings, "category_option_finder", return_value="exact-category"), \
                patch.object(naver_editor_settings, "mouse_click", return_value=True) as choose, \
                patch.object(naver_editor_settings, "wait_until", return_value=True), \
                patch.object(naver_editor_settings, "settings_state", return_value=state), \
                patch.object(naver_editor_settings.time, "sleep"):
            self.assertEqual(naver_editor.cmd_settings(page, args), 0)
        choose.assert_called_once_with(page, "exact-category")
        self.assertEqual(
            [call.args[1] for call in click_control.call_args_list],
            ['button[data-click-area="tpb*i.category"]', "#tag-input"],
        )

    def test_settings_control_waits_until_motion_stops_and_is_uncovered(self):
        states = [
            {"top": 28, "x": 300, "y": 40, "uncovered": False},
            {"top": 48, "x": 300, "y": 60, "uncovered": False},
            {"top": 68, "x": 300, "y": 80, "uncovered": True},
            {"top": 68, "x": 300, "y": 80, "uncovered": True},
        ]

        class Page:
            def __init__(self):
                self.events = []
                self.expressions = []

            def js(self, expression):
                self.expressions.append(expression)
                return json.dumps(states.pop(0))

            def call(self, method, **params):
                self.events.append((method, params))

        page = Page()

        def poll(predicate, **_kwargs):
            for _ in range(4):
                if predicate():
                    return True
                self.assertEqual(page.events, [])
            return False

        with patch.object(naver_editor_settings, "wait_until", side_effect=poll), \
                patch.object(naver_editor_settings.time, "monotonic", side_effect=[1.0, 1.3]):
            self.assertTrue(naver_editor_settings.click_stable_settings_control(page, "#category"))
        self.assertTrue(all("scrollIntoView({block:'nearest'})" in expr for expr in page.expressions))
        self.assertEqual(
            [(method, params["type"], params["x"], params["y"]) for method, params in page.events],
            [
                ("Input.dispatchMouseEvent", "mousePressed", 300, 80),
                ("Input.dispatchMouseEvent", "mouseReleased", 300, 80),
            ],
        )

    def test_settings_state_reads_category_before_inner_text_is_painted(self):
        if not shutil.which("node"):
            self.skipTest("node 없음")

        class Page:
            def js(self, expression):
                setup = (
                    "globalThis.document = {"
                    "querySelector: () => ({innerText:'', textContent:'맛집로그'}),"
                    "querySelectorAll: () => []};"
                )
                return subprocess.check_output(
                    ["node", "-e", setup + f"console.log({expression});"], text=True,
                ).strip()

        self.assertEqual(
            naver_editor_settings.settings_state(Page()),
            {"category": "맛집로그", "tags": []},
        )

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
        with patch.object(naver_editor_settings, "settings_open", return_value=False), \
                patch.object(naver_editor_settings, "progress", return_value={
                    "draftHash": "same", "passed": ["fill", "photos"]
                }), \
                patch.object(naver_editor_settings, "click_button") as click, \
                contextlib.redirect_stderr(io.StringIO()) as stderr:
            self.assertEqual(naver_editor.cmd_save(page, args), 1)
        click.assert_not_called()
        self.assertIn("components, settings", stderr.getvalue())

    def test_save_refuses_image_that_is_still_local(self):
        draft = {
            "title": "[자동화 테스트] 사진 전송",
            "category": "맛집로그",
            "tags": ["식빵"],
            "blocks": [{"type": "image", "path": "photos/001.jpg"}],
        }
        args = argparse.Namespace(draft_data=draft, draft_hash="same")

        class Page:
            def js(self, _expression):
                return 1

        with patch.object(naver_editor_settings, "progress", return_value={
            "draftHash": "same", "passed": ["fill", "photos", "components", "settings"]
        }), patch.object(naver_editor_settings, "paragraphs", side_effect=[
            [draft["title"]], []
        ]), patch.object(naver_editor_settings, "image_count", return_value=1), \
                patch.object(naver_editor_settings, "incomplete_images", return_value=[0]), \
                patch.object(naver_editor_settings, "component_count", return_value=0), \
                patch.object(naver_editor_settings, "component_state", return_value={}), \
                patch.object(naver_editor_settings, "component_problems", return_value=[]), \
                patch.object(naver_editor_settings, "open_settings", return_value=True), \
                patch.object(naver_editor_settings, "settings_state", return_value={
                    "category": "맛집로그", "tags": ["식빵"]
                }), patch.object(naver_editor_settings, "close_settings", return_value=True):
            problems = naver_editor_settings.save_readiness(Page(), args)
        self.assertTrue(any("전송" in problem for problem in problems), problems)

    def test_save_rechecks_photo_immediately_before_click(self):
        draft = {"title": "사진 재확인", "blocks": [{"type": "image", "path": "photos/001.jpg"}]}
        args = argparse.Namespace(draft_data=draft, draft_hash="same")

        class Page:
            def js(self, _expression):
                return 5

        with patch.object(naver_editor_settings, "settings_open", return_value=False), \
                patch.object(naver_editor_settings, "save_readiness", return_value=[]), \
                patch.object(naver_editor_settings, "image_count", return_value=1), \
                patch.object(naver_editor_settings, "incomplete_images", return_value=[0]), \
                patch.object(naver_editor_settings, "click_button") as click, \
                contextlib.redirect_stderr(io.StringIO()) as stderr:
            self.assertEqual(naver_editor_settings.cmd_save(Page(), args), 1)
        click.assert_not_called()
        self.assertIn("저장 직전에", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
