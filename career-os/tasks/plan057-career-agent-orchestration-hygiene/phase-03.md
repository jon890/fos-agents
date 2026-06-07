# Phase 03 — registry와 background flow 정리

**Model**: sonnet
**Status**: pending

---

## 목표

agent switch 이후 subagent/session registry visibility와 main session decision-making 흐름을 정리한다.

**범위 외**:

- 새 subagent 실행.
- session registry 데이터 변경.
- plan055 구현 phase 실행.
- commit/push.

---

## 관련 docs/files

실행 전 반드시 읽는다:

- `AGENTS.md`
- `../AGENTS.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `tasks/plan055-resume-package-flow/index.json`
- `tasks/plan057-career-agent-orchestration-hygiene/hud-protocol.md`

---

## 작업 항목 (4)

1. 메인 세션이 맡는 decision-making, task files, background implementation review 책임을 정리한다.
2. subagent/session registry visibility 확인 절차를 smoke checklist로 만든다.
3. agent switch 후 registry가 보이지 않을 때의 fallback 절차를 적는다.
4. `tasks/plan057-career-agent-orchestration-hygiene/session-registry-flow.md`를 작성한다.

---

## Intended File Scope

- `tasks/plan057-career-agent-orchestration-hygiene/session-registry-flow.md`

---

## 검증

```bash
test -f tasks/plan057-career-agent-orchestration-hygiene/session-registry-flow.md
rg -n "subagent|session registry|agent switch|main session|background implementation|task files" tasks/plan057-career-agent-orchestration-hygiene/session-registry-flow.md
git status --short tasks/plan057-career-agent-orchestration-hygiene
```

성공 기준:

- registry visibility smoke 절차가 있다.
- main session과 background implementation 책임이 분리된다.
- plan055와 겹치는 구현 phase는 실행하지 않는다.

---

## Blocked / Failed 조건

- registry visibility 확인 도구가 현재 세션에 없으면 `echo "PHASE_BLOCKED: session registry tool unavailable" && exit 2`.
- background flow가 OpenClaw 정책과 충돌하면 `echo "PHASE_BLOCKED: background flow policy conflict" && exit 2`.
- 새 session을 실행했거나 외부 상태를 바꿨으면 `echo "PHASE_FAILED: session state changed unexpectedly" && exit 1`.

---

## Self-check

- 절차 문서만 만든다.
- 실제 subagent/session을 만들지 않는다.
- main session의 승인과 검토 책임을 흐리지 않는다.
- background 구현은 task phase 승인 후에만 실행한다고 적는다.
