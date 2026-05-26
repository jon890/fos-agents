# Phase 05 E2E Audit Summary
Date: 2026-05-26

## 검증 환경

- Runtime: Bun
- TypeScript type check: PASS (0 errors)
- 검증 방식: fixture 기반 dry-run + run-once (임시 ledger copy)
- 실제 `data/applications/` 미사용

---

## Fixture별 결과

### 1. no-actionable-candidate

**파일**: `fixtures/no-actionable-candidate.jsonl` (2 records)

| ID | 상태 | 기대 결정 | 실제 결정 | Allowed | 일치 |
|---|---|---|---|---|---|
| fixture-nac-001 | discovered / stale | `needs_more_search` | `needs_more_search` | NO | ✅ |
| fixture-nac-002 | closed | `terminal_skip` | `terminal_skip` | NO | ✅ |

validate: `ledger ok: 2 records`

---

### 2. good-match

**파일**: `fixtures/good-match.jsonl` (1 record)

| ID | 상태 | fitScore | 기대 결정 | 실제 결정 | Allowed | 일치 |
|---|---|---|---|---|---|---|
| fixture-gm-001 | analyzing | 82 | `draft_application_package` | `draft_application_package` | YES | ✅ |

- 전이: `analyzing → preparing_application`
- command suggestion: `application-package-writer`, `application-reviewer` 모두 정상 출력

**run-once 실행 결과:**
- Ledger updated: YES (agentPhase = `package_drafting`, status = `preparing_application`)
- decision log: `data/applications/fixture-gm-001/decisions/decisions.jsonl` 정상 기록
- 기록 내용: applicationId, fromStatus, fromAgentPhase, decision, nextStatus, nextAgentPhase, nextActions, allowed, createdAt 모두 포함

---

### 3. blocked-cooldown

**파일**: `fixtures/blocked-cooldown.jsonl` (1 record)

| ID | 상태 | nextRunAt | 기대 결정 | 실제 결정 | Allowed | 일치 |
|---|---|---|---|---|---|---|
| fixture-bc-001 | blocked | 2026-05-28 | `wait_cooldown` | `wait_cooldown` | NO | ✅ |

- 쿨다운 미만료 → agent 대기, 사용자 판단 없이 스스로 멈춤

---

### 4. needs-revision + max-revision 경계값

**파일**: `fixtures/needs-revision.jsonl` (1 record, revisionCount=1/3)

| ID | revisionCount | 기대 결정 | 실제 결정 | Allowed | 일치 |
|---|---|---|---|---|---|
| fixture-nr-001 | 1/3 | `revise_application_package` | `revise_application_package` | YES | ✅ |

- 전이: `needs_revision → preparing_application`

**max-revision 경계값 (revisionCount=3/3, 인라인 fixture):**

| 조건 | 기대 결정 | 실제 결정 | Allowed | 일치 |
|---|---|---|---|---|
| revisionCount == maxRevisionCount | `max_revision_exceeded_escalate` | `max_revision_exceeded_escalate` | NO | ✅ |

- 전이: `needs_revision → ready_for_user_review`
- Required User Action: `review_application`

---

### 5. ready-for-user-review

**파일**: `fixtures/ready-for-user-review.jsonl` (1 record)

| ID | 상태 | 기대 결정 | 실제 결정 | Allowed | 일치 |
|---|---|---|---|---|---|
| fixture-rfur-001 | ready_for_user_review | `await_user_approval` | `await_user_approval` | NO | ✅ |

- Required User Action: `review_application`
- 자동 진행 없음 — 완전 정지

---

## report-daily 연결 확인

- `report-daily` 명령 실행: PASS
- 출력 경로: `runtime/reports/daily/YYYY-MM-DD/application-agent/digest.md`
- digest 구성: Executive Summary, Agent Actions Today, Needs User Approval, Public-Safe Study Candidates, Private Strategy Notes, Discord Summary Draft
- Discord summary: 공개 민감 정보 제외, 6줄 이내 draft 포함
- plan029 daily-application-digest skill과 동일 출력 디렉터리 패턴 호환

---

## 버그 수정: approved → approved forbidden 체크 오류

**증상**: `approved` 상태 레코드에서 `generate_submission_checklist` 결정이 `Allowed: NO`로 나와 체크리스트가 실제로 기록되지 않았음.

**원인**: `policy.ts` `makeDecision`의 `AgentForbiddenTargetStatuses.has(nextStatus)` 체크가 "신규 전이"와 "현 상태 유지"를 구분하지 않았음.

**수정**:
- `policy.ts`: forbidden 조건에 `&& input.nextStatus !== record.status` 추가 — 실제 전이가 아닌 상태 유지는 허용
- `safety_gate.ts`: `agent_cannot_approve` 위반 조건에 `&& decision.fromStatus !== 'approved'` 추가

**검증**: 수정 후 `approved` 레코드에서 `Allowed: YES`, 체크리스트 파일 생성 확인.
기존 5개 fixture 결과 불변.

---

## Safety Gate 검증

| 규칙 | 동작 | 확인 |
|---|---|---|
| submitted 자동 설정 불가 | policy에서 AgentForbiddenTargetStatuses로 차단 | ✅ |
| approved 자동 전이 불가 | safety_gate `agent_cannot_approve` (transition only) | ✅ |
| approved→approved 체크리스트 생성 | Allowed YES, 파일 생성 확인 | ✅ |
| ready_for_user_review 자동 진행 불가 | Allowed NO, 완전 정지 | ✅ |
| fos-study publish 차단 | FORBIDDEN_ACTION_NAMES 포함 | ✅ (설계) |
| candidate-profile.md 직접 수정 차단 | PROFILE_MODIFICATION_SUBSTRINGS 패턴 차단 | ✅ (설계) |

---

## public/private boundary

- `partitionStudyActions`가 `PRIVATE_STUDY_KEYWORDS`로 분류
- daily digest의 "Public-Safe Study Candidates" / "Private Strategy Notes" 섹션 분리 확인
- Discord Summary Draft: 공개 채널용, 민감 정보 제외 6줄 이내

---

## plan029/030 호환성

- `ledger_schema.ts` 런타임 필드(agentPhase, sourceFreshness, fitScore 등) 모두 `optional()` — plan029 기존 레코드 backward compatible
- `isActionableCandidate`가 stale/closed/submitted 제외 — plan030 freshness guard를 candidate ingest prerequisite로 간접 참조
- `ingest_position_report.ts`가 position-recommender 출력(plan029 산출물)을 ledger에 추가하는 경로 제공
- Codex review 후 `ingest_position_report.ts`에 markdown position-recommender report fallback parser 추가. 기존 JSON/JSONL 입력도 유지한다.
- 한글 회사/직무명에서 ASCII slug가 비는 경우를 대비해 id에 SHA-1 8자리 hash를 붙인다.

---

## 운영 등록 판단

**권장: 즉시 cron 등록하지 않음**

근거:
- policy engine과 safety gate의 정확성은 fixture 수준에서 확인됨
- 실제 `data/applications/ledger.jsonl` 대상 수동 `dry-run`과 `run-once`를 2-3회 먼저 수행
- ledger 운영 데이터가 없는 상태에서 cron은 의미 없음 (ledger populate 먼저 필요)
- daily cron은 ledger에 actionable candidate가 2개 이상 쌓인 후 별도 phase/follow-up task로 등록

**수동 시작 절차**:
```bash
# 1. position-recommender로 공고 수집
cd career-os && claude -p "/position-recommender"

# 2. 수집 결과를 ledger에 ingest
bun scripts/application-agent/run.ts ingest-position-report data/runtime/... --ledger data/applications/ledger.jsonl

# 3. dry-run으로 decisions 확인
bun scripts/application-agent/run.ts dry-run --ledger data/applications/ledger.jsonl

# 4. 이상 없으면 run-once
bun scripts/application-agent/run.ts run-once --ledger data/applications/ledger.jsonl
```

---

## 후속 task 후보

| 후보 | 우선순위 | 근거 |
|---|---|---|
| 실제 ledger populate + run-once 2-3회 수동 검증 | HIGH | cron 등록 전제 조건 |
| daily cron 등록 (weekday morning) | MEDIUM | ledger 안정화 후 |
| cooldown 만료 자동 재개 end-to-end (nextRunAt 과거로 설정 fixture) | MEDIUM | blocked→analyzing 경로 실제 검증 |
| submission Level 1 (브라우저 입력 반자동화) | LOW | ADR D5: plan031 MVP 범위 외, 후속 plan/ADR |
| public fos-study publish gate flow | LOW | ADR D6: 별도 승인 조건 설계 필요 |

---

## 성공 기준 체크

- [x] policy engine이 no-match, good-match, blocked, revise, user-review 상태를 모두 올바르게 분기
- [x] 사용자 승인 전 submitted/approved 외부 action이 발생하지 않음
- [x] public/private boundary 위반 없음
- [x] plan029 기존 skill 산출물과 호환
- [x] plan030 freshness guard를 candidate ingest prerequisite로 참조
