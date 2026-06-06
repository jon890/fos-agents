# Phase 04 — 검증과 dogfooding 및 필요한 문서 정리

**Model**: haiku
**Status**: pending

---

## 목표

plan047 변경을 검증하고 current OpenClaw session의 available visible surface에서 dogfooding한다.
AGENTS.md 또는 TOOLS.md 업데이트는 실제 운영 규칙이 바뀐 경우에만 최소 범위로 수행한다.

**범위 외**: 새 기능 추가, plan045/plan046 수정, career-os running task state 수정, completed subagents 표시, 자동 stop/cancel 정책 추가.

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

- 검증과 문서 최소 정리만 한다.
- AGENTS.md는 필요할 때만 수정한다.
- 문서 수정 시 repo-relative path만 쓴다.
- private absolute home-server path를 docs/tasks에 쓰지 않는다.
- English HUD labels는 허용한다.
- visible surface text에는 Markdown table을 쓰지 않는다.
- pinning 또는 고정 노출 여부는 surface 사용자가 결정하며 helper가 자동으로 강제하지 않는다.
- visible usage는 5h remaining과 weekly remaining만 둔다.
- context usage는 최소 표현만 둔다.
- completed subagents는 HUD 본문에 표시하지 않는다.
- 자동 stop, cancel, task kill은 구현하거나 문서화하지 않는다.
- 이 phase는 하나의 commit/push 경계다.
- stage는 intended files만 한다.

---

## 관련 파일

먼저 아래 파일을 읽는다.

- `_shared/lib/task_hud.ts`
- `AGENTS.md`
- `openclaw-orchestrator/AGENTS.md`
- `openclaw-orchestrator/TOOLS.md`
- `openclaw-orchestrator/tasks/plan047-openclaw-session-hud-enhancement/index.json`
- `openclaw-orchestrator/tasks/plan047-openclaw-session-hud-enhancement/phase-01.md`
- `openclaw-orchestrator/tasks/plan047-openclaw-session-hud-enhancement/phase-02.md`
- `openclaw-orchestrator/tasks/plan047-openclaw-session-hud-enhancement/phase-03.md`

---

## 작업 항목

### 1. helper 검증

`_shared/lib/task_hud.ts`의 syntax와 dry-run을 검증한다.
dry-run output은 아래 조건을 만족해야 한다.

- HUD로 알아보기 쉬운 heading이 있다.
- Usage line에는 5h remaining과 weekly remaining만 있다.
- Context line이 있다.
- Agents line은 active subagents만 반영한다.
- completed subagents가 sample에 있어도 표시하지 않는다.
- account identity, email, detailed costs, secrets가 없다.

### 2. current session dogfooding

현재 OpenClaw session에서 가능한 가장 안전한 visible surface 방식으로 1회 dogfooding한다.

- message edit이 가능하면 기존 HUD message를 update한다.
- edit이 불가능하면 dry-run 또는 safe fallback send만 수행한다.
- fallback send를 수행하면 state에 superseded 관계가 저장되는지 확인한다.
- dogfooding 결과는 채널에 길게 쓰지 않는다.

### 3. 문서 업데이트 필요 여부 판단

운영자가 다음에 알 필요가 있는 규칙만 문서에 남긴다.
필요 없으면 AGENTS.md와 TOOLS.md는 수정하지 않는다.

문서가 필요할 수 있는 경우:

- `_shared/lib/task_hud.ts` CLI contract가 바뀌었다.
- `openclaw-orchestrator/state/task-hud/` state policy가 바뀌었다.
- current session HUD update command가 운영 절차로 남아야 한다.

긴 schema 본문은 문서에 중복하지 않는다.
task plan이나 helper code를 단일 출처로 둔다.

### 4. task status 정리

검증이 끝나면 plan047 `index.json`을 completed로 바꾼다.
각 phase status와 commitSha는 실제 실행 결과에 맞춰 업데이트한다.

---

## 검증

보고 직전 반드시 아래 Bash 블록을 실행한다.
raw value를 stdout에 남긴다.

```bash
cd "$(git rev-parse --show-toplevel)"
python3 -m json.tool openclaw-orchestrator/tasks/plan047-openclaw-session-hud-enhancement/index.json >/tmp/plan047-index.json
bun --check _shared/lib/task_hud.ts
grep -R "^|" openclaw-orchestrator/tasks/plan047-openclaw-session-hud-enhancement && exit 1 || true
FORBIDDEN_WORD="$(printf 'g%s' 'ate')"
grep -R "$FORBIDDEN_WORD" openclaw-orchestrator/tasks/plan047-openclaw-session-hud-enhancement && exit 1 || true
grep -R "email\\|account identity\\|detailed cost\\|token cost\\|secret" openclaw-orchestrator/tasks/plan047-openclaw-session-hud-enhancement _shared/lib/task_hud.ts && exit 1 || true
git diff --check
git status --short
```

private absolute path scan도 실행한다.
검증식은 repo path만 대상으로 하고, command 자체에 private absolute path를 쓰지 않는다.

```bash
cd "$(git rev-parse --show-toplevel)"
PRIVATE_PREFIX="$(printf '/%s/' 'home')"
grep -R "$PRIVATE_PREFIX" openclaw-orchestrator/tasks/plan047-openclaw-session-hud-enhancement && exit 1 || true
```

---

## Commit / Push

검증 통과 후 intended files만 stage한다.

예상 intended files:

- `_shared/lib/task_hud.ts`
- 필요한 경우 `AGENTS.md`
- 필요한 경우 `openclaw-orchestrator/AGENTS.md`
- 필요한 경우 `openclaw-orchestrator/TOOLS.md`
- `openclaw-orchestrator/tasks/plan047-openclaw-session-hud-enhancement/index.json`

commit message:

```text
chore(openclaw): session HUD 검증과 운영 문서 정리
```

commit 후 `git push origin main`을 실행한다.
unrelated dirty state가 있으면 commit하지 말고 어떤 파일 때문에 보류했는지 보고한다.

---

## Blocked 조건

반드시 Bash 도구로 직접 실행하라.
prose만 출력하면 success로 잘못 처리될 수 있다.

- helper syntax 검증이 실패하면 `echo 'PHASE_FAILED: task_hud syntax check failed' && exit 1`
- dry-run output에 민감정보가 보이면 `echo 'PHASE_FAILED: visible HUD privacy leak' && exit 1`
- current session dogfooding이 불가능하면 dry-run 검증으로 대체하고 blocked 처리하지 않는다.
- docs/tasks에 private absolute path가 있으면 `echo 'PHASE_FAILED: private absolute path in task docs' && exit 1`
