# 코드 아키텍처

career-os는 skill이 실행 계약을 설명하고 TypeScript 스크립트가 반복 가능한 처리를 담당하는 파일 기반 워크스페이스다.

public `fos-agents` 저장소는 skill과 실행 코드를 소유한다.
비공개 작업 파일은 각 환경의 기존 경로에서 다루고 홈서버 `career-os` S3 collection의 immutable release를 기준으로 동기화한다.

## 디렉터리 구조

```text
career-os/
├── .claude/skills/       사용자 작업별 skill
├── .codex/skills/        Codex에서 같은 skill을 노출하는 링크
├── config/               사람이 관리하는 수집 정책
├── scripts/              검증, 수집과 변환 코드
├── applications/         동기화되는 로컬 지원 패키지
├── library/              여러 지원에서 재사용하는 비공개 자료
├── state/                동기화되는 도구 실행 상태
├── public/               공개 가능한 질문 은행
├── cache/                다시 만들 수 있는 수집 결과
├── sources/fos-study/    별도 저장소에서 관리하는 공개 학습·이력 자료
└── docs/                 제품, 흐름, 데이터, 기술 결정 문서
```

## 파일 개요

| 경로                                                                | 책임                                                      |
| ------------------------------------------------------------------- | --------------------------------------------------------- |
| `.claude/skills/<name>/SKILL.md`                                    | 사용자 요청별 실행 계약의 관리 원본                       |
| `.claude/skills/application-package-writer/templates/`              | 검토 화면의 HTML 골격과 CSS                               |
| `.codex/skills/<name>`                                              | Codex가 같은 skill을 읽는 링크                            |
| `config/*.ts`                                                       | 공고, 읽을거리와 면접 자료의 수집 정책                    |
| `.claude/skills/resume-preparer/references/resume-writing-style.md` | 모든 이력서와 경력기술서에 적용하는 표현과 근거 범위 기준 |
| `.claude/skills/resume-preparer/references/resume-design.md`        | 이력서와 경력기술서의 기본 시각 기준                      |
| `.claude/skills/resume-preparer/templates/`                         | 이력서 HTML 골격, 기본 CSS 와 회사·학교 로고              |
| `scripts/lib/`                                                      | CLI, 텍스트 정규화와 날짜 변환 같은 공통 순수 기능        |
| `scripts/career-workspace/`                                         | 비공개 작업본의 준비, 차이 확인과 release 반영            |
| `scripts/position-recommender/`                                     | 활성 공고 수집, 추천 검증과 HTML 생성                     |
| `scripts/study-topic-recommender/`                                  | 읽을거리 수집, 선별 결과 검증과 HTML 생성                 |
| `scripts/interview-drill/`                                          | 질문 선택, 꼬리질문과 복습 상태 관리                      |
| `scripts/interview-question-sources/`                               | 외부 면접 질문 후보 수집과 출처 검증                      |
| `scripts/question-bank-collector/`                                  | 공개 질문 은행의 구조, 공개 범위와 출처 검사              |
| `applications/<company>/<position>/`                                | 사용자가 여는 검토 화면과 제출 PDF                        |
| `applications/<company>/<position>/evidence/`                       | 공고 원문, 후보자 인터뷰, 지원 전략과 제출 문서 원본      |
| `applications/<company>/<position>/review/`                         | 근거 장부, 점수표, manifest와 제출 문서 HTML              |
| `library/`                                                          | 여러 지원에서 재사용하는 비공개 질문과 이력서 기준본      |
| `state/`                                                            | 답변 연습처럼 다음 실행에 필요한 상태                     |
| `public/question-bank/`                                             | 공개 가능한 일반 면접 질문과 출처                         |
| `sources/fos-study/`                                                | 별도 저장소에서 관리하는 공개 학습·경력 근거              |
| `docs/`                                                             | 제품 가치, 흐름, 데이터 계약, 코드 구조와 결정 이유       |

현재 경력, 역할 선호와 경험 경계는 이 저장소에 복제하지 않는다.
skill이 private brain에서 조회하고, 제출에 사용할 세부 성과는 `sources/fos-study/`와 실제 프로젝트 근거로 다시 확인한다.

## 스킬 스크립트의 CLI 계약

새 스킬 스크립트는 `scripts/lib/cli.ts` 의 `runCli` 를 기본으로 사용한다.
인자 파싱, 사용법 오류 처리와 결과 출력이 스크립트마다 같은 모양으로 되풀이되면
그 스크립트가 무엇을 검사하고 무엇을 만드는지가 가려진다.

```typescript
if (import.meta.main) {
  await runCli(
    {
      name: "validate_claim_ledger.ts",
      summary: "제출 HTML 의 각 주장이 근거와 맞는지 원장으로 검사한다.",
      positional: [{ name: "<claim-ledger.json>", description: "검사할 주장 원장" }],
      options: { "--artifact": { value: true, description: "원장이 가리키는 제출 HTML" } },
    },
    ({ positional, options }) =>
      validateClaimLedger(positional[0], options["--artifact"] as string),
  );
}
```

종료 코드는 셋으로 고정한다.

| 코드 | 뜻                                               |
| ---- | ------------------------------------------------ |
| 0    | 통과                                             |
| 1    | 검사나 실행 실패                                 |
| 2    | 사용법 오류. 인자가 없거나 값이 규격에 맞지 않다 |

사용법 오류를 1과 나누는 이유는 호출하는 쪽이 재시도할지 인자를 고칠지 가리기 위해서다.

- 검사 스크립트는 `{ passed: boolean }` 을 돌려준다. `runCli` 가 그 값으로 0과 1을 정한다.
- 파일을 만드는 스크립트는 아무것도 돌려주지 않고 `{ json: false }` 를 준다. 예외가 없으면 0으로 끝난다.
- 인자 규격은 `pattern` 으로 적는다. 검사 코드를 본문에 두지 않는다.
- `--help` 는 `runCli` 가 spec 으로 만든다. 도움말 문자열을 따로 쓰지 않는다.

### 기존 CLI 리팩토링 범위

기존 명령은 옵션 중복 처리, 도움말, 출력과 종료 코드가 서로 다르다.
`runCli`로 바꿀 때 이 계약이 달라지는 명령은 기존 진입점을 유지한다.
파일별 작업은 subprocess 회귀 테스트, 독립 계획 검토, 구현, 전체 관련 테스트 순으로 진행한다.

| 파일                                                                                                     | 변경 범위                                                                              |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `scripts/lib/cli.ts`                                                                                     | 기존 `parseArgs`와 `runCli`를 보존하고, 여러 명령이 사용하는 첫 옵션값 조회만 공유한다 |
| `scripts/position-recommender/validate_recommendation.ts`                                                | 파일을 읽고 후보풀과 대조하는 함수가 검사 결과를 반환하도록 분리한다                   |
| `scripts/position-recommender/render_candidate_preview.ts`                                               | 같은 파일 검사 함수를 사용하고 HTML 파일 생성과 CLI 출력을 분리한다                    |
| `scripts/position-recommender/render_recommendation.ts`                                                  | 파일 생성 함수를 명시적인 입력으로 호출하고 기존 순차 옵션 파싱을 보존한다             |
| `scripts/interview-question-sources/cli.ts`, `scripts/study-topic-recommender/manage_reading_sources.ts` | 명령 함수에 argv를 전달하고 반복 옵션 조회를 공유한다                                  |
| `scripts/study-topic-recommender/validate_outputs.ts`                                                    | 검증 함수에 실행 경로를 전달하고 결과 JSON을 반환한다                                  |
| `scripts/study-topic-recommender/morning_reading_cli.ts`, `scripts/interview-drill/drill-engine.ts`      | 옵션 조회만 공유하고 실행·오류 계약을 보존한다                                         |
| `scripts/lib/cli-contract.test.ts`                                                                       | 실제 subprocess로 출력 채널, 종료 코드, 인자와 import 동작을 고정한다                  |

`firstOptionValue`는 첫 번째 같은 이름 바로 다음 토큰을 반환한다.
다음 토큰이 옵션처럼 보여도 값으로 취급하고 모르는 옵션은 검사하지 않는다.
이는 기존 명령의 호환 동작이며, 새 명령의 엄격한 옵션 검사는 `parseArgs`가 담당한다.

공통화하지 않는 동작은 다음과 같다.

| 대상                                                                    | 유지 이유                                                                  |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 기존 `runCli` 사용처 6개                                                | 이미 옵션 스펙과 핵심 함수 호출로 분리되어 있다                            |
| `collect_live_postings.ts`                                              | 옵션 별칭, 소스별 실패 허용 개수와 필수 개인 제외 설정 검증을 보존한다     |
| `career-workspace/cli.ts`, `career-storage-s3.ts`                       | 원격 오류 JSON, 바이너리 출력과 비공개 동기화 계약이 다르다                |
| `morning_reading_cli.ts`                                                | API 오류의 비공개 정보 제거, 429 정보와 파일모드 자동 전환 금지를 보존한다 |
| `application_question_schema.ts`, `question-bank-collector/validate.ts` | `passed` 없는 성공 JSON과 기존 오류·도움말 동작을 보존한다                 |

`interview-question-sources/cli.ts`, `manage_reading_sources.ts`, `validate_outputs.ts`는
실행을 의존하는 importer가 없어 `import.meta.main`에서만 실행한다.
직접 실행하는 명령은 기존 출력과 종료 코드를 유지하며, import는 명령을 실행하거나 출력·종료하지 않는다.

기본값과 보조 경로는 이번 작업에서 변경하지 않는다.
개인 제외 설정 오류, 학습자료 API 실패와 산출물 공개 경계 위반은 기존처럼 실행을 중단한다.

수정할 때는 Java 서비스처럼 입력을 받아 결과를 돌려주는 핵심 함수부터 읽는다.
파일 끝의 CLI 진입점은 컨트롤러처럼 인자를 전달하고 결과를 출력한다.
추천 판정은 `validateRecommendationAgainstPool`에서 고친다.
추천 화면 변경 위치는 아래 「포지션 추천 렌더」를 따른다.
옵션 조회 규칙은 `scripts/lib/cli.ts`에서 확인한다.

| 수정할 처리                    | 핵심 함수                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| 추천 파일 로드와 후보풀 대조   | `validateRecommendationFiles(input, candidates)`                                    |
| 추천 화면 파일 생성            | `writeCandidatePreview(input, candidates, output, limitValue)`                      |
| 상세 추천 HTML 파일 생성       | `writeRecommendation(input, output, format, template)`                              |
| 읽을거리 목록과 설정 예시 생성 | `listReadingSources(category, includeDisabled)`, `buildReadingSourceTemplate(args)` |
| 면접 질문 소스 명령            | `runInterviewQuestionSources(command, args)`                                        |
| 산출물 내용과 공개 경계 검사   | `validateMorningReadingOutputs(root)`                                               |

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

## 포지션 추천 수집

수집 정책은 세 층으로 나눈다.

| 층        | 위치                         | 책임                                                              |
| --------- | ---------------------------- | ----------------------------------------------------------------- |
| 소스 경계 | `live-postings/adapters/`    | 소스 고유 API, 상태값과 상세 요청 전 사전 선별                    |
| 공통 정책 | `live-postings/policy/`      | 목표 직무·고용형태 키워드, 분류와 마감 변환                       |
| 최종 경계 | `live-postings/validator.ts` | 모든 소스의 URL, 상태, 마감, 고용형태와 역할을 같은 규칙으로 검사 |

adapter의 사전 필터와 최종 경계는 역할이 다르므로 둘 다 유지한다.
사전 필터는 명백히 불필요한 상세 페이지 요청을 줄이고, 최종 경계는 adapter 누락이 모델 입력으로 번지는 것을 막는다.
다만 공통 키워드를 adapter에 복제하지 않는다.
교체 가능한 목록은 `policy/keywords.ts`, 판정 로직은 `role.ts`, `classification.ts`, `lifecycle.ts`가 소유한다.
공백 정규화, 키워드 포함 검사와 HTML 평문화는 `scripts/lib/text.ts`, 날짜 파싱과 시각 차이 계산은 `scripts/lib/date-format.ts`를 사용한다.

현재 키워드 판정은 부분 문자열 검사이므로 새 단어를 추가할 때 기존 공고 제목에 대한 회귀 테스트를 먼저 둔다.
회사나 특정 공고의 가치 판단은 공통 정책에 넣지 않고 `feedback/`의 검증된 개인 제외 규칙으로 반영한다.

## 포지션 추천 렌더

모델이 추천 데이터에 맞는 정보 구조와 화면 구성을 선택해 독립 HTML 파일을 만든다.
스크립트는 추천 링크, 기본 HTML 메타 정보와 공개 범위를 검사하며 절 이름이나 카드 수를 고정하지 않는다.
고정 템플릿 렌더러는 모델이 HTML을 만들지 못했을 때의 대체 경로와 회귀 검사에 사용한다.

| 수정할 내용                        | 파일                                                                                                                                                                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 자유형 HTML 공개 계약              | [validate-report-html.ts](../scripts/position-recommender/render/validate-report-html.ts)                                                                                                                                                       |
| 대체 상세 화면                     | [report.html](../scripts/position-recommender/render/templates/report.html), [report-parts.html](../scripts/position-recommender/render/templates/report-parts.html)                                                                            |
| 대체 추천 화면과 전체 후보 목록    | [preview.html](../scripts/position-recommender/render/templates/preview.html), [preview-parts.html](../scripts/position-recommender/render/templates/preview-parts.html)                                                                        |
| 대체 렌더의 색상과 동작            | [report.css](../scripts/position-recommender/render/templates/report.css), [preview.css](../scripts/position-recommender/render/templates/preview.css), [preview.js](../scripts/position-recommender/render/templates/preview.js)               |
| 상세 화면의 데이터 변환            | [recommendation-html.ts](../scripts/position-recommender/render/recommendation-html.ts)의 `renderRecommendationHtml(run, assets, generatedAt)`                                                                                                  |
| 후보 정렬, 표시 제한과 카드 데이터 | [candidate-preview-html.ts](../scripts/position-recommender/render/candidate-preview-html.ts)의 `renderCandidatePreview(run, options, assets, collected)`                                                                                       |
| 파일 읽기, 쓰기, 현재 시각과 CLI   | [render_recommendation.ts](../scripts/position-recommender/render_recommendation.ts), [render_candidate_preview.ts](../scripts/position-recommender/render_candidate_preview.ts), [assets.ts](../scripts/position-recommender/render/assets.ts) |
| 한국 시각과 날짜 표시              | [lib/date-format.ts](../scripts/lib/date-format.ts)                                                                                                                                                                                             |

`render/assets.ts`는 `import.meta.url` 기준으로 대체 템플릿과 자산 문자열을 읽는다.
화면별 `parts.html`에 `<template id="이름">…</template>` 요소로 조각을 모은다.
이름에는 영문·숫자·밑줄·하이픈을 쓰고 중복 이름은 허용하지 않는다.
요소 안팎의 줄바꿈과 HTML 주석은 사용할 수 있다.
반복과 조건은 TypeScript에서 처리하며 템플릿에 별도 문법을 넣지 않는다.
순수 렌더 함수에는 자산과 표시 시각을 명시적으로 전달하므로 같은 입력은 같은 HTML을 만든다.
기존 `toHtml(run, templatePath)`, `toReportHtml(run)`, `renderCandidatePreviewHtml(run, options)`는 얇은 호환 함수로 유지한다.

[template.ts](../scripts/position-recommender/render/template.ts)는 이름이 있는 슬롯만 한 번 치환한다.
일반 값은 HTML 이스케이프하고, 신뢰할 수 있는 조립 HTML과 CSS·JS는 별도 `raw` 입력으로 전달한다.
템플릿이 요구한 값이 없거나 등록되지 않은 슬롯이면 오류로 중단하며, 데이터 안의 `{{slot}}`은 다시 치환하지 않는다.
기존 `--template`의 `title`, `generatedAt`, `reportHtml`, `sourceDiagnosticsHtml` 슬롯을 지원한다.
`sourceDiagnosticsHtml`은 이전 기본 템플릿과의 호환을 위해 명시적으로 빈 문자열을 전달한다.

상세 렌더 CLI는 `--format html`만 허용한다.
`md` 등 다른 형식은 스키마 검사 이후 사용법 오류로 종료하며 파일을 만들거나 덮어쓰지 않는다.
기존 옵션 중복 처리와 오류 출력 순서는 유지한다.
Markdown 지원 제거를 제외한 화면, 필드, 링크, 정렬, 검색과 빈 상태는 기존 동작을 보존한다.

저장소 루트에서 아래 검증을 실행한다.

```bash
bun test career-os/scripts/position-recommender/render/*.test.ts career-os/scripts/lib/cli-contract.test.ts career-os/scripts/lib/date-format.test.ts
bun run format:position-recommender
bun run format:position-recommender:check
bunx tsc --noEmit
git diff --check
```

Prettier 개발 의존성은 정확한 버전으로 고정한다.
위 포맷 명령은 `position-recommender` 아래의 TypeScript, HTML, CSS와 JavaScript 전체를 대상으로 삼는다.
개인 산출물과 다른 워크스페이스 스크립트에는 적용하지 않는다.
함수 사이에는 빈 줄 하나를 직접 유지한다.
Prettier는 기존 빈 줄을 보존하지만 없는 빈 줄을 새로 만들지 않는다.
동작 근거는 [Prettier의 빈 줄 처리](https://prettier.io/docs/rationale.html#empty-lines)를 따른다.

`scripts/lib/date-format.ts`는 입력 날짜를 한국 시각으로 표시하며 현재 시각을 직접 얻지 않는다.
`formatSeoulDateTime(Date)`는 상세 추천의 한국어 날짜·분 표시,
`formatSeoulDisplayTime(string)`은 미리보기의 짧은 시각·전체 시각,
`formatSeoulIsoDate(generatedAt)`는 `YYYY-MM-DD`를 반환한다.
미리보기의 잘못된 날짜는 `확인 필요`로 표시하고, ISO 날짜 변환은 기존 `generatedAt` 오류를 유지한다.
아침 읽을거리의 파일명과 API 보고서 ID도 동일한 ISO 날짜 함수를 재사용한다.
`parseDateOrNull`과 `ceilDaysUntil`은 공고 마감처럼 여러 처리에서 재사용할 순수 계산만 제공한다.
마감 상태와 긴급도 값은 `live-postings/policy/lifecycle.ts`가 결정한다.

## Skill과 실행 코드

`SKILL.md`는 입력, 실행 순서, 산출물, 검증, 안전 경계를 설명한다.
반복되는 수집, 파싱, 렌더링과 검증은 `scripts/`의 TypeScript로 구현한다.

하나의 스크립트가 수집과 추천, 렌더링을 모두 책임지지 않는다.
외부 응답은 경계에서 검증한 뒤 내부 타입으로 변환한다.
구조화 데이터 검증에는 Zod를 사용하고, 표시 문자열은 렌더러에서만 만든다.

## 실행 환경 준비

`scripts/career-workspace/`는 Hermes, Codex CLI와 Claude Code가 공유하는 파일 준비·차이 검사·반영 경계다.
manifest 생성과 검증, 로컬 기준 상태 확인, SSH와 command transport, 홈서버 명령을 책임별 모듈로 나눈다.
S3 storage adapter는 홈서버에서 표준 입력과 출력으로 release를 발행하고 내보낸다.
회귀 테스트와 fixture는 `tests/`에 분리한다.
사용자는 이 helper를 직접 고르지 않고 기존 career-os skill을 계속 호출한다.

정상 실행 경로를 이해할 때는 다음 파일만 순서대로 읽는다.

| 순서 | 파일                                       | 책임                                         |
| ---- | ------------------------------------------ | -------------------------------------------- |
| 1    | `cli.ts`                                   | 준비, 차이 확인, 발행과 skill 실행 전후 처리 |
| 2    | `command-transport.ts`, `ssh-transport.ts` | 홈서버의 `career-storage` 호출               |
| 3    | `career-storage`                           | 홈서버 publish 직렬화                        |
| 4    | `career-storage-s3.ts`                     | 홈서버 명령의 입력과 출력                    |
| 5    | `s3-storage.ts`                            | 불변 release 검증과 current pointer 변경     |
| 6    | `s3-object-store.ts`                       | Bun `S3Client`를 통한 객체 읽기와 쓰기       |

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

## 공고 추천

회사별 채널은 소스 어댑터와 공개 채용 페이지에서 동적으로 찾는다.
Wanted adapter는 개발 전체 직군 `518`을 기술 상수로 사용하고, 백엔드와 AI Platform 역할 경계는 공통 수집 정책에서 적용한다.
후보자 선호와 회사 평가는 수집 상수에 넣지 않고 추천 단계에서 판단한다.

`scripts/position-recommender/` 루트에는 수집, 추천 검증, 제외 반영과 대체 렌더의 CLI 진입점만 둔다.
`live-postings/`는 외부 소스 어댑터와 수집 정책, `recommendation/`은 추천 계약,
`feedback/`은 제외 기준, `render/`는 HTML 생성과 검사를 구현한다.
어댑터는 원문 응답을 공통 `LivePosting` 형태로 바꾼다.
후보풀 정책은 개별 공고 URL, 활성 상태, 마감일, 고용 형태, 역할과 중복을 결정적으로 검사한다.
`exclusions.ts`는 필수 개인 제외 설정을 검증하고 공통 수집 경로에서 후보풀 생성 전에 해당 공고를 제거한다.
`apply_exclusion_suggestions.ts`는 추천 결과에서 검증된 자동 제외 제안만 비공개 설정에 합친다.
설정과 비공개 전송 계약은 [데이터 구조](data-schema.md#개인-공고-제외-설정)를 따른다.

`collection_health.ts`는 실행 전체가 추천 입력으로 쓸 만한지 판정한다.
소스 하나가 실패해도 남은 소스로 후보풀을 만드는 것은 의도한 동작이지만,
실패 개수를 판정하지 않으면 소스 대부분이 실패한 실행이 정상 실행과 같은 종료 코드로 끝난다.
실패 소스가 허용 개수를 넘거나 후보가 0건이면 수집기는 후보풀을 남기고 종료 코드 1로 끝낸다.
어댑터가 `partial`로 보고했더라도 하나도 수집하지 못한 채 오류만 냈으면 실패로 센다.

이 판정은 어댑터가 보고한 개수에 의존한다.
`collectedCount`, `importedCount`, `skippedCount`, `failedCount` 넷의 뜻은
`contracts.ts`의 `sourceDiagnosticSchema`가 소유하며 어댑터가 임의로 정하지 않는다.
원본 목록 건수처럼 소스마다 다른 값은 `message`에 적는다.
요청이나 파싱이 실패해 판단하지 못한 공고는 `failedCount`로 세고 `skippedCount`에 넣지 않는다.

수집 결과는 실행별 임시 후보풀에 저장한다.
모델은 후보풀에 존재하는 공고만 선별하고, `recommendation/schema.ts`와 `validate_recommendation.ts`가 결과 구조와 원문 일치 여부를 검사한다.
HTML은 검증된 추천 JSON에서 파생한다.
외부 게시를 요청하면 게시 검증 뒤 임시 데이터와 함께 삭제하고, 게시하지 않으면 사용자에게 로컬 검토 경로를 전달한 뒤 정리한다.

## 지원 패키지

`application-package-writer`는 사용자가 호출하는 지원 준비 진입점이다.
공고와 회사 기준 확인, 후보자 인터뷰, 근거 매핑과 지원 전략을 한 흐름으로 연결한다.
제출 문서의 내부 정보 유출 검사와 로컬 검토 화면 생성은 이 스킬의 `scripts/`에 둔다.

`resume-preparer`는 지원 전략을 이력서와 경력기술서로 변환하는 제출 문서 진입점이다.
문서 작성, 사람 확인, 주장 근거 감사, 인사담당자와 실무담당자 리뷰, HTML·PDF 변환과 제출 묶음 검증을 순서대로 수행한다.
사실 감사와 설득력 평가는 별도 참고 문서와 검사 스크립트로 분리하지만 별도 스킬로 노출하지 않는다.
면접 말하기 준비와 꼬리질문 연습은 `interview-practice`가 담당한다.

공고별 문서는 `applications/<company>/<position>/`에 세 층으로 둔다.
최상위에는 사용자가 직접 여는 `application-package.html`과 제출 PDF만 두고, 기준 원본은 `evidence/`에, 내부 검증 자료는 `review/`에 둔다.
기준 원본은 `evidence/`의 `posting.md`, `candidate-interview.md`, `fit.md`, `strategy.md`, `status.md`, `resume-draft.md`와 `interview-questions.json`이다.
포지션별 질문은 공고 책임, 근거 방어와 경험 공백에서 파생한다.
화면 구성은 [`data-schema.md`](data-schema.md#검토-화면)의 「검토 화면」이 소유한다.
생성기와 검증기는 이 세 층의 경로를 계약으로 사용한다.
층별 파일 목록은 [`data-schema.md`](data-schema.md)의 「지원 패키지」가 소유한다.
브라우저 자동 입력용 `application-form.json`과 경력기술서는 필요한 경우에만 추가한다.
공통 개인정보는 private brain에서 가져오고 후보자 인터뷰에는 복제하지 않는다.
공고별 개인 근거와 면접 준비 자료도 같은 `applications/<company>/<position>/`에 둔다.
여러 지원에서 재사용하는 개인 질문과 이력서 원고 기준본은 `library/`에 둔다.
작성 취향은 아래 「후보자 지식과 이력서」의 스킬 참조가 담당한다.
실제 제출은 두 스킬의 책임이 아니다.

## 후보자 지식과 이력서

이력서 작성 취향은 `.claude/skills/resume-preparer/references/resume-taste.md`가 소유한다.
조회 시점과 환원 분기는 같은 스킬의 `references/brain-context.md`에 두고 필요한 단계에서 읽는다.
스킬은 개인 맥락 조회를 `brain-search`, 새 개인 지식의 저장 제안을 `brain-add`로 연결한다.

현재 경력, 역할 선호와 경험 경계의 기준 원본은 private brain이다.
skill은 필요한 정보를 실행 시점에 조회하고 TypeScript 스크립트에 명시적인 입력으로 전달한다.
세부 성과는 공개 가능한 `sources/fos-study/`와 실제 작업 저장소에서 다시 확인한다.

공개 가능한 이력 자료는 별도 `sources/fos-study/` 저장소에서 관리한다.

## 현재 지원 대상과 면접 답변 연습

현재 지원 대상은 private brain에서 검색한다.
skill은 brain에서 찾은 회사와 역할을 대응하는 `applications/<company>/<position>/` 경로로 해석해 실행 스크립트에 명시적으로 전달한다.
TypeScript 스크립트가 brain을 직접 조회하지 않는다.

`scripts/interview-drill/`은 `interview-practice`의 기술·인성 모드에서 공통 진행과 복습 상태를 처리한다.
공고별 `evidence/interview-questions.json`을 명시하면 포지션 질문 세 개와 공통 기반 질문 두 개를 기본으로 섞는다.
`follow-up-policy.ts`는 답변 수준에 따른 꼬리질문 축과 최대 깊이를 제공한다.
복습 상태는 `state/drill-progress.json` 하나에 저장한다.
후보풀과 리포트 중간 파일처럼 다시 만들 수 있는 실행 자료는 `state/`에 두지 않는다.

`config/interview-question-sources.ts`는 공식 문서, 기술 블로그, 공개 영상과 GitHub 가이드의 역할을 구분한다.
`scripts/interview-question-sources/`는 기존 읽을거리 수집 어댑터를 재사용해 실행별 후보풀을 만들고 설정과 후보 형식을 검증한다.
수집 후보는 질문의 정답 근거가 아니며, 공개 질문의 답변 신호는 공식 참조에서 다시 검증한다.

`public/question-bank/sources.json`은 공개 공통 질문이 참조하는 공식 URL과 확인일을 관리한다.
공개 질문 보강은 `interview-practice`의 필요할 때만 읽는 참고 문서가 안내한다.
`scripts/question-bank-collector/validate.ts`는 독립된 검증 모듈로 남아 질문 구조, 공개 범위, 출처 등록과 URL 형식을 검사한다.

## 아침 읽을거리

`config/external-reading-sources.ts`는 읽을거리 소스와 어댑터 종류를 타입 안전하게 관리한다.
`scripts/study-topic-recommender/source/`는 글과 영상 피드 수집 경계다.
후보풀, 선별, 누적 이력, 공부 주제 구성과 HTML 렌더링은 각각 분리된 모듈이 담당한다.
실행기는 시스템 임시 디렉터리 아래의 명시적인 실행 경로만 사용하며 저장소에 리포트 디렉터리를 만들지 않는다.
누적 추천 이력은 `state/morning-study-history.json`에 두고 홈서버 S3 release로 동기화한다.
임시 실행 경로는 누적 이력을 읽기만 하며, 출력 검증이 끝난 뒤 별도 완료 동작이 이력을 원자적으로 갱신한다.
YouTube 채널은 공식 Atom 피드를 우선 사용하고 피드를 읽을 수 없을 때만 공개 채널 페이지를 보조 경로로 사용한다.

다음은 명시적으로 선택하는 library 모드의 현재 클라이언트 구조다.
클라이언트는 mock HTTP로 검증했으며 운영 서버 적용과 웹 UI 구현은 별도 작업이다.
현재 기본 실행은 기존 파일모드 구조를 따른다.
실행 CLI와 실패 복구는 [`flow.md`](flow.md#학습자료-api-연동모드)가 소유하고, 저장 모델과 payload 매핑은 [`data-schema.md`](data-schema.md#학습자료-api-연동-상태)가 소유한다.
`scripts/study-topic-recommender/study-library/`는 fos-blog 학습자료 API 호출, 서비스 인증 헤더, 응답 Zod 검증과 기존 후보풀 타입 변환만 맡는다.
이 디렉터리는 MySQL 드라이버나 서버 저장 로직을 갖지 않으며, DB 스키마와 HTTP endpoint 정의는 [fos-blog 학습자료 HTTP 계약](https://github.com/jon890/fos-blog/blob/study-library-planning/docs/api/study-library.md)을 단일 출처로 둔다.
`scripts/study-topic-recommender/source/archive/`는 sitemap과 YouTube uploads playlist 같은 과거 수집 cursor를 해석한다.
source 어댑터는 원문 발견과 메타 추출만 하고, 자료 저장과 cursor 진행은 study-library client가 API 응답으로 확인한다.
archive 진입점은 `config/external-reading-sources.ts`에 복제하지 않고 sourceKey별 registry로 둔다.
registry가 담는 소스별 진입점과 cursor 형식은 [`data-schema.md`](data-schema.md#학습자료-api-연동-상태)가 소유한다.

파일모드와 library 모드는 실행 진입점에서 분리한다.
기본 파일모드는 기존 `skill begin`, `state/morning-study-history.json`, `--commit-history` 흐름을 유지한다.
library 모드는 legacy state를 읽거나 `skill begin`에 의존하지 않고, 후보 조회와 추천 이력을 API에서 가져온다.
연동모드에서 API 호출이 실패하면 파일모드로 자동 전환하지 않는다.
연동모드는 후보 준비, HTML 생성, 출력 검증, 추천 저장을 CLI 명령으로 분리한다.
검증 전에는 recommendation-runs를 저장하지 않는다.
단, 실제 legacy `state/morning-study-history.json`을 읽는 import preview는 기존 private 작업본 동기화가 필요하므로 `skill begin`과 `skill finish` 예외를 둔다.
`runtime-paths.ts`는 기존 `CAREER_OS_ROOT`와 새 `--run-dir`를 함께 해석한다.
둘 다 주어졌는데 다른 경로이면 사용법 오류로 중단하고, 둘 중 하나만 있으면 같은 시스템 임시 실행 경로 검증을 적용한다.
`validate_outputs.ts`도 같은 경로 해석을 사용한다.

연동모드는 다음 환경값을 사용한다.

| 이름                   | 의미                                                                             |
| ---------------------- | -------------------------------------------------------------------------------- |
| `STUDY_LIBRARY_URL`    | fos-blog API origin. HTTPS URL이며 path, query, hash와 credentials가 없어야 한다 |
| `STUDY_SERVICE_TOKEN`  | 서비스 인증 Bearer 토큰. 브라우저 세션과 별개다                                  |
| `YOUTUBE_DATA_API_KEY` | 선택값. 있으면 YouTube uploads playlist 과거 수집을 사용한다                     |

서비스 요청은 `Authorization: Bearer <STUDY_SERVICE_TOKEN>`을 보낸다.
브라우저 관리자 쿠키나 세션을 복제하지 않는다.
값이 없거나 origin 형식이 맞지 않으면 `--library` 실행은 시작 전에 실패한다.
fetch는 `redirect: "error"`와 timeout 10초를 적용한다.
네트워크 오류와 5xx 응답은 같은 본문과 같은 멱등 키로 최대 2회 재시도한다.
4xx 응답은 재시도하지 않는다.

구현 위치는 다음처럼 나눈다.

| 경로                                                               | 책임                                                                                                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/study-topic-recommender/study-library/client.ts`          | fetch, 인증 헤더, 오류 변환, 응답 검증                                                                                                                 |
| `scripts/study-topic-recommender/study-library/contracts.ts`       | API 소비 DTO의 Zod 스키마. 서버 계약 복제 대신 필요한 응답 모양만 검증                                                                                 |
| `scripts/study-topic-recommender/study-library/source-sync.ts`     | sourceKey 등록, version 조회와 config 변환                                                                                                             |
| `scripts/study-topic-recommender/study-library/ingestion.ts`       | mode별 cursor 조회, 자료 배치 저장과 멱등 키 생성                                                                                                      |
| `scripts/study-topic-recommender/study-library/candidates.ts`      | 후보 페이지 조회와 기존 후보풀 변환                                                                                                                    |
| `scripts/study-topic-recommender/study-library/recommendations.ts` | 기존 report를 recommendation-runs와 publications 요청으로 변환                                                                                         |
| `scripts/study-topic-recommender/study-library/imports.ts`         | legacy history와 Pages manifest를 import preview payload로 변환                                                                                        |
| `scripts/study-topic-recommender/source/archive/`                  | sitemap index, 단일 sitemap posts 필터, YouTube uploads playlist cursor 해석                                                                           |
| `scripts/study-topic-recommender/morning_reading_cli.ts`           | `--run-dir`, `--library`, `--mode`, `--source-key`, `--prepare-candidates`, `--commit-recommendation`, `--record-publication`, `--import-preview` 분기 |
| `scripts/study-topic-recommender/runtime-paths.ts`                 | `CAREER_OS_ROOT`와 `--run-dir` 공통 경로 검증. 둘 다 있으면 값이 같을 때만 허용                                                                        |
| `scripts/study-topic-recommender/validate_outputs.ts`              | `--run-dir` 또는 공통 경로 해석 결과로 report와 HTML 검증                                                                                              |

새 런타임 의존성은 추가하지 않는다.
Bun, TypeScript, fetch와 기존 Zod 의존성으로 구현한다.

수집 단계는 등록된 소스의 글과 영상을 결정적으로 가져온다.
코드는 URL을 정규화한 `contentKey`로 이전 추천을 판정하고 모델 선택 검증에서 재선택을 거부한다.
모델은 고정 키워드 점수 대신 수집된 자료의 내용과 사용자 방향을 바탕으로 커리어에 전이할 판단이 있는 자료를 고른다.
렌더러는 카테고리별 자료 목록이 아니라 공부 주제, 커리어 질문과 연결 자료를 표시한다.
별도 AI 전용 소스나 AI 전용 리포트 구역은 두지 않는다.

## 리포트 게시

외부 게시용 HTML은 시스템 임시 디렉터리에 만든다.
실행 경로 바로 아래에 검증할 구조화 데이터와 HTML 등 해당 skill의 산출물을 두며 별도 `reports/` 계층을 만들지 않는다.
외부 공유가 요청되면 루트의 `report-publisher` skill이 민감 정보 검사, Cloudflare Pages 게시, URL 검증을 담당한다.
게시가 끝나면 임시 HTML을 삭제한다.
사용자가 로컬 사본을 요청한 경우에만 지정한 경로에 보존한다.

개인 연락처와 비공개 지원 전략이 있는 이력서는 공개 리포트 게시 흐름과 분리한다.

## 외부 경계

- 채용 사이트와 기술 블로그는 읽기 전용 입력이다.
- `sources/fos-study/`는 별도 Git 저장소다.
- `.env`는 Git에 커밋하지 않는다.
- 홈서버 주소, 계정과 저장 경로는 환경 설정에서만 주입하고 공개 문서나 결과 JSON에 기록하지 않는다.
- 비공개 작업 파일의 이전 release와 복구 경계는 홈서버 private 인프라가 소유한다.
- 외부 제출과 공개 게시에는 사용자 승인이 필요하다.
