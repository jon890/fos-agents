# Phase 02 — state/ 신설 + 이동 + positions-queue 경로 규약

**Model**: sonnet
**Status**: completed

## 목표

state/ 신설 + tracked config→state 이동 + positions-queue 경로 규약 확정 (decisions.md 이동표·기준 준수).

## 중요 지침

구현 phase다. docs·ADR을 수정하지 않는다. Phase 01 ADR·이동표를 벗어나면 PHASE_BLOCKED.
tracked/untracked를 구분한다 — tracked만 git mv, untracked는 참조 갱신 + gitignore 경계로만 규약을 바꾼다(decisions.md 스코프 절). 코드 심볼·파일명 rename은 이 phase가 아니라 Phase 06이 한다.

## 작업

- **tracked git mv**: `config/study-progress.json`·`config/drill-progress.json`·`config/mvp-target.json`·`config/study-pack-candidates.json`을 `state/`로 git mv.
- **cooldown 분리(tracked)**: `config/verified-company-research-targets.json`의 cooldown 항목을 `state/company-cooldown.json`으로 분리(priorityCompanies·preferenceExcluded는 config 유지).
- **untracked 경로 규약 갱신(물리 이동 없음)**: `data/applications/ledger.jsonl`→`state/positions-queue.jsonl`, `data/runtime/topic-inventory.json`·`topic-inventory-history.jsonl`·`drill-log-*.jsonl`→`state/`의 경로 문자열을 스크립트·SKILL에서 갱신.
- 위 대상을 읽는 SKILL·scripts(drill-engine·study-topic-recommender·position-recommender·application-agent)·docs 경로를 함께 갱신.
- `.gitignore`에 `state/` 경계 반영(question-bank negation 훼손 없이).

## 성공 기준

- tracked 이동 대상이 `state/`로 git mv됐다(git status 확인, 이력 보존).
- untracked 대상은 참조·gitignore 규약만 갱신됐다(물리 이동 없음).
- 대상을 읽는 SKILL·scripts·docs·.gitignore 참조가 새 경로로 갱신됐다(live docs·scripts·.claude/skills 기준 해당 옛 경로 참조 0; tasks/·frozen ADR 제외).
- 변경 .ts `bun --check` 통과 + drill-engine·study-topic-recommender가 새 경로 파일 부재를 graceful 처리(크래시 없음).

## 실패 조건

- tracked 파일을 git mv 없이 옮겨 이력이 끊기면 실패.
- live 코드·docs·skill에 해당 옛 경로 참조가 남아 실행이 깨지면 실패.
