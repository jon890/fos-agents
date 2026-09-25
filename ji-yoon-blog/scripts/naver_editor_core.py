"""네이버 편집기 자동화가 함께 쓰는 초안 상태와 화면 조작을 제공한다."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
from pathlib import Path

from cdp import Page

sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[1] / ".claude/skills/naver-blog-draft/scripts"),
)
from draft_contract import validate as validate_draft  # noqa: E402

TITLE_SELECTOR = ".se-documentTitle .se-text-paragraph"
BODY_SELECTOR = ".se-component.se-text .se-text-paragraph"
PROGRESS_KEY = "ji-yoon-blog/editor-progress"
STAGES = ("fill", "photos", "components", "settings")

# 이모지와 그것을 잇는 변형 선택자, 피부색, ZWJ 를 한 덩어리로 잡는다.
EMOJI_RUN = re.compile("([\U0001F000-\U0001FAFF\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u200D]+)")
STEP_SECONDS = 3.0
# 글자가 화면에 보인 뒤에도 편집기가 받아들이기까지 시간이 걸린다.
# 그 전에 Enter 를 누르면 새 문단이 생기지 않고 다음 줄이 앞 줄을 덮어쓴다.
# 실측으로 0.05초에서는 한 번에 1~2줄이 빠졌고 0.1초부터 빠지지 않았다. 여유를 둔다.
SETTLE_SECONDS = 0.15


def load_draft(args: argparse.Namespace) -> bool:
    """브라우저를 열기 전에 초안 계약을 검사한다."""
    try:
        raw = Path(args.draft).read_bytes()
        draft = json.loads(raw)
    except (OSError, ValueError) as exc:
        print(f"초안을 읽지 못했다: {exc}", file=sys.stderr)
        return False
    if not isinstance(draft, dict):
        print("초안은 JSON 객체여야 한다", file=sys.stderr)
        return False
    problems = validate_draft(draft)
    if problems:
        print("초안 계약이 맞지 않아 에디터를 열거나 고치지 않는다:", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        print("지융에게 협찬 여부와 장소를 확인하고 새 형식으로 초안을 다시 만든다.", file=sys.stderr)
        return False
    args.draft_data = draft
    args.draft_hash = hashlib.sha256(raw).hexdigest()
    return True


def progress(page: Page) -> dict:
    raw = page.js(f"sessionStorage.getItem({json.dumps(PROGRESS_KEY)})")
    try:
        return json.loads(raw) if raw else {}
    except ValueError:
        return {}


def set_stage(page: Page, args: argparse.Namespace, stage: str, passed: bool) -> None:
    """같은 탭과 같은 초안의 단계 결과만 다음 명령에 넘긴다."""
    current = progress(page)
    if current.get("draftHash") != args.draft_hash:
        current = {"draftHash": args.draft_hash, "passed": []}
    passed_stages = set(current.get("passed", []))
    if not passed:
        passed_stages.difference_update(STAGES[STAGES.index(stage) :])
    else:
        passed_stages.add(stage)
    current["passed"] = [item for item in STAGES if item in passed_stages]
    page.js(
        f"sessionStorage.setItem({json.dumps(PROGRESS_KEY)}, {json.dumps(json.dumps(current))})"
    )


def mouse_click(page: Page, finder: str) -> bool:
    """JS 식이 찾은 요소의 가운데를 마우스로 누른다.

    편집기와 Chrome 은 JS의 `.click()`을 사람이 누른 것으로 보지 않는다.
    저장 버튼과 사진 버튼도 CDP 마우스 이벤트를 써야 동작했다.
    """
    box = page.js(
        f'''(() => {{
  const el = {finder};
  if (!el) return null;
  el.scrollIntoView({{behavior: "instant", block: "center"}});
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return JSON.stringify({{x: r.left + r.width / 2, y: r.top + r.height / 2}});
}})()'''
    )
    if not box:
        return False
    spot = json.loads(box)
    for kind in ("mousePressed", "mouseReleased"):
        page.call(
            "Input.dispatchMouseEvent",
            type=kind,
            x=spot["x"],
            y=spot["y"],
            button="left",
            clickCount=1,
        )
    return True


def click(page: Page, selector: str) -> bool:
    """선택자가 가리키는 자리를 눌러 초점을 준다."""
    return mouse_click(page, f"document.querySelector({json.dumps(selector)})")


def button_finder(scope: str, text: str) -> str:
    """`scope` 안에서 글자가 정확히 `text` 인 버튼을 찾는 JS 식을 돌려준다."""
    return (
        f"[...document.querySelectorAll({json.dumps(scope)})]"
        f".find(b => b.innerText.trim() === {json.dumps(text)})"
    )


def click_button(page: Page, text: str) -> bool:
    """글자가 정확히 그것인 버튼을 마우스로 누른다.

    클래스 이름에는 바뀌는 해시가 붙으므로 글자로 찾는다.
    """
    return mouse_click(page, button_finder("button", text))


def clear_field(page: Page) -> None:
    """지금 초점이 있는 곳의 글자를 지운다."""
    # 홈서버 Chrome 은 Linux 라 전체 선택이 Control 이다.
    for kind in ("rawKeyDown", "keyUp"):
        page.call(
            "Input.dispatchKeyEvent",
            type=kind,
            key="a",
            code="KeyA",
            windowsVirtualKeyCode=65,
            nativeVirtualKeyCode=65,
            modifiers=2,
        )
    page.press("Delete", "Delete", 46)


def image_placeholder(block: dict) -> str:
    """사진 블록의 자리표시 글을 만든다."""
    name = Path(block.get("path", "")).name or "이름 없는 사진"
    return f"[사진 자리: {name}]"


def sticker_placeholder(block: dict) -> str:
    """실제 스티커로 바꿀 자리표시 글을 만든다."""
    label = block.get("label") or block.get("purpose") or block.get("stickerCode", "")
    return f"[스티커 자리: {label}]"


def map_placeholder(block: dict) -> str:
    """실제 지도 카드로 바꿀 자리표시 글을 만든다."""
    name = block.get("name", "")
    address = block.get("address", "")
    return f"[장소 자리: {name} | {address}]"


def body_lines(draft: dict) -> list[str]:
    """초안 블록을 편집기에 넣을 줄 목록으로 편다."""
    lines: list[str] = []
    for block in draft.get("blocks", []):
        kind = block.get("type")
        if kind == "text":
            lines.extend(block.get("lines", []))
            lines.append("")
        elif kind == "image":
            lines.append(image_placeholder(block))
        elif kind == "map":
            lines.append(map_placeholder(block))
        elif kind == "sticker":
            lines.append(sticker_placeholder(block))
    while lines and not lines[-1]:
        lines.pop()
    return lines


def blocking_popup(page: Page) -> str:
    """화면을 덮고 있는 알림의 글을 돌려준다. 없으면 빈 문자열이다."""
    return (
        page.js(
            '''(() => {
  const dim = [...document.querySelectorAll("[class*=popup-dim]")].find(e => {
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 100 && s.display !== "none" && s.visibility !== "hidden";
  });
  if (!dim) return "";
  const box = document.querySelector(".se-popup-container, [role=dialog]");
  return box ? box.innerText.replace(/\\s+/g, " ").trim().slice(0, 120) : "알림";
})()'''
        )
        or ""
    )


def dismiss_popup(page: Page, button: str) -> bool:
    """알림의 버튼 하나를 마우스로 누른다."""
    return mouse_click(page, button_finder(".se-popup button, [role=dialog] button", button))


def require_clear_screen(page: Page) -> str:
    """화면을 덮은 알림이 있으면 그 글을 돌려준다. 없으면 빈 문자열이다."""
    for _ in range(3):
        note = blocking_popup(page)
        if not note:
            return ""
        time.sleep(0.5)
    return blocking_popup(page)


def emoji_split(text: str) -> list[str]:
    """글자와 이모지를 나눠 넣을 조각 목록을 돌려준다."""
    return [part for part in EMOJI_RUN.split(text) if part]


def normalize(text: str) -> str:
    """편집기가 바꿔 넣는 공백 문자를 되돌려 초안과 견줄 수 있게 한다."""
    return text.replace("\u00a0", " ").replace("\u200b", "").replace("\ufeff", "").strip()


def normalize_place_address(text: str) -> str:
    """네이버가 덧붙이는 국가명과 경기도의 약칭 차이를 맞춘다."""
    address = " ".join(normalize(text).split()).removeprefix("대한민국 ")
    if address.startswith("경기 "):
        address = "경기도 " + address[len("경기 ") :]
    return address


def paragraphs(page: Page, selector: str) -> list[str]:
    """선택자에 걸리는 문단의 글을 차례대로 읽는다.

    빈 칸의 `제목` 같은 안내 문구는 실제 글이 아니므로 제외한다.
    """
    raw = page.js(
        f"JSON.stringify([...document.querySelectorAll({json.dumps(selector)})]"
        ".map(e => { const c = e.cloneNode(true);"
        " c.querySelectorAll('.se-placeholder').forEach(x => x.remove());"
        " return c.textContent; }))"
    )
    return json.loads(raw or "[]")


def focus(page: Page, selector: str, scope: str, tries: int = 10) -> bool:
    """선택자 자리를 눌러 커서가 scope 안에 들어간 것을 확인한다.

    화면을 막 연 직후 편집기가 본문으로 초점을 옮길 수 있다.
    누른 뒤에도 커서가 지정한 자리에 있는지 확인하고 아니면 다시 누른다.
    """
    inside = (
        "(() => { const n = getSelection().anchorNode;"
        " const e = n && (n.nodeType === 1 ? n : n.parentElement);"
        f" return !!(e && e.closest({json.dumps(scope)})); }})()"
    )
    for _ in range(tries):
        if not click(page, selector):
            return False
        time.sleep(0.3)
        if page.js(inside):
            return True
    return False


def wait_until(check, seconds: float = STEP_SECONDS) -> bool:
    """check 가 참이 될 때까지 짧게 거듭 본다.

    시간 안에 참이 되지 않으면 호출자가 화면 대조 결과로 실패를 판정한다.
    """
    deadline = time.monotonic() + seconds
    while True:
        if check():
            return True
        if time.monotonic() >= deadline:
            return False
        time.sleep(0.05)


def type_line(page: Page, selector: str, text: str) -> None:
    """커서가 있는 마지막 문단에 한 줄을 넣고 반영될 때까지 기다린다.

    한꺼번에 넣으면 여러 줄이 빠질 수 있고, 이모지가 든 줄은 앞 글자가 사라질 수 있다.
    글자와 이모지를 나눠 넣고 조각마다 화면에 들어왔는지 확인한다.
    """
    typed = ""
    for part in emoji_split(text):
        page.type_text(part)
        typed += part
        want = normalize(typed)
        wait_until(lambda: normalize((paragraphs(page, selector) or [""])[-1]) == want)
        time.sleep(SETTLE_SECONDS)


def new_paragraph(page: Page, selector: str) -> None:
    """Enter 를 누르고 문단이 하나 늘어날 때까지 기다린다."""
    count = len(paragraphs(page, selector))
    page.enter()
    wait_until(lambda: len(paragraphs(page, selector)) > count)


def body_mismatch(want: list[str], got: list[str]) -> str:
    """초안 줄과 화면 문단을 견줘 처음 어긋난 자리를 돌려준다."""
    for index, (wanted, actual) in enumerate(zip(want, got)):
        if wanted != actual:
            return f"{index + 1}번째 줄이 다르다. 초안 {wanted!r}, 화면 {actual!r}"
    if len(want) != len(got):
        return f"줄 수가 다르다. 초안 {len(want)}줄, 화면 {len(got)}줄"
    return ""


def focus_placeholder(page: Page, text: str) -> bool:
    """본문에서 자리표시 문단을 찾아 초점을 두고 글자를 지운다."""
    finder = (
        f"[...document.querySelectorAll({json.dumps(BODY_SELECTOR)})]"
        f".filter(e => {{ const value = e.textContent.trim();"
        f" return value === {json.dumps(text)} ||"
        f" ({json.dumps(text)}.startsWith(value) && value.length >= {len(text) - 10}); }})"
    )
    matches = json.loads(
        page.js(
            f"JSON.stringify({finder}.map(e => ({{id:e.id, text:e.textContent.trim()}})))"
        )
        or "[]"
    )
    if len(matches) != 1 or not matches[0]["id"]:
        return False
    element_id = matches[0]["id"]
    remaining = matches[0]["text"]
    element = f"document.getElementById({json.dumps(element_id)})"

    def click_end() -> bool:
        spot = page.js(
            f'''(() => {{
  const el = {element};
  if (!el) return null;
  el.scrollIntoView({{behavior: "instant", block: "center"}});
  const range = document.createRange();
  range.selectNodeContents(el);
  const rects = range.getClientRects();
  const rect = rects[rects.length - 1];
  if (!rect) return null;
  return JSON.stringify({{x: rect.right + 4, y: rect.top + rect.height / 2}});
}})()'''
        )
        if not spot:
            return False
        point = json.loads(spot)
        for kind in ("mousePressed", "mouseReleased"):
            page.call(
                "Input.dispatchMouseEvent",
                type=kind,
                x=point["x"],
                y=point["y"],
                button="left",
                clickCount=1,
            )
        return bool(
            page.js(
                "(() => { const s = getSelection(); const n = s.anchorNode;"
                f" return n?.nodeType === 3 && n.parentElement.closest({json.dumps(BODY_SELECTOR)})?.id === {json.dumps(element_id)}"
                " && s.anchorOffset === n.textContent.length; })()"
            )
        )

    if not click_end():
        return False
    # JS Range로 선택해 지우면 편집기 내부 커서와 어긋날 수 있다.
    # 실제 키 입력으로 끝에서 지우고, 매번 줄이 짧아졌는지 확인한다.
    for _ in range(len(remaining) * 2):
        current = page.js(f"{element}?.textContent") or ""
        if not current:
            return True
        if len(current) > len(remaining) or not remaining.startswith(current):
            return False
        if not click_end():
            return False
        page.press("Backspace", "Backspace", 8)
        if not wait_until(lambda: len(page.js(f"{element}?.textContent") or "") < len(current)):
            return False
        time.sleep(SETTLE_SECONDS)
    return False


def component_count(page: Page, kind: str) -> int:
    """본문의 SmartEditor 구성요소 수를 읽는다."""
    return page.js(f'document.querySelectorAll(".se-component.se-{kind}").length') or 0
