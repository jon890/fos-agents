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
├── config/               사람이 관리하는 수집 정책
├── scripts/              검증, 수집과 변환 코드
├── plugin/               fos-assistant 에 연결하는 `fos-career` 커넥터. 루트와 별도 package다
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

`plugin/skills/<name>/` 안의 자리가 정해져 있다.

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

저장소에는 `.claude/skills/` 와 `.codex/skills/` 가 없다. 모든 스킬이 `plugin/` 에 있다.
스킬의 실행 코드는 `scripts/application-package/`, `scripts/resume-preparer/`, `scripts/position-recommender/`, `scripts/study-topic-recommender/` 에 있다.

### 실행 코드를 두 자리 중 어디에 두나

같은 TypeScript 인데 스킬 번들 안과 `scripts/` 둘로 나뉜다.

| 자리 | 언제 | 예 |
| --- | --- | --- |
| `scripts/<name>/` | 여러 진입점이 나뉘고 독립 테스트가 큰 코드. plugin 로컬 실행기가 번들하는 코드 | 공고 수집, 읽을거리 수집, 이력서 PDF 변환, 지원 패키지 검사와 렌더링 |
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

개인 맥락은 이 저장소에 두지 않는다.
현재 경력, 역할 선호, 경험 경계, 지원 상태와 학습 관심사는 커리어 Backend 의 후보자 맥락 문서가 소유한다.
연락처와 신원을 담은 지원서 공통 프로필은 fos-assistant Memory 가 소유한다. 아래 「지원서 공통 프로필」 절이 읽는 방법을 정한다.

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

skill 은 `plugin/` 이 소유하고 Hermes cron 은 plugin 스킬을 쓴다.
환경별 차이는 `.env`의 transport 설정에만 두고 지원 판단과 문서 작성 절차를 복제하지 않는다.
SSH client는 `career-storage`를 원격 호출하고, 홈서버의 Hermes는 같은 명령을 command transport로 호출한다.
두 경로는 같은 홈서버 잠금과 S3 pointer 갱신 계약을 사용한다.

### 커리어 Backend

`services/career-backend/`는 포지션 추천, 공부 추천, 회사 근거처럼 커리어 데이터의 장기 상태를 제공하는 Backend다.
Node 22 위의 NestJS로 돌고 Prisma로 MySQL을 읽고 쓴다.
DB 연결은 MySQL 인증 캐시가 비어도 전체 인증을 할 수 있도록 TLS를 쓴다.
Backend와 MySQL이 속한 같은 Docker network를 신뢰 경계로 본다.
MySQL container가 자체 서명 인증서를 사용하므로 서버 인증서의 CA 검증은 하지 않는다.
모노레포 루트와 별도의 `package.json`과 `tsconfig.json`을 가진 독립 package다.
결정과 근거는 [ADR-121](adr/ADR-121-추천-backend는-nestjs와-prisma로-운영한다.md)과
[ADR-122](adr/ADR-122-추천-상태는-질의-단위로-읽고-쓴다.md)에 있다.

서비스 코드, HTTP 계약과 migration은 `career-os`가 소유한다.
배포 설정, database와 계정 생성, network와 backup은 홈서버 인프라 저장소가 소유한다.
공부 소스, 수집 자료, 후보, 추천과 제외 판정은 `/api/study/v1` 에서 읽고 쓴다.
면접 연습의 주제별 복습 상태, 연습 기록과 개인 질문은 `/api/interview/v1` 에서 읽고 쓴다.
스킬이 판단에 쓰는 개인 맥락 문서는 `/api/candidate-context/v1` 에서 읽고 쓴다.
프로필 원고와 월별 에이전트 사용량 기록은 `/api/profile/v1` 에서 읽고 쓴다.


| 경로                                                     | 책임                                                    |
| ------------------------------------------------------ | ----------------------------------------------------- |
| `services/career-backend/src/main.ts`              | 프로세스 시간대 고정, `API_HOST`와 `API_PORT`로 listen           |
| `services/career-backend/src/app.module.ts`        | module 조립과 전역 filter·interceptor 등록                   |
| `services/career-backend/src/config/`              | 환경값 읽기와 기동 전 검증                                       |
| `services/career-backend/src/common/`              | 인증, 요청 ID, 본문 크기, zod 검증, 멱등 처리, 오류 응답 형식             |
| `services/career-backend/src/positions/`           | 회사 정책, 공고 버전, 분석 상태와 추천 조립. 분석 기준 버전은 수집 저장 때 `src/candidate-context/` 가 내보낸 조회로 `position-preferences` 문서를 읽어 계산하고, 공고 분석 실행은 회사 tier 실행에 적힌 값을 이어 쓴다 |
| `services/career-backend/src/positions/repository/`| Prisma 질의. 도메인이 요구하는 단위로만 읽고 쓴다                       |
| `services/career-backend/src/study/`               | 공부 소스, 수집 자료, cursor, 후보와 추천 판정                         |
| `services/career-backend/src/interview/`           | 주제별 복습 상태, 연습 기록, 개인 질문과 복습일 규칙                        |
| `services/career-backend/src/candidate-context/`   | 후보자 맥락 문서와 그 이력. 다른 module 에 문서 조회를 내보낸다               |
| `services/career-backend/src/profile/`             | 프로필 원고와 그 이력, 월별 에이전트 사용량 기록과 처음 값을 지키는 규칙        |
| `services/career-backend/src/health/`              | 생존 확인과 준비 확인                                          |
| `services/career-backend/src/prisma/`              | `PrismaClient` 수명과 연결 설정                              |
| `services/career-backend/src/contracts/`           | `scripts/`가 소유한 공고 후보 계약의 사본                          |
| `services/career-backend/prisma/schema.prisma`     | model 정의. `prisma db pull`이 만든다                       |
| `services/career-backend/prisma/migrations/`       | 순서가 있는 migration과 적용 기록                               |


**`src/contracts/posting-candidate.ts`는 사본이다.**
원본은 `scripts/position-recommender/live-postings/contracts.ts`이고 소유자는 그쪽이다.
서비스가 독립 package가 되어 자기 디렉터리 밖을 import할 수 없어 통째로 복사했다.
원본과 어긋나지 않는지는 사본 옆의 대조 테스트가 기본 `npm test`에서 확인한다.
원본을 고친 뒤 다시 복사한다. 사본을 직접 고치지 않는다.

**`test/fixtures/legacy-contract/`는 전환 전 구현이 낸 응답을 뽑아 둔 기록이다.**
case 34개가 요청 전문과 응답 전문과 쓰기 뒤의 DB 행을 담는다.
e2e 검사가 이 값과 대조해 전환이 계약을 바꾸지 않았는지 판정한다.
값이 다르면 새 구현이 계약을 어긴 것이므로 이 파일을 고쳐 통과시키지 않는다.

Backend는 local 개발에서는 `CAREER_BACKEND_DATABASE_URL`을 읽을 수 있고,
운영에서는 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`과 `DB_PASSWORD`를 읽는다.
두 형식을 함께 주면 시작 전에 실패한다.
client는 `CAREER_BACKEND_URL`과 `CAREER_BACKEND_TOKEN` 또는
`CAREER_BACKEND_TOKEN_FILE`, 선택값인 Cloudflare Access service token 을 읽으며 DB 자격증명을 받지 않는다.
공부 추천과 포지션 client 는 `scripts/lib/career-backend-config.ts` 로 같은 연결값을 검증한다.
포지션과 공부 추천 client 는 `scripts/lib/career-backend-http.ts` 에 HTTP 요청, 인증 헤더, 재시도, timeout 과 오류 응답 해석을 맡긴다.
Cloudflare Access 헤더 `CF-Access-Client-Id`, `CF-Access-Client-Secret` 은 `scripts/lib/access-credentials.ts` 가 환경값에서 만들고 같은 HTTP 계층, 공부 추천 `doctor.ts` 와 지원서 공통 프로필 client 가 붙인다.
멱등 키를 만드는 방법은 이미 저장된 키와 맞아야 하므로 각 client 가 지금 방식을 유지한다.

**프로세스 시간대를 UTC에 고정한다.** 시각 컬럼이 모두 `DATETIME(3)`이라 시간대를 저장하지 않으므로,
프로세스가 다른 시간대면 다시 읽은 시각이 어긋나고 임차권 판정이 뒤집힌다.
`src/main.ts`와 Prisma adapter 연결 옵션과 `vitest.config.ts` 셋이 함께 고정한다.

endpoint 별 동작, 상태 코드와 transaction 경계는
[`flow.md`](flow.md#커리어-backend)가 소유한다.

**쓰기 안전은 DB 행 잠금이 맡는다.** 쓰기 transaction이 자기 실행 행을 먼저 잠그고
격리 수준을 `READ COMMITTED`로 둔다. 상태 전체를 메모리에 들고 쓰던 구조가 아니므로
인스턴스를 하나로 제한할 이유는 저장 계층에서 나오지 않는다.
실제로 몇 개를 띄울지는 배포 결정이고 홈서버 인프라 저장소가 소유한다.

**이 서비스는 루트 타입 검사에 들어가지 않는다.** 루트 `tsconfig.json`의 `include`에서 빠져 있다.
남겨 두면 루트 검사가 `verbatimModuleSyntax: true`인 설정으로 NestJS 파일까지 검사해
의존성 주입에 필요한 type import를 지운다.

그래서 이 서비스는 자기 package 안에서 검증한다.

```bash
# cwd: career-os/services/career-backend
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
`application-form.json`은 fos-assistant Memory 에서 읽은 공통 프로필의 현재 스냅샷, 회사별 선택값, 첨부 파일과 서술형 질문을 구조화한다.
`profileSource` 는 `fos-assistant-memory:identity/career-application-profile` 로 쓴다.
이전에 만든 스냅샷을 다시 검증할 수 있게 schema 는 옛 값 `private-brain:career-application-profile` 도 받는다. 새로 쓰지 않는다.
서술형 문항이 없는 지원 건은 `questions`를 빈 배열로 둔다.

#### `review/`

- `resume.html`과 `career-description.html`: PDF를 만든 원본
- `claim-ledger.json`과 `career-description-claim-ledger.json`: 주장별 근거 장부
- `resume-scorecard.md`와 `career-description-scorecard.md`: 인사담당자와 실무담당자 리뷰 결과
- `submission-manifest.json`: 각 PDF의 파일 해시와 원본 HTML의 문구 해시를 연결한다

이 층의 파일은 사용자용 링크로 노출하지 않는다.
검증에는 사용하므로 현재 제출 문구와 PDF가 같은 버전인지 증명한다.

`scripts/application-package/templates/` 가 검토 화면의 HTML 골격과 CSS 를 소유한다. `render_application_package.ts` 가 텍스트 import 로 읽는다.
실행 코드는 `scripts/application-package/` 에 있고 plugin 로컬 실행기 `package` 가 이 코드를 부른다.
화면 구성과 적합도 점수의 필드는 [`data-schema.md`](data-schema.md#application-package-writer)가 소유한다.

## interview-practice

면접 연습 스킬은 저장소에 없고 plugin 에 있다.
MCP 도구만으로 하는 연습은 `plugin/connector-skills/interview-practice/` 가, 공고별 질문으로 하는 연습과 외부 자료에서 질문을 찾는 일은 Claude Code 전용 `plugin/skills/interview-question-prep/` 가 맡는다.
배치는 아래 「fos-career 커넥터」 절이 소유한다.

질문은 공개 범위에 따라 세 자리로 나뉜다.

| 자리 | 담는 것 |
| --- | --- |
| `applications/<company>/<position>/evidence/interview-questions.json` | 공고에서 파생한 포지션별 질문 |
| `CAREER_STORE` 로 고른 저장소 | 개인 경험에서 파생해 여러 지원에서 다시 쓰는 질문 |
| `public/question-bank/` | 공개 가능한 일반 질문 |
| `public/question-bank/sources.json` | 질문 출처의 공식 URL 과 확인일 |

**공개 산출물에 개인 질문과 포지션별 질문을 넣지 않는다.** 이 분리가 자리를 나눈 이유다.

현재 지원 대상과 경력 수준, 경험 경계는 `CAREER_MEMORY` 로 고른 memory 공급자에서 읽는다.
계약과 공급자는 [ADR-130](adr/ADR-130-면접-연습의-후보자-맥락은-memory-공급자-경계로-읽는다.md)과 `data-schema.md` 의 「후보자 맥락」 절이 정한다.
`backend` 공급자일 때 스크립트는 `scripts/candidate-context/client.ts` 로 문서 본문을 읽어 채울 칸 목록과 함께 낸다. 칸은 모델이 채운다.

`scripts/interview-drill/`은 질문 선별과 연습 기록을 처리한다. 커넥터와 로컬 실행기가 이 코드를 번들해 쓰고, 저장소의 `drill-engine.ts` CLI 도 같은 코드다.
공고별 `evidence/interview-questions.json`을 명시하면 포지션 질문과 공통 기반 질문을 섞어 구성한다.
`follow-up-policy.ts`는 답변 수준에 따른 꼬리질문 축과 최대 깊이를 제공한다.
`question-selection.ts` 는 질문 묶음과 복습 상태, 오늘 날짜를 받아 낼 질문을 고르는 순수 함수다. `drill-engine.ts` 가 파일과 저장소에서 읽은 값을 넘기고, fos-career 커넥터도 같은 함수를 번들해 쓴다.
`public-question-bank.ts` 는 공개 질문 은행 JSON 을 정적 import 로 읽어 tech 와 behavioral 묶음으로 낸다. `drill-engine.ts`, 커넥터와 로컬 실행기가 같은 모듈을 쓴다. 실행 파일 위치로 은행 경로를 찾지 않으므로 번들한 실행기에서도 질문이 빠지지 않는다.

주제별 복습 상태, 연습 기록과 개인 질문은 `scripts/interview-drill/store/` 의 저장소 interface 뒤에 있다.
결정과 근거는 [ADR-129](adr/ADR-129-면접-연습-기록과-개인-질문은-backend가-소유한다.md)에 있다.

| 경로 | 책임 |
| --- | --- |
| `scripts/interview-drill/store/port.ts` | `InterviewPracticeStore` interface. 복습 상태 조회, 연습 기록, 개인 질문 조회와 저장 |
| `scripts/interview-drill/store/backend-store.ts` | `/api/interview/v1` 를 부르는 구현 |
| `scripts/interview-drill/store/file-store.ts` | `CAREER_STORE_DIR` 의 파일을 읽고 쓰는 구현 |
| `scripts/interview-drill/store/index.ts` | `CAREER_STORE` 로 구현 하나를 고른다. 값이 없으면 실패한다 |
| `scripts/interview-drill/memory.ts` | `CAREER_MEMORY` 에 따라 후보자 맥락을 검사해 내거나 채울 칸 목록을 낸다 |
| `scripts/interview-drill/templates/candidate-memory.example.json` | `CAREER_MEMORY=file` 로 쓸 후보자 맥락 파일의 템플릿 |
| `services/career-backend/src/interview/review-schedule.ts` | 복습일 규칙. Backend 와 파일 구현이 함께 import 한다 |

| 명령 | 책임 |
| --- | --- |
| `drill-engine.ts select <tech\|behavioral> [--application-dir] [--target-bar] [--count]` | 복습 상태와 개인 질문을 읽어 오늘 질문을 JSON 으로 낸다 |
| `drill-engine.ts record --attempt-id ...` | 연습 한 번을 기록하고 갱신된 주제 복습 상태를 JSON 으로 낸다 |
| `drill-engine.ts personal add --file <json\|jsonl>` | 개인 질문을 더하거나 같은 `id` 를 덮어쓴다 |
| `drill-engine.ts personal disable --question-id <id>` | 개인 질문을 끈다 |
| `drill-engine.ts memory` | 후보자 맥락을 JSON 으로 낸다. `backend` 면 문서 본문과 채울 칸 목록을 낸다 |
| `drill-engine.ts doctor` | `CAREER_STORE`, `CAREER_MEMORY` 와 그에 필요한 연결값, 파일 경로를 점검하고 빠진 것을 알려 준다 |

Backend 구현의 HTTP 호출은 `scripts/interview-drill/career-backend/client.ts` 가 맡는다.
연결값은 공부 추천, 포지션 client 와 같이 `scripts/lib/career-backend-config.ts` 로 검증한다.
`backend` 를 고른 실행이 Backend 에 닿지 못하면 명령은 종료 코드 1 로 끝나고 파일 구현으로 바꾸지 않는다.

후보풀과 리포트 중간 파일처럼 다시 만들 수 있는 실행 자료는 `state/`에 두지 않는다.

`config/interview-question-sources.ts`는 공식 문서, 기술 블로그, 공개 영상과 GitHub 가이드의 역할을 구분한다.
`scripts/interview-question-sources/`는 기존 읽을거리 수집 어댑터를 재사용해 실행별 후보풀을 만들고 설정과 후보 형식을 검증한다.

`public/question-bank/sources.json`은 공개 공통 질문이 참조하는 공식 URL과 확인일을 관리한다.
**공개 질문 보강은 저장소 유지 절차다.** 절차는 [`public/question-bank/MAINTENANCE.md`](../public/question-bank/MAINTENANCE.md) 가 소유한다.
plugin 을 설치한 사람은 이 저장소에 커밋하지 않는다. 그래서 plugin 스킬은 외부 자료에서 찾은 질문을 공개 은행에 넣지 않고 개인 질문으로 Backend 에 저장한다.
외부 자료 후보 수집과 질문 승격 기준은 `plugin/skills/interview-question-prep/references/source-discovery.md` 가 소유하고 유지 절차도 그 문서를 가리킨다.
`scripts/question-bank-collector/validate.ts`는 독립된 검증 모듈로 남아 질문 구조, 공개 범위, 출처 등록과 URL 형식을 검사한다.

## position-recommender

`scripts/position-recommender/` 루트에는 CLI 진입점과 일일 실행 파일 계약 helper인 `run-dir.ts`를 둔다.
어느 진입점이 [`flow.md`](flow.md#position-recommender)의 어느 단계인지는 다음과 같다.

**일일 실행 경로는 `position_run.ts`의 하위 명령 다섯 개다.**
skill이 중간 파일 이름과 플래그를 알지 못하도록 모든 하위 명령이 `--run <RUN_DIR>` 하나만 받는다.
`run-dir.ts`는 일일 실행 파일 이름과 모델이 채울 결과 파일의 틀을 관리하고, 정리할 임시 실행 경로를 검증한다.

| 하위 명령 | 흐름의 단계 |
| --- | --- |
| `collect` | 수집 전 후보자 맥락 문서 확인과 `candidate-context.json` 기록, 공고 수집, 수집 실행 저장, 회사 큐 수신, 근거 수집과 저장 |
| `commit-company-tiers` | 축별 판정 반영과 분석 큐 생성 |
| `commit-analyses` | 큐에 든 공고의 분석 반영 |
| `finalize` | 추천 JSON과 HTML 생성과 검증 |
| `cleanup` | 검증과 전달이 끝난 임시 실행 디렉터리 정리 |

나머지 진입점은 일일 실행에 들어가지 않는다.

| 진입점 | 언제 쓰나 |
| --- | --- |
| `configure_position_analysis_policy.ts` | 분석 정책 설정 |
| `configure_position_company_preferences.ts` | 사람이 정한 회사 tier와 제외 설정 |

plugin 의 로컬 실행기 `position` 은 `runPositionCommand` 에 하위 명령을 그대로 넘긴다. 일일 실행 경로만 열고 설정 진입점은 열지 않는다.
`render/assets.ts` 는 리포트 템플릿을 텍스트 import 로 읽는다. 실행 파일 위치로 템플릿을 찾지 않으므로 번들한 실행기에서도 같은 HTML 이 나온다.

디렉터리별 책임은 다음과 같다.

| 디렉터리 | 책임 |
| --- | --- |
| `live-postings/` | 외부 소스 어댑터와 수집 정책 |
| `recommendation/` | 추천 계약과 최종 답변 문구 |
| `company-evidence/` | 근거 수집기와 그 계약 |
| `feedback/` | 개인 제외 기준. 규칙은 Backend에서 읽는다 |
| `career-backend/` | Backend client. 큐 조회와 분석 반영 |
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

회사별 기술 블로그 RSS 주소와 GitHub organization 이름,
DART 고유번호와 Blind 경로는 `company_preferences`가 담는다.
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
| 대체 렌더의 색상                | [report.css](../scripts/position-recommender/render/templates/report.css) |
| 상세 화면의 데이터 변환         | [recommendation-html.ts](../scripts/position-recommender/render/recommendation-html.ts)의 `renderRecommendationHtml(run, assets, generatedAt)`                                                                                                      |
| 템플릿 읽기                   | [assets.ts](../scripts/position-recommender/render/assets.ts) |
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

실행 코드는 `scripts/resume-preparer/` 에 있다. plugin 로컬 실행기 `resume` 이 이 코드를 부른다.
`scripts/resume-preparer/verified-claims/`는 검증 완료 주장 스키마, 안정적인 주장 키, 근거 파일 해시, 저장과 검색을 책임별 모듈로 나눈다.
검증 완료 주장 CLI 는 다음 셋이다.


| CLI                                                  | 책임                                               |
| ---------------------------------------------------- | ------------------------------------------------ |
| `search_verified_claims.ts <query>`                  | 문구와 근거 설명을 검색해 관련 주장, 근거 경로와 locator를 점수순으로 출력한다 |
| `assess_claim_reuse.ts <application-directory>`      | 현재 제출 문서에서 그대로 쓸 수 있는 판정과 다시 읽을 근거를 나눈다          |
| `promote_verified_claims.ts <application-directory>` | 검증을 통과한 현재 공고별 원장을 검증 장부에 원자적으로 합친다              |


검색과 판정 CLI는 상태 파일을 바꾸지 않는다.
반영 CLI는 `schemaVersion: 3`, 모든 주장 `safe`, 현재 HTML 문구 해시 일치를 다시 검사한 뒤에만 쓴다.
같은 원장을 다시 반영하면 파일 내용과 수정 시각을 바꾸지 않는다.

실제 제출은 이 스킬의 책임이 아니다.

이력서 작성 취향은 `plugin/skills/resume-preparer/references/resume-taste.md`가 소유한다.
조회 시점과 저장 분기는 같은 스킬의 `references/candidate-context.md`에 두고 필요한 단계에서 읽는다.
스킬은 개인 맥락을 `get_context_document` 로 읽고, 승인받은 새 개인 사실을 `save_context_document` 로 저장한다.

현재 경력, 역할 선호와 경험 경계의 기준 원본은 후보자 맥락 문서 `career-status` 와 `position-preferences` 다.
skill은 필요한 정보를 실행 시점에 조회하고 TypeScript 스크립트에 명시적인 입력으로 전달한다.
세부 성과는 공개 가능한 `sources/fos-study/`와 실제 작업 저장소에서 다시 확인한다.

공개 가능한 이력 자료는 별도 `sources/fos-study/` 저장소에서 관리한다.

| 경로 | 책임 |
| --- | --- |
| `plugin/skills/resume-preparer/references/resume-writing-style.md` | 모든 이력서와 경력기술서에 적용하는 표현과 근거 범위 기준 |
| `plugin/skills/resume-preparer/references/resume-design.md` | 이력서와 경력기술서의 기본 시각 기준 |
| `plugin/skills/resume-preparer/references/resume-taste.md` | 개인 작성 취향 |
| `plugin/skills/resume-preparer/references/candidate-context.md` | 개인 맥락 조회 시점과 저장 분기 |
| `scripts/resume-preparer/templates/` | 이력서 HTML 골격과 기본 CSS. `export_resume.ts` 가 텍스트 import 로 읽는다 |
| 작업본 `library/resume-logos/` | 회사·학교 로고와 이름을 잇는 `index.json`. 개인 경력을 드러내므로 저장소와 plugin 에 두지 않는다 |

`export_resume.ts --logo-dir <dir>` 로 로고 디렉터리를 정한다. 없으면 `CAREER_WORKSPACE_ROOT`(없으면 `career-os`) 아래 `library/resume-logos/` 다. 디렉터리나 `index.json` 이 없으면 로고 없이 렌더한다.

plugin 의 로컬 실행기 `resume` 은 하위 명령으로 위 CLI 와 HTML·PDF 변환, 제출 묶음 검사를 고른다.
검증 완료 주장의 상태 디렉터리는 작업본 아래 `state/verified-claims/` 로 넘긴다. 주장 원장의 근거 경로는 실행한 디렉터리 기준이다.
지원 패키지 검사와 검토 화면은 로컬 실행기 `package` 가 한다. 아래 「로컬 실행기」 표가 책임을 정한다.

공고별 스타일은 `export_resume.ts --design <path>`에 CSS 파일이나
`css` 코드 블록이 있는 Markdown 파일을 명시한다.

## study-topic-recommender

`scripts/study-topic-recommender/` 의 디렉터리 책임이다.

| 경로 | 책임 |
| --- | --- |
| `source/` | 글과 영상 피드 수집 경계. 원문 발견과 메타 추출만 한다 |
| `source/archive/` | sitemap 과 YouTube uploads playlist 같은 과거 수집 cursor 해석 |
| `study-library/` | 학습자료 API client. fetch, 인증 헤더, 응답 검증과 후보풀 타입 변환 |
| `render/` | 주제 중심 HTML 생성 |

루트의 진입점이다.

| 진입점 | 언제 쓰나 |
| --- | --- |
| `morning_reading_cli.ts` | 일일 실행. `--doctor` 로 연결값, 인증과 `learning-interests` 문서를 먼저 확인한다. 수집, 후보 조회, 선택 검증, 추천 저장, `--cleanup`으로 임시 실행 디렉터리 정리, `--help`와 `-h`로 사용법 출력 |
| `build_morning_reading.ts`, `validate_outputs.ts` | HTML 생성과 산출물 검증 |
| `manage_reading_sources.ts` | 사람이 소스를 조회하고 더하고 고치고 끈다. `help`와 `template`는 API 연결 없이 사용법과 요청 초안을 보여준다 |

후보풀, 선별, 공부 주제 구성과 HTML 렌더링은 각각 분리된 모듈이 담당한다.
실행기는 시스템 임시 디렉터리 아래의 명시적인 실행 경로만 사용하며 저장소에 리포트 디렉터리를 만들지 않는다.
`runtime-paths.ts` 가 `CAREER_OS_ROOT` 와 `--run-dir` 를 함께 해석하고 `validate_outputs.ts` 도 같은 해석을 쓴다.
정리 명령에 필요한 직접 자식 경로, 접두사와 symlink 검증도 `runtime-paths.ts`에서 수행한다.
둘 다 주어졌는데 경로가 다르면 사용법 오류로 중단한다.

archive 진입점은 소스 필드에 복제하지 않고 `sourceKey` 별 registry 인 `source/archive/registry.ts` 로 둔다.

### Backend 경계

`study-library/` 는 MySQL 드라이버나 서버 저장 로직을 갖지 않는다.
schema 와 endpoint 는 `services/career-backend/src/study/` 가 소유한다.
포지션 쪽 `src/positions/` 와 같은 배치다.

| 경로 | 책임 |
| --- | --- |
| `src/study/study.controller.ts` | `/api/study/v1` 경로 |
| `src/study/schema.ts` | 요청과 응답의 zod 계약 |
| `src/study/study.service.ts` | 후보 거르기, 추천 저장 검증. 기준 버전을 `learning-interests` 문서 버전에서 계산한다 |
| `src/study/repository/study.repository.ts` | table 읽기와 쓰기 |

client 가 읽는 환경값은 포지션 추천과 같다. 같은 Backend 이고 같은 token 이다.

| 이름 | 의미 |
| --- | --- |
| `CAREER_BACKEND_URL` | 커리어 Backend origin |
| `CAREER_BACKEND_TOKEN` 또는 `CAREER_BACKEND_TOKEN_FILE` | Bearer token. 파일은 mode 600 |
| `CAREER_BACKEND_ACCESS_CLIENT_ID` | 선택값. Backend 가 Cloudflare Access 뒤에 있을 때 `CF-Access-Client-Id` 로 보낸다 |
| `CAREER_BACKEND_ACCESS_CLIENT_SECRET` 또는 `CAREER_BACKEND_ACCESS_CLIENT_SECRET_FILE` | 선택값. `CF-Access-Client-Secret` 으로 보낸다. 파일은 mode 600. ID 와 secret 은 둘 다 있거나 둘 다 없어야 한다. launchd 로 도는 agent-usage 도 `--env-file` 로 같이 읽는다 |
| `YOUTUBE_DATA_API_KEY` | 선택값. 있으면 YouTube uploads playlist 과거 수집을 쓴다 |

`manage_reading_sources.ts`의 `list`, `add`, `update`, `disable`, `enable`과 다른 API 사용 명령은 연결 값이 없으면 요청 전에 실패한다.
`help`와 `template`는 연결 값을 읽지 않는다. 브라우저 관리자 쿠키나 세션을 복제하지 않는다.

`study.service.ts` 는 `learning-interests` 문서를 `src/candidate-context/` 가 내보낸 조회로 읽는다.
후보자 맥락 table 을 직접 질의하지 않는다.
학습 관심사를 고치는 명령은 공부 추천 디렉터리가 아니라 `scripts/candidate-context/` 에 있다. 아래 절이 소유한다.

## 후보자 맥락 문서

`scripts/candidate-context/` 는 사람이 후보자 맥락 문서를 조회하고 저장하는 CLI 다.
여러 스킬이 같은 문서를 읽으므로 한 스킬의 디렉터리에 두지 않는다.

| 경로 | 책임 |
| --- | --- |
| `client.ts` | `/api/candidate-context/v1` client. 연결값과 HTTP 는 `scripts/lib/career-backend-config.ts` 와 `scripts/lib/career-backend-http.ts` 를 쓴다 |
| `contracts.ts` | 문서 키 넷과 요청, 응답의 zod 계약 |
| `manage_candidate_context.ts` | `list`, `get`, `put` 과 `help`. `help` 만 연결값 없이 실행한다. `put` 은 문서만 저장하고 포지션 분석 정책을 건드리지 않는다 |
| `position-context.ts` | `prepareCandidateContext` 는 수집 전에 `position-preferences` 와 `application-state` 문서를 읽어 `candidate-context.json` 을 쓴다. 문서가 없으면 쓰지 않고 멈춘다. 분석 정책을 읽지 않는다 |
| `repository-guard.ts` | 개인 맥락을 쓸 경로가 git 저장소 안이면 거절한다. `manage_candidate_context.ts` 와 `prepareCandidateContext` 가 함께 쓴다 |

`put` 은 `--file` 로 받은 Markdown 파일을 본문으로 보내고 `--note` 와 `--expected-version` 을 요구한다.
본문을 저장소 파일로 두지 않는다. 개인 맥락이라 시스템 임시 디렉터리에서 편집하고 저장한 뒤 지운다.

## 지원서 공통 프로필

`scripts/application-profile/` 는 fos-assistant Memory 의 지원서 공통 프로필을 읽는 CLI 다.
흐름과 실패 갈래는 [`flow.md`](flow.md#지원서-공통-프로필)가 소유한다.

| 경로 | 책임 |
| --- | --- |
| `contracts.ts` | collection `identity`, 문서 키 `career-application-profile` 상수와 응답의 zod 계약 |
| `client.ts` | 연결값 검사와 서비스 읽기 HTTP 호출. 커리어 Backend 의 client 를 쓰지 않는다 |
| `read_application_profile.ts` | `get --out <path>` 와 `help`. `help` 만 연결값 없이 실행한다 |

| 환경 변수 | 뜻 |
| --- | --- |
| `FOS_ASSISTANT_URL` | fos-assistant 의 HTTP 또는 HTTPS origin. path, query, hash 와 credentials 를 받지 않는다 |
| `FOS_ASSISTANT_SERVICE_TOKEN` | fos-assistant 웹 화면에서 발급한 서비스 토큰. `identity` collection 과 그 민감 읽기를 받는다 |
| `FOS_ASSISTANT_ACCESS_CLIENT_ID` | 선택값. fos-assistant 가 Cloudflare Access 뒤에 있을 때 `CF-Access-Client-Id` 로 보낸다 |
| `FOS_ASSISTANT_ACCESS_CLIENT_SECRET` 또는 `FOS_ASSISTANT_ACCESS_CLIENT_SECRET_FILE` | 선택값. `CF-Access-Client-Secret` 으로 보낸다. 파일은 mode 600. ID 와 secret 은 둘 다 있거나 둘 다 없어야 한다 |

`FOS_ASSISTANT_URL` 과 `FOS_ASSISTANT_SERVICE_TOKEN` 은 `career-os/.env` 에 두고 `bun --env-file=career-os/.env` 로 넘긴다.
Access 값도 같은 파일에 둔다.
Access 값이 없으면 헤더를 보내지 않아 내부망과 터널 직접 경로는 그대로 동작한다.
collection 과 문서 키는 코드에 고정한다. 설정으로 바꾸지 않는다.

- `--out` 은 `scripts/candidate-context/repository-guard.ts` 로 git 저장소 밖인지 확인한 뒤에만 요청한다.
  같은 디렉터리에 0600 임시 파일을 새로 만들어 쓰고 `--out` 으로 이름을 바꾼다. 이미 있는 파일이나 링크에 쓰지 않는다.
- 표준 출력은 `collection`, `documentKey`, `revision`, `updatedAt`, `tokenExpiresAt`, `out` 만 담는다. `tokenExpiresAt` 은 응답의 `X-Service-Token-Expires-At` 머리말이며 없으면 `null` 이다.
- 오류 메시지는 상태와 다음 행동만 담는다. 응답 본문, 문서 본문과 토큰을 담지 않는다.
- 요청에 `Origin` 머리말을 붙이지 않고 redirect 를 따라가지 않는다.

## sync-profile

스킬은 저장소에 없고 plugin 의 Claude Code 전용 `plugin/skills/sync-profile/` 에 있다.
**폼을 조작하는 셸 스크립트는 그 스킬 번들 안에 둔다.**
대상 사이트의 폼을 조작하는 코드라 다른 스킬이 재사용할 것이 없고, 대상별 절차 문서 바로 옆에 두는 편이 읽기 쉽다.
스크립트는 `browser-driver` 명령으로 이미 로그인된 브라우저를 조작한다. 명령 위치는 `BROWSER_DRIVER` 로 바꿀 수 있고, 없으면 PATH 의 `browser-driver` 다.
사용량 측정과 수집은 스킬 없이 `launchd` 도 실행하므로 `scripts/agent-usage/` 에 둔다. plugin 은 로컬 실행기 `usage` 로 같은 수집기를 부른다.

| 경로 | 책임 |
| --- | --- |
| `plugin/skills/sync-profile/references/wanted.md` | 원티드 폼 구조와 저장 확인 절차 |
| `plugin/skills/sync-profile/references/linkedin.md` | LinkedIn 편집 진입과 저장 확인 절차 |
| `plugin/skills/sync-profile/references/github.md` | GitHub 프로필 문서 규칙 |
| `plugin/skills/sync-profile/scripts/wanted_*.sh` | 원티드 폼 필드 조회와 입력 |
| `plugin/skills/sync-profile/scripts/linkedin_*.sh` | LinkedIn 소개의 문단 입력과 프로젝트 폼 채우기 |

원고와 사용량 기록은 파일이 아니다. 커리어 Backend 의 `profile` 모듈이 갖고, 스킬은 MCP 도구(`list_profile_documents`, `get_profile_document`, `save_profile_document`, `list_usage_snapshots`)로 읽고 쓴다. 저장소에서는 `scripts/profile/manage_profile.ts` 가 같은 계약을 쓴다.
`library/profiles/` 는 쓰지 않는다. 차트 이미지는 저장하지 않고 기록에서 그때마다 그린다.

사용량 측정과 수집의 배치다.

| 경로 | 책임 |
| --- | --- |
| `scripts/agent-usage/agent_usage.py` | 에이전트 세션 기록에서 월별 토큰, 환산 비용, 세션 수, 단가를 모르는 토큰 계산. 단가표를 갖는다 |
| `scripts/agent-usage/measure.ts` | `agent_usage.py --json` 을 실행해 출력을 zod 로 검증하고 달 표기를 `YYYY-MM` 으로 바꾼다. 실행기를 인자로 받아 테스트가 대역을 넣는다 |
| `scripts/agent-usage/collect_usage.ts` | 수집기. 기록이 없는 끝난 달만 측정해 올린다. 측정기, 기록 저장소, 현재 시각을 인자로 받는다 |
| `scripts/agent-usage/launchd/agent-usage.plist.template` | `launchd` 작업 틀. 자리표시자는 `bun` 경로, 저장소 경로, 로그 디렉터리뿐이다 |
| `scripts/agent-usage/manage_launchd.ts` | `install`, `uninstall`, `status`. `install` 과 `uninstall` 은 `--dry-run` 으로 쓸 파일과 실행할 명령만 낸다 |
| `scripts/profile/migrate_library_profiles.ts` | `library/profiles/` 의 원고 셋과 사용량 표를 Backend 로 옮기는 일회성 명령 |

`launchd` 작업의 이름은 `com.fos-agents.career-os.agent-usage` 다. 매일 10시에 돌고, 기기가 잠들어 있었으면 깨어난 뒤에 돈다.
plist 는 `~/Library/LaunchAgents/` 에, 로그는 `~/Library/Logs/fos-career-os/agent-usage.log` 에 둔다.
등록은 세션 기록이 있는 기기에서 사람이 한 번 실행한다. 홈서버 인프라 저장소의 배포와 무관하다.

브라우저 조작은 공용 `browser-driver`를 쓰고 이 스킬이 드라이버를 따로 만들지 않는다.

### 프로필 저장 CLI

`scripts/profile/` 는 커리어 Backend 의 프로필 원고와 에이전트 사용량 기록을 읽고 쓰는 client 와 CLI 다.
스킬 번들이 아니라 `scripts/` 에 두는 이유는 `sync-profile` 스킬 말고도 사용량 수집기와 fos-assistant 커넥터가 같은 계약을 쓰기 때문이다.
결정과 근거는 [ADR-133](adr/ADR-133-프로필-원고와-에이전트-사용량-기록은-backend의-profile-모듈이-갖는다.md)에 있다.

| 경로 | 책임 |
| --- | --- |
| `scripts/profile/contracts.ts` | 문서 키 셋, 사용량 기록과 요청, 응답의 zod 계약 |
| `scripts/profile/client.ts` | `/api/profile/v1` client. 연결값과 HTTP 는 `scripts/lib/career-backend-config.ts` 와 `scripts/lib/career-backend-http.ts` 를 쓴다 |
| `scripts/profile/manage_profile.ts` | `documents list`, `documents get`, `documents put`, `usage list`, `usage put` 과 `help`. `help` 만 연결값 없이 실행한다 |

`documents get --out` 은 원고를 쓸 경로가 git 저장소 안이면 거절한다. 판정은 `scripts/candidate-context/repository-guard.ts` 를 함께 쓴다.
`documents put` 은 `--file` 로 받은 Markdown 파일을 본문으로 보내고 `--note` 와 `--expected-version` 을 요구한다.
원고는 시스템 임시 디렉터리에서 편집하고 저장한 뒤 지운다.
`usage put` 은 측정값을 옵션으로 받는다. `--replace` 는 `--note` 와 함께 줄 때만 받는다.

## fos-career 커넥터

`plugin/` 은 fos-assistant 가 사용자별 profile 에 설치하는 커넥터의 배포 단위다.
plugin 이름과 커넥터 id 는 `fos-career`, MCP 서버 이름은 `career` 다.
가계부 커넥터(`accountbook/plugin/`)와 같은 구성이고, 결정은 [ADR-135](adr/ADR-135-fos-assistant-커넥터는-backend를-감싸고-숫자는-기록에서-직접-읽는다.md)에 있다.
이 plugin 은 career-os 의 스킬과 MCP 서버를 한데 묶는 배포 단위이기도 하다. 옮기는 단계와 세 층 구조는 [ADR-137](adr/ADR-137-스킬과-mcp를-plugin-하나로-묶고-세-단계로-옮긴다.md)을 따른다.
지금은 2단계를 진행하고 있다. 대화용 스킬과 Claude Code 전용 스킬의 자리는 [ADR-139](adr/ADR-139-plugin-의-대화용-스킬과-claude-code-전용-스킬을-디렉터리로-나눈다.md), 로컬 실행기의 배치는 [ADR-138](adr/ADR-138-plugin-로컬-실행기는-scripts-원본을-번들해-부르고-작업본-위치는-설정으로-받는다.md)을 따른다.
fos-assistant 의 일반 에이전트가 읽는 스킬의 자리는 [ADR-141](adr/ADR-141-일반-에이전트가-읽는-스킬은-plugin-의-agent-skills-에-두고-따로-올린다.md)을 따른다.

```text
career-os/plugin/
├── .claude-plugin/plugin.json
├── .mcp.json
├── connector.json
├── package.json, tsconfig.json, bun.lock
├── src/
├── scripts/
├── dist/career-mcp.js
├── dist/career-local.js
├── agent-skills/
│   └── proactive-check/
├── connector-skills/
│   ├── career-connector/SKILL.md
│   ├── interview-practice/SKILL.md
│   └── study-topic-recommender/SKILL.md
└── skills/
    ├── application-package-writer/
    ├── interview-question-prep/
    ├── position-recommender/
    ├── resume-preparer/
    ├── study-collection/
    └── sync-profile/
```

| 경로 | 책임 |
| --- | --- |
| `plugin/connector.json` | 연결 화면의 입력 칸, 확인 도구, 도구별 위험도와 승인 방식, 오류 코드 대응 |
| `plugin/.mcp.json` | `career` 서버의 실행 명령과 env 변수 참조. 실제 값을 담지 않는다 |
| `plugin/src/server.ts` | stdio MCP 서버 조립과 도구별 읽기 전용 표시 |
| `plugin/src/tools.ts` | 도구 열여덟 개의 입력 스키마와 분기, 오류를 `{ error: { code, message } }` 로 바꾸는 일 |
| `plugin/src/interview.ts` | 면접 연습 도구 넷의 입력과 응답 스키마, 공개 질문 은행 번들과 질문 선별 호출 |
| `plugin/src/study.ts` | 공부 후보 읽기와 목록, 추천 저장 도구 셋의 입력과 응답 스키마, 후보 요약과 추천 저장 요청 조립 |
| `plugin/src/positions.ts` | 포지션 조사 제외 기준 도구의 응답 스키마와 제외 규칙, 회사 선호를 함께 읽어 보류 여부를 정하는 일 |
| `plugin/src/backend.ts` | 커리어 Backend 의 Bearer HTTP client 와 응답 스키마 |
| `plugin/src/github.ts` | GitHub REST client. 프로필 저장소 조회와 Git Data API 로 커밋 하나를 만드는 일 |
| `plugin/src/*.test.ts`, `plugin/scripts/*.test.ts` | fetch 대역으로 도는 도구 테스트, 번들 일치와 manifest 일치 검사 |
| `plugin/scripts/build.ts`, `plugin/dist/career-mcp.js` | 의존성을 포함한 MCP 서버 실행 파일의 빌드와 배포 |
| `plugin/dist/career-local.js` | 같은 빌드가 만드는 로컬 실행기 실행 파일. 아래 「로컬 실행기」 |
| `plugin/agent-skills/proactive-check/` | fos-assistant 의 일반 커리어 에이전트가 먼저 살펴보기에서 읽는 지침. 커넥터 위임으로 맥락을 읽어 공부, 포지션, 동향 가운데 조사할 영역을 고르고 결과 블록을 쓴다. `evals/` 는 합성 fixture 와 기대 판정이다 |
| `plugin/scripts/agent-skill-eval.ts` | `agent-skills/proactive-check/evals/` 의 fixture 를 Claude Code CLI 로 실제 모델에 돌리고 고른 영역, 위임, 직접 호출과 검색어를 채점한다. 결과가 있는 평가는 v3와 문제 후보 배열을 검사하고, `NOTHING_NEW` 는 빈 발견과 빈 후보를 요구한다. 결과 작성 평가는 이번 실행에서 원문을 확인한 합성 결과로 문제 후보의 수, 필수 칸과 근거 참조를 채점한다 |
| `plugin/connector-skills/career-connector/SKILL.md` | 연결용 에이전트의 지침. 프로필 갱신 순서와 승인 규칙, 조사용 읽기 도구의 결과 해석 |
| `plugin/connector-skills/interview-practice/SKILL.md` | MCP 도구만으로 하는 면접 연습. 질문 고르기, 답변 평가, 기록과 개인 질문 저장 |
| `plugin/connector-skills/study-topic-recommender/SKILL.md` | MCP 도구만으로 하는 공부 추천. 수집된 후보에서 고르고 추천 이력을 저장 |
| `plugin/skills/application-package-writer/` | Claude Code 전용. 공고별 적합도 판정, 후보자 인터뷰, 지원 전략과 검토 화면 |
| `plugin/skills/interview-question-prep/` | Claude Code 전용. 공고별 질문으로 하는 연습과 외부 자료에서 개인 질문 찾기 |
| `plugin/skills/study-collection/` | Claude Code 전용. 외부 피드 수집, 소스 관리, HTML 리포트와 게시 기록 |
| `plugin/skills/position-recommender/` | Claude Code 전용. 공고 수집부터 회사 판정, 공고 분석, 리포트까지의 판단 흐름 |
| `plugin/skills/resume-preparer/` | Claude Code 전용. 이력서와 경력기술서 작성, 주장 감사, HTML·PDF 와 제출 묶음 |
| `plugin/skills/sync-profile/` | Claude Code 전용. 원티드, LinkedIn, GitHub 프로필 갱신과 저장 확인 |
| `scripts/lib/text-asset.ts` | 텍스트 import 로 읽은 템플릿이 문자열인지 확인하는 helper. 번들한 실행기가 템플릿 파일을 찾지 않게 한다 |
| `scripts/plugin-local/` | 로컬 실행기의 진입점. 하위 명령을 `scripts/` 의 CLI 로 넘긴다. 실행기 이름 목록은 import 가 없는 `executors.ts` 가 갖는다 |
| `scripts/interview-drill/public-question-bank.ts` | 공개 질문 은행 JSON 을 정적 import 로 읽는 모듈. 커넥터와 실행기와 CLI 가 함께 쓴다 |
| `scripts/interview-drill/question-selection.ts` | 질문 은행과 복습 상태로 낼 질문을 고르는 순수 함수. `follow-up-policy.ts` 의 상수만 import 한다. 노트북 CLI 와 커넥터가 같은 함수를 쓴다 |
| `public/question-bank/*/questions.json` | 공개 질문 은행. 커넥터가 번들에 넣어 저장소 경로 없이 읽는다 |
| `scripts/agent-usage/chart.ts` | 사용량 기록을 차트 입력으로 바꾸고 SVG 를 그리며 README 의 Tokens 배지 값을 읽는 순수 함수. import 가 없다 |
| `scripts/agent-usage/render_chart.ts` | 노트북에서 같은 차트를 파일로 그리는 CLI. Backend 의 사용량 기록을 읽는다 |

**커넥터는 `scripts/` 의 Backend client 를 번들하지 않고 `plugin/src/backend.ts` 를 따로 둔다.**

- `scripts/lib/career-backend-config.ts` 는 token 파일을 읽는다. 번들에 넣으면 MCP 서버가 파일을 읽는 코드를 갖게 된다. 커넥터는 profile 의 환경 변수만 읽고 `.env` 를 탐색하지 않는다
- `scripts/` 의 코드는 루트 package 의 `zod` 를, plugin 은 자기 package 의 `zod` 를 쓴다. 함께 번들하면 `zod` 가 두 벌 들어가고 커밋한 번들이 루트의 설치 상태에 따라 달라진다
- `scripts/lib/career-backend-http.ts` 는 실패한 요청을 다시 보낸다. 확인 도구는 10초 안에 답해야 해서 커넥터는 다시 보내지 않고 시간 제한을 짧게 둔다

두 client 가 어긋나지 않는지는 번들에 들어가지 않는 plugin 의 테스트가 확인한다. 문서 키 목록과 저장 요청의 `Idempotency-Key` 가 `scripts/candidate-context/` 와 `scripts/profile/` 의 것과 같은지 대조한다.

**차트 코드는 `scripts/agent-usage/chart.ts` 하나다.** plugin 이 이 파일을 번들한다.
다른 파일을 import 하지 않는 순수 함수라 위의 `zod` 문제가 없다. 노트북의 CLI 와 커넥터가 같은 함수로 같은 SVG 를 그린다.

**질문 선별 코드는 `scripts/interview-drill/question-selection.ts` 하나다.** 같은 이유로 plugin 이 이 파일과 `follow-up-policy.ts` 를 번들한다.
두 파일은 `zod` 와 파일 시스템을 import 하지 않는다. 질문 은행은 인자로 받고 날짜도 인자로 받는다.
공개 질문 은행 JSON 도 번들에 들어간다. 그래서 `public/question-bank/` 를 고치면 번들을 다시 만들어 함께 커밋한다.

**Backend 응답과 요청 스키마는 plugin 의 `zod` 로 다시 적는다.** `services/career-backend/src/interview/schema.ts` 와 `src/study/schema.ts` 를 번들하지 않는다.
두 쪽이 같은지는 `plugin/src/contract-parity.test.ts` 가 같은 입력을 두 스키마에 넣어 대조한다.

**MCP 서버는 프로세스 안의 상태에 기대지 않는다.** fos-assistant 는 승인된 쓰기를 새 프로세스에서 실행한다.
파일을 읽거나 쓰지 않고, 호출 사이에 값을 기억하지 않는다.

### 로컬 실행기

Claude Code 전용 스킬은 `bun --no-env-file "${CLAUDE_PLUGIN_ROOT}/dist/career-local.js" <실행기> ...` 로 로컬 실행기를 부른다.
`${CLAUDE_PLUGIN_ROOT}` 는 Claude Code 가 `SKILL.md` 본문에서만 치환한다. 그래서 스킬 본문이 이 명령을 알려 주고, 스킬 본문과 `references/` 의 문서는 그 명령을 `<CAREER_LOCAL>` 로 적는다.
`--no-env-file` 은 사용자가 연 디렉터리의 `.env` 를 `bun` 이 자동으로 읽지 않게 한다.

| 실행기 | 넘기는 곳 | 하는 일 |
| --- | --- | --- |
| `workspace` | `scripts/plugin-local/workspace.ts` | 비공개 작업본의 위치를 알려 주고, 스킬 시작과 끝에 동기화한다 |
| `interview` | `scripts/interview-drill/drill-engine.ts` 의 `select` | 공고별 질문을 섞어 오늘 질문을 고른다. 저장소는 늘 Backend 다 |
| `interview-sources` | `scripts/interview-question-sources/cli.ts` | 등록 출처에서 면접 질문 후보를 임시 디렉터리에 모은다 |
| `study` | `scripts/study-topic-recommender/morning_reading_cli.ts` | 피드 수집, 후보 준비, HTML 리포트, 추천과 게시 기록, 실행 디렉터리 정리 |
| `study-validate` | `scripts/study-topic-recommender/validate_outputs.ts` | 실행 디렉터리의 리포트 산출물을 검증한다 |
| `study-sources` | `scripts/study-topic-recommender/manage_reading_sources.ts` | 읽을거리 소스를 조회하고 더하고 끈다 |
| `position` | `scripts/position-recommender/position_run.ts` 의 `runPositionCommand` | 공고 수집, 회사 판정과 공고 분석 반영, 리포트 최종화, 실행 디렉터리 정리 |
| `usage` | `scripts/agent-usage/collect_usage.ts` 의 `main` | 기록이 없는 끝난 달의 에이전트 사용량을 측정해 Backend 에 올린다 |
| `package` | `scripts/application-package/` | 근거 원본이 원격보다 뒤처졌는지 검사하고(`check-sources`), 제출 문서의 내부 정보를 검사하고(`validate`), 검토 화면을 만들고(`render`), 포지션별 면접 질문 파일을 검증한다(`question-schema`) |
| `application-profile` | `scripts/application-profile/read_application_profile.ts` | fos-assistant Memory 의 지원서 공통 프로필을 저장소 밖 파일로 읽는다 |
| `resume` | `scripts/resume-preparer/` 의 CLI 여덟 | 이력서 HTML·PDF 변환과 검사, 주장 원장 검증, 검증 완료 주장 판정과 검색과 반영, 제출 묶음 생성과 검증 |

- 실행기 원본은 `scripts/` 에 있다. 저장소의 CLI 와 같은 코드다. 실행기 코드를 고치면 `bun run --cwd career-os/plugin build` 로 `dist/career-local.js` 를 다시 만들어 함께 커밋한다
- `dist/career-local.js` 는 루트 `bun.lock` 이 고정한 `zod` 와 `fast-xml-parser` 를 번들한다. MCP 서버 번들(`dist/career-mcp.js`)과 따로 만들어 서로의 `zod` 가 섞이지 않는다
- 실행기는 실행 파일 옆의 파일이나 저장소 경로를 찾지 않는다. 공개 질문 은행과 템플릿은 import 로 번들에 들어간다
- Backend 연결값은 셸 환경 변수 `CAREER_BACKEND_URL`, `CAREER_BACKEND_TOKEN` 에서 읽는다. `.env` 를 탐색하지 않는다
- 비공개 작업본의 위치와 동기화 설정은 [`data-schema.md`](data-schema.md#로컬-실행기-환경-변수)가 소유한다

### 커넥터 설치 계약

fos-assistant 는 `plugin/` 을 복사하거나 마운트해 `connector.json`, `.mcp.json`, `.claude-plugin/plugin.json` 의 `skills` 가 가리키는 `connector-skills/` 를 읽는다.

- `connector.json` 은 `schema: 2` 다. 도구 열여덟 개를 `tools` 에 빠짐없이 선언하고 `default_tool_policy` 는 `deny` 다. 새 도구를 더할 때는 같은 변경에서 `tools` 에 위험도와 승인 방식과 `title` 을 선언한다
- 확인 도구 `check_connection` 은 `READ` 와 `none` 이고 서버가 `readOnlyHint: true` 로 표시한다
- `.mcp.json` 의 서버 env 는 `connector.json` 의 `fields[].env` 와 `operator_env` 의 합과 같다. 다르면 커넥터가 카탈로그에서 빠진다
- `operator_secrets` 를 선언하지 않는다. 선언하면 카탈로그에서 빠진다. 그래서 Backend 의 token 은 사용자가 연결 화면에 넣는다
- `connector-skills/` 아래 모든 `SKILL.md` 의 본문을 이름 순으로 이어 붙인 것이 연결용 에이전트의 지침이 된다. 앞머리를 뺀 본문을 합쳐 8,000자를 넘지 않고 그 아래에 심볼릭 링크를 두지 않는다. 어기면 카탈로그에서 빠진다
- `agent-skills/` 는 커넥터 설치가 읽지 않는다. 일반 에이전트에 스킬로 따로 올린다([ADR-141](adr/ADR-141-일반-에이전트가-읽는-스킬은-plugin-의-agent-skills-에-두고-따로-올린다.md)). 세 디렉터리에 같은 이름의 스킬을 두지 않는다
- `skills/` 는 Claude Code 만 읽는다. fos-assistant 는 읽지 않으므로 이 디렉터리의 스킬은 지침 상한에 들지 않는다. 두 디렉터리에 같은 이름의 스킬을 두지 않는다
- plugin 스킬을 `.claude/skills/` 에 링크하지 않는다. 저장소를 연 Claude Code 세션도 plugin 을 설치해 plugin 스킬을 쓴다
- 저장소에 스킬 사본을 두지 않는다. 판단 규칙은 plugin 스킬 한 곳에서만 고친다
- 도구 목록이 바뀐 판을 배포하면 실행 환경이 MCP 서버를 다시 띄워야 새 도구가 보인다. 스킬 본문만 바뀐 판은 연결 확인으로 반영한다
- 실행 파일에 의존성이 포함돼 있어 설치한 환경에서 `bun install` 을 하지 않는다. 소스를 고친 사람이 빌드해 `dist/career-mcp.js` 를 함께 커밋한다

환경 변수의 뜻은 [`data-schema.md`](data-schema.md#fos-career-커넥터)가 소유한다.

검증 명령이다. 실제 Backend 와 GitHub 를 부르지 않고 모든 HTTP 호출을 fetch 대역으로 확인한다.

```bash
# cwd: 저장소 루트
bun install --frozen-lockfile
bun install --frozen-lockfile --cwd career-os/plugin
bun test ./career-os/plugin ./career-os/scripts/agent-usage ./career-os/scripts/interview-drill ./career-os/scripts/plugin-local
bun run --cwd career-os/plugin typecheck
bun run --cwd career-os/plugin build
claude plugin validate career-os/plugin
```

첫 줄의 루트 설치는 plugin 의 대조 테스트가 `scripts/` 의 계약 파일을 import 하기 때문에 필요하다.
로컬 실행기 번들도 루트에 설치한 `zod` 와 `fast-xml-parser` 로 만든다.
