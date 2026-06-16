## ADR-070 — study topic 후보 풀은 LLM refresh turn이 발굴하고 config에는 active 캐시만 반영한다

- Status: Accepted
- Date: 2026-06-09

### 맥락

[[ADR-033]] 이후 `study-topic-recommender`는 `sources/fos-study/`를 직접 스캔해 이미 만들어진 학습 문서를 다시 추천하는 문제를 줄였다.
그러나 새 학습 후보는 여전히 `config/study-pack-candidates.json`의 seed/fallback 항목에 강하게 의존하고 있었다.
이 파일이 커질수록 추천이 고정 풀 순회처럼 보이고, 사용자가 새 관심사를 말해도 후보 발굴이 충분히 동적으로 움직이지 않는 문제가 있었다.

### 결정

- 새 후보 발굴은 별도 `candidate refresh turn`으로 분리한다.
  LLM이 후보를 제안한 뒤 deterministic 검증으로 4라벨(`new`, `update-existing`, `skip`, `needs-confirmation`)로 분류하고, `new` 후보만 config에 자동 append/update한다.
  나머지는 config에 반영하지 않고 runtime report에만 남긴다.
  이유: config를 전체 후보 정본이 아니라 active 후보 캐시로만 유지해 파일 크기가 추천 품질을 저하시키는 문제를 방지한다.
- active 자동 후보 수를 상한으로 제한하고, 오랫동안 선택되지 않은 자동 후보는 stale 처리 대상으로 본다.
- cron은 매일 무조건 후보를 보충하지 않는다.
  후보가 부족하거나, 추천 다양성이 떨어지거나, 사용자가 새 관심사나 지원·면접 맥락을 제공한 경우에만 refresh turn을 연다.

거절한 대안:

- seed/fallback 항목을 사람이 직접 계속 추가하는 방식: 관리 부담이 증가하고 사용자 관심사 변화에 늦게 반응한다.
- 매일 무조건 LLM으로 후보를 전체 갱신하는 방식: 비용이 높고 안정적인 후보가 매번 교체될 수 있다.

### 결과

- 추천이 고정 후보 파일 순회가 아니라 현재 맥락에서 새 후보를 발굴하는 구조가 된다.
- 기존 refresh 코드의 강점인 inventory scan, 중복 검증, history cooldown, RSS discovery는 유지된다.
- 후보 발굴 이유와 자동 반영 내역이 runtime report로 추적된다.
- 이미 만들어진 study pack은 새 후보가 아니라 기존 문서 보강 후보로 분류된다.
