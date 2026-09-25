"""네이버 편집기의 스티커와 지도 구성요소를 넣고 대조한다."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from cdp import Page
from naver_editor_core import (
    BODY_SELECTOR,
    clear_field,
    click,
    component_count,
    focus_placeholder,
    map_placeholder,
    mouse_click,
    normalize,
    normalize_place_address,
    paragraphs,
    require_clear_screen,
    set_stage,
    sticker_placeholder,
    wait_until,
)

sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[1] / ".claude/skills/naver-blog-draft/scripts"),
)
from draft_contract import STICKER_CODES  # noqa: E402

STICKER_BUTTON = "button.se-sticker-toolbar-button"
PLACE_BUTTON = "button.se-map-toolbar-button"


def insert_sticker(page: Page, block: dict) -> str:
    """자리표시 문단에 코드로 지정한 실제 스티커를 넣는다."""
    code = block.get("stickerCode", "")
    if code not in STICKER_CODES.values():
        return f"지원하지 않는 stickerCode: {code}"
    marker = sticker_placeholder(block)
    if not focus_placeholder(page, marker):
        return f"스티커 자리를 찾지 못했다: {marker}"
    before = component_count(page, "sticker")
    panel_open = page.js(
        "(() => { const e = document.querySelector('.se-sidebar-container-sticker');"
        " if (!e) return false; const r = e.getBoundingClientRect();"
        " return r.width > 0 && r.height > 0; })()"
    )
    if not panel_open and not click(page, STICKER_BUTTON):
        return "스티커 버튼을 찾지 못했다"
    finder = (
        "[...document.querySelectorAll('button.se-sidebar-element-sticker')]"
        f".find(e => e.innerText.trim() === {json.dumps(code)})"
    )
    if not wait_until(lambda: bool(page.js(f"!!({finder})"))):
        return f"스티커를 찾지 못했다: {code}"
    if not mouse_click(page, finder):
        return f"스티커를 누르지 못했다: {code}"
    if not wait_until(lambda: component_count(page, "sticker") > before):
        return f"스티커가 본문에 들어가지 않았다: {code}"
    return ""


def place_candidates(page: Page) -> list[dict]:
    """장소 검색 결과의 이름과 주소를 화면 순서대로 읽는다."""
    raw = page.js(
        "JSON.stringify([...document.querySelectorAll('.se-place-map-search-result-link')]"
        ".map((link, index) => {"
        " const row = link.closest('li') || link.parentElement;"
        " const lines = (row?.innerText || '').split('\\n').map(v => v.trim()).filter(Boolean);"
        " return {index, name: lines[0] || '', address: lines.slice(1).join(' ')};"
        "}))"
    )
    return json.loads(raw or "[]")


def ensure_domestic_map(page: Page) -> str:
    """장소 검색 범위를 국내로 고른다. 편집기가 이전 선택을 기억할 수 있다."""
    mode_button = ".se-popup-label-select-button"
    mode = lambda: page.js(
        f'document.querySelector({json.dumps(mode_button)})?.innerText.trim()'
    )
    if not wait_until(lambda: bool(mode())):
        return "지도 검색 범위를 찾지 못했다"
    if mode() == "국내":
        return ""
    if not click(page, mode_button) or not click(page, "label[for=popup-select-option-domestic]"):
        return "지도 검색을 국내로 바꾸지 못했다"
    if not wait_until(lambda: mode() == "국내"):
        return "지도 검색이 국내로 바뀌지 않았다"
    return ""


def domestic_place_candidates(page: Page) -> list[dict]:
    """검색 범위를 바꾼 직후 잠깐 남는 해외 결과를 제외한다."""
    if page.js("document.querySelector('.se-popup-label-select-button')?.innerText.trim()") != "국내":
        return []
    return [
        item
        for item in place_candidates(page)
        if not item["address"].startswith("대한민국 ")
    ]


def insert_map(page: Page, block: dict) -> str:
    """상호명과 주소가 모두 같은 검색 결과 하나만 골라 지도 카드를 넣는다."""
    name = normalize(block.get("name", ""))
    address = normalize_place_address(block.get("address", ""))
    if not name or not address:
        return "지도 블록의 name 과 address 를 모두 채운다"
    marker = map_placeholder(block)
    if not focus_placeholder(page, marker):
        return f"장소 자리를 찾지 못했다: {marker}"
    before = component_count(page, "placesMap")
    if not click(page, PLACE_BUTTON):
        return "장소 버튼을 찾지 못했다"
    search = 'input[placeholder="장소명을 입력하세요."]'
    candidates = []
    for _ in range(3):
        problem = ensure_domestic_map(page)
        if problem:
            return problem
        if not wait_until(lambda: page.js(f"!!document.querySelector({json.dumps(search)})")):
            return "장소 검색 입력칸을 찾지 못했다"
        if not click(page, search):
            return "장소 검색 입력칸을 누르지 못했다"
        clear_field(page)
        page.type_text(name)
        page.enter()
        if wait_until(lambda: bool(domestic_place_candidates(page)), seconds=5.0):
            candidates = domestic_place_candidates(page)
            break
    if not candidates:
        return f"장소 검색 결과가 없다: {name}"
    matches = [
        item
        for item in candidates
        if normalize(item["name"]) == name
        and normalize_place_address(item["address"]) == address
    ]
    if len(matches) != 1:
        return f"이름과 주소가 같은 장소가 하나가 아니다: {name} / {address} / {matches}"
    index = matches[0]["index"]
    finder = f"document.querySelectorAll('.se-place-map-search-result-link')[{index}]"
    if not mouse_click(page, finder):
        return f"장소 검색 결과를 누르지 못했다: {name}"
    add_finder = (
        "[...document.querySelectorAll('.se-place-add-button')]"
        ".find(e => e.getBoundingClientRect().width > 0 && !e.disabled)"
    )
    if not wait_until(lambda: page.js(f"!!({add_finder})")):
        return "장소 추가 버튼이 나타나지 않았다"
    if not mouse_click(page, add_finder):
        return "장소 추가 버튼을 누르지 못했다"
    confirm_finder = (
        "[...document.querySelectorAll('.se-popup-button-confirm')]"
        ".find(e => !e.disabled && e.getBoundingClientRect().width > 0)"
    )
    if not wait_until(lambda: page.js(f"!!({confirm_finder})")):
        return "장소 확인 버튼이 나타나지 않았다"
    if not mouse_click(page, confirm_finder):
        return "장소 확인 버튼을 누르지 못했다"
    if not wait_until(lambda: component_count(page, "placesMap") > before, seconds=10.0):
        return "지도 카드가 본문에 들어가지 않았다"
    return ""


def component_state(page: Page) -> dict:
    raw = page.js(
        "JSON.stringify({"
        "stickers:[...document.querySelectorAll('.se-component.se-sticker img')].map(e=>e.alt),"
        "maps:[...document.querySelectorAll('.se-component.se-placesMap')].map(e=>e.innerText)"
        "})"
    )
    return json.loads(raw or "{}")


def component_problems(draft: dict, state: dict, lines: list[str]) -> list[str]:
    """스티커 코드 순서와 지도 상호·주소가 초안과 같은지 대조한다."""
    blocks = draft["blocks"]
    wanted_stickers = [block["stickerCode"] for block in blocks if block["type"] == "sticker"]
    problems = []
    if state.get("stickers") != wanted_stickers:
        problems.append("스티커 코드나 순서가 초안과 다르다")
    wanted_maps = [
        (normalize(block["name"]), normalize_place_address(block["address"]))
        for block in blocks
        if block["type"] == "map"
    ]
    maps = [
        list(filter(None, map(normalize, text.splitlines())))
        for text in state.get("maps", [])
    ]
    actual_maps = [
        (parts[0], normalize_place_address(parts[1])) for parts in maps if len(parts) >= 2
    ]
    if actual_maps != wanted_maps:
        problems.append("지도 상호명이나 주소가 초안과 다르다")
    if any(line.startswith(("[스티커 자리:", "[장소 자리:")) for line in lines):
        problems.append("스티커나 지도 자리표시가 남았다")
    return problems


def cmd_components(page: Page, args: argparse.Namespace) -> int:
    """초안의 스티커와 지도를 실제 편집기 구성요소로 바꾼다."""
    draft = args.draft_data
    set_stage(page, args, "components", False)
    note = require_clear_screen(page)
    if note:
        print(f"화면을 덮은 알림이 있어 구성요소를 넣지 못한다: {note}", file=sys.stderr)
        return 1
    if not component_problems(draft, component_state(page), paragraphs(page, BODY_SELECTOR)):
        print("스티커와 지도가 이미 초안과 일치한다")
        set_stage(page, args, "components", True)
        return 0
    counts = {"sticker": 0, "map": 0}
    for block in draft.get("blocks", []):
        kind = block.get("type")
        if kind == "sticker":
            problem = insert_sticker(page, block)
        elif kind == "map":
            problem = insert_map(page, block)
        else:
            continue
        if problem:
            print(problem, file=sys.stderr)
            return 1
        counts[kind] += 1
    problems = component_problems(draft, component_state(page), paragraphs(page, BODY_SELECTOR))
    if problems:
        print("구성요소가 초안과 다르다: " + ", ".join(problems), file=sys.stderr)
        return 1
    print(f"실제 스티커 {counts['sticker']}개와 지도 {counts['map']}개를 넣었다")
    set_stage(page, args, "components", True)
    return 0
