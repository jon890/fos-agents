# Phase 03. 제외 규칙의 옛 스키마와 비공개 작업본의 관리 스킬 목록을 정리한다

**Execution profile**: fast

## 목표

포지션 제외 규칙에서 닿지 않는 옛 파일 형식 분기를 지우고, 비공개 작업본 동기화가 더 이상 쓰지 않는 두 스킬을 관리 목록에서 뺀다.

**범위 외**: client 통합은 Phase 04 다. `CAREER_RECOMMENDATION_*` 옛 환경값 호환은 이름 변경 작업이 맡는다.

## 컨텍스트

- `career-os/scripts/position-recommender/feedback/exclusions.ts` 는 옛 파일 형식 `schemaVersion: 1`(`versionOneSchema`)과 scope 없는 `legacyPostingExclusionSchema` 를 담은 union `positionExclusionsSchema` 를 가진다
- 운영에서는 client 가 Backend 의 `positionExclusionSchema`(`career-os/services/career-backend/src/positions/schema.ts`, scope 로 구분하는 union)로 파싱한 규칙을 `loadPositionExclusions` 에 넘긴다. v1 분기와 scope 없는 분기는 운영에서 닿지 않고 테스트만 쓴다
- `validateCareerDownsideExclusion` 은 Backend 스키마의 `superRefine` 과 같은 검사를 client 에서 한 번 더 한다
- scripts 쪽에만 있는 검사가 하나 있다. posting 규칙의 `source` 를 `live-postings/contracts.ts` 의 `sourceIdSchema`(알려진 수집 소스 이름)로 제한한다. Backend 스키마에는 없다
- `career-os/scripts/career-workspace/cli.ts` 의 `managedSkills` 에 `position-recommender` 와 `study-topic-recommender` 가 있다. 두 스킬은 `skill begin`, `skill finish` 를 부르지 않는다. 공부 추천 스킬은 「`career-workspace` 파일 동기화 명령을 실행하지 않는다」 고 적는다

**근거 문서**: `docs/data-schema.md` 의 「개인 공고 제외 설정」 절, `docs/adr/ADR-123-회사-근거와-개인-제외-정책은-backend가-소유한다.md`, `docs/flow.md` 의 「비공개 작업본 동기화」 절

## 의도 메모

- `sourceIdSchema` 검사는 남긴다. 수집 소스 목록은 scripts 가 소유하고 Backend 가 모른다
- Backend 와 같은 검사를 client 에서 반복하는 `validateCareerDownsideExclusion` 은 지운다. 규칙은 Backend 가 저장할 때 이미 검사했다
- `managedSkills` 에서 빼는 것은 동작 변경이 아니다. 두 스킬이 이 명령을 부르지 않는다는 사실을 코드에 맞추는 것이다

## Blocked 조건

- `career-os/scripts/position-recommender/run-dir.ts` 에 `writeCompanyTierUpdatesTemplate` 가 없으면 `PHASE_BLOCKED: cron 안정화 작업 머지 전` 을 출력하고 종료한다

## 작업 항목

### 1. `feedback/exclusions.ts` 수정

- `versionOneSchema`, `versionTwoSchema`, `legacyPostingExclusionSchema`, `positionExclusionsSchema` union 을 지운다
- 입력 타입은 Backend 의 `positionExclusionSchema` 로 파싱한 규칙 배열로 둔다. posting 규칙에는 `sourceIdSchema` 검사를 덧붙인다
- `validateCareerDownsideExclusion` 을 지운다
- `loadPositionExclusions`, `filterExcludedPostings` 의 동작은 바꾸지 않는다

### 2. `career-workspace/cli.ts` 수정

`managedSkills` 에서 `position-recommender` 와 `study-topic-recommender` 를 뺀다. 두 스킬의 동기화 성공을 검증하던 career-workspace 테스트는 지운다.

### 3. 이 phase 를 검증하는 테스트

- `feedback/exclusions.test.ts` 에서 v1 형식 테스트를 지운다. scope 별 필터 테스트와, 알려지지 않은 `source` 를 가진 posting 규칙을 거절하는 테스트는 남기거나 더한다
- career-workspace 테스트에 `skill begin position-recommender` 와 `skill begin study-topic-recommender` 가 각각 `INVALID_MANIFEST` 로 거절되는 경우를 표 기반 테스트로 더한다

## 검증

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts
PATH="$HOME/.bun/bin:$PATH" bunx tsc --noEmit
! git grep -nE "legacyPostingExclusionSchema|versionOneSchema|validateCareerDownsideExclusion" -- career-os/scripts
```

모두 종료 코드 0 이어야 한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/feedback/exclusions.ts` | 수정 |
| `career-os/scripts/position-recommender/feedback/exclusions.test.ts` | 수정 |
| `career-os/scripts/career-workspace/cli.ts` | 수정 |
| `career-os/scripts/career-workspace/tests/cli.test.ts` | 수정 |
