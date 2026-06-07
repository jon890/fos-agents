# Phase 02 — 지원 준비 요청 상태 모델

**Model**: sonnet
**Status**: completed

---

## 목표

맞춤 이력서 생성 요청의 상태 모델을 만든다.
fos-career는 요청과 상태를 보여주고,
career-os runner는 실제 mutation과 검증을 맡는 경계를 유지한다.

**범위 외**: resume 문서 생성 로직, processor post-validation, UI polish, export.

---

## 관련 docs

실행 전 반드시 읽는다.

- `docs/data-schema.md` — priority request bridge, Resume Package Contract
- `docs/flow.md` — Resume Package Flow
- `docs/code-architecture.md` — plan053 bridge와 plan055 경계
- `docs/adr.md` — ADR-053, ADR-056
- `tasks/plan053-priority-write-action-design/index.json`

---

## 작업 항목 (5)

### 1. request status enum 정의

수정 대상 후보:

- `scripts/application-agent/*request*.ts`
- `/home/bifos/services/fos-career/lib/**`

기본 enum은 다음 값으로 둔다.

- `pending`
- `running`
- `done`
- `failed`
- `stale`

`applied` 같은 priority 전용 단어를 resume request에는 쓰지 않는다.

### 2. request payload contract 정의

요청 payload에는 최소한 다음 값을 둔다.

- request id
- `ledgerId`
- 요청 당시 ledger snapshot
- 요청자
- 요청 시각
- requested action: `generate_resume_package`

snapshot은 stale guard에 사용한다.

### 3. result projection 정의

처리 결과에는 다음 값을 둔다.

- `ledgerId`
- `status`
- `error`
- `resultSnapshot`
- 생성 또는 확인된 material paths

`resultSnapshot`은 사용자가 UI에서 결과를 이해할 수 있는 요약만 담는다.
지원 문서 전문은 status DB에 복사하지 않는다.

### 4. 기존 bridge 재사용 여부 구현

plan053 pending request bridge를 확장할 수 있으면 같은 패턴을 재사용한다.
기존 table/processor로 표현이 어렵다면 새 schema proposal을 docs에 먼저 남긴 뒤 구현한다.

### 5. 정적 검증

변경된 TypeScript 파일에 대해 `bun --check` 또는 repo의 기존 typecheck를 실행한다.
fos-career를 수정했다면 `/home/bifos/services/fos-career`에서 `npx tsc --noEmit`을 실행한다.

---

## 성공 기준

- application resume request status가 `pending/running/done/failed/stale`로 표현된다.
- stale request를 감지할 snapshot contract가 있다.
- status에는 `ledgerId`, `error`, `resultSnapshot`이 있다.
- fos-career가 career-os 파일을 직접 쓰지 않는다.
- public/private 문서 전문이 DB status에 복사되지 않는다.

---

## 검증

보고 직전 반드시 실행한다.

```bash
rg "pending|running|done|failed|stale" scripts/application-agent /home/bifos/services/fos-career/lib /home/bifos/services/fos-career/app || true
rg "ledgerId|resultSnapshot|generate_resume_package" scripts/application-agent /home/bifos/services/fos-career/lib /home/bifos/services/fos-career/app || true
git diff --stat
```

변경 파일에 맞춰 추가 실행한다.

```bash
bun --check scripts/application-agent/<changed-file>.ts
cd /home/bifos/services/fos-career && npx tsc --noEmit
```

---

## Blocked / Failed 조건

- fos-career repo가 없으면 `PHASE_BLOCKED: fos-career repo unavailable`를 출력하고 exit 2.
- 기존 priority request bridge가 resume request에 맞지 않고 새 DB schema 결정이 필요하면 `PHASE_BLOCKED: application request storage decision required`를 출력하고 exit 2.
- typecheck가 실패하고 원인을 수정하지 못하면 `PHASE_FAILED: application request status typecheck failed`를 출력하고 exit 1.

---

## Intended File Scope

- `scripts/application-agent/**`
- `/home/bifos/services/fos-career/lib/**`
- `/home/bifos/services/fos-career/app/**`
- 필요 시 `docs/data-schema.md`, `docs/flow.md`, `docs/code-architecture.md`

---

## Self-check

- 실제 resume 생성 로직을 이 phase에서 구현하지 않는다.
- request status에 지원 문서 본문을 저장하지 않는다.
- 외부 제출, 로그인, 공개 발행 action을 추가하지 않는다.
