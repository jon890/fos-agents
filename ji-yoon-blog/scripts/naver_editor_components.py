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
    str(Path(__file__).resolve().parents[1] / ".claude/skills/ji-yoon-blog-style/scripts"),
)
from draft_contract import STICKER_CODES  # noqa: E402

STICKER_BUTTON = "button.se-sticker-toolbar-button"
PLACE_BUTTON = "button.se-map-toolbar-button"


def place_address_without_repeated_name(name: str, address: str) -> str:
    """지도 검색 결과와 카드 주소 끝에 반복된 상호명을 제거한다."""
    address = normalize(address)
    suffix = " " + normalize(name)
    return address[: -len(suffix)] if suffix.strip() and address.endswith(suffix) else address


def insert_sticker(page: Page, block: dict) -> str:
    """자리표시 문단에 코드로 지정한 실제 스티커를 넣는다."""
    code = block.get("stickerCode", "")
    if code not in STICKER_CODES.values():
        return f"지원하지 않는 stickerCode: {code}"
    marker = sticker_placeholder(block)
    if not wait_until(lambda: focus_placeholder(page, marker), seconds=5.0):
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
    candidates = json.loads(raw or "[]")
    for item in candidates:
        item["address"] = place_address_without_repeated_name(item["name"], item["address"])
    return candidates


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


PLACE_SEARCH_INPUT = 'input[placeholder="장소명을 입력하세요."]'


def search_places(page: Page, query: str) -> tuple[str, list[dict]]:
    """검색어 하나로 장소를 찾고 이번 검색의 국내 결과를 돌려준다.

    이전 검색 결과가 잠깐 남아 있으므로 목록이 바뀔 때까지 기다린다.
    새 결과가 이전 결과와 같으면 목록이 바뀌지 않으므로, 기다린 뒤에도 결과가 있으면 그대로 쓴다.
    """
    problem = ensure_domestic_map(page)
    if problem:
        return problem, []
    if not wait_until(lambda: page.js(f"!!document.querySelector({json.dumps(PLACE_SEARCH_INPUT)})")):
        return "장소 검색 입력칸을 찾지 못했다", []
    if not click(page, PLACE_SEARCH_INPUT):
        return "장소 검색 입력칸을 누르지 못했다", []
    previous = domestic_place_candidates(page)
    clear_field(page)
    page.type_text(query)
    page.enter()

    def changed() -> bool:
        current = domestic_place_candidates(page)
        return bool(current) and current != previous

    wait_until(changed, seconds=5.0)
    return "", domestic_place_candidates(page)


def find_place_matches(page: Page, name: str, address: str) -> tuple[str, list[dict], list[dict]]:
    """상호명, 주소 순서로 검색해 이름과 주소가 모두 같은 결과를 찾는다.

    네이버 장소 검색은 상호명으로는 안 나오고 주소로는 나오는 경우가 있다.
    검색어만 넓히고 선택 기준은 상호와 주소의 완전 일치를 유지한다.
    """
    candidates: list[dict] = []
    matches: list[dict] = []
    for query in (name, address):
        for _ in range(3):
            problem, found = search_places(page, query)
            if problem:
                return problem, [], []
            if found:
                candidates = found
                matches = [
                    item
                    for item in found
                    if normalize(item["name"]) == name
                    and normalize_place_address(item["address"]) == address
                ]
                break
        if matches:
            break
    return "", candidates, matches


def insert_map(page: Page, block: dict) -> str:
    """상호명과 주소가 모두 같은 검색 결과 하나만 골라 지도 카드를 넣는다."""
    name = normalize(block.get("name", ""))
    address = normalize_place_address(block.get("address", ""))
    if not name or not address:
        return "지도 블록의 name 과 address 를 모두 채운다"
    marker = map_placeholder(block)
    if not wait_until(lambda: focus_placeholder(page, marker), seconds=5.0):
        return f"장소 자리를 찾지 못했다: {marker}"
    before = component_count(page, "placesMap")
    if not click(page, PLACE_BUTTON):
        return "장소 버튼을 찾지 못했다"
    problem, candidates, matches = find_place_matches(page, name, address)
    if problem:
        return problem
    if not candidates:
        return f"장소 검색 결과가 없다: {name}"
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
    stickers = []
    for index in range(component_count(page, "sticker")):
        def visible_sticker_code() -> str:
            return page.js(
                f"(() => {{ const sticker = [...document.querySelectorAll('.se-component.se-sticker')][{index}];"
                " if (!sticker) return '';"
                " sticker.scrollIntoView({behavior: 'instant', block: 'center'});"
                " return sticker.querySelector('img')?.alt || ''; })()"
            ) or ""

        wait_until(lambda: bool(visible_sticker_code()), seconds=15.0)
        stickers.append(visible_sticker_code())
    raw_maps = page.js(
        "JSON.stringify([...document.querySelectorAll('.se-component.se-placesMap')]"
        ".map(e=>e.innerText))"
    )
    return {"stickers": stickers, "maps": json.loads(raw_maps or "[]")}


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
        (
            parts[0],
            normalize_place_address(place_address_without_repeated_name(parts[0], parts[1])),
        )
        for parts in maps
        if len(parts) >= 2
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
    def current_problems() -> list[str]:
        return component_problems(draft, component_state(page), paragraphs(page, BODY_SELECTOR))

    wait_until(lambda: not current_problems(), seconds=10.0)
    problems = current_problems()
    if problems:
        print("구성요소가 초안과 다르다: " + ", ".join(problems), file=sys.stderr)
        return 1
    print(f"실제 스티커 {counts['sticker']}개와 지도 {counts['map']}개를 넣었다")
    set_stage(page, args, "components", True)
    return 0
