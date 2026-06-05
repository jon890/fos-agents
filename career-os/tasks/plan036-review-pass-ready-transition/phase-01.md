# Phase 01 — review pass transition

## 목표

`application-reviewer`가 `pass` 판정을 냈는데도 runner가 `needs_revision` 루프를 반복하는 문제를 막는다.

## 구현

- `scripts/application-agent/skill_executor.ts`
  - revision 상태에서 `application-package.md`가 이미 있어도 `review.md`보다 오래되었거나 같은 시간이면 package-writer를 다시 실행한다.
  - `call_application_package_writer` 상태에서 review가 package보다 오래되면 reviewer를 다시 실행한다.
- `scripts/application-agent/policy.ts`
  - `review.md`에서 `- result: pass`를 읽는다.
  - `preparing_application` 또는 `needs_revision` 상태에서 pass 판정이면 `review_pass_ready_for_user` decision으로 `ready_for_user_review` 전환을 허용한다.

## 검증

- 실제 당근페이 backend application에서 package-writer 재실행.
- reviewer 재실행 후 `result: pass`, `confidence: high`.
- policy dry-run이 `needs_revision -> ready_for_user_review`를 제안.
- 실제 run-once가 ledger를 `ready_for_user_review`로 갱신.
- ledger validate 통과.
