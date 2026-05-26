# Phase 02 — ledger/runtime schema + validator 확장

## 목표

`scripts/application-agent/ledger_schema.ts`를 확장해 application-flow-agent가 읽고 쓸 수 있는 runtime 필드와 검증 규칙을 추가한다.

## 작업 범위

### 1. ledger schema 확장

기존 record와 호환되도록 optional field로 시작한다.

추가 후보:

- `agentPhase` 또는 `agentState`
- `nextRunAt`
- `lastDecisionAt`
- `decisionReason`
- `confidence`
- `autonomyLevel`
- `requiredUserAction`
- `actionableCandidate`
- `fitScore`
- `priority`
- `sourceFreshness`
- `lastAgentAction`
- `decisionLogPath`

권장 enum:

- `autonomyLevel`: `agent_only` | `user_approval_required` | `external_action_blocked`
- `requiredUserAction`: `none` | `review_application` | `approve_submission` | `provide_evidence` | `decide_cooldown` | `approve_public_publish` | `approve_profile_update`
- `priority`: `low` | `normal` | `high` | `urgent`
- `sourceFreshness`: `fresh` | `stale` | `unknown`

### 2. agent decision schema 추가

별도 schema 파일 또는 같은 모듈에 `AgentDecisionSchema`를 추가한다.

필수 필드:

- `applicationId`
- `fromStatus`
- `fromAgentPhase`
- `decision`
- `decisionReason`
- `confidence`
- `nextStatus`
- `nextAgentPhase`
- `nextActions`
- `requiredUserAction`
- `allowed`
- `createdAt`

### 3. transition validator 확장

검증 규칙:

- `submitted`는 agent가 자동으로 설정할 수 없다.
- `approved`는 사용자 승인 근거 없이 설정할 수 없다.
- `ready_for_user_review` 이후 외부 제출 action은 항상 `requiredUserAction=approve_submission`.
- `closed`는 terminal이다.
- `blocked`에서 자동 재개하려면 `nextRunAt` 또는 명시적 해제 조건이 필요하다.
- `revisionCount > maxRevisionCount`이면 revise action 금지.
- `sourceFreshness=stale`이면 actionable candidate로 취급하지 않는다.

### 4. fixture ledger 작성

gitignored private data 대신 tracked fixture를 둔다.

권장 경로:

```text
scripts/application-agent/fixtures/
├── no-actionable-candidate.jsonl
├── good-match.jsonl
├── blocked-cooldown.jsonl
├── needs-revision.jsonl
└── ready-for-user-review.jsonl
```

fixture에는 실제 민감 지원 전략을 넣지 않는다.

## 산출물

- `scripts/application-agent/ledger_schema.ts` 확장
- 필요 시 `scripts/application-agent/agent_decision_schema.ts`
- `scripts/application-agent/fixtures/*.jsonl`
- schema/fixture 검증 명령 문서화

## 검증 기준

```bash
bun scripts/application-agent/ledger_schema.ts scripts/application-agent/fixtures/good-match.jsonl
bun scripts/application-agent/ledger_schema.ts scripts/application-agent/fixtures/blocked-cooldown.jsonl
```

추가 self-check:

- 기존 `data/applications/ledger.jsonl`가 있으면 backward compatible하게 통과한다.
- optional field 부재로 기존 plan029 fixture가 깨지지 않는다.
- 제출/승인 관련 금지 전이가 validator에 반영된다.

