# Phase 03 — session_status to HUD wrapper 연결

**Model**: sonnet
**Status**: pending

---

## 목표

`session_status`에서 usage, context, native active-agent state를 안전하게 추출해 HUD update wrapper에 연결한다.

**범위 외**: pinned message fallback warning 구현, real edit 검증.

---

## 사전 cwd 설정

첫 Bash 호출에서 ai-nodes repo root로 이동한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 관련 문서와 파일

- `openclaw-orchestrator/AGENTS.md`
- `_shared/lib/task_hud.ts`

---

## 작업 항목

1. OpenClaw `session_status` output에서 HUD에 필요한 safe field만 받는 wrapper를 만든다.
2. 5h remaining, weekly remaining, context percent, compaction count를 allowlist로 전달한다.
3. native active-agent state가 있으면 active만 HUD에 보여준다.
4. raw `session_status` object, account identity, detailed costs, token dump는 visible HUD에 쓰지 않는다.
5. source field가 없으면 `unavailable` 또는 `unknown`으로 degrade한다.

---

## 검증

보고 직전 아래 Bash 블록을 실행하고 raw output을 남긴다.

```bash
cd "$(git rev-parse --show-toplevel)"
sample='{"fiveHourRemaining":"72%","weeklyRemaining":"81%","contextPercent":43,"compactionCount":2}'
agents='[{"id":"a1","label":"active worker","status":"running"},{"id":"a2","label":"done worker","status":"completed"}]'
bun _shared/lib/task_hud.ts update --dry-run --session plan049-session-status --task-label plan049 --status phase-03 --session-status-json "$sample" --subagents-json "$agents" > /tmp/plan049-session-status-hud.txt
cat /tmp/plan049-session-status-hud.txt
rg -n 'Usage: 5h 72% .* weekly 81%' /tmp/plan049-session-status-hud.txt
rg -n '^Context: 43%$' /tmp/plan049-session-status-hud.txt
rg -n 'Agents: 1 active .*active worker' /tmp/plan049-session-status-hud.txt
HOME_PREFIX=$(printf '/%s/' home)
USERS_PREFIX=$(printf '/%s/' Users)
! rg -n "done worker|account|email|cost|token|$HOME_PREFIX|$USERS_PREFIX" /tmp/plan049-session-status-hud.txt
git diff --check
HOME_PREFIX=$(printf '/%s/' home)
USERS_PREFIX=$(printf '/%s/' Users)
rg -n "$HOME_PREFIX|$USERS_PREFIX" _shared/lib/task_hud.ts openclaw-orchestrator/tasks/plan049-openclaw-hud-runtime-stability && exit 1 || true
```

---

## 커밋 및 푸시 경계

의도한 변경만 stage한다.
이 phase의 커밋은 `session_status` wrapper와 HUD mapping만 담는다.
커밋 뒤 `git push origin main`을 실행한다.

---

## 중단 조건

- safe field mapping 없이 raw `session_status`를 visible HUD에 넣어야 한다면 작업을 중단한다.
- active와 completed agent를 구분할 수 없으면 agent line을 숨기거나 `unavailable`로 두고 보고한다.
