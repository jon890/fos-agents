## ADR-040 — application-flow-agent native skill 실행은 명시 옵션에서만 수행

- Status: Accepted
- Date: 2026-06-04

### 맥락

ADR-038로 `application-flow-agent`는 필수 산출물이 없으면 ledger 상태 전이를 막게 됐다. 다음 단계는 runner가 실제 `application-package-writer`와 `application-reviewer`를 실행해 산출물을 만든 뒤 같은 gate를 통과시키는 것이다. 다만 Claude native skill 실행은 비용과 시간, private 지원 문서 생성이라는 부작용이 있으므로 기본 동작으로 켜면 운용자가 dry-run/suggestion-only 흐름을 잃는다.

### 결정

- native skill 실행은 `--execute-skills` 명시 옵션에서만 수행한다.
- 실행 대상은 MVP에서 private agent-only skill로 제한한다.
  - `application-package-writer`
  - `application-reviewer`
- 쓰기형 native skill은 `claude --permission-mode acceptEdits -p ...`로 실행한다.
- `run_fit_analysis`, `draft_application_package`, `revise_application_package`는 `application-package-writer`를 실행한다.
- `call_application_package_writer`는 `application-package-writer` 후 `application-reviewer`를 순차 실행한다.
- skill 실행 후에도 [[ADR-038]] execution gate가 필수 산출물을 다시 검증한다.
- revision 상태에서는 기존 package 존재만으로 전이하지 않고, `application-package.md`가 `review.md`보다 최신인지 확인한다.
- `study-pack-writer`, `interview-asset-writer`, `candidate-baseline-suggester`처럼 공개 발행/프로필 반영/사용자 승인 경계가 있는 skill은 자동 실행 대상에서 제외한다.

### 결과

- 기본 `run-once`/`run-daily`는 계속 command suggestion only로 안전하게 동작한다.
- 사용자가 명시적으로 `--execute-skills`를 붙이면 runner가 package/review 산출물을 만들고, 검증 통과 시 ledger를 이어서 갱신한다.
- reviewer가 `revise`를 낸 뒤에는 수정된 package가 review보다 최신이어야 다음 revision 전이가 가능하다.
- 실제 제출, 로그인, 브라우저 입력, fos-study 발행은 여전히 자동화하지 않는다.
