# Phase 03 — AGENTS 통합과 Discord 세션 dogfooding

**Model**: sonnet
**Status**: pending

---

## 목표

구현된 task HUD helper를 OpenClaw 운용 규칙에 연결하고 현재 Discord/OpenClaw 세션에서 실제로 써 본다.
이 phase에서만 `AGENTS.md` 통합을 검토하고 편집한다.

## 범위

- `AGENTS.md`에 shared helper convention 추가
- `openclaw-orchestrator/AGENTS.md`에 state와 use policy 추가
- 필요 시 `openclaw-orchestrator/TOOLS.md`에 로컬 실행 메모 추가
- 현재 Discord/OpenClaw session에서 HUD message 생성과 edit 검증
- compaction likely와 count-change 메시지의 실제 표현 점검
- 실패 fallback 확인

## 범위 외

- 다른 domain workspace AGENTS.md 일괄 수정
- cron 또는 daemon 도입
- 자동 stop 정책 도입
- public-postable artifact 생성
- account email, identity, 상세 token cost 출력

## AGENTS.md 통합 원칙

추가 문구는 짧고 역참조 중심으로 둔다.
긴 schema 본문은 task plan 또는 helper README에 둔다.

root `AGENTS.md`에는 `_shared/lib/task_hud.ts`가 workspace-agnostic helper라는 점만 짧게 둔다.
openclaw-orchestrator `AGENTS.md`에는 `state/task-hud/`의 private runtime state 정책과 사용 규칙을 둔다.

## _shared와 openclaw-orchestrator 경계

root `AGENTS.md`는 `_shared/lib` convention의 단일 기준이다.
여기에는 workspace-agnostic helper 위치와 `_shared/types` 재사용 기준만 연결한다.

`openclaw-orchestrator/AGENTS.md`는 HUD 운영 정책의 기준이다.
여기에는 `state/task-hud/` runtime state, Discord HUD 사용 규칙, privacy rule을 연결한다.

AGENTS 통합 중에도 helper implementation 위치는 `_shared/lib/task_hud.ts`로 유지한다.
state와 message id 저장 위치는 `openclaw-orchestrator/state/task-hud/`로 유지한다.

반드시 들어갈 정책:

- `_shared/lib`는 workspace-agnostic Bun TypeScript helper만 둔다.
- openclaw-orchestrator는 planning artifact와 private runtime state를 맡는다.
- implementation code는 orchestration-specific일 때만 openclaw-orchestrator 내부에 둔다.
- HUD는 session별 Discord/OpenClaw message로 운영한다.
- visible HUD usage는 5시간 잔여와 주간 잔여만 출력한다.
- account email, identity, 상세 token cost는 채널에 출력하지 않는다.
- threshold는 warn only다.
- compaction은 가능하면 사전 경고하고, 탐지되면 후속 메시지를 보낸다.
- true pre-compaction hook이 없을 수 있으므로 prediction과 post-detection을 쓴다.

## Dogfooding 절차

1. 현재 Discord/OpenClaw session id와 channel/message metadata를 확인한다.
2. HUD message를 생성한다.
3. 같은 session에서 task status를 1회 이상 edit한다.
4. dry-run 또는 safe test 값으로 warning 메시지를 확인한다.
5. thread 전략이 있으면 thread에 상세 warning을 기록한다.
6. visible HUD에 민감정보가 없는지 확인한다.
7. state file에 session별 message id가 저장되는지 확인한다.

## Discord 메시지 검증

검증할 것:

- 같은 session update가 기존 HUD message를 edit한다.
- 다른 session은 다른 HUD message를 쓴다.
- edit 실패 시 새 message fallback이 동작한다.
- thread가 있으면 상세 로그는 thread로 간다.
- 채널 본문은 짧게 유지된다.

## 성공 기준

- AGENTS.md 또는 TOOLS.md 변경이 최소 범위다.
- 현재 Discord/OpenClaw session에서 HUD create/edit이 검증된다.
- visible HUD에 금지 정보가 없다.
- compaction 관련 메시지가 확정할 수 없는 내용을 확정 표현하지 않는다.
- dogfooding 결과와 남은 한계가 task plan 또는 helper README에 기록된다.

## PHASE_FAILED / PHASE_BLOCKED 조건

- Discord message create/edit 권한이 없으면 `PHASE_BLOCKED: cannot dogfood Discord HUD`를 출력하고 멈춘다.
- AGENTS.md 통합이 다른 workspace 정책까지 바꿔야 한다면 `PHASE_BLOCKED: cross-workspace policy change required`를 출력하고 멈춘다.
- HUD가 민감정보를 출력하면 `PHASE_FAILED: visible HUD privacy violation`을 출력하고 수정한다.
