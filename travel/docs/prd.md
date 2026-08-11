# PRD — travel

travel 워크스페이스의 **제품 범위·기능 명세**.
현재 운영 워크플로의 단일 출처.
새 기능을 추가하거나 우선순위를 정할 때 이 문서가 기준.

런타임 상태(어느 trip이 활성인지, 무엇이 변경됐는지)는 여기에 박지 않는다.
`docs/index.md`가 trip 목록 단일 출처이고 `skills/workspace-audit`가 그때그때 보고한다.

## 1. 목적

trip별 의사결정·일정·예약 정보를 마크다운으로 누적·관리하는 개인 문서 워크스페이스.
단일 사용자(=본인)가 대화 중 Claude 보조를 받아 문서를 직접 작성·정리한다.

자동화·cron·외부 API 호출은 없다.
다른 워크스페이스(apartment / career-os / stock-investment / health-care)가 *자동화 + 일자별 산출물 + Claude CLI 호출 흐름*을 핵심으로 하는 것과 근본적으로 다르다.

## 2. 사용자

본인 1인.
trip을 계획·준비·완료하는 전 과정에서 의사결정·일정·예약 정보를 단일 출처로 유지.

## 3. 기능 목록

자동화 없음 — *대화·문서 작성·결정 기록*만 책임.

| 번호 | 기능 | 산출물 위치 | 트리거 |
|---|---|---|---|
| 1 | trip 디렉터리 생성 | `trips/<trip-id>/` | 사용자 요청 시 1회 |
| 2 | trip-overview.md 작성 | `trips/<trip-id>/docs/trip-overview.md` | 예약·고정 정보 정리 시 |
| 3 | itinerary.md 작성 | `trips/<trip-id>/docs/itinerary.md` | Day별 일정 확정 시 |
| 4 | decision-log.md 누적 | `trips/<trip-id>/docs/decision-log.md` | 결정 시점마다 append |
| 5 | trip별 특화 문서 작성 | `trips/<trip-id>/docs/` 하위 | trip 특성에 따라 |
| 6 | 출발 전 체크리스트 정리 | `trips/<trip-id>/output/` | 출발 직전 |
| 7 | trip 인덱스 갱신 | `docs/index.md` | trip 추가·완료 시 |

## 4. 산출물 경로 정책

| 경로 | 용도 |
|---|---|
| `trips/<trip-id>/docs/` | trip별 마크다운 문서 (개요 / 일정 / 결정 로그 / 특화 문서) |
| `trips/<trip-id>/data/` | 예약 PDF / 보딩패스 / 지도 캡처 / CSV 등 보조 자료 |
| `trips/<trip-id>/memory/` | 세션 기록 (날짜별 .md) |
| `trips/<trip-id>/output/` | 산출물 (체크리스트 / route schematic 등) |
| `docs/index.md` | 모든 trip 목록 (동적, 보존 대상) |
| `data/audit/` | workspace-audit 결과 |
| `memory/` | 워크스페이스 레벨 세션 기록 |
| `logs/.usage-status` | openclaw 사용 메타 |

trip-id 명명 규칙: `<도시-slug>-<YYYY-MM>` (예: `osaka-2026-05`).

## 5. 비기능 요구사항

- **재실행 가능성 불요**: 수동 대화 중심이라 멱등 실행 개념이 없음.
- **비밀 정보 없음**: 예약 정보는 문서로 보관. 외부 노출 없음. `.env` 없음.
- **워크스페이스 격리**: 다른 워크스페이스(apartment / career-os / stock-investment / health-care) 자산 교차 참조 없음.
- **비용 추적 불요**: Claude CLI 자동 호출이 없으므로 `task-runs.jsonl` 운영 안 함.

## 6. 의도적으로 안 하는 것

- 예약 자동화 (항공·숙소·레스토랑 API 연동 금지)
- 가격 수집 자동화 (실시간 가격 API 호출 금지)
- 외부 서비스 연동 (Discord 알림 / cron 실행 없음)
- 다른 워크스페이스 helper 의존 (이 워크스페이스는 독립 문서 도구)

## 7. 미연결 / 보류 항목

- **자동화 도입 시점**: trip 자동 일정 생성 / 예약 가격 수집 / 항공편 모니터링 등 명확한 자동화 요구사항이 발생하면 별도 plan에서 ADR-002 결정 후 `scripts/` 신설.
- **워크스페이스 레벨 skill**: trip별 컨텍스트가 충분히 표준화되면 `.claude/skills/` 도입 여부 ADR-003에서 결정.

현재 상태: 순수 문서 워크스페이스.

## 8. 성공 기준

- trip별 의사결정 / 일정 / 예약 정보가 `trips/<trip-id>/docs/` 하위에 단일 출처로 유지됨.
- 각 trip 시작 시 디렉터리 구조가 일관되게 생성됨.
- `docs/index.md`에서 모든 trip 목록과 상태를 확인 가능.
- 다른 워크스페이스 자산을 교차 참조하지 않음.
