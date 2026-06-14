# Phase 08 — 통합 검증과 task 완료 마킹

**Model**: haiku
**Status**: pending

---

## 목표

plan073 전체 변경을 pnpm build/lint/typecheck, migration smoke, report ingest smoke, card click smoke, worker dry-run으로 검증하고 task 상태를 완료로 정리한다.

**범위 외**: 신규 기능 구현, docs/ADR 수정, legacy import 미검증 상태에서의 강제 삭제.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/tasks/plan073-dashboard-application-candidate-state/index.json`
- `career-os/docs/adr.md`의 ADR-081
- `career-os/docs/flow.md`의 Application Candidate State
- `/home/bifos/services/fos-career/package.json`
- `/home/bifos/services/fos-career/db/schema.ts`

---

## 작업 항목

### 1. 전체 정적 검증

career-os TypeScript와 fos-career pnpm 검증을 실행한다.
fos-career에 lint script가 없으면 `pnpm exec tsc --noEmit`와 `pnpm build`를 최소 기준으로 삼고, 없는 script를 새로 만들지는 않는다.

### 2. DB와 ingest smoke

migration smoke, report ingest dry-run, legacy import diff 검증을 실행한다.
DB 연결이 없어 smoke를 실행할 수 없으면 schema/sql/static 검증 결과와 blocker 여부를 명확히 판단한다.

### 3. UI action smoke

card click 지원 시작 dry-run 또는 route handler smoke로 state transition과 outbox idempotency를 확인한다.

### 4. worker dry-run

outbox worker dry-run으로 pending lock, retry/backoff, 첫 실행 묶음 handler 선택을 확인한다.

### 5. task 완료 마킹과 final commit

검증이 통과하면 `career-os/tasks/plan073-dashboard-application-candidate-state/index.json`의 status를 `completed`, phase 8 status를 `completed`, current_phase를 8로 갱신한다.
마지막 commit에는 intended files만 stage한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/tasks/plan073-dashboard-application-candidate-state/index.json` | 완료 상태 마킹 |

읽기 및 검증 대상:

- `career-os/scripts/position-recommender/*`
- `/home/bifos/services/fos-career/app`
- `/home/bifos/services/fos-career/lib`
- `/home/bifos/services/fos-career/scripts`
- `/home/bifos/services/fos-career/db`

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"

bun build --target bun --outfile /tmp/plan073-run-daily-check.js career-os/scripts/position-recommender/run_daily_with_claude.ts

cd /home/bifos/services/fos-career
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm build
pnpm run ingest:position-recommendations -- --dry-run
pnpm run smoke:start-application -- --dry-run
pnpm run process:career-outbox -- --dry-run

cd "$(git rev-parse --show-toplevel)"
rg -n "frontdoor queue|Frontdoor Queue" career-os/scripts career-os/.claude /home/bifos/services/fos-career/app /home/bifos/services/fos-career/lib /home/bifos/services/fos-career/scripts && exit 1 || true
git -C career-os diff --check
git -C career-os status --short
git -C /home/bifos/services/fos-career diff --check
git -C /home/bifos/services/fos-career status --short
```

---

## 성공 기준

- pnpm install, typecheck, build가 통과한다.
- migration smoke 또는 schema/sql 대체 검증 결과가 명확하다.
- report ingest dry-run과 legacy import diff 검증이 통과한다.
- card click smoke가 state transition과 outbox idempotency를 확인한다.
- worker dry-run이 pending lock, retry/backoff, 첫 실행 묶음을 확인한다.
- 새 사용자 화면과 새 workflow에 `frontdoor queue` 용어가 남지 않는다.
- task index가 completed로 갱신된다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- DB 연결이나 fixture 부재로 migration, ingest, click, worker 검증을 합리적으로 대체할 수 없다.
- legacy import diff가 통과하지 않아 cleanup 완료 판단이 불가능하다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.

- 검증 명령을 실행하지 않고 완료 마킹하는 경우.
- 실패한 build, typecheck, smoke를 무시하고 completed로 바꾸는 경우.
- legacy import 검증 없이 `frontdoor-queue.jsonl` 삭제를 완료 처리하는 경우.
- unrelated dirty 파일을 stage하거나 revert한 경우.

---

## common-pitfalls self-check

- [ ] 보고 직전 검증 bash 블록을 실제로 실행한다.
- [ ] 실패한 명령이 있으면 completed로 마킹하지 않는다.
- [ ] 마지막 status 변경 외 신규 구현을 하지 않는다.
- [ ] docs/ADR 수정은 범위 밖이다.
- [ ] git status에서 intended 변경만 남았는지 확인한다.
