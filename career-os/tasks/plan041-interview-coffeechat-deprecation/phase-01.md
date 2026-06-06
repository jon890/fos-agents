# Phase 01 — Caller Inventory And Migration Map

**Model**: sonnet
**Status**: pending

---

## 목표

coffeechat-specific 자동화를 폐기하기 전에 active caller, config, skill, script, docs, data archive를 inventory로 정리하고, first-round/final/offer 준비 기능 중 `interview-prep-analyzer`로 이관할 항목을 명확히 한다.

**범위 외**:

- 파일 삭제.
- active skill routing 변경.
- `interview-prep-analyzer` 구현 변경.
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
- `career-os/docs/adr.md` — ADR-029, ADR-034, ADR-048.
- `career-os/docs/code-architecture.md`
- `career-os/docs/flow.md`
- `career-os/.claude/skills/interview-prep-analyzer/SKILL.md`
- `career-os/.claude/skills/interview-coffeechat-prep/SKILL.md`

---

## 작업 항목

1. `rg -n "coffeechat|커피챗|interview-coffeechat-prep|offer-chat|final-round|first-round"`로 active caller inventory를 수집한다.
2. `career-os/tasks/plan041-interview-coffeechat-deprecation/inventory.md`를 작성한다.
3. inventory를 네 그룹으로 분류한다.
   - 폐기: coffeechat-specific prompt, default mode, 자동 전략 리포트 routing.
   - 이관: first-round/final/offer 면접 준비 기능.
   - 보존: 과거 task/ADR/report archive.
   - 확인 필요: 삭제하면 current first-round workflow가 깨질 수 있는 파일.
4. `interview-prep-analyzer`로 이관할 기능의 최소 계약을 적는다.
5. 구현 중 모호한 caller가 발견되면 삭제하지 말고 Blocked로 남긴다.

---

## 검증

```bash
cd "$(git rev-parse --show-toplevel)"

test -f career-os/tasks/plan041-interview-coffeechat-deprecation/inventory.md \
  || { echo "PHASE_FAILED: inventory.md missing"; exit 1; }

rg -n "폐기|이관|보존|확인 필요" career-os/tasks/plan041-interview-coffeechat-deprecation/inventory.md \
  || { echo "PHASE_FAILED: inventory categories missing"; exit 1; }

python3 -m json.tool career-os/tasks/plan041-interview-coffeechat-deprecation/index.json > /dev/null \
  || { echo "PHASE_FAILED: index.json invalid"; exit 1; }
```

---

## Blocked 조건

- first-round 준비가 `interview-coffeechat-prep`에 강하게 결합되어 이관 범위를 판단할 수 없으면 `PHASE_BLOCKED: first-round migration boundary unclear`를 출력하고 exit 2.
- active cron/caller가 발견됐는데 대체 경로가 없으면 `PHASE_BLOCKED: active coffeechat caller needs replacement`를 출력하고 exit 2.
