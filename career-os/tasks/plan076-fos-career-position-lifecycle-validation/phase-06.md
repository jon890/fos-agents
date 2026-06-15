# Phase 06 - 검증과 배포 smoke

**Model**: haiku
**Status**: pending

---

## 목표

plan076 전체 변경을 최종 검증한다.
typecheck, build, migration 재실행, validator fixture, source failure fixture, reopen fixture, Docker health, 외부 `/dashboard/positions` 접근을 확인한다.

**범위 외**: 새 기능 구현, 공고 상세 페이지, source adapter 구현/수정, cron 자동 apply, career-os docs/ADR 수정, plan075 산출물 수정.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md`의 ADR-084
- `career-os/docs/prd.md`의 plan076 성공 범위
- `career-os/docs/flow.md`의 validator와 표시 흐름
- `career-os/docs/data-schema.md`의 lifecycle planned schema
- `career-os/docs/code-architecture.md`의 plan076 구조
- `career-os/tasks/plan076-fos-career-position-lifecycle-validation/index.json`
- `career-os/tasks/plan076-fos-career-position-lifecycle-validation/phase-01.md`
- `career-os/tasks/plan076-fos-career-position-lifecycle-validation/phase-02.md`
- `career-os/tasks/plan076-fos-career-position-lifecycle-validation/phase-03.md`
- `career-os/tasks/plan076-fos-career-position-lifecycle-validation/phase-04.md`
- `career-os/tasks/plan076-fos-career-position-lifecycle-validation/phase-05.md`
- `~/services/fos-career/AGENTS.md`

---

## 작업 항목

### 1. 정적 검증

fos-career에서 typecheck와 build를 실행한다.

### 2. migration smoke

기존 fos-career MySQL 또는 명시 smoke DB에서 `drizzle-kit migrate`를 2회 실행한다.
신규 table과 migration 상태를 확인한다.

### 3. lifecycle fixture 검증

다음 fixture 또는 동등한 smoke를 실행한다.

- validator dry-run
- validator apply
- source failure 또는 unstable source skip
- closed 공고 재등장 reopen

### 4. Docker health

기존 docker compose stack의 health를 확인한다.
새 DB 컨테이너를 만들지 않는다.

### 5. 외부 route smoke

외부 `/dashboard/positions` 접근 결과가 로그인 리다이렉트 또는 정상 응답인지 확인한다.
인증 우회나 테스트 계정 생성을 하지 않는다.

---

## Critical Files

| 저장소 | 파일 | 변경 |
|---|---|---|
| fos-career | 검증 fixture와 script | 필요 시 smoke script 보강 |
| fos-career | task completion report 대상 파일 | phase 완료 기록 |

읽기 전용 확인 파일:

- `career-os/tasks/plan076-fos-career-position-lifecycle-validation/index.json`
- `career-os/docs/adr.md`

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
cd ~/services/fos-career

pnpm exec tsc --noEmit
pnpm build
pnpm drizzle-kit migrate
pnpm drizzle-kit migrate

pnpm run validate:positions -- --dry-run
pnpm run validate:positions -- --dry-run --max-changes 1
# 프로젝트에 apply/source-failure/reopen fixture script가 있으면 여기서 실행하고 raw 결과를 남긴다.

docker compose ps
curl -I -L --max-redirs 0 http://localhost:3000/dashboard/positions || true

rg -n "position_status_events|position_validation_runs|manual_closed|validator_closed|validator_reopened|validation_skipped" db app lib scripts
git diff --check
git status --short
```

---

## 성공 기준

- `pnpm exec tsc --noEmit`과 `pnpm build`가 통과한다.
- `drizzle-kit migrate` 2회가 통과한다.
- dry-run/apply fixture가 `--apply` 경계와 `--max-changes` 상한을 확인한다.
- source failure fixture가 unstable source를 `validation_skipped`로 처리한다.
- reopen fixture가 닫힌 공고 재등장을 snapshot `posting_status`로 복원한다.
- Docker compose health가 정상이다.
- 외부 `/dashboard/positions`가 로그인 리다이렉트 또는 정상 응답을 반환한다.
- plan075 산출물, career-os docs/ADR/AGENTS는 수정되지 않았다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- 기존 DB 연결 또는 smoke DB 연결을 확인할 수 없다.
- 외부 route smoke가 인프라 접근 권한 때문에 확인 불가능하다.
- fixture가 없고 실제 DB에서 안전하게 대체 검증할 방법도 없다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.

- typecheck, build, migrate 재실행 중 하나라도 실패한다.
- dry-run/apply/source failure/reopen 중 핵심 fixture를 실행하지 않고 완료하려는 경우.
- 새 DB 컨테이너를 만든 경우.
- validator cron 자동 apply를 켠 경우.
- plan075 산출물 또는 career-os docs/ADR/AGENTS를 수정한 경우.
- unrelated dirty 파일을 stage하거나 revert한 경우.

---

## common-pitfalls self-check

- [ ] 첫 bash 블록이 `cd "$(git rev-parse --show-toplevel)"`로 시작한다.
- [ ] migration은 2회 실행한다.
- [ ] dry-run/apply/source failure/reopen fixture를 모두 확인한다.
- [ ] 외부 `/dashboard/positions`는 로그인 리다이렉트 또는 정상 응답만 확인한다.
- [ ] 새 기능 범위를 추가하지 않는다.
