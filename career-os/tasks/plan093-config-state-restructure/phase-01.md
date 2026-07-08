# Phase 01 — 결정 고정 (docs-first, ADR)

**Model**: opus
**Status**: pending

## 목표

파괴적 이동 전에 5버킷 구조·용어·이동표를 ADR로 고정한다. decisions.md를 정본으로 삼는다.

## 중요 지침

이 phase만 docs/ADR을 수정한다. Phase 02~06은 구현만 한다.
결정별 독립 ADR로 분리한다(한 ADR = 한 의사결정).

## 작업

- 신규 ADR 작성(번호는 착수 시 재확인):
  - config/state 구분 기준 + 5버킷 top-level 구조(data/ 해체).
  - ledger → positions-queue 이름 변경.
  - verified-company의 cooldown을 state/company-cooldown.json으로 분리(ADR-095 갱신/부분 supersede).
  - frontdoor-queue 폐기 + "승격"→"등록" 용어.
- decisions.md의 파일 이동표를 **전수 확정**(현재 data/·config/ 전 파일을 config/state/applications/reports/cache 중 하나로 분류, 애매 없음).
- docs/data-schema.md·code-architecture.md·flow.md의 디렉터리 책임·경로를 새 구조로 갱신.
- docs/adr/INDEX.md에 신규 ADR 행 추가.

## 성공 기준

- 결정별 ADR이 생성되고 INDEX에 등록됐다.
- 전수 이동표가 애매 항목 0으로 확정됐다(모든 기존 파일에 목적지 지정).
- data-schema·code-architecture·flow가 5버킷 구조를 반영한다.

## 실패 조건

- 이동표에 목적지 미정 파일이 남으면 실패. 구현 phase 진입 금지.
