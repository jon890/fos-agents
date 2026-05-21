# Phase 03 — apartment:today-interior-recommendations cron payload 슬림화

## 목표

openclaw cron job `9a6ac82d-f6d6-4d25-a8aa-05cddc33dabe` (apartment:today-interior-recommendations) 의 `payload.message` 를 현 3439c / 25 line 본문에서 한국어 슬림 본문 (~400c / 약 10 line) 으로 교체. 정책은 SKILL.md / config 단일 출처 (4번 진단 + phase-02 한국어화 완료 후 정합 보장).

## 사전 조건

- phase-01 + phase-02 완료 — apartment 2 skill 한국어화 + skill-creator 강화 적용됨.
- ai-nodes ADR-007 채택.
- openclaw Gateway 정상 동작 (CLI / Gateway protocol 일치).
- 글로벌 `<openclaw_safety>` 정책 — cron edit 은 *사용자 명시 확인 필수*.

## 새 payload 본문 (한국어 슬림)

다음을 그대로 사용. 4번 진단 시뮬레이션에서 정책 누락 0 확인됨 (SKILL.md / config 모든 정책 항목이 본 본문 외부의 단일 출처에 박혀 있어 본문 슬림 가능):

```text
apartment 오늘의 인테리어 추천 workflow 실행 (대상: 구리 럭키아파트 5동 1004호).

Skill: apartment-interior-reference-digest (canonical source of truth — SKILL.md + config 가 모든 정책)
Workspace: ~/ai-nodes/apartment

오늘의 추가 컨텍스트:
- Runner: scripts/apartment-interior-reference-digest/run_digest.sh
- 추가 docs: lucky-5-1004-{decision-summary, field-checklist, contractor-brief, decision-queue}.md
- 최근 7일 data/interior-reference-digest/*/report.md 비반복 체크
- Discord 출력: 추천 3-5개 + 오늘 결정할 3개

Reply NO_REPLY 후 성공/실패만 짧게.
```

## 단계

### 1. 새 payload 본문 파일로 보관

Write 도구로 `apartment/tasks/plan008-skill-korean-rewrite/audit/phase-03-new-payload.txt` 에 위 본문 그대로 저장.

### 2. openclaw cron edit 명령 준비 + 옵션 사전 확인

```bash
# 현재 payload 백업 (audit trail)
openclaw cron get 9a6ac82d-f6d6-4d25-a8aa-05cddc33dabe \
  > apartment/tasks/plan008-skill-korean-rewrite/audit/phase-03-old-payload.json

# edit 옵션 확인 — --payload-message-file 또는 --field payload.message 패턴 존재 여부
openclaw cron edit --help 2>&1 | head -30
```

`openclaw cron edit` 의 message 변경 인터페이스 결정 후 명령 확정.

### 3. 사용자 명시 확인 (필수)

`<openclaw_safety>` 정책상 openclaw state 변경은 사용자 명시 확인 필요. plan-and-build 가 본 phase 를 자동 실행하면 `AskUserQuestion` 으로 confirm.

옵션:
- (A) 슬림 payload 그대로 적용 (권장).
- (B) 추가 수정 후 적용.
- (C) 보류.

### 4. payload 교체 + 검증

```bash
openclaw cron edit 9a6ac82d-f6d6-4d25-a8aa-05cddc33dabe \
  --payload-message-file apartment/tasks/plan008-skill-korean-rewrite/audit/phase-03-new-payload.txt
# (실제 옵션명은 step 2 에서 확정)

openclaw cron get 9a6ac82d-f6d6-4d25-a8aa-05cddc33dabe \
  | jq -r '.payload.message' \
  > apartment/tasks/plan008-skill-korean-rewrite/audit/phase-03-applied-payload.txt

diff <(jq -r '.payload.message' apartment/tasks/plan008-skill-korean-rewrite/audit/phase-03-old-payload.json) \
     apartment/tasks/plan008-skill-korean-rewrite/audit/phase-03-applied-payload.txt \
  > apartment/tasks/plan008-skill-korean-rewrite/audit/phase-03-payload-diff.md || true
```

### 5. commit

- 메시지: `chore(apartment): apartment:today-interior cron payload 슬림화 (plan008 phase-03)`.
- 본문에 before/after 글자수 비교 (3439c → ~400c, 약 8배 슬림) + 정책 단일 출처 (SKILL.md/config) 위임 설명.

## 검증 기준 (성공 조건)

- `openclaw cron get 9a6ac82d-...` 의 payload.message 글자 수 ~400c (오차 ±50).
- `audit/phase-03-{old-payload.json, new-payload.txt, applied-payload.txt, payload-diff.md}` 4 파일 존재.
- 슬림 본문이 phase-02 한국어화된 SKILL.md 정책과 1:1 정합 (drift 0).

## 산출물

- `apartment/tasks/plan008-skill-korean-rewrite/audit/phase-03-old-payload.json`
- `apartment/tasks/plan008-skill-korean-rewrite/audit/phase-03-new-payload.txt`
- `apartment/tasks/plan008-skill-korean-rewrite/audit/phase-03-applied-payload.txt`
- `apartment/tasks/plan008-skill-korean-rewrite/audit/phase-03-payload-diff.md`
- openclaw cron job `9a6ac82d-...` 의 payload.message 새 본문

## 차단 조건 (block)

- openclaw Gateway protocol mismatch → 사용자가 Gateway 재시작 후 재시도.
- `cron edit` 의 message 변경 인터페이스 부재 → 우회 경로 결정 (예: `cron rm` + `cron add` 재등록 — *job ID 바뀜* 부작용 주의).
- 사용자 명시 확인 거부 → phase block, 별도 task 로 이관.

## critic / verify 사전 해소

common-pitfalls.md 섹션 1~5 self-check:

- 1 모호한 task 명세 X — 새 payload 본문 박혀 있음.
- 2 산출물 위치 명시 ✓.
- 3 검증 기준 명시 ✓.
- 4 phase-01 + phase-02 의존성 명시 ✓.
- 5 차단 조건 명시 — Gateway / 옵션 / 사용자 거부 3가지 경로.

## 의도적으로 안 하는 것

- 다른 cron job (apartment:guri-buy-search 등) 영향 X.
- SKILL.md / config 변경 X (4번 진단 + phase-02 에서 완료).
- payload 본문에 정책 추가 X — 정책은 SKILL.md 단일 출처.
- delivery / failureAlert / schedule 필드 변경 X — payload.message 만.
