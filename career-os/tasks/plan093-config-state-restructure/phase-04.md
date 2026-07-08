# Phase 04 — reports/ 재편

**Model**: sonnet
**Status**: pending

## 목표

reports/ 재편 (decisions.md 이동표·기준 준수).

## 중요 지침

구현 phase다. docs·ADR을 수정하지 않는다. Phase 01 ADR·이동표를 벗어나면 PHASE_BLOCKED.
git mv로 이력 보존. 파일 이동과 그 참조 갱신을 같은 phase에서 함께 한다.

## 작업

data/reports/**·job-fit-*.md·baseline을 reports/로, mirror(position-recommendation.*)를 reports/latest/로, downloads를 reports/downloads/로, morning-topic-recommendation.md를 reports/로 이동. 렌더러·SKILL·notify 경로 갱신.

## 성공 기준

- 대상 파일이 새 위치로 이동됐다.
- 이동 파일을 읽는 SKILL·scripts·docs·.gitignore 참조가 새 경로로 갱신됐다(끊긴 링크 0).
- 관련 실행(수집/렌더/드릴 중 해당)이 새 경로로 성공한다.

## 실패 조건

- 이동 후 옛 경로 참조가 남아 실행이 깨지면 실패.
