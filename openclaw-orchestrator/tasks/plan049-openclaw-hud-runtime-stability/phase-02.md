# Phase 02 — Updated timestamp KST 절대시간 렌더링

**Model**: sonnet
**Status**: pending

---

## 목표

Pinned HUD의 `Updated` line을 KST absolute timestamp로 렌더링한다.

**범위 외**: state root 변경, message edit fallback, `session_status` wrapper.

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

1. `formatUpdatedAt` 또는 equivalent 렌더링 지점을 KST absolute time으로 바꾼다.
2. `Updated`는 날짜, 시각, `KST`를 포함한다.
3. Relative-only wording은 visible HUD에서 쓰지 않는다.
4. invalid timestamp fallback은 raw value를 안전하게 보여주되 private path와 무관하게 유지한다.

---

## 검증

보고 직전 아래 Bash 블록을 실행하고 raw output을 남긴다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun _shared/lib/task_hud.ts update --dry-run --session plan049-kst --task-label plan049 --status phase-02 > /tmp/plan049-hud.txt
cat /tmp/plan049-hud.txt
rg -n '^Updated: .*KST$' /tmp/plan049-hud.txt
! rg -n 'just now|ago|UTC' /tmp/plan049-hud.txt
git diff --check
HOME_PREFIX=$(printf '/%s/' home)
USERS_PREFIX=$(printf '/%s/' Users)
rg -n "$HOME_PREFIX|$USERS_PREFIX" _shared/lib/task_hud.ts openclaw-orchestrator/tasks/plan049-openclaw-hud-runtime-stability && exit 1 || true
```

---

## 커밋 및 푸시 경계

의도한 변경만 stage한다.
이 phase의 커밋은 timestamp 렌더링 변경만 담는다.
커밋 뒤 `git push origin main`을 실행한다.

---

## 중단 조건

- `Updated`가 KST absolute timestamp로 확인되지 않으면 작업을 중단한다.
- timestamp 변경이 state schema나 message fallback 정책까지 건드리면 해당 변경을 되돌리고 다음 phase로 넘긴다.
