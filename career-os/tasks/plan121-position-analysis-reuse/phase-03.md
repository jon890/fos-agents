# Phase 03. 스킬 연결과 반복 실행 측정

**Execution profile**: standard

## 목표

`position-recommender`가 선택된 공고만 분석하고 반복 실행의 재사용과 토큰 사용량을 비교할 수 있게 한다.

**범위 외**: Hermes 구현과 profile 설정, cron 등록, 다른 저장소와 외부 데이터베이스는 수정하지 않는다.

## 컨텍스트

비공개 `state/`를 읽고 쓰기 전에 `career-workspace`의 `skill begin`을 실행하고,
검증이 끝난 상태만 `skill finish`로 반영해야 한다.
현재 스킬은 후보풀 전체 순위를 모델에게 만들게 하고 추천 JSON 검증 뒤에도 렌더, 검사와 정리를 여러 명령으로 수행한다.

**근거 문서**: `docs/flow.md`의 「포지션 추천」, `docs/code-architecture.md`의 「공고 추천」, `docs/prd.md`의 「성공 기준」, `docs/adr/ADR-117-포지션-분석은-우선순위-큐와-버전-이력으로-재사용한다.md`

## 의도 메모

- 스킬은 후보풀 전체와 모든 과거 분석을 모델 입력에 넣지 않는다.
- 모델은 `analysis-queue.json`의 선택 공고만 읽고 같은 실행 ID의 갱신만 만든다.
- 수집과 분석 집계는 사용자에게 전달하지만 비공개 회사 제외 사유는 공개 리포트에 쓰지 않는다.
- 절감률은 구현 전 수치로 약속하지 않고 같은 측정 항목의 전후 실행으로 계산한다.

## 작업 항목

### 1. 비공개 정책 초기화와 실행 전 검사

기존 비공개 작업 release를 준비한 뒤 `state/private-config/position-analysis.json`이 없으면 예시 회사 없이 기본 운영값으로 초기 파일을 만든다.
실제 회사 티어는 사용자가 정한 이름만 추가하며 코드나 모델이 회사 규모를 추측해 저장하지 않는다.
기존 `position-exclusions.json`의 회사 제외 규칙을 유지하고 분석 정책으로 복제하지 않는다.

### 2. `position-recommender` 실행 순서 변경

`.claude/skills/position-recommender/SKILL.md`를 `skill-creator` 절차로 수정한다.
수집 뒤 `prepare_position_analysis.ts`를 실행하고 큐가 비어 있으면 모델 분석과 회사 조사를 생략한다.
큐가 있으면 선택된 공고와 해당 회사의 유효한 조사만 읽어 `analysis-updates.json`을 만들고 반영한다.

추천 판단 뒤에는 `finalize_position_recommendation.ts` 한 번으로 JSON, HTML과 공개 계약을 검증한다.
최종 답변은 이번 실행 분석, 재사용, 대기와 개인 제외 건수, 부분 실패 소스를 포함한다.
분석 이력과 회사 조사 반영이 끝난 뒤 `skill finish`를 실행하고 임시 산출물을 정리한다.

### 3. 반복 실행 관측값 추가

준비와 최종화 명령의 JSON 출력에 후보풀 바이트, 전체 후보 수, 큐 본문 바이트,
이번 실행 분석, 재사용, `new`, `changed`, `stale`, 대기 건수와 소스 경고 수를 넣는다.
후보 원문, 개인 정책과 분석 이유 전문은 출력하지 않는다.

첫 운영 실행과 다음 cron 실행에서 Hermes가 제공하는 모델 API 호출 수, 도구 사용 턴 수,
전체 입력, cache read, cache에 없던 입력, 출력 토큰과 추천 JSON 검증 뒤 입력을 기록한다.
career-os가 제공하지 않는 Hermes 집계는 코드 계약으로 만들지 않고 운영 결과 보고에만 남긴다.

### 4. 스킬과 반복 실행 회귀 테스트

큐가 있는 실행, 모든 분석이 `fresh`인 실행, 정책 오류, 분석 갱신 오류,
부분 실패 소스와 release 충돌을 fixture와 subprocess 테스트로 확인한다.
두 번째 실행은 모델 분석 없이 같은 추천 순서와 `reused` 집계를 만들고 상태 파일을 불필요하게 바꾸지 않아야 한다.

`quick_validate.py`, TypeScript 검사, position-recommender 전체 테스트와 문서 검사까지 통과한 뒤
`tasks/plan121-position-analysis-reuse/index.json`의 `status`를 `completed`로 바꾸고 `current_phase`를 3으로 유지한다.

## 검증

저장소 루트에서 다음 명령을 실행한다.

```bash
# cwd: 저장소 루트
bun test career-os/scripts/position-recommender
bun test career-os/.claude/skills/position-recommender
bunx tsc --noEmit
bun run format:position-recommender:check
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py career-os/.claude/skills/position-recommender
python3 ~/.claude/scripts/korean-style-check.py career-os/.claude/skills/position-recommender/SKILL.md career-os/docs/prd.md career-os/docs/flow.md career-os/docs/code-architecture.md career-os/docs/data-schema.md career-os/docs/adr/ADR-117-포지션-분석은-우선순위-큐와-버전-이력으로-재사용한다.md career-os/tasks/plan121-position-analysis-reuse/phase-01.md career-os/tasks/plan121-position-analysis-reuse/phase-02.md career-os/tasks/plan121-position-analysis-reuse/phase-03.md
python3 ~/.claude/scripts/check-readability.py career-os/.claude/skills/position-recommender/SKILL.md career-os/docs/prd.md career-os/docs/flow.md career-os/docs/code-architecture.md career-os/docs/data-schema.md career-os/docs/adr/ADR-117-포지션-분석은-우선순위-큐와-버전-이력으로-재사용한다.md career-os/tasks/plan121-position-analysis-reuse/phase-01.md career-os/tasks/plan121-position-analysis-reuse/phase-02.md career-os/tasks/plan121-position-analysis-reuse/phase-03.md
git diff --check
```

운영 실행 전후 비교는 후보 수가 달라도 해석할 수 있도록 후보당 입력, 상세 분석 건당 입력과 추천 검증 뒤 입력을 함께 기록한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `.claude/skills/position-recommender/SKILL.md` | 수정 |
| `state/private-config/position-analysis.json` | 비공개 운영 파일 신규 |
| `scripts/position-recommender/*position_analysis*.test.ts` | 수정 |
| `scripts/position-recommender/finalize_position_recommendation.test.ts` | 수정 |
| `tasks/plan121-position-analysis-reuse/index.json` | 완료 상태 갱신 |
