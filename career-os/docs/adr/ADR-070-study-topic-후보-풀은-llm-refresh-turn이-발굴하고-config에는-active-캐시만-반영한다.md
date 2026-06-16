## ADR-070 — study topic 후보 풀은 LLM refresh turn이 발굴하고 config에는 active 캐시만 반영한다

- Status: Accepted
- Date: 2026-06-09

### 맥락

`study-topic-recommender`는 [[ADR-033]] 이후 `sources/fos-study/`를 직접 스캔한다.
따라서 이미 만들어진 학습 문서를 새 study pack으로 다시 추천하는 문제는 줄었다.

하지만 새 학습 후보는 여전히 `config/study-pack-candidates.json`의 seed/fallback 항목에 강하게 의존한다.
이 파일이 커질수록 추천이 고정 풀 순회처럼 보이고, 사용자가 새 관심사를 말해도 후보 발굴이 충분히 동적으로 움직이지 않는다.

기존 `refresh_topic_inventory.ts`는 재사용할 가치가 있다.
이 스크립트는 fos-study inventory, deterministic dedupe, 최근 추천 history, RSS discovery, markdown rendering을 이미 처리한다.
다만 이름과 달리 새 후보를 LLM으로 탐색해 config에 반영하는 단계는 거의 없다.

### 결정

- `refresh_topic_inventory.ts`는 inventory refresh와 추천 스냅샷 생성을 계속 담당한다.
- 새 후보 발굴은 별도 `candidate refresh turn`으로 분리한다.
- 후보 refresh turn은 다음 입력을 읽는다.
  - `sources/fos-study/` inventory
  - `config/study-preferences.json`
  - `config/study-progress.json`
  - 최근 `data/runtime/topic-inventory-history.jsonl`
  - 현재 추천 실행 맥락 또는 사용자 자연어 관심사
- 후보 refresh turn은 LLM이 10-20개 후보를 제안한 뒤 deterministic 검증으로 분류한다.
  분류 값은 `new`, `update-existing`, `skip`, `needs-confirmation`이다.
- `new` 후보만 `config/study-pack-candidates.json`에 자동 append/update한다.
- `update-existing`, `skip`, `needs-confirmation`은 config에 반영하지 않고 runtime report에만 남긴다.
- `config/study-pack-candidates.json`은 전체 후보 정본이 아니라 active 후보 캐시와 사람이 고른 seed/pin 목록이다.
- 자동 후보 항목은 `source: "llm-candidate-refresh"`, `generatedAt`, `status`, `sourceSignals`, `promotionTarget.outputPath`를 가진다.
- active 자동 후보는 기본 30개를 넘기지 않는다.
  30일 이상 선택되지 않은 자동 후보는 `stale` 처리 대상이다.
- 후보 refresh 실행 기록은 `data/runtime/study-topic-candidate-refresh.json`과 `.md`에 남긴다.
- cron은 매일 무조건 후보를 보충하지 않는다.
  추천 실행 중 다음 조건이면 후보 refresh turn을 연다.
  - 새 후보가 5개 이하
  - 최근 7회 추천에서 같은 domain/tag 반복이 과도함
  - 사용자가 새 관심사를 말함
  - 새 지원·면접 맥락이 생김
  - 이미 만든 문서가 새 추천 후보에 많이 섞임
- cron 자동 후보 refresh는 하루 1회로 제한한다.
- 추천 결과와 정기 실행 요약은 `#병태-이직준비방`으로 보낸다.
  개발·운영 상태와 오류 분석은 `#병태-개발공부방`에 둔다.

### 결과

- 추천은 고정 후보 파일 순회가 아니라, 현재 맥락에서 새 후보를 발굴하는 구조가 된다.
- 기존 refresh 코드의 강점인 inventory scan, 중복 검증, history cooldown, RSS discovery는 유지된다.
- config는 계속 작게 유지하면서도, 검증을 통과한 후보는 자동으로 다음 추천 입력에 들어간다.
- 이미 만들어진 study pack은 새 후보가 아니라 기존 문서 보강 후보로 분류된다.
- 후보 발굴 이유와 자동 반영 내역이 runtime report로 추적된다.

### 적용

- `config/study-pack-candidates.json`
- `data/runtime/study-topic-candidate-refresh.json`
- `data/runtime/study-topic-candidate-refresh.md`
- `data/runtime/topic-inventory.json`
- `scripts/study-topic-recommender/`
- `.claude/skills/study-topic-recommender/SKILL.md`
- `docs/data-schema.md`
- `docs/flow.md`
- `docs/code-architecture.md`
