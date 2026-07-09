# Phase 03 — merge (094→101, adapter 043/047/051)

**Model**: sonnet
**Status**: pending

## 목표

같은 결정을 나눠 담은 alive ADR을 병합해 단일 출처로.

## 중요 지침

구현 phase. 병합 시 각 원본의 고유 WHY·거절 대안을 병합본에 보존한다(정보 손실 금지).

## 작업

- **ADR-094 → ADR-101**: 094의 "recommendation.json 정본 전환" 근거를 101에 통합. 094는 제거(또는 101 supersede 태그). 101의 ADR-102 partial-superseded 부분 주의.
  - **live 참조 리다이렉트(실측 ~21건, 필수)**: `ADR-094`를 `ADR-101`로 갱신한다. 대상 파일:
    - `.claude/skills/position-recommender/SKILL.md`(6), `.claude/skills/job-fit-analyzer/SKILL.md`(1)
    - `docs/code-architecture.md`(4), `docs/data-schema.md`(1)
    - `docs/adr/ADR-096-*.md`(2), `docs/adr/ADR-099-*.md`(1), `docs/adr/ADR-101-*.md`(1), `docs/adr/INDEX.md`(094 행)
    - `scripts/position-recommender/recommendation_schema.ts`(주석 1), `scripts/position-recommender/render_recommendation.ts`(주석 1) — **코드 주석도 리다이렉트**(이 plan이 없애려는 drift 자체).
- **adapter 043/047/051**: 수집 adapter 경계 3개를 하나로 병합, 각 단계 근거 보존. 나머지는 supersede-tag. 병합 후 043/047/051 live 참조(code-architecture.md 등)를 병합본으로 갱신.
- (여력 시) 037~042 application-flow-agent runtime 6→2~3 검토. 무리면 다음 plan.

## 성공 기준

- 병합된 ADR이 원본들의 WHY를 모두 담는다.
- 병합으로 제거된 ADR(094 등)의 live SKILL.md·docs 참조가 병합본으로 리다이렉트됨(끊긴 링크 0).

## 보류 조건

- 병합 시 원본 고유 근거가 유실될 위험이 있으면 해당 병합은 보류하고 supersede-tag만.
