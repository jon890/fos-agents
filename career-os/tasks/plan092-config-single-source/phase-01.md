# Phase 01 — 결정 고정 (docs-first, ADR)

**Model**: opus
**Status**: pending

## 목표

이후 구현 phase가 파괴적으로 config를 바꾸기 전에, 단일 출처·프로필 분리 결정을 ADR로 고정한다.
`findings.md`의 높음+중간 항목에 대한 "무엇을 단일 출처로 삼는가"를 문서로 확정한다.

## 중요 지침

이 phase는 유일하게 docs/ADR을 수정하는 phase다.
Phase 02~05는 이 결정을 구현만 하며 docs를 수정하지 않는다.
결정이 애매하면 사용자·Codex와 planning 대화로 되돌린다(비대화형 강행 금지).

## 관련 파일

- `tasks/plan092-config-single-source/findings.md` (감사 결과)
- `docs/adr/INDEX.md`, `docs/data-schema.md`, `docs/code-architecture.md`

## 작업

- 신규 ADR(ADR-103 이후) 작성:
  - 회사 키워드·AI 랭킹 규칙 단일 출처 결정 — 회사별 키워드는 `verified-company-research-targets.json`, role 키워드는 `position-collection.json`, 랭킹 방법론은 `position-decision-criteria.md`.
  - candidate-profile core/detail 분리 결정 + "어느 skill이 무엇을 읽는가" 매핑(9개 skill 각각 core만 / core+detail).
  - study-progress 학습 이력 ↔ 드릴 간격 반복 상태 분리 + weak_spots 스키마 정본.
  - topic-file-map 삭제 + 참조 doc 정리 결정.
- `docs/data-schema.md`·`docs/code-architecture.md`의 config 책임 표를 위 결정에 맞게 갱신.
- `docs/adr/INDEX.md`에 신규 ADR 행 추가.

## 성공 기준

- 신규 ADR 파일이 생성되고 INDEX에 등록됐다.
- ADR에 skill↔파일 읽기 매핑 표가 명시됐다(Phase 03 구현의 계약).
- `data-schema.md`가 새 단일 출처를 반영한다.

## 보류 조건

- 프로필 core/detail 경계(어느 섹션이 core인지)나 skill 매핑에 이견이 있으면 planning으로 되돌린다.

## 실패 조건

- 결정 없이 구현 phase로 넘어가려 하면 실패. 반드시 ADR 고정 후 Phase 02 진입.
