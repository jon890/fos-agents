# Phase 01. 진입점을 하위 명령 넷으로 모은다

**Execution profile**: deep

## 목표

일일 실행 경로의 진입점을 `position_run.ts`의 하위 명령 넷으로 모은다.
`collect`, `commit-company-tiers`, `commit-analyses`, `finalize`다.

모든 하위 명령이 `--run <RUN_DIR>` 하나만 받는다.
중간 파일 이름을 명령이 정하므로 부르는 쪽이 그것을 알 필요가 없다.

**범위 외**: skill 문서 다시 쓰기는 Phase 02다.
근거 수집기는 셋째 계획이다.

## 컨텍스트

지금 skill이 부르는 진입점은 아홉이고, 파일 동기화 둘과 회사 조사 하나는
첫째 계획에서 이미 사라졌다. 남은 여섯을 넷으로 모은다.

| 지금 | 뒤 |
| --- | --- |
| `collect_live_postings.ts` + `prepare_position_analysis.ts` | `position_run.ts collect` |
| `complete_company_tier_assessment.ts` | `position_run.ts commit-company-tiers` |
| `commit_position_analysis.ts` | `position_run.ts commit-analyses` |
| `finalize_position_recommendation.ts` | `position_run.ts finalize` |

`configure_position_analysis_policy.ts`와 `configure_position_company_preferences.ts`와
`validate_recommendation.ts`와 `render_*.ts`와 `import_position_state.ts`는 그대로 둔다.
일일 실행 경로가 아니다.

지금 skill 문서가 플래그를 열일곱 번 적는다.
`--candidates`, `--company-tier-queue-output`, `--analysis-queue-output`, `--contract-version`,
`--queue`, `--input`, `--analysis-run-id`, `--output-json`, `--output-html`이 그것이다.
스크립트 인자가 바뀌면 skill이 먼저 낡는 구조다.

**근거 문서**: `docs/code-architecture.md`의 「position-recommender」 절,
`docs/flow.md`의 「position-recommender」 절

## 의도 메모

**기존 파일을 지우지 않고 얇게 감싼다.**
`collect_live_postings.ts`가 하는 수집 자체는 그대로 두고,
`position_run.ts`가 그것을 부르고 출력 경로를 정한다.
한 번에 합치면 어느 변경이 동작을 바꿨는지 가릴 수 없다.

**`<RUN_DIR>` 안의 파일 이름을 계약으로 고정한다.**
`posting-candidates.json`, `company-tier-queue.json`, `analysis-queue.json`,
`company-tier-updates.json`, `analysis-updates.json`,
`recommendation.json`, `index.html` 일곱이다.
`position_run.ts`가 이 이름을 소유하고 다른 곳에서 문자열로 쓰지 않는다.

**모델이 쓰는 입력 파일은 명령이 만들지 않는다.**
`company-tier-updates.json`과 `analysis-updates.json`은 모델이 만든다.
`commit-*` 하위 명령은 그 파일이 `<RUN_DIR>`에 있다고 보고 읽는다.
없으면 어느 경로에 무엇을 써야 하는지 적어 종료 코드 1로 끝낸다.

**`collect`가 `<RUN_DIR>`을 직접 만든다.**
지금은 skill이 `mktemp -d`를 부른다. 그것도 skill이 알 필요 없는 절차다.
`collect`가 만들고 그 경로를 stdout 첫 줄에 낸다.

## 작업 항목

### 1. `scripts/position-recommender/position_run.ts` 추가

하위 명령 넷을 받는다. 공통 인자는 `--run <RUN_DIR>` 하나다.
`collect`만 `--run`을 생략할 수 있고, 생략하면 임시 디렉터리를 만들어 경로를 낸다.

각 하위 명령이 stdout에 내는 것은 집계와 다음에 할 일 한 줄이다.
회사명, 후보자 기준, 평가 이유, 공고 본문, 제외 사유는 내지 않는다.
지금 각 진입점이 지키는 출력 경계와 같다.

### 2. `RUN_DIR` 파일 이름 계약을 한 곳에 둔다

`scripts/position-recommender/run-dir.ts`에 상수와 경로 함수를 둔다.
`position_run.ts`와 테스트만 이것을 읽는다.

### 3. `collect` 하위 명령

`collect_live_postings.ts`의 수집과 `prepare_position_analysis.ts`의 저장을 순서대로 부른다.
평가할 회사가 있으면 `company-tier-queue.json`을, 없으면 `analysis-queue.json`을 남기는
지금 동작을 그대로 유지한다.

stdout에 어느 파일이 생겼는지와 다음 하위 명령 이름을 낸다.

### 4. `commit-company-tiers`와 `commit-analyses`와 `finalize`

각각 `complete_company_tier_assessment.ts`와 `commit_position_analysis.ts`와
`finalize_position_recommendation.ts`를 부른다.
큐와 입력과 출력 경로는 `run-dir.ts`가 정한 이름으로 스스로 만든다.

`commit-analyses`는 반영 결과가 `partial`이면 Backend에서 최신 큐를 다시 받아 저장한다.
첫 제출 전 큐를 그대로 두면 이미 반영된 항목까지 다시 요구해 남은 항목만 제출할 수 없기 때문이다.
최신 큐를 저장한 뒤 남은 건수와 같은 명령을 다시 부르라는 한 줄을 낸다.

`finalize`는 지금처럼 `collectionWarnings`를 함께 낸다.

### 5. 기존 진입점 넷을 라이브러리로 내린다

`collect_live_postings.ts`와 `prepare_position_analysis.ts`와
`complete_company_tier_assessment.ts`와 `commit_position_analysis.ts`와
`finalize_position_recommendation.ts`에서 CLI 인자 처리를 떼어
함수로 내보내고, `position_run.ts`가 그 함수를 부른다.

파일은 남긴다. cron이나 다른 곳이 아직 직접 부를 수 있어서다.
CLI 진입 부분은 함수를 부르는 얇은 껍질만 남는다.

### 6. 이 phase를 검증하는 `scripts/position-recommender/position_run.test.ts`

확인할 것이다.

- `collect`를 `--run` 없이 부르면 임시 디렉터리를 만들고 그 경로를 첫 줄에 낸다
- 평가할 회사가 있으면 `company-tier-queue.json`만, 없으면 `analysis-queue.json`만 생긴다
- `commit-company-tiers`를 `company-tier-updates.json` 없이 부르면
  어느 경로에 무엇을 써야 하는지 적고 종료 코드 1로 끝난다
- `commit-analyses`가 `partial` 응답을 받으면 최신 큐를 저장하고 다시 부르라는 줄을 낸다
- 네 하위 명령의 stdout에 회사명과 공고 본문이 없다

Backend 호출은 기존 테스트가 쓰는 stub을 그대로 쓴다.

## 검증

```bash
# cwd: 저장소 루트
bun test career-os/scripts/position-recommender
bunx tsc --noEmit
git diff --check
```

기대값이다.

- 셋이 모두 종료 코드 0
- `position_run.test.ts`의 항목이 모두 통과
- 기존 테스트가 계속 통과
- 출력에 `skipped`가 없다

**하위 명령 넷이 실제로 있는지 센다.**

```bash
# cwd: 저장소 루트
bun career-os/scripts/position-recommender/position_run.ts --help
```

`collect`, `commit-company-tiers`, `commit-analyses`, `finalize` 넷이 나와야 한다.

**파일 이름이 한 곳에서만 나오는지 센다.**

```bash
# cwd: 저장소 루트
grep -rn "posting-candidates.json\|company-tier-queue.json\|analysis-queue.json" \
  career-os/scripts/position-recommender --include=*.ts | grep -v run-dir.ts | grep -v test
```

출력이 비어야 한다. 나오면 5번에서 떼지 못한 자리가 있다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/position_run.ts` | 신규 |
| `career-os/scripts/position-recommender/run-dir.ts` | 신규 |
| `career-os/scripts/position-recommender/position_run.test.ts` | 신규 |
| `career-os/scripts/position-recommender/collect_live_postings.ts` | 수정 |
| `career-os/scripts/position-recommender/prepare_position_analysis.ts` | 수정 |
| `career-os/scripts/position-recommender/complete_company_tier_assessment.ts` | 수정 |
| `career-os/scripts/position-recommender/commit_position_analysis.ts` | 수정 |
| `career-os/scripts/position-recommender/finalize_position_recommendation.ts` | 수정 |
