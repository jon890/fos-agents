# Phase 04 — Coffeechat Asset Deprecation

**Model**: sonnet
**Status**: pending

---

## 목표

coffeechat-specific skill/script/reference/config를 active workflow에서 제거하거나 archive/tombstone으로 전환한다. 과거 기록은 삭제하지 않는다.

**범위 외**:

- 과거 task/ADR 삭제.
- 과거 `data/reports`와 archive 삭제.
- first-round/final/offer 준비 기능 삭제.
- commit/push.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

- `career-os/docs/adr.md` — ADR-048.
- `career-os/tasks/plan041-interview-coffeechat-deprecation/inventory.md`
- `career-os/.claude/skills/interview-coffeechat-prep/SKILL.md`
- `career-os/scripts/interview-coffeechat-prep/`
- `career-os/config/mvp-target.json`

---

## 작업 항목

1. `interview-coffeechat-prep` skill을 active skill에서 제거하거나 `deprecated` tombstone으로 전환한다.
2. `scripts/interview-coffeechat-prep`가 caller 0이면 제거한다. caller가 남아 있으면 tombstone으로 막고 `PHASE_BLOCKED` 여부를 판단한다.
3. `references/coffeechat-prompt.md`와 `coffeechat-review-prompt.md`는 active prompt로 쓰이지 않게 archive 또는 삭제 후보로 처리한다.
4. `config/mvp-target.json`에서 `coffeechat` block을 제거할지, historical compatibility로 null 처리할지 inventory 근거에 따라 결정한다.
5. 삭제 대신 archive가 필요한 파일은 `data/private/.../prep-archive` 또는 task inventory에 경로만 남긴다.

---

## 검증

```bash
cd "$(git rev-parse --show-toplevel)"

! rg -n "default coffeechat|mode 생략 시 coffeechat|커피챗 준비.*default|/interview-coffeechat-prep" \
  career-os/AGENTS.md career-os/docs/flow.md career-os/.claude/skills career-os/scripts career-os/config \
  || { echo "PHASE_FAILED: active coffeechat entrypoint remains"; exit 1; }

rg -n "interview-prep-analyzer" career-os/AGENTS.md career-os/docs/flow.md career-os/.claude/skills \
  || { echo "PHASE_FAILED: replacement interview prep path missing"; exit 1; }
```

---

## Blocked 조건

- coffeechat script/skill 삭제가 first-round/final/offer를 같이 깨면 `PHASE_BLOCKED: reusable interview mode still coupled to coffeechat asset`를 출력하고 exit 2.
- config migration이 data loss 위험을 만들면 `PHASE_BLOCKED: coffeechat config migration unsafe`를 출력하고 exit 2.
