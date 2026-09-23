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

### 워크스페이스 디렉터리

```text
career-os/
├── .claude/skills/       사용자 작업별 skill
├── .codex/skills/        Codex에서 같은 skill을 노출하는 링크
├── config/               사람이 관리하는 수집 정책
├── scripts/              검증, 수집과 변환 코드
├── services/             추천 상태 HTTP Backend와 migration. 루트와 별도 package다
├── applications/         동기화되는 로컬 지원 패키지
├── library/              사람이 직접 관리하며 여러 지원에서 재사용하는 비공개 자료
├── state/                검증기와 도구가 다음 실행에 재사용하는 상태
├── public/               공개 가능한 질문 은행
├── cache/                다시 만들 수 있는 수집 결과
├── sources/fos-study/    별도 저장소에서 관리하는 공개 학습·이력 자료
└── docs/                 제품, 흐름, 데이터, 기술 결정 문서
```

### 스킬 폴더

`.claude/skills/<name>/` 안의 자리가 정해져 있다.

| 자리 | 담는 것 |
| --- | --- |
| `SKILL.md` | 목표와 워크플로. 에이전트가 언제나 읽는다 |
| `references/` | 필요한 단계에서만 읽는 판정 기준과 대상별 절차 |
| `scripts/` | 이 스킬만 쓰는 실행 코드 |
| `templates/` | HTML 골격, CSS 와 이미지 |

**`SKILL.md` 에 모든 것을 적지 않는다.**
언제나 읽어야 하는 것만 남기고, 특정 단계에서만 필요한 것은 `references/` 로 내린다.
`SKILL.md` 가 그 파일을 언제 읽는지 적는다.

**판정 기준을 산문으로 반복하지 않는다.** 한 파일이 소유하고 나머지는 그것을 가리킨다.

현재 구성이다. 비어 있는 자리는 그 스킬에 필요가 없어서다.

| 스킬 | `references/` | `scripts/` | `templates/` |
| --- | --- | --- | --- |
| `application-package-writer` | 6 | 11 | 2 |
| `interview-practice` | 3 | | |
| `position-recommender` | 2 | | |
| `resume-preparer` | 7 | 21 | 4 |
| `study-topic-recommender` | 2 | | |
| `sync-profile` | 3 | 4 | |

### 실행 코드를 두 자리 중 어디에 두나

같은 TypeScript 인데 스킬 번들 안과 `scripts/` 둘로 나뉜다.

| 자리 | 언제 | 예 |
| --- | --- | --- |
| `.claude/skills/<name>/scripts/` | 그 스킬 밖에서 쓰지 않는 코드 | 이력서 PDF 변환, 원티드 폼 조작 |
| `scripts/<name>/` | 여러 진입점이 나뉘고 독립 테스트가 큰 코드 | 공고 수집, 읽을거리 수집 |
| `scripts/lib/` | 두 워크스페이스 이상이 쓰는 순수 기능 | CLI, 텍스트 정규화, 날짜 변환 |

테스트는 코드 옆에 둔다. `<이름>.test.ts` 로 같은 디렉터리에 둔다.

### 데이터 폴더

사람이 고치는 곳과 도구가 쓰는 곳을 나눈다.

| 폴더 | 누가 쓰나 | 동기화 |
| --- | --- | --- |
| `config/` | 사람이 직접 고치고 커밋한다 | Git |
| `applications/<company>/<position>/` | 스킬이 만들고 사람이 읽는다 | 비공개 release |
| `library/` | 사람이 직접 관리한다 | 비공개 release |
| `state/` | 도구가 쓰고 도구가 읽는다 | 비공개 release |
| `public/question-bank/` | 스킬이 만들고 공개한다 | Git |
| `cache/` | 도구가 다시 만들 수 있다 | 안 함 |
| 시스템 임시 디렉터리 | 게시용 HTML 과 실행별 중간 데이터. 검증 뒤 지운다 | 안 함 |

현재 경력과 역할 선호와 경험 경계는 이 저장소에 두지 않는다. private brain 이 소유한다.

### 스킬과 실행 코드

`SKILL.md` 는 입력, 실행 순서, 산출물, 검증, 안전 경계를 설명한다.
반복되는 수집, 파싱, 렌더링과 검증은 TypeScript 로 구현한다.

하나의 스크립트가 수집과 추천과 렌더링을 모두 책임지지 않는다.
외부 응답은 경계에서 검증한 뒤 내부 타입으로 바꾼다.
구조화 데이터 검증에는 zod 를 쓰고, 표시 문자열은 렌더러에서만 만든다.

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

release 파일은 홈서버 `career-os` bucket 과 각 환경의 `career-os/.career-sync/` 에 놓인다.
각 파일의 형식은 [`data-schema.md`](data-schema.md#홈서버-release)가 소유한다.

```text
career-os bucket
├── releases/<revision>/
│   ├── workspace.tar             세 관리 root 의 archive
│   ├── workspace-manifest.json   archive 에 든 파일 목록과 hash
│   └── release.json              release 하나의 식별과 요약
└── pointers/
    └── current.json              지금 기준이 되는 release

career-os/.career-sync/
├── sync-state.json               마지막으로 준비한 release
├── skill-session.json            진행 중인 skill 실행
└── prepare-journal.json          준비 단계의 복구 기록
```

각 환경은 `applications`, `library`와 `state`를 일반 로컬 디렉터리로 사용한다.
원격 파일을 network filesystem으로 직접 편집하지 않으며, 준비 단계는 검증한 release만 임시 경로에서 로컬로 교체한다.
반영 단계는 실행 시작 revision이 홈서버 현재 값과 일치할 때만 새 release를 만든다.

`.claude/skills/`가 skill 관리 원본이다.
`.codex/skills/`는 같은 디렉터리를 가리키며 Hermes cron은 `career-os`를 작업 디렉터리로 사용한다.
환경별 차이는 `.env`의 transport 설정에만 두고 지원 판단과 문서 작성 절차를 복제하지 않는다.
SSH client는 `career-storage`를 원격 호출하고, 홈서버의 Hermes는 같은 명령을 command transport로 호출한다.
두 경로는 같은 홈서버 잠금과 S3 pointer 갱신 계약을 사용한다.

### 추천 상태 Backend

`services/recommendation-api/`는 포지션의 장기 상태를 제공하는 Backend다.
Node 22 위의 NestJS로 돌고 Prisma로 MySQL을 읽고 쓴다.
모노레포 루트와 별도의 `package.json`과 `tsconfig.json`을 가진 독립 package다.
결정과 근거는 [ADR-121](adr/ADR-121-추천-backend는-nestjs와-prisma로-운영한다.md)과
[ADR-122](adr/ADR-122-추천-상태는-질의-단위로-읽고-쓴다.md)에 있다.

서비스 코드, HTTP 계약과 migration은 `career-os`가 소유한다.
배포 설정, database와 계정 생성, network와 backup은 홈서버 인프라 저장소가 소유한다.
학습자료 API는 client 만 구현했고 mock HTTP 로 검증했다. 서버는 구현하지 않았다.


| 경로                                                     | 책임                                                    |
| ------------------------------------------------------ | ----------------------------------------------------- |
| `services/recommendation-api/src/main.ts`              | 프로세스 시간대 고정, `API_HOST`와 `API_PORT`로 listen           |
| `services/recommendation-api/src/app.module.ts`        | module 조립과 전역 filter·interceptor 등록                   |
| `services/recommendation-api/src/config/`              | 환경값 읽기와 기동 전 검증                                       |
| `services/recommendation-api/src/common/`              | 인증, 요청 ID, 본문 크기, zod 검증, 멱등 처리, 오류 응답 형식             |
| `services/recommendation-api/src/positions/`           | 회사 정책, 공고 버전, 분석 상태와 추천 조립                            |
| `services/recommendation-api/src/positions/repository/`| Prisma 질의. 도메인이 요구하는 단위로만 읽고 쓴다                       |
| `services/recommendation-api/src/health/`              | 생존 확인과 준비 확인                                          |
| `services/recommendation-api/src/prisma/`              | `PrismaClient` 수명과 연결 설정                              |
| `services/recommendation-api/src/contracts/`           | `scripts/`가 소유한 공고 후보 계약의 사본                          |
| `services/recommendation-api/prisma/schema.prisma`     | model 정의. `prisma db pull`이 만든다                       |
| `services/recommendation-api/prisma/migrations/`       | 순서가 있는 migration과 적용 기록                               |


**`src/contracts/posting-candidate.ts`는 사본이다.**
원본은 `scripts/position-recommender/live-postings/contracts.ts`이고 소유자는 그쪽이다.
서비스가 독립 package가 되어 자기 디렉터리 밖을 import할 수 없어 통째로 복사했다.
원본과 어긋나지 않는지는 사본 옆의 대조 테스트가 기본 `npm test`에서 확인한다.
원본을 고친 뒤 다시 복사한다. 사본을 직접 고치지 않는다.

**`test/fixtures/legacy-contract/`는 전환 전 구현이 낸 응답을 뽑아 둔 기록이다.**
case 34개가 요청 전문과 응답 전문과 쓰기 뒤의 DB 행을 담는다.
e2e 검사가 이 값과 대조해 전환이 계약을 바꾸지 않았는지 판정한다.
값이 다르면 새 구현이 계약을 어긴 것이므로 이 파일을 고쳐 통과시키지 않는다.

Backend는 local 개발에서는 `CAREER_RECOMMENDATION_DATABASE_URL`을 읽을 수 있고,
운영에서는 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`과 `DB_PASSWORD`를 읽는다.
두 형식을 함께 주면 시작 전에 실패한다.
client는 `CAREER_RECOMMENDATION_API_URL`과 `CAREER_RECOMMENDATION_API_TOKEN` 또는
`CAREER_RECOMMENDATION_API_TOKEN_FILE`만 읽으며 DB 자격증명을 받지 않는다.
`STUDY_LIBRARY_URL`과 `STUDY_SERVICE_TOKEN`은 study client 전환 동안 같은 Backend를 가리키는 호환 환경값으로 유지한다.

**프로세스 시간대를 UTC에 고정한다.** 시각 컬럼이 모두 `DATETIME(3)`이라 시간대를 저장하지 않으므로,
프로세스가 다른 시간대면 다시 읽은 시각이 어긋나고 임차권 판정이 뒤집힌다.
`src/main.ts`와 Prisma adapter 연결 옵션과 `vitest.config.ts` 셋이 함께 고정한다.

endpoint 별 동작, 상태 코드와 transaction 경계는
[`flow.md`](flow.md#추천-상태-backend)가 소유한다.

**쓰기 안전은 DB 행 잠금이 맡는다.** 쓰기 transaction이 자기 실행 행을 먼저 잠그고
격리 수준을 `READ COMMITTED`로 둔다. 상태 전체를 메모리에 들고 쓰던 구조가 아니므로
인스턴스를 하나로 제한할 이유는 저장 계층에서 나오지 않는다.
실제로 몇 개를 띄울지는 배포 결정이고 홈서버 인프라 저장소가 소유한다.

**이 서비스는 루트 타입 검사에 들어가지 않는다.** 루트 `tsconfig.json`의 `include`에서 빠져 있다.
남겨 두면 루트 검사가 `verbatimModuleSyntax: true`인 설정으로 NestJS 파일까지 검사해
의존성 주입에 필요한 type import를 지운다.

그래서 이 서비스는 자기 package 안에서 검증한다.

```bash
# cwd: career-os/services/recommendation-api
npm run typecheck
npm test
```

`npm test`는 실제 MySQL을 요구한다. 접속 문자열이 없으면 건너뛰지 않고 실패한다.
건너뛴 실행을 통과 근거로 쓰지 않기 위해서다.
루트 `bunx tsc --noEmit`은 `career-os/scripts/`가 import하는 서비스 파일만 끌어온다.

배포 절차와 cron 등록은 홈서버 인프라 저장소가 소유한다. `career-os` 에서 실행하지 않는다.

### 외부 경계

- `sources/fos-study/`는 별도 Git 저장소다.
- 채용 사이트와 기술 블로그는 읽기 전용 입력이다.
- `.env`는 Git에 커밋하지 않는다.

- 홈서버 주소, 계정과 저장 경로는 환경 설정에서만 주입하고 공개 문서나 결과 JSON에 기록하지 않는다.
- 비공개 작업 파일의 이전 release와 복구 경계는 홈서버 private 인프라가 소유한다.
- 외부 제출과 공개 게시에는 사용자 승인이 필요하다.

## application-package-writer

공고별 `applications/<company>/<position>/`는 세 층으로 나뉜다.
파일이 어느 층에 있는지가 누가 그 파일을 여는지를 정한다.

| 층              | 여는 주체    | 담는 것                                                    |
| --------------- | ------------ | ---------------------------------------------------------- |
| 디렉터리 최상위 | 사용자       | `application-package.html`과 현재 공고가 요구하는 제출 PDF |
| `evidence/`     | skill과 사람 | 기준 원본 Markdown과 구조화 입력                           |
| `review/`       | 검증기       | 근거 장부, 점수표, manifest와 제출 문서 HTML               |

### 최상위

- `application-package.html`: 기준 원본과 현재 제출 파일을 묶은 로컬 검토 화면
- `resume.pdf`: 이력서 제출본
- `career-description.pdf`: 경력기술서를 받는 공고에만 둔다
- `submission.pdf`: 한 파일 제출을 요구하는 공고에만 둔다

#### `evidence/`

- `posting.md`: 공고 원문이며 공식 페이지의 절 구조를 그대로 둔다. 쪼갠 항목 목록은 `fit.md` 의 적합도 표가 담는다
- `candidate-interview.md`: 후보자 원문 답변, 정리한 핵심과 제출 반영 여부
- `fit.md`: 결론, 공고 항목별 적합도 표, 구분별 가중치, 공개 자료로 확인한 팀과 인접 사례
- `strategy.md`: 승부처, 지원동기, 기여 시나리오, 보완할 공백, 회사 문화와의 연결, 면접에서 검증받을 내용이며 시장과 규모로 판단하는 「이 자리에서 얻을 경험과 성장」을 선택 절로 둔다
- `status.md`: 준비 상태 세 줄과 제출 준비 상태, 사용자 확인 필요, 다음 행동
- `resume-draft.md`: HTML과 PDF로 변환할 제출용 이력서 원본
- `interview-questions.json`: 공고 책임, 근거 방어와 경험 공백에서 만든 포지션별 질문
- `career-description-draft.md`: 경력기술서를 받는 공고에만 둔다
- `application-form.json`: 브라우저 자동 입력을 준비할 때만 둔다

**`interview-questions.json` 은 `application-package-writer` 가 만들고 소유한다.**
`resume-preparer` 와 `interview-practice` 는 질문을 더할 수 있으나 기존 질문을 지우거나 다시 쓰지 않는다.
세 스킬이 같은 파일에 쓰므로 소유자를 하나로 둔다.

앞의 다섯이 기본 원본이다.
`application-package-writer`는 지원 판단과 후보자 인터뷰를 관리하고, `resume-preparer`는 `resume-draft.md`와 제출 문서를 관리한다.
`application-form.json`은 private brain 공통 프로필의 현재 스냅샷, 회사별 선택값, 첨부 파일과 서술형 질문을 구조화한다.
서술형 문항이 없는 지원 건은 `questions`를 빈 배열로 둔다.

#### `review/`

- `resume.html`과 `career-description.html`: PDF를 만든 원본
- `claim-ledger.json`과 `career-description-claim-ledger.json`: 주장별 근거 장부
- `resume-scorecard.md`와 `career-description-scorecard.md`: 인사담당자와 실무담당자 리뷰 결과
- `submission-manifest.json`: 각 PDF의 파일 해시와 원본 HTML의 문구 해시를 연결한다

이 층의 파일은 사용자용 링크로 노출하지 않는다.
검증에는 사용하므로 현재 제출 문구와 PDF가 같은 버전인지 증명한다.

`.claude/skills/application-package-writer/templates/` 가 검토 화면의 HTML 골격과 CSS 를 소유한다.
화면 구성과 적합도 점수의 필드는 [`data-schema.md`](data-schema.md#application-package-writer)가 소유한다.

## interview-practice

질문은 공개 범위에 따라 세 자리로 나뉜다.

| 자리 | 담는 것 |
| --- | --- |
| `applications/<company>/<position>/evidence/interview-questions.json` | 공고에서 파생한 포지션별 질문 |
| `library/question-bank/` | 개인 경험에서 파생해 여러 지원에서 다시 쓰는 질문 |
| `public/question-bank/` | 공개 가능한 일반 질문 |
| `public/question-bank/sources.json` | 질문 출처의 공식 URL 과 확인일 |

**공개 산출물에 개인 질문과 포지션별 질문을 넣지 않는다.** 이 분리가 자리를 나눈 이유다.

현재 지원 대상은 private brain 에서 찾는다.
스킬이 회사와 역할을 `applications/<company>/<position>/` 경로로 해석해 스크립트에 넘긴다.
TypeScript 스크립트가 brain 을 직접 조회하지 않는다.

`scripts/interview-drill/`은 `interview-practice`의 기술·인성 모드에서 공통 진행과 복습 상태를 처리한다.
공고별 `evidence/interview-questions.json`을 명시하면 포지션 질문과 공통 기반 질문을 섞어 구성한다.
`follow-up-policy.ts`는 답변 수준에 따른 꼬리질문 축과 최대 깊이를 제공한다.
복습 상태는 `state/drill-progress.json` 하나에 저장한다.
후보풀과 리포트 중간 파일처럼 다시 만들 수 있는 실행 자료는 `state/`에 두지 않는다.

`config/interview-question-sources.ts`는 공식 문서, 기술 블로그, 공개 영상과 GitHub 가이드의 역할을 구분한다.
`scripts/interview-question-sources/`는 기존 읽을거리 수집 어댑터를 재사용해 실행별 후보풀을 만들고 설정과 후보 형식을 검증한다.

`public/question-bank/sources.json`은 공개 공통 질문이 참조하는 공식 URL과 확인일을 관리한다.
공개 질문 보강은 `interview-practice`의 필요할 때만 읽는 참고 문서가 안내한다.
`scripts/question-bank-collector/validate.ts`는 독립된 검증 모듈로 남아 질문 구조, 공개 범위, 출처 등록과 URL 형식을 검사한다.

## position-recommender

`scripts/position-recommender/` 루트에는 CLI 진입점만 둔다.
어느 진입점이 [`flow.md`](flow.md#position-recommender)의 어느 단계인지는 다음과 같다.

**일일 실행 경로는 `position_run.ts`의 하위 명령 넷이다.**
skill이 중간 파일 이름과 플래그를 알지 못하도록 모든 하위 명령이 `--run <RUN_DIR>` 하나만 받는다.

| 하위 명령 | 흐름의 단계 |
| --- | --- |
| `collect` | 공고 수집, 수집 실행 저장, 회사 큐 수신, 근거 수집과 저장 |
| `commit-company-tiers` | 축별 판정 반영과 분석 큐 생성 |
| `commit-analyses` | 큐에 든 공고의 분석 반영 |
| `finalize` | 추천 JSON과 HTML 생성과 검증 |

나머지 진입점은 일일 실행에 들어가지 않는다.

| 진입점 | 언제 쓰나 |
| --- | --- |
| `validate_recommendation.ts` | 추천 원문 대조 |
| `render_recommendation.ts`, `render_candidate_preview.ts` | 렌더 |
| `configure_position_analysis_policy.ts` | 분석 정책 설정 |
| `configure_position_company_preferences.ts` | 사람이 정한 회사 tier와 제외 설정 |
| `import_position_state.ts` | 파일에 있던 회사 조사와 제외 규칙을 DB로 옮기는 일회성 명령 |

디렉터리별 책임은 다음과 같다.

| 디렉터리 | 책임 |
| --- | --- |
| `live-postings/` | 외부 소스 어댑터와 수집 정책 |
| `recommendation/` | 추천 계약과 최종 답변 문구 |
| `company-evidence/` | 근거 수집기와 그 계약 |
| `feedback/` | 개인 제외 기준. 규칙은 Backend에서 읽는다 |
| `recommendation-api/` | Backend client. 큐 조회와 분석 반영 |
| `company-tier-analysis/` | 회사 tier 모델 평가의 요청과 응답 계약 |
| `render/` | HTML 생성과 검사 |

### 근거 수집기

근거 수집기는 `company-evidence/collectors/`에 소스마다 하나씩 둔다.
`live-postings/adapters/`와 같은 모양이다. 등록은 `collectors/index.ts`가 한다.

| 수집기 | 받는 것 | 인증 |
| --- | --- | --- |
| `dart.ts` | OpenDART 「직원 현황」과 재무정보 | 인증키가 필요하다 |
| `tech-blog.ts` | 회사 기술 블로그 RSS | 없다 |
| `github.ts` | GitHub organization의 저장소 | 없다 |
| `review.ts` | Blind 항목별 평점 | 없다 |
| `job-posting.ts` | 우리가 이미 모은 활성 공고 | 없다 |

**수집기 하나가 실패해도 다른 수집기는 계속한다.**
실패한 수집기가 채우던 축만 비고, 그 사실이 판정에 남는다.
`collectors/registry.ts`가 회사마다 어느 수집기를 돌릴지 정하고,
유효기간이 남은 근거는 다시 모으지 않는다.

회사별 기술 블로그 RSS 주소와 GitHub organization 이름은 `company_preferences`가 담는다.
수집기 코드에 회사 목록을 넣지 않는다.

### 수집 정책의 세 층

수집 정책은 세 층으로 나눈다.


| 층     | 위치                           | 책임                                       |
| ----- | ---------------------------- | ---------------------------------------- |
| 소스 경계 | `live-postings/adapters/`    | 소스 고유 API, 상태값과 상세 요청 전 사전 선별            |
| 공통 정책 | `live-postings/policy/`      | 목표 직무·고용형태 키워드, 분류와 마감 변환                |
| 최종 경계 | `live-postings/validator.ts` | 모든 소스의 URL, 상태, 마감, 고용형태와 역할을 같은 규칙으로 검사 |


**사전 필터와 최종 경계를 둘 다 둔다.** 사전 필터는 불필요한 상세 페이지 요청을 줄이고,
최종 경계는 adapter 누락이 모델 입력으로 번지는 것을 막는다.
공통 키워드를 adapter 에 복제하지 않는다.
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

실제 제출은 이 스킬의 책임이 아니다.

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

루트의 진입점은 `build_morning_reading.ts` 와 `validate_outputs.ts` 이고
`morning_reading_cli.ts` 가 플래그 분기를 담당한다.
후보풀, 선별, 누적 이력, 공부 주제 구성과 HTML 렌더링은 각각 분리된 모듈이 담당한다.
실행기는 시스템 임시 디렉터리 아래의 명시적인 실행 경로만 사용하며 저장소에 리포트 디렉터리를 만들지 않는다.
`runtime-paths.ts` 가 `CAREER_OS_ROOT` 와 `--run-dir` 를 함께 해석하고 `validate_outputs.ts` 도 같은 해석을 쓴다.
둘 다 주어졌는데 경로가 다르면 사용법 오류로 중단한다.

`config/external-reading-sources.ts` 가 소스 목록과 어댑터 종류를 소유한다.
archive 진입점은 이 파일에 복제하지 않고 sourceKey 별 registry 로 둔다.

### 두 모드의 경계

파일모드와 library 모드는 실행 진입점에서 나뉜다.
`study-library/` 는 MySQL 드라이버나 서버 저장 로직을 갖지 않는다.
schema 와 endpoint 정의는 `services/recommendation-api/` 가 소유한다.

두 모드가 무엇을 읽고 쓰는지는 [`flow.md`](flow.md#study-topic-recommender)가 소유한다.

library 모드가 읽는 환경값이다.

| 이름 | 의미 |
| --- | --- |
| `STUDY_LIBRARY_URL` | career-os API origin. HTTPS 이며 path, query, hash 와 credentials 가 없어야 한다 |
| `STUDY_SERVICE_TOKEN` | 서비스 인증 Bearer token. 브라우저 세션과 별개다 |
| `YOUTUBE_DATA_API_KEY` | 선택값. 있으면 YouTube uploads playlist 과거 수집을 쓴다 |

값이 없거나 origin 형식이 맞지 않으면 `--library` 실행은 시작 전에 실패한다.
브라우저 관리자 쿠키나 세션을 복제하지 않는다.

## sync-profile

**실행 코드를 `scripts/` 가 아니라 스킬 번들 안에 둔다.**
대상 사이트의 폼을 조작하는 코드라 다른 스킬이 재사용할 것이 없고,
대상별 절차 문서 바로 옆에 두는 편이 읽기 쉽다.

| 경로 | 책임 |
| --- | --- |
| `.claude/skills/sync-profile/references/wanted.md` | 원티드 폼 구조와 저장 확인 절차 |
| `.claude/skills/sync-profile/references/linkedin.md` | LinkedIn 편집 진입과 저장 확인 절차 |
| `.claude/skills/sync-profile/references/github.md` | GitHub 프로필 문서 규칙 |
| `.claude/skills/sync-profile/scripts/wanted_*.sh` | 원티드 폼 필드 조회와 입력 |
| `.claude/skills/sync-profile/scripts/agent_usage.py` | 에이전트 세션 기록에서 월별 토큰과 환산 비용 계산 |
| `library/profiles/wanted-profile.md` | 원티드 원고 |
| `library/profiles/linkedin-profile.md` | LinkedIn 원고 |
| `library/profiles/github-profile.md` | GitHub 원고 |
| `library/profiles/github-agent-usage.svg` | `agent_usage.py` 가 만든 이미지 |

브라우저 조작은 공용 `browser-driver`를 쓰고 이 스킬이 드라이버를 따로 만들지 않는다.
