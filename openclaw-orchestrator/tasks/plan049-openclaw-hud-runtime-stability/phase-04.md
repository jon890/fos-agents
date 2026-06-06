# Phase 04 — pinned message edit fallback warning 정책 구현

**Model**: sonnet
**Status**: pending

---

## 목표

Pinned HUD update는 기존 message id edit을 먼저 시도하고, edit 실패로 새 HUD를 만들 때 별도 visible warning을 보낸다.

**범위 외**: state root 변경, timestamp 변경, `session_status` field mapping.

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

1. 저장된 `hudMessageId`가 있으면 send보다 edit을 먼저 시도한다.
2. edit 성공 시 새 message를 만들지 않는다.
3. edit 실패 뒤 fallback send가 성공하면 state에 previous message id를 남긴다.
4. fallback send 성공 직후 별도 visible warning을 emoji 포함으로 보낸다.
5. warning text는 새 HUD가 created 되었고 user가 pin해야 한다는 내용을 포함한다.

---

## 검증

보고 직전 아래 Bash 블록을 실행하고 raw output을 남긴다.
기본 검증은 dry-run과 mockable command path만 사용한다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun _shared/lib/task_hud.ts update --dry-run --session plan049-edit-policy --task-label plan049 --status phase-04 > /tmp/plan049-edit-policy.txt
cat /tmp/plan049-edit-policy.txt
rg -n '^Updated: .*KST$' /tmp/plan049-edit-policy.txt
rg -n "edit" _shared/lib/task_hud.ts
rg -n "pin|pinned|pinning|created|new HUD|⚠" _shared/lib/task_hud.ts
git diff --check
HOME_PREFIX=$(printf '/%s/' home)
USERS_PREFIX=$(printf '/%s/' Users)
rg -n "$HOME_PREFIX|$USERS_PREFIX" _shared/lib/task_hud.ts openclaw-orchestrator/tasks/plan049-openclaw-hud-runtime-stability && exit 1 || true
```

Real Discord/OpenClaw validation은 main session에서만 한다.
그 검증은 existing pinned message id edit만 대상으로 한다.
새 message 생성은 edit failure path를 intentionally tested로 표시한 경우에만 허용한다.

---

## 커밋 및 푸시 경계

의도한 변경만 stage한다.
이 phase의 커밋은 edit-first fallback warning 정책 변경만 담는다.
커밋 뒤 `git push origin main`을 실행한다.

---

## 중단 조건

- edit 성공 경로에서 새 HUD message가 만들어지면 작업을 중단한다.
- fallback warning 없이 새 HUD message를 만들게 되면 작업을 중단한다.
- main session이 아닌 곳에서 real edit 검증이 필요하면 dry-run 결과만 남기고 보고한다.
