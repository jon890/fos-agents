# Phase 05 — cache/ 규약 + stray 정리 + .gitignore 최종 경계

**Model**: sonnet
**Status**: completed

## 목표

cache/ 규약 확정 + stray/폐기 참조 정리 + .gitignore 최종 경계 (decisions.md 이동표·기준 준수).

## 중요 지침

구현 phase다. docs·ADR을 수정하지 않는다. Phase 01 ADR·이동표를 벗어나면 PHASE_BLOCKED.
`data/runtime/**` 캐시 대상은 전량 **untracked**(gitignore `**/data/`)다 — 물리 이동 없이 경로 규약 + 참조 갱신 + gitignore 경계로만 실현한다(decisions.md 스코프 절).

## 작업

- 경로 규약 갱신(물리 이동 없음): `live-position-postings.md`(snapshot)·`feed-cache/`→`cache/`.
- 폐기 참조 정리: `data/runtime/data`(stray)·`position-recommendation-items.json`(ADR-101 폐기)를 읽는 live 코드·SKILL 참조 제거.
- `collect_live_postings`·`feed_discovery` 경로 문자열을 `cache/`로 갱신.
- **`.gitignore` 최종 경계 재작성**: `**/data/`를 `state/`·`reports/`·`cache/`·`applications/` 버킷별 경계로 교체하되 **기존 `!**/data/question-bank/` negation을 새 구조에 맞게 보존**(question-bank는 계속 tracked). cache/·reports/·applications/·state/의 tracked/untracked 여부를 decisions.md·Phase 01 ADR 기준으로 정확히 반영.

## 성공 기준

- 대상을 읽는 SKILL·scripts·docs 참조가 `cache/` 새 경로로 갱신됐다(live docs·scripts·.claude/skills 기준 해당 옛 경로 참조 0; tasks/·frozen ADR 제외).
- `.gitignore`가 5버킷 경계를 반영하고, question-bank negation이 보존돼 `git check-ignore`로 question-bank는 tracked·cache/는 ignore 확인된다.
- 변경 .ts `bun --check` 통과 + collect_live_postings·feed_discovery가 새 경로에서 크래시 없이 동작(파일 부재 graceful).

## 실패 조건

- question-bank negation이 사라져 공개 질문 bank가 gitignore되면 실패.
- live 코드·docs·skill에 stray/폐기 옛 경로 참조가 남아 실행이 깨지면 실패.
