"""홈서버에서 `ji-yoon-blog` bucket 의 사진 폴더를 만들고 조회하고 전송한다.

이 스크립트는 홈서버에서만 실행한다.
S3 credential 이 홈서버 밖으로 나가지 않게 하려고 맥북은 SSH 로 이 명령을 부른다.

사용법:

    python3 photo_store.py folders
    python3 photo_store.py create 2026-09-04-순돌이곱창
    python3 photo_store.py list 2026-09-04-순돌이곱창
    python3 photo_store.py fetch 2026-09-04-순돌이곱창 > photos.tar

삭제 하위 명령은 두지 않는다.
`Write` 권한이 삭제까지 포함하지만 이 명령에 그 경로를 두지 않는다.
"""

from __future__ import annotations

import io
import json
import sys
import tarfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from seaweed_s3 import S3ConfigError, S3HttpError, SeaweedS3, load_env  # noqa: E402

PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"}
KEEP_NAME = ".keep"
DEFAULT_PREFIX = "photos/"


def photo_prefix(env: dict[str, str]) -> str:
    """사진이 놓이는 접두사를 돌려준다. 끝에 슬래시를 붙여 맞춘다."""
    prefix = env.get("JI_YOON_BLOG_PHOTO_PREFIX") or DEFAULT_PREFIX
    return prefix if prefix.endswith("/") else prefix + "/"


def is_photo(key: str) -> bool:
    """이미지 확장자를 가진 키만 사진으로 센다."""
    name = key.rsplit("/", 1)[-1]
    if name == KEEP_NAME or not name:
        return False
    dot = name.rfind(".")
    if dot < 0:
        return False
    return name[dot:].lower() in PHOTO_EXTENSIONS


def folder_prefix(prefix: str, folder: str) -> str:
    """폴더 이름을 접두사가 붙은 키 접두사로 바꾼다."""
    name = folder.strip().strip("/")
    if not name:
        raise ValueError("폴더 이름이 비어 있다.")
    if "/" in name:
        raise ValueError(f"폴더 이름에 슬래시를 넣지 않는다: {folder}")
    return f"{prefix}{name}/"


def cmd_folders(s3: SeaweedS3, prefix: str) -> int:
    """폴더마다 접두사, 사진 장수, 합계 크기를 JSON 배열로 낸다."""
    objects, _ = s3.list(prefix)
    summary: dict[str, dict] = {}
    for obj in objects:
        rest = obj["key"][len(prefix) :]
        if "/" not in rest:
            continue
        name = rest.split("/", 1)[0]
        entry = summary.setdefault(
            name, {"prefix": f"{prefix}{name}/", "folder": name, "photos": 0, "bytes": 0}
        )
        if is_photo(obj["key"]):
            entry["photos"] += 1
            entry["bytes"] += obj["size"]
    rows = [summary[name] for name in sorted(summary)]
    print(json.dumps(rows, ensure_ascii=False, indent=2))
    return 0


def cmd_create(s3: SeaweedS3, prefix: str, folder: str) -> int:
    """폴더 접두사에 크기 0 객체를 쓴다.

    S3 에는 폴더가 없고 키 접두사만 있다.
    이 객체가 없으면 사진을 올리기 전의 폴더가 Admin UI 파일 목록에 보이지 않는다.
    """
    target = folder_prefix(prefix, folder)
    s3.put(f"{target}{KEEP_NAME}", b"")
    print(target)
    return 0


def cmd_list(s3: SeaweedS3, prefix: str, folder: str) -> int:
    """폴더 안 사진마다 키, 크기, 수정 시각을 JSON 배열로 낸다."""
    target = folder_prefix(prefix, folder)
    objects, _ = s3.list(target)
    rows = [
        {"key": obj["key"], "size": obj["size"], "modified": obj["modified"]}
        for obj in objects
        if is_photo(obj["key"])
    ]
    rows.sort(key=lambda row: row["key"])
    print(json.dumps(rows, ensure_ascii=False, indent=2))
    return 0


def cmd_fetch(s3: SeaweedS3, prefix: str, folder: str) -> int:
    """폴더 안 사진을 tar 로 묶어 표준 출력에 흘린다.

    tar 안의 이름은 원본 파일명만 쓰고 접두사 경로를 넣지 않는다.
    """
    target = folder_prefix(prefix, folder)
    objects, _ = s3.list(target)
    photos = sorted((obj for obj in objects if is_photo(obj["key"])), key=lambda o: o["key"])
    if not photos:
        print(f"사진이 없다: {target}", file=sys.stderr)
        return 1

    now = int(time.time())
    with tarfile.open(fileobj=sys.stdout.buffer, mode="w|") as tar:
        for obj in photos:
            data = s3.get(obj["key"])
            info = tarfile.TarInfo(name=obj["key"].rsplit("/", 1)[-1])
            info.size = len(data)
            info.mtime = now
            tar.addfile(info, io.BytesIO(data))
    print(f"{len(photos)}장을 tar 로 보냈다: {target}", file=sys.stderr)
    return 0


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 2
    command = argv[1]

    try:
        env = load_env()
        s3 = SeaweedS3(env)
    except S3ConfigError as exc:
        print(exc, file=sys.stderr)
        return 2
    prefix = photo_prefix(env)

    try:
        if command == "folders":
            return cmd_folders(s3, prefix)
        if command in ("create", "list", "fetch"):
            if len(argv) < 3:
                print(f"폴더 이름이 필요하다: {command} <폴더>", file=sys.stderr)
                return 2
            folder = argv[2]
            if command == "create":
                return cmd_create(s3, prefix, folder)
            if command == "list":
                return cmd_list(s3, prefix, folder)
            return cmd_fetch(s3, prefix, folder)
    except ValueError as exc:
        print(exc, file=sys.stderr)
        return 2
    except S3HttpError as exc:
        print(exc, file=sys.stderr)
        return 1

    print(f"모르는 명령: {command}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
