"""맥북에서 SSH 로 홈서버의 사진 저장소 명령을 부른다.

홈서버로 가는 길은 SSH 하나뿐이다.
S3 포트는 외부에 열려 있지 않으므로 맥북 코드는 S3 에 직접 붙지 않는다.
사진 폴더를 만들고 목록을 보고 받아오는 일을 모두 홈서버의
`ji-yoon-blog/scripts/photo_store.py` 가 맡고, 이 스크립트는 그것을 부른다.

설정은 워크스페이스 `.env` 에서 읽는다.

    JI_YOON_BLOG_SSH_TARGET=user@homeserver
    JI_YOON_BLOG_SSH_ARGS=-p 22 -i ~/.ssh/id_ed25519
    JI_YOON_BLOG_REMOTE_ROOT=~/fos-agents
    JI_YOON_BLOG_STORAGE_URL=https://storage.example.com/buckets/ji-yoon-blog

`JI_YOON_BLOG_STORAGE_URL` 은 아이폰이 여는 Admin UI 주소의 앞부분이며
bucket 경로까지 담는다.
bucket 이름이 이 값에 들어 있으므로 맥북은 S3 설정을 따로 읽지 않는다.

사용법:
    python3 photos.py folders
    python3 photos.py new 순돌이곱창
    python3 photos.py new 순돌이곱창 --date 2026-09-01
    python3 photos.py pull 2026-09-04-순돌이곱창 --out ./drafts/2026-09-04-순돌이곱창
"""

from __future__ import annotations

import argparse
import io
import json
import os
import shlex
import subprocess
import sys
import tarfile
import urllib.parse
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from photo_set import renumber  # noqa: E402

REMOTE_SCRIPT = "ji-yoon-blog/scripts/photo_store.py"
DEFAULT_REMOTE_ROOT = "~/fos-agents"
ENV_PREFIX = "JI_YOON_BLOG_"


class SshConfigError(RuntimeError):
    """맥북 SSH 설정이 없거나 비어 있다."""


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
    values.update({k: v for k, v in os.environ.items() if k.startswith(ENV_PREFIX)})
    return values


def ssh_command(env: dict[str, str], remote_args: list[str]) -> list[str]:
    """홈서버 명령을 실행할 `ssh` 인자 목록을 만든다."""
    target = env.get("JI_YOON_BLOG_SSH_TARGET", "")
    if not target:
        raise SshConfigError(
            "JI_YOON_BLOG_SSH_TARGET 이 비어 있다.\n"
            "워크스페이스 .env 에 홈서버 SSH 대상을 넣는다."
        )

    # zsh 는 변수를 단어로 나누지 않는다.
    # 추가 인자를 문자열 하나로 넘기면 첫 인자에 전체가 붙어 접속이 실패하므로
    # 파이썬에서 셸 규칙대로 나눠 목록으로 넘긴다.
    extra = shlex.split(env.get("JI_YOON_BLOG_SSH_ARGS", ""))

    root = env.get("JI_YOON_BLOG_REMOTE_ROOT") or DEFAULT_REMOTE_ROOT
    # 홈서버 셸이 `~` 를 펼쳐야 하므로 root 는 따옴표로 감싸지 않는다.
    remote = " ".join(
        ["python3", f"{root}/{REMOTE_SCRIPT}"] + [shlex.quote(a) for a in remote_args]
    )
    return ["ssh"] + extra + [target, remote]


def run_remote(env: dict[str, str], remote_args: list[str]) -> bytes:
    """홈서버 명령을 부르고 표준 출력을 돌려준다. 실패하면 멈춘다."""
    command = ssh_command(env, remote_args)
    done = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if done.returncode != 0:
        message = done.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(
            f"홈서버 명령이 실패했다 (종료 코드 {done.returncode}): {' '.join(remote_args)}\n{message}"
        )
    return done.stdout


def folder_url(env: dict[str, str], prefix: str) -> str:
    """Admin UI 의 파일 화면이 그 폴더를 열도록 주소를 만든다."""
    base = env.get("JI_YOON_BLOG_STORAGE_URL", "").rstrip("/")
    if not base:
        return ""
    parts = urllib.parse.urlsplit(base)
    bucket_path = parts.path or ""
    path = f"{bucket_path}/{prefix.strip('/')}"
    query = urllib.parse.urlencode({"path": path})
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, "/files", query, ""))


def cmd_folders(env: dict[str, str], args: argparse.Namespace) -> int:
    """폴더와 사진 장수를 표로 보여준다."""
    folders = json.loads(run_remote(env, ["folders"]).decode("utf-8") or "[]")
    if not folders:
        print("사진 묶음이 없다", file=sys.stderr)
        return 1

    print(f"{'폴더':<32}{'사진':>6}{'크기':>12}")
    for f in folders:
        size_mb = f.get("bytes", 0) / (1024 * 1024)
        print(f"{f.get('folder', ''):<32}{f.get('photos', 0):>6}{size_mb:>10.1f}MB")
    return 0


def cmd_new(env: dict[str, str], args: argparse.Namespace) -> int:
    """오늘 날짜로 폴더를 만들고 아이폰이 열 주소를 출력한다."""
    when = args.date or date.today().isoformat()
    folder = f"{when}-{args.place}"
    prefix = run_remote(env, ["create", folder]).decode("utf-8").strip()
    if not prefix:
        print(f"홈서버가 접두사를 돌려주지 않았다: {folder}", file=sys.stderr)
        return 1

    print(prefix)
    url = folder_url(env, prefix)
    if url:
        print(url)
    else:
        print(
            "JI_YOON_BLOG_STORAGE_URL 이 비어 있어 아이폰이 열 주소를 만들지 못했다.",
            file=sys.stderr,
        )
    return 0


def cmd_pull(env: dict[str, str], args: argparse.Namespace) -> int:
    """tar 를 받아 풀고 촬영시각 순으로 번호를 붙인다."""
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    # 사진을 파일로 먼저 저장하지 않고 스트림으로 처리한다.
    blob = run_remote(env, ["fetch", args.folder])
    if not blob:
        print(f"{args.folder} 에서 받은 것이 없다", file=sys.stderr)
        return 1

    with tarfile.open(fileobj=io.BytesIO(blob), mode="r|*") as tar:
        for member in tar:
            # tar 안의 이름은 원본 파일명 하나이며 경로를 담지 않는다.
            name = Path(member.name).name
            if not member.isfile() or not name or name.startswith("."):
                continue
            source = tar.extractfile(member)
            if source is None:
                continue
            (out / name).write_bytes(source.read())

    photos = renumber(out)
    if not photos:
        print(f"{out} 아래에 사진이 없다", file=sys.stderr)
        return 1

    print(json.dumps(photos, ensure_ascii=False, indent=2))
    print(f"사진 {len(photos)}장을 {out} 에 받았다", file=sys.stderr)

    missing = [p for p in photos if not p["shotAt"]]
    if missing:
        print(
            f"촬영시각을 읽지 못한 사진이 {len(missing)}장이다. 이름 순서로 세웠다.",
            file=sys.stderr,
        )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="SSH 로 홈서버의 사진 저장소를 부른다")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("folders", help="폴더와 사진 장수를 보여준다")

    new = sub.add_parser("new", help="사진 폴더를 만들고 아이폰이 열 주소를 출력한다")
    new.add_argument("place", help="장소 이름")
    new.add_argument("--date", help="폴더에 쓸 날짜. 생략하면 오늘이다")

    pull = sub.add_parser("pull", help="사진을 받아 촬영시각 순으로 번호를 붙인다")
    pull.add_argument("folder", help="홈서버의 폴더 이름")
    pull.add_argument("--out", required=True, help="사진을 풀어 놓을 디렉터리")

    args = parser.parse_args()
    handlers = {"folders": cmd_folders, "new": cmd_new, "pull": cmd_pull}

    try:
        return handlers[args.command](load_env(), args)
    except (SshConfigError, RuntimeError) as exc:
        print(exc, file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
