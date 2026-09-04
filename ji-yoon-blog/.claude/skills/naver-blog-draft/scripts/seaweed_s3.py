"""홈서버 SeaweedFS 의 S3 호환 API 에 붙는다.

boto3 를 쓰지 않고 표준 라이브러리로 AWS Signature V4 를 만든다.
이 워크스페이스의 다른 스크립트가 모두 의존성 없는 파이썬이라 맞춘다.

SeaweedFS 는 가상 호스트 방식 주소를 쓰지 않으므로 경로 방식으로 보낸다.
`https://<endpoint>/<bucket>/<key>` 형태다.

설정은 워크스페이스 `.env` 에서 읽는다.

    JI_YOON_BLOG_S3_ENDPOINT=https://s3.example.com
    JI_YOON_BLOG_S3_BUCKET=ji-yoon-blog
    JI_YOON_BLOG_S3_ACCESS_KEY=...
    JI_YOON_BLOG_S3_SECRET_KEY=...

사용법:

    python3 seaweed_s3.py list photos/
    python3 seaweed_s3.py get photos/2026-09-04-순돌이곱창/IMG_0001.jpg out.jpg
    python3 seaweed_s3.py folders photos/
    python3 seaweed_s3.py presign PUT photos/2026-09-04-순돌이곱창/001.jpg 86400
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


class S3ConfigError(RuntimeError):
    """설정이 없거나 비어 있다."""


def load_env(env_path: Path | None = None) -> dict[str, str]:
    """워크스페이스 `.env` 를 읽는다. 이미 환경에 있는 값이 우선한다."""
    values: dict[str, str] = {}
    path = env_path or Path(__file__).resolve().parents[4] / ".env"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            values[key.strip()] = value.strip().strip('"').strip("'")
    values.update({k: v for k, v in os.environ.items() if k.startswith("JI_YOON_BLOG_S3_")})
    return values


class SeaweedS3:
    def __init__(self, env: dict[str, str] | None = None):
        env = env if env is not None else load_env()
        missing = [
            k
            for k in (
                "JI_YOON_BLOG_S3_ENDPOINT",
                "JI_YOON_BLOG_S3_BUCKET",
                "JI_YOON_BLOG_S3_ACCESS_KEY",
                "JI_YOON_BLOG_S3_SECRET_KEY",
            )
            if not env.get(k)
        ]
        if missing:
            raise S3ConfigError(
                "설정이 없다: " + ", ".join(missing) + "\n워크스페이스 .env 를 채운다."
            )
        self.endpoint = env["JI_YOON_BLOG_S3_ENDPOINT"].rstrip("/")
        self.bucket = env["JI_YOON_BLOG_S3_BUCKET"]
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

    def _request(self, method: str, path: str, query: dict[str, str] | None = None) -> bytes:
        query = query or {}
        parsed = urllib.parse.urlsplit(self.endpoint)
        host = parsed.netloc
        now = datetime.now(timezone.utc)
        amz_date = now.strftime("%Y%m%dT%H%M%SZ")
        stamp = now.strftime("%Y%m%d")

        # 경로의 각 마디를 따로 인코딩한다. 슬래시는 그대로 두어야 서명이 맞는다.
        canonical_path = "/" + "/".join(
            urllib.parse.quote(seg, safe="~") for seg in f"{self.bucket}/{path}".split("/") if seg != ""
        )
        if path.endswith("/"):
            canonical_path += "/"
        canonical_query = "&".join(
            f"{urllib.parse.quote(k, safe='~')}={urllib.parse.quote(v, safe='~')}"
            for k, v in sorted(query.items())
        )
        payload_hash = hashlib.sha256(b"").hexdigest()
        canonical_headers = f"host:{host}\nx-amz-content-sha256:{payload_hash}\nx-amz-date:{amz_date}\n"
        signed_headers = "host;x-amz-content-sha256;x-amz-date"
        canonical_request = "\n".join(
            [method, canonical_path, canonical_query, canonical_headers, signed_headers, payload_hash]
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
        req = urllib.request.Request(
            url,
            method=method,
            headers={
                "Host": host,
                "x-amz-date": amz_date,
                "x-amz-content-sha256": payload_hash,
                "Authorization": (
                    f"AWS4-HMAC-SHA256 Credential={self.access_key}/{scope}, "
                    f"SignedHeaders={signed_headers}, Signature={signature}"
                ),
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")[:400]
            raise RuntimeError(f"S3 {method} 실패 {exc.code}: {body}") from exc

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
                    {"key": get("Key"), "size": int(get("Size") or 0), "modified": get("LastModified")}
                )
            for node in root.findall("s3:CommonPrefixes", NS) or root.findall("CommonPrefixes"):
                folders.append(
                    node.findtext("s3:Prefix", namespaces=NS) or node.findtext("Prefix") or ""
                )

            truncated = (
                root.findtext("s3:IsTruncated", namespaces=NS) or root.findtext("IsTruncated") or "false"
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

    # ---- 서명된 주소 ----

    def presign(self, method: str, key: str, expires: int = 86400) -> str:
        """비밀 키 없이도 쓸 수 있는 한시 주소를 만든다.

        업로드 페이지가 브라우저에서 도는데 비밀 키를 그리로 보낼 수 없다.
        서명한 주소만 심으면 그 키 하나에, 정해진 기간에만 쓸 수 있다.
        """
        parsed = urllib.parse.urlsplit(self.endpoint)
        host = parsed.netloc
        now = datetime.now(timezone.utc)
        amz_date = now.strftime("%Y%m%dT%H%M%SZ")
        stamp = now.strftime("%Y%m%d")
        scope = f"{stamp}/{REGION}/{SERVICE}/aws4_request"

        canonical_path = "/" + "/".join(
            urllib.parse.quote(seg, safe="~") for seg in f"{self.bucket}/{key}".split("/") if seg
        )
        query = {
            "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
            "X-Amz-Credential": f"{self.access_key}/{scope}",
            "X-Amz-Date": amz_date,
            "X-Amz-Expires": str(expires),
            "X-Amz-SignedHeaders": "host",
        }
        canonical_query = "&".join(
            f"{urllib.parse.quote(k, safe='~')}={urllib.parse.quote(v, safe='~')}"
            for k, v in sorted(query.items())
        )
        canonical_request = "\n".join(
            [method, canonical_path, canonical_query, f"host:{host}\n", "host", "UNSIGNED-PAYLOAD"]
        )
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
        return f"{parsed.scheme}://{host}{canonical_path}?{canonical_query}&X-Amz-Signature={signature}"


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
        for f in folders:
            print(f)
        return 0

    if command == "list":
        prefix = sys.argv[2] if len(sys.argv) > 2 else ""
        objects, _ = s3.list(prefix)
        for o in objects:
            print(f"{o['size']:>10}  {o['modified']}  {o['key']}")
        print(f"총 {len(objects)}개", file=sys.stderr)
        return 0

    if command == "presign":
        method = sys.argv[2].upper()
        key = sys.argv[3]
        expires = int(sys.argv[4]) if len(sys.argv) > 4 else 86400
        print(s3.presign(method, key, expires))
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
