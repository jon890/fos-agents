# Phase 02 — HUD 표시 형식과 context 및 active subagent 필드 개선

**Model**: sonnet
**Status**: pending

---

## 목표

기존 `_shared/lib/task_hud.ts`를 확장해 HUD가 더 눈에 띄게 보이도록 만들고 context usage와 active subagents를 표시한다.
OpenClaw visible surface friendly plain text를 유지하며 Markdown table은 사용하지 않는다.

**범위 외**: current OpenClaw session 자동 연결, AGENTS.md 수정, plan045/plan046 수정, career-os running task state 수정, 자동 stop/cancel 구현, 자동 pin 강제.

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

- 구현 변경은 기본적으로 `_shared/lib/task_hud.ts`에 한정한다.
- 재사용 가능한 formatting/helper code만 `_shared/lib`에 둔다.
- durable orchestration state는 `openclaw-orchestrator/state/task-hud/`에 둔다.
- state schema 변경이 필요하면 existing state와 호환되게 migration-safe로 처리한다.
- account identity, email, detailed costs, raw token cost, secrets를 HUD에 출력하지 않는다.
- visible usage는 `5h remaining`과 `weekly remaining`만 둔다.
- context usage는 최소 표현으로 둔다.
- completed subagents는 HUD 본문에 표시하지 않는다.
- English HUD labels는 허용된다.
- Korean-facing docs에 mixed jargon을 불필요하게 쓰지 않는다.
- 이 phase는 하나의 commit/push 경계다.
- stage는 intended files만 한다.

---

## 관련 파일

먼저 아래 파일을 읽는다.

- `_shared/lib/task_hud.ts`
- `openclaw-orchestrator/tasks/plan047-openclaw-session-hud-enhancement/index.json`
- `openclaw-orchestrator/tasks/plan047-openclaw-session-hud-enhancement/phase-01.md`
- `openclaw-orchestrator/tasks/plan045-openclaw-session-task-hud/phase-02.md`
- `openclaw-orchestrator/state/task-hud/.gitignore`

---

## 작업 항목

### 1. HUD body를 더 알아보기 쉬운 형태로 정리

기존 helper의 HUD render path를 찾아 수정한다.
목표는 OpenClaw visible surface에서 glanceable한 HUD다.

권장 형태는 table이 아닌 line-based block이다.

```text
╭─ OpenClaw HUD
│ Task: <label>
│ State: <status>
│ Usage: 5h <remaining> · weekly <remaining>
│ Context: <used>/<limit> (<percent>)
│ Agents: <active summary or none>
│ Warn: <ok or warning summary>
╰─ Updated <relative time or timestamp>
```

Box drawing character가 기존 project style이나 visible surface rendering에 맞지 않으면 ASCII fallback을 둔다.
fallback 예시는 아래처럼 둔다.

```text
[OpenClaw HUD]
Task: <label>
State: <status>
Usage: 5h <remaining> · weekly <remaining>
Context: <used>/<limit> (<percent>)
Agents: <active summary or none>
Warn: <ok or warning summary>
Updated: <relative time or timestamp>
```

### 2. context usage field 추가

phase 1에서 확인한 session_status field를 helper input model에 반영한다.
field가 없거나 partial이면 숨기지 말고 최소 fallback을 둔다.

Fallback 예시:

- `Context: unavailable`
- `Context: <percent>`
- `Context: <used>/<limit>`

exact compaction policy나 boundary가 없으면 확정 표현을 쓰지 않는다.
warning text는 `likely` 또는 `appears`를 사용한다.

### 3. active subagents만 표시

subagent list normalization을 추가한다.
status가 active/running/in_progress 계열인 항목만 HUD body에 포함한다.

표시량은 짧게 제한한다.

- active count
- 최대 3개 label 또는 id
- 더 많으면 `+N more`

completed/done/failed/cancelled 계열은 HUD body에서 제외한다.
활성 상태를 판별할 수 없으면 `Agents: unavailable` 또는 `Agents: none active` 중 더 안전한 표현을 쓴다.

### 4. privacy와 warn-only 보장

render function 또는 formatter 주변에 visible field allowlist를 둔다.
raw session_status dump를 그대로 문자열화하지 않는다.

warning은 HUD body와 warning message만 만들 수 있다.
자동 stop, cancel, task kill, process termination code를 추가하지 않는다.

---

## 검증

보고 직전 반드시 아래 Bash 블록을 실행한다.
raw value를 stdout에 남긴다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun --check _shared/lib/task_hud.ts
bun _shared/lib/task_hud.ts --help >/tmp/plan047-task-hud-help.txt
grep -Ei "email|account|cost|secret|token cost|api key" /tmp/plan047-task-hud-help.txt && exit 1 || true
FORBIDDEN_WORD="$(printf 'g%s' 'ate')"
grep -R "$FORBIDDEN_WORD" openclaw-orchestrator/tasks/plan047-openclaw-session-hud-enhancement && exit 1 || true
git diff --check
git status --short
```

가능한 경우 dry-run 명령도 실행한다.
helper가 다른 CLI 형태라면 실제 `--help` 출력에 맞춰 equivalent dry-run을 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun _shared/lib/task_hud.ts status --dry-run --session test-session
bun _shared/lib/task_hud.ts update --dry-run --session test-session --task-label "plan047 demo" --status "running"
```

---

## Commit / Push

검증 통과 후 intended files만 stage한다.

예상 intended files:

- `_shared/lib/task_hud.ts`
- 필요한 경우 `_shared/types/index.ts`

commit message:

```text
feat(openclaw): session HUD 표시 정보 개선
```

commit 후 `git push origin main`을 실행한다.
unrelated dirty state가 있으면 commit하지 말고 어떤 파일 때문에 보류했는지 보고한다.

---

## Blocked 조건

반드시 Bash 도구로 직접 실행하라.
prose만 출력하면 success로 잘못 처리될 수 있다.

- HUD helper의 CLI나 render path를 찾을 수 없으면 `echo 'PHASE_BLOCKED: task_hud render path not found' && exit 2`
- safe allowlist 없이 raw session_status를 HUD에 출력해야만 구현 가능하면 `echo 'PHASE_BLOCKED: raw session_status would leak' && exit 2`
- active subagent 판별이 불가능하면 subagent field를 숨기는 fallback으로 진행한다.
