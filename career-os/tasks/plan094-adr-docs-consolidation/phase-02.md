# Phase 02 — 승인된 정리 실행

**Model**: sonnet
**Status**: pending

## 목표

Phase 01 findings 중 사용자가 승인한 항목만 정리한다. provenance 보존이 원칙이다.

## 중요 지침

사용자 승인 없이 ADR을 삭제·병합하지 않는다.
압축은 삭제가 아니라 supersede 표기·병합(원 번호 참조 유지)·archive다. 결정 이력을 잃지 않는다.
구체 대상·조치는 Phase 01 findings + 사용자 리뷰 후 이 문서에 확정해 채운다(현재는 골격).

## 작업 (findings 확정 후 채움)

- superseded ADR에 "대체: ADR-NNN" 표기 추가.
- mergeable ADR 병합(내용 통합 + 원 번호 참조 유지).
- stale 서술을 현재 구조에 맞게 정정.
- bloat 압축(의사결정 의도 보존, 구현 상세 제거).
- `docs/adr/INDEX.md`와 5문서를 정리 결과에 맞게 갱신.

## 성공 기준

- 승인된 정리만 반영됐다.
- 어떤 ADR도 provenance(결정 이력)를 잃지 않았다(삭제 대신 supersede/archive).
- INDEX ↔ 실제 ADR 파일 정합(끊긴 링크 0).

## 실패 조건

- 승인 안 된 ADR을 정리하면 실패.
- 결정 이력이 추적 불가하게 사라지면 실패.
