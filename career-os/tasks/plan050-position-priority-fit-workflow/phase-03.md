# Phase 03 — User-confirmed priority and preparation actions

**Model**: sonnet
**Status**: pending

---

## 목표

사용자가 확정한 action stage와 rank를 LLM refresh와 분리해 저장하고, next action을 application/study/interview 준비 흐름으로 연결한다.

**범위 외**: 외부 지원 제출, 공개 발행, dashboard write UI, docs 수정.

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
- `career-os/docs/data-schema.md` — userConfirmedPriority and priority history
- `career-os/docs/flow.md` — preparation actions
- `career-os/scripts/application-agent/priority_schema.ts`
- `career-os/scripts/application-agent/priority_history.ts`
- `career-os/scripts/application-agent/policy.ts`
- `career-os/scripts/application-agent/actions.ts`

---

## 작업 항목

### 1. User confirmation command 추가

application-agent CLI에 priority confirmation command를 추가한다.
예: `bun career-os/scripts/application-agent/run.ts confirm-priority --record-id <id> --stage investigate --rank 2 --reason "..."`

동작:

- frontdoor queue 또는 ledger에서 record를 찾는다.
- `userConfirmedPriority`를 갱신한다.
- `_priority-history.jsonl`에 previous/next event를 append한다.
- `recommendationSnapshot`은 수정하지 않는다.

### 2. Preparation action mapping

action stage를 다음 action 후보로 연결한다.

- `prepare-now`: posting/fit/gap 최신화, package draft, interview practice.
- `investigate`: source URL 재확인, role scope 확인, risk flag 정리.
- `monitor`: nextRunAt 또는 daily refresh 대상 유지.
- `low-priority`: dashboard 하위 표시, 자동 package draft 제외.
- `hold`: 사용자 판단 또는 조건 대기.
- `excluded`: 추천/준비 후보 제외.

### 3. Existing workflow 재사용 연결

새 generator를 만들지 않고 기존 workflow 호출 후보만 남긴다.

- application package writer 후보
- application reviewer 후보
- study-topic-recommender / study-pack-writer 후보
- interview-prep-analyzer / interview-asset-writer 후보

### 4. Safety checks

- `excluded` 자동 확정 금지.
- user-confirmed priority가 있으면 policy/render path에서 recommendation snapshot보다 우선.
- 외부 제출, 로그인, 공개 발행, profile 원본 수정은 기존 금지 action을 유지.

---

## 검증

보고 직전 반드시 본 bash 블록을 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun --check career-os/scripts/application-agent/run.ts
bun --check career-os/scripts/application-agent/actions.ts
bun --check career-os/scripts/application-agent/policy.ts
bun career-os/scripts/application-agent/run.ts validate
git diff --check
```

history append smoke는 fixture 또는 temp runtime file을 사용하고 실제 private records를 바꾸지 않는다.

Commit/push:

```bash
cd "$(git rev-parse --show-toplevel)"
git status --short
git add career-os/scripts/application-agent/run.ts \
  career-os/scripts/application-agent/actions.ts \
  career-os/scripts/application-agent/policy.ts \
  career-os/scripts/application-agent/render_decision_log.ts
git commit -m "feat(career): store user-confirmed priority actions"
git push origin main
```

---

## 의도 메모

- final priority는 사용자 확정값이므로 LLM refresh와 분리한다.
- preparation action은 이미 있는 application/study/interview workflow로 이어져야 한다.

## Blocked 조건

- record id를 frontdoor queue와 ledger 양쪽에서 찾는 공통 패턴이 없으면 `PHASE_BLOCKED: priority confirmation record lookup needs design decision`을 출력하고 exit 2.
- confirmation command가 recommendation snapshot을 덮어쓰면 `PHASE_FAILED: user confirmation overwrote recommendation snapshot`을 출력하고 exit 1.

