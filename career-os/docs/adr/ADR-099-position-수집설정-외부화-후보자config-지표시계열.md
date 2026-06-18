## ADR-099 — position-recommender 수집 설정 외부화 + 후보자 config + 지표 시계열

- Status: Accepted
- Date: 2026-06-18

### 맥락

position-recommender를 실사용·고도화하면서 세 가지 한계가 드러났다.

- **수집 설정 하드코딩**: `wanted.ts`에 `job_group_id=518`(개발 직군), `years=3`(경력 필터), `WANTED_TARGET_KEYWORDS` 28개가 코드에 박혀 있어 실험·튜닝이 불가능하다.
- **경력 미스매치**: `years=3`은 경력 필터로 보이는데 후보자는 7년차다. 저연차 공고가 섞이거나 시니어 공고를 놓칠 수 있다. 후보자 경력이 구조화 값으로 어디에도 없다(`candidate-profile.md`는 prose).
- **개선 측정 불가**: 스킬을 바꿔도 "개선됐는지"를 볼 지표 시계열이 없다. 수집 diagnostics는 그날 로그로만 남고 누적·비교가 안 된다(`logs/` 비어 있음).

설정이 코드에 고정돼 있으면 실험할 수 없고, 지표가 없으면 개선 여부를 숫자로 확인할 수 없다.

### 결정

수집 설정을 외부화하고, 후보자 사실을 구조화하고, 개선을 측정할 지표 시계열을 도입한다.

- **수집 설정 외부화** → `config/position-collection.json` (신규). `wanted`의 `jobGroupId`·`targetKeywords`를 담고, `wanted.ts`가 하드코딩 대신 이 config를 읽는다.
- **후보자 사실 config** → `config/candidate-config.json` (신규). `experienceYears`(7) 등 코드가 읽는 구조화 사실만 둔다. `candidate-profile.md`는 LLM 프롬프트용 prose로 유지한다.
  - **거울 구조**: 같은 사실을 두 곳에 본문으로 두지 않는다. 사실은 JSON이 정본, prose는 서술 중심. prose의 풍부한 강점·약점·의사결정 서사가 LLM 진단·추천 품질을 살린다.
- **years 매핑**: wanted `years` 파라미터를 후보자 경력 기반으로 도출한다. 파라미터의 정확한 의미(단일/범위)는 구현 phase에서 실측 검증 후 7년차에 맞춘다.
- **지표 시계열** → `logs/position-metrics.jsonl` (신규, 날짜별 1줄 append). 자동 계측 가능한 수집 건강·추천 건강 지표를 누적해 기준선 대비 개선을 추적한다.

### 결과

- 수집 설정을 config에서 바꿔 실험할 수 있다(키워드·연차·직군 튜닝).
- 후보자 경력 7년이 wanted 검색·추천 연차 매칭에 반영돼 시니어 공고 적합도가 오른다.
- 지표 시계열로 "경력을 7년으로 맞췄더니 시니어 공고 비율이 올랐다" 같은 개선을 숫자로 확인한다.
- `candidate-config.json`은 position 외 job-fit 등 다른 스킬도 후보자 사실을 공유할 수 있다(후속 연동).

### 적용

- `wanted.ts`·`collect_live_postings.ts`가 `position-collection.json`·`candidate-config.json`을 읽도록 한다.
- 지표 기록 helper를 추가하고 수집·추천 후 `position-metrics.jsonl`에 append한다.
- 구현은 plan090 phase로 옮긴다. `data-schema.md`·`flow.md`·`code-architecture.md`·`prd.md`에 반영한다.
- 구조 정본 패턴은 [[ADR-094]](JSON 정본)·[[ADR-095]](회사데이터 config 흡수)를 재사용한다.
