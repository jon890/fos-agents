"""사진 저장소 명령을 부른다. 맥북과 홈서버 양쪽에서 돈다.

사진 폴더를 만들고 목록을 보고 받아오는 일은 모두
`ji-yoon-blog/scripts/photo_store.py` 가 맡는다.
이 스크립트는 그것을 부르는 쪽이며, 부르는 길을 환경을 보고 스스로 고른다.

| 도는 자리 | 고르는 길 |
| --- | --- |
| 홈서버와 그 안의 Hermes 컨테이너 | `photo_store.py` 를 같은 자리에서 부른다 |
| 맥북 | SSH 로 홈서버의 `photo_store.py` 를 부른다 |

무엇으로 고르는지는 `run_remote()` 가 설명한다.
플래그로 고르지 않으므로 부르는 쪽은 어느 자리에서 도는지 알 필요가 없다.

S3 credential 이 홈서버 밖으로 나가지 않는다는 규칙은 그대로다.
S3 설정을 읽을 수 있다는 것 자체가 S3 에 닿는 자리에 있다는 뜻이다.

설정은 워크스페이스 `.env` 에서 읽는다.

    JI_YOON_BLOG_SSH_TARGET=user@homeserver
    JI_YOON_BLOG_SSH_ARGS=-p 22 -i ~/.ssh/id_ed25519
    JI_YOON_BLOG_REMOTE_ROOT=~/fos-agents
    JI_YOON_BLOG_STORAGE_URL=https://storage.example.com/files?path=/buckets/ji-yoon-blog

앞의 셋은 SSH 로 가는 자리에서만 쓴다.
`JI_YOON_BLOG_STORAGE_URL` 은 아이폰이 여는 Admin UI 파일 화면 주소이며
`path` 조회 인자에 bucket 경로를 담는다. 이 값은 양쪽 자리에서 모두 쓴다.

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
import unicodedata
import urllib.parse
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from photo_set import renumber  # noqa: E402

REMOTE_SCRIPT = "ji-yoon-blog/scripts/photo_store.py"
DEFAULT_REMOTE_ROOT = "~/fos-agents"
ENV_PREFIX = "JI_YOON_BLOG_"

# 이 스킬은 워크스페이스 안에 있으므로 같은 저장소의 `scripts/` 가 위로 네 단계다.
WORKSPACE_ROOT = Path(__file__).resolve().parents[4]
LOCAL_SCRIPT = WORKSPACE_ROOT / "scripts" / "photo_store.py"


class StoreConfigError(RuntimeError):
    """사진 저장소로 가는 두 길의 설정이 모두 없거나 비어 있다."""


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


def s3_missing_keys() -> list[str] | None:
    """이 자리에서 `photo_store.py` 가 읽을 S3 설정 중 비어 있는 것을 돌려준다.

    판정을 `seaweed_s3` 에 그대로 맡긴다.
    `photo_store.py` 가 실제로 쓰는 것과 같은 함수로 물어야
    "부르면 되는가" 와 "된다고 본 것" 이 어긋나지 않는다.

    같은 저장소에 `scripts/photo_store.py` 가 없으면 그 자리에서 부를 길이 아예
    없으므로 `None` 을 돌려준다. 빈 목록과 구분해야 하므로 목록으로 합치지 않는다.
    """
    if not LOCAL_SCRIPT.exists():
        return None
    scripts_dir = str(LOCAL_SCRIPT.parent)
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)
    try:
        import seaweed_s3  # noqa: PLC0415
    except ImportError:
        return None
    return seaweed_s3.missing_keys(seaweed_s3.load_env())


def local_command(remote_args: list[str]) -> list[str]:
    """같은 자리의 `photo_store.py` 를 실행할 인자 목록을 만든다."""
    return [sys.executable, str(LOCAL_SCRIPT)] + remote_args


def ssh_command(env: dict[str, str], remote_args: list[str]) -> list[str]:
    """홈서버 명령을 실행할 `ssh` 인자 목록을 만든다."""
    target = env.get("JI_YOON_BLOG_SSH_TARGET", "")
    if not target:
        raise StoreConfigError(
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
    """사진 저장소 명령을 부르고 표준 출력을 돌려준다. 실패하면 멈춘다.

    두 길 중 하나를 환경만 보고 고른다. 부르는 쪽은 어느 길인지 알 필요가 없다.

    | 본 것 | 고르는 길 |
    | --- | --- |
    | S3 설정이 모두 있다 | `photo_store.py` 를 같은 자리에서 부른다 |
    | S3 설정이 없고 SSH 대상이 있다 | SSH 로 홈서버의 `photo_store.py` 를 부른다 |
    | 둘 다 없다 | 어느 값을 채워야 하는지 알리고 멈춘다 |

    S3 설정이 있는 자리는 S3 에 닿는 자리다.
    홈서버와 그 안의 Hermes 컨테이너가 여기 해당하고, 거기서는 SSH 로 나갔다
    들어올 이유가 없다. 맥북은 S3 설정을 갖지 않으므로 SSH 로 간다.
    """
    missing = s3_missing_keys()
    if missing is not None and not missing:
        command = local_command(remote_args)
        where = "사진 저장소 명령"
    elif env.get("JI_YOON_BLOG_SSH_TARGET"):
        command = ssh_command(env, remote_args)
        where = "홈서버 명령"
    else:
        raise StoreConfigError(store_config_message(missing))

    done = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if done.returncode != 0:
        message = done.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(
            f"{where}이 실패했다 (종료 코드 {done.returncode}): {' '.join(remote_args)}\n{message}"
        )
    return done.stdout


def store_config_message(missing: list[str] | None) -> str:
    """두 길이 모두 막혔을 때 어느 값을 채워야 하는지 이름으로 적는다."""
    lines = ["사진 저장소로 가는 두 길의 설정이 모두 없다.", ""]
    if missing:
        lines.append("같은 자리에서 부르려면 아래 값을 채운다.")
        lines.extend(f"  {key}" for key in missing)
    else:
        lines.append(
            f"같은 자리에서 부르려면 {LOCAL_SCRIPT} 가 있어야 하고 "
            "S3 설정을 읽을 수 있어야 한다."
        )
    lines.append("")
    lines.append("SSH 로 부르려면 워크스페이스 .env 에 아래 값을 채운다.")
    lines.append("  JI_YOON_BLOG_SSH_TARGET")
    return "\n".join(lines)


def folder_url(env: dict[str, str], prefix: str) -> str:
    """Admin UI 의 파일 화면이 그 폴더를 열도록 주소를 만든다.

    Admin UI 의 `path` 는 filer 경로이며 bucket 부터 시작한다.
    예전 `/buckets/<bucket>` 설정값도 폴더 주소 생성에는 계속 쓸 수 있다.
    bucket 부분이 빠진 주소는 빈 목록을 보여주므로 여기서 먼저 막는다.
    """
    base = env.get("JI_YOON_BLOG_STORAGE_URL", "").rstrip("/")
    if not base:
        return ""
    parts = urllib.parse.urlsplit(base)
    if parts.path == "/files":
        bucket_path = urllib.parse.parse_qs(parts.query).get("path", [""])[0].rstrip("/")
    else:
        bucket_path = parts.path.rstrip("/")
    if not bucket_path.startswith("/buckets/") or len(bucket_path.split("/")) < 3:
        raise StoreConfigError(
            "JI_YOON_BLOG_STORAGE_URL 에 bucket 경로가 없다.\n"
            f"지금 값: {base}\n"
            "Admin UI 파일 화면의 주소를 그대로 넣는다. `.env.example` 이 형태를 보여준다."
        )
    path = f"{bucket_path}/{prefix.strip('/')}"
    query = urllib.parse.urlencode({"path": path})
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, "/files", query, ""))


def display_width(text: str) -> int:
    """터미널에서 차지하는 칸 수를 센다. 한글과 이모지는 두 칸이다."""
    return sum(2 if unicodedata.east_asian_width(ch) in "WF" else 1 for ch in text)


def pad(text: str, width: int) -> str:
    """표 한 칸을 화면 폭 기준으로 왼쪽에 맞춘다."""
    return text + " " * max(0, width - display_width(text))


def rpad(text: str, width: int) -> str:
    """표 한 칸을 화면 폭 기준으로 오른쪽에 맞춘다."""
    return " " * max(0, width - display_width(text)) + text


def cmd_folders(env: dict[str, str], args: argparse.Namespace) -> int:
    """폴더와 사진 장수를 표로 보여준다."""
    folders = json.loads(run_remote(env, ["folders"]).decode("utf-8") or "[]")
    if not folders:
        print("사진 묶음이 없다", file=sys.stderr)
        return 1

    print(f"{pad('폴더', 34)}{rpad('사진', 6)}{rpad('크기', 12)}")
    for f in folders:
        size_mb = f.get("bytes", 0) / (1024 * 1024)
        print(
            f"{pad(str(f.get('folder', '')), 34)}"
            f"{rpad(str(f.get('photos', 0)), 6)}"
            f"{rpad(f'{size_mb:.1f}MB', 12)}"
        )
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
    # 폴더는 이미 만들어졌으므로 주소를 만들지 못해도 접두사는 남긴다.
    try:
        url = folder_url(env, prefix)
    except StoreConfigError as exc:
        print(exc, file=sys.stderr)
        return 1
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
    parser = argparse.ArgumentParser(description="사진 저장소 명령을 부른다. 맥북과 홈서버 양쪽에서 돈다")
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
    except (StoreConfigError, RuntimeError) as exc:
        print(exc, file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
