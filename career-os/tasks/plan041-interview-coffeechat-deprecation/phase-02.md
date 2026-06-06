# Phase 02 — Active Docs And Routing Deprecation

**Model**: sonnet
**Status**: pending

---

## 목표

AGENTS/flow/code-architecture/skill routing에서 coffeechat 자동화를 active workflow에서 제거한다. 과거 ADR/task/archive는 보존하되, 새 에이전트가 coffeechat skill을 표준 진입점으로 오해하지 않도록 tombstone만 남긴다.

**범위 외**:

- coffeechat script/skill 파일 삭제.
- `interview-prep-analyzer` 구현 변경.
- 과거 report/archive 삭제.
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
- `career-os/tasks/plan041-interview-coffeechat-deprecation/inventory.md`

---

## 작업 항목

1. `AGENTS.md` native skill 목록에서 `/interview-coffeechat-prep` active entry를 제거하거나 deprecated tombstone으로 축소한다.
2. `docs/flow.md`의 `/interview-coffeechat-prep` active flow를 deprecated 섹션으로 이동 또는 축소한다.
3. `docs/code-architecture.md`에서 interview-coffeechat-prep를 active 구조가 아닌 deprecation target으로 표기한다.
4. `.claude/skills/position-recommender/SKILL.md`의 coffeechat routing 문구를 제거한다.
5. coffeechat 요청은 자동화 실행이 아니라 회사/상대/목적 확인 질문으로 라우팅한다는 원칙을 남긴다.

---

## 검증

```bash
cd "$(git rev-parse --show-toplevel)"

! rg -n "커피챗 전략 리포트.*interview-coffeechat-prep|claude -p \"/interview-coffeechat-prep\"" \
  career-os/AGENTS.md career-os/docs/flow.md career-os/.claude/skills/position-recommender/SKILL.md \
  || { echo "PHASE_FAILED: active coffeechat routing remains"; exit 1; }

rg -n "ADR-048|deprecated|폐기" \
  career-os/AGENTS.md career-os/docs/flow.md career-os/docs/code-architecture.md \
  || { echo "PHASE_FAILED: deprecation tombstone missing"; exit 1; }
```

---

## Blocked 조건

- active docs를 수정하면 현재 first-round workflow가 사라지는 구조라면 `PHASE_BLOCKED: first-round docs replacement needed`를 출력하고 exit 2.
- coffeechat routing 제거 후 대체 안내 문구를 둘 위치가 불명확하면 `PHASE_BLOCKED: coffeechat fallback guidance unclear`를 출력하고 exit 2.
