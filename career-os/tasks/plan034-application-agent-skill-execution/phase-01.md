# Phase 01 — explicit skill execution mode

## 목표

`application-flow-agent`가 `--execute-skills` 옵션에서 agent-only private native skill을 실행하고, 산출물이 생긴 뒤에만 plan032 execution gate를 통과해 ledger를 갱신하게 한다.

## 계획

1. 실행 범위 제한
   - 산출물: `--execute-skills` 명시 옵션
   - 기본 실행은 기존처럼 command suggestion only
2. skill executor 추가
   - 산출물: `scripts/application-agent/skill_executor.ts`
   - `application-package-writer`, `application-reviewer`만 순차 실행
3. artifact 검증 재사용
   - 산출물: 기존 `actions.ts` execution gate 유지
   - skill 실행 후에도 산출물이 없으면 ledger 전이 금지
4. 문서화와 fixture 검증
   - 산출물: ADR-040, flow/code-architecture 갱신, stub Claude 검증

## 구현

- `scripts/application-agent/run.ts`
  - `--execute-skills`와 `--skill-timeout-ms` 옵션을 추가했다.
  - `run-once`, `run-daily`, `resume`, `dry-run`, `report-daily`가 공통 helper를 통해 optional skill execution을 거친다.
  - 실행 결과에는 ran/skipped/failed skill을 출력한다.
- `scripts/application-agent/skill_executor.ts`
  - decision별 필요한 native skill invocation을 결정한다.
  - 쓰기형 native skill은 `claude --permission-mode acceptEdits -p ...`로 실행한다.
  - `run_fit_analysis`, `draft_application_package`, `revise_application_package`는 `application-package-writer`를 실행한다.
  - `call_application_package_writer`는 `application-package-writer` 후 `application-reviewer`를 실행한다.
  - 기대 산출물이 없으면 실패로 처리한다.
- `scripts/application-agent/actions.ts`
  - `run_fit_analysis` command suggestion을 `position-recommender`가 아니라 `application-package-writer <posting.md>`로 수정했다.
  - `needs_revision` 상태에서는 `application-package.md`가 `review.md`보다 최신일 때만 revision 산출물로 인정한다.
- `scripts/application-agent/skill_contracts.ts`
  - `application-package-writer` CLI pattern을 실제 skill 입력과 맞춰 `{postingPath}`로 수정했다.
  - package-writer/reviewer command suggestion에 `--permission-mode acceptEdits`를 명시했다.

## 안전 범위

- 실제 지원 제출, 로그인, 브라우저 자동 입력은 여전히 실행하지 않는다.
- `study-pack-writer`, `interview-asset-writer`, `candidate-baseline-suggester`처럼 사용자 승인 또는 공개 발행 경계가 있는 skill은 이번 executor 대상에서 제외한다.
- `--execute-skills`가 없으면 기존 command suggestion only 동작을 유지한다.

## 검증

```bash
bun scripts/application-agent/run.ts validate --ledger data/applications/ledger.jsonl
bun scripts/application-agent/run.ts dry-run --execute-skills --ledger data/applications/ledger.jsonl
bun scripts/application-agent/run.ts
```

stub `claude`와 임시 ledger를 사용해 다음도 검증했다.

```bash
PATH="$tmp/bin:$PATH" bun scripts/application-agent/run.ts run-once --execute-skills --ledger "$tmp/ledger.jsonl"
```

결과:

- stub `application-package-writer`와 `application-reviewer`가 순차 실행됐다.
- `fit-analysis.md`, `application-package.md`, `review.md` 생성 후 ledger가 갱신됐다.
- `--execute-skills`가 없으면 plan032 execution gate가 기존처럼 상태 전이를 막는다.

## Live 1건 실행 결과

사용자 승인 후 당근페이 `Software Engineer, Backend` 1건을 실제 실행했다.

- 최초 실패 원인: `posting.md` 부재. Claude는 공고 본문을 추측하지 않고 중단했다.
- 조치: 공식 공고 URL을 확인해 `posting.md`를 작성했다.
- 재실행 결과:
  - `fit-analysis.md` 생성
  - `application-package.md` 생성
  - `review.md` 생성
  - ledger status가 `preparing_application`에서 `needs_revision`으로 전이
- reviewer verdict: `revise`
- 추가 보강: 다음 dry-run이 기존 package 존재만 보고 revision 완료로 오판하지 않도록 stale artifact gate를 추가했다.

## 다음 단계

실제 Claude 호출을 live application에 적용할 때는 `run-once --execute-skills`부터 수동으로 1건 실행하고, 산출물 품질과 reviewer verdict를 확인한 뒤 `run-daily --execute-skills`를 검토한다.
