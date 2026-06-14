# Phase 02 — application candidate DB schema와 migration

**Model**: sonnet
**Status**: pending

---

## 목표

ADR-081의 application candidate state와 background outbox 정본을 fos-career MySQL schema와 migration으로 구현한다.

**범위 외**: report ingest 구현, dashboard UI, worker 실행 로직, legacy 파일 삭제, career-os docs/ADR 수정.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/data-schema.md`의 fos-career MySQL 스키마, application candidate state, career_outbox_jobs
- `career-os/docs/adr.md`의 ADR-081
- `career-os/docs/code-architecture.md`의 fos-career 웹 대시보드
- `/home/bifos/services/fos-career/db/schema.ts`
- `/home/bifos/services/fos-career/db/migrations/meta/_journal.json`
- `/home/bifos/services/fos-career/package.json`

---

## 작업 항목

### 1. Drizzle schema 추가

`/home/bifos/services/fos-career/db/schema.ts`에 다음 테이블을 추가한다.

- `application_state_master`
- `application_stage_master`
- `application_stage_transitions`
- `position_recommendation_runs`
- `application_candidates`
- `application_candidate_states`
- `career_outbox_jobs`

state 기본값은 `recommended`, `held`, `excluded`, `started`, `closed`다.
stage 기본값은 `company_analysis`, `posting_analysis`, `fit_analysis`, `study_pack`, `resume_draft`, `submitted`, `resume_passed`, `interview_prep`다.

### 2. unique key와 index 정의

`application_candidates.candidateKey`와 `career_outbox_jobs.idempotencyKey`는 unique여야 한다.
dashboard 조회와 worker lock에 필요한 index를 추가한다.

### 3. migration 생성

pnpm 기반 drizzle 명령으로 migration을 생성한다.
생성된 SQL에 master seed 또는 deterministic insert가 필요한지 확인하고, drizzle-kit 패턴에 맞게 처리한다.

### 4. migration smoke

가능하면 local MySQL 또는 기존 docker compose 환경에서 migration 적용 smoke를 실행한다.
DB 연결 정보가 없으면 schema generation과 SQL inspection까지 수행하고 `PHASE_BLOCKED` 여부를 판단한다.

### 5. phase commit

schema와 migration 파일만 stage하고 commit한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `/home/bifos/services/fos-career/db/schema.ts` | application candidate state와 outbox schema 추가 |
| `/home/bifos/services/fos-career/db/migrations/*.sql` | 신규 migration |
| `/home/bifos/services/fos-career/db/migrations/meta/*` | drizzle migration metadata 갱신 |

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
cd /home/bifos/services/fos-career

pnpm exec tsc --noEmit
pnpm build
rg -n "application_candidates|application_candidate_states|career_outbox_jobs|position_recommendation_runs" db/schema.ts db/migrations
rg -n "frontdoor queue|frontdoor-queue" db/schema.ts && exit 1 || true
git diff --check
git status --short
```

---

## 성공 기준

- ADR-081에 적힌 테이블이 Drizzle schema와 migration에 존재한다.
- candidate key와 outbox idempotency key unique 제약이 있다.
- master state/stage와 transition seed 전략이 migration에서 확인 가능하다.
- `pnpm exec tsc --noEmit`와 `pnpm build`가 통과한다.
- career-os docs/ADR은 수정하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- docs에 없는 state, stage, transition 결정이 필요하다.
- MySQL migration seed 방식이 기존 운영 정책과 충돌한다.
- local DB가 없어 migration smoke를 못 하는 수준을 넘어 schema 자체 확정이 불가능하다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.

- schema만 만들고 migration을 만들지 않은 경우.
- unique/idempotency 제약 없이 outbox를 만든 경우.
- 검증 명령을 실행하지 못한 경우.
- unrelated dirty 파일을 stage하거나 revert한 경우.

---

## common-pitfalls self-check

- [ ] 성공 기준은 `pnpm`, `rg`, `git diff --check`로 판정 가능하다.
- [ ] 새 DB schema는 이미 docs-first로 기록된 ADR-081과 data-schema 범위 안이다.
- [ ] phase 안에서 docs를 수정하지 않는다.
- [ ] fos-career 외 다른 코드 저장소를 수정하지 않는다.
- [ ] 첫 bash 블록에서 ai-nodes 루트로 이동한다.
