## ADR-094 — 포지션 추천 산출물을 JSON 정본으로 전환한다

- Status: Accepted
- Date: 2026-06-17

### 맥락

position-recommender는 현재 `report.md`를 정본으로 두고, HTML·items.json·DB ingest가 각각 markdown을 다시 파싱한다.
실사용 고도화 세션(2026-06-17)에서 이 구조의 한계가 드러났다.

- **markdown 3중 파싱**: 같은 report.md를 HTML 렌더러·items 추출기·DB ingest가 각각 재파싱한다.
- **자체 파서 fragility**: HTML 렌더러가 들여쓴 하위 항목을 평탄화하거나 `<ol><li>` 안에 `<ul>`을 형제로 붙이는 부정확한 구조를 만든다.
- **정보 손실**: SKILL self-check는 14개 라벨을 강제하는데, items.json은 그중 6개만 추출해 나머지가 DB·Discord로 전달되지 못한다.
- **단일 구조 출처 부재**: HTML·Discord 카드·DB가 모두 구조화 데이터를 요구하지만 공통 정본이 없어 변환이 흩어져 있다.

산문 markdown은 사람이 읽기엔 좋지만, 기계가 여러 출력으로 파생하기엔 깨지기 쉬운 중간 표현이다.

### 결정

산출물 정본을 **구조화 JSON**(`recommendation.json`, schemaVersion 2)으로 올린다.

- 에이전트는 자유 산문 대신 **고정 스키마 JSON을 채운다**. SKILL이 이미 14개 라벨을 강제하므로 실질 제약 증가는 작다.
- 렌더러가 JSON 하나에서 **HTML·Markdown·Discord 카드·DB items를 파생**한다.
- 템플릿은 **디자인·스타일만 정의**하고 데이터 바인딩만 한다. fragile한 자체 markdown 파서는 폐기한다.
- self-check를 markdown grep에서 **zod 스키마 검증**으로 전환한다.
- `report.md`는 폐기하지 않고 JSON에서 파생하는 **사람 읽기용 산출물**로 둔다. 기존 freshness 가드와 기록 호환을 유지하기 위함이다.

핵심 전환: **정본을 산문에서 구조로 옮긴다.** 구조가 정본이면 렌더링이 깨질 수 없고, 모든 출력이 한 소스에서 일관되게 나온다.

### 결과

- markdown 3중 파싱이 사라져 렌더링이 입력 형식에 흔들리지 않는다.
- 14개 라벨이 손실 없이 items·DB·Discord로 전달된다.
- 스타일과 데이터가 분리돼 디자인 변경이 템플릿 한 곳에서 끝난다.
- 한 JSON에서 HTML·Markdown·Discord가 파생돼 출력 간 불일치가 사라진다.
- zod 검증이 텍스트 grep보다 견고해 누락·형식 오류를 구조적으로 막는다.

### 적용

- zod 스키마는 `scripts/position-recommender/recommendation_schema.ts`로 둔다([[ADR-019]] scripts 분리, [[ADR-031]] _lib 폐기 원칙에 따라 skill scripts 내부에 둔다).
- 전환 phase는 plan에서 확정한다.
  - 스키마 확정 → 렌더러를 JSON 입력으로 전환 → `structured_recommendation_items.ts`를 JSON→items로 단순화 → SKILL.md self-check를 스키마 검증으로 교체 → `run_daily_with_claude` flow 정렬.
- 데이터 스키마 변경(`recommendation.json` 구조, items.json 관계)은 `docs/data-schema.md`에 반영한다.
- 본 결정은 [[ADR-030]](agent skill 직접 읽기/쓰기)의 산출물 책임을 구조화 정본으로 구체화한다.
