# AGENTS.md — travel 워크스페이스

`travel/`은 여행별 일정, 예약 정보, 의사결정 기록을 trip 디렉터리로 관리하는 문서 중심 워크스페이스다.
실제 trip 데이터는 공개 저장소에 커밋하지 않고 `private/trips/`에 둔다.

## 문서 라우팅

| 문서 | 책임 |
|---|---|
| [`README.md`](README.md) | 처음 사용하는 사람을 위한 범위와 시작 방법 |
| [`docs/index.md`](docs/index.md) | 공개 trip 목록과 공개 경계 |
| [`docs/prd.md`](docs/prd.md) | 제품 범위와 성공 기준 |
| [`docs/flow.md`](docs/flow.md) | trip 생성부터 종료까지의 흐름 |
| [`docs/data-schema.md`](docs/data-schema.md) | trip 디렉터리와 파일 스키마 |
| [`docs/code-architecture.md`](docs/code-architecture.md) | 현재 디렉터리 구조와 의도적으로 없는 항목 |
| [`docs/adr/INDEX.md`](docs/adr/INDEX.md) | travel 한정 기술 결정 |

모노레포 공통 결정은 [`../docs/adr/INDEX.md`](../docs/adr/INDEX.md)를 따른다.

## 데이터 경계

이 저장소는 공개 저장소다.
실제 날짜, 시각, 만남 장소, 이동 동선, 예약 정보가 들어간 trip은 Git이 무시하는 `private/trips/`에 둔다.

- 여행 정보는 `private/trips/<trip-id>/` 안에 둔다.
- 개인 trip 목록은 `private/trips/index.md`를 갱신한다.
- 공개 `docs/index.md`에는 개인 날짜와 목적지를 적지 않는다.
- 공개 산출물이 필요하면 날짜, 시각, 만남 장소, 개인 건강정보를 제거하고 사용자의 명시적 승인을 받는다.
- 공개 여부가 애매하면 공개하지 않는다.

## 작업 경계

- 예약 정보와 개인 일정은 공개 블로그나 외부 저장소에 복사하지 않는다.
- 자동화가 필요해지기 전까지 `scripts/`, workspace-level skill, runtime config를 만들지 않는다.

## trip 기본 구조

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

`trip-id`는 `<도시-slug>-<YYYY-MM>` 형식을 쓴다.
같은 도시와 월에 여러 trip이 있으면 suffix를 붙인다.
