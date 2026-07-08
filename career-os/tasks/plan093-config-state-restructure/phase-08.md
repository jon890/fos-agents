# Phase 08 — 전 경로 참조 grep-0 (live 한정) + 최종 검증 + 완료 처리

**Model**: sonnet
**Status**: completed

## 목표

남은 `data/` 경로·옛 용어 참조를 live 범위에서 0으로 만들고, 수집·렌더·드릴 진입점을 최종 검증한 뒤 task를 완료 처리한다.

## 중요 지침

구현 phase다. docs·ADR을 수정하지 않는다(단 task index.json 완료 마킹은 예외).
**grep-0 대상은 live docs·scripts·.claude/skills로 한정한다. `tasks/`와 frozen ADR(`docs/adr/`)은 제외한다** — 과거 계획·결정 기록은 동결이며 재작성 금지(M1).

## 작업

- 남은 `data/` 경로 참조를 live 범위에서 전수 grep해 0으로 만든다:
  `git grep -n 'data/runtime\|data/applications\|data/reports' -- ':!tasks/' ':!docs/adr/'` 결과가 0.
- 옛 용어(`ledger`·`frontdoor`·`promote`·"승격") live 잔존을 최종 확인(Phase 06·07 누락분 마무리; tasks/·frozen ADR 제외).
- 진입점 실행 검증: 수집(`collect_live_postings`)·렌더(`render_recommendation`·`render_candidate_preview`)·드릴(`drill-engine`)이 새 경로 규약에서 `bun --check` 통과 + 새 경로 파일 부재를 graceful 처리(크래시 없음).
- **task 완료 처리**: index.json의 `status`와 모든 phase status를 `"completed"`로 갱신(team-lead가 최종 커밋).

## 성공 기준

- live docs·scripts·.claude/skills 기준 `data/` 옛 경로 참조 0(tasks/·frozen ADR 제외).
- live 범위 옛 용어(ledger/frontdoor/promote/승격) 잔존 0.
- 수집·렌더·드릴 진입점이 `bun --check` 통과 + 새 경로에서 크래시 없이 로드.
- index.json status와 전 phase status가 `completed`.

## 실패 조건

- live 코드·docs·skill에 `data/` 옛 경로나 옛 용어가 남으면 실패.
- `tasks/`나 frozen ADR을 grep-0 위해 수정하면 실패(동결 위반).
