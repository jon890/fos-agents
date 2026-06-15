# Phase 03 — source diagnostics와 positions UI 연결

**Model**: sonnet
**Status**: pending

## 목표

fos-career dashboard가 source diagnostics를 `collected_positions` row에서 역산하지 않고 registry와 최신 collection run diagnostics에서 읽게 한다.
전체 공고 화면은 최신 collection run과 연결된 공고 상태를 보여준다.

**범위 외**: DB schema 신설, snapshot import core 구현, daily runner 연결, source adapter 확장, career-os docs/ADR 수정, 외부 채용 사이트 제출·로그인·업로드·공개 발행.

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

- `career-os/AGENTS.md`의 웹 대시보드 경계와 Validation and Git
- `career-os/docs/prd.md`의 plan074와 plan075 섹션
- `career-os/docs/data-schema.md`의 `position_sources`, `position_collection_runs`, `position_source_run_diagnostics`, `collected_positions`
- `career-os/docs/flow.md`의 source diagnostics 표시 기준과 `/dashboard/positions` 책임
- `career-os/docs/code-architecture.md`의 plan074 이후 UX 구조와 plan075 이후 source/collection 구조
- `career-os/docs/adr.md`의 ADR-082와 ADR-083
- `career-os/tasks/plan075-fos-career-source-registry-collection-runs/index.json`
- `~/services/fos-career/AGENTS.md`

---

## 작업 항목

### 1. 기존 `/dashboard/sources` 데이터 경로 제거 또는 격리

fos-career에서 source diagnostics가 `collected_positions.sourceDiagnostics` 또는 row-derived count를 읽는 코드를 찾는다.
새 화면의 정본 query는 `position_sources`, latest `position_collection_runs`, `position_source_run_diagnostics`가 되게 수정한다.
legacy field는 migration compatibility fallback으로만 남긴다.

### 2. latest run diagnostics query 구현

enabled registry source가 imported count 0이어도 표시되게 query를 만든다.
latest run이 없을 때는 source registry만 표시하고, run 없음 상태를 명확히 보여준다.

### 3. 0건과 실패 원인 표시

source row에 다음 정보를 표시한다.

- `zeroReason`: `no_matching_postings`, `too_narrow_filter`, `parser_changed`, `blocked`, `disabled`, `unknown`
- `failureReason`
- collected/imported/skipped/failed count
- latest run id와 run status

긴 diagnostics JSON이나 raw error는 접힘 영역 또는 detail text로 제한한다.

### 4. `/dashboard/positions` 최신 run 연결 표시

전체 공고 화면에서 각 공고의 `collectionRunId`와 source label을 표시하거나 filter/detail에 연결한다.
추천 후보와 전체 공고 pool의 구분은 유지한다.

### 5. UI smoke와 responsive 검증

desktop/mobile viewport에서 `/dashboard/sources`와 `/dashboard/positions`를 확인한다.
텍스트 겹침, 가로 overflow, nested card 구조, 긴 failure reason으로 인한 layout 깨짐이 없어야 한다.

---

## Critical Files

| 저장소 | 파일 | 변경 |
|---|---|---|
| fos-career | `app/dashboard/sources/**` | registry + latest run diagnostics 조회와 표시 |
| fos-career | `app/dashboard/positions/**` | source label, latest run 연결 표시 |
| fos-career | `lib/db/**` | source diagnostics와 positions query helper |
| fos-career | `app/globals.css` 또는 관련 CSS | responsive overflow와 접힘 영역 보정 |

읽기 전용 확인 파일:

- `career-os/docs/flow.md`
- `career-os/docs/code-architecture.md`
- `career-os/tasks/plan075-fos-career-source-registry-collection-runs/index.json`

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
cd ~/services/fos-career

pnpm exec tsc --noEmit
pnpm build

grep -R "sourceDiagnostics" -n app lib db | head -50
grep -R "position_sources\|position_collection_runs\|position_source_run_diagnostics\|zeroReason\|failureReason\|collectionRunId" -n app lib db | head -100

git diff --cached --name-only
git status --short
```

가능하면 Docker 또는 local dev server에서 `/dashboard/sources`와 `/dashboard/positions`를 desktop/mobile로 열어 screenshot 또는 짧은 관찰 결과를 남긴다.
브라우저 확인을 못 하면 이유를 phase 보고에 남긴다.

---

## 성공 기준

- `/dashboard/sources`는 source registry와 latest collection run diagnostics를 정본으로 읽는다.
- enabled source는 imported count 0이어도 화면에 보인다.
- 0건 source는 `zeroReason` 또는 `failureReason`을 사용자에게 확인 가능한 형태로 보여준다.
- `/dashboard/positions`는 source label과 최신 collection run 연결을 표시한다.
- row-derived `sourceDiagnostics`는 새 source list 정본으로 쓰이지 않는다.
- `pnpm exec tsc --noEmit`, `pnpm build`가 통과한다.
- career-os docs/ADR/AGENTS는 수정하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- phase 01 schema 또는 phase 02 import 결과가 없어 UI query를 실제 DB 기준으로 검증할 수 없다.
- source diagnostics 표시가 docs/ADR에 없는 새 상태 enum 또는 정책 결정을 요구한다.
- 현재 dashboard route 구조가 plan074 결정과 달라 새 planning이 필요하다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- `/dashboard/sources`가 계속 `collected_positions` row-derived diagnostics를 정본으로 쓰는 경우.
- 0건 source가 registry에 있어도 화면에서 사라지는 경우.
- `pnpm exec tsc --noEmit` 또는 `pnpm build`를 실행하지 못한 경우.
- unrelated dirty 파일을 stage하거나 revert한 경우.
- career-os docs/ADR/AGENTS를 수정한 경우.

---

## common-pitfalls self-check

- [ ] 첫 bash 블록이 `cd "$(git rev-parse --show-toplevel)"`로 시작한다.
- [ ] UI 검증은 build와 grep뿐 아니라 가능하면 실제 viewport 확인을 포함한다.
- [ ] row-derived diagnostics fallback은 migration compatibility로만 둔다.
- [ ] phase 안에서 docs/ADR을 수정하지 않는다.
- [ ] unrelated dirty 변경을 stage하지 않는다.
