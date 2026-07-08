# Phase 02 — state/ 신설 + 이동 + positions-queue rename

**Model**: sonnet
**Status**: pending

## 목표

state/ 신설 + 이동 + positions-queue rename (decisions.md 이동표·기준 준수).

## 중요 지침

구현 phase다. docs·ADR을 수정하지 않는다. Phase 01 ADR·이동표를 벗어나면 PHASE_BLOCKED.
git mv로 이력 보존. 파일 이동과 그 참조 갱신을 같은 phase에서 함께 한다.

## 작업

positions-queue.jsonl(옛 ledger)·study-progress·drill-progress·mvp-target·study-pack-candidates·topic-inventory(+history)·drill-log를 state/로 git mv. verified-company의 cooldown을 state/company-cooldown.json으로 분리. 이동한 파일을 읽는 SKILL·scripts(drill-engine·study-topic-recommender·position-recommender·application-agent)·docs 경로를 함께 갱신.

## 성공 기준

- 대상 파일이 새 위치로 이동됐다.
- 이동 파일을 읽는 SKILL·scripts·docs·.gitignore 참조가 새 경로로 갱신됐다(끊긴 링크 0).
- 관련 실행(수집/렌더/드릴 중 해당)이 새 경로로 성공한다.

## 실패 조건

- 이동 후 옛 경로 참조가 남아 실행이 깨지면 실패.
