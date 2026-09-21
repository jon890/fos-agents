"""CDP 의 WebSocket 창구를 의존성 없이 부른다.

`browser-driver` 는 페이지 안에서 JS 를 돌리는 것까지만 한다.
네이버 편집기는 그 경로로 글자를 받지 않는다.
SmartEditor 가 자체 입력 버퍼로 글자를 받아서 `execCommand` 가 `false` 로 끝난다. 실측이다.

브라우저의 실제 입력 경로로 넣으려면 CDP 의 `Input` 을 불러야 하고,
그 창구는 HTTP 가 아니라 WebSocket 에만 있다.
그래서 여기서 최소한의 WebSocket 클라이언트를 직접 만든다.
이 워크스페이스의 다른 스크립트가 모두 의존성 없는 파이썬이라 맞춘다.

붙는 곳은 홈서버의 상주 Chrome 이다.
맥북에서 부를 때는 SSH 포트 포워딩이 떠 있어야 한다.

    ssh -L 9222:127.0.0.1:9222 <홈서버>

상주 Chrome 을 띄우고 내리는 것은 `naver_session.py` 가 소유한다.
"""

from __future__ import annotations

import base64
import json
import os
import socket
import struct
import time
import urllib.request

PORT = int(os.environ.get("JI_YOON_BLOG_CDP_PORT", "9222"))
HOST = "127.0.0.1"


class CdpError(RuntimeError):
    """CDP 에 붙지 못했거나 명령이 오류로 끝났다."""


def http_json(path: str, method: str = "GET", timeout: float = 10.0):
    """CDP 의 HTTP 창구를 부른다."""
    request = urllib.request.Request(f"http://{HOST}:{PORT}{path}", method=method)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read().decode("utf-8", errors="replace")
    return json.loads(body) if body.strip() else {}


def find_page(url_part: str) -> dict:
    """주소에 그 조각이 든 탭을 돌려준다."""
    for tab in http_json("/json/list"):
        if tab.get("type") == "page" and url_part in tab.get("url", ""):
            return tab
    raise CdpError(f"그 주소를 연 탭이 없다: {url_part}")


class Socket:
    """RFC 6455 의 클라이언트 쪽만 담은 최소 구현이다."""

    def __init__(self, ws_url: str, timeout: float = 30.0):
        path = ws_url.split(f"{HOST}:{PORT}", 1)[-1]
        self.sock = socket.create_connection((HOST, PORT), timeout=timeout)
        self.sock.settimeout(timeout)
        key = base64.b64encode(os.urandom(16)).decode()
        handshake = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {HOST}:{PORT}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n"
            # Chrome 은 origin 을 검사한다. 허용 목록은 상주 Chrome 의 실행 옵션이 정한다.
            f"Origin: http://{HOST}:{PORT}\r\n\r\n"
        )
        self.sock.sendall(handshake.encode())
        head = self._read_until(b"\r\n\r\n")
        if b"101" not in head.split(b"\r\n", 1)[0]:
            raise CdpError(f"WebSocket 으로 올라가지 못했다: {head.splitlines()[:1]}")
        self.buffer = b""

    def _read_until(self, marker: bytes) -> bytes:
        data = b""
        while marker not in data:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise CdpError("연결이 끊겼다")
            data += chunk
        return data

    def _recv_exact(self, count: int) -> bytes:
        while len(self.buffer) < count:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise CdpError("연결이 끊겼다")
            self.buffer += chunk
        out, self.buffer = self.buffer[:count], self.buffer[count:]
        return out

    def send(self, text: str) -> None:
        """텍스트 프레임 하나를 보낸다. 클라이언트는 반드시 마스킹한다."""
        payload = text.encode("utf-8")
        header = bytearray([0x81])
        length = len(payload)
        if length < 126:
            header.append(0x80 | length)
        elif length < (1 << 16):
            header.append(0x80 | 126)
            header += struct.pack(">H", length)
        else:
            header.append(0x80 | 127)
            header += struct.pack(">Q", length)
        mask = os.urandom(4)
        header += mask
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        self.sock.sendall(bytes(header) + masked)

    def recv(self) -> str:
        """텍스트 프레임 하나를 받는다. ping 에는 pong 으로 답한다."""
        while True:
            first, second = self._recv_exact(2)
            opcode = first & 0x0F
            length = second & 0x7F
            if length == 126:
                (length,) = struct.unpack(">H", self._recv_exact(2))
            elif length == 127:
                (length,) = struct.unpack(">Q", self._recv_exact(8))
            payload = self._recv_exact(length)
            if opcode == 0x9:  # ping
                self.sock.sendall(bytes([0x8A, 0x80]) + os.urandom(4))
                continue
            if opcode == 0x8:  # close
                raise CdpError("브라우저가 연결을 닫았다")
            if opcode in (0x1, 0x0):
                return payload.decode("utf-8", errors="replace")

    def close(self) -> None:
        try:
            self.sock.close()
        except OSError:
            pass


class Page:
    """탭 하나에 붙어 CDP 명령을 주고받는다."""

    def __init__(self, ws_url: str, timeout: float = 30.0):
        self.ws = Socket(ws_url, timeout=timeout)
        self.next_id = 0
        self.dialogs: list[str] = []
        self.events: list[dict] = []
        # `confirm` 이나 `alert` 가 뜨면 페이지 실행이 통째로 멈춘다.
        # 그 상태에서는 어떤 명령도 응답하지 않아 전부 시간 초과로 끝난다.
        # 실측으로 임시저장 글 삭제가 그런 confirm 을 띄웠다.
        # 그래서 붙자마자 Page 도메인을 켜서 그 알림을 받을 수 있게 한다.
        self._notify("Page.enable")

    def _notify(self, method: str, **params) -> None:
        """응답을 기다리지 않고 명령 하나를 보낸다."""
        self.next_id += 1
        self.ws.send(json.dumps({"id": self.next_id, "method": method, "params": params}))

    @classmethod
    def by_url(cls, url_part: str, timeout: float = 30.0) -> "Page":
        return cls(find_page(url_part)["webSocketDebuggerUrl"], timeout=timeout)

    def call(self, method: str, **params):
        """명령 하나를 보내고 그 응답을 돌려준다. 이벤트는 흘려보낸다."""
        self.next_id += 1
        sent = self.next_id
        self.ws.send(json.dumps({"id": sent, "method": method, "params": params}))
        while True:
            message = json.loads(self.ws.recv())
            if message.get("method") == "Page.javascriptDialogOpening":
                # 열린 채로 두면 페이지가 멈춘 채 아무 명령도 돌지 않는다.
                # 받는 즉시 수락하고 무엇이 떴는지 남긴다.
                self.dialogs.append(message["params"].get("message", ""))
                self._notify("Page.handleJavaScriptDialog", accept=True)
                continue
            if message.get("id") != sent:
                if message.get("method"):
                    self.events.append(message)
                continue
            if "error" in message:
                raise CdpError(f"{method}: {message['error'].get('message')}")
            return message.get("result", {})

    def wait_event(self, method: str, seconds: float = 20.0) -> dict | None:
        """그 이름의 이벤트가 올 때까지 기다린다. 이미 받아 둔 것이 있으면 그것을 먼저 준다.

        파일 선택 창처럼 명령의 응답이 아니라 이벤트로 오는 것을 받을 때 쓴다.
        """
        for i, kept in enumerate(self.events):
            if kept.get("method") == method:
                return self.events.pop(i).get("params", {})

        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            try:
                message = json.loads(self.ws.recv())
            except CdpError:
                return None
            except OSError:
                return None
            if message.get("method") == method:
                return message.get("params", {})
            if message.get("method"):
                self.events.append(message)
        return None

    def js(self, expression: str):
        """페이지 안에서 JS 를 돌리고 값을 돌려준다."""
        result = self.call(
            "Runtime.evaluate",
            expression=expression,
            returnByValue=True,
            awaitPromise=True,
        )
        if result.get("exceptionDetails"):
            raise CdpError(str(result["exceptionDetails"].get("text")))
        return result.get("result", {}).get("value")

    def type_text(self, text: str) -> None:
        """지금 초점이 있는 곳에 글자를 넣는다.

        `Input.insertText` 는 브라우저의 입력 경로를 그대로 지나므로
        편집기가 사람이 친 것과 같게 받는다.
        """
        self.call("Input.insertText", text=text)

    def press(self, key: str, code: str, key_code: int) -> None:
        """키 하나를 누르고 뗀다."""
        for kind in ("rawKeyDown", "keyUp"):
            self.call(
                "Input.dispatchKeyEvent",
                type=kind,
                key=key,
                code=code,
                windowsVirtualKeyCode=key_code,
                nativeVirtualKeyCode=key_code,
            )

    def enter(self) -> None:
        self.press("Enter", "Enter", 13)

    def close(self) -> None:
        self.ws.close()
