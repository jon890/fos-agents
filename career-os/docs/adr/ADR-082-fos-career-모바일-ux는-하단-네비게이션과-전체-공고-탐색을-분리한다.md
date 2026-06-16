## ADR-082 — fos-career 모바일 UX는 하단 네비게이션과 전체 공고 탐색을 분리한다

- Status: Accepted
- Date: 2026-06-15

### 맥락

fos-career 대시보드는 포지션, 리포트, 소스 진단, 지원 현황, 우선 행동, 면접 hub로 메뉴가 늘었다.
모바일 상단 메뉴는 계속 가로로 늘어나며 실제 조작성이 떨어진다.

동시에 대시보드에는 두 종류의 포지션 데이터가 있다.
하나는 collector가 가져온 전체 수집 공고 풀이고, 다른 하나는 position recommender가 그중에서 선별한 지원 후보 5개다.
두 화면이 섞이면 사용자는 왜 후보가 5개인지, 수집된 나머지 공고는 어디서 보는지 이해하기 어렵다.

plan073 구현 뒤 확인한 structured recommendation item에는 `priorityReason`, `nextAction`, `evidenceUrls`가 null로 남는 사례가 있었다.
Markdown 리포트에는 근거가 있는데 DB snapshot이 비어 있으면 모바일 카드가 빈약해지고, 같은 DB 연동 실수를 반복할 수 있다.

### 결정

- 모바일 shell은 하단 네비게이션과 햄버거 또는 더보기 메뉴를 함께 사용한다.
- 하단 네비게이션 기본 항목은 `홈`, `공고`, `후보`, `지원`, `더보기`다.
- `공고`는 `collected_positions` 전체 풀을 보는 화면이다.
- `후보`는 position recommender가 선별한 application candidate 화면이다.
- 리포트, 소스 진단, 우선 행동, 면접 hub는 햄버거 또는 더보기 메뉴에서 접근한다.
- `/dashboard/positions`는 검색, 필터, 정렬, source diagnostics 접힘 영역을 갖춘 전체 공고 탐색 화면으로 개선한다.
- 추천 후보로 승격된 공고는 전체 공고 목록에서도 badge 또는 링크로 드러낸다.
- 추천 후보 카드 표시는 `latestSnapshotJson.priorityReason`, `nextAction`, `riskFlags`, `evidenceUrls`를 우선한다.
- Markdown 리포트에 있는 추천 이유와 다음 행동은 structured recommendation item 생성 또는 ingest 단계에서 누락 없이 추출한다.
- 추출 누락은 null로 조용히 통과시키지 않고 검증 로그나 dry-run summary에서 드러낸다.
- 작업 완료 후 당일 포지션 추천을 재실행하고, Toss 계열 쿨다운 해제와 구조화 추출 결과가 DB에 반영됐는지 확인한다.

### 결과

- 모바일에서 메뉴가 늘어나도 핵심 행동은 하단 네비게이션으로 유지된다.
- 전체 공고 탐색과 추천 후보 검토가 서로 다른 사용자 과업으로 분리된다.
- 지원 후보 5개는 “전체 수집 공고 중 선별된 후보”로 설명된다.
- 추천 카드가 빈 이유/다음 행동으로 보이는 문제가 줄어든다.
- 수집 공고 화면이 단순 raw list에서 실제 탐색 도구로 진화한다.

### 적용

- `docs/prd.md`
- `docs/data-schema.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `tasks/plan074-fos-career-mobile-position-explorer/`
