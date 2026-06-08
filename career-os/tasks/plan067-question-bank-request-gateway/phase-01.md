# Phase 01 — fos-career DB/schema/API 계약 확장

**Model**: sonnet
**Status**: completed

## 목표

fos-career request gateway가 `question_bank_refresh` 요청을 안전하게 만들 수 있도록 DB/schema/API 계약을 확장한다.

`interview_skill_requests`의 request type과 requested skill allowlist를 넓히되, 기존 interview request gateway 경계를 유지한다.

## 중요 지침

이 phase는 implementation phase다.

career-os `docs/`, ADR, `AGENTS.md`, `TOOLS.md`, 정책 문서를 수정하지 않는다.
문서 계약이 부족하면 추측하지 말고 `PHASE_BLOCKED`로 멈춘다.

같은 plan의 phase는 병렬 실행하지 않는다.
Phase 01 완료 후에만 Phase 02로 넘어간다.

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
- `docs/data-schema.md`의 fos-career request gateway와 `public/question-bank/` 계약
- `docs/flow.md`의 question bank dashboard request 흐름
- `docs/code-architecture.md`의 dashboard/processor 책임 경계
- `tasks/plan060-interview-skill-request-gateway/index.json`
- `tasks/plan065-question-bank-collector/index.json`
- `~/services/fos-career/db/schema.ts`
- `~/services/fos-career/app/api/interview/requests/route.ts`
- `~/services/fos-career/lib/interview/gateway.ts`

## 범위

- `interview_skill_requests.request_type`에 `question_bank_refresh` 추가.
- `requested_skill` allowlist에 `question-bank-collector` 추가.
- 필요한 migration 추가.
- API route validation 확장.
- gateway helper 또는 request builder의 타입/allowlist 확장.
- request payload topic 검증 추가.
- resultJson 최소 저장 계약의 타입 또는 helper 반영.

## 비범위

- dashboard 버튼 UI.
- processor 실행 연결.
- career-os scripts 수정.
- career-os docs/ADR/정책 문서 수정.
- private `prep.md` 자동 반영.
- 범용 chat 복구.
- dashboard가 `claude` 직접 실행.
- fos-study 발행.
- commit, push, PR 생성.

## 구현 힌트

- plan060의 `interview_skill_requests` migration과 request type 패턴을 먼저 확인한다.
- 기존 `InterviewRequestType`, request schema, route validator, `REQUEST_TYPE_SKILL` 또는 동등 allowlist를 재사용한다.
- `question_bank_refresh`는 `question-bank-collector` 외 skill과 결합할 수 없게 한다.
- topic은 공개 가능 일반 질문 범위로 제한한다.
  회사명, 개인 이력, private 답변, 지원 전략을 topic으로 저장하지 않는다.
- migration이 enum 변경인지 varchar/check constraint 변경인지 기존 DB 방식을 따른다.

## 검증 명령

보고 직전 가능한 범위에서 실행하고 raw 결과를 남긴다.

```bash
cd ~/services/fos-career
git status --short

rg -n "question_bank_refresh|question-bank-collector|interview_skill_requests|REQUEST_TYPE_SKILL|InterviewRequestType" \
  db app lib scripts

npx tsc --noEmit
git diff --check
```

DB migration smoke 명령이 repo에 있으면 함께 실행한다.
명령을 찾지 못하면 실행하지 못한 이유를 보고한다.

## 성공 기준

- schema 또는 migration에 `question_bank_refresh`가 반영된다.
- API validation이 `question_bank_refresh`를 허용한다.
- allowlist는 `question_bank_refresh`와 `question-bank-collector` 조합만 허용한다.
- allowlist 밖 requested skill은 rejected 또는 blocked가 된다.
- resultJson 타입 또는 helper가 path, summary, count 중심의 최소 저장 계약을 표현한다.
- `npx tsc --noEmit`이 통과한다.
- `git diff --check`가 통과한다.

## common-pitfalls self-check

- 첫 bash 블록에 `cd "$(git rev-parse --show-toplevel)"`가 있다.
- `~/services/fos-career` dirty state를 확인했다.
- apartment 변경은 수정, stage, revert하지 않는다.
- career-os docs/ADR/정책 문서를 수정하지 않는다.
- dashboard container가 `claude`를 직접 실행하지 않는다.
- private 본문, 답변 전문, command stdout 전체를 resultJson에 저장하지 않는다.

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- fos-career의 DB schema 또는 migration 구조를 찾을 수 없다.
- 기존 request gateway 계약과 ADR-068 계약이 충돌한다.
- `question_bank_refresh` topic의 public-safe 검증 기준을 문서에서 확인할 수 없다.
- docs/ADR/정책 문서 수정 없이는 진행할 수 없다.
- 기존 dirty 변경이 같은 fos-career 파일에서 충돌해 의도한 변경과 사용자 변경을 구분할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- dashboard 또는 API가 `claude`를 직접 실행하게 만든다.
- `question_bank_refresh`가 `question-bank-collector` 외 skill을 허용한다.
- resultJson에 private 본문, 답변 전문, command stdout 전체를 저장한다.
- career-os docs/ADR/정책 문서를 임의 수정한다.
- apartment repo 변경을 수정, stage, revert한다.

## 실행 결과

- Completed at: 2026-06-08T19:08:22+09:00
- fos-career `db/schema.ts`와 migration `0006_question_bank_refresh_requests.sql`에 `question_bank_refresh`, `question-bank-collector` enum을 추가했다.
- `lib/interview/gateway.ts`와 `app/api/interview/requests/route.ts`에서 request type, skill allowlist, required skill mapping, public-safe topic gate를 확장했다.
- `question_bank_refresh`는 `question-bank-collector` 외 skill과 결합할 수 없게 유지했다.
- 검증: `npx tsc --noEmit` 통과, `git diff --check` 통과, self-test gate 통과.
