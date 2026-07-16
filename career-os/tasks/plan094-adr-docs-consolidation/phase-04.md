# Phase 04 — docs 다이어트

**Model**: sonnet
**Status**: completed

## 목표

code-architecture·data-schema의 drift·bloat·중복 정리.

## 중요 지침

구현 phase. 5문서 단일 출처 원칙 유지. 결정 근거는 ADR, 스키마는 data-schema 책임.

## 작업

- 착수 전 `wc -l docs/data-schema.md docs/code-architecture.md`로 정정 전 줄 수를 기록한다(측정 기준값).
- `code-architecture.md:44-45` ADR 수 "88개" → 실제 수로 정정 또는 "개별 파일"로 수치 제거(재발 방지). Phase 02·03 이후 실제 파일 수로 맞춘다.
- `data-schema.md:357-373` plan002 리다이렉트 stub 5개 제거.
- `data-schema.md` study-pack-topics·study-pack-candidates 이중 문서화 → 현행 1건 통합.
- `data-schema.md:177-187` 미실행 config diet 청소 목록 정리.
- interview-prep-analyzer `mvp_target_schema.ts` "사용 중" 기술 정정(#69 삭제 반영) — 실측 위치:
  - `code-architecture.md:239`·`:147-148`(디렉터리/트리 엔트리, 실제 파일 부재)·`:131-132`.
  - `data-schema.md:225`·`:1032-1033`.

## 성공 기준

- ADR 수 정합, plan002 stub·중복 제거.
- data-schema·code-architecture 줄 수를 정정 전후 실측 수치로 기록(예: 1490 → N줄). 막연한 "유의미 감소" 표현 금지.
- 죽은 스크립트(`mvp_target_schema.ts`) 참조 0.

## 실패 조건

- 현행 config 스키마 문서가 유실되면 실패(폐기분만 제거).
