# Phase 03 — policy decision engine + command interface 구현

## 목표

ledger와 runtime 상태를 읽고 다음 행동 1개 또는 daily batch를 결정하는 TypeScript runner를 구현한다.

이 phase의 핵심은 LLM 호출이 아니라 deterministic policy decision이다.

## command interface

권장 entrypoint:

```bash
bun scripts/application-agent/run.ts run-once
bun scripts/application-agent/run.ts run-daily
bun scripts/application-agent/run.ts dry-run
bun scripts/application-agent/run.ts validate
bun scripts/application-agent/run.ts resume <application-id>
bun scripts/application-agent/run.ts ingest-position-report <report-path>
```

### command 책임

- `run-once`
  - 가장 우선순위 높은 agent-only action 1개만 결정하고 실행한다.
- `run-daily`
  - 하루 작업 제한을 지키며 여러 후보를 순회한다.
- `dry-run`
  - ledger를 쓰지 않고 decision log만 출력한다.
- `validate`
  - schema, transition, path 존재, private/public boundary를 검사한다.
- `resume <id>`
  - 특정 application만 이어서 처리한다.
- `ingest-position-report`
  - `position-recommender` report/runtime에서 후보를 추출해 ledger 후보로 등록한다.

## module 구조

ADR-035의 TypeScript helper 분해 원칙을 따른다.

```text
scripts/application-agent/
├── run.ts
├── ledger_schema.ts
├── agent_decision_schema.ts
├── ledger_io.ts
├── policy.ts
├── actions.ts
├── ingest_position_report.ts
├── render_decision_log.ts
└── fixtures/
```

## policy engine 책임

- application 후보 우선순위 계산
- actionable candidate 판정
- no-match 분기
- search expansion 또는 scheduled retry 결정
- review/revise loop 종료 조건 적용
- blocked/closed 처리
- user approval gate에서 정지
- private study/interview loop action 생성

## action 실행 범위

MVP에서 실제 실행 가능한 action:

- ledger decision log 작성
- ledger 상태/agentPhase 갱신
- application-package-writer 호출 준비 또는 명령 제안
- application-reviewer 호출 준비 또는 명령 제안
- daily-application-digest 호출 준비 또는 명령 제안
- private study/interview action queue 작성
- submission checklist 작성

MVP에서 금지:

- 실제 제출
- 외부 사이트 입력/전송
- 브라우저 자동 입력
- fos-study 공개 발행 자동 실행
- candidate-profile.md 직접 수정

## 산출물

- `scripts/application-agent/run.ts`
- policy/action 관련 TS 모듈
- decision log markdown 또는 jsonl 형식
- fixture 기반 dry-run output

## 검증 기준

```bash
bun scripts/application-agent/run.ts validate --ledger scripts/application-agent/fixtures/good-match.jsonl
bun scripts/application-agent/run.ts dry-run --ledger scripts/application-agent/fixtures/no-actionable-candidate.jsonl
bun scripts/application-agent/run.ts dry-run --ledger scripts/application-agent/fixtures/ready-for-user-review.jsonl
```

필수 검증:

- no actionable candidate가 `needs_more_search` 또는 `scheduled_retry`로 분기한다.
- good match가 package/review action으로 진행한다.
- cooldown candidate는 blocked로 간다.
- `ready_for_user_review`는 사용자 승인 요청에서 멈춘다.
- `submitted`는 자동 설정되지 않는다.

