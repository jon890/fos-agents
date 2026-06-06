# Phase 05 — 검증과 문서 및 커밋 경계 정리

**Model**: haiku
**Status**: pending

---

## 목표

Plan049 변경 전체를 검증하고, 문서와 task metadata를 정리한 뒤 intended files만 commit/push 한다.

**범위 외**: 새 기능 추가, HUD format redesign, unrelated dirty file 정리.

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
- `openclaw-orchestrator/tasks/plan049-openclaw-hud-runtime-stability/index.json`

---

## 작업 항목

1. Dry-run HUD update 검증을 다시 실행한다.
2. state path가 `openclaw-orchestrator/state/task-hud/` 하나인지 확인한다.
3. real edit 검증이 main session에서 수행됐는지 확인한다.
4. edit failure path를 intentionally tested로 표시하지 않았다면 새 HUD message가 없어야 한다.
5. docs나 task에 private absolute path가 없는지 scan한다.
6. `index.json` status와 phase status를 실제 결과에 맞게 갱신한다.

---

## 검증

보고 직전 아래 Bash 블록을 실행하고 raw output을 남긴다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun _shared/lib/task_hud.ts update --dry-run --session plan049-final --task-label plan049 --status phase-05 > /tmp/plan049-final-hud.txt
cat /tmp/plan049-final-hud.txt
rg -n '^Updated: .*KST$' /tmp/plan049-final-hud.txt
HOME_PREFIX=$(printf '/%s/' home)
USERS_PREFIX=$(printf '/%s/' Users)
! rg -n "just now|ago|UTC|$HOME_PREFIX|$USERS_PREFIX" /tmp/plan049-final-hud.txt
find . -path '*/state/task-hud' -type d -print | sort
test "$(find . -path '*/state/task-hud' -type d -print | wc -l)" -eq 1
rg -n "$HOME_PREFIX|$USERS_PREFIX" openclaw-orchestrator/AGENTS.md openclaw-orchestrator/tasks/plan049-openclaw-hud-runtime-stability _shared/lib/task_hud.ts && exit 1 || true
git diff --check
git status --short
```

If real edit validation was run from main session, report the existing pinned message edit result.
If it was not run, report that only dry-run validation was performed.

---

## 커밋 및 푸시 경계

의도한 변경만 stage한다.
Final commit은 docs metadata 또는 task metadata 정리만 담는다.
커밋 뒤 `git push origin main`을 실행한다.

---

## 중단 조건

- private absolute path scan이 하나라도 걸리면 수정 전까지 완료하지 않는다.
- second state root가 보이면 완료하지 않는다.
- unintended dirty file이 있으면 stage하지 않고 보고한다.
