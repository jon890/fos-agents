## ADR-030 — position-recommender native 마이그 + collect_live_postings ts 활성화 + extract/publish/runner 폐기

**Status**: Accepted
**Date**: 2026-05-16

### 맥락

position-recommender는 활성도 36회/30일 (career-os 최활성)이지만 옛 외부 subprocess 패턴: `run_position_recommendation.sh` 76줄이 7 references cat → `claude --print --output-format json` 호출 → `extract_position_report.ts` 45줄로 markdown 검증. native skill 패턴([[ADR-002]])과 어긋남.

또 deferred 2 자산:
- `collect_live_postings.py` 298줄 — Wanted + Toss 채용 API 수집 (Python `requests`). plan005([[ADR-017]]) wire-up 됐어야 했으나 1개월+ 호출 0. POSITION_POSTINGS_FILE env 외부 주입 패턴이 *대체*해 왔음 (사용자 수동 markdown).
- `publish_job_analysis.sh` 110줄 — fos-study publish 의도였으나 호출 0. position 분석은 *비공개*가 자연 (recommend-positions는 후보자 본인 결정 도구).

또 `POSITION_CONTEXT` + `POSITION_POSTINGS_FILE` env 주입 패턴이 native skill 자연어 호출 (`claude -p "/position-recommender <자연어>"`)과 일관성 없음.

### 결정

여섯 묶음 변경 (한 plan022):

1. **SKILL.md native 명세 재작성**: references 6 + candidate-profile + sources.json `techBlog` Read → Claude 자연어 분석 → report.md Write. 자체 self-check (첫 줄 `#` + 30줄+).
2. **collect_live_postings.py → ts 마이그 + 활성화**: 298줄 Python (`requests`) → Bun fetch (built-in). Wanted + Toss API 그대로. SKILL.md가 *선택적으로* Bash 호출 (자연어에 "최신 채용" 키워드 있으면).
3. **run_position_recommendation.sh 폐기**: native skill SKILL.md가 직접 Read/Write.
4. **extract_position_report.ts 폐기**: Claude 자체 self-check (첫 줄 `#` + 30줄+)로 흡수. JSON 추출 단계 native에서 불필요.
5. **publish_job_analysis.sh 폐기**: 호출 0 + position 분석은 비공개 자연.
6. **POSITION_CONTEXT + POSITION_POSTINGS_FILE env → 자연어 인자 흡수**: `claude -p "/position-recommender AI 서비스팀 백엔드 위주"` + 파일 path는 자연어 지정 (Read 도구).
7. **dispatcher `recommend-positions` case 폐기**: **마지막 남은 dispatcher case**. plan023에서 command-router 디렉터리 자체 폐기 가능.

거절한 대안:
- collect_live_postings.py 폐기: Wanted/Toss API 수집은 가치 있음 — ts 마이그 + 활성화로 자동 흐름 회복.
- publish_job_analysis.sh ts 마이그 + 활성화: position 분석은 후보자 본인 의사결정 자산 — fos-study publish 의도 모호.
- extract_position_report.ts 유지: native 패턴에서 JSON → markdown 단계 불필요.

### 결과

- 활성 흐름 native 일관성 회복 (plan021 패턴 적용).
- 옛 shell runner + Python collector + extract.ts + publish.sh = **4 파일 폐기** (run_*.sh + extract + collect.py + publish.sh).
- collect_live_postings.ts 신규 — 자동 채용 수집 활성화 회복.
- **dispatcher case 1 → 0**. plan023에서 command-router 디렉터리 + run_now.sh + setup_env.sh 일괄 폐기 가능.
- 단점: collect_live_postings.ts 마이그가 Wanted/Toss API 응답 형식 변경 가능성에 취약 — Python 원본과 동등성 검증으로 완화.

### 적용

`tasks/plan022-position-recommender-native/`. depends_on: plan021 (zod 도입 — collector ts가 mvp_target_schema 참조 가능). common-pitfalls 6-6 회피: SKILL.md draft + collect_live_postings.ts draft 별도 파일.
