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

사용자가 명시적으로 정한 지속적인 제외만 관리한다.

- `excludedCompanies`: 수집 단계에서 제외할 회사명
- `suppressedPostings`: 추천 결과에서 숨길 개별 공고 URL과 이유

일시적인 회사 쿨다운은 이 파일에 넣지 않는다.

### `config/external-reading-sources.ts`

아침 읽을거리의 외부 글·영상 소스와 수집 어댑터를 관리한다.
소스 식별자는 회사나 매체를 나타내며 특정 주제를 포함하지 않는다.

주요 필드:

- `key`, `title`, `category`
- `adapter`
- `feedUrl` 또는 `url`
- `enabled`
- 출처 분류

### `config/current-target.example.json`

로컬 현재 지원 대상 파일의 예시다.
실제 값은 `state/current-target.json`에 두며 커밋하지 않는다.

## State

### `state/current-target.json`

선택된 현재 지원 대상 하나를 담는 선택적 로컬 파일이다.
파일이 없으면 선택된 대상이 없다.

최상위 `primary`에 현재 대상 하나를 둔다.

필수 필드:

- `company`, `role`
- `company_slug`, `position_slug`
- `data_root`

선택 필드:

- `team`, `position_focus`, `notes`
- `interview_date`
- `interview.first_round`, `final_round`, `offer_chat`

형식은 `scripts/current-target/current_target_schema.ts`가 검증한다.
`data_root`는 `private/<회사 식별자>/<포지션 식별자>` 형태다.
과거 대상 이력은 이 파일에 누적하지 않는다.

### `state/drill-progress.json`

기술·인성 답변 드릴의 진행과 복습 상태를 관리한다.

포함 내용:

- 질문별 시도와 최근 결과
- 다시 볼 질문과 복습 시점
- 기술·인성 드릴이 공유하는 진행 정보

학습 주제 생성 상태와 섞지 않는다.

### `state/company-cooldown.json`

특정 회사를 일정 기간 추천에서 낮추거나 제외하는 운영 상태다.
지속적인 제외 정책과 분리하며, 기한이 끝나면 다시 평가할 수 있어야 한다.

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
- 다음 행동

추천 항목의 URL과 공고 정보는 후보풀 원문과 일치해야 한다.
게시용 HTML은 이 결과에서 만든다.
후보풀, 추천 JSON과 HTML은 게시 검증 뒤 삭제한다.

## 지원 후보와 패키지

`scripts/application-agent/positions_queue_schema.ts`가 지원 후보 상태를 정의한다.
상태 변경은 action request와 안전 검사를 통과한 뒤 적용한다.

공고별 `applications/<company>/<position>/`에는 다음 산출물을 둘 수 있다.

- 적합도 분석
- 지원 패키지
- 이력서 초안
- 자기소개 자료
- 제출 점검표
- reviewer 판정

개인 근거와 면접 준비는 `private/<company>/<position>/`에 둔다.

## 이력서 근거 감사

`private/resume-audit/<resume-id>/`는 공개하지 않는 검증 자료다.

주요 파일:

- `claim-ledger.json`: 이력서 주장, 근거, 판정, 소유권 범위
- `evidence-audit.md`: 사람이 읽는 근거 감사 결과
- `resume-scorecard.md`: 이력서 평가와 남은 개선점

근거 장부는 대상 HTML의 내용 해시와 연결해 다른 버전의 증거를 잘못 재사용하지 않게 한다.

## 역할 진단과 면접 자료

`job-fit-analyzer`는 구조화 JSON을 만들고 Markdown을 표시 결과로 만든다.
결과에는 지원 판단, 경력 연결점, 면접 전략, 다음 행동을 포함한다.

개인 면접 자료는 `private/<company>/<position>/interview/`에 둔다.
공개 가능한 일반 질문은 `public/question-bank/`에 둔다.
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
외부 공유 URL은 `report-publisher` skill이 게시와 검증을 마친 뒤 제공한다.
게시용 임시 파일은 검증 뒤 삭제하며 사용자가 보존을 요청한 경우에만 지정 경로에 남긴다.

## 보존과 공개 범위

- `config/`와 공개 질문 은행은 검토 후 Git으로 관리한다.
- 로컬 현재 대상과 실행 상태는 필요할 때만 유지한다.
- cache와 다시 만들 수 있는 중간 리포트는 장기 이력으로 취급하지 않는다.
- 개인 연락처, 회사별 지원 전략, 근거 감사 원문은 공개 리포트에 포함하지 않는다.
- 경력 자료를 공개할 때도 비공개 회사 정보와 로컬 경로를 제거한다.
