## ADR-042 — reviewer pass 판정은 사용자 검토 대기 상태로 전환한다

- Status: Accepted
- Date: 2026-06-04

### 맥락

실제 당근페이 Backend application 실행에서 `application-reviewer`가 `result: pass`를 냈지만, 기존 policy는 `needs_revision` 상태만 보고 다시 `revise_application_package`를 제안했다. 또한 revision 단계에서 기존 `application-package.md`가 존재한다는 이유로 package-writer가 skip되어 stale review/package 루프가 풀리지 않는 문제가 있었다.

### 결정

- `needs_revision`에서 `application-package.md`가 `review.md`보다 오래되었거나 같은 시간이면 기존 package가 있어도 `application-package-writer`를 다시 실행한다.
- `preparing_application`에서 `review.md`가 package보다 오래되면 `application-reviewer`를 다시 실행한다.
- policy는 `review.md`의 `- result: pass`를 읽고, pass면 `review_pass_ready_for_user` decision으로 `ready_for_user_review`에 전환한다.
- `ready_for_user_review` 이후에는 기존 user approval gate가 적용되어 실제 제출은 자동화하지 않는다.

### 결과

- reviewer pass 이후 revision 루프가 반복되지 않는다.
- 사용자는 최종 패키지와 review를 보고 제출 여부를 결정할 수 있다.
- stale artifact gate와 pass verdict gate가 함께 작동해 package/review 순서를 유지한다.
