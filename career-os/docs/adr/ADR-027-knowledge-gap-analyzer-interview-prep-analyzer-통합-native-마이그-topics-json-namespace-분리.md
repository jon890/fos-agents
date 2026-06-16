## ADR-027 — knowledge-gap-analyzer → interview-prep-analyzer 통합 native 마이그 + topics.json namespace 분리

**Status**: Accepted
**Date**: 2026-05-15

### 맥락

knowledge-gap-analyzer는 baseline / daily / smoke 3 모드를 dispatcher 분기로 처리했으나 코드 80% 중복이었고 실측 활성도도 낮았다.
`config/topics.json`이 plan002 통합본으로 62KB / 1084줄까지 비대해졌으며, namespace별 사용 skill은 1-2개에 불과해 분리하면 단일 책임이 명확해진다.
plan002 통합 결정([[ADR-008]])을 부분 번복하는 셈이라 ADR 기록이 필요하다.

### 결정

한 plan(plan017)에서 두 변경 묶음을 처리한다.

1. **knowledge-gap-analyzer → interview-prep-analyzer 통합 native**: 단일 skill에 자연어로 baseline / daily 모드를 분기하고, smoke는 폐기한다. study-pack-writer 패턴과 일관성을 맞추고, Python 스크립트 6개를 완전 폐기한다.
2. **topics.json namespace 분리**: 단일 통합 파일을 namespace별 json으로 나눠 단일 책임을 확보한다. plan002 통합 의도(5 → 1)가 과도 통합으로 판명됐다.

### 거절한 대안

- 2 skill 분리(baseline-analyzer + daily-analyzer): 코드 80% 중복 + 활성도 낮아 두 SKILL.md drift 위험이 크다.
- topics.json 유지 + namespace 안에서만 분기: 1084줄 한 파일은 AI 에이전트 컨텍스트 로드 비용과 사용자 편집 불편을 낳는다.
- 다른 plan으로 분리: 두 변경이 의존성이 없어 한 plan으로 묶는 것이 원자적이다.

### 결과

- knowledge-gap-analyzer 폐기, interview-prep-analyzer 신규(skill 수 유지).
- Python script 6개 폐기. config 1 → 3 json (총 크기는 동일하나 namespace별 단일 책임).
- 단점: namespace 추가 시 새 config 파일 신설 부담 (희소).
