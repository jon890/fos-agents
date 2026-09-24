"""초안을 네이버 글쓰기 화면에 넣고 임시저장한다.

홈서버의 상주 Chrome 에 CDP 로 붙어 사람이 치는 것과 같은 경로로 글자를 넣는다.
상주 Chrome 을 띄우고 로그인을 판정하는 것은 `naver_session.py` 가 소유한다.
맥북에서 부를 때는 포트 포워딩이 떠 있어야 한다.

    ssh -L 9222:127.0.0.1:9222 <홈서버>

넣는 것과 넣지 못하는 것이 갈린다. 실측이다.

| 항목 | 임시저장으로 |
| --- | --- |
| 제목 | 넣는다 |
| 본문 글자 | 넣는다 |
| 사진 | 초안의 자리마다 넣고 `문서 너비`를 적용한다 |
| 스티커와 지도 | 초안의 자리마다 실제 편집기 구성요소로 넣는다 |
| 카테고리와 태그 | 발행 설정에서 넣고 설정을 닫는다. 발행하지 않는다 |

발행하지 않는다. `저장` 만 누른다.

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
import hashlib
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from cdp import HOST, PORT, CdpError, Page, http_json  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".claude/skills/naver-blog-draft/scripts"))
from draft_contract import STICKER_CODES, validate as validate_draft  # noqa: E402

BLOG_ID = os.environ.get("JI_YOON_BLOG_BLOG_ID", "mywldbs")
WRITE_URL = f"https://blog.naver.com/PostWriteForm.naver?blogId={BLOG_ID}"
WRITE_MARK = "PostWriteForm.naver"

TITLE_SELECTOR = ".se-documentTitle .se-text-paragraph"
BODY_SELECTOR = ".se-component.se-text .se-text-paragraph"

STICKER_BUTTON = "button.se-sticker-toolbar-button"
PLACE_BUTTON = "button.se-map-toolbar-button"
PUBLISH_SETTINGS_BUTTON = 'button[data-click-area="tpb.publish"]'
PROGRESS_KEY = "ji-yoon-blog/editor-progress"
STAGES = ("fill", "photos", "components", "settings")


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
        passed_stages.difference_update(STAGES[STAGES.index(stage):])
    else:
        passed_stages.add(stage)
    current["passed"] = [item for item in STAGES if item in passed_stages]
    page.js(f"sessionStorage.setItem({json.dumps(PROGRESS_KEY)}, {json.dumps(json.dumps(current))})")


def close_tab(target_id: str) -> None:
    """정확한 탭 하나를 닫는다. CDP의 응답은 JSON이 아닌 일반 문자열이다."""
    with urllib.request.urlopen(
        f"http://{HOST}:{PORT}/json/close/{urllib.parse.quote(target_id)}",
        timeout=10,
    ):
        pass


def mouse_click(page: Page, finder: str) -> bool:
    """JS 식이 찾은 요소의 가운데를 마우스로 누른다. 찾지 못하거나 보이지 않으면 거짓이다.

    편집기와 Chrome 은 JS 의 `.click()` 을 사람이 누른 것으로 보지 않는다.
    저장 버튼은 그 클릭을 받지 않았고, 사진 버튼은 파일 선택 창을 열지 않았다. 실측이다.
    그래서 누르는 것은 모두 CDP 의 `Input.dispatchMouseEvent` 로 한다.
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

    클래스 이름에 해시가 붙어 바뀌므로 글자로 찾는다.
    """
    return mouse_click(page, button_finder("button", text))


def clear_field(page: Page) -> None:
    """지금 초점이 있는 곳의 글자를 지운다."""
    # 홈서버 Chrome 은 Linux 라 전체 선택이 Control 이다
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


def body_lines(draft: dict) -> list[str]:
    """초안 블록을 편집기에 넣을 줄 목록으로 편다."""
    lines: list[str] = []
    for block in draft.get("blocks", []):
        kind = block.get("type")
        if kind == "text":
            lines.extend(block.get("lines", []))
            lines.append("")
        elif kind == "image":
            name = Path(block.get("path", "")).name or "이름 없는 사진"
            lines.append(f"[사진 자리: {name}]")
        elif kind == "map":
            lines.append(map_placeholder(block))
        elif kind == "sticker":
            lines.append(sticker_placeholder(block))
    while lines and not lines[-1]:
        lines.pop()
    return lines


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


def blocking_popup(page: Page) -> str:
    """화면을 덮고 있는 알림의 글을 돌려준다. 없으면 빈 문자열이다."""
    return page.js(
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
    ) or ""


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


def cmd_open(page: Page, args: argparse.Namespace) -> int:
    """글쓰기 화면을 연다."""
    for _ in range(40):
        time.sleep(1)
        title = page.js("document.title") or ""
        if "네이버 블로그" in title and page.js(
            f'!!document.querySelector({json.dumps(TITLE_SELECTOR)})'
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


# 이모지와 그것을 잇는 변형 선택자, 피부색, ZWJ 를 한 덩어리로 잡는다.
EMOJI_RUN = re.compile("([\U0001F000-\U0001FAFF\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u200D]+)")
STEP_SECONDS = 3.0
# 글자가 화면에 보인 뒤에도 편집기가 받아들이기까지 시간이 걸린다.
# 그 전에 Enter 를 누르면 새 문단이 생기지 않고 다음 줄이 앞 줄을 덮어쓴다.
# 실측으로 0.05초에서는 한 번에 1~2줄이 빠졌고 0.1초부터 빠지지 않았다. 여유를 둔다.
SETTLE_SECONDS = 0.15


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
        address = "경기도 " + address[len("경기 "):]
    return address


def paragraphs(page: Page, selector: str) -> list[str]:
    """선택자에 걸리는 문단의 글을 차례대로 읽는다.

    빈 칸은 `제목` 같은 안내 문구를 `.se-placeholder` 로 띄운다. 그것은 글이 아니므로 빼고 읽는다.
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

    화면을 막 연 직후에는 편집기가 스스로 본문에 초점을 옮긴다.
    그 전에 제목을 눌러 두면 초점을 빼앗겨 제목 글자가 본문에 들어가고, 이어서 본문을 지울 때 함께 사라진다. 실측이다.
    그래서 누른 뒤 잠깐 두고 커서가 아직 그 자리에 있는지 본다. 없으면 다시 누른다.
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

    시간이 지나도 참이 되지 않으면 그대로 넘어간다. 빠진 것은 `fill` 끝의 대조가 잡는다.
    """
    deadline = time.monotonic() + seconds
    while True:
        if check():
            return True
        if time.monotonic() >= deadline:
            return False
        time.sleep(0.05)


def type_line(page: Page, selector: str, text: str) -> None:
    """커서가 있는 마지막 문단에 한 줄을 넣고 편집기에 반영될 때까지 기다린다.

    한꺼번에 몰아 넣으면 편집기가 여러 줄을 통째로 놓친다.
    이모지가 든 줄을 한 번에 넣으면 이모지만 남고 앞의 글자가 사라진다.
    그래서 글자와 이모지를 나눠 넣고, 조각마다 화면에 들어온 것을 보고 잠깐 더 기다린 뒤 다음으로 간다.
    모두 실측이다.
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
    """초안 줄과 화면 문단을 견줘 처음 어긋난 자리를 돌려준다. 같으면 빈 문자열이다."""
    for index, (w, g) in enumerate(zip(want, got)):
        if w != g:
            return f"{index + 1}번째 줄이 다르다. 초안 {w!r}, 화면 {g!r}"
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
    matches = json.loads(page.js(f"JSON.stringify({finder}.map(e => ({{id:e.id, text:e.textContent.trim()}})))") or "[]")
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
        return bool(page.js(
            "(() => { const s = getSelection(); const n = s.anchorNode;"
            f" return n?.nodeType === 3 && n.parentElement.closest({json.dumps(BODY_SELECTOR)})?.id === {json.dumps(element_id)}"
            " && s.anchorOffset === n.textContent.length; })()"
        ))

    if not click_end():
        return False
    # JS Range 로 선택해 Delete 하면 편집기 내부 커서와 어긋나 일부 글자만 지워진다.
    # 실제 키 입력으로 끝에서 지우고, 커서가 튀어 멈추면 끝을 다시 누른다.
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


def cmd_fill(page: Page, args: argparse.Namespace) -> int:
    """초안의 제목과 본문을 넣는다."""
    draft = args.draft_data
    set_stage(page, args, "fill", False)
    title = draft.get("title")
    if not title:
        print("초안에 `title` 이 없다. 제목을 먼저 고른다.", file=sys.stderr)
        return 1

    note = require_clear_screen(page)
    if note:
        print(f"화면을 덮은 알림이 있어 글자를 넣지 못한다: {note}", file=sys.stderr)
        print("`open` 을 다시 불러 알림을 지난 뒤 다시 넣는다.", file=sys.stderr)
        return 1

    if not focus(page, TITLE_SELECTOR, ".se-documentTitle"):
        print("제목 자리에 커서를 두지 못했다", file=sys.stderr)
        return 1
    clear_field(page)
    type_line(page, TITLE_SELECTOR, title)

    if not focus(page, BODY_SELECTOR, ".se-component.se-text"):
        print("본문 자리에 커서를 두지 못했다", file=sys.stderr)
        return 1
    clear_field(page)
    lines = body_lines(draft)
    for index, line in enumerate(lines):
        if line:
            type_line(page, BODY_SELECTOR, line)
        if index != len(lines) - 1:
            new_paragraph(page, BODY_SELECTOR)

    # 넣었다고 말하기 전에 화면에서 읽어 확인한다.
    # 제목만 보면 본문이 절반 넘게 빠져도 0 으로 끝난다. 실측이다. 그래서 본문도 줄마다 견준다.
    landed = normalize("".join(paragraphs(page, TITLE_SELECTOR)))
    if landed != normalize(title):
        print(f"제목이 들어가지 않았다. 화면에 있는 것: {landed!r}", file=sys.stderr)
        return 1

    want = [normalize(line) for line in lines if normalize(line)]
    got = [text for text in map(normalize, paragraphs(page, BODY_SELECTOR)) if text]
    wrong = body_mismatch(want, got)
    if wrong:
        print(
            f"본문이 초안과 다르다. 초안 {len(want)}줄 {sum(map(len, want))}자,"
            f" 화면 {len(got)}줄 {sum(map(len, got))}자",
            file=sys.stderr,
        )
        print(wrong, file=sys.stderr)
        return 1

    print(f"제목과 본문 {len(want)}줄 {sum(map(len, want))}자를 넣었다. 초안과 같다")
    set_stage(page, args, "fill", True)
    return 0


PHOTO_BUTTON = "button.se-image-toolbar-button"
# `사진 첨부 방식` 창의 `개별사진`. `button` 이 아니라 `input[type=button]` 이다.
LAYOUT_EACH = "#image-type-list"


def attach_photos(page: Page, files: list[str], seconds: float = 30.0) -> str:
    """사진 버튼을 눌러 열리는 파일 선택 창을 가로채 파일을 넣는다.

    네이버는 사진 버튼을 누를 때 숨긴 `input[type=file][multiple]` 을 그 자리에서 만든다.
    자체 업로드 창을 띄우는 것이 아니라 그 input 을 누른다. 실측이다.

    파일 선택 창이 닫히면 그 input 이 DOM 에서 사라진다.
    그래서 누른 뒤에 새로 붙어 `#hidden-file` 을 찾으면 늦다.
    `DOM.querySelector` 가 `nodeId: 0` 을 주고 파일 주입이
    `Could not find node with given id` 로 끝난다. 이것도 실측이다.

    누르는 것과 넣는 것이 한 연결 안에서 이어져야 한다.
    그래서 파일 선택 창을 가로채 그 이벤트가 주는 `backendNodeId` 로 바로 넣는다.

    files 는 브라우저가 도는 기계의 경로다. 홈서버 Chrome 이면 홈서버 경로다.
    """
    page.call("DOM.enable")
    page.call("Runtime.enable")
    page.call("Page.setInterceptFileChooserDialog", enabled=True)

    # JS 의 `.click()` 으로 누르면 파일 선택 창이 열리지 않는다.
    # Chrome 은 사용자 활성화가 있을 때만 그 창을 여는데, 그 시점에
    # `navigator.userActivation.isActive` 가 거짓이었다. 마우스 이벤트로 누르면 바로 열린다. 실측이다.
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
    return bool(page.js(
        f"[...document.querySelectorAll('.se-component.se-image')][{index}]"
        "?.querySelector('img')?.src.includes('blogfiles.pstatic.net')"
    ))


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
        lambda: bool(page.js(
            f"(() => {{ const e = document.querySelector({json.dumps(toolbar)});"
            " if (!e) return false; const r = e.getBoundingClientRect();"
            " return r.width > 0 && r.height > 0; })()"
        )),
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
    fitted = page.js('document.querySelectorAll(".se-component.se-image .se-component-content-fit").length') or 0
    if fitted != inserted:
        print(f"기존 사진 중 문서 너비가 아닌 것이 있다: 사진 {inserted}개, 적용 {fitted}개", file=sys.stderr)
        return 1
    if any(not image_uploaded(page, index) for index in range(inserted)):
        print("기존 사진 중 전송이 끝나지 않은 것이 있다. 새 탭에서 다시 시작한다", file=sys.stderr)
        return 1
    visible_lines = paragraphs(page, BODY_SELECTOR)
    for block in blocks[:inserted]:
        marker = image_placeholder(block)
        if any(marker == line or (marker.startswith(line) and len(line) >= len(marker) - 10)
               for line in visible_lines):
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
        if not wait_until(lambda: image_uploaded(page, before) or bool(blocking_popup(page)), seconds=90.0):
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


def component_count(page: Page, kind: str) -> int:
    """본문의 SmartEditor 구성요소 수를 읽는다."""
    return page.js(f'document.querySelectorAll(".se-component.se-{kind}").length') or 0


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
    mode = lambda: page.js(f'document.querySelector({json.dumps(mode_button)})?.innerText.trim()')
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
    return [item for item in place_candidates(page)
            if not item["address"].startswith("대한민국 ")]


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
        if not wait_until(lambda: page.js(f'!!document.querySelector({json.dumps(search)})')):
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
        if normalize(item["name"]) == name and normalize_place_address(item["address"]) == address
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
    wanted_stickers = [b["stickerCode"] for b in blocks if b["type"] == "sticker"]
    problems = []
    if state.get("stickers") != wanted_stickers:
        problems.append("스티커 코드나 순서가 초안과 다르다")
    wanted_maps = [
        (normalize(b["name"]), normalize_place_address(b["address"]))
        for b in blocks if b["type"] == "map"
    ]
    maps = [list(filter(None, map(normalize, text.splitlines())))
            for text in state.get("maps", [])]
    actual_maps = [(parts[0], normalize_place_address(parts[1]))
                   for parts in maps if len(parts) >= 2]
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
        " category: document.querySelector('button[data-click-area=\"tpb*i.category\"]')?.innerText.trim() || '',"
        " tags: [...document.querySelectorAll('span[id^=\"tag-item-\"][aria-label]')]"
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
    wanted_text = [normalize(line) for block in blocks if block["type"] == "text" for line in block["lines"] if normalize(line)]
    cursor = 0
    for line in body:
        if cursor < len(wanted_text) and line == wanted_text[cursor]:
            cursor += 1
    if cursor != len(wanted_text):
        problems.append(f"본문 글이 빠졌다: {cursor}/{len(wanted_text)}줄 확인")
    if any(line.startswith(("[사진 자리:", "[스티커 자리:", "[장소 자리:")) for line in body):
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
    fit = page.js("document.querySelectorAll('.se-component.se-image .se-component-content-fit').length") or 0
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

    # JS 의 `.click()` 으로는 저장되지 않는다.
    # 그 호출이 `Uncaught` 로 끝나고 저장 수도 늘지 않는다. 실측이다.
    # 편집기가 사람이 실제로 누른 것만 받으므로 마우스 이벤트로 누른다.
    if not click_button(page, "저장"):
        print("저장 버튼을 찾지 못했다", file=sys.stderr)
        return 1

    for _ in range(25):
        time.sleep(1)
        after = page.js(save_count_js())
        if after is not None and before is not None and after > before:
            print(f"임시저장했다. 저장된 글이 {before} 에서 {after} 로 늘었다")
            return 0
    print("저장 버튼은 눌렀지만 저장된 글 수가 늘지 않았다. 확인이 필요하다.", file=sys.stderr)
    return 1


def save_count_js() -> str:
    """임시저장된 글 수를 읽는 JS 를 돌려준다.

    그 숫자는 `저장` 버튼 안이 아니라 옆에 붙은 별도 버튼에 있다.
    클래스 이름에 해시가 붙어 바뀌므로 aria-label 로 찾는다.
    """
    # 일반 문자열에 `\\"` 를 쓰면 파이썬이 `"` 로 풀어 JS 가 문법 오류로 죽는다.
    # 저장 버튼을 누르기 전 개수를 읽는 자리에서 죽어 저장이 한 번도 시도되지 않았다. 실측이다.
    # 그래서 raw 문자열에 쓰고 선택자는 작은따옴표로 감싼다.
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
        # 글자 수는 초안과 같은 셈법으로 파이썬에서 센다. JS 의 length 는 이모지를 둘로 센다.
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


def main() -> int:
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

    args = parser.parse_args()
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
        tabs = [t for t in http_json("/json/list") if t.get("type") == "page"]
        if args.command == "open":
            target = http_json(
                "/json/new?" + urllib.parse.quote(WRITE_URL, safe=""), method="PUT"
            )
            args.target_id = target.get("id", "")
        else:
            if not args.target_id:
                print("기존 탭을 잘못 고르지 않도록 --target-id 를 반드시 준다", file=sys.stderr)
                return 1
            target = next((t for t in tabs if t.get("id") == args.target_id), None)
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
