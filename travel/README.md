# travel

`travel/`은 여행별 일정, 예약 정보, 의사결정을 Markdown으로 관리하는 문서 중심 워크스페이스다.
현재는 자동 수집기나 workspace-level skill 없이 사용자가 대화 중 문서를 정리하는 방식으로 운영한다.

## 시작하기

1. [`AGENTS.md`](AGENTS.md)를 읽는다.
2. `private/trips/index.md`에서 기존 trip을 확인한다.
3. 새 여행이면 `private/trips/<trip-id>/`를 만든다.
4. `trip-overview.md`, `itinerary.md`, `decision-log.md`를 채운다.

## 현재 trip

실제 trip 목록은 개인 날짜와 목적지를 포함하므로 공개 저장소에 두지 않는다.
`private/trips/index.md`를 따른다.

공개 승인된 trip만 [`docs/index.md`](docs/index.md)에 올린다.

## trip 구조

```text
private/trips/<trip-id>/
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
find travel/private/trips -maxdepth 2 -type f | sort
rg -n "채널 ID|환경 종속 경로|내부 호스트" travel/AGENTS.md travel/README.md travel/docs
git ls-files travel/ | rg "trips/" || echo "trip 데이터가 tracked 되지 않음"
```

`private/trips/index.md`의 trip 목록과 실제 `private/trips/` 하위 디렉터리가 맞는지도 함께 본다.
마지막 명령은 개인 trip 데이터가 다시 Git에 올라가지 않았는지 확인한다.
