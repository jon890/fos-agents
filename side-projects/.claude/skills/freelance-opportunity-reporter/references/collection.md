# 외주 공고 수집 기준

이 문서는 목록 화면의 일부만 보고 공고 수집을 끝내지 않기 위한 기준이다.
수집 누락과 분류 제외를 구분할 수 있는 근거를 남긴다.

## 수집 단위

플랫폼과 공고 식별자의 조합을 고유 키로 사용한다.
제목이나 목록 순서는 고유 키로 사용하지 않는다.

각 공고에 아래 필드를 저장한다.

- `platform`
- `project_id`
- `title`
- `url`
- `registered_at`
- `collected_at`
- `list_page`
- `collection_source`
- `detail_status`
- `eligibility_status`
- `exclusion_reason`

상세 확인 전 공고도 원자료에 저장한다.
적합하지 않은 공고는 `eligibility_status`와 `exclusion_reason`으로 분류한다.

## 원자료 형식

`reports/freelance-opportunities-YYYY-MM-DD.json`은 아래 구조를 사용한다.

```json
{
  "collected_at": "2026-07-27T13:06:00+09:00",
  "collection": [
    {
      "platform": "Wishket",
      "source_id": "wishket-outsourcing-open",
      "advertised_count": 50,
      "pages_scanned": 5,
      "stopped_after_no_new_ids": 2
    }
  ],
  "items": [
    {
      "platform": "Wishket",
      "project_id": "157210",
      "title": "업비트·빗썸 신규 공지 감지 파이썬 스크립트 개발",
      "url": "https://www.wishket.com/project/157210/",
      "registered_at": "2026-07-27",
      "collected_at": "2026-07-27T16:15:00+09:00",
      "list_page": 1,
      "collection_source": "wishket-outsourcing-open",
      "detail_status": "confirmed",
      "eligibility_status": "candidate",
      "exclusion_reason": null
    }
  ]
}
```

## 목록 수집 절차

1. 필터와 목록 주소의 조합을 `source_id`로 정하고 플랫폼이 표시한 전체 공고 수를 기록한다.
2. 페이지 이동이나 무한 스크롤마다 새 공고 식별자를 저장한다.
3. 새 식별자가 나오지 않는 상태를 두 번 연속 확인할 때까지 진행한다.
4. 표시 건수보다 고유 식별자가 적으면 한 번 다시 시도한다.
5. 다시 시도해도 차이가 남으면 수집 상태를 `incomplete`로 둔다.
6. 상세 페이지 실패는 목록 공고를 삭제하지 않고 `detail_status`에 기록한다.
7. `scripts/audit_collection.py`로 중복, 필수 필드, 표시 건수 차이를 검사한다.

관련 추천이나 검색 결과처럼 표시된 전체 건수가 없는 수집 범위는 별도 `source_id`를 사용한다.
이 경우 `coverage_expected`를 `false`로 두어 기본 목록의 누락 수를 상쇄하지 않게 한다.

수집이 불완전하면 리포트를 만들 수는 있다.
다만 `전수 수집`이라고 표현하지 않고 리포트 첫 부분에 누락 수와 실패 원인을 표시한다.

## 증분 수집

가장 최근 원자료가 있으면 공고 식별자를 비교한다.
이전 파일에 없던 식별자는 `new_since_last_scan`을 `true`로 둔다.

같은 날 추가 수집한 공고는 기존 원자료에 합친다.
별도 추가 검토 섹션만 만들지 않는다.
합친 원자료로 점수, 요약, 표 순위, 다음 행동을 다시 계산한다.
