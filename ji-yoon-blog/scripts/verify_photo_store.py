"""홈서버에서 사진 저장소의 연결과 권한 경계를 확인한다.

전용 시험 접두사에서 다음 다섯을 확인하고 시험 객체를 남기지 않는다.

1. 자기 bucket 에 쓴 객체를 다시 받은 byte 의 SHA-256 이 같다.
2. 익명 요청이 거부된다.
3. 같은 credential 로 `career-os` bucket 에 쓰거나 읽을 수 없다.
4. `Write` 권한이 삭제까지 포함한다. 이것은 막을 수 없는 사실이라 통과 조건으로 둔다.
5. 시험 객체가 더는 존재하지 않는다.

출력과 오류에 access key 와 secret key 를 넣지 않는다.
확인이 하나라도 실패하면 0 이 아닌 코드로 끝낸다.

사용법:

    python3 verify_photo_store.py
"""

from __future__ import annotations

import hashlib
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from seaweed_s3 import S3ConfigError, S3HttpError, SeaweedS3, load_env  # noqa: E402

VERIFY_PREFIX = "_verify/"
OTHER_BUCKET = "career-os"
DENIED_STATUS = (400, 401, 403)


class VerifyFailure(RuntimeError):
    """확인 항목이 통과하지 못했다."""

    def __init__(self, message: str, isolation: bool = False):
        super().__init__(message)
        self.isolation = isolation


def report(ok: bool, title: str, detail: str) -> None:
    mark = "통과" if ok else "실패"
    print(f"[{mark}] {title}: {detail}")


def check_round_trip(s3: SeaweedS3, key: str) -> None:
    """쓴 byte 와 받은 byte 의 SHA-256 을 견준다."""
    payload = os.urandom(4096)
    expected = hashlib.sha256(payload).hexdigest()
    s3.put(key, payload)
    got = hashlib.sha256(s3.get(key)).hexdigest()
    if got != expected:
        raise VerifyFailure(f"쓴 byte 와 받은 byte 의 SHA-256 이 다르다: {expected} vs {got}")
    report(True, "왕복 확인", f"SHA-256 이 같다 ({expected[:16]}…)")


def check_anonymous_denied(s3: SeaweedS3, key: str) -> None:
    """서명을 붙이지 않은 요청이 거부되는지 본다."""
    request = urllib.request.Request(s3.url_for(key), method="GET")
    try:
        with urllib.request.urlopen(request, timeout=30) as resp:
            status = resp.status
    except urllib.error.HTTPError as exc:
        exc.read()
        if exc.code in DENIED_STATUS or exc.code == 404:
            report(True, "익명 요청 거부", f"HTTP {exc.code} 로 막혔다")
            return
        raise VerifyFailure(f"익명 요청이 예상하지 않은 코드로 끝났다: HTTP {exc.code}", True)
    except urllib.error.URLError as exc:
        raise VerifyFailure(f"익명 요청을 보내지 못했다: {exc.reason}") from exc
    raise VerifyFailure(f"익명 요청이 성공했다: HTTP {status}", True)


def check_other_bucket_denied(env: dict[str, str]) -> None:
    """같은 credential 로 다른 bucket 을 읽거나 쓸 수 없는지 본다."""
    other = SeaweedS3(env, bucket=OTHER_BUCKET)

    try:
        other.list("")
    except S3HttpError as exc:
        if exc.status not in DENIED_STATUS:
            raise VerifyFailure(
                f"{OTHER_BUCKET} 목록 조회가 예상하지 않은 코드로 끝났다: HTTP {exc.status}", True
            ) from exc
        report(True, f"{OTHER_BUCKET} 읽기 거부", f"HTTP {exc.status} 로 막혔다")
    else:
        raise VerifyFailure(f"{OTHER_BUCKET} 목록 조회가 성공했다", True)

    probe = f"{VERIFY_PREFIX}isolation-probe-{int(time.time())}"
    try:
        other.put(probe, b"")
    except S3HttpError as exc:
        if exc.status not in DENIED_STATUS:
            raise VerifyFailure(
                f"{OTHER_BUCKET} 쓰기가 예상하지 않은 코드로 끝났다: HTTP {exc.status}", True
            ) from exc
        report(True, f"{OTHER_BUCKET} 쓰기 거부", f"HTTP {exc.status} 로 막혔다")
    else:
        raise VerifyFailure(
            f"{OTHER_BUCKET} 쓰기가 성공했다. {OTHER_BUCKET}/{probe} 를 사람이 지운다."
            " 이 스크립트는 다른 bucket 의 객체를 지우지 않는다.",
            True,
        )


def check_delete_allowed(s3: SeaweedS3, key: str) -> None:
    """`Write` 권한이 삭제까지 포함하는지 본다.

    권한을 갈라 줄 수 없어서 막을 수 없는 사실이다.
    코드에 삭제 경로를 두지 않는 것이 유일한 경계라서 이것을 통과 조건으로 둔다.
    """
    s3.delete(key)
    report(True, "삭제 포함 확인", "Write 권한이 삭제까지 포함한다")


def check_absent(s3: SeaweedS3, key: str) -> None:
    """시험 객체가 더는 존재하지 않는지 본다."""
    try:
        s3.get(key)
    except S3HttpError as exc:
        if exc.status != 404:
            raise VerifyFailure(
                f"시험 객체 조회가 예상하지 않은 코드로 끝났다: HTTP {exc.status}"
            ) from exc
        report(True, "시험 객체 정리", "HTTP 404 로 남아 있지 않다")
        return
    raise VerifyFailure("삭제한 시험 객체를 아직 받을 수 있다")


def cleanup(s3: SeaweedS3, key: str) -> None:
    """확인이 중간에 멈춰도 시험 객체를 남기지 않는다."""
    try:
        s3.delete(key)
    except S3HttpError:
        pass


def main() -> int:
    try:
        env = load_env()
        s3 = SeaweedS3(env)
    except S3ConfigError as exc:
        print(exc, file=sys.stderr)
        print("PHASE_BLOCKED: 홈서버 환경 파일 미비", file=sys.stderr)
        return 2

    key = f"{VERIFY_PREFIX}{int(time.time())}-{os.getpid()}.bin"
    print(f"bucket {s3.bucket} 의 {key} 로 확인한다.")

    deleted = False
    try:
        check_round_trip(s3, key)
        check_anonymous_denied(s3, key)
        check_other_bucket_denied(env)
        check_delete_allowed(s3, key)
        deleted = True
        check_absent(s3, key)
    except VerifyFailure as exc:
        report(False, "확인 중단", str(exc))
        if not deleted:
            cleanup(s3, key)
        if exc.isolation:
            print("PHASE_BLOCKED: bucket 격리 미충족", file=sys.stderr)
        return 1
    except S3HttpError as exc:
        report(False, "확인 중단", str(exc))
        if not deleted:
            cleanup(s3, key)
        return 1

    print("다섯 항목을 모두 통과했다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
