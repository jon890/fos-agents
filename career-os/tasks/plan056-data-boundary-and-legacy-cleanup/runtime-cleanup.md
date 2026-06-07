# plan056 phase-03 runtime 정리 결정

날짜: 2026-06-07
Worktree: `/home/bifos/ai-nodes-worktrees/plan056-complete`

## 범위

이 phase는 tracked `data/runtime` 산출물만 검토했다.
runtime 파일을 이동, 삭제, 재작성하지 않았다.

tracked runtime 파일:

- `data/runtime/live-position-postings.plan048-final.md`
- `data/runtime/live-position-postings.plan048-smoke.md`

이 checkout에는 다른 tracked `data/runtime` 파일이 없다.

## runtime 경계

`data/runtime/`은 최신 projection, cache, lock, evaluation state를 두는 위치다.
장기 증거 archive가 아니다.

active runtime 예시는 아래처럼 유지한다.

- `position-recommender`가 사용하는 최신 live posting snapshot
- `frontdoor-queue.jsonl` recommendation queue state
- topic inventory와 replenishment state
- application-agent evaluation latest report
- lock file과 feed cache

오래된 plan smoke/final artifact는 성격이 다르다.
이 파일들은 완료된 plan의 검증 증거이지 현재 runtime state가 아니다.

## plan048 증거 검토

`tasks/plan048-target-source-coverage-dashboard/index.json` is completed.
summary에는 final all-source snapshot이 active/open direct posting 15개를 만들었다고 기록돼 있다.
configured source set과 source count도 함께 기록돼 있다.

두 runtime exception 파일은 plan048 phase 문서에서 smoke/final verification output으로 명시돼 있다.

- `data/runtime/live-position-postings.plan048-smoke.md`
- `data/runtime/live-position-postings.plan048-final.md`

두 파일은 같은 all-source live posting snapshot 형태를 가진다.
source diagnostics, active/open evidence, source failure detail이 들어 있다.

plan048 검증이 통과했다는 과거 증거로는 유용하다.
하지만 채용공고 상태는 빠르게 낡기 때문에 현재 live posting source로는 유용하지 않다.

## 권장 결정

권장 결정은 후속 cleanup에서 두 plan048 파일을 active `data/runtime` 밖으로 옮기는 것이다.

선호 목적지:

- `tasks/plan048-target-source-coverage-dashboard/evidence/live-position-postings.final.md`
- `tasks/plan048-target-source-coverage-dashboard/evidence/live-position-postings.smoke.md`

이유:

- 이 파일들은 plan 검증 증거다.
- 증거는 그것을 만든 plan 근처에 두는 편이 자연스럽다.
- task-local evidence로 옮기면 오래된 posting snapshot을 live runtime처럼 오해하지 않는다.
- 파일이 이미 tracked 상태이므로 `git mv`로 history를 보존할 수 있다.

task-local evidence가 너무 지저분하다고 판단될 때의 fallback 목적지:

- `data/private/archive/plan048/live-position-postings.final.md`
- `data/private/archive/plan048/live-position-postings.smoke.md`

이 fallback은 민감하거나 오래된 source material을 active runtime 밖에 둔다.
명확한 audit 이유가 없으면 untracked 상태로 유지한다.

권장하지 않는 선택:

- 두 파일을 `data/runtime`의 영구 tracked exception으로 계속 두는 것.
- evidence 역할을 기록하거나 이동하지 않고 삭제하는 것.

## 후속 실행

이 phase는 cleanup을 실행하지 않는다.

후속 cleanup은 작은 phase 또는 별도 plan으로 아래 범위를 다룰 수 있다.

1. `tasks/plan048-target-source-coverage-dashboard/evidence/`를 만든다.
2. tracked plan048 runtime exception 파일 2개를 `git mv`로 옮긴다.
3. 아직 `data/runtime/live-position-postings.plan048-*.md`를 가리키는 plan048 reference를 갱신한다.
4. active producer나 dashboard reader가 plan-specific filename을 기대하지 않는지 확인한다.
5. 일반 `data/runtime/` latest projection file은 untracked 상태로 둔다.

## report 보존 메모

이 checkout에는 `data/reports/` 파일이 없다.
다른 checkout에서 오래된 baseline 또는 daily report가 보이면 live reference 기준으로 먼저 분류한다.

아래 항목에서 참조할 때만 active로 둔다.

- 현재 interview prep
- 현재 application package
- task validation evidence
- docs 또는 ADR decision context

그 외에는 삭제를 고려하기 전에 날짜, plan, topic 기준으로 `data/private/archive/`에 archive한다.
