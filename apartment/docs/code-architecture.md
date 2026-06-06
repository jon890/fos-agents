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
│   ├── README.md                    # config 파일 역할과 평면도 보관 규칙
│   ├── focus-unit.json              # 포커스 평형 메타데이터 단일 출처 (59A, ADR-002)
│   ├── guri-buy-complexes.json      # Guri 광역 탐색 후보 단지 단일 출처
│   ├── interior-reference-digest.json
│   └── lucky-24-floorplan.json      # 럭키 24평 참고 평면도 메타데이터, 원본 이미지 경로/해시 포함
│
├── scripts/                            # 워크스페이스 레벨 공용 헬퍼 (ADR-003)
│   ├── _lib/
│   │   └── load_target_meta.ts         # focus-unit.json read + env override (ADR-002, plan002)
│   ├── apartment-daily-report/         # skill 실행 파일 (plan007, ADR-004)
│   │   ├── run_with_claude.sh          # 운영 진입점: native skill 직접 호출 (ADR-010, plan010)
│   │   ├── run_smoke_test.sh           # 헬스 체크 진입점
│   │   ├── run_guri_buy_search.sh
│   │   ├── collect_sources.ts          # ADR-006 (import 통합 오케스트레이터, plan003)
│   │   ├── collect_naver_api.ts        # ADR-001 (Naver API 3 endpoint), plan003 마이그
│   │   ├── naver_api_schemas.ts        # ADR-007 (zod 응답 스키마), plan003
│   │   ├── collect_hogangnono.ts       # plan004 마이그 (HTML regex 파서)
│   │   ├── collect_kbland.ts           # plan004 마이그 (HTML regex 파서)
│   │   └── normalize_results.ts        # plan005 마이그 (zod 입력/출력 스키마)
│   └── apartment-interior-reference-digest/  # skill 실행 파일 (plan007, ADR-004)
│       └── run_with_claude.sh          # 운영 cron 진입점: Claude native skill 호출
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
│   ├── interior/floorplans/lucky-24/ # 럭키 24평 참고 평면도 원본 이미지/README
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
| apartment-daily-report | 등록 (native, ADR-010) | `claude -p "/apartment-daily-report"` 또는 `bash apartment/scripts/apartment-daily-report/run_with_claude.sh` |
| apartment-interior-reference-digest | 등록 | `claude -p "/apartment-interior-reference-digest"` 또는 `bash apartment/scripts/apartment-interior-reference-digest/run_with_claude.sh` |

## 4. Runner 패턴

두 skill 모두 native thin wrapper 패턴 (daily-report는 ADR-010, interior는 plan007).

```bash
# run_with_claude.sh 상단 패턴
cd "$TASK_ROOT"
notify_safe "[시작] ..."          # Discord 시작 알림 (bun run notify_discord.ts)
claude --permission-mode bypassPermissions -p "/<skill> ${REQUEST}"
# stdout 비면 report.md 경로 폴백, exit!=0이면 Discord 실패 알림
```

native skill이 SKILL.md 기준으로 수집·정규화 TS(bun Bash)·합성·완료 알림을 직접 수행.
`track_task.sh` self-wrap는 ADR-010으로 폐기 — `task-runs.jsonl` 미생성.

## 5. 외부 의존성

| 의존성 | 위치 | 상태 | 역할 |
|---|---|---|---|
| `track_task.sh` | `_shared/bin/track_task.sh` | apartment 미사용 (ADR-010) | self-wrap 제거.<br>stock-investment만 잔존 |
| `extract_claude_result.ts` | `_shared/lib/extract_claude_result.ts` | apartment 미사용 (ADR-010) | json envelope 추출 폐기 — Claude가 report.md 직접 Write |
| `claude` CLI | 시스템 설치 | 사용 중 | native skill 직접 호출 (`claude -p "/<skill>"`) |
| `agent-browser` CLI | 로컬 설치 필수 | 사용 중 | Naver Bearer JWT 자동 추출 (ADR-001) |
| Bun runtime | 시스템 (ai-nodes root `bun install`) | 사용 중 (ADR-003) | 수집·정규화 TS 헬퍼 실행 (collect_sources / normalize_results / load_target_meta) |
| `notify_discord.ts` | `_shared/lib/notify_discord.ts` | 사용 중 (ADR-009) | Discord 알림 (openclaw 경유, thin wrapper + native skill이 `bun run`으로 호출) |

`notify_discord.ts` — ADR-009로 apartment 도입. 워크스페이스 한정 `notify_discord.sh` / `notify_discord_media.sh`를 폐기하고 `_shared/lib`의 ts 정본으로 통합 (openclaw subprocess + 10s 타임아웃, `DISCORD_CHANNEL_ID` 필수). `extract_claude_result.ts`는 ADR-010으로 apartment에서 미사용 — stock-investment만 잔존(후속 모노레포 plan에서 폐기 예정). apartment는 ADR-003 이후 Shell + TS 표준 확장.

## 6. 언어 분포

| 언어 | 파일 수 (추정) | 역할 |
|---|---|---|
| Shell | 3 | thin wrapper `run_with_claude.sh` × 2 (daily-report ADR-010 + interior)<br>+ `run_smoke_test.sh`<br>`run_report.sh`는 ADR-010 폐기 |
| Python | 0 | apartment-daily-report 안 Python 0. ai-nodes plan001 이후 `_shared/bin/extract_claude_result.py` git rm — `_shared/lib/extract_claude_result.ts`가 단일 출처 |
| TypeScript | 7 | `_lib/load_target_meta.ts` (plan002) + collect_sources / collect_naver_api / naver_api_schemas (plan003) + collect_hogangnono / collect_kbland (plan004) + normalize_results (plan005) |

apartment는 ADR-003으로 TypeScript 도입 시작 (plan002). plan003 (Naver / sources) + plan004 (Hogangnono / KB) + plan005 (normalize) 마이그 완료. plan006 (build_weekly_listing_trend)는 ADR-008로 폐기 (dead code + PIL 의존 제거). apartment Python 완전 제거 — ai-nodes "stdlib only" 진술 정합화.
