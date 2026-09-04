"""홈서버 SeaweedFS 의 S3 호환 API 에 붙는다.

boto3 를 쓰지 않고 표준 라이브러리로 AWS Signature V4 를 만든다.
이 워크스페이스의 다른 스크립트가 모두 의존성 없는 파이썬이라 맞춘다.

SeaweedFS 는 가상 호스트 방식 주소를 쓰지 않으므로 경로 방식으로 보낸다.
`https://<endpoint>/<bucket>/<key>` 형태다.

이 모듈은 홈서버에서만 실행한다.
S3 credential 을 홈서버 밖으로 내리지 않으려고 워크스페이스 `scripts/` 에 둔다.

설정은 워크스페이스 `.env` 를 먼저 보고, 없으면
`~/apps/ji-yoon-blog/config/host.env` 를 본다.

    JI_YOON_BLOG_S3_ENDPOINT=http://127.0.0.1:8333
    JI_YOON_BLOG_S3_BUCKET=ji-yoon-blog
    JI_YOON_BLOG_S3_ACCESS_KEY=...
    JI_YOON_BLOG_S3_SECRET_KEY=...

사용법:

    python3 seaweed_s3.py list photos/
    python3 seaweed_s3.py get photos/2026-09-04-순돌이곱창/IMG_0001.jpg out.jpg
    python3 seaweed_s3.py folders photos/
"""

from __future__ import annotations

import hashlib
import hmac
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree

REGION = "us-east-1"
SERVICE = "s3"
NS = {"s3": "http://s3.amazonaws.com/doc/2006-03-01/"}

REQUIRED_KEYS = (
    "JI_YOON_BLOG_S3_ENDPOINT",
    "JI_YOON_BLOG_S3_BUCKET",
    "JI_YOON_BLOG_S3_ACCESS_KEY",
    "JI_YOON_BLOG_S3_SECRET_KEY",
)

WORKSPACE_ENV = Path(__file__).resolve().parents[1] / ".env"
HOST_ENV = Path.home() / "apps" / "ji-yoon-blog" / "config" / "host.env"


class S3ConfigError(RuntimeError):
    """설정이 없거나 비어 있다."""


class S3HttpError(RuntimeError):
    """S3 가 2xx 가 아닌 응답을 돌려줬다.

    부르는 쪽이 상태 코드로 판단할 수 있게 `status` 를 함께 담는다.
    """

    def __init__(self, status: int, method: str, key: str, body: str):
        super().__init__(f"S3 {method} 실패 {status}: {body}")
        self.status = status
        self.method = method
        self.key = key
        self.body = body


def _read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def load_env(env_path: Path | None = None) -> dict[str, str]:
    """설정 값을 읽는다.

    워크스페이스 `.env` 를 먼저 보고, 그것이 없으면 홈서버 환경 파일을 본다.
    이미 환경에 있는 `JI_YOON_BLOG_` 값이 파일 값보다 우선한다.
    """
    values: dict[str, str] = {}
    candidates = [env_path] if env_path is not None else [WORKSPACE_ENV, HOST_ENV]
    for candidate in candidates:
        if candidate is not None and candidate.exists():
            values = _read_env_file(candidate)
            break
    values.update({k: v for k, v in os.environ.items() if k.startswith("JI_YOON_BLOG_")})
    return values


def missing_keys(env: dict[str, str]) -> list[str]:
    """필수 설정 중에서 비어 있는 항목의 이름을 돌려준다."""
    return [key for key in REQUIRED_KEYS if not env.get(key)]


def config_error(missing: list[str]) -> S3ConfigError:
    """어느 항목이 비었는지와 어느 파일을 채우는지 함께 알린다."""
    return S3ConfigError(
        "설정이 없다: "
        + ", ".join(missing)
        + f"\n다음 중 하나를 채운다: {WORKSPACE_ENV} 또는 {HOST_ENV}"
    )


class SeaweedS3:
    def __init__(self, env: dict[str, str] | None = None, bucket: str | None = None):
        env = env if env is not None else load_env()
        missing = missing_keys(env)
        if missing:
            raise config_error(missing)
        self.endpoint = env["JI_YOON_BLOG_S3_ENDPOINT"].rstrip("/")
        self.bucket = bucket or env["JI_YOON_BLOG_S3_BUCKET"]
        self.access_key = env["JI_YOON_BLOG_S3_ACCESS_KEY"]
        self.secret_key = env["JI_YOON_BLOG_S3_SECRET_KEY"]

    # ---- 서명 ----

    def _sign(self, key: bytes, message: str) -> bytes:
        return hmac.new(key, message.encode("utf-8"), hashlib.sha256).digest()

    def _signing_key(self, stamp: str) -> bytes:
        k = self._sign(f"AWS4{self.secret_key}".encode("utf-8"), stamp)
        k = self._sign(k, REGION)
        k = self._sign(k, SERVICE)
        return self._sign(k, "aws4_request")

    def canonical_path(self, key: str) -> str:
        """서명과 주소가 함께 쓰는 경로를 만든다.

        경로의 각 마디를 따로 인코딩한다. 슬래시는 그대로 두어야 서명이 맞는다.
        """
        path = "/" + "/".join(
            urllib.parse.quote(seg, safe="~")
            for seg in f"{self.bucket}/{key}".split("/")
            if seg != ""
        )
        if key.endswith("/"):
            path += "/"
        return path

    def url_for(self, key: str) -> str:
        """서명을 붙이지 않고 그 객체를 가리키는 주소를 만든다."""
        parsed = urllib.parse.urlsplit(self.endpoint)
        return f"{parsed.scheme}://{parsed.netloc}{self.canonical_path(key)}"

    def _request(
        self,
        method: str,
        path: str,
        query: dict[str, str] | None = None,
        body: bytes | None = None,
    ) -> bytes:
        query = query or {}
        parsed = urllib.parse.urlsplit(self.endpoint)
        host = parsed.netloc
        now = datetime.now(timezone.utc)
        amz_date = now.strftime("%Y%m%dT%H%M%SZ")
        stamp = now.strftime("%Y%m%d")

        canonical_path = self.canonical_path(path)
        canonical_query = "&".join(
            f"{urllib.parse.quote(k, safe='~')}={urllib.parse.quote(v, safe='~')}"
            for k, v in sorted(query.items())
        )
        payload = body if body is not None else b""
        payload_hash = hashlib.sha256(payload).hexdigest()
        canonical_headers = (
            f"host:{host}\nx-amz-content-sha256:{payload_hash}\nx-amz-date:{amz_date}\n"
        )
        signed_headers = "host;x-amz-content-sha256;x-amz-date"
        canonical_request = "\n".join(
            [
                method,
                canonical_path,
                canonical_query,
                canonical_headers,
                signed_headers,
                payload_hash,
            ]
        )

        scope = f"{stamp}/{REGION}/{SERVICE}/aws4_request"
        to_sign = "\n".join(
            [
                "AWS4-HMAC-SHA256",
                amz_date,
                scope,
                hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
            ]
        )
        signature = hmac.new(
            self._signing_key(stamp), to_sign.encode("utf-8"), hashlib.sha256
        ).hexdigest()

        url = f"{parsed.scheme}://{host}{canonical_path}"
        if canonical_query:
            url += f"?{canonical_query}"
        headers = {
            "Host": host,
            "x-amz-date": amz_date,
            "x-amz-content-sha256": payload_hash,
            "Authorization": (
                f"AWS4-HMAC-SHA256 Credential={self.access_key}/{scope}, "
                f"SignedHeaders={signed_headers}, Signature={signature}"
            ),
        }
        if body is not None:
            headers["Content-Length"] = str(len(payload))
        req = urllib.request.Request(url, method=method, headers=headers, data=body)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:400]
            raise S3HttpError(exc.code, method, path, detail) from exc

    # ---- 조회 ----

    def list(self, prefix: str = "", delimiter: str = "") -> tuple[list[dict], list[str]]:
        """접두사 아래 객체와 하위 폴더를 돌려준다.

        `delimiter` 를 `/` 로 주면 한 단계 아래 폴더만 본다.
        """
        objects: list[dict] = []
        folders: list[str] = []
        token = ""
        while True:
            query = {"list-type": "2", "prefix": prefix, "max-keys": "1000"}
            if delimiter:
                query["delimiter"] = delimiter
            if token:
                query["continuation-token"] = token
            root = ElementTree.fromstring(self._request("GET", "", query))

            for node in root.findall("s3:Contents", NS) or root.findall("Contents"):
                get = lambda tag: (  # noqa: E731 - 네임스페이스 유무를 모두 받는다
                    node.findtext(f"s3:{tag}", namespaces=NS) or node.findtext(tag) or ""
                )
                objects.append(
                    {
                        "key": get("Key"),
                        "size": int(get("Size") or 0),
                        "modified": get("LastModified"),
                    }
                )
            for node in root.findall("s3:CommonPrefixes", NS) or root.findall("CommonPrefixes"):
                folders.append(
                    node.findtext("s3:Prefix", namespaces=NS) or node.findtext("Prefix") or ""
                )

            truncated = (
                root.findtext("s3:IsTruncated", namespaces=NS)
                or root.findtext("IsTruncated")
                or "false"
            )
            token = (
                root.findtext("s3:NextContinuationToken", namespaces=NS)
                or root.findtext("NextContinuationToken")
                or ""
            )
            if truncated.lower() != "true" or not token:
                break
        return objects, folders

    def get(self, key: str) -> bytes:
        return self._request("GET", key)

    # ---- 변경 ----

    def put(self, key: str, data: bytes) -> None:
        """객체 하나를 쓴다."""
        self._request("PUT", key, body=data)

    def delete(self, key: str) -> None:
        """객체 하나를 지운다.

        `Write` 권한이 삭제까지 포함하므로 이 메서드가 동작한다.
        사진 폴더를 지우는 명령은 두지 않는다.
        연결과 권한을 확인하는 스크립트가 자기 시험 객체를 치울 때만 부른다.
        """
        self._request("DELETE", key)


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    command = sys.argv[1]
    try:
        s3 = SeaweedS3()
    except S3ConfigError as exc:
        print(exc, file=sys.stderr)
        return 2

    if command == "folders":
        prefix = sys.argv[2] if len(sys.argv) > 2 else "photos/"
        _, folders = s3.list(prefix, delimiter="/")
        for folder in folders:
            print(folder)
        return 0

    if command == "list":
        prefix = sys.argv[2] if len(sys.argv) > 2 else ""
        objects, _ = s3.list(prefix)
        for obj in objects:
            print(f"{obj['size']:>10}  {obj['modified']}  {obj['key']}")
        print(f"총 {len(objects)}개", file=sys.stderr)
        return 0

    if command == "get":
        key, out = sys.argv[2], sys.argv[3]
        Path(out).write_bytes(s3.get(key))
        print(f"{key} -> {out}")
        return 0

    print(f"모르는 명령: {command}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
