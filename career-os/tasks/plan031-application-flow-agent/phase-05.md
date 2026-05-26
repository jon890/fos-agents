# Phase 05 — fixture 기반 end-to-end 검증 + 운영 등록 판단

## 목표

fixture로 application-flow-agent MVP가 실제 자율 decision loop로 동작하는지 검증하고, daily cron 등록 여부를 판단한다.

## 검증 fixture

필수 fixture:

1. no actionable candidate
   - 기대: `needs_more_search` 또는 `scheduled_retry`
2. good match
   - 기대: package/review action 생성
3. blocked/cooldown
   - 기대: `blocked`, 사용자 판단 필요
4. needs_revision -> revise -> review
   - 기대: revisionCount 제한 준수
5. ready_for_user_review
   - 기대: 사용자 승인 요청에서 멈춤

## end-to-end rehearsal

실제 private `data/applications/`가 아니라 fixture와 dry-run을 우선 사용한다.

검증 순서:

1. `validate`
2. `dry-run` fixture별 decision 확인
3. `run-once`를 임시 ledger copy에 실행
4. decision log 확인
5. daily digest/report 연결 확인

## 운영 등록 판단

cron 등록은 이 phase의 마지막 decision이다.

추천 기본값:

- 즉시 cron 등록하지 않는다.
- 수동 `run-once`와 `dry-run`을 2-3회 사용한다.
- 안정화 후 weekday morning daily cron을 별도 phase 또는 follow-up task로 등록한다.

## 산출물

- fixture별 audit summary
- `tasks/plan031-application-flow-agent/audit/phase-05-e2e-summary.md`
- 운영 등록 판단 기록
- 후속 task 후보 목록

## 성공 기준

- policy engine이 no-match, good-match, blocked, revise, user-review 상태를 모두 올바르게 분기한다.
- 사용자 승인 전 submitted/approved 외부 action이 발생하지 않는다.
- public/private boundary 위반이 없다.
- plan029 기존 skill 산출물과 호환된다.
- plan030 freshness guard를 candidate ingest prerequisite로 참조한다.

