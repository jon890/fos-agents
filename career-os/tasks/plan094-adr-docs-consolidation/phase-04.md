# Phase 04 — docs 다이어트

**Model**: sonnet
**Status**: pending

## 목표

code-architecture·data-schema의 drift·bloat·중복 정리.

## 중요 지침

구현 phase. 5문서 단일 출처 원칙 유지. 결정 근거는 ADR, 스키마는 data-schema 책임.

## 작업

- `code-architecture.md:44-45` ADR 수 "88개" → 실제 수로 정정 또는 "개별 파일"로 수치 제거(재발 방지).
- `data-schema.md:357-373` plan002 리다이렉트 stub 5개 제거.
- `data-schema.md` study-pack-topics·study-pack-candidates 이중 문서화 → 현행 1건 통합.
- `data-schema.md:177-187` 미실행 config diet 청소 목록 정리.
- `code-architecture.md:239`·`data-schema.md:225` interview-prep-analyzer `mvp_target_schema.ts` "사용 중" 기술 정정(#69 삭제 반영).

## 성공 기준

- ADR 수 정합, plan002 stub·중복 제거.
- data-schema 줄 수 유의미 감소, 죽은 스크립트 참조 0.

## 실패 조건

- 현행 config 스키마 문서가 유실되면 실패(폐기분만 제거).
