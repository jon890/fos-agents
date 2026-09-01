#!/usr/bin/env python3
"""Immutable home-server storage endpoint for the career workspace."""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import re
import shutil
import sys
import tarfile
import tempfile
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import BinaryIO, NoReturn


SCHEMA_VERSION = 1
WORKSPACE = "career-os"
MANAGED_ROOTS = ("applications", "library", "state")
REVISION_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
ISO_UTC_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$")
DEFAULT_MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024


class StorageError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def fail(action: str, code: str) -> NoReturn:
    json.dump(
        {
            "schemaVersion": SCHEMA_VERSION,
            "action": action,
            "ok": False,
            "code": code,
        },
        sys.stderr,
        separators=(",", ":"),
    )
    sys.stderr.write("\n")
    raise SystemExit(1)


def write_json(value: object) -> None:
    json.dump(value, sys.stdout, separators=(",", ":"))
    sys.stdout.write("\n")


def storage_root() -> Path:
    configured = os.environ.get("CAREER_STORAGE_ROOT")
    root = Path(configured).expanduser() if configured else Path.home() / ".hermes/storage/career-os"
    return root.resolve()


def validate_revision(value: object) -> str:
    if not isinstance(value, str) or REVISION_PATTERN.fullmatch(value) is None:
        raise StorageError("INVALID_MANIFEST")
    return value


def validate_sha256(value: object) -> str:
    if not isinstance(value, str) or SHA256_PATTERN.fullmatch(value) is None:
        raise StorageError("INVALID_MANIFEST")
    return value


def validate_workspace_path(value: object) -> str:
    if not isinstance(value, str) or not value or "\\" in value or any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise StorageError("INVALID_MANIFEST")
    path = PurePosixPath(value)
    parts = path.parts
    if path.is_absolute() or any(part in ("", ".", "..") for part in parts):
        raise StorageError("INVALID_MANIFEST")
    if len(parts) < 2 or parts[0] not in MANAGED_ROOTS:
        raise StorageError("INVALID_MANIFEST")
    return value


def validate_producer(value: object) -> dict[str, str]:
    if not isinstance(value, dict) or set(value) != {"skill", "mode"}:
        raise StorageError("INVALID_MANIFEST")
    skill = value.get("skill")
    mode = value.get("mode")
    if not isinstance(skill, str) or not skill.strip() or mode not in ("interactive", "automation"):
        raise StorageError("INVALID_MANIFEST")
    return {"skill": skill, "mode": mode}


def validate_files(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        raise StorageError("INVALID_MANIFEST")
    files: list[dict[str, object]] = []
    seen: set[str] = set()
    for entry in value:
        if not isinstance(entry, dict) or set(entry) != {"path", "size", "sha256"}:
            raise StorageError("INVALID_MANIFEST")
        relative_path = validate_workspace_path(entry.get("path"))
        size = entry.get("size")
        if not isinstance(size, int) or isinstance(size, bool) or size < 0:
            raise StorageError("INVALID_MANIFEST")
        digest = validate_sha256(entry.get("sha256"))
        if relative_path in seen:
            raise StorageError("INVALID_MANIFEST")
        seen.add(relative_path)
        files.append({"path": relative_path, "size": size, "sha256": digest})
    return files


def validate_draft(value: object) -> dict[str, object]:
    expected = {"schemaVersion", "workspace", "parentRevision", "producer", "contentDigest", "files"}
    if not isinstance(value, dict) or set(value) != expected:
        raise StorageError("INVALID_MANIFEST")
    if type(value.get("schemaVersion")) is not int or value.get("schemaVersion") != SCHEMA_VERSION or value.get("workspace") != WORKSPACE:
        raise StorageError("INVALID_MANIFEST")
    parent = value.get("parentRevision")
    if parent is not None:
        parent = validate_revision(parent)
    return {
        "schemaVersion": SCHEMA_VERSION,
        "workspace": WORKSPACE,
        "parentRevision": parent,
        "producer": validate_producer(value.get("producer")),
        "contentDigest": validate_sha256(value.get("contentDigest")),
        "files": validate_files(value.get("files")),
    }


def validate_release(value: object, expected_revision: str) -> dict[str, object]:
    if not isinstance(value, dict):
        raise StorageError("INVALID_MANIFEST")
    expected = {
        "schemaVersion",
        "workspace",
        "parentRevision",
        "producer",
        "contentDigest",
        "files",
        "revision",
        "createdAt",
    }
    if set(value) != expected:
        raise StorageError("INVALID_MANIFEST")
    draft = validate_draft({key: value[key] for key in value if key not in ("revision", "createdAt")})
    revision = validate_revision(value.get("revision"))
    created_at = value.get("createdAt")
    if revision != expected_revision or not isinstance(created_at, str) or ISO_UTC_PATTERN.fullmatch(created_at) is None:
        raise StorageError("INVALID_MANIFEST")
    try:
        parsed = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    except ValueError as error:
        raise StorageError("INVALID_MANIFEST") from error
    if parsed.tzinfo is None:
        raise StorageError("INVALID_MANIFEST")
    return {**draft, "revision": revision, "createdAt": created_at}


def read_current_manifest(root: Path) -> dict[str, object] | None:
    current = root / "current"
    if not current.exists() and not current.is_symlink():
        return None
    if not current.is_symlink():
        raise StorageError("INVALID_MANIFEST")
    target = os.readlink(current)
    revision = Path(target).name
    if target != f"releases/{revision}":
        raise StorageError("INVALID_MANIFEST")
    validate_revision(revision)
    manifest_path = root / "releases" / revision / "workspace-manifest.json"
    try:
        value = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise StorageError("INVALID_MANIFEST") from error
    return validate_release(value, revision)


def javascript_sort_key(value: str) -> bytes:
    return value.encode("utf-16-be")


def digest_files(files: list[dict[str, object]]) -> str:
    digest = hashlib.sha256()
    for entry in sorted(files, key=lambda item: javascript_sort_key(str(item["path"]))):
        digest.update(str(entry["path"]).encode())
        digest.update(b"\0")
        digest.update(str(entry["size"]).encode())
        digest.update(b"\0")
        digest.update(str(entry["sha256"]).encode())
        digest.update(b"\n")
    return digest.hexdigest()


def collect_files(root: Path) -> list[dict[str, object]]:
    files: list[dict[str, object]] = []
    for managed_root in MANAGED_ROOTS:
        base = root / managed_root
        if not base.is_dir() or base.is_symlink():
            raise StorageError("INVALID_MANIFEST")
        for current_root, directory_names, file_names in os.walk(base, followlinks=False):
            current_path = Path(current_root)
            for directory_name in directory_names:
                if (current_path / directory_name).is_symlink():
                    raise StorageError("INVALID_MANIFEST")
            for file_name in file_names:
                source = current_path / file_name
                if not source.is_file() or source.is_symlink():
                    raise StorageError("INVALID_MANIFEST")
                relative = source.relative_to(root).as_posix()
                validate_workspace_path(relative)
                body_digest = hashlib.sha256()
                size = 0
                with source.open("rb") as stream:
                    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                        size += len(chunk)
                        body_digest.update(chunk)
                files.append({"path": relative, "size": size, "sha256": body_digest.hexdigest()})
    return sorted(files, key=lambda item: javascript_sort_key(str(item["path"])))


def normalized_tar_name(name: str) -> str:
    normalized = name[2:] if name.startswith("./") else name
    normalized = normalized[:-1] if normalized.endswith("/") else normalized
    if not normalized or "\\" in normalized or any(ord(char) < 32 or ord(char) == 127 for char in normalized):
        raise StorageError("INVALID_MANIFEST")
    raw_parts = normalized.split("/")
    if any(part in ("", ".", "..") for part in raw_parts):
        raise StorageError("INVALID_MANIFEST")
    path = PurePosixPath(normalized)
    if path.is_absolute():
        raise StorageError("INVALID_MANIFEST")
    return normalized


def validate_and_extract_archive(archive_path: Path, destination: Path) -> None:
    expected_top_levels = {"workspace-draft.json", *MANAGED_ROOTS}
    seen_exact: set[str] = set()
    try:
        with tarfile.open(archive_path, mode="r:") as archive:
            members = archive.getmembers()
            if not members:
                raise StorageError("INVALID_MANIFEST")
            validated: list[tuple[tarfile.TarInfo, str]] = []
            seen_names: set[str] = set()
            for member in members:
                name = normalized_tar_name(member.name)
                if name in seen_names:
                    raise StorageError("INVALID_MANIFEST")
                seen_names.add(name)
                top_level = name.split("/", 1)[0]
                if top_level not in expected_top_levels or not (member.isfile() or member.isdir()):
                    raise StorageError("INVALID_MANIFEST")
                exact = name == top_level
                if top_level == "workspace-draft.json":
                    if not exact or not member.isfile():
                        raise StorageError("INVALID_MANIFEST")
                elif exact and not member.isdir():
                    raise StorageError("INVALID_MANIFEST")
                if exact:
                    seen_exact.add(top_level)
                validated.append((member, name))
            if seen_exact != expected_top_levels:
                raise StorageError("INVALID_MANIFEST")
            for member, name in validated:
                target = destination.joinpath(*PurePosixPath(name).parts)
                if member.isdir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                source = archive.extractfile(member)
                if source is None:
                    raise StorageError("TRANSFER_FAILED")
                with source, target.open("xb") as output:
                    shutil.copyfileobj(source, output)
    except StorageError:
        raise
    except (OSError, tarfile.TarError) as error:
        raise StorageError("TRANSFER_FAILED") from error


def receive_archive(stream: BinaryIO, destination: Path) -> None:
    limit = int(os.environ.get("CAREER_STORAGE_MAX_ARCHIVE_BYTES", DEFAULT_MAX_ARCHIVE_BYTES))
    total = 0
    with destination.open("xb") as output:
        while True:
            chunk = stream.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > limit:
                raise StorageError("TRANSFER_FAILED")
            output.write(chunk)
    if total == 0:
        raise StorageError("TRANSFER_FAILED")


def status(root: Path) -> None:
    current = read_current_manifest(root)
    write_json(
        {
            "schemaVersion": SCHEMA_VERSION,
            "action": "status",
            "ok": True,
            "workspace": WORKSPACE,
            "current": None
            if current is None
            else {
                "revision": current["revision"],
                "contentDigest": current["contentDigest"],
                "createdAt": current["createdAt"],
                "fileCount": len(current["files"]),
            },
        }
    )


def export_release(root: Path, revision: str) -> None:
    revision = validate_revision(revision)
    release = root / "releases" / revision
    if not release.is_dir():
        raise StorageError("REMOTE_UNINITIALIZED")
    read_current_manifest(root) if (root / "current").exists() else None
    manifest_path = release / "workspace-manifest.json"
    try:
        manifest = validate_release(json.loads(manifest_path.read_text(encoding="utf-8")), revision)
        actual_files = collect_files(release)
    except (OSError, json.JSONDecodeError) as error:
        raise StorageError("INVALID_MANIFEST") from error
    if actual_files != manifest["files"] or digest_files(actual_files) != manifest["contentDigest"]:
        raise StorageError("INVALID_MANIFEST")
    try:
        with tarfile.open(fileobj=sys.stdout.buffer, mode="w|", format=tarfile.USTAR_FORMAT) as archive:
            archive.add(manifest_path, arcname="workspace-manifest.json", recursive=False)
            for managed_root in MANAGED_ROOTS:
                archive.add(release / managed_root, arcname=managed_root, recursive=True)
    except (OSError, tarfile.TarError) as error:
        raise StorageError("TRANSFER_FAILED") from error


def publish(root: Path) -> None:
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    (root / "releases").mkdir(mode=0o700, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="publish-", dir=root) as temporary:
        temp_root = Path(temporary)
        archive_path = temp_root / "input.tar"
        extracted = temp_root / "extracted"
        extracted.mkdir()
        receive_archive(sys.stdin.buffer, archive_path)
        validate_and_extract_archive(archive_path, extracted)
        try:
            draft = validate_draft(json.loads((extracted / "workspace-draft.json").read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError) as error:
            raise StorageError("INVALID_MANIFEST") from error
        actual_files = collect_files(extracted)
        if actual_files != draft["files"] or digest_files(actual_files) != draft["contentDigest"]:
            raise StorageError("INVALID_MANIFEST")

        lock_path = root / ".publish.lock"
        with lock_path.open("a+b") as lock:
            try:
                fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as error:
                raise StorageError("REVISION_CONFLICT") from error
            current = read_current_manifest(root)
            current_revision = None if current is None else current["revision"]
            if current_revision != draft["parentRevision"]:
                raise StorageError("REVISION_CONFLICT")
            if current is not None and current["contentDigest"] == draft["contentDigest"]:
                write_json(
                    {
                        "schemaVersion": SCHEMA_VERSION,
                        "action": "publish",
                        "ok": True,
                        "revision": current["revision"],
                        "contentDigest": current["contentDigest"],
                        "createdAt": current["createdAt"],
                        "fileCount": len(current["files"]),
                        "noChange": True,
                    }
                )
                return

            created_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
            revision = f"rev-{int(time.time() * 1000)}-{uuid.uuid4().hex[:12]}"
            release_manifest = {**draft, "revision": revision, "createdAt": created_at}
            staging = root / "releases" / f".staging-{revision}-{uuid.uuid4().hex}"
            release = root / "releases" / revision
            staging.mkdir(mode=0o700)
            promoted = False
            try:
                for managed_root in MANAGED_ROOTS:
                    shutil.copytree(extracted / managed_root, staging / managed_root)
                (staging / "workspace-manifest.json").write_text(
                    json.dumps(release_manifest, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8",
                )
                staging.rename(release)
                promoted = True
                temporary_link = root / f"current.{os.getpid()}.{uuid.uuid4().hex}.tmp"
                temporary_link.symlink_to(f"releases/{revision}")
                temporary_link.replace(root / "current")
            except OSError:
                if "temporary_link" in locals():
                    temporary_link.unlink(missing_ok=True)
                if staging.exists():
                    shutil.rmtree(staging)
                if promoted and release.exists():
                    shutil.rmtree(release)
                raise

            write_json(
                {
                    "schemaVersion": SCHEMA_VERSION,
                    "action": "publish",
                    "ok": True,
                    "revision": revision,
                    "contentDigest": draft["contentDigest"],
                    "createdAt": created_at,
                    "fileCount": len(draft["files"]),
                    "noChange": False,
                }
            )


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(add_help=False)
    subparsers = parser.add_subparsers(dest="action", required=True)
    subparsers.add_parser("status", add_help=False)
    export_parser = subparsers.add_parser("export", add_help=False)
    export_parser.add_argument("--revision", required=True)
    subparsers.add_parser("publish", add_help=False)
    return parser.parse_args()


def main() -> None:
    os.umask(0o077)
    try:
        arguments = parse_arguments()
    except SystemExit:
        fail("status", "INVALID_MANIFEST")
    action = arguments.action
    try:
        root = storage_root()
        if action == "status":
            status(root)
        elif action == "export":
            export_release(root, arguments.revision)
        else:
            publish(root)
    except StorageError as error:
        fail(action, error.code)
    except (OSError, ValueError):
        fail(action, "TRANSPORT_UNAVAILABLE")


if __name__ == "__main__":
    main()
