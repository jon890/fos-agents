# Code Architecture — travel

travel은 문서 중심 워크스페이스다.
현재 자동화 코드, workspace-level skill, 별도 config 디렉터리가 없다.

## 디렉터리

```text
travel/
├── AGENTS.md
├── README.md
├── CLAUDE.md -> AGENTS.md
├── .env.example
├── docs/
│   ├── index.md
│   ├── prd.md
│   ├── data-schema.md
│   ├── flow.md
│   ├── code-architecture.md
│   └── adr.md
└── trips/
    └── <trip-id>/
        ├── docs/
        │   ├── trip-overview.md
        │   ├── itinerary.md
        │   └── decision-log.md
        ├── data/
        ├── memory/
        └── output/
```

## 책임

| 경로 | 책임 |
|---|---|
| `docs/index.md` | 전체 trip 목록 |
| `docs/prd.md` | 워크스페이스 범위와 성공 기준 |
| `docs/flow.md` | trip 생성·정리 흐름 |
| `docs/data-schema.md` | trip 디렉터리와 파일 구조 |
| `docs/adr.md` | travel 한정 결정 이유 |
| `trips/<trip-id>/docs/` | trip별 핵심 문서 |
| `trips/<trip-id>/data/` | 예약 파일과 보조 자료 |
| `trips/<trip-id>/memory/` | 세션 기록과 회고 |
| `trips/<trip-id>/output/` | 체크리스트, HTML, 이미지 산출물 |

## 의도적으로 없는 항목

| 항목 | 이유 |
|---|---|
| `scripts/` | 현재 자동화 코드가 없다. |
| `.claude/skills/` | workspace-level skill이 없다. |
| `config/` | 예약 정보는 trip 문서에 보관한다. |
| `logs/` | 자동 실행 로그를 만들지 않는다. |

`.env.example`은 기본 환경 값을 위한 템플릿이다.
필수 비밀 값은 현재 없다.
