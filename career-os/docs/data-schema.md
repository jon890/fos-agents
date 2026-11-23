# 데이터 구조

이 문서는 각 스킬이 **무엇을 어디에 저장하고 어떤 제약을 두는지**를 담는다.
필드와 타입, 키와 유니크 제약, 지울 때 함께 지워지는 것이 여기 속한다.

무엇을 약속하는지는 [`prd.md`](prd.md), 어떤 순서로 도는지는 [`flow.md`](flow.md),
코드가 어디 있는지는 [`code-architecture.md`](code-architecture.md)가 담는다.

## 공통

### 커리어 작업 폴더

공고 추천, 공부 추천, 면접 연습의 데이터와 프로필 원고가 있는 자리다([ADR-146](adr/ADR-146-커리어-표-데이터는-에이전트-작업-폴더의-sqlite-가-갖는다.md)).
루트는 `CAREER_WORKSPACE_ROOT` 이고 없으면 `/workspace/career` 다.

| 경로 | 내용 |
| --- | --- |
| `state/career.sqlite` | 공고, 회사, 공부, 면접 table 과 `request_receipts`. WAL 모드라 같은 이름의 `-wal`, `-shm` 파일이 함께 생긴다 |
| `context/<문서 키>.md` | 에이전트가 실행 직전에 옮겨 쓴 맥락 문서. 실행기의 입력일 뿐 원본이 아니다. 키는 `position-preferences`, `application-state`, `learning-interests`, `career-status` 다 |
| `runs/<실행 폴더>/` | 한 번 실행의 중간 산출물. 이름은 `position-recommendation-*`, `study-topic-recommender.*` 다. 정리 명령이 지운다 |
| `library/profiles/<wanted\|linkedin\|github>.md` | 프로필 원고의 원본. `career-connector` 스킬이 파일 도구로 읽고 고친다. 길이 제한과 버전, 승인 카드가 없다 |
| `reports/<YYYY-MM-DD>-<position\|study>.html` | 완성한 리포트의 사본. 날짜는 서울 날짜다. 같은 날 다시 만들면 덮어쓴다 |

`state/career.sqlite` 의 table 과 열 이름은 아래 `fos_career` 의 공고·회사·공부·면접 table 과 같다. 다른 점은 이렇다.

- 시각은 UTC ISO 문자열, 날짜는 `YYYY-MM-DD` 문자열, JSON 은 문자열, 참·거짓은 1 과 0 이다.
- 스키마 버전은 `PRAGMA user_version` 이다. 실행기가 열 때 모자란 단계만 적용한다(`scripts/lib/career-store/ddl.ts`). 첫 단계가 공고·회사·공부, 둘째 단계가 면접 table 셋이다.
- `company_evidence` 의 유일 키는 `(company_key, source_type, url)` 이다. `url_hash` 열은 없다.
- `request_receipts` 는 처리 중 표시 없이 끝난 응답만 담는다.
- 외래 키와 `CHECK` 제약은 옮기지 않았다. 같은 조건을 저장 모듈의 요청 검증이 막는다.
- `candidateContextVersion` 은 `<문서 키>:sha256:<hex>` 다. 맥락 문서 본문을 정규화해 계산한다.
- 후보자 맥락 문서, 프로필 원고, 사용량 table 은 없다. 맥락 문서는 기억이, 원고는 위 파일이 갖고 사용량은 다루지 않는다.

### `fos_career` 도메인 구조

포지션 추천, 공부 추천과 회사 근거 등 커리어 상태를 담는 database 다.
공고·회사·공부·면접 table 은 작업 폴더의 SQLite 로 옮겼고(위 절), Backend 의 그 table 은 Backend 를 내릴 때까지 남아 있을 뿐 실행기와 MCP 서버가 읽지 않는다.
아래는 포지션 추천 table 의 다섯 묶음이다.

| 묶음 | table | 담는 것 |
| --- | --- | --- |
| 공고 원문 | `position_sources`, `positions`, `position_versions` | 외부 공고와 그 내용이 바뀐 이력. 판단을 섞지 않는다 |
| 실행 | `position_collection_runs`, `position_analysis_runs`, `company_tier_assessment_runs`, `position_recommendation_runs` 와 각 `*_items` | 수집 실행 하나에 분석, 회사 tier 평가, 추천 실행이 하나씩 붙는다 |
| 판단 | `position_analyses`, `company_tier_assessments` | 모델이 공고와 회사를 평가한 결과. 실행이 지워져도 남는다 |
| 회사 근거 | `company_evidence` | 외부에서 관측한 회사 사실. 추론은 담지 않는다 |
| 회사 설정과 사람이 정한 것 | `company_preferences`, `position_exclusions`, `position_analysis_policy` | 회사별 수집 주소와 우선순위, 개인 제외 규칙, 분석 정책 |

`request_receipts` 는 쓰기 요청의 멱등 키와 응답을 담는다. 도메인 데이터가 아니다.

```mermaid
erDiagram
  position_sources ||--o{ positions : ""
  positions ||--o{ position_versions : ""
  position_collection_runs ||--o{ position_collection_items : ""
  position_collection_items }o--|| position_versions : ""
  position_collection_runs ||--o| company_tier_assessment_runs : ""
  position_collection_runs ||--o| position_analysis_runs : ""
  position_analysis_runs ||--o{ position_analysis_run_items : ""
  position_analysis_run_items }o--o| position_analyses : ""
  position_analyses }o--|| position_versions : ""
  company_tier_assessment_runs ||--o{ company_tier_assessment_run_items : ""
  company_tier_assessment_run_items }o--o| company_tier_assessments : ""
  position_analysis_runs ||--o| position_recommendation_runs : ""
  position_recommendation_runs ||--o{ position_recommendation_items : ""
  position_recommendation_items }o--|| position_analyses : ""
```

묶음 사이에 지키는 규칙이다.

- **분석은 공고 version 에 붙는다.** 공고 본문이 바뀌면 새 version 이 생기고 이전 분석은 그 version 에 남는다.
- **판단은 덮어쓰지 않고 쌓는다.** 새 분석과 새 tier 평가는 행을 추가하고, 현재 값은 유효한 것 가운데 가장 최근 하나다.
- **판단을 만든 실행은 지울 수 없다.** 실행을 지우면 그 실행의 항목과 진단만 함께 지워지고 공고와 판단은 남는다.
- **회사는 `company_key` 로 잇고 `companies` table 을 두지 않는다.** `company_preferences`, `company_tier_assessments`, `company_evidence`, `position_exclusions` 가 같은 정규화 규칙의 `company_key` 를 쓴다. foreign key 는 없다.
- **칸끼리의 조건은 DB 의 `CHECK` 가 강제한다.** `scope` 마다 필수 칸이 다른 제외 규칙이나 HTTPS 만 받는 URL 이 그렇다. 이 제약은 `schema.prisma` 에 없고 migration SQL 에만 있다.

table 별 칸과 제약은 아래 `position-recommender` 절이 소유한다.
면접 연습 table 은 `interview-practice` 절이, 공부 추천 table 은 `study-topic-recommender` 절이 소유한다.
프로필 원고와 에이전트 사용량 기록 table 은 `sync-profile` 절이 소유한다.
schema 는 `services/career-backend/prisma/` 가 관리하고,
migration 적용 절차는 [`services/career-backend/README.md`](../services/career-backend/README.md) 가 소유한다.

### 후보자 맥락 문서

스킬이 판단에 쓰는 개인 맥락을 문서 키마다 Markdown 본문 하나로 담는다.
값을 읽는 쪽은 스크립트가 아니라 모델이라 본문의 형식을 칸으로 나누지 않는다.

**원본은 커리어 에이전트 주인의 기억(fos-assistant Memory)이다**([ADR-147](adr/ADR-147-후보자-맥락-문서는-비서의-기억이-프로필-원고는-작업-폴더-파일이-갖는다.md)).
기억 제목은 고정이다. 스킬이 `memory_search` 와 `memory_read` 로 읽고, 실행기가 필요로 하는 문서는 본문 그대로 작업 폴더 `context/<문서 키>.md` 에 옮겨 쓴다.
고칠 때는 `memory_remember` 로 본문 전체를 남긴다. 바로 저장될지 제안으로 남을지는 비서가 정하고, 제안이면 사람이 기억 화면에서 받아들여야 다음 실행에 반영된다.
한 번에 남길 수 있는 본문은 2000자까지라 넘으면 스킬이 줄이자고 제안한다. 같은 제목의 기억이 둘 이상이면 스킬은 고르지 않고 멈춘다.

| 문서 키 | 기억 제목 |
| --- | --- |
| `career-status` | 커리어: 현재 경력 |
| `position-preferences` | 커리어: 역할 선호 |
| `application-state` | 커리어: 지원 상태 |
| `learning-interests` | 커리어: 학습 관심사 |

| 문서 키 | 담는 것 | 읽는 스킬 |
| --- | --- | --- |
| `learning-interests` | 공부 추천이 따를 학습 관심사와 우선순위 | `study-collection` |
| `position-preferences` | 이직 우선순위와 역할 선호 | `position-recommender`, `career-connector` |
| `application-state` | 지원 결과, 현재 집중 대상과 사용 원칙. 재지원 간격의 날짜는 `position_exclusions` 가 담는다 | `position-recommender`, `application-package-writer`, `interview-practice` |
| `career-status` | 현재 경력, 강점, 경험 경계와 지원 전략 | `resume-preparer`, `application-package-writer`, `interview-practice`, `sync-profile` |

연락처, 생년월일, 병역과 정확한 재직 기간 같은 지원서 공통 프로필은 문서 키에 넣지 않는다.
그 원본은 fos-assistant Memory 이고 읽는 방법은 [`flow.md`](flow.md#지원서-공통-프로필)가 소유한다.

기준 버전은 본문에서 계산한다. 공고 분석은 `position-preferences`, 공부 추천은 `learning-interests` 의 `context/` 사본을 정규화한 SHA-256 으로 `<문서 키>:sha256:<hex>` 를 낸다. 본문이 같으면 같은 기준이라 다시 분석하지 않는다([ADR-146](adr/ADR-146-커리어-표-데이터는-에이전트-작업-폴더의-sqlite-가-갖는다.md)).

커리어 Backend 의 `candidate_context_documents`, `candidate_context_document_revisions` table 과 HTTP 계약은 비서용 스킬과 실행기가 쓰지 않는다. Backend 를 내릴 때 함께 사라진다.

각 후보는 출처 식별자, 출처 종류와 역할, 주제, 제목, URL, 게시 시각, 공개 설명, 자료 종류를 가진다.

### 면접 연습 저장소

주제별 복습 상태, 연습 기록과 개인 질문은 커리어 작업 폴더의 `state/career.sqlite` 하나에 둔다([ADR-146](adr/ADR-146-커리어-표-데이터는-에이전트-작업-폴더의-sqlite-가-갖는다.md)).
JSON 파일 저장소와 Backend 저장소, `CAREER_STORE` 선택은 없다. 그래서 대화가 바뀌어도 앞 연습의 복습 대상과 개인 질문이 이어진다.
table 과 열, 복습일 규칙은 아래 「면접 연습 table」 과 같고 타입만 SQLite 다(시각은 UTC ISO 문자열, 날짜는 `YYYY-MM-DD`, `payload` 는 JSON 문자열, `enabled` 는 1 과 0).
같은 `attemptId` 의 기록을 다시 보내면 `request_receipts` 가 처음 응답을 돌려주고 복습 상태를 한 번 더 바꾸지 않는다. 같은 `attemptId` 에 다른 본문이 오면 `IDEMPOTENCY_CONFLICT` 다.
실행기 명령은 [`code-architecture.md`](code-architecture.md#interview-practice)가 소유한다.

### 면접 연습 table

```mermaid
erDiagram
  interview_topic_progress ||--o{ interview_attempts : ""
```

셋 모두 행을 지우지 않는다. 개인 질문은 `enabled` 로 끈다.

#### `interview_topic_progress`

복습 단위는 질문이 아니라 주제다. 같은 주제의 질문 하나를 통과하면 그 주제 전체의 복습일이 뒤로 밀린다.

| 칸 | 타입 | 뜻 |
| --- | --- | --- |
| `drill_type` | `ENUM('tech','behavioral')` | 기본 키 앞부분 |
| `topic` | `VARCHAR(100)` | 기본 키 뒷부분. 질문의 `topic` |
| `pass_count` | `INT UNSIGNED` | `pass` 를 받은 횟수 |
| `fail_count` | `INT UNSIGNED` | `shallow`, `fail`, `unknown` 을 받은 횟수 |
| `next_review_date` | `DATE NULL` | 다음 복습일. 없으면 복습 대상이 아니다 |
| `last_passed_date` | `DATE NULL` | 마지막으로 `pass` 를 받은 날 |
| `updated_at` | `DATETIME(3)` | |

복습일은 연습 기록을 추가하는 transaction 안에서 Backend 가 정한다.
날짜는 Asia/Seoul 기준의 평가일(`evaluated_on`)에서 센다.

| 점수 | 바뀌는 칸 | 다음 복습일 |
| --- | --- | --- |
| `pass` | `pass_count` 1 증가, `last_passed_date` 를 평가일로 | 평가일에 간격을 더한 날. 간격은 `pass_count` 가 1, 2, 3 … 일 때 1, 3, 7, 14, 30, 60일이고 그 뒤로는 60일 |
| `shallow`, `fail`, `unknown` | `fail_count` 1 증가 | 평가일 다음 날 |

#### `interview_attempts`

연습 한 번이 한 행이다. 답변 원문은 담지 않는다.

| 칸 | 타입 | 뜻 |
| --- | --- | --- |
| `attempt_id` | `CHAR(36)` | 기본 키. client 가 만든 UUID. `Idempotency-Key` 와 같은 값 |
| `drill_type`, `topic` | | `interview_topic_progress` 를 가리키는 foreign key |
| `question_id` | `VARCHAR(100)` | 공개, 개인, 공고별 질문의 `id` |
| `question` | `VARCHAR(2000)` | 그때 물은 질문 원문. 질문 파일이 바뀌어도 기록이 읽히게 남긴다 |
| `score` | `ENUM('pass','shallow','fail','unknown')` | |
| `feedback` | `VARCHAR(500) NULL` | 가장 큰 공백 같은 짧은 피드백 |
| `evaluated_on` | `DATE` | Asia/Seoul 기준 평가일 |
| `target_company`, `target_role`, `target_value_axis` | `VARCHAR(100) NULL` | 포지션별 연습일 때만 |
| `root_question_id` | `VARCHAR(100) NULL` | 꼬리질문일 때 원 질문 |
| `parent_question` | `VARCHAR(2000) NULL` | 꼬리질문일 때 바로 앞 질문 |
| `follow_up_depth` | `TINYINT UNSIGNED NULL` | 1부터 4까지 |
| `follow_up_axis` | `ENUM('clarification','decision','counterexample','operations','evidence-boundary') NULL` | |
| `stop_reason` | `ENUM('depth-limit','needs-study','answer-complete','session-ended') NULL` | |
| `created_at` | `DATETIME(3)` | |

`(drill_type, topic, created_at)` 에 index 를 둔다.

#### `interview_personal_questions`

개인 경험에서 나온 질문이다. 공개 질문 은행에 넣지 않는다.

| 칸 | 타입 | 뜻 |
| --- | --- | --- |
| `question_id` | `VARCHAR(100)` | 기본 키. 질문의 `id` |
| `drill_type` | `ENUM('tech','behavioral')` | |
| `topic` | `VARCHAR(100)` | |
| `enabled` | `BOOLEAN` | 끈 질문은 연습에 나오지 않는다 |
| `payload` | `JSON` | 질문 전체. 공개 질문 은행의 질문 항목과 같은 형식이다 |
| `created_at`, `updated_at` | `DATETIME(3)` | |

`payload` 의 형식은 DB 제약이 아니라 Backend 의 zod 검사가 지킨다.
`payload` 안의 `id`, `topic` 은 행의 `question_id`, `topic` 과 같아야 하고, 다르면 `400` 이다.
`answerSignals` 와 `followUps` 는 따로 조회하지 않고 질문 전체가 한 번에 모델에게 전달되므로 자식 table 로 나누지 않는다.

### 후보자 맥락

질문 난도와 꼬리질문 경계를 정할 때 읽는 값이다. 비서용 `interview-practice` 스킬은 기억의 「커리어: 현재 경력」 과 「커리어: 지원 상태」 를 직접 읽는다. 아래 `CAREER_MEMORY` 는 저장소에서 `drill-engine.ts memory` 를 직접 부를 때만 쓴다.
결정과 근거는 [ADR-130](adr/ADR-130-면접-연습의-후보자-맥락은-memory-공급자-경계로-읽는다.md)과 [ADR-132](adr/ADR-132-스킬의-개인-맥락은-후보자-맥락-문서에서-읽고-지원서-공통-프로필만-brain에-둔다.md)에 있다.

| `CAREER_MEMORY` | 채우는 쪽 |
| --- | --- |
| `context` | 스크립트가 작업 폴더 `context/career-status.md` 와 `context/application-state.md` 의 본문을 채울 칸 목록과 함께 낸다. 출력은 `provider`, `fields`, `instruction`, `documents` 이고 `documents` 의 원소는 `{ documentKey, version, body }` 다. `version` 은 본문에서 계산한 `<문서 키>:sha256:<hex>` 다 |
| `file` | `CAREER_MEMORY_FILE` 의 JSON. 기본은 `career-os/library/candidate-memory.json`. 템플릿은 `scripts/interview-drill/templates/candidate-memory.example.json` |
| 없음 | 명령이 실패한다 |

| 칸 | 타입 | 뜻 |
| --- | --- | --- |
| `schemaVersion` | `1` | |
| `currentRole.title` | 문자열 | 현재 역할 |
| `currentRole.yearsOfExperience` | 0 이상 숫자 | 경력 연차 |
| `currentRole.bar` | `production`, `large-scale`, `global-scale` | 지금 책임지는 문제 규모 |
| `experience.direct` | 문자열 배열 | 직접 설계하거나 운영한 기술과 영역 |
| `experience.adjacent` | 문자열 배열 | 옆에서 함께 다룬 영역 |
| `experience.studyOnly` | 문자열 배열 | 학습만 한 영역 |
| `targets` | 배열. 비어도 된다 | 현재 지원 대상 |
| `targets[].company`, `targets[].role` | 문자열 | |
| `targets[].applicationDir` | 문자열 | `career-os/` 기준 지원 디렉터리. 예: `applications/<company>/<role>` |

현재 직장 이름은 계약에 두지 않는다. 질문 난도는 회사 이름이 아니라 `bar` 로 정한다.
파일은 개인 정보라 `library/` 처럼 Git 이 추적하지 않는 곳에 둔다.

## position-recommender

### 개인 공고 제외 설정

작업 폴더 저장소의 `position_exclusions` 가 담는다.
`position exclusions get` 으로 읽고 `position exclusions put --input <JSON>` 으로 전체를 바꾼다. 입력은 `{ "schemaVersion": 2, "exclusions": [...] }` 나 규칙 배열이다.

| 칸 | 타입 | 설명 |
| --- | --- | --- |
| `position_exclusion_id` | `CHAR(36)` PK | |
| `scope` | `ENUM('posting','company','company-role')` | |
| `company_key` | `VARCHAR(191)` NULL | `company` 와 `company-role` 에서 필수 |
| `source_key` | `VARCHAR(100)` NULL | `posting` 에서 쓴다 |
| `identity_hash` | `VARCHAR(512)` NULL | `posting` 에서 쓴다 |
| `normalized_url` | `VARCHAR(2048)` NULL | `posting` 에서 쓴다 |
| `title_keywords_json` | `JSON` NULL | `company-role` 에서 필수 |
| `decision_kind` | `ENUM('career-downside','manual')` | |
| `reason` | `TEXT` | |
| `evidence_urls_json` | `JSON` | HTTPS 만 담는다 |
| `confidence` | `ENUM('low','medium','high')` NULL | |
| `decided_at` | `DATE` | |
| `expires_at` | `DATE` NULL | |

`scope` 마다 필요한 칸이 다른 것은 `CHECK` 로 강제한다.

API 본문은 아래 모양이다.

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

`scope` 마다 요구하는 필드가 다르다.

| `scope` | 요구하는 것 | 언제 맞다고 보나 |
| --- | --- | --- |
| `posting` | 정식 `source` 는 반드시, 그리고 `identityHash` 와 HTTPS `url` 중 하나 이상 | 같은 소스에서 식별자나 정규화 URL 이 일치 |
| `company` | 정확한 회사명과 공개 근거 URL 두 개 이상 | 회사명이 정확히 일치 |
| `company-role` | 정확한 회사명과 공고명에서 찾을 `titleKeywords` | 회사명이 일치하고 제목에 keyword 가 있다 |

`decisionKind` 다.

| 값 | 뜻 |
| --- | --- |
| `career-downside` | 사용자가 업사이드 비교로 제외하기로 했다. 사유와 공개 근거를 함께 적는다 |
| `manual` | 지원 결과처럼 업사이드 비교와 다른 이유다 |

`expiresAt` 이 있으면 그날까지만 적용하고 다음 날부터 후보풀로 되돌린다. 재지원 간격이 여기 해당한다.

URL 정규화는 fragment 와 `utm_*` 와 `fbclid` 와 `gclid` 를 지우고
query 순서와 마지막 슬래시를 맞춘다. 공고 ID 를 담는 query 는 남긴다.

읽기와 쓰기에는 `scope` 가 있는 버전 2 규칙만 사용한다.
**추천 실행이 이 규칙을 자동으로 만들거나 갱신하지 않는다.**
재지원 간격의 날짜는 이 규칙의 `expiresAt` 만 소유한다. 지원 결과의 설명은 후보자 맥락 문서 `application-state` 가 담고 날짜를 적지 않는다.

선택 이유는 [ADR-123](adr/ADR-123-회사-근거와-개인-제외-정책은-backend가-소유한다.md)을 따른다.
읽는 시점과 실패 처리는 [`flow.md`](flow.md#position-recommender)가 소유한다.

### 회사 근거

`fos_career.company_evidence` 가 담는다.
수집기가 모아 `PUT api/positions/v1/company-tier-runs/:companyTierRunId/evidence` 로 저장한다.
한 회사의 유효한 근거는 `GET api/positions/v1/companies/:companyKey/evidence` 로 읽는다.
조회 응답에는 저장된 `company_evidence_id`를 `id`로 함께 준다.
모델은 이 근거만 읽고 세 축을 판정한다.

| 칸 | 타입 | 설명 |
| --- | --- | --- |
| `company_evidence_id` | `CHAR(36)` PK | |
| `company_key` | `VARCHAR(191)` | |
| `source_type` | `ENUM` | 아래 표 |
| `url` | `VARCHAR(2048)` | HTTPS 만 담는다 |
| `url_hash` | `CHAR(64)` 생성 열 | `url` 에서 DB 가 만든다. 쓰기에서 값을 주지 않는다 |
| `title` | `VARCHAR(500)` NULL | |
| `summary` | `TEXT` | 한 줄 요약 |
| `payload_json` | `JSON` | 수집기가 받은 값. 급여와 근속과 인원이 여기 든다 |
| `observed_at` | `DATETIME(3)` | 수집 시각 |
| `valid_until` | `DATE` | 만료일 |

같은 출처를 다시 모으면 행을 늘리지 않는다. 유일성 기준은 `(company_key, source_type, url)` 이다.
더 오래된 관측으로는 덮지 않는다. `observed_at` 이 저장된 값과 같거나 더 최신일 때 갱신한다.
같은 시각으로 다시 보내면 나중에 보낸 값이 남는다.
수집기가 `observed_at` 을 날짜 단위로 적고 재시도가 같은 시각을 다시 보내는데,
같은 시각까지 막으면 그 갱신이 반영되지 않는다.
더 오래된 관측을 보내면 요청은 성공하고 행은 그대로 남는다.

UNIQUE 는 `url` 대신 `url_hash` 에 건다.
`VARCHAR(2048)` 을 utf8mb4 로 담으면 index key 가 8192 바이트가 되어
InnoDB 상한 3072 바이트를 넘고, MySQL 이 `Specified key was too long` 으로 거절한다.
앞부분만 잘라 거는 prefix index 는 앞 570자가 같은 서로 다른 URL 을 한 행으로 묶어
다른 출처의 근거를 덮어쓴다. 오류가 나지 않고 값만 틀린다.
고유 키를 전체 값의 해시에 거는 것은 `positions.identity_hash` 와 같고, 계산 주체만 다르다.
`identity_hash` 는 애플리케이션이 계산해 넣고 `url_hash` 는 DB 가 만든다.

`PUT` 의 응답은 `companyTierRunId` 와 회사별 `savedCount` 다.
`savedCount` 는 중복을 없앤 뒤 그 회사의 출처 키 수다.
같은 키가 한 요청에 두 번 오면 1 이고, 옛 관측이라 갱신되지 않은 키도 여기 든다.
바뀐 행 수가 아니라 그 키로 지금 존재하는 행 수다.

`source_type` 과 그 출처가 채우는 축이다.

공고 수집기는 `GET api/positions/v1/companies/:companyKey/active-postings`로
Backend에 저장된 활성 공고의 제목, URL과 `first_seen_at`을 읽는다.

| `source_type` | 출처 | 채우는 축 |
| --- | --- | --- |
| `dart-employment` | OpenDART 「직원 현황」 | `compensation-upside`, `team-growth` |
| `dart-financial` | OpenDART 재무정보 | `team-growth` |
| `tech-blog` | 회사 기술 블로그 RSS | `growth-scope` |
| `github` | GitHub organization | `growth-scope` |
| `conference` | 컨퍼런스 발표 | `growth-scope` |
| `review` | Blind 항목별 평점 | `compensation-upside` |
| `job-posting` | 우리가 모은 활성 공고 | `growth-scope`, `team-growth` |
| `official` | 회사 공식 홈페이지와 채용 페이지 | 축을 정하지 않는다 |
| `other` | 그 밖 | 축을 정하지 않는다 |

`valid_until` 은 출처마다 다르다.

| `source_type` | 유효기간 | 이유 |
| --- | --- | --- |
| `dart-employment`, `dart-financial` | 180일 | 사업보고서가 1년에 한 번 나온다 |
| `tech-blog` | 14일 | 글이 계속 올라온다 |
| `github` | 30일 | 마지막 push 시각만 본다 |
| `review` | 60일 | 평점이 천천히 움직인다 |
| `conference`, `official`, `other` | 90일 | |
| `job-posting` | 수집 실행마다 다시 만든다 | 이미 매일 모은다 |

### 포지션 분석 정책

`fos_career.position_analysis_policy` 의 단일 행이다.
수집 결과와 모델 분석은 이 table 에 넣지 않는다.

| 필드 | 허용 범위 |
| --- | --- |
| `dailyAnalysisLimit` | 하루 분석 상한 |
| `prioritySlots` | 회사 우선 슬롯 수 |
| `agingSlots` | 오래 기다린 공고 보장 슬롯 수 |
| `staleAfterDays` | 분석의 유효기간 |
| `defaultCompanyTier` | 등록되지 않은 회사에 적용할 tier |
| `dailyCompanyTierLimit` | 1 부터 20. 하루에 모델이 평가할 회사 수 |
| `companyTierStaleAfterDays` | 1 부터 365. 모델 평가의 기본 유효기간 |

```json
{
  "schemaVersion": 2,
  "dailyAnalysisLimit": 20,
  "prioritySlots": 16,
  "agingSlots": 4,
  "staleAfterDays": 30,
  "defaultCompanyTier": 3,
  "dailyCompanyTierLimit": 5,
  "companyTierStaleAfterDays": 90
}
```

**DB 기본값을 두지 않는다.** 새 저장소에 행을 만들 때 모든 값을 줘야 하고
이후 변경도 정책 설정 명령(`position configure-policy --input <JSON>`)으로만 한다.

### `fos_career.company_preferences`

회사별 수집 주소와 사람이 정한 회사 우선순위와 제외를 담는다.
모델 평가는 별도 table이 담는다.

| column | 값 |
| --- | --- |
| `company_key` | 정규화한 회사명. 유일하다 |
| `company_name` | 표시 이름 |
| `tier` | 1, 2, 3 또는 NULL. NULL이면 사람 override가 없다 |
| `disposition` | `analyze`, `exclude`, `benchmark` |
| `tech_blog_feed_url`, `github_org` | 기술 블로그 RSS 주소와 GitHub organization |
| `dart_corp_code`, `blind_company_slug` | DART 고유번호와 Blind 회사 경로 |

등록되지 않은 회사는 `defaultCompanyTier` 를 적용한다.
**보고 싶지 않은 회사를 낮은 tier 로 두지 않는다.** `disposition: exclude` 로 저장한다.
`benchmark`는 현재 직장을 비교할 때 쓴다.
회사 판정 큐에는 들어가지만 공고 분석 큐에는 들어가지 않는다.
수집 주소만 설정한 회사는 `tier: null`로 두어 모델 판정을 받는다.

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

`prioritySlots`와 `agingSlots`의 합은 `dailyAnalysisLimit`과 같아야 한다.
`dailyAnalysisLimit`은 1부터 20까지만 허용한다.
우선 슬롯은 회사 티어, `new`, `changed`, `stale` 상태, 마감 긴급도, 대기 시작 시각과 공고 ID 순서로 정한다.
보장 슬롯은 회사 티어와 무관하게 대기 시작 시각이 오래된 순서로 정한다.
한쪽 슬롯을 채울 후보가 부족하면 다른 쪽 후보가 남은 자리를 사용하며 같은 공고를 두 번 고르지 않는다.

정책은 후보자 기준 버전을 담지 않는다. 요청과 응답에 `candidateContextVersion` 칸이 없고, 보내면 `400` 이다.
기준 버전은 [후보자 맥락 문서](#후보자-맥락-문서) 절이 적은 대로 `position-preferences` 문서의 `version` 에서 계산한다.
`position-preferences` 문서를 새로 저장하면 기준 버전이 달라지고, 기존 공고 분석과 회사 tier 평가는 본문이 같아도 `stale`로 분류한다.
회사 tier 실행, 공고 분석 실행, 공고 분석과 회사 tier 평가의 `candidate_context_version` 칸은 그 행을 만들 때 계산한 기준 버전의 기록이다.
문서를 새로 저장해도 이미 있는 행의 값은 바뀌지 않는다.
정책 설정 명령의 멱등 키는 보내는 정책 전체의 hash 다.

수집 명령은 수집 전에 `position-preferences` 와 `application-state` 문서를 읽어 실행 디렉터리에 `candidate-context.json` 을 쓴다. 형태는 `{ candidateContextVersion, documents: { "position-preferences": { version, body }, "application-state": { version, body } } }` 이다.
이 파일의 `candidateContextVersion` 은 수집 명령이 읽은 문서 version 으로 만든 값이다. 모델이 읽은 본문이 어느 version 인지 알리는 용도이고 Backend 는 이 값을 받지 않는다.
개인 맥락이라 저장소 안 경로에는 쓰지 않고 파일 권한은 `0600` 이다.
정책이 없거나 형식이 잘못됐으면 전체 후보를 기본값으로 분석하지 않고 API가 `409`로 실행을 중단한다.

새 DB에는 정책 기본값을 넣지 않는다.
운영자는 첫 수집 전에 인증된 `PUT /api/positions/v1/analysis-policy` 요청으로 정책을 명시적으로 설정한다.
`GET /api/positions/v1/analysis-policy` 는 저장된 정책을 같은 형식으로 돌려주고, 없으면 `409 POLICY_NOT_CONFIGURED` 다.
모든 쓰기 요청과 마찬가지로 `Authorization: Bearer`와 `Idempotency-Key`가 필요하다.
로컬 운영 명령은 같은 endpoint를 호출하며 DB에 직접 연결하지 않는다.

```bash
bun career-os/scripts/position-recommender/configure_position_analysis_policy.ts \
  --input <분석-정책.json>
```

### 공고 후보풀과 추천 결과

#### 재사용하는 회사 조사 데이터

회사별 공개 사실은 `fos_career.company_evidence` 가 담는다. 이 문서의 「회사 근거」 절이 소유한다.
포지션 추천은 파일이 아니라 `GET api/positions/v1/companies/:companyKey/evidence` 로 읽는다.

#### 공고 후보풀

수집기가 외부 공고를 공통 형태로 바꾼 것이다.

| 필드 |
| --- |
| 소스와 외부 식별자 |
| 회사와 공고명 |
| 개별 공고 URL |
| 게시일과 마감일 |
| 활성 상태 |
| 역할 설명과 요구 경력 |
| 수집 시각 |

활성 상태를 확인할 수 없거나 개별 공고 URL 이 없으면 추천 후보로 올리지 않는다.

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
| `position_analysis_policy`        | singleton PK, 일일 상한, 슬롯과 만료일 정책                                                 |
| `company_preferences`             | `company_key` UNIQUE, 회사명, nullable tier, 수집 주소, `analyze`·`exclude`·`benchmark`, 변경 시각 |
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

이 중복이 어긋나지 않았는지 확인하는 감사 조회는
[ADR-119](adr/ADR-119-분석-실행의-처리-결과와-분석의-생성-출처를-분리해-저장한다.md)가 소유한다.

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
판단 근거와 감사 조회는
[ADR-120](adr/ADR-120-회사-tier는-사람-override와-모델-평가를-분리해-저장한다.md)이 소유한다.

| table                               | column                                                                                                                                                                                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `company_tier_assessment_runs`      | `company_tier_run_id`, `collection_run_id`, `candidate_context_version`, `contract_version`, `status`, `assessed_now_count`, `created_at`, `completed_at`                                                                                                                                              |
| `company_tier_assessments`          | `company_tier_assessment_id`, `company_key`, `company_name`, `candidate_context_version`, `contract_version`, `created_by_company_tier_run_id`, `recommended_tier`, `confidence`, `reason`, `assessment`, `signals_json`, `evidence_json`, `assumptions_json`, `assessed_at`, `valid_until`             |
| `company_tier_assessment_run_items` | `company_tier_run_id`, `company_key`, `company_name`, `selection_order`, `assessment_status`, `selection_reason`, `prior_tier`, `active_position_count`, `result_status`, `company_tier_assessment_id`, `failure_code`, `attempt_count`, `completed_at`                                                 |

수집 실행 하나는 회사 tier 실행 하나만 가지므로 `collection_run_id`에 UNIQUE를 둔다.
실행 항목은 `(company_tier_run_id, company_key)`가 PK이고 `(company_tier_run_id, selection_order)`가 UNIQUE다.
평가를 만든 실행과 실행 항목이 연결한 평가는 모두 `ON DELETE RESTRICT` foreign key로 검증하므로,
평가를 만든 실행은 삭제할 수 없다.
`company_key`는 `company_preferences`와 같은 정규화 규칙을 쓰고 별도 `companies` table을 만들지 않는다.

`recommended_tier`는 1, 2, 3과 NULL을, `confidence`는 `low`, `medium`, `high`와 NULL을 허용한다.
**NULL은 판정할 근거가 없었다는 뜻이고 지어낸 값보다 낫다.**
`recommended_tier`가 NULL이면 그 회사의 tier는 `manual`이 없는 한 `default`로 푼다.
이유는 [ADR-124](adr/ADR-124-판정-스키마는-모르는-상태를-표현한다.md)를 따른다.
`assessment_status`는 유효한 평가가 없는 회사의 `new`와 평가가 만료된 회사의 `stale` 중 하나이고,
`selection_reason`은 각각에 대응하는 `discovery`와 `refresh` 중 하나다.
`prior_tier`는 `stale` 항목이 만료된 이전 평가의 tier를 담는 자리이므로 `new` 항목에서는 비어 있다.

실행 항목의 `result_status` 다.

| 값 | 뜻 | `company_tier_assessment_id` | `failure_code` |
| --- | --- | --- | --- |
| `pending` | 아직 결과가 오지 않았다 | 없음 | 없음 |
| `created` | 새 평가 행을 만들었다 | 있음 | 없음 |
| `reused` | 고를 때는 유효한 평가가 없었는데 결과를 받을 때 이미 있었다 | 있음 | 없음 |
| `failed` | 평가하지 못했다 | 없음 | 있음 |

`reused` 는 앞선 실행과 겹쳐 돌았을 때만 나온다. 큐가 유효한 평가가 없는 회사만 고르기 때문이다.
Backend 는 같은 회사와 같은 후보자 기준 버전과 계약 버전의 유효한 평가를 찾으면
새 행을 만들지 않고 그것을 연결한다.

`failure_code` 는 다섯만 허용한다.
client 가 보내는 `research_unavailable`, `model_unavailable`, `contract_rejected`, `internal_error` 와
Backend 가 2시간이 지난 처리 중 표시를 회수하며 남기는 `lease_expired` 다.

실행 상태는 선택 항목이 모두 `created` 또는 `reused` 면 `completed`, `failed` 가 남아 있으면 `partial` 이다.
선택할 회사가 없으면 만들어지는 즉시 `completed` 다.
`assessed_now_count` 는 `created` 항목만 센다. `reused` 와 `failed` 는 들어가지 않는다.

`signals_json`은 축 셋을 각각 한 번씩만 담는다.

| 축 | 답하는 것 | 채우는 근거 |
| --- | --- | --- |
| `growth-scope` | 기술적으로 성장할 수 있는가 | `tech-blog`, `github`, `conference`, `job-posting` |
| `team-growth` | 팀이 커지고 있는가 | `dart-employment`, `dart-financial`, `job-posting` |
| `compensation-upside` | 보상과 복지가 적절한가 | `dart-employment`, `review` |

각 축은 `level`과 `evidenceIds`를 담는다.
**`evidenceIds`가 비어 있으면 `level`은 `unknown`이어야 한다.**
근거를 요구해서 등급을 받는 것이 아니라 근거가 있는 축만 등급을 받는다.

`assessment`는 유보와 조건과 반대 근거를 적는 서술이고 2000자까지다.
공개 HTML에 넣지 않는다. 공개에 실리는 것은 200자까지인 `reason`이다.

`evidence_json`의 근거 URL은 HTTPS만 허용하고 최소 개수를 요구하지 않는다.
빈 배열은 근거를 찾지 못했다는 정직한 값이다.
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
- 후보 회사와 `benchmark` 회사의 축별 판정, 근거 ID와 공개 근거 링크
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

`companyAssessments`는 후보 회사와 `benchmark` 회사의 현재 유효한 판정을 회사별로 담는다.
세 축의 등급과 `evidenceIds`에 연결된 공개 근거 URL과 제목, 200자 이하의 `reason`만 포함한다.
판정이 없거나 근거 ID가 연결되지 않은 축은 `unknown`으로 표시한다.
비공개 `assessment`는 API 추천 응답, 추천 JSON과 HTML에 넣지 않는다.
HTML에는 내부 우선순위인 tier를 표시하지 않는다.

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
개인 우선순위와 현재 역할의 본문은 후보자 맥락 문서가 소유하며 분석 이력에는 기준 버전만 저장한다.
추천 개수와 분류는 스키마가 정하지 않는다.
게시용 HTML은 이 결과에서 만든다.
HTML은 상세 추천, 분석한 활성 공고 순위, 분석 대기 목록과 수집 경고를 구분해 표시한다.
후보풀, 추천 JSON과 HTML은 게시 검증 뒤 삭제한다.
공고 분석 이력과 회사 근거는 다음 실행에서 재사용하며 Backend 와 MySQL 이 보존한다.

## resume-preparer

근거 장부는 대상 HTML 의 내용 해시와 연결해 다른 버전의 증거를 잘못 재사용하지 않게 한다.

| `schemaVersion` | 더해진 것 |
| --- | --- |
| 2 | 기술 범위와 경력 기간과 운영과 숙련도 주장이 `experienceDepth` 에 사용·기능 개발·운영 깊이·사용자 확인 수준을 기록한다 |
| 3 | `document` 와 `user` 근거에 `locator` 가 필수다. 검증기가 그 자리를 근거 파일에서 직접 찾는다 |

새 원장은 3을 쓴다. 이미 제출한 2는 locator 어긋남을 경고로만 보고하고 소급해 고치지 않는다.
locator 형식과 판정 기준은
`plugin/skills/resume-preparer/references/claim-model.md` 가 소유한다.

**`safe` 가 아닌 판정이 하나라도 남으면 제출 준비가 끝난 것이 아니다.**

`review/resume-scorecard.md` 가 담는 것이다.

| 담는 것 |
| --- |
| 독립된 인사담당자 판정 |
| 독립된 실무담당자 판정 |
| 경쟁상 차단 항목 |
| 근거 방어 결과 |
| 통제할 수 없는 위험 |

정량 점수로 약한 필수 조건을 상쇄하지 않는다. 두 검토자가 모두 통과해야 한다.

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

plugin 의 로컬 실행기는 이 디렉터리를 `CAREER_WORKSPACE_ROOT` 아래 `state/verified-claims/` 로 넘긴다.
근거 경로는 실행한 디렉터리 기준으로 적으므로, 저장소 밖에서 쓰는 근거는 대부분 「그 밖의 로컬 파일」 로 나뉜다.

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

### `library/resume-logos/`

이력서 HTML 에 회사와 학교 로고를 붙이는 자산이다. 개인 경력을 드러내므로 비공개 작업본에만 둔다.

| 파일 | 담는 것 |
| --- | --- |
| `index.json` | `{ "map": { "<h3 제목이 시작하는 이름>": "<이미지 파일 이름>" } }` |
| `*.png`, `*.svg` | 로고 이미지. 렌더러가 base64 로 인라인한다 |

제목이 `map` 의 key 로 시작하면 그 로고가 붙고, 없는 이름은 로고 없이 렌더한다.

## study-topic-recommender

공부 주제 추천의 소스, 자료, 추천 이력과 제외 판정은 `fos_career` 의 `study_` table 이 담는다.
skill 과 수집기는 table 에 직접 접속하지 않고 `/api/study/v1` 만 호출한다.
HTTP 계약과 오류 코드는 [`flow.md`](flow.md#study-topic-recommender)가 소유한다.

### study table

| table | 담는 것 |
| --- | --- |
| `study_sources` | 수집할 외부 소스. 원본이다 |
| `study_source_cursors` | 소스와 mode 마다 이어서 모을 위치 |
| `study_materials` | 수집한 자료. `content_key` 로 한 번만 저장한다 |
| `study_material_sources` | 자료가 어느 소스에서 나왔는지. 한 자료가 여러 소스에서 나올 수 있다 |
| `study_recommendation_control` | `history_version`. 한 행이다 |
| `study_recommendation_runs` | 일별 추천 실행 |
| `study_recommendation_topics` | 실행이 고른 공부 주제 |
| `study_recommended_materials` | 주제에 연결한 추천 자료 |
| `study_material_verdicts` | 고르지 않은 후보의 판정 |
| `study_publications` | 외부 게시 성공 이력 |

멱등 영수증은 커리어 Backend 가 함께 쓰는 `request_receipts` 에 둔다.

옛 `fos-blog` 설계의 열세 table 에서 넷을 뺐다.
`study_material_states` 와 `study_material_tags` 는 쓰는 화면과 값이 없다. client 가 보내는 `tags` 는 늘 빈 배열이다.
`study_recommendation_items` 는 `study_recommended_materials` 와 합쳤다.
`study_request_receipts` 는 공용 `request_receipts` 로 대신한다.
그리고 제외 판정을 담는 `study_material_verdicts` 를 더했다.

### `study_sources`

| 칸 | 타입 | 설명 |
| --- | --- | --- |
| `source_key` | `VARCHAR(100)` PK | 회사나 매체를 나타내며 주제를 담지 않는다 |
| `title` | `VARCHAR(255)` | 표시 이름 |
| `category` | `VARCHAR(50)` | 수집 카테고리 |
| `adapter` | `ENUM('feed','page','youtube')` | |
| `url` | `VARCHAR(2048)` NULL | HTTPS |
| `feed_url` | `VARCHAR(2048)` NULL | HTTPS |
| `enabled` | `BOOLEAN` | 이번 실행에서 수집할지 |
| `note` | `VARCHAR(500)` NULL | 사람이 무엇을 왜 바꿨는지 |
| `version` | `INT UNSIGNED` | 낙관적 잠금 |
| `created_at`, `updated_at` | `DATETIME(3)` | |

`url` 과 `feed_url` 중 하나 이상은 NOT NULL 이다. `CHECK` 로 강제한다.

### `study_source_cursors`

`(source_key, mode)` 가 PK 이고 `mode` 는 `recent` 와 `archive` 다.
`cursor_json` 은 서버가 해석하지 않는 JSON 이고 직렬화 64 KiB 이하다.
`version` 은 성공한 ingestion 만 올린다.

### `study_materials`

| 칸 | 타입 | 설명 |
| --- | --- | --- |
| `content_key` | `VARCHAR(191)` PK | YouTube 영상이면 video ID, 일반 글이면 정규화한 URL 의 SHA-256 |
| `canonical_url` | `VARCHAR(2048)` | 추적 query 와 fragment 를 지운 HTTPS URL |
| `url` | `VARCHAR(2048)` | 수집한 원문 URL |
| `title` | `VARCHAR(500)` | |
| `published` | `VARCHAR(100)` | 피드가 준 게시 시각 원문 |
| `published_at` | `DATETIME(3)` NULL | 해석할 수 있을 때만 |
| `excerpt` | `TEXT` NULL | 2,000자 이하 |
| `kind` | `ENUM('feed-article','feed-video','page-link','page-video')` | 수집 경로 |
| `first_collected_at`, `last_collected_at` | `DATETIME(3)` | |

같은 `content_key` 를 다시 받으면 행을 늘리지 않고 제목과 발췌와 `last_collected_at` 을 갱신한다.

### `study_recommendation_control`

한 행이다.

| 칸 | 설명 |
| --- | --- |
| `history_version` | 추천 실행을 저장할 때마다 1 씩 오른다 |

후보자 기준 버전은 이 행에 두지 않는다. `learning-interests` 문서의 `version` 에서 계산한다.

### 추천 실행

`study_recommendation_runs` 는 `report_id` 가 PK 이고 서울 날짜의 `morning-YYYY-MM-DD` 다.
`generated_at` 과 그 실행이 쓴 `candidate_context_version` 을 담는다.

`study_recommendation_topics` 는 `(report_id, topic_key)` 가 PK 이다.

| 칸 | 설명 |
| --- | --- |
| `topic_key` | 날짜가 달라도 같은 개념을 식별하는 kebab-case 키 |
| `title` | 외부 자료에서 도출한 공부 주제 |
| `career_question` | 현재 업무나 다음 역할에 적용해 볼 질문. NULL 허용 |
| `position` | 리포트 안의 순서 |

`study_recommended_materials` 는 `(report_id, content_key)` 가 PK 이다.

| 칸 | 설명 |
| --- | --- |
| `content_key` | **UNIQUE 다.** 한 번 추천한 자료는 다시 추천하지 않는다 |
| `topic_key` | 연결한 주제 |
| `summary`, `reason` | NULL 허용 |
| `career_value` | `current-work`, `target-role`, `engineering-judgment`, `product-business` 중 하나. NULL 허용 |
| `position` | 주제 안의 순서 |

`career_question`, `summary`, `reason`, `career_value` 를 NULL 로 두는 이유는 이관이다.
파일에 있던 이력은 이 값이 없거나 일부만 있다. 지어낸 문장으로 채우지 않는다.
정상 실행은 모델이 모두 채우고, client 의 선택 검증이 빈 값을 거부한다.

직전 실행과 같은 `topic_key` 는 고를 수 없다. 서버가 저장 시점에 다시 검증한다.

### `study_material_verdicts`

고르지 않은 후보의 판정이다.

| 칸 | 타입 | 설명 |
| --- | --- | --- |
| `content_key` | `VARCHAR(191)` | |
| `candidate_context_version` | `VARCHAR(191)` | 판정할 때의 후보자 기준 버전 |
| `verdict` | `ENUM('rejected')` | 지금은 제외 하나다 |
| `reason` | `VARCHAR(300)` | 한 줄 이유 |
| `report_id` | `VARCHAR(40)` | 판정한 실행 |
| `judged_at` | `DATETIME(3)` | |
| `valid_until` | `DATE` | 판정한 날부터 30일 |

`(content_key, candidate_context_version)` 이 PK 다.
같은 기준 버전에서 다시 판정하면 갱신한다.

후보 조회는 아래 둘 중 하나라도 맞으면 그 자료를 뺀다.

- `study_recommended_materials` 에 있다
- 지금의 기준 버전 `learning-interests:v{version}` 으로 된 판정이 있고 `valid_until` 이 오늘 이후다

관심사 문서를 새로 저장하면 기준 버전이 바뀌어 예전 판정은 지우지 않아도 조회에서 저절로 빠진다.
이유는 [ADR-127](adr/ADR-127-공부-추천은-고르지-않은-후보의-판정을-재사용한다.md)과
[ADR-131](adr/ADR-131-후보자-맥락은-backend-문서로-두고-공부-추천-기준-버전을-문서-버전에서-계산한다.md)을 따른다.

### `study_publications`

`publication_id` 가 PK 이고 `report_id` 가 `study_recommendation_runs` 를 가리킨다.
`channel`, `url`, `external_id`, `published_at` 을 담는다.
멱등 키는 `publication:` 뒤에 고정 순서 `{reportId,channel,publishedAt,externalId,url}` JSON 의 UTF-8 SHA-256 hex 를 붙인다.

파일 원본은 2026-09-25에 Backend로 이관했고 이관 명령은 삭제했다.

### 실행 중 생성되는 읽을거리 데이터

시스템 임시 경로에 만들고 게시와 검증이 끝나면 지운다.

수집 후보다.

| 필드 | 값 |
| --- | --- |
| `contentKey` | 정규화한 URL. 중복과 이전 추천 판정의 키다 |
| 원문 URL, 출처, 제목, 게시 시각 | |
| `excerpt` | 피드가 주면 담는 공개 설명문 |
| `previouslyRecommended` | 서버가 준 값. 이미 추천한 자료는 후보로 오지 않으므로 늘 `false` 다 |

후보풀은 `recentStudyTopicKeys` 로 직전 리포트의 공부 주제 키를 함께 담는다.
후보풀 옆 메타데이터는 `historyVersion`, `candidateContextVersion` 과 함께 `learningInterests` 의 `version` 과 `body` 를 담는다.

선별 결과는 공부 주제 배열과 고르지 않은 후보의 `rejections` 다.

| 필드 | 값 |
| --- | --- |
| `topicKey` | 날짜가 달라도 같은 개념을 식별하는 kebab-case 키 |
| `title` | 외부 자료에서 도출한 공부 주제 |
| `careerQuestion` | 현재 업무나 다음 역할에 적용해 볼 질문 |
| `items` | 이 주제에 연결한 추천 자료 하나 이상 |

각 추천 자료는 카테고리, 제목, 원문 URL, 출처, 요약, 추천 이유, 커리어 연결 유형을 가진다.
연결 유형은 `current-work`, `target-role`, `engineering-judgment`, `product-business` 중 하나다.

선택 단계는 리포트와 같은 `state/` 디렉터리에 `recommendation-request.json` 을 만든다.
추천을 저장할 때 이 파일과 리포트를 함께 읽는다.

| 필드 | 값 |
| --- | --- |
| `reportId` | 리포트의 `generatedAt` 에서 계산한 서울 날짜의 `morning-YYYY-MM-DD` |
| `generatedAt` | 리포트와 같은 UTC ISO 시각 |
| `candidateContextVersion` | 후보 조회에서 받은 비어 있지 않은 기준 버전 |
| `rejections` | 고르지 않은 후보의 `candidateId` 와 한 줄 이유 |

`reportId` 나 `generatedAt` 이 리포트와 다르거나 파일이 없으면 API 에 추천 저장 요청을 보내지 않는다.

**고를 수 없는 것이 둘이다.** `previouslyRecommended: true` 인 후보와
직전 리포트와 같은 `topicKey` 다.

**원문에 없는 값을 기본값으로 채우지 않는다.** 예상 학습 시간과 난이도와 분야가 여기 해당한다.
필요하지만 확인할 수 없으면 정보가 없다고 표시한다.

### cursor 와 자료 배치

후보풀은 API 후보 조회 결과이므로 `collectionLog`를 빈 배열로 둔다.
HTML report의 counts는 `activeSources`를 `GET /sources`의 enabled 소스 수, `sourcesWithCandidates`를 후보에 나타난 sourceKey 수, `collectedArticles`를 후보풀 길이로 계산한다.
카테고리별 source count도 enabled 소스 목록에서 계산한다.

cursor는 sourceKey와 mode별로 서버가 관리한다.
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

자료 배치 저장의 규칙이다.

- `items` 는 한 요청에 100개 이하다.
- recent 의 `lastSeen` 은 이번 정상 응답에서 확인한 기존 키와 저장할 새 키만 담는다.
  실행 한도에 걸려 아직 저장하지 않은 자료는 넣지 않는다.
- 다음 응답에 없는 키는 지워도 된다. 다시 수집되면 서버가 `contentKey` 로 같은 자료를 갱신한다.
- 수집기 한도는 배치 크기와 외부 요청량을 제한하는 값이다. 누적 자료의 보관 한도가 아니다.

자료의 `kind` 로 같은 sourceKey 라도 수집 경로를 구분한다.

| 수집 경로 | `kind` |
| --- | --- |
| feed recent | `feed-article`, `feed-video` |
| archive sitemap | `page-link` |
| YouTube uploads archive | `page-video` |

feed 와 page recent 는 `fetchedAt` 을 기록한다.
YouTube recent 는 API 키 없이 RSS 를 쓰고 `rssOnly:true` 를 기록한다.

실패와 빈 상태를 구분한다.

- 정상 빈 문서와 HTTP·파싱 실패를 구분한다. stale cache 로 실패를 대신하지 않는다.
- 다음 위치를 확정할 수 없으면 `POST /ingestions` 를 보내지 않는다.
  수집 실패, 파싱 실패, API 키 부재가 여기 해당한다.
- 정상적인 빈 페이지를 확인했을 때만 빈 `items` 와 다음 cursor 를 보낼 수 있다.
- sitemap index 나 본문이 이전 digest 와 달라지면 변경을 감지한 상태로 실패하고 cursor 를 진행하지 않는다.

cursor 는 성공한 ingestion 만 교체한다. 충돌하면 기존 cursor 를 유지한다.
직렬화 크기가 64 KiB 를 넘지 않아야 하며, 넘을 것 같으면 pending 목록을
다음 실행에서 다시 계산할 수 있는 작은 상태로 줄인다.
더 수집할 항목이 없으면 `done:true` 로 저장한다.
처음부터 다시 수집할 때는 `--reset-cursor` 를 쓴다. 조합은 스킬의 `references/execution.md` 가 소유한다.

추천 저장은 `MorningReadingReport` 와 같은 디렉터리의 `recommendation-request.json` 을
API `recommendation-runs` payload 로 변환해 보낸다.
`reportId`는 서울 날짜의 `morning-YYYY-MM-DD`, `generatedAt`은 UTC ISO 문자열을 사용한다.
HTML은 기존 렌더러가 만들며, Markdown 리포트는 만들지 않는다.
HTML과 report JSON 검증이 끝난 뒤 `--commit-recommendation --report <RUN_DIR>/state/morning-reading.json` 명령이 같은 `generatedAt`을 재사용해 저장한다.
게시가 별도로 성공한 뒤에만 publications 기록을 보낸다.
publication의 `idempotencyKey`는 `publication:` 뒤에 고정 순서 `{reportId,channel,publishedAt,externalId,url}` JSON의 UTF-8 SHA-256 hex를 붙인다.
추천 저장이 실패하면 완료로 보지 않고, 파일 이력에 대신 쓰지 않는다.

## sync-profile

이 스킬은 상태 파일을 두지 않는다.
외부 프로필의 현재 값은 실행할 때마다 대상 서버에서 다시 읽는다.
로컬에 사본을 두면 서버와 어긋난 것을 알 수 없다.

원고는 커리어 Backend 의 프로필 원고 문서다. 문서 키는 `wanted`, `linkedin`, `github` 이다.
저장 규칙은 후보자 맥락 문서와 같고 근거는 [ADR-133](adr/ADR-133-프로필-원고와-에이전트-사용량-기록은-backend의-profile-모듈이-갖는다.md)이다.
원고가 담는 것이다.

| 담는 것 |
| --- |
| 프로필에 실제로 올라간 내용. 이력서 초안의 사본이 아니다 |
| 폼 제약으로 원고와 다르게 넣은 것과 그 이유 |

등록하지 못한 기술과 종료월을 넣은 진행 중 프로젝트가 두 번째에 해당한다.
파일 배치는 [`code-architecture.md`](code-architecture.md#sync-profile)가 소유한다.

### 프로필 원고 table

커리어 Backend 의 `profile` 모듈이 대상별 프로필 원고의 원본을 갖는다.
문서 키마다 Markdown 본문 하나이고, 저장 규칙은 [「후보자 맥락 문서」](#후보자-맥락-문서)와 같다.
후보자 맥락 문서는 스킬이 판단에 쓰는 입력이고 프로필 원고는 밖에 올린 결과라 table 을 따로 둔다.
HTTP 계약은 [`flow.md`](flow.md#프로필-http-계약)가 소유한다. 이유는 [ADR-133](adr/ADR-133-프로필-원고와-에이전트-사용량-기록은-backend의-profile-모듈이-갖는다.md)을 따른다.

| 문서 키 | 담는 것 |
| --- | --- |
| `wanted` | 원티드 프로필 원고 |
| `linkedin` | LinkedIn 프로필 원고 |
| `github` | GitHub 프로필 README 원고 |

`profile_documents` 는 문서 키마다 한 행이다.

| 칸 | 타입 | 설명 |
| --- | --- | --- |
| `document_key` | `VARCHAR(50)` PK | 위 세 값 중 하나. `CHECK` 로 강제한다 |
| `body` | `MEDIUMTEXT` | Markdown 본문. 서버가 UTF-8 64 KiB 이하만 받는다 |
| `version` | `INT UNSIGNED` | 저장할 때마다 1 씩 오른다. 첫 저장이 1 이다. `CHECK` 로 1 이상을 강제한다 |
| `note` | `VARCHAR(500)` | 마지막 변경 이유 |
| `updated_at` | `DATETIME(3)` | |

`profile_document_revisions` 는 저장할 때마다 한 행을 더한다. 지우거나 고치지 않는다.

| 칸 | 타입 | 설명 |
| --- | --- | --- |
| `document_key` | `VARCHAR(50)` | `profile_documents` 를 가리키는 외래 키. `RESTRICT` 다 |
| `version` | `INT UNSIGNED` | 이 저장으로 생긴 version |
| `body` | `MEDIUMTEXT` | 그때의 본문 |
| `note` | `VARCHAR(500)` | 변경 이유 |
| `created_at` | `DATETIME(3)` | |

`(document_key, version)` 이 PK 다. 문서 행을 지우는 경로는 없다.

### 에이전트 사용량 기록 table

`agent_usage_snapshots` 는 달마다 한 행이다. 세션 기록이 기기에서 지워진 뒤에는 그 달을 다시 셀 수 없어,
측정한 값을 그때 적어 두고 이후에는 바꾸지 않는다.

| 칸 | 타입 | 설명 |
| --- | --- | --- |
| `month` | `CHAR(7)` PK | `YYYY-MM`. `CHECK` 로 형식을 강제한다 |
| `claude_tokens` | `BIGINT UNSIGNED` | 그 달의 Claude Code 토큰 |
| `codex_tokens` | `BIGINT UNSIGNED` | 그 달의 Codex 토큰 |
| `claude_cost_usd` | `DECIMAL(12,2)` NULL | 공개 API 단가로 환산한 비용. 측정하지 못했으면 비운다 |
| `codex_cost_usd` | `DECIMAL(12,2)` NULL | 위와 같다 |
| `sessions` | `INT UNSIGNED` NULL | 세션 수. 측정하지 못했으면 비운다 |
| `unpriced_tokens` | `BIGINT UNSIGNED` | 단가를 몰라 비용에서 뺀 토큰 |
| `measured_on` | `DATE` | 측정한 날 |
| `source` | `VARCHAR(20)` | `MEASURED` 나 `BACKFILLED`. `CHECK` 로 강제한다 |
| `note` | `VARCHAR(500)` NULL | 기록을 바꾼 이유나 되읽은 출처 |
| `created_at` | `DATETIME(3)` | |
| `updated_at` | `DATETIME(3)` | |

- `MEASURED` 는 세션 기록에서 직접 센 값이다. `BACKFILLED` 는 세션 기록이 지워진 뒤 옛 산출물에서 되읽은 값이고 환산 비용과 세션 수가 없을 수 있다.
- 토큰 칸이 `BIGINT` 인 이유는 한 달 값이 `INT UNSIGNED` 의 상한인 약 43억을 넘기 때문이다. HTTP 응답에서는 JSON 숫자로 낸다.
- **그 달의 행이 이미 있으면 저장 요청이 와도 값을 바꾸지 않는다.** 바꾸는 경로는 요청이 `replace` 와 사유를 함께 보낼 때뿐이다. 이력 table 은 두지 않고 바꾼 사유를 `note` 에 남긴다.
- 끝나지 않은 달은 행을 만들 수 없다. 달 중간의 값이 그 달의 기록으로 굳는 것을 막는다.
- 행을 지우는 경로는 없다.

코드 배치는 [`code-architecture.md`](code-architecture.md#sync-profile)가 소유한다.

### 수집기가 올리는 사용량 기록

수집기는 `agent_usage.py --json` 의 `months` 배열 한 줄을 사용량 기록 한 행으로 올린다.

| `agent_usage.py --json` 의 값 | 사용량 기록의 칸 | 바꾸는 것 |
| --- | --- | --- |
| `month` (`YYYY.MM`) | `month` | 점을 `-` 로 바꿔 `YYYY-MM` 으로 보낸다 |
| `claude_tokens`, `codex_tokens` | `claude_tokens`, `codex_tokens` | 그대로다. 0 이상 정수다 |
| `claude_cost`, `codex_cost` | `claude_cost_usd`, `codex_cost_usd` | 그대로다. 소수 둘째 자리까지의 달러다 |
| `sessions` | `sessions` | 그대로다 |
| `unpriced_tokens` | `unpriced_tokens` | 그대로다. 단가를 모르는 모델의 토큰이고 비용에 들어 있지 않다 |
| 없음 | `measured_on` | 수집기가 돈 날의 `Asia/Seoul` 날짜다 |
| 없음 | `source` | 언제나 `MEASURED` 다 |

`unpriced_tokens` 는 달마다 낸다. 합계에만 있으면 한 달의 기록에 넣을 수 없다.

### 다른 기기의 사용량 합계 파일

세션 기록이 여러 기기에 나뉘어 있으면 다른 기기에서 `agent_usage.py --totals-json --source <기기 이름>` 으로 합계 파일을 내보내고,
측정하는 기기에서 `agent_usage.py --merge <파일>` 로 더한다. 파일 하나는 한 기기의 기록이다. 같은 기기의 세션이 든 파일을 더하면 두 번 센다.

```json
{
  "source": "company",
  "months": {
    "YYYY-MM": {
      "claude": { "<모델>": { "input": 0, "cache_write_5m": 0, "cache_write_1h": 0, "cache_read": 0, "output": 0 } },
      "codex": { "<모델>": { "input": 0, "cached": 0, "output": 0, "total": 0 } },
      "claude_sessions": 0,
      "codex_sessions": 0
    }
  }
}
```

- 칸은 위와 정확히 같아야 한다. 빠지거나 남는 키가 있으면 `--merge` 가 종료 코드 2 로 거절한다.
- 값은 0 이상 정수다. Codex 는 `input` 이 `cached` 를 포함하고, `cached <= input`, `total >= input + output` 이다.
- 환산 비용은 파일에 두지 않는다. 더하는 쪽이 자기 단가표로 다시 환산한다.
- 여러 파일의 `source` 가 겹치면 거절한다.
- 합친 값으로 이미 기록된 달을 바꾸면 `note` 에 합친 `source` 를 적는다.

`library/profiles/github-agent-usage-snapshots.md` 의 표에서 옮긴 달은 다르게 저장한다.
그 표는 토큰을 십억 단위 소수 한 자리(`1.3B`)로 적었고 환산 비용과 세션 수의 칸이 없다.

| 칸 | 옮긴 달의 값 |
| --- | --- |
| `claude_tokens`, `codex_tokens` | 표의 값에 십억을 곱한 정수다. 1억 토큰 아래 자리는 0 이다 |
| `claude_cost_usd`, `codex_cost_usd`, `sessions` | 비운다 |
| `unpriced_tokens` | 0 이다. 비용이 비어 있어 뜻이 없다 |
| `measured_on` | 표의 「측정한 날」 이다 |
| `source` | `BACKFILLED` 다. 한 달 전체를 측정한 달이라고 명령에 알려 준 달만 `MEASURED` 다 |
| `note` | 표의 「비고」 다 |

환산 비용이나 세션 수가 빈 달이 섞이면 프로필의 그 배지는 합계를 낼 수 없어 뺀다.

## fos-career 커넥터

커넥터의 MCP 서버는 아무것도 저장하지 않는다. README 는 GitHub 의 프로필 저장소가, 이력서는 원티드가 갖는다.
후보자 맥락 문서는 사용자의 기억이, 프로필 원고와 표 데이터는 작업 폴더가 갖고 스킬과 로컬 실행기가 다룬다([ADR-147](adr/ADR-147-후보자-맥락-문서는-비서의-기억이-프로필-원고는-작업-폴더-파일이-갖는다.md)).
이 절은 커넥터의 환경 변수와 MCP 계약의 단일 소스다. 입력 스키마의 정본은 `plugin/src/tools.ts` 와 `plugin/src/wanted/fields.ts` 다.

### 커넥터 환경 변수

| 이름 | 누가 주나 | 필수 | 내용 |
| --- | --- | :---: | --- |
| `CAREER_GITHUB_TOKEN` | 사용자. 연결 칸 `github_token` | 아니오 | 프로필 저장소 하나의 내용 읽기와 쓰기 권한만 가진 token |
| `CAREER_GITHUB_TOKEN_URL` | fos-assistant 실행기. 「GitHub 으로 연결」 단추로 만든 연결에만 값이 있다 | 아니오 | fos-assistant 의 토큰 통로 주소(HTTP 또는 HTTPS). 값이 있으면 `CAREER_GITHUB_TOKEN` 대신 쓴다. `connector.json` 의 `oauth.token_env` 다 |
| `CAREER_GITHUB_PROFILE_REPO` | 운영자 | 예 | `<owner>/<repo>` 모양의 프로필 저장소 이름 |
| `CAREER_BROWSER_URL` | fos-assistant 실행기 | 아니오 | 「내 브라우저」 중계 주소. 없으면 원티드 도구가 `CAREER_BROWSER_UNREACHABLE` 로 답한다. `connector.json` 의 `owner_browser_env` 다 |

서버는 커리어 Backend 의 주소와 token, Cloudflare Access 값을 읽지 않는다. 연결 화면에 필수 칸이 없다.

값이 `${` 로 시작하면 치환되지 않은 변수 참조이므로 없는 값으로 다룬다.
`CAREER_GITHUB_PROFILE_REPO` 가 없거나 모양이 틀리면 서버가 `CAREER_CONFIG` 로 시작하지 않는다.
`CAREER_GITHUB_TOKEN` 과 `CAREER_GITHUB_TOKEN_URL` 이 둘 다 없으면 서버는 시작하고 GitHub 도구가 `CAREER_GITHUB_NOT_CONFIGURED` 로 답한다. 하나라도 있으면 `check_connection` 은 GitHub 을 설정된 것으로 보고 실제로 불러 본다.
`CAREER_GITHUB_TOKEN_URL` 이 있으면 GitHub 도구를 부를 때마다 그 주소에 `GET` 을 보내 `{access_token, expires_at}` 의 `access_token` 을 받고, 그 한 번의 도구 호출 안의 GitHub 요청에 모두 쓴다. 다음 호출에서 다시 받으므로 fos-assistant 가 갱신한 token 이 재시작 없이 쓰인다. 계약은 fos-assistant 의 `hermes/connectors/README.md` 「비밀값과 권한」 과 `docs/features/connector-oauth/design.md` 「선언」 을 따른다.
주소가 HTTP 나 HTTPS 가 아니어도 서버는 시작하고, GitHub 도구만 `CAREER_GITHUB_NOT_CONFIGURED` 로 답한다. GitHub 은 선택 기능이라 나머지 도구를 막지 않는다. 통로를 부르지 않고 붙여 넣은 token 으로도 넘어가지 않는다.
token 과 통로 주소를 파일에 저장하지 않고 로그와 결과, 오류 응답에 넣지 않는다.

### 로컬 실행기 환경 변수

스킬이 부르는 `dist/career-local.js` 가 셸 환경에서 읽는 값이다. 스킬은 `bun --no-env-file` 로 불러 cwd 의 `.env` 를 읽지 않는다.
공고·공부·면접 실행기는 Backend 값을 읽지 않는다. 아래 Backend 값은 노트북 전용 `usage` 실행기만 읽는다.

| 이름 | 필수 | 내용 |
| --- | :---: | --- |
| `CAREER_BACKEND_URL` | `usage` 만 | 커리어 Backend origin |
| `CAREER_BACKEND_TOKEN` | `usage` 만 | Backend 의 Bearer token. `CAREER_BACKEND_TOKEN_FILE`(권한 0600 파일)로 대신할 수 있다 |
| `CAREER_BACKEND_ACCESS_CLIENT_ID`, `CAREER_BACKEND_ACCESS_CLIENT_SECRET` | 아니오 | Backend 앞에 Cloudflare Access 가 있을 때의 service token. secret 은 `CAREER_BACKEND_ACCESS_CLIENT_SECRET_FILE` 로 대신할 수 있다. 계약은 ADR-140 을 따른다 |
| `CAREER_WORKSPACE_ROOT` | 아니오 | 커리어 작업 폴더. 공고·공부·면접 실행기는 없으면 `/workspace/career` 를 쓴다(위 「커리어 작업 폴더」). 노트북 전용 실행기(`workspace`, `resume`)는 없으면 `~/.fos-career/workspace` 를 쓴다 |
| `CAREER_WORKSPACE_SSH_TARGET` | 아니오 | 이 값을 지정하면 홈서버 동기화를 켠다. `CAREER_WORKSPACE_REMOTE_COMMAND`, `CAREER_WORKSPACE_SSH_ARGS` 를 함께 읽는다 |
| `YOUTUBE_DATA_API_KEY` | 아니오 | 공부 자료 archive 수집의 YouTube Data API key |
| `CAREER_EVIDENCE_DIR` | 아니오 | 스킬이 읽는 프로젝트 근거 디렉터리. 없으면 `CAREER_WORKSPACE_ROOT` 아래 `evidence/`. `workspace paths --json` 이 `evidenceDir` 로 알려 준다. `package check-sources` 는 이 디렉터리나 그 바로 위가 Git 저장소의 루트일 때 그 저장소가 원격보다 뒤처졌는지 본다 |
| `FOS_ASSISTANT_URL`, `FOS_ASSISTANT_SERVICE_TOKEN` | 아니오 | `application-package-writer` 가 지원서 공통 프로필을 읽는 `application-profile` 실행기의 fos-assistant origin 과 서비스 토큰. 계약은 ADR-136 을 따른다. Cloudflare Access 가 앞에 있으면 `FOS_ASSISTANT_ACCESS_CLIENT_ID`, `FOS_ASSISTANT_ACCESS_CLIENT_SECRET` 도 읽는다 |
| `BROWSER_DRIVER` | 아니오 | `sync-profile` 의 폼 조작 스크립트가 부르는 `browser-driver` 명령의 경로. 없으면 PATH 의 `browser-driver` |
| `CAREER_DART_API_KEY` | 아니오 | 공고 추천의 회사 근거 수집에 쓰는 OpenDART key. `CAREER_DART_API_KEY_FILE`(권한 0600 파일)로 대신할 수 있다. 없으면 DART 근거를 건너뛴다 |

작업본의 기본 위치를 plugin 데이터 디렉터리에 두지 않는다. plugin 을 지우면 그 디렉터리가 함께 지워진다.
token 과 문서 본문을 실행기의 로그와 오류 출력에 싣지 않는다.

### 도구

Hermes 에서는 서버 이름 `career` 로 `mcp__career__<도구>` 가 된다.
`check_`, `get_` 으로 시작하는 도구는 읽기 전용으로 표시한다. 도구는 아래 다섯뿐이다.

| 도구 | 위험도, 승인 | 입력 | 결과 |
| --- | --- | --- | --- |
| `check_connection` | `READ`, `none` | 없음 | `{ github: "ok" \| "not_configured" }`. 확인 도구다. GitHub 연결이 없어도 성공한다 |
| `get_github_profile` | `READ`, `none` | 없음 | `{ repo, branch, head, readme }`. `head` 는 기본 branch 의 끝 커밋 SHA 이고 `readme` 는 그 커밋에서 읽은 값이다. README 가 없으면 `null` 이다 |
| `update_github_profile` | `WRITE`, `required`, `outbound: true`, `grant: false` | `readme`, `expectedBranch`, `expectedHead` | `{ changed, commitSha, branch }` |
| `get_wanted_resume` | `READ`, `none` | 선택 `resumeKey` | 이력서 칸 목록이나 고를 이력서 목록, 로그인 넘기기. 계약은 [`features/profile-browser-sync/design.md`](features/profile-browser-sync/design.md) |
| `update_wanted_resume` | `WRITE`, `required`, `outbound: true`, `grant: false` | `resumeKey`, `resumeTitle`, `changes` | 칸마다의 결과 |

- 쓰기 도구 둘은 누구나 볼 수 있는 프로필을 바꾸므로 `outbound: true` 이고 `grant: false` 로 상시 허락을 닫는다. 승인 카드에 「승인하고 묻지 않기」 와 「이 대화에서 계속 허용」 이 나오지 않고 호출마다 사람이 승인한다. `conversation_grant` 는 선언하지 않는다
- `update_github_profile` 은 `README.md` 한 파일만 쓴다. `readme` 는 README 전체의 Markdown 이다. 입력 스키마가 `readme`, `expectedBranch`, `expectedHead` 밖의 키(`months`, 합계, SVG)를 거절한다
- **에이전트 사용량 차트와 Tokens 배지는 프로필에서 뺐다.** 도구는 사용량 기록을 읽지 않고 `agent-usage.svg` 를 쓰거나 지우지 않는다. README 에서 차트 그림과 배지를 빼는 일은 `career-connector` 스킬이 안내한다. 사용량 기록이 노트북 파일로 가 더 갱신되지 않으므로 멈춘 숫자가 최신처럼 보이지 않게 한다
- `expectedBranch` 와 `expectedHead` 는 변경안을 만들 때 읽은 `get_github_profile` 의 `branch` 와 `head` 다. `expectedHead` 는 소문자 40자리 SHA 다. 둘은 승인 인자에 함께 저장되므로, 승인을 기다리는 사이 README 가 바뀌거나 기본 branch 가 바뀌면 실행할 때 `CAREER_GITHUB_STALE_REVIEW` 로 거절하고 GitHub 에 아무것도 쓰지 않는다. 최신 끝 커밋 위에 검토한 원고를 다시 올리지 않는다
- 커밋이 하나도 없는 빈 프로필 저장소는 끝 커밋을 읽을 수 없어 `get_github_profile` 이 `CAREER_GITHUB_UNAVAILABLE` 로 답한다. 첫 커밋은 GitHub 에서 직접 만든다
- 두 칸이 없는 옛 형식의 요청은 입력 검증에서 `CAREER_INVALID_INPUT` 으로 거절한다. 검토 기준을 모르는 원고를 최신 끝 커밋에 올리지 않기 위해서다
- `commitSha` 는 올라간 커밋이다. `changed: false` 이면 저장소가 이미 같은 내용이라 커밋을 만들지 않은 것이고 `commitSha` 는 그때의 branch 끝이다
- 결과는 MCP 응답의 첫 텍스트 칸에 JSON 으로 싣는다. `check_connection` 은 같은 값을 `structuredContent` 에도 싣는다
- 오류는 `isError: true` 와 `{ error: { code, message } }` 다

**승인이 필요한 도구의 인자는 fos-assistant 가 UTF-8 16KB 까지만 받는다.**
키와 따옴표를 포함해 직렬화한 인자 전체의 크기다. 한글은 한 글자가 3바이트라 본문이 5천 자 안팎이면 닿는다.
넘는 호출은 커넥터에 닿기 전에 거절된다.

### 실행기로 옮긴 일

MCP 도구가 하던 일 가운데 커리어 데이터를 읽고 쓰는 것은 실행기 명령과 스킬로 옮겼다.

| 하던 도구 | 지금 |
| --- | --- |
| 후보자 맥락 문서 읽기와 저장 | 기억 도구(`memory_search`, `memory_read`, `memory_remember`). 제목은 [후보자 맥락 문서](#후보자-맥락-문서) |
| 프로필 원고 읽기와 저장 | 작업 폴더 `library/profiles/<wanted\|linkedin\|github>.md` 를 파일 도구로 |
| 면접 질문 고르기, 기록, 개인 질문 | `<CAREER_LOCAL> interview select \| progress \| record \| personal` |
| 공부 후보와 추천 | `study-collection` 스킬의 `<CAREER_LOCAL> study` |
| 공고 제외 기준 읽기와 판정 | `<CAREER_LOCAL> position exclusions get`, `position check-exclusions --input <JSON>` |
| 사용량 기록 읽기 | 없음. 사용량은 프로필에 넣지 않는다 |

`position check-exclusions` 의 입력은 `{ postings: [{ url, company, title, source?, identityHash? }] }`(1개에서 10개)이고 결과는 `{ results: [{ position, url, verdict, basis? }] }` 다.

- `verdict` 는 `excluded`, `clear`, `undeterminable` 이다. `basis` 는 `excluded` 일 때 `identity`, `url`, `company`, `company-role`, `company-preference` 이고 `undeterminable` 일 때 `identity-missing`, `invalid-url`, `rule-unreadable` 이다. `clear` 는 이 공고에 적용되는 규칙을 모두 비교했고 걸린 것이 없다는 뜻이다. 단 `source` 를 모르는 공고는 식별자와 URL 을 함께 가진 규칙을 정규화 URL 로만 비교한다. 회사 비교는 `companyKey` 와 같은 정규화(공백 연속과 대소문자)를 쓴다
- `source` 는 수집기 어댑터의 이름(`SOURCE_IDS`)만 받고 `identityHash` 는 `source` 와 함께만 받는다. 두 값은 공고 목록이 준 것만 넘기며 주소에서 만들지 않는다. 식별자만으로 비교하는 규칙(URL 이 없는 공고 제외)이 있는데 공고의 식별자가 없으면 `undeterminable` 이고 추천하지 않는다
- `source` 를 모르는 공고는 정규화 URL 이 같은 규칙에 걸리고, 알면 `source` 와 정규화 URL 이 모두 같은 규칙에 걸린다. 정규화는 수집기의 `normalizePostingUrl` 이다(fragment, `utm_*`, `fbclid`, `gclid`, query 순서, 끝 슬래시)
- 규칙과 회사 선호는 같은 SQLite 파일에 있어 한쪽만 읽지 못하는 경우가 없다. 저장소를 열지 못하면 명령이 종료 코드 1 로 끝난다
- 판정은 수집기의 `feedback/exclusion-match.ts` 가 하며 모델이 규칙을 해석하지 않는다. 규칙의 사유와 근거 주소는 결과에 넣지 않는다

### 커넥터 오류 코드

`connector.json` 의 `errors` 가 오른쪽 칸의 공통 어휘로 잇는다. 비어 있는 코드는 표에 넣지 않으며 fos-assistant 가 `unavailable` 로 읽는다.

| 오류 코드 | 조건 | 공통 어휘 |
| --- | --- | --- |
| `CAREER_CONFIG` | 프로필 저장소 이름(`CAREER_GITHUB_PROFILE_REPO`)이 없거나 모양이 틀림 | |
| `CAREER_INVALID_RESPONSE` | GitHub 이나 토큰 통로의 응답에서 필요한 구조를 읽지 못함 | `unavailable` |
| `CAREER_INVALID_INPUT` | 도구 입력 검증 실패 | `invalid_input` |
| `CAREER_GITHUB_NOT_CONFIGURED` | GitHub token 도 토큰 통로 주소도 없음, 토큰 통로 주소가 HTTP 나 HTTPS 주소가 아님, 또는 토큰 통로가 404 로 답함(연결이 없거나 해제됨) | `credential_rejected` |
| `CAREER_GITHUB_UNAUTHORIZED` | GitHub 가 401 로 답함, 또는 토큰 통로가 401(주소의 표식이 틀림)이나 409(다시 연결해야 함)로 답함. `connector.json` 은 recovery `reconnect` 를 함께 선언한다 | `credential_rejected` |
| `CAREER_GITHUB_FORBIDDEN` | GitHub 가 401, 409, 422, 429 를 뺀 4xx 로 답함. 주로 403 과 404 이며 token 에 그 저장소의 권한이 없거나 저장소 이름이 틀리다 | `forbidden` |
| `CAREER_GITHUB_CONFLICT` | branch 를 옮기는 마지막 요청에서만 GitHub 가 409 나 422 로 답함. 그 사이 다른 커밋이 올라왔다 | `unavailable` |
| `CAREER_GITHUB_STALE_REVIEW` | 실행할 때의 기본 branch 나 그 끝 커밋이 `expectedBranch`, `expectedHead` 와 다름. 검토한 뒤 저장소가 바뀌었고 GitHub 에 아무것도 쓰지 않았다 | `invalid_input` |
| `CAREER_GITHUB_UNAVAILABLE` | GitHub 의 5xx 와 429, branch 를 옮기기 전 단계의 409 와 422, 연결과 시간 초과 실패. 토큰 통로의 503(갱신을 지금 못 함)과 그 밖의 실패 응답, 통로 연결과 시간 초과 실패도 든다 | `unavailable` |
| `CAREER_BROWSER_UNREACHABLE` | 「내 브라우저」 중계 주소가 비었거나 브라우저에 닿지 못함. 노트북 Claude Code 에서는 늘 이 코드다. 원티드 도구는 아무 칸도 건드리지 않았다 | `unavailable` |
| `CAREER_BROWSER_IN_USE` | 사람이 「직접 할게요」 로 「내 브라우저」 를 쥐고 있음. 읽기 도구는 오류 대신 이 코드를 `code` 로 한 넘기기(`human_browser`)를 돌려준다 | `unavailable` |
| `CAREER_WANTED_LOGIN_REQUIRED` | 원티드 로그인이나 보안 확인 화면. 읽기 도구는 이 코드를 `code` 로 한 넘기기(`login`)를 돌려준다. `connector.json` 은 recovery `reconnect` 를 함께 선언한다 | `credential_rejected` |
| `CAREER_WANTED_PAGE_CHANGED` | 원티드 화면이나 칸 구조가 예상과 다름. 기다린 뒤에도 이력서 목록이 비어 있는 경우도 든다. 쓰기 도구는 오류 대신 칸의 `reason: page_changed` 로 멈춘다 | `unavailable` |
| `CAREER_WANTED_RESUME_NOT_FOUND` | 받은 `resumeKey` 의 이력서가 없음. 쓰기 도구는 첫 칸을 건드리기 전에만 이 오류를 낸다 | `invalid_input` |
| `CAREER_UNKNOWN_TOOL`, `CAREER_INTERNAL` | 지원하지 않는 도구 또는 내부 처리 실패 | |

`message` 는 사람에게 보일 고정 문구다. GitHub 과 원티드의 응답 본문, token, 프로필 본문을 담지 않는다.

## 수집 공고의 고용형태

공고 계약은 `scripts/position-recommender/live-postings/contracts.ts`가 소유한다.
`employmentType`은 소스가 제공한 고용형태 원문이며 선택 필드다.
값이 없거나 비어 있으면 미확인으로 유지하고 정규직으로 추정하지 않는다.
공통 validator는 구조화 고용형태와 제목의 채용 표기를 모두 검사한다.
둘 중 하나라도 비정규 고용을 명시하면 제외한다.
업무·요건·우대사항의 기술 설명이나 공통 채용 안내는 고용형태 근거로 쓰지 않는다.
미확인 자체로 수집을 제외하지 않으며, 후속 분석에 미확인 상태를 전달한다.
