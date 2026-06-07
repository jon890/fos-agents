# Phase 01 — HUD event wrapper와 stale 판정

**Model**: sonnet
**Status**: pending

---

## 목표

작업 이벤트를 한 줄 명령으로 HUD update에 연결하는 wrapper를 만든다.
같은 wrapper가 canonical state root와 30분 stale 기준을 책임진다.

**범위 외**: `run-phases.py` 연결, 실제 pinned message edit dogfooding, task 완료 처리.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다.
본 phase는 ai-nodes 루트 기준 path를 쓰므로 첫 Bash에서 repo root로 이동한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 관련 문서와 파일

- `docs/adr.md` ADR-012
- `openclaw-orchestrator/AGENTS.md`
- `_shared/lib/task_hud.ts`
- `openclaw-orchestrator/scripts/task-hud/update_from_session_status.ts`
- `openclaw-orchestrator/state/task-hud/.gitignore`

---

## 작업 항목

1. `openclaw-orchestrator/scripts/task-hud/update_event.ts`를 만든다.
   - 입력은 `--session`, `--task-label`, `--event`, `--status`, `--target`, `--dry-run`.
   - `--event` 값은 `start`, `phase-start`, `phase-complete`, `blocked`, `failed`, `complete`, `stale-check`.
   - canonical state root는 `openclaw-orchestrator/state/task-hud/`로 고정한다.
2. wrapper는 `_shared/lib/task_hud.ts update`를 호출한다.
   - visible status는 event와 status를 합쳐 짧게 만든다.
   - raw tool output, 계정, 비용, token dump는 전달하지 않는다.
3. stale check를 구현한다.
   - 같은 session state의 `updatedAt`이 30분보다 오래됐고 active 상태면 stale status를 render한다.
   - dry-run에서 stale 여부를 stdout으로 확인할 수 있게 한다.
4. `--help`를 추가하고 기존 wrapper와 CLI 스타일을 맞춘다.

---

## 검증

보고 직전 아래 Bash 블록을 실행하고 raw output을 남긴다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun --check openclaw-orchestrator/scripts/task-hud/update_event.ts
bun openclaw-orchestrator/scripts/task-hud/update_event.ts --help >/tmp/plan050-hud-event-help.txt
rg -n 'start|phase-start|phase-complete|stale-check' /tmp/plan050-hud-event-help.txt
bun openclaw-orchestrator/scripts/task-hud/update_event.ts --dry-run --session plan050-event --task-label plan050 --event start --status running > /tmp/plan050-hud-event-start.txt
cat /tmp/plan050-hud-event-start.txt
rg -n '^Task: plan050$' /tmp/plan050-hud-event-start.txt
rg -n '^State: start: running$' /tmp/plan050-hud-event-start.txt
! rg -n 'email|account|cost|token|secret' /tmp/plan050-hud-event-start.txt
before_count=$(find openclaw-orchestrator/state/task-hud -maxdepth 1 -name '*.json' | wc -l)
bun openclaw-orchestrator/scripts/task-hud/update_event.ts --dry-run --session plan050-event --task-label plan050 --event stale-check --status running > /tmp/plan050-hud-event-stale.txt
after_count=$(find openclaw-orchestrator/state/task-hud -maxdepth 1 -name '*.json' | wc -l)
echo "state-json-before=$before_count"
echo "state-json-after=$after_count"
test "$before_count" = "$after_count"
git diff --check
```

---

## 커밋 및 푸시 경계

의도한 변경만 stage한다.
이 phase의 커밋은 HUD event wrapper와 stale 판정 변경만 담는다.
커밋 뒤 `git push origin main`을 실행한다.

---

## 중단 조건

- canonical state root 외부에 새 state JSON이 생기면 수정하거나 `PHASE_FAILED: duplicate HUD state root`를 출력하고 exit 1.
- raw session/tool output을 visible HUD로 넘겨야 구현 가능하면 `PHASE_BLOCKED: raw HUD payload would leak`를 출력하고 exit 2.
- dry-run 없이 새 HUD message를 보내야만 검증 가능하면 이 phase에서는 멈추고 phase 3으로 넘긴다.
