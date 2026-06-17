# Phase 02 — skill surface audit

**Model**: sonnet
**Status**: pending

---

## 목표

SKILL.md와 사용자에게 표시되는 generated markdown 문구에서 CLI hardcoding을 제거한다.
실제 실행기를 바꾸지 않고, 사람이 읽는 문구와 skill 위임 문구만 agent 비종속 표현으로 바꾼다.

**범위 외**:
- `skill_executor.ts` 같은 실제 실행기 구현 변경
- cron runner 동작 변경
- 과거 ADR과 완료된 task 기록 수정

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 작업 항목

### 1. hidden skill audit

`--hidden`을 사용해 `.claude/skills`와 `.codex/skills`까지 확인한다.
`.codex/skills`는 심볼릭 링크이므로 정본 수정은 `.claude/skills`에만 한다.

### 2. SKILL.md 위임 표현 정제

SKILL.md 안에서 다른 skill을 부르는 문구는 `/<skill> [args]` 또는 `<skill> 위임`으로 바꾼다.
특정 CLI 실행 방법은 쓰지 않는다.

### 3. 사용자 표시 markdown 문구 정제

`scripts/study-topic-recommender/render/markdown.ts`처럼 사용자에게 안내 문구를 렌더링하는 파일은 실행기 구현이 아니므로 정제 대상이다.
문구는 skill 호출 의도로 바꾸고, 실제 spawn 로직은 변경하지 않는다.

### 4. scripts 실행기 잔재는 분리

`skill_executor.ts`, `skill_contracts.ts`, `run_daily_with_claude.ts`, `run_with_discord_notify.ts`처럼 실제 실행하거나 실행 명령을 구성하는 파일은 이번 phase에서 수정하지 않는다.
phase-03의 후속 plan 계약에 남긴다.

---

## 검증

보고 직전 반드시 Bash 도구로 직접 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"

# SKILL.md와 사용자 표시 렌더러에서 CLI hardcoding이 없어야 한다.
! rg --hidden -n "claude[ ]-p|claude[ ]--permission|--permission[-]mode|--max[-]turns|claude[ ]--output-format" \
  career-os/.claude/skills \
  career-os/scripts/study-topic-recommender/render

# scripts 실행기 잔재는 phase-03 후속 범위로 남아야 한다.
rg --hidden -n "claude[ ]-p|claude[ ]--permission|--permission[-]mode|--max[-]turns|claude[ ]--output-format" \
  career-os/scripts/application-agent \
  career-os/scripts/position-recommender \
  career-os/scripts/study-pack-writer \
  >/tmp/plan087-scripts-followup.txt
test -s /tmp/plan087-scripts-followup.txt
```

## Blocked 조건

- `.claude/skills`에서 CLI hardcoding이 발견됐지만 문맥상 역사 기록인지 현재 지시인지 판단할 수 없으면 `PHASE_BLOCKED: skill 본문 판단 필요`를 출력하고 종료한다.
- 사용자 표시 렌더러와 실제 실행기를 같은 파일에서 분리하기 어렵다면 `PHASE_BLOCKED: scripts 범위 재결정 필요`를 출력하고 종료한다.
