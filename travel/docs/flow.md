# Flow — travel

travel은 자동화 runner 없이 사용자가 대화 중 문서를 갱신하는 흐름만 가진다.

## trip 생성

```text
사용자 요청
  -> 목적지와 기간 확인
  -> trip-id 결정
  -> trips/<trip-id>/ 디렉터리 생성
  -> 기본 문서 생성
  -> docs/index.md 갱신
```

기본 문서:

- `docs/trip-overview.md`
- `docs/itinerary.md`
- `docs/decision-log.md`

## 예약·고정 정보 정리

```text
항공, 숙소, 교통, 보험 정보
  -> trip-overview.md에 정리
  -> PDF, 이미지, CSV 같은 보조 자료는 data/에 보관
```

예약 번호와 세부 일정은 해당 trip 안에만 둔다.

## 일정 작성

```text
방문지, 식당, 활동 계획
  -> Day별 일정으로 정리
  -> itinerary.md 갱신
```

이동 시간, 예약 필요 여부, 대기 시간, 비상 대안을 함께 기록한다.

## 결정 기록

```text
결정 발생
  -> 결정 내용과 이유를 한 줄 또는 짧은 단락으로 정리
  -> decision-log.md에 추가
```

결정을 바꿀 때도 과거 줄을 지우기보다 새 결정을 추가한다.

## 출발 전 정리

```text
trip-overview.md + itinerary.md 검토
  -> 체크리스트 또는 요약 생성
  -> output/에 저장
```

## trip 종료

```text
귀가 후
  -> docs/index.md 상태 갱신
  -> 필요하면 memory/에 회고 작성
```

trip 디렉터리는 삭제하지 않고 보존한다.
