# Phase 04 — reports/ 경로 규약 재편

**Model**: sonnet
**Status**: pending

## 목표

reports/ top-level 버킷 규약 재편 (decisions.md 이동표·기준 준수).

## 중요 지침

구현 phase다. docs·ADR을 수정하지 않는다. Phase 01 ADR·이동표를 벗어나면 PHASE_BLOCKED.
`data/reports/**`·`data/runtime/*` 대상은 전량 **untracked**(gitignore `**/data/`)다 — 물리 이동 없이 경로 규약 + 참조 갱신 + gitignore 경계로만 실현한다(decisions.md 스코프 절).

## 작업

- 경로 규약 갱신(물리 이동 없음): `data/reports/**`·`job-fit-*.md`·`baseline`→`reports/`, mirror(`position-recommendation.*`)→`reports/latest/`, `downloads`→`reports/downloads/`, `morning-topic-recommendation.md`→`reports/`.
- 위 경로를 쓰는 렌더러(render_recommendation·render_candidate_preview)·SKILL·notify 경로 문자열을 갱신.
- `.gitignore`에 `reports/` 경계 반영(question-bank negation 훼손 없이).

## 성공 기준

- 대상을 읽는 렌더러·SKILL·scripts·docs·.gitignore 참조가 `reports/` 새 경로로 갱신됐다(live docs·scripts·.claude/skills 기준 해당 옛 경로 참조 0; tasks/·frozen ADR 제외).
- 변경 .ts `bun --check` 통과 + 렌더러가 새 경로 파일 부재/디렉터리 미존재를 graceful 처리(크래시 없음).

## 실패 조건

- live 코드·docs·skill에 해당 옛 경로 참조가 남아 렌더/notify가 깨지면 실패.
