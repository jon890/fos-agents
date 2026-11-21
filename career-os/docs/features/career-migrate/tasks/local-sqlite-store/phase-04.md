# Phase 04. 공고·공부 실행기가 Backend 대신 저장 모듈을 쓴다

**Execution profile**: standard

## 목표

두 실행기의 Backend HTTP client 를 phase 02, 03 의 저장 모듈로 바꾼다. 맥락 문서는 작업 폴더 `context/` 에서 읽고, 실행 폴더는 작업 폴더 `runs/` 아래에 두고, 리포트 사본을 `reports/` 에 남긴다.

**범위 외**: 면접, 후보자 맥락, 프로필, 사용량 실행기와 MCP 서버(`career-os/plugin/src/`)는 계속 Backend 를 부른다. `career-os/scripts/lib/career-backend-http.ts` 와 `career-backend-config.ts` 는 그 실행기들이 써서 남긴다.

## 컨텍스트

- 공고 실행기 진입점은 `career-os/scripts/position-recommender/position_run.ts`, 공부 실행기는 `career-os/scripts/study-topic-recommender/morning_reading_cli.ts` 와 `manage_reading_sources.ts` 다. 둘 다 `career-os/scripts/plugin-local/main.ts` 가 `career-local.js` 로 묶는다.
- 호출부는 client 를 인자로 받는 구조라 판단 코드는 그대로 두고 만드는 함수와 타입 import 만 바꾼다.
- 맥락 문서는 에이전트가 실행 전에 `<작업 폴더>/context/<문서 키>.md` 로 써 둔다. 이 계획에서 문서의 원본은 아직 Backend 의 후보자 맥락 문서이고(다음 계획에서 기억으로 바뀐다), 실행기는 원본이 어디든 `context/` 만 읽는다.
- 작업 폴더 루트는 `CAREER_WORKSPACE_ROOT`, 없으면 `/workspace/career` 다.

**요구사항**: REQ1, REQ3, REQ4(설계 DECISION4, 5, 11, 스펙 DECISION16, 17, 19, 22)

**근거 문서**: `career-os/docs/features/career-migrate/README.md`, `career-os/docs/flow.md`

## 의도 메모

- 새 DB 에는 분석 정책, 회사 선호, 제외 규칙이 없다. Backend 에는 이것을 넣는 HTTP 경로가 있었고 저장소 스크립트나 MCP 도구가 불렀다. 실행 공간에서도 넣을 수 있게 `position` 실행기에 설정 명령을 더한다. 값의 기본값은 넣지 않는다.
- 저장소가 잠겼거나 깨졌으면 실행기는 표준 오류 첫 줄에 `CAREER_STORE_BUSY` 나 `CAREER_STORE_CORRUPT` 를 적고 종료 코드 1 로 끝난다. 에이전트가 그 줄을 결과 글 첫 줄에 옮긴다.
- 리포트 사본의 이름에 실행 시각을 붙이지 않는다. 같은 날 다시 만들면 같은 이름을 덮어쓴다. 「내 파일」 에는 에이전트가 실행마다 따로 넣는다.

## 작업 항목

### 1. 공고 실행기

- `career-os/scripts/position-recommender/career-backend/client.ts` 와 그 테스트를 지우고 `career-os/scripts/position-recommender/position-store.ts` 를 만든다. `createPositionStore(environment)` 가 `openCareerStore` 로 연 DB 위의 `PositionStore` 를 돌려준다. 호출부의 `createCareerBackendClient`, `CareerBackendClient` 를 이 이름으로 바꾼다.
- `career-os/services/career-backend/src/…` 를 가리키는 import 를 `career-os/scripts/lib/career-store/…` 로 바꾼다(공고 실행기 전체).
- `career-os/scripts/position-recommender/candidate-context.ts`: `context/position-preferences.md`, `context/application-state.md` 를 읽어 실행 폴더의 `candidate-context.json` 에 `{ candidateContextVersion, documents: { <키>: { body } } }` 로 쓴다. 문서가 없으면 어느 문서를 어느 경로에 써야 하는지 알리고 던진다. `career-os/scripts/candidate-context/position-context.ts` 와 그 테스트는 쓰는 곳이 없어져 지운다.
- `run-dir.ts`: 실행 폴더를 `<루트>/runs/position-recommendation-*` 로 만들고, 정리 검사는 시스템 임시 폴더의 직접 자식과 `<루트>/runs` 의 직접 자식을 받는다.
- `position_run.ts`: 하위 명령 `configure-policy --input <json>`, `configure-companies --input <json>`, `exclusions get`, `exclusions put --input <json>` 을 더한다. `finalize` 는 리포트를 `<루트>/reports/<서울 날짜>-position.html` 로 복사하고 그 경로를 출력한다.
- `feedback/exclusions.ts` 의 실패 문구를 저장소 기준으로 고친다.

### 2. 공부 실행기

- `study-library/client.ts`: `StudyLibraryClient` 를 `StudyStore` 를 감싼 것으로 바꾼다. 공개 메서드 이름은 그대로다. HTTP 재시도와 origin, token 옵션은 없앤다.
- `study-library/contracts.ts`: `learningInterests.version` 을 문자열로 받는다.
- `study-library/doctor.ts`: 저장소를 열 수 있는지와 `context/learning-interests.md` 가 있는지 본다.
- `runtime-paths.ts`: 실행 폴더를 시스템 임시 폴더 아래와 `<루트>/runs/` 아래에서 받는다.
- `morning_reading_cli.ts`: 추천 저장이 끝나면 리포트 HTML 을 `<루트>/reports/<서울 날짜>-study.html` 로 복사한다. 오류 출력은 `CareerStoreError` 의 code 를 낸다.
- `manage_reading_sources.ts`: 버전 충돌 판정을 `CareerStoreError` 로 한다.

### 3. `career-os/scripts/plugin-local/main.ts`

`position`, `study`, `study-sources` 실행기의 오류 출력에서 저장소 오류 code 를 첫 줄에 낸다. 실행기 설명 문구의 Backend 언급을 고친다.

### 4. 테스트

- 기존 실행기 테스트(`position_run.test.ts`, `position_analysis_pipeline.test.ts`, `finalize_position_recommendation.test.ts`, `study-library/*.test.ts`, `runtime-paths.test.ts`, `manage_reading_sources.test.ts`, `plugin-local/main.test.ts`)를 임시 작업 폴더의 SQLite 로 돌게 고친다. HTTP 대역(fetch stub)으로 요청 모양을 보던 검사는 저장 결과를 보는 검사로 바꾼다.
- `career-os/scripts/position-recommender/two-run.test.ts`: 임시 작업 폴더에서 수집 결과를 넣는 대역으로 `collect → commit-company-tiers → commit-analyses → finalize` 를 두 번 돌린다. 두 번째 실행의 분석 큐에 바뀌지 않은 공고가 없고, 제외 규칙에 넣은 공고와 회사가 후보에 없다.
- `career-os/scripts/study-topic-recommender/two-run.test.ts`: 수집을 두 번 돌려 두 번째가 저장된 커서를 받아 시작하고, 첫 실행에서 고른 자료가 두 번째 후보에 없으며, 게시 기록이 추천 실행 목록에서 보인다.
- `career-os/scripts/lib/career-backend-naming.test.ts` 의 허용 목록에서 지운 테스트 파일을 뺀다.

## 검증

```bash
bun test ./career-os/scripts/lib ./career-os/scripts/position-recommender ./career-os/scripts/study-topic-recommender ./career-os/scripts/plugin-local
bunx tsc --noEmit -p .
bun run format:position-recommender:check
grep -rn "career-backend" career-os/scripts/position-recommender career-os/scripts/study-topic-recommender --include='*.ts' | grep -v "\.test\.ts" ; test $? -eq 1
```

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/position-store.ts` | 신규 |
| `career-os/scripts/position-recommender/candidate-context.ts` | 신규 |
| `career-os/scripts/position-recommender/candidate-context.test.ts` | 신규 |
| `career-os/scripts/position-recommender/two-run.test.ts` | 신규 |
| `career-os/scripts/study-topic-recommender/two-run.test.ts` | 신규 |
| `career-os/scripts/position-recommender/career-backend/client.ts` | 삭제 |
| `career-os/scripts/position-recommender/career-backend/client.test.ts` | 삭제 |
| `career-os/scripts/candidate-context/position-context.ts` | 삭제 |
| `career-os/scripts/candidate-context/position-context.test.ts` | 삭제 |
| `career-os/scripts/position-recommender/*.ts` | 수정 (import 와 client 이름) |
| `career-os/scripts/position-recommender/**/*.ts` | 수정 (스키마 import 경로) |
| `career-os/scripts/study-topic-recommender/study-library/client.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/client.test.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/contracts.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/doctor.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/doctor.test.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/candidates.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/ingestion.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/runtime-paths.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/runtime-paths.test.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/morning_reading_cli.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/manage_reading_sources.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/manage_reading_sources.test.ts` | 수정 |
| `career-os/scripts/plugin-local/main.ts` | 수정 |
| `career-os/scripts/plugin-local/main.test.ts` | 수정 |
| `career-os/scripts/lib/career-backend-naming.test.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/candidates.test.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/ingestion.test.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/recommendations.test.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/morning_reading_cli.test.ts` | 수정 |
| `career-os/scripts/lib/access-client-wiring.test.ts` | 수정 (공부 client 를 대상에서 뺀다) |
| `career-os/plugin/src/contract-parity.test.ts` | 수정 (공부 계약의 비교 대상이 바뀌면) |
