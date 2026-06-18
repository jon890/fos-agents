# phase-03: 지표 기록 helper + position-metrics.jsonl

## 목표
position-recommender 개선을 측정할 지표를 수집·추천 산출물에서 계산해 `logs/position-metrics.jsonl`에 날짜별 1줄 append하는 helper를 만든다 (ADR-099).

## 먼저 읽을 것
- `career-os/docs/adr/ADR-099-*.md` — 지표 설계 근거
- `career-os/docs/data-schema.md` — `logs/position-metrics.jsonl` 스키마 행
- `career-os/scripts/position-recommender/collect_live_postings.ts` 및 `live-postings/` — 수집 diagnostics(source_counts, reject reasons, active direct posting 수)가 어디서 나오는지
- `career-os/scripts/position-recommender/recommendation_schema.ts` — 추천 JSON(JobFitRun 아님, RecommendationRun) 구조(tier·라벨)

## 변경할 파일 (신규)
- `career-os/scripts/position-recommender/record_metrics.ts`

## 작업
`record_metrics.ts`를 CLI로 만든다:
```
record_metrics.ts --snapshot <live-postings.md> [--recommendation <recommendation.json>] [--output logs/position-metrics.jsonl]
```
- **collection 지표** (snapshot diagnostics에서 파싱): `activeDirectPostings`(direct_posting+active 수), `sourceCounts`(source별), `rejectCounts`(not_server/contract/http 등), `adapterCoverage`(adapter 보유 회사 수 / verified priorityCompanies 수 — `config/verified-company-research-targets.json` hasAdapter로 계산).
- **recommendation 지표** (recommendation.json 있을 때만): `strongActive`(강력 추천 active 비율), `newRatio`(최근 7일 대비 신규 공고 비율 — 같은 디렉터리 지난 recommendation 비교, 어려우면 생략 가능), `tierDist`(strong/stretch/hold 수), `labelCompleteness`(14 라벨 채움 비율).
- 한 줄 JSON: `{ date(Asia/Seoul), collection:{...}, recommendation:{...}|null }`을 `logs/position-metrics.jsonl`에 append.
- `logs/`는 gitignore다(커밋 대상 아님). 디렉터리 없으면 생성.
- recommendation 인자 없으면 collection 지표만 기록(recommendation: null).

## 성공 기준 (실행 가능)
```bash
cd career-os
# 기존 수집 snapshot으로 collection 지표 기록 (없으면 수집 1회)
[ -f data/runtime/live-position-postings.md ] || bun scripts/position-recommender/collect_live_postings.ts
bun scripts/position-recommender/record_metrics.ts --snapshot data/runtime/live-position-postings.md --output /tmp/metrics-test.jsonl
# 기대: 1줄 JSON, collection 필드(activeDirectPostings·sourceCounts·adapterCoverage) 존재
python3 -c "import json; d=json.loads(open('/tmp/metrics-test.jsonl').readlines()[-1]); print('date:', d['date']); print('collection keys:', list(d['collection'].keys())); assert 'adapterCoverage' in d['collection']"
rm -f /tmp/metrics-test.jsonl
```
- (node_modules 없으면 repo 루트 심링크 후 검증, 끝나고 제거.)

## 금지 사항
- wanted.ts·config 파일(phase-01/02) 수정 금지.
- docs/ADR 수정 금지.
- `logs/position-metrics.jsonl`을 git add 하지 않는다(gitignore).

## 완료 시
```bash
cd career-os && git add scripts/position-recommender/record_metrics.ts && \
git -C .. commit -q -m "feat(career-os): position 지표 기록 helper record_metrics (ADR-099 phase-03)
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## 막히면
`PHASE_BLOCKED: <이유>` 또는 `PHASE_FAILED: <에러>` stdout 출력 후 종료.
