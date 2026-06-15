# Phase 03 — 추천 후보 구조화 추출과 ingest 보강

**Model**: sonnet
**Status**: pending

## 목표

추천 후보 카드에 필요한 `priorityReason`, `nextAction`, `riskFlags`, `evidenceUrls`가 structured recommendation item과 fos-career DB ingest에서 조용히 null로 빠지지 않게 보강한다.
기본값은 DB schema 변경 없이 existing JSON snapshot과 ingest helper를 개선하는 것이다.

**범위 외**: 추천 개수 정책 변경, DB schema 변경 기본 도입, dashboard shell 변경, 외부 제출/로그인/업로드, career-os docs/ADR 수정.

---

## 사전 cwd 설정

본 phase는 career-os runner와 fos-career ingest helper를 함께 다룬다.
첫 bash에서 career-os로 이동하고, fos-career 명령은 `cd ~/services/fos-career`를 명시해 실행한다.

```bash
cd ~/ai-nodes/career-os
pwd
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/data-schema.md`의 recommendation item과 `application_candidates.latestSnapshotJson` 섹션
- `career-os/docs/flow.md`의 `/position-recommender`와 plan074 ingest 설명
- `career-os/docs/adr.md`의 ADR-082
- `career-os/tasks/plan074-fos-career-mobile-position-explorer/index.json`
- `~/services/fos-career/AGENTS.md`

---

## 작업 항목

### 1. 구조화 추출 책임 경계 확인

career-os `scripts/position-recommender/structured_recommendation_items.ts`와 fos-career `scripts/ingest-position-recommendations.ts`를 읽는다.
Markdown/items 생성 책임은 career-os, DB upsert와 candidate state 반영 책임은 fos-career로 나눈다.

### 2. career-os structured item 보강

Markdown 리포트 또는 item source에 있는 추천 근거, 다음 행동, 주의 조건, 근거 URL을 `priorityReason`, `nextAction`, `riskFlags`, `evidenceUrls`로 채운다.
필드가 비어도 허용되는 경우와 누락으로 잡아야 하는 경우를 코드에 명확히 둔다.

### 3. fos-career ingest 검증 보강

fos-career ingest dry-run summary 또는 로그에서 카드 필수 필드 누락을 드러낸다.
기존 JSON snapshot을 `latestSnapshotJson`으로 저장하는 경로를 보존하고, schema 변경 없이 가능한 범위에서 null 누락을 줄인다.

### 4. fixture 또는 dry-run 검증 추가

실제 당일 리포트를 건드리기 전에 fixture, latest runtime report, 또는 dry-run으로 누락 필드 count를 확인한다.
Markdown에 근거가 있는데 structured item만 null인 사례가 재발하지 않는지 검증한다.

### 5. phase commit

의도한 career-os runner 변경과 fos-career ingest helper 변경만 stage하고 commit한다.
두 저장소를 모두 변경했다면 각각의 저장소에서 status와 commit 범위를 별도로 보고한다.

---

## Critical Files

| 저장소 | 파일 | 변경 |
|---|---|---|
| career-os | `scripts/position-recommender/structured_recommendation_items.ts` | 추천 후보 구조화 필드 추출 보강 |
| career-os | `scripts/position-recommender/run_daily_with_claude.ts` | structured item 생성/검증 호출 보강이 필요할 때만 수정 |
| career-os | `scripts/position-recommender/templates/report.html` | 카드 필드 source와 무관한 표시 template 수정은 피함 |
| fos-career | `scripts/ingest-position-recommendations.ts` | DB ingest dry-run summary와 누락 필드 검증 |
| fos-career | `scripts/application-candidate-utils.ts` | snapshot normalization helper가 있을 때만 최소 수정 |
| fos-career | `lib/reports/position-reports.ts` | dashboard 카드 fallback에 필요한 read helper만 최소 수정 |

읽기 전용 확인 파일:

- `career-os/docs/data-schema.md`
- `career-os/docs/flow.md`
- `career-os/docs/adr.md`
- `career-os/tasks/plan074-fos-career-mobile-position-explorer/index.json`
- `~/services/fos-career/AGENTS.md`

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd ~/ai-nodes/career-os

bun --check scripts/position-recommender/structured_recommendation_items.ts
bun --check scripts/position-recommender/run_daily_with_claude.ts

grep -R "priorityReason\\|nextAction\\|riskFlags\\|evidenceUrls" -n scripts/position-recommender scripts/application-agent | head -50

cd ~/services/fos-career

pnpm exec tsc --noEmit
pnpm build
grep -R "priorityReason\\|nextAction\\|riskFlags\\|evidenceUrls" -n scripts lib app | head -80

git status --short
cd ~/ai-nodes/career-os
git status --short
```

가능하면 fos-career ingest dry-run 명령을 실행한다.
정확한 script 옵션은 `~/services/fos-career/package.json`과 `scripts/ingest-position-recommendations.ts`를 확인한 뒤 사용한다.

---

## 성공 기준

- structured recommendation item이 `priorityReason`, `nextAction`, `riskFlags`, `evidenceUrls`를 채우는 경로를 가진다.
- Markdown에 근거가 있는데 structured item이 null로 조용히 통과하는 경우가 dry-run summary나 로그에 드러난다.
- fos-career ingest가 existing JSON snapshot을 보존하면서 카드 필수 필드 누락을 품질 신호로 다룬다.
- career-os `bun --check`와 fos-career `pnpm exec tsc --noEmit`, `pnpm build`가 통과한다.
- DB schema 변경 없이 완료한다. schema 변경이 필요하면 PHASE_BLOCKED 또는 migration 포함 판단을 명확히 남긴다.
- career-os docs/ADR/AGENTS는 수정하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- 필수 카드 필드를 안정적으로 채우려면 Markdown 리포트 형식 정책 변경이 필요하다.
- DB schema 변경이 필요하고 docs/data-schema.md 또는 ADR 추가 결정 없이는 진행할 수 없다.
- career-os runner와 fos-career ingest 중 어느 쪽이 정본 추출 책임을 가져야 하는지 문서 결정과 충돌한다.
- 두 저장소 중 하나에 unrelated dirty 변경이 있어 변경을 안전하게 분리할 수 없다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- 카드 필수 필드 누락 검증 없이 완료 보고하려는 경우.
- DB schema 변경을 했지만 migration 적용/검증 기준을 포함하지 않은 경우.
- career-os 또는 fos-career 검증 명령을 실행하지 못한 경우.
- unrelated dirty 파일을 stage하거나 revert한 경우.
- career-os docs/ADR/AGENTS를 수정한 경우.

---

## common-pitfalls self-check

- [ ] career-os runner와 fos-career ingest helper 책임을 섞지 않는다.
- [ ] schema 변경이 필요하면 migration 적용/검증까지 포함하거나 PHASE_BLOCKED로 멈춘다.
- [ ] 성공 기준은 check/build/grep/dry-run output으로 판정 가능하다.
- [ ] career-os docs/ADR 수정은 범위 밖이다.
- [ ] 두 저장소 status를 각각 보고한다.
