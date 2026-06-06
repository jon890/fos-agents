# Phase 03 — 현재 OpenClaw 세션 자동 갱신 연결과 warning threshold 적용

**Model**: sonnet
**Status**: pending

---

## 목표

개선된 HUD helper를 현재 OpenClaw session에서 가능한 자동 갱신 경로에 연결한다.
threshold 동작은 warning only로 유지하고 자동 stop, cancel, task kill은 구현하지 않는다.

**범위 외**: HUD render redesign, AGENTS.md 수정, plan045/plan046 수정, career-os running task state 수정, account/billing 상세 노출, 자동 pin 강제.

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

- 가능한 곳은 script invocation으로 HUD update를 자동화한다.
- 자동화가 불확실하면 explicit manual command를 남기고 안전하게 멈춘다.
- warning은 send/edit만 한다.
- 자동 stop, cancel, task kill, destructive cleanup은 금지한다.
- current visible surface에 보이는 usage는 5h remaining과 weekly remaining만 둔다.
- context usage는 최소 표현만 둔다.
- completed subagents는 HUD 본문에 표시하지 않는다.
- 계정 identity, email, detailed costs, secrets는 visible surface에 출력하지 않는다.
- pinning 또는 고정 노출 여부는 surface 사용자가 결정하며 helper가 자동으로 강제하지 않는다.
- durable HUD state는 `openclaw-orchestrator/state/task-hud/` 아래에 둔다.
- 이 phase는 하나의 commit/push 경계다.
- stage는 intended files만 한다.

---

## 관련 파일

먼저 아래 파일을 읽는다.

- `_shared/lib/task_hud.ts`
- `openclaw-orchestrator/state/task-hud/.gitignore`
- `openclaw-orchestrator/tasks/plan047-openclaw-session-hud-enhancement/phase-01.md`
- `openclaw-orchestrator/tasks/plan047-openclaw-session-hud-enhancement/phase-02.md`

가능하면 OpenClaw tool specs 또는 local invocation examples도 확인한다.

- `session_status`
- `subagents`
- OpenClaw visible message send/edit tool
- OpenClaw session metadata source

---

## 작업 항목

### 1. update source를 session_status 중심으로 연결

helper가 session_status snapshot을 받아 HUD를 update할 수 있게 한다.
direct tool call이 필요하면 thin wrapper만 추가한다.

필요한 input:

- session id
- visible target or message identity
- task label
- task state
- 5h remaining
- weekly remaining
- context usage
- compaction count if available
- active subagents if available

없는 field는 숨기거나 unavailable로 처리한다.
raw snapshot은 visible body에 출력하지 않는다.

### 2. current OpenClaw session용 safe script path 확인

현재 OpenClaw session에서 helper를 부를 수 있는 가장 좁은 script path를 확인한다.
이번 dogfooding surface가 Discord일 수 있지만 helper 계약은 Discord 전용으로 고정하지 않는다.
기존 `_shared/lib/task_hud.ts` CLI로 충분하면 새 script를 만들지 않는다.

새 wrapper가 꼭 필요하면 workspace-agnostic helper는 `_shared/lib`에 두고, orchestration state policy만 `openclaw-orchestrator/state/task-hud/`를 사용한다.
wrapper가 OpenClaw current-session에 강하게 묶이면 `openclaw-orchestrator/` 내부에 둔다.

### 3. warning threshold 적용

threshold는 warning only다.
초기값은 phase 1 실측 field 단위에 맞춘다.

권장 warning 종류:

- 5h remaining low
- weekly remaining low
- context usage high
- compaction likely
- compaction count changed
- HUD edit failed and fallback message created

경고 중복을 막기 위해 cooldown을 둔다.
cooldown state는 `openclaw-orchestrator/state/task-hud/`에 저장한다.

### 4. compaction wording 보정

OpenClaw가 exact compaction policy/boundary를 노출하면 그 field만 사용한다.
노출하지 않으면 아래 원칙을 따른다.

- `likely`는 context usage가 높은 경우에만 쓴다.
- `appears`는 compaction count 변경이나 context reset 같은 후속 감지에만 쓴다.
- exact boundary를 모르면 숫자를 invented threshold처럼 말하지 않는다.

---

## 검증

보고 직전 반드시 아래 Bash 블록을 실행한다.
raw value를 stdout에 남긴다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun --check _shared/lib/task_hud.ts
grep -R "auto.*stop\\|cancel.*task\\|task kill\\|kill process" _shared/lib openclaw-orchestrator/tasks/plan047-openclaw-session-hud-enhancement && exit 1 || true
grep -R "email\\|account identity\\|detailed cost\\|token cost\\|secret" _shared/lib openclaw-orchestrator/tasks/plan047-openclaw-session-hud-enhancement && exit 1 || true
FORBIDDEN_WORD="$(printf 'g%s' 'ate')"
grep -R "$FORBIDDEN_WORD" openclaw-orchestrator/tasks/plan047-openclaw-session-hud-enhancement && exit 1 || true
git diff --check
git status --short
```

가능하면 dry-run 또는 current-session safe invocation을 실행한다.
실제 visible message edit이 가능하면 1회만 수행하고 결과를 짧게 기록한다.
권한이나 message id가 없으면 dry-run으로 대체하고 이유를 기록한다.

---

## Commit / Push

검증 통과 후 intended files만 stage한다.

예상 intended files:

- `_shared/lib/task_hud.ts`
- 필요한 경우 `openclaw-orchestrator/` 아래 HUD wrapper script
- 필요한 경우 `openclaw-orchestrator/state/task-hud/.gitignore`

commit message:

```text
feat(openclaw): session HUD 자동 갱신 연결
```

commit 후 `git push origin HEAD`을 실행한다.
unrelated dirty state가 있으면 commit하지 말고 어떤 파일 때문에 보류했는지 보고한다.

---

## Blocked 조건

반드시 Bash 도구로 직접 실행하라.
prose만 출력하면 success로 잘못 처리될 수 있다.

- current visible message identity를 얻을 수 없고 dry-run도 불가능하면 `echo 'PHASE_BLOCKED: no safe HUD update invocation' && exit 2`
- warning only를 지키지 않고 자동 stop/cancel이 필요해야만 동작하면 `echo 'PHASE_BLOCKED: warning only policy conflict' && exit 2`
- exact compaction source가 없으면 blocked가 아니다. likely/appears wording fallback으로 진행한다.
