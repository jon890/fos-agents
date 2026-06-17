# Phase 03 — scripts follow-up contract

**Model**: sonnet
**Status**: pending

---

## 목표

scripts 계층의 Claude 실행기 hardcoding을 이번 plan에서 구현하지 않고, 후속 plan의 결정점으로 고정한다.
현재 운영 runner를 깨지 않기 위해 실행 코드 변경은 하지 않는다.

**범위 외**:
- `skill_executor.ts` 실행 로직 변경
- `run_daily_with_claude.ts` 실행 로직 변경
- cron payload 변경
- 실제 agent command abstraction 구현

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 작업 항목

### 1. scripts 잔재 목록 재확인

다음 영역의 CLI hardcoding을 읽기 전용으로 분류한다:
- `career-os/scripts/application-agent/`
- `career-os/scripts/position-recommender/`
- `career-os/scripts/study-pack-writer/`

### 2. 후속 결정점 정리

후속 plan에서 선택할 방향을 task 또는 hand-off 메모에 남긴다:
- 실행기 주입: `CAREER_OS_AGENT_CMD` 같은 env로 실행기를 바꾼다.
- 호출 제거: scripts는 수집과 후처리만 맡고 skill 실행은 에이전트가 직접 맡는다.
- 현상 유지: 운영 runner는 Claude CLI 호환 계층으로 유지한다.

### 3. current docs와 충돌하지 않게 설명 보강

현재 docs는 agent skill 호출 의도를 표준으로 둔다.
scripts 잔재는 구현 부채가 아니라 의도적으로 보류한 운영 호환 계층으로 설명한다.

### 4. 통합 검증

문서, SKILL.md, 사용자 표시 렌더러에는 hardcoding이 없어야 한다.
scripts 실행기 잔재와 과거 ADR/task 기록은 별도 분류로 남아야 한다.

---

## 검증

보고 직전 반드시 Bash 도구로 직접 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"

# 현재 표준 문서와 skill 표면은 clean이어야 한다.
! rg --hidden -n "claude[ ]-p|claude[ ]--permission|--permission[-]mode|--max[-]turns|claude[ ]--output-format" \
  career-os/AGENTS.md \
  career-os/TOOLS.md \
  career-os/docs/prd.md \
  career-os/docs/flow.md \
  career-os/docs/code-architecture.md \
  career-os/.claude/skills \
  career-os/scripts/study-topic-recommender/render

# scripts 실행기 잔재는 후속 범위로 분류되어야 한다.
rg --hidden -n "claude[ ]-p|claude[ ]--permission|--permission[-]mode|--max[-]turns|claude[ ]--output-format" \
  career-os/scripts/application-agent \
  career-os/scripts/position-recommender \
  career-os/scripts/study-pack-writer

# JSON task 파일은 유효해야 한다.
python3 -m json.tool career-os/tasks/plan087-agent-agnostic-skill-invocation/index.json >/tmp/plan087-index.json
```

## Blocked 조건

- scripts 실행기를 이번 plan에서 바꾸라는 새 요구가 나오면 `PHASE_BLOCKED: scripts 실행기 결정 재개 필요`를 출력하고 종료한다.
- 운영 runner 검증 없이 실행 로직을 바꿔야만 grep을 통과할 수 있으면 `PHASE_BLOCKED: 실행기 abstraction 별도 plan 필요`를 출력하고 종료한다.
