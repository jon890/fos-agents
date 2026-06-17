# Phase 01 — docs-first materialization

**Model**: sonnet
**Status**: pending

---

## 목표

skill 호출 표준을 특정 CLI 명령이 아니라 agent skill 호출 의도로 문서화한다.
ADR-093과 현재 운영 문서만 다루며, scripts 실행기 구현은 건드리지 않는다.

**범위 외**:
- `career-os/scripts/**` 실행기 수정
- 과거 `career-os/tasks/**` 기록 수정
- 기존 ADR 역사 기록 수정
- phase 실행 중 추가 ADR 신설

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 관련 docs

실행 전 반드시 읽는다:
- `career-os/docs/adr/INDEX.md`
- `career-os/docs/adr/ADR-085-career-os-skill을-codex에-심볼릭-링크로-노출한다.md`
- `career-os/docs/prd.md`
- `career-os/docs/flow.md`
- `career-os/docs/code-architecture.md`
- `career-os/AGENTS.md`
- `career-os/TOOLS.md`

---

## 작업 항목

### 1. ADR-093 추가 여부 확인

`career-os/docs/adr/ADR-093-skill-호출은-agent-비종속-의도-표현으로-쓴다.md`와 `docs/adr/INDEX.md` 행을 확인한다.
없으면 추가한다.

### 2. 현재 표준 문서 표현 정제

다음 파일에서 현재 표준 호출을 `/<skill> [args]` 의도 표현으로 정리한다:
- `career-os/AGENTS.md`
- `career-os/TOOLS.md`
- `career-os/docs/prd.md`
- `career-os/docs/flow.md`
- `career-os/docs/code-architecture.md`

### 3. 역사 기록 보존

과거 ADR과 완료된 task 파일에 남은 CLI 명령은 실행 이력이므로 수정하지 않는다.

### 4. 한국어 문서 원칙 반영

`TOOLS.md`도 한국어 설명 문장으로 작성한다.
경로, 명령, env key 같은 식별자는 원문을 유지한다.

---

## 검증

보고 직전 반드시 Bash 도구로 직접 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"
test -f career-os/docs/adr/ADR-093-skill-호출은-agent-비종속-의도-표현으로-쓴다.md
grep -q "ADR-093" career-os/docs/adr/INDEX.md
grep -q "TOOLS.md" career-os/AGENTS.md
grep -q "Agent Skill 호출" career-os/TOOLS.md

! rg -n "claude[ ]-p|claude[ ]--permission|--permission[-]mode|--max[-]turns|claude[ ]--output-format" \
  career-os/AGENTS.md career-os/TOOLS.md career-os/docs/prd.md career-os/docs/flow.md career-os/docs/code-architecture.md
```

## Blocked 조건

- ADR-093 번호가 이미 다른 결정에 사용됐으면 `PHASE_BLOCKED: ADR-093 번호 충돌`을 출력하고 종료한다.
- 사용자가 scripts 실행기 변경까지 이번 phase에 요구하면 `PHASE_BLOCKED: scope 변경 필요`를 출력하고 종료한다.
