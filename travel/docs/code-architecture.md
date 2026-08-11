# code-architecture — travel

travel 워크스페이스의 **디렉터리 구조·계층·외부 의존성 단일 출처**.
구조 변경 시 본 문서를 먼저 갱신하고 실 디렉터리에 반영한다.

## 1. 디렉터리 트리

```
travel/
├── AGENTS.md                      # 워크스페이스 가이드 본체
├── CLAUDE.md -> AGENTS.md         # Claude Code 자동 로드용 심링크
├── .env                           # secrets (gitignored) — ADR-002
├── .env.example                   # secrets template (git tracked)
│
├── docs/                          # 워크스페이스 5문서 + 인덱스
│   ├── index.md                   # trip 목록 (동적, 보존 대상)
│   ├── prd.md                     # 제품 범위·기능 명세
│   ├── data-schema.md             # 디렉터리·파일 스키마
│   ├── flow.md                    # 사용자 대화 흐름
│   ├── code-architecture.md       # 본 문서
│   └── adr.md                     # 아키텍처 결정 누적
│
├── tasks/                         # plan 사이클 영역
│   └── plan{N}-<slug>/            # planning + plan-and-build 스킬 운영
│
├── trips/                         # trip-instance 영역 (동적)
│   └── <trip-id>/                 # trip별 독립 디렉터리
│       ├── docs/                  # 마크다운 문서
│       │   ├── trip-overview.md   # 예약·고정 정보
│       │   ├── itinerary.md       # Day별 일정
│       │   ├── decision-log.md    # 결정 누적
│       │   └── <특화문서>.md      # trip별 추가 문서
│       ├── data/                  # 예약 파일·보조 자료
│       ├── memory/                # 세션 기록
│       └── output/                # 산출물
│
├── data/                          # 워크스페이스 레벨
│   └── audit/                     # workspace-audit 결과
│
├── memory/                        # 워크스페이스 레벨 세션 기록
│
└── logs/
    └── .usage-status              # openclaw 사용 메타
```

## 2. 계층 구조

| 계층 | 경로 | 설명 |
|---|---|---|
| 워크스페이스 | `travel/` | ai-nodes 독립 워크스페이스 root |
| 문서 | `travel/docs/` | 5문서 + 인덱스 |
| plan | `travel/tasks/` | plan 사이클 영역 |
| trip-instance | `travel/trips/<trip-id>/` | trip별 독립 컨텍스트 |
| trip 문서 | `trips/<trip-id>/docs/` | 마크다운 3종 + 특화 문서 |
| trip 자료 | `trips/<trip-id>/data/` | 예약·보조 파일 |

## 3. 의도된 비대칭 (ADR-001)

ai-nodes 표준 워크스페이스 구조(ADR-006 분리 패턴)와 비교할 때 아래 항목이 *의도적으로 없다*.

### 3-1. `scripts/` 없음

runner·자동화 없음.
도입 시점은 trip 자동 일정 생성 / 예약 가격 수집 등 명확한 자동화 요구사항 발생 시 별도 plan으로 결정.

### 3-2. `.claude/skills/` 없음

workspace-level skill 없음.
trip-instance 내부 `trips/<trip-id>/docs/`가 Claude 호출의 사실상 컨텍스트 진입점.

### 3-3. `config/` 없음

runtime 설정 없음.
예약 정보는 `trips/<trip-id>/docs/trip-overview.md`에 문서로 보관.

이 3가지 부재는 빈 placeholder를 만드는 것보다 *의도된 비대칭*으로 명시하는 것이 정직하다.
향후 자동화가 도입되면 별도 ADR에서 각 항목을 추가한다.

## 4. 외부 의존성

| 의존 대상 | 용도 | 필수 여부 |
|---|---|---|
| `claude` CLI | 대화 + 문서 작성 보조 | 필수 |

다른 워크스페이스의 Python, Bun, agent-browser 도구에 의존하지 않는다.
이 워크스페이스는 독립 문서 도구다.

## 5. 다른 워크스페이스와 비교

| 항목 | travel | 다른 워크스페이스 |
|---|---|---|
| `scripts/` | 없음 (의도된 비대칭) | 있음 (runner) |
| `.claude/skills/` | 없음 (의도된 비대칭) | 있음 (skill SKILL.md) |
| `config/` | 없음 | 있음 (JSON config) |
| `.env` | 있음 (ADR-002) | 있음 (DISCORD_CHANNEL_ID 등) |
| cron | 없음 | 있음 (health-care 08:30, stock 08:00·09:00) |
| Claude CLI 자동 호출 | 없음 | 있음 |
| `logs/task-runs.jsonl` | 없음 | 있음 |

ADR-006 분리 패턴은 travel에 적용되지 않는다.
적용하지 않는 근거는 ADR-001 참조.

## 6. trip-instance 계층 책임

| 파일 | 책임 |
|---|---|
| `docs/trip-overview.md` | 예약·고정 정보 (항공 / 숙소 / 교통 / 보험) |
| `docs/itinerary.md` | Day별 일정 (체크인 / 활동 / 식사 / 이동) |
| `docs/decision-log.md` | 결정 누적 (append 전용) |
| `data/` | 예약 파일·보조 자료 |
| `memory/` | 세션 기록 |
| `output/` | 체크리스트·schematic 등 산출물 |
