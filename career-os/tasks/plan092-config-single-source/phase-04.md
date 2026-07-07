# Phase 04 — study-progress 분리 + weak_spots 스키마 통일

**Model**: sonnet
**Status**: pending

## 목표

findings 중간 3번. `study-progress.json`의 학습 이력(sessions)과 드릴 간격 반복 상태(weak_spots)를 관심사별로 분리하고, weak_spots 스키마를 문서·타입·실데이터로 통일한다.

## 중요 지침

구현 phase다. docs·ADR을 수정하지 않는다.
weak_spots는 recommender와 두 드릴 skill이 함께 쓰므로, 분리 시 세 writer 모두 갱신한다.

## 관련 파일

- `config/study-progress.json` (`sessions`, `weak_spots`)
- `scripts/interview-drill/drill-engine.ts` (`WeakSpotEntry` 타입)
- `.claude/skills/tech-interview-drill/SKILL.md`, `.claude/skills/behavioral-interview-drill/SKILL.md`
- `.claude/skills/study-topic-recommender/SKILL.md`

## 작업

- ADR 결정대로 드릴 간격 반복 상태를 `config/drill-progress.json`으로 분리하거나, `study-progress.json` 안에서 스키마를 통일.
- `weak_spots` 필드 셋(`pass_count`·`fail_count`·`next_review_date` 등)을 SKILL 문서·`WeakSpotEntry` 타입·실데이터에서 동일하게 맞춘다.
- 세 writer(recommender·tech drill·behavioral drill)의 읽기/쓰기 경로 갱신.

## 성공 기준

- 학습 이력과 드릴 상태가 관심사별로 분리(ADR 결정 형태).
- weak_spots 스키마가 문서·타입·실데이터에서 일치(필드 셋 diff 0).
- tech/behavioral 드릴 1회 실행이 정상 동작하고 상태가 올바른 파일에 기록된다.

## 보류 조건

- 기존 weak_spots 데이터 마이그레이션 방식이 불명확하면 Phase 01로.

## 실패 조건

- 드릴 실행이 스키마 불일치로 깨지면 실패.
