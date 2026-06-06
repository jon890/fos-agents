# Phase 05 — Validation And Completion Metadata

**Model**: haiku
**Status**: pending

---

## 목표

coffeechat 자동화가 active workflow에서 제거됐고, 필요한 면접 준비 기능이 `interview-prep-analyzer`로 이관됐는지 검증한다. 마지막으로 task metadata만 갱신한다.

**범위 외**:

- 추가 리팩터링.
- 새 면접 준비 기능 생성.
- 과거 archive 삭제.
- commit/push.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

- `career-os/AGENTS.md`
- `career-os/docs/adr.md` — ADR-048.
- `career-os/docs/code-architecture.md`
- `career-os/docs/flow.md`
- `career-os/tasks/plan041-interview-coffeechat-deprecation/index.json`

---

## 검증

```bash
cd "$(git rev-parse --show-toplevel)"

python3 -m json.tool career-os/tasks/plan041-interview-coffeechat-deprecation/index.json > /dev/null \
  || { echo "PHASE_FAILED: index.json invalid"; exit 1; }

test -f career-os/tasks/plan041-interview-coffeechat-deprecation/inventory.md \
  || { echo "PHASE_FAILED: inventory.md missing"; exit 1; }

! rg -n "claude -p \"/interview-coffeechat-prep\"|커피챗 전략 리포트 →|default coffeechat|mode 생략 시 coffeechat" \
  career-os/AGENTS.md career-os/docs/flow.md career-os/docs/code-architecture.md career-os/.claude/skills career-os/scripts career-os/config \
  || { echo "PHASE_FAILED: active coffeechat routing remains"; exit 1; }

rg -n "interview-prep-analyzer|면접 연습|1차 면접" \
  career-os/AGENTS.md career-os/docs/flow.md career-os/.claude/skills/interview-prep-analyzer/SKILL.md \
  || { echo "PHASE_FAILED: replacement interview prep guidance missing"; exit 1; }

git diff --check
```

---

## Metadata Update

검증이 모두 통과하면 `index.json`을 갱신한다.

- `status`: `"completed"`
- `current_phase`: `5`
- 모든 phase status: `"completed"`
- `updated_at`: 실제 완료 UTC timestamp
- `error_message`: `null`
- `blocked_reason`: `null`

---

## Blocked 조건

- active coffeechat routing이 남아 있는데 안전하게 제거할 수 없으면 `PHASE_BLOCKED: active coffeechat routing remains`를 출력하고 exit 2.
- replacement interview prep path가 명확하지 않으면 `PHASE_BLOCKED: replacement interview prep path missing`을 출력하고 exit 2.
