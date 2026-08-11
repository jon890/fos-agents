## ADR-103 — 회사 키워드·AI 랭킹 규칙 단일 출처

- Status: Accepted
- Date: 2026-07-07

### 맥락

position-recommender의 회사 탐색 키워드와 AI 전환 레인 랭킹 규칙이 여러 파일에 흩어져 있다.

회사별 탐색 키워드가 두 곳에 이중 기재됐다.

- `config/position-collection.json`의 `wanted.targetKeywords`
- `config/verified-company-research-targets.json`의 `priorityCompanies[].wantedKeywords`

AI 전환 레인의 랭킹·다운랭크 규칙도 네 곳에 분산됐다.

- `config/position-collection.json`의 `interestProfile`(`rankingBias`·`downrankPatterns`·`preferredPatterns`)
- `.claude/skills/position-recommender/references/position-decision-criteria.md`
- `.claude/skills/position-recommender/references/company-upside-reference.md`
- `.claude/skills/position-recommender/references/position-recommendation-prompt.md`

두 가지 문제가 생긴다.

- `position-collection.json`의 `_meta.purpose`는 "수집 설정"인데 랭킹 규칙과 회사 키워드가 섞여 이름과 내용이 어긋난다.
- 같은 회사 키워드를 두 파일에서 각각 갱신해야 해 drift가 쌓인다.

비회귀 처리가 필요한 지점도 있다.
`position-collection.json.targetKeywords`에는 verified `priorityCompanies` 13개에 없는 회사 키워드가 다수 포함돼 있다.
삼성SDS, LG CNS, SK 계열, 현대오토에버, KT, 카카오(corp), 카카오엔터프라이즈, 카카오헬스케어, NAVER Cloud, Works Mobile이 여기 해당한다.
단순히 회사 키워드를 verified로만 모으면 이 회사들의 수집 커버리지가 사라진다.

### 결정

회사 키워드와 랭킹 규칙을 관심사별 단일 출처로 재편한다.

- 회사별 탐색 키워드의 단일 출처는 `config/verified-company-research-targets.json`이다.
  `priorityCompanies[].wantedKeywords`가 검증 회사군의 키워드를 소유한다.
- 회사 비종속 role 키워드의 단일 출처는 `config/position-collection.json`의 `wanted.targetKeywords`다.
  회사명이 붙지 않은 순수 직무 키워드만 둔다(예: `AI Agent 백엔드`, `Applied AI Engineer`, `LLM 백엔드`).
- 랭킹 방법론(2개 이상 조건 판단, 가점·감점 규칙 등)의 단일 출처는 `position-decision-criteria.md`다.
  데이터성 관심사 리스트(테마·선호·다운랭크 패턴)는 `position-collection.json`의 `interestProfile`에 둔다.
  `company-upside-reference.md`·`position-recommendation-prompt.md`는 방법론을 역참조하고 규칙 본문을 중복 기재하지 않는다.
- 비회귀 처리: verified에 저-tier `secondaryCompanies` 목록을 신설한다.
  priorityCompanies에 없던 회사 키워드를 이 목록으로 옮겨 모든 회사 키워드를 verified 단일 출처로 모은다.
  수집 커버리지를 유지하면서 회사 키워드 이중 기재를 없앤다.
- 수집 코드는 verified(회사 키워드)와 position-collection(role 키워드) 두 소스를 merge해 탐색 키워드 집합을 만든다.

### 결과

- 회사 키워드는 verified 한 곳에서만 갱신하면 된다.
- `position-collection.json`은 이름대로 role 키워드와 수집 설정만 담아 이름과 내용이 맞는다.
- 랭킹 규칙 본문이 한 곳(`position-decision-criteria.md`)에 모여 references drift가 줄어든다.
- non-priority 회사 키워드를 `secondaryCompanies`로 보존해 수집 커버리지 회귀가 없다.

### 적용

- verified JSON에 `secondaryCompanies` 목록을 추가하고, non-priority 회사 키워드를 이동한다.
- `position-collection.json.targetKeywords`에서 회사명이 붙은 키워드를 제거하고 role 키워드만 남긴다.
- 수집 코드(`scripts/position-recommender/`)가 두 소스를 merge하도록 wire-up한다.
- 회사 데이터 config 흡수 패턴은 [[ADR-090]]·[[ADR-095]]를 재사용한다.
- `data-schema.md`의 verified 스키마 표에 `secondaryCompanies`를 반영한다.
