# 데이터 구조

career-os는 사람이 관리하는 설정, 실행 상태, 비공개 산출물, 공개 자료, 재생성 가능한 결과를 경로별로 분리한다.

## 저장 원칙

- `config/`에는 오래 유지할 프로필과 정책을 둔다.
- `state/`에는 실행 사이에 유지할 현재 상태를 둔다.
- `applications/`와 `private/`에는 개인 지원 자료를 둔다.
- `reports/`에는 구조화 결과와 사람이 읽는 리포트를 둔다.
- `cache/`에는 원본에서 다시 만들 수 있는 수집 결과를 둔다.
- `public/`과 `sources/fos-study/`에는 공개 가능한 자료만 둔다.

## Config

### `config/candidate-profile.md`

추천과 지원 문서가 공통으로 읽는 후보자 요약이다.

포함 내용:

- 목표 역할과 선호 방향
- 경력 기간과 주요 역할
- 확인된 강점과 대표 성과
- 과장하면 안 되는 소유권·수치 경계
- 최신 경력 자료와 작업 근거 링크

세부 프로젝트 사실을 여러 설정 파일에 복제하지 않는다.
최신 이력 자료와 실제 저장소를 함께 확인한다.

### `config/position-collection.ts`

외부 채용 소스의 탐색 범위를 관리하는 TypeScript 설정이다.
Zod 검증을 통과한 값만 수집 코드가 사용한다.

현재 필드:

- `wanted.jobGroupId`: Wanted 직군 식별자

후보자 선호와 회사 평가는 이 파일에 넣지 않는다.

### `config/verified-company-research-targets.json`

회사별 공식 채용 페이지, 수집 어댑터, 검색 이름, 기술 블로그를 관리한다.
회사가 좋은지 여부를 확정하는 목록이 아니라 탐색 채널 목록이다.

### `config/position-filters.json`

사용자가 명시적으로 억제한 개별 공고만 관리한다.

- `suppressedPostings`: 추천 결과에서 숨길 개별 공고 URL과 이유

회사 이름으로 후보를 수집 단계에서 제외하지 않는다.
회사별 선호, 탈락 이력과 지원 우선순위는 private brain의 현재 커리어 상태를 검색해 추천 순위에서 판단한다.

### `config/external-reading-sources.ts`

아침 읽을거리의 외부 글·영상 소스와 수집 어댑터를 관리한다.
소스 식별자는 회사나 매체를 나타내며 특정 주제를 포함하지 않는다.

주요 필드:

- `key`, `title`, `category`
- `adapter`
- `feedUrl` 또는 `url`
- `enabled`
- 출처 분류

## State

### `state/drill-progress.json`

기술·인성 면접 답변 연습의 진행과 복습 상태를 관리한다.

포함 내용:

- 질문별 시도와 최근 결과
- 다시 볼 질문과 복습 시점
- 기술·인성 모드가 공유하는 진행 정보

학습 주제 생성 상태와 섞지 않는다.

### 실행 중 생성되는 읽을거리 데이터

읽을거리 실행은 시스템 임시 경로에 후보풀, 선별 결과와 이력을 만든다.
게시와 검증이 끝나면 실행별 데이터를 정리한다.

## 공고 후보풀과 추천 결과

### 공고 후보풀

수집기는 각 외부 공고를 공통 형태로 변환한다.

핵심 필드:

- 소스와 외부 식별자
- 회사와 공고명
- 개별 공고 URL
- 게시일과 마감일
- 활성 상태
- 역할 설명과 요구 경력
- 수집 시각

활성 상태를 확인할 수 없거나 개별 공고 URL이 없는 항목은 추천 후보로 승격하지 않는다.

### 실행 중 생성되는 포지션 추천 데이터

모델이 임시 후보풀에서 선별한 실행별 추천 결과다.
형식은 `scripts/position-recommender/recommendation_schema.ts`가 검증한다.

핵심 필드:

- 실행 날짜와 후보풀 출처
- 추천 공고 목록
- 공고별 지원 판단과 근거
- 요구사항 대비 확인된 강점과 위험
- 후보풀 전체의 적합도 순위와 공개 가능한 한 줄 판단
- 다음 행동

추천 항목의 URL과 공고 정보는 후보풀 원문과 일치해야 한다.
전체 후보 순위는 1부터 후보 수까지 이어지며 모든 후보 ID를 한 번씩 포함한다.
강력 추천과 도전 추천의 순위는 전체 후보 순위와 일치한다.
강력 추천, 도전 추천과 보류·주의 목록에는 고정 개수 제한을 두지 않는다.
모델은 후보풀 전체를 분석하고 기준을 통과한 공고를 모두 분류하며, 정해진 개수를 채우려고 기준 미달 공고를 올리지 않는다.
게시용 HTML은 이 결과에서 만든다.
후보풀, 추천 JSON과 HTML은 게시 검증 뒤 삭제한다.

## 지원 패키지

공고별 `applications/<company>/<position>/`에는 다음 산출물을 둘 수 있다.

- `candidate-interview.md`: 후보자 원문 답변, 정리한 핵심과 제출 반영 여부
- `application-package.md`: 공고·회사 기준, 후보자 근거, 지원 판단, 승부처, 공백과 다음 행동을 담은 원본
- `resume-draft.md`: HTML과 PDF로 변환할 제출용 이력서 원본
- `interview-questions.json`: 공고 책임, 근거 방어와 경험 공백에서 만든 포지션별 질문

위 네 파일이 기본 원본이다.
`application-package.html`은 기본 원본과 현재 제출 파일을 묶은 로컬 검토 화면이다.
지원 사이트가 별도 문항을 요구하면 `application-answers.md`를 추가한다.
경력기술서를 받는 공고에는 `career-description-draft.md`를 추가한다.
최종 제출 단계에서는 `resume.html`과 `resume.pdf`를 파생한다.
경력기술서가 필요한 지원 건은 `career-description.html`, `career-description.pdf`와 한 파일 제출용 `submission.pdf`를 추가한다.
`submission-manifest.json`은 각 PDF의 파일 해시와 원본 HTML의 문구 해시를 연결한다.

`application-package.md`의 준비 상태는 `ready`, `needs_user_input`, `revise`, `do_not_apply` 중 하나다.
이 상태는 합격 가능성 점수가 아니라 현재 근거와 사용자 확인을 기준으로 한 제출 준비 상태다.

개인 근거와 면접 준비는 `private/<company>/<position>/`에 둔다.

## 제출 문서 근거 감사

근거 감사 자료는 대상 제출 문서와 같은 `applications/<company>/<position>/`에 둔다.

주요 파일:

- `claim-ledger.json`: 이력서 주장, 근거, 판정, 소유권 범위
- `evidence-audit.md`: 사람이 읽는 근거 감사 결과
- `resume-scorecard.md`: 이력서 평가와 남은 개선점
- `career-description-claim-ledger.json`: 경력기술서 주장과 근거 판정
- `career-description-scorecard.md`: 경력기술서 평가와 남은 개선점
- `submission-manifest.json`: 현재 HTML과 PDF 제출 묶음의 해시

근거 장부는 대상 HTML의 내용 해시와 연결해 다른 버전의 증거를 잘못 재사용하지 않게 한다.
`schemaVersion: 2`부터 기술 범위, 경력 기간, 운영과 숙련도 주장은 `experienceDepth`에 사용, 기능 개발, 운영 깊이 또는 사용자 확인 수준을 기록한다.
`safe`가 아닌 판정이 하나라도 남으면 제출 준비가 끝난 것으로 보지 않는다.
`resume-scorecard.md`에는 블라인드 채용 담당자·기술 리더 판정, 경쟁상 차단 항목, 근거 방어 결과와 통제할 수 없는 위험을 기록한다.
총점만으로 `pass`를 만들지 않으며 두 블라인드 검토자가 모두 통과해야 한다.

## 면접 자료

현재 지원 대상은 private brain에서 찾고 대응하는 `applications/<company>/<position>/`을 실행 경로로 사용한다.
포지션별 질문은 해당 지원 디렉터리의 `interview-questions.json`에 둔다.
공개 가능한 일반 질문은 `public/question-bank/`에 둔다.
질문 출처의 공식 URL, 게시자, 확인일과 적용 범위는 `public/question-bank/sources.json`에 둔다.
각 질문의 `source`는 이 레지스트리의 식별자를 참조한다.
개인 경험에서 파생한 질문은 `private/question-bank/`에 둔다.

## 아침 읽을거리

수집 후보는 외부 원문 URL, 출처, 제목과 게시 시각을 포함한다.
피드가 제공하는 경우 요약 판단에 사용할 공개 설명문을 `excerpt`에 담는다.
선별 결과는 같은 항목 식별자를 참조한다.

리포트 항목에는 다음 정보를 담는다.

- 카테고리
- 제목과 원문 URL
- 출처
- 간단한 요약
- 추천 이유

원문에 없는 예상 학습 시간, 난이도, 분야를 임의 기본값으로 채우지 않는다.
값이 필요하지만 확인할 수 없으면 명시적으로 정보가 없다고 표시한다.

## Reports와 Cache

- `reports/latest/`: 다른 도구가 읽을 최신 구조화 결과
- 시스템 임시 디렉터리: 게시 전 공개 가능 HTML과 실행별 중간 데이터
- `reports/*.md`: 사람이 읽는 로컬 리포트
- `cache/`: 피드와 공고에서 다시 만들 수 있는 중간 결과

HTML 게시 전에는 개인 정보, 비공개 업무 내용, 로컬 절대 경로를 검사한다.
포지션 추천 HTML은 전체 추천 중 상위 3건의 우선 검토 카드, 나머지 추천의 압축 목록, 별도 보류·주의 목록과 전체 후보 순위의 접이식 검색 목록으로 표시한다.
외부 공유 URL은 `report-publisher` skill이 게시와 검증을 마친 뒤 제공한다.
게시용 임시 파일은 검증 뒤 삭제하며 사용자가 보존을 요청한 경우에만 지정 경로에 남긴다.

## 보존과 공개 범위

- `config/`와 공개 질문 은행은 검토 후 Git으로 관리한다.
- 현재 지원 대상과 회사별 지원 판단은 private brain에서 관리한다.
- cache와 다시 만들 수 있는 중간 리포트는 장기 이력으로 취급하지 않는다.
- 개인 연락처, 회사별 지원 전략, 근거 감사 원문은 공개 리포트에 포함하지 않는다.
- 경력 자료를 공개할 때도 비공개 회사 정보와 로컬 경로를 제거한다.
