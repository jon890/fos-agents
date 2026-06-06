# Phase 02 — Recommendation snapshot from postings and existing assets

**Model**: sonnet
**Status**: pending

---

## 목표

plan048 collected postings, position recommendation reports, candidate/profile material, application-agent files를 읽어 LLM recommendation snapshot 초안을 생성하는 경로를 만든다.

**범위 외**: user-confirmed priority 수정, dashboard UI, 새 채용 source adapter, docs 수정.

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

- `career-os/docs/adr.md` — ADR-052, ADR-051
- `career-os/docs/flow.md` — Position Priority + Posting/Fit Analysis Workflow
- `career-os/docs/code-architecture.md` — Position priority layer
- `career-os/docs/data-schema.md` — recommendationSnapshot fields
- `career-os/data/runtime/live-position-postings.md` if present
- `career-os/data/runtime/position-recommendation.md` if present
- `career-os/config/candidate-profile.md`

---

## 작업 항목

### 1. Input collector 작성

`career-os/scripts/application-agent/priority_recommendation.ts`를 추가한다.
다음 입력을 optional로 읽는다.

- `data/runtime/live-position-postings.md`
- `data/runtime/position-recommendation.md`
- 최근 daily position recommendation report
- `data/runtime/application-agent/frontdoor-queue.jsonl`
- `data/applications/ledger.jsonl`
- existing application files: `posting.md`, `fit-analysis.md`, `review.md`
- manual active-open URL notes가 있으면 evidence input으로 읽는다.

### 2. Posting/fit/gap summary projection

공고별로 아래 summary object를 만든다.

- posting analysis: active/open evidence, role, stack, deadline, source URL.
- fit summary: candidate profile and reusable application assets 근거.
- gap summary: 부족 역량, 확인해야 할 요구사항, risk flags.
- preparation actions: package draft, interview practice, study pack candidate, monitor, investigate.

### 3. Recommendation snapshot write path

frontdoor queue record 또는 ledger record에 `recommendationSnapshot`, `actionStage`, `priorityRank`, `priorityReason`, `nextAction`, `riskFlags`, `evidenceUrls`를 갱신한다.
`userConfirmedPriority`는 절대 수정하지 않는다.

### 4. CLI smoke command

직접 실행 가능한 CLI를 제공한다.
예: `bun career-os/scripts/application-agent/priority_recommendation.ts --dry-run`.
`--dry-run`은 파일을 쓰지 않고 candidate count와 stage distribution만 출력한다.

---

## 검증

보고 직전 반드시 본 bash 블록을 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun --check career-os/scripts/application-agent/priority_recommendation.ts
bun career-os/scripts/application-agent/priority_recommendation.ts --dry-run
git diff --check
```

`userConfirmedPriority` 보호 검증:

```bash
cd "$(git rev-parse --show-toplevel)"
rg -n "userConfirmedPriority" career-os/scripts/application-agent/priority_recommendation.ts
```

Commit/push:

```bash
cd "$(git rev-parse --show-toplevel)"
git status --short
git add career-os/scripts/application-agent/priority_recommendation.ts \
  career-os/scripts/application-agent/frontdoor_queue_io.ts \
  career-os/scripts/application-agent/ledger_io.ts
git commit -m "feat(career): derive priority recommendation snapshots"
git push origin main
```

---

## 의도 메모

- 이 phase는 collected posting을 바로 지원 행동으로 번역한다.
- 판단 근거는 recommendation snapshot에 남기고, 최종 사용자의 우선순위 확정값은 보존한다.

## Blocked 조건

- active/open posting input을 찾을 수 없고 fixture도 만들 수 없으면 `PHASE_BLOCKED: no posting input available for priority snapshot smoke`를 출력하고 exit 2.
- dry-run이 candidate count와 stage distribution을 출력하지 못하면 `PHASE_FAILED: priority recommendation dry-run failed`를 출력하고 exit 1.
