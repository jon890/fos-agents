# Code Architecture — career-os

career-os의 디렉터리 구조·계층 책임·외부 의존성. 새 스킬·러너를 추가하거나 파이프라인을 바꿀 때 이 문서를 기준으로 한다.
작성 규칙은 [`README.md`](README.md)의 Code Architecture 작성 규칙을 따른다.

## 계층

```
┌─────────────────────────────────────────────────────────────┐
│ 진입점 (agent skill — plan023 dispatcher 폐기 완료, ADR-031) │
│   /<skill-name> [args]                                      │
│   - SKILL.md 자동 로드 → 현재 에이전트가 직접 실행          │
│   - .claude/skills 정본 + .codex/skills 심볼릭 링크          │
│   - 12개: study/interview/application/position 계열          │
│   - 특정 CLI runner는 compatibility backend로만 사용         │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────────┐
│ 스킬별 스크립트 (필요 시)                                    │
│   scripts/<skill-name>/*.ts                                 │
│   - 외부 수집기 (collect_*.ts), 인벤토리 갱신               │
│     (refresh_topic_inventory.ts) 등 Bun 실행               │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────────┐
│ 외부 동기 저장소                                              │
│   sources/fos-study/  (jon890/fos-study git repo)            │
│   - study-pack / interview-asset가 commit + push             │
└─────────────────────────────────────────────────────────────┘
```

## 디렉터리 책임

```
career-os/
├── AGENTS.md (= CLAUDE.md 심볼릭 링크)
│     모든 에이전트용 정식 가이드. 워크스페이스 정책·진입점·외부 의존성.
├── docs/                                  ← 5 종합 문서 + 보조 영역
│   ├── prd.md            제품 범위·MVP·기능 목록
│   ├── data-schema.md    config/state/logs 스키마
│   ├── flow.md           사용자/데이터 플로우
│   ├── code-architecture.md  이 문서
│   ├── adr/              아키텍처 결정 개별 파일 + INDEX (ADR-089 파일럿 전환, ai-nodes ADR-015)
│   │   ├── INDEX.md      번호·제목·Status·파일 조망 표
│   │   └── ADR-NNN-slug.md  개별 ADR 파일 (개수는 INDEX.md 참조 — 여기 숫자 고정 안 함)
│   ├── korean-expression-guide.md  career-os 산출물 한국어 표현 가이드
│   ├── hand-off/         외부 위임·인수인계 일회성 노트
│   └── prep/             회사·이벤트별 운영 자산. 이벤트 종료 후 archive
│
├── tasks/                                 ← planning 산출물 (실행 대기 또는 실행 중)
│   └── plan{N}-<kebab-slug>/
│       ├── index.json                    task 메타데이터 + phase 목록 (run-phases.py가 검증)
│       └── phase-NN.md                   각 phase의 자기완결 프롬프트
│   ↑ skills/planning이 생성, skills/plan-and-build가 실행. 완료된 plan도 history 보존 위해 삭제 X.
│
├── config/                                ← 사람이 큐레이션한 정책·타깃·baseline·예외 override (ADR-069)
│   ├── candidate-profile.md           이력 core — 추천·fit 판단용 사실·라벨 (prose, ADR-104)
│   ├── candidate-profile-detail.md    이력 detail — 면접 서사·심화 (ADR-104 신규, Phase 03)
│   ├── study-pack-topics.json         legacy 대량 topic DB. plan068에서 override/seed로 축소 예정
│   ├── question-bank-topics.json      interview-asset topic override 후보. public/question-bank 정본 아님
│   ├── external-reading-sources.json  techBlog/ai/geek 외부 reading reservoir (plan002, ADR-083 이후 공고 source registry와 분리)
│   ├── position-collection.json       position 수집 설정 (wanted jobGroupId + 회사 비종속 role 키워드, ADR-099·ADR-103)
│   ├── verified-company-research-targets.json  검증 회사군 + 회사 키워드 (ADR-090·ADR-103. cooldown은 state/로 분리 ADR-109)
│   ├── candidate-config.json          후보자 구조화 사실 (experienceYears 등, ADR-099. profile.md는 prose)
│   ├── baseline-core-files.json       baseline 분석 대상 파일 목록 (txt → JSON, plan002)
│   ├── study-preferences.json
│   ├── topic-profiles.json
│   ├── resume-design.md
│   ├── live-coding-seed-pool.json
│   ├── live-coding-seed-candidates.json
│   └── .env                           비밀 (GITHUB_TOKEN, DISCORD_WEBHOOK_URL 등)
│   (study-progress·drill-progress·mvp-target·study-pack-candidates는 ADR-107로 state/로 이동)
│
├── state/                                 ← 시스템 실행·이벤트 산물 (ADR-107. 기본 gitignore, 5개 파일만 negation tracked)
│   ├── positions-queue.jsonl        옛 data/applications/ledger.jsonl (ADR-108 rename, Phase 07)
│   ├── _priority-history.jsonl      priority 변경 audit log
│   ├── mvp-target.json              현재 active 타깃 (tracked. 옛 config/)
│   ├── study-progress.json          topic 학습 이력·약점 상태 (tracked. ADR-002·ADR-105)
│   ├── drill-progress.json          드릴 간격 반복 상태 (tracked. ADR-105)
│   ├── study-pack-candidates.json   자동 발굴 active 후보 캐시 + seed/pin (tracked)
│   ├── company-cooldown.json        회사 cooldown (tracked. ADR-109 verified-company에서 분리)
│   ├── topic-inventory.json / topic-inventory-history.jsonl
│   ├── study-topic-candidate-refresh.{json,md} / study-topic-actions/ / topic-replenishment.json
│   ├── drill-log-YYYY-MM-DD.jsonl / behavioral-interview-web-source-scan-*.md
│   ├── source/                      외부 수집 노트. 지원/면접과 연결되면 private by default
│   └── application-agent/
│       ├── eval-cases/ / eval-reports/ / package-eval/   평가 샘플·결과 (gitignore)
│
├── applications/                          ← 공고별 지원 원장과 private 지원 패키지 (ADR-107. gitignore)
│   └── <company-slug>/<role-slug>/{posting,fit-analysis,application-package,resume-draft,cover-letter,submission-checklist,review}.md
│
├── reports/                               ← 사람이 읽는 생성물 (ADR-107. gitignore)
│   ├── baseline/YYYY-MM-DD/          baseline 실행 결과
│   ├── daily/YYYY-MM-DD/             daily / position 실행 결과. 오래된 report는 retention/archive 후보
│   ├── job-fit-*.{json,md} / stage-prep-*.md
│   ├── morning-topic-recommendation.md
│   ├── latest/                      옛 data/runtime mirror (position-recommendation.{md,html})
│   ├── downloads/                   Discord 첨부용 HTML
│   └── prep/                        legacy 회사별 준비 자산. 새 정본은 private/<company>/<position>/interview/prep.md
│
├── cache/                                 ← 재생성 가능한 캐시·transient (ADR-107. gitignore)
│   ├── live-position-postings.md    수집 snapshot
│   ├── feed-cache/<sha1>.json       6h TTL (ADR-013)
│   ├── locks/                       flock 잠금 파일들
│   ├── normalized/                  fos-study 정규화 캐시 (현재 비어 있음)
│   └── freeform-study-pack-topic.json / live-coding-generated-topic.json  (deferred runner용)
│
│   (generated-artifacts.json은 ADR-033 / plan025로 active 제거 — sources/fos-study/ 직접 스캔)
│   (버킷 경계와 archive/retention 기본값은 data-schema.md의 "버킷 경계와 보존 원칙"이 단일 출처)
│   (private/ 는 별도 top-level — 포지션별 작업 홈과 archive. gitignore)
│
├── logs/                                  ← gitignore. 운영 데이터 단일 출처
│   ├── task-runs.jsonl           모든 agent skill 실행 (옛 run_now.sh는 plan023에서 폐기)
│   ├── token-usage.jsonl         (위와 동일 스키마)
│   └── .usage-status/            track_task 임시 상태 파일
│
├── scripts/                              ← 실행 파일 영역 (plan006 후, ADR-019). career-os 한정 컨벤션.
│   (command-router/ 폐기 완료 — plan023, ADR-031. dispatcher case 0개 → 디렉터리 삭제)
│   (knowledge-gap-analyzer/ 폐기 완료 — plan017. baseline/daily/smoke 3 script + Python 6개 제거. interview-prep-analyzer agent skill로 대체)
│   ├── study-topic-recommender/
│   │   ├── refresh_topic_inventory.ts    ADR-009/010/012/013 종합 엔진 (ADR-026 Python → TypeScript). ADR-033 이후 fos-study 직접 스캔
│   │   ├── refresh_candidate_pool.ts      ADR-070 LLM 후보 발굴 + 검증 + config 자동 반영 entrypoint
│   │   ├── send_daily_recommendation.ts  ADR-073 daily lean Discord 메시지 + 버튼 payload 발송
│   │   ├── feed_discovery.ts             ADR-013 RSS/Atom 파서 (ADR-026 Python → TypeScript)
│   │   ├── fos_study_inventory.ts        fos-study 트리 스캔 helper (ADR-033, plan025 신규 — 필요 시 분리)
│   │   └── duplicate_detection.ts        deterministic dedupe helper (ADR-033, plan025 신규 — writer도 참조)
│   (study-topic-recommender: run_*.sh + Python scripts 폐기 완료 — plan016. dispatcher 2 case 폐기. agent skill로 진입점 통합)
│   (study-pack-writer + interview-asset-writer scripts 폐기 — plan013/015 agent skill로 흡수, .claude/skills/ 트리 참조)
│   ├── position-recommender/
│   │   ├── collect_live_postings.ts    CLI 호환 entrypoint (ADR-030, ADR-047)
│   │   ├── recommendation_schema.ts    표준 출력 JSON zod 스키마 (ADR-101, RecommendationRun, source·closeDate 포함)
│   │   ├── render_recommendation.ts    표준 출력 JSON에서 Markdown·HTML 파생 (ADR-101)
│   │   ├── templates/report.html       position daily HTML 표시 template (스타일만, JSON 바인딩)
│   │   └── live-postings/
│   │       ├── types.ts                Posting / SourceAdapter / CollectResult 계약
│   │       ├── policy.ts               수집 가능성 필터. 추천 순위 판단은 하지 않음
│   │       ├── validator.ts            direct active/open posting snapshot boundary
│   │       ├── render.ts               markdown snapshot renderer
│   │       ├── cli.ts                  arg parsing + adapter 실행 + 파일 쓰기
│   │       └── adapters/{index,wanted,toss,coupang-careers,kakaomobility,naver-careers,...}.ts
│   │           source별 listing/detail fetch, entrypoint, known target URL 소유
│   ├── application-agent/
│   │   ├── evaluate_cases.ts           runtime eval-case markdown을 pass/revise/blocked로 검증하는 결정적 평가기
│   │   └── evaluate_package.ts         application-package/review 문서를 제출 전 안전 기준으로 점검
│   ├── interview-prep/
│   │   └── stage_review_html_for_discord.ts  면접 단계 리뷰 HTML 검증 보조
│   ├── interview-drill/                (plan086 신규 — 공용 드릴 엔진, ADR-019 scripts 분리 원칙 준수)
│   │   └── drill-engine.ts             질문 선정(간격 반복) + 채점 + 기록 + 약점 환류 + study-pack 위임
│                                       질문 정본은 public/question-bank(일반) + private/question-bank(개인), ADR-097
│                                       (tech-interview-drill, behavioral-interview-drill 공유 — ADR-031 준수, scripts/_lib 미사용)
│
├── .claude/skills/                       ← agent skill 정본 (plan006 후, ADR-019, ADR-002, ADR-085)
│   ├── job-fit-analyzer/               (ADR-096 의사결정·전략 재정의)
│   │   └── SKILL.md  지원 의사결정 + 면접 전략 + 커리어 패스 정합. 정본 JSON → md 파생
│   │       (실행 자산: scripts/job-fit-analyzer/{jobfit_schema.ts, render_job_fit.ts}, ADR-019 분리)
│   ├── tech-interview-drill/           (plan086 신규)
│   │   └── SKILL.md  매일 기술 면접 답변 연습 + 3단계 채점 + 약점 환류
│   ├── behavioral-interview-drill/     (plan086 신규)
│   │   └── SKILL.md  매일 인성 면접 답변 연습 + STAR·가치관 채점 + 약점 환류
│   ├── interview-stage-prep/           (plan086 신규)
│   │   └── SKILL.md  1차/최종/오퍼 단계별 실전 준비 자료 생성
│   ├── study-topic-recommender/
│   │   └── SKILL.md   (plan016에서 agent skill 명세로 재작성. references/ 없음)
│   ├── study-pack-writer/{SKILL.md, references/}   (plan013-2에서 agent skill 명세로 재작성. plan014에서 옛 maintain-study-pack + bootcamp-batch 기능 흡수)
│   ├── interview-asset-writer/
│   │   ├── SKILL.md   (plan015에서 agent skill 명세로 재작성. Q&A 질문 은행 + 마스터 플레이북 두 형식 흡수. 옛 experience-question-bank-writer + interview-master-writer 통합)
│   │   └── references/question-bank-prompt.md
│   ├── question-bank-collector/
│   │   └── SKILL.md   (일반 backend/CS 질문 bank 수집과 public-safe normalizer)
│   ├── position-recommender/
│   │   ├── SKILL.md
│   │   └── references/   company-upside-reference.md, position-context-index.md,
│   │                     position-decision-criteria.md, verified-company-research-targets.json
│   │                     (plan002 이후 config/에서 이동)
│   ├── application-package-writer/
│   │   └── SKILL.md  공고별 fit/gap + 맞춤 지원 패키지 작성
│   ├── application-reviewer/
│   │   └── SKILL.md  evidence/drift/privacy/cooldown 검토
│   └── daily-application-digest/
│       └── SKILL.md  positions-queue 기반 daily summary
│
├── .codex/skills/                        ← Codex 노출용 심볼릭 링크 (ADR-085)
│   ├── application-package-writer -> ../../.claude/skills/application-package-writer
│   ├── application-reviewer -> ../../.claude/skills/application-reviewer
│   ├── behavioral-interview-drill -> ../../.claude/skills/behavioral-interview-drill  (plan086 신규)
│   ├── daily-application-digest -> ../../.claude/skills/daily-application-digest
│   ├── interview-asset-writer -> ../../.claude/skills/interview-asset-writer
│   ├── interview-stage-prep -> ../../.claude/skills/interview-stage-prep  (plan086 신규)
│   ├── job-fit-analyzer -> ../../.claude/skills/job-fit-analyzer  (plan086 신규)
│   ├── position-recommender -> ../../.claude/skills/position-recommender
│   ├── question-bank-collector -> ../../.claude/skills/question-bank-collector
│   ├── study-pack-writer -> ../../.claude/skills/study-pack-writer
│   ├── study-topic-recommender -> ../../.claude/skills/study-topic-recommender
│   └── tech-interview-drill -> ../../.claude/skills/tech-interview-drill  (plan086 신규)
│
└── sources/
    └── fos-study/                ← 외부 동기 git repo (jon890/fos-study)
        ├── interview/, database/, java/, kafka/, architecture/, ...
        └── (study-pack / interview-asset 산출물이 여기로 push됨)
```

config 설계 원칙:

- config는 전체 자산 목록을 담는 DB가 아니다.
- 학습 문서 목록은 `sources/fos-study/`에서 파생한다.
- 공개 질문 목록은 `public/question-bank/`에서 파생한다.
- config에 남길 것은 현재 타깃, 후보자 baseline, 학습 진행 상태, 외부 reading reservoir, 사람이 고른 pin/override/제외 조건이다.
- 공고 수집 설정은 `config/position-collection.json`과 `scripts/position-recommender/live-postings/` adapter가 소유한다.
- 회사별 탐색 키워드는 `config/verified-company-research-targets.json`이 단일 출처이고, `position-collection.json`은 회사 비종속 role 키워드만 담는다(ADR-103).
- `study-pack-topics.json`, `study-pack-candidates.json`처럼 자산 목록을 복제하는 파일은 plan068에서 reader inventory와 fallback을 확인한 뒤 축소한다.

## 외부 의존성 (`_shared/`)

career-os 워크스페이스 바깥, ai-nodes 루트의 `_shared/` 에 모든 워크스페이스가 공유하는 헬퍼. (ADR-020)

```
~/ai-nodes/
├── package.json                              # Bun 프로젝트 루트
├── tsconfig.json
├── .gitignore                                # node_modules 포함
└── _shared/                                  ← 모든 워크스페이스 공용 코드 (ADR-020)
    ├── bin/                                  ← shell 계열.
    │   ├── track_task.sh                     # 트래커. career-os 사용 0, apartment 사용 중.
    │   └── update_artifacts.py               # career-os 사용 0 (plan025 / ADR-033 이후). 잔존 파일.
    ├── lib/                                  ← TS(Bun) 헬퍼.
    │   ├── notify_discord.ts                 # Discord 알림 (career-os 사용 중)
    │   └── extract_claude_result.ts          # claude JSON envelope 파싱. career-os + apartment + stock-investment 공용 (ai-nodes plan001 통합).
    └── types/                                ← TS 공통 타입.
        └── (ClaudeUsage / TaskRunEntry / NotificationPayload 등)
```

| 파일 | 책임 | career-os 사용 |
|---|---|---|
| `_shared/bin/track_task.sh` | runner 래퍼. JSONL 로그 + openclaw status diff. | 0 (apartment 사용 중) |
| `_shared/lib/extract_claude_result.ts` | claude JSON envelope 파싱. ai-nodes plan001 통합. | 사용 중 (career-os + apartment + stock-investment 공용) |
| `_shared/lib/notify_discord.ts` | Bun. `openclaw message send --channel discord` subprocess. `DISCORD_CHANNEL_ID` env 필수. `--media <path>`, `--presentation <json>` 옵션 지원 (ADR-021, ADR-073). | 사용 중 |
| `_shared/bin/update_artifacts.py` | `data/generated-artifacts.json` upsert. | 0 (ADR-033 / plan025 이후 career-os 사용 0 — 파일 자체는 별도 plan에서 폐기 검토) |
| `zod` (npm) | TypeScript runtime 스키마 검증. `package.json`에 의존성. | 사용 중 |
| `_shared/types/` | TS 공통 타입 디렉터리. ClaudeUsage / TaskRunEntry / NotificationPayload 등. | 간접 사용 |

## Agent Skill 진입점 패턴 (plan023 dispatcher 폐기 이후)

dispatcher (`run_now.sh` + `run_tracked()`) 폐기 완료 (plan023, ADR-031).
진입점은 agent skill 직접 호출이다.
Claude, Codex, Gemini 같은 에이전트는 같은 SKILL.md를 공유한다.
Codex 발견 경로는 `.codex/skills` 심볼릭 링크를 사용한다.

```bash
# 표준 호출
/<skill-name> [args]

# legacy cron/runner는 compatibility backend로만 특정 CLI를 사용할 수 있음
# 사용자-facing 계약은 항상 /<skill-name> [args]

# Discord 알림 (notify_discord.ts 직접 호출)
bun --env-file=career-os/.env _shared/lib/notify_discord.ts "[완료] <message>"

# daily study 추천 버튼 포함 알림
cd career-os
bun --env-file=.env scripts/study-topic-recommender/send_daily_recommendation.ts
```

각 agent skill의 SKILL.md가 알림·자기 검증(self-check) 책임을 직접 담는다.

### SKILL.md 권장 섹션 구성

career-os agent skill의 SKILL.md는 아래 섹션 구성을 권장한다.
강제 템플릿이 아니라 일관성 기준이며, 스킬 성격에 따라 가감한다.

- 호출 후 해석 — 입력·모드·범위 중 스킬에 맞는 이름을 쓴다.
  - 단일 입력은 `호출 후 입력 해석`.
  - 여러 모드로 분기하면 `호출 후 모드 해석`, 범위가 갈리면 `호출 후 범위 해석`.
- Inputs — 읽는 파일과 명령 출력.
- Workflow — 수집·분석·산출·검증 단계.
- Self-check — 산출물 자기 검증. 독립 섹션이면 `## Self-check` 레벨로 둔다.
- Error handling — 입력 부재·실패 시 동작. 표 형태를 권장한다.
- Why this design — 결정 근거. 관련 ADR 번호를 인용한다.
- References — 관련 스킬 cross-ref와 핵심 docs 포인터. ADR 재나열이 아니라 포인터 역할.

질문·검증·금지선처럼 스킬 고유 섹션은 위 구성에 더한다.
public-safe 수집기처럼 단순한 스킬은 일부 섹션을 생략할 수 있다(예: question-bank-collector).

(옛 bash runner → `track_task.sh` → `claude --print --output-format json` → Python extractor → `claude_persist_usage` → fos-study push 패턴은 plan006~022 기간 레거시. plan023 ADR-031로 career-os에서 완전 제거. apartment는 여전히 `track_task.sh` 사용 중.)

## 생성 산출물 품질 경계

LLM이 작성하는 Markdown 산출물은 skill prompt, runner post-validation, reviewer 중 해당 흐름에 존재하는 가장 가까운 계층에서 품질 계약을 확인한다.
계약은 전역 기준이고, resume package만의 특수 규칙이 아니다.

책임:

| 계층 | 책임 |
|---|---|
| agent skill prompt | 한국어 우선 섹션 제목, 자연스러운 한국어 문장, 첫 10줄 안 decision/conclusion/recommended action 요구 |
| runner / processor | 필수 파일 존재, freshness, `needs_evidence` 잔존 여부, 제출용/공개용 파일 경계 검증 |
| reviewer skill | 내부 분석과 제출용 또는 공개용 문구 혼입 여부, evidence/drift/privacy risk 검토 |
| application/reviewer 계층 | private 산출물과 공개용/제출용 산출물을 같은 ready 상태로 섞어 처리하지 않음 |

`needs_evidence`는 저장된 최종 산출물의 상태값으로 방치하지 않는다.
검증 계층은 이를 `보강 필요 / 선택지 / 권장 행동`으로 변환해야 하며, 변환 전에는 제출용 또는 공개용 산출물을 ready 상태로 보지 않는다.

## 인근 워크스페이스와의 관계

- **다른 워크스페이스 자산 참조 금지** — apartment/, stock-investment/, travel/는 별개 격리 영역.
- ai-nodes 루트의 `_shared/bin/`만 모든 워크스페이스가 공유.
- ai-nodes 루트의 `skills/`는 전역 공용 스킬 (`workspace-audit`, `agent-browser`).
- career-os 워크스페이스 audit은 `bash skills/workspace-audit/scripts/run_audit.sh career-os`로 실행. 산출물은 `/tmp/workspace-audit-career-os/`에 stash (영구화 X — 보존 가치는 ADR로 lift).

## 사용자 표면

사람이 보는 표면은 Markdown/HTML 리포트, private position home, positions-queue(옛 application ledger, ADR-108), question bank, Discord 요약이다.

현재 인터페이스:

| 흐름 | 정본 |
|---|---|
| 공고 수집 | `config/position-collection.json`, `scripts/position-recommender/live-postings/`, `cache/live-position-postings.md` |
| 공고 추천 | `recommendation.json` 정본 + Markdown/HTML 파생 |
| 지원 준비 | `state/positions-queue.jsonl` (옛 ledger, ADR-108), `applications/<application-id>/` |
| 면접 준비 | `state/mvp-target.json`, `private/<company>/<position>/interview/prep.md`, drill log |
| 피드백 루프 | closed/rejected 기록, `state/study-progress.json`, `private/question-bank/`, 다음 job-fit report |

원칙:

- 추천 후보 상태와 background outbox를 외부 MySQL에 두지 않는다.
- 흐름은 "추천 → 사용자 선택 → positions-queue 등록"이다(ADR-110로 frontdoor-queue 대기열 폐기, "승격"→"등록").
- HTML report는 읽기용 snapshot이고 action source가 아니다.
- 오래 걸리는 작업은 사용자가 skill을 명시 호출하거나 agent가 현재 세션에서 이어서 실행한다.
- 외부 제출, 로그인, 업로드, 공개 발행은 사용자 승인 없이 실행하지 않는다.

## 변경 시 영향 범위

| 변경 종류 | 같이 갱신해야 할 파일 |
|---|---|
| 새 agent skill 추가 | `.claude/skills/<name>/SKILL.md` + `scripts/<name>/` (필요 시) + 본 문서 디렉터리 트리 + `flow.md` 명령별 흐름 + `prd.md` 기능 표 |
| 새 config 추가 | `data-schema.md` config 섹션 + `prd.md` (사용자 가시 자산이면) |
| 새 외부 의존 (`_shared/lib/`) | 본 문서의 외부 의존성 표 + ADR 추가 |

## application agent MVP (plan029)

plan029는 기존 career-os skill을 새 application 상태 루프로 조립한다.

새 agent skill 후보:

- `application-package-writer`
  - 입력: 공고 URL 또는 `applications/**/posting.md`, `config/candidate-profile.md`, 관련 resume/task 근거.
  - 출력: `fit-analysis.md`, `application-package.md`.
- `application-reviewer`
  - 입력: 공고, fit 분석, 지원 패키지, candidate-profile.
  - 출력: `review.md`, pass/revise/block 판단.
- `daily-application-digest`
  - 입력: `state/positions-queue.jsonl` (옛 `data/applications/ledger.jsonl`, ADR-108), 오늘 변경된 application files, position/study/interview runtime report.
  - 출력: `reports/daily/YYYY-MM-DD/application-digest/report.md` + Discord 요약.

데이터 저장소:

```text
state/
└── positions-queue.jsonl          # 옛 data/applications/ledger.jsonl (ADR-108)

applications/
└── <company-slug>/<role-slug>/{posting,fit-analysis,application-package,resume-draft,cover-letter,submission-checklist,review}.md
```

MVP에서는 제출 자동화를 구현하지 않는다. 브라우저 입력 보조와 최종 제출은 별도 phase 또는 ADR에서 다룬다.

## application-flow-agent runtime (plan031)

plan031은 plan029 agent skill 위에 TypeScript runtime 계층을 추가한다.

```text
scripts/application-agent/
├── run.ts                         # command interface (run-once / run-daily / dry-run / validate / resume / ingest-position-report / report-daily)
├── positions_queue_schema.ts      # positions-queue schema + agentPhase runtime field + transition validator (zod, 옛 ledger_schema.ts, ADR-108)
├── agent_decision_schema.ts       # policy decision object schema (zod)
├── positions_queue_io.ts          # positions-queue read/write helpers (옛 ledger_io.ts, ADR-108)
├── policy.ts                      # deterministic policy decision engine + priority ranker
├── actions.ts                     # allowlisted local artifact generation (checklist / study-actions / profile-suggestions)
├── ingest_position_report.ts      # position report -> candidate positions-queue record
├── skill_executor.ts              # --execute-skills 명시 시 compatibility backend로 agent-only private skills 실행
├── progress_notifier.ts           # --notify-discord 명시 시 private-safe progress 알림
├── skill_contracts.ts             # 에이전트 비종속 skill 호출 계약 + compatibility backend builder
├── safety_gate.ts                 # hard safety gate validator + study action classifier (phase-04)
├── render_decision_log.ts         # decision log renderer + daily digest with public/private separation
└── fixtures/                      # non-sensitive validation fixtures
```

책임 매트릭스 (TypeScript vs LLM):

| 책임 | 담당 |
|---|---|
| 분석, 작성, 리뷰, 추천 근거 생성 | agent skills (LLM) |
| 다음 action 선택 | TypeScript `policy.ts` |
| 상태 전이 허용 여부 판정 | TypeScript `policy.ts` + `positions_queue_schema.ts` validator |
| skill 산출물 존재 검증 후 상태 갱신 | TypeScript `actions.ts` execution gate |
| 명시 옵션에서 compatibility backend 실행 | TypeScript `skill_executor.ts` (`--execute-skills`) |
| 단계별 진행 알림 | TypeScript `progress_notifier.ts` (`--notify-discord`) |
| safety gate 적용 (금지 action 차단) | TypeScript `safety_gate.ts` |
| user gate 적용 (승인 전 정지) | TypeScript `actions.ts` + `skill_contracts.ts` |
| positions-queue schema 검증 | TypeScript `positions_queue_schema.ts` (zod) |
| study action public/private 분류 | TypeScript `safety_gate.ts` (`classifyStudyAction`) |
| 에이전트 비종속 skill 호출 contract 문서화 | TypeScript `skill_contracts.ts` |
| daily digest public/private 분리 렌더링 | TypeScript `render_decision_log.ts` (`renderDailyDigestReport`) |
| stale source 여부 판단 | TypeScript validator (`sourceFreshness` 필드) |
| fit score threshold 판단 | TypeScript `policy.ts` |

`policy.ts` 결정 흐름:

```text
현재 positions-queue records 읽기
  -> actionable candidate 판정 (fit threshold + freshness + cooldown + duplicate)
  -> policy matrix 조회 (status + agentPhase 조합)
  -> 허용된 next action 반환 또는 user gate 발생
  -> safety_gate.ts 검증 (forbidden action / public publish / profile modification 차단)
  -> --notify-discord 명시 시 private-safe progress 알림
  -> --execute-skills 명시 시 agent-only private skill 실행
  -> skill artifact gate 검증 (필수 산출물 없으면 positions-queue 전이 금지)
  -> validator로 전이 허용 여부 최종 확인
  -> agentPhase + status 갱신 + decision log append
```

safety gate 금지 action 목록 (`safety_gate.ts`):

- `submit_application` — 실제 지원 제출 금지 (체크리스트까지만)
- `publish_to_fos_study` 계열 — 공개 발행은 사용자 승인 필수
- `modify_candidate_profile` 계열 — `config/candidate-profile.md` 직접 수정 금지
- `login_to_site` / `automate_site_input` — 외부 사이트 접근 금지
- `send_external_data` / `access_external_account` — 외부 전송/계정 접근 금지

산출물 allowlist (agent가 생성할 수 있는 파일만):

| 파일 | 생성 조건 |
|---|---|
| `{applicationDir}/submission-checklist.md` | `approved` 상태, 수동 제출 안내만 |
| `{applicationDir}/private-study-actions.md` | `generate_study_actions` / `scheduled_retry` |
| `{outputDir}/profile-suggestions-{date}.md` | `interview_prep` + study actions 결정 시 |
| `{outputDir}/reports/daily/{date}/application-agent/digest.md` | `report-daily` 커맨드 |

## resume package flow (plan055)

plan055는 application-agent의 다음 축을 맞춤 이력서 패키지로 둔다.
`application-package.md`는 내부 전략 문서로 유지하고, 제출용 Markdown 초안은 별도 파일로 분리한다.

구성 요소:

- career-os runner: `run.ts resume` 계열 command가 package/review skill 실행 후 산출물 검증을 수행한다.
- skill contract: 생성 문서 품질 계약을 `application-package-writer`와 `application-reviewer` 입력/출력 조건에 반영한다.
- processor post-validation: 실제 파일 존재, freshness, review verdict, `needs_evidence` resolution을 확인한다.
- resume exporter: `export_resume.ts`가 `resume-draft.md`와 `design.md` 계약으로 `resume.html`, `resume.pdf`를 만든다.
- priority/application view helper: readiness를 파일 존재 여부와 positions-queue fields에서 계산한다.

필수 산출물:

```text
applications/<company-slug>/<role-slug>/
├── posting.md
├── fit-analysis.md
├── application-package.md
├── resume-draft.md
├── design.md
├── resume.html
├── resume.pdf
├── cover-letter.md
├── submission-checklist.md
└── review.md
```

상태 경계:

- career-os runner는 positions-queue mutation과 post-validation을 맡는다.
- 외부 제출, 로그인, public publish, candidate-profile mutation은 사용자 승인 없이는 실행하지 않는다.
- PDF export는 로컬 첨부 파일 생성까지만 다룬다.
  채용 사이트 업로드, 전송, 제출 버튼 클릭은 자동화하지 않는다.

plan030 freshness guard는 구현 대상이 아니라 후보 ingest 시 prerequisite로만 참조한다 (`sourceFreshness` 필드 검증).

## Position priority layer (implemented — plan050)

plan050은 새 독립 추천기를 먼저 만들지 않고 기존 collector/recommender/application-agent 자산을 연결하는 얇은 priority layer로 둔다.
이 문단은 파일 기반 priority layer 구조를 설명한다.
별도 DB 없이 positions-queue projection을 사용한다.

책임 경계:

- `scripts/position-recommender/live-postings/`는 active/open 개별 공고와 compact evidence snapshot을 만든다.
  긴 JD 원문 필드는 추천 판단에 필요한 길이로 축약해 LLM 입력과 실행 시간을 줄인다.
  Wanted는 broad scan 외에 선호 회사와 AI 전환 직무 keyword discovery를 수행하고,
  Toss는 공식 `job-groups` API에서 그룹 공고와 하위 포지션을 펼쳐 수집하며,
  Kakao 계열, NAVER 계열, Coupang은 official source entrypoint가 확인된 범위에서 adapter로 수집한다.
  adapter는 listing/API/sitemap root URL은 가질 수 있지만, 개별 공고 URL을 코드에 하드코딩하지 않는다.
- `position-recommender` agent skill은 표준 출력 JSON `recommendation.json`(ADR-101, schemaVersion 2)을 만든다. 적재용 `source`·`closeDate`를 포함하며, Discord 요약 같은 가공은 호출자가 맡는다(ADR-101).
- `scripts/position-recommender/render_recommendation.ts`는 표준 출력 JSON에서 Markdown·HTML을 파생한다(입력 시 zod 검증 내장). 자체 markdown 파서 `render_report_html.ts`는 ADR-101로 폐기됐다.
  표시 구조와 CSS는 `scripts/position-recommender/templates/report.html`에 둔다.
- `scripts/application-agent/`는 positions-queue, 공고별 application files, priority history를 검증하고 갱신한다.
- `config/candidate-profile.md`와 기존 resume/profile material은 fit analysis 입력으로 재사용한다.
- study/interview 관련 agent skill은 gap 기반 preparation action 후보를 만들 때만 호출한다.
- `priority_view.ts`는 id로 positions-queue record를 찾아 recommendation snapshot, fit/gap details, evidence, preparation actions, history를 요약한다.

관련 파일:

```text
scripts/application-agent/
├── priority_schema.ts             # action stage, recommendation snapshot, user confirmed priority schema
├── priority_history.ts            # priority change history append/read helpers
├── priority_recommendation.ts     # position/positions-queue inputs를 recommendation snapshot으로 정리
└── priority_view.ts               # 사람이 읽기 쉬운 priority summary projection

state/
└── _priority-history.jsonl        # user/agent priority change audit log
```

기존 파일 확장 후보:

- `positions_queue_schema.ts` — 등록된 application의 confirmed priority optional fields.
- `policy.ts` — `prepare-now`와 기존 actionable candidate 판단 연결.
- `render_decision_log.ts` — priority change summary 추가.

구현 원칙:

- `userConfirmedPriority`는 LLM refresh path에서 쓰지 않는다.
- `recommendationSnapshot`은 source report, evidence URL, generatedAt을 포함해야 한다.
- `excluded`는 사용자 확정 또는 명확한 정책 사유 없이 자동 확정하지 않는다.
- priority history는 append-only로 운영한다.

## Application agent helper

현재는 career-os 파일과 skill 직접 호출이 정본이다.

로컬 helper:

- `apply_priority_request.ts`
- `apply_position_action_request.ts`
- `priority_request_schema.ts`
- `position_action_request_schema.ts`

이 helper들은 외부 웹 DB 계약이 아니라 JSON request를 검증하고 career-os 파일 원장에 반영하는 compatibility entrypoint다.
사용자가 명시적으로 필요 없다고 판단하면 별도 cleanup pass에서 제거한다.

### Question Bank Collector

`question-bank-collector`는 공개 가능 일반 backend/CS 면접 질문을 `public/question-bank/`에 축적한다.
OpenClaw 자연어 라우팅을 위해 skill description에는 “일반 backend 질문”, “CS 질문 수집”, “면접 질문 bank”, “질문 뱅크 보강”, “약점 기반 질문 재선별” 같은 trigger를 명시한다.

책임:

- fos-study와 public-safe topic seed를 읽어 질문 후보를 만든다.
- 단순 암기형 질문을 backend 실무형 질문으로 정규화한다.
- category, difficulty, intent, answerSignals, source, publicSafe, positionFitHint를 저장한다.
- private 포지션 맥락이 필요한 질문은 `private/<company>/<position>/interview/prep.md` 선별 단계에서만 다룬다.
- 검수된 질문/해설만 `sources/fos-study/`로 재작성해 발행할 수 있다.

파일 기반 연동:

- 사용자는 `/question-bank-collector <topic>`을 직접 호출한다.
- public-safe 질문은 `public/question-bank/`에 저장한다.
- 개인 맞춤 질문은 `private/question-bank/` 또는 `private/<company>/<position>/interview/prep.md`에만 둔다.
- private prep 반영은 별도 후속 흐름으로 분리한다.
