# Data Schema — career-os

career-os가 다루는 모든 영속 데이터의 스키마와 위치. 새 필드를 추가하거나 새 파일을 도입할 때 이 문서에 같이 갱신한다.

## 디렉터리 한눈에

| 디렉터리 | 역할 | git 추적 |
|---|---|---|
| `.env` (워크스페이스 root) | Discord 채널 ID·GitHub 토큰 등 secret (ADR-021) | ✗ (.gitignore) |
| `.env.example` (워크스페이스 root) | secret 키 템플릿 — git 추적되는 빈 값 가이드 (ADR-021) | ✓ |
| `config/` | 사람이 큐레이션한 입력 (정책·토픽·후보 reservoir) | ✓ |
| `config/study-progress.json` | 후보자 학습 진도 (config/로 이동) | ✓ |
| ~~`data/generated-artifacts.json`~~ | (ADR-033 / plan025로 active 제거 — `sources/fos-study/` 트리가 단일 진실원) | history |
| `data/reports/baseline/YYYY-MM-DD/` | baseline 실행 산출물 (analysis-input, claude.result.json, report.md, fallback.md) | △ 부분적 |
| `data/reports/daily/YYYY-MM-DD/` | daily 실행 산출물 | △ |
| `data/runtime/` | 매 실행 갱신되는 가변 상태 (토픽 풀, 잠금, 피드 캐시) | ✗ (대부분 gitignore) |
| `data/applications/` | 공고별 지원 상태, 맞춤 지원 패키지, evidence/drift review, application digest 입력 (plan029 예정) | ✗ |
| `data/normalized/` | 외부 소스 정규화 캐시 (현재 비어 있음 — fos-study.latest.json 정리됨) | ✗ |
| `data/prep/` | 회사별 hand-crafted 커피챗 준비 자산 (plan021 ADR-029: `docs/prep/` → `data/prep/` 이동) | ✓ |
| `data/source/` | 수집된 외부 노트 | ✗ |
| `logs/` | 실행 로그 (`task-runs.jsonl`, `token-usage.jsonl`) | ✗ |
| `sources/fos-study/` | 외부 동기 저장소 (jon890/fos-study) — git submodule 같은 위치이나 실제로는 별도 clone | ✗ |

## config/

### config/mvp-target.json (현재 타깃 단일 출처)

zod 검증 단일 출처: `career-os/scripts/interview-coffeechat-prep/mvp_target_schema.ts` → `parseMvpTarget(path)` (plan021 ADR-029, audit 후 _shared/lib → skill 내부 이동).

```json
{
  "primary": {
    "company": "string",
    "team": "string",
    "role": "string",
    "interview_date": "YYYY-MM-DD | empty",
    "notes": "string (선택)",
    "coffeechat": {
      "sites": [
        { "key": "string", "url": "string (URL)", "label": "string" }
      ],
      "source_dir": "string (data/source/ 아래 서브 디렉터리명)",
      "report_slug": "string (data/reports/daily/<date>/<slug>/ 경로명)",
      "prep_dir": "string (data/prep/ 아래 서브 디렉터리명)",
      "strategy_filename": "string (default: strategy.md)",
      "checklist_filename": "string (default: checklist.md)"
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

- `primary.interview` — 면접 단계별 4 mode 컨테이너 (ADR-034, plan026).
  - `primary.interview.coffeechat` — 커피챗 mode 객체 (필드: sites, source_dir, report_slug, prep_dir, strategy_filename, checklist_filename).
  - `primary.interview.first_round` — 1차 면접 mode. 활성. 같은 형식.
  - `primary.interview.final_round` — 최종 면접 mode. nullable, 별도 plan에서 활성화.
  - `primary.interview.offer_chat` — 오퍼챗 mode. nullable, 별도 plan에서 활성화.
- 이전 평면 변수 6개 (`coffeechat_skill_dir` 등) → plan021에서 `coffeechat` 객체로 통합. plan026에서 `primary.coffeechat` → `primary.interview.coffeechat` 위치 이동 (ADR-034).

타깃 전환 시 `primary`를 `history` 앞에 push하고 새 `primary`를 채운다.

### config/candidate-profile.md

후보자 이력. 11개 섹션의 prose 마크다운. **JSON이 아닌 의도적 선택** — AI 에이전트가 context로 직접 읽는 자산이라 구조화보다 narrative 가치가 큼. 모든 주장은 `task/**` 또는 `resume/**` 경로 태깅됨 (소스 추적용).

### config/study-preferences.json

아침 학습 추천의 사용자 선호와 타깃 맥락. `current_target`은 `config/mvp-target.json`의 현재 1순위 면접 대비 흐름을 사람이 읽기 쉽게 반복한 값이고, `secondary_targets`는 1순위 대비를 방해하지 않는 보조 학습 트랙을 정의한다.

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

## data/applications/ (planned — plan029)

공고별 지원 에이전트 MVP의 비공개 상태 저장소. 실제 지원 전략, 맞춤 이력서 문구, 제출 상태, 회사별 쿨다운 판단이 들어가므로 git 추적하지 않는다.

### 디렉터리 구조

```text
data/applications/
├── ledger.jsonl
└── <company-slug>/
    └── <role-slug>/
        ├── posting.md
        ├── fit-analysis.md
        ├── application-package.md
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
  "riskFlags": ["toss_group_cooldown"],
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
- `application-package.md`: 맞춤 이력서 bullet, 지원동기, 직무별 강조 포인트.
- `review.md`: evidence guard, drift review, 개인정보/공개 금지 정보, 사용자 승인 필요 항목.

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

writer는 deterministic scan + (가능하면) Claude review 결과를 새 markdown Write 직전에 한 번 더 확인 — 사용자가 직접 topic-key를 지정해 호출하는 경로에도 최종 게이트로 동작.

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

### data/prep/<company-slug>/ (plan021, ADR-029)

커피챗 면접 준비 회사별 hand-crafted 자산. `docs/prep/`에서 이동됨 (ADR-015 정렬 — `docs/`는 의사결정·학습 누적용, 회사 특화 운영 자산은 `data/prep/`).

```
data/prep/
└── <company-slug>/           (예: cj-foodville, nhn-commerce)
    ├── strategy.md            커피챗 전략 노트 — 회사 분석 + 후보자 포지셔닝 힌트
    └── checklist.md           면접 당일 최종 체크리스트
```

- `<company-slug>` = `config/mvp-target.json`의 `primary.interview.<mode>.prep_dir` 값과 일치 (ADR-034, plan026).
- `interview-coffeechat-prep` native skill이 Read. 회사 전환 시 `mvp-target.json`의 `primary.interview.<mode>.prep_dir` 교체 + 새 `data/prep/<new-slug>/` 디렉터리 작성.
- 산출물 (private vs public-safe, ADR-034): `data/reports/daily/YYYY-MM-DD/<report_slug>/{report.md, report-public.md}` 두 파일. private = 후보자 비공개 자료, public-safe = sanitized (개인명·추수 액수·내부 리서치 마스킹).
- git 추적 ✓ — 준비 자산은 히스토리 보존 가치 있음.

### data/runtime/locks/

study-pack 등 중복 실행 방지용 flock 파일. 토픽별 `<task>-<topic>.lock`.

### data/runtime/live-position-postings.md

`position-recommender` daily runner가 Claude 호출 전에 갱신하는 active-only 공고 snapshot.
source adapter가 수집한 후보를 공통 validator가 걸러낸 뒤 markdown으로 렌더링한다.

필수 의미 필드:

- `source` — 수집 adapter 이름. 예: `wanted`, `toss-careers`.
- `link_type` — 추천 입력은 `direct_posting`만 허용.
- `posting_status` — 추천 입력은 `active` 또는 `open`만 허용.
- `active_evidence` — API status, job detail page, apply form 등 active/open 근거.
- `closes_at`, `days_until_close`, `close_urgency` — 마감 판단 정보. 마감이 없으면 `no_deadline`.
- `opened_at` — 값이 있을 때만 출력. 수집되지 않은 경우 `unknown` 문자열을 쓰지 않고 생략한다.

`career_article`, `search_page`, `posting_status: unknown` 항목은 snapshot에서 제외하거나 diagnostics에만 남긴다.

## sources/fos-study/

외부 git 저장소 (jon890/fos-study). career-os가 마크다운만 읽고, study-pack 종류 명령이 commit + push한다.

career-os가 손대지 말아야 할 영역: `.claude/**` (별도 스킬 정의), `.git/**`.

`sources/fos-study/.claude/skills/docs-audit/SKILL.md`는 docs-audit 스킬의 진실 출처이며 `career-os/.claude/skills/docs-audit/`이 실체 디렉터리로 위치함 (내부 SKILL.md만 심링크 유지).
