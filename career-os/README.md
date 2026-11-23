# career-os

커리어 전환의 공고 탐색, 지원 준비, 면접 연습, 학습 자산을 파일과 agent skill로 관리하는 개인 운영 워크스페이스다.

## 시작

스킬은 모두 fos-assistant 의 커리어 에이전트에서 돈다. 현재 작업에 맞는 skill을 대화에서 부른다.
각 skill은 `SKILL.md`에 입력, 산출물, 검증, 안전 경계를 담는다.

- 지원 가능한 공고를 찾을 때: plugin 의 `position-recommender`
- 공고별 지원 판단과 전략을 준비할 때: plugin 의 `application-package-writer`
- 이력서·경력기술서를 작성하고 검증할 때: plugin 의 `resume-preparer`. 제출 문서를 평가하고 고칠 때: `resume-review`
- 기술·인성 면접을 연습할 때: plugin 의 `interview-practice`. 공고별 질문으로 연습하거나 질문을 더 찾을 때: plugin 의 `interview-question-prep`
- 읽을거리를 수집하고 오늘 읽을 자료를 골라 HTML 리포트를 만들 때: plugin 의 `study-collection`
- 맥락 문서와 프로필 원고를 고치고 원티드와 GitHub 프로필을 갱신할 때: plugin 의 `career-connector`

`application-package-writer`는 전체 지원 요청에서 `resume-preparer`까지 연결한다.
공개 질문 보강은 [`public/question-bank/MAINTENANCE.md`](public/question-bank/MAINTENANCE.md)의 저장소 유지 절차로 한다.
각 스킬의 입력, 산출물, 검증, 안전 경계는 해당 `SKILL.md`에서 확인한다.

fos-assistant 의 커리어 에이전트에서 문서를 고치고, 면접을 연습하고, 공고와 공부 자료를 추천받고, GitHub 프로필을 갱신할 때는 `plugin/` 의 커리어 커넥터를 쓴다. 스킬은 셸 실행 공간에서 돌고 데이터는 에이전트 주인의 작업 폴더와 기억에 있다.
자세한 것은 [`docs/code-architecture.md`](docs/code-architecture.md)의 「fos-career 커넥터」를 따른다.
실행기가 읽는 환경 변수는 [`docs/data-schema.md`](docs/data-schema.md#로컬-실행기-환경-변수)를 따른다.

## 공식 링크

`plugin/connector.json`의 루트 필드로 링크 목적지를 선언한다.

- `link`: [커리어 프로젝트](https://github.com/jon890/fos-agents/tree/main/career-os). `link_kind: project`는 GitHub 프로젝트 디렉터리라는 뜻이다.
- `readme_url`: [커리어 README](https://github.com/jon890/fos-agents/blob/main/career-os/README.md). 제품 범위와 시작 흐름을 안내하는 문서다.

이 선택 필드를 지원하지 않는 구버전 fos-assistant에서는 링크가 표시되지 않는다. 화면에 링크를 표시하려면 새 카탈로그 reader와 UI가 함께 반영되어야 한다.

## 설정

clone 뒤에는 `.env.example`에서 필요한 키 이름을 확인한다. `.env`는 워크스페이스 루트에 두고 git에 올리지 않는다.
현재 경력, 역할 선호, 경험 경계와 지원 상태는 커리어 에이전트 주인의 기억에 있는 후보자 맥락 문서가 기준 원본이다.
연락처와 신원을 담은 지원서 공통 프로필도 같은 기억에 「커리어: 지원서 공통 프로필」 로 있다.
지원 자료(`applications/`, `library/`, `state/`)는 저장소가 아니라 커리어 에이전트의 작업 폴더에 있고 기기 사이에 동기화하지 않는다.
에이전트 사용량은 세션 기록이 있는 기기에서 `scripts/agent-usage/collect_usage.ts` 가 그 기기의 파일에 쌓는다.
진행 중인 지원 대상은 후보자 맥락 문서 `application-state` 에서 확인하고 공고별 실행 자료는 `applications/<company>/<role>/`에서 관리한다.

## 작업 흐름

1. 활성 공고를 수집하고 지원 후보를 판단한다.
2. 공고별 지원 패키지를 만들고 근거 감사, 블라인드 평가와 HTML·PDF 검증을 통과할 때까지 제출 문서를 개선한다.
3. 면접 답변 연습 결과를 다음 복습과 준비 행동에 반영한다.
4. 기술 학습과 질문 은행은 공개 가능한 자산으로 축적한다.

세부 흐름은 [docs/flow.md](docs/flow.md)를 따른다.

## 데이터 경계

층별 저장 위치는 [`docs/code-architecture.md`](docs/code-architecture.md)의 「데이터 폴더」가 소유한다.
외부로 나가는 동작의 승인 경계는 [`AGENTS.md`](AGENTS.md)의 「작업 경계」가 소유한다.

## 검증

문서 변경 뒤에는 현재 파일 구조와 낡은 실행기·경로·전달 매체 표현이 남았는지 확인한다.
구조 변경이면 `scripts/`, `config/`, `applications/`, `library/`, `state/`, `cache/`와 시스템 임시 산출물의 설명을 대조한다.

TypeScript 스크립트 변경이 있으면 루트에서 `bunx tsc --noEmit`과 해당 스크립트의 검증 명령을 실행한다.

`plugin/` 을 고쳤을 때의 검증 명령은 `docs/code-architecture.md` 의 「fos-career 커넥터」에 있다.

GitHub Actions의 [커넥터 계약 검증](../.github/workflows/connector-contracts.yml)은 main 대상 PR과 main push에서 plugin과 관련 로컬 실행기의 테스트, plugin 타입 검사를 Bun 1.3.14로 실행한다.
SDK 초기화·도구 목록과 manifest 이름·정책, 번들 일치 검사를 포함하며 비밀 값이나 실제 Backend·GitHub API를 사용하지 않는다.

## 문서

문서별 책임과 언제 보는지는 [AGENTS.md](AGENTS.md)의 「읽기 순서」 표를 따른다.
