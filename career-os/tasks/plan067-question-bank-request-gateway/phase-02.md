# Phase 02 — 면접 hub 질문 bank 보강 버튼

**Model**: sonnet
**Status**: completed

## 목표

fos-career 면접 hub에 “질문 bank 보강” 요청 버튼을 추가한다.

버튼은 `question_bank_refresh` request를 만들 뿐이며, dashboard가 career-os skill이나 `claude`를 직접 실행하지 않는다.

## 중요 지침

이 phase는 implementation phase다.

Phase 01이 완료된 뒤 실행한다.
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
- `docs/prd.md`의 question bank MVP와 범위 밖 항목
- `docs/flow.md`의 면접 hub request 흐름
- `tasks/plan067-question-bank-request-gateway/index.json`
- `~/services/fos-career/app/dashboard/interview/page.tsx`
- `~/services/fos-career/app/api/interview/requests/route.ts`
- `~/services/fos-career/lib/interview/gateway.ts`

## 범위

- 면접 hub에 “질문 bank 보강” 요청 버튼 추가.
- 기본 topic 후보 추가.
- topic 후보는 공개 가능 일반 질문 범위만 사용.
- request 생성 payload에 `requestType: "question_bank_refresh"`와 `requestedSkill: "question-bank-collector"`를 사용.
- 요청 생성 성공/실패 상태를 기존 dashboard 패턴에 맞게 표시.
- archive/read-only 상태에서 새 request 생성이 차단되는 기존 guard가 있으면 유지.

## 비범위

- processor 실행 연결.
- private `prep.md` 자동 반영 버튼.
- 질문 bank 내용을 fos-study로 발행.
- 범용 chat 복구.
- dashboard가 `claude` 직접 실행.
- public/question-bank에 private 정보 저장.
- career-os docs/ADR/정책 문서 수정.
- commit, push, PR 생성.

## 구현 힌트

- 기존 `interview_prep_report`, `interview_asset`, `study_pack` request 버튼과 같은 UI/상태 패턴을 따른다.
- 기본 topic 후보는 다음처럼 일반 범위로 제한한다.
  - Java/Spring backend interview questions
  - Database/JPA/MyBatis/Redis/cache interview questions
  - CS Network/OS/data structure basics
  - Operations, incident, observability questions
  - System design/backend architecture questions
- 회사명, 개인 프로젝트 세부, 답변 전문, 지원 전략을 topic 후보로 넣지 않는다.
- 버튼 label은 사용자에게 보이는 한글 “질문 bank 보강”을 사용한다.

## 검증 명령

보고 직전 가능한 범위에서 실행하고 raw 결과를 남긴다.

```bash
cd ~/services/fos-career
git status --short

rg -n "질문 bank 보강|question_bank_refresh|question-bank-collector|claude|prep.md|fos-study" \
  app lib scripts

npx tsc --noEmit
git diff --check
```

## 성공 기준

- 면접 hub에 “질문 bank 보강” 요청 버튼이 있다.
- 버튼은 API request row만 만들고 직접 skill을 실행하지 않는다.
- 기본 topic 후보는 공개 가능 일반 질문 범위만 포함한다.
- private `prep.md` 자동 반영 버튼은 추가하지 않는다.
- 범용 chat UI/API를 되살리지 않는다.
- `claude` 직접 실행 문자열이 dashboard 경로에 없다.
- `npx tsc --noEmit`이 통과한다.
- `git diff --check`가 통과한다.

## common-pitfalls self-check

- Phase 01이 완료됐는지 확인했다.
- dashboard 버튼은 request 생성만 담당한다.
- private prep 자동 반영 버튼을 만들지 않았다.
- topic 후보에 회사별 비공개 맥락이나 개인 이력 세부사항을 넣지 않았다.
- career-os docs/ADR/정책 문서를 수정하지 않았다.

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- 면접 hub 위치나 기존 request 버튼 패턴을 찾을 수 없다.
- API 계약이 Phase 01 결과와 맞지 않는다.
- 공개 가능 topic 후보 범위를 문서에서 확인할 수 없다.
- archive/read-only guard와 새 버튼이 충돌한다.
- 기존 dirty 변경이 같은 fos-career UI 파일에서 충돌해 의도한 변경과 사용자 변경을 구분할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- dashboard가 `claude` 또는 career-os skill을 직접 실행한다.
- private `prep.md` 자동 반영 버튼을 만든다.
- 범용 chat UI/API를 복구한다.
- topic 후보에 private 답변, 지원 전략, 회사별 비공개 맥락을 넣는다.
- career-os docs/ADR/정책 문서를 임의 수정한다.
- apartment repo 변경을 수정, stage, revert한다.

## 실행 결과

- Completed at: 2026-06-08T19:08:22+09:00
- fos-career 면접 hub request queue 후보에 “질문 bank 보강” 요청 버튼을 추가했다.
- 기본 topic 후보는 Java/Spring, DB/JPA/MyBatis/Redis/cache, CS Network/OS/data structure, 운영/장애/관측성, System design/backend architecture로 제한했다.
- 버튼은 `/api/interview/requests`에 `requestType=question_bank_refresh`, `requestedSkill` 기본 mapping `question-bank-collector`를 저장하는 기존 request row 생성 흐름만 사용한다.
- dashboard에는 `claude` 직접 실행 경로를 추가하지 않았다.
- 검증: `npx tsc --noEmit` 통과, `npm run build` 통과, `git diff --check` 통과.
