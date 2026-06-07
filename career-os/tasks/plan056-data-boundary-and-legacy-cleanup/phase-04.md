# Phase 04 — coffeechat tombstone 결정

**Model**: sonnet
**Status**: pending

---

## 목표

coffeechat tombstone을 유지할지 제거할지 결정하고, plan041의 metadata/body mismatch를 함께 확인한다.

**범위 외**:

- `.claude/skills/interview-coffeechat-prep` 삭제.
- `scripts/interview-coffeechat-prep` 삭제.
- `interview-prep-analyzer` 구현 변경.
- 외부 메시지 전송.

---

## 관련 docs/files

실행 전 반드시 읽는다:

- `tasks/plan041-interview-coffeechat-deprecation/index.json`
- `tasks/plan041-interview-coffeechat-deprecation/phase-01.md`
- `tasks/plan041-interview-coffeechat-deprecation/phase-04.md`
- `tasks/plan041-interview-coffeechat-deprecation/phase-05.md`
- `docs/adr.md`
- `.claude/skills/interview-coffeechat-prep/SKILL.md`가 있으면 읽기
- `scripts/interview-coffeechat-prep`가 있으면 inventory

---

## 작업 항목 (5)

1. `rg -n "coffeechat|커피챗|interview-coffeechat-prep"`로 active caller와 archive reference를 구분한다.
2. `.claude/skills/interview-coffeechat-prep` tombstone 상태를 확인한다.
3. `scripts/interview-coffeechat-prep` tombstone 상태를 확인한다.
4. plan041 index는 completed인데 phase body가 pending인 mismatch가 있는지 확인한다.
5. `tasks/plan056-data-boundary-and-legacy-cleanup/coffeechat-tombstone.md`에 유지, 제거, ADR-only 전환 권고를 작성한다.

---

## Intended File Scope

- `tasks/plan056-data-boundary-and-legacy-cleanup/coffeechat-tombstone.md`

---

## 검증

```bash
test -f tasks/plan056-data-boundary-and-legacy-cleanup/coffeechat-tombstone.md
rg -n "coffeechat|interview-coffeechat-prep|tombstone|plan041|metadata|pending|completed" tasks/plan056-data-boundary-and-legacy-cleanup/coffeechat-tombstone.md
git status --short tasks/plan056-data-boundary-and-legacy-cleanup .claude/skills/interview-coffeechat-prep scripts/interview-coffeechat-prep
```

성공 기준:

- 두 tombstone 경로의 상태와 권고가 적힌다.
- plan041 metadata/body mismatch 여부가 적힌다.
- tombstone 파일 자체는 수정되지 않는다.

---

## Blocked / Failed 조건

- active caller가 발견됐지만 대체 경로가 없으면 `echo "PHASE_BLOCKED: active coffeechat caller still exists" && exit 2`.
- tombstone 유지/제거가 사용자 승인 없이는 위험하면 `echo "PHASE_BLOCKED: coffeechat tombstone decision needs user approval" && exit 2`.
- `.claude` 또는 `scripts` 파일이 변경되면 `echo "PHASE_FAILED: tombstone files changed unexpectedly" && exit 1`.

---

## Self-check

- tombstone은 decision만 남기고 직접 제거하지 않는다.
- plan041 과거 기록은 history로 보존한다.
- first-round/final/offer 준비 기능이 깨지는지 확인한다.
- 권고에는 rollback 방법을 포함한다.
