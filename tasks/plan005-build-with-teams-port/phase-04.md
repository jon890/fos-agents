# Phase 04 — AGENTS.md / code-architecture.md 반영 + 검증

**Model**: sonnet
**Status**: pending

---

## 목표

build-with-teams를 모노레포 문서에 반영하고, 실제 1회 실행으로 검증한 뒤 plan을 완료 처리한다.

**범위 외**: skill/agent/variant 재작성(phase-01~03). ADR-018은 이미 반영됨.

---

## 사전 cwd

```bash
cd "$(git rev-parse --show-toplevel)"
```

## 작업

### 1. AGENTS.md 반영

ai-nodes 루트 `AGENTS.md`(또는 해당 실행 모델 섹션)에 build-with-teams를 추가:
- 공용 skill 목록에 `build-with-teams` 추가.
- plan-and-build와 병존 한 줄: "무인 cron/background → plan-and-build, 대화형 가시 협업 → build-with-teams"(ADR-018).
- 전용 agent 패턴(`.claude/agents/<workspace>-{executor,docs-verifier}.md`) 언급.

### 2. code-architecture.md 반영

ai-nodes `docs/code-architecture.md`:
- 공용 skills 목록(`.claude/skills/`)에 build-with-teams 추가.
- `.claude/agents/` 디렉터리 책임(워크스페이스 전용 agent) 추가.

### 3. 검증 — build-with-teams 1회 실행 (smoke)

작은 검증 대상으로 build-with-teams 흐름을 실제 1회 돌린다(가시 협업 동작 확인). 대안: TeamCreate로 critic 1명 스폰 → verify_team_members.sh 통과 → SendMessage 왕복 1회 → shutdown. 본격 plan 실행이 아니라 **파이프라인 동작 smoke**다.
- 환경상 Agent Teams 스폰이 불가하면 그 사실을 보고하고 skill·agent·variant 파일 정합 검증으로 대체(PHASE_BLOCKED 아님 — 문서/구조 검증으로 완료 가능).

### 4. index.json 완료 처리

`tasks/plan005-build-with-teams-port/index.json` status=completed, 모든 phase status=completed.

---

## 성공 기준

```bash
cd "$(git rev-parse --show-toplevel)"
FAIL=0
grep -q "build-with-teams" AGENTS.md || { echo "[FAIL] AGENTS.md 미반영"; FAIL=1; }
grep -q "build-with-teams" docs/code-architecture.md || { echo "[FAIL] code-architecture 미반영"; FAIL=1; }
# skill·agent·variant 정합
[ -f .claude/skills/build-with-teams/SKILL.md ] && [ -f .claude/agents/career-os-executor.md ] && [ -f .claude/skills/build-with-teams/variants/career-os.md ] || { echo "[FAIL] 산출물 누락"; FAIL=1; }
grep -q '"status": "completed"' tasks/plan005-build-with-teams-port/index.json || { echo "[FAIL] index.json 미완료"; FAIL=1; }
[ "$FAIL" = 0 ] && echo "SUCCESS phase-04 — plan005 완료" || { echo "PHASE_FAILED"; exit 1; }
```

## commit (push 금지 — 이후 plan 단위 PR은 메인 세션)

```bash
git add AGENTS.md docs/code-architecture.md tasks/plan005-build-with-teams-port/index.json
git commit -q -m "docs(ai-nodes): build-with-teams AGENTS·code-architecture 반영 + plan005 완료 (ADR-018)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## Blocked 조건

- 성공 기준 FAIL: `PHASE_FAILED`
