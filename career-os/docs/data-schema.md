# 데이터 구조

이 문서는 각 스킬이 **무엇을 어디에 저장하고 어떤 제약을 두는지**를 담는다.
필드와 타입, 키와 유니크 제약, 지울 때 함께 지워지는 것이 여기 속한다.

무엇을 약속하는지는 [`prd.md`](prd.md), 어떤 순서로 도는지는 [`flow.md`](flow.md),
코드가 어디 있는지는 [`code-architecture.md`](code-architecture.md)가 담는다.

## 공통

### 저장 원칙

- `config/`에는 오래 유지할 수집 정책을 둔다.
- `applications/`, `library/`와 `state/`는 홈서버 `career-os` S3 collection의 release와 동기화하는 로컬 작업본이다.
- `cache/`에는 원본에서 다시 만들 수 있는 수집 결과를 둔다.
- `public/question-bank/`과 `sources/fos-study/`에는 공개 가능한 자료만 둔다.
- 게시용 HTML과 실행별 중간 데이터는 시스템 임시 디렉터리에 두고 검증 뒤 삭제한다.

### MySQL schema 적용

홈서버 `fos_career` database 의 schema 는 `services/recommendation-api/migrations/` 의
번호가 붙은 SQL 파일이 소유한다.
아래의 table 과 column 서술은 그 SQL 을 읽기 쉽게 옮긴 것이다. 둘이 다르면 SQL 이 맞다.

적용 기록은 `schema_migrations` table 에 있다.

### 비공개 작업 release

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

### 비공개 작업 전송 계약

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
같은 코드가 여러 원인에서 나오는 자리에는 선택 항목 `detail`로 무엇이 어긋났는지와 다음에 실행할 명령을 한국어로 함께 담는다.
`TRANSPORT_UNAVAILABLE`은 `.env` 파일이 없거나 원격 연결 값이 비어 있는 경우를 연결 실패와 구분한다.
`RESTORE_REQUIRED`는 세션 기록이 없는 경우, 기록의 skill이 다른 경우, 기록의 revision이 현재 작업본과 다른 경우를 구분한다.
오류에는 파일 본문, 호스트, 계정, key 경로와 비밀값을 포함하지 않는다.

Markdown, JSON, 검토용 HTML, PDF와 실제 제출 묶음은 해당 application 디렉터리 안에서 함께 동기화한다.
게시 뒤 삭제하는 공개 리포트와 원본에서 다시 만들 수 있는 cache는 release에 포함하지 않는다.

client의 `.env`는 작업 경로와 transport만 주입한다.
SSH 환경은 `CAREER_WORKSPACE_SSH_TARGET`, `CAREER_WORKSPACE_SSH_ARGS`와 `CAREER_WORKSPACE_REMOTE_COMMAND`를 사용한다.
홈서버의 Hermes는 command transport로 같은 `career-storage` 명령을 호출한다.
S3 endpoint, bucket과 credential은 홈서버 명령의 환경에만 두며 client에 전달하지 않는다.
근거 원장의 `${PROJECTS_ROOT}`와 `${PERSONAL_ROOT}`는 환경마다 같은 이름의 변수로 해석하며 release에는 환경별 절대 경로를 저장하지 않는다.

### 임시 산출물과 Cache

- 시스템 임시 디렉터리: 게시 전 공개 가능 HTML과 실행별 중간 데이터. 추가 문서 형식은 해당 skill 계약을 따른다.
- `cache/`: 피드와 공고에서 다시 만들 수 있는 중간 결과

HTML 게시 전에는 개인 정보, 비공개 업무 내용, 로컬 절대 경로를 검사한다.
포지션 추천 HTML은 전체 추천 중 상위 3건의 우선 검토 카드, 나머지 추천의 압축 목록,
별도 보류·주의 목록과 검토한 후보의 접이식 검색 목록으로 표시한다.
포지션 추천은 HTML만 생성하며 Markdown 리포트는 만들지 않는다.
`recommendation.json`과 후보풀 JSON은 검증 입력으로 유지하고 기존 개인 Markdown 파일은 삭제하지 않는다.
외부 공유 URL은 `report-publisher` skill이 게시와 검증을 마친 뒤 제공한다.
게시용 임시 파일은 검증 뒤 삭제하며 사용자가 보존을 요청한 경우에만 지정 경로에 남긴다.

### 보존과 공개 범위

- `config/`와 공개 질문 은행은 검토 후 Git으로 관리한다.
- 지원 원본, 개인 질문, 답변 연습 상태와 아침 공부 추천 이력은 홈서버의 비공개 작업 release로 동기화한다.
- 현재 경력, 역할 선호, 경험 경계와 지원 대상은 private brain에서 관리한다.
- cache와 다시 만들 수 있는 임시 산출물은 장기 이력으로 취급하지 않는다.
- 개인 연락처, 회사별 지원 전략, 근거 감사 원문은 공개 리포트에 포함하지 않는다.
- 경력 자료를 공개할 때도 비공개 회사 정보와 로컬 경로를 제거한다.

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

#### 검토 화면

`application-package.html`은 준비 상태, 결론, 제출 PDF와 조건부 지원서 입력값을 탭 밖 상단에 고정한다.
본문은 `공고 원문`, `공고 적합도`, `지원 전략`, `상세 자료` 네 탭으로 나누며 `공고 원문`이 기본 선택이다.
`공고 적합도` 탭의 첫 내용은 공고 항목 하나에 한 행을 주는 적합도 표다.
`지원 전략` 탭은 「이 자리에서 얻을 경험과 성장」을 「입사 후 기여 시나리오」와 「보완할 공백」 사이에 둔다.
이 절은 선택 절이며, 없으면 나머지 순서를 그대로 두고 건너뛴다.
`공고 원문` 탭은 `evidence/posting.md`를 읽어 보여주며 원문을 다른 파일에 복제하지 않는다.

지원 패키지 검증기는 제출 문서와 지원서 답변에 내부 정보가 남았는지만 본다.
어떤 파일과 절을 만들지는 `application-package-writer` 의 지침이 정한다.

#### 적합도 판정과 점수

판단 기준은
[`fit-judgment.md`](../.claude/skills/application-package-writer/references/fit-judgment.md)가 소유한다.
행별 점수와 구분별 가중치는 모델이 공고를 보고 정해 `evidence/fit.md` 에 남긴다.
소계와 총점은 그 둘로 `fit_score.ts` 가 계산한다.
색 구간은 `render/constants.ts` 가 소유한다.

`evidence/status.md`의 준비 상태 값과 판단 기준은
[`application-quality-rubric.md`](../.claude/skills/application-package-writer/references/application-quality-rubric.md)의 「판정」이 소유한다.

첫 10줄의 `evidence`는 제출 문장이 현재 근거 범위 안에 있는지의 상태다.

| 값        | 뜻                                                  |
| --------- | --------------------------------------------------- |
| `safe`    | 제출 문장이 모두 확인한 근거 범위 안에 있다         |
| `revise`  | 근거보다 넓게 읽히는 문장이 있어 표현을 낮춰야 한다 |
| `blocked` | 근거를 확인하기 전에는 그 문장을 제출에 쓸 수 없다  |

첫 10줄의 `human-confirmation`은 본인 역할, 당시 제약, 기각한 대안, 결과의 확인 범위와 제출 문구 동의처럼 후보자만 확정할 수 있는 사실과 표현 확인 상태다.
값은 `complete` 또는 `needs_input`이며, `needs_input`이면 준비 상태를 `ready`로 둘 수 없다.

공고별 개인 근거와 면접 질문은 해당 `applications/<company>/<position>/`에 둔다.
여러 지원에서 재사용하는 개인 질문은 `library/question-bank/`에 둔다.
특정 지원에 종속되지 않는 대상별 프로필 원고는 `library/profiles/`에 둔다.
이력서 공통 작성 규칙과 디자인은 `resume-preparer` 스킬의 참조와 템플릿이 소유한다.
과거 지원에서 만든 근거 원장, 감사 문서, 점수표와 사용하지 않는 CSS는 `library/`에 남기지 않는다.

재사용할 작성 취향의 기준 원본은 `.claude/skills/resume-preparer/references/resume-taste.md`다.
brain에는 경력, 역할 선호와 경험 경계 등 개인 지식을 두고, 지원별 사실과 표현 확인은 `evidence/candidate-interview.md`의 기존 계약을 따른다.
작성 취향은 스킬에서 유지하고, brain 검색 결과는 해당 문장을 판단하는 데 필요한 출처와 범위만 지원 기록에 연결한다.

## interview-practice

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

### `state/drill-progress.json`

기술·인성 면접 답변 연습의 진행과 복습 상태를 관리한다.

포함 내용:

- 질문별 시도와 최근 결과
- 다시 볼 질문과 복습 시점
- 기술·인성 모드가 공유하는 진행 정보

학습 주제 생성 상태와 섞지 않는다.
이 파일은 public 저장소에서 추적하지 않고 비공개 작업 release로 동기화한다.

## position-recommender

### 개인 공고 제외 설정

`config/position-exclusions.ts`는 필수 개인 정책 파일의 상대 경로를 지정한다.
정책 본문은 Git에서 제외되는 `state/private-config/position-exclusions.json`에 둔다.
`state/private-config/`는 사람이 관리하는 비공개 설정을 기존 release로 전송하기 위한 예외이며, 실행 결과나 지원 이력 저장소가 아니다.
지원 결과와 재지원 간격의 원본은 계속 private brain에 둔다.

```json
{
  "schemaVersion": 2,
  "exclusions": [
    {
      "scope": "posting",
      "source": "wanted",
      "identityHash": "wanted:example-id",
      "decisionKind": "career-downside",
      "reason": "공고의 역할 범위가 희망하는 모듈 소유권과 맞지 않는다.",
      "evidenceUrls": ["https://example.com/jobs/example-id"],
      "confidence": "medium",
      "decidedAt": "2026-09-10"
    }
  ]
}
```

공고 규칙은 정식 `source`와 `identityHash`, HTTPS `url` 중 하나 이상을 가진다.
회사 규칙은 `scope: company`와 정확한 회사명, 회사 전체 판단에 사용하는 공개 근거 URL을 두 개 이상 가진다.
회사 내 역할군만 잠시 제외할 때는 `scope: company-role`, 정확한 회사명과
공고명에서 찾을 `titleKeywords`를 사용한다.
같은 소스에서 식별자나 정규화 URL 중 하나가 일치하거나 회사명이 정확히 일치하면 제외한다.
URL은 fragment, `utm_*`, `fbclid`, `gclid`를 제거하고 query 순서와 마지막 슬래시를 정규화한다.
공고 ID를 담는 query는 보존한다.
새 ID로 등록된 공고는 명시된 식별자나 URL이 일치하지 않으면 유지한다.

`career-downside` 규칙은 사용자가 명시적으로 제외하기로 한 사유와 공개 근거를 기록한다.
추천 실행이 제외 규칙을 자동으로 만들거나 갱신하지 않는다.
지원 결과처럼 업사이드 비교와 다른 이유는 `manual`로 기록한다.
재지원 간격처럼 종료일이 있는 규칙은 `expiresAt`까지 적용하고 다음 날부터 자동으로 후보풀에 되돌린다.
버전 1의 기존 공고 규칙은 읽을 수 있지만 새 규칙은 이유와 결정 근거가 있는 버전 2로 저장한다.

수집기는 설정을 외부 요청 전에 읽고, 누락이나 형식 오류가 있으면 종료 코드 1로 중단한다.
규칙이 필요 없는 환경은 사람이 확인한 `exclusions: []`를 명시한다.
`--exclusions-config <파일>`은 검증이나 명시적인 별도 설정에 사용하며 같은 검증을 적용한다.
일반 실행은 스크립트가 속한 워크스페이스의 기본 경로를 읽는다.

규칙 갱신은 기존 `prepare`, `diff`, `publish` 절차로 현재 release를 준비하고 변경 파일을 확인한 뒤 반영한다.
다른 환경은 추천 스킬의 `prepare` 단계에서 같은 release를 받는다.
새 수집 코드와 스킬 배포 전에는 원격 규칙 저장만으로 자동 추천에 적용되지 않는다.
선택 이유는 [개인 공고 제외 정책 ADR](adr/ADR-114-개인-공고-제외-정책을-비공개-release로-전송한다.md)을 따른다.

### 포지션 분석 정책

`fos_career.position_analysis_policy`의 단일 행은 후보자 기준 버전과 일일 분석 상한을 저장한다.
`fos_career.company_preferences`는 사람이 정한 회사 우선순위와 명시적 제외만 저장한다.
수집 결과와 모델 분석은 정책 table에 넣지 않는다.

```json
{
  "schemaVersion": 2,
  "candidateContextVersion": "career-priority-2026-09",
  "dailyAnalysisLimit": 20,
  "prioritySlots": 16,
  "agingSlots": 4,
  "staleAfterDays": 30,
  "defaultCompanyTier": 3,
  "dailyCompanyTierLimit": 5,
  "companyTierStaleAfterDays": 90
}
```

`dailyCompanyTierLimit`은 하루에 모델이 평가할 회사 수의 상한이고 1부터 20까지만 허용한다.
`companyTierStaleAfterDays`는 모델 평가의 기본 유효기간이고 1부터 365까지만 허용한다.
두 값은 `002_company_tier_assessments.sql`이 기존 단일 행에 5와 90을 채운 뒤 `NOT NULL`로 바꾼다.
다른 정책 값과 마찬가지로 DB 기본값은 남기지 않으므로,
새 DB에 행을 만들 때 두 값을 반드시 줘야 하고 이후 변경도 정책 설정 요청으로만 한다.

`tier`는 1, 2, 3만 허용하며 1이 가장 높다.
회사명은 정규화한 `companyKey`로 유일해야 하고 표시 이름을 별도 column에 둔다.
등록되지 않은 회사는 `defaultCompanyTier`를 적용한다.
보고 싶지 않은 회사는 낮은 티어로 두지 않고 `disposition: exclude`로 저장한다.
기존 개인 공고 제외 설정은 전환 명령이 멱등하게 import하고, 전환 뒤에는 API가 회사 정책의 기준 저장소다.

현재 회사 정책 설정 명령은 기존 개인 제외 설정을 자동으로 import하지 않고 다음 명시 JSON만 받는다.
각 회사는 입력 순서대로 인증된 `PUT /api/positions/v1/company-preferences/:companyKey` 요청으로 반영한다.
`companyKey`는 입력 회사명을 Backend와 같은 규칙으로 정규화해 만들며 같은 입력의 멱등 키는 변하지 않는다.

```json
{
  "schemaVersion": 1,
  "preferences": [
    {
      "companyName": "예시 회사",
      "tier": 1,
      "disposition": "analyze"
    }
  ]
}
```

```bash
bun career-os/scripts/position-recommender/configure_position_company_preferences.ts \
  --input <회사-정책.json>
```

명령은 회사명과 비공개 제외 사유를 출력하지 않고 전체 반영·제외·tier별 건수만 출력한다.
기존 개인 제외 설정의 자동 import는 별도 전환 작업 범위다.

`prioritySlots`와 `agingSlots`의 합은 `dailyAnalysisLimit`과 같아야 한다.
`dailyAnalysisLimit`은 1부터 20까지만 허용한다.
우선 슬롯은 회사 티어, `new`, `changed`, `stale` 상태, 마감 긴급도, 대기 시작 시각과 공고 ID 순서로 정한다.
보장 슬롯은 회사 티어와 무관하게 대기 시작 시각이 오래된 순서로 정한다.
한쪽 슬롯을 채울 후보가 부족하면 다른 쪽 후보가 남은 자리를 사용하며 같은 공고를 두 번 고르지 않는다.

`candidateContextVersion`은 현재 역할 기준과 이직 우선순위가 바뀌었을 때 사람이 새 값으로 변경한다.
값이 달라지면 기존 공고 분석은 본문이 같아도 `stale`로 분류한다.
정책이 없거나 형식이 잘못됐으면 전체 후보를 기본값으로 분석하지 않고 API가 `409`로 실행을 중단한다.

새 DB에는 정책 기본값을 넣지 않는다.
운영자는 첫 수집 전에 인증된 `PUT /api/positions/v1/analysis-policy` 요청으로 정책을 명시적으로 설정한다.
모든 쓰기 요청과 마찬가지로 `Authorization: Bearer`와 `Idempotency-Key`가 필요하다.
로컬 운영 명령은 같은 endpoint를 호출하며 DB에 직접 연결하지 않는다.

```bash
bun career-os/scripts/position-recommender/configure_position_analysis_policy.ts \
  --input <분석-정책.json>
```

#### 재사용하는 회사 조사 데이터

`state/company-research/<companyKey>.json`은 포지션 추천이 다음 실행에서도 재사용할 공개 회사 사실과
그 사실에서 도출한 추론을 담는다. 비공개 작업 release로 동기화하지만 현재 역할,
개인 우선순위와 최종 추천 순위는 넣지 않는다.

```json
{
  "schemaVersion": 1,
  "profile": {
    "companyKey": "example-company",
    "company": "예시 회사",
    "aliases": ["Example Company"],
    "researchedAt": "2026-09-14T12:00:00+09:00",
    "facts": [
      {
        "factId": "example-company-growth-2026-q3",
        "topic": "growth",
        "scope": "company",
        "statement": "공식 실적 발표에서 유료 고객 수가 전년 동기보다 증가했다.",
        "source": {
          "url": "https://example.com/ir/2026-q3",
          "title": "2026년 3분기 실적",
          "publisher": "예시 회사",
          "sourceType": "investor-relations",
          "publishedAt": "2026-09-01",
          "observedAt": "2026-09-14T12:00:00+09:00"
        },
        "validUntil": "2026-12-13"
      }
    ],
    "inferences": [
      {
        "inferenceId": "example-company-domain-upside-2026-q3",
        "topic": "domain-growth",
        "statement": "고객 증가가 이어지면 공통 구조와 운영 안정성을 다룰 문제도 커질 가능성이 있다.",
        "basisFactIds": ["example-company-growth-2026-q3"],
        "assumptions": ["고객 증가가 해당 백엔드 팀의 처리 범위 확대로 이어진다."],
        "confidence": "medium",
        "inferredAt": "2026-09-14T12:00:00+09:00",
        "validUntil": "2026-12-13"
      }
    ],
    "researchGaps": [
      {
        "topic": "compensation",
        "question": "백엔드 경력직 총보상 구간을 확인할 공개 자료가 있는가",
        "lastAttemptedAt": "2026-09-14T12:00:00+09:00",
        "retryAfter": "2026-10-14"
      }
    ]
  }
}
```

`topic`과 `scope`는 조사한 회사와 공고에 맞는 이름을 자유롭게 쓴다.
각 사실은 HTTPS 출처를 갖는다. 유효기간, 추론의 가정과 신뢰도는 재사용 판단에 도움이 될 때만 넣는다.
`researchGaps`는 같은 조사를 매 실행마다 반복하지 않도록
재조사할 질문과 날짜를 보존한다. 현재 형식은
`scripts/position-recommender/company-research/schema.ts`가 검증한다.

#### 공고 후보풀

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

**후보풀은 공고 원문만 담는다.** 업사이드나 리스크 판정을 넣지 않는다.
어댑터는 공고 원문만 보므로 현재 직장의 기준값과 비교할 수 없고,
회사 단위로 쓴 문구가 같은 회사의 모든 공고에 같은 값으로 들어간다.

#### 공고별 분석 이력

`fos_career`는 공고 원문, 공고 버전, 개인 분석과 추천 실행을 별도 table로 보존한다.
공고 원문에 주관적인 점수와 판단을 섞지 않는다.

| table                             | 주요 키와 책임                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `position_sources`                | `source_key` UNIQUE, 활성 여부와 마지막 정상 수집 시각                                       |
| `position_collection_runs`        | `run_id` PK, `idempotency_key` UNIQUE, 실행 상태와 집계                                      |
| `position_source_run_diagnostics` | `(run_id, source_key)` UNIQUE, 성공·부분 실패·실패와 건수                                    |
| `positions`                       | `position_id` PK, `(source_key, identity_hash)` UNIQUE, 현재 lifecycle과 관측 시각           |
| `position_versions`               | `position_version_id` PK, `(position_id, content_hash)` UNIQUE, 정규화한 공고 snapshot       |
| `position_collection_items`       | `(run_id, position_id)` UNIQUE, 해당 실행이 본 version과 활성 상태                           |
| `position_analysis_policy`        | singleton PK, 후보자 기준 버전, 일일 상한, 슬롯과 만료일 정책                                |
| `company_preferences`             | `company_key` UNIQUE, 회사명, tier, `analyze` 또는 `exclude`, 변경 시각                      |
| `company_tier_assessment_runs`      | `company_tier_run_id` PK, `collection_run_id` UNIQUE, 후보자 기준 버전과 계약 버전, `pending`·`partial`·`completed` 상태 |
| `company_tier_assessments`          | `company_tier_assessment_id` PK, `company_key`와 후보자 기준·계약 버전, 추천 tier와 신뢰도, 근거 JSON, 유효기간, 최초 생성 실행 |
| `company_tier_assessment_run_items` | `(company_tier_run_id, company_key)` PK, 선택 순서와 선택 이유, 처리 결과와 연결한 평가, 실패 사유와 제출 횟수     |
| `position_analysis_runs`          | `analysis_run_id` PK, 수집 실행과 후보자 기준 버전, 분석 계약 버전, `pending`·`partial`·`completed` 상태 |
| `position_analysis_run_items`     | `(analysis_run_id, position_id)` UNIQUE, 선택 순서, 상태와 선택 이유, 처리 결과와 연결한 분석, 실패 사유와 제출 횟수 |
| `position_analyses`               | `(position_version_id, candidate_context_version, contract_version)` UNIQUE, 점수와 유효기간, 최초 생성 실행 |
| `position_recommendation_runs`    | `recommendation_run_id` PK, 분석 실행, 생성 시각과 집계                                      |
| `position_recommendation_items`   | `(recommendation_run_id, position_id)` UNIQUE, 순위, 결론과 분석 참조                        |
| `request_receipts`                | `idempotency_key` PK, 요청 hash, 응답 상태와 응답 본문                                       |

`positions`의 안정적인 식별자는 `source_key`와 `identity_hash`를 우선 사용하고,
외부 식별자가 없을 때만 정규화 URL에서 identity hash를 만든다.
`position_versions.content_hash`는 회사명, 공고명, 직무 분류, 요약, 주요 업무,
요구 경력, 우대 사항, 기술과 태그를 정렬한 정규 JSON의 SHA-256이다.
수집 시각, 남은 날짜와 현재 상태처럼 매일 달라지는 값은 제외한다.

분석은 공고 version, 후보자 기준 버전과 분석 계약 버전이 같고 `valid_until`이 지나지 않았을 때만 `fresh`다.
분석이 없으면 `new`, 최신 공고 version이 달라졌으면 `changed`, 나머지 무효화 사유는 `stale`다.
새 분석은 과거 행을 갱신하지 않고 추가하며 현재 추천은 조건에 맞는 가장 최근 분석 하나만 사용한다.

`decision`은 `recommend`, `consider`, `hold` 중 하나이고 `fit_score`는 0부터 100까지의 정수다.
점수는 역할 적합도 0부터 40, 역할 범위와 성장 여지 0부터 25,
회사 기회 0부터 20, 제약이 적은 정도 0부터 15로 나누며 합계가 `fit_score`와 같아야 한다.
상세 근거와 다음 행동은 JSON column에 저장하지만 공고와 분석의 관계는 JSON 안 식별자가 아니라 foreign key로 유지한다.

수집 실행을 삭제하면 해당 실행 항목과 진단은 함께 삭제하지만 공고와 공고 version은 보존한다.
분석을 만든 실행은 삭제할 수 없다.
선택 항목만 지우는 삭제는 분석을 만들지 않은 실행에만 허용한다.
공고를 삭제하는 운영 기능은 만들지 않고 lifecycle로 관리한다.
명시된 마감일이 지났으면 `closed`, 성공한 동일 소스 수집에서 보이지 않으면 `not_seen`으로 바꾼다.
소스가 `partial` 또는 `failed`면 누락만으로 lifecycle을 바꾸지 않는다.

실행 항목의 `result_status`는 `pending`, `created`, `reused`, `failed` 중 하나다.
`created`와 `reused`는 `analysis_id`와 `completed_at`을 함께 가지고,
`failed`는 `failure_code`와 `completed_at`을 가지며 `analysis_id`는 비어 있다.
`attempt_count`는 그 항목의 결과를 제출해 처리한 횟수다.
실행 상태는 선택 항목이 모두 `created` 또는 `reused`면 `completed`,
`failed`가 남아 있으면 `partial`이다.

`position_analysis_runs.analyzed_now_count`는 그 실행이 새로 만든 분석 수다.
추천 응답의 `analyzedNowCount`는 그중 순위에 든 수이므로,
분석을 만든 뒤 공고 본문이 바뀌어 순위에서 빠지면 두 값이 달라진다.

큐 응답의 `reusedCount`, `pendingCount`, `newCount`, `changedCount`, `staleCount`는
활성 공고 전체를 기준으로 세고,
`completedCount`와 `failedCount`는 그 실행이 선택한 항목만 기준으로 센다.

감사 조회는 애플리케이션 코드를 거치지 않고 SQL 한 문장으로 답한다.

실행이 선택한 공고를 확인한다.

```sql
SELECT i.selection_order, p.company_name, p.title, i.analysis_status, i.selection_reason
FROM position_analysis_run_items i
JOIN positions p ON p.position_id = i.position_id
WHERE i.analysis_run_id = ?
ORDER BY i.selection_order;
```

공고별 처리 결과를 확인한다.

```sql
SELECT p.title, i.result_status, i.failure_code, i.attempt_count, i.completed_at
FROM position_analysis_run_items i
JOIN positions p ON p.position_id = i.position_id
WHERE i.analysis_run_id = ?
ORDER BY i.selection_order;
```

추천 실행이 쓴 분석이 그 실행에서 생성됐는지 재사용됐는지 확인한다.

```sql
SELECT ri.rank_number, p.title, ri.analysis_id,
       CASE WHEN a.created_by_analysis_run_id = rr.analysis_run_id
            THEN 'created' ELSE 'reused' END AS origin
FROM position_recommendation_items ri
JOIN position_recommendation_runs rr
  ON rr.recommendation_run_id = ri.recommendation_run_id
JOIN position_analyses a ON a.analysis_id = ri.analysis_id
JOIN positions p ON p.position_id = ri.position_id
WHERE ri.recommendation_run_id = ?
ORDER BY ri.rank_number;
```

실행 항목에 연결된 분석, 분석을 최초 생성한 실행과 실패 후 재시도는
같은 두 table을 다른 조건으로 조회한다.

임시 `analysis-queue.json`은 Backend 응답을 그대로 저장한 실행 파일이다.
`schemaVersion`은 2이고 `collectionRunId`, `analysisRunId`, 생성 시각, 정책 요약,
상태별 집계와 선택된 `candidates` 배열을 가진다.
각 후보는 `resultStatus`를 함께 가진다.
모델의 `analysis-updates.json`도 `schemaVersion`이 2이고 같은 `analysisRunId`를 담는다.
아직 끝나지 않은 공고를 분석 결과는 `results`에, 분석하지 못한 사유는 `failures`에 한 번씩 나눠 담는다.

#### 회사 tier 평가 이력

사람이 정한 회사 우선순위는 `company_preferences`에만 남고,
모델이 만든 tier 평가는 세 table에 실행 단위로 따로 쌓는다.
판단 근거는 [회사 tier ADR](adr/ADR-120-회사-tier는-사람-override와-모델-평가를-분리해-저장한다.md)이 소유한다.

| table                               | column                                                                                                                                                                                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `company_tier_assessment_runs`      | `company_tier_run_id`, `collection_run_id`, `candidate_context_version`, `contract_version`, `status`, `assessed_now_count`, `created_at`, `completed_at`                                                                                                                                              |
| `company_tier_assessments`          | `company_tier_assessment_id`, `company_key`, `company_name`, `candidate_context_version`, `contract_version`, `created_by_company_tier_run_id`, `recommended_tier`, `confidence`, `reason`, `signals_json`, `evidence_json`, `assumptions_json`, `assessed_at`, `valid_until`                          |
| `company_tier_assessment_run_items` | `company_tier_run_id`, `company_key`, `company_name`, `selection_order`, `assessment_status`, `selection_reason`, `prior_tier`, `active_position_count`, `result_status`, `company_tier_assessment_id`, `failure_code`, `attempt_count`, `completed_at`                                                 |

수집 실행 하나는 회사 tier 실행 하나만 가지므로 `collection_run_id`에 UNIQUE를 둔다.
실행 항목은 `(company_tier_run_id, company_key)`가 PK이고 `(company_tier_run_id, selection_order)`가 UNIQUE다.
평가를 만든 실행과 실행 항목이 연결한 평가는 모두 `ON DELETE RESTRICT` foreign key로 검증하므로,
평가를 만든 실행은 삭제할 수 없다.
`company_key`는 `company_preferences`와 같은 정규화 규칙을 쓰고 별도 `companies` table을 만들지 않는다.

`recommended_tier`는 1, 2, 3만, `confidence`는 `low`, `medium`, `high`만 허용한다.
`assessment_status`는 유효한 평가가 없는 회사의 `new`와 평가가 만료된 회사의 `stale` 중 하나이고,
`selection_reason`은 각각에 대응하는 `discovery`와 `refresh` 중 하나다.
`prior_tier`는 `stale` 항목이 만료된 이전 평가의 tier를 담는 자리이므로 `new` 항목에서는 비어 있다.

실행 항목의 `result_status`는 `pending`, `created`, `reused`, `failed` 중 하나이며
`created`와 `reused`만 `company_tier_assessment_id`를 가지고 `failed`만 `failure_code`를 가진다.
`created`는 그 결과가 새 평가 행을 만든 항목이다.
`reused`는 선택한 시점에는 유효한 평가가 없었지만 결과를 받는 시점에 이미 생겼을 때 쓴다.
큐는 유효한 평가가 없는 회사만 고르므로 이 상태는 앞선 실행과 겹쳐 돌았을 때만 나온다.
Backend는 같은 회사, 같은 후보자 기준 버전과 계약 버전의 유효한 평가를 찾으면
새 행을 만들지 않고 그것을 연결한 뒤 `reused`로 남긴다.
`failure_code`는 client가 보내는 `research_unavailable`, `model_unavailable`, `contract_rejected`, `internal_error`와
Backend가 2시간이 지난 처리 중 표시를 회수하며 남기는 `lease_expired`만 허용한다.
실행 상태는 선택 항목이 모두 `created` 또는 `reused`면 `completed`, `failed`가 남아 있으면 `partial`이다.
선택할 회사가 없으면 실행은 만들어지는 즉시 `completed`다.
`assessed_now_count`는 그 실행이 새로 만든 평가 수이므로 `created` 항목만 센다.
`reused`와 `failed`는 이 값에 들어가지 않는다.

`signals_json`은 성장 범위를 `growth-scope`, 보상 상승을 `compensation-upside`,
팀 성장을 `team-growth` 키로 각각 한 번씩만 담고,
확인하지 못한 축은 지어낸 사실 대신 `unknown`으로 남긴다.
세 이름은 `state/company-research/`의 `topic`과 같은 kebab-case 표기를 따른다.
`evidence_json`의 근거 URL은 HTTPS만 허용한다.
`valid_until`은 Backend가 다음 셋 중 가장 빠른 날로 정한다.
수신 시각에 `companyTierStaleAfterDays`를 더한 날, 각 근거의 만료일,
client가 결과에 `validUntil`을 넣었으면 그 날이다.
client가 보낸 값이 셋 중 가장 늦으면 쓰지 않으므로 그 값만으로 유효기간을 늘릴 수 없다.

평가는 `(company_key, candidate_context_version, contract_version, valid_until, assessed_at)` 복합 index로 조회하며,
과거 행을 갱신하지 않고 추가만 한다.
후보자 기준 버전이나 계약 버전이 달라지면 기존 평가는 재사용하지 않고 다시 평가한다.

회사 tier 큐는 수동 tier나 `exclude`가 있는 회사를 먼저 빼고 `dailyCompanyTierLimit`까지 고른다.
유효한 평가가 없는 회사를 활성 공고 수 내림차순, 첫 관측 시각, `company_key` 순으로 먼저 채우고,
남은 자리를 만료된 이전 Tier 1, 2, 3, 오래된 만료일, `company_key` 순으로 채운다.
다른 실행이 처리 중인 회사는 건너뛰며, 2시간이 지난 항목은 `lease_expired`로 끝내고 다시 고른다.
활성 공고 수는 tier 값 자체를 정하는 데 쓰지 않는다.

공고를 고를 때는 `exclude`를 제거한 뒤 `manual`, `model`, `default` 순서로 tier를 해결한다.
그때 사용한 값과 출처는 `position_analysis_run_items`와 `position_recommendation_items`에 스냅샷한다.

```text
company_tier_source ENUM('manual', 'model', 'default') NOT NULL
company_tier_assessment_id CHAR(36) NULL
```

`company_tier_source`가 `model`일 때만 평가 ID가 있어야 하며 `CHECK`로 강제한다.
`002` 적용 시점의 기존 행은 모두 `default`로 이관하고 평가 ID를 비운다.
이전 공고 분석을 재사용한 추천도 그 추천 실행이 사용한 현재 tier와 출처를 따로 남기므로,
분석 시점의 tier와 추천 시점의 tier가 달라도 둘 다 확인할 수 있다.

추천이 어느 tier를 어디서 얻었는지 확인한다.

```sql
SELECT ri.rank_number, p.company_name, ri.company_tier,
       ri.company_tier_source, ri.company_tier_assessment_id
FROM position_recommendation_items ri
JOIN positions p ON p.position_id = ri.position_id
WHERE ri.recommendation_run_id = ?
ORDER BY ri.rank_number;
```

실행이 평가하려던 회사와 그 결과를 확인한다.

```sql
SELECT i.selection_order, i.company_name, i.assessment_status, i.selection_reason,
       i.result_status, i.failure_code, i.attempt_count
FROM company_tier_assessment_run_items i
WHERE i.company_tier_run_id = ?
ORDER BY i.selection_order;
```

아직 기본 tier로 남아 있는 회사를 확인한다.

```sql
SELECT DISTINCT p.company_name
FROM position_analysis_run_items i
JOIN positions p ON p.position_id = i.position_id
WHERE i.analysis_run_id = ? AND i.company_tier_source = 'default';
```

임시 `company-tier-queue.json`은 Backend 응답을 그대로 저장한 실행 파일이다.
`schemaVersion`은 1이고 `collectionRunId`, `companyTierRunId`, 생성 시각,
상태별 집계와 선택된 회사 배열을 가진다.
각 회사는 `companyKey`, `companyName`, `assessmentStatus`, `activePositionCount`,
대표 공고 URL 최대 3개와 만료된 이전 평가의 tier, 이유, 만료일만 가진다.
공고 본문은 이 큐에 넣지 않는다. 직무 적합도는 기존 공고 분석이 판정한다.
모델의 `company-tier-updates.json`도 `schemaVersion`이 1이고 같은 `companyTierRunId`를 담으며,
아직 끝나지 않은 회사를 평가한 것은 `results`에, 평가하지 못한 사유는 `failures`에 한 번씩 나눠 담는다.

#### 실행 중 생성되는 포지션 추천 데이터

스크립트가 현재 후보풀과 유효한 공고 분석을 합쳐 만든 실행별 추천 결과다.
형식은 `scripts/position-recommender/recommendation/schema.ts`가 검증한다.

핵심 필드:

- 실행 날짜와 후보풀 출처
- 유효한 분석이 있는 활성 공고의 순위
- 순위 앞부분에서 고른 상세 추천 공고 목록
- 공고별 지원 이유
- 아직 분석하지 못한 활성 공고와 대기 사유
- 새 분석, 재사용, 분석 대기 건수
- 소스별 성공, 부분 실패, 실패 수와 확인하지 못한 공고 수
- 공고마다 그때 쓴 회사 tier의 값과 출처
- 출처별 공고 수와 tier 평가 실패 건수
- 모델이 필요에 따라 붙인 상세 근거와 다음 행동

추천 JSON의 `schemaVersion`은 11이다.
`pendingCandidates`의 각 항목은 후보 ID, 회사, 공고명, URL, 회사 티어와 `new`, `changed`, `stale` 중 하나를 가진다.
`analysisSummary`는 `activeCount`, `analyzedNowCount`, `reusedCount`, `pendingCount`와 `personalExcludedCount`를 가진다.

추천과 순위와 대기 항목은 모두 회사 tier의 출처를 함께 담는다.

| 필드 | 담는 것 |
| --- | --- |
| `companyTierSource` | `manual`, `model`, `default` 중 하나 |
| `companyTierAssessmentId` | 모델 평가의 ID. 출처가 `model`일 때만 있다 |
| `companyTierAssessedAt`, `companyTierValidUntil` | 그 평가의 시각과 만료일 |
| `companyTierConfidence` | `low`, `medium`, `high` |
| `companyTierReason` | 간결한 판정 이유 |
| `companyTierEvidenceUrls` | HTTPS 근거 최대 3개 |

`model` 이 아닌 출처는 평가 ID와 근거 필드를 갖지 않고 근거 목록이 비어 있다.

`companyTierSummary`는 `manualCount`, `modelCount`, `defaultCount`와 `assessmentFailedCount`를 가진다.
기본 tier로 남은 공고 수와 평가에 실패한 회사 수를 최종 답변이 숨기지 않게 하는 자리다.
`collectionHealth.warningSources`는 소스, `partial` 또는 `failed` 상태, 실패 건수와 공개 가능한 이유만 담는다.
최종 답변에 넣는 수집 경고 줄은 `scripts/position-recommender/recommendation/final-answer.ts`가 만든다.
그 줄은 소스, 상태, 실패 건수와 고정 문장 하나로만 구성하고 `reason`의 본문은 쓰지 않는다.

추천 항목의 URL과 공고 정보는 후보풀 원문과 일치해야 한다.

분석 순위는 `decision`, `fitScore`, 회사 티어, 마감 긴급도와 공고 ID를 차례로 적용해 결정적으로 만든다.
상세 추천은 `recommend` 또는 `consider`인 순위 앞부분과 같은 순서를 사용한다.
`hold`와 분석 대기 공고는 상세 추천 수를 채우기 위해 올리지 않는다.
라벨과 상세 근거의 제목은 후보마다 자유롭게 구성하고 필요 없으면 생략한다.
사실과 추론에 공개 근거가 있으면 URL을 기록하며, 가정은 판단에 영향을 줄 때만 덧붙인다.
개인 우선순위와 현재 역할의 본문은 private brain이 소유하며 분석 이력에는 기준 버전만 저장한다.
추천 개수와 분류는 스키마가 정하지 않는다.
게시용 HTML은 이 결과에서 만든다.
HTML은 상세 추천, 분석한 활성 공고 순위, 분석 대기 목록과 수집 경고를 구분해 표시한다.
후보풀, 추천 JSON과 HTML은 게시 검증 뒤 삭제한다.
공고 분석 이력과 회사 조사 데이터는 다음 실행에서 재사용하므로 `state/`에 유지한다.

## resume-preparer

근거 감사 자료는 대상 제출 문서와 같은 지원 디렉터리의 `review/`에 둔다.
파일 목록은 위 「application-package-writer」의 `review/`가 소유한다.
작성, 근거 감사와 평가는 `resume-preparer`의 순차 단계이며 별도 사용자 스킬로 나누지 않는다.

claim ledger를 다시 설명하는 evidence audit는 별도 파일로 만들지 않는다.
면접에서 확인할 질문은 필요할 때 `evidence/interview-questions.json`에 선택적으로 남긴다.
질문 생성 여부와 답변 여부는 제출 문서의 준비 상태를 결정하지 않는다.

근거 장부는 대상 HTML의 내용 해시와 연결해 다른 버전의 증거를 잘못 재사용하지 않게 한다.
`schemaVersion: 2`부터 기술 범위, 경력 기간, 운영과 숙련도 주장은 `experienceDepth`에 사용, 기능 개발, 운영 깊이 또는 사용자 확인 수준을 기록한다.
`schemaVersion: 3`부터 `document`와 `user` 근거에 `locator`를 필수로 두고, 검증기가 그 자리를 근거 파일에서 직접 찾는다.
locator 형식과 판정 기준은 `.claude/skills/resume-preparer/references/claim-model.md`가 소유한다.
새로 만드는 원장은 `schemaVersion: 3`을 쓴다. 이미 제출한 `schemaVersion: 2` 원장은 locator 어긋남을 경고로만 보고하고 소급해 고치지 않는다.
`safe`가 아닌 판정이 하나라도 남으면 제출 준비가 끝난 것으로 보지 않는다.
`review/resume-scorecard.md`에는 독립된 인사담당자와 실무담당자 판정, 경쟁상 차단 항목, 근거 방어 결과와 통제할 수 없는 위험을 기록한다.
정량 점수로 약한 필수 조건을 상쇄하지 않으며 두 블라인드 검토자가 모두 통과해야 한다.

### `state/verified-claims/`

`resume-preparer`가 다시 쓸 수 있다고 확인한 주장과 근거 파일 상태를 작은 JSON 파일로 나눠 저장한다.
이 디렉터리는 검증 결과에서 만든 상태이며 사람이 직접 관리하는 원고를 두지 않는다.

경로는 첫 번째 로컬 근거의 책임에 따라 정한다.

| 근거                                    | 장부 경로                                                     |
| --------------------------------------- | ------------------------------------------------------------- |
| `sources/fos-study/task/<group>/<file>` | `state/verified-claims/task/<group>/<file>.json`              |
| `library/profiles/<file>`               | `state/verified-claims/profile/<file>.json`                   |
| `applications/<company>/<position>/...` | `state/verified-claims/application/<company>/<position>.json` |
| 그 밖의 로컬 파일                       | `state/verified-claims/other/<file>.json`                     |

각 파일은 다음 필드를 가진다.

- `schemaVersion`: 검증 장부 스키마 버전이며 처음 구현은 `1`이다
- `groupKey`: 위 경로에서 만든 안정적인 묶음 식별자다
- `claims`: `claimKey` 순으로 정렬한 검증 완료 주장 목록이다
- `claims[].claimKey`: 정규화한 `proposedText`의 SHA-256으로 만든 안정적인 키다
- `claims[].claim`: 공고별 `schemaVersion: 3` 원장의 주장과 네 판정 축이다
- `claims[].evidenceSnapshots`: 근거별 `path`, `kind`, `locator`, `sha256`과 `freshness`다
- `claims[].origins`: 이 판정을 만든 application 경로, 원장 경로, HTML 문구 해시와 원장의 `generatedAt`이다

로컬 파일 근거의 `freshness`는 `tracked`이며 파일 내용의 SHA-256을 저장한다.
HTTPS `runtime` 근거는 실행마다 달라질 수 있으므로 `refresh_required`로 저장한다.
재사용 판정은 구현, 소유권, 결과와 경험 깊이 축을 각각 확인한다.
어떤 축에 HTTPS `runtime` 근거만 있으면 해당 주장은 다시 감사한다.
같은 축에 현재 SHA-256이 일치하는 로컬 근거가 있으면 HTTPS 근거는 보조 근거로 남기고 주장을 재사용할 수 있다.
근거 파일을 읽을 수 없거나 해시가 달라지면 해당 근거를 참조하는 주장은 다시 감사한다.

공고별 `review/claim-ledger.json`은 현재 제출 HTML 전체의 완결된 감사 결과다.
`state/verified-claims/`는 다음 감사의 읽기 범위를 줄이는 파생 상태이며 공고별 원장을 대신하지 않는다.
`sources/fos-study/task/`는 계속 읽기 전용 근거로 유지하고 검증 결과를 그 저장소에 쓰지 않는다.

## study-topic-recommender

### `config/external-reading-sources.ts`

아침 읽을거리의 외부 글·영상 소스와 수집 어댑터를 관리한다.
소스 식별자는 회사나 매체를 나타내며 특정 주제를 포함하지 않는다.

주요 필드:

- `key`, `title`, `category`
- `adapter`
- `feedUrl` 또는 `url`
- `enabled`
- 출처 분류

#### 실행 중 생성되는 읽을거리 데이터

읽을거리 실행은 시스템 임시 경로에 후보풀, 선별 결과와 이력을 만든다.
게시와 검증이 끝나면 실행별 데이터를 정리한다.

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

#### `state/morning-study-history.json`

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

#### 학습자료 API 연동 상태

이 절은 명시적으로 선택하는 library 모드의 현재 클라이언트 계약이다.
운영 서버 적용과 웹 UI 구현은 별도 작업이다.
현재 기본 실행의 누적 추천 이력은 위 `state/morning-study-history.json` 계약을 따른다.

`--library` 실행에서 누적 자료, 즐겨찾기, 읽음, 메모와 추천 이력은
`career-os` Backend가 `fos_career`의 별도 study table에 저장한다.
수집기와 skill은 table에 직접 접속하지 않고 HTTP API만 사용한다.
HTTP endpoint, 오류 코드와 저장 제약은 `services/recommendation-api/`의 계약과 migration이 단일 출처다.

study table은 기존 `fos-blog` 설계의 관계를 유지한다.
`study_sources`, `study_source_cursors`, `study_materials`, `study_material_sources`,
`study_material_tags`, `study_material_states`, `study_recommendation_control`,
`study_recommendation_runs`, `study_recommendation_topics`, `study_recommendation_items`,
`study_recommended_materials`, `study_publications`와 `study_request_receipts`를 사용한다.
현재 기존 table은 0행이므로 데이터 복사는 하지 않으며 API 계약 검증 뒤 제거한다.

##### 학습자료 HTTP 계약

기본 경로는 `/api/study/v1`을 유지한다.
`producer` token은 수집, 추천과 게시 기록에 사용하고,
`admin-gateway` token은 `fos-blog`의 인증된 Server Action이 자료 조회와 개인 상태 변경에 사용한다.
브라우저에는 두 token을 모두 전달하지 않는다.

| endpoint                                | 허용 역할               | 계약                                           |
| --------------------------------------- | ----------------------- | ---------------------------------------------- |
| `PUT /sources/{sourceKey}`              | producer                | source 전체 교체와 version 검사                |
| `GET /sources`                          | producer, admin-gateway | source 목록과 version 조회                     |
| `GET /sources/{sourceKey}/cursor?mode=` | producer                | mode별 opaque cursor 조회                      |
| `POST /ingestions`                      | producer                | 자료 묶음과 다음 cursor 원자 저장              |
| `GET /materials`                        | admin-gateway           | 필터, 정렬과 cursor pagination                 |
| `GET /materials/{id}`                   | admin-gateway           | 자료, source, tag와 개인 상태 조회             |
| `PATCH /materials/{id}/state`           | admin-gateway           | 즐겨찾기, 읽음, 메모와 version 충돌 검사       |
| `GET /candidates`                       | producer                | 누적 추천을 제외한 후보와 history version 조회 |
| `GET /recommendation-runs`              | admin-gateway           | 추천 실행 목록 pagination                      |
| `POST /recommendation-runs`             | producer                | 추천 전체 원자 저장과 중복 검사                |
| `GET /recommendation-runs/{reportId}`   | admin-gateway           | 추천 당시 snapshot과 현재 개인 상태 조회       |
| `POST /publications`                    | producer                | 외부 게시 성공 이력 저장                       |
| `POST /imports/dry-run`                 | producer, admin-gateway | legacy 이관 미리보기와 preview hash 생성       |
| `POST /imports/commit`                  | admin-gateway           | preview hash와 history version 검사 뒤 반영    |

요청 본문은 1 MiB 이하이고 오류 응답은 `{error:{code,message,requestId}}`다.
개인 응답은 `Cache-Control: private, no-store`와 `X-Robots-Tag: noindex, nofollow`를 사용한다.
모든 쓰기 요청은 멱등 키를 요구하며 같은 key와 다른 요청 hash는 `409`로 거부한다.
version 충돌도 `409`, 본문 상한 초과는 `413`, rate limit은 `429`, 저장소 장애는 `503`을 사용한다.

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

| adapter   | mode      | cursor 예시                                                                                                                                                                                                  | 의미                                                    |
| --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `feed`    | `recent`  | `{"lastSeen":["url:..."],"fetchedAt":"2026-09-07T00:00:00.000Z"}`                                                                                                                                            | 최근 피드 중 이미 본 정규 URL 키                        |
| `page`    | `archive` | `{"sitemapIndexUrl":"https://.../sitemap-index.xml","indexDigest":"sha256:...","pendingSitemaps":["https://.../post-sitemap.xml"],"completedSitemaps":[],"currentSitemap":null,"lastUrl":null,"done":false}` | sitemap index 기반 과거 URL 탐색 위치                   |
| `page`    | `archive` | `{"sitemapUrl":"https://tech.kakao.com/sitemap.xml","sitemapDigest":"sha256:...","onlyPathPrefix":"/posts/","lastUrl":"https://...","done":false}`                                                           | 단일 sitemap에서 posts URL만 읽은 위치                  |
| `youtube` | `archive` | `{"uploadsPlaylistId":"UU...","pageToken":"...","pendingVideoIds":[],"apiKeyRequired":true,"done":false}`                                                                                                    | YouTube Data API uploads playlist 페이지 안의 남은 영상 |
| `youtube` | `recent`  | `{"rssOnly":true,"lastSeen":["youtube:..."]}`                                                                                                                                                                | API 키가 없어 RSS 최근 영상만 수집한 상태               |

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

#### Pages manifest와 import payload

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

## sync-profile

대상별 프로필 원고를 `library/profiles/` 에 둔다.
원티드는 `wanted-profile.md`, GitHub 은 `github-profile.md`, LinkedIn 은 `linkedin-profile.md` 다.
비공개 작업 release 로 동기화한다.
생성 이미지도 같은 디렉터리에 둔다. `github-agent-usage.svg` 가 그것이다.

원고는 **프로필에 실제로 올라간 내용**을 담는다. 이력서 초안의 사본이 아니다.
다음 갱신 때 무엇이 올라가 있는지 알아야 어디를 고칠지 정할 수 있다.

폼 제약 때문에 원고와 다르게 넣은 것이 있으면 그 사실과 이유를 원고에 함께 적는다.
등록하지 못한 기술과 종료월을 넣은 진행 중 프로젝트가 여기 해당한다.

이 스킬은 별도 상태 파일을 두지 않는다.
외부 프로필의 현재 값은 실행할 때마다 대상 서버에서 다시 읽는다.
로컬에 사본을 두면 서버와 어긋난 것을 알 수 없기 때문이다.
