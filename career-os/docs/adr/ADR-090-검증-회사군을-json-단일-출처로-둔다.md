## ADR-090 — 검증 회사군을 verified-company-research-targets.json 단일 출처로 둔다

- Status: Accepted
- Date: 2026-06-16

### 맥락

검증 회사군(추천 시 회사 업사이드 판단 + 추가 수집 대상 가이드)이 세 곳에 분산됐다.

- `references/verified-company-research-targets.json` — 7개, 구조화(career URL·기술블로그·선호 도메인).
- `references/position-decision-criteria.md`·`position-recommendation-prompt.md` — 12개+ 텍스트 "최우선 탐색군", 서로 거의 동일한 문장으로 중복.

정의가 불일치하고(JSON에 카카오뱅크·카카오모빌리티·무신사·컬리·야놀자 누락) 텍스트 2곳이 중복돼 drift가 생긴다.
또 JSON은 LLM 프롬프트 주입에만 쓰이고 수집 adapter 코드는 JSON을 읽지 않아, 회사 메타와 수집 코드가 단절돼 있다.

### 결정

- 검증 회사군 JSON을 `references/`에서 `config/verified-company-research-targets.json`으로 옮겨 단일 출처로 둔다. 텍스트 목록의 회사를 JSON으로 흡수한다.
  - 이유 — career-os config는 사람이 큐레이션한 정책·외부 source registry이고 코드가 읽는 설정이다(`config/sources.json`과 같은 부류). 양방향(코드 discovery + LLM 주입) 소비에 맞고, `data-schema.md`가 스키마를 관리한다.
- 스키마를 코드와 LLM 양방향 소비를 고려해 설계한다.
  - 코드용 — `hasAdapter`·`adapterId`·`careerUrls`·`wantedKeywords`로 수집 커버리지와 discovery.
  - LLM용 — `tier`·`koreanName`·`preferredDomains`·`techBlogs`·`notes`로 업사이드 판단.
- `hasAdapter: false`인 회사는 adapter 추가 backlog로 본다([[ADR-091]] 후속 plan082 대상).
- `decision-criteria.md`·`prompt.md`의 텍스트 "최우선 탐색군" 목록은 제거하고 JSON을 역참조한다(거울 구조).
- 거절한 대안 — 텍스트 정본: 구조화(URL·도메인·adapter 상태) 이점을 잃는다. JSON 폐지: 업사이드 메타와 탐색 가이드를 LLM에 줄 단일 소스가 사라진다.

### 결과

- 검증 회사군 정의가 한 곳에 모인다. LLM 업사이드 판단과 추가 수집 대상이 단일 소스를 본다.
- `hasAdapter`로 수집 커버리지가 가시화돼 adapter 추가 우선순위를 식별한다.
- 코드가 JSON을 읽어 adapter를 라우팅하는 wire-up은 후속 plan에서 한다 — 본 ADR은 그 위에서 동작할 양방향 스키마까지만 확정한다.
- 단점 — 회사를 확장할 때 메타(career URL·선호 도메인)를 채우는 수작업이 든다.
