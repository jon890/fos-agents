# Phase 01 — 결정 고정 (docs-first, ADR)

**Model**: opus
**Status**: completed

## 목표

이후 구현 phase가 파괴적으로 config를 바꾸기 전에, 단일 출처·프로필 분리 결정을 ADR로 고정한다.
`findings.md`의 높음+중간 항목에 대한 "무엇을 단일 출처로 삼는가"를 문서로 확정한다.

## 중요 지침

이 phase는 유일하게 docs/ADR을 수정하는 phase다.
Phase 02~05는 이 결정을 구현만 하며 docs를 수정하지 않는다.
결정이 애매하면 사용자·Codex와 planning 대화로 되돌린다(비대화형 강행 금지).
착수 전 pitfall을 선독한다: `.claude/skills/plan-and-build/references/common-pitfalls/INDEX.md`의 plan 카테고리(1-1·1-2·1-5)와 harness(6-5 destructive→additive). 특히 1-5(한 ADR = 한 의사결정)를 준수한다.

## 관련 파일

- `tasks/plan092-config-single-source/findings.md` (감사 결과)
- `docs/adr/INDEX.md`, `docs/data-schema.md`, `docs/code-architecture.md`

## 작업

4개 결정을 **결정별 독립 ADR로 분리 작성**한다(한 ADR = 한 의사결정, pitfall 1-5). 번호는 `ADR-103`~`ADR-106`(origin/main 최대 102 확인, 착수 시 재확인).

- **ADR-103 회사 키워드·AI 랭킹 규칙 단일 출처**
  - 회사별 키워드는 `verified-company-research-targets.json` 단일 출처, role(회사 비종속) 키워드는 `position-collection.json`, 랭킹 방법론은 `position-decision-criteria.md`.
  - **비회귀 처리 방침(필수)**: `position-collection.json.targetKeywords`에는 verified `priorityCompanies` 13개에 없는 회사 키워드(삼성SDS·LG CNS·SK*·현대오토에버·KT·카카오(corp)·카카오엔터프라이즈·카카오헬스케어·NAVER Cloud·Works Mobile)가 다수다. 기본 방침은 verified에 저-tier `secondaryCompanies` 키워드 목록을 신설해 모든 회사 키워드를 verified 단일 출처로 모으고 수집 커버리지를 유지한다(회귀 방지). 이견 시 planning으로 되돌린다.
- **ADR-104 candidate-profile core/detail 분리 + skill 매핑**
  - profile 13개 섹션 전수 분류(실행자 임의 판단 금지):
    - **core**(추천/fit 판단용 사실·라벨): 지원 대상 / 핵심 무기 / 커리어 타임라인 / 보유 기술 스택(라벨 중심, 증거 축약) / 입증된 강점 / 약점·학습 중인 영역 / 제약·스코프
    - **detail**(면접 서사·심화): 주요 프로젝트 요약 / 개인 프로젝트 / 기술 의사결정 패턴 / 협업·리더십·코드 리뷰 스타일 / 면접 준비 우선순위
    - **meta**(어느 skill에도 주입 안 함): Source provenance — 이미 `candidate-profile-provenance.md`로 분리됨. 이 섹션은 core/detail 어느 파일에도 넣지 않는다.
  - core 파일 경로는 `config/candidate-profile.md`를 유지(기존 참조 파손 방지), detail은 신규 파일로 분리.
  - 9개 skill 각각 "core만 / core+detail" 매핑 표를 ADR에 명시(Phase 03 계약).
- **ADR-105 study-progress ↔ drill 상태 분리 + weak_spots 스키마 정본**
  - 드릴 간격 반복 상태를 `config/drill-progress.json`으로 분리.
  - `WeakSpotEntry`를 관심사별 2타입으로 정본화: topic 학습 상태(`last_studied·study_count·last_evaluated·status`, study-progress 잔류) ↔ drill 상태(`pass_count·fail_count·next_review_date·last_passed`, drill-progress).
  - **마이그레이션**: 실데이터 weak_spots에 drill 필드 0건이므로 `drill-progress.json`은 빈 상태로 신설, study-progress의 기존 키는 topic 학습 필드로 잔류. 데이터 손실 없음을 ADR에 명시.
- **ADR-106 topic-file-map 폐기 + 참조 doc 정리**
  - `config/topic-file-map.json` 삭제 결정과 참조 doc(`data-schema.md`·`code-architecture.md`·`ADR-016`·`ADR-001`·`plan017`) 정리 범위를 고정.
- `docs/data-schema.md`·`docs/code-architecture.md`의 config 책임 표를 위 결정에 맞게 갱신.
- `docs/adr/INDEX.md`에 신규 ADR 4행 추가.

## 성공 기준

- 결정별 독립 ADR 4개(ADR-103~106)가 생성되고 INDEX에 4행 등록됐다.
- ADR-104에 profile 13섹션 전수 분류 + 9개 skill↔파일 읽기 매핑 표가 명시됐다(Phase 03 구현의 계약).
- ADR-103에 비-priority 회사 키워드 처리 방침이 명시됐다(Phase 02 계약).
- ADR-105에 weak_spots 스키마 정본과 마이그레이션 방침이 명시됐다(Phase 04 계약).
- `data-schema.md`가 새 단일 출처(회사 키워드·profile core/detail·drill-progress)를 반영한다.

## 보류 조건

- 프로필 core/detail 경계나 skill 매핑, 비-priority 회사 처리 방침에 이견이 있으면 planning으로 되돌린다.

## 실패 조건

- 결정 없이 구현 phase로 넘어가려 하면 실패. 반드시 ADR 4개 고정 후 Phase 02 진입.
- 4개 결정을 1개 ADR에 묶으면 실패(pitfall 1-5 위반).
