## ADR-095 — 회사 업사이드 운영 데이터를 verified-company-research-targets.json 단일 출처로 흡수한다

- Status: Accepted
- Date: 2026-06-17

### 맥락

[[ADR-090]]에서 검증 회사군(tier·careerUrls·preferredDomains)을 `config/verified-company-research-targets.json` 단일 출처로 옮겼다.
그런데 회사별 *운영 데이터*는 아직 references 산문 2곳에 중복돼 있다.

- 쿨다운 상태(최근 지원 후 우선순위를 낮추는 회사, 토스 계열 쿨다운 해제 날짜).
- 선호 제외 회사(JD fit이 높아도 사용자 선호가 낮아 추천 티어에 올리지 않는 회사).

두 데이터가 `references/company-upside-reference.md`와 `references/position-decision-criteria.md`에 거의 같은 문장으로 산문 중복돼 있다.
한쪽만 갱신하면 drift가 생긴다(예: 쿨다운 해제 날짜를 한 파일에서만 고치는 경우).

position-recommender는 비대화형 분석이라 이 데이터는 "대화 가이드"가 아니라 "에이전트가 추천 판단에 참조하는 데이터"다.
tier가 이미 config JSON에 있는 것과 같은 부류이므로, 운영 데이터도 config가 맞다.

### 결정

회사별 운영 데이터(쿨다운·선호제외)를 `config/verified-company-research-targets.json` 단일 출처로 흡수한다. ADR-090의 연장이다.

- JSON 최상위에 `cooldown`(쿨다운 회사 + 해제 메모)과 `preferenceExcluded`(선호 제외 회사) 두 키를 추가한다.
  - tier가 이미 config에 있으므로, 같은 파일에 운영 데이터를 모아 회사 관련 단일 출처를 완성한다.
- `references/company-upside-reference.md`는 **방법론만** 남긴다.
  - 유지 — 평가 5축, 강력 추천 최소 조건, 배민/우아한 판단 기준의 *방법론*, 포지션 추천 출력 규칙.
  - 회사 데이터 — tier 목록·쿨다운·선호제외는 config를 역참조한다.
- `references/position-decision-criteria.md`의 쿨다운·선호제외 *데이터*도 config 역참조로 바꾼다. 판단 기준(쿨다운은 하드필터가 아니라 감점 신호다 등)은 산문에 남긴다.
- 거울 구조([[ADR-090]] 동일 원칙) — 같은 회사 목록을 md와 json 양쪽에 본문으로 두지 않는다. 방법론은 md, 회사 데이터는 config.
- 거절한 대안 — references 산문 정본 유지: drift가 계속 생기고, 비대화형 에이전트가 산문에서 데이터를 파싱해야 한다. tier만 config·운영 데이터는 산문: 회사 관련 단일 출처가 둘로 쪼개진다.

### 결과

- 쿨다운·선호제외 운영 데이터가 tier와 같은 파일에 모여, 회사 관련 정책이 단일 출처를 본다.
- 한 곳만 고치면 되므로 쿨다운 해제·선호제외 변경의 drift가 사라진다.
- references md는 *방법론*만 담아, 데이터 갱신 때 md를 건드리지 않는다.
- 단점 — 운영 데이터를 바꿀 때 산문이 아니라 JSON을 편집해야 하므로, JSON 유효성 점검이 필요하다.

### 적용

- `config/verified-company-research-targets.json`에 `cooldown`·`preferenceExcluded` 추가, `_meta.usage`에 단일 출처 한 줄 보강.
- `references/company-upside-reference.md` 회사 데이터를 config 역참조로 축약.
- `references/position-decision-criteria.md` 쿨다운·선호제외 데이터를 config 역참조로 전환.
- config 스키마 변경이므로 `docs/data-schema.md`의 verified-company-research-targets 항목에 두 키를 반영한다.
