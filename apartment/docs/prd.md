# apartment 제품 요구사항

apartment 워크스페이스는 아파트 시세 조사와 인테리어 의사결정을 위한 로컬 리포트 워크스페이스다.
사용자가 실제 행동을 판단할 수 있도록 확인된 데이터, 불확실성, 다음 확인 항목을 분리한다.

## 목적

- 타깃 단지의 시세와 매물 신호를 날짜별 리포트로 남긴다.
- Guri 광역 매수 후보를 같은 기준으로 비교한다.
- 인테리어 레퍼런스와 의사결정 질문을 꾸준히 정리한다.
- 외부 전달 채널이 바뀌어도 로컬 파일과 표준 출력으로 결과를 확인할 수 있게 한다.

## 현재 타깃

단지, 주소, 면적과 외부 식별자는 `config/focus-unit.json`을 단일 출처로 삼는다.

## 기능

| 기능 | 입력 | 산출물 |
|---|---|---|
| 일일 시세 리포트 | `config/focus-unit.json`, 선택 `.env`, 외부 소스 수집 결과 | `data/YYYY-MM-DD/{raw-search.json, summary.json, report.md}` |
| 수집 smoke test | 현재 수집기와 정규화기 | 임시 `raw-search.json`, `summary.json`, stdout 결과 |
| 인테리어 레퍼런스 디제스트 | `config/interior-reference-digest.json`, `docs/interior/*.md`, 웹 검색 결과 | `data/interior-reference-digest/YYYY-MM-DD/report.md` |
| 인테리어 의사결정 HTML 뷰 | `docs/interior/*.md` | `data/interior-reference-digest/YYYY-MM-DD/decision-view.html` |

## 59A 표기 정책

- exact: `59A`, `59-A`, `59 A`, 전용 59㎡, 타입 프로필 직접 매칭.
- unverified: `59형`, `전용59`, `59㎡` 키워드만 확인된 경우.
- non-match: 단지 전체 평균, 다른 평형, 타입이 불명확한 값.

non-match 값을 59A 확인값으로 표기하지 않는다.
unverified 값은 타입 미확인이라고 쓴다.

## Guri 광역 탐색 정책

Guri 광역 탐색 후보와 제외 기준은 `config/guri-buy-complexes.json`을 따른다.

- 입지, 생활 동선, 대중교통 접근성을 가격 정렬보다 앞에 둔다.
- 세안고, 전세안고, 월세승계, 갭투자 가능성이 큰 매물은 제외하거나 강하게 감점한다.
- 입주 조건 데이터가 없으면 전화 확인 대상으로 표기한다.
- 통근 시간은 검증 가능한 근거가 있을 때만 쓴다.

## 산출물 원칙

- 리포트는 항상 로컬 파일로 남긴다.
- 스킬은 생성 경로와 공개 가능한 짧은 요약을 반환한다.
- 외부 전달 채널과 자동 실행 시점은 저장소 밖에서 정한다.
- 공개 HTML URL이 필요하면 루트 `report-publisher`로 공개 범위와 배포 결과를 검증한다.

## 성공 기준

- source 수집 실패 시 실패 사실과 raw 결과를 남긴다.
- 확인된 사실과 추론이 구분된다.
- 59A 타입 확인 정책이 지켜진다.
- 인테리어 결정 원본은 `docs/interior/*.md`에 남고, HTML은 표시용으로만 쓰인다.
- 같은 날 재실행해도 산출물 위치와 의미가 흔들리지 않는다.
