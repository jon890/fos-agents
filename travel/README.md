# travel

`travel/`은 여행별 일정, 예약 정보, 의사결정을 Markdown으로 관리하는 문서 중심 워크스페이스다.
현재는 자동 수집기나 workspace-level skill 없이 사용자가 대화 중 문서를 정리하는 방식으로 운영한다.

## 시작하기

1. [`AGENTS.md`](AGENTS.md)를 읽는다.
2. [`docs/index.md`](docs/index.md)에서 기존 trip을 확인한다.
3. 새 여행이면 `trips/<trip-id>/`를 만든다.
4. `trip-overview.md`, `itinerary.md`, `decision-log.md`를 채운다.

## 현재 trip

| trip | 설명 |
|---|---|
| `trips/osaka-2026-05` | 2026-05 오사카 여행 |
| `trips/paju-heyri-2026-05` | 파주 헤이리 반나절 데이트 |
| `trips/gunsan-daejeon-2026-08` | 2026-08 군산·대전 여행 |
| `trips/cheonho-2026-08` | 2026-08 천호 반나절 데이트 |

전체 목록은 [`docs/index.md`](docs/index.md)를 따른다.

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

| 경로 | 용도 |
|---|---|
| `docs/trip-overview.md` | 항공, 숙소, 교통, 보험 같은 고정 정보 |
| `docs/itinerary.md` | Day별 일정 |
| `docs/decision-log.md` | 결정 누적 |
| `data/` | 예약 PDF, 지도 캡처, 보조 자료 |
| `memory/` | 세션 기록 |
| `output/` | 체크리스트, HTML, 이미지 같은 산출물 |

## 설정

현재 필수 비밀 값은 없다.
기본 환경 값은 [`travel/.env.example`](.env.example)을 참고한다.
실제 `.env`는 필요할 때만 같은 위치에 만든다.

## 검증

문서 변경 후에는 아래를 확인한다.

```bash
find travel/trips -maxdepth 2 -type f | sort
rg -n "채널 ID|환경 종속 경로|내부 호스트" travel/AGENTS.md travel/README.md travel/docs
```

`docs/index.md`의 trip 목록과 실제 `trips/` 하위 디렉터리가 맞는지도 함께 본다.
