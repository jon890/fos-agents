# Phase 06 — 전 경로 참조 갱신 + 검증

**Model**: sonnet
**Status**: pending

## 목표

전 경로 참조 갱신 + 검증 (decisions.md 이동표·기준 준수).

## 중요 지침

구현 phase다. docs·ADR을 수정하지 않는다. Phase 01 ADR·이동표를 벗어나면 PHASE_BLOCKED.
git mv로 이력 보존. 파일 이동과 그 참조 갱신을 같은 phase에서 함께 한다.

## 작업

남은 data/ 참조를 전수 grep해 0으로 만든다. 용어(승격→등록)를 docs/SKILL 산문에서 교체. 수집(collect_live_postings)·렌더(render_recommendation·render_candidate_preview)·드릴(drill-engine) 실행이 새 경로로 성공하는지 확인.

## 성공 기준

- 대상 파일이 새 위치로 이동됐다.
- 이동 파일을 읽는 SKILL·scripts·docs·.gitignore 참조가 새 경로로 갱신됐다(끊긴 링크 0).
- 관련 실행(수집/렌더/드릴 중 해당)이 새 경로로 성공한다.

## 실패 조건

- 이동 후 옛 경로 참조가 남아 실행이 깨지면 실패.
