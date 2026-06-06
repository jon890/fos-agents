# Phase 01 — 현재 HUD helper와 OpenClaw 노출값 읽기 전용 확인

**Model**: sonnet
**Status**: pending

---

## 목표

현재 구현된 HUD helper, runtime state, OpenClaw session_status/subagents 노출값을 읽기 전용으로 확인한다.
이 phase는 plan047 구현 범위를 고정하기 위한 discovery만 수행한다.

**범위 외**: 파일 수정, state 파일 갱신, visible surface 메시지 발송, plan045/plan046 수정, career-os running task state 수정.

---

## 사전 cwd 설정

본 phase는 repo-relative path를 사용한다.
첫 Bash 호출에서 ai-nodes repo root로 이동하고 이후 명령도 같은 기준을 유지한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 반드시 지킬 것

- 이 phase는 read-only다.
- `git status --short` 결과가 phase 시작과 끝에서 동일해야 한다.
- `openclaw-orchestrator/tasks/plan047-openclaw-session-hud-enhancement/`도 수정하지 않는다.
- `career-os/tasks/plan046-fos-career-position-collection-dashboard-verification/`는 읽더라도 수정하지 않는다.
- plan045 implementation code와 `_shared/lib/task_hud.ts`는 읽기만 한다.
- `openclaw-orchestrator/state/task-hud/`는 읽기만 한다.
- private absolute home-server path를 docs나 task 파일에 쓰지 않는다.
- Korean-facing docs에서 English jargon을 불필요하게 섞지 않는다.
- visible HUD 본문은 Markdown table 없이 설계한다.
- pinning 또는 고정 노출 여부는 surface 사용자가 결정하며 helper가 자동으로 강제하지 않는다.

---

## 읽을 파일과 확인 대상

먼저 아래 파일을 읽는다.

- `AGENTS.md`
- `openclaw-orchestrator/AGENTS.md`
- `openclaw-orchestrator/TOOLS.md`
- `_shared/lib/task_hud.ts`
- `openclaw-orchestrator/state/task-hud/.gitignore`
- `openclaw-orchestrator/tasks/plan045-openclaw-session-task-hud/index.json`
- `openclaw-orchestrator/tasks/plan045-openclaw-session-task-hud/phase-01.md`
- `openclaw-orchestrator/tasks/plan045-openclaw-session-task-hud/phase-02.md`
- `openclaw-orchestrator/tasks/plan045-openclaw-session-task-hud/phase-03.md`

가능하면 OpenClaw dynamic tool specs를 확인한다.

- `session_status`
- `subagents`
- OpenClaw visible message create/edit 관련 tool

사용 가능한 tool spec을 찾을 수 없다면 구현을 막지 않는다.
대신 phase 1 결과에 "사용 가능한 정확한 spec을 확인하지 못했다"라고 기록한다.

---

## 확인 항목

### 1. HUD helper 현재 계약

`_shared/lib/task_hud.ts`에서 다음을 확인한다.

- CLI command와 option 목록
- HUD body 생성 함수 위치
- usage, context, compaction field 입력 형태
- state read/write 위치
- OpenClaw visible message send/edit 호출 경로
- dry-run 또는 local validation 지원 여부

### 2. runtime state 현재 형태

`openclaw-orchestrator/state/task-hud/` 아래 tracked sample이나 ignored policy를 확인한다.

- session id 저장 key
- HUD message id 저장 key
- usage snapshot 저장 key
- context snapshot 저장 key
- compaction count 저장 key
- warning cooldown 저장 key
- subagent 관련 key 유무

state 파일 안에 민감정보가 보이면 내용을 출력하지 않는다.
대신 어떤 종류의 민감정보가 있는지 일반화해서 기록한다.

### 3. session_status capability

OpenClaw가 노출하는 값을 확인한다.

- 5h remaining에 해당하는 field
- weekly remaining에 해당하는 field
- context usage에 해당하는 field
- context limit 또는 percent에 해당하는 field
- compaction count에 해당하는 field
- exact compaction policy 또는 boundary 노출 여부
- pre-compaction hook 또는 event 노출 여부

exact policy나 boundary가 없으면 plan047 구현은 아래 원칙을 따른다.

- session_status context usage를 표시한다.
- compaction count가 있으면 변화 감지에 쓴다.
- 확정할 수 없는 compaction timing은 `likely` 또는 `appears` 표현만 쓴다.

### 4. subagents capability

subagents 정보에서 active만 식별할 수 있는지 확인한다.

- active/running/in_progress 같은 상태 field
- completed/done/failed/cancelled 같은 종료 상태 field
- label, id, task, model 같은 표시 가능한 field
- channel-visible HUD에 보여도 되는 최소 field

completed subagents는 HUD 본문에 표시하지 않는다.
종료 이력은 필요하면 state나 thread 세부 로그로만 검토한다.

### 5. 자동 갱신 연결 가능 지점

현재 OpenClaw session에서 script 기반 자동 갱신을 어디에 연결할 수 있는지 확인한다.

- helper CLI update command
- OpenClaw session turn 시작/종료 hook 존재 여부
- manual script invocation path
- current visible message edit path
- warning only threshold 적용 가능 위치

자동 stop, cancel, task kill 가능성을 구현 후보로 올리지 않는다.

---

## 산출물

이 phase는 파일을 만들지 않는다.
phase 실행자는 최종 응답에 아래 내용을 짧게 남긴다.

- 확인한 helper command 요약
- session_status에서 실제로 확인한 field 요약
- exact compaction policy/boundary 노출 여부
- active subagents만 표시할 수 있는지 여부
- phase 2 구현에 필요한 결정

---

## 검증

보고 직전 반드시 아래 Bash 블록을 실행한다.
raw value를 stdout에 남긴다.

```bash
cd "$(git rev-parse --show-toplevel)"
git status --short
test -f _shared/lib/task_hud.ts
test -d openclaw-orchestrator/state/task-hud
test -f openclaw-orchestrator/tasks/plan045-openclaw-session-task-hud/index.json
```

read-only phase 끝에 git status가 시작 시점과 다르면 원인을 설명하고 `PHASE_FAILED: read-only phase left changes`를 출력한 뒤 실패 처리한다.

---

## Blocked 조건

반드시 Bash 도구로 직접 실행하라.
prose만 출력하면 success로 잘못 처리될 수 있다.

- `_shared/lib/task_hud.ts`가 없으면 `echo 'PHASE_BLOCKED: task_hud helper missing' && exit 2`
- `session_status`나 대체 안전 usage source가 전혀 없으면 `echo 'PHASE_BLOCKED: no safe session usage source' && exit 2`
- active subagent와 completed subagent를 구분할 source가 전혀 없으면 phase 2에서 field를 숨기는 fallback을 계획하고 계속 진행한다.
