## ADR-033 — fos-study source tree를 study artifact 단일 진실원으로 사용

- Status: Accepted
- Date: 2026-05-18

### 맥락

study-topic-recommender가 `data/generated-artifacts.json`의 outputPath 집합을 "이미 생성됨" 근거로 사용해 fos-study 실제 트리와 drift가 발생했다.
inventory 갱신과 upsert가 분리되어 동기화가 보장되지 않았고, exact path match만 보므로 경로만 다른 유사 주제는 통과했다.
별도 인덱스를 유지하면 drift 비용이 가치보다 크므로 fos-study 자체를 진실원으로 삼는다.

### 결정

`career-os/sources/fos-study/**/*.md`를 generated study artifact의 단일 진실원으로 사용한다.

- `data/generated-artifacts.json`은 활성 동작에서 제거한다.
- study-topic-recommender는 fos-study 트리를 직접 스캔하며, 추천 실행 중 `git pull`은 하지 않는다.
- `topic-inventory.json`은 config pool 복사본이 아닌 실행/진단 스냅샷으로 축소한다.
- duplicate detection은 TS deterministic scan(path/slug/token)을 먼저 실행하고, Claude semantic review를 수행하는 2단계로 분리한다. TS는 provider-free로 동작한다.
- recommender와 writer가 같은 4라벨 duplicate decision schema(`new`, `update-existing`, `skip`, `needs-user-confirmation`)를 사용한다.

### 거절한 대안

- `generated-artifacts.json` 유지 + cross-sync 도입: drift 자체를 없애지 못하며 두 진실원을 정당화할 수 없다.
- duplicate detection helper를 `_shared/lib`로 즉시 승격: career-os/fos-study 구조에 강하게 묶여 있어 ADR-001 위반.
- duplicate review를 TS에서 직접 Claude API 호출: provider-free 원칙 위배이며 native skill이 단일 출처여야 한다.
- fos-study 자동 `git pull` 후 스캔: 추천 입력 무결성이 흔들리므로 사용자 로컬 clone 상태 그대로 사용한다.

### 결과

- fos-study가 "이미 존재하는 문서" 집합의 유일한 진실원이 된다.
- recommender와 writer 사이 duplicate 정책이 통일된다.
- 아침 markdown에 "보강 후보" 5개가 별도 섹션으로 노출되어 새 문서 vs 기존 문서 보강 의사결정이 명확해진다.
- 매 추천마다 fos-study 트리 스캔 비용이 추가되지만 본문을 읽지 않으므로 무시 가능하다.
