## ADR-083 — source registry와 collection run은 fos-career DB가 정본이다

- Status: Accepted
- Date: 2026-06-15

### 맥락

fos-career 소스 진단 탭은 DB에 들어간 `collected_positions` 행의 `sourceDiagnostics` 텍스트를 다시 해석해 source 목록을 만들고 있었다.
이 때문에 최신 수집 설정에는 7개 source가 있어도 대시보드에는 과거 import에 남은 4개 source만 보였다.

최근 포지션 추천 재실행은 추천 후보 DB ingest를 갱신했지만, 전체 수집 snapshot import와 source diagnostics 갱신을 함께 보장하지 않았다.
추천 후보와 수집 공고 pool, source diagnostics가 서로 다른 최신성을 갖는 구조가 된 것이다.

사용자는 source 목록도 DB에서 관리하고, 앞으로 DB 연동 실수를 반복하지 않도록 수집 실행 자체를 추적하길 원한다.
또한 Naver Careers와 KakaoPay Securities처럼 0건 source가 있을 때 단순 0건이 아니라 왜 0건인지 후속 진단할 수 있어야 한다.

### 결정

- source registry와 collection run 상태는 fos-career MySQL이 정본이다.
- career-os `live-postings` adapter registry는 실제 수집 방법과 official entrypoint를 계속 소유한다.
- DB source registry는 dashboard 표시와 enable/disable 상태의 기준이다.
- 새 테이블을 도입한다.
  - `position_sources`
  - `position_collection_runs`
  - `position_source_run_diagnostics`
- `collected_positions`는 개별 공고 pool만 담당한다.
- `collected_positions.sourceDiagnostics` 같은 반복 저장 진단 텍스트는 migration compatibility로만 남긴다.
- source diagnostics 화면은 `collected_positions`에서 source 목록을 역산하지 않는다.
- source diagnostics 화면은 registry와 최신 collection run diagnostics를 읽는다.
- collection snapshot import는 Claude 추천 생성보다 먼저 수행한다.
- 추천 run은 사용한 `collectionRunId`를 참조한다.
- 추천 생성이나 recommendation ingest가 실패해도 collection run과 source별 diagnostics는 DB에 남긴다.
- source별 0건은 `zeroReason` 또는 `failureReason`으로 분리한다.
  - 정상 0건
  - 필터 과도
  - 파서 변경
  - 차단
  - 비활성
  - 알 수 없음
- registry에 있는 enabled source는 imported count가 0이어도 dashboard에 표시한다.
- Naver Careers와 KakaoPay Securities의 0건 원인은 plan075 후속 phase에서 source별로 진단한다.

### 결과

- source diagnostics가 오래된 collected position row에 끌려가지 않는다.
- "소스가 몇 개인가"와 "이번 run에서 몇 건을 import했는가"를 분리해 볼 수 있다.
- 추천 후보 5개가 어떤 collection run에서 나왔는지 추적할 수 있다.
- source별 실패가 다른 source 수집과 dashboard 표시를 막지 않는다.
- 0건 source를 정상 상태와 장애 상태로 구분할 수 있다.
- 단점은 DB schema, import pipeline, runner, dashboard가 함께 바뀌므로 plan075로 phase를 나눠 진행해야 한다는 점이다.

### 적용

- `docs/prd.md`
- `docs/data-schema.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `tasks/plan075-fos-career-source-registry-collection-runs/`
