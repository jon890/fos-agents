"""네이버 편집기의 사진 첨부와 배치 검사를 맡는다."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from cdp import Page
from naver_editor_core import (
    BODY_SELECTOR,
    blocking_popup,
    click,
    focus_placeholder,
    image_placeholder,
    mouse_click,
    paragraphs,
    require_clear_screen,
    set_stage,
    wait_until,
)

PHOTO_BUTTON = "button.se-image-toolbar-button"
# `사진 첨부 방식` 창의 `개별사진`. 현재 명령은 한 장씩 넣지만 기존 모듈 계약을 유지한다.
LAYOUT_EACH = "#image-type-list"


def attach_photos(page: Page, files: list[str], seconds: float = 30.0) -> str:
    """사진 버튼을 눌러 열리는 파일 선택 창을 가로채 파일을 넣는다.

    네이버는 버튼을 누를 때 `input[type=file]`을 만들고 창이 닫히면 지운다.
    선택 창 이벤트의 `backendNodeId`를 받아 같은 CDP 연결에서 즉시 파일을 넣는다.
    파일 경로는 브라우저가 실행되는 기계의 경로여야 한다.
    """
    page.call("DOM.enable")
    page.call("Runtime.enable")
    page.call("Page.setInterceptFileChooserDialog", enabled=True)
    # JS의 `.click()`은 사용자 활성화로 인정되지 않아 파일 선택 창이 열리지 않는다.
    if not click(page, PHOTO_BUTTON):
        return "사진 버튼을 찾지 못했다"

    chooser = page.wait_event("Page.fileChooserOpened", seconds=seconds)
    if not chooser:
        return "파일 선택 창을 가로채지 못했다"
    node = chooser.get("backendNodeId")
    if not node:
        return f"파일 선택 창에 backendNodeId 가 없다: {chooser}"

    page.call("DOM.setFileInputFiles", files=files, backendNodeId=node)
    return ""


def photo_paths(draft: dict, root: Path, base: str) -> list[str]:
    """초안의 image 블록이 가리키는 파일을 브라우저 쪽 경로로 바꾼다."""
    paths = []
    for block in draft.get("blocks", []):
        if block.get("type") != "image":
            continue
        name = block.get("path", "")
        if not name:
            continue
        if base:
            paths.append(base.rstrip("/") + "/" + Path(name).name)
        else:
            paths.append(str(root / name))
    return paths


def image_count(page: Page) -> int:
    """본문에 들어간 이미지 블록 수를 읽는다."""
    return page.js('document.querySelectorAll(".se-component.se-image").length') or 0


def image_uploaded(page: Page, index: int) -> bool:
    """자리만 생긴 상태가 아니라 네이버 사진 주소로 전송됐는지 읽는다."""
    return bool(
        page.js(
            f"[...document.querySelectorAll('.se-component.se-image')][{index}]"
            "?.querySelector('img')?.src.includes('blogfiles.pstatic.net')"
        )
    )


def fit_image(page: Page, index: int) -> bool:
    """index 번째 사진을 골라 `문서 너비`를 적용하고 결과 클래스를 확인한다."""
    image = (
        f"[...document.querySelectorAll('.se-component.se-image')][{index}]"
        ".querySelector('.se-module-image')"
    )
    if not wait_until(lambda: mouse_click(page, image), seconds=10.0):
        return False
    fitted = (
        f"[...document.querySelectorAll('.se-component.se-image')][{index}]"
        "?.querySelector('.se-component-content-fit') !== null"
    )
    if page.js(fitted):
        return True
    toolbar = "button.se-object-arrangement-fit-toolbar-button"
    if not wait_until(
        lambda: bool(
            page.js(
                f"(() => {{ const e = document.querySelector({json.dumps(toolbar)});"
                " if (!e) return false; const r = e.getBoundingClientRect();"
                " return r.width > 0 && r.height > 0; })()"
            )
        ),
        seconds=10.0,
    ):
        return False
    if not click(page, toolbar):
        return False
    return wait_until(lambda: bool(page.js(fitted)), seconds=10.0)


def cmd_photos(page: Page, args: argparse.Namespace) -> int:
    """초안의 사진을 편집기에 넣는다."""
    draft_path = Path(args.draft)
    draft = args.draft_data
    set_stage(page, args, "photos", False)
    blocks = [block for block in draft.get("blocks", []) if block.get("type") == "image"]
    files = photo_paths(draft, draft_path.parent, args.remote_base)
    if not blocks or not files:
        print("초안에 image 블록이 없다", file=sys.stderr)
        return 1

    note = require_clear_screen(page)
    if note:
        print(f"화면을 덮은 알림이 있어 사진을 넣지 못한다: {note}", file=sys.stderr)
        return 1

    if len(blocks) != len(files):
        print("경로가 빈 image 블록이 있다", file=sys.stderr)
        return 1

    inserted = image_count(page)
    if inserted > len(blocks):
        print(f"사진이 초안보다 많다: 화면 {inserted}개, 초안 {len(blocks)}개", file=sys.stderr)
        return 1
    fitted = (
        page.js(
            'document.querySelectorAll(".se-component.se-image .se-component-content-fit").length'
        )
        or 0
    )
    if fitted != inserted:
        print(
            f"기존 사진 중 문서 너비가 아닌 것이 있다: 사진 {inserted}개, 적용 {fitted}개",
            file=sys.stderr,
        )
        return 1
    if any(not image_uploaded(page, index) for index in range(inserted)):
        print("기존 사진 중 전송이 끝나지 않은 것이 있다. 새 탭에서 다시 시작한다", file=sys.stderr)
        return 1
    visible_lines = paragraphs(page, BODY_SELECTOR)
    for block in blocks[:inserted]:
        marker = image_placeholder(block)
        if any(
            marker == line or (marker.startswith(line) and len(line) >= len(marker) - 10)
            for line in visible_lines
        ):
            print(f"사진과 자리표시가 함께 남아 있다: {marker}", file=sys.stderr)
            return 1

    for block, path in zip(blocks[inserted:], files[inserted:]):
        marker = image_placeholder(block)
        if not focus_placeholder(page, marker):
            print(f"사진 자리를 찾지 못했다: {marker}", file=sys.stderr)
            return 1
        before = image_count(page)
        problem = attach_photos(page, [path])
        if problem:
            print(problem, file=sys.stderr)
            return 1
        if not wait_until(lambda: image_count(page) > before, seconds=30.0):
            print(f"사진이 본문에 들어가지 않았다: {path}", file=sys.stderr)
            return 1
        if not wait_until(
            lambda: image_uploaded(page, before) or bool(blocking_popup(page)), seconds=90.0
        ):
            print(f"사진 전송이 끝나지 않았다: {path}", file=sys.stderr)
            return 1
        if not image_uploaded(page, before):
            print(f"사진 전송 중 알림이 떴다: {blocking_popup(page)}", file=sys.stderr)
            return 1
        if not fit_image(page, before):
            print(f"사진에 `문서 너비`를 적용하지 못했다: {path}", file=sys.stderr)
            return 1
        inserted += 1

    if image_count(page) != len(blocks):
        print("사진 개수가 초안과 다르다", file=sys.stderr)
        return 1
    print(f"사진 {inserted}개를 자리마다 넣고 모두 `문서 너비`로 맞췄다")
    set_stage(page, args, "photos", True)
    return 0
