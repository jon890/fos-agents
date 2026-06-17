## ADR-012 — OpenClaw HUD 정책은 .openclaw, 공통 helper는 _shared

- Status: Accepted
- Date: 2026-06-07

### 맥락

OpenClaw 장기 작업 상태를 보여주는 pinned 메시지가 이미 있다.
사용자는 이 메시지를 앞으로 HUD라고 부르기로 했다.

기존 helper는 수동 갱신과 pinned message edit 기능을 갖췄다.
하지만 작업 시작, 진행, 완료, 실패 이벤트와 HUD update 호출이 강하게 연결되어 있지 않았다.
그 결과 2026-06-07에 career 작업이 진행됐는데 HUD는 03:47 KST 상태로 멈춰 있었다.

초기 정리에서는 `openclaw-orchestrator/`를 HUD 운영 workspace처럼 쓰려 했다.
하지만 HUD는 career, apartment, stock 같은 ai-nodes 도메인 산출물이 아니다.
OpenClaw 자체의 행동 규칙과 runtime state에 가깝다.

따라서 정책과 state를 ai-nodes domain workspace 안에 두면 경계가 흐려진다.
재사용 가능한 rendering/edit helper만 `_shared`에 남기는 편이 더 자연스럽다.

### 결정

OpenClaw HUD의 의미를 pinned 상태 메시지로 고정한다.
HUD는 chat narration이 아니라 session 작업 상태의 visible projection이다.

HUD 정책은 각 OpenClaw agent workspace의 `AGENTS.md`에 둔다.
여기에는 HUD 용어, 갱신 이벤트, stale 기준, visible privacy rule을 기록한다.

career HUD runtime state는 `.openclaw/workspace-career/state/task-hud/`에 둔다.
기존 `openclaw-orchestrator/state/task-hud/`와 `.openclaw/workspace/state/task-hud/`는 더 이상 사용하지 않고 제거한다.

workspace-agnostic helper code는 `ai-nodes/_shared/lib/`에 둘 수 있다.
단, 특정 OpenClaw workspace state를 직접 소유하지 않는다.

갱신은 이벤트 기반으로 한다.
장기 작업 시작, phase 시작, phase 완료, 실패, blocked, 최종 완료 시 HUD update를 호출한다.
stale 기준은 30분이다.

거절한 대안:

- 매분 polling.
  - 메시지 edit이 많고 작업 이벤트와 무관한 noise가 생긴다.
- 작업자가 임의로 기억하고 수동 갱신.
  - 밤샘 작업처럼 긴 흐름에서 누락되기 쉽다.
- `openclaw-orchestrator/`를 새 HUD 구현 중심으로 계속 키우기.
  - OpenClaw 자체 정책과 ai-nodes 도메인 작업공간의 경계가 섞인다.

### 결과

사용자는 pinned HUD 하나만 보면 현재 장기 작업 상태를 확인할 수 있다.
작업 루프가 HUD update를 놓치면 stale 기준으로 드러난다.
state root 혼선은 새 구현에서 제거된다.
`openclaw-orchestrator/`는 운영 workspace에서 제외하고 ai-nodes에서 삭제한다.

단점은 각 long-running 진입점이 HUD update helper를 호출해야 한다는 점이다.
이 호출 누락을 줄이기 위해 `.openclaw/workspace-career/AGENTS.md`와 관련 skill에 HUD 갱신 지점을 기록한다.

### 적용

- HUD 정책: `.openclaw/workspace-career/AGENTS.md`.
- HUD runtime state: `.openclaw/workspace-career/state/task-hud/`.
- helper: `_shared/lib/task_hud.ts`.
- career updater wrapper: `.openclaw/workspace-career/scripts/task-hud/`.

---
