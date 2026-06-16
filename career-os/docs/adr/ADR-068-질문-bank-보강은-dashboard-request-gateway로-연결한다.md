## ADR-068 — 질문 bank 보강은 dashboard request gateway로 연결한다

- Status: Accepted
- Date: 2026-06-08

### 맥락

ADR-066으로 공개 가능 일반 질문 bank와 `question-bank-collector` skill이 생겼다.
하지만 fos-career dashboard의 면접 hub에는 아직 이 skill을 호출하는 버튼과 request processor 경로가 없다.

사용자는 내부 skill 호출을 버튼 기반으로 쓰고 싶어 하며, 범용 chat은 ADR-064로 제거했다.
따라서 question bank 보강도 chat이 아니라 목적별 request queue로 연결해야 한다.

### 결정

- fos-career `interview_skill_requests`에 `question_bank_refresh` request type을 추가한다.
- `question_bank_refresh`의 유일한 skill은 `question-bank-collector`다.
- dashboard 면접 hub에는 “질문 bank 보강” 요청 버튼을 추가한다.
  topic은 공개 가능 일반 질문 범위만 받는다.
- processor는 `question_bank_refresh`를 받으면 `claude --permission-mode <mode> -p "/question-bank-collector <topic>"`로 실행한다.
- processor는 실행 후 `public/question-bank` path와 validator 결과만 request result에 저장한다.
  private 본문, 답변 전문, command stdout 전체는 저장하지 않는다.
- 이번 연결은 public question bank 보강까지만 다룬다.
  `private/<company>/<position>/interview/prep.md`로 선별 반영하는 버튼은 후속 plan에서 다룬다.
- `sources/fos-study/` 자동 발행은 하지 않는다.

### 결과

- dashboard에서 일반 backend/CS 질문 bank 보강을 버튼으로 요청할 수 있다.
- queue/processor/HUD 흐름은 기존 interview skill request gateway와 일관된다.
- public/private 경계가 유지된다.
- question bank를 실제 면접 질문 추천으로 섞는 단계는 후속 결정으로 분리된다.

### 적용

- `fos-career/db/schema.ts`
- `fos-career/db/migrations/`
- `fos-career/lib/interview/gateway.ts`
- `fos-career/app/dashboard/interview/page.tsx`
- `fos-career/app/api/interview/requests/route.ts`
- `fos-career/scripts/process-interview-requests.ts`
- `career-os/tasks/plan067-question-bank-request-gateway/`
