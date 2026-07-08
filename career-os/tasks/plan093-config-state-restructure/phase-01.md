# Phase 01 — 결정 고정 (docs-first, ADR)

**Model**: opus
**Status**: pending

## 목표

파괴적 이동 전에 5버킷 구조·용어·이동표를 ADR로 고정한다. decisions.md를 정본으로 삼는다.

## 중요 지침

이 phase만 docs/ADR을 수정한다. Phase 02~06은 구현만 한다.
결정별 독립 ADR로 분리한다(한 ADR = 한 의사결정).

## 작업

- 신규 ADR 작성(번호는 착수 시 `git grep -hoE 'ADR-[0-9]+' origin/main -- docs/adr/`로 재확인. 실측 max 106 → 107부터):
  - config/state 구분 기준 + 5버킷 top-level 구조(data/ 해체). runtime 실데이터 마이그레이션은 별도 후속임을 ADR 본문에 명시(decisions.md 스코프 절).
  - ledger → positions-queue 이름 변경(데이터 파일 + **코드 심볼·파일명** 포함, M2=A).
  - verified-company의 cooldown을 state/company-cooldown.json으로 분리. **ADR-095를 신규 ADR로 supersede 표기하고 ADR-095 본문은 동결(수정 금지)**. INDEX에 supersede 관계 링크만 추가.
  - frontdoor-queue 코드 폐기 + "승격"→"등록" 용어. 과거 ADR-045(frontdoor 분리)를 신규 ADR로 supersede 표기, ADR-045 본문 동결.
- decisions.md의 파일 이동표를 **전수 확정**(현재 data/·config/ 전 파일을 config/state/applications/reports/cache 중 하나로 분류, 애매 없음). tracked/untracked 구분을 이동표에 표기한다(tracked만 git mv).
- docs/data-schema.md·code-architecture.md·flow.md의 디렉터리 책임·경로를 새 구조로 갱신.
- docs/adr/INDEX.md에 신규 ADR 행 추가.

## 중요 지침 (frozen ADR)

과거 ADR 본문은 동결한다 — 수정하지 않는다. cooldown 분리·frontdoor 폐기는 **신규 ADR로 결정하고 과거 ADR(095·045)을 supersede** 표기, INDEX에 관계만 링크한다.

## 성공 기준

- 결정별 ADR이 생성되고 INDEX에 등록됐다(한 ADR = 한 의사결정).
- ADR-095·ADR-045 본문은 미수정이고, 신규 ADR이 supersede 관계로 이를 대체한다.
- 전수 이동표가 애매 항목 0으로 확정됐다(모든 기존 파일에 목적지 + tracked/untracked 표기).
- data-schema·code-architecture·flow가 5버킷 구조를 반영한다.

## 실패 조건

- 이동표에 목적지 미정 파일이 남으면 실패. 구현 phase 진입 금지.
- 과거 ADR 본문을 수정하면 실패(동결 위반).
