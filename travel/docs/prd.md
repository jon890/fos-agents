# PRD — travel

travel 워크스페이스는 여행별 문서를 안전하게 누적 관리하는 개인 문서 워크스페이스다.
현재 범위는 대화 중 문서 작성과 정리다.

## 목적

- trip별 일정, 예약 정보, 의사결정을 한 디렉터리에 모은다.
- 개인 trip 목록을 `private/trips/index.md`에서 확인한다.
- 예약 정보와 개인 일정을 외부 공개 경계 밖에 둔다.

## 사용자

본인 1인.
여행 계획, 준비, 종료 후 정리까지 같은 문서 구조를 사용한다.

## 기능

| 기능 | 산출물 |
|---|---|
| trip 생성 | `private/trips/<trip-id>/` |
| 예약·고정 정보 정리 | `private/trips/<trip-id>/docs/trip-overview.md` |
| Day별 일정 정리 | `private/trips/<trip-id>/docs/itinerary.md` |
| 결정 기록 | `private/trips/<trip-id>/docs/decision-log.md` |
| trip별 보조 자료 보관 | `private/trips/<trip-id>/data/` |
| 출발 전 체크리스트와 HTML 등 산출물 | `private/trips/<trip-id>/output/` |
| 개인 trip 목록 갱신 | `private/trips/index.md` |

## 의도적으로 안 하는 것

- 항공권, 숙소, 식당 예약 자동화.
- 실시간 가격 수집 자동화.
- 외부 알림 직접 전송.
- 다른 워크스페이스 helper 의존.

## 성공 기준

- 모든 trip이 `private/trips/index.md`에 있다.
- 각 trip의 핵심 정보가 `trip-overview.md`, `itinerary.md`, `decision-log.md`로 나뉜다.
- 예약 정보와 개인 일정이 공개 문서나 외부 저장소로 복사되지 않는다.
- `git ls-files travel/`에 trip 데이터가 나오지 않는다.
- 자동화가 없는 현재 구조를 문서가 그대로 설명한다.
