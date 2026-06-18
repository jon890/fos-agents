# phase-02: wanted.ts config 로드 + years 경력 매핑

## 목표
`wanted.ts`가 하드코딩 대신 `config/position-collection.json`·`config/candidate-config.json`을 읽게 하고, wanted `years` 파라미터를 후보자 경력(7년) 기반으로 설정한다 (ADR-099).

## 먼저 읽을 것
- `career-os/docs/adr/ADR-099-*.md`
- `career-os/config/position-collection.json`·`candidate-config.json` (phase-01 산출물)
- `career-os/scripts/position-recommender/live-postings/adapters/wanted.ts` — 현재 하드코딩: `job_group_id: "518"`, `years: "3"`(fetchWanted·wantedKeywordSearch 두 곳), `WANTED_TARGET_KEYWORDS`

## 변경할 파일
- `career-os/scripts/position-recommender/live-postings/adapters/wanted.ts`
- (필요 시) config 로드 헬퍼 — 같은 디렉터리 또는 `live-postings/`에 작은 로더

## 작업
1. `position-collection.json`에서 `jobGroupId`·`targetKeywords`를 읽어 하드코딩(`518`, `WANTED_TARGET_KEYWORDS` 상수)을 대체한다. config 로드는 스크립트 위치 기준 절대경로(`import.meta.dir`)로 career-os/config를 찾는다(cwd 무관, ADR-091 원칙).
2. `candidate-config.json`의 `experienceYears`로 wanted `years` 파라미터를 도출한다.
   - **먼저 years 파라미터 의미를 실측 검증**한다: `years=3`과 `years=7`로 같은 query를 호출해 결과 차이를 확인(단일 연차인지, 0~N 범위인지). 의미가 불명확하면 `PHASE_BLOCKED: wanted years 파라미터 의미 불명확 — <관측>`로 멈춘다.
   - 검증 결과에 따라 7년차에 맞는 값(단일이면 7, 범위면 적절 min)으로 설정한다. 두 호출 위치(`fetchWanted`, `wantedKeywordSearch`) 모두 반영.
3. config 파일이 없으면 안전한 기본값(jobGroupId 518, years 7)으로 폴백하고 stderr warn.

## 성공 기준 (실행 가능)
```bash
cd career-os
# 하드코딩 제거 확인: wanted.ts에 528 키워드 배열·518 리터럴이 config 로드로 대체됨
grep -q "position-collection" scripts/position-recommender/live-postings/adapters/wanted.ts && echo "config 로드 반영"
# 수집 1회 동작 (node_modules 필요 시 repo 루트 심링크 후 검증, 끝나고 제거)
bun scripts/position-recommender/collect_live_postings.ts --output /tmp/wanted-check.md 2>&1 | tail -3
grep -q "postings" /tmp/wanted-check.md 2>/dev/null || head -3 /tmp/wanted-check.md
rm -f /tmp/wanted-check.md
```
- config 로드 반영 + 수집이 에러 없이 도는지 확인.

## 금지 사항
- config 파일 *내용* 변경 금지 (phase-01 산출물). 읽기만.
- docs/ADR 수정 금지.
- 지표 기록(phase-03)은 건드리지 않는다.

## 완료 시
```bash
cd career-os && git add scripts/position-recommender/ && \
git -C .. commit -q -m "feat(career-os): wanted.ts config 로드 + years 경력 매핑 (ADR-099 phase-02)
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## 막히면
- wanted years 의미 불명확: `PHASE_BLOCKED: <관측>` 출력 후 종료.
- 수집 실패: `PHASE_FAILED: <에러>` 출력 후 종료.
