## ADR-109 — 회사 cooldown을 state/company-cooldown.json으로 분리한다

- Status: Accepted
- Date: 2026-07-08
- Supersedes: [[ADR-095]]의 cooldown 흡수 부분

### 맥락

[[ADR-095]]는 회사별 운영 데이터(쿨다운·선호제외)를 `config/verified-company-research-targets.json` 단일 출처로 흡수했다.
당시 판단은 "tier가 config에 있으니 운영 데이터도 config"였다.

그러나 ADR-107의 config/state 구분 기준으로 다시 보면 둘의 변경 트리거가 다르다.

- `cooldown` — 지원 결과 이벤트로 갱신한다. 시스템 실행·이벤트가 트리거이므로 state다.
- `priorityCompanies`·`preferenceExcluded` — 사용자가 검증군과 선호를 의도적으로 정한다. config다.

같은 파일에 config와 state를 섞으면, 지원 결과가 생길 때마다 사람이 검토·승인하는 config 파일을 자동으로 건드리게 된다.

### 결정

`verified-company-research-targets.json`의 `cooldown`을 `state/company-cooldown.json`으로 분리한다.

- `cooldown.active[]`·`cooldown.notes`를 `state/company-cooldown.json`으로 옮긴다.
- `priorityCompanies`·`preferenceExcluded`·`secondaryCompanies`·회사 키워드는 `config/verified-company-research-targets.json`에 그대로 둔다.
- cooldown은 여전히 하드필터가 아니라 우선순위 감점 신호다(ADR-095 판단 기준 유지).
- `company-cooldown.json`은 해제 날짜라는 지속 가치가 있는 결정을 담으므로 git 추적을 유지한다(tracked, 이동표에서 negation 확정).

[[ADR-095]]의 cooldown 흡수 결정만 본 ADR로 대체한다.
[[ADR-095]] 본문은 동결하고 수정하지 않는다.
preferenceExcluded를 config에 두는 ADR-095·ADR-090의 결정은 그대로 살아 있다.

### 거절한 대안

- cooldown을 config에 유지 — 지원 결과 이벤트가 사람 검토용 config 파일을 자동 갱신해, config/state 구분(ADR-107)이 무너진다.
- cooldown을 untracked runtime으로 전환 — 해제 날짜 결정 이력이 clone 간에 사라진다.

### 결과

- 지원 결과 이벤트는 `state/`만 건드리고, 사람이 검토하는 `config/`는 건드리지 않는다.
- `verified-company-research-targets.json`은 사용자 의도 데이터(검증군·선호·키워드)만 남는다.
- 단점 — cooldown을 참조하는 position-recommender 계열이 두 파일을 함께 읽어야 한다.

### 적용

- `config/verified-company-research-targets.json`에서 `cooldown` 키를 제거하고 `state/company-cooldown.json`으로 옮긴다.
- cooldown을 읽는 references 산문·스크립트의 경로 참조를 새 위치로 갱신한다.
- `docs/data-schema.md`의 verified-company 항목에서 `cooldown` 행을 `state/company-cooldown.json` 항목으로 옮긴다.
- `docs/adr/INDEX.md`의 ADR-095 Status에 본 ADR의 supersede 관계를 링크한다.
