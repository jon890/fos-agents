# Data Schema — career-os

career-os가 다루는 모든 영속 데이터의 스키마와 위치. 새 필드를 추가하거나 새 파일을 도입할 때 이 문서에 같이 갱신한다.

## 디렉터리 한눈에

| 디렉터리 | 역할 | git 추적 |
|---|---|---|
| `.env` (워크스페이스 root) | Discord 채널 ID·GitHub 토큰 등 secret (ADR-021) | ✗ (.gitignore) |
| `.env.example` (워크스페이스 root) | secret 키 템플릿 — git 추적되는 빈 값 가이드 (ADR-021) | ✓ |
| `config/` | 사람이 큐레이션한 정책·현재 타깃·baseline·예외 override. 실제 학습/질문 자산 목록의 복제본으로 쓰지 않음 (ADR-069) | ✓ |
| `config/study-progress.json` | 후보자 학습 진도 (config/로 이동) | ✓ |
| ~~`data/generated-artifacts.json`~~ | (ADR-033 / plan025로 active 제거 — `sources/fos-study/` 트리가 단일 진실원) | history |
| `data/applications/` | 공고별 지원 상태, 맞춤 지원 패키지, evidence/drift review, application digest 입력 | ✗ |
| `private/<company-slug>/<position-slug>/` | 회사·직무별 active 준비 홈. 면접·스터디·지원 산출물을 포지션 단위로 묶는 작업 홈 | ✗ |
| `private/` | 회사·포지션별 작업 홈과 필요 시 archive. 공개용으로 다듬기 전의 준비 자료 위치 | ✗ |
| `public/question-bank/` | 공개 가능 일반 backend/CS 면접 질문 bank. private 맥락 없이 git 추적되는 재사용 질문 자산 | ✓ |
| `data/reports/baseline/YYYY-MM-DD/` | baseline 실행 산출물 (analysis-input, claude.result.json, report.md, fallback.md) | △ 부분적 |
| `data/reports/daily/YYYY-MM-DD/` | daily 실행 산출물 | △ |
| `data/runtime/` | 매 실행 갱신되는 가변 상태 (토픽 풀, 잠금, 피드 캐시, 최신 projection) | ✗ (대부분 gitignore) |
| `data/normalized/` | 외부 소스 정규화 캐시 (현재 비어 있음 — fos-study.latest.json 정리됨) | ✗ |
| `data/prep/` | legacy 보조 준비 자산 위치. 새 active 준비 정본은 position home의 `interview/prep.md` | ✓ |
| `data/source/` | 수집된 외부 노트 | ✗ |
| `logs/` | 실행 로그 (`task-runs.jsonl`, `token-usage.jsonl`) | ✗ |
| `sources/fos-study/` | 외부 동기 저장소 (jon890/fos-study) — git submodule 같은 위치이나 실제로는 별도 clone | ✗ |

## data/ 경계와 보존 원칙 (ADR-058)

`data/` 아래 파일은 private by default다.
특히 지원, 면접, 후보자 이력, 회사별 전략, 수집 원문과 연결된 내용은 공개 가능성이 따로 확인되기 전까지 비공개로 본다.

기본 경계:

- `private/<company>/<position>/` — 포지션별 작업 홈.
  회사·포지션 맥락, 면접 준비, 답변 메모, 포지션별 학습 재료를 둔다.
  공개 가능한 기술 자료는 개인 맥락을 제거해 `sources/fos-study/`에 별도로 작성할 수 있다.
- `data/applications/` — 실제 지원 준비 원장과 공고별 산출물의 private home.
  맞춤 이력서, 지원 전략, fit/gap 분석, review, 제출 체크리스트를 둔다.
- `private/archive/` — public/source/report/runtime 중 어느 곳에도 바로 둘 수 없는 private-only archive 후보 위치.
  구조 전환에서 새 정본으로 대체한 legacy runtime/report는 archive 없이 삭제할 수 있다.
- `data/source/` — 외부에서 수집한 source text와 notes의 입력 위치.
  외부 공개 페이지에서 왔더라도 특정 지원, 면접, 회사 전략과 연결되면 private by default로 다룬다.
- `data/reports/` — baseline, daily, position, interview-prep 같은 생성 리포트 위치.
  active 판단에 쓰이는 최근 report와 참조된 report만 active로 두고, 오래된 report는 retention 검토 후 archive한다.
- `data/runtime/` — 최신 projection, cache, lock, eval result 같은 가변 상태 위치.
  장기 근거가 필요한 runtime 파일은 runtime에 계속 두지 않고 report, task evidence, private archive 중 하나로 승격 여부를 결정한다.

## public/question-bank/ (ADR-066)

공개 가능 일반 backend/CS 면접 질문 bank다.
`data/`가 gitignore/private 성격이므로, 공개 가능한 재사용 질문은 이 경로에 둔다.

기본 하위 디렉터리:

- `java-spring/`
- `database/`
- `cs/`
- `operations/`
- `system-design/`

질문 항목 기본 필드:

- `id`
- `category`
- `difficulty`
- `question`
- `intent`
- `answerSignals`
- `source`
- `publicSafe`
- `positionFitHint`
- `normalizedFrom`

경계:

- private 답변, 포지션별 지원 전략, 회사별 비공개 맥락을 저장하지 않는다.
- 유료 강의/문제집/면접 후기 원문을 복사하지 않는다.
- `sources/fos-study/`로 발행하려면 별도 public-safe 문서로 재작성한다.

fos-career request gateway:

- request type: `question_bank_refresh`
- requested skill: `question-bank-collector`
- result에는 `public/question-bank` 경로, 요약, validator count만 둔다.
- private 답변, 지원 전략, 회사별 비공개 맥락, command stdout 전체는 저장하지 않는다.

보존 정책:

- 삭제는 마지막 단계다.
  먼저 archive, tombstone, retention window, task-local evidence 중 하나로 분류한다.
  단, 구조 전환에서 정본이 `private/<company>/<position>/`으로 이동했고 새 정본으로 대체 확인이 끝난 legacy mirror/runtime/report는 archive 없이 제거해도 된다.
- 오래된 generated report는 최근 7일 반복 추천, active interview/application 판단, task/ADR 근거와 연결돼 있으면 보존한다.
  연결이 없고 새 report나 docs 결정으로 대체됐으면 `private/archive/` 후보로 분류한다.
## config/

### config 책임 원칙 (ADR-069)

`config/`는 “존재하는 모든 자산 목록”이 아니라 “사람이나 agent가 의도적으로 고른 정책·타깃·예외”를 담는다.

유지 원칙:

- 현재 회사·직무·포지션 홈: `config/mvp-target.json`
- 후보자 baseline과 장기 이력: `config/candidate-profile.md`
- baseline 분석용 core file pin: `config/baseline-core-files.json`
- 학습 진행 상태와 약점 상태: `config/study-progress.json`
- 외부 source registry: `config/sources.json`
- 지원서 export 기본 디자인 계약: `config/resume-design.md`
- 사람이 명시적으로 고른 추천 guardrail, pin, 제외, seed override

파생 원칙:

- 학습 문서 inventory는 `sources/fos-study/` 파일 트리에서 파생한다.
- 공개 가능 일반 면접 질문 inventory는 `public/question-bank/` validator 결과에서 파생한다.
- config는 `sources/fos-study/`나 `public/question-bank/`의 전체 목록을 다시 들고 있지 않는다.
- 대량 reservoir JSON은 정본이 아니라 migration 대상이다.
  필요한 항목만 curated override나 seed로 축소한다.

정리 후보:

- `first-round-drill-core-files.json` — `interview/prep.md` 단일 정본 이후 active reader가 없으면 제거한다.
- `study-preferences.json` — `mvp-target`과 반복되는 current target은 제거하고 추천 철학/제약만 남긴다.
- `study-pack-topics.json`, `study-pack-candidates.json` — 전체 topic DB 역할을 중단하고 override/seed만 남긴다.
- `topic-file-map.json` — 수동 topic→file map 대신 fos-study inventory 검색/태그/path 기반 선별로 전환한다.
- `topic-profiles.json` — 전역 config가 아니라 `study-pack-writer` reference나 작은 override로 이관한다.
- `question-bank-topics.json` — `public/question-bank`와 역할을 분리하고, 필요하면 interview-asset topic override로 rename한다.
- `live-coding-seed-pool.json`, `live-coding-seed-candidates.json` — active 추천 흐름에서 실제 사용 여부를 확인한 뒤 유지 또는 흡수한다.

config diet는 plan068에서 reader inventory와 fallback을 확인한 뒤 phase 단위로 진행한다.
삭제는 reader 제거와 검증이 끝난 뒤 수행한다.

### config/mvp-target.json (현재 타깃 단일 출처)

zod 검증 단일 출처: `career-os/scripts/interview-prep-analyzer/mvp_target_schema.ts` → `parseMvpTarget(path)` (ADR-048).

```json
{
  "primary": {
    "company": "string",
    "team": "string",
    "role": "string",
    "company_slug": "string (예: cj-foodville)",
    "position_slug": "string (예: digital-channel-backend)",
    "data_root": "string (예: private/cj-foodville/digital-channel-backend)",
    "interview_date": "YYYY-MM-DD | empty",
    "notes": "string (선택)",
    "interview": {
      "first_round": {
        "sites": [
          { "key": "string", "url": "string (URL)", "label": "string" }
        ],
        "source_dir": "string (data/source/ 아래 서브 디렉터리명)",
        "report_slug": "string (data/reports/daily/<date>/<slug>/ 경로명)"
      },
      "final_round": null,
      "offer_chat": null
    }
  },
  "history": [
    {
      "company": "string",
      "team": "string",
      "role": "string",
      "interview_date": "YYYY-MM-DD",
      "deprecated_at": "YYYY-MM-DD",
      "notes": "string (선택)"
    }
  ]
}
```

- `primary.interview` — 면접 단계별 컨테이너.
  - `primary.interview.first_round` — 1차 면접 mode. 활성. 필드: sites, source_dir, report_slug.
  - `primary.interview.final_round` — 최종 면접 mode. nullable, 필요 시 활성화.
  - `primary.interview.offer_chat` — 오퍼 단계 mode. nullable, 필요 시 활성화.
- `primary.company_slug`, `primary.position_slug`, `primary.data_root` — 회사·직무별 관리 홈.
  active 타깃의 사람이 보는 자산은 `data_root` 아래에 둔다.
  웹과 새 자동화는 `data_root`를 정본으로 읽고, 면접 질문 정본을 `data/runtime`이나 `data/reports/daily`에 중복 유지하지 않는다.

타깃 전환 시 `primary`를 `history` 앞에 push하고 새 `primary`를 채운다.

### private/<company-slug>/<position-slug>/ (position home)

회사·직무별 active 준비 홈이다.
예: `private/cj-foodville/digital-channel-backend/`.

이 위치는 공개용 자료가 아니라 포지션별 작업 홈이다.
회사·포지션 맥락, 면접 질문, 답변 메모, 피드백, 지원 준비가 섞일 수 있다.
자동화와 웹은 이 경로를 정본으로 읽는다.
공개 가능한 기술 공부팩은 이 작업 홈의 내용을 그대로 복사하지 않고, 개인 답변·지원 전략·회사별 민감 맥락을 제거해 `sources/fos-study/`에 따로 작성한다.

권장 구조:

```text
private/<company-slug>/<position-slug>/
├── README.md
├── manifest.json
├── interview/
│   ├── prep.md
│   ├── answers/
│   ├── feedback/
│   └── history/YYYY-MM-DD.md  (선택)
└── application/
```

현재 규칙:

- `interview/prep.md` — 사람이 보는 면접 준비 단일 정본.
  예상 질문 드릴, 추천 시작 질문, 1차 면접 전략, 체크리스트, 단기 Java 준비 항목, 이미 정리된 주제와 다음 액션을 섹션으로 담는다.
- `interview/answers/` — 이 포지션에 연결된 답변 기록.
- `interview/feedback/` — 이 포지션에 연결된 답변 피드백.
- `interview/history/` — 필요한 경우에만 생성하는 날짜별 snapshot.
- `manifest.json` — 사람이 읽는 index와 연결 자산 목록을 둔다.

분리 파일로 생성됐던 면접 준비 리포트, 예상 질문 드릴, 1차 면접 전략, 1차 면접 체크리스트, 10일 Java 준비 재료는 dashboard primary asset으로 유지하지 않는다.
필요한 내용만 `interview/prep.md`에 정제해 흡수한다.

### config/candidate-profile.md

후보자 이력. 11개 섹션의 prose 마크다운. **JSON이 아닌 의도적 선택** — AI 에이전트가 context로 직접 읽는 자산이라 구조화보다 narrative 가치가 큼. 모든 주장은 `task/**` 또는 `resume/**` 경로 태깅됨 (소스 추적용).

### config/study-preferences.json

아침 학습 추천의 사용자 선호와 학습 제약을 담는다.
ADR-069 이후 `current_target`처럼 `config/mvp-target.json`의 현재 타깃을 반복하는 필드는 축소 대상이다.
이 파일을 유지한다면 “추천 철학, 제외할 축, 보조 관심사, 난이도 선호”처럼 타깃 config와 중복되지 않는 값만 남긴다.

`secondary_targets[]` 예시 필드:

```json
{
  "company": "TossPlace",
  "role": "Applied AI Engineer",
  "priority": 2,
  "posting_path": "data/applications/tossplace/applied-ai-engineer/posting.md",
  "fit_analysis_path": "data/applications/tossplace/applied-ai-engineer/fit-analysis.md",
  "application_package_path": "data/applications/tossplace/applied-ai-engineer/application-package.md",
  "review_path": "data/applications/tossplace/applied-ai-engineer/review.md",
  "study_goal": "string",
  "focus_axes": ["string"],
  "constraints": ["string"]
}
```

보조 트랙은 study-pack 자동 생성이나 fos-study 발행을 의미하지 않는다. cron이나 agent prompt가 이 값을 읽어 별도 report/runtime 경로에 추천만 생성한다.

### config/baseline-core-files.txt

> **plan002 이후**: `config/baseline-core-files.json`으로 전환. 단일 출처는 "통합 config 스키마 (plan002 이후)" 섹션 참조.

### config/study-pack-topics.json (primary curated)

> **plan002 이후**: `config/topics.json`의 `study-pack` namespace로 통합. 단일 출처는 "통합 config 스키마 (plan002 이후)" 섹션 참조.

### config/study-topic-candidates.json (reservoir)

> **plan002 이후**: `config/topics.json`의 `study-pack-candidates` namespace로 통합. 단일 출처는 "통합 config 스키마 (plan002 이후)" 섹션 참조.

### config/experience-question-bank-topics.json

> **plan002 이후**: `config/topics.json`의 `question-bank` namespace로 통합. 단일 출처는 "통합 config 스키마 (plan002 이후)" 섹션 참조.

### config/topic-file-map.json

daily report용 토픽 → fos-study 파일 목록 매핑 (ADR-001).

```json
{
  "<topic-key>": ["sources/fos-study/path/to/file.md", ...]
}
```

### config/tech-blog-sources.json / ai-topic-sources.json / geek-news-sources.json

> **plan002 이후**: `config/sources.json`의 `techBlog` / `ai` / `geek` category로 통합. 단일 출처는 "통합 config 스키마 (plan002 이후)" 섹션 참조.

## 통합 config 스키마 (plan002 이후)

plan002가 통합한 새 config 파일 스키마 단일 출처. 기존 개별 섹션에는 "plan002 이후 migrated" 표시 추가됨.

### config/topics.json (plan017에서 폐기 — 3 json으로 분리)

> **plan017 이후**: namespace별 단일 책임 파일로 분리됨 (ADR-027). `study-pack-topics.json` / `study-pack-candidates.json` / `question-bank-topics.json` 3개 파일이 각자의 skill namespace만 담는다. 아래 스키마는 history 보존용.

3개 topic config 파일 통합본 (`study-pack-topics`, `study-topic-candidates`, `experience-question-bank-topics`). 옛 `study-pack-maintainer-topics`와 `cj-foodville-bootcamp-topics`는 plan014에서, `interview-master-topics`는 plan015에서 폐기 — 모두 study-pack-writer + interview-asset-writer 두 native skill로 흡수.

```json
{
  "_meta": {
    "purpose": "study-pack / question-bank 등 모든 topic 메타데이터 단일 출처 (interview-asset-writer가 question-bank namespace 사용)",
    "schema_version": "1",
    "namespaces": [
      "study-pack",
      "study-pack-candidates",
      "question-bank",
      "master"
    ]
  },
  "study-pack": {
    "<topic-key>": {
      "domain": "string",
      "outputPath": "string (fos-study 기준 상대 경로)",
      "title": "string",
      "promptAppend": "string (선택)"
    }
  },
  "study-pack-candidates": {
    "<topic-key>": { "...같은 스키마..." }
  },
  "question-bank": {
    "<topic-key>": {
      "domain": "string",
      "outputPath": "string",
      "title": "string",
      "inputFiles": ["string"]
    }
  },
  "master": { "...study-pack과 유사..." }
}
```

namespace 안의 topic key는 namespace별로 독립적이라 같은 key가 두 namespace에 있어도 OK. 각 namespace 안에서만 유일성 보장.

## data/applications/ (implemented base — plan029, plan031, plan038)

공고별 지원 에이전트 MVP의 비공개 상태 저장소. 실제 지원 전략, 맞춤 이력서 문구, 제출 상태, 회사별 쿨다운 판단이 들어가므로 git 추적하지 않는다.

## data/runtime/application-agent/frontdoor-queue.jsonl (legacy — plan038)

사용자 선택 전 추천 후보 순위와 상태를 저장하는 JSONL 파일. 한 줄은 하나의 추천 후보이며, 사용자가 "N번 준비 시작"을 선택하기 전까지 `data/applications/ledger.jsonl`에 넣지 않는다. 이 파일은 runtime 데이터이며 git 추적 대상이 아니다.
ADR-081 이후 이 파일은 DB import 검증 후 삭제 대상이다.
새 대시보드 기능은 이 파일을 현재 상태 정본으로 삼지 않는다.

상태 enum:

- `collected`: 수집됨. 아직 추천 후보로 선별되지 않았다.
- `shortlisted`: 추천 후보로 선별됐다.
- `needs_user_start_approval`: 사용자에게 "준비 시작" 선택을 기다린다.
- `start_approved`: 사용자가 준비 시작을 승인했다.
- `promoted_to_ledger`: ledger 승격이 끝났다.
- `rejected`: 사용자가 제외했다.
- `expired`: 공고가 만료됐거나 active 검증에 실패했다.

예시 record:

```json
{
  "queueId": "frontdoor-kakaopay-server-144295",
  "rank": 1,
  "company": "카카오페이",
  "role": "서버 개발자",
  "trackLabel": "KakaoPay AI track candidate",
  "source": "position-recommender",
  "url": "https://www.wanted.co.kr/wd/144295",
  "status": "needs_user_start_approval",
  "fitScore": 78,
  "recommendationTier": "challenge",
  "sourceFreshness": "fresh",
  "selectedAt": null,
  "promotedApplicationId": null,
  "decisionReason": "AI 도구 활용 우대가 있는 서버 공고로, 별도 KakaoPay AI 전용 공고 URL 확인 전 임시 후보로 사용한다.",
  "nextActions": ["await_user_start_approval"]
}
```

필수/중요 필드:

- `queueId`: frontdoor queue 안의 고유 ID.
- `rank`: 사용자에게 보여줄 추천 순위.
- `company`, `role`, `trackLabel`: 표시용 정보.
- `source`, `url`: 수집 출처와 개별 공고 URL.
- `status`: 위 상태 enum 중 하나.
- `fitScore`, `recommendationTier`, `sourceFreshness`: 추천/검증 판단에 쓰는 보조 필드.
- `selectedAt`: 사용자가 준비 시작을 승인한 시각. 승인 전에는 `null`.
- `promotedApplicationId`: ledger 승격 후 연결된 application id. 승격 전에는 `null`.
- `decisionReason`, `nextActions`: 사용자에게 보여줄 이유와 다음 액션.

검증 규칙:

- `sourceFreshness=stale`이면 `needs_user_start_approval`이나 `start_approved`가 될 수 없다.
- `start_approved`는 사용자 선택 근거 없이 설정할 수 없다.
- `promoted_to_ledger`는 `promotedApplicationId`가 있어야 한다.
- 이미 같은 URL이나 external id가 ledger에 있으면 새 ledger record를 만들지 않고 existing application을 연결한다.

### position priority fields (implemented — plan050)

plan050은 frontdoor queue와 ledger에 action stage 중심 priority layer를 추가한다.
이 필드는 회사의 절대 선호 순위가 아니라 "지금 어떤 행동을 할지"를 나타낸다.

기본 action stage:

- `prepare-now`: 바로 지원 준비를 시작한다.
- `investigate`: 공고/회사/요구 역량을 더 확인한다.
- `monitor`: active/open 상태를 유지하며 주기적으로 본다.
- `low-priority`: 가능성은 있으나 지금 준비하지 않는다.
- `hold`: 판단 보류 또는 조건 대기.
- `excluded`: 추천/대시보드 준비 후보에서 제외한다.

사용자 표시용 숫자 매핑:

- `prepare-now` → `1`
- `investigate` → `2`
- `monitor` → `3`
- `low-priority`, `hold`, `excluded` → `4`

예시 optional fields:

```json
{
  "priorityRank": 1,
  "actionStage": "prepare-now",
  "priorityReason": "AI Agent 실무 전환성이 높고 active/open evidence가 명확하다.",
  "nextAction": "공고 분석과 fit/gap 분석을 갱신한 뒤 지원 패키지 초안을 만든다.",
  "riskFlags": ["platform_scope_heavy"],
  "evidenceUrls": ["https://example.com/jobs/123"],
  "recommendationSnapshot": {
    "generatedAt": "2026-06-07T09:30:00+09:00",
    "sourceReportPath": "data/runtime/position-recommendation.md",
    "postingAnalysisPath": "data/applications/example/backend/posting.md",
    "fitSummary": "서버/API 경험과 AI agent workflow 관심사가 맞는다.",
    "gapSummary": "Kubernetes 운영 경험은 확인이 필요하다.",
    "preparationActions": ["package_draft", "interview_practice", "study_pack_candidate"]
  },
  "userConfirmedPriority": {
    "confirmedAt": "2026-06-07T10:00:00+09:00",
    "actionStage": "investigate",
    "priorityRank": 2,
    "reason": "공고는 좋지만 플랫폼 요구사항을 먼저 확인한다.",
    "confirmedBy": "user"
  }
}
```

필드 책임:

- `priorityRank`: 같은 action stage 안에서 보여줄 상대 순서. 전체 회사 선호 순위가 아니다.
- `actionStage`: LLM 추천 초안의 현재 행동 단계.
- `priorityReason`: 행동 단계 추천 이유.
- `nextAction`: 사람이 바로 실행할 다음 행동.
- `riskFlags`: 쿨다운, 공고 불명확성, 과한 요구 역량, 지원 경로 문제 등.
- `evidenceUrls`: 공고 URL, official careers URL, manual active-open URL 등 판단 근거.
- `recommendationSnapshot`: LLM이 만든 추천 초안과 분석 요약. refresh 때 갱신 가능하다.
- `userConfirmedPriority`: 사용자가 확정한 priority. LLM refresh가 덮어쓰면 안 된다.

검증 규칙:

- `actionStage`는 기본 enum 중 하나여야 한다.
- `excluded`는 사용자 확정 또는 명확한 정책 사유 없이 자동으로 확정값이 될 수 없다.
- `userConfirmedPriority`가 있으면 dashboard와 application flow는 이 값을 LLM snapshot보다 우선 표시한다.
- `recommendationSnapshot.generatedAt`과 source report path가 없으면 refresh 결과로 취급하지 않는다.
- `prepare-now`에는 `nextAction`과 하나 이상의 `evidenceUrls`가 필요하다.

### data/applications/_priority-history.jsonl (implemented — plan050)

priority 변경 이력을 저장하는 runtime/private audit log다.
한 줄은 하나의 priority 변경 이벤트다.

예시 record:

```json
{
  "eventId": "priority-20260607-kakaopay-001",
  "recordId": "frontdoor-kakaopay-ax-202310",
  "recordType": "frontdoor_queue",
  "changedAt": "2026-06-07T10:00:00+09:00",
  "changedBy": "user",
  "previous": {
    "actionStage": "prepare-now",
    "priorityRank": 1
  },
  "next": {
    "actionStage": "investigate",
    "priorityRank": 2
  },
  "reason": "플랫폼 요구사항 확인 후 준비 여부를 정한다.",
  "source": "manual-confirmation"
}
```

### application workbench projection (implemented — plan054)

plan054는 fos-career 내부 read-only projection을 추가한다.
이 projection은 career-os 파일에 저장되는 새 원장이 아니라, frontdoor queue, ledger, priority history, application files를 읽어 화면 표시용으로 계산한 view model이다.

예시 shape:

```json
{
  "id": "ledger:tossplace-applied-ai-engineer-7746700003",
  "recordType": "ledger",
  "recordId": "tossplace-applied-ai-engineer-7746700003",
  "company": "TossPlace",
  "role": "Applied AI Engineer",
  "status": "ready_for_user_review",
  "actionStage": "prepare-now",
  "priorityRank": 1,
  "fitScore": 86,
  "readiness": {
    "posting": "present",
    "fitAnalysis": "present",
    "applicationPackage": "missing",
    "resumeDraft": "missing",
    "coverLetter": "missing",
    "submissionChecklist": "missing",
    "review": "missing",
    "completeCount": 2,
    "totalCount": 7
  },
  "nextAction": "지원 패키지 초안을 만들고 사용자 검토 대기로 전환한다.",
  "blockers": ["review_missing"],
  "riskFlags": ["existing_ledger_record"],
  "materialPaths": {
    "postingPath": "data/applications/tossplace/applied-ai-engineer/posting.md",
    "fitAnalysisPath": "data/applications/tossplace/applied-ai-engineer/fit-analysis.md",
    "applicationPackagePath": null,
    "resumeDraftPath": null,
    "coverLetterPath": null,
    "submissionChecklistPath": null,
    "reviewPath": null
  }
}
```

필드 책임:

- `id`: UI row key. `recordType:recordId` 형식.
- `recordType`: `frontdoor_queue` 또는 `ledger`.
- `recordId`: 원본 career-os record id.
- `readiness`: 지원 준비 산출물 존재 여부. 실제 파일 시스템 read 결과에서 계산한다.
- `nextAction`: priority snapshot, user confirmation, ledger nextActions 중 사람이 바로 볼 값을 선택한다.
- `blockers`: 준비 진행을 막는 표시용 이유. 원장 status가 아니라 projection 계산값이다.

검증 규칙:

- projection은 fos-career MySQL에 저장하지 않는다.
- projection 계산은 career-os 파일을 수정하지 않는다.
- ledger file path가 있으면 파일 존재 여부를 직접 확인하고, 없으면 `missing`으로 표시한다.
- frontdoor queue record는 application material path가 없을 수 있으므로 readiness를 `not_started` 성격으로 계산한다.
- plan055 이후 readiness는 `resume-draft.md`, `cover-letter.md`, `submission-checklist.md`를 포함한다.
  구현 전까지 누락 파일은 `missing`으로 표시한다.

### interview skill request queue (planned — plan060)

plan060은 fos-career 내부 request queue를 추가한다.
이 queue는 career-os 파일이 아니라 dashboard가 만든 skill 실행 요청과 처리 결과의 최소 메타데이터를 저장한다.
dashboard는 career-os를 read-only projection으로만 읽고, skill 실행은 processor가 맡는다.
면접 대화 답변 전문과 상세 피드백은 request result가 아니라 별도 private answer/session table에 저장한다.

허용 skill:

- `interview-prep-analyzer`
- `interview-asset-writer`
- `study-pack-writer`

권장 request record shape:

```json
{
  "id": "interview-skill-request-20260607-001",
  "targetKey": "cj-foodville-2026-06-15",
  "company": "CJ푸드빌",
  "interviewDate": "2026-06-15",
  "requestType": "interview_prep_report",
  "skillName": "interview-prep-analyzer",
  "skillArgs": {
    "mode": "first-round",
    "topic": null
  },
  "status": "pending",
  "requestedBy": "admin",
  "requestedAt": "2026-06-07T12:00:00+09:00",
  "startedAt": null,
  "finishedAt": null,
  "sourceSnapshot": {
    "mvpTargetPath": "config/mvp-target.json",
    "prepDir": "data/prep/cj-foodville",
    "reportPath": null
  },
  "resultSnapshot": {
    "status": null,
    "paths": [],
    "summary": null,
    "errorSummary": null
  }
}
```

필드 책임:

- `targetKey`: 회사와 면접일 기준의 dashboard hub key.
  CJ푸드빌 2026-06-15는 `cj-foodville-2026-06-15`를 권장한다.
- `requestType`: `interview_prep_report`, `interview_asset`, `study_pack`, `answer_feedback` 중 하나.
- `skillName`: allowlist에 있는 native skill 이름.
  `answer_feedback`처럼 dashboard private feedback 요청이면 `null` 또는 별도 feedback processor 값을 둘 수 있다.
- `skillArgs`: processor가 command를 만들기 위한 최소 인자.
  private answer body나 generated markdown body를 넣지 않는다.
- `sourceSnapshot`: 요청 당시 dashboard가 본 경로와 revision hint.
  원문 본문은 저장하지 않는다.
- `resultSnapshot.paths`: 생성 또는 갱신된 파일 경로 목록.
- `resultSnapshot.summary`: 사람이 상태를 이해할 수 있는 짧은 요약.
  답변 전문은 answer/session table에 따로 저장한다.
  result snapshot에는 private 문서 본문이나 command stdout 전체를 저장하지 않는다.

상태 enum:

- `pending`
- `running`
- `done`
- `failed`
- `stale`
- `blocked`

검증 규칙:

- native skill 요청의 `skillName`은 allowlist 밖 값을 받을 수 없다.
- `study-pack-writer` 요청은 공개 가능한 순수 기술 주제일 때만 허용한다.
  회사별 지원 전략이나 private 후보자 맥락을 fos-study 공개 글로 만들지 않는다.
- `study-pack-writer` 결과는 기존 정책대로 `sources/fos-study/`에 `[초안]` 제목으로 생성하고 commit/push까지 이어진다.
  push 실패는 `failed`로 남기고 silent 처리하지 않는다.
- `interview-asset-writer` 결과는 공개 가능 경로와 private 경로의 경계를 processor가 확인해야 한다.
- `interview-prep-analyzer` 결과는 private report 경로와 짧은 요약만 저장한다.
- `answer_feedback`은 사용자 입력 답변을 private answer record로 저장하고, feedback result를 같은 private 경계 안에 둔다.
  답변 전문과 상세 피드백은 dashboard에서 바로 확인할 수 있게 DB에 저장한다.
  request result snapshot, audit log, Discord 알림, fos-study로는 복사하지 않는다.
- 외부 제출, 공개 발행, 로그인, 업로드, candidate-profile 자동 수정 요청은 생성 시 차단한다.
- processor stdout은 debug log로도 전문 저장하지 않고 필요한 오류 요약만 남긴다.

### interview session mode (planned — plan060)

CJ푸드빌 2026-06-15 면접 hub는 면접 전까지 active session mode로 동작한다.
면접이 끝나면 read-only/archive 상태로 전환한다.

권장 session record shape:

```json
{
  "id": "interview-session-cj-foodville-2026-06-15",
  "targetKey": "cj-foodville-2026-06-15",
  "company": "CJ푸드빌",
  "interviewDate": "2026-06-15",
  "modeStatus": "active",
  "archivedAt": null,
  "createdAt": "2026-06-07T12:00:00+09:00",
  "updatedAt": "2026-06-07T12:20:00+09:00",
  "defaultTurnBudget": 5,
  "allowFreeformExtension": true,
  "finalSummary": null,
  "improvementTopics": [],
  "studyPackCandidates": []
}
```

`modeStatus` enum:

- `active`: 면접 전 준비 중.
- `read_only`: 면접이 끝나 새 답변/요청 생성을 막고 기록 조회만 허용.
- `archived`: 장기 보존 상태.
  dashboard에서는 archive badge와 기록 조회만 제공한다.

전환 규칙:

- 2026-06-15 CJ푸드빌 면접 종료 후 해당 session은 `read_only` 또는 `archived`로 전환한다.
- archive 상태에서는 새 질문 생성, 새 답변 입력, 새 feedback 요청을 만들지 않는다.
- 기존 답변 전문, 상세 피드백, 최종 요약, 보완 주제, study-pack 후보는 dashboard에서 조회 가능해야 한다.
- archive 전환은 외부 제출이나 공개 발행을 의미하지 않는다.
- 면접 대화 세션은 기본 5턴으로 시작한다.
  사용자가 원하면 자유형으로 꼬리질문과 추가 답변을 연장할 수 있다.

### interview answer records (planned — plan060)

plan060은 dashboard에서 사용자가 면접 질문에 대한 답변을 직접 입력하고 피드백을 받을 수 있게 한다.
이 기록은 private dashboard data다.
공개 study artifact나 career-os docs가 아니다.

권장 record shape:

```json
{
  "id": "answer-record-20260607-001",
  "sessionId": "interview-session-cj-foodville-2026-06-15",
  "targetKey": "cj-foodville-2026-06-15",
  "company": "CJ푸드빌",
  "interviewDate": "2026-06-15",
  "turnIndex": 1,
  "questionType": "main",
  "questionText": "본인의 백엔드 경험을 CJ푸드빌 서비스와 어떻게 연결할 수 있나요?",
  "answerText": "사용자가 dashboard에 입력한 답변 전문",
  "createdBy": "admin",
  "createdAt": "2026-06-07T12:10:00+09:00",
  "feedbackStatus": "pending",
  "feedbackRequestId": "interview-skill-request-20260607-002",
  "feedback": {
    "summary": "핵심 경험 연결은 좋지만 CJ푸드빌 도메인 연결 근거가 약하다.",
    "detail": "상세 피드백 전문",
    "scores": {
      "technicalAccuracy": 3,
      "experienceConnection": 4,
      "answerStructure": 3,
      "cjFoodvilleContext": 2
    },
    "strengths": ["백엔드 장애 대응 경험을 먼저 제시했다."],
    "risks": ["식음료/매장 운영 도메인과의 연결이 추상적이다."],
    "recommendedRevision": "CJ푸드빌 주문/매장 운영 맥락으로 경험을 다시 연결한다.",
    "followUpQuestions": ["해당 경험에서 지표를 어떻게 개선했나요?"],
    "improvementTopics": ["대용량 주문 처리", "장애 대응 커뮤니케이션"],
    "studyPackCandidates": ["pos-order-traffic-handling"],
    "generatedAt": "2026-06-07T12:11:00+09:00"
  },
  "sourceContext": {
    "prepPaths": [],
    "reportPaths": []
  }
}
```

필드 책임:

- `questionText`: dashboard에서 선택하거나 사용자가 입력한 질문.
- `answerText`: 사용자가 입력한 답변 전문.
  private DB record에 저장해 dashboard에서 바로 조회할 수 있게 한다.
  공개 산출물로 옮기지 않는다.
- `questionType`: `main`, `follow_up`, `revision`, `summary` 중 하나.
- `feedbackRequestId`: `interview_skill_requests`의 `answer_feedback` 요청과 연결한다.
- `feedback`: dashboard에 보여줄 피드백.
  상세 피드백까지 DB에 저장해 dashboard에서 바로 조회할 수 있게 한다.
  private feedback이며 외부 제출 문구나 공개 글이 아니다.
- `feedback.scores`: 기본 4개 평가 기준의 점수.
  기술 정확성, 경험 연결, 답변 구조, CJ푸드빌 맥락 반영을 기본값으로 둔다.
- `feedback.followUpQuestion`: LLM evaluator 또는 deterministic fallback이 만든 꼬리질문.
  LLM evaluator는 답변 상태를 보고 꼬리질문 생성 여부까지 판단한다.
- `feedback.improvementTopics`와 `feedback.studyPackCandidates`: 다음 연습 또는 public-safe 공부팩 후보.
- `sourceContext`: feedback이 참고한 career-os 경로.
  파일 본문은 저장하지 않는다.

검증 규칙:

- answer record는 Discord나 외부 알림에 본문을 보내지 않는다.
- feedback은 답변의 강점, 리스크, 권장 수정 방향, 꼬리질문 생성 여부/내용, 보완 주제, study-pack 후보를 제공한다.
  합격 보장, 허위 성과 추가, 검증되지 않은 정량 성과 제안은 금지한다.
- 평가 점수는 dashboard 비교와 개선 추적을 돕기 위한 내부 기준이다.
- 너무 짧거나 의미 없는 답변은 LLM 호출 없이 1/5 insufficient feedback으로 저장한다.
- guard 통과 답변은 `prep.md`, 현재 질문, 답변, 최근 답변/피드백 요약, 정리된 주제, 포지션 맥락으로 구성한 context bundle을 LLM evaluator에 전달한다.
- LLM raw response 전체는 audit log나 request result에 저장하지 않는다.
  합격 가능성 점수로 해석하지 않는다.
- answer record는 `study-pack-writer` 입력으로 자동 변환하지 않는다.
- 공개 가능한 기술 주제만 별도 `study_pack` request로 승격할 수 있다.
  승격은 고정 추천뿐 아니라 사용자의 자연어 요청으로도 만들 수 있다.
- 사용자가 인터뷰 중 특정 주제를 정말 모르겠다고 느끼면 해당 turn에서 직접 `study_pack` request를 만들 수 있다.
- archived session에서는 answer record 생성과 feedback request 생성을 막는다.

### 디렉터리 구조

```text
data/applications/
├── ledger.jsonl
├── _priority-history.jsonl
└── <company-slug>/
    └── <role-slug>/
        ├── posting.md
        ├── fit-analysis.md
        ├── application-package.md
        ├── resume-draft.md
        ├── cover-letter.md
        ├── submission-checklist.md
        └── review.md
```

TossPlace fixture 예시:

```text
data/applications/tossplace/applied-ai-engineer/
```

### ledger.jsonl record schema

검증 단일 출처: `scripts/application-agent/ledger_schema.ts`

```json
{
  "id": "tossplace-applied-ai-engineer-7746700003",
  "company": "TossPlace",
  "role": "Applied AI Engineer",
  "source": "toss-careers",
  "url": "https://toss.im/career/job-detail?gh_jid=7746700003",
  "status": "discovered",
  "statusUpdatedAt": "2026-05-22T13:45:00+00:00",
  "discoveredAt": "2026-05-22T13:45:00+00:00",
  "applicationDir": "data/applications/tossplace/applied-ai-engineer",
  "postingPath": "data/applications/tossplace/applied-ai-engineer/posting.md",
  "fitAnalysisPath": "data/applications/tossplace/applied-ai-engineer/fit-analysis.md",
  "applicationPackagePath": "data/applications/tossplace/applied-ai-engineer/application-package.md",
  "reviewPath": "data/applications/tossplace/applied-ai-engineer/review.md",
  "needsUserReview": true,
  "userDecision": "pending",
  "revisionCount": 0,
  "maxRevisionCount": 3,
  "riskFlags": ["existing_ledger_record"],
  "nextActions": ["fit_analysis"],
  "notes": "MVP fixture only; not an actual submission target."
}
```

필수 필드:

- `id`: `<company-slug>-<role-slug>-<external-id>` 형식 권장.
- `company`, `role`: 사람이 읽는 표시명.
- `source`: `wanted`, `toss-careers`, `company-careers`, `manual` 등 source key.
- `url`: 원 공고 URL.
- `status`: 아래 status enum 중 하나.
- `statusUpdatedAt`: 마지막 상태 변경 시각.
- `applicationDir`: 공고별 산출물 디렉터리.
- `riskFlags`: 쿨다운, 중복 지원, 공고 만료 등 리스크 태그.
- `nextActions`: 다음 agent/user action.

선택 필드:

- `discoveredAt`
- `postingPath`
- `fitAnalysisPath`
- `applicationPackagePath`
- `resumeDraftPath`
- `coverLetterPath`
- `submissionChecklistPath`
- `reviewPath`
- `needsUserReview`
- `userDecision`
- `revisionCount`
- `maxRevisionCount`
- `notes`

사용자 결정 enum:

- `pending`
- `approved`
- `rejected`
- `paused`
- `needs_changes`

상태 enum 초안:

- `discovered`
- `analyzing`
- `preparing_application`
- `needs_revision`
- `ready_for_user_review`
- `approved`
- `submitted`
- `interview_prep`
- `interview_scheduled`
- `closed`
- `blocked`

허용 전이:

```text
discovered
  -> analyzing | blocked | closed
analyzing
  -> preparing_application | needs_revision | ready_for_user_review | blocked | closed
preparing_application
  -> needs_revision | ready_for_user_review | blocked | closed
needs_revision
  -> preparing_application | blocked | ready_for_user_review
ready_for_user_review
  -> approved | needs_revision | blocked | closed
approved
  -> submitted | interview_prep | blocked | closed
submitted
  -> interview_prep | interview_scheduled | closed
interview_prep
  -> interview_scheduled | closed | blocked
interview_scheduled
  -> interview_prep | closed
blocked
  -> analyzing | preparing_application | ready_for_user_review | closed
closed
  -> (terminal)
```

### 공고별 파일 책임

- `posting.md`: 공고 원문 요약, source URL, 수집 시각, 채용 상태.
- `fit-analysis.md`: candidate-profile 기반 fit/gap, 우선순위, 지원 리스크.
- `application-package.md`: 지원 전략, 포지셔닝, 맞춤 초안 방향, 근거 보강 요청을 담는 내부 준비 문서.
- `resume-draft.md`: 사용자가 제출 전에 검토할 맞춤 이력서 Markdown 초안.
- `design.md`: 공고별 HTML/PDF 이력서 디자인 계약.
  없으면 `config/resume-design.md` 기본값을 사용한다.
- `resume.html`: `resume-draft.md`에 `design.md` 계약을 적용한 HTML 이력서.
- `resume.pdf`: HTML 이력서를 headless Chrome으로 변환한 첨부 가능한 PDF 이력서.
- `cover-letter.md`: 지원동기와 자기소개서 성격의 제출용 Markdown 초안.
- `submission-checklist.md`: 사용자가 수동 제출 전에 확인할 체크리스트.
- `review.md`: evidence guard, drift review, 개인정보/공개 금지 정보, 사용자 승인 필요 항목.

### Resume Package Contract (completed — plan055)

plan055는 지원 패키지의 전략 문서와 제출용 문서를 분리한다.
Markdown 산출물을 먼저 고정하고, 리뷰된 이력서 초안을 HTML/PDF로 내보낸다.
산출물 체인은 `Markdown 이력서 초안 -> design.md 적용 HTML 이력서 -> HTML을 PDF로 변환한 완성 PDF 이력서`다.
외부 제출 자동화는 여전히 범위 밖이다.

필수 파일:

- `application-package.md`: 내부 지원 전략과 초안 방향.
  공개 또는 제출용 최종 문구와 내부 분석을 섞지 않는다.
- `resume-draft.md`: 제출용 이력서 초안.
  검증된 경험과 근거 태그에서만 문장을 만든다.
- `design.md`: 공고별 이력서 디자인 계약.
  파일이 없으면 `config/resume-design.md`를 사용한다.
- `resume.html`: `resume-draft.md`와 디자인 계약에서 만든 HTML 제출물.
- `resume.pdf`: HTML을 headless Chrome으로 출력한 첨부 가능한 PDF.
- `cover-letter.md`: 지원동기/자기소개서 초안.
  회사와 공고 맥락을 반영하되 검증되지 않은 성과를 단정하지 않는다.
- `submission-checklist.md`: 수동 제출 전 확인 항목.
  자동 제출이나 외부 사이트 입력을 수행하지 않는다.

선택 파일:

- `resume-metadata.json`: readiness/status 계산을 단순화해야 할 때만 도입한다.
  도입 시 `ledger_schema.ts`와 fos-career projection 책임을 함께 문서화한다.

생성 문서 품질 계약:

- 첫 10줄 안에 결론을 둔다.
- 섹션 제목은 한국어 우선으로 쓴다.
- 본문은 자연스러운 한국어 문장으로 작성한다.
- 내부 분석과 제출용 문구를 분리한다.
- `needs_evidence`는 그대로 두지 않는다.
  `보강 필요 / 선택지 / 권장 행동`으로 바꾼다.
- 긴 문단과 영어-heavy label을 피한다.

`needs_evidence` resolution loop:

1. 보강이 필요한 주장과 이유를 기록한다.
2. 가능한 선택지를 제시한다.
   예: 삭제, 약화 표현, 사용자에게 근거 요청, private source 재확인.
3. 권장 행동을 하나 고른다.
4. 근거가 확인되기 전에는 제출용 문서에 강한 주장으로 쓰지 않는다.
5. 해결 상태를 `review.md` 또는 선택적 `resume-metadata.json`에 남긴다.

공개 가능한 기술 학습 자료는 이 디렉터리가 아니라 `sources/fos-study/`에 기존 `study-pack-writer` 정책으로만 발행한다.

### Git 추적 정책

루트 `.gitignore`의 `**/data/` 규칙 때문에 `data/applications/`의 실제 지원 산출물은 기본적으로 git 추적되지 않는다. 이는 의도된 정책이다. 스키마와 skill 명세만 git 추적하고, 공고별 맞춤 이력서/지원 전략/제출 상태는 로컬 private data로 유지한다.

### application-flow-agent runtime fields (plan031 — phase-01 확정)

plan031은 기존 ledger record와 호환되도록 optional runtime field를 추가한다. 기존 `status`는 큰 흐름을 유지하고, 세부 자율 실행 상태는 `agentPhase` optional 필드로 분리한다. 검증 단일 출처: `scripts/application-agent/ledger_schema.ts` (phase-02에서 확장).

```json
{
  "agentPhase": "scouting",
  "nextRunAt": "2026-06-02T09:00:00+09:00",
  "lastDecisionAt": "2026-05-26T19:45:00+09:00",
  "decisionReason": "No actionable candidate after sufficient search; retry next week.",
  "autonomyLevel": "agent_only",
  "requiredUserAction": "none",
  "actionableCandidate": false,
  "fitScore": 68,
  "priority": "normal",
  "sourceFreshness": "fresh",
  "lastAgentAction": "schedule_retry",
  "decisionLogPath": "data/applications/_logs/2026-05-26/application-flow-agent.md"
}
```

`agentPhase` enum (확정 — plan031 phase-01):

| 값 | 의미 |
|---|---|
| `scouting` | 후보 탐색 중 |
| `needs_more_search` | actionable candidate 없음 + 검색량 부족 |
| `no_good_match` | 충분히 검색했지만 actionable candidate 없음 |
| `scheduled_retry` | 다음 실행 예약됨 (`nextRunAt` 설정) |
| `actionable_candidate` | active + fit threshold 통과 후보 판정됨 |
| `generating_package` | application-package-writer 실행 대상 |
| `reviewing_package` | application-reviewer 실행 대상 |
| `collecting_evidence` | 근거 부족 보강 대상 |
| `revising_package` | agent 수정 루프 대상 |
| `waiting_user_approval` | 사용자 승인 전 정지 |
| `study_loop` | private study/interview action 생성 대상 |
| `submission_checklist` | 제출 링크/체크리스트 생성 대상 (Level 0) |

나머지 enum:

- `autonomyLevel`: `agent_only`, `user_approval_required`, `external_action_blocked`
- `requiredUserAction`: `none`, `review_application`, `approve_submission`, `provide_evidence`, `decide_cooldown`, `approve_public_publish`, `approve_profile_update`
- `priority`: `low`, `normal`, `high`, `urgent`
- `sourceFreshness`: `fresh`, `stale`, `unknown`

검증 규칙 (TypeScript validator 책임):

- `submitted`는 agent가 자동으로 설정할 수 없다.
- `approved`는 사용자 승인 근거 없이 설정할 수 없다.
- `sourceFreshness=stale`이면 actionable candidate로 취급하지 않는다.
- `revisionCount > maxRevisionCount`이면 revise action을 금지한다.
- `ready_for_user_review` 이후 외부 제출 action은 항상 사용자 승인 필요 상태로 남긴다.
- fit score 70점 미만이면 `actionable_candidate`로 전이할 수 없다.

### config/study-pack-topics.json (plan017 신규 — study-pack namespace 단일 책임)

`config/topics.json`의 `study-pack` namespace 분리본 (ADR-027). study-pack-writer + study-topic-recommender가 Read. 55 키.

ADR-069 이후 이 파일은 전체 학습 자산 DB가 아니라 migration 대상이다.
실제 학습 문서 inventory는 `sources/fos-study/`에서 파생하고, 이 파일에 남길 값은 사람이 의도적으로 고른 override, pin, fallback topic 정도로 축소한다.

```json
{
  "_meta": {
    "purpose": "study-pack-writer + study-topic-recommender 전용 topic 메타데이터",
    "schema_version": "1"
  },
  "study-pack": {
    "<topic-key>": {
      "domain": "string",
      "outputPath": "string (fos-study 기준 상대 경로)",
      "title": "string",
      "promptAppend": "string (선택)"
    }
  }
}
```

### config/study-pack-candidates.json (plan017 신규 — study-pack 후보 reservoir)

`config/topics.json`의 `study-pack-candidates` namespace 분리본 (ADR-027). study-topic-recommender가 Read (replenish 로직에서 참조).

ADR-069 이후 대량 후보 reservoir 역할은 축소 대상이다.
추천 후보는 fos-study inventory와 최근 학습 기록에서 파생하고, 이 파일은 필요한 seed/override만 남기는 방향으로 정리한다.

```json
{
  "_meta": {
    "purpose": "study-pack 후보 reservoir — study-topic-recommender replenish 전용",
    "schema_version": "1"
  },
  "study-pack-candidates": {
    "<topic-key>": {
      "domain": "string",
      "outputPath": "string",
      "title": "string",
      "promptAppend": "string (선택)"
    }
  }
}
```

### config/question-bank-topics.json (plan017 신규 — question-bank + master namespace)

`config/topics.json`의 `question-bank` + `master` namespace 분리본 (ADR-027). interview-asset-writer가 Read.

ADR-066 이후 공개 가능 일반 질문 bank의 정본은 `public/question-bank/`다.
이 파일은 공개 질문 bank 자체를 대표하지 않는다.
필요하면 private interview asset writer용 topic override로 역할을 좁히거나 이름을 바꾼다.

```json
{
  "_meta": {
    "purpose": "interview-asset-writer 전용 topic 메타데이터 (question-bank + master)",
    "schema_version": "1"
  },
  "question-bank": {
    "<topic-key>": {
      "domain": "string",
      "outputPath": "string",
      "title": "string",
      "inputFiles": ["string"]
    }
  },
  "master": {
    "<topic-key>": {
      "domain": "string",
      "outputPath": "string",
      "title": "string"
    }
  }
}
```

### config/sources.json

3개 source config 파일 통합본 (`tech-blog-sources`, `ai-topic-sources`, `geek-news-sources`).

```json
{
  "_meta": {
    "purpose": "tech-blog / ai / geek-news reservoir 단일 출처",
    "schema_version": "1",
    "categories": ["techBlog", "ai", "geek"]
  },
  "techBlog": {
    "_meta": { "purpose": "..." },
    "items": [
      {
        "key": "string",
        "title": "string",
        "source": "string",
        "url": "string",
        "feedUrl": "string (선택)",
        "filterKeywords": ["string"],
        "tags": ["string"],
        "whyNow": "string",
        "estMinutes": "number"
      }
    ]
  },
  "ai": { "...같은 구조..." },
  "geek": { "...같은 구조..." }
}
```

### config/topic-profiles.json

study-pack-writer가 토픽 family별로 작성 emphasis와 출력 경로 패턴을 참고하는 메타데이터. SKILL.md Inputs에서 Read. 옛 `.claude/skills/study-pack-writer/references/topic-profiles.md`를 JSON으로 옮긴 것 (config 컨벤션 정렬).

ADR-069 이후 전역 config에 둘 필요가 있는지 재검토한다.
skill 전용 작성 가이드라면 `.claude/skills/study-pack-writer/references/`로 이관하는 것이 우선 후보다.

```json
{
  "<family-key>": {
    "topicHints": ["string"],
    "emphasis": ["string"],
    "outputPathPatterns": ["string"]
  }
}
```

현재 family: `mysql`, `redis`, `kafka`, `spring-jpa`. topic-key가 어느 family의 `topicHints`에 속하는지 매칭 → 해당 family의 `emphasis`와 `outputPathPatterns` 적용.

### config/baseline-core-files.json

`config/baseline-core-files.txt` (ADR-003) → JSON 전환 (plan002).

```json
{
  "_meta": {
    "purpose": "baseline 분석 대상 큐레이션된 core 파일 목록 (ADR-003)",
    "schema_version": "1"
  },
  "files": [
    {"path": "interview/kakao-healthcare-carechat-ai-agent.md", "note": "선택적 — 토픽별 컨텍스트"}
  ]
}
```

`note` 필드는 선택. 단순 path 배열보다 per-file 메타데이터(우선도, 코멘트) 가능. 25개 초과 시 ADR-003 청킹 재도입 검토.

## .env / Secrets (워크스페이스 root)

ADR-021로 워크스페이스 secret 위치를 `<ws>/config/.env` → `<ws>/.env`(워크스페이스 root)로 이동. `.env.example`도 같은 위치.

`career-os/.env` 스키마:

```bash
# Discord 채널 ID (필수 — 누락 시 notify_discord.ts가 exit 1로 실패)
DISCORD_CHANNEL_ID=

# fos-study publish용 GitHub API
GITHUB_TOKEN=
GITHUB_REPO_OWNER=jon890
GITHUB_REPO_NAME=fos-study
GITHUB_REPO_BRANCH=main
```

`career-os/.env.example`은 위와 같은 키 + 빈 값. git 추적 ✓.

caller가 `.env`를 ts에 전달하는 방법: `bun --env-file=career-os/.env _shared/lib/notify_discord.ts "<message>"` (ADR-021 결정).

## logs/

### logs/task-runs.jsonl

`track_task.sh`가 매 실행마다 한 줄씩 append. career-os는 plan023 이후 native skill 직접 실행으로 전환 — `TaskRunEntry` 자동 기록은 apartment 등 `track_task.sh` 사용 워크스페이스에서만 유효. career-os 실행 이력은 Discord 알림 경유.

```json
{
  "run_id": "YYYYMMDDTHHMMSS-PID",
  "task_name": "career-os:<command>:<topic?>",
  "start_time": "ISO-8601",
  "end_time": "ISO-8601",
  "duration_sec": "int",
  "status": "success | failed",
  "exit_code": "int",
  "command": "string (전체 실행 명령)",
  "model": "string (예: claude-sonnet-4-6, claude-opus-4-7[1m]) — ADR-014 이후 채워짐",
  "tokens_in_delta": "int",
  "tokens_out_delta": "int",
  "cached_tokens_delta": "int",
  "cache_read_input_tokens": "int",
  "cache_hit_percent_start/end": "int",
  "cost_usd": "float",
  "service_tier": "standard | priority | ...",
  "claude_session_id": "string",
  "claude_result_uuid": "string",
  "usage_raw": "object (Claude usage JSON 원본)",
  "model_usage": "object",
  "file_metrics_before/after": "object (report/input/target-list 파일 메트릭)"
}
```

### logs/token-usage.jsonl

`task-runs.jsonl`과 동일 스키마. 별도 파일로 token-usage만 다시 보고자 할 때 빠른 grep용.

### logs/.usage-status/ (임시 폴더)

`track_task.sh`가 실행 중에 쓰는 임시 상태 파일들. 끝나면 정리되지 않고 누적 — 주기적 cleanup 필요 (현재 정책 미정).

## data/

### config/study-progress.json (ADR-002, data/ → config/ 이동)

```json
{
  "sessions": [
    {
      "date": "YYYY-MM-DD",
      "topics": ["string", ...],
      "files": ["string", ...],
      "source": "daily-run | manual | ..."
    }
  ],
  "weak_spots": {
    "<topic-key>": {
      "last_studied": "YYYY-MM-DD | null",
      "study_count": "int"
    }
  }
}
```

`interview-prep-analyzer` daily 모드 성공 후 자동 업데이트 (plan017, ADR-027). 옛 `run_daily.sh` 후속.

### data/reports/ (interview-prep-analyzer 산출물 — plan017)

`interview-prep-analyzer` 실행 산출물. 외부 publish 없음 — 내부 학습용.

| 경로 | 모드 | 내용 |
|---|---|---|
| `data/reports/baseline/YYYY-MM-DD/report.md` | baseline | 큐레이션 10파일 + 7섹션 고위험 영역 종합 진단 |
| `data/reports/daily/YYYY-MM-DD/report.md` | daily | 토픽 1개 3-5파일 + 5섹션 집중 점검 |

baseline 모드는 `config/baseline-core-files.json` 큐레이션 집합 사용. daily 모드는 토픽 기반 fos-study 파일 선택 + `config/study-progress.json` 갱신.

### data/generated-artifacts.json (ADR-033, plan025 이후 active 제거)

career-os 활성 동작 진실원에서 제외. `sources/fos-study/**/*.md` 트리가 study artifact의 단일 진실원이다. 파일은 history 보존을 위해 일정 기간 남길 수 있으나 Read·Write 0.

`_shared/bin/update_artifacts.py`는 career-os caller 0 — 다른 워크스페이스(현재 미사용) 영향 회피 위해 파일 자체는 별도 plan에서 처리.

### data/runtime/topic-inventory.json (ADR-009, ADR-033 이후 스냅샷 축소)

`refresh_topic_inventory.ts`가 매 morning 추천마다 갱신. ADR-033 이후 config pool 복사본이 아닌 **실행/진단 스냅샷**이다 — 마지막 실행의 판단 결과 + duplicate review status만 담는다.

```json
{
  "generatedAt": "ISO-8601",
  "sourceOfTruth": {
    "kind": "fos-study",
    "root": "sources/fos-study",
    "scannedMarkdownCount": "int",
    "excludedDirs": [".git", ".claude"]
  },
  "counts": {
    "configCuratedStudyTopics": "int",
    "configStudyTopicCandidates": "int",
    "existingFosStudyMarkdownFiles": "int",
    "remainingCuratedStudyTopics": "int",
    "remainingCandidateStudyTopics": "int",
    "remainingLiveCodingSeeds": "int",
    "duplicateCandidates": "int"
  },
  "remaining": {
    "curatedStudyTopicKeys": ["<topic-key>", ...],
    "candidateStudyTopicKeys": ["<topic-key>", ...],
    "liveCodingSlugs": ["<slug>", ...]
  },
  "excluded": {
    "exactPathMatches": [{ "key": "string", "candidatePath": "string", "matchedPath": "string" }],
    "normalizedPathMatches": [{ "key": "string", "candidatePath": "string", "matchedPath": "string" }],
    "possibleDuplicates": [{ "key": "string", "candidatePath": "string", "matchedPath": "string", "reason": "string" }]
  },
  "claudeDuplicateReview": {
    "status": "ok | skipped | failed",
    "reviewedAt": "ISO-8601 | null",
    "items": [
      { "key": "string", "candidatePath": "string", "matchedPath": "string", "decision": "new | update-existing | skip | needs-user-confirmation", "reason": "string" }
    ]
  },
  "recommendations": [],
  "updateExistingRecommendations": [],
  "todayPick": {},
  "discovery": {}
}
```

ADR-026 Python → TypeScript 마이그 결정은 유지. ADR-033 이후 fos-study 트리 스캔 결과(`excluded.*`)가 추가되고 옛 `pools.uncoveredCuratedStudyTopics` 등 config 복사본 필드는 `remaining.*`로 키만 압축.

### Duplicate decision schema (ADR-033)

`study-topic-recommender`와 `study-pack-writer`가 공유하는 중복 판정 공통 스키마. inventory의 `claudeDuplicateReview.items[]` 그리고 writer의 duplicate guard 입력/출력 모두 같은 모양을 사용한다.

```json
{
  "key": "string (topic-key)",
  "candidatePath": "string (fos-study 기준 상대 경로)",
  "matchedPath": "string (기존 fos-study 문서 경로 또는 null)",
  "decision": "new | update-existing | skip | needs-user-confirmation",
  "reason": "string (한 줄 설명)",
  "confidence": "high | medium | low"
}
```

decision 라벨 의미:

- `new` — 새 study pack 생성/추천 가능. 기존 문서와 의미 중복 없음.
- `update-existing` — 새 파일 생성 금지. 기존 문서 보강 후보. `matchedPath` 필수.
- `skip` — visible recommendation에서 제외. writer에서 호출되면 작성 중단.
- `needs-user-confirmation` — 애매. 사용자 확인 없이는 새 파일 생성 금지.

writer는 deterministic scan + (가능하면) Claude review 결과를 새 markdown Write 직전에 한 번 더 확인 — 사용자가 직접 topic-key를 지정해 호출하는 경로에도 최종 검증 조건으로 동작.

### data/runtime/study-topic-candidate-refresh.json (ADR-070)

LLM 기반 후보 refresh turn의 실행 기록.
추천기가 고정 seed만 순회하지 않도록, 현재 학습 선호·진행 상태·최근 추천 반복·fos-study inventory를 보고 새 후보를 발굴한 결과를 남긴다.

이 파일은 실행 기록이다.
실제 추천 후보로 쓰는 active 캐시는 `config/study-pack-candidates.json`에 반영한다.

```json
{
  "generatedAt": "ISO-8601",
  "trigger": {
    "kind": "on-demand | cron-health-check | recommendation-needs-refresh",
    "reason": "string",
    "sourceMessage": "string | null"
  },
  "inputs": {
    "fosStudyMarkdownCount": "int",
    "recentHistoryEntries": "int",
    "remainingNewCandidates": "int",
    "dominantRecentDomains": ["string"]
  },
  "proposals": [
    {
      "key": "string",
      "title": "string",
      "domain": "string",
      "tag": "new | deepen | interview | live-coding",
      "difficulty": "string",
      "estMinutes": "int",
      "whyNow": ["string"],
      "promotionTarget": { "outputPath": "string" },
      "sourceSignals": ["string"]
    }
  ],
  "decisions": [
    {
      "key": "string",
      "decision": "new | update-existing | skip | needs-confirmation",
      "candidatePath": "string",
      "matchedPath": "string | null",
      "reason": "string"
    }
  ],
  "applied": {
    "configPath": "config/study-pack-candidates.json",
    "added": ["string"],
    "updated": ["string"],
    "staled": ["string"]
  }
}
```

동반 markdown인 `data/runtime/study-topic-candidate-refresh.md`는 사람이 읽는 요약이다.
Discord에는 민감하지 않은 후보 수, 새 후보 예시, 보류 사유만 요약한다.

### config/study-pack-candidates.json (ADR-070 이후 active 후보 캐시)

`study-topic-recommender`가 읽는 후보 입력이다.
전체 학습 자산 목록이나 정본 reservoir가 아니다.
LLM 후보 refresh가 검증을 통과한 `new` 후보만 자동 append/update한다.

자동 반영 항목은 다음 필드를 가진다.

```json
{
  "key": "string",
  "title": "string",
  "domain": "string",
  "tag": "new | deepen | interview | live-coding",
  "difficulty": "string",
  "estMinutes": "int",
  "whyNow": ["string"],
  "source": "llm-candidate-refresh",
  "generatedAt": "ISO-8601",
  "status": "active | stale | promoted",
  "sourceSignals": ["string"],
  "promotionTarget": { "outputPath": "string" }
}
```

운영 규칙:

- `new`만 config에 반영한다.
- `update-existing`, `skip`, `needs-confirmation`은 runtime report에만 남긴다.
- active 자동 후보는 기본 30개를 넘기지 않는다.
- 30일 이상 선택되지 않은 자동 후보는 `stale` 처리 대상이다.
- fos-study 문서가 실제로 생긴 후보는 다음 refresh에서 `promoted` 또는 제거 후보가 된다.

### data/runtime/topic-inventory-history.jsonl (ADR-010/012)

매 모닝 추천마다 한 줄 append. ADR-010 carry-over penalty와 ADR-012 보조 카테고리 cooldown의 입력.

```json
{
  "generatedAt": "ISO-8601",
  "keys": ["<backend-key>", ...],
  "techBlogKeys": [...],
  "aiKeys": [...],
  "geekKeys": [...],
  "todayPickKeys": {"backend": "...", "techBlog": "...", "ai": "..."},
  "articleUrls": ["string", ...]
}
```

### data/runtime/study-topic-actions/YYYY-MM-DD.json (ADR-073)

daily study Discord 버튼 callback을 topic 추천 결과와 연결하는 runtime snapshot.
정본 학습 이력이나 추천 pool이 아니라, 해당 날짜 메시지의 버튼을 해석하기 위한 짧은 매핑이다.
`latest.json`은 가장 최근 날짜 파일의 mirror다.

```json
{
  "date": "YYYY-MM-DD",
  "generatedAt": "ISO-8601",
  "markdownPath": "data/runtime/morning-topic-recommendation.md",
  "recommendations": [
    {
      "index": 1,
      "key": "topic-key",
      "title": "string",
      "action": "career.study-pack.create:YYYY-MM-DD:1:topic-key"
    }
  ],
  "skipAction": "career.study-pack.skip:YYYY-MM-DD"
}
```

운영 규칙:

- `career.study-pack.create:*`는 study-pack 초안 생성 요청이다. 공개 최종화나 `[초안]` 제거 승인이 아니다.
- `career.study-pack.skip:*`는 그날 추천을 넘긴 기록이다. topic 영구 제외가 아니다.
- 버튼 유효시간은 OpenClaw Discord `agentComponents.ttlMs` 설정을 따른다.

### data/runtime/topic-replenishment.json (ADR-011)

replenish 실행 결과 요약. claudeInvoked 여부, 보충된 후보 수 등.

```json
{
  "generatedAt": "ISO-8601",
  "claudeInvoked": "bool",
  "requestedGenerationCount": "int",
  "before": {"candidateCount": "int", "primaryUncovered": "int", ...},
  "after": {...},
  "accepted": [...],
  "rejected": [...],
  "promoted": [...]
}
```

### data/runtime/morning-topic-recommendation.md

`refresh_topic_inventory.ts` 산출물 (ADR-026). ADR-012의 10픽 + 오늘의 3선 마크다운. 사람이 직접 읽음.

### data/runtime/feed-cache/<sha1>.json (ADR-013)

RSS/Atom feed 디스크 캐시. 6시간 TTL.

```json
{
  "url": "string",
  "fetchedAt": "ISO-8601",
  "entries": [
    {"title": "...", "url": "...", "published": "ISO-8601"}
  ]
}
```

### data/runtime/freeform-study-pack-topic.json / live-coding-generated-topic.json

`run_from_request.sh` / `run_morning_live_coding.sh`가 쓰는 임시 토픽 컨테이너. 두 runner 모두 dispatcher 미연결 — deferred.

### data/runtime/profile-refresh-suggestions/YYYY-MM-DD/ (plan020, ADR-028)

`candidate-baseline-suggester` 실행마다 생성되는 audit trail. 날짜별 디렉터리로 멱등.

```
data/runtime/profile-refresh-suggestions/
└── YYYY-MM-DD/
    ├── before/
    │   ├── candidate-profile.md          갱신 전 프로필 사본
    │   ├── baseline-core-files.json      갱신 전 baseline 파일 목록 사본
    │   └── study-progress.json           갱신 전 학습 진도 사본
    ├── after/
    │   ├── candidate-profile.md          갱신 후 사본
    │   ├── baseline-core-files.json      갱신 후 사본
    │   └── study-progress.json           갱신 후 사본
    ├── diff/
    │   ├── candidate-profile.md.diff     unified diff (before vs after)
    │   ├── baseline-core-files.json.diff
    │   └── study-progress.json.diff
    └── changes.md                        변경 사유 + fos-study path 출처 요약
```

`changes.md` 구조:

```markdown
# Profile Refresh — YYYY-MM-DD

## 강점 추가 (N건)
## 약점 outdated 마킹 (N건)
## baseline-core-files 추가 (N건)
## weak_spots 상태 갱신 (N건)
## 미반영 / skip
```

`before/` 생성 실패 시 skill이 즉시 중단 — audit trail 없이 자산 갱신 금지 (ADR-028).
git 추적 여부: `data/runtime/` 아래이므로 대부분 gitignore. 보존이 필요한 경우 사용자가 git add 수동 처리.

### data/runtime/application-agent/eval-cases/

커리어 에이전트가 만든 이력서 문장, 지원 패키지 문장, 리뷰 문장의 안전성을 점검하기 위한 평가 샘플. 현재는 runtime 실험 자산이라 git 추적하지 않는다.

기본 파일:

```text
data/runtime/application-agent/eval-cases/resume-package-eval-cases.md
```

케이스 형식:

```markdown
## Case 01 — Evidence-backed backend resume line

Type: resume_line

Candidate output:
> ...

Expected verdict: pass
```

`Expected verdict` 값:

- `pass`: 그대로 사용 가능
- `revise`: 수정 필요
- `blocked`: 제출, 공개, 이력서 반영 전 차단

현재 검증 단일 출처는 `scripts/application-agent/evaluate_cases.ts`다. 이 스크립트는 샘플을 읽어 실제 판정과 기대 판정이 일치하는지 확인하고, 결과를 `eval-reports/`에 쓴다.

### data/runtime/application-agent/eval-reports/

`scripts/application-agent/evaluate_cases.ts` 실행 결과. 기본 산출물:

```text
data/runtime/application-agent/eval-reports/latest-report.md
data/runtime/application-agent/eval-reports/latest-report.json
```

`latest-report.json` 주요 필드:

```json
{
  "generatedAt": "2026-06-05T16:31:01.830Z",
  "overall": "pass",
  "matched": 10,
  "total": 10,
  "results": [
    {
      "id": "case-01",
      "title": "Evidence-backed backend resume line",
      "type": "resume_line",
      "expectedVerdict": "pass",
      "actualVerdict": "pass",
      "matched": true,
      "reasons": ["검증 가능한 기술 경험 문장"]
    }
  ]
}
```

이 리포트는 커리어 에이전트의 평가 기준이 바뀌었을 때 회귀 확인용으로 쓴다. 장기 보존이 필요한 리포트는 별도 report 경로로 승격하기 전까지 git에 넣지 않는다.

### data/runtime/application-agent/package-eval/

실제 지원 패키지 평가 결과. `scripts/application-agent/evaluate_package.ts`가 `application-package.md`와 `review.md`를 읽고, 제출 전 안전 점검 리포트를 쓴다.

기본 산출물:

```text
data/runtime/application-agent/package-eval/<company-role>/latest-report.md
data/runtime/application-agent/package-eval/<company-role>/latest-report.json
```

`latest-report.json` 주요 필드:

```json
{
  "generatedAt": "2026-06-05T16:49:00.000Z",
  "applicationDir": "data/applications/tossplace/applied-ai-engineer",
  "overall": "revise",
  "inputs": {
    "packagePath": "data/applications/tossplace/applied-ai-engineer/application-package.md",
    "reviewPath": "data/applications/tossplace/applied-ai-engineer/review.md"
  },
  "findings": [
    {
      "id": "internal-identifier-generalization",
      "severity": "revise",
      "reason": "사내 식별자는 실제 제출본에서 일반화 권장"
    }
  ]
}
```

`overall` 산정:

- `blocked` finding이 하나라도 있으면 `blocked`
- `blocked`는 없고 `revise` finding이 있으면 `revise`
- finding이 없거나 `pass`만 있으면 `pass`

이 리포트는 runtime 점검 결과라 git에 넣지 않는다. 사용자 검토 후 보존 가치가 생긴 결론만 `review.md`나 별도 비공개 report로 승격한다.

### data/prep/<company-or-stage-slug>/ (legacy)

회사/면접 단계별 hand-crafted 준비 자산의 옛 위치다.
새 active 면접 준비 정본은 `private/<company>/<position>/interview/prep.md`다.
`data/prep/`는 보조 입력이나 과거 task evidence가 필요할 때만 참조한다.

```
data/prep/
└── <company-or-stage-slug>/   (예: cj-foodville-first-round)
    ├── strategy.md            회사/면접 단계 분석 + 후보자 포지셔닝 힌트
    └── checklist.md           면접 당일 최종 체크리스트
```

- active `config/mvp-target.json`은 `prep_dir`를 들지 않는다.
- `interview-prep-analyzer` native skill은 `primary.data_root` 아래 `interview/prep.md`를 정본으로 읽는다.
- stage 산출물: `private/<company>/<position>/interview/prep.md`.
- git 추적 ✓ — 남기는 경우 과거 히스토리 보존 가치가 있는 파일만 둔다.

### data/runtime/locks/

study-pack 등 중복 실행 방지용 flock 파일. 토픽별 `<task>-<topic>.lock`.

### data/runtime/live-position-postings.md

`position-recommender` daily runner가 Claude 호출 전에 갱신하는 active-only 공고 snapshot.
source adapter가 수집한 후보를 공통 validator가 걸러낸 뒤 markdown으로 렌더링한다.

필수 의미 필드:

- `source` — 수집 adapter 이름. 예: `wanted`, `toss-careers`.
- `discovery_mode` — 같은 source 안의 발견 경로. 예: `broad`, `target-url`, `official-listing`.
- `link_type` — 추천 입력은 `direct_posting`만 허용.
- `posting_status` — 추천 입력은 `active` 또는 `open`만 허용.
- `active_evidence` — API status, job detail page, apply form 등 active/open 근거.
- `closes_at`, `days_until_close`, `close_urgency` — 마감 판단 정보. 마감이 없으면 `no_deadline`.
- `opened_at` — 값이 있을 때만 출력. 수집되지 않은 경우 `unknown` 문자열을 쓰지 않고 생략한다.

`career_article`, `search_page`, `posting_status: unknown` 항목은 snapshot에서 제외하거나 diagnostics에만 남긴다.

source diagnostics:

- `configured_sources` — 요청된 source set. `all`은 등록된 모든 source를 뜻한다.
- `source_counts` — source별 import 후보 수.
- `source_diagnostics` — dashboard에 보여줄 source별 짧은 상태와 실패 수.
- `source_errors` — runtime output에 남기는 상세 실패. 한 source 실패는 다른 source 결과를 제거하지 않는다.

source adapter는 official listing, official API, sitemap, keyword search에서 발견한 후보를 import하기 전에 detail page를 fetch하고 active/open evidence를 기록한다.
개별 공고 URL은 daily snapshot에서 파생되어야 하며, adapter 코드의 필수 seed로 두지 않는다.
중복 처리는 URL 우선, URL이 불안정한 source는 hash 보조를 사용한다.
Wanted adapter는 백엔드 keyword 외에 AI Agent/RAG/MCP/LLMOps/ML Backend 계열 keyword를 함께 수집할 수 있다.
Toss adapter는 공식 `job-groups` API의 그룹 공고와 하위 포지션을 펼쳐 snapshot에 넣는다.

### data/runtime/position-recommendation.html

`position-recommender` daily runner가 Markdown 추천 리포트 검증 뒤 생성하는 HTML 미러.

- 정본 내용은 `data/runtime/position-recommendation.md`와 당일 report.md다.
- HTML은 사람이 아침 Discord 알림에서 바로 읽기 위한 표시 산출물이다.
- 같은 날짜 보존본은 `data/reports/daily/YYYY-MM-DD/position-recommendation/report.html`에 쓴다.
- 표시 template 정본은 `scripts/position-recommender/templates/report.html`이다.
- template은 실행 자산이므로 `data/` 아래에 두지 않는다.
- 한국어 리포트 본문은 Markdown 입력에서 들어오고, template 파일 자체는 ASCII 중심으로 유지한다.

## sources/fos-study/

외부 git 저장소 (jon890/fos-study). career-os가 마크다운만 읽고, study-pack 종류 명령이 commit + push한다.

career-os가 손대지 말아야 할 영역: `.claude/**` (별도 스킬 정의), `.git/**`.

`sources/fos-study/.claude/skills/docs-audit/SKILL.md`는 docs-audit 스킬의 진실 출처이며 `career-os/.claude/skills/docs-audit/`이 실체 디렉터리로 위치함 (내부 SKILL.md만 심링크 유지).

## fos-career MySQL 스키마

fos-career 대시보드가 소유하는 데이터.
ADR-081 이후 추천 후보 상태와 background outbox는 fos-career DB를 정본으로 둔다.
career-os 파일은 migration 전 legacy 입력 또는 private 산출물 위치로만 다룬다.

정본 원칙:

- 추천 후보의 현재 상태와 stage는 fos-career DB가 정본이다.
- 같은 공고 중복 방지는 candidate key unique constraint로 처리한다.
- HTML report는 읽기용 snapshot이며 action source가 아니다.
- `frontdoor-queue.jsonl`은 DB import 검증 후 삭제한다.
- 오래 걸리는 skill 실행은 DB outbox job으로 관리한다.

### admin_users

단일 관리자 계정 테이블.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | INT AUTO_INCREMENT PK | |
| `username` | VARCHAR(64) UNIQUE NOT NULL | 관리자 아이디 |
| `passwordHash` | VARCHAR(255) NOT NULL | bcrypt 해시 |
| `createdAt` | DATETIME NOT NULL | |
| `lastLoginAt` | DATETIME NULL | |

### sessions

관리자 세션.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | VARCHAR(128) PK | 세션 ID (UUID) |
| `adminUserId` | INT FK NOT NULL | admin_users.id |
| `expiresAt` | DATETIME NOT NULL | |
| `createdAt` | DATETIME NOT NULL | |
| `ipAddress` | VARCHAR(45) NULL | |

### audit_logs

관리자 행동 기록.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | BIGINT AUTO_INCREMENT PK | |
| `adminUserId` | INT FK NULL | admin_users.id |
| `action` | VARCHAR(128) NOT NULL | 예: `auth.login_success`, `dashboard.view`, `interview.feedback_generated` |
| `resource` | VARCHAR(128) NULL | 예: `application`, `interview_answer`, `skill_request` |
| `resourceId` | VARCHAR(255) NULL | |
| `detailsJson` | JSON NULL | |
| `createdAt` | DATETIME NOT NULL | |

### action_history

대시보드에서 시작한 액션 이력.
범용 chat action은 ADR-064로 제거됐고, 목적별 request와 면접 답변/피드백 액션만 기록한다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | BIGINT AUTO_INCREMENT PK | |
| `adminUserId` | INT FK NOT NULL | admin_users.id |
| `actionType` | VARCHAR(64) NOT NULL | 예: `dashboard.view`, `skill_request.created`, `interview.answer_submitted` |
| `payloadJson` | JSON NULL | |
| `status` | ENUM('pending','done','failed') NOT NULL | |
| `createdAt` | DATETIME NOT NULL | |

### application_state_master

지원 후보의 큰 상태를 정의하는 master table.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `key` | VARCHAR(64) PK | 예: `recommended`, `held`, `excluded`, `started`, `closed` |
| `label` | VARCHAR(128) NOT NULL | 화면 표시명 |
| `sortOrder` | INT NOT NULL | 화면 표시 순서 |
| `isTerminal` | TINYINT NOT NULL | 종료 상태 여부 |
| `createdAt` | DATETIME NOT NULL | |
| `updatedAt` | DATETIME NOT NULL | |

기본 상태:

- `recommended`: 추천 후보로 표시할 수 있다.
- `held`: 사용자가 보류했다.
- `excluded`: 사용자가 제외했다. 기본 추천 화면에서 숨긴다.
- `started`: 내부 지원 시작 workflow가 시작됐다.
- `closed`: 더 이상 진행하지 않는다.

### application_stage_master

지원 workflow 안의 현재 단계를 정의하는 master table.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `key` | VARCHAR(64) PK | 예: `company_analysis`, `fit_analysis`, `study_pack`, `resume_draft` |
| `label` | VARCHAR(128) NOT NULL | 화면 표시명 |
| `sortOrder` | INT NOT NULL | workflow 순서 |
| `createdAt` | DATETIME NOT NULL | |
| `updatedAt` | DATETIME NOT NULL | |

기본 stage:

- `company_analysis`: 회사와 사업 맥락 분석.
- `posting_analysis`: 공고 요구사항 분석.
- `fit_analysis`: 후보자 이력과 공고 fit/gap 분석.
- `study_pack`: fit/gap 기반 공부팩 생성.
- `resume_draft`: 이력서와 지원 패키지 초안 생성.
- `submitted`: 사용자가 실제 제출했다고 표시한 상태.
- `resume_passed`: 서류 통과를 표시한 상태.
- `interview_prep`: 면접 대비 workflow.

### application_stage_transitions

허용되는 state/stage 전이를 정의한다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | BIGINT AUTO_INCREMENT PK | |
| `fromState` | VARCHAR(64) NOT NULL | nullable이 필요하면 별도 sentinel 사용 |
| `fromStage` | VARCHAR(64) NOT NULL | nullable이 필요하면 별도 sentinel 사용 |
| `toState` | VARCHAR(64) NOT NULL | |
| `toStage` | VARCHAR(64) NOT NULL | |
| `trigger` | VARCHAR(128) NOT NULL | 예: `user.start_application`, `worker.fit_analysis_done` |
| `createdAt` | DATETIME NOT NULL | |

### position_recommendation_runs

아침 포지션 추천 실행 단위.
Markdown/HTML 리포트와 DB ingest 결과를 연결한다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | VARCHAR(64) PK | run id |
| `reportDate` | DATE NOT NULL | 리포트 기준 날짜 |
| `sourceSnapshotPath` | TEXT NULL | 수집 snapshot path |
| `markdownReportPath` | TEXT NOT NULL | career-os report.md 또는 runtime markdown path |
| `htmlReportPath` | TEXT NULL | career-os report.html path |
| `status` | ENUM('pending','ingested','failed') NOT NULL | ingest 상태 |
| `itemCount` | INT NOT NULL | structured item 수 |
| `createdAt` | DATETIME NOT NULL | |
| `updatedAt` | DATETIME NOT NULL | |

### application_candidates

추천 공고 후보의 identity table.
같은 공고가 여러 날 추천되어도 한 row로 유지한다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | VARCHAR(64) PK | candidate id |
| `candidateKey` | VARCHAR(128) UNIQUE NOT NULL | normalized URL hash 또는 fallback hash |
| `keyStrategy` | ENUM('normalized_url','company_title_source_close_date') NOT NULL | key 생성 방식 |
| `source` | VARCHAR(64) NOT NULL | Wanted, Toss, NAVER Careers 등 |
| `company` | VARCHAR(256) NOT NULL | 회사명 |
| `title` | TEXT NOT NULL | 공고명 |
| `postingUrl` | TEXT NULL | 원본 공고 URL |
| `normalizedPostingUrl` | TEXT NULL | query/tracking 정리 URL |
| `closeDate` | VARCHAR(32) NULL | 마감일 문자열 |
| `latestRunId` | VARCHAR(64) NULL | 마지막 추천 run |
| `latestSnapshotJson` | JSON NOT NULL | 추천 카드 요약, fit/gap, evidence |
| `createdAt` | DATETIME NOT NULL | |
| `updatedAt` | DATETIME NOT NULL | |

### application_candidate_states

지원 후보의 현재 상태와 stage.
대시보드가 현재 화면을 계산할 때 보는 정본이다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `candidateId` | VARCHAR(64) PK | application_candidates.id |
| `currentState` | VARCHAR(64) NOT NULL | application_state_master.key |
| `currentStage` | VARCHAR(64) NULL | application_stage_master.key |
| `ledgerId` | VARCHAR(255) NULL | legacy ledger 또는 새 application workflow id |
| `lastUserAction` | VARCHAR(128) NULL | 예: `start_application`, `hold`, `exclude` |
| `lastUserActionAt` | DATETIME NULL | |
| `lastRecommendationRunId` | VARCHAR(64) NULL | 마지막으로 추천에 등장한 run |
| `hiddenFromRecommendation` | TINYINT NOT NULL | excluded/closed 기본 숨김 |
| `stateReason` | TEXT NULL | 사용자 또는 system reason |
| `createdAt` | DATETIME NOT NULL | |
| `updatedAt` | DATETIME NOT NULL | |

표시 규칙:

- `recommended`: 카드 표시, 클릭 가능.
- `held`: 보류 섹션으로 분리.
- `excluded`: 기본 추천 화면에서 숨김.
- `started`: 지원 준비 중으로 표시, 다시 클릭 불가.
- `closed`: 기본 숨김.

### career_outbox_jobs

fos-career가 소유하는 background job outbox다.
사용자 클릭과 worker 실행을 분리하고, retry와 감사 가능성을 보장한다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | VARCHAR(64) PK | job id |
| `jobType` | VARCHAR(128) NOT NULL | 예: `application.start`, `application.fit_analysis`, `study_pack.create` |
| `aggregateType` | VARCHAR(64) NOT NULL | 예: `application_candidate` |
| `aggregateId` | VARCHAR(64) NOT NULL | candidate id 또는 application id |
| `payloadJson` | JSON NOT NULL | worker 입력. private 본문은 저장하지 않음 |
| `status` | ENUM('pending','running','succeeded','failed','dead','cancelled') NOT NULL | |
| `attempts` | INT NOT NULL | |
| `maxAttempts` | INT NOT NULL | |
| `nextRunAt` | DATETIME NOT NULL | |
| `lockedBy` | VARCHAR(128) NULL | worker id |
| `lockedAt` | DATETIME NULL | |
| `idempotencyKey` | VARCHAR(255) UNIQUE NOT NULL | 중복 실행 방지 key |
| `resultJson` | JSON NULL | 생성 경로, 다음 stage, 요약 |
| `lastError` | TEXT NULL | 실패 요약 |
| `createdAt` | DATETIME NOT NULL | |
| `updatedAt` | DATETIME NOT NULL | |

worker 규칙:

- pending job을 `nextRunAt <= now()` 조건으로 가져온다.
- lock 획득은 DB transaction으로 처리한다.
- 실패하면 attempts를 늘리고 backoff 뒤 재시도한다.
- `dead`는 maxAttempts 초과 또는 재시도 불가능한 검증 실패다.
- 외부 제출, 업로드, 로그인, 공개 발행은 jobType으로 허용하지 않는다.

### priority_action_requests (legacy bridge)

fos-career가 소유하는 priority write-action pending queue다.
career-os 파일을 직접 쓰지 않고, 사용자가 확인한 요청을 감사 가능한 DB row로 보존한다.
ADR-081 이후 새 long-running 작업은 `career_outbox_jobs`로 통합한다.
priority bridge는 migration compatibility로 유지한다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | VARCHAR(64) PK | UUID |
| `adminUserId` | INT FK NOT NULL | admin_users.id |
| `recordType` | ENUM('frontdoor_queue','ledger') NOT NULL | career-os record 종류 |
| `recordId` | VARCHAR(255) NOT NULL | queueId 또는 ledger id |
| `requestedStage` | VARCHAR(32) NOT NULL | action stage |
| `requestedRank` | INT NOT NULL | 같은 stage 안 상대 순서 |
| `reason` | TEXT NOT NULL | 사용자가 확인한 이유 |
| `status` | ENUM('pending','applied','rejected','failed','stale') NOT NULL | 처리 상태 |
| `requestSnapshotJson` | JSON NOT NULL | 요청 당시 record 요약과 기존 priority |
| `appliedEventId` | VARCHAR(255) NULL | career-os `_priority-history.jsonl` eventId |
| `errorMessage` | TEXT NULL | 실패 또는 stale 사유 |
| `createdAt` | DATETIME NOT NULL | |
| `updatedAt` | DATETIME NOT NULL | |

상태 책임:

- `pending`: fos-career가 요청만 저장했다.
- `applied`: career-os runner가 기존 `confirm-priority` 계열 명령으로 적용했고 eventId를 연결했다.
- `rejected`: 사용자가 적용 전 취소했다.
- `failed`: runner가 검증 또는 실행에 실패했다.
- `stale`: 요청 당시 snapshot과 현재 career-os record가 달라 자동 적용하지 않았다.

검증 규칙:

- `requestedStage`는 career-os `ActionStage` enum 중 하나여야 한다.
- `requestedRank`는 양의 정수여야 한다.
- `reason`은 빈 문자열이면 안 된다.
- 같은 `recordType` + `recordId`에 `pending` row가 있으면 새 요청보다 기존 요청 검토를 우선한다.
- fos-career 웹 앱은 이 row 생성만 수행하고 `frontdoor-queue.jsonl`, `ledger.jsonl`, `_priority-history.jsonl`을 쓰지 않는다.
- fos-career host-side processor는 pending row를 읽고 career-os applier를 호출한 뒤 이 table과 `audit_logs`만 갱신한다.

### priority action request applier input

career-os `scripts/application-agent/apply_priority_request.ts`가 받는 JSON contract다.
stdin 또는 `--request <path>`로 전달한다.

```json
{
  "requestId": "uuid",
  "recordType": "frontdoor_queue",
  "recordId": "queue-id",
  "requestedStage": "prepare-now",
  "requestedRank": 1,
  "reason": "사용자가 확인한 이유",
  "changedBy": "fos-career-admin:1",
  "requestSnapshot": {
    "recordType": "frontdoor_queue",
    "recordId": "queue-id",
    "company": "Company",
    "role": "Backend Engineer",
    "url": "https://example.com/posting",
    "effectiveActionStage": "investigate",
    "priorityRank": 2,
    "prioritySource": "recommendation",
    "latestRecommendationSnapshotAt": "2026-06-07T00:00:00.000Z",
    "latestUserConfirmationAt": null,
    "userConfirmedPriority": null
  }
}
```

stale guard 비교 대상:

- record type/id
- company/role/url
- effective action stage와 rank
- priority source
- latest recommendation snapshot timestamp
- latest user confirmation timestamp
- current `userConfirmedPriority`

결과 JSON status:

- `applied`: stale guard 통과 후 기존 `application-agent confirm-priority` helper로 반영했다.
- `stale`: 현재 career-os projection이 request snapshot과 달라 쓰지 않았다.
- `rejected`: request JSON이 schema 또는 identity contract를 만족하지 않는다.
- `failed`: helper 실행 중 예외가 발생했다.

### user_position_action_requests (legacy bridge — plan059)

fos-career가 소유하는 공고 상태 사용자 액션 pending queue다.
사용자가 dashboard에서 `보류`, `제외`, `지원 준비`를 선택하면 career-os 파일을 직접 쓰지 않고 이 요청으로 저장한다.
ADR-081 이후 상태 변경은 `application_candidate_states` transaction으로 처리하고, 오래 걸리는 실행은 `career_outbox_jobs`로 넘긴다.
이 table은 legacy frontdoor/ledger bridge migration 중에만 사용한다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | VARCHAR(64) PK | UUID |
| `adminUserId` | INT FK NOT NULL | admin_users.id |
| `recordType` | ENUM('frontdoor_queue','ledger') NOT NULL | career-os record 종류 |
| `recordId` | VARCHAR(255) NOT NULL | queueId 또는 ledger id |
| `requestedAction` | ENUM('hold','exclude','prepare_application') NOT NULL | 사용자 선택 액션 |
| `reason` | TEXT NULL | 사용자가 입력한 선택 사유. optional |
| `effectiveReason` | TEXT NOT NULL | 사용자 사유 또는 시스템 기본 사유 |
| `status` | ENUM('pending','running','done','failed','stale') NOT NULL | 처리 상태 |
| `requestSnapshotJson` | JSON NOT NULL | 요청 당시 record 요약과 현재 stage/status |
| `resultSnapshotJson` | JSON NULL | 적용 뒤 stage, ledgerId, readiness, material paths 요약 |
| `errorMessage` | TEXT NULL | 실패 또는 stale 사유 |
| `createdAt` | DATETIME NOT NULL | |
| `updatedAt` | DATETIME NOT NULL | |

액션 의미:

- `hold`: action stage를 `hold`로 바꾸고 사용자의 판단 보류 상태로 둔다.
- `exclude`: action stage를 `excluded`로 바꾸고 추천/준비 후보에서 제외한다.
- `prepare_application`: 상태 변경과 함께 지원 준비 산출물 생성을 시작한다.
  frontdoor 후보는 ledger 승격을 거친 뒤 이력서 패키지 생성 request로 이어진다.

검증 규칙:

- `reason`은 optional이지만 `effectiveReason`은 비어 있으면 안 된다.
- 같은 `recordType` + `recordId`에 `pending` 또는 `running` row가 있으면 새 요청보다 기존 요청 검토를 우선한다.
- `prepare_application`은 외부 제출, 로그인, 업로드를 수행하지 않는다.
- processor는 요청 당시 snapshot과 현재 career-os record를 비교하고 stale이면 career-os 파일을 쓰지 않는다.
- result payload에는 ledger id, 적용 stage, readiness 숫자, material path 요약만 저장한다.
  private 문서 본문, resume body, command stdout 전체는 저장하지 않는다.

### llm_chat_sessions (legacy — ADR-064)

초기 fos-career MVP의 범용 LLM 채팅 세션.
ADR-064 이후 새 코드 경로는 이 table을 사용하지 않는다.
즉시 destructive migration으로 drop하지 않고, 데이터 보관 여부는 별도 cleanup plan에서 결정한다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | VARCHAR(128) PK | UUID |
| `adminUserId` | INT FK NOT NULL | admin_users.id |
| `title` | VARCHAR(255) NOT NULL | 자동 생성 또는 사용자 지정 |
| `createdAt` | DATETIME NOT NULL | |
| `updatedAt` | DATETIME NOT NULL | |

### llm_chat_messages (legacy — ADR-064)

초기 fos-career MVP의 범용 LLM 채팅 메시지.
ADR-064 이후 면접 답변/피드백은 전용 interview answer/feedback table과 request 흐름을 사용한다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | BIGINT AUTO_INCREMENT PK | |
| `sessionId` | VARCHAR(128) FK NOT NULL | llm_chat_sessions.id |
| `role` | ENUM('user','assistant') NOT NULL | |
| `content` | TEXT NOT NULL | |
| `contextSnapshotJson` | JSON NULL | 채팅 시점 career-os 컨텍스트 메타데이터 (파일 경로 목록 + 레코드 count만, 전체 내용 아님) |
| `createdAt` | DATETIME NOT NULL | |

Git 추적: fos-career 저장소(`~/services/fos-career`)에서 Drizzle ORM으로 관리.
ai-nodes career-os와 무관.
