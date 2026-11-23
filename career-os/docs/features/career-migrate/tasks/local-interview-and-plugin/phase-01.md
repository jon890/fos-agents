# Phase 01. 면접 연습 저장을 작업 폴더 SQLite 로 옮긴다

**Execution profile**: standard

## 목표

주제별 복습 상태, 연습 기록, 개인 질문을 `state/career.sqlite` 에 두고 면접 실행기가 Backend 와 JSON 파일 저장소 없이 돌게 한다. 대화가 바뀌어도 앞 연습이 이어지게 하는 바탕이다.

**범위 외**: MCP 도구 삭제(phase 03), 비서용 스킬(phase 04), 공고별 질문 준비 스킬의 이전(3단계).

## 컨텍스트

- 지금 면접 실행기(`career-os/scripts/interview-drill/drill-engine.ts`)는 `CAREER_STORE` 로 Backend 저장소와 JSON 파일 저장소 가운데 하나를 고른다(`store/`). 플러그인 실행기(`career-os/scripts/plugin-local/main.ts`)는 `select` 만 받고 기록은 MCP 도구가 했다.
- 1단계가 만든 저장 모듈 관례(`career-os/scripts/lib/career-store/study/store.ts`)를 따른다. 저장소 메서드 하나가 Backend 의 HTTP 경로 하나이고 입출력이 같다.
- 스키마와 복습 간격 규칙은 `career-os/services/career-backend/src/interview/schema.ts`, `review-schedule.ts` 에 있다. 규칙은 바꾸지 않고 자리만 옮긴다. Backend 소스는 5단계가 지우므로 여기서는 복사하고 `scripts/` 의 import 만 바꾼다.

**요구사항**: REQ5(원본 스펙 fos-assistant `docs/features/career-migrate/spec.md`, 설계 REQ5 줄과 DECISION10)

**근거 문서**: `career-os/docs/features/career-migrate/README.md`, `career-os/docs/adr/ADR-146-커리어-표-데이터는-에이전트-작업-폴더의-sqlite-가-갖는다.md`

## 의도 메모

- 이미 적용된 스키마 단계는 고치지 않는다. 면접 테이블 셋은 `SCHEMA_STEPS` 의 둘째 단계로 더한다. 1단계 운영 파일(`user_version = 1`)이 열릴 때 둘째 단계만 적용된다.
- 같은 `attemptId` 재전송은 `request_receipts` 로 처음 응답을 돌려준다(Backend 와 같다). 개인 질문 저장은 덮어쓰기라 기록을 두지 않는다. 본문으로 키를 만들면 끈 질문을 같은 본문으로 다시 켤 수 없다.
- 실행기의 `record` 는 `--attempt-id` 가 없으면 UUID 를 만든다. 결과가 불명확할 일이 없다(같은 프로세스의 한 transaction 이다).
- `record` 는 `--input <JSON 파일>` 도 받는다. 질문과 피드백에 따옴표나 줄바꿈이 있으면 셸 인자로 깨진다.
- 이 phase 는 `plugin/src/contract-parity.test.ts` 가 import 하는 Backend client 를 지운다. 그 테스트는 phase 03 이 지우므로 phase 03 을 먼저 커밋한다.
- 후보자 맥락 공급자(`CAREER_MEMORY`)의 `backend` 는 작업 폴더 `context/` 의 문서를 읽는 `context` 로 바꾼다. `file` 은 그대로 둔다(ADR-130 의 Backend 없는 사용자).

## 작업 항목

### 1. `career-os/scripts/lib/career-store/interview/`

- `schema.ts`, `review-schedule.ts`: Backend 의 같은 파일을 옮긴다. `review-schedule.test.ts` 도 옮긴다.
- `store.ts`: `InterviewStore(db, now)`. `listProgress(drillType)`, `createAttempt(body, idempotencyKey)`, `listEnabledPersonalQuestions(drillType)`, `upsertPersonalQuestion(questionId, body)`. 질의는 Backend `interview.repository.ts` 를 SQLite 문법으로 옮긴다. 쓰기는 `db.transaction`.
- `store.test.ts`: 지금 `store/store-contract.test.ts` 의 사례(pass 다음 날 복습, 같은 attemptId 한 번만, 이전 attemptId 재시도는 당시 응답, 개인 질문 끄기와 다시 켜기, 틀린 형식은 저장 안 함)와 「연결을 닫고 다시 열어도 복습 상태와 개인 질문이 남는다」.

### 2. `career-os/scripts/lib/career-store/ddl.ts`

`STEP_2` 로 `interview_topic_progress`, `interview_attempts`, `interview_personal_questions` 를 더한다. `database.test.ts` 에 `user_version = 1` 파일이 열리면 면접 테이블이 생기는 사례를 더한다.

### 3. `career-os/scripts/interview-drill/`

- `store/`, `career-backend/` 를 지운다. `drill-engine.ts` 는 `InterviewStore` 를 직접 쓴다. `deps.createStore` 는 `() => InterviewStore` 다.
- `drill-engine.ts` 의 `createCandidateContextClient`, `CareerBackendHttpError` import 와 그 호출을 지운다. 면접 실행기에 Backend 호출이 남지 않는다.
- 명령: `select`, `record`(`--attempt-id` 선택), `progress <tech|behavioral>`(신규, 복습 상태 목록), `personal list <tech|behavioral>`(신규), `personal add`, `personal disable`, `memory`, `doctor`.
- `doctor` 는 저장소를 열어 보고 `CAREER_MEMORY` 를 점검한다. `CAREER_STORE`, `CAREER_STORE_DIR` 는 읽지 않는다.
- `memory.ts`: `backend` 공급자를 `context` 로 바꾼다. `context/career-status.md`, `context/application-state.md` 를 읽고 없으면 빠진 키를 알린다. `career-store/context.ts` 의 `ContextDocumentKey` 에 `career-status` 를 더한다.

### 4. `career-os/scripts/plugin-local/main.ts`

`interview` 실행기가 위 명령을 모두 받는다(`memory`, `doctor` 제외). 저장소 오류는 `careerStoreFailureLine` 으로 첫 줄에 낸다.

### 5. 테스트

`drill-engine.test.ts`, `drill-engine.cli.test.ts`, `memory.test.ts`, `plugin-local/main.test.ts` 를 새 저장소와 명령에 맞춘다. 번들을 실행하는 `plugin/scripts/local-bundle.test.ts` 는 번들을 다시 만드는 phase 04 에서 고친다. CLI 테스트에 「프로세스 둘로 나눠 기록한 뒤 고르면 앞 기록이 반영된다」 를 둔다.

## 검증

```bash
bun test ./career-os/scripts/lib/career-store ./career-os/scripts/interview-drill ./career-os/scripts/plugin-local
bunx tsc --noEmit -p .
```

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/lib/career-store/interview/schema.ts` | 신규 |
| `career-os/scripts/lib/career-store/interview/review-schedule.ts` | 신규 |
| `career-os/scripts/lib/career-store/interview/review-schedule.test.ts` | 신규 |
| `career-os/scripts/lib/career-store/interview/store.ts` | 신규 |
| `career-os/scripts/lib/career-store/interview/store.test.ts` | 신규 |
| `career-os/scripts/lib/career-store/ddl.ts` | 수정 |
| `career-os/scripts/lib/career-store/context.ts` | 수정 |
| `career-os/scripts/lib/career-store/database.test.ts` | 수정 |
| `career-os/scripts/interview-drill/drill-engine.ts` | 수정 |
| `career-os/scripts/interview-drill/memory.ts` | 수정 |
| `career-os/scripts/interview-drill/drill-engine.test.ts` | 수정 |
| `career-os/scripts/interview-drill/drill-engine.cli.test.ts` | 수정 |
| `career-os/scripts/interview-drill/memory.test.ts` | 수정 |
| `career-os/scripts/interview-drill/store/backend-store.ts` | 삭제 |
| `career-os/scripts/interview-drill/store/file-store.ts` | 삭제 |
| `career-os/scripts/interview-drill/store/index.ts` | 삭제 |
| `career-os/scripts/interview-drill/store/index.test.ts` | 삭제 |
| `career-os/scripts/interview-drill/store/port.ts` | 삭제 |
| `career-os/scripts/interview-drill/store/store-contract.test.ts` | 삭제 |
| `career-os/scripts/interview-drill/career-backend/client.ts` | 삭제 |
| `career-os/scripts/interview-drill/career-backend/client.test.ts` | 삭제 |
| `career-os/scripts/plugin-local/main.ts` | 수정 |
| `career-os/scripts/plugin-local/main.test.ts` | 수정 |
| `career-os/.env.example` | 수정 |
