#!/usr/bin/env python3
"""Validate and publish a bounded HTML report to Cloudflare Pages."""

from __future__ import annotations

import argparse
import html.parser
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

WRANGLER_VERSION = "4.115.0"
DEFAULT_PROJECT = "fos-reports"
MAX_FILE_COUNT = 1_000
# Cloudflare Pages는 분기 별칭 서브도메인을 28자로 잘라낸다.
# slug가 이보다 길면 별칭 주소가 slug와 달라져 검증이 실패하고,
# 앞 28자가 같은 두 리포트는 같은 별칭을 공유해 서로를 덮어쓴다.
MAX_BRANCH_ALIAS_LENGTH = 28
MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_TOTAL_BYTES = 100 * 1024 * 1024
SLUG_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
URL_PATTERN = re.compile(r"https://[a-z0-9.-]+\.pages\.dev(?:/[^\s]*)?", re.IGNORECASE)
ANSI_PATTERN = re.compile(r"\x1b\[[0-9;]*m")

BLOCKED_NAMES = {
    ".env",
    ".git",
    ".DS_Store",
    "id_rsa",
    "id_ed25519",
}
BLOCKED_SUFFIXES = {
    ".db",
    ".key",
    ".p12",
    ".pem",
    ".pfx",
    ".sqlite",
    ".sqlite3",
}
TEXT_SUFFIXES = {
    ".css",
    ".csv",
    ".html",
    ".htm",
    ".js",
    ".json",
    ".map",
    ".md",
    ".svg",
    ".txt",
    ".xml",
    ".yaml",
    ".yml",
}
SENSITIVE_PATTERNS = {
    "private key": re.compile(
        r"-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----"
    ),
    "Cloudflare API token name": re.compile(r"\bCLOUDFLARE_API_TOKEN\b"),
    "AWS secret name": re.compile(r"\bAWS_SECRET_ACCESS_KEY\b"),
    "GitHub token name": re.compile(r"\bGITHUB_TOKEN\b"),
    "OpenAI-style token": re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
    "local file URL": re.compile(r"\bfile://", re.IGNORECASE),
    "macOS absolute home path": re.compile(r"/Users/[^/\s\"'<>]+/"),
    "Linux absolute home path": re.compile(r"/home/[^/\s\"'<>]+/"),
    "Windows absolute home path": re.compile(
        r"[A-Za-z]:\\Users\\[^\\\s\"'<>]+\\", re.IGNORECASE
    ),
    "localhost URL": re.compile(
        r"https?://(?:localhost|127\.0\.0\.1|\[?::1\]?)(?::\d+)?",
        re.IGNORECASE,
    ),
    "private IPv4 URL": re.compile(
        r"https?://(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
        r"|192\.168\.\d{1,3}\.\d{1,3}"
        r"|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d+)?",
        re.IGNORECASE,
    ),
}


class PublishError(RuntimeError):
    """Expected validation or deployment failure."""


class ReferenceCollector(html.parser.HTMLParser):
    """Collect file-like references from HTML attributes."""

    def __init__(self) -> None:
        super().__init__()
        self.references: list[str] = []

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        del tag
        for name, value in attrs:
            if name.lower() in {"href", "src", "poster"} and value:
                self.references.append(value.strip())
            if name.lower() == "srcset" and value:
                self.references.extend(parse_srcset(value))


@dataclass(frozen=True)
class PreparedReport:
    source: str
    slug: str
    project_name: str
    entry: str
    file_count: int
    total_bytes: int
    files: list[str]
    expected_branch_url: str
    warnings: list[str]


def emit_json(payload: dict[str, object]) -> None:
    print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))


def repo_root() -> Path:
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise PublishError("Git 저장소 안에서 실행해야 합니다.")
    return Path(result.stdout.strip()).resolve()


def validate_slug(slug: str) -> None:
    if not SLUG_PATTERN.fullmatch(slug):
        raise PublishError(
            "slug는 1-63자의 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다."
        )
    if "--" in slug:
        raise PublishError("slug에 연속 하이픈을 사용할 수 없습니다.")


def validate_report_slug(slug: str) -> None:
    # 길이를 먼저 본다. validate_slug의 1-63자 메시지가 앞서면
    # 64자 이상 slug를 준 사용자가 정작 지켜야 하는 28자 상한을 안내받지 못한다.
    if len(slug) > MAX_BRANCH_ALIAS_LENGTH:
        raise PublishError(
            f"리포트 slug는 {MAX_BRANCH_ALIAS_LENGTH}자 이내여야 합니다. "
            f"Cloudflare Pages가 분기 별칭 주소를 {MAX_BRANCH_ALIAS_LENGTH}자로 잘라내므로 "
            f"더 길면 안정 주소를 검증할 수 없고 앞부분이 같은 리포트끼리 주소가 겹칩니다: "
            f"{slug} ({len(slug)}자)"
        )
    validate_slug(slug)
    if slug == "main":
        raise PublishError("production branch인 main은 리포트 slug로 사용할 수 없습니다.")


def ensure_source_scope(source: Path, root: Path) -> Path:
    try:
        resolved = source.resolve(strict=True)
    except FileNotFoundError as exc:
        raise PublishError(f"게시 대상을 찾을 수 없습니다: {source}") from exc
    temp_root = Path(tempfile.gettempdir()).resolve()
    in_repo = resolved.is_relative_to(root)
    in_temp = resolved.is_relative_to(temp_root)
    if not in_repo and not in_temp:
        raise PublishError(
            "게시 대상은 현재 저장소 또는 시스템 임시 디렉터리 안에 있어야 합니다."
        )
    if resolved in {root, temp_root}:
        raise PublishError("저장소나 시스템 임시 디렉터리의 루트는 게시할 수 없습니다.")
    if resolved.is_symlink() or source.is_symlink():
        raise PublishError("심볼릭 링크는 게시 대상으로 사용할 수 없습니다.")
    return resolved


def source_label(source: Path, root: Path) -> str:
    if source.is_relative_to(root):
        return str(source.relative_to(root))
    return f"system-temp/{source.name}"


def is_hidden_or_blocked(path: Path, base: Path) -> str | None:
    relative = path.relative_to(base)
    for part in relative.parts:
        if part.startswith("."):
            return f"숨김 경로는 게시할 수 없습니다: {relative}"
        if part in BLOCKED_NAMES:
            return f"차단된 파일 이름입니다: {relative}"
    if path.suffix.lower() in BLOCKED_SUFFIXES:
        return f"민감할 수 있는 파일 형식입니다: {relative}"
    return None


def iter_source_files(source: Path) -> Iterable[Path]:
    if source.is_file():
        yield source
        return
    if not source.is_dir():
        raise PublishError("게시 대상은 HTML 파일이나 디렉터리여야 합니다.")
    for current_root, dir_names, file_names in os.walk(source, followlinks=False):
        current = Path(current_root)
        for directory in list(dir_names):
            candidate = current / directory
            if candidate.is_symlink():
                raise PublishError(
                    f"심볼릭 링크 디렉터리는 게시할 수 없습니다: "
                    f"{candidate.relative_to(source)}"
                )
        for file_name in file_names:
            candidate = current / file_name
            if candidate.is_symlink():
                raise PublishError(
                    f"심볼릭 링크 파일은 게시할 수 없습니다: "
                    f"{candidate.relative_to(source)}"
                )
            yield candidate


def read_text(path: Path) -> str | None:
    if path.suffix.lower() not in TEXT_SUFFIXES:
        return None
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        raise PublishError(f"UTF-8로 읽을 수 없는 텍스트 파일입니다: {path}") from exc


def scan_sensitive_text(path: Path, text: str, base: Path) -> None:
    for label, pattern in SENSITIVE_PATTERNS.items():
        if pattern.search(text):
            relative = path.relative_to(base)
            raise PublishError(f"공개 차단 패턴 발견: {label} ({relative})")


def is_external_reference(value: str) -> bool:
    lowered = value.lower()
    return lowered.startswith(
        (
            "#",
            "data:image/",
            "https://",
            "mailto:",
            "tel:",
        )
    )


def parse_srcset(value: str) -> list[str]:
    stripped = value.strip()
    if stripped.lower().startswith("data:image/"):
        return [stripped.split(maxsplit=1)[0]]
    return [
        candidate.strip().split(maxsplit=1)[0]
        for candidate in stripped.split(",")
        if candidate.strip()
    ]


def validate_single_html_references(source: Path, text: str) -> None:
    collector = ReferenceCollector()
    collector.feed(text)
    references = list(collector.references)
    references.extend(
        match.group(1).strip(" \"'")
        for match in re.finditer(r"url\(([^)]+)\)", text, re.IGNORECASE)
    )
    local = sorted(
        {
            value
            for value in references
            if value and not is_external_reference(value)
        }
    )
    if local:
        joined = ", ".join(local[:5])
        raise PublishError(
            "단일 HTML이 로컬 또는 허용되지 않은 URL을 참조합니다. "
            "로컬 자산이면 index.html과 자산을 담은 디렉터리를 입력하고, "
            f"외부 자산이면 HTTPS를 사용하세요: {joined}"
        )
    if source.suffix.lower() not in {".html", ".htm"}:
        raise PublishError("단일 파일 게시 대상은 HTML이어야 합니다.")


def validate_entry_path(source: Path, entry: str | None) -> str:
    entry_name = entry or "index.html"
    if "\\" in entry_name or re.match(r"^[A-Za-z]:", entry_name):
        raise PublishError("entry는 디렉터리 안의 상대 POSIX 경로여야 합니다.")
    relative = Path(entry_name)
    if relative.is_absolute() or not relative.parts:
        raise PublishError("entry는 디렉터리 안의 상대 경로여야 합니다.")
    if any(part in {".", ".."} or part.startswith(".") for part in relative.parts):
        raise PublishError("entry에 숨김 경로나 상위 경로 이동을 사용할 수 없습니다.")
    if relative.suffix.lower() not in {".html", ".htm"}:
        raise PublishError("entry는 HTML 파일이어야 합니다.")
    try:
        resolved = (source / relative).resolve(strict=True)
        resolved.relative_to(source.resolve())
    except (FileNotFoundError, ValueError) as exc:
        raise PublishError("entry는 게시 대상 디렉터리 안에 있어야 합니다.") from exc
    if not resolved.is_file() or resolved.is_symlink():
        raise PublishError("entry는 심볼릭 링크가 아닌 HTML 파일이어야 합니다.")
    return relative.as_posix()


def copy_report(source: Path, stage: Path, entry: str | None) -> str:
    if source.is_file():
        text = read_text(source)
        if text is None:
            raise PublishError("단일 파일 게시 대상은 HTML이어야 합니다.")
        validate_single_html_references(source, text)
        shutil.copy2(source, stage / "index.html")
        return "index.html"

    entry_name = validate_entry_path(source, entry)
    shutil.copytree(source, stage, dirs_exist_ok=True)
    if entry_name != "index.html":
        shutil.copy2(stage / entry_name, stage / "index.html")
    return "index.html"


def prepare_report(
    source_arg: str,
    slug: str,
    project_name: str,
    entry: str | None,
    stage: Path,
) -> PreparedReport:
    validate_report_slug(slug)
    validate_slug(project_name)
    root = repo_root()
    source = ensure_source_scope(Path(source_arg), root)
    source_base = source.parent if source.is_file() else source

    source_files = list(iter_source_files(source))
    if not source_files:
        raise PublishError("게시 대상에 파일이 없습니다.")
    if len(source_files) > MAX_FILE_COUNT:
        raise PublishError(
            f"파일 수가 제한을 넘었습니다: {len(source_files)} > {MAX_FILE_COUNT}"
        )

    total_bytes = 0
    for path in source_files:
        blocked = is_hidden_or_blocked(path, source_base)
        if blocked:
            raise PublishError(blocked)
        size = path.stat().st_size
        if size > MAX_FILE_BYTES:
            raise PublishError(
                f"파일 크기가 25 MiB 제한을 넘었습니다: "
                f"{path.relative_to(source_base)}"
            )
        total_bytes += size
        text = read_text(path)
        if text is not None:
            scan_sensitive_text(path, text, source_base)
    if total_bytes > MAX_TOTAL_BYTES:
        raise PublishError(
            f"전체 크기가 제한을 넘었습니다: {total_bytes} > {MAX_TOTAL_BYTES}"
        )

    stage.mkdir(parents=True, exist_ok=True)
    entry_name = copy_report(source, stage, entry)
    staged_files = sorted(
        str(path.relative_to(stage))
        for path in stage.rglob("*")
        if path.is_file()
    )
    return PreparedReport(
        source=source_label(source, root),
        slug=slug,
        project_name=project_name,
        entry=entry_name,
        file_count=len(staged_files),
        total_bytes=sum(
            path.stat().st_size for path in stage.rglob("*") if path.is_file()
        ),
        files=staged_files,
        expected_branch_url=f"https://{slug}.{project_name}.pages.dev/",
        warnings=[
            "자동 검사는 공개 안전성을 보장하지 않습니다.",
            "Cloudflare Pages 미리보기 주소도 공개 주소입니다.",
        ],
    )


def wrangler_command() -> list[str]:
    return ["npx", "--yes", f"wrangler@{WRANGLER_VERSION}"]


def clean_output(value: str) -> str:
    cleaned = ANSI_PATTERN.sub("", value)
    cleaned = re.sub(
        r"https://dash\.cloudflare\.com/oauth2/auth\?\S+",
        "[REDACTED_OAUTH_URL]",
        cleaned,
    )
    cleaned = re.sub(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
        "[REDACTED_EMAIL]",
        cleaned,
    )
    cleaned = re.sub(r"\b[a-f0-9]{32}\b", "[REDACTED_ACCOUNT_ID]", cleaned)
    sensitive_assignment = re.compile(
        r"(?i)(token|authorization|secret)\s*[:=]\s*\S+"
    )
    return sensitive_assignment.sub(r"\1=[REDACTED]", cleaned)


def run_wrangler(args: list[str], cwd: Path, timeout: int = 300) -> str:
    result = subprocess.run(
        wrangler_command() + args,
        cwd=cwd,
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    output = clean_output("\n".join((result.stdout, result.stderr)).strip())
    if result.returncode != 0:
        raise PublishError(f"Wrangler 실행 실패:\n{output[-4_000:]}")
    return output


def check_authentication(output: str) -> None:
    unauthenticated_markers = (
        "you are not authenticated",
        "please run `wrangler login`",
    )
    lowered = output.lower()
    if any(marker in lowered for marker in unauthenticated_markers):
        raise PublishError(
            "Cloudflare 인증이 없습니다. "
            f"`npx wrangler@{WRANGLER_VERSION} login`을 먼저 실행하세요."
        )


def verify_url_with_curl(url: str) -> dict[str, object]:
    marker_status = "__FOS_HTTP_STATUS__:"
    marker_url = "__FOS_EFFECTIVE_URL__:"
    result = subprocess.run(
        [
            "curl",
            "--fail",
            "--silent",
            "--show-error",
            "--location",
            "--max-time",
            "20",
            "--user-agent",
            "fos-report-publisher/1.0",
            "--write-out",
            f"\n{marker_status}%{{http_code}}\n{marker_url}%{{url_effective}}\n",
            url,
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    output = result.stdout
    status_match = re.search(rf"{marker_status}(\d{{3}})", output)
    url_match = re.search(rf"{marker_url}([^\r\n]+)", output)
    body = output.split(f"\n{marker_status}", maxsplit=1)[0]
    title_match = re.search(
        r"<title[^>]*>(.*?)</title>",
        body,
        re.IGNORECASE | re.DOTALL,
    )
    title = (
        re.sub(r"\s+", " ", title_match.group(1)).strip() if title_match else ""
    )
    status = int(status_match.group(1)) if status_match else None
    return {
        "ok": result.returncode == 0 and status is not None and 200 <= status < 400,
        "status": status,
        "title": title,
        "url": url_match.group(1) if url_match else url,
        "error": clean_output(result.stderr.strip()) if result.returncode else "",
    }


def verify_url(url: str, attempts: int = 6) -> dict[str, object]:
    last_error = ""
    for attempt in range(attempts):
        if shutil.which("curl"):
            curl_result = verify_url_with_curl(url)
            if curl_result.get("ok"):
                return curl_result
            last_error = str(curl_result.get("error") or curl_result)
            if attempt + 1 < attempts:
                time.sleep(2)
            continue
        try:
            request = urllib.request.Request(
                url,
                headers={"User-Agent": "fos-report-publisher/1.0"},
            )
            with urllib.request.urlopen(request, timeout=15) as response:
                body = response.read(512_000).decode("utf-8", errors="replace")
                title_match = re.search(
                    r"<title[^>]*>(.*?)</title>",
                    body,
                    re.IGNORECASE | re.DOTALL,
                )
                title = (
                    re.sub(r"\s+", " ", title_match.group(1)).strip()
                    if title_match
                    else ""
                )
                return {
                    "ok": 200 <= response.status < 400,
                    "status": response.status,
                    "title": title,
                    "url": response.geturl(),
                }
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = str(exc)
            if attempt + 1 < attempts:
                time.sleep(2)
    return {"ok": False, "status": None, "title": "", "error": last_error, "url": url}


def publish_report(args: argparse.Namespace) -> dict[str, object]:
    if not args.confirm_public:
        raise PublishError("외부 게시에는 --confirm-public이 필요합니다.")
    with tempfile.TemporaryDirectory(prefix="fos-report-publish-") as temp_dir:
        stage = Path(temp_dir) / "site"
        prepared = prepare_report(
            args.source,
            args.slug,
            args.project_name,
            args.entry,
            stage,
        )
        output = run_wrangler(
            [
                "pages",
                "deploy",
                str(stage),
                "--project-name",
                args.project_name,
                "--branch",
                args.slug,
            ],
            cwd=repo_root(),
        )
        urls = list(dict.fromkeys(URL_PATTERN.findall(output)))
        deployment_url = next(
            (
                url
                for url in urls
                if url.rstrip("/") != prepared.expected_branch_url.rstrip("/")
            ),
            urls[0] if urls else "",
        )
        if not deployment_url:
            raise PublishError("Wrangler 출력에서 배포 URL을 찾지 못했습니다.")
        verification = verify_url(deployment_url)
        if not verification.get("ok"):
            raise PublishError(
                "배포는 생성됐지만 공개 URL 검증에 실패했습니다: "
                f"{json.dumps(verification, ensure_ascii=False)}"
            )
        branch_verification = verify_url(prepared.expected_branch_url, attempts=1)
        branch_url = (
            prepared.expected_branch_url if branch_verification.get("ok") else None
        )
        return {
            "status": "published",
            "public_url": deployment_url,
            "deployment_url": deployment_url,
            "branch_url": branch_url,
            "verification": verification,
            "branch_verification": branch_verification,
            "report": asdict(prepared),
        }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="공개 가능한 HTML 리포트를 Cloudflare Pages에 게시합니다."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    for command in ("prepare", "publish"):
        subparser = subparsers.add_parser(command)
        subparser.add_argument("--source", required=True)
        subparser.add_argument("--slug", required=True)
        subparser.add_argument("--project-name", default=DEFAULT_PROJECT)
        subparser.add_argument("--entry")
        if command == "publish":
            subparser.add_argument("--confirm-public", action="store_true")

    auth_parser = subparsers.add_parser("check-auth")
    auth_parser.add_argument("--project-name", default=DEFAULT_PROJECT)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        if args.command == "prepare":
            with tempfile.TemporaryDirectory(prefix="fos-report-prepare-") as temp_dir:
                prepared = prepare_report(
                    args.source,
                    args.slug,
                    args.project_name,
                    args.entry,
                    Path(temp_dir) / "site",
                )
                emit_json({"status": "prepared", "report": asdict(prepared)})
        elif args.command == "publish":
            emit_json(publish_report(args))
        elif args.command == "check-auth":
            output = run_wrangler(["whoami"], cwd=repo_root(), timeout=120)
            check_authentication(output)
            emit_json(
                {
                    "status": "authenticated",
                    "project_name": args.project_name,
                    "wrangler_version": WRANGLER_VERSION,
                    "pages_write": "pages (write)" in output.lower(),
                }
            )
        return 0
    except PublishError as exc:
        emit_json({"status": "error", "error": str(exc)})
        return 1
    except subprocess.TimeoutExpired:
        emit_json({"status": "error", "error": "Wrangler 실행 시간이 초과됐습니다."})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
