# Phase 05 — 검증

**Model**: sonnet
**Status**: completed

## 목표

정리 후 무결성 검증.

## 작업

- **삭제 23개 잔여 참조 0**: `grep -rEn "ADR-0(11|23|34|45|46|48|49|50|53|54|60|61|64|65|67|68|75|77|78|81|82|83|84)\b" career-os/docs career-os/.claude` — 삭제 대상을 가리키는 참조 0. **`grep -E`(ERE) 필수** — `( )`·`|`는 BRE(plain grep)에서 리터럴이 되어 매칭이 안 되고 dangling이 있어도 조용히 exit 1로 오통과한다.
- **merge 제거분 잔여 참조 0(MAJOR-2)**: `grep -rEn "ADR-094\b|ADR-043\b|ADR-047\b|ADR-051\b" career-os/docs career-os/.claude career-os/scripts` — 병합본(101/adapter 병합본)으로 리다이렉트되지 않은 잔존 참조 0. **`grep -E` + `scripts/` 범위 포함 필수**(`|` 문법 + ADR-094가 recommendation_schema.ts·render_recommendation.ts 주석에 있음). 단 병합본 자신의 Supersedes 표기는 예외.
- **ADR-102 Supersedes 검증**: 15개(053·060·065·078 포함, 077 미포함) 등재 확인.
- docs-check 자동화 재실행: INDEX ↔ 파일 sync OK, config schema alignment OK.
- INDEX 행 수 = 실제 ADR 파일 수.
- code-architecture ADR 수치 정합.

## 성공 기준

- dangling ADR 링크 0(삭제 23개 + merge 제거분 094·043·047·051 모두).
- ADR-102 Supersedes = 15개.
- docs-check 자동화 clean.
- INDEX ↔ 파일 정합.

## 실패 조건

- 깨진 [[ADR]] 링크(삭제분 또는 merge 제거분) 또는 INDEX 불일치가 남으면 실패.
