"""홈서버에서 네이버 세션을 담은 Chrome 을 상주시키고 상태를 판정한다.

이 스크립트는 홈서버에서만 실행한다.
홈서버에 화면이 없으므로 Chrome 을 headless 로 띄우고 CDP 포트로만 조작한다.
맥북은 SSH 포트 포워딩으로 그 포트에 닿는다.

    ssh -L 9222:127.0.0.1:9222 <홈서버>

포트는 loopback 에만 연다.
그 포트에 닿는 쪽은 이 브라우저를 전부 조작할 수 있고, 프로필에는 네이버 로그인 쿠키가 남는다.
프로필 디렉터리를 계정 비밀번호와 같은 등급으로 다룬다.

CDP 의 HTTP 창구만 쓴다. WebSocket 을 쓰지 않으므로 의존성이 없다.
이 워크스페이스의 다른 스크립트가 모두 의존성 없는 파이썬이라 맞춘다.

사용법:
    python3 naver_session.py start
    python3 naver_session.py status
    python3 naver_session.py login-check
    python3 naver_session.py stop

종료 코드:
    0  요청한 것이 참이다. `status` 와 `login-check` 는 로그인이 살아 있다는 뜻이다
    1  브라우저는 떴지만 네이버 로그인이 없다
    2  브라우저를 띄우지 못했거나 CDP 에 닿지 못했다
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

PORT = int(os.environ.get("JI_YOON_BLOG_CDP_PORT", "9222"))
PROFILE = Path(
    os.environ.get("JI_YOON_BLOG_CHROME_PROFILE", "~/.config/ji-yoon-blog-chrome")
).expanduser()
PID_FILE = PROFILE / "chrome.pid"
BLOG_ID = os.environ.get("JI_YOON_BLOG_BLOG_ID", "mywldbs")
WRITE_URL = f"https://blog.naver.com/PostWriteForm.naver?blogId={BLOG_ID}"
LOGIN_HOST = "nid.naver.com"
LOGIN_TITLE = "NAVER 로그인"
# 로그인한 뒤의 글쓰기 화면 제목에 들어 있는 조각이다.
# 실측한 제목은 `지융로그 : 네이버 블로그` 였다.
# 로그인 화면 제목은 `NAVER 로그인` 이라 이 조각과 겹치지 않는다.
# 비우면 로그인이 살아 있다고 판정하지 않고 `판정하지 못했다` 로 끝난다.
EDITOR_TITLE = os.environ.get("JI_YOON_BLOG_EDITOR_TITLE", "네이버 블로그")
# DevTools 프런트엔드가 붙어 올 때의 origin 이다.
# 포트로 직접 여는 화면과 chrome://inspect 가 서로 다른 값을 보낸다.
ALLOWED_ORIGINS = os.environ.get(
    "JI_YOON_BLOG_CDP_ORIGINS",
    f"http://127.0.0.1:{PORT},http://localhost:{PORT},devtools://devtools",
)
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/150.0.0.0 Safari/537.36"
)

CHROME_CANDIDATES = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]


class SessionError(RuntimeError):
    """브라우저를 띄우지 못했거나 CDP 에 닿지 못했다."""


def chrome_binary() -> str:
    """쓸 수 있는 Chrome 실행 파일을 찾는다."""
    for name in CHROME_CANDIDATES:
        found = shutil.which(name)
        if found:
            return found
    raise SessionError(
        "Chrome 실행 파일을 찾지 못했다. 찾아본 이름: " + ", ".join(CHROME_CANDIDATES)
    )


def cdp(path: str, method: str = "GET", timeout: float = 5.0) -> object:
    """CDP 의 HTTP 창구를 부른다."""
    url = f"http://127.0.0.1:{PORT}{path}"
    request = urllib.request.Request(url, method=method)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read().decode("utf-8", errors="replace")
    if not body.strip():
        return {}
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return body


def is_up(timeout: float = 2.0) -> bool:
    """CDP 포트가 응답하는지 본다."""
    try:
        cdp("/json/version", timeout=timeout)
        return True
    except (urllib.error.URLError, OSError):
        return False


def wait_up(seconds: float = 25.0) -> bool:
    """CDP 포트가 응답할 때까지 기다린다."""
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if is_up(timeout=1.0):
            return True
        time.sleep(0.5)
    return False


def launch(extra: list[str]) -> subprocess.Popen:
    """Chrome 을 headless 로 띄운다."""
    PROFILE.mkdir(parents=True, exist_ok=True)
    # 프로필에 로그인 쿠키가 남으므로 본인만 읽게 한다
    PROFILE.chmod(0o700)
    command = [
        chrome_binary(),
        "--headless=new",
        f"--remote-debugging-port={PORT}",
        "--remote-debugging-address=127.0.0.1",
        f"--user-data-dir={PROFILE}",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-gpu",
        "--window-size=1280,2000",
        # headless 의 기본 UA 는 `HeadlessChrome` 을 담는다.
        # 네이버가 그 값을 보고 막을 수 있어 보통 Chrome 의 UA 로 바꾼다.
        f"--user-agent={USER_AGENT}",
        # 이 값이 없으면 Chrome 이 DevTools 의 WebSocket 을 origin 검사로 거절한다.
        # 실측으로 화면에는 `Debugging connection was closed` 만 뜨고
        # 이유는 브라우저 기록에만 남아 원인을 찾기 어렵다.
        f"--remote-allow-origins={ALLOWED_ORIGINS}",
        *extra,
        "about:blank",
    ]
    log = (PROFILE / "chrome.log").open("ab")
    return subprocess.Popen(
        command,
        stdout=log,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
        start_new_session=True,
    )


def tab_url(target_id: str) -> str:
    """탭 하나가 지금 보고 있는 주소를 돌려준다."""
    for tab in cdp("/json/list") or []:
        if tab.get("id") == target_id:
            return tab.get("url", "")
    return ""


def open_tab(url: str) -> str:
    """새 탭을 열고 그 식별자를 돌려준다."""
    path = "/json/new?" + urllib.parse.quote(url, safe="")
    # Chrome 111 부터 이 창구가 PUT 만 받는다. 옛 버전은 GET 만 받는다.
    for method in ("PUT", "GET"):
        try:
            made = cdp(path, method=method, timeout=15.0)
        except urllib.error.HTTPError:
            continue
        if isinstance(made, dict) and made.get("id"):
            return made["id"]
    raise SessionError("새 탭을 열지 못했다")


def close_tab(target_id: str) -> None:
    """탭을 닫는다. 실패해도 넘어간다."""
    try:
        cdp(f"/json/close/{target_id}")
    except (urllib.error.URLError, OSError):
        pass


def tab_state(target_id: str) -> tuple[str, str]:
    """탭의 주소와 제목을 돌려준다."""
    for tab in cdp("/json/list") or []:
        if tab.get("id") == target_id:
            return (tab.get("url", ""), tab.get("title", ""))
    return ("", "")


def login_state(seconds: float = 25.0) -> tuple[bool | None, str]:
    """글쓰기 화면을 열어 로그인 여부를 판정한다.

    네이버는 로그인 화면으로 보내는 것을 화면이 뜬 뒤에 한다.
    실측으로 그 리다이렉트가 1초 안에 올 때도 있었고 11초 뒤에 올 때도 있었다.
    그래서 주소가 잠깐 안 바뀌는 것을 로그인으로 읽지 않는다.
    창을 끝까지 기다린 뒤에만 로그인이 살아 있다고 판정한다.

    돌려주는 첫 값이 None 이면 판정하지 못한 것이다. 그때는 로그인으로 치지 않는다.
    """
    target_id = open_tab(WRITE_URL)
    url = ""
    last_title = ""
    try:
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            url, title = tab_state(target_id)
            last_title = title or last_title
            if LOGIN_HOST in url or title.strip() == LOGIN_TITLE:
                return (False, url)
            if EDITOR_TITLE and EDITOR_TITLE in title:
                return (True, url)
            time.sleep(0.5)
    finally:
        close_tab(target_id)

    if EDITOR_TITLE and EDITOR_TITLE in last_title:
        return (True, url)
    # 리다이렉트가 안 온 것을 로그인으로 읽지 않는다.
    # 실측으로 그 리다이렉트는 1초 안에 올 때도 있고 11초 뒤에 올 때도 있었다.
    # 느려서 아직 안 온 것과 로그인이 살아 있어 오지 않는 것을 주소만으로 가르지 못한다.
    return (None, url)


def read_pid() -> int | None:
    """적어 둔 PID 를 읽는다. 그 프로세스가 없으면 None 이다."""
    try:
        pid = int(PID_FILE.read_text(encoding="utf-8").strip())
    except (OSError, ValueError):
        return None
    try:
        os.kill(pid, 0)
    except OSError:
        return None
    return pid


def cmd_start(args: argparse.Namespace) -> int:
    """Chrome 을 띄운다. 이미 떠 있으면 그대로 둔다."""
    if is_up():
        print(f"이미 떠 있다: 127.0.0.1:{PORT}")
        return report_login()

    # Ubuntu 24.04 는 권한 없는 user namespace 를 막아 Chrome 의 sandbox 가 서지 않을 수 있다.
    # 먼저 sandbox 를 둔 채로 띄워 보고, 서지 않을 때만 끄고 다시 띄운다.
    for extra, label in (([], "sandbox 를 둔 채"), (["--no-sandbox"], "--no-sandbox 로")):
        process = launch(extra)
        if wait_up():
            PID_FILE.write_text(str(process.pid), encoding="utf-8")
            print(f"{label} 띄웠다. pid {process.pid}, 포트 {PORT}")
            print(f"프로필: {PROFILE}")
            return report_login()
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()

    log = PROFILE / "chrome.log"
    raise SessionError(f"CDP 포트가 열리지 않았다. 기록: {log}")


def report_login() -> int:
    """로그인 여부를 알리고 그에 맞는 종료 코드를 돌려준다."""
    logged_in, url = login_state()
    if logged_in:
        print("네이버 로그인이 살아 있다")
        return 0
    if logged_in is None:
        print("로그인 여부를 판정하지 못했다.", file=sys.stderr)
        print(f"글쓰기 화면이 머문 곳: {url or '(주소를 읽지 못했다)'}", file=sys.stderr)
        return 2
    print("네이버 로그인이 없다. 한 번 로그인해야 한다.", file=sys.stderr)
    print(f"글쓰기 화면이 간 곳: {url}", file=sys.stderr)
    print("맥북에서 포트를 이어 붙인 뒤 chrome://inspect 로 이 브라우저에 붙어 로그인한다.", file=sys.stderr)
    print(f"  ssh -L {PORT}:127.0.0.1:{PORT} <홈서버>", file=sys.stderr)
    return 1


def cmd_status(args: argparse.Namespace) -> int:
    """지금 상태를 알린다."""
    if not is_up():
        print("떠 있지 않다", file=sys.stderr)
        return 2
    version = cdp("/json/version")
    tabs = cdp("/json/list") or []
    print(f"브라우저: {version.get('Browser', '?')}")
    print(f"포트: 127.0.0.1:{PORT}")
    print(f"프로필: {PROFILE}")
    print(f"pid: {read_pid() or '알 수 없음'}")
    print(f"열린 탭: {len(tabs)}")
    return report_login()


def cmd_login_check(args: argparse.Namespace) -> int:
    """로그인 여부만 판정한다."""
    if not is_up():
        print("떠 있지 않다", file=sys.stderr)
        return 2
    return report_login()


def cmd_stop(args: argparse.Namespace) -> int:
    """상주 Chrome 을 내린다. 프로필은 지우지 않는다."""
    pid = read_pid()
    if pid is None:
        print("적어 둔 pid 로 도는 프로세스가 없다", file=sys.stderr)
        return 0 if not is_up() else 2
    os.kill(pid, signal.SIGTERM)
    for _ in range(20):
        if not is_up(timeout=1.0):
            break
        time.sleep(0.5)
    PID_FILE.unlink(missing_ok=True)
    print(f"내렸다. pid {pid}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="홈서버의 네이버 세션 브라우저를 다룬다")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("start", help="상주 Chrome 을 띄운다")
    sub.add_parser("status", help="상태와 로그인 여부를 알린다")
    sub.add_parser("login-check", help="로그인 여부만 판정한다")
    sub.add_parser("stop", help="상주 Chrome 을 내린다")

    args = parser.parse_args()
    handlers = {
        "start": cmd_start,
        "status": cmd_status,
        "login-check": cmd_login_check,
        "stop": cmd_stop,
    }
    try:
        return handlers[args.command](args)
    except SessionError as exc:
        print(exc, file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
