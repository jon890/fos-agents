# Code Architecture — career-os

career-os의 디렉터리 구조·계층 책임·외부 의존성. 새 스킬·러너를 추가하거나 파이프라인을 바꿀 때 이 문서를 기준으로 한다.

## 계층

```
┌─────────────────────────────────────────────────────────────┐
│ 진입점 (native skill — plan023 dispatcher 폐기 완료, ADR-031)│
│   claude -p "/<skill-name> [args]"                          │
│   - SKILL.md 자동 로드 → Claude 도구 직접 실행              │
│   - 7개: study-pack-writer / interview-asset-writer /       │
│     study-topic-recommender / interview-prep-analyzer /     │
│     candidate-baseline-suggester / interview-coffeechat-    │
│     prep / position-recommender                             │
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
│   ├── hand-off/         외부 위임·인수인계 일회성 노트
│   └── prep/             회사·이벤트별 운영 자산. 이벤트 종료 후 archive
│
├── tasks/                                 ← planning 산출물 (실행 대기 또는 실행 중)
│   └── plan{N}-<kebab-slug>/
│       ├── index.json                    task 메타데이터 + phase 목록 (run-phases.py가 검증)
│       └── phase-NN.md                   각 phase의 자기완결 프롬프트
│   ↑ skills/planning이 생성, skills/plan-and-build가 실행. 완료된 plan도 history 보존 위해 삭제 X.
│
├── config/                                ← 사람이 큐레이션한 입력 (ADR-016 통합 후)
│   ├── mvp-target.json                현재 active 타깃 단일 출처
│   ├── candidate-profile.md           이력 (prose, 의도적으로 JSON 아님)
│   ├── study-pack-topics.json         study-pack namespace (plan017 분리 — study-pack-writer + study-topic-recommender Read)
│   ├── study-pack-candidates.json     study-pack 후보 reservoir (plan017 분리 — study-topic-recommender Read)
│   ├── question-bank-topics.json      question-bank + master namespace (plan017 분리 — interview-asset-writer Read)
│   ├── sources.json                   3 source configs 통합 (plan002)
│   ├── baseline-core-files.json       baseline 분석 대상 파일 목록 (txt → JSON, plan002)
│   ├── topic-file-map.json            daily용 토픽 → 파일
│   ├── live-coding-seed-pool.json
│   ├── live-coding-seed-candidates.json
│   └── .env                           비밀 (GITHUB_TOKEN, DISCORD_WEBHOOK_URL 등)
│
├── data/
│   (study-progress.json은 config/로 이동 — ADR-002)
│   (generated-artifacts.json은 ADR-033 / plan025로 active 제거 — sources/fos-study/ 직접 스캔)
│   ├── reports/
│   │   ├── baseline/YYYY-MM-DD/  baseline 실행 결과
│   │   └── daily/YYYY-MM-DD/     daily / position / foodville 실행 결과
│   ├── runtime/                  ← 가변 상태 (gitignore 대부분)
│   │   ├── topic-inventory.json
│   │   ├── topic-inventory-history.jsonl
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
│   ├── normalized/               fos-study 정규화 캐시 (현재 비어 있음)
│   ├── prep/                     회사별 hand-crafted 준비 자산 (plan021 ADR-029: docs/prep/ → data/prep/ 이동)
│   │   └── <company-slug>/
│   │       ├── strategy.md       커피챗 전략 노트 (회사 특화)
│   │       └── checklist.md      면접 체크리스트 (회사 특화)
│   └── source/                   외부 수집 노트
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
│   │   ├── feed_discovery.ts             ADR-013 RSS/Atom 파서 (ADR-026 Python → TypeScript)
│   │   ├── fos_study_inventory.ts        fos-study 트리 스캔 helper (ADR-033, plan025 신규 — 필요 시 분리)
│   │   └── duplicate_detection.ts        deterministic dedupe helper (ADR-033, plan025 신규 — writer도 참조)
│   (study-topic-recommender: run_*.sh + Python scripts 폐기 완료 — plan016. dispatcher 2 case 폐기. native skill로 진입점 통합)
│   (study-pack-writer + interview-asset-writer scripts 폐기 — plan013/015 native skill로 흡수, .claude/skills/ 트리 참조)
│   ├── position-recommender/
│   │   └── collect_live_postings.ts    source adapter + active validator 기반 live posting 수집기 (ADR-030, ADR-043)
│   ├── application-agent/
│   │   ├── evaluate_cases.ts           runtime eval-case markdown을 pass/revise/blocked로 검증하는 결정적 평가기
│   │   └── evaluate_package.ts         application-package/review 문서를 제출 전 안전 기준으로 점검
│   └── interview-coffeechat-prep/{collect_company_sites.ts}
   (cj-foodville-coffeechat-prep: run_foodville_coffeechat_prep.sh + collect_foodville_sites.py 폐기 — plan021, ADR-029. native skill + ts collector로 대체)
│
├── .claude/skills/                       ← Claude 컨텍스트 자산만 (plan006 후, ADR-019, ADR-002)
│   ├── interview-prep-analyzer/
│   │   └── SKILL.md  (plan017에서 native skill 명세 작성. baseline + daily 자연어 분기, smoke 폐기)
│   ├── study-topic-recommender/
│   │   └── SKILL.md   (plan016에서 native skill 명세로 재작성. references/ 없음)
│   ├── study-pack-writer/{SKILL.md, references/}   (plan013-2에서 native skill 명세로 재작성. plan014에서 옛 maintain-study-pack + bootcamp-batch 기능 흡수)
│   ├── interview-asset-writer/
│   │   ├── SKILL.md   (plan015에서 native skill 명세로 재작성. Q&A 질문 은행 + 마스터 플레이북 두 형식 흡수. 옛 experience-question-bank-writer + interview-master-writer 통합)
│   │   └── references/question-bank-prompt.md
│   ├── position-recommender/
│   │   ├── SKILL.md
│   │   └── references/   company-upside-reference.md, position-context-index.md,
│   │                     position-decision-criteria.md, verified-company-research-targets.json
│   │                     (plan002 이후 config/에서 이동)
│   ├── application-package-writer/          (planned — plan029)
│   │   └── SKILL.md  공고별 fit/gap + 맞춤 지원 패키지 작성
│   ├── application-reviewer/                (planned — plan029)
│   │   └── SKILL.md  evidence/drift/privacy/cooldown 검토
│   ├── daily-application-digest/            (planned — plan029)
│   │   └── SKILL.md  application ledger 기반 daily summary
│   ├── interview-coffeechat-prep/{SKILL.md, references/}
   │   (plan021 ADR-029 rename: cj-foodville-coffeechat-prep → interview-coffeechat-prep. 회사명 박힘 제거)
   │   (plan026 ADR-034: 4 mode 일반화. coffeechat / first-round / final-round / offer-chat. private + public-safe 두 산출물)
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
| `_shared/lib/notify_discord.ts` | Bun. `openclaw message send --channel discord` subprocess. `DISCORD_CHANNEL_ID` env 필수. `--media <path>` 옵션 지원 (ADR-021). | 사용 중 |
| `career-os/scripts/interview-coffeechat-prep/mvp_target_schema.ts` | Bun/zod. `config/mvp-target.json` 스키마 검증 단일 출처. `parseMvpTarget()` + `CoffeechatSchema` (plan021 ADR-029, audit 후 skill 내부로 이동 — ADR-001 엄격 준수). | 사용 중 (career-os 한정) |
| `_shared/bin/update_artifacts.py` | `data/generated-artifacts.json` upsert. | 0 (ADR-033 / plan025 이후 career-os 사용 0 — 파일 자체는 별도 plan에서 폐기 검토) |
| `zod` (npm) | TypeScript runtime 스키마 검증. `package.json`에 의존성. | 사용 중 |
| `_shared/types/` | TS 공통 타입 디렉터리. ClaudeUsage / TaskRunEntry / NotificationPayload 등. | 간접 사용 |

## Native Skill 진입점 패턴 (plan023 dispatcher 폐기 이후)

dispatcher (`run_now.sh` + `run_tracked()`) 폐기 완료 (plan023, ADR-031). 진입점은 native skill 직접 호출.

```bash
# 표준 호출
claude -p "/<skill-name> [args]"

# acceptEdits 권한이 필요한 skill (candidate-baseline-suggester)
claude --permission-mode acceptEdits -p "/candidate-baseline-suggester"

# Discord 알림 (notify_discord.ts 직접 호출)
bun --env-file=career-os/.env _shared/lib/notify_discord.ts "[완료] <message>"
```

각 native skill의 SKILL.md가 알림·자기 검증(self-check) 책임을 직접 담는다.

(옛 bash runner → `track_task.sh` → `claude --print --output-format json` → Python extractor → `claude_persist_usage` → fos-study push 패턴은 plan006~022 기간 레거시. plan023 ADR-031로 career-os에서 완전 제거. apartment는 여전히 `track_task.sh` 사용 중.)

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
│   │   └── chat/               LLM 채팅 UI
│   └── api/
│       ├── auth/               세션 관리 (login/logout)
│       └── chat/               LLM 채팅 API
├── lib/
│   ├── career-os/
│   │   ├── adapter.ts          읽기 전용 파일 어댑터 (CAREER_OS_ROOT 기반)
│   │   └── types.ts            FrontdoorQueueRecord, LedgerRecord 타입
│   └── db/
│       ├── client.ts           MySQL 클라이언트 싱글턴 (Drizzle ORM)
│       └── session.ts          iron-session 세션 헬퍼
├── db/
│   ├── schema.ts               MySQL 스키마 (admin_users, sessions, audit_logs, action_history, llm_chat_*)
│   ├── migrations/             drizzle-kit 생성 마이그레이션 파일
│   └── seed-admin.ts           관리자 계정 초기 생성 스크립트
├── middleware.ts                /dashboard, /api/chat 세션 검증
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

career-os와의 인터페이스:

| 방향 | 방법 | 범위 |
|---|---|---|
| fos-career → career-os | 읽기 전용 파일 마운트 (`CAREER_OS_ROOT`) | frontdoor-queue, ledger, position-recommendation, candidate-profile |
| career-os → fos-career | 없음 | career-os는 fos-career를 참조하지 않는다 |

MVP에서 fos-career가 읽는 career-os 파일:

- `data/runtime/application-agent/frontdoor-queue.jsonl`
- `data/applications/ledger.jsonl`
- `data/runtime/position-recommendation.md`
- `config/candidate-profile.md`

## 변경 시 영향 범위

| 변경 종류 | 같이 갱신해야 할 파일 |
|---|---|
| 새 native skill 추가 | `.claude/skills/<name>/SKILL.md` + `scripts/<name>/` (필요 시) + 본 문서 디렉터리 트리 + `flow.md` 명령별 흐름 + `prd.md` 기능 표 |
| 새 config 추가 | `data-schema.md` config 섹션 + `prd.md` (사용자 가시 자산이면) |
| 새 외부 의존 (`_shared/lib/`) | 본 문서의 외부 의존성 표 + ADR 추가 |

## Planned: application agent MVP (plan029)

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
└── <company-slug>/<role-slug>/{posting,fit-analysis,application-package,review}.md

data/runtime/application-agent/
└── frontdoor-queue.jsonl          # plan038: 사용자 선택 전 추천 후보 queue
```

MVP에서는 제출 자동화를 구현하지 않는다. 브라우저 입력 보조와 최종 제출은 별도 phase 또는 ADR에서 다룬다.

## application-flow-agent runtime (plan031 — phase-01~04 구현 완료)

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
├── frontdoor_queue.ts             # planned plan038: position report -> frontdoor queue
├── promote_frontdoor_candidate.ts # planned plan038: user-approved queue record -> ledger
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

plan030 freshness guard는 구현 대상이 아니라 후보 ingest 시 prerequisite로만 참조한다 (`sourceFreshness` 필드 검증).
