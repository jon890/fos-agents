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
| 사진 | 넣지 못한다. 자리 표시만 남긴다 |
| 태그 | 넣지 못한다. 발행 설정 레이어에만 입력란이 있다 |

발행하지 않는다. `저장` 만 누른다.

사용법:
    python3 naver_editor.py open
    python3 naver_editor.py fill drafts/순돌이곱창/draft.json
    python3 naver_editor.py save
    python3 naver_editor.py state

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
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from cdp import CdpError, Page, http_json  # noqa: E402

BLOG_ID = os.environ.get("JI_YOON_BLOG_BLOG_ID", "mywldbs")
WRITE_URL = f"https://blog.naver.com/PostWriteForm.naver?blogId={BLOG_ID}"
WRITE_MARK = "PostWriteForm.naver"

TITLE_SELECTOR = ".se-documentTitle .se-text-paragraph"
BODY_SELECTOR = ".se-component.se-text .se-text-paragraph"


def click(page: Page, selector: str) -> bool:
    """선택자가 가리키는 자리를 눌러 초점을 준다."""
    box = page.js(
        f'''(() => {{
  const el = document.querySelector({json.dumps(selector)});
  if (!el) return null;
  el.scrollIntoView({{block: "center"}});
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
            lines.append(f"[장소 자리: {block.get('address', '')}]")
        elif kind == "sticker":
            lines.append(f"[스티커 자리: {block.get('emoji', '')}]")
    while lines and not lines[-1]:
        lines.pop()
    return lines


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
    """알림의 버튼 하나를 누른다."""
    return bool(
        page.js(
            f'''(() => {{
  const want = {json.dumps(button)};
  const b = [...document.querySelectorAll(".se-popup button, [role=dialog] button")]
    .find(b => b.innerText.trim() === want);
  if (!b) return false;
  b.click();
  return true;
}})()'''
        )
    )


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
    page.call("Page.navigate", url=WRITE_URL)
    for _ in range(40):
        time.sleep(1)
        title = page.js("document.title") or ""
        if "네이버 블로그" in title and page.js(
            f'!!document.querySelector({json.dumps(TITLE_SELECTOR)})'
        ):
            # 앞서 쓰던 글이 있으면 `이어서 작성하시겠습니까?` 알림이 화면을 덮는다.
            # 그 알림을 치우지 않으면 클릭이 닿지 않는데 화면은 멀쩡해 보인다. 실측이다.
            note = blocking_popup(page)
            if note:
                choice = "확인" if args.resume else "취소"
                if not dismiss_popup(page, choice):
                    print(f"알림을 치우지 못했다: {note}", file=sys.stderr)
                    return 1
                time.sleep(1)
                print(f"이전 글 알림을 `{choice}` 로 지났다")
            print(f"글쓰기 화면을 열었다: {title}")
            return 0
        if "NAVER 로그인" in title:
            print("로그인 화면으로 넘어갔다. naver_session.py 로 로그인 상태를 본다.", file=sys.stderr)
            return 1
    print("글쓰기 화면이 뜨지 않았다", file=sys.stderr)
    return 1


def cmd_fill(page: Page, args: argparse.Namespace) -> int:
    """초안의 제목과 본문을 넣는다."""
    draft = json.loads(Path(args.draft).read_text(encoding="utf-8"))
    title = draft.get("title")
    if not title:
        print("초안에 `title` 이 없다. 제목을 먼저 고른다.", file=sys.stderr)
        return 1

    note = require_clear_screen(page)
    if note:
        print(f"화면을 덮은 알림이 있어 글자를 넣지 못한다: {note}", file=sys.stderr)
        print("`open` 을 다시 불러 알림을 지난 뒤 다시 넣는다.", file=sys.stderr)
        return 1

    if not click(page, TITLE_SELECTOR):
        print("제목 자리를 찾지 못했다", file=sys.stderr)
        return 1
    clear_field(page)
    page.type_text(title)

    if not click(page, BODY_SELECTOR):
        print("본문 자리를 찾지 못했다", file=sys.stderr)
        return 1
    clear_field(page)
    lines = body_lines(draft)
    for index, line in enumerate(lines):
        if line:
            page.type_text(line)
        if index != len(lines) - 1:
            page.enter()

    # 넣었다고 말하기 전에 화면에서 읽어 확인한다.
    landed = page.js(
        f'(document.querySelector({json.dumps(TITLE_SELECTOR)}) || {{}}).innerText || ""'
    )
    if (landed or "").strip() != title.strip():
        print(f"제목이 들어가지 않았다. 화면에 있는 것: {landed!r}", file=sys.stderr)
        return 1

    print(f"제목과 본문 {len(lines)}줄을 넣었다")
    tags = draft.get("tags") or []
    if tags:
        print(f"태그 {len(tags)}개는 넣지 못했다. 발행 설정 레이어에만 입력란이 있다.")
        print("  " + ", ".join(tags))
    return 0


PHOTO_BUTTON = "button.se-image-toolbar-button"


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

    pressed = page.js(
        "(() => { const b = document.querySelector("
        + json.dumps(PHOTO_BUTTON)
        + "); if (!b) return false; b.click(); return true; })()"
    )
    if not pressed:
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


def cmd_photos(page: Page, args: argparse.Namespace) -> int:
    """초안의 사진을 편집기에 넣는다."""
    draft_path = Path(args.draft)
    draft = json.loads(draft_path.read_text(encoding="utf-8"))
    files = photo_paths(draft, draft_path.parent, args.remote_base)
    if not files:
        print("초안에 image 블록이 없다", file=sys.stderr)
        return 1

    note = require_clear_screen(page)
    if note:
        print(f"화면을 덮은 알림이 있어 사진을 넣지 못한다: {note}", file=sys.stderr)
        return 1

    before = image_count(page)
    problem = attach_photos(page, files)
    if problem:
        print(problem, file=sys.stderr)
        return 1

    for _ in range(60):
        time.sleep(1)
        after = image_count(page)
        if after > before:
            print(f"사진 {after - before}개가 본문에 들어갔다. 넣은 파일은 {len(files)}개다")
            return 0
    print("파일은 넣었지만 본문에 이미지 블록이 생기지 않았다", file=sys.stderr)
    return 1


def cmd_save(page: Page, args: argparse.Namespace) -> int:
    """임시저장한다. 발행 버튼은 누르지 않는다."""
    before = page.js(save_count_js())
    pressed = page.js(
        '''(() => {
  const b = [...document.querySelectorAll("button")]
    .find(b => b.innerText.trim() === "저장");
  if (!b) return false;
  b.click();
  return true;
})()'''
    )
    if not pressed:
        print("저장 버튼을 찾지 못했다", file=sys.stderr)
        return 1

    for _ in range(20):
        time.sleep(1)
        after = page.js(save_count_js())
        if after is not None and before is not None and after > before:
            print(f"임시저장했다. 저장된 글 {before} 에서 {after} 로 늘었다")
            return 0
    print("저장 버튼은 눌렀지만 저장된 글 수가 늘지 않았다. 확인이 필요하다.", file=sys.stderr)
    return 1


def save_count_js() -> str:
    """임시저장된 글 수를 읽는 JS 를 돌려준다.

    그 숫자는 `저장` 버튼 안이 아니라 옆에 붙은 별도 버튼에 있다.
    클래스 이름에 해시가 붙어 바뀌므로 aria-label 로 찾는다.
    """
    return '''(() => {
  const b = document.querySelector("[aria-label*=\"임시저장된 글 보기\"]");
  if (!b) return null;
  const m = (b.getAttribute("aria-label") || b.innerText).match(/(\\d+)/);
  return m ? Number(m[1]) : null;
})()'''


def cmd_state(page: Page, args: argparse.Namespace) -> int:
    """편집기에 실제로 들어간 것을 읽어 낸다."""
    state = page.js(
        f'''JSON.stringify({{
  docTitle: document.title,
  title: (document.querySelector({json.dumps(TITLE_SELECTOR)}) || {{}}).innerText || "",
  bodyLines: [...document.querySelectorAll({json.dumps(BODY_SELECTOR)})]
    .map(e => e.innerText).filter(t => t.trim()).length,
  savedCount: (() => {{
    const b = document.querySelector("[aria-label*=\\"임시저장된 글 보기\\"]");
    if (!b) return null;
    const m = (b.getAttribute("aria-label") || b.innerText).match(/(\\d+)/);
    return m ? Number(m[1]) : null;
  }})()
}})'''
    )
    print(state)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="네이버 글쓰기 화면에 초안을 넣는다")
    sub = parser.add_subparsers(dest="command", required=True)
    opener = sub.add_parser("open", help="글쓰기 화면을 연다")
    opener.add_argument(
        "--resume", action="store_true", help="앞서 쓰던 글이 있으면 이어서 쓴다"
    )
    fill = sub.add_parser("fill", help="초안의 제목과 본문을 넣는다")
    fill.add_argument("draft", help="draft.json 경로")
    photos = sub.add_parser("photos", help="초안의 사진을 편집기에 넣는다")
    photos.add_argument("draft", help="draft.json 경로")
    photos.add_argument(
        "--remote-base",
        default="",
        help="브라우저가 도는 기계에서 사진이 있는 디렉터리. 비우면 초안 옆 경로를 쓴다",
    )
    sub.add_parser("save", help="임시저장한다")
    sub.add_parser("state", help="편집기에 들어간 것을 읽어 낸다")

    args = parser.parse_args()
    handlers = {
        "open": cmd_open,
        "fill": cmd_fill,
        "photos": cmd_photos,
        "save": cmd_save,
        "state": cmd_state,
    }

    try:
        tabs = [t for t in http_json("/json/list") if t.get("type") == "page"]
        target = next((t for t in tabs if WRITE_MARK in t.get("url", "")), None)
        if target is None:
            if args.command != "open":
                print(f"글쓰기 화면을 연 탭이 없다. 먼저 `open` 을 부른다.", file=sys.stderr)
                return 1
            target = tabs[0] if tabs else None
            if target is None:
                print("열린 탭이 없다. naver_session.py 로 브라우저를 먼저 띄운다.", file=sys.stderr)
                return 2
        page = Page(target["webSocketDebuggerUrl"])
    except (CdpError, OSError) as exc:
        print(f"브라우저에 붙지 못했다: {exc}", file=sys.stderr)
        return 2

    try:
        return handlers[args.command](page, args)
    except CdpError as exc:
        print(exc, file=sys.stderr)
        return 2
    finally:
        page.close()


if __name__ == "__main__":
    raise SystemExit(main())
