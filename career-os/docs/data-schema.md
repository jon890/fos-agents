# 데이터 구조

이 문서는 각 스킬이 **무엇을 어디에 저장하고 어떤 제약을 두는지**를 담는다.
필드와 타입, 키와 유니크 제약, 지울 때 함께 지워지는 것이 여기 속한다.

무엇을 약속하는지는 [`prd.md`](prd.md), 어떤 순서로 도는지는 [`flow.md`](flow.md),
코드가 어디 있는지는 [`code-architecture.md`](code-architecture.md)가 담는다.

## 공통

### MySQL schema 적용

홈서버 `fos_career` database 의 schema 는 `services/recommendation-api/migrations/` 의
번호가 붙은 SQL 파일이 소유한다.
아래의 table 과 column 서술은 그 SQL 을 읽기 쉽게 옮긴 것이다. 둘이 다르면 SQL 이 맞다.

적용 기록은 `schema_migrations` table 에 있다.

**적용한 migration 파일은 고치지 않는다.** checksum 이 달라져 다음 적용이 거절된다.
schema 를 바꿀 때는 다음 번호의 파일을 더한다.

### 홈서버 release

홈서버 `career-os` bucket 과 로컬 `career-os/.career-sync/` 의 파일 다섯이다.
`releases/` 아래 셋은 만든 뒤 고치지 않는다.

| 파일 | 담는 것 |
| --- | --- |
| `releases/<revision>/workspace.tar` | 세 관리 root 의 archive |
| `releases/<revision>/workspace-manifest.json` | 아래 manifest |
| `releases/<revision>/release.json` | `schemaVersion`, `workspace`, `revision`, `contentDigest`, `createdAt`, `fileCount`, `archiveKey`, `archiveSha256`, `manifestKey`, `manifestSha256` |
| `pointers/current.json` | release.json 과 같은 식별·요약 필드에 `descriptorKey`, `descriptorSha256` |
| `.career-sync/sync-state.json` | 마지막으로 준비한 `revision`, `contentDigest`, 파일 hash |
| `.career-sync/skill-session.json` | 진행 중인 skill 이름, 시작 revision, 시작 시각 |
| `.career-sync/prepare-journal.json` | 아래 journal |

#### manifest

| 필드 | 값 |
| --- | --- |
| `schemaVersion` | `1` |
| `workspace` | `career-os` 고정 |
| `revision` | 홈서버가 부여한 release 식별자 |
| `parentRevision` | publish 를 시작할 때 확인한 이전 revision |
| `createdAt` | 홈서버가 기록한 UTC 시각 |
| `producer` | 만든 skill 과 `interactive` 또는 `automation` |
| `contentDigest` | 정렬한 파일 경로와 크기와 SHA-256 에서 만든 전체 digest |
| `files` | 상대 경로, byte 크기, SHA-256 목록 |

`files` 의 경로는 `applications/`, `library/`, `state/` 중 하나로 시작해야 한다.
일반 파일만 허용한다. symlink 와 `.env` 와 `.omc` 와 log 와 cache 와 임시 파일은 거절한다.

#### prepare-journal

transaction 식별자와 상태 하나, 그리고 root 별 `hadOriginal`, `backupDone`, `applyDone` 을 담는다.

| 상태 | 복구할 때 하는 일 |
| --- | --- |
| `started`, `staged` | 기존 root 를 건드리지 않았으므로 staging 만 지운다 |
| `backed_up`, `applied`, `restoring` | root 별 상태와 실제 경로를 대조해 새 root 를 지우고 backup 을 되돌린다 |
| `restored` | 되돌리기를 마쳤다 |
| `completed` | 새 root 와 `sync-state.json` 의 hash 가 같을 때만 backup 과 journal 을 지운다 |

`hadOriginal: false` 인 항목은 되돌릴 때 새 root 만 지운다.
기록과 실제 경로가 어긋나면 자동으로 판단하지 않고 `RESTORE_REQUIRED` 로 멈춘다.

#### 원격 명령의 응답

| 명령 | 응답 |
| --- | --- |
| `career-storage status` | `RemoteStatusResult`. `schemaVersion`, `action`, `ok`, `workspace`, nullable `current` |
| `career-storage export --revision <revision>` | release 의 tar |
| `career-storage publish` | `RemotePublishResult`. `schemaVersion`, `action`, `ok`, `revision`, `contentDigest`, `createdAt`, `fileCount`, `noChange` |

`current` 는 `revision`, `contentDigest`, `createdAt`, `fileCount` 를 가진다.
export tar 의 최상위는 `workspace-manifest.json` 과 세 관리 root 만,
publish tar 의 최상위는 `workspace-draft.json` 과 세 관리 root 만 허용한다.

절차와 실패 복구는 [`flow.md`](flow.md#비공개-작업본-동기화)가 소유한다.

## application-package-writer

### 적합도 판정과 점수

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

brain에는 경력, 역할 선호와 경험 경계 등 개인 지식을 두고, 지원별 사실과 표현 확인은 `evidence/candidate-interview.md`의 기존 계약을 따른다.
작성 취향은 스킬에서 유지하고, brain 검색 결과는 해당 문장을 판단하는 데 필요한 출처와 범위만 지원 기록에 연결한다.

## interview-practice

### `config/interview-question-sources.ts`

| 필드 | 값 |
| --- | --- |
| `key` | 출처 식별자. 고유하다 |
| 출처 종류 | 공식 문서, 기술 블로그, 공개 영상, GitHub 가이드 |
| 사용 역할 | 정답 근거, 사례 발견, 범위 확인 |
| 주제, URL, 수집 어댑터 | |

**정답 근거 역할은 공식 문서만 가진다.** 기술 블로그와 공개 영상과 GitHub 가이드는
사례 발견이나 범위 확인만 할 수 있다.

### 질문

각 질문의 `source` 는 `public/question-bank/sources.json` 의 식별자를 참조한다.
`bar` 는 공개 능력 수준 셋 중 하나다.

| `bar` | 수준 |
| --- | --- |
| `production` | 한 서비스의 정확성과 장애 복구와 운영 지표를 책임진다 |
| `large-scale` | 대규모 제품과 여러 팀이 쓰는 계약과 용량과 변경 안전성을 판단한다 |
| `global-scale` | 다중 리전과 조직 공통 기반의 실패 격리와 보안과 장기 trade-off 를 주도한다 |

현재 직장과 목표 회사와 개인 경험 경계를 `bar` 값이나 공개 질문 본문에 넣지 않는다.

### `interview-source-candidates.json`

실행별 후보풀이다. 시스템 임시 경로에 두고 질문 승격 뒤 지운다. 장기 상태로 두지 않는다.

각 후보는 출처 식별자, 출처 종류와 역할, 주제, 제목, URL, 게시 시각, 공개 설명, 자료 종류를 가진다.

### `state/drill-progress.json`

답변 연습의 진행과 복습 상태다. 학습 주제 생성 상태와 섞지 않는다.

| 담는 것 |
| --- |
| 질문별 시도와 최근 결과 |
| 다시 볼 질문과 복습 시점 |
| 기술·인성 모드가 공유하는 진행 정보 |

일별 답변 기록은 꼬리질문일 때 원 질문 식별자, 부모 질문, 깊이, 확인 축, 중단 이유를
선택 필드로 가진다.

## position-recommender

### 개인 공고 제외 설정

본문은 Git 에서 제외되는 `state/private-config/position-exclusions.json` 에 있다.
`config/position-exclusions.ts` 는 그 경로만 담는다.

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
| `posting` | 정식 `source` 와 `identityHash` 와 HTTPS `url` 중 하나 이상 | 같은 소스에서 식별자나 정규화 URL 이 일치 |
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

버전 1의 공고 규칙은 읽을 수 있다. 새 규칙은 버전 2로 저장한다.
**추천 실행이 이 규칙을 자동으로 만들거나 갱신하지 않는다.**
지원 결과와 재지원 간격의 원본은 private brain 이 소유한다.

선택 이유는 [ADR-114](adr/ADR-114-개인-공고-제외-정책을-비공개-release로-전송한다.md)를 따른다.
읽는 시점과 실패 처리는 [`flow.md`](flow.md#position-recommender)가 소유한다.

### 포지션 분석 정책

`fos_career.position_analysis_policy` 의 단일 행이다.
수집 결과와 모델 분석은 이 table 에 넣지 않는다.

| 필드 | 허용 범위 |
| --- | --- |
| `candidateContextVersion` | 후보자 기준 버전 문자열 |
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

**DB 기본값을 두지 않는다.** 새 DB 에 행을 만들 때 모든 값을 줘야 하고
이후 변경도 정책 설정 요청으로만 한다.

### `fos_career.company_preferences`

사람이 정한 회사 우선순위와 제외만 담는다. 모델 평가는 별도 table 이 담는다.

| column | 값 |
| --- | --- |
| `company_key` | 정규화한 회사명. 유일하다 |
| `company_name` | 표시 이름 |
| `tier` | 1, 2, 3. 1이 가장 높다 |
| `disposition` | `analyze` 또는 `exclude` |

등록되지 않은 회사는 `defaultCompanyTier` 를 적용한다.
**보고 싶지 않은 회사를 낮은 tier 로 두지 않는다.** `disposition: exclude` 로 저장한다.

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

### 공고 후보풀과 추천 결과

#### 재사용하는 회사 조사 데이터

`state/company-research/<companyKey>.json`은 포지션 추천이 다음 실행에서도 재사용할 공개 회사 사실과
그 사실에서 도출한 추론을 담는다. 비공개 작업 release로 동기화하지만 현재 역할,
개인 우선순위와 최종 추천 순위는 넣지 않는다.

| 자리 | 담는 것 |
| --- | --- |
| `profile.companyKey`, `company`, `aliases` | 회사 식별. `companyKey` 가 파일 이름이다 |
| `profile.facts[]` | 공개 사실 하나. `factId`, `topic`, `scope`, `statement` |
| `facts[].source` | HTTPS 출처. `url`, `title`, `publisher`, `sourceType`, `publishedAt`, `observedAt` |
| `facts[].validUntil` | 이 사실을 다시 쓸 수 있는 마지막 날 |
| `profile.inferences[]` | 사실에서 도출한 추론. `basisFactIds` 로 근거 사실을 가리킨다 |
| `inferences[].assumptions`, `confidence` | 재사용 판단에 도움이 될 때만 넣는다 |
| `researchGaps[]` | 재조사할 질문과 날짜. 같은 조사를 매 실행 반복하지 않으려고 둔다 |

`topic`과 `scope`는 조사한 회사와 공고에 맞는 이름을 자유롭게 쓴다.
각 사실은 HTTPS 출처를 갖는다. 유효기간, 추론의 가정과 신뢰도는 재사용 판단에 도움이 될 때만 넣는다.
`researchGaps`는 같은 조사를 매 실행마다 반복하지 않도록
재조사할 질문과 날짜를 보존한다. 현재 형식은
`scripts/position-recommender/company-research/schema.ts`가 검증한다.

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

근거 장부는 대상 HTML 의 내용 해시와 연결해 다른 버전의 증거를 잘못 재사용하지 않게 한다.

| `schemaVersion` | 더해진 것 |
| --- | --- |
| 2 | 기술 범위와 경력 기간과 운영과 숙련도 주장이 `experienceDepth` 에 사용·기능 개발·운영 깊이·사용자 확인 수준을 기록한다 |
| 3 | `document` 와 `user` 근거에 `locator` 가 필수다. 검증기가 그 자리를 근거 파일에서 직접 찾는다 |

새 원장은 3을 쓴다. 이미 제출한 2는 locator 어긋남을 경고로만 보고하고 소급해 고치지 않는다.
locator 형식과 판정 기준은
`.claude/skills/resume-preparer/references/claim-model.md` 가 소유한다.

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

| 필드 | 값 |
| --- | --- |
| `key` | 소스 식별자. 회사나 매체를 나타내며 주제를 담지 않는다 |
| `title`, `category` | 표시 이름과 분류 |
| `adapter` | `feed`, `page`, `youtube` |
| `feedUrl` 또는 `url` | 둘 중 하나 |
| `enabled` | 이번 실행에서 수집할지 |

### 실행 중 생성되는 읽을거리 데이터

시스템 임시 경로에 만들고 게시와 검증이 끝나면 지운다.

수집 후보다.

| 필드 | 값 |
| --- | --- |
| `contentKey` | 정규화한 URL. 중복과 이전 추천 판정의 키다 |
| 원문 URL, 출처, 제목, 게시 시각 | |
| `excerpt` | 피드가 주면 담는 공개 설명문 |
| `previouslyRecommended` | 누적 이력에 같은 `contentKey` 가 있는지 |

후보풀은 `recentStudyTopicKeys` 로 직전 리포트의 공부 주제 키를 함께 담는다.

선별 결과는 공부 주제 배열이다.

| 필드 | 값 |
| --- | --- |
| `topicKey` | 날짜가 달라도 같은 개념을 식별하는 kebab-case 키 |
| `title` | 외부 자료에서 도출한 공부 주제 |
| `careerQuestion` | 현재 업무나 다음 역할에 적용해 볼 질문 |
| `items` | 이 주제에 연결한 추천 자료 하나 이상 |

각 추천 자료는 카테고리, 제목, 원문 URL, 출처, 요약, 추천 이유, 커리어 연결 유형을 가진다.
연결 유형은 `current-work`, `target-role`, `engineering-judgment`, `product-business` 중 하나다.

**고를 수 없는 것이 둘이다.** `previouslyRecommended: true` 인 후보와
직전 리포트와 같은 `topicKey` 다.

### `state/morning-study-history.json`

검증을 통과해 사용자에게 낸 추천 자료의 누적 이력이다.
비공개 작업 release 로 동기화하며 임시 리포트와 분리한다.

| 필드 | 값 |
| --- | --- |
| `schemaVersion` | `1` |
| `reports[]` | 반영을 마친 일별 리포트의 `reportId` 와 추천 시각 |
| `entries[]` | 과거 추천 자료 |

`entries[]` 의 필드다.

| 필드 | 값 |
| --- | --- |
| `contentKey` | 정규화한 원문의 유일 키. 파일 안에서 유일하다 |
| `canonicalUrl` | 추적 query 와 fragment 를 지운 HTTPS 원문 URL |
| `sourceKey` | 등록된 출처 식별자 |
| `category` | 수집 카테고리 |
| `title`, `studyTopic` | 추천 당시의 제목과 공부 주제 |
| `studyTopicKey` | 추천 당시 공부 주제의 안정적인 식별자 |
| `careerValue` | 추천 당시 커리어 연결 유형 |
| `recommendedAt` | 이력에 반영한 UTC 시각 |
| `reportId` | 이 추천이 든 일별 리포트 식별자 |

`contentKey` 는 YouTube 영상이면 video ID 를 담고, 일반 글이면 정규화한 URL 의 SHA-256 이다.
`reports[].reportId` 도 파일 안에서 유일하다. 같은 날짜의 리포트를 두 번 반영하지 않는다.

다음 실행은 가장 최근 `reportId` 의 `studyTopicKey` 를 읽어 같은 주제 선택을 거절한다.

**원문에 없는 값을 기본값으로 채우지 않는다.** 예상 학습 시간과 난이도와 분야가 여기 해당한다.
필요하지만 확인할 수 없으면 정보가 없다고 표시한다.

### 학습자료 API 연동 상태

이 절은 명시적으로 선택하는 library 모드의 현재 클라이언트 계약이다.
운영 서버 적용과 웹 UI 구현은 별도 작업이다.
현재 기본 실행의 누적 추천 이력은 위 `state/morning-study-history.json` 계약을 따른다.

`--library` 실행에서 누적 자료, 즐겨찾기, 읽음, 메모와 추천 이력은
`career-os` Backend가 `fos_career`의 별도 study table에 저장한다.
수집기와 skill은 table에 직접 접속하지 않고 HTTP API만 사용한다.

study table은 기존 `fos-blog` 설계의 관계를 유지한다.
`study_sources`, `study_source_cursors`, `study_materials`, `study_material_sources`,
`study_material_tags`, `study_material_states`, `study_recommendation_control`,
`study_recommendation_runs`, `study_recommendation_topics`, `study_recommendation_items`,
`study_recommended_materials`, `study_publications`와 `study_request_receipts`를 사용한다.
현재 기존 table은 0행이므로 데이터 복사는 하지 않으며 API 계약 검증 뒤 제거한다.

HTTP 계약과 오류 코드는 [`flow.md`](flow.md#study-topic-recommender)가 소유한다.

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

추천 저장은 기존 `MorningReadingReport`를 API `recommendation-runs` payload로 변환해 보낸다.
`reportId`는 서울 날짜의 `morning-YYYY-MM-DD`, `generatedAt`은 UTC ISO 문자열을 사용한다.
HTML은 기존 렌더러가 만들며, Markdown 리포트는 만들지 않는다.
HTML과 report JSON 검증이 끝난 뒤 `--commit-recommendation --report <RUN_DIR>/state/morning-reading.json` 명령이 같은 `generatedAt`을 재사용해 저장한다.
게시가 별도로 성공한 뒤에만 publications 기록을 보낸다.
publication의 `idempotencyKey`는 `publication:` 뒤에 고정 순서 `{reportId,channel,publishedAt,externalId,url}` JSON의 UTF-8 SHA-256 hex를 붙인다.
추천 저장이 실패하면 완료로 보지 않고, 파일 이력에 대신 쓰지 않는다.

### Pages manifest 와 import payload

library 모드의 import preview 입출력이다. 일회성 이관에만 쓴다.

Pages manifest 다. **API 에 보내지 않는 envelope 다.**

| 필드 | 값 |
| --- | --- |
| `schemaVersion` | `1` |
| `reports[]` | API `ImportReport` 와 같은 `reportId`, `generatedAt`, `topics` |
| `reports[].provenance.sourcePageUrl` | 이 리포트를 확인한 기존 Pages HTTPS URL |
| `reports[].provenance.localHtmlPath` | 선택값. 승인된 URL 에서 받아 둔 HTML 경로 |

`provenance` 는 career-os 가 기존 노출 위치를 추적하려고 두는 것이다.
API 로 보내기 전에 각 report 에서 지운다.

기존 이력에 없는 `careerQuestion`, `summary`, `reason`, `careerValue` 는 `null` 로 남긴다.
임의 문장과 분류와 URL 을 추정하지 않는다.

`importKey` 는 `import:` 뒤에 canonical JSON reports 의 UTF-8 SHA-256 hex 를 붙인 값이다.
canonical JSON 은 객체 키를 재귀적으로 사전순 정렬하고 배열 순서는 두고 공백 없이 직렬화한다.
같은 reports 는 같은 `importKey` 를 만든다. `null` 로 남긴 값이 달라져도 다른 키가 된다.

## sync-profile

이 스킬은 상태 파일을 두지 않는다.
외부 프로필의 현재 값은 실행할 때마다 대상 서버에서 다시 읽는다.
로컬에 사본을 두면 서버와 어긋난 것을 알 수 없다.

`library/profiles/` 의 원고가 담는 것이다.

| 담는 것 |
| --- |
| 프로필에 실제로 올라간 내용. 이력서 초안의 사본이 아니다 |
| 폼 제약으로 원고와 다르게 넣은 것과 그 이유 |

등록하지 못한 기술과 종료월을 넣은 진행 중 프로젝트가 두 번째에 해당한다.
파일 배치는 [`code-architecture.md`](code-architecture.md#sync-profile)가 소유한다.
