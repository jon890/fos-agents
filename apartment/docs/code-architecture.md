# Code Architecture — apartment

apartment 워크스페이스의 **디렉터리 구조·책임·외부 의존성** 단일 출처. 코드 구조 변경·새 skill 추가 시 이 문서가 기준.

## 1. 디렉터리 트리

```
apartment/
├── AGENTS.md                        # 워크스페이스 가이드 진입점
├── CLAUDE.md -> AGENTS.md           # 심링크
├── .env                             # 비밀 정보 (NAVER_COOKIE, DISCORD_WEBHOOK_URL 등)
├── .env.example                     # 템플릿
│
├── config/
│   ├── focus-unit.json              # 포커스 평형 메타데이터 단일 출처 (59A, ADR-002)
│   ├── guri-buy-complexes.json      # Guri 광역 탐색 후보 단지 단일 출처
│   ├── interior-reference-digest.json
│   └── lucky-24-floorplan.json
│
├── scripts/                            # 워크스페이스 레벨 공용 헬퍼 (ADR-003)
│   ├── _lib/
│   │   └── load_target_meta.ts         # focus-unit.json read + env override (ADR-002, plan002)
│   ├── apartment-daily-report/         # skill 실행 파일 (plan007, ADR-004)
│   │   ├── run_report.sh               # 메인 진입점 (self-wrap 포함)
│   │   ├── run_smoke_test.sh           # 헬스 체크 진입점
│   │   ├── run_guri_buy_search.sh
│   │   ├── collect_sources.ts          # ADR-006 (import 통합 오케스트레이터, plan003)
│   │   ├── collect_naver_api.ts        # ADR-001 (Naver API 3 endpoint), plan003 마이그
│   │   ├── naver_api_schemas.ts        # ADR-007 (zod 응답 스키마), plan003
│   │   ├── collect_hogangnono.ts       # plan004 마이그 (HTML regex 파서)
│   │   ├── collect_kbland.ts           # plan004 마이그 (HTML regex 파서)
│   │   └── normalize_results.ts        # plan005 마이그 (zod 입력/출력 스키마)
│   └── apartment-interior-reference-digest/  # skill 실행 파일 (plan007, ADR-004)
│       ├── run_with_claude.sh       # 운영 cron 진입점: Claude native skill 호출
│       └── run_digest.sh            # request/report placeholder scaffold
│
├── docs/
│   ├── prd.md
│   ├── data-schema.md
│   ├── flow.md
│   ├── code-architecture.md         # 이 파일
│   ├── adr.md
│   └── interior/                    # 인테리어 결정 영역 (skill 도메인 자산)
│       ├── interior-references.md
│       ├── lucky-5-1004-interior-decisions.md
│       ├── lucky-5-1004-decision-queue.md
│       ├── lucky-5-1004-decision-summary.md
│       ├── lucky-5-1004-field-checklist.md
│       └── lucky-5-1004-contractor-brief.md
│
├── .claude/
│   └── skills/
│       ├── apartment-daily-report/       # native skill 등록 (컨텍스트 자산)
│       │   ├── SKILL.md
│       │   └── references/
│       └── apartment-interior-reference-digest/  # native skill 등록 (plan007, ADR-004)
│           ├── SKILL.md
│           └── references/
│
├── tasks/
│   └── plan{N}-<slug>/
│       ├── index.json
│       └── phase-NN.md
│
├── data/                            # gitignored — 산출물
│   ├── YYYY-MM-DD/
│   ├── YYYY-MM-DD-HHMM-guri-buy-search/
│   ├── interior-reference-digest/YYYY-MM-DD/
│   └── audit/YYYY-MM-DD.md
│
└── logs/                            # gitignored — 실행 메타데이터
    ├── task-runs.jsonl
    ├── token-usage.jsonl
    └── .usage-status/
```

## 2. skill 구조 표준

`scripts/<name>/`(실행 파일) + `.claude/skills/<name>/{SKILL.md, references/}`(컨텍스트 자산) 분리 구조 — ai-nodes ADR-006 표준 (plan007, ADR-004 적용).

실행 파일과 컨텍스트 자산을 분리 관리. `skills/` 통합 구조는 ADR-004에서 폐기.

## 3. native skill 등록 (.claude/skills/)

| skill 이름 | 등록 상태 | 호출 방법 |
|---|---|---|
| apartment-daily-report | 등록 | `claude -p "/apartment-daily-report"` 또는 `bash apartment/scripts/apartment-daily-report/run_report.sh` |
| apartment-interior-reference-digest | 등록 | `claude -p "/apartment-interior-reference-digest"` 또는 `bash apartment/scripts/apartment-interior-reference-digest/run_with_claude.sh` |

## 4. Runner 패턴

self-wrap 패턴 — `TRACK_TASK_WRAPPED` guard.

```bash
# run_report.sh 상단 패턴
if [ -z "$TRACK_TASK_WRAPPED" ]; then
  exec _shared/bin/track_task.sh \
    --task-id "apartment:daily-report" \
    -- "$0" "$@"
fi

# 이후: TRACK_TASK_WRAPPED=1 환경에서 본체 실행
```

`logs/task-runs.jsonl` 기록 보장. task-id 형태: `apartment:<task-name>`.

## 5. 외부 의존성

| 의존성 | 위치 | 상태 | 역할 |
|---|---|---|---|
| `track_task.sh` | `_shared/bin/track_task.sh` | load-bearing | 모든 runner self-wrap. 없으면 runner 실패 |
| `extract_claude_result.ts` | `_shared/lib/extract_claude_result.ts` | 사용 중 (ai-nodes plan001) | `claude --output-format json` envelope → report.md 파싱 |
| `claude` CLI | 시스템 설치 | 사용 중 | Claude 호출 (90s 타임아웃 + fallback) |
| `agent-browser` CLI | 로컬 설치 필수 | 사용 중 | Naver Bearer JWT 자동 추출 (ADR-001) |
| Bun runtime | 시스템 (ai-nodes root `bun install`) | 사용 중 (ADR-003) | apartment ts 헬퍼 실행 (예: `scripts/_lib/load_target_meta.ts`, plan002) |
| `notify_discord.ts` | `_shared/lib/notify_discord.ts` | 사용 중 (ADR-009) | Discord 알림 (openclaw 경유, `run_report.sh`가 `bun run`으로 호출) |

`notify_discord.ts` — ADR-009로 apartment 도입. 워크스페이스 한정 `notify_discord.sh` / `notify_discord_media.sh`를 폐기하고 `_shared/lib`의 ts 정본으로 통합 (openclaw subprocess + 10s 타임아웃, `DISCORD_CHANNEL_ID` 필수). `extract_claude_result.ts`는 ai-nodes plan001 이후 apartment + stock-investment + career-os 공용. apartment는 ADR-003 이후 Shell + TS 표준 확장.

## 6. 언어 분포

| 언어 | 파일 수 (추정) | 역할 |
|---|---|---|
| Shell | 3 | runner (run_report.sh, run_with_claude.sh) + smoke_test (Discord 알림은 ADR-009로 `_shared/lib/notify_discord.ts` 통합) |
| Python | 0 | apartment-daily-report 안 Python 0. ai-nodes plan001 이후 `_shared/bin/extract_claude_result.py` git rm — `_shared/lib/extract_claude_result.ts`가 단일 출처 |
| TypeScript | 7 | `_lib/load_target_meta.ts` (plan002) + collect_sources / collect_naver_api / naver_api_schemas (plan003) + collect_hogangnono / collect_kbland (plan004) + normalize_results (plan005) |

apartment는 ADR-003으로 TypeScript 도입 시작 (plan002). plan003 (Naver / sources) + plan004 (Hogangnono / KB) + plan005 (normalize) 마이그 완료. plan006 (build_weekly_listing_trend)는 ADR-008로 폐기 (dead code + PIL 의존 제거). apartment Python 완전 제거 — ai-nodes "stdlib only" 진술 정합화.
