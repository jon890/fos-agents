# Data Schema — travel

이 문서는 travel의 trip 디렉터리와 파일 구조를 설명한다.
전체 trip 목록은 `docs/index.md`가 단일 출처다.

## trip-id

형식은 `<도시-slug>-<YYYY-MM>`이다.
같은 도시와 월에 여러 trip이 있으면 `-2`, `-3` 같은 suffix를 붙인다.

예:

- `osaka-2026-05`
- `gunsan-daejeon-2026-08`

## trip 구조

```text
trips/<trip-id>/
├── docs/
│   ├── trip-overview.md
│   ├── itinerary.md
│   └── decision-log.md
├── data/
├── memory/
└── output/
```

## `docs/`

| 파일 | 내용 |
|---|---|
| `trip-overview.md` | 항공, 숙소, 교통, 보험 같은 예약·고정 정보 |
| `itinerary.md` | Day별 일정 |
| `decision-log.md` | 결정과 이유의 누적 기록 |
| `<topic>.md` | 음식, 쇼핑, 예산, 짐 목록 같은 trip별 특화 문서 |

## `data/`

예약 확인서, 바우처, 보딩패스, 지도 캡처, CSV 같은 보조 자료를 둔다.
파일명은 원본을 유지할 수 있다.
자료가 많으면 하위 디렉터리를 자유롭게 만든다.

## `memory/`

세션 기록과 여행 후 회고를 둔다.
권장 파일명은 `YYYY-MM-DD.md` 또는 `YYYY-MM-DD-<topic>.md`다.

## `output/`

체크리스트, HTML, 이미지, 인쇄용 요약 같은 생성 산출물을 둔다.

## 워크스페이스 root

| 경로 | 내용 |
|---|---|
| `AGENTS.md` | 작업 규칙과 문서 라우팅 |
| `README.md` | 시작 안내 |
| `docs/index.md` | 전체 trip 목록 |
| `docs/prd.md` | 제품 범위 |
| `docs/data-schema.md` | 본 문서 |
| `docs/flow.md` | 사용자 흐름 |
| `docs/code-architecture.md` | 디렉터리 구조 |
| `docs/adr.md` | 결정 이유 |
| `.env.example` | 기본 환경 값 템플릿 |
