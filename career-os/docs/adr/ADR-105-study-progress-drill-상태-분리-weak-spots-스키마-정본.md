## ADR-105 — study-progress ↔ drill 상태 분리 + weak_spots 스키마 정본

- Status: Accepted
- Date: 2026-07-07

### 맥락

`config/study-progress.json`은 성격이 다른 두 상태를 한 파일에 담고, writer도 다르다.

- `sessions` — 학습 이력. `study-topic-recommender` 학습 흐름이 쓴다.
- `weak_spots` — 약점 추적. topic 학습 상태와 드릴 간격 반복 상태가 한 엔트리에 섞여 있다.

`weak_spots` 스키마에도 drift가 있다.

- SKILL 문서(`tech-interview-drill`·`behavioral-interview-drill`)와 `docs/data-schema.md`는 `question_id`·`shallow_count`·`unknown_count` 같은 필드를 기술한다.
- 실제 코드 `scripts/interview-drill/drill-engine.ts`의 `WeakSpotEntry` 타입과 실데이터에는 그 필드들이 없다.
- 문서·타입·실데이터의 필드 셋이 어긋난다.

한 엔트리에 두 관심사가 섞여 있어, 어느 필드를 어느 writer가 소유하는지 불명확하다.

### 결정

`weak_spots` 엔트리를 관심사별 2타입으로 정본화하고, 코드 타입(`WeakSpotEntry`)과 실데이터를 스키마 정본으로 삼는다.

topic 학습 상태는 `config/study-progress.json`의 `weak_spots`에 잔류한다.

- `last_studied`
- `study_count`
- `last_evaluated`
- `status`

드릴 간격 반복 상태는 `config/drill-progress.json`(신규)으로 분리한다.

- `pass_count`
- `fail_count`
- `next_review_date`
- `last_passed`

두 파일 모두 `topic` 키(약점 추적 식별자, ADR-097)로 같은 약점을 가리킨다.
문서·SKILL에만 있던 `question_id`·`shallow_count`·`unknown_count`는 코드·실데이터에 없으므로 스키마에서 제거한다.

마이그레이션은 데이터 손실 없이 진행한다.

- 실데이터 `weak_spots`에 drill 필드(pass_count 등)가 0건이므로 `drill-progress.json`은 빈 상태로 신설한다.
- `study-progress.json`의 기존 키는 topic 학습 필드로 잔류한다.
- 기존 값 이동이 없어 손실이 없다.

### 결과

- topic 학습 상태와 드릴 상태의 파일·writer 경계가 선명해진다.
- 스키마 정본이 코드 타입·실데이터와 일치해 drift가 사라진다.
- 드릴 상태가 별도 파일이라 학습 추천 흐름과 드릴 흐름이 서로의 파일을 덮어쓰지 않는다.

### 적용

- `config/drill-progress.json`을 빈 `{}` 상태로 신설한다.
- 드릴 필드 read/write 코드 경로는 `scripts/interview-drill/drill-engine.ts` 하나다.
  이 파일은 tech-interview-drill·behavioral-interview-drill 두 드릴이 공유하므로, drill-engine.ts를 1회 갱신하면 두 드릴이 함께 커버된다.
  두 드릴의 SKILL.md를 필드 로직 때문에 따로 수정하지 않는다.
- topic 학습 필드(`sessions`·`weak_spots` topic 필드)는 `study-topic-recommender` 학습 흐름이 계속 `study-progress.json`에 쓴다.
- `WeakSpotEntry` 타입을 topic 타입과 drill 타입으로 나누고, 드릴 필드는 drill-progress.json을 읽고 쓰도록 바꾼다.
- `data-schema.md`의 `weak_spots` 스키마를 정본에 맞게 갱신하고, `drill-progress.json` 스키마를 추가한다.
- `topic` 키 공유 규칙은 [[ADR-097]]을 유지한다.
