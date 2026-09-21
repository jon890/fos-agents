# 코드 아키텍처

career-os는 스킬이 실행 계약을 설명하고 TypeScript 스크립트와 작은 HTTP Backend가
반복 가능한 처리를 담당하는 워크스페이스다.

이 문서는 **어느 경로에 무엇이 앉고 어느 쪽이 어느 쪽을 부르는지**를 담는다.
폴더 컨벤션과 모듈 책임이 여기 속한다.
도메인 규칙과 분기는 [`flow.md`](flow.md), 저장 모델은 [`data-schema.md`](data-schema.md),
제품 약속은 [`prd.md`](prd.md)가 담는다.

파일 하나하나가 무엇을 하는지는 그 파일의 주석이 소유한다. 여기에 옮겨 적지 않는다.

public `fos-agents` 저장소는 스킬과 실행 코드를 소유한다.
비공개 작업 파일은 각 환경의 기존 경로에서 다루고 홈서버 `career-os` collection의 release를 기준으로 동기화한다.

## 공통

### 디렉터리 구조

```text
career-os/
├── .claude/skills/       사용자 작업별 skill
├── .codex/skills/        Codex에서 같은 skill을 노출하는 링크
├── config/               사람이 관리하는 수집 정책
├── scripts/              검증, 수집과 변환 코드
├── services/             추천 상태 HTTP Backend와 migration
├── applications/         동기화되는 로컬 지원 패키지
├── library/              사람이 직접 관리하며 여러 지원에서 재사용하는 비공개 자료
├── state/                검증기와 도구가 다음 실행에 재사용하는 상태
├── public/               공개 가능한 질문 은행
├── cache/                다시 만들 수 있는 수집 결과
├── sources/fos-study/    별도 저장소에서 관리하는 공개 학습·이력 자료
└── docs/                 제품, 흐름, 데이터, 기술 결정 문서
```

### 파일 개요

| 경로                                                                  | 책임                               |
| ------------------------------------------------------------------- | -------------------------------- |
| `.claude/skills/<name>/SKILL.md`                                    | 사용자 요청별 실행 계약의 관리 원본             |
| `.codex/skills/<name>`                                              | Codex가 같은 skill을 읽는 링크           |
| `config/*.ts`                                                       | 공고, 읽을거리와 면접 자료의 수집 정책           |
| `scripts/lib/`                                                      | CLI, 텍스트 정규화와 날짜 변환 같은 공통 순수 기능  |
| `scripts/career-workspace/`                                         | 비공개 작업본의 준비, 차이 확인과 release 반영   |
| `scripts/position-recommender/`                                     | 활성 공고 수집, 추천 검증과 HTML 생성         |
| `scripts/study-topic-recommender/`                                  | 읽을거리 수집, 선별 결과 검증과 HTML 생성       |
| `services/recommendation-api/`                                      | 포지션·학습자료 상태 API와 MySQL migration |
| `scripts/interview-drill/`                                          | 질문 선택, 꼬리질문과 복습 상태 관리            |
| `scripts/interview-question-sources/`                               | 외부 면접 질문 후보 수집과 출처 검증            |
| `scripts/question-bank-collector/`                                  | 공개 질문 은행의 구조, 공개 범위와 출처 검사       |
| `applications/<company>/<position>/`                                | 사용자가 여는 검토 화면과 제출 PDF            |
| `applications/<company>/<position>/evidence/`                       | 공고 원문, 후보자 인터뷰, 지원 전략과 제출 문서 원본  |
| `applications/<company>/<position>/review/`                         | 근거 장부, 점수표, manifest와 제출 문서 HTML |
| `library/`                                                          | 여러 지원에서 재사용하는 비공개 질문과 프로필 원고     |
| `state/`                                                            | 답변 연습과 검증 장부처럼 다음 실행에 필요한 상태     |
| `public/question-bank/`                                             | 공개 가능한 일반 면접 질문과 출처              |
| `sources/fos-study/`                                                | 별도 저장소에서 관리하는 공개 학습·경력 근거        |
| `docs/`                                                             | 제품 가치, 흐름, 데이터 계약, 코드 구조와 결정 이유  |


현재 경력, 역할 선호와 경험 경계는 이 저장소에 복제하지 않는다.
skill이 private brain에서 조회하고, 제출에 사용할 세부 성과는 `sources/fos-study/`와 실제 프로젝트 근거로 다시 확인한다.

### 스킬과 실행 코드

`SKILL.md`는 입력, 실행 순서, 산출물, 검증, 안전 경계를 설명한다.
반복되는 수집, 파싱, 렌더링과 검증은 `scripts/`의 TypeScript로 구현한다.

하나의 스크립트가 수집과 추천, 렌더링을 모두 책임지지 않는다.
외부 응답은 경계에서 검증한 뒤 내부 타입으로 변환한다.
구조화 데이터 검증에는 Zod를 사용하고, 표시 문자열은 렌더러에서만 만든다.

새 스킬 스크립트는 `scripts/lib/cli.ts` 의 `runCli` 를 기본으로 사용한다.
인자 파싱, 사용법 오류 처리와 결과 출력이 스크립트마다 같은 모양으로 되풀이되면
그 스크립트가 무엇을 검사하고 무엇을 만드는지가 가려진다.
사용법은 `scripts/lib/cli.ts` 를 연 뒤 기존 스크립트 하나를 예시로 참고한다.

종료 코드는 셋으로 고정한다.


| 코드  | 뜻                            |
| --- | ---------------------------- |
| 0   | 통과                           |
| 1   | 검사나 실행 실패                    |
| 2   | 사용법 오류. 인자가 없거나 값이 규격에 맞지 않다 |


사용법 오류를 1과 나누는 이유는 호출하는 쪽이 재시도할지 인자를 고칠지 가리기 위해서다.

- 검사 스크립트는 `{ passed: boolean }` 을 돌려준다. `runCli` 가 그 값으로 0과 1을 정한다.
- 파일을 만드는 스크립트는 아무것도 돌려주지 않고 `{ json: false }` 를 준다. 예외가 없으면 0으로 끝난다.
- 인자 규격은 `pattern` 으로 적는다. 검사 코드를 본문에 두지 않는다.
- `--help` 는 `runCli` 가 spec 으로 만든다. 도움말 문자열을 따로 쓰지 않는다.

#### CLI 계약

새 스크립트는 `runCli`를 쓴다.
옵션 중복 처리, 도움말, 출력과 종료 코드 계약이 다른 기존 명령은 호환을 위해 기존 진입점을 유지한다.
`firstOptionValue`는 여러 기존 명령이 공유하는 첫 옵션값 조회이며,
같은 이름 뒤 토큰을 옵션처럼 보여도 값으로 취급하는 기존 호환 동작을 그대로 옮긴 것이다.
새 명령의 엄격한 옵션 검사는 `parseArgs`가 담당한다.

수정할 때는 Java 서비스처럼 입력을 받아 결과를 돌려주는 핵심 함수부터 읽는다.
파일 끝의 CLI 진입점은 컨트롤러처럼 인자를 전달하고 결과를 출력한다.
추천 판정은 `validateRecommendationAgainstPool`에서 고친다.
추천 화면 변경 위치는 아래 「포지션 추천 렌더」를 따른다.
옵션 조회 규칙은 `scripts/lib/cli.ts`에서 확인한다.


| 수정할 처리            | 핵심 함수                                              |
| ----------------- | -------------------------------------------------- |
| 추천 파일 로드와 후보풀 대조  | `validateRecommendationFiles`                      |
| 추천 화면 파일 생성       | `writeCandidatePreview`                            |
| 상세 추천 HTML 파일 생성  | `writeRecommendation`                              |
| 읽을거리 목록과 설정 예시 생성 | `listReadingSources`, `buildReadingSourceTemplate` |
| 면접 질문 소스 명령       | `runInterviewQuestionSources`                      |
| 산출물 내용과 공개 경계 검사  | `validateMorningReadingOutputs`                    |


저장소 루트에서 이미 준비한 입력 파일을 다음처럼 검사한다.
아래 명령은 네트워크 수집을 실행하지 않는다.

```bash
bun career-os/scripts/position-recommender/validate_recommendation.ts --input /tmp/recommendation.json --candidates /tmp/posting-candidates.json
bun career-os/scripts/study-topic-recommender/manage_reading_sources.ts list --category techBlog
bun test career-os/scripts/lib/cli-contract.test.ts career-os/scripts/lib/cli.test.ts
bun test career-os/scripts
bun test ./career-os/.claude/skills/
bunx tsc --noEmit
```

**스킬 스크립트는 경로를 직접 줘야 실행된다.**
`bun test` 는 점으로 시작하는 디렉터리를 훑지 않아, 스킬이 `.claude/` 아래에 있는 한
`bun test career-os/scripts` 나 파일 이름으로는 걸리지 않는다.
실측으로 스킬 스크립트에 실패하는 테스트를 심고 `bun test career-os/scripts` 를 돌렸더니 0 fail 이 나왔다.

`bunx tsc --noEmit` 은 `tsconfig.json` 의 `include` 가 스킬 스크립트를 담고 있어 경로를 주지 않아도 된다.

실제 S3 연동 테스트는 전용 환경값이 모두 있을 때만 실행된다.
로컬 리팩토링 검증에서는 해당 환경값을 제거하여 원격 저장소에 쓰지 않도록 한다.

### 비공개 작업본 동기화

`scripts/career-workspace/`는 Hermes, Codex CLI와 Claude Code가 공유하는 파일 준비·차이 검사·반영 경계다.
manifest 생성과 검증, 로컬 기준 상태 확인, SSH와 command transport, 홈서버 명령을 책임별 모듈로 나눈다.
S3 storage adapter는 홈서버에서 표준 입력과 출력으로 release를 발행하고 내보낸다.
회귀 테스트와 fixture는 `tests/`에 분리한다.
사용자는 이 helper를 직접 고르지 않고 기존 career-os skill을 계속 호출한다.

정상 실행 경로를 이해할 때는 다음 파일만 순서대로 읽는다.


| 순서  | 파일                                         | 책임                                |
| --- | ------------------------------------------ | --------------------------------- |
| 1   | `cli.ts`                                   | 준비, 차이 확인, 발행과 skill 실행 전후 처리     |
| 2   | `command-transport.ts`, `ssh-transport.ts` | 홈서버의 `career-storage` 호출          |
| 3   | `career-storage`                           | 홈서버 publish 직렬화                   |
| 4   | `career-storage-s3.ts`                     | 홈서버 명령의 입력과 출력                    |
| 5   | `s3-storage.ts`                            | 불변 release 검증과 current pointer 변경 |
| 6   | `s3-object-store.ts`                       | Bun `S3Client`를 통한 객체 읽기와 쓰기      |


`contracts.ts`, `manifest.ts`, `local-state.ts`, `tar-utils.ts`는 위 실행 경로가 공유하는 검증 코드다.
동작을 수정하지 않는다면 `tests/`는 읽지 않아도 된다.

각 환경은 `applications`, `library`와 `state`를 일반 로컬 디렉터리로 사용한다.
원격 파일을 network filesystem으로 직접 편집하지 않으며, 준비 단계는 검증한 release만 임시 경로에서 로컬로 교체한다.
반영 단계는 실행 시작 revision이 홈서버 현재 값과 일치할 때만 새 release를 만든다.

`.claude/skills/`가 skill 관리 원본이다.
`.codex/skills/`는 같은 디렉터리를 가리키며 Hermes cron은 `career-os`를 작업 디렉터리로 사용한다.
환경별 차이는 `.env`의 transport 설정에만 두고 지원 판단과 문서 작성 절차를 복제하지 않는다.
SSH client는 `career-storage`를 원격 호출하고, 홈서버의 Hermes는 같은 명령을 command transport로 호출한다.
두 경로는 같은 홈서버 잠금과 S3 pointer 갱신 계약을 사용한다.

### 추천 상태 Backend

`services/recommendation-api/`는 포지션의 장기 상태를 제공하는 작은 Bun HTTP Backend다.
서비스 코드, HTTP 계약과 SQL migration은 `career-os`가 소유한다.
배포 설정, database와 계정 생성, network와 backup은 홈서버 인프라 저장소가 소유한다.
학습자료 API는 아직 구현되지 않았다. Backend 스택 전환 뒤로 계획을 보류했다.


| 경로                                                | 책임                                                 |
| ------------------------------------------------- | -------------------------------------------------- |
| `services/recommendation-api/server.ts`           | `Bun.serve` 시작, health·인증 확인, 공통 timeout과 오류 응답    |
| `services/recommendation-api/routes/positions.ts` | 수집 실행, 회사 tier 반영, 공고 분석 실행, 분석 반영과 추천 실행 endpoint |
| `services/recommendation-api/position/`           | 회사 정책, 공고 버전, 분석 상태와 추천 조립                         |
| `services/recommendation-api/db/`                 | `Bun.SQL` 연결, transaction helper와 repository       |
| `services/recommendation-api/migrations/`         | 순서가 있는 SQL migration과 적용 기록                        |


Backend는 local 개발에서는 `CAREER_RECOMMENDATION_DATABASE_URL`을 읽을 수 있고,
운영에서는 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`과 `DB_PASSWORD`를 읽는다.
두 형식을 함께 주면 시작 전에 실패한다.
client는 `CAREER_RECOMMENDATION_API_URL`과 `CAREER_RECOMMENDATION_API_TOKEN` 또는
`CAREER_RECOMMENDATION_API_TOKEN_FILE`만 읽으며 DB 자격증명을 받지 않는다.
`STUDY_LIBRARY_URL`과 `STUDY_SERVICE_TOKEN`은 study client 전환 동안 같은 Backend를 가리키는 호환 환경값으로 유지한다.

모든 쓰기 요청은 `Authorization: Bearer`와 `Idempotency-Key`를 요구한다.
같은 key와 같은 본문은 기존 응답을 반환하고, 같은 key에 다른 본문을 보내면 `409`를 반환한다.
DB 연결 실패는 `503`, 요청 계약 오류는 `400`, 인증 실패는 `401`, version 충돌은 `409`로 반환한다.
응답은 `Cache-Control: no-store`를 사용하며 원본 token과 DB 오류 전문을 포함하지 않는다.
`PUT /api/positions/v1/analysis-policy`는 fresh DB의 포지션 분석 정책을 명시적으로 초기화하거나 갱신한다.
정책을 설정하지 않은 상태의 수집 요청은 기본값을 추정하지 않고 `409 POLICY_NOT_CONFIGURED`를 반환한다.
`configure_position_analysis_policy.ts`는 정책 JSON을 검증한 뒤 이 endpoint만 호출한다.
`GET /health/live`는 process 상태만 확인하고,
`GET /health/ready`는 DDL을 실행하지 않고 DB 연결, migration version과 checksum을 조회한다.
`GET /api/v1/auth/check`는 유효한 Bearer token에만 `204`를 반환한다.

공고 수집 실행 저장, 회사 tier 결과 반영, 공고 분석 실행 생성, 분석 결과 반영,
학습자료와 cursor 저장, 추천 실행 저장은 각각 한 transaction에서 끝낸다.
`POST /api/positions/v1/collection-runs`는 공고 버전과 수집 실행, 회사 tier 평가 실행 생성까지만 한 transaction에서 처리하고 공고 분석 실행은 만들지 않는다.
`POST /api/positions/v1/company-tier-runs/:id/results`가 모델 평가와 실패를 반영하고,
`POST /api/positions/v1/collection-runs/:id/analysis-runs`가 회사마다 `manual`, `model`, `default` 순서로 tier를 해결한 뒤 공고 분석 실행을 만든다.
회사 tier 실행이 `pending`이면 공고 분석 실행 생성은 `409 COMPANY_TIER_RUN_PENDING`을 반환하고,
수집 실행 하나는 공고 분석 실행 하나만 가지므로 재시도는 저장한 응답을 그대로 돌려준다.
외부 queue와 worker는 두지 않으며 cron이 동기 HTTP 요청으로 단계를 진행한다.
분석 결과 반영은 분석한 공고와 분석하지 못한 공고를 함께 받고,
실행 상태를 `pending`, `partial`, `completed` 중 하나로 돌려준다.
`partial`이면 client가 남은 항목만 다시 보내며 Backend는 스스로 재시도하지 않는다.

운영 배포는 아래 조건을 먼저 만족해야 한다.
이 값은 홈서버 인프라 저장소가 읽으며 `career-os`에서 실행하지 않는다.


| 조건        | 내용                                                                                    |
| --------- | ------------------------------------------------------------------------------------- |
| 초기 schema | 운영 database에는 `001_position_schema`를 한 번만 적용한다. 그 뒤에는 초기 파일을 고치지 않고 `002_*.sql`을 추가한다 |
| 인스턴스 수    | Backend는 하나만 띄운다. 상태 전체를 메모리에 들고 기록하므로 둘 이상이면 서로의 기록을 덮는다                             |
| 적용 확인     | `migrate.ts up` 실행 뒤 `GET /health/ready`가 200인지 확인한다                                  |
| 정책 초기화    | `PUT /api/positions/v1/analysis-policy`로 분석 정책을 한 번 넣는다. 넣기 전에는 수집 요청이 409를 반환한다      |
| cron 연결   | 스킬 실행 cron 등록은 홈서버 인프라 저장소가 담당한다                                                      |

### 외부 경계

- `sources/fos-study/`는 별도 Git 저장소다.

- 홈서버 주소, 계정과 저장 경로는 환경 설정에서만 주입하고 공개 문서나 결과 JSON에 기록하지 않는다.
- 비공개 작업 파일의 이전 release와 복구 경계는 홈서버 private 인프라가 소유한다.
- 외부 제출과 공개 게시에는 사용자 승인이 필요하다.

## application-package-writer

`application-package-writer`는 사용자가 호출하는 지원 준비 진입점이다.
공고와 회사 기준 확인, 후보자 인터뷰, 근거 매핑과 지원 전략을 한 흐름으로 연결한다.
제출 문서의 내부 정보 유출 검사와 로컬 검토 화면 생성은 이 스킬의 `scripts/`에 둔다.

`resume-preparer`는 지원 전략을 이력서와 경력기술서로 변환하는 제출 문서 진입점이다.

공고별 문서는 `applications/<company>/<position>/`에 세 층으로 둔다.
최상위에는 사용자가 직접 여는 `application-package.html`과 제출 PDF만 두고,
기준 원본은 `evidence/`에, 내부 검증 자료는 `review/`에 둔다.
생성기와 검증기는 이 세 층의 경로를 계약으로 사용한다.

`.claude/skills/application-package-writer/templates/`가 검토 화면의 HTML 골격과 CSS를 소유한다.
층별 파일 목록과 화면 구성은 [`data-schema.md`](data-schema.md)가 소유한다.

여러 지원에서 재사용하는 개인 질문과 대상별 프로필 원고는 `library/`에 둔다.
지원서 검증 결과와 점수표는 `library/`에 보관하지 않는다.
공고별 현재 검토 결과는 해당 `applications/`에 두고,
여러 지원에서 재사용할 검증 완료 주장만 `state/verified-claims/`에 둔다.

## interview-practice

현재 지원 대상은 private brain에서 검색한다.
skill은 brain에서 찾은 회사와 역할을 대응하는 `applications/<company>/<position>/` 경로로 해석해 실행 스크립트에 명시적으로 전달한다.
TypeScript 스크립트가 brain을 직접 조회하지 않는다.

`scripts/interview-drill/`은 `interview-practice`의 기술·인성 모드에서 공통 진행과 복습 상태를 처리한다.
공고별 `evidence/interview-questions.json`을 명시하면 포지션 질문과 공통 기반 질문을 섞어 구성한다.
`follow-up-policy.ts`는 답변 수준에 따른 꼬리질문 축과 최대 깊이를 제공한다.
복습 상태는 `state/drill-progress.json` 하나에 저장한다.
후보풀과 리포트 중간 파일처럼 다시 만들 수 있는 실행 자료는 `state/`에 두지 않는다.

`config/interview-question-sources.ts`는 공식 문서, 기술 블로그, 공개 영상과 GitHub 가이드의 역할을 구분한다.
`scripts/interview-question-sources/`는 기존 읽을거리 수집 어댑터를 재사용해 실행별 후보풀을 만들고 설정과 후보 형식을 검증한다.
수집 후보는 질문의 정답 근거가 아니며, 공개 질문의 답변 신호는 공식 참조에서 다시 검증한다.

`public/question-bank/sources.json`은 공개 공통 질문이 참조하는 공식 URL과 확인일을 관리한다.
공개 질문 보강은 `interview-practice`의 필요할 때만 읽는 참고 문서가 안내한다.
`scripts/question-bank-collector/validate.ts`는 독립된 검증 모듈로 남아 질문 구조, 공개 범위, 출처 등록과 URL 형식을 검사한다.

## position-recommender

`scripts/position-recommender/` 루트에는 CLI 진입점만 둔다.
수집, 추천 원문 대조, 회사 조사 병합과 렌더가 그것이다.
디렉터리별 책임은 다음과 같다.

| 디렉터리 | 책임 |
| --- | --- |
| `live-postings/` | 외부 소스 어댑터와 수집 정책 |
| `recommendation/` | 추천 계약과 최종 답변 문구 |
| `company-research/` | 재사용할 회사 사실의 계약과 병합 |
| `feedback/` | 개인 제외 기준 |
| `recommendation-api/` | Backend client. 큐 조회와 분석 반영 |
| `render/` | HTML 생성과 검사 |

#### 수집 정책의 세 층

수집 정책은 세 층으로 나눈다.


| 층     | 위치                           | 책임                                       |
| ----- | ---------------------------- | ---------------------------------------- |
| 소스 경계 | `live-postings/adapters/`    | 소스 고유 API, 상태값과 상세 요청 전 사전 선별            |
| 공통 정책 | `live-postings/policy/`      | 목표 직무·고용형태 키워드, 분류와 마감 변환                |
| 최종 경계 | `live-postings/validator.ts` | 모든 소스의 URL, 상태, 마감, 고용형태와 역할을 같은 규칙으로 검사 |


adapter의 사전 필터와 최종 경계는 역할이 다르므로 둘 다 유지한다.
사전 필터는 명백히 불필요한 상세 페이지 요청을 줄이고, 최종 경계는 adapter 누락이 모델 입력으로 번지는 것을 막는다.
다만 공통 키워드를 adapter에 복제하지 않는다.
교체 가능한 목록은 `policy/keywords.ts`, 판정 로직은 `role.ts`, `classification.ts`, `lifecycle.ts`가 소유한다.
공백 정규화, 키워드 포함 검사와 HTML 평문화는 `scripts/lib/text.ts`, 날짜 파싱과 시각 차이 계산은 `scripts/lib/date-format.ts`를 사용한다.

현재 키워드 판정은 부분 문자열 검사이므로 새 단어를 추가할 때 기존 공고 제목에 대한 회귀 테스트를 먼저 둔다.
회사나 특정 공고의 가치 판단은 공통 정책에 넣지 않고 `feedback/`의 검증된 개인 제외 규칙으로 반영한다.

어댑터는 원문 응답을 공통 `LivePosting` 형태로 바꾼다.

`collection_health.ts`는 실행 전체가 추천 입력으로 쓸 만한지 판정한다.
실패 소스가 허용 개수를 넘거나 후보가 0건이면 수집기는 후보풀을 남기고 종료 코드 1로 끝낸다.
판정 기준이 되는 소스별 수집 개수의 뜻은 `contracts.ts`의 `sourceDiagnosticSchema`가 소유한다.
Wanted adapter의 직군 코드처럼 소스 고유의 상수는 그 adapter가 소유한다.
후보자 선호와 회사 평가는 수집 상수에 넣지 않고 추천 단계에서 판단한다.

#### 렌더

모델이 추천 데이터에 맞는 정보 구조와 화면 구성을 선택해 독립 HTML 파일을 만든다.
스크립트는 추천 링크, 기본 HTML 메타 정보와 공개 범위를 검사하며 절 이름이나 카드 수를 고정하지 않는다.
고정 템플릿 렌더러는 모델의 추천 데이터를 일관된 반응형 HTML로 표시한다.
선택 데이터가 없는 절은 만들지 않으며 추천 분류나 판단값을 보완하지 않는다.


| 수정할 내용                | 파일                                                                                                                                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 자유형 HTML 공개 계약        | [validate-report-html.ts](../scripts/position-recommender/render/validate-report-html.ts)                                                                                                                                                          |
| 대체 상세 화면              | [report.html](../scripts/position-recommender/render/templates/report.html), [report-parts.html](../scripts/position-recommender/render/templates/report-parts.html)                                                                               |
| 대체 추천 화면과 전체 후보 목록    | [preview.html](../scripts/position-recommender/render/templates/preview.html), [preview-parts.html](../scripts/position-recommender/render/templates/preview-parts.html)                                                                           |
| 대체 렌더의 색상과 동작         | [report.css](../scripts/position-recommender/render/templates/report.css), [preview.css](../scripts/position-recommender/render/templates/preview.css), [preview.js](../scripts/position-recommender/render/templates/preview.js)                  |
| 상세 화면의 데이터 변환         | [recommendation-html.ts](../scripts/position-recommender/render/recommendation-html.ts)의 `renderRecommendationHtml(run, assets, generatedAt)`                                                                                                      |
| 후보 정렬, 표시 제한과 카드 데이터  | [candidate-preview-html.ts](../scripts/position-recommender/render/candidate-preview-html.ts)의 `renderCandidatePreview(run, options, assets, collected)`                                                                                           |
| 파일 읽기, 쓰기, 현재 시각과 CLI | [render\_recommendation.ts](../scripts/position-recommender/render_recommendation.ts), [render\_candidate\_preview.ts](../scripts/position-recommender/render_candidate_preview.ts), [assets.ts](../scripts/position-recommender/render/assets.ts) |
| 한국 시각과 날짜 표시          | [lib/date-format.ts](../scripts/lib/date-format.ts)                                                                                                                                                                                                |


대체 렌더러와 순수 렌더 함수의 조각 조립, 슬롯 치환 규칙은 각 파일을 열어 확인한다.
이 문서는 어떤 파일이 무엇을 맡는지만 안내하고, 치환 순서나 이스케이프 규칙 같은 내부 동작은 코드 주석으로 옮긴다.

상세 렌더 CLI는 `--format html`만 허용한다.
`md` 등 다른 형식은 스키마 검사 이후 사용법 오류로 종료하며 파일을 만들거나 덮어쓰지 않는다.

저장소 루트에서 아래 검증을 실행한다.

```bash
bun test career-os/scripts/position-recommender/render/*.test.ts career-os/scripts/lib/cli-contract.test.ts career-os/scripts/lib/date-format.test.ts
bun run format:position-recommender
bun run format:position-recommender:check
bunx tsc --noEmit
git diff --check
```

위 포맷 명령은 `position-recommender` 아래의 TypeScript, HTML, CSS와 JavaScript 전체를 대상으로 삼는다.
개인 산출물과 다른 워크스페이스 스크립트에는 적용하지 않는다.

`scripts/lib/date-format.ts`는 한국 시각 표시를 담당하며 현재 시각을 직접 얻지 않는다.
아침 읽을거리의 파일명과 API 보고서 ID도 이 모듈의 ISO 날짜 함수를 재사용한다.
마감 상태와 긴급도 값은 `live-postings/policy/lifecycle.ts`가 결정한다.

## resume-preparer

문서 작성, 사람 확인, 주장 근거 감사, 인사담당자와 실무담당자 리뷰, HTML·PDF 변환과 제출 묶음 검증을 순서대로 수행한다.
사실 감사와 설득력 평가는 별도 참고 문서와 검사 스크립트로 분리하지만 별도 스킬로 노출하지 않는다.
면접 말하기 준비와 꼬리질문 연습은 `interview-practice`가 담당한다.

`.claude/skills/resume-preparer/scripts/verified-claims/`는 검증 완료 주장 스키마, 안정적인 주장 키, 근거 파일 해시, 저장과 검색을 책임별 모듈로 나눈다.
CLI 진입점은 다음 셋만 스킬의 `scripts/` 바로 아래에 둔다.


| CLI                                                  | 책임                                               |
| ---------------------------------------------------- | ------------------------------------------------ |
| `search_verified_claims.ts <query>`                  | 문구와 근거 설명을 검색해 관련 주장, 근거 경로와 locator를 점수순으로 출력한다 |
| `assess_claim_reuse.ts <application-directory>`      | 현재 제출 문서에서 그대로 쓸 수 있는 판정과 다시 읽을 근거를 나눈다          |
| `promote_verified_claims.ts <application-directory>` | 검증을 통과한 현재 공고별 원장을 검증 장부에 원자적으로 합친다              |


검색과 판정 CLI는 상태 파일을 바꾸지 않는다.
반영 CLI는 `schemaVersion: 3`, 모든 주장 `safe`, 현재 HTML 문구 해시 일치를 다시 검사한 뒤에만 쓴다.
같은 원장을 다시 반영하면 파일 내용과 수정 시각을 바꾸지 않는다.

공고별 문서는 `applications/<company>/<position>/`에 세 층으로 둔다.
최상위에는 사용자가 직접 여는 `application-package.html`과 제출 PDF만 두고, 기준 원본은 `evidence/`에, 내부 검증 자료는 `review/`에 둔다.
포지션별 질문은 공고 책임, 근거 방어와 경험 공백에서 파생한다.
화면 구성은 [`data-schema.md`](data-schema.md#검토-화면)의 「검토 화면」이 소유한다.
생성기와 검증기는 이 세 층의 경로를 계약으로 사용한다.
층별 파일 목록은 [`data-schema.md`](data-schema.md)의 「지원 패키지」가 소유한다.
브라우저 자동 입력용 `application-form.json`과 경력기술서는 필요한 경우에만 추가한다.
공통 개인정보는 private brain에서 가져오고 후보자 인터뷰에는 복제하지 않는다.
공고별 개인 근거와 면접 준비 자료도 같은 `applications/<company>/<position>/`에 둔다.
여러 지원에서 재사용하는 개인 질문과 대상별 프로필 원고는 `library/`에 둔다.
프로필 원고는 `library/profiles/`에 두며 원티드, LinkedIn과 GitHub처럼 갱신 대상을 파일명으로 구분한다.
지원서 검증 결과와 점수표는 `library/`에 보관하지 않는다.
공고별 현재 검토 결과는 해당 `applications/`에 두고, 여러 지원에서 재사용할 검증 완료 주장만 `state/verified-claims/`에 둔다.
작성 취향은 아래 「후보자 지식과 이력서」의 스킬 참조가 담당한다.
실제 제출은 두 스킬의 책임이 아니다.

이력서 작성 취향은 `.claude/skills/resume-preparer/references/resume-taste.md`가 소유한다.
조회 시점과 환원 분기는 같은 스킬의 `references/brain-context.md`에 두고 필요한 단계에서 읽는다.
스킬은 개인 맥락 조회를 `brain-search`, 새 개인 지식의 저장 제안을 `brain-add`로 연결한다.

현재 경력, 역할 선호와 경험 경계의 기준 원본은 private brain이다.
skill은 필요한 정보를 실행 시점에 조회하고 TypeScript 스크립트에 명시적인 입력으로 전달한다.
세부 성과는 공개 가능한 `sources/fos-study/`와 실제 작업 저장소에서 다시 확인한다.

공개 가능한 이력 자료는 별도 `sources/fos-study/` 저장소에서 관리한다.

| 경로 | 책임 |
| --- | --- |
| `.claude/skills/resume-preparer/references/resume-writing-style.md` | 모든 이력서와 경력기술서에 적용하는 표현과 근거 범위 기준 |
| `.claude/skills/resume-preparer/references/resume-design.md` | 이력서와 경력기술서의 기본 시각 기준 |
| `.claude/skills/resume-preparer/references/resume-taste.md` | 개인 작성 취향 |
| `.claude/skills/resume-preparer/references/brain-context.md` | 개인 맥락 조회 시점과 환원 분기 |
| `.claude/skills/resume-preparer/templates/` | 이력서 HTML 골격, 기본 CSS와 회사·학교 로고 |

공고별 스타일은 `export_resume.ts --design <path>`에 CSS 파일이나
`css` 코드 블록이 있는 Markdown 파일을 명시한다.

## study-topic-recommender

`scripts/study-topic-recommender/` 의 디렉터리 책임이다.

| 경로 | 책임 |
| --- | --- |
| `source/` | 글과 영상 피드 수집 경계. 원문 발견과 메타 추출만 한다 |
| `source/archive/` | sitemap 과 YouTube uploads playlist 같은 과거 수집 cursor 해석 |
| `persistence/` | 파일모드의 누적 이력 |
| `study-library/` | 학습자료 API client. fetch, 인증 헤더, 응답 검증과 후보풀 타입 변환 |
| `render/` | 주제 중심 HTML 생성 |

후보풀, 선별, 누적 이력, 공부 주제 구성과 HTML 렌더링은 각각 분리된 모듈이 담당한다.
실행기는 시스템 임시 디렉터리 아래의 명시적인 실행 경로만 사용하며 저장소에 리포트 디렉터리를 만들지 않는다.
`runtime-paths.ts` 가 `CAREER_OS_ROOT` 와 `--run-dir` 를 함께 해석하고 `validate_outputs.ts` 도 같은 해석을 쓴다.
둘 다 주어졌는데 경로가 다르면 사용법 오류로 중단한다.

`config/external-reading-sources.ts` 가 소스 목록과 어댑터 종류를 소유한다.
archive 진입점은 이 파일에 복제하지 않고 sourceKey 별 registry 로 둔다.

### 두 모드의 경계

파일모드와 library 모드는 실행 진입점에서 나뉜다.

- 파일모드는 `skill begin`, `state/morning-study-history.json`, `--commit-history` 흐름을 쓴다.
- library 모드는 그 파일을 읽지 않고 후보와 추천 이력을 API 에서 가져온다.
- API 호출이 실패해도 파일모드로 자동 전환하지 않는다.
- `study-library/` 는 MySQL 드라이버나 서버 저장 로직을 갖지 않는다.
  schema 와 endpoint 정의는 `services/recommendation-api/` 가 소유한다.
- legacy 이력을 읽는 import preview 만 `skill begin` 과 `skill finish` 예외를 둔다.

library 모드가 읽는 환경값이다.

| 이름 | 의미 |
| --- | --- |
| `STUDY_LIBRARY_URL` | career-os API origin. HTTPS 이며 path, query, hash 와 credentials 가 없어야 한다 |
| `STUDY_SERVICE_TOKEN` | 서비스 인증 Bearer token. 브라우저 세션과 별개다 |
| `YOUTUBE_DATA_API_KEY` | 선택값. 있으면 YouTube uploads playlist 과거 수집을 쓴다 |

값이 없거나 origin 형식이 맞지 않으면 `--library` 실행은 시작 전에 실패한다.
브라우저 관리자 쿠키나 세션을 복제하지 않는다.

### 설계 경계

수집 단계는 등록된 소스의 글과 영상을 결정적으로 가져온다.
코드는 URL 을 정규화한 `contentKey` 로 이전 추천을 판정하고 모델 선택 검증에서 재선택을 거부한다.
모델은 고정 키워드 점수 대신 수집된 자료의 내용과 사용자 방향을 바탕으로 고른다.
렌더러는 카테고리별 자료 목록이 아니라 공부 주제, 커리어 질문과 연결 자료를 표시한다.
별도 AI 전용 소스나 AI 전용 리포트 구역은 두지 않는다.
새 런타임 의존성은 추가하지 않는다.

## sync-profile

**이 스킬만 실행 코드를 `scripts/` 가 아니라 스킬 번들 안에 둔다.**
대상 사이트의 폼을 조작하는 코드라 다른 스킬이 재사용할 것이 없고,
대상별 절차 문서 바로 옆에 두는 편이 읽기 쉽다.

| 경로 | 책임 |
| --- | --- |
| `.claude/skills/sync-profile/references/wanted.md` | 원티드 폼 구조와 저장 확인 절차 |
| `.claude/skills/sync-profile/references/linkedin.md` | LinkedIn 편집 진입과 저장 확인 절차 |
| `.claude/skills/sync-profile/references/github.md` | GitHub 프로필 문서 규칙 |
| `.claude/skills/sync-profile/scripts/wanted_*.sh` | 원티드 폼 필드 조회와 입력 |
| `.claude/skills/sync-profile/scripts/agent_usage.py` | 에이전트 세션 기록에서 월별 토큰과 환산 비용 계산 |
| `library/profiles/` | 대상별 프로필 원고 |

브라우저 조작은 공용 `browser-driver`를 쓰고 이 스킬이 드라이버를 따로 만들지 않는다.
`agent_usage.py`의 모델 단가표는 그 스크립트 안에 있다. 모델이 바뀌면 그곳을 고친다.
