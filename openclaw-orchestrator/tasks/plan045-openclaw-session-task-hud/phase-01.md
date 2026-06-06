# Phase 01 — 상태와 메시지 계약 설계

**Model**: sonnet
**Status**: pending

---

## 목표

OpenClaw 전체에서 쓸 세션별 task HUD와 usage guard의 계약을 먼저 고정한다.
이 phase는 설계와 문서화만 한다.
helper code, runtime state, AGENTS.md는 아직 만들거나 고치지 않는다.

## 범위

- `_shared/lib/task_hud.ts` 또는 유사 파일에 들어갈 helper의 public command 계약 설계
- `openclaw-orchestrator/state/task-hud/`에 저장할 runtime state schema 설계
- `_shared`와 `openclaw-orchestrator`의 역할 경계 설계
- Discord 메시지 생성, 갱신, thread 전략 설계
- usage, context, compaction 관측 데이터 흐름 설계
- 경고 threshold와 메시지 문구 설계

## 범위 외

- helper 구현
- Discord 메시지 실제 발송 또는 편집
- `AGENTS.md` 수정
- cron, persistent daemon, 자동 중단 정책
- 계정 email, account identity, token cost 세부값 노출

## 사전 확인

아래 파일을 먼저 읽고 workspace 정책을 따른다.

- `AGENTS.md`
- `openclaw-orchestrator/AGENTS.md`
- `openclaw-orchestrator/TOOLS.md`

## _shared와 openclaw-orchestrator 경계

`_shared/lib`는 workspace-agnostic Bun TypeScript helper의 위치다.
`notify_discord.ts`가 이미 OpenClaw Discord send wrapper의 공용 precedent다.
이 helper는 OpenClaw를 호출하지만 domain workspace가 의존하는 낮은 수준 알림 helper이므로 `_shared/lib`에 남길 수 있다.

`openclaw-orchestrator`는 durable OpenClaw orchestration memory를 맡는다.
task planning, private runtime state, cross-domain coordination notes도 이 workspace에 둔다.

따라서 helper가 career-os, apartment, stock-investment 같은 domain data에 의존하지 않으면 `_shared/lib`에 둔다.
helper가 orchestration-specific policy나 local state layout에 강하게 묶이면 openclaw-orchestrator 내부 구현 위치를 별도로 검토한다.

이번 plan의 기본 결정은 low-level HUD notification helper가 workspace-agnostic일 때 `_shared/lib/task_hud.ts`에 두는 것이다.
runtime state와 Discord message id는 orchestration runtime data이므로 openclaw-orchestrator `state/task-hud/`에 둔다.
stateful wrapper가 필요하면 `_shared/lib`의 낮은 수준 notifier와 `openclaw-orchestrator`의 state wrapper로 나눈다.

권장 위치:

- plan files: `openclaw-orchestrator/tasks/plan045-openclaw-session-task-hud/`
- shared helper: `_shared/lib/task_hud.ts`
- shared types: `_shared/types/index.ts`, 필요할 때만
- runtime state: `openclaw-orchestrator/state/task-hud/`

## 설계 원칙

- HUD는 Discord/OpenClaw session 단위로 1개씩 둔다.
- 전역 HUD 메시지 1개로 모든 작업을 덮어쓰지 않는다.
- 채널에 보이는 usage는 최소화한다.
- 표시 항목은 `5h remaining`과 `weekly remaining`만 둔다.
- account identity, email, detailed token cost, detailed credit number는 출력하지 않는다.
- context 사용량은 warning 판단에는 쓸 수 있다.
- context 상세값은 threshold 전에는 HUD 본문에 노출하지 않는다.
- threshold에 도달해도 warn only로 동작한다.
- 자동 stop, 자동 cancel, 자동 task kill은 하지 않는다.

## 상태 계약 초안

runtime state는 나중에 `openclaw-orchestrator/state/task-hud/` 아래에 둔다.
phase 1에서는 schema만 문서화한다.

권장 key:

- `session_id`
- `source_channel`
- `source_message_id`
- `hud_message_id`
- `hud_thread_id`
- `task_label`
- `task_status`
- `last_usage_snapshot`
- `last_context_snapshot`
- `last_compaction_count`
- `last_warning_at`
- `updated_at`

민감정보 금지:

- account email
- account display name
- raw auth token
- API key
- 상세 token cost
- 상세 billing credit

## Discord 메시지 전략

기본 전략:

- session 시작 또는 첫 task HUD 요청 시 새 HUD 메시지를 만든다.
- 같은 session에서는 기존 HUD 메시지를 edit한다.
- 상세 로그가 필요하면 HUD 메시지 thread를 쓴다.
- 일반 채널 본문에는 짧은 상태만 유지한다.

thread 사용 기준:

- compaction likely 경고
- compaction count 변경 감지
- threshold warning 이력
- helper 오류와 재시도 내역

편집 실패 fallback:

- message edit 권한 또는 ref가 없으면 새 HUD 메시지를 보낸다.
- state에 superseded HUD 관계를 남긴다.
- 채널에는 이전 메시지를 삭제하지 않는다.

## Usage와 Context 데이터 소스

첫 데이터 소스는 `session_status`로 둔다.
가능한 필드만 읽고 없는 값은 숨긴다.

수집 우선순위:

1. `session_status`의 5시간 잔여, 주간 잔여, context 사용량, compaction 관련 값
2. OpenClaw session metadata의 message id, channel id, thread id
3. 나중에 확인된 안전한 dedicated source

account credits는 나중에 안전한 dedicated source가 확인될 때만 검토한다.
그 경우에도 visible HUD에는 상세 credit이나 계정 정보를 출력하지 않는다.

## Compaction 메시지 정책

true pre-compaction hook이 없을 수 있음을 명시한다.
hook이 없으면 아래 방식으로 운영한다.

- `session_status` 기반으로 compaction 가능성을 예측한다.
- compaction likely threshold에 가까워지면 명시 메시지를 보낸다.
- compaction count나 context reset이 감지되면 post-detection 메시지를 보낸다.
- 감지할 수 없는 경우에는 확정 표현을 쓰지 않는다.

권장 문구:

- `Context is likely to compact soon. I will keep the task state in the HUD and continue.`
- `Compaction appears to have occurred. I detected the count/state changed and will continue from the saved HUD state.`

## 성공 기준

- 상태 schema와 Discord message contract가 문서화된다.
- visible HUD privacy rule이 명확하다.
- `session_status` 우선 데이터 흐름이 명확하다.
- compaction hook 한계를 솔직히 적는다.
- phase 2 구현자가 바로 작업할 수 있다.

## PHASE_FAILED / PHASE_BLOCKED 조건

- OpenClaw session id 또는 Discord message id를 얻을 수 있는 경로가 전혀 없으면 `PHASE_BLOCKED: no session message identity source`를 출력하고 멈춘다.
- `session_status`에 usage와 context 관련 값이 전혀 없으면 `PHASE_BLOCKED: no safe usage source`를 출력하고 멈춘다.
- safe dedicated source 없이 account identity나 email을 출력해야만 동작한다면 `PHASE_BLOCKED: privacy violation required`를 출력하고 멈춘다.
