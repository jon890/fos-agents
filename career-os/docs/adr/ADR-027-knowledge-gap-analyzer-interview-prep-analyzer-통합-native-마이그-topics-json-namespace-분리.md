## ADR-027 — knowledge-gap-analyzer → interview-prep-analyzer 통합 native 마이그 + topics.json namespace 분리

**Status**: Accepted
**Date**: 2026-05-15

### 맥락

knowledge-gap-analyzer는 baseline / daily / smoke 3 모드를 dispatcher 분기로 처리. 모드별 입력 set·산출물 섹션·부수효과(study-progress 갱신)는 다르지만 코드 80% 중복 (mvp-target + candidate-profile + fos-study Read → Claude 분석 → report.md Write). codex가 자동 생성한 분리 구조라 *과도한 책임 분할* 의심. 실측 활성도도 낮음 (baseline 4 + daily 2 + smoke 7 / 30일).

또 `config/topics.json`이 plan002 통합본으로 62KB / 1084줄까지 비대. namespace별 사용 skill 1-2개로 분리되어 *분리하면 깔끔* — 그러나 plan002 통합 결정([[ADR-008]] 가정)을 부분 번복하는 셈이라 ADR 기록 필요. 현재 Write 0건 (사용자 수동 편집만) — 분리 마이그 안전.

### 결정

한 plan(plan017)에서 두 변경 묶음 처리:

1. **knowledge-gap-analyzer → interview-prep-analyzer 통합 native**: 단일 skill에 자연어로 baseline / daily 모드 분기. smoke는 폐기 (native 패턴에선 검증 가치 약함 — Claude 호출 sanity는 다른 skill 사용 중에 자연 확인). study-pack-writer / interview-asset-writer 패턴 일관성. Python 6개 (build_target_file_list / select_topic / update_study_progress / run_baseline / run_daily / run_smoke_test) 완전 폐기 — 알고리즘 단순 (점수 X, cooldown 단순)이라 자연어 추론으로 동등.
2. **topics.json namespace 분리**: 3 json (`study-pack-topics.json` 55 키 / `study-pack-candidates.json` 2 키 / `question-bank-topics.json` 2 키). 각 namespace를 사용하는 skill 1-2개에 맞춰 분리 — 단일 책임. plan002 통합 의도 (5 → 1)가 *과도 통합*으로 판명됨.

### 거절한 대안

- 2 skill 분리 (baseline-analyzer + daily-analyzer): 코드 80% 중복 + 활성도 낮아 두 SKILL.md drift 위험 — 단일이 더 native 답다.
- topics.json 유지 + namespace 안에서만 분기: 1084줄 한 파일 — AI 에이전트 컨텍스트 로드 비용 + 사용자 편집 불편.
- 다른 plan으로 분리: 두 변경이 시간적으로 동시 적용 가능 (의존성 없음) — 한 plan으로 atomicity.

### 결과

- skill 수 유지 (knowledge-gap-analyzer 폐기 1, interview-prep-analyzer 신규 1).
- dispatcher case 7 → 4 (baseline + daily + smoke 폐기). 누적 native 진입점 4개 (study-pack / interview-asset / study-topic-recommender / interview-prep-analyzer).
- Python script 6개 폐기. config 1 → 3 json (총 크기는 동일하나 namespace별 단일 책임).
- 단점: namespace 추가 시 새 config 파일 신설 부담 (희소).

### 적용

`tasks/plan017-interview-prep-analyzer-native/`. depends_on: plan013([[ADR-002]]). common-pitfalls 6-6/6-7 회피: draft 별도 파일 + references audit grep + commit 개수 self-check phase.
