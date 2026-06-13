# Code Architecture — career-os

career-os의 디렉터리 구조·계층 책임·외부 의존성. 새 스킬·러너를 추가하거나 파이프라인을 바꿀 때 이 문서를 기준으로 한다.

## 계층

```
┌─────────────────────────────────────────────────────────────┐
│ 진입점 (native skill — plan023 dispatcher 폐기 완료, ADR-031)│
│   claude -p "/<skill-name> [args]"                          │
│   - SKILL.md 자동 로드 → Claude 도구 직접 실행              │
│   - 6개: study-pack-writer / interview-asset-writer /       │
│     study-topic-recommender / interview-prep-analyzer /     │
│     candidate-baseline-suggester / position-recommender     │
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
│   - .claude/skills/docs-audit/SKILL.md는 진실 출처           │
└─────────────────────────────────────────────────────────────┘
```

## 디렉터리 책임

```
career-os/
├── AGENTS.md (= CLAUDE.md 심볼릭 링크)
│     모든 에이전트용 정식 가이드. 워크스페이스 정책·진입점·외부 의존성.
├── TOOLS.md
│     도구 메모. 짧음.
├── docs/                                  ← 5 종합 문서 + 보조 영역
│   ├── prd.md            제품 범위·MVP·기능 목록
│   ├── data-schema.md    config/logs/runtime 스키마
│   ├── flow.md           사용자/데이터 플로우
│   ├── code-architecture.md  이 문서
│   ├── adr.md            모든 아키텍처 결정 누적 기록 (단일 출처, ADR-015/018)
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
│   ├── mvp-target.json                현재 active 타깃 단일 출처
│   ├── candidate-profile.md           이력 (prose, 의도적으로 JSON 아님)
│   ├── study-pack-topics.json         legacy 대량 topic DB. plan068에서 override/seed로 축소 예정
│   ├── study-pack-candidates.json     자동 발굴 active 후보 캐시 + 사람이 고른 seed/pin. 정본 목록 아님
│   ├── question-bank-topics.json      interview-asset topic override 후보. public/question-bank 정본 아님
│   ├── sources.json                   3 source configs 통합 (plan002)
│   ├── baseline-core-files.json       baseline 분석 대상 파일 목록 (txt → JSON, plan002)
│   ├── topic-file-map.json            legacy daily용 토픽 → 파일. fos-study inventory 기반으로 대체 예정
│   ├── live-coding-seed-pool.json
│   ├── live-coding-seed-candidates.json
│   └── .env                           비밀 (GITHUB_TOKEN, DISCORD_WEBHOOK_URL 등)
│
├── data/
│   (study-progress.json은 config/로 이동 — ADR-002)
│   (generated-artifacts.json은 ADR-033 / plan025로 active 제거 — sources/fos-study/ 직접 스캔)
│   (data 경계와 archive/retention 기본값은 data-schema.md의 "data/ 경계와 보존 원칙"이 단일 출처)
│   ├── reports/
│   │   ├── baseline/YYYY-MM-DD/  baseline 실행 결과
│   │   └── daily/YYYY-MM-DD/     daily / position / foodville 실행 결과. 오래된 generated report는 retention/archive 후보
│   ├── runtime/                  ← 가변 상태 (gitignore 대부분)
│   │   ├── topic-inventory.json
│   │   ├── topic-inventory-history.jsonl
│   │   ├── study-topic-candidate-refresh.json
│   │   ├── study-topic-candidate-refresh.md
│   │   ├── study-topic-actions/YYYY-MM-DD.json
│   │   ├── study-topic-actions/latest.json
│   │   ├── topic-replenishment.json
│   │   ├── morning-topic-recommendation.md
│   │   ├── position-recommendation.md
│   │   ├── application-agent/
│   │   │   ├── eval-cases/           지원 패키지/이력서 문장 평가 샘플 (runtime, gitignore)
│   │   │   ├── eval-reports/         평가 샘플 실행 결과 (runtime, gitignore)
│   │   │   └── package-eval/         실제 지원 패키지 평가 결과 (runtime, gitignore)
│   │   ├── feed-cache/<sha1>.json    6h TTL (ADR-013)
│   │   ├── locks/                    flock 잠금 파일들
│   │   ├── freeform-study-pack-topic.json   (deferred runner용)
│   │   └── live-coding-generated-topic.json (deferred runner용)
│   ├── applications/             data/applications/ — 공고별 지원 원장과 private 지원 패키지. gitignore
│   ├── private/                  private/ — 포지션별 작업 홈과 archive. gitignore
│   ├── normalized/               fos-study 정규화 캐시 (현재 비어 있음)
│   ├── prep/                     legacy 회사별 hand-crafted 준비 자산. 새 dashboard primary asset은 private/<company>/<position>/interview/prep.md
│   └── source/                   data/source/ — 외부 수집 노트. 지원/면접과 연결되면 private by default
│
├── logs/                                  ← gitignore. 운영 데이터 단일 출처
│   ├── task-runs.jsonl           모든 native skill 실행 (옛 run_now.sh는 plan023에서 폐기)
│   ├── token-usage.jsonl         (위와 동일 스키마)
│   └── .usage-status/            track_task 임시 상태 파일
│
├── scripts/                              ← 실행 파일 영역 (plan006 후, ADR-019). career-os 한정 컨벤션.
│   (command-router/ 폐기 완료 — plan023, ADR-031. dispatcher case 0개 → 디렉터리 삭제)
│   (knowledge-gap-analyzer/ 폐기 완료 — plan017. baseline/daily/smoke 3 script + Python 6개 제거. interview-prep-analyzer native skill로 대체)
│   ├── study-topic-recommender/
│   │   ├── refresh_topic_inventory.ts    ADR-009/010/012/013 종합 엔진 (ADR-026 Python → TypeScript). ADR-033 이후 fos-study 직접 스캔
│   │   ├── refresh_candidate_pool.ts      ADR-070 LLM 후보 발굴 + 검증 + config 자동 반영 entrypoint
│   │   ├── send_daily_recommendation.ts  ADR-073 daily lean Discord 메시지 + 버튼 payload 발송
│   │   ├── feed_discovery.ts             ADR-013 RSS/Atom 파서 (ADR-026 Python → TypeScript)
│   │   ├── fos_study_inventory.ts        fos-study 트리 스캔 helper (ADR-033, plan025 신규 — 필요 시 분리)
│   │   └── duplicate_detection.ts        deterministic dedupe helper (ADR-033, plan025 신규 — writer도 참조)
│   (study-topic-recommender: run_*.sh + Python scripts 폐기 완료 — plan016. dispatcher 2 case 폐기. native skill로 진입점 통합)
│   (study-pack-writer + interview-asset-writer scripts 폐기 — plan013/015 native skill로 흡수, .claude/skills/ 트리 참조)
│   ├── position-recommender/
│   │   ├── run_daily_with_claude.ts    daily runner 정본. collect → Claude guard → freshness/active 검증 → frontdoor/priority refresh → Discord 알림
│   │   ├── run_daily_with_claude.sh    기존 cron/수동 호출 호환용 TS runner shim
│   │   ├── collect_live_postings.ts    CLI 호환 entrypoint (ADR-030, ADR-043, ADR-047)
│   │   ├── render_report_html.ts       Markdown 추천 리포트의 HTML 미러 생성
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
│   ├── interview-prep-analyzer/
│   │   ├── collect_interview_sites.ts  first-round/final-round/offer-chat 회사 사이트 수집 (ADR-048)
│   │   └── mvp_target_schema.ts        면접 단계 설정 zod 검증
│
├── .claude/skills/                       ← Claude 컨텍스트 자산만 (plan006 후, ADR-019, ADR-002)
│   ├── interview-prep-analyzer/
│   │   └── SKILL.md  (plan017에서 native skill 명세 작성. plan041에서 first-round/final-round/offer-chat 준비 이관)
│   ├── study-topic-recommender/
│   │   └── SKILL.md   (plan016에서 native skill 명세로 재작성. references/ 없음)
│   ├── study-pack-writer/{SKILL.md, references/}   (plan013-2에서 native skill 명세로 재작성. plan014에서 옛 maintain-study-pack + bootcamp-batch 기능 흡수)
│   ├── interview-asset-writer/
│   │   ├── SKILL.md   (plan015에서 native skill 명세로 재작성. Q&A 질문 은행 + 마스터 플레이북 두 형식 흡수. 옛 experience-question-bank-writer + interview-master-writer 통합)
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
│   ├── daily-application-digest/
│   │   └── SKILL.md  application ledger 기반 daily summary
│   ├── candidate-baseline-suggester/
│   │   └── SKILL.md   (plan020에서 native skill 명세 작성. Append + 주석 마킹 + audit trail. ADR-028)
│   └── docs-audit/
│       └── SKILL.md → sources/fos-study/.claude/skills/docs-audit/SKILL.md (심링크)
│
└── sources/
    └── fos-study/                ← 외부 동기 git repo (jon890/fos-study)
        ├── .claude/skills/docs-audit/SKILL.md  (career-os 측 심링크의 진실 출처)
        ├── interview/, database/, java/, kafka/, architecture/, ...
        └── (study-pack / interview-asset 산출물이 여기로 push됨)
```

config 설계 원칙:

- config는 전체 자산 목록을 담는 DB가 아니다.
- 학습 문서 목록은 `sources/fos-study/`에서 파생한다.
- 공개 질문 목록은 `public/question-bank/`에서 파생한다.
- config에 남길 것은 현재 타깃, 후보자 baseline, 외부 source registry, 학습 진행 상태, 사람이 고른 pin/override/제외 조건이다.
- `study-pack-topics.json`, `study-pack-candidates.json`, `topic-file-map.json`처럼 자산 목록을 복제하는 파일은 plan068에서 reader inventory와 fallback을 확인한 뒤 축소한다.

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
| `career-os/scripts/interview-prep-analyzer/mvp_target_schema.ts` | Bun/zod. `config/mvp-target.json` 면접 단계 설정 검증. `parseMvpTarget()` (ADR-048). | 사용 중 (career-os 한정) |
| `_shared/bin/update_artifacts.py` | `data/generated-artifacts.json` upsert. | 0 (ADR-033 / plan025 이후 career-os 사용 0 — 파일 자체는 별도 plan에서 폐기 검토) |
| `zod` (npm) | TypeScript runtime 스키마 검증. `package.json`에 의존성. | 사용 중 |
| `_shared/types/` | TS 공통 타입 디렉터리. ClaudeUsage / TaskRunEntry / NotificationPayload 등. | 간접 사용 |

## Native Skill 진입점 패턴 (plan023 dispatcher 폐기 이후)

dispatcher (`run_now.sh` + `run_tracked()`) 폐기 완료 (plan023, ADR-031). 진입점은 native skill 직접 호출.

```bash
# 표준 호출
claude -p "/<skill-name> [args]"

# 비대화형 자동 실행 중 쓰기/Bash 승인을 기다리면 멈추는 skill
claude --permission-mode bypassPermissions -p "/study-topic-recommender"

# acceptEdits 권한이 필요한 skill (candidate-baseline-suggester)
claude --permission-mode acceptEdits -p "/candidate-baseline-suggester"

# Discord 알림 (notify_discord.ts 직접 호출)
bun --env-file=career-os/.env _shared/lib/notify_discord.ts "[완료] <message>"

# daily study 추천 버튼 포함 알림
cd career-os
bun --env-file=.env scripts/study-topic-recommender/send_daily_recommendation.ts
```

각 native skill의 SKILL.md가 알림·자기 검증(self-check) 책임을 직접 담는다.

(옛 bash runner → `track_task.sh` → `claude --print --output-format json` → Python extractor → `claude_persist_usage` → fos-study push 패턴은 plan006~022 기간 레거시. plan023 ADR-031로 career-os에서 완전 제거. apartment는 여전히 `track_task.sh` 사용 중.)

## 생성 산출물 품질 경계

LLM이 작성하는 Markdown 산출물은 skill prompt, runner post-validation, reviewer 중 해당 흐름에 존재하는 가장 가까운 계층에서 품질 계약을 확인한다.
계약은 전역 기준이고, resume package만의 특수 규칙이 아니다.

책임:

| 계층 | 책임 |
|---|---|
| native skill prompt | 한국어 우선 섹션 제목, 자연스러운 한국어 문장, 첫 10줄 안 decision/conclusion/recommended action 요구 |
| runner / processor | 필수 파일 존재, freshness, `needs_evidence` 잔존 여부, 제출용/공개용 파일 경계 검증 |
| reviewer skill | 내부 분석과 제출용 또는 공개용 문구 혼입 여부, evidence/drift/privacy risk 검토 |
| fos-career adapter | private 산출물과 공개용/제출용 산출물을 같은 화면에 섞어 action으로 처리하지 않음 |

`needs_evidence`는 저장된 최종 산출물의 상태값으로 방치하지 않는다.
검증 계층은 이를 `보강 필요 / 선택지 / 권장 행동`으로 변환해야 하며, 변환 전에는 제출용 또는 공개용 산출물을 ready 상태로 보지 않는다.

## 인근 워크스페이스와의 관계

- **다른 워크스페이스 자산 참조 금지** — apartment/, stock-investment/, travel/는 별개 격리 영역.
- ai-nodes 루트의 `_shared/bin/`만 모든 워크스페이스가 공유.
- ai-nodes 루트의 `skills/`는 전역 공용 스킬 (`workspace-audit`, `agent-browser`).
- career-os 워크스페이스 audit은 `bash skills/workspace-audit/scripts/run_audit.sh career-os`로 실행. 산출물은 `/tmp/workspace-audit-career-os/`에 stash (영구화 X — 보존 가치는 ADR로 lift).

## Planned: fos-career 웹 대시보드 (plan039)

fos-career는 career-os와 **분리된 저장소**(`~/services/fos-career`)의 독립 프로젝트다.
ai-nodes 모노레포 밖에 위치하며, career-os의 자동화 흐름을 변경하지 않는다.

```text
~/services/fos-career/          ← 별도 git 저장소 (ai-nodes 밖)
├── app/                        Next.js 15 App Router
│   ├── (auth)/login/           관리자 로그인
│   ├── dashboard/
│   │   ├── positions/          frontdoor queue + position recommendation
│   │   ├── applications/       ledger 목록 + 상세
│   │   └── interview/          면접 prep.md, 질문, 답변, 피드백 UI
│   └── api/
│       ├── auth/               세션 관리 (login/logout)
│       ├── priority/           priority pending request
│       ├── positions/          user action pending request
│       └── interview/          면접 답변/피드백 request
├── lib/
│   ├── career-os/
│   │   ├── adapter.ts          읽기 전용 파일 어댑터 (CAREER_OS_ROOT 기반)
│   │   └── types.ts            FrontdoorQueueRecord, LedgerRecord 타입
│   ├── llm/
│   │   ├── types.ts            LLM provider 공통 계약
│   │   ├── provider.ts         LLM_PROVIDER 기반 provider 선택
│   │   └── openai-provider.ts
│   └── db/
│       ├── client.ts           MySQL 클라이언트 싱글턴 (Drizzle ORM)
│       └── session.ts          iron-session 세션 헬퍼
├── db/
│   ├── schema.ts               MySQL 스키마 (admin_users, sessions, audit_logs, action_history, pending request, interview answer/feedback)
│   ├── migrations/             drizzle-kit 생성 마이그레이션 파일
│   └── seed-admin.ts           관리자 계정 초기 생성 스크립트
├── middleware.ts                /dashboard와 보호 API 세션 검증
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

Auth shell 경계:

- 로그인 화면은 독립 랜딩이 아니라 fos-career 관리자 shell의 content 영역으로 보이게 한다.
- 인증 전 shell은 제품명/head/nav 구조를 유지하되, 데이터 메뉴는 disabled 또는 제한 상태로 표시한다.
- 인증 후 `/dashboard/*`는 기존 dashboard layout과 동일한 운영 화면으로 진입한다.
- 로그인 shell 변경은 auth/session 정책 변경이 아니라 UI 구조 변경이다.

career-os와의 인터페이스:

| 방향 | 방법 | 범위 |
|---|---|---|
| fos-career → career-os | 읽기 전용 파일 마운트 (`CAREER_OS_ROOT`) | frontdoor-queue, ledger, position-recommendation, candidate-profile |
| fos-career → career-os write | pending request queue + controlled runner | plan053 priority confirmation, plan055 resume package request status |
| career-os → fos-career | 없음 | career-os는 fos-career를 직접 참조하지 않는다 |

LLM provider 경계:

- 범용 `/dashboard/chat`과 `/api/chat`은 ADR-064로 제거한다.
- `lib/llm/*`는 자유 채팅이 아니라 목적별 evaluator/request processor에서 재사용할 provider 경계다.
- 면접 답변 평가는 `interview/prep.md`, 현재 질문, 사용자 답변, 최근 답변/피드백 요약을 묶은 context bundle로 실행한다.
- `LLM_PROVIDER=openai`는 OpenAI Responses API provider를 사용할 수 있다.
- 새 SDK는 evaluator가 요구하는 구조화 출력 계약을 만족할 때만 추가한다.

MVP에서 fos-career가 읽는 career-os 파일:

- `data/runtime/application-agent/frontdoor-queue.jsonl`
- `data/applications/ledger.jsonl`
- `data/applications/_priority-history.jsonl`
- `data/runtime/position-recommendation.md`
- `config/candidate-profile.md`

Priority write-action bridge:

- fos-career는 MySQL `priority_action_requests`에 사용자 확인 요청을 저장한다.
- web container의 `/data/career-os` mount는 read-only로 유지한다.
- career-os 파일 변경은 writable checkout에서 실행되는 controlled runner만 수행한다.
- runner는 기존 `scripts/application-agent/run.ts confirm-priority` 경로를 재사용한다.
- direct JSONL write, dashboard container writable mount, chat 기반 mutation은 금지한다.
- 적용 결과는 career-os `_priority-history.jsonl`과 fos-career request status 양쪽에서 확인한다.

## 변경 시 영향 범위

| 변경 종류 | 같이 갱신해야 할 파일 |
|---|---|
| 새 native skill 추가 | `.claude/skills/<name>/SKILL.md` + `scripts/<name>/` (필요 시) + 본 문서 디렉터리 트리 + `flow.md` 명령별 흐름 + `prd.md` 기능 표 |
| 새 config 추가 | `data-schema.md` config 섹션 + `prd.md` (사용자 가시 자산이면) |
| 새 외부 의존 (`_shared/lib/`) | 본 문서의 외부 의존성 표 + ADR 추가 |

## application agent MVP (plan029)

plan029는 기존 career-os skill을 새 application 상태 루프로 조립한다.

새 native skill 후보:

- `application-package-writer`
  - 입력: 공고 URL 또는 `data/applications/**/posting.md`, `config/candidate-profile.md`, 관련 resume/task 근거.
  - 출력: `fit-analysis.md`, `application-package.md`.
- `application-reviewer`
  - 입력: 공고, fit 분석, 지원 패키지, candidate-profile.
  - 출력: `review.md`, pass/revise/block 판단.
- `daily-application-digest`
  - 입력: `data/applications/ledger.jsonl`, 오늘 변경된 application files, position/study/interview runtime report.
  - 출력: `data/reports/daily/YYYY-MM-DD/application-digest/report.md` + Discord 요약.

데이터 저장소:

```text
data/applications/
├── ledger.jsonl
└── <company-slug>/<role-slug>/{posting,fit-analysis,application-package,resume-draft,cover-letter,submission-checklist,review}.md

data/runtime/application-agent/
└── frontdoor-queue.jsonl          # plan038: 사용자 선택 전 추천 후보 queue
```

MVP에서는 제출 자동화를 구현하지 않는다. 브라우저 입력 보조와 최종 제출은 별도 phase 또는 ADR에서 다룬다.

## application-flow-agent runtime (plan031)

plan031은 plan029 native skills 위에 TypeScript runtime 계층을 추가한다.

```text
scripts/application-agent/
├── run.ts                         # command interface (run-once / run-daily / dry-run / validate / resume / ingest-position-report / report-daily)
├── ledger_schema.ts               # ledger schema + agentPhase runtime field + transition validator (zod)
├── agent_decision_schema.ts       # policy decision object schema (zod)
├── ledger_io.ts                   # ledger read/write helpers
├── policy.ts                      # deterministic policy decision engine + priority ranker
├── actions.ts                     # allowlisted local artifact generation (checklist / study-actions / profile-suggestions)
├── ingest_position_report.ts      # position report -> candidate ledger
├── frontdoor_queue.ts             # plan038: position report -> frontdoor queue
├── promote_frontdoor_candidate.ts # plan038: user-approved queue record -> ledger
├── skill_executor.ts              # --execute-skills 명시 시 agent-only private native skills 실행
├── progress_notifier.ts           # --notify-discord 명시 시 private-safe progress 알림
├── skill_contracts.ts             # native skill call contracts + CLI command builder (phase-04)
├── safety_gate.ts                 # hard safety gate validator + study action classifier (phase-04)
├── render_decision_log.ts         # decision log renderer + daily digest with public/private separation
└── fixtures/                      # non-sensitive validation fixtures
```

책임 매트릭스 (TypeScript vs LLM):

| 책임 | 담당 |
|---|---|
| 분석, 작성, 리뷰, 추천 근거 생성 | Claude native skills (LLM) |
| 다음 action 선택 | TypeScript `policy.ts` |
| 상태 전이 허용 여부 판정 | TypeScript `policy.ts` + `ledger_schema.ts` validator |
| skill 산출물 존재 검증 후 상태 갱신 | TypeScript `actions.ts` execution gate |
| 명시 옵션에서 native skill 실행 | TypeScript `skill_executor.ts` (`--execute-skills`) |
| 단계별 진행 알림 | TypeScript `progress_notifier.ts` (`--notify-discord`) |
| safety gate 적용 (금지 action 차단) | TypeScript `safety_gate.ts` |
| user gate 적용 (승인 전 정지) | TypeScript `actions.ts` + `skill_contracts.ts` |
| ledger schema 검증 | TypeScript `ledger_schema.ts` (zod) |
| study action public/private 분류 | TypeScript `safety_gate.ts` (`classifyStudyAction`) |
| skill 호출 contract 문서화 | TypeScript `skill_contracts.ts` |
| daily digest public/private 분리 렌더링 | TypeScript `render_decision_log.ts` (`renderDailyDigestReport`) |
| stale source 여부 판단 | TypeScript validator (`sourceFreshness` 필드) |
| fit score threshold 판단 | TypeScript `policy.ts` |

`policy.ts` 결정 흐름:

```text
현재 ledger records 읽기
  -> actionable candidate 판정 (fit threshold + freshness + cooldown + duplicate)
  -> policy matrix 조회 (status + agentPhase 조합)
  -> 허용된 next action 반환 또는 user gate 발생
  -> safety_gate.ts 검증 (forbidden action / public publish / profile modification 차단)
  -> --notify-discord 명시 시 private-safe progress 알림
  -> --execute-skills 명시 시 agent-only private skill 실행
  -> skill artifact gate 검증 (필수 산출물 없으면 ledger 전이 금지)
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
- fos-career adapter/UI: application request status와 readiness를 사람이 볼 수 있게 표시한다.

필수 산출물:

```text
data/applications/<company-slug>/<role-slug>/
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

- fos-career는 request row와 status projection을 보여준다.
- career-os runner는 ledger mutation과 post-validation을 맡는다.
- 외부 제출, 로그인, public publish, candidate-profile mutation은 사용자 승인 없이는 실행하지 않는다.
- PDF export는 로컬 첨부 파일 생성까지만 다룬다.
  채용 사이트 업로드, 전송, 제출 버튼 클릭은 자동화하지 않는다.

plan030 freshness guard는 구현 대상이 아니라 후보 ingest 시 prerequisite로만 참조한다 (`sourceFreshness` 필드 검증).

## Position priority layer (implemented — plan050)

plan050은 새 독립 추천기를 먼저 만들지 않고 기존 collector/recommender/application-agent 자산을 연결하는 얇은 priority layer로 둔다.

책임 경계:

- `scripts/position-recommender/live-postings/`는 active/open 개별 공고와 compact evidence snapshot을 만든다.
  긴 JD 원문 필드는 추천 판단에 필요한 길이로 축약해 LLM 입력과 실행 시간을 줄인다.
  Wanted는 broad scan 외에 선호 회사와 AI 전환 직무 keyword discovery를 수행하고,
  Toss는 공식 `job-groups` API에서 그룹 공고와 하위 포지션을 펼쳐 수집하며,
  Kakao 계열, NAVER 계열, Coupang은 official source entrypoint가 확인된 범위에서 adapter로 수집한다.
  adapter는 listing/API/sitemap root URL은 가질 수 있지만, 개별 공고 URL을 코드에 하드코딩하지 않는다.
- `position-recommender` native skill은 LLM recommendation snapshot 초안을 만든다.
- `scripts/position-recommender/render_report_html.ts`는 daily runner의 post-process로 Markdown 리포트를 HTML 미러로 변환한다.
- `scripts/application-agent/`는 frontdoor queue, ledger, 공고별 application files, priority history를 검증하고 갱신한다.
- `config/candidate-profile.md`와 기존 resume/profile material은 fit analysis 입력으로 재사용한다.
- study/interview 관련 native skill은 gap 기반 preparation action 후보를 만들 때만 호출한다.
- fos-career는 priority fields와 history를 읽기 전용으로 표시한다.
  list route는 action stage filter와 scan에 집중하고, detail route는 record type과 id로 frontdoor queue 또는 ledger record를 찾아 recommendation snapshot, fit/gap details, evidence, preparation actions, history를 보여준다.

관련 파일:

```text
scripts/application-agent/
├── priority_schema.ts             # action stage, recommendation snapshot, user confirmed priority schema
├── priority_history.ts            # priority change history append/read helpers
├── priority_recommendation.ts     # position/frontdoor/ledger inputs를 recommendation snapshot으로 정리
└── priority_dashboard_view.ts     # dashboard가 읽기 쉬운 summary projection

data/applications/
└── _priority-history.jsonl        # user/agent priority change audit log
```

기존 파일 확장 후보:

- `frontdoor_queue_schema.ts` — action stage와 recommendation snapshot optional fields.
- `ledger_schema.ts` — promoted application의 confirmed priority optional fields.
- `policy.ts` — `prepare-now`와 기존 actionable candidate 판단 연결.
- `render_decision_log.ts` — priority change summary 추가.

구현 원칙:

- `userConfirmedPriority`는 LLM refresh path에서 쓰지 않는다.
- `recommendationSnapshot`은 source report, evidence URL, generatedAt을 포함해야 한다.
- `excluded`는 사용자 확정 또는 명확한 정책 사유 없이 자동 확정하지 않는다.
- priority history는 append-only로 운영한다.

## Priority write-action bridge (plan053)

plan053은 priority confirmation write를 dashboard 직접 쓰기가 아니라 queue-based bridge로 둔다.

구성 요소:

- fos-career API: authenticated admin request를 받아 `priority_action_requests` row를 만든다.
- fos-career UI: detail 화면에서 stage/rank/reason을 확인하고 pending status를 보여준다.
- fos-career host-side processor: pending request를 JSON으로 넘기고 결과 status를 fos-career DB에 반영한다.
- career-os applier: request snapshot을 검증한 뒤 기존 `confirm-priority` helper로 적용한다.
- audit: fos-career `audit_logs`, fos-career `priority_action_requests`, career-os `_priority-history.jsonl`을 함께 본다.

관련 파일:

```text
career-os/scripts/application-agent/apply_priority_request.ts
career-os/scripts/application-agent/priority_request_schema.ts
career-os/scripts/application-agent/run.ts
```

거절한 대안:

- career-os를 HTTP API service로 띄우기.
  인증, 네트워크 노출, long-running service 운영 비용이 MVP보다 크다.
- dashboard container에 writable career-os mount를 주기.
  기존 read-only 안전 경계를 깨고 UI bug가 곧 data corruption으로 이어질 수 있다.
- fos-career가 `frontdoor-queue.jsonl`과 `ledger.jsonl`을 직접 수정하기.
  career-os schema validation과 priority history helper를 우회한다.
- LLM chat이 tool call로 priority를 변경하기.
  사용자 확인, idempotency, rollback 검증이 불명확하다.

## fos-career application workbench (plan054)

plan054는 fos-career의 다음 제품 축을 application workbench로 둔다.
기존 priority/list/detail projection을 재사용하되, 화면의 중심을 "공고가 수집됐는가"에서 "지원 준비가 어디까지 됐고 다음 행동이 무엇인가"로 옮긴다.

구성 요소:

- fos-career adapter: frontdoor queue, ledger, priority history, application files를 읽어 workbench projection을 만든다.
- applications list UI: stage/status/readiness/next action/blocker를 스캔 가능한 행 단위로 표시한다.
- application detail UI: posting, fit analysis, application package, review 파일 존재 여부와 준비 상태를 우선 보여준다.
- career-os automation: 실제 산출물 생성과 원장 mutation은 기존 agent/task 흐름 또는 plan053 safe bridge가 맡는다.

관련 fos-career 파일:

```text
/home/bifos/services/fos-career/app/dashboard/applications/page.tsx
/home/bifos/services/fos-career/app/dashboard/applications/[id]/page.tsx
/home/bifos/services/fos-career/lib/career-os/adapter.ts
/home/bifos/services/fos-career/lib/career-os/types.ts
```

구현 원칙:

- fos-career MySQL에 새 상태 원장을 만들지 않고, MVP는 read-only projection으로 시작한다.
- readiness는 파일 존재 여부와 ledger/frontdoor fields에서 계산한다.
- 외부 제출, 공개 발행, candidate-profile mutation은 workbench 밖의 별도 승인 흐름으로 유지한다.
- action button이 필요하면 plan053처럼 pending request bridge를 먼저 설계한다.

## 공고 상태 사용자 액션 (plan059 예정)

plan059는 application workbench에 `보류`, `제외`, `지원 준비` 버튼을 추가한다.
이 버튼은 UI convenience가 아니라 사용자의 명시 의사결정을 request로 보존하는 write boundary다.

구성 요소:

- fos-career UI: application/detail 화면에서 공고별 상태 액션 버튼과 optional reason 입력을 제공한다.
- fos-career API: authenticated admin request를 받아 `user_position_action_requests` row를 만든다.
- fos-career processor: pending request를 읽고 stale guard를 수행한 뒤 career-os runner를 호출한다.
- career-os runner: frontdoor/ledger record에 action stage를 반영하고, `지원 준비`는 ledger 승격과 이력서 패키지 생성으로 이어간다.
- audit: fos-career `audit_logs`, `user_position_action_requests`, career-os priority/application history를 함께 본다.
- processor 운영 진입점은 host-side wrapper다.
  web container는 career-os를 read-only mount로 유지하고, host-side wrapper가 writable checkout과 host-published MySQL port를 사용한다.

액션 매핑:

- `보류` -> `hold`
- `제외` -> `excluded`
- `지원 준비` -> `prepare_application`

구현 원칙:

- reason은 optional이지만 request에는 `effectiveReason`을 항상 저장한다.
- dashboard container는 career-os 파일을 직접 쓰지 않는다.
- `지원 준비`는 내부 산출물 생성까지 진행한다.
  외부 제출, 업로드, 로그인, 공개 발행은 하지 않는다.

## CJ푸드빌 면접 skill request gateway (plan060 예정)

plan060은 fos-career dashboard의 면접 준비 hub와 career-os native skill 실행 사이에 request gateway를 둔다.
dashboard는 CJ푸드빌 2026-06-15 면접 준비 상태를 보여주지만, career-os skill을 직접 실행하지 않는다.

구성 요소:

- fos-career hub adapter: career-os read-only mount에서 target, prep, report, fos-study 관련 경로를 읽어 projection을 만든다.
- fos-career API: authenticated admin request를 받아 `interview_skill_requests` row를 만든다.
- fos-career interview session store: CJ푸드빌 2026-06-15 면접모드의 active/read-only/archive 상태를 관리한다.
- fos-career answer practice UI: 기본 5턴 세션, 자유형 연장, 질문 생성/선택, 답변 textarea, 피드백, 꼬리질문, 최종 요약/보완 주제/study-pack 후보를 제공한다.
  긴 질문 가독성을 위해 질문 후보는 `<select>`가 아니라 버튼 목록과 readonly textarea 조합으로 표시하고, 제출값은 hidden `questionText`로 유지한다.
- fos-career answer store: 답변 전문과 상세 피드백을 private DB record로 저장해 dashboard에서 바로 보여준다.
- fos-career scoring model: 기술 정확성, 경험 연결, 답변 구조, CJ푸드빌 맥락 반영 점수를 저장하고 표시한다.
  너무 짧거나 의미 있는 기술·경험 신호가 없는 답변은 강점 없이 insufficient feedback과 1/5 점수로 저장한다.
- fos-career LLM evaluator: guard를 통과한 `answer_feedback` request에 대해 `prep.md`, 현재 질문, 사용자 답변, 최근 답변/피드백 요약, 정리된 주제, 포지션 맥락을 context bundle로 묶고 OpenAI provider를 통해 strict JSON feedback을 생성한다.
  꼬리질문 생성 여부와 꼬리질문 내용은 evaluator가 판단한다.
- fos-career processor: pending request를 읽고 allowlist와 stale guard를 확인한 뒤 career-os native skill을 호출한다.
- career-os native skills: 기존 `interview-prep-analyzer`, `interview-asset-writer`, `study-pack-writer`를 재사용한다.
- audit: fos-career `audit_logs`와 request row에는 상태, 경로, 짧은 요약만 남긴다.

허용 command family:

```text
claude -p "/interview-prep-analyzer first-round"
claude -p "/interview-asset-writer <topic>"
claude -p "/study-pack-writer <public-safe-topic>"
```

구현 원칙:

- 새 career-os skill이나 script를 만들지 않고 기존 native skill을 먼저 연결한다.
- dashboard container의 `/data/career-os` mount는 read-only로 유지한다.
- processor는 writable checkout에서만 skill을 실행한다.
- `study-pack-writer` 요청은 기존 방식처럼 `sources/fos-study/`에 `[초안]` 제목의 공부팩을 만들고 commit/push까지 수행한다.
- request/result payload와 audit log에는 private 문서 본문, 면접 답변 전문, 상세 피드백, command stdout 전체를 저장하지 않는다.
- 사용자가 textarea에 입력한 답변 전문과 processor가 만든 상세 피드백은 private answer/session DB에 저장한다.
  dashboard에서 바로 조회 가능해야 하며, audit log, Discord, fos-study로 복사하지 않는다.
- answer feedback은 private dashboard 기능이며 답변의 강점, 리스크, 권장 수정 방향, 점수, 꼬리질문, 보완 주제, study-pack 후보를 제공한다.
- LLM evaluator는 외부 사이트 접근, fos-study 발행, candidate-profile mutation, 지원서 제출을 수행하지 않는다.
  timeout, 설정 오류, JSON parse 실패는 deterministic fallback으로 처리한다.
- study-pack request는 고정 추천 후보와 사용자 자연어 요청을 모두 받는다.
  사용자가 인터뷰 중 특정 주제를 정말 모르겠다고 느끼면 해당 turn에서 직접 요청할 수 있다.
- 2026-06-15 CJ푸드빌 면접 종료 후 해당 면접모드는 read-only/archive 상태로 전환한다.
  archive 상태에서는 새 질문/답변/feedback request를 만들지 않는다.
- study pack은 공개 가능한 순수 기술 주제만 허용한다.
- 외부 제출, 공개 발행, 로그인, 업로드, candidate-profile 자동 수정은 forbidden action이다.
- implementation phase에서 docs/ADR/정책 문서 수정이 필요해지면 구현하지 말고 `PHASE_BLOCKED`로 보고한다.

### Question Bank Collector

`question-bank-collector`는 공개 가능 일반 backend/CS 면접 질문을 `public/question-bank/`에 축적한다.
OpenClaw 자연어 라우팅을 위해 skill description에는 “일반 backend 질문”, “CS 질문 수집”, “면접 질문 bank”, “질문 뱅크 보강”, “약점 기반 질문 재선별” 같은 trigger를 명시한다.

책임:

- fos-study와 public-safe topic seed를 읽어 질문 후보를 만든다.
- 단순 암기형 질문을 backend 실무형 질문으로 정규화한다.
- category, difficulty, intent, answerSignals, source, publicSafe, positionFitHint를 저장한다.
- private 포지션 맥락이 필요한 질문은 `private/<company>/<position>/interview/prep.md` 선별 단계에서만 다룬다.
- 검수된 질문/해설만 `sources/fos-study/`로 재작성해 발행할 수 있다.

fos-career 연동:

- 면접 hub는 `question_bank_refresh` request를 만든다.
- processor는 host-side career-os checkout에서 `question-bank-collector`를 실행한다.
- dashboard container는 `claude`를 직접 실행하지 않는다.
- private prep 반영은 별도 후속 흐름으로 분리한다.
