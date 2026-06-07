# Phase 02 — HUD snapshot 갱신 절차

**Model**: sonnet
**Status**: pending

---

## 목표

HUD usage snapshot 갱신 절차를 `session_status` 우선 호출 규칙으로 고정하고 stale snapshot 재사용 위험을 줄인다.

**범위 외**:

- HUD 구현 코드 수정.
- OpenClaw state 삭제.
- cron/systemd 설정 변경.
- commit/push.

---

## 관련 docs/files

실행 전 반드시 읽는다:

- `tasks/plan057-career-agent-orchestration-hygiene/ownership-inventory.md`
- `AGENTS.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `~/.openclaw/workspace/openclaw-orchestrator/state/task-hud`는 존재 여부만 확인
- 관련 `update_event.ts` 경로가 확인되면 파일명과 호출 방식만 inventory

---

## 작업 항목 (5)

1. HUD usage snapshot을 쓰는 흐름을 찾고 `update_event.ts` 단독 호출 지점을 inventory한다.
2. `session_status` 호출 없이 snapshot을 쓰면 stale snapshot이 생기는 실패 모드를 정리한다.
3. legacy HUD state인 `~/.openclaw/workspace/openclaw-orchestrator/state/task-hud` 처리 선택지를 적는다.
4. archive/migration decision이 필요한 항목과 즉시 정리 가능한 runtime artifact를 분리한다.
5. `tasks/plan057-career-agent-orchestration-hygiene/hud-protocol.md`를 작성한다.

---

## Intended File Scope

- `tasks/plan057-career-agent-orchestration-hygiene/hud-protocol.md`

---

## 검증

```bash
test -f tasks/plan057-career-agent-orchestration-hygiene/hud-protocol.md
rg -n "session_status|stale snapshot|update_event.ts|task-hud|archive|migration" tasks/plan057-career-agent-orchestration-hygiene/hud-protocol.md
git status --short tasks/plan057-career-agent-orchestration-hygiene
```

성공 기준:

- `session_status` 선행 호출 규칙이 적힌다.
- `stale snapshot` 위험이 명시된다.
- legacy HUD state를 silent deletion하지 않는 결정 경로가 적힌다.

---

## Blocked / Failed 조건

- HUD updater 경로를 찾을 수 없으면 `echo "PHASE_BLOCKED: HUD updater path unclear" && exit 2`.
- legacy state가 private secret을 포함할 가능성이 있으면 `echo "PHASE_BLOCKED: legacy HUD state needs privacy review" && exit 2`.
- OpenClaw state 파일이 변경되면 `echo "PHASE_FAILED: legacy HUD state changed unexpectedly" && exit 1`.

---

## Self-check

- state 디렉터리는 읽기 최소화한다.
- 삭제나 migration을 실행하지 않는다.
- protocol은 사람이 재현 가능한 순서로 쓴다.
- update_event.ts 수정은 후속 implementation phase로 남긴다.
