# Phase 05 — 0건 source 원인 진단 보강

**Model**: sonnet
**Status**: pending

## 목표

Naver Careers와 KakaoPay Securities처럼 0건 source의 원인을 `zeroReason` 또는 `failureReason`으로 더 잘 분류한다.
source adapter를 무제한 확장하지 않고 plan075에서 확인된 0건 원인 진단만 보강한다.
마지막 phase이므로 통합 검증 결과를 확인한 뒤 task index를 completed로 정리한다.

**범위 외**: 새 source 대량 추가, 추천 후보 개수 정책 변경, DB schema 신설, daily runner 구조 변경, career-os docs/ADR 수정, 외부 채용 사이트 제출·로그인·업로드·공개 발행.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다.
본 phase는 ai-nodes 루트 기준 path를 쓰므로 첫 bash에서 cwd를 ai-nodes 루트로 변경한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/AGENTS.md`의 source coverage 확장 원칙과 Validation and Git
- `career-os/docs/prd.md`의 plan075 범위와 범위 밖
- `career-os/docs/data-schema.md`의 `position_source_run_diagnostics` 표시 규칙
- `career-os/docs/flow.md`의 source diagnostics 표시 기준
- `career-os/docs/code-architecture.md`의 `live-postings` adapter 책임
- `career-os/docs/adr.md`의 ADR-079와 ADR-083
- `career-os/tasks/plan075-fos-career-source-registry-collection-runs/index.json`
- `~/services/fos-career/AGENTS.md`

---

## 작업 항목

### 1. latest diagnostics에서 0건 source 확인

phase 04 실제 smoke 결과와 DB latest diagnostics를 확인한다.
Naver Careers와 KakaoPay Securities가 0건이 아니면, 해당 사실과 현재 reason mapping을 보고하고 검증 중심으로 마무리한다.

### 2. zeroReason mapping 보강

import parser 또는 adapter diagnostics mapping에서 0건 원인을 다음 enum 후보로 분류한다.

- `no_matching_postings`
- `too_narrow_filter`
- `parser_changed`
- `blocked`
- `disabled`
- `unknown`

raw HTML, 개인정보, 민감 정보는 `failureReason`에 저장하지 않는다.

### 3. Naver Careers 진단 확인

NAVER Careers official listing/API 접근, parser count, active/open validator 결과를 확인한다.
필요하면 diagnostics 요약을 보강하지만, 새 NAVER 계열 source를 늘리는 작업은 하지 않는다.

### 4. KakaoPay Securities 진단 확인

KakaoPay Securities listing/detail 접근, parser count, active/open validator 결과를 확인한다.
필요하면 diagnostics 요약을 보강하지만, Kakao 계열 adapter를 새로 여러 개 추가하지 않는다.

### 5. 재import와 UI 표시 검증

수집 snapshot 또는 실제 collect smoke를 다시 import하고, `/dashboard/sources`에서 0건 reason이 보이는지 확인한다.
실제 source가 0건이면 정상 0건과 parser/blocked/unknown을 구분해야 한다.

### 6. task index 완료 기록

검증이 모두 통과하면 `career-os/tasks/plan075-fos-career-source-registry-collection-runs/index.json`을 업데이트한다.
`status`는 `completed`, 모든 phase status는 `completed`, `current_phase`는 5로 둔다.
검증 중 실패 또는 보류가 있으면 completed로 표시하지 말고 `PHASE_FAILED` 또는 `PHASE_BLOCKED`로 종료한다.

---

## Critical Files

| 저장소 | 파일 | 변경 |
|---|---|---|
| career-os | `scripts/position-recommender/live-postings/adapters/naver-careers.ts` | 필요한 경우 diagnostics 요약 보강 |
| career-os | `scripts/position-recommender/live-postings/adapters/kakaopay-securities.ts` | 필요한 경우 diagnostics 요약 보강 |
| career-os | `scripts/position-recommender/live-postings/*` | zero/failure diagnostics가 renderer에 남도록 최소 수정 |
| career-os | `tasks/plan075-fos-career-source-registry-collection-runs/index.json` | 마지막 검증 통과 시 completed 기록 |
| fos-career | `db/import-positions.ts` 또는 import helper | zeroReason/failureReason mapping 보강 |
| fos-career | `app/dashboard/sources/**` | 필요한 경우 reason 표시 fallback 보강 |

읽기 전용 확인 파일:

- `career-os/docs/adr.md`
- `career-os/docs/flow.md`
- `career-os/tasks/plan075-fos-career-source-registry-collection-runs/index.json`

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
AI_NODES_ROOT="$(pwd)"

bun --version
rg -n "naver-careers|kakaopay-securities|zeroReason|failureReason|parser_changed|blocked|too_narrow_filter|no_matching_postings" career-os/scripts/position-recommender ~/services/fos-career/db ~/services/fos-career/lib ~/services/fos-career/app

cd ~/services/fos-career
pnpm exec tsc --noEmit
pnpm build

# 실제 collect/import 재검증은 phase 04 runner 또는 phase 02 import CLI를 사용한다.
pnpm tsx db/import-positions.ts --snapshot "$AI_NODES_ROOT/career-os/data/runtime/live-position-postings.md" --requested-source all --dry-run
pnpm tsx db/import-positions.ts --snapshot "$AI_NODES_ROOT/career-os/data/runtime/live-position-postings.md" --requested-source all

git status --short
git -C "$AI_NODES_ROOT/career-os" status --short
jq '.status, .current_phase, [.phases[].status]' "$AI_NODES_ROOT/career-os/tasks/plan075-fos-career-source-registry-collection-runs/index.json"
```

실제 DB query로 Naver Careers와 KakaoPay Securities의 latest diagnostics status, count, zeroReason, failureReason을 출력한다.

---

## 성공 기준

- Naver Careers와 KakaoPay Securities의 latest diagnostics가 0건일 때 `zeroReason` 또는 `failureReason`을 가진다.
- 정상 0건과 parser 변경, 차단, 필터 과도, 알 수 없음이 구분된다.
- source별 진단 보강이 다른 source 수집과 import를 막지 않는다.
- `/dashboard/sources`에서 0건 reason이 확인 가능하다.
- `pnpm exec tsc --noEmit`, `pnpm build`가 통과한다.
- `index.json`이 completed 상태와 phase별 completed 상태를 기록한다.
- source adapter를 무제한 확장하지 않는다.
- career-os docs/ADR/AGENTS는 수정하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- 0건 원인 분류가 docs/ADR에 없는 새 enum 또는 정책 결정을 요구한다.
- Naver Careers 또는 KakaoPay Securities가 로그인, 브라우저 인증, 외부 계정 접근 없이는 원인 확인이 불가능하다.
- 실제 DB latest diagnostics를 확인할 수 없다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- 0건 source를 단순 `ok` 또는 빈 reason으로 처리하는 경우.
- raw HTML이나 민감 정보를 `failureReason`에 저장하는 경우.
- source adapter를 plan075 범위 밖으로 대량 추가하는 경우.
- `pnpm exec tsc --noEmit` 또는 `pnpm build`를 실행하지 못한 경우.
- 검증 실패 또는 보류가 있는데 `index.json`을 completed로 표시한 경우.
- unrelated dirty 파일을 stage하거나 revert한 경우.
- career-os docs/ADR/AGENTS를 수정한 경우.

---

## common-pitfalls self-check

- [ ] 첫 bash 블록이 `cd "$(git rev-parse --show-toplevel)"`로 시작한다.
- [ ] 0건 reason enum은 docs에 이미 있는 값만 쓴다.
- [ ] source adapter 확장은 보강 대상 2개 source로 제한한다.
- [ ] raw HTML이나 민감 정보를 저장하지 않는다.
- [ ] 마지막 phase에서 task index 완료 상태를 검증한다.
- [ ] phase 안에서 docs/ADR을 수정하지 않는다.
