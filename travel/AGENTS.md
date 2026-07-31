# AGENTS.md — travel 워크스페이스

`~/ai-nodes/travel`는 여행 계획·의사결정·예약 정보를 trip별로 누적 관리하는 독립 워크스페이스.

## 1. trip-instance 구조

```
trips/<trip-id>/
├── docs/                # 의사결정·일정·개요 (트립 메인)
│   ├── trip-overview.md     # 예약·고정 정보 (항공/숙소/교통/보험)
│   ├── itinerary.md         # Day별 일정
│   ├── decision-log.md      # 결정 누적
│   └── food-shopping-prep.md  # (선택) trip별 특화 문서
├── data/                # 예약 산출물 + 보조 데이터 (CSV / PDF 등)
├── memory/              # 세션 기록 (날짜별 .md)
└── output/              # 생성 산출물 (PNG / route schematic 등)
```

trip-id 명명 규칙: `<도시-slug>-<YYYY-MM>` (예: `osaka-2026-05`).
워크스페이스 root `docs/index.md`에 모든 trip 인덱스 유지.

## 2. 운영 원칙

- trip별 폴더 격리
- 결정 시점마다 `docs/decision-log.md`에 라인 append.
- 출발 전·후 review
- 예약 정보 외부 노출 금지 — 공개 블로그 / 외부 git push 안 함.
