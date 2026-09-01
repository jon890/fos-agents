# 데이터 구조

career-os는 사람이 관리하는 설정, 실행 상태, 비공개 산출물, 공개 자료, 재생성 가능한 결과를 경로별로 분리한다.

## 저장 원칙

- `config/`에는 오래 유지할 프로필과 정책을 둔다.
- `applications/`, `library/`와 `state/`는 홈서버 release와 동기화하는 로컬 작업본이다.
- `cache/`에는 원본에서 다시 만들 수 있는 수집 결과를 둔다.
- `public/`과 `sources/fos-study/`에는 공개 가능한 자료만 둔다.
- 게시용 HTML과 실행별 중간 데이터는 시스템 임시 디렉터리에 두고 검증 뒤 삭제한다.

## 비공개 작업 release

홈서버의 각 release는 `applications`, `library`, `state`와 `workspace-manifest.json`을 가진다.
release 디렉터리는 생성 뒤 수정하지 않으며 검증을 통과한 release만 `current` 상대 링크가 가리킨다.

manifest는 다음 필드를 가진다.

- `schemaVersion`: 현재 값 `1`
- `workspace`: 고정값 `career-os`
- `revision`: 홈서버가 부여한 release 식별자
- `parentRevision`: publish가 시작할 때 확인한 이전 revision
- `createdAt`: 홈서버가 기록한 UTC 시각
- `producer`: 결과를 만든 skill과 `interactive` 또는 `automation` 실행 방식
- `contentDigest`: 정렬한 파일 경로, 크기와 SHA-256에서 만든 전체 digest
- `files`: 상대 경로, byte 크기와 SHA-256 목록

파일 경로는 `applications/`, `library/`, `state/` 중 하나로 시작해야 한다.
일반 파일만 허용하고 symlink, `.env`, `.omc`, log, cache와 임시 파일은 거부한다.
같은 `contentDigest`를 다시 publish하면 새 release를 만들지 않는다.

로컬 `career-os/.career-sync/sync-state.json`은 마지막으로 준비한 `revision`, `contentDigest`와 파일 hash를 기록한다.
`skill-session.json`은 성공한 작성 skill의 이름, 시작 revision과 시작 시각을 기록한다.
같은 skill의 완료 단계만 이 기록을 소비할 수 있으며 성공한 발행이나 무변경 종료 뒤 삭제한다.
prepare 중에는 같은 디렉터리의 임시 staging, backup과 `prepare-journal.json`으로 세 관리 root의 교체·복구 상태를 기록한다.
이 디렉터리는 Git과 원격 release에 포함하지 않는다.
prepare는 현재 로컬 hash가 마지막 동기화 상태와 다르면 파일을 교체하지 않으며, 중단된 journal이 있으면 새 작업 전에 기존 root를 복구한다.

`prepare-journal.json`은 transaction 식별자, `started`, `staged`, `backed_up`, `applied`, `restoring`, `restored`, `completed` 상태와 root별 `hadOriginal`, `backupDone`, `applyDone`을 기록한다.
`started`와 `staged`는 기존 root를 건드리지 않았으므로 staging만 정리한다.
`backed_up`, `applied`와 `restoring`은 root별 상태와 실제 경로를 대조해 새 root를 제거하고 backup을 복구한다.
원래 root가 없던 항목은 `hadOriginal: false`로 기록하고 복구 때 새 root만 제거한다.
`completed`는 새 root와 `sync-state.json`의 hash가 일치할 때만 backup과 journal을 정리한다.
기록과 실제 경로가 모순되면 자동 판단하지 않고 `RESTORE_REQUIRED`로 중단한다.

## 비공개 작업 전송 계약

원격 명령은 다음 세 동작만 제공한다.

- `career-storage status`: 본문 없이 호출하고 `RemoteStatusResult` JSON을 stdout으로 반환한다.
- `career-storage export --revision <revision>`: 해당 immutable release를 tar stdout으로 반환한다.
- `career-storage publish`: `workspace-draft.json`과 세 관리 root가 든 tar를 stdin으로 받고 `RemotePublishResult` JSON을 stdout으로 반환한다.

export tar의 최상위에는 `workspace-manifest.json`, `applications/`, `library/`, `state/`만 허용한다.
publish tar의 최상위에는 `workspace-draft.json`과 같은 세 관리 root만 허용한다.

`RemoteStatusResult`는 `schemaVersion`, `action: "status"`, `ok: true`, `workspace`와 nullable `current`를 가진다.
`current`는 `revision`, `contentDigest`, `createdAt`, `fileCount`를 가진다.
`RemotePublishResult`는 `schemaVersion`, `action: "publish"`, `ok: true`, `revision`, `contentDigest`, `createdAt`, `fileCount`, `noChange`를 가진다.

성공 JSON만 stdout에 기록한다.
실패는 nonzero 종료 코드와 stderr의 `schemaVersion`, `action`, `ok: false`, `code`를 가진 JSON으로 반환한다.
공통 오류 코드는 `WORKSPACE_DIRTY`, `REMOTE_UNINITIALIZED`, `REVISION_CONFLICT`, `INVALID_MANIFEST`, `TRANSFER_FAILED`, `TRANSPORT_UNAVAILABLE`, `RESTORE_REQUIRED`다.
오류에는 파일 본문, 호스트, 계정, key 경로와 비밀값을 포함하지 않는다.

Markdown, JSON, 검토용 HTML, PDF와 실제 제출 묶음은 해당 application 디렉터리 안에서 함께 동기화한다.
게시 뒤 삭제하는 공개 리포트와 원본에서 다시 만들 수 있는 cache는 release에 포함하지 않는다.

client의 `.env`는 작업 경로와 transport만 주입한다.
SSH 환경은 `CAREER_WORKSPACE_SSH_TARGET`, `CAREER_WORKSPACE_SSH_ARGS`와 `CAREER_WORKSPACE_REMOTE_COMMAND`를 사용한다.
홈서버의 Hermes는 `CAREER_WORKSPACE_LOCAL_TRANSPORT_ROOT`로 같은 저장소를 직접 읽는다.
근거 원장의 `${PROJECTS_ROOT}`와 `${PERSONAL_ROOT}`는 환경마다 같은 이름의 변수로 해석하며 release에는 환경별 절대 경로를 저장하지 않는다.

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
이 파일은 public 저장소에서 추적하지 않고 비공개 작업 release로 동기화한다.

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
`application-package-writer`는 지원 판단과 후보자 인터뷰를 관리하고, `resume-preparer`는 `resume-draft.md`와 제출 문서를 관리한다.
`application-package.html`은 기본 원본과 현재 제출 파일을 묶은 로컬 검토 화면이다.
지원 사이트가 별도 문항을 요구하면 `application-answers.md`를 추가한다.
경력기술서를 받는 공고에는 `career-description-draft.md`를 추가한다.
최종 제출 단계에서는 `resume.html`과 `resume.pdf`를 파생한다.
경력기술서가 필요한 지원 건은 `career-description.html`, `career-description.pdf`와 한 파일 제출용 `submission.pdf`를 추가한다.
`submission-manifest.json`은 각 PDF의 파일 해시와 원본 HTML의 문구 해시를 연결한다.

`application-package.md`의 준비 상태는 `ready`, `needs_user_input`, `revise`, `do_not_apply` 중 하나다.
이 상태는 합격 가능성 점수가 아니라 현재 근거와 사용자 확인을 기준으로 한 제출 준비 상태다.
첫 10줄의 `human-confirmation`은 동기, 본인 역할, 당시 제약, 기각한 대안과 결과의 확인 범위처럼 후보자만 확정할 수 있는 항목의 상태다.
값은 `complete` 또는 `needs_input`이며, `needs_input`이면 준비 상태를 `ready`로 둘 수 없다.

공고별 개인 근거와 면접 준비는 해당 `applications/<company>/<position>/`에 둔다.
여러 지원에서 재사용하는 개인 질문은 `library/question-bank/`에 둔다.
특정 지원에 종속되지 않는 이력서 기준본은 `library/resume-baselines/`에 둔다.

## 제출 문서 근거 감사

근거 감사 자료는 대상 제출 문서와 같은 `applications/<company>/<position>/`에 둔다.
작성, 근거 감사와 평가는 `resume-preparer`의 순차 단계이며 별도 사용자 스킬로 나누지 않는다.

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
개인 경험에서 파생한 질문은 `library/question-bank/`에 둔다.

`config/interview-question-sources.ts`는 질문 후보를 찾을 외부 출처를 관리한다.
각 출처는 고유 `key`, 출처 종류, 사용 역할, 주제, URL과 수집 어댑터를 가진다.
기술 블로그, 공개 영상과 GitHub 가이드는 사례 발견이나 범위 확인 역할만 가지며 정답 근거 역할을 가질 수 없다.

질문의 선택 `bar`는 다음 공개 능력 수준 중 하나다.

- `production`: 한 서비스의 정확성, 장애 복구와 운영 지표를 책임지는 수준
- `large-scale`: 대규모 제품과 여러 팀이 쓰는 계약, 용량과 변경 안전성을 판단하는 수준
- `global-scale`: 다중 리전과 조직 공통 기반의 실패 격리, 보안과 장기 trade-off를 주도하는 수준

현재 직장, 목표 회사와 개인 경험 경계는 private brain에서 실행할 때만 읽는다.
이 정보는 `bar` 값이나 공개 질문 본문에 복제하지 않는다.

실행별 `interview-source-candidates.json`은 시스템 임시 경로에 둔다.
각 후보는 출처 식별자, 출처 종류와 역할, 주제, 제목, URL, 게시 시각, 공개 설명과 자료 종류를 가진다.
후보풀은 질문 승격 뒤 삭제하며 장기 상태로 보존하지 않는다.

일별 답변 기록은 꼬리질문일 때 원 질문 식별자, 부모 질문, 깊이, 확인 축과 중단 이유를 선택 필드로 가진다.

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

## 임시 산출물과 Cache

- 시스템 임시 디렉터리: 게시 전 공개 가능 HTML, Markdown과 실행별 중간 데이터
- `cache/`: 피드와 공고에서 다시 만들 수 있는 중간 결과

HTML 게시 전에는 개인 정보, 비공개 업무 내용, 로컬 절대 경로를 검사한다.
포지션 추천 HTML은 전체 추천 중 상위 3건의 우선 검토 카드, 나머지 추천의 압축 목록, 별도 보류·주의 목록과 전체 후보 순위의 접이식 검색 목록으로 표시한다.
외부 공유 URL은 `report-publisher` skill이 게시와 검증을 마친 뒤 제공한다.
게시용 임시 파일은 검증 뒤 삭제하며 사용자가 보존을 요청한 경우에만 지정 경로에 남긴다.

## 보존과 공개 범위

- `config/`와 공개 질문 은행은 검토 후 Git으로 관리한다.
- 지원 원본, 개인 질문과 답변 연습 상태는 홈서버의 비공개 작업 release로 동기화한다.
- 현재 지원 대상과 회사별 지원 판단은 private brain에서 관리한다.
- cache와 다시 만들 수 있는 임시 산출물은 장기 이력으로 취급하지 않는다.
- 개인 연락처, 회사별 지원 전략, 근거 감사 원문은 공개 리포트에 포함하지 않는다.
- 경력 자료를 공개할 때도 비공개 회사 정보와 로컬 경로를 제거한다.
