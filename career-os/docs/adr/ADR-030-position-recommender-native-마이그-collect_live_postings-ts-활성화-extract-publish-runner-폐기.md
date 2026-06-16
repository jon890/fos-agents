## ADR-030 — position-recommender native 마이그 + collect_live_postings ts 활성화 + extract/publish/runner 폐기

**Status**: Accepted
**Date**: 2026-05-16

### 맥락

position-recommender는 활성도 36회/30일 (career-os 최활성)이지만 옛 외부 subprocess 패턴으로 동작했다.
`run_position_recommendation.sh` → `claude --print --output-format json` → `extract_position_report.ts` 구조가 [[ADR-002]] native skill 패턴과 어긋났다.

두 자산이 deferred 상태였다.
- `collect_live_postings.py` — Wanted + Toss 채용 API 수집. 1개월+ 호출 0.
- `publish_job_analysis.sh` — fos-study publish 의도였으나 호출 0.

### 결정

- SKILL.md를 native 명세로 재작성한다.
- `collect_live_postings.py`를 Bun TypeScript로 마이그레이션하고 활성화한다.
- `run_position_recommendation.sh`, `extract_position_report.ts`, `publish_job_analysis.sh`를 폐기한다.
- `POSITION_CONTEXT` + `POSITION_POSTINGS_FILE` env를 자연어 인자로 흡수한다.
- dispatcher `recommend-positions` case를 폐기한다.

거절한 대안:
- `collect_live_postings.py` 폐기: Wanted/Toss API 수집 가치 있음 — ts 마이그로 복구.
- `publish_job_analysis.sh` 활성화: position 분석은 비공개 자산 — fos-study publish 의도 모호.
- `extract_position_report.ts` 유지: native 패턴에서 JSON 추출 단계 불필요.

### 결과

- 활성 흐름 native 일관성 회복. 3 파일 폐기, collect_live_postings.ts 신규.
- dispatcher case 1 → 0. plan023에서 command-router 디렉터리 일괄 폐기 가능.
- 단점: ts 마이그가 Wanted/Toss API 응답 형식 변경에 취약 — Python 원본과 동등성 검증으로 완화.
