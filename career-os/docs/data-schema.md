# Data Schema — career-os

career-os가 다루는 모든 영속 데이터의 스키마와 위치. 새 필드를 추가하거나 새 파일을 도입할 때 이 문서에 같이 갱신한다.
작성 규칙은 [`README.md`](README.md)의 Data Schema 작성 규칙을 따른다.

## 디렉터리 한눈에 (5버킷 구조 — ADR-107)

top-level을 5버킷으로 재편했다.
config/state는 "이 파일이 바뀌는 트리거가 무엇인가"로 가른다(사용자 의도 = config, 시스템 실행·이벤트 = state).
현재 구조에서는 `config/`, `state/`, `applications/`, `reports/`, `cache/`가 각자의 책임을 갖는다.

| 디렉터리 | 역할 | git 추적 |
|---|---|---|
| `.env` (워크스페이스 root) | GitHub 토큰 등 secret | ✗ (.gitignore) |
| `.env.example` (워크스페이스 root) | secret 키 템플릿 — git 추적되는 빈 값 가이드 | ✓ |
| `config/` | 사람이 큐레이션한 정책·현재 타깃·baseline·예외 override. 자산 목록 복제본으로 쓰지 않음 (ADR-069) | ✓ |
| `state/` | 시스템 실행·이벤트 산물 (positions-queue, 학습·드릴 진도, mvp-target, topic-inventory, drill-log, company-cooldown, 수집 노트, eval) | ✗ 기본 gitignore, 5개 파일만 negation tracked (ADR-107) |
| `applications/` | 공고별 지원 상태, 맞춤 지원 패키지, evidence/drift review | ✗ |
| `reports/` | 사람이 읽는 생성물 (baseline·daily·job-fit·stage-prep 리포트, morning-topic-recommendation, `reports/latest/` mirror, `reports/downloads/`) | ✗ |
| `cache/` | 재생성 가능한 캐시·transient (live-postings snapshot, feed-cache, locks, normalized) | ✗ |
| `private/<company-slug>/<position-slug>/` | 회사·직무별 active 준비 홈. 면접·스터디·지원 산출물을 포지션 단위로 묶는 작업 홈 | ✗ |
| `private/` | 회사·포지션별 작업 홈과 필요 시 archive. 공개용으로 다듬기 전의 준비 자료 위치 | ✗ |
| `public/question-bank/` | 공개 가능 일반 backend/CS 면접 질문 bank. private 맥락 없이 git 추적되는 재사용 질문 자산 | ✓ |
| `logs/` | 추천 지표와 skill 평가 로그 | ✗ |
| `sources/fos-study/` | 외부 동기 저장소 (jon890/fos-study) — git submodule 같은 위치이나 실제로는 별도 clone | ✗ |

`state/`에서 negation으로 tracked를 유지하는 5개 파일: `study-progress.json`·`drill-progress.json`·`mvp-target.json`·`study-pack-candidates.json`·`company-cooldown.json` (clone 간 연속성이 필요한 저-churn 상태). 나머지 `state/**`는 untracked runtime이다.

## 버킷 경계와 보존 원칙 (ADR-058, ADR-107)

`state/`·`applications/`·`reports/`·`cache/` 아래 파일과 `private/`는 private by default다.
특히 지원, 면접, 후보자 이력, 회사별 전략, 수집 원문과 연결된 내용은 공개 가능성이 따로 확인되기 전까지 비공개로 본다.

기본 경계:

- `private/<company>/<position>/` — 포지션별 작업 홈.
  회사·포지션 맥락, 면접 준비, 답변 메모, 포지션별 학습 재료를 둔다.
  공개 가능한 기술 자료는 개인 맥락을 제거해 `sources/fos-study/`에 별도로 작성할 수 있다.
- `applications/` — 실제 지원 준비와 공고별 산출물의 private home.
  맞춤 이력서, 지원 전략, fit/gap 분석, review, 제출 체크리스트를 둔다.
- `private/archive/` — public/state/report 중 어느 곳에도 바로 둘 수 없는 private-only archive 후보 위치.
  구조 전환에서 새 정본으로 대체한 legacy state/report는 archive 없이 삭제할 수 있다.
- `state/source/` — 외부에서 수집한 source text와 notes의 입력 위치.
  외부 공개 페이지에서 왔더라도 특정 지원, 면접, 회사 전략과 연결되면 private by default로 다룬다.
- `reports/` — baseline, daily, position, interview-prep 같은 생성 리포트 위치.
  active 판단에 쓰이는 최근 report와 참조된 report만 active로 두고, 오래된 report는 retention 검토 후 archive한다.
- `state/`·`cache/` — projection, lock, eval result, 큐, 진도 같은 가변 상태 위치.
  장기 근거가 필요한 state 파일은 그대로 두지 않고 report, 검증 근거, private archive 중 하나로 승격 여부를 결정한다.

문서 유지 원칙:

- 폐기·제거된 항목은 이 문서에 스키마를 남기지 않는다. 문서 비대화와 노이즈를 줄인다.
- 폐기 이력은 Git 이력에서 확인한다.
- 단, applier·processor 등 코드가 아직 참조하는 항목은 legacy라도 스키마를 유지한다.

## public/question-bank/ (ADR-066, ADR-097)

공개 가능 일반 backend/CS·인성 면접 질문 bank이자 **질문 정본**이다(ADR-097).
`state/`·`applications/`·`reports/`·`cache/`가 gitignore/private 성격이므로, 공개 가능한 재사용 질문은 이 경로에 둔다.
`interview-asset-writer`, `question-bank-collector`, 드릴 엔진이 모두 이 정본을 소비한다.

기본 하위 디렉터리(= category):

- `java-spring/`
- `database/`
- `cs/`
- `operations/`
- `system-design/`
- `behavioral/` (ADR-097 신설 — 일반 STAR·협업·성장 질문)

질문 항목 기본 필드:

- `id`
- `topic` (ADR-097 — `study-progress.json` `weak_spots` 키. 드릴·`study-topic-recommender`·공부팩이 공유하는 약점 추적 식별자)
- `category`
- `difficulty`
- `question`
- `intent`
- `answerSignals`
- `source`
- `publicSafe`
- `positionFitHint`
- `normalizedFrom`
- `followUps` (선택)

경계:

- private 답변, 포지션별 지원 전략, 회사별 비공개 맥락을 저장하지 않는다.
- behavioral 카테고리에는 일반 질문 본문만 둔다. 후보자 개인 답변·이력 기반 질문은 `private/question-bank/`에 둔다.
- 인성 면접 웹 수집 자료에서 파생한 public-safe 일반 질문은 `public/question-bank/behavioral/questions.json`에 누적한다.
  수집 근거, URL, 신뢰도, 회사별 맥락은 `state/behavioral-interview-web-source-scan-YYYY-MM-DD.md`에 둔다.
- 유료 강의/문제집/면접 후기 원문을 복사하지 않는다.
- `sources/fos-study/`로 발행하려면 별도 public-safe 문서로 재작성한다.

파일 기반 question bank 보강:

- 사용자는 `/question-bank-collector <topic>`을 직접 호출한다.
- 결과에는 `public/question-bank` 경로, 요약, validator count만 둔다.
- private 답변, 지원 전략, 회사별 비공개 맥락은 저장하지 않는다.

보존 정책:

- 삭제는 마지막 단계다.
  먼저 archive, tombstone, retention window, task-local evidence 중 하나로 분류한다.
  단, 구조 전환에서 정본이 `private/<company>/<position>/`으로 이동했고 새 정본으로 대체 확인이 끝난 legacy mirror/runtime/report는 archive 없이 제거해도 된다.
- 오래된 generated report는 최근 7일 반복 추천, active interview/application 판단, task/ADR 근거와 연결돼 있으면 보존한다.
  연결이 없고 새 report나 docs 결정으로 대체됐으면 `private/archive/` 후보로 분류한다.

## private/question-bank/ (ADR-097)

후보자 이력 기반 **개인 맞춤 질문 정본**이다.
`**/private/`로 git 무시되므로 공개되지 않는다.
일반 질문은 `public/question-bank/`에 두고, 여기에는 개인 맥락이 들어간 질문만 둔다.

파일:

- `private/question-bank/behavioral-personal.jsonl` — 후보자 이력 기반 개인 STAR 질문
- `private/question-bank/tech-personal.jsonl` — 후보자 경험 기반 기술 심화 질문

질문 항목 필드(JSON Lines, 한 줄 한 질문):

- `id` — 고유 식별자(예: `beh-personal-001`, `tech-personal-001`)
- `topic` — `weak_spots` 키(public 질문과 동일 규칙). 드릴이 같은 약점으로 추적한다.
- `category` — 일반 질문과 같은 분류 체계
- `difficulty`
- `question`
- `intent`
- `answerSignals`
- `followUps` (선택)
- `source` — `interview-asset-writer`(candidate-profile 파생) 또는 드릴 중 즉석 생성

생성·소비:

- 생성: `interview-asset-writer`가 `config/candidate-profile.md` 기반으로 파생하거나, 드릴 중 사용자 요청으로 즉석 생성한다.
- 소비: 드릴 엔진이 public(일반) 정본과 합쳐 질문 풀을 구성한다.

경계:

- 이 경로의 질문을 `public/question-bank/`로 역유출하지 않는다.
- 회사별 비공개 맥락·지원 전략은 질문 본문이 아니라 지원 패키지/면접 메모(`applications/` private 산출물)에서 관리한다.

## config/

### config 책임 원칙 (ADR-069)

`config/`는 “존재하는 모든 자산 목록”이 아니라 “사람이나 agent가 의도적으로 고른 정책·타깃·예외”를 담는다.

유지 원칙:

- 후보자 baseline과 장기 이력(추천·fit 판단용 core): `config/candidate-profile.md` (ADR-104)
- 후보자 면접 서사·심화(면접 skill용 detail): `config/candidate-profile-detail.md` (ADR-104)
- baseline 분석용 core file pin: `config/baseline-core-files.json`
- 외부 reading reservoir: `config/external-reading-sources.json`

ADR-107로 `state/`로 이동한 항목(트리거가 시스템 실행·이벤트라 config가 아님):

- 현재 회사·직무·포지션 홈: `state/mvp-target.json` (탈락 시 루프가 primary→history 자동 갱신)
- topic 학습 진행 상태와 약점 학습 상태: `state/study-progress.json` (ADR-105 — 드릴 상태는 분리)
- 드릴 간격 반복 상태: `state/drill-progress.json` (ADR-105)
- study-pack 후보 캐시: `state/study-pack-candidates.json`
- 회사 cooldown: `state/company-cooldown.json` (ADR-109 — verified-company에서 분리)
- durable 공고 필터(회사 선호 제외 + 공고 URL 억제): `config/position-filters.json` (ADR-111)
- 검증 회사군과 회사 키워드 단일 출처: `config/verified-company-research-targets.json` (ADR-090, references에서 이동; ADR-103 회사 키워드 흡수)
- position 수집 설정(회사 비종속 role 키워드): `config/position-collection.json` (ADR-099, ADR-103) — `{ wanted: { jobGroupId, targetKeywords[] } }`. targetKeywords는 role 키워드만, 회사 키워드는 verified가 소유
- 후보자 구조화 사실: `config/candidate-config.json` (ADR-099) — `{ experienceYears, ... }`. 코드가 읽는 사실 정본, profile.md는 prose 서술(거울 구조)
- position 지표 시계열: `logs/position-metrics.jsonl` (ADR-099) — 날짜별 1줄 append. `{ date, collection:{activeDirectPostings,sourceCounts,rejectCounts,adapterCoverage}, recommendation:{strongActive,newRatio,tierDist,labelCompleteness} }`
- 지원서 export 기본 디자인 계약: `config/resume-design.md`
- 사람이 명시적으로 고른 추천 guardrail, pin, 제외, seed override

파생 원칙:

- 학습 문서 inventory는 `sources/fos-study/` 파일 트리에서 파생한다.
- 공개 가능 일반 면접 질문 inventory는 `public/question-bank/` validator 결과에서 파생한다.
- config는 `sources/fos-study/`나 `public/question-bank/`의 전체 목록을 다시 들고 있지 않는다.
- 대량 reservoir JSON은 정본이 아니라 migration 대상이다.
  필요한 항목만 curated override나 seed로 축소한다.

config 축소 이후 상태:

- `first-round-drill-core-files.json` — `interview/prep.md` 단일 정본 이후 제거됨.
- `study-pack-candidates.json` — `state/study-pack-candidates.json`으로 이동됨(ADR-107).
- `study-preferences.json`, `study-pack-topics.json`, `topic-profiles.json`, `question-bank-topics.json`, `live-coding-seed-pool.json`, `live-coding-seed-candidates.json` — 전체 목록 역할을 중단하고 override/seed 중심으로 축소되어 남아 있다(각 파일 섹션 참조).

### config/verified-company-research-targets.json (검증 회사군 단일 출처, ADR-090)

검증 회사군의 단일 출처. 코드(adapter discovery)와 LLM 프롬프트 주입 양방향으로 소비한다.
`references/`에서 `config/`로 이동했다(ADR-090). 텍스트로 흩어졌던 "최우선 탐색군"(decision-criteria.md·prompt.md)을 흡수하고, 두 텍스트는 본 파일을 역참조한다.

| 필드 | 소비자 | 설명 |
|---|---|---|
| `priorityCompanies[].company`, `koreanName`, `tier` | 공통/LLM | 회사명·검증 티어 |
| `priorityCompanies[].hasAdapter`, `adapterId` | 코드 | 수집 adapter 커버리지·라우팅. `false`는 adapter 추가 backlog |
| `priorityCompanies[].careerUrls`, `wantedKeywords` | 코드+LLM | discovery entrypoint + 탐색 키워드 |
| `priorityCompanies[].preferredDomains`, `notes` | LLM | 회사 업사이드 판단 근거 |
| `priorityCompanies[].techBlogs` | LLM | 기술 블로그 URL 목록. `ref:<key>` 값은 `config/external-reading-sources.json`의 `techBlog.items[].key`를 가리키고, URL 정본은 그 파일이다. 매칭 항목이 없으면 URL을 그대로 둔다 |
| `secondaryCompanies[]` | 코드+LLM | 저-tier 회사 키워드 목록(ADR-103). priorityCompanies에 없던 회사 키워드를 담아 수집 커버리지 유지. `company`·`wantedKeywords` 중심 |

`cooldown`은 ADR-109로 `state/company-cooldown.json`으로 분리했다(지원 결과 이벤트로 갱신 = state). 본 파일에는 더 두지 않는다.
`preferenceExcluded`는 ADR-111로 `config/position-filters.json`의 `excludedCompanies`로 이관했다(durable 공고 필터 통합). 본 파일에는 더 두지 않는다.
코드는 JSON을 읽어 adapter 라우팅과 LLM 판단에 사용한다.

### config/position-filters.json (durable 공고 필터 단일 출처, ADR-111)

position-recommender가 참조하는 사람 큐레이션 제외의 단일 출처. 소비 단계가 다른 두 필드를 담는다.

| 필드 | 소비자 | 설명 |
|---|---|---|
| `excludedCompanies[]` | 코드(수집) | 회사 단위 선호 제외. `collect_live_postings.ts`가 수집 시점에 주입해 snapshot에서 제외한다. preferenceExcluded 이관(ADR-095→ADR-111) |
| `suppressedPostings[]` | 코드(추천)+LLM | 공고 URL 단위 억제. `render_candidate_preview.ts`가 전체 공고 HTML에서 숨기고, 추천 티어 제외는 SKILL 지시에 따라 에이전트가 수행한다. `url`·`company`·`title`·`reason` |

`suppressedPostings`는 URL 단위라 같은 회사가 다른 URL로 새 공고를 올리면 다시 노출된다.
역할 패턴(seniority·저수준 네트워크 등)의 일반 제외는 `references/position-decision-criteria.md` 방법론 산문이 담당한다.
시한부 cooldown은 여기 두지 않는다 — `state/company-cooldown.json`이 정본이다(ADR-109·ADR-107).

### state/company-cooldown.json (ADR-109 신규)

우선순위 감점 쿨다운 회사와 해제 메모의 단일 출처.
`verified-company-research-targets.json`에서 분리했다(지원 결과 이벤트로 갱신 = state).
하드필터가 아니라 감점 신호다(ADR-095 판단 기준 유지). 해제 날짜 결정 이력이 있어 tracked를 유지한다.

```json
{
  "active": [
    { "company": "string", "failedAt": "YYYY-MM (선택)", "cooldownUntil": "YYYY-MM-DD | null", "reason": "string" }
  ],
  "notes": "string"
}
```

### state/mvp-target.json (현재 타깃 단일 출처. ADR-107 config→state 이동)

전용 zod 검증 스크립트는 없다(#69에서 legacy interview-prep-analyzer 스크립트 삭제). 각 skill이 파일을 직접 읽는다.

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
    "position_focus": "string (선택, 현재 타깃 포지션의 핵심 업무·스택·도메인)",
    "notes": "string (선택)",
    "interview": {
      "first_round": {
        "sites": [
          { "key": "string", "url": "string (URL)", "label": "string" }
        ],
        "source_dir": "string (state/source/ 아래 서브 디렉터리명)",
        "report_slug": "string (reports/daily/<date>/<slug>/ 경로명)"
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

- `primary` — 활성 타깃이 없으면 `null`일 수 있다.
  탈락, 지원 취소, 종료 후 다음 active target이 정해지지 않았을 때 사용한다.
- `history[].outcome` — 선택 필드.
  `rejected`, `withdrawn`, `closed`, `completed` 중 하나다.
- `primary.interview` — 면접 단계별 컨테이너.
  - `primary.interview.first_round` — 1차 면접 mode. 활성. 필드: sites, source_dir, report_slug.
  - `primary.interview.final_round` — 최종 면접 mode. nullable, 필요 시 활성화.
  - `primary.interview.offer_chat` — 오퍼 단계 mode. nullable, 필요 시 활성화.
- `primary.company_slug`, `primary.position_slug`, `primary.data_root` — 회사·직무별 관리 홈.
  active 타깃의 사람이 보는 자산은 `data_root` 아래에 둔다.
  자동화는 `data_root`를 정본으로 읽고, 면접 질문 정본을 `state`나 `reports/daily`에 중복 유지하지 않는다.

타깃 전환 시 `primary`를 `history` 앞에 push하고 새 `primary`를 채운다.

### private/<company-slug>/<position-slug>/ (position home)

회사·직무별 active 준비 홈이다.
예: `private/cj-foodville/digital-channel-backend/`.

이 위치는 공개용 자료가 아니라 포지션별 작업 홈이다.
회사·포지션 맥락, 면접 질문, 답변 메모, 피드백, 지원 준비가 섞일 수 있다.
자동화는 이 경로를 정본으로 읽는다.
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

분리 파일로 생성됐던 면접 준비 리포트, 예상 질문 드릴, 1차 면접 전략, 1차 면접 체크리스트, 10일 Java 준비 재료는 active primary asset으로 유지하지 않는다.
필요한 내용만 `interview/prep.md`에 정제해 흡수한다.

### config/candidate-profile.md (core) + config/candidate-profile-detail.md (detail)

후보자 이력. prose 마크다운. **JSON이 아닌 의도적 선택** — AI 에이전트가 context로 직접 읽는 자산이라 구조화보다 narrative 가치가 큼. 모든 주장은 `task/**` 또는 `resume/**` 경로 태깅됨 (소스 추적용).

ADR-104로 성격별 2파일로 분리한다.

- `config/candidate-profile.md` (core) — 추천·fit 판단용 사실·라벨 7개 섹션.
  지원 대상, 핵심 무기, 커리어 타임라인, 보유 기술 스택(라벨 중심·증거 축약), 입증된 강점, 약점·학습 중인 영역, 제약·스코프.
  경로를 유지해 기존 참조 파손을 막는다.
- `config/candidate-profile-detail.md` (detail) — 면접 서사·심화 5개 섹션.
  주요 프로젝트 요약, 개인 프로젝트, 기술 의사결정 패턴, 협업·리더십·코드 리뷰 스타일, 면접 준비 우선순위.
  보유 기술 스택의 증거 상세(여러 줄 서술 + `task/**` 경로)도 여기 둔다.
- Source provenance는 `config/candidate-profile-provenance.md`가 단일 출처다. 어느 skill에도 프롬프트로 주입하지 않는다.

skill별 주입 범위(core만 / core+detail)는 ADR-104의 매핑 표가 단일 출처다.

### config/study-preferences.json

아침 학습 추천의 사용자 선호와 학습 제약을 담는다.
ADR-069 이후 `current_target`처럼 `state/mvp-target.json`의 현재 타깃을 반복하는 필드는 축소 대상이다.
이 파일을 유지한다면 “추천 철학, 제외할 축, 보조 관심사, 난이도 선호”처럼 타깃 config와 중복되지 않는 값만 남긴다.

`secondary_targets[]` 예시 필드:

```json
{
  "company": "TossPlace",
  "role": "Applied AI Engineer",
  "priority": 2,
  "posting_path": "applications/tossplace/applied-ai-engineer/posting.md",
  "fit_analysis_path": "applications/tossplace/applied-ai-engineer/fit-analysis.md",
  "application_package_path": "applications/tossplace/applied-ai-engineer/application-package.md",
  "review_path": "applications/tossplace/applied-ai-engineer/review.md",
  "study_goal": "string",
  "focus_axes": ["string"],
  "constraints": ["string"]
}
```

보조 트랙은 study-pack 자동 생성이나 fos-study 발행을 의미하지 않는다. agent prompt가 이 값을 읽어 별도 report/runtime 경로에 추천만 생성한다.

## applications/

공고별 지원 에이전트 MVP의 비공개 상태 저장소. 실제 지원 전략, 맞춤 이력서 문구, 제출 상태, 회사별 쿨다운 판단이 들어가므로 git 추적하지 않는다.

### position priority fields

positions-queue는 action stage 중심 priority layer를 포함한다.
이 필드는 회사의 절대 선호 순위가 아니라 "지금 어떤 행동을 할지"를 나타낸다.

기본 action stage:

- `prepare-now`: 바로 지원 준비를 시작한다.
- `investigate`: 공고/회사/요구 역량을 더 확인한다.
- `monitor`: active/open 상태를 유지하며 주기적으로 본다.
- `low-priority`: 가능성은 있으나 지금 준비하지 않는다.
- `hold`: 판단 보류 또는 조건 대기.
- `excluded`: 추천/준비 후보에서 제외한다.

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
    "sourceReportPath": "reports/latest/position-recommendation.md",
    "actionStage": "prepare-now",
    "priorityRank": 1,
    "postingAnalysisPath": "applications/example/backend/posting.md",
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
  `actionStage`와 `priorityRank`를 포함해 stale guard와 fallback projection에 쓴다.
- `userConfirmedPriority`: 사용자가 확정한 priority. LLM refresh가 덮어쓰면 안 된다.

검증 규칙:

- `actionStage`는 기본 enum 중 하나여야 한다.
- `excluded`는 사용자 확정 또는 명확한 정책 사유 없이 자동으로 확정값이 될 수 없다.
- `userConfirmedPriority`가 있으면 application flow는 이 값을 LLM snapshot보다 우선 표시한다.
- `recommendationSnapshot.generatedAt`과 source report path가 없으면 refresh 결과로 취급하지 않는다.
- `prepare-now`에는 `nextAction`과 하나 이상의 `evidenceUrls`가 필요하다.

### state/_priority-history.jsonl

priority 변경 이력을 저장하는 runtime/private audit log다.
한 줄은 하나의 priority 변경 이벤트다.

예시 record:

```json
{
  "eventId": "priority-20260607-kakaopay-001",
  "recordId": "app-kakaopay-ax-202310",
  "recordType": "positions-queue",
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

### priority view projection

`priority_view.ts`는 positions-queue, priority history, application files를 읽어 사람이 볼 요약 row를 계산한다.
이 projection은 파일에 저장되는 새 원장이 아니며, 외부 DB에도 저장하지 않는다.

검증 규칙:

- projection 계산은 career-os 파일을 수정하지 않는다.
- positions-queue file path가 있으면 파일 존재 여부를 직접 확인하고, 없으면 `missing`으로 표시한다.

### interview answer feedback files

면접 답변과 피드백은 별도 웹 DB가 아니라 active `mvp-target`의 `primary.data_root` 아래에 저장한다.

```text
private/<company-slug>/<position-slug>/interview/
├── answers/YYYY-MM-DD.jsonl
└── feedback/YYYY-MM-DD.md
```

규칙:

- `state/mvp-target.json`의 `primary`가 `null`이면 포지션별 답변 피드백 기록은 중단한다.
- 답변 전문과 상세 피드백은 private 경계 안에만 둔다.
- 외부 공유 요약, `sources/fos-study/`, 공개 질문 bank로 답변 원문을 복사하지 않는다.
- 공개 가능한 기술 주제만 별도 `study-pack-writer` 입력 후보가 될 수 있다.

### 디렉터리 구조

```text
applications/
└── <company-slug>/
    └── <role-slug>/
        ├── posting.md
        ├── fit-analysis.md
        ├── application-package.md
        ├── resume-draft.md
        ├── cover-letter.md
        ├── submission-checklist.md
        └── review.md

state/
├── positions-queue.jsonl
└── _priority-history.jsonl
```

TossPlace fixture 예시:

```text
applications/tossplace/applied-ai-engineer/
```

### positions-queue.jsonl record schema

검증 단일 출처: `scripts/application-agent/positions_queue_schema.ts`.

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
  "applicationDir": "applications/tossplace/applied-ai-engineer",
  "postingPath": "applications/tossplace/applied-ai-engineer/posting.md",
  "fitAnalysisPath": "applications/tossplace/applied-ai-engineer/fit-analysis.md",
  "applicationPackagePath": "applications/tossplace/applied-ai-engineer/application-package.md",
  "reviewPath": "applications/tossplace/applied-ai-engineer/review.md",
  "needsUserReview": true,
  "userDecision": "pending",
  "revisionCount": 0,
  "maxRevisionCount": 3,
  "riskFlags": ["existing_positions_queue_record"],
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

### Resume Package Contract

지원 패키지는 전략 문서와 제출용 문서를 분리한다.
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
- `resume-scorecard.md`: 인사 담당자·기술 리더·제출 품질 관점의 반복 채점과 수정 기록. 내부 검토용이며 제출물에 포함하지 않는다.
- `claim-ledger.json`: 제출 문구를 구현·소유권·결과 세 축으로 분해한 근거 원장. 코드·테스트·Git·문서 증거와 안전한 대체 문구를 기록한다.
- `evidence-audit.md`: claim ledger를 사람이 읽을 수 있게 요약한 사실성 감사 결과. 내부 검토용이며 제출물에 포함하지 않는다.
- `cover-letter.md`: 지원동기/자기소개서 초안.
  회사와 공고 맥락을 반영하되 검증되지 않은 성과를 단정하지 않는다.
- `submission-checklist.md`: 수동 제출 전 확인 항목.
  자동 제출이나 외부 사이트 입력을 수행하지 않는다.

선택 파일:

- `resume-metadata.json`: readiness/status 계산을 단순화해야 할 때만 도입한다.
  도입 시 `positions_queue_schema.ts`와 파일 기반 projection 책임을 함께 문서화한다.

생성 문서 품질 계약:

- 내부 분석과 제출용 문구를 분리한다.
- `needs_evidence`는 그대로 두지 않는다.
  `보강 필요 / 선택지 / 권장 행동`으로 바꾼다.

`needs_evidence` resolution loop:

1. 보강이 필요한 주장과 이유를 기록한다.
2. 가능한 선택지를 제시한다.
   예: 삭제, 약화 표현, 사용자에게 근거 요청, private source 재확인.
3. 권장 행동을 하나 고른다.
4. 근거가 확인되기 전에는 제출용 문서에 강한 주장으로 쓰지 않는다.
5. 해결 상태를 `review.md` 또는 선택적 `resume-metadata.json`에 남긴다.

공개 가능한 기술 학습 자료는 이 디렉터리가 아니라 `sources/fos-study/`에 기존 `study-pack-writer` 정책으로만 발행한다.

### Git 추적 정책

루트 `.gitignore`의 `applications/` 규칙 때문에 실제 지원 산출물은 기본적으로 git 추적되지 않는다. 이는 의도된 정책이다. 스키마와 skill 명세만 git 추적하고, 공고별 맞춤 이력서/지원 전략/제출 상태는 로컬 private data로 유지한다.

### application-flow-agent runtime fields

positions-queue record는 optional runtime field를 가진다. 기존 `status`는 큰 흐름을 유지하고, 세부 자율 실행 상태는 `agentPhase` optional 필드로 분리한다. 검증 단일 출처는 `scripts/application-agent/positions_queue_schema.ts`다.

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
  "decisionLogPath": "state/_logs/2026-05-26/application-flow-agent.md"
}
```

`agentPhase` enum:

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

### config/study-pack-topics.json

study-pack-writer와 study-topic-recommender가 읽는 topic override와 fallback topic 파일이다.

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

현행 스키마는 "state/study-pack-candidates.json (ADR-070 이후 active 후보 캐시. ADR-107 config→state 이동)" 섹션을 단일 출처로 참조한다.

### config/question-bank-topics.json

interview-asset-writer가 읽는 question-bank와 master topic override 파일이다.

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

### config/external-reading-sources.json

3개 외부 reading source config 파일 통합본 (`tech-blog-sources`, `ai-topic-sources`, `geek-news-sources`).
`study-topic-recommender`의 보조 읽을거리 추천과 `position-recommender`의 `techBlogSignal` 판단에만 사용한다.
공고 수집 source registry가 아니다.
공고 수집 source 설정은 `config/position-collection.json`과 career-os `live-postings` adapter registry가 소유한다.

```json
{
  "_meta": {
    "purpose": "tech-blog / ai / geek-news external reading reservoir 단일 출처",
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

baseline 분석 대상 core file 목록이다.

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

워크스페이스 secret은 `<ws>/.env`에 둔다. `.env.example`도 같은 위치다.

`career-os/.env` 스키마:

```bash
# fos-study publish용 GitHub API
GITHUB_TOKEN=
GITHUB_REPO_OWNER=jon890
GITHUB_REPO_NAME=fos-study
GITHUB_REPO_BRANCH=main
```

`career-os/.env.example`은 위와 같은 키 + 빈 값. git 추적 ✓.

## state/

### state/study-progress.json (ADR-002; ADR-105 드릴 상태 분리; ADR-107 config→state 이동)

topic 학습 이력과 topic 학습 약점 상태의 단일 출처다.
트리거가 시스템 학습 실행이라 ADR-107로 `state/`로 옮겼다(tracked 유지, negation).
드릴 간격 반복 상태는 `state/drill-progress.json`으로 분리했다(ADR-105).
스키마 정본은 `scripts/interview-drill/drill-engine.ts`의 topic 타입과 실데이터다.

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
      "study_count": "int",
      "last_evaluated": "YYYY-MM-DD | null",
      "status": "string (new | improving | strong | stale | covered-update-existing 등)"
    }
  }
}
```

- `weak_spots`의 이 필드는 topic 학습 상태다. `study-topic-recommender` 학습 흐름이 갱신한다.
- `<topic-key>`는 약점 추적 식별자로 드릴·공부팩과 공유한다(ADR-097).
- 옛 문서에 있던 `question_id`·`shallow_count`·`unknown_count`는 코드·실데이터에 없어 제거했다(ADR-105 drift 정리).

### state/drill-progress.json (ADR-105 신규; ADR-107 config→state 이동)

드릴 간격 반복 상태의 단일 출처다.
트리거가 드릴 실행이라 ADR-107로 `state/`로 옮겼다(tracked 유지, negation).
`tech-interview-drill`·`behavioral-interview-drill`이 공유하는 `scripts/interview-drill/drill-engine.ts`가 읽고 쓴다.
`<topic-key>`는 study-progress와 같은 약점 추적 식별자다.

```json
{
  "<topic-key>": {
    "pass_count": "int",
    "fail_count": "int",
    "next_review_date": "YYYY-MM-DD | null",
    "last_passed": "YYYY-MM-DD | null"
  }
}
```

- `pass_count` / `fail_count`: 답변 통과·실패 누적 횟수.
- `next_review_date`: 다음 복습 예정일 (간격 반복 스케줄, ISO 8601).
- `last_passed`: 마지막 통과 날짜 (ISO 8601, null이면 미통과).
- 신설 시 빈 `{}`로 시작한다. 실데이터에 drill 필드가 0건이라 마이그레이션 데이터 손실이 없다(ADR-105).

### reports/

분석·준비 스킬 실행 산출물. 외부 publish 없음 — 내부 학습용.

| 경로 | 스킬 | 내용 |
|---|---|---|
| `reports/baseline/YYYY-MM-DD/report.md` | legacy `interview-prep-analyzer` baseline | 큐레이션 10파일 + 7섹션 고위험 영역 종합 진단 |
| `reports/daily/YYYY-MM-DD/report.md` | legacy `interview-prep-analyzer` daily | 토픽 1개 3-5파일 + 5섹션 집중 점검 |
| `reports/job-fit-YYYY-MM-DD-<slug>.json` | `job-fit-analyzer` | **정본** JobFitRun(schemaVersion 1, `scripts/job-fit-analyzer/jobfit_schema.ts`). `verdict`(go/no-go)·`careerPath`·`interviewStrategy` 1급, `reinforcement` 부차. `targetRole`(자연어 인자 또는 mvp-target fallback + slug), `nextActions`, `changeSince`(ADR-096) |
| `reports/job-fit-YYYY-MM-DD-<slug>.md` | `job-fit-analyzer` | 위 정본에서 `render_job_fit.ts --format md` 파생 |
| `reports/stage-prep-YYYY-MM-DD.md` | `interview-stage-prep` | 1차/최종/오퍼 단계별 실전 준비 자료 |

baseline 모드는 `config/baseline-core-files.json` 큐레이션 집합 사용.
daily 모드는 토픽 기반 fos-study 파일 선택 + `state/study-progress.json` 갱신.

### state/drill-log-YYYY-MM-DD.jsonl

`tech-interview-drill` / `behavioral-interview-drill` 실행 시 질문별 답변 성과를 누적하는 일별 로그.
같은 날 여러 번 드릴을 돌려도 같은 파일에 append된다.

```json
{
  "date": "YYYY-MM-DD",
  "drill_type": "tech | behavioral",
  "question_id": "string",
  "question_text": "string",
  "answer_summary": "string",
  "score": "pass | shallow | fail | unknown",
  "topics": ["string", "..."],
  "study_pack_dispatched": "boolean"
}
```

- `drill_type`: `tech`(기술 면접)이면 기술 채점 rubric, `behavioral`이면 STAR·가치관 관점 채점 rubric 적용.
- `answer_summary`: 사용자 답변 요약 (1문장).
- `score`: 3단계 채점 결과. `unknown`은 답변 불가 또는 채점 보류.
- `study_pack_dispatched`: `fail`/`shallow` 점수 시 `study-pack-writer`에 비동기 위임 여부.

### state/topic-inventory.json

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

### state/study-topic-candidate-refresh.json

LLM 기반 후보 refresh turn의 실행 기록.
추천기가 고정 seed만 순회하지 않도록, 현재 학습 선호·진행 상태·최근 추천 반복·fos-study inventory를 보고 새 후보를 발굴한 결과를 남긴다.

이 파일은 실행 기록이다.
실제 추천 후보로 쓰는 active 캐시는 `state/study-pack-candidates.json`에 반영한다.

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
    "configPath": "state/study-pack-candidates.json",
    "added": ["string"],
    "updated": ["string"],
    "staled": ["string"]
  }
}
```

동반 markdown인 `state/study-topic-candidate-refresh.md`는 사람이 읽는 요약이다.
외부 공유 요약에는 민감하지 않은 후보 수, 새 후보 예시, 보류 사유만 담는다.

### state/study-pack-candidates.json (ADR-070 이후 active 후보 캐시. ADR-107 config→state 이동)

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

### state/topic-inventory-history.jsonl

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

### state/study-topic-actions/YYYY-MM-DD.json

daily study action callback을 topic 추천 결과와 연결하는 runtime snapshot.
정본 학습 이력이나 추천 pool이 아니라, 해당 날짜 메시지의 버튼을 해석하기 위한 짧은 매핑이다.
`latest.json`은 가장 최근 날짜 파일의 mirror다.

```json
{
  "date": "YYYY-MM-DD",
  "generatedAt": "ISO-8601",
  "markdownPath": "reports/morning-topic-recommendation.md",
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
- 외부 전달 계층이 버튼을 제공한다면 유효시간과 callback 처리를 그 계층에서 정한다.

### state/topic-replenishment.json

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

### reports/morning-topic-recommendation.md

`refresh_topic_inventory.ts` 산출물 (ADR-026). ADR-012의 10픽 + 오늘의 3선 마크다운. 사람이 직접 읽음.

### cache/feed-cache/<sha1>.json (ADR-013)

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

### state/application-agent/eval-cases/

커리어 에이전트가 만든 이력서 문장, 지원 패키지 문장, 리뷰 문장의 안전성을 점검하기 위한 평가 샘플. 현재는 runtime 실험 자산이라 git 추적하지 않는다.

기본 파일:

```text
state/application-agent/eval-cases/resume-package-eval-cases.md
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

### state/application-agent/eval-reports/

`scripts/application-agent/evaluate_cases.ts` 실행 결과. 기본 산출물:

```text
state/application-agent/eval-reports/latest-report.md
state/application-agent/eval-reports/latest-report.json
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

### state/application-agent/package-eval/

실제 지원 패키지 평가 결과. `scripts/application-agent/evaluate_package.ts`가 `application-package.md`와 `review.md`를 읽고, 제출 전 안전 점검 리포트를 쓴다.

기본 산출물:

```text
state/application-agent/package-eval/<company-role>/latest-report.md
state/application-agent/package-eval/<company-role>/latest-report.json
```

`latest-report.json` 주요 필드:

```json
{
  "generatedAt": "2026-06-05T16:49:00.000Z",
  "applicationDir": "applications/tossplace/applied-ai-engineer",
  "overall": "revise",
  "inputs": {
    "packagePath": "applications/tossplace/applied-ai-engineer/application-package.md",
    "reviewPath": "applications/tossplace/applied-ai-engineer/review.md"
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

### private/<company>/<position>/interview/prep.md

회사/면접 단계별 active 준비 정본이다.
`interview-stage-prep` skill은 `state/mvp-target.json`의 `primary.data_root` 아래 `interview/prep.md`를 읽는다.

### cache/locks/

study-pack 등 중복 실행 방지용 flock 파일. 토픽별 `<task>-<topic>.lock`.

### cache/live-position-postings.md

`position-recommender` 수집 단계(`collect_live_postings.ts`)가 추천 분석 전에 갱신하는 active-only 공고 snapshot.
source adapter가 수집한 후보를 공통 validator가 걸러낸 뒤 markdown으로 렌더링한다.

필수 의미 필드:

- `collection_run_id`, `collected_at` — snapshot을 만든 단일 수집 실행과 ISO 8601 시각.
  전체 공고 HTML은 이 값을 표시하며, 같은 실행의 snapshot만 기본 입력으로 허용한다.
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
- `source_diagnostics` — 리포트에 보여줄 source별 짧은 상태와 실패 수.
- `source_errors` — runtime output에 남기는 상세 실패. 한 source 실패는 다른 source 결과를 제거하지 않는다.

source adapter는 official listing, official API, sitemap, keyword search에서 발견한 후보를 import하기 전에 detail page를 fetch하고 active/open evidence를 기록한다.
카카오페이 adapter는 Kakao Careers public API에서 `PROGRESS`, `closeFlag: false`, 정규직과 direct apply URL을 함께 확인한다.
개별 공고 URL은 daily snapshot에서 파생되어야 하며, adapter 코드의 필수 seed로 두지 않는다.
중복 처리는 URL 우선, URL이 불안정한 source는 hash 보조를 사용한다.
Wanted adapter는 백엔드 keyword 외에 AI Agent/RAG/MCP/LLMOps/ML Backend 계열 keyword를 함께 수집할 수 있다.
Toss adapter는 공식 `job-groups` API의 그룹 공고와 하위 포지션을 펼쳐 snapshot에 넣는다.

### reports/daily/YYYY-MM-DD/position-recommendation/recommendation.json (표준 출력 JSON, ADR-101)

`position-recommender` 산출물의 단일 표준 출력. schemaVersion 2, `scripts/position-recommender/recommendation_schema.ts` zod 스키마를 따른다.

- 에이전트가 이 JSON을 생성하고, `render_recommendation.ts`가 Markdown·HTML을 파생한다. 자체 markdown 파서를 거치지 않는다.
- 사람용 14개 라벨 외에 적재용 `source`(수집 adapter 식별자)와 `closeDate`(마감일 문자열 또는 null)를 `PositionItem`(강력·도전 티어)에 둔다(ADR-101).
- `source`·`closeDate`는 수집 snapshot에서 채운다.
- tier 상한(강력 3 / 도전 2 / 보류 3), `linkEvidenceLevel` enum(active/open만), 추천 티어 개별 공고 URL 강제, 강력 추천 `stretchGap` 금지를 스키마가 보장한다.
- 표준 출력 JSON을 호출자가 공개 가능한 공유 요약으로 가공한다.
- 옛 파생 `items.json`은 ADR-101로 폐기됐다.

### reports/latest/position-recommendation.{json,md}

recommendation.json 정본에서 파생하는 사람 읽기용 산출물(mirror).

- `position-recommendation.md` — `render_recommendation.ts --format md` 파생. freshness 가드·기록 호환용.
- 같은 날짜 보존본은 `reports/daily/YYYY-MM-DD/position-recommendation/{recommendation.json,report.md}`.
- HTML은 `reports/downloads/position-recommendation-all-YYYY-MM-DD.html` 하나만 만든다. 추천 공고 섹션과 전체 조건 통과 공고 섹션을 함께 담는다.
- 표시 template 정본은 `scripts/position-recommender/templates/report.html` (스타일만 정의, JSON 데이터 바인딩). 현재 표준 파이프라인은 이 template을 쓰지 않고 `--format html`을 직접 호출할 때만 쓴다.
- template은 실행 자산이므로 별도 데이터 버킷에 두지 않고 ASCII 중심으로 유지한다.

## sources/fos-study/

외부 git 저장소 (jon890/fos-study). career-os가 마크다운만 읽고, study-pack 종류 명령이 commit + push한다.

career-os가 손대지 말아야 할 영역: `.claude/**` (별도 스킬 정의), `.git/**`.
