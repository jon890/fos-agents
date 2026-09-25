"""네이버 편집기에 초안의 제목과 본문 글자를 넣는다."""

from __future__ import annotations

import argparse
import sys

from cdp import Page
from naver_editor_core import (
    BODY_SELECTOR,
    TITLE_SELECTOR,
    body_lines,
    body_mismatch,
    clear_field,
    focus,
    new_paragraph,
    normalize,
    paragraphs,
    require_clear_screen,
    set_stage,
    type_line,
)


def cmd_fill(page: Page, args: argparse.Namespace) -> int:
    """초안의 제목과 본문을 넣는다."""
    draft = args.draft_data
    set_stage(page, args, "fill", False)
    title = draft.get("title")
    if not title:
        print("초안에 `title` 이 없다. 제목을 먼저 고른다.", file=sys.stderr)
        return 1

    note = require_clear_screen(page)
    if note:
        print(f"화면을 덮은 알림이 있어 글자를 넣지 못한다: {note}", file=sys.stderr)
        print("`open` 을 다시 불러 알림을 지난 뒤 다시 넣는다.", file=sys.stderr)
        return 1

    if not focus(page, TITLE_SELECTOR, ".se-documentTitle"):
        print("제목 자리에 커서를 두지 못했다", file=sys.stderr)
        return 1
    clear_field(page)
    type_line(page, TITLE_SELECTOR, title)

    if not focus(page, BODY_SELECTOR, ".se-component.se-text"):
        print("본문 자리에 커서를 두지 못했다", file=sys.stderr)
        return 1
    clear_field(page)
    lines = body_lines(draft)
    for index, line in enumerate(lines):
        if line:
            type_line(page, BODY_SELECTOR, line)
        if index != len(lines) - 1:
            new_paragraph(page, BODY_SELECTOR)

    landed = normalize("".join(paragraphs(page, TITLE_SELECTOR)))
    if landed != normalize(title):
        print(f"제목이 들어가지 않았다. 화면에 있는 것: {landed!r}", file=sys.stderr)
        return 1

    want = [normalize(line) for line in lines if normalize(line)]
    got = [text for text in map(normalize, paragraphs(page, BODY_SELECTOR)) if text]
    wrong = body_mismatch(want, got)
    if wrong:
        print(
            f"본문이 초안과 다르다. 초안 {len(want)}줄 {sum(map(len, want))}자,"
            f" 화면 {len(got)}줄 {sum(map(len, got))}자",
            file=sys.stderr,
        )
        print(wrong, file=sys.stderr)
        return 1

    print(f"제목과 본문 {len(want)}줄 {sum(map(len, want))}자를 넣었다. 초안과 같다")
    set_stage(page, args, "fill", True)
    return 0
