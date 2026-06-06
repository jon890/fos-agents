# Phase 01 — Priority schema and history storage

**Model**: sonnet
**Status**: pending

---

## 목표

frontdoor queue와 ledger가 action stage priority, LLM recommendation snapshot, user-confirmed priority, priority history를 검증할 수 있게 schema와 저장 helper를 추가한다.

**범위 외**: LLM 추천 생성, dashboard UI, 공고 분석 본문 생성, docs 수정.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다. 본 phase는 ai-nodes repo root 기준 path를 사용하므로 첫 bash에서 repo root로 이동한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md` — ADR-052
- `career-os/docs/data-schema.md` — position priority fields, priority history
- `career-os/docs/code-architecture.md` — Position priority layer
- `career-os/scripts/application-agent/frontdoor_queue_schema.ts`
- `career-os/scripts/application-agent/ledger_schema.ts`

---

## 작업 항목

### 1. `priority_schema.ts` 추가

`career-os/scripts/application-agent/priority_schema.ts`를 추가한다.

- `actionStage`: `prepare-now`, `investigate`, `monitor`, `low-priority`, `hold`, `excluded`
- `priorityRank`: positive integer
- `priorityReason`: non-empty string
- `nextAction`: non-empty string for `prepare-now`
- `riskFlags`: string array
- `evidenceUrls`: URL string array
- `recommendationSnapshot`: `generatedAt`, `sourceReportPath`, optional posting/fit/gap/preparation summaries
- `userConfirmedPriority`: `confirmedAt`, `actionStage`, `priorityRank`, `reason`, `confirmedBy`

### 2. Existing schemas에 optional fields 연결

`frontdoor_queue_schema.ts`와 `ledger_schema.ts`에 priority optional fields를 연결한다.
기존 record가 깨지지 않아야 한다.

### 3. Priority history helper 추가

`career-os/scripts/application-agent/priority_history.ts`를 추가한다.

- 기본 경로: `career-os/data/applications/_priority-history.jsonl`
- 파일이 없으면 빈 배열을 반환한다.
- append write는 trailing newline을 유지한다.
- event schema는 `eventId`, `recordId`, `recordType`, `changedAt`, `changedBy`, `previous`, `next`, `reason`, `source`를 검증한다.

### 4. 자동 확정 방지 규칙 구현

- `recommendationSnapshot` write path는 `userConfirmedPriority`를 바꾸지 않는다.
- `excluded`는 `userConfirmedPriority` 또는 명확한 policy source 없이 자동 확정하지 않는다.
- `prepare-now`에는 `nextAction`과 하나 이상의 `evidenceUrls`가 필요하다.

---

## 검증

보고 직전 반드시 본 bash 블록을 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun --check career-os/scripts/application-agent/priority_schema.ts
bun --check career-os/scripts/application-agent/priority_history.ts
bun --check career-os/scripts/application-agent/frontdoor_queue_schema.ts
bun --check career-os/scripts/application-agent/ledger_schema.ts
git diff --check
```

파일 존재 검증:

```bash
cd "$(git rev-parse --show-toplevel)"
[ -f career-os/scripts/application-agent/priority_schema.ts ]
[ -f career-os/scripts/application-agent/priority_history.ts ]
```

Commit/push:

```bash
cd "$(git rev-parse --show-toplevel)"
git status --short
git add career-os/scripts/application-agent/priority_schema.ts \
  career-os/scripts/application-agent/priority_history.ts \
  career-os/scripts/application-agent/frontdoor_queue_schema.ts \
  career-os/scripts/application-agent/ledger_schema.ts
git commit -m "feat(career): add priority action stage schema"
git push origin main
```

---

## 의도 메모

- ADR-052의 핵심은 LLM recommendation snapshot과 user-confirmed priority를 분리하는 것이다.
- 이 phase는 후속 phase가 데이터를 안전하게 쓸 수 있는 최소 schema를 만든다.

## Blocked 조건

- 기존 zod schema 패턴을 찾을 수 없으면 `PHASE_BLOCKED: application-agent schema pattern unavailable`를 출력하고 exit 2.
- 기존 frontdoor/ledger fixtures가 optional priority fields 때문에 깨지면 `PHASE_FAILED: priority schema is not backward compatible`를 출력하고 exit 1.

