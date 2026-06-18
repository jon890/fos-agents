# phase-04: end-to-end 통합 검증 + 기준선 + plan 완료 마킹

## 목표
phase-01~03(config 외부화 + wanted config 로드 + 지표 helper)이 end-to-end로 동작하는지 실제 수집으로 검증하고, 오늘을 **지표 기준선**으로 찍은 뒤 plan090을 완료로 마킹한다 (ADR-099).

## 먼저 읽을 것
- `career-os/config/position-collection.json`·`candidate-config.json` (phase-01)
- `career-os/scripts/position-recommender/live-postings/adapters/wanted.ts` (phase-02)
- `career-os/scripts/position-recommender/record_metrics.ts` (phase-03)

## 검증 (실행 가능)
```bash
cd career-os
# 1) config 로드 확인: wanted.ts가 하드코딩 대신 config 읽음
grep -q "position-collection" scripts/position-recommender/live-postings/adapters/wanted.ts && echo "config 로드 OK"
# 2) 수집 1회 (config 값 반영 — jobGroupId·years·targetKeywords가 config에서)
bun scripts/position-recommender/collect_live_postings.ts 2>&1 | tail -3
# 3) 지표 기준선 기록 (collection 지표)
bun scripts/position-recommender/record_metrics.ts --snapshot data/runtime/live-position-postings.md --output logs/position-metrics.jsonl
# 4) 검증: 기준선 1줄 + adapterCoverage·activeDirectPostings 존재
python3 -c "import json; d=json.loads(open('logs/position-metrics.jsonl').readlines()[-1]); print('기준선:', d['date'], 'activeDirectPostings:', d['collection'].get('activeDirectPostings'), 'adapterCoverage:', d['collection'].get('adapterCoverage')); assert d['collection'].get('activeDirectPostings') is not None"
echo "E2E + 기준선 OK"
```
- `config 로드 OK` + `E2E + 기준선 OK` 출력이면 통과.
- (node_modules 없으면 repo 루트 심링크 후 검증, 끝나고 제거.)
- 수집이 외부 API(wanted 등) 호출이라 네트워크 의존 — 0건이어도 에러 없이 기록되면 통과. API 차단/타임아웃은 `PHASE_FAILED`가 아니라 collection 지표에 reject로 남는다.

## logs는 gitignore
`logs/position-metrics.jsonl`은 gitignore라 커밋 대상이 아니다. 기준선은 로컬에 남고, 이후 실행이 같은 파일에 누적된다.

## index.json 완료 마킹
- `tasks/plan090-position-collection-metrics/index.json`의 `status`를 `completed`, `current_phase`를 4, `updated_at`을 현재 UTC로 갱신.
- (phase별 status/commitSha는 run-phases.py가 자동 기록.)

## 금지 사항
- phase-01~03 산출물(config·wanted.ts·record_metrics.ts) 로직 수정 금지. 검증만. 실패면 PHASE_FAILED.
- docs/ADR 수정 금지.
- `logs/position-metrics.jsonl` git add 금지.

## 완료 시 (push 포함 — 마지막 phase)
```bash
cd career-os && git add tasks/plan090-position-collection-metrics/index.json && \
git -C .. commit -q -m "chore(career-os): plan090 통합 검증 완료 + 지표 기준선 + index 마킹 (ADR-099 phase-04)
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" && \
git -C .. push origin feat/position-collection-metrics
```

## 막히면
- 검증 실패: `PHASE_FAILED: <항목>` 출력 후 종료.
- 사람 결정 필요: `PHASE_BLOCKED: <이유>` 출력.
