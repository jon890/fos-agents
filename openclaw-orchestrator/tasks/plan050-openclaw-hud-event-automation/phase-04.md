# Phase 04 — 검증과 task 상태 정리

**Model**: haiku
**Status**: pending

---

## 목표

plan050 변경을 검증하고 task 상태를 실제 결과에 맞게 정리한다.
마지막 phase 뒤 trailing working tree 변경이 남지 않게 cleanup commit까지 처리한다.

**범위 외**: 새로운 HUD 기능 추가, legacy state file 삭제, 별도 scheduler 도입.

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
- `openclaw-orchestrator/tasks/plan050-openclaw-hud-event-automation/index.json`
- `openclaw-orchestrator/scripts/task-hud/`
- `skills/plan-and-build/scripts/run-phases.py`

---

## 작업 항목

1. 문법과 dry-run을 검증한다.
2. HUD visible output privacy grep을 수행한다.
3. `index.json`의 phase status와 task status를 실제 결과에 맞게 업데이트한다.
4. phase commit 후 run-phases.py가 남긴 trailing `index.json` 변경이 있으면 cleanup commit을 만든다.
5. 마지막 HUD를 `complete`로 real edit한다.
   - main session real edit이 불가능하면 dry-run 결과를 남기고 blocked 처리하지 않는다.

---

## 검증

보고 직전 아래 Bash 블록을 실행하고 raw output을 남긴다.

```bash
cd "$(git rev-parse --show-toplevel)"
python3 -m json.tool openclaw-orchestrator/tasks/plan050-openclaw-hud-event-automation/index.json >/tmp/plan050-index.json
python3 -m py_compile skills/plan-and-build/scripts/run-phases.py
for file in openclaw-orchestrator/scripts/task-hud/*.ts; do
  bun --check "$file"
done
bun openclaw-orchestrator/scripts/task-hud/update_event.ts --dry-run --session plan050-final --task-label plan050 --event complete --status done > /tmp/plan050-final-hud.txt
cat /tmp/plan050-final-hud.txt
rg -n '^State: complete: done$' /tmp/plan050-final-hud.txt
! rg -n 'email|account|cost|token|secret' /tmp/plan050-final-hud.txt
HOME_PREFIX=$(printf '/%s/' home)
USERS_PREFIX=$(printf '/%s/' Users)
! rg -n "$HOME_PREFIX|$USERS_PREFIX" openclaw-orchestrator/tasks/plan050-openclaw-hud-event-automation openclaw-orchestrator/AGENTS.md
git diff --check
git status --short
```

Real edit 가능한 main session이면 마지막에 아래 명령을 한 번 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun openclaw-orchestrator/scripts/task-hud/update_event.ts --session discord-career-main --target channel:1492521172099666021 --task-label plan050 --event complete --status done
```

---

## 커밋 및 푸시 경계

의도한 변경만 stage한다.
이 phase의 커밋은 검증 보정과 task 상태 정리만 담는다.
커밋 뒤 `git push origin main`을 실행한다.

run-phases.py가 commitSha 또는 updated_at을 후기록해 trailing 변경이 남으면 cleanup commit을 추가하고 push한다.

---

## 중단 조건

- `index.json` 검증 실패 시 수정하거나 `PHASE_FAILED: plan050 index invalid`를 출력하고 exit 1.
- privacy grep 실패 시 `PHASE_FAILED: visible HUD privacy leak`를 출력하고 exit 1.
- intended file 외 변경이 stage되면 `PHASE_FAILED: unrelated files staged`를 출력하고 exit 1.
