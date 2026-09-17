# Phase 03. 스킬 연결과 반복 실행 측정

**Execution profile**: standard

## 목표

`position-recommender`가 Backend가 고른 공고만 분석하고,
수집 실패와 분석 대기를 표시하며 반복 cron의 토큰 사용량을 비교할 수 있게 한다.

**범위 외**: Hermes 구현과 profile 설정, cron 등록, 홈서버 배포, 운영 DB 적용과 다른 저장소 수정은 수행하지 않는다.

## 컨텍스트

현재 스킬은 후보풀 전체를 비교하고 추천 JSON 검증 뒤에도 여러 후처리 명령을 실행한다.
2026-09-17 실행에서는 추천 JSON 검증 뒤 16회 호출이 1,759,795 입력 토큰을 사용했다.
Backend로 상태를 옮겨도 후처리 왕복을 줄이지 않으면 이미 커진 대화 기록을 계속 전달한다.

**근거 문서**: `docs/flow.md`의 「포지션 추천」,
`docs/code-architecture.md`의 「공고 추천」,
`docs/prd.md`의 「성공 기준」,
`docs/adr/ADR-118-추천-상태는-career-os-api와-mysql이-관리한다.md`

## 의도 메모

- 스킬은 전체 후보풀과 과거 분석 전체를 모델 입력에 넣지 않는다.
- Backend 장애 때 파일 이력으로 자동 전환하지 않는다.
- 부분 실패 소스는 성공으로 숨기지 않고 최종 답변과 HTML에 표시한다.
- 절감률은 구현 전 수치로 약속하지 않고 같은 측정 항목의 전후 실행으로 계산한다.

## 작업 항목

### 1. 추천 JSON과 HTML에 대기·수집 진단 추가

`recommendation/schema.ts`의 버전을 올리고 `pendingCandidates`, `analysisSummary`와 `collectionHealth`를 추가한다.
`validate_recommendation.ts`는 유효한 분석 순위와 대기 목록의 합집합이
개인 제외 후 활성 후보 전체와 일치하는지 검사한다.

`render/recommendation-html.ts`와 `render/validate-report-html.ts`는
부분 실패 소스, 실패 건수와 후보 누락 가능성을 표시하고 검사한다.
오류 원문과 실패 URL 목록, 비공개 회사 제외 사유는 공개 HTML에 넣지 않는다.

### 2. 추천 최종화 명령으로 후처리 통합

`finalize_position_recommendation.ts` 한 번으로 Backend 추천 응답 검증,
추천 JSON 생성, HTML 생성과 공개 계약 검사를 순서대로 실행한다.
중간 단계가 실패하면 기존 출력을 덮어쓰지 않고 성공 메시지를 내지 않는다.
후보 상세 본문을 stdout에 출력하지 않고 집계와 생성 경로만 반환한다.

### 3. position-recommender 실행 순서 변경

`.claude/skills/position-recommender/SKILL.md`를 `skill-creator` 절차로 수정한다.
수집 뒤 `prepare_position_analysis.ts`를 실행하고 큐가 비어 있으면 모델 분석과 회사 조사를 생략한다.
큐가 있으면 선택된 공고와 해당 회사의 유효한 조사만 읽어 `analysis-updates.json`을 만든다.

최종 답변은 이번 실행 분석, 재사용, 대기와 개인 제외 건수, 부분 실패 소스를 포함한다.
회사 조사 반영이 끝난 뒤 기존 `skill finish`를 실행하고 임시 산출물을 정리한다.
포지션 분석 이력은 S3 release에 복제하지 않는다.

### 4. 반복 실행 관측값 추가

준비와 최종화 명령의 JSON 출력에 후보풀 바이트, 전체 후보 수, 큐 본문 바이트,
이번 실행 분석, 재사용, `new`, `changed`, `stale`, 대기 건수와 소스 경고 수를 넣는다.
후보 원문, 개인 정책과 분석 이유 전문은 출력하지 않는다.

첫 운영 실행과 다음 cron 실행에서 Hermes의 모델 API 호출 수, 도구 사용 턴 수,
전체 입력, cache read, cache에 없던 입력, 출력 토큰과 추천 JSON 검증 뒤 입력을 기록한다.
career-os가 제공하지 않는 Hermes 집계는 운영 결과 보고에만 남긴다.

### 5. 스킬과 반복 실행 회귀 테스트

큐가 있는 실행, 모든 분석이 `fresh`인 실행, API 인증 오류, 분석 반영 충돌,
부분 실패 소스와 release 충돌을 fixture와 subprocess 테스트로 확인한다.
두 번째 실행은 모델 분석 없이 같은 추천 순서와 `reused` 집계를 만들고 DB에 새 분석을 추가하지 않아야 한다.

`quick_validate.py`, TypeScript 검사, position-recommender 전체 테스트와 문서 검사를 통과한 뒤
`tasks/plan121-position-analysis-reuse/index.json`의 `status`를 `completed`로 바꾸고 `current_phase`를 3으로 유지한다.

## 검증

```bash
# cwd: 저장소 루트
bun test career-os/services/recommendation-api career-os/scripts/position-recommender career-os/.claude/skills/position-recommender
bunx tsc --noEmit
bun run format:position-recommender:check
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py career-os/.claude/skills/position-recommender
python3 ~/.claude/scripts/korean-style-check.py career-os/.claude/skills/position-recommender/SKILL.md career-os/docs/prd.md career-os/docs/flow.md career-os/docs/code-architecture.md career-os/docs/data-schema.md career-os/docs/adr/ADR-118-추천-상태는-career-os-api와-mysql이-관리한다.md career-os/tasks/plan121-position-analysis-reuse/phase-01.md career-os/tasks/plan121-position-analysis-reuse/phase-02.md career-os/tasks/plan121-position-analysis-reuse/phase-03.md
python3 ~/.claude/scripts/check-readability.py career-os/.claude/skills/position-recommender/SKILL.md career-os/docs/prd.md career-os/docs/flow.md career-os/docs/code-architecture.md career-os/docs/data-schema.md career-os/docs/adr/ADR-118-추천-상태는-career-os-api와-mysql이-관리한다.md career-os/tasks/plan121-position-analysis-reuse/phase-01.md career-os/tasks/plan121-position-analysis-reuse/phase-02.md career-os/tasks/plan121-position-analysis-reuse/phase-03.md
git diff --check
```

운영 실행 전후 비교는 후보 수가 달라도 해석할 수 있도록 후보당 입력,
상세 분석 건당 입력과 추천 검증 뒤 입력을 함께 기록한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `.claude/skills/position-recommender/SKILL.md` | 수정 |
| `scripts/position-recommender/recommendation/schema.ts` | 수정 |
| `scripts/position-recommender/validate_recommendation.ts` | 수정 |
| `scripts/position-recommender/render/*.ts` | 수정 |
| `scripts/position-recommender/render/templates/*` | 수정 |
| `scripts/position-recommender/finalize_position_recommendation.ts` | 수정 |
| `scripts/position-recommender/**/*.test.ts` | 수정 |
| `tasks/plan121-position-analysis-reuse/index.json` | 완료 상태 갱신 |
