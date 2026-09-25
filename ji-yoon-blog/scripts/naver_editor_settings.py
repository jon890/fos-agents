"""네이버 발행 설정, 저장 전 대조와 상태 조회를 맡는다."""

from __future__ import annotations

import argparse
import json
import sys
import time

from cdp import Page
from naver_editor_components import component_problems, component_state
from naver_editor_core import (
    BODY_SELECTOR,
    SETTLE_SECONDS,
    STAGES,
    TITLE_SELECTOR,
    click,
    click_button,
    component_count,
    mouse_click,
    normalize,
    paragraphs,
    progress,
    require_clear_screen,
    set_stage,
    wait_until,
)
from naver_editor_photos import image_count

PUBLISH_SETTINGS_BUTTON = 'button[data-click-area="tpb.publish"]'


def settings_open(page: Page) -> bool:
    """접힌 설정도 화면을 가리므로 발행 설정 레이어의 존재를 읽는다."""
    return bool(page.js("!!document.querySelector('[class^=layer_publish]')"))


def open_settings(page: Page) -> bool:
    """발행 설정 레이어만 연다. 발행 확인 버튼은 누르지 않는다."""
    if settings_open(page):
        return True
    if not click(page, PUBLISH_SETTINGS_BUTTON):
        return False
    return wait_until(lambda: settings_open(page))


def close_settings(page: Page) -> bool:
    """상단 발행 버튼으로 설정 레이어만 닫는다. 발행 확인은 누르지 않는다."""
    if not settings_open(page):
        return True
    if not click(page, PUBLISH_SETTINGS_BUTTON):
        return False
    return wait_until(lambda: not settings_open(page))


def settings_state(page: Page) -> dict:
    """열린 발행 설정의 카테고리와 태그를 읽는다."""
    raw = page.js(
        "JSON.stringify({"
        ' category: document.querySelector(\'button[data-click-area="tpb*i.category"]\')?.innerText.trim() || \'\','
        ' tags: [...document.querySelectorAll(\'span[id^="tag-item-"][aria-label]\')]'
        "   .map(e => e.getAttribute('aria-label'))"
        "})"
    )
    state = json.loads(raw or "{}")
    state["tags"] = list(dict.fromkeys(state.get("tags", [])))
    return state


def category_option_finder(category: str) -> str:
    """목록의 카테고리 이름만 대조해 보이는 label 을 찾는다."""
    return (
        "[...document.querySelectorAll('label[for]')]"
        ".find(e => e.getBoundingClientRect().width > 0"
        " && [...e.querySelectorAll('[data-testid^=categoryItemText_]')]"
        f".some(name => name.textContent.replace(/\\s+/g, ' ').trim() === {json.dumps(category)}))"
    )


def cmd_settings(page: Page, args: argparse.Namespace) -> int:
    """카테고리와 태그를 발행 설정에 넣고 설정만 닫는다."""
    draft = args.draft_data
    set_stage(page, args, "settings", False)
    category = draft.get("category", "").strip()
    tags = [tag.lstrip("#").strip() for tag in draft.get("tags", []) if tag.strip()]
    if category not in ("맛집로그", "카페로그") or not tags:
        print("category 는 맛집로그 또는 카페로그이고 tags 는 비어 있지 않아야 한다", file=sys.stderr)
        return 1
    note = require_clear_screen(page)
    if note:
        print(f"화면을 덮은 알림이 있어 설정하지 못한다: {note}", file=sys.stderr)
        return 1
    if not open_settings(page):
        print("발행 설정을 열지 못했다", file=sys.stderr)
        return 1
    if not click(page, 'button[data-click-area="tpb*i.category"]'):
        print("카테고리 선택기를 열지 못했다", file=sys.stderr)
        return 1
    label = category_option_finder(category)
    if not wait_until(lambda: bool(page.js(f"!!({label})")), seconds=10.0):
        print(f"카테고리 목록에 보이는 항목이 없다: {category}", file=sys.stderr)
        return 1
    if not mouse_click(page, label):
        print(f"카테고리 항목을 누르지 못했다: {category}", file=sys.stderr)
        return 1
    if not wait_until(lambda: settings_state(page).get("category") == category):
        print(f"카테고리 선택이 반영되지 않았다: {category}", file=sys.stderr)
        return 1
    for tag in tags:
        if not click(page, "#tag-input"):
            print("태그 입력칸을 누르지 못했다", file=sys.stderr)
            return 1
        page.type_text(tag)
        if not wait_until(lambda: page.js("document.querySelector('#tag-input')?.value") == tag):
            print(f"태그 글자가 입력되지 않았다: {tag}", file=sys.stderr)
            return 1
        time.sleep(SETTLE_SECONDS)
        page.enter()
        if not wait_until(lambda: tag in settings_state(page).get("tags", [])):
            print(f"태그 칩이 생기지 않았다: {tag}", file=sys.stderr)
            return 1
    got = settings_state(page)
    missing = [tag for tag in tags if tag not in got.get("tags", [])]
    if category != got.get("category", "") or missing:
        print(f"카테고리나 태그가 화면과 다르다: {got}", file=sys.stderr)
        return 1
    if not close_settings(page):
        print("발행 설정을 닫지 못했다", file=sys.stderr)
        return 1
    print(f"카테고리 `{category}`와 태그 {len(tags)}개를 넣고 발행 설정을 닫았다")
    set_stage(page, args, "settings", True)
    return 0


def save_readiness(page: Page, args: argparse.Namespace) -> list[str]:
    """앞 단계의 성공과 실제 화면이 같은 초안을 가리키는지 확인한다."""
    current = progress(page)
    if current.get("draftHash") != args.draft_hash:
        return ["이 탭에서 검사한 초안과 저장할 초안이 다르다"]
    missing = [stage for stage in STAGES if stage not in current.get("passed", [])]
    if missing:
        return [f"끝나지 않은 단계: {', '.join(missing)}"]

    draft = args.draft_data
    blocks = draft["blocks"]
    problems = []
    title = normalize("".join(paragraphs(page, TITLE_SELECTOR)))
    if title != normalize(draft["title"]):
        problems.append("제목이 초안과 다르다")
    body = [normalize(line) for line in paragraphs(page, BODY_SELECTOR)]
    body = [line for line in body if line]
    wanted_text = [
        normalize(line)
        for block in blocks
        if block["type"] == "text"
        for line in block["lines"]
        if normalize(line)
    ]
    cursor = 0
    for line in body:
        if cursor < len(wanted_text) and line == wanted_text[cursor]:
            cursor += 1
    if cursor != len(wanted_text):
        problems.append(f"본문 글이 빠졌다: {cursor}/{len(wanted_text)}줄 확인")
    if any(
        line.startswith(("[사진 자리:", "[스티커 자리:", "[장소 자리:")) for line in body
    ):
        problems.append("사진·스티커·장소 자리표시 글이 남았다")

    expected = {
        "사진": sum(block["type"] == "image" for block in blocks),
        "스티커": sum(block["type"] == "sticker" for block in blocks),
        "지도": sum(block["type"] == "map" for block in blocks),
    }
    actual = {
        "사진": image_count(page),
        "스티커": component_count(page, "sticker"),
        "지도": component_count(page, "placesMap"),
    }
    for name, count in expected.items():
        if actual[name] != count:
            problems.append(f"{name} 수가 다르다: 초안 {count}, 화면 {actual[name]}")
    problems.extend(component_problems(draft, component_state(page), body))
    fit = (
        page.js(
            "document.querySelectorAll('.se-component.se-image .se-component-content-fit').length"
        )
        or 0
    )
    if fit != expected["사진"]:
        problems.append(f"문서 너비 사진 수가 다르다: 초안 {expected['사진']}, 화면 {fit}")

    if not open_settings(page):
        problems.append("카테고리와 태그를 읽을 수 없다")
    else:
        state = settings_state(page)
        if state.get("category") != draft["category"]:
            problems.append(f"카테고리가 다르다: {state.get('category')!r}")
        if set(state.get("tags", [])) != set(draft["tags"]):
            problems.append(f"태그가 다르다: {state.get('tags', [])!r}")
        if not close_settings(page):
            problems.append("발행 설정을 닫지 못했다")
    return problems


def cmd_save(page: Page, args: argparse.Namespace) -> int:
    """초안과 화면을 대조한 뒤 임시저장한다. 발행 버튼은 누르지 않는다."""
    if settings_open(page):
        print("발행 설정을 먼저 닫아야 임시저장할 수 있다", file=sys.stderr)
        return 1
    problems = save_readiness(page, args)
    if problems:
        print("임시저장을 거절했다:", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        return 1
    before = page.js(save_count_js())
    if before is None:
        print("임시저장 개수를 읽지 못해 저장하지 않는다", file=sys.stderr)
        return 1
    # JS의 `.click()`은 저장되지 않는다. 사람이 누른 것으로 인정되는 마우스 이벤트를 쓴다.
    if not click_button(page, "저장"):
        print("저장 버튼을 찾지 못했다", file=sys.stderr)
        return 1

    for _ in range(25):
        time.sleep(1)
        after = page.js(save_count_js())
        if after is not None and after > before:
            print(f"임시저장했다. 저장된 글이 {before} 에서 {after} 로 늘었다")
            return 0
    print("저장 버튼은 눌렀지만 저장된 글 수가 늘지 않았다. 확인이 필요하다.", file=sys.stderr)
    return 1


def save_count_js() -> str:
    """임시저장된 글 수를 별도 버튼의 aria-label에서 읽는 JS를 돌려준다."""
    # raw 문자열을 써야 선택자의 따옴표가 풀려 JS 문법 오류가 나지 않는다.
    return r'''(() => {
  const b = document.querySelector('[aria-label*="임시저장된 글 보기"]');
  if (!b) return null;
  const m = (b.getAttribute("aria-label") || b.innerText).match(/(\d+)/);
  return m ? Number(m[1]) : null;
})()'''


def cmd_state(page: Page, args: argparse.Namespace) -> int:
    """편집기에 실제로 들어간 것을 읽어 낸다."""
    body = [text for text in map(normalize, paragraphs(page, BODY_SELECTOR)) if text]
    if not open_settings(page):
        print("카테고리와 태그 상태를 읽을 수 없다", file=sys.stderr)
        return 1
    settings = settings_state(page)
    if not close_settings(page):
        print("상태를 읽은 뒤 발행 설정을 닫지 못했다", file=sys.stderr)
        return 1
    state = {
        "targetId": args.target_id,
        "docTitle": page.js("document.title"),
        "title": normalize("".join(paragraphs(page, TITLE_SELECTOR))),
        # JS의 length는 이모지를 둘로 세므로 초안과 같은 셈법으로 Python에서 센다.
        "bodyLines": len(body),
        "bodyChars": sum(map(len, body)),
        "images": image_count(page),
        "fitImages": page.js(
            "document.querySelectorAll('.se-component.se-image .se-component-content-fit').length"
        )
        or 0,
        "stickers": component_count(page, "sticker"),
        "maps": component_count(page, "placesMap"),
        "category": settings.get("category", ""),
        "tags": settings.get("tags", []),
        "savedCount": page.js(save_count_js()),
    }
    print(json.dumps(state, ensure_ascii=False))
    return 0
