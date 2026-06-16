#!/usr/bin/env python3
"""
adr.md를 개별 ADR 파일로 분해하는 스크립트.

동작:
- career-os/docs/adr.md를 읽어 ## ADR-N 헤더 기준으로 split
- 각 ADR을 career-os/docs/adr/ADR-NNN-slug.md 로 저장
- ADR 간 cross-ref를 [[ADR-NNN]] wiki 링크로 변환 (자기 헤더·ai-nodes 참조 제외)
- career-os/docs/adr/INDEX.md 생성
"""

import re
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]  # ai-nodes repo root
ADR_SRC = ROOT / "career-os" / "docs" / "adr.md"
ADR_OUT_DIR = ROOT / "career-os" / "docs" / "adr"


def make_slug(title: str) -> str:
    """ADR 제목에서 kebab-slug를 만든다."""
    # '— ' 이후 텍스트 추출
    if "—" in title:
        title = title.split("—", 1)[1].strip()
    # 소문자화
    slug = title.lower()
    # 한글·영문·숫자 이외 문자를 '-'로
    slug = re.sub(r"[^\w가-힣a-z0-9]+", "-", slug, flags=re.UNICODE)
    # 연속 '-' 1개로
    slug = re.sub(r"-+", "-", slug)
    # 양끝 '-' 제거
    slug = slug.strip("-")
    if not slug:
        slug = "adr"
    return slug


def convert_crossrefs(text: str, self_num: str) -> str:
    """
    ADR 본문에서 다른 ADR 참조를 [[ADR-NNN]] wiki 링크로 변환.

    제외:
    - 이미 [[ ]] 로 감싼 것
    - 자기 자신 헤더 줄 (## ADR-NNN —)
    - ai-nodes·모노레포 ADR 참조 (앞에 'ai-nodes ADR-' / '모노레포 ADR-' 패턴)
    """
    lines = text.split("\n")
    result = []
    for line in lines:
        # 헤더 줄은 변환하지 않음
        if re.match(r"^## ADR-", line):
            result.append(line)
            continue

        # ai-nodes / 모노레포 ADR 참조는 변환 제외를 위해 임시 마킹
        # 'ai-nodes ADR-NNN' 또는 '모노레포 ADR-NNN' 패턴을 임시 치환
        protected = {}
        counter = [0]

        def protect(m):
            key = f"\x00PROTECTED{counter[0]}\x00"
            counter[0] += 1
            protected[key] = m.group(0)
            return key

        # ai-nodes ADR- / 모노레포 ADR- 앞에 붙은 패턴 보호
        line_proc = re.sub(
            r"(?:ai-nodes|모노레포)\s+ADR-\d+",
            protect,
            line
        )
        # 이미 [[ ]] 로 감싼 것도 보호
        line_proc = re.sub(
            r"\[\[ADR-\d+\]\]",
            protect,
            line_proc
        )

        # 나머지 ADR-NNN 참조를 [[ADR-NNN]] 로 변환 (자기 자신 제외)
        def replace_ref(m):
            num = m.group(1)
            if num == self_num:
                return m.group(0)
            return f"[[ADR-{num}]]"

        line_proc = re.sub(r"\bADR-(\d+)\b", replace_ref, line_proc)

        # 보호했던 것 복원
        for key, val in protected.items():
            line_proc = line_proc.replace(key, val)

        result.append(line_proc)
    return "\n".join(result)


def extract_status(block: str) -> str:
    """ADR 본문에서 Status 값을 추출한다."""
    m = re.search(r"^-\s*Status:\s*(.+)$", block, re.MULTILINE)
    if m:
        return m.group(1).strip()
    return ""


def split_adr():
    """adr.md를 개별 ADR 파일로 분해하고 INDEX.md를 생성한다."""
    if not ADR_SRC.exists():
        print(f"ERROR: {ADR_SRC} 없음", file=sys.stderr)
        sys.exit(1)

    ADR_OUT_DIR.mkdir(parents=True, exist_ok=True)

    text = ADR_SRC.read_text(encoding="utf-8")
    lines = text.split("\n")

    # ## ADR-N 헤더 위치 찾기
    header_pattern = re.compile(r"^## ADR-(\d+)\b")
    headers = []
    for i, line in enumerate(lines):
        m = header_pattern.match(line)
        if m:
            headers.append((i, m.group(1), line))

    print(f"[원본 ADR 헤더 수] {len(headers)}")

    # 번호 중복 체크
    nums = [h[1] for h in headers]
    dup_nums = [n for n in set(nums) if nums.count(n) > 1]
    if dup_nums:
        print(f"ERROR: 번호 중복 ADR: {dup_nums}", file=sys.stderr)
        sys.exit(1)

    # 각 ADR 블록 추출 및 파일 생성
    adr_records = []
    slug_set = set()

    for idx, (line_start, num, header_line) in enumerate(headers):
        # 블록 끝: 다음 ## ADR- 헤더 직전 (또는 파일 끝)
        if idx + 1 < len(headers):
            line_end = headers[idx + 1][0]
        else:
            line_end = len(lines)

        block_lines = lines[line_start:line_end]

        # 블록 끝의 --- 구분선 제거
        while block_lines and block_lines[-1].strip() in ("---", ""):
            block_lines.pop()

        block = "\n".join(block_lines)

        # slug 생성
        slug = make_slug(header_line)

        # slug 충돌 체크
        if slug in slug_set:
            print(f"ERROR: slug 충돌 — ADR-{num}: '{slug}'", file=sys.stderr)
            sys.exit(1)
        slug_set.add(slug)

        # 파일명: 원본 번호 그대로 (ADR-1, ADR-001 등)
        filename = f"ADR-{num}-{slug}.md"
        out_path = ADR_OUT_DIR / filename

        # cross-ref 변환
        block = convert_crossrefs(block, num)

        # trailing newline 1개
        content = block.rstrip("\n") + "\n"
        out_path.write_text(content, encoding="utf-8")

        status = extract_status(block)
        title = header_line
        if "—" in title:
            title = title.split("—", 1)[1].strip()
        elif "-" in title:
            title = title.split("-", 1)[1].strip()

        adr_records.append({
            "num": num,
            "num_int": int(num),
            "title": title,
            "status": status,
            "filename": filename,
        })

    print(f"[생성된 ADR 파일 수] {len(adr_records)}")

    # INDEX.md 생성
    adr_records.sort(key=lambda r: r["num_int"])

    index_lines = [
        "# ADR INDEX — career-os",
        "",
        "개별 ADR 파일 조망 표. 새 ADR은 새 파일(`docs/adr/ADR-NNN-slug.md`) + 이 INDEX 행 추가.",
        "",
        "| ADR | 제목 | Status | 파일 |",
        "|---|---|---|---|",
    ]
    for r in adr_records:
        link = f"[{r['filename']}]({r['filename']})"
        index_lines.append(
            f"| ADR-{r['num']} | {r['title']} | {r['status']} | {link} |"
        )

    index_content = "\n".join(index_lines) + "\n"
    index_path = ADR_OUT_DIR / "INDEX.md"
    index_path.write_text(index_content, encoding="utf-8")
    print(f"[INDEX.md 행 수] {len(adr_records)}")

    # slug 충돌 없음 확인
    print(f"[slug 충돌] 없음")
    print("완료")


if __name__ == "__main__":
    split_adr()
