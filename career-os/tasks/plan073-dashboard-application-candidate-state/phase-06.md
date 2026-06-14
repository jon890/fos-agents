# Phase 06 — outbox worker와 첫 분석 묶음 adapter

**Model**: sonnet
**Status**: completed

---

## 목표

fos-career DB outbox worker가 pending job을 lock, retry, backoff로 처리하고 `application.start`의 첫 실행 묶음인 회사 분석, 공고 분석, fit 분석을 career-os adapter로 시작하게 한다.

**범위 외**: 공부팩 생성, 이력서 초안 생성, 제출/면접 대비 stage 실행, legacy cleanup, career-os docs/ADR 수정.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md`의 ADR-081
- `career-os/docs/flow.md`의 outbox worker 규칙
- `career-os/docs/code-architecture.md`의 fos-career worker to career-os 인터페이스
- `career-os/docs/data-schema.md`의 `career_outbox_jobs`
- `/home/bifos/services/fos-career/scripts/process-application-actions.ts`
- `/home/bifos/services/fos-career/scripts/process-position-actions.ts`
- `/home/bifos/services/fos-career/lib/career-os/adapter.ts`

---

## 작업 항목

### 1. outbox worker skeleton

`career_outbox_jobs`에서 `pending`이고 `nextRunAt <= now()`인 job을 transaction으로 lock해 `running` 처리하는 worker를 만든다.
`lockedBy`, `lockedAt`, `attempts`, `status`, `lastError`, `resultJson`을 갱신한다.

### 2. retry와 backoff

일시 실패는 attempts를 증가시키고 backoff 뒤 `pending`으로 돌린다.
maxAttempts 초과나 재시도 불가능한 검증 실패는 `dead`로 둔다.

### 3. application.start handler

첫 실행 묶음으로 회사 분석, 공고 분석, fit 분석을 순서와 의존성에 맞게 시작한다.
기존 native skill 또는 application package workflow를 재사용하되, 외부 제출과 공개 발행은 호출하지 않는다.

### 4. dry-run mode

실제 skill 실행 없이 payload 검증, lock, handler 선택, 다음 stage 계산을 확인하는 dry-run 옵션을 만든다.
검증 smoke는 dry-run을 기본으로 한다.

### 5. phase commit

worker, adapter, package script만 stage하고 commit한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `/home/bifos/services/fos-career/scripts/*outbox*` | 신규 worker |
| `/home/bifos/services/fos-career/scripts/process-application-actions.ts` | 재사용 또는 대체 연결 |
| `/home/bifos/services/fos-career/lib/career-os/adapter.ts` | controlled local runner helper 추가 |
| `/home/bifos/services/fos-career/package.json` | worker/dry-run script 추가 |

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
cd /home/bifos/services/fos-career

pnpm exec tsc --noEmit
pnpm build
pnpm run process:career-outbox -- --dry-run
rg -n "career_outbox_jobs|lockedBy|nextRunAt|application.start|dry-run|company_analysis|posting_analysis|fit_analysis" scripts lib app
rg -n "submit|upload|login|publish" scripts lib && true
git diff --check
git status --short
```

---

## 성공 기준

- worker가 pending job lock, running 처리, success/failure 갱신, retry/backoff를 구현한다.
- `application.start` handler가 첫 실행 묶음인 회사 분석, 공고 분석, fit 분석만 처리한다.
- dry-run으로 DB와 runner 계약을 확인할 수 있다.
- 공부팩과 이력서 초안은 fit 분석 뒤 다음 stage로 남긴다.
- `pnpm exec tsc --noEmit`, `pnpm build`, dry-run이 통과한다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- 회사 분석, 공고 분석, fit 분석을 호출할 기존 career-os entrypoint가 확인되지 않는다.
- worker가 career-os checkout을 write mount로 요구한다.
- retry/backoff 정책이 docs에 없는 새 운영 결정을 요구한다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.

- lock 없이 pending job을 실행하는 경우.
- dry-run 없이 실제 skill 실행만 가능한 worker를 만든 경우.
- 공부팩, 이력서 초안, 제출, 공개 발행까지 한 번에 실행하는 경우.
- 검증 명령을 실행하지 못한 경우.

---

## common-pitfalls self-check

- [x] 성공 기준은 `pnpm`, dry-run, `rg`로 판정 가능하다.
- [x] 오래 걸리는 실행은 DB outbox job으로 관리한다.
- [x] 외부 제출, 로그인, 업로드, 공개 발행을 수행하지 않는다.
- [x] docs/ADR 수정은 범위 밖이다.
- [x] 첫 bash 블록에서 ai-nodes 루트로 이동한다.

---

## 완료 기록

- 완료 시각: 2026-06-14T16:20:19Z
- fos-career commit: `60c4a4b feat(fos-career): career outbox worker 추가`
- 변경 요약:
  - `process:career-outbox` worker를 추가했다.
  - pending `career_outbox_jobs`를 transaction으로 lock해 `running` 처리하고 success/failure/retry/backoff/dead 상태를 갱신한다.
  - `application.start` handler가 `company_analysis`, `posting_analysis`, `fit_analysis` 첫 분석 묶음만 처리하고 다음 stage를 `study_pack`으로 남긴다.
  - 실제 skill 실행 없이 payload, lock, handler, stage 계산을 확인하는 dry-run을 추가했다.
  - non-dry-run 실행은 기존 applier process 패턴과 같이 별도 `CAREER_OS_APPLIER_ROOT`/`CAREER_OS_ROOT`에서 수행한다.
- 검증:
  - `pnpm exec tsc --noEmit`
  - `DATABASE_URL='mysql://user:pass@127.0.0.1:3306/fos_career' SESSION_SECRET='0123456789abcdef0123456789abcdef' pnpm build`
  - `pnpm run process:career-outbox -- --dry-run`
  - `rg -n "career_outbox_jobs|lockedBy|nextRunAt|application.start|dry-run|company_analysis|posting_analysis|fit_analysis" scripts lib app`
  - `rg -n "submit|upload|login|publish" scripts lib && true`
  - `git diff --check`
- 비고:
  - 금지어 grep은 기존 login route, 기존 application preparation 코드, dry-run smoke의 금지어 검사에서만 잡혔다.
  - 신규 worker/handler에는 외부 제출, 업로드, 로그인, 공개 발행 실행 호출이 없다.
