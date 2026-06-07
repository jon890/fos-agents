# Phase 03 — current session dogfooding과 legacy root guard

**Model**: sonnet
**Status**: pending

---

## 목표

현재 Discord career 채널의 pinned HUD를 실제로 edit해 event wrapper를 검증한다.
동시에 legacy state root가 다시 사용되지 않도록 guard를 추가한다.

**범위 외**: `run-phases.py` 구현 변경, task 최종 완료 처리.

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
- `openclaw-orchestrator/scripts/task-hud/update_event.ts`
- `openclaw-orchestrator/state/task-hud/discord-career-main.json`
- `_shared/lib/task_hud.ts`

---

## 작업 항목

1. legacy state root 감지 guard를 추가한다.
   - canonical root 외부의 `discord-career-main.json`을 발견하면 warning을 출력한다.
   - guard는 파일을 삭제하지 않는다.
   - 삭제나 이동은 사용자 요청 또는 별도 cleanup task로 넘긴다.
2. current session real edit 명령을 좁게 실행한다.
   - target은 현재 career channel만 사용한다.
   - 기존 HUD message id edit을 먼저 시도한다.
   - edit 실패 fallback으로 새 message가 생기면 warning이 보이는지 확인한다.
3. state file이 canonical root만 갱신됐는지 확인한다.
4. visible HUD에 private absolute path, 계정, 비용, token dump가 없는지 확인한다.

---

## 검증

보고 직전 아래 Bash 블록을 실행하고 raw output을 남긴다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun --check openclaw-orchestrator/scripts/task-hud/update_event.ts
before_canonical=$(stat -c '%Y' openclaw-orchestrator/state/task-hud/discord-career-main.json 2>/dev/null || echo 0)
LEGACY_HUD_ROOT="${OPENCLAW_WORKSPACE_HUD_STATE_ROOT:-$HOME/.openclaw/workspace/openclaw-orchestrator/state/task-hud}"
legacy_count=$(find "$LEGACY_HUD_ROOT" -maxdepth 1 -name 'discord-career-main.json' 2>/dev/null | wc -l)
echo "legacy-state-count=$legacy_count"
bun openclaw-orchestrator/scripts/task-hud/update_event.ts --dry-run --session discord-career-main --task-label plan050 --event phase-start --status dogfood > /tmp/plan050-dogfood-dry.txt
cat /tmp/plan050-dogfood-dry.txt
rg -n '^Task: plan050$' /tmp/plan050-dogfood-dry.txt
! rg -n 'email|account|cost|token|secret' /tmp/plan050-dogfood-dry.txt
after_dry=$(stat -c '%Y' openclaw-orchestrator/state/task-hud/discord-career-main.json 2>/dev/null || echo 0)
test "$before_canonical" = "$after_dry"
git diff --check
```

Real edit은 main session에서만 실행한다.
실행 가능한 main session이면 아래 명령을 한 번 실행하고 결과를 보고한다.
실행 불가한 session이면 dry-run 결과만 남기고 blocked 처리하지 않는다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun openclaw-orchestrator/scripts/task-hud/update_event.ts --session discord-career-main --target channel:1492521172099666021 --task-label plan050 --event phase-start --status dogfood
```

---

## 커밋 및 푸시 경계

의도한 변경만 stage한다.
이 phase의 커밋은 dogfooding guard나 real edit helper 보정만 담는다.
커밋 뒤 `git push origin main`을 실행한다.

---

## 중단 조건

- real edit이 새 HUD message를 만들었는데 fallback warning이 없으면 `PHASE_FAILED: fallback warning missing`을 출력하고 exit 1.
- canonical root 외 state를 읽어야만 동작하면 `PHASE_FAILED: legacy HUD state dependency`를 출력하고 exit 1.
- visible HUD에 private absolute path나 sensitive field가 나오면 `PHASE_FAILED: visible HUD privacy leak`을 출력하고 exit 1.
