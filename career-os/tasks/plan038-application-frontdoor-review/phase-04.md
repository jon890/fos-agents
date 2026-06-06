# Phase 04 — Analysis And Study Entry Wiring

**Model**: sonnet
**Status**: pending

---

## 목표

ledger로 승격된 후보만 상세 공고 분석, fit/gap, 공부 우선순위, 예상 면접 질문 흐름으로 진입하도록 연결한다.

**범위 외**: 최종 지원 패키지 자동 제출, 공개 fos-study 발행, Next.js 대시보드는 하지 않는다.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

- `career-os/docs/adr.md` — ADR-045
- `career-os/docs/flow.md` — Application Flow Agent Runtime
- `career-os/scripts/application-agent/run.ts`
- `career-os/scripts/application-agent/actions.ts`
- `career-os/scripts/application-agent/policy.ts`
- `career-os/scripts/application-agent/skill_contracts.ts`
- `career-os/scripts/application-agent/safety_gate.ts`

---

## 작업 항목

### 1. promoted candidate nextActions 정리

`promoted_to_ledger`가 된 후보의 ledger record는 상세 분석과 공부 준비 흐름을 나타내는 next action을 갖는다.

권장 next action:

- `run_posting_analysis`
- `run_fit_gap_analysis`
- `generate_study_priorities`
- `generate_interview_questions`

### 2. 기존 user gate 유지

최종 `application-package.md`, `review.md`, 제출 체크리스트, 외부 제출 action은 기존 사용자 검토 gate를 유지한다.

### 3. safety gate 검증

study action은 private 지원 준비 자료로 남기고, 공개 fos-study 발행은 사용자 승인 없이는 실행하지 않는다.

### 4. Discord 알림 문구 경계

알림을 추가한다면 회사/역할/단계/필요한 사용자 action만 포함한다. 지원 패키지 본문, 개인 이력 세부사항, private fit 분석 내용은 Discord에 보내지 않는다.

---

## 검증

보고 직전 반드시 본 bash 블록을 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun --check career-os/scripts/application-agent/run.ts
bun --check career-os/scripts/application-agent/actions.ts
bun --check career-os/scripts/application-agent/policy.ts
bun --check career-os/scripts/application-agent/skill_contracts.ts
bun --check career-os/scripts/application-agent/safety_gate.ts
bun career-os/scripts/application-agent/run.ts validate
```

금지 action 잔재 검증:

```bash
cd "$(git rev-parse --show-toplevel)"
! grep -R "submit_application" career-os/scripts/application-agent/promote_frontdoor_candidate.ts career-os/scripts/application-agent/frontdoor_queue_builder.ts
```

## Blocked 조건

- 상세 분석과 공부 우선순위 생성의 기존 실행 진입점이 불명확하면 `PHASE_BLOCKED: analysis or study entrypoint unavailable`를 출력하고 exit 2.
- 사용자 승인 없이 공개 발행이나 외부 제출 action이 생기면 `PHASE_FAILED: unsafe external action introduced`를 출력하고 exit 1.
