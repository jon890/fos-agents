# Phase 02 — run-phases.py 이벤트 갱신 연결

**Model**: sonnet
**Status**: pending

---

## 목표

plan-and-build phase 실행기가 작업 이벤트마다 HUD를 갱신하게 연결한다.
장기 구현 작업이 진행될 때 HUD가 수동 기억에 의존하지 않게 한다.

**범위 외**: wrapper 신규 구현, current session real edit dogfooding, legacy state cleanup.

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
- `skills/plan-and-build/scripts/run-phases.py`

---

## 작업 항목

1. `skills/plan-and-build/scripts/run-phases.py`에 optional HUD update 함수를 추가한다.
   - HUD env가 없으면 조용히 skip한다.
   - subprocess 실패가 phase 실행 자체를 깨뜨리지 않게 warning만 출력한다.
2. env 계약을 좁게 둔다.
   - `TASK_HUD_SESSION_ID`: HUD session id.
   - `TASK_HUD_TARGET`: optional OpenClaw target.
   - `TASK_HUD_DISABLE=1`: HUD 갱신 skip.
3. phase 이벤트 연결.
   - task 시작: `start`.
   - phase 시작: `phase-start`.
   - phase 성공: `phase-complete`.
   - blocked: `blocked`.
   - failed: `failed`.
   - 전체 완료: `complete`.
4. 기존 Discord 알림과 중복되더라도 역할을 분리한다.
   - Discord 알림은 narration.
   - HUD는 pinned state projection.

---

## 검증

보고 직전 아래 Bash 블록을 실행하고 raw output을 남긴다.

```bash
cd "$(git rev-parse --show-toplevel)"
python3 -m py_compile skills/plan-and-build/scripts/run-phases.py
bun --check openclaw-orchestrator/scripts/task-hud/update_event.ts
rg -n 'TASK_HUD_SESSION_ID|TASK_HUD_TARGET|TASK_HUD_DISABLE' skills/plan-and-build/scripts/run-phases.py
rg -n 'phase-start|phase-complete|blocked|failed|complete' skills/plan-and-build/scripts/run-phases.py
tmpdir=$(mktemp -d)
mkdir -p "$tmpdir/workspace/tasks/demo"
cat > "$tmpdir/workspace/tasks/demo/index.json" <<'JSON'
{
  "name": "demo",
  "description": "demo",
  "created_at": "2026-06-07T00:00:00Z",
  "updated_at": "2026-06-07T00:00:00Z",
  "status": "pending",
  "current_phase": 1,
  "total_phases": 1,
  "error_message": null,
  "blocked_reason": null,
  "phases": [
    {
      "number": 1,
      "title": "demo",
      "file": "phase-01.md",
      "status": "pending",
      "allowedTools": ["Bash"],
      "model": "haiku",
      "timeout": 1
    }
  ]
}
JSON
cat > "$tmpdir/workspace/tasks/demo/phase-01.md" <<'MD'
Print only done.
MD
TASK_HUD_SESSION_ID=plan050-dry TASK_HUD_TARGET=channel:dry-run TASK_HUD_DISABLE=1 python3 skills/plan-and-build/scripts/run-phases.py "$tmpdir/workspace/tasks/demo" --to-phase 1 || true
rm -rf "$tmpdir"
git diff --check
```

검증은 `TASK_HUD_DISABLE=1`로 실행한다.
실제 Claude 호출 성공 여부가 아니라 HUD env path가 syntax를 깨지 않는지를 본다.

---

## 커밋 및 푸시 경계

의도한 변경만 stage한다.
이 phase의 커밋은 `run-phases.py` HUD event 연결만 담는다.
커밋 뒤 `git push origin main`을 실행한다.

---

## 중단 조건

- HUD subprocess 실패가 phase success/failure 판정을 바꾸게 되면 `PHASE_FAILED: HUD update must be non-blocking`을 출력하고 exit 1.
- HUD env가 없을 때 기존 `run-phases.py` 실행이 깨지면 `PHASE_FAILED: HUD env optionality broken`을 출력하고 exit 1.
- raw phase stdout/stderr 전체를 HUD에 넣어야 한다면 `PHASE_BLOCKED: raw phase output would leak`를 출력하고 exit 2.
