# Phase 04 — Dashboard projection and end-to-end validation

**Model**: haiku
**Status**: completed

---

## 목표

career-os priority fields를 dashboard가 읽기 쉬운 projection으로 정리하고, collected posting부터 priority display까지 end-to-end 검증한다.

**범위 외**: dashboard write UI, external submission, new LLM provider, docs 수정.

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
- `career-os/docs/code-architecture.md` — fos-career read-only career-os files, Position priority layer
- `career-os/docs/data-schema.md` — priority fields and history
- `career-os/tasks/plan050-position-priority-fit-workflow/index.json`

---

## 작업 항목

### 1. Dashboard summary projection

`career-os/scripts/application-agent/priority_dashboard_view.ts`를 추가한다.

각 record를 다음 필드로 project한다.

- record id, company, role, URL
- effective action stage: `userConfirmedPriority`가 있으면 우선
- priority badge label and numeric display value
- fit summary
- gap summary
- next action
- risk flags
- evidence URLs
- latest recommendation snapshot timestamp
- latest user confirmation timestamp
- priority history count

### 2. Dashboard read contract 확인

fos-career가 읽는 career-os 파일 목록과 projection output이 맞는지 확인한다.
fos-career repo 수정은 이 phase에서 하지 않는다.
필요한 dashboard work가 발견되면 별도 후속 task로 남긴다.

### 3. End-to-end smoke

plan048 snapshot 또는 fixture를 입력으로 사용해 다음을 확인한다.

- recommendation snapshot 생성 가능.
- user-confirmed priority가 snapshot보다 우선 표시됨.
- history event count가 projection에 반영됨.
- action stage filter 값이 6개 enum을 모두 인식함.

### 4. Task completion

모든 검증이 통과하면 `index.json`을 completed로 마킹한다.
검증 결과를 phase stdout에 요약한다.

---

## 검증

보고 직전 반드시 본 bash 블록을 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun --check career-os/scripts/application-agent/priority_dashboard_view.ts
bun career-os/scripts/application-agent/priority_recommendation.ts --dry-run
bun career-os/scripts/application-agent/run.ts validate
git diff --check
```

Projection smoke:

```bash
cd "$(git rev-parse --show-toplevel)"
bun career-os/scripts/application-agent/priority_dashboard_view.ts --dry-run
```

Task status update and commit/push:

```bash
cd "$(git rev-parse --show-toplevel)"
git status --short
git add career-os/scripts/application-agent/priority_dashboard_view.ts \
  career-os/tasks/plan050-position-priority-fit-workflow/index.json
git commit -m "test(career): validate priority dashboard projection"
git push origin main
```

If run-phases.py writes trailing task metadata after the commit, perform one cleanup commit with only the task index metadata and push it.

---

## 의도 메모

- dashboard는 priority를 읽기 전용으로 표시한다.
- write action은 별도 승인된 후속 plan에서 다룬다.

## Blocked 조건

- fos-career read-only adapter가 priority fields를 표시할 수 없는 구조라면 `PHASE_BLOCKED: dashboard adapter requires separate task`를 출력하고 exit 2.
- projection이 user-confirmed priority보다 recommendation snapshot을 우선 표시하면 `PHASE_FAILED: dashboard projection priority precedence is wrong`을 출력하고 exit 1.
