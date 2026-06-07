# Phase 03 — 이력서 패키지 처리 후검증

**Model**: sonnet
**Status**: pending

---

## 목표

`run.ts resume` 이후 processor가 실제 산출물을 검증하도록 만든다.
ledger 상태 전이는 파일 존재, freshness, review verdict를 확인한 뒤에만 허용한다.

**범위 외**: 문서 본문 생성 prompt 개선, dashboard UI, export.

---

## 관련 docs

실행 전 반드시 읽는다.

- `docs/data-schema.md` — Resume Package Contract
- `docs/flow.md` — Resume Package Flow와 post-validation
- `docs/code-architecture.md` — application-agent runner 책임
- `docs/adr.md` — ADR-038, ADR-040, ADR-056
- `tasks/plan031-application-flow-agent/index.json`

---

## 작업 항목 (5)

### 1. `run.ts resume` command 확인 또는 추가

수정 대상:

- `scripts/application-agent/run.ts`
- 관련 CLI/parser 파일

기존 resume command가 있으면 확장한다.
없으면 `resume <application-id>` 또는 `resume-package <application-id>` 중 기존 command naming에 맞는 entry를 추가한다.

### 2. 필수 산출물 검증 함수 추가

검증 대상:

- `posting.md`
- `fit-analysis.md`
- `application-package.md`
- `resume-draft.md`
- `cover-letter.md`
- `submission-checklist.md`
- `review.md`

파일 경로는 ledger record의 `applicationDir`과 optional path fields를 우선 사용한다.

### 3. freshness 검증 추가

`review.md`는 생성 문서보다 같거나 최신이어야 한다.
revision loop에서는 이전 review만 보고 통과하지 않도록 mtime 또는 명시 metadata를 확인한다.

### 4. status transition gate 연결

post-validation 실패 시 ledger status를 앞서 보내지 않는다.
실패는 request status `failed` 또는 `stale`에 반영하고,
decision log에 누락 파일과 사유를 남긴다.

### 5. fixture/smoke 검증

비민감 fixture 또는 temp directory로 missing-file, stale-review, complete-package 사례를 검증한다.
실제 private application 문서를 git에 추가하지 않는다.

---

## 성공 기준

- 필수 7개 산출물이 없으면 `ready_for_user_review`로 넘어가지 않는다.
- stale review는 통과하지 않는다.
- 검증 실패가 ledger를 오염시키지 않는다.
- missing/stale/error가 request status 또는 decision log에서 확인된다.
- private application data가 git 추적 파일로 추가되지 않는다.

---

## 검증

보고 직전 반드시 실행한다.

```bash
bun --check scripts/application-agent/run.ts
rg "resume-draft.md|cover-letter.md|submission-checklist.md" scripts/application-agent
rg "posting.md|fit-analysis.md|application-package.md|review.md" scripts/application-agent
git status --short
```

가능하면 fixture smoke를 실행한다.

```bash
bun scripts/application-agent/run.ts validate
```

---

## Blocked / Failed 조건

- `run.ts` command 구조를 안전하게 확장할 수 없으면 `PHASE_BLOCKED: run.ts resume command boundary unclear`를 출력하고 exit 2.
- ledger schema와 path fields가 충돌하면 `PHASE_BLOCKED: resume material path schema decision required`를 출력하고 exit 2.
- 검증 명령이 실패하고 수정하지 못하면 `PHASE_FAILED: resume post-validation failed`를 출력하고 exit 1.

---

## Intended File Scope

- `scripts/application-agent/run.ts`
- `scripts/application-agent/actions.ts`
- `scripts/application-agent/skill_contracts.ts`
- `scripts/application-agent/*resume*`
- `scripts/application-agent/fixtures/**`
- 필요 시 `docs/data-schema.md`, `docs/flow.md`

---

## Self-check

- 실제 외부 제출 action을 만들지 않는다.
- `data/applications/` private 산출물을 git에 추가하지 않는다.
- 파일 존재만으로 품질 pass를 의미한다고 오해하지 않는다.
