#!/usr/bin/env python3
"""Apply small fos-study markdown safety rewrites to generated stock notes.

This is intentionally conservative: it targets parser-sensitive patterns we have
seen in generated prose, while leaving fenced code and inline code untouched.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


def split_inline_code(line: str) -> list[tuple[bool, str]]:
    parts: list[tuple[bool, str]] = []
    pos = 0
    for match in re.finditer(r"`[^`]*`", line):
        if match.start() > pos:
            parts.append((False, line[pos:match.start()]))
        parts.append((True, match.group(0)))
        pos = match.end()
    if pos < len(line):
        parts.append((False, line[pos:]))
    return parts


def sanitize_text_segment(text: str) -> str:
    # Avoid bold spans wrapping quoted phrases: **"..."** or
    # **... "..." ...** can confuse some markdown/MDX pipelines.
    # Keep the emphasis, drop quote marks inside the bold span.
    text = re.sub(r"\*\*[\"“”]([^\n*]+?)[\"“”]\*\*", r"**\1**", text)

    def strip_quotes_in_bold(match: re.Match[str]) -> str:
        inner = match.group(1).replace('"', '').replace('“', '').replace('”', '')
        return f"**{inner}**"

    text = re.sub(r"\*\*([^*\n]*[\"“”][^*\n]*)\*\*", strip_quotes_in_bold, text)

    # fos-study rule: **텍스트(English)** -> **텍스트**(English)
    # Only rewrite when the parenthesized suffix is at the end of the bold span.
    text = re.sub(r"\*\*([^*\n()]+?)\(([^()\n]+)\)\*\*", r"**\1**(\2)", text)

    # GFM can interpret two bare tildes in one paragraph as strikethrough.
    # Keep already-escaped tildes idempotent.
    text = re.sub(r"(?<!\\)~", r"\\~", text)
    return text


def sanitize(markdown: str) -> str:
    out: list[str] = []
    in_fence = False
    for line in markdown.splitlines(keepends=True):
        if line.lstrip().startswith("```"):
            out.append(line)
            in_fence = not in_fence
            continue
        if in_fence:
            out.append(line)
            continue
        chunks = split_inline_code(line)
        out.append("".join(part if is_code else sanitize_text_segment(part) for is_code, part in chunks))
    return "".join(out)


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: sanitize_fos_study_markdown.py <markdown-file>", file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    text = path.read_text(encoding="utf-8")
    sanitized = sanitize(text)
    if sanitized != text:
        path.write_text(sanitized, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
