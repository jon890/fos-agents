## ADR-083 — source registry와 collection run은 fos-career DB가 정본이다

- Status: Accepted
- Date: 2026-06-15

### 맥락

fos-career 소스 진단 탭이 `collected_positions` 행의 `sourceDiagnostics` 텍스트를 역산해 source 목록을 만들고 있었다.
최신 수집 설정에는 7개 source가 있어도 대시보드에는 과거 import에 남은 4개만 보이는 문제가 생겼다.
추천 후보, 수집 공고 pool, source diagnostics가 서로 다른 최신성을 갖는 구조였다.
0건 source가 있을 때 단순 0건이 아니라 왜 0건인지 후속 진단할 수 없었다.

### 결정

- source registry와 collection run 상태는 fos-career MySQL이 정본이다.
- career-os `live-postings` adapter registry는 실제 수집 방법과 공식 진입점을 소유한다.
- DB source registry는 dashboard 표시와 enable/disable 상태의 기준이다.
- source registry, collection run, source별 run diagnostics를 위한 전용 테이블을 도입한다.
- `collected_positions`는 개별 공고 pool만 담당한다. source 목록을 역산하는 데 쓰지 않는다.
- collection snapshot import는 Claude 추천 생성보다 먼저 수행하며, 추천 run은 사용한 collection run을 참조한다.
- 추천 생성이 실패해도 collection run과 source별 diagnostics는 DB에 남긴다.
- registry에 있는 enabled source는 import 건수가 0이어도 dashboard에 표시한다.

### 결과

- source diagnostics가 오래된 collected position 행에 끌려가지 않는다.
- "소스가 몇 개인가"와 "이번 run에서 몇 건을 import했는가"를 분리해 볼 수 있다.
- 추천 후보가 어떤 collection run에서 나왔는지 추적할 수 있다.
- 0건 source를 정상 상태와 장애 상태로 구분할 수 있다.
- DB schema, import pipeline, runner, dashboard가 함께 바뀌므로 plan075로 phase를 나눠 진행한다.
