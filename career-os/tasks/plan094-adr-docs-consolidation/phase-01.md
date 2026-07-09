# Phase 01 — 정책 ADR 고정 + 삭제·merge 목록 확정

**Model**: opus
**Status**: pending

## 목표

ADR 정리 정책을 신규 ADR로 고정하고, decisions.md의 삭제 23개·merge·docs 목록을 실행 전 최종 확정한다.

## 중요 지침

이 phase만 docs/ADR을 새로 쓴다(정책 ADR). Phase 02~05는 그 결정을 실행한다.

## 작업

- 신규 ADR 작성: "죽은 ADR은 archive 폴더 없이 삭제하고 provenance는 tombstone ADR로 보존한다" 정책. keep/delete binary 원칙, tombstone 자족성 요구를 명시.
- decisions.md 삭제 목록(23개) 각 파일 실재 재확인 + 각 tombstone 매핑 확정(fos-career→ADR-102, coffeechat→어느 ADR이 폐기 근거인지).
- merge 매핑 확정(094→101, adapter 043/047/051 병합본 설계).
- docs 정리 대상 라인 확정(code-architecture:44-45, data-schema:357-373·중복·177-187).

## 성공 기준

- 정책 ADR 생성 + INDEX 등록.
- 삭제 23개 각각에 tombstone·링크영향 매핑 완료(누락 0).
- Phase 02~04가 바로 실행할 수 있는 확정 목록 존재.

## 실패 조건

- tombstone이 WHY를 자족적으로 못 담는 삭제 대상이 있으면, 흡수 계획 없이 Phase 02 진입 금지.
