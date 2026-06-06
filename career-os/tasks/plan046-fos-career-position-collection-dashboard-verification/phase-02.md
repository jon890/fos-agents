# Phase 02 — 기존 source 전체 수집 실행과 성공/실패 기록

**Model**: sonnet
**Status**: pending

---

## 목표

새 source를 추가하지 않고 기존 source를 모두 실행한다.
성공한 source의 공고는 계속 다음 phase로 넘기고, 실패한 source는 명확히 기록한다.

---

## 사전 cwd 설정

```bash
pwd
git status --short
mkdir -p data/runtime/plan046
```

phase 시작 전 관련 없는 dirty state가 있으면 다음 phase로 넘기지 않는다.
읽기 전용이지만 수집 산출물은 이 phase의 의도한 runtime 변경이다.
phase 끝에서는 의도한 산출물만 명시 stage하고 commit/push하거나, commit하지 않을 이유를 보고한다.
넓은 `git add .`는 쓰지 않는다.
plan-and-build runner는 workspace env가 설정되어 있으면 notify_discord로 phase 진행 알림을 보낸다.
특별한 사용자 요약이 필요한 경우가 아니면 수동 알림을 중복하지 않는다.

---

## 관련 docs

실행 전 반드시 읽는다.

- `docs/data-schema.md` — `data/runtime/live-position-postings.md`
- `docs/flow.md` — `/position-recommender` 입력 흐름
- `tasks/plan046-fos-career-position-collection-dashboard-verification/phase-01.md`

---

## 작업 항목

### 1. 실행 전 검증

```bash
test -f scripts/position-recommender/collect_live_postings.ts || { echo "PHASE_BLOCKED: collector entrypoint missing"; exit 2; }
bun --check scripts/position-recommender/collect_live_postings.ts
```

### 2. 기존 source 전체 실행

`--source all`로 실행한다.
새 source를 추가하거나 source registry를 바꾸지 않는다.

```bash
out="data/runtime/plan046/live-position-postings-all.md"
log="data/runtime/plan046/collection-all.log"

bun scripts/position-recommender/collect_live_postings.ts \
  --source all \
  --output "$out" \
  > "$log" 2>&1

test -s "$out" || { echo "PHASE_FAILED: collection output missing"; exit 1; }
sed -n '1,160p' "$out"
sed -n '1,120p' "$log"
```

### 3. source별 성공/실패 정리

collector output과 log에서 다음을 확인한다.

- 요청한 source
- source별 수집 수
- source별 오류
- 통과한 공고 수
- 제거된 후보 수

실패 source가 있어도 성공 source의 공고가 있으면 다음 phase로 넘긴다.
단, 모든 source가 실패하거나 공고가 0개이면 중단한다.

```bash
grep -n "requested_source\\|source_counts\\|source_errors\\|total\\|valid" data/runtime/plan046/live-position-postings-all.md || true
grep -n "WARN source errors" data/runtime/plan046/collection-all.log || true

if ! grep -q "link_type: direct_posting" data/runtime/plan046/live-position-postings-all.md; then
  echo "PHASE_BLOCKED: no successful direct postings collected"
  exit 2
fi
```

### 4. 산출물 보존

이번 phase의 산출물은 이후 phase에서 입력으로 쓴다.

- `data/runtime/plan046/live-position-postings-all.md`
- `data/runtime/plan046/collection-all.log`

---

## 검증

보고 직전 반드시 실행한다.

```bash
test -s data/runtime/plan046/live-position-postings-all.md
grep -q "link_type: direct_posting" data/runtime/plan046/live-position-postings-all.md
grep -n "source_errors" data/runtime/plan046/live-position-postings-all.md || true
git status --short
```

성공 기준:

- 기존 source 전체 실행 결과가 남아 있다.
- 하나 이상 성공한 source의 direct posting이 있다.
- 실패 source가 있으면 로그 또는 output에 기록되어 있다.
- 새 source가 추가되지 않았다.
- phase 끝에서 의도한 runtime 산출물만 commit/push했거나, commit하지 않은 이유를 보고했다.
- runner가 기록할 commit hash 또는 clean/no-change 상태가 명확하다.
- 관련 없는 dirty state를 다음 phase로 넘기지 않았다.

---

## Blocked / Failed 조건

- collector entrypoint가 없으면 `PHASE_BLOCKED: collector entrypoint missing`를 출력하고 exit 2.
- 모든 source가 실패하거나 direct posting이 0개이면 `PHASE_BLOCKED: no successful direct postings collected`를 출력하고 exit 2.
- collector 실행 자체가 예외로 종료되고 output이 없으면 `PHASE_FAILED: collection output missing`를 출력하고 exit 1.
- 새 source 추가가 필요하다고 판단되면 `PHASE_BLOCKED: new source is out of scope for plan046`를 출력하고 exit 2.
- unrelated dirty files 때문에 커밋 범위를 분리할 수 없으면 `PHASE_BLOCKED: commit scope unclear due to unrelated dirty files`를 출력하고 exit 2.
