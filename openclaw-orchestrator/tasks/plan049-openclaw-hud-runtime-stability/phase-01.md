# Phase 01 — state root 안정화

**Model**: sonnet
**Status**: pending

---

## 목표

HUD state root가 cwd, env, 호출 위치에 따라 갈라지지 않게 안정화한다.

**범위 외**: timestamp 렌더링, `session_status` wrapper, visible warning 정책 변경.

---

## 사전 cwd 설정

첫 Bash 호출에서 ai-nodes repo root로 이동한다.
이 phase의 모든 path는 repo-relative path를 쓴다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 관련 문서와 파일

- `AGENTS.md`
- `openclaw-orchestrator/AGENTS.md`
- `_shared/lib/task_hud.ts`
- `openclaw-orchestrator/state/task-hud/.gitignore`

---

## 작업 항목

1. `_shared/lib/task_hud.ts`의 default state root resolution을 점검한다.
2. 어떤 cwd에서 실행해도 `openclaw-orchestrator/state/task-hud/`만 쓰도록 보정한다.
3. `TASK_HUD_STATE_ROOT` override가 필요한 경우에도 private absolute path가 visible output에 섞이지 않게 유지한다.
4. 같은 session id update가 같은 state file을 읽고 쓰는지 dry-run으로 검증한다.

---

## 검증

보고 직전 아래 Bash 블록을 실행하고 raw output을 남긴다.

```bash
cd "$(git rev-parse --show-toplevel)"
before_count=$(find . -path '*/state/task-hud/*.json' -print | sort | wc -l)
bun _shared/lib/task_hud.ts update --dry-run --session plan049-state-root --task-label plan049 --status phase-01
bun _shared/lib/task_hud.ts status --dry-run --session plan049-state-root
after_count=$(find . -path '*/state/task-hud/*.json' -print | sort | wc -l)
echo "state-json-before=$before_count"
echo "state-json-after=$after_count"
test -d openclaw-orchestrator/state/task-hud
test ! -d state/task-hud
git diff --check
HOME_PREFIX=$(printf '/%s/' home)
USERS_PREFIX=$(printf '/%s/' Users)
rg -n "$HOME_PREFIX|$USERS_PREFIX" _shared/lib/task_hud.ts openclaw-orchestrator/AGENTS.md openclaw-orchestrator/tasks/plan049-openclaw-hud-runtime-stability && exit 1 || true
```

Dry-run 검증은 state file을 새로 만들지 않아야 한다.
실제 쓰기 검증이 필요하면 repo-relative state root만 사용하고 생성 파일을 의도한 commit에 포함하거나 즉시 정리한다.

---

## 커밋 및 푸시 경계

의도한 변경만 stage한다.
이 phase의 커밋은 state root 안정화 변경만 담는다.
커밋 뒤 `git push origin main`을 실행한다.

---

## 중단 조건

- 두 번째 state root가 생기면 수정하거나 작업을 중단하고 원인을 보고한다.
- private absolute path가 docs, task, visible HUD 후보 문자열에 나오면 작업을 중단한다.
- dry-run 없이 새 HUD message를 보내야만 검증 가능한 상태라면 main session 검증 phase로 넘긴다.
