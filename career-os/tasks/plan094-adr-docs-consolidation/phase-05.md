# Phase 05 — 검증

**Model**: sonnet
**Status**: pending

## 목표

정리 후 무결성 검증.

## 작업

- `grep -rn "ADR-0(11|23|34|45|46|48|49|50|53|54|60|61|64|65|67|68|75|77|78|81|82|83|84)\b" career-os/docs career-os/.claude` — 삭제 대상을 가리키는 tombstone 외 참조 0.
- docs-check 자동화 재실행: INDEX ↔ 파일 sync OK, config schema alignment OK.
- INDEX 행 수 = 실제 ADR 파일 수.
- code-architecture ADR 수치 정합.

## 성공 기준

- dangling ADR 링크 0.
- docs-check 자동화 clean.
- INDEX ↔ 파일 정합.

## 실패 조건

- 깨진 [[ADR]] 링크 또는 INDEX 불일치가 남으면 실패.
