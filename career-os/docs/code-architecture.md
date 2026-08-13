# Code Architecture — career-os

career-os의 디렉터리 구조·계층 책임·외부 의존성. 새 스킬·러너를 추가하거나 파이프라인을 바꿀 때 이 문서를 기준으로 한다.
작성 규칙은 [`README.md`](README.md)의 Code Architecture 작성 규칙을 따른다.

## 계층

```
┌─────────────────────────────────────────────────────────────┐
│ 진입점 (agent skill)                                        │
│   /<skill-name> [args]                                      │
│   - SKILL.md 자동 로드 → 현재 에이전트가 직접 실행          │
│   - .claude/skills 정본 + .codex/skills 심볼릭 링크          │
│   - study/interview/application/position/resume 계열         │
│   - compatibility backend는 내부 구현 세부사항               │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────────┐
│ 스킬별 스크립트 (필요 시)                                    │
│   scripts/<skill-name>/*.ts                                 │
│   - 외부 수집기와 리포트 생성기 등 Bun 실행                  │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────────┐
│ 외부 동기 저장소                                              │
│   sources/fos-study/  (jon890/fos-study git repo)            │
│   - 추천 모델이 실제 학습 이력을 읽는 입력                    │
└─────────────────────────────────────────────────────────────┘
```

## 디렉터리 책임

```
career-os/
├── AGENTS.md (= CLAUDE.md 심볼릭 링크)
│     모든 에이전트용 정식 가이드. 워크스페이스 정책·진입점·외부 의존성.
├── .env                                    비밀 값 (gitignore)
├── docs/                                  ← 5 종합 문서 + 보조 영역
│   ├── prd.md            제품 가치·skill 자산·성공 기준
│   ├── data-schema.md    config/state/logs 스키마
│   ├── flow.md           사용자/데이터 플로우
│   ├── code-architecture.md  이 문서
│   ├── adr/              아키텍처 결정 개별 파일 + INDEX
│   │   ├── INDEX.md      번호·제목·Status·파일 조망 표
│   │   └── ADR-NNN-slug.md  개별 ADR 파일 (개수는 INDEX.md 참조 — 여기 숫자 고정 안 함)
│   ├── hand-off/         외부 위임·인수인계 일회성 노트
│   └── prep/             회사·이벤트별 운영 자산. 이벤트 종료 후 archive
│
├── config/                                ← 사람이 큐레이션한 정책·baseline·예외 override
│   ├── candidate-profile.md           후보자 기준과 최신 경력 자료 진입점
│   ├── question-bank-topics.json      interview-asset topic override 후보. public/question-bank 정본 아님
│   ├── external-reading-sources.ts    기술 블로그와 개발 동향 수집 대상
│   ├── position-collection.ts         공고 소스와 어댑터 수집 설정
│   ├── verified-company-research-targets.json  검증 회사군 + 회사 키워드 (ADR-090·ADR-103. cooldown은 state/로 분리 ADR-109)
│   ├── current-target.example.json    로컬 현재 지원 대상 예시
│   ├── position-filters.json          제외 회사와 억제 공고 URL
│   ├── resume-design.md
│   └── 기타 skill별 정책과 예외
│
├── state/                                 ← 시스템 실행·이벤트 산물
│   ├── positions-queue.jsonl        지원 후보 상태 큐
│   ├── _priority-history.jsonl      priority 변경 audit log
│   ├── current-target.json          현재 지원 대상 하나를 담는 로컬 상태
│   ├── drill-progress.json          답변 연습의 간격 반복 상태
│   ├── company-cooldown.json        회사 cooldown (tracked. ADR-109 verified-company에서 분리)
│   ├── morning-reading.json / morning-reading-history.jsonl
│   ├── reading-candidates.json      외부 소스에서 수집한 글의 실행 스냅샷
│   ├── drill-log-YYYY-MM-DD.jsonl / behavioral-interview-web-source-scan-*.md
│   ├── source/                      외부 수집 노트. 지원/면접과 연결되면 private by default
│   └── application-agent/
│       ├── eval-cases/ / eval-reports/ / package-eval/   평가 샘플·결과 (gitignore)
│
├── applications/                          ← 공고별 지원 상태와 private 지원 패키지
│   └── <company-slug>/<role-slug>/{posting,fit-analysis,application-package,resume-draft,cover-letter,submission-checklist,review}.md
│
├── reports/                               ← 사람이 읽는 생성물
│   ├── baseline/YYYY-MM-DD/          baseline 실행 결과
│   ├── daily/YYYY-MM-DD/             daily / position 실행 결과. 오래된 report는 retention/archive 후보
│   ├── job-fit-*.{json,md} / stage-prep-*.md
│   ├── morning-reading.md
│   ├── latest/                      position-recommendation.{json,md} mirror
│   ├── downloads/                   외부 게시 준비용 HTML
│   └── prep/                        legacy 회사별 준비 자산. 새 정본은 private/<company>/<position>/interview/prep.md
│
├── cache/                                 ← 재생성 가능한 캐시·transient
│   ├── live-position-postings.md    수집 snapshot
│   ├── feed-cache/<sha1>.json       6h TTL (ADR-013)
│   ├── locks/                       flock 잠금 파일들
│   ├── normalized/                  fos-study 정규화 캐시 (현재 비어 있음)
│   └── 기타 임시 topic 컨테이너
│
│   (버킷 경계와 archive/retention 기본값은 data-schema.md의 "버킷 경계와 보존 원칙"이 단일 출처)
│   (private/ 는 별도 top-level — 포지션별 작업 홈과 archive. gitignore)
│
├── logs/                                  ← gitignore. 운영 지표와 평가 로그
│   └── position-metrics.jsonl      공고 수집·추천 지표 시계열
│
├── scripts/                              ← 실행 파일 영역. career-os 한정 컨벤션.
│   ├── study-topic-recommender/
│   │   ├── build_morning_reading.ts      공개 실행 진입점
│   │   ├── morning_reading_cli.ts        수집·선별·리포트 단계 조립
│   │   ├── manage_reading_sources.ts     외부 읽을거리 조회·검증·추가 초안
│   │   ├── render_source_catalog.ts       등록 소스와 원문 추적성 신뢰도 HTML 생성
│   │   ├── validate_outputs.ts            추천 산출물과 공개 범위 검증
│   │   ├── reading_contracts.ts           Zod 스키마, 타입, 허용 상수
│   │   ├── reading_sources.ts             정적 소스 설정 검증과 정규화
│   │   ├── reading_candidate_pool.ts      전체 소스 후보 수집과 풀 검증
│   │   ├── reading_selection.ts           모델 선택 검증과 추천 변환
│   │   ├── reading_stage.ts               수집 결과 준비와 모델 선택 적용
│   │   ├── source/adapters/               feed/page 수집 어댑터와 레지스트리
│   │   ├── source/feed.ts                 RSS/Atom 파싱과 캐시
│   │   ├── persistence/history.ts         최근 추천 URL 이력
│   │   ├── render/{markdown,html,report}.ts
│   │   │                                   같은 추천 정본의 표시 변환
│   ├── position-recommender/
│   │   ├── collect_live_postings.ts    공고 수집 entrypoint (ADR-030, ADR-047)
│   │   ├── recommendation_schema.ts    표준 출력 JSON zod 스키마 (ADR-101, RecommendationRun, source·closeDate 포함)
│   │   ├── render_recommendation.ts    표준 출력 JSON에서 Markdown·HTML 파생 (ADR-101)
│   │   ├── render_candidate_preview.ts 전체 active 공고 HTML 파생
│   │   ├── record_metrics.ts          수집·추천 지표 append
│   │   ├── templates/report.html       position daily HTML 표시 template (스타일만, JSON 바인딩)
│   │   └── live-postings/
│   │       ├── types.ts                Posting / SourceAdapter / CollectResult 계약
│   │       ├── policy.ts               수집 가능성 필터. 추천 순위 판단은 하지 않음
│   │       ├── validator.ts            direct active/open posting snapshot boundary
│   │       ├── render.ts               markdown snapshot renderer
│   │       ├── cli.ts                  arg parsing + adapter 실행 + 파일 쓰기
│   │       └── adapters/{index,wanted,toss,coupang-careers,kakaobank-careers,kakaomobility,kurly-careers,naver-careers,...}.ts
│   │           source별 listing/detail fetch, entrypoint, known target URL 소유
│   ├── application-agent/
│   │   ├── run.ts, policy.ts, actions.ts, safety_gate.ts
│   │   ├── positions_queue_schema.ts, positions_queue_io.ts
│   │   ├── priority_*.ts, apply_*_request.ts
│   │   ├── skill_contracts.ts, skill_executor.ts
│   │   ├── render_decision_log.ts, ingest_position_report.ts
│   │   └── evaluate_cases.ts, evaluate_package.ts, export_resume.ts
│   ├── interview-prep/
│   │   └── 면접 단계 리뷰 HTML 검증 보조
│   ├── interview-drill/
│   │   └── drill-engine.ts             질문 선정(간격 반복) + 채점 + 기록 + 약점 환류
│                                       질문 정본은 public/question-bank(일반) + private/question-bank(개인), ADR-097
│                                       (tech-interview-drill, behavioral-interview-drill 공유 — ADR-031 준수, scripts/_lib 미사용)
│
├── .claude/skills/                       ← agent skill 정본
│   ├── job-fit-analyzer/               (ADR-096 의사결정·전략 재정의)
│   │   └── SKILL.md  지원 의사결정 + 면접 전략 + 커리어 패스 정합. 정본 JSON → md 파생
│   │       (실행 자산: scripts/job-fit-analyzer/{jobfit_schema.ts, render_job_fit.ts}, ADR-019 분리)
│   ├── tech-interview-drill/
│   │   └── SKILL.md  매일 기술 면접 답변 연습 + 3단계 채점 + 약점 환류
│   ├── behavioral-interview-drill/
│   │   └── SKILL.md  매일 인성 면접 답변 연습 + STAR·가치관 채점 + 약점 환류
│   ├── interview-stage-prep/
│   │   └── SKILL.md  1차/최종/오퍼 단계별 실전 준비 자료 생성
│   ├── study-topic-recommender/
│   │   ├── SKILL.md
│   │   └── references/source-management.md   외부 읽을거리 소스 관리 명령
│   ├── interview-asset-writer/
│   │   └── SKILL.md
│   ├── question-bank-collector/
│   │   └── SKILL.md   (일반 backend/CS 질문 bank 수집과 public-safe normalizer)
│   ├── position-recommender/
│   │   ├── SKILL.md
│   │   └── references/   company-upside-reference.md, position-context-index.md,
│   │                     position-decision-criteria.md, verified-company-discovery.md,
│   │                     report-html-delivery.md
│   ├── application-package-writer/
│   │   └── SKILL.md  공고별 fit/gap + 맞춤 지원 패키지 작성
│   ├── application-reviewer/
│   │   └── SKILL.md  evidence/drift/privacy/cooldown 검토
│   ├── resume-evaluator/
│   │   ├── SKILL.md  인사·기술 리더 관점 100점 채점과 최대 3회 HTML 개선 루프
│   │   ├── references/scoring-rubric.md
│   │   ├── scripts/check_resume_html.ts
│   │   └── evals/evals.json
│   ├── resume-evidence-auditor/
│   │   ├── SKILL.md  이력서 주장과 코드·테스트·Git·업무 문서 교차 검증
│   │   ├── references/claim-model.md
│   │   ├── scripts/validate_claim_ledger.ts
│   │   └── evals/evals.json
│   └── daily-application-digest/
│       └── SKILL.md  positions-queue 기반 daily summary
│
├── .codex/skills/                        ← Codex 노출용 심볼릭 링크
│   ├── application-package-writer -> ../../.claude/skills/application-package-writer
│   ├── application-reviewer -> ../../.claude/skills/application-reviewer
│   ├── resume-evaluator -> ../../.claude/skills/resume-evaluator
│   ├── resume-evidence-auditor -> ../../.claude/skills/resume-evidence-auditor
│   ├── behavioral-interview-drill -> ../../.claude/skills/behavioral-interview-drill
│   ├── daily-application-digest -> ../../.claude/skills/daily-application-digest
│   ├── interview-asset-writer -> ../../.claude/skills/interview-asset-writer
│   ├── interview-stage-prep -> ../../.claude/skills/interview-stage-prep
│   ├── job-fit-analyzer -> ../../.claude/skills/job-fit-analyzer
│   ├── position-recommender -> ../../.claude/skills/position-recommender
│   ├── question-bank-collector -> ../../.claude/skills/question-bank-collector
│   ├── study-topic-recommender -> ../../.claude/skills/study-topic-recommender
│   └── tech-interview-drill -> ../../.claude/skills/tech-interview-drill
│
└── sources/
    └── fos-study/                ← 외부 동기 git repo (jon890/fos-study)
        ├── interview/, database/, java/, kafka/, architecture/, ...
        └── (사용자가 실제로 학습하고 발행한 문서)
```

config 설계 원칙:

- config는 전체 자산 목록을 담는 DB가 아니다.
- 학습 문서 목록은 `sources/fos-study/`에서 파생한다.
- 공개 질문 목록은 `public/question-bank/`에서 파생한다.
- config에 남길 것은 후보자 baseline, 외부 읽을거리 수집 대상, 사람이 고른 pin/override/제외 조건이다.
- 현재 타깃과 학습 진행 상태는 `state/`가 소유한다.
- 공고 수집 설정은 `config/position-collection.json`과 `scripts/position-recommender/live-postings/` adapter가 소유한다.
- 회사별 탐색 키워드는 `config/verified-company-research-targets.json`이 단일 출처이고, `position-collection.json`은 회사 비종속 role 키워드만 담는다(ADR-103).
- 아침 읽을거리 소스는 `external-reading-sources.ts`에서 타입 검증되는 상수로 관리한다.
- 학습 방향은 별도 후보 설정이 아니라 `sources/fos-study/`의 실제 문서와 최근 이력에서 판단한다.

## 외부 의존성

career-os 실행 코드는 워크스페이스 안의 `scripts/`에 둔다.
루트 `package.json`과 `tsconfig.json`은 TypeScript 실행 환경만 제공한다.

| 의존성 | 책임 |
|---|---|
| `zod` | 실행 입력과 산출물 스키마 검증 |
| `fast-xml-parser` | RSS와 Atom 수집 결과 파싱 |
| `dotenv` | 명시한 워크스페이스 `.env` 로드 |

## Agent Skill 진입점 패턴

진입점은 agent skill 직접 호출이다.
Claude, Codex, Gemini 같은 에이전트는 같은 SKILL.md를 공유한다.
Codex 발견 경로는 `.codex/skills` 심볼릭 링크를 사용한다.

사용자-facing 계약은 `/<skill-name> [args]` 형식이다.
호환 실행 코드는 스킬 내부 구현으로만 사용한다.

각 agent skill의 SKILL.md가 산출물과 자기 검증 책임을 직접 담는다.
외부 전달은 저장소 밖 호출자가 표준 출력과 생성 파일을 사용해 처리한다.

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
- References — 관련 스킬 cross-ref와 핵심 docs 포인터. ADR 재나열이 아니라 포인터 역할.

질문·검증·금지선처럼 스킬 고유 섹션은 위 구성에 더한다.
public-safe 수집기처럼 단순한 스킬은 일부 섹션을 생략할 수 있다(예: question-bank-collector).

## 생성 산출물 품질 경계

LLM이 작성하는 Markdown 산출물은 skill prompt, processor post-validation, reviewer 중 해당 흐름에 존재하는 가장 가까운 계층에서 품질 계약을 확인한다.
계약은 전역 기준이고, resume package만의 특수 규칙이 아니다.

책임:

| 계층 | 책임 |
|---|---|
| agent skill prompt | 산출물 목적, 필수 입력, 금지 경계, 검증 조건 명시 |
| processor | 필수 파일 존재, freshness, `needs_evidence` 잔존 여부, 제출용/공개용 파일 경계 검증 |
| reviewer skill | 내부 분석과 제출용 또는 공개용 문구 혼입 여부, evidence/drift/privacy risk 검토 |
| application/reviewer 계층 | private 산출물과 공개용/제출용 산출물을 같은 ready 상태로 섞어 처리하지 않음 |

`needs_evidence`는 저장된 최종 산출물의 상태값으로 방치하지 않는다.
검증 계층은 이를 `보강 필요 / 선택지 / 권장 행동`으로 변환해야 하며, 변환 전에는 제출용 또는 공개용 산출물을 ready 상태로 보지 않는다.

## 인근 워크스페이스와의 관계

- **다른 워크스페이스 자산 참조 금지** — apartment/, stock-investment/, travel/는 별개 격리 영역.
- 루트 공용 skill이나 helper가 필요하면 루트 문서를 먼저 확인한다.
- career-os 감사/검증 산출물은 `/tmp`나 `reports/` 중 보존 목적에 맞는 위치를 사용하고, 영구 정책은 ADR로 승격한다.

## 사용자 표면

사람이 보는 표면은 Markdown/HTML 리포트, private position home, positions-queue, question bank, 공개 가능한 공유 요약이다.

현재 인터페이스:

| 흐름 | 정본 |
|---|---|
| 공고 수집 | `config/position-collection.json`, `scripts/position-recommender/live-postings/`, `cache/live-position-postings.md` |
| 공고 추천 | `recommendation.json` 정본 + Markdown/HTML 파생 |
| 지원 준비 | `state/positions-queue.jsonl`, `applications/<application-id>/` |
| 면접 준비 | `state/current-target.json`, `private/<company>/<position>/interview/prep.md`, drill log |
| 피드백 루프 | closed/rejected 기록, `state/study-progress.json`, `private/question-bank/`, 다음 job-fit report |

원칙:

- 추천 후보 상태와 background outbox를 외부 MySQL에 두지 않는다.
- 흐름은 "추천 → 사용자 선택 → positions-queue 등록"이다.
- HTML report는 읽기용 snapshot이고 action source가 아니다.
- 오래 걸리는 작업은 사용자가 skill을 명시 호출하거나 agent가 현재 세션에서 이어서 실행한다.
- 외부 제출, 로그인, 업로드, 공개 발행은 사용자 승인 없이 실행하지 않는다.

## 변경 시 영향 범위

| 변경 종류 | 같이 갱신해야 할 파일 |
|---|---|
| 새 agent skill 추가 | `.claude/skills/<name>/SKILL.md` + `scripts/<name>/` (필요 시) + 본 문서 디렉터리 트리 + `flow.md` 명령별 흐름 + `prd.md` 기능 표 |
| 새 config 추가 | `data-schema.md` config 섹션 + `prd.md` (사용자 가시 자산이면) |
| 새 외부 의존 | 본 문서의 외부 의존성 표 + ADR 추가 |

## Application Agent

application 상태 루프는 기존 career-os skill과 파일 기반 상태를 연결한다.

연동 skill:

- `application-package-writer`
  - 입력: 공고 URL 또는 `applications/**/posting.md`, `config/candidate-profile.md`, 관련 resume/task 근거.
  - 출력: `fit-analysis.md`, `application-package.md`.
- `application-reviewer`
  - 입력: 공고, fit 분석, 지원 패키지, candidate-profile.
  - 출력: `review.md`, pass/revise/block 판단.
- `daily-application-digest`
  - 입력: `state/positions-queue.jsonl`, 오늘 변경된 application files, position/study/interview runtime report.
  - 출력: `reports/daily/YYYY-MM-DD/application-digest/report.md` + 공개 가능한 요약.

데이터 저장소:

```text
state/
└── positions-queue.jsonl          # 지원 후보 상태 큐

applications/
└── <company-slug>/<role-slug>/{posting,fit-analysis,application-package,resume-draft,cover-letter,submission-checklist,review}.md
```

제출 자동화는 구현하지 않는다. 브라우저 입력 보조와 최종 제출은 별도 결정이 필요하다.

## Application Agent Runtime

`scripts/application-agent/`는 skill 산출물, positions-queue, priority history를 연결하는 TypeScript runtime 계층이다.

```text
scripts/application-agent/
├── run.ts                         # command interface (run-once / run-daily / dry-run / validate / resume / ingest-position-report / report-daily)
├── positions_queue_schema.ts      # positions-queue schema + agentPhase runtime field + transition validator (zod)
├── agent_decision_schema.ts       # policy decision object schema (zod)
├── positions_queue_io.ts          # positions-queue read/write helpers
├── policy.ts                      # deterministic policy decision engine + priority ranker
├── actions.ts                     # allowlisted local artifact generation (checklist / study-actions / profile-suggestions)
├── ingest_position_report.ts      # position report -> candidate positions-queue record
├── skill_executor.ts              # --execute-skills 명시 시 compatibility backend로 agent-only private skills 실행
├── skill_contracts.ts             # 에이전트 비종속 skill 호출 계약 + compatibility backend builder
├── safety_gate.ts                 # hard safety gate validator + study action classifier
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

## Resume Package Flow

지원 패키지는 내부 전략 문서와 제출용 문서를 분리한다.
`application-package.md`는 내부 전략 문서로 유지하고, 제출용 Markdown 초안은 별도 파일로 분리한다.

구성 요소:

- application-agent runtime: `run.ts` 계열 command가 package/review skill 실행 후 산출물 검증을 수행한다.
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

- application-agent runtime은 positions-queue mutation과 post-validation을 맡는다.
- 외부 제출, 로그인, public publish, candidate-profile mutation은 사용자 승인 없이는 실행하지 않는다.
- PDF export는 로컬 첨부 파일 생성까지만 다룬다.
  채용 사이트 업로드, 전송, 제출 버튼 클릭은 자동화하지 않는다.

freshness guard는 후보 ingest 시 prerequisite로 참조한다 (`sourceFreshness` 필드 검증).

## Position Priority Layer

파일 기반 priority layer는 기존 collector/recommender/application-agent 자산을 연결한다.
별도 DB 없이 positions-queue projection을 사용한다.

책임 경계:

- `scripts/position-recommender/live-postings/`는 active/open 개별 공고와 compact evidence snapshot을 만든다.
  긴 JD 원문 필드는 추천 판단에 필요한 길이로 축약해 LLM 입력과 실행 시간을 줄인다.
  Wanted는 broad scan 외에 선호 회사와 AI 전환 직무 keyword discovery를 수행하고,
  Toss는 공식 `job-groups` API에서 그룹 공고와 하위 포지션을 펼쳐 수집하며,
  카카오페이는 Kakao Careers public API의 계열사 테크 목록과 개별 상세에서 active 상태와 지원 URL을 확인한다.
  Kakao 계열, 카카오뱅크, NAVER 계열, Coupang, Kurly는 official source entrypoint가 확인된 범위에서 adapter로 수집한다.
  크래프톤은 게임사라 전체 채용이 아니라 공식 Greenhouse board에서 AI Frontier·AI Research·AI Transformation(AX) 조직 공고만 수집한다.
  adapter는 listing/API/sitemap root URL은 가질 수 있지만, 개별 공고 URL을 코드에 하드코딩하지 않는다.
- `position-recommender` agent skill은 표준 출력 JSON `recommendation.json`(ADR-101, schemaVersion 2)을 만든다. 적재용 `source`·`closeDate`를 포함하며, 외부 공유 요약 같은 가공은 호출자가 맡는다(ADR-101).
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
자연어 라우팅을 위해 skill description에는 “일반 backend 질문”, “CS 질문 수집”, “면접 질문 bank”, “질문 뱅크 보강”, “약점 기반 질문 재선별” 같은 trigger를 명시한다.

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
