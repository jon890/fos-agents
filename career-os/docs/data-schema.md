# 데이터 구조

career-os는 사람이 관리하는 설정, 실행 상태, 비공개 산출물, 공개 자료, 재생성 가능한 결과를 경로별로 분리한다.

## 저장 원칙

- `config/`에는 오래 유지할 수집 정책을 둔다.
- `applications/`, `library/`와 `state/`는 홈서버 `career-os` S3 collection의 release와 동기화하는 로컬 작업본이다.
- `cache/`에는 원본에서 다시 만들 수 있는 수집 결과를 둔다.
- `public/`과 `sources/fos-study/`에는 공개 가능한 자료만 둔다.
- 게시용 HTML과 실행별 중간 데이터는 시스템 임시 디렉터리에 두고 검증 뒤 삭제한다.

## 비공개 작업 release

홈서버의 `career-os` bucket은 release별 archive, manifest와 descriptor를 가진다.
`releases/<revision>/workspace.tar`, `releases/<revision>/workspace-manifest.json`과 `releases/<revision>/release.json`은 생성 뒤 수정하지 않는다.
검증을 통과한 release만 `pointers/current.json`이 가리킨다.

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

`releases/<revision>/release.json`은 `schemaVersion`, `workspace`, `revision`, `contentDigest`, `createdAt`, `fileCount`, `archiveKey`, `archiveSha256`, `manifestKey`, `manifestSha256`를 가진다.
과거 revision을 export할 때 이 descriptor를 기준으로 archive와 manifest의 hash를 검증한다.

`pointers/current.json`은 같은 식별·요약 필드와 `descriptorKey`, `descriptorSha256`을 가진다.
현재 pointer는 같은 revision의 `releases/<revision>/release.json`만 가리킬 수 있다.
archive를 export할 때는 `archiveSha256`, release manifest와 내부 파일 hash를 모두 검증한다.

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
홈서버의 Hermes는 command transport로 같은 `career-storage` 명령을 호출한다.
S3 endpoint, bucket과 credential은 홈서버 명령의 환경에만 두며 client에 전달하지 않는다.
근거 원장의 `${PROJECTS_ROOT}`와 `${PERSONAL_ROOT}`는 환경마다 같은 이름의 변수로 해석하며 release에는 환경별 절대 경로를 저장하지 않는다.

## 스킬 참조

### `.claude/skills/resume-preparer/references/resume-writing-style.md`

모든 공고의 이력서와 경력기술서에 공통으로 적용하는 작성 기준이다.
구체적인 업무를 먼저 쓰는 방법, 지표를 설명하는 순서, 전후 비교 조건과 실제 담당 범위를 관리한다.
`resume-preparer`는 제출 문서를 작성하거나 수정하기 전에 이 파일을 읽고 렌더링 전에 다시 점검한다.

### `.claude/skills/resume-preparer/references/resume-design.md`

모든 공고의 이력서와 경력기술서에 기본으로 적용하는 디자인 판단과 검증 기준이다.
기본 CSS는 `.claude/skills/resume-preparer/assets/resume.css`에 둔다.
공고별 스타일은 `export_resume.ts --design <path>`에 CSS 파일이나 `css` 코드 블록이 있는 Markdown 파일을 명시한다.

## Config

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

공고별 `applications/<company>/<position>/`는 세 층으로 나뉜다.
파일이 어느 층에 있는지가 누가 그 파일을 여는지를 정한다.

| 층 | 여는 주체 | 담는 것 |
| --- | --- | --- |
| 디렉터리 최상위 | 사용자 | `application-package.html`과 현재 공고가 요구하는 제출 PDF |
| `evidence/` | skill과 사람 | 기준 원본 Markdown과 구조화 입력 |
| `review/` | 검증기 | 근거 장부, 점수표, manifest와 제출 문서 HTML |

### 최상위

- `application-package.html`: 기준 원본과 현재 제출 파일을 묶은 로컬 검토 화면
- `resume.pdf`: 이력서 제출본
- `career-description.pdf`: 경력기술서를 받는 공고에만 둔다
- `submission.pdf`: 한 파일 제출을 요구하는 공고에만 둔다

### `evidence/`

- `posting.md`: 공고 원문을 항목으로 나눈 기준본이며 원문 표현이 판단을 가르는 곳은 낱말을 그대로 남긴다
- `candidate-interview.md`: 후보자 원문 답변, 정리한 핵심과 제출 반영 여부
- `application-package.md`: 공고 항목별 적합도, 후보자 근거, 지원 판단, 승부처, 공백과 다음 행동을 담은 원본
- `resume-draft.md`: HTML과 PDF로 변환할 제출용 이력서 원본
- `interview-questions.json`: 공고 책임, 근거 방어와 경험 공백에서 만든 포지션별 질문
- `career-description-draft.md`: 경력기술서를 받는 공고에만 둔다
- `application-form.json`: 브라우저 자동 입력을 준비할 때만 둔다

앞의 다섯이 기본 원본이다.
`application-package-writer`는 지원 판단과 후보자 인터뷰를 관리하고, `resume-preparer`는 `resume-draft.md`와 제출 문서를 관리한다.
`application-form.json`은 private brain 공통 프로필의 현재 스냅샷, 회사별 선택값, 첨부 파일과 서술형 질문을 구조화한다.
서술형 문항이 없는 지원 건은 `questions`를 빈 배열로 둔다.

### `review/`

- `resume.html`과 `career-description.html`: PDF를 만든 원본
- `claim-ledger.json`과 `career-description-claim-ledger.json`: 주장별 근거 장부
- `resume-scorecard.md`와 `career-description-scorecard.md`: 인사담당자와 실무담당자 리뷰 결과
- `submission-manifest.json`: 각 PDF의 파일 해시와 원본 HTML의 문구 해시를 연결한다

이 층의 파일은 사용자용 링크로 노출하지 않는다.
검증에는 사용하므로 현재 제출 문구와 PDF가 같은 버전인지 증명한다.

### 검토 화면

`application-package.html`은 준비 상태, 결론, 제출 PDF와 조건부 지원서 입력값을 탭 밖 상단에 고정한다.
본문은 `공고 적합도`, `지원 전략`, `공고 원문`, `상세 자료` 네 탭으로 나눈다.
`공고 적합도` 탭의 첫 내용은 공고 항목 하나에 한 행을 주는 적합도 표다.
`공고 원문` 탭은 `evidence/posting.md`를 읽어 보여주며 원문을 다른 파일에 복제하지 않는다.

지원 패키지 검증기는 이 스키마에 없는 파일과 층이 어긋난 파일을 거부해 일회성 검토 문서가 쌓이지 않게 한다.

### 적합도 판정과 점수

`evidence/application-package.md`의 「공고 항목별 적합도」 표는 공고 항목 하나에 한 행을 준다.
공고 한 줄에 컴포넌트가 여럿 들어 있으면 각각을 별도 행으로 쪼갠다.

표의 열은 `공고 항목`, `공고 구분`, `근거`, `판정` 넷이다.
`공고 구분`은 `주요 업무`, `기대 경험`, `우대 경험` 중 하나다.

| 판정 | 점수 | 기준 |
| --- | --- | --- |
| `확인됨` | 100 | 제출 문장으로 쓸 직접 근거가 있다 |
| `강한 인접` | 75 | 같은 문제 유형을 다뤘고 연결을 설명할 필요가 거의 없다 |
| `인접 경험` | 50 | 전환할 수 있지만 왜 같은 문제인지 설명해야 한다 |
| `공백` | 0 | 직접 근거가 없다 |
| `사용자 확인` | 계산 제외 | 후보자만 확정할 수 있어 아직 판정할 수 없다 |

| 공고 구분 | 가중치 |
| --- | --- |
| 주요 업무 | 3 |
| 기대 경험 | 2 |
| 우대 경험 | 1 |

총점은 `Σ(점수 × 가중치) ÷ Σ(100 × 가중치) × 100`이며 소수 첫째 자리까지 남긴다.
구분별 소계는 같은 식을 그 구분의 행에만 적용한다.
`사용자 확인` 행은 분자와 분모 양쪽에서 뺀다.

총점은 합격 확률이 아니다.
공고 요구와 현재 확보한 근거가 얼마나 맞닿아 있는지를 나타낸다.

검토 화면은 총점과 구분별 소계를 색이 있는 원으로 표시한다.

| 점수 구간 | 색 |
| --- | --- |
| 85 이상 | 진한 초록 |
| 65 이상 85 미만 | 초록 |
| 45 이상 65 미만 | 노랑 |
| 25 이상 45 미만 | 주황 |
| 25 미만 | 빨강 |

`evidence/application-package.md`의 준비 상태는 `ready`, `needs_user_input`, `revise`, `do_not_apply` 중 하나다.
이 상태는 합격 가능성 점수가 아니라 현재 근거와 사용자 확인을 기준으로 한 제출 준비 상태다.
첫 10줄의 `human-confirmation`은 본인 역할, 당시 제약, 기각한 대안, 결과의 확인 범위와 제출 문구 동의처럼 후보자만 확정할 수 있는 사실과 표현 확인 상태다.
값은 `complete` 또는 `needs_input`이며, `needs_input`이면 준비 상태를 `ready`로 둘 수 없다.

공고별 개인 근거와 면접 질문은 해당 `applications/<company>/<position>/`에 둔다.
여러 지원에서 재사용하는 개인 질문은 `library/question-bank/`에 둔다.
특정 지원에 종속되지 않는 이력서 원고 기준본은 `library/resume-baselines/`에 둔다.

재사용할 작성 취향의 기준 원본은 `.claude/skills/resume-preparer/references/resume-taste.md`다.
brain에는 경력, 역할 선호와 경험 경계 등 개인 지식을 두고, 지원별 사실과 표현 확인은 `evidence/candidate-interview.md`의 기존 계약을 따른다.
작성 취향은 스킬에서 유지하고, brain 검색 결과는 해당 문장을 판단하는 데 필요한 출처와 범위만 지원 기록에 연결한다.

## 제출 문서 근거 감사

근거 감사 자료는 대상 제출 문서와 같은 지원 디렉터리의 `review/`에 둔다.
파일 목록은 위 「지원 패키지」의 `review/`가 소유한다.
작성, 근거 감사와 평가는 `resume-preparer`의 순차 단계이며 별도 사용자 스킬로 나누지 않는다.

claim ledger를 다시 설명하는 evidence audit는 별도 파일로 만들지 않는다.
면접에서 확인할 질문은 필요할 때 `evidence/interview-questions.json`에 선택적으로 남긴다.
질문 생성 여부와 답변 여부는 제출 문서의 준비 상태를 결정하지 않는다.

근거 장부는 대상 HTML의 내용 해시와 연결해 다른 버전의 증거를 잘못 재사용하지 않게 한다.
`schemaVersion: 2`부터 기술 범위, 경력 기간, 운영과 숙련도 주장은 `experienceDepth`에 사용, 기능 개발, 운영 깊이 또는 사용자 확인 수준을 기록한다.
`safe`가 아닌 판정이 하나라도 남으면 제출 준비가 끝난 것으로 보지 않는다.
`review/resume-scorecard.md`에는 독립된 인사담당자와 실무담당자 판정, 경쟁상 차단 항목, 근거 방어 결과와 통제할 수 없는 위험을 기록한다.
정량 점수로 약한 필수 조건을 상쇄하지 않으며 두 블라인드 검토자가 모두 통과해야 한다.

## 면접 자료

현재 지원 대상은 private brain에서 찾고 대응하는 `applications/<company>/<position>/`을 실행 경로로 사용한다.
포지션별 질문은 해당 지원 디렉터리의 `evidence/interview-questions.json`에 둔다.
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

수집 후보는 외부 원문 URL, 정규화한 `contentKey`, 출처, 제목과 게시 시각을 포함한다.
피드가 제공하는 경우 요약 판단에 사용할 공개 설명문을 `excerpt`에 담는다.
`previouslyRecommended`는 누적 이력에 같은 `contentKey`가 있는지를 나타낸다.
후보풀의 `recentStudyTopicKeys`는 직전 리포트에 포함된 공부 주제 키다.
선별 결과는 같은 항목 식별자를 참조하며 `previouslyRecommended: true`인 후보를 선택할 수 없다.
직전 리포트와 같은 `topicKey`도 선택할 수 없다.

선별 결과와 리포트는 공부 주제 배열을 기준으로 사용한다.
각 공부 주제는 다음 정보를 담는다.

- `topicKey`: 날짜가 달라도 같은 개념을 식별하는 kebab-case 키
- `title`: 외부 자료에서 도출한 공부 주제
- `careerQuestion`: 현재 업무나 다음 역할에 적용해 볼 질문
- `items`: 주제에 연결한 한 개 이상의 추천 자료

각 추천 자료는 카테고리, 제목과 원문 URL, 출처, 간단한 요약, 추천 이유와 커리어 연결 유형을 가진다.
커리어 연결 유형은 `current-work`, `target-role`, `engineering-judgment`, `product-business` 중 하나다.

### `state/morning-study-history.json`

검증을 통과해 사용자에게 제공할 준비가 끝난 추천 자료의 누적 이력이다.
이 파일은 홈서버 비공개 작업 release로 동기화하며 임시 리포트와 분리한다.

- `schemaVersion`: 현재 값 `1`
- `reports`: 반영을 마친 일별 리포트 식별자와 추천 시각 배열
- `entries`: 과거 추천 자료 배열
- `entries[].contentKey`: 정규화한 원문을 식별하는 유일 키
- `entries[].canonicalUrl`: 추적 query와 fragment를 제거한 HTTPS 원문 URL
- `entries[].sourceKey`: 등록된 출처 식별자
- `entries[].category`: 수집 카테고리
- `entries[].title`: 추천 당시 제목
- `entries[].studyTopic`: 추천 당시 공부 주제
- `entries[].studyTopicKey`: 추천 당시 공부 주제의 안정적인 식별자
- `entries[].careerValue`: 추천 당시 커리어 연결 유형
- `entries[].recommendedAt`: 이력에 반영한 UTC 시각
- `entries[].reportId`: 추천이 포함된 일별 리포트 식별자

`contentKey`는 파일 안에서 유일해야 한다.
`reports[].reportId`도 파일 안에서 유일해야 하며 같은 날짜의 리포트를 두 번 반영하지 않는다.
다음 실행은 가장 최근 `reportId`의 `studyTopicKey`를 읽어 직전 리포트와 같은 주제 선택을 거부한다.
YouTube 영상은 video ID를 키에 포함하고 일반 글은 정규화한 URL의 SHA-256으로 키를 만든다.
이력 갱신은 임시 파일을 같은 디렉터리에 쓴 뒤 rename하며, 기존 이력을 읽거나 검증하지 못하면 빈 이력으로 대체하지 않는다.

원문에 없는 예상 학습 시간, 난이도, 분야를 임의 기본값으로 채우지 않는다.
값이 필요하지만 확인할 수 없으면 명시적으로 정보가 없다고 표시한다.

### 학습자료 API 연동 상태

이 절은 명시적으로 선택하는 library 모드의 현재 클라이언트 계약이다.
운영 서버 적용과 웹 UI 구현은 별도 작업이다.
현재 기본 실행의 누적 추천 이력은 위 `state/morning-study-history.json` 계약을 따른다.

`--library` 실행에서 누적 자료, 즐겨찾기, 읽음, 메모와 추천 이력은 fos-blog의 기존 MySQL에 있는 별도 study 테이블이 소유한다.
career-os는 이 테이블에 직접 접속하지 않고 HTTP API만 사용한다.
HTTP endpoint, 오류 코드와 저장 제약은 [fos-blog 학습자료 HTTP 계약](https://github.com/jon890/fos-blog/blob/study-library-planning/docs/api/study-library.md)이 단일 출처다.
이 저장소 문서는 클라이언트가 필요한 매핑과 로컬 설정만 설명한다.

career-os의 기존 `ReadingSource`는 API 소스 등록 요청으로 변환한다.
`key`는 `sourceKey`, `title`, `category`, `url`, `feedUrl`, `adapter`, `enabled`는 같은 의미로 보낸다.
API가 필수로 요구하는 `expectedVersion`은 `GET /sources` 결과의 version 또는 새 소스의 `0`에서 가져온다.
필드가 비어 있으면 추정값을 만들지 않고, 없는 URL 필드는 명시적인 `null`로 보낸다.
archive 수집 진입점은 config 필드가 아니라 sourceKey별 고정 registry가 소유하므로 `config/external-reading-sources.ts`의 schemaVersion은 바꾸지 않는다.
Kurly와 OliveYoung은 최근 수집에서는 계속 `feed` adapter이고, archive mode에서만 registry의 sitemap index 수집기를 사용한다.

API 후보 `Candidate`는 기존 후보풀의 `ReadingCandidate`로 변환한다.
`Candidate.id`는 `contentKey`이며 기존 선택 파일의 `candidateId`로 사용한다.
`recentStudyTopicKeys`는 후보풀의 같은 필드로 전달하고 `historyVersion`은 후보풀 옆 meta 파일에 보존한다.
`historyVersion`은 recommendation-runs 요청 본문에 넣지 않는다.
서버가 추천 저장 시점에 직전 주제와 누적 추천 집합을 다시 검증한다.
`previouslyRecommended`는 서버 응답값을 사용하며 로컬 파일 이력으로 덮어쓰지 않는다.
library 후보풀은 API 후보 조회 결과이므로 `collectionLog`를 빈 배열로 둔다.
HTML report의 counts는 `activeSources`를 `GET /sources`의 enabled 소스 수, `sourcesWithCandidates`를 후보에 나타난 sourceKey 수, `collectedArticles`를 후보풀 길이로 계산한다.
카테고리별 source count도 enabled 소스 목록에서 계산한다.

연동모드에서 cursor는 sourceKey와 mode별로 서버가 관리한다.
career-os가 해석하는 archive cursor의 내부 형태는 아래처럼 adapter별로 제한한다.
이 값은 API에는 opaque JSON으로 저장되며, 서버는 내용을 해석하지 않는다.

| adapter | mode | cursor 예시 | 의미 |
| --- | --- | --- | --- |
| `feed` | `recent` | `{"lastSeen":["url:..."],"fetchedAt":"2026-09-07T00:00:00.000Z"}` | 최근 피드 중 이미 본 정규 URL 키 |
| `page` | `archive` | `{"sitemapIndexUrl":"https://.../sitemap-index.xml","indexDigest":"sha256:...","pendingSitemaps":["https://.../post-sitemap.xml"],"completedSitemaps":[],"currentSitemap":null,"lastUrl":null,"done":false}` | sitemap index 기반 과거 URL 탐색 위치 |
| `page` | `archive` | `{"sitemapUrl":"https://tech.kakao.com/sitemap.xml","sitemapDigest":"sha256:...","onlyPathPrefix":"/posts/","lastUrl":"https://...","done":false}` | 단일 sitemap에서 posts URL만 읽은 위치 |
| `youtube` | `archive` | `{"uploadsPlaylistId":"UU...","pageToken":"...","pendingVideoIds":[],"apiKeyRequired":true,"done":false}` | YouTube Data API uploads playlist 페이지 안의 남은 영상 |
| `youtube` | `recent` | `{"rssOnly":true,"lastSeen":["youtube:..."]}` | API 키가 없어 RSS 최근 영상만 수집한 상태 |

sitemap index cursor의 `currentSitemapDigest`는 처리 중인 sitemap 본문 변경을 감지한다.
큰 목록을 축약하면 `pendingSitemapsTrimmed:true`와 누적 `completedSitemapCount`로 같은 index에서 남은 목록을 다시 계산한다.
YouTube archive cursor는 `pendingVideoIds`와 함께 `pendingVideos`에 아직 저장하지 않은 영상의 `videoId`, `title`, `published`를 보존한다.
`nextPageToken`은 현재 페이지의 남은 영상을 모두 저장한 뒤 사용할 다음 페이지 위치다.
마지막 페이지의 남은 영상까지 저장해야 `done:true`가 된다.

자료 배치 저장 요청의 `items`는 100개 이하로 보낸다.
recent의 `lastSeen`은 현재 정상 응답에서 확인한 기존 키와 이번 배치에 저장할 새 키를 보존한다.
아직 저장하지 않은 자료는 실행 한도에 걸렸더라도 `lastSeen`에 넣지 않는다.
다음 응답에 없는 키는 제거할 수 있으며, 다시 수집되면 서버가 contentKey로 같은 자료를 갱신한다.
feed와 page recent는 `fetchedAt`을 기록하고 YouTube recent는 API 키 없이 RSS를 사용하며 `rssOnly:true`를 기록한다.
library 수집은 정상 빈 문서와 HTTP·파싱 실패를 구분하며 stale cache로 실패를 대신하지 않는다.
수집기 한도는 배치 크기와 외부 요청량을 제한하기 위한 값이며 누적 자료의 보관 한도로 쓰지 않는다.
최근 feed 수집 자료는 `feed-article` 또는 `feed-video` kind를 사용한다.
archive sitemap 자료는 `page-link`, YouTube uploads 자료는 `page-video` kind를 사용해 같은 sourceKey라도 수집 경로를 구분한다.
수집 실패, 파싱 실패, API 키 부재처럼 다음 위치를 확정할 수 없는 경우에는 `POST /ingestions`를 보내지 않는다.
정상적인 빈 페이지를 확인했을 때만 items 빈 배열과 다음 cursor를 보낼 수 있다.
sitemap index나 sitemap 본문이 이전 digest와 달라지면 변경을 감지한 상태로 실패하고 cursor를 진행하지 않는다.
다시 처음부터 수집해야 할 때는 `--reset-cursor`를 `--library --collect-only --mode archive --source-key <key>`와 함께 실행한다.
reset도 cursor 단독 API를 쓰지 않고 기존 cursor version을 읽은 뒤 초기 cursor에서 만든 자료 배치와 다음 cursor를 ingestion으로 원자 저장한다.
성공한 ingestion만 기존 cursor를 교체하며, 충돌하면 기존 cursor를 유지한다.
`done:true`인 archive 재수집도 같은 옵션을 사용한다.
cursor 직렬화 크기는 API 계약의 64 KiB 제한을 넘지 않아야 하며, 초과가 예상되면 pending 목록을 다음 실행에서 다시 계산할 수 있는 작은 상태로 줄인다.
모든 archive cursor는 더 수집할 항목이 없을 때 `done:true`로 저장한다.

추천 저장은 기존 `MorningReadingReport`를 API `recommendation-runs` payload로 변환해 보낸다.
`reportId`는 서울 날짜의 `morning-YYYY-MM-DD`, `generatedAt`은 UTC ISO 문자열을 사용한다.
HTML은 기존 렌더러가 만들며, Markdown 리포트는 만들지 않는다.
HTML과 report JSON 검증이 끝난 뒤 `--commit-recommendation --report <RUN_DIR>/state/morning-reading.json` 명령이 같은 `generatedAt`을 재사용해 저장한다.
게시가 별도로 성공한 뒤에만 publications 기록을 보낸다.
publication의 `idempotencyKey`는 `publication:` 뒤에 고정 순서 `{reportId,channel,publishedAt,externalId,url}` JSON의 UTF-8 SHA-256 hex를 붙인다.
추천 저장이 실패하면 완료로 보지 않고, 파일 이력에 대신 쓰지 않는다.

### Pages manifest와 import payload

이 절은 library 모드의 현재 import preview 입력과 출력 계약이다.
기존 Pages 노출 이력은 API payload와 분리한 manifest envelope로 읽는다.
서버 API에는 envelope를 보내지 않고, API `ImportReport` 규격의 `reports`만 보낸다.

Pages manifest는 다음 필드를 가진다.

- `schemaVersion`: 현재 값 `1`
- `reports`: API `ImportReport`와 같은 `reportId`, `generatedAt`, `topics` 구조
- `reports[].provenance.sourcePageUrl`: 해당 리포트를 확인한 기존 Pages HTTPS URL
- `reports[].provenance.localHtmlPath`: 선택값. 에이전트가 승인된 URL에서 받아 둔 HTML 파일 경로

`provenance`는 career-os가 기존 노출 위치를 추적하기 위한 envelope 필드다.
API에 `POST /imports/dry-run`을 보내기 전에는 각 report에서 제거한다.
`ImportTopic`과 `ImportItem` 필드는 fos-blog HTTP 계약을 따른다.
기존 이력에 없는 `careerQuestion`, `summary`, `reason`, `careerValue`는 `null`로 보존한다.
임의 문장, 분류와 URL을 추정하지 않는다.

import preview의 `importKey`는 `import:` 뒤에 canonical JSON reports의 UTF-8 SHA-256 hex를 붙인다.
canonical JSON은 객체 키를 재귀적으로 사전순 정렬하고 배열 순서는 보존한 뒤 공백 없이 직렬화한다.
같은 reports 입력은 같은 importKey를 만들고, null 보존값을 포함해 reports가 바뀌면 다른 importKey를 만든다.
`--output`은 본인 관리자 UI가 바로 받을 raw `{importKey,reports}`만 저장한다.
dry-run 응답은 `<output>.preview.json`, 변환 오류는 `<output>.errors.json`에 분리해 저장한다.
변환 오류가 있으면 payload를 저장하거나 API 요청을 보내지 않는다.

## 임시 산출물과 Cache

- 시스템 임시 디렉터리: 게시 전 공개 가능 HTML과 실행별 중간 데이터. 추가 문서 형식은 해당 skill 계약을 따른다.
- `cache/`: 피드와 공고에서 다시 만들 수 있는 중간 결과

HTML 게시 전에는 개인 정보, 비공개 업무 내용, 로컬 절대 경로를 검사한다.
포지션 추천 HTML은 전체 추천 중 상위 3건의 우선 검토 카드, 나머지 추천의 압축 목록, 별도 보류·주의 목록과 전체 후보 순위의 접이식 검색 목록으로 표시한다.
외부 공유 URL은 `report-publisher` skill이 게시와 검증을 마친 뒤 제공한다.
게시용 임시 파일은 검증 뒤 삭제하며 사용자가 보존을 요청한 경우에만 지정 경로에 남긴다.

## 보존과 공개 범위

- `config/`와 공개 질문 은행은 검토 후 Git으로 관리한다.
- 지원 원본, 개인 질문, 답변 연습 상태와 아침 공부 추천 이력은 홈서버의 비공개 작업 release로 동기화한다.
- 현재 경력, 역할 선호, 경험 경계와 지원 대상은 private brain에서 관리한다.
- cache와 다시 만들 수 있는 임시 산출물은 장기 이력으로 취급하지 않는다.
- 개인 연락처, 회사별 지원 전략, 근거 감사 원문은 공개 리포트에 포함하지 않는다.
- 경력 자료를 공개할 때도 비공개 회사 정보와 로컬 경로를 제거한다.
