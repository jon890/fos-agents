# Phase 01. 포지션 추천의 수동 렌더와 후보 미리보기 경로를 지운다

**Execution profile**: standard

## 목표

일일 실행에 들어가지 않는 포지션 추천 진입점 셋과 그것만 쓰는 모듈, 템플릿, 테스트를 지운다.
추천 HTML 은 `finalize` 가 만들고, 이 phase 는 그 경로를 바꾸지 않는다.

**범위 외**: 공부 추천은 Phase 02, 제외 규칙과 비공개 작업본은 Phase 03, client 통합은 Phase 04 다.

## 컨텍스트

지울 진입점은 스킬, hermes cron 설정, 홈서버 인프라 저장소 어디에서도 부르지 않는다. 2026-09-27 에 셋 모두 grep 으로 확인했다.

| 지울 것 | 쓰는 곳 |
| --- | --- |
| `career-os/scripts/position-recommender/render_candidate_preview.ts` | 자기 테스트, `scripts/lib/cli-contract.test.ts` |
| `career-os/scripts/position-recommender/render_recommendation.ts` | 자기 테스트, `cli-contract.test.ts` |
| `career-os/scripts/position-recommender/validate_recommendation.ts` | `render_candidate_preview.ts`, `recommendation/validate.test.ts`, `cli-contract.test.ts` |
| `career-os/scripts/position-recommender/render/candidate-preview-html.ts` | `render_candidate_preview.ts` 만 |
| `render/templates/preview.html`, `preview-parts.html`, `preview.css`, `preview.js` | `render/assets.ts` 의 preview 종류를 거쳐 `render_candidate_preview.ts` 만 |

일일 실행의 `finalize_position_recommendation.ts` 는 `render/assets.ts` 의 `loadRenderAssets("report")` 와 `render/recommendation-html.ts` 만 쓴다. 이 둘은 남긴다.

**근거 문서**: `docs/code-architecture.md` 의 「position-recommender」 진입점 표와 「렌더」 절

## 의도 메모

- 남는 코드가 지운 파일을 import 하면 타입 검사가 잡는다. 지운 뒤 `bunx tsc --noEmit` 로 확인한다
- `live-postings/candidate_pool.ts` 의 `loadPostingCandidatePool` 은 `validate_recommendation.ts` 만 쓴다. 지운 뒤 다른 호출처가 없으면 함께 지운다. `buildPostingCandidatePool` 은 수집 경로가 쓰므로 남긴다
- `render/fixture.ts` 에서 미리보기 테스트만 쓰던 부분이 있으면 지우고, report 테스트가 쓰는 부분은 남긴다

## Blocked 조건

- `career-os/scripts/position-recommender/update-templates.ts` 가 main 에 없으면 cron 안정화 작업이 아직 머지되지 않은 것이다. `PHASE_BLOCKED: cron 안정화 작업 머지 전` 을 출력하고 종료한다. 같은 디렉터리를 고치므로 충돌한다

## 작업 항목

### 1. 진입점 셋과 전용 모듈 삭제

위 표의 파일을 지운다. 각 파일의 테스트 `render/render-candidate-preview.test.ts`, `render/render-recommendation.test.ts`, `recommendation/validate.test.ts` 도 지운다.

### 2. `career-os/scripts/position-recommender/render/assets.ts` 수정

preview 종류를 지우고 report 만 남긴다. `render/assets.test.ts` 에서 preview 를 다루는 테스트를 지운다.

### 3. `career-os/scripts/position-recommender/live-postings/candidate_pool.ts` 수정

`loadPostingCandidatePool` 의 호출처가 남지 않았으면 지운다.

### 4. `career-os/scripts/lib/cli-contract.test.ts` 수정

지운 세 진입점을 부르는 테스트와 「import는 실행하거나 출력하지 않는다」 목록의 해당 항목을 지운다. 남는 스크립트의 단언은 바꾸지 않는다.

### 5. `career-os/package.json` 의 `format:position-recommender` 확인

지운 파일을 가리키면 그 경로를 뺀다.

### 6. 이 phase 를 검증하는 테스트

새 테스트는 만들지 않는다. 남는 테스트가 모두 통과하고, 지운 이름이 코드에 남지 않았는지 확인한다.

## 검증

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts
PATH="$HOME/.bun/bin:$PATH" bunx tsc --noEmit
! git grep -nE "render_candidate_preview|render_recommendation|validate_recommendation|candidate-preview-html|loadPostingCandidatePool|preview-parts\.html" -- career-os ':!career-os/docs/adr' ':!career-os/tasks'
```

모두 종료 코드 0 이어야 한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/render_candidate_preview.ts` | 삭제 |
| `career-os/scripts/position-recommender/render_recommendation.ts` | 삭제 |
| `career-os/scripts/position-recommender/validate_recommendation.ts` | 삭제 |
| `career-os/scripts/position-recommender/render/candidate-preview-html.ts` | 삭제 |
| `career-os/scripts/position-recommender/render/templates/preview.html`, `preview-parts.html`, `preview.css`, `preview.js` | 삭제 |
| `career-os/scripts/position-recommender/render/render-candidate-preview.test.ts` | 삭제 |
| `career-os/scripts/position-recommender/render/render-recommendation.test.ts` | 삭제 |
| `career-os/scripts/position-recommender/recommendation/validate.test.ts` | 삭제 |
| `career-os/scripts/position-recommender/render/assets.ts`, `assets.test.ts` | 수정 |
| `career-os/scripts/position-recommender/render/fixture.ts` | 필요하면 수정 |
| `career-os/scripts/position-recommender/live-postings/candidate_pool.ts` | 수정 |
| `career-os/scripts/lib/cli-contract.test.ts` | 수정 |
| `career-os/package.json` | 필요하면 수정 |
