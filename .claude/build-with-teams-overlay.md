# build-with-teams 오버레이 — fos-agents

공용 코어(`~/.claude/skills/build-with-teams`)에 fos-agents 특화를 주입한다.
코어가 뼈대, 아래 내용이 이 레포의 살점이다.

## 전용 agent (executor·docs-verifier)

executor·docs-verifier 는 실행 워크스페이스명을 prefix 로 한 전용 agent 를 쓴다.
정본은 `.claude/agents/<workspace>-{executor,docs-verifier}.md`.

| 워크스페이스 | executor | docs-verifier |
|---|---|---|
| career-os | `career-os-executor` | `career-os-docs-verifier` |
| 그 외 (apartment·stock-investment·travel·health-care·ji-yoon-blog·side-projects) | 전용 agent 없음 — `oh-my-claudecode:executor` 로 대체 | 전용 agent 없음 — team-lead 가 진행 전 사용자에게 확인 |

critic·code-reviewer 는 모든 워크스페이스에서 공용 agent(`oh-my-claudecode:critic`, `oh-my-claudecode:code-reviewer`)를 쓴다.

## 통합 검증 명령 (워크스페이스별 — CLAUDE.md 에 없으면 이 표를 따른다)

| 워크스페이스 | 검증 명령 |
|---|---|
| career-os | 관련 테스트 + `bunx tsc --noEmit` + Python 수집기 변경 시 해당 smoke test |
| 그 외 | 각 워크스페이스 `README.md`의 검증 명령 |

career-os 는 TypeScript 를 bun 으로 실행하고 스키마 검증에 zod 를 쓴다.

## worktree 직후 setup

career-os 는 fos-agents 루트에서 `bun install` 1회(이미 설치돼 있으면 생략) 외 추가 setup 이 없다.
그 외 워크스페이스는 문서화된 setup 절차가 없다.

## 코드 규칙 권위 (워크스페이스별)

career-os: `career-os/AGENTS.md` + `career-os/docs/`의 5문서(`prd.md`·`data-schema.md`·`flow.md`·`code-architecture.md`·`adr/`).
그 외 워크스페이스: `<workspace>/AGENTS.md` + `<workspace>/docs/`의 책임 문서와 `adr/`.
executor·code-reviewer 프롬프트에는 위 권위 문서를 참조로 인용한다.

## index.json 스키마

planning 오버레이(`.claude/planning-overlay.md`)의 "index.json 스키마" 절이 단일 소스다.
build-with-teams 는 그 스키마로 만들어진 task 를 그대로 실행하며 별도 필드를 추가하지 않는다.

## plan/ADR 번호 재확인

worktree 생성 직전, planning 오버레이의 "plan 네이밍 (번호 충돌 확인)" 스캔을 한 번 더 실행한다.
다른 세션이 그 사이 같은 번호를 선점했을 수 있다(실측: plan088·ADR-096 충돌 사례).

## common-pitfalls 경로

critic·code-reviewer·docs-verifier 가 사전 해소 점검할 패턴 파일은 `.claude/skills/_shared/common-pitfalls/INDEX.md` (라우터) 다.
executor 스폰 프롬프트의 환경 함정은 전용 agent 정의(`<Domain_Rules>`)가 단일 소스이므로 반복하지 않는다.

## 노하우 누적 위치

review 회고에서 나온 재사용 가치 있는 발견은 `.claude/skills/_shared/common-pitfalls/`에 누적한다.
새 문서를 신설하지 않는다.
