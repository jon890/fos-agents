# Config 정리 findings 백로그 (2026-07)

career-os config·references·skill-input의 중복·관심사 혼입·wiring 문제를 감사한 결과다.
바로 실행하는 plan이 아니라, 향후 planning 세션의 입력으로 쓰는 findings 기록이다.
구조 변경(단일 출처 재편, config 분리)은 config + 수집 코드 + references + SKILL 문서를 함께 바꾸는 coordinated 변경이라, 구현 전 ADR/planning으로 결정을 고정한다.

기존 관련 plan: `plan002-config-consolidation`, `plan068-config-diet`(ADR-069). 이 findings는 그 후속이다.

## 높음

### 1. 회사 키워드·AI 랭킹 규칙 분산 (중복 + 관심사 혼입)
- 회사별 Wanted 키워드가 이중 기재.
  - `config/position-collection.json` `wanted.targetKeywords`
  - `config/verified-company-research-targets.json` `priorityCompanies[].wantedKeywords`
- AI 전환 레인 랭킹/다운랭크 규칙이 4곳에 분산.
  - `config/position-collection.json` `interestProfile`(rankingBias·downrankPatterns·preferredPatterns)
  - `.claude/skills/position-recommender/references/position-decision-criteria.md`
  - `.claude/skills/position-recommender/references/company-upside-reference.md`
  - `.claude/skills/position-recommender/references/position-recommendation-prompt.md`
- `position-collection.json`은 `_meta.purpose`가 "수집 설정"인데 랭킹 규칙이 섞여 이름-내용 불일치.
- 제안: 회사별 키워드는 `verified-company-research-targets.json` 단일 출처, `position-collection.json`은 회사 비종속 role 키워드만. 데이터성 관심사(리스트)는 `interestProfile`, 방법론(2개 이상 조건 등)은 `position-decision-criteria.md` 단일 출처, 나머지는 역참조. 수집 코드가 두 소스를 merge.

### 2. 고아 config `topic-file-map.json`
- `config/topic-file-map.json` — 어떤 SKILL·스크립트도 읽지 않는다(interview-prep-analyzer 소비자 미연결).
- 단순 삭제 불가: `docs/data-schema.md`, `docs/code-architecture.md`, `docs/adr/ADR-016`, `docs/adr/ADR-001`, `tasks/plan017-*`가 참조하므로 삭제 시 해당 문서도 함께 정리해야 한다.
- 제안: interview-prep-analyzer에 연결하거나, 삭제 + 참조 문서 정리. 결정 필요.

## 중간

### 3. `study-progress.json` 관심사 혼재 + 스키마 drift
- `config/study-progress.json` `sessions`(학습 이력, study-topic-recommender)와 `weak_spots`(드릴 간격 반복, tech/behavioral-interview-drill)가 한 파일에 있고 writer가 다르다.
- `weak_spots` 스키마 drift: SKILL 문서(`tech-interview-drill/SKILL.md`, `behavioral-interview-drill/SKILL.md`)는 `pass_count·fail_count·next_review_date`로 기술하나, 실데이터·`scripts/interview-drill/drill-engine.ts`의 `WeakSpotEntry` 타입과 필드 셋이 어긋난다.
- 제안: 드릴 간격 반복 상태를 `config/drill-progress.json`으로 분리하거나, `weak_spots` 스키마를 문서·타입·실데이터로 통일.

### 4. techBlog URL 중복
- `verified-company-research-targets.json` `priorityCompanies[].techBlogs` ↔ `config/external-reading-sources.json` `techBlog.items[].url`에 같은 회사 블로그 URL 재수록.
- 제안: URL 정본은 `external-reading-sources.json`, verified 쪽은 key 참조만.

### 5. Tech Lead/CTO·Toss 범용공고 제외 규칙 중복
- `.claude/skills/position-recommender/SKILL.md`와 `references/position-decision-criteria.md`에 거의 동일 문장.
- 제안: `position-decision-criteria.md`를 단일 출처로, SKILL.md는 역참조.

### 6. `mvp-target.json` history ↔ cooldown 탈락시점 중복
- `config/mvp-target.json` `history`의 탈락 이력(CJ 등)과 `verified-company-research-targets.json` `cooldown.active`의 `failedAt`이 같은 사실을 이중 관리.
- 제안: cooldown이 탈락 시점 정본, history는 참조 또는 날짜 중복 제거.

## 낮음

- 고용형태(계약직/프리랜서 제외) 규칙이 candidate-profile·company-upside·decision-criteria·prompt 4곳 반복. profile=사실, criteria=규칙으로 역할이 다르나 규칙 문구는 criteria에만.
- Kotlin(갭 아님)·TCP/UDP 제외 규칙이 candidate-profile ↔ decision-criteria 중복. profile은 사실, criteria는 규칙으로 유지 가능하나 규칙 문구는 criteria에만.
- `verified-company-research-targets.json`이 정적 reservoir + 동적 쿨다운 혼재(ADR-095 의도). 쿨다운이 커지면 분리 검토.
- `baseline-core-files.json` `note`에 provenance 혼입.

## 정상 확인 (변경 불필요)

- `candidate-profile-provenance.md` 분리는 정합. 어떤 skill도 판단에 안 쓰던 추적 정보라 프롬프트 주입 축소 효과만 있고 부작용 없음.
- config↔skill 끊긴 링크 없음. 쿨다운·선호제외 단일 출처(ADR-095) 준수(references는 역참조).

## candidate-profile.md skill-input 심화 slim (별도 결정)

- `candidate-profile.md`는 9개 skill이 공유하는 프롬프트 주입 입력이다.
- 면접용 섹션(주요 프로젝트 서사·의사결정 패턴·협업·면접 준비 우선순위)은 추천 판단엔 거의 안 쓰이지만 interview 계열 skill이 사용한다.
- 따라서 in-file 삭제는 interview skill을 해친다. 심화 slim은 core(추천/fit) ↔ detail(면접) 파일 분리가 필요하고, 이는 9개 skill의 Inputs를 함께 바꾸는 변경이라 ADR로 결정한다.
- 1차 slim(provenance 분리)은 완료.
