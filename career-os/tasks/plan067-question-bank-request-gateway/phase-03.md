# Phase 03 — processor question-bank-collector 연결

**Model**: sonnet
**Status**: completed

## 목표

fos-career request processor가 `question_bank_refresh` request를 받아 `question-bank-collector`를 실행하도록 연결한다.

실행 후 validator 결과를 확인하고, request result에는 공개 가능한 최소 결과만 저장한다.

## 중요 지침

이 phase는 implementation phase다.

Phase 02가 완료된 뒤 실행한다.
같은 plan의 phase는 병렬 실행하지 않는다.

career-os `docs/`, ADR, `AGENTS.md`, `TOOLS.md`, 정책 문서를 수정하지 않는다.
문서 계약이 부족하면 추측하지 말고 `PHASE_BLOCKED`로 멈춘다.

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
git status --short
git -C ~/services/fos-career status --short
```

## 관련 파일

실행 전 반드시 읽는다.

- `docs/adr.md`의 ADR-068
- `docs/data-schema.md`의 result 저장 경계
- `docs/flow.md`의 processor 흐름
- `docs/code-architecture.md`의 host-side processor 책임
- `tasks/plan065-question-bank-collector/index.json`
- `tasks/plan067-question-bank-request-gateway/index.json`
- `scripts/question-bank-collector/validate.ts`
- `~/services/fos-career/scripts/process-interview-requests.ts`
- `~/services/fos-career/lib/interview/gateway.ts`

## 범위

- processor에 `question_bank_refresh` handling 추가.
- `question_bank_refresh`를 `/question-bank-collector <topic>` 명령으로 매핑.
- 기존 `CLAUDE_PERMISSION_MODE` 또는 기존 processor 권한 모드 사용.
- host-side career-os checkout에서 실행.
- 실행 후 `bun scripts/question-bank-collector/validate.ts` 실행 또는 동등한 결과 확인.
- request status를 pending/running/done/failed/blocked 기존 패턴에 맞게 갱신.
- resultJson에는 public-safe summary, `public/question-bank` path, validator count만 저장.
- errorSummary는 짧게 축약하고 command stdout 전체를 저장하지 않는다.

## 비범위

- dashboard UI 수정.
- private `prep.md` 자동 반영.
- question bank 내용을 fos-study로 발행.
- 범용 chat 복구.
- dashboard container에서 직접 실행.
- public/question-bank에 private 정보 저장.
- career-os docs/ADR/정책 문서 수정.
- commit, push, PR 생성.

## 구현 힌트

- 기존 processor의 `interview-prep-analyzer`, `interview-asset-writer`, `study-pack-writer` 실행 패턴을 따른다.
- command 생성 시 topic shell escaping 또는 argv 배열 방식을 기존 안전 패턴에 맞춘다.
- processor가 writable career-os checkout 경로를 어떻게 받는지 기존 env를 재사용한다.
- validator output에서 category count, question count, file count처럼 공개 가능한 숫자만 추출한다.
- stdout 전문, 질문 본문 전체, private 본문을 DB나 audit payload에 넣지 않는다.
- 실패 시에도 민감 내용이 errorSummary에 섞이지 않게 축약한다.

## 검증 명령

보고 직전 가능한 범위에서 실행하고 raw 결과를 남긴다.

```bash
cd ~/services/fos-career
git status --short

rg -n "question_bank_refresh|question-bank-collector|CLAUDE_PERMISSION_MODE|validate.ts|resultJson|stdout|errorSummary" \
  scripts lib app db

npx tsc --noEmit
git diff --check

cd ~/ai-nodes/career-os
bun scripts/question-bank-collector/validate.ts
git status --short sources/fos-study
```

processor dry-run, self-test, 또는 unit test가 있으면 함께 실행한다.
명령을 찾지 못하면 실행하지 못한 이유를 보고한다.

## 성공 기준

- processor가 `question_bank_refresh`를 `question-bank-collector`로만 실행한다.
- 기존 권한 모드 env 또는 processor 권한 모드를 사용한다.
- 실행 후 validator 결과가 확인된다.
- resultJson에는 public-safe summary, path, count만 저장된다.
- command stdout 전체와 민감 본문이 resultJson, audit log, Discord 알림에 저장되지 않는다.
- `sources/fos-study/` 변경이 없다.
- `bun scripts/question-bank-collector/validate.ts`가 통과한다.
- `npx tsc --noEmit`이 통과한다.
- `git diff --check`가 통과한다.

## common-pitfalls self-check

- Phase 02가 완료됐는지 확인했다.
- processor만 `claude`를 실행한다.
- dashboard container 직접 실행 경로를 만들지 않았다.
- validator 결과는 숫자와 path 중심으로만 저장했다.
- stdout 전문과 질문 bank 본문 전체를 resultJson에 저장하지 않았다.
- fos-study를 수정하지 않았다.
- career-os docs/ADR/정책 문서를 수정하지 않았다.

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- processor 실행 위치 또는 career-os checkout env를 찾을 수 없다.
- 기존 processor 권한 모드와 ADR-068의 `<mode>` 계약을 연결할 수 없다.
- validator 실행 결과에서 public-safe count를 추출할 수 없다.
- command stdout 전체 저장 없이는 성공/실패를 판단할 수 없다.
- 기존 dirty 변경이 같은 processor 파일에서 충돌해 의도한 변경과 사용자 변경을 구분할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- `question_bank_refresh`가 `question-bank-collector` 외 skill을 실행한다.
- dashboard container가 `claude`를 직접 실행한다.
- resultJson, audit log, Discord 알림에 command stdout 전체나 민감 본문을 저장한다.
- private `prep.md` 자동 반영을 구현한다.
- `sources/fos-study/`를 수정하거나 발행한다.
- career-os docs/ADR/정책 문서를 임의 수정한다.

## 실행 결과

- Completed at: 2026-06-08T19:08:22+09:00
- fos-career host-side processor `scripts/process-interview-requests.ts`에 `question_bank_refresh` 처리를 추가했다.
- processor는 기존 permission mode env를 사용해 `/question-bank-collector <topic>`만 실행하고, 실행 후 `bun scripts/question-bank-collector/validate.ts`를 실행한다.
- question bank resultJson에는 `public/question-bank` path, public-safe summary, validator `categories/questions` count만 저장한다.
- question-bank-collector command stdout 전체는 resultJson/audit에 저장하지 않는다.
- 검증: `npm run apply:interview-requests -- --self-test-gates` 통과, `bun scripts/question-bank-collector/validate.ts` 통과, `sources/fos-study` 무변경 확인.
- apartment repo 변경을 수정, stage, revert한다.
