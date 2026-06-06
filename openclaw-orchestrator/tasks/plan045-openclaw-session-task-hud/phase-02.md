# Phase 02 — 공용 helper 구현

**Model**: sonnet
**Status**: pending

---

## 목표

phase 1에서 고정한 계약에 맞춰 OpenClaw 공용 task HUD helper를 구현한다.
helper가 workspace-agnostic이면 `_shared/lib/task_hud.ts` 또는 유사 파일에 둔다.
runtime state는 `openclaw-orchestrator/state/task-hud/` 아래에 둔다.

## 범위

- `_shared/lib/task_hud.ts` helper 구현
- 필요 시 `_shared/types/index.ts` shared type 추가
- `openclaw-orchestrator/state/task-hud/` runtime state 읽기와 쓰기
- session별 HUD message create/edit
- usage와 context warning 판단
- compaction likely와 compaction count 변경 메시지
- 안전한 dry-run 또는 local test mode

## 범위 외

- `AGENTS.md` 통합
- OpenClaw-wide 자동 실행 강제
- 자동 task stop 또는 cancel
- account email, identity, 상세 token cost 출력
- career-os 전용 로직

## 구현 원칙

- helper는 특정 domain workspace에 묶지 않는다.
- workspace-agnostic Bun TypeScript code는 `_shared/lib`에 둔다.
- `openclaw-orchestrator`에는 planning artifact와 private runtime state를 둔다.
- helper가 orchestration-specific logic으로 바뀌면 phase 2 시작 전에 구현 위치를 재검토한다.
- workspace routing과 private-by-default 정책은 유지한다.
- Discord 채널에 보이는 HUD는 짧게 둔다.
- warning 상세는 thread 또는 별도 짧은 메시지로 보낸다.
- edit 실패 시 새 메시지 fallback과 state 갱신을 한다.

## _shared와 openclaw-orchestrator 경계

`AGENTS.md`의 `_shared/lib` convention을 따른다.
task HUD helper implementation은 workspace-agnostic Bun TypeScript code로 유지한다.
따라서 기본 구현 위치는 `_shared/lib/task_hud.ts`다.

`openclaw-orchestrator/AGENTS.md`의 private-by-default 정책도 따른다.
session state, Discord message id, warning cooldown은 orchestration runtime data다.
따라서 runtime state는 `openclaw-orchestrator/state/task-hud/`에 둔다.

shared type이 여러 helper에서 재사용될 때만 `_shared/types/index.ts`에 둔다.
task HUD 내부에서만 쓰는 type은 `task_hud.ts` 안에 둔다.

## 권장 명령 계약

phase 1에서 조정 가능하지만 다음 형태를 우선 검토한다.

```bash
bun _shared/lib/task_hud.ts status --session <session-id>
bun _shared/lib/task_hud.ts update --session <session-id> --task-label <label> --status <status>
bun _shared/lib/task_hud.ts warn --session <session-id> --kind <usage|context|compaction>
```

입력은 가능한 한 JSON도 허용한다.
OpenClaw dynamic tool에서 넘기는 metadata와 CLI 호출을 모두 받을 수 있게 한다.

## HUD 표시 항목

visible HUD 예시:

```text
Task: <label>
Status: <status>
Usage: 5h <remaining>, weekly <remaining>
Guard: ok
```

warning 상태 예시:

```text
Task: <label>
Status: <status>
Usage: 5h <remaining>, weekly <remaining>
Guard: context warning
```

금지:

- account email
- account display name
- token 단가
- 상세 token count
- 상세 billing cost
- raw `session_status` dump

## Threshold 동작

- 5시간 잔여가 낮으면 warning을 보낸다.
- 주간 잔여가 낮으면 warning을 보낸다.
- context 사용량이 compaction 가능 구간에 가까우면 warning을 보낸다.
- warning은 중복 spam을 막기 위해 cooldown을 둔다.
- 어떤 threshold도 자동 중단을 만들지 않는다.

## Compaction 동작

- pre-compaction hook이 있으면 hook에서 explicit message를 보낸다.
- hook이 없으면 `session_status` 값으로 likely 상태를 예측한다.
- compaction count가 바뀌거나 context 상태가 reset된 듯하면 post-detection message를 보낸다.
- 탐지 신뢰도가 낮으면 `appears` 또는 `likely` 표현만 쓴다.

## 검증

권장 검증:

```bash
bun _shared/lib/task_hud.ts --help
bun _shared/lib/task_hud.ts status --dry-run --session test-session
bun _shared/lib/task_hud.ts update --dry-run --session test-session --task-label "demo" --status "running"
```

실제 Discord edit 검증은 phase 3에서 한다.

## 성공 기준

- helper가 session별 state를 만들고 갱신한다.
- dry-run으로 HUD 본문이 privacy rule을 지킨다.
- usage/context/compaction warning은 warn only로 동작한다.
- edit 실패 fallback이 구현되어 있다.
- local 검증 명령이 통과한다.

## PHASE_FAILED / PHASE_BLOCKED 조건

- helper가 account email 또는 detailed cost를 출력하면 `PHASE_FAILED: privacy leak in visible HUD`를 출력하고 수정한다.
- session별 message id를 안정적으로 저장할 수 없으면 `PHASE_BLOCKED: cannot persist per-session HUD identity`를 출력하고 멈춘다.
- Discord edit API 경로가 없으면 `PHASE_BLOCKED: no Discord edit tool available`을 출력하고 멈춘다.
