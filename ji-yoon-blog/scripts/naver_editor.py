"""초안을 네이버 글쓰기 화면에 넣고 임시저장한다.

홈서버의 상주 Chrome 에 CDP 로 붙어 사람이 치는 것과 같은 경로로 넣는다.
상주 Chrome 을 띄우고 로그인을 판정하는 것은 `naver_session.py`가 맡는다.
맥북에서 부를 때는 포트 포워딩이 떠 있어야 한다.

    ssh -L 9222:127.0.0.1:9222 <홈서버>

제목과 본문, 사진, 스티커, 지도, 카테고리와 태그를 넣는다.
사진은 초안의 자리마다 넣고 `문서 너비`를 적용한다.
발행하지 않으며 `save` 명령도 초안과 화면을 다시 대조한 뒤 임시저장 버튼만 누른다.

사용법:
    python3 naver_editor.py open drafts/순돌이곱창/draft.json
    python3 naver_editor.py --target-id <탭 식별자> fill drafts/순돌이곱창/draft.json
    python3 naver_editor.py --target-id <탭 식별자> photos drafts/순돌이곱창/draft.json --remote-base <사진 디렉터리>
    python3 naver_editor.py --target-id <탭 식별자> components drafts/순돌이곱창/draft.json
    python3 naver_editor.py --target-id <탭 식별자> settings drafts/순돌이곱창/draft.json
    python3 naver_editor.py --target-id <탭 식별자> save drafts/순돌이곱창/draft.json
    python3 naver_editor.py --target-id <탭 식별자> state
    python3 naver_editor.py --target-id <탭 식별자> close

종료 코드:
    0  요청한 것이 끝났다
    1  화면이 기대한 상태가 아니다
    2  브라우저에 붙지 못했다
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request

from cdp import HOST, PORT, CdpError, Page, http_json
from naver_editor_components import (
    PLACE_BUTTON,
    STICKER_BUTTON,
    STICKER_CODES,
    cmd_components,
    component_problems,
    component_state,
    domestic_place_candidates,
    ensure_domestic_map,
    insert_map,
    insert_sticker,
    place_candidates,
)
from naver_editor_core import (
    BODY_SELECTOR,
    EMOJI_RUN,
    PROGRESS_KEY,
    SETTLE_SECONDS,
    STAGES,
    STEP_SECONDS,
    TITLE_SELECTOR,
    blocking_popup,
    body_lines,
    body_mismatch,
    button_finder,
    click,
    click_button,
    clear_field,
    component_count,
    dismiss_popup,
    emoji_split,
    focus,
    focus_placeholder,
    image_placeholder,
    load_draft,
    map_placeholder,
    mouse_click,
    new_paragraph,
    normalize,
    normalize_place_address,
    paragraphs,
    progress,
    require_clear_screen,
    set_stage,
    sticker_placeholder,
    type_line,
    validate_draft,
    wait_until,
)
from naver_editor_photos import (
    LAYOUT_EACH,
    PHOTO_BUTTON,
    attach_photos,
    cmd_photos,
    fit_image,
    image_count,
    image_uploaded,
    photo_paths,
)
from naver_editor_settings import (
    PUBLISH_SETTINGS_BUTTON,
    category_option_finder,
    close_settings,
    cmd_save,
    cmd_settings,
    cmd_state,
    open_settings,
    save_count_js,
    save_readiness,
    settings_open,
    settings_state,
)
from naver_editor_text import cmd_fill

BLOG_ID = os.environ.get("JI_YOON_BLOG_BLOG_ID", "mywldbs")
WRITE_URL = f"https://blog.naver.com/PostWriteForm.naver?blogId={BLOG_ID}"
WRITE_MARK = "PostWriteForm.naver"


def close_tab(target_id: str) -> None:
    """정확한 탭 하나를 닫는다. CDP의 응답은 JSON이 아닌 일반 문자열이다."""
    with urllib.request.urlopen(
        f"http://{HOST}:{PORT}/json/close/{urllib.parse.quote(target_id)}",
        timeout=10,
    ):
        pass


def cmd_open(page: Page, args: argparse.Namespace) -> int:
    """글쓰기 화면을 연다."""
    for _ in range(40):
        time.sleep(1)
        title = page.js("document.title") or ""
        if "네이버 블로그" in title and page.js(
            f"!!document.querySelector({json.dumps(TITLE_SELECTOR)})"
        ):
            note = blocking_popup(page)
            if "작성 중인 글이 있습니다" in note and "이어서 작성하시겠습니까" in note:
                if not dismiss_popup(page, "취소"):
                    print(f"작성 중인 글 알림을 닫지 못했다: {note}", file=sys.stderr)
                    return 1
                note = require_clear_screen(page)
            if note:
                print(f"알림이 떠 있어 멈춘다: {note}", file=sys.stderr)
                return 1
            page.js(f"sessionStorage.removeItem({json.dumps(PROGRESS_KEY)})")
            print(f"글쓰기 화면을 새 탭에 열었다: {title}")
            print(f"target-id: {args.target_id}")
            return 0
        if "NAVER 로그인" in title:
            print("로그인 화면으로 넘어갔다. naver_session.py 로 로그인 상태를 본다.", file=sys.stderr)
            return 1
    print("글쓰기 화면이 뜨지 않았다", file=sys.stderr)
    return 1


def build_parser() -> argparse.ArgumentParser:
    """기존 CLI 명령과 인자를 한곳에서 정의한다."""
    parser = argparse.ArgumentParser(description="네이버 글쓰기 화면에 초안을 넣는다")
    parser.add_argument(
        "--target-id",
        default="",
        help="open 이 출력한 정확한 탭 식별자. 기존 글쓰기 탭을 잘못 고르지 않기 위해 필요하다",
    )
    sub = parser.add_subparsers(dest="command", required=True)
    opener = sub.add_parser("open", help="초안을 검사한 뒤 글쓰기 화면을 연다")
    opener.add_argument("draft", help="draft.json 경로")
    fill = sub.add_parser("fill", help="초안의 제목과 본문을 넣는다")
    fill.add_argument("draft", help="draft.json 경로")
    photos = sub.add_parser("photos", help="초안의 사진을 편집기에 넣는다")
    photos.add_argument("draft", help="draft.json 경로")
    photos.add_argument(
        "--remote-base",
        default="",
        help="브라우저가 도는 기계에서 사진이 있는 디렉터리. 비우면 초안 옆 경로를 쓴다",
    )
    components = sub.add_parser("components", help="초안의 스티커와 지도를 실제로 넣는다")
    components.add_argument("draft", help="draft.json 경로")
    settings = sub.add_parser("settings", help="카테고리와 태그를 발행 설정에 넣는다")
    settings.add_argument("draft", help="draft.json 경로")
    save = sub.add_parser("save", help="앞 단계와 화면을 검사한 뒤 임시저장한다")
    save.add_argument("draft", help="draft.json 경로")
    sub.add_parser("state", help="편집기에 들어간 것을 읽어 낸다")
    sub.add_parser("close", help="open 으로 만든 탭을 닫는다")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if hasattr(args, "draft") and not load_draft(args):
        return 1
    handlers = {
        "open": cmd_open,
        "fill": cmd_fill,
        "photos": cmd_photos,
        "components": cmd_components,
        "settings": cmd_settings,
        "save": cmd_save,
        "state": cmd_state,
    }

    try:
        tabs = [tab for tab in http_json("/json/list") if tab.get("type") == "page"]
        if args.command == "open":
            target = http_json(
                "/json/new?" + urllib.parse.quote(WRITE_URL, safe=""), method="PUT"
            )
            args.target_id = target.get("id", "")
        else:
            if not args.target_id:
                print("기존 탭을 잘못 고르지 않도록 --target-id 를 반드시 준다", file=sys.stderr)
                return 1
            target = next((tab for tab in tabs if tab.get("id") == args.target_id), None)
            if target is None:
                print(f"그 target-id 탭이 없다: {args.target_id}", file=sys.stderr)
                return 1
        if args.command == "close":
            close_tab(args.target_id)
            print(f"테스트 탭을 닫았다: {args.target_id}")
            return 0
        if args.command != "open" and WRITE_MARK not in target.get("url", ""):
            print(f"그 탭은 글쓰기 화면이 아니다: {target.get('url', '')}", file=sys.stderr)
            return 1
        page = Page(target["webSocketDebuggerUrl"])
        # 홈서버의 큰 가상 창에서는 아래쪽 문단에 보낸 마우스 이벤트가
        # 편집기에 닿지 않는다. 탭마다 화면 높이를 고정해 스크롤하며 누른다.
        page.call(
            "Emulation.setDeviceMetricsOverride",
            width=1280,
            height=720,
            deviceScaleFactor=1,
            mobile=False,
        )
    except (CdpError, OSError) as exc:
        print(f"브라우저에 붙지 못했다: {exc}", file=sys.stderr)
        return 2

    try:
        result = handlers[args.command](page, args)
        if args.command == "open" and result != 0:
            close_tab(args.target_id)
        return result
    except CdpError as exc:
        print(exc, file=sys.stderr)
        return 2
    finally:
        page.close()


if __name__ == "__main__":
    raise SystemExit(main())
