# Phase 03 — daily runner 검증과 통합 smoke

**Model**: haiku
**Status**: pending

---

## 목표

Wanted + Toss adapter가 daily runner의 active-only gate와 함께 동작하는지 검증하고 task를 완료 상태로 정리한다.

**범위 외**: 추천 리포트 내용을 새로 생성해 품질 평가하지 않는다. 이 phase는 collector와 runner gate 검증만 한다.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md` — ADR-039, ADR-043
- `career-os/docs/flow.md` — `/position-recommender`
- `career-os/tasks/plan037-position-recommender-source-adapters/index.json`

---

## 작업 항목

### 1. runner source 옵션 점검

`career-os/scripts/position-recommender/run_daily_with_claude.sh`가 source adapter 구조와 충돌하지 않는지 확인한다.

- `POSITION_RECOMMENDER_SOURCE=wanted`
- `POSITION_RECOMMENDER_SOURCE=toss`
- `POSITION_RECOMMENDER_SOURCE=all`

daily 기본값은 과도한 실패 위험을 줄이기 위해 기존처럼 `wanted` 유지가 기본이다. Toss를 daily 기본에 넣을지는 별도 사용자 결정 전까지 강제하지 않는다.

### 2. active-only leak 검증

snapshot과 runner validation에서 다음이 새지 않는지 확인한다.

- `link_type: career_article`
- `link_type: search_page`
- `posting_status: unknown`
- `opened_at`의 unknown 상태 문자열

### 3. 통합 smoke

collector smoke와 runner syntax/validate-existing을 실행한다.

`--validate-existing`은 기존 오늘 report가 없으면 실패할 수 있다. 그 경우는 runner 자체 실패로 단정하지 말고 `PHASE_BLOCKED: no existing daily report for validate-existing`를 출력해 사람에게 넘긴다.

### 4. task 상태 정리

모든 검증이 끝나면 `career-os/tasks/plan037-position-recommender-source-adapters/index.json`의 `status`를 `completed`로 바꾸고 phase status도 completed로 업데이트한다.

---

## Critical Files

- `career-os/scripts/position-recommender/collect_live_postings.ts`
- `career-os/scripts/position-recommender/run_daily_with_claude.sh`
- `career-os/tasks/plan037-position-recommender-source-adapters/index.json`

---

## 검증

보고 직전 반드시 아래 Bash 블록을 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun build career-os/scripts/position-recommender/collect_live_postings.ts --target=bun --outfile=/tmp/collect_live_postings.js
bash -n career-os/scripts/position-recommender/run_daily_with_claude.sh
bun career-os/scripts/position-recommender/collect_live_postings.ts --source wanted --max-wanted 30 --output /tmp/live-position-wanted.md
bun career-os/scripts/position-recommender/collect_live_postings.ts --source toss --output /tmp/live-position-toss.md
cat /tmp/live-position-wanted.md /tmp/live-position-toss.md > /tmp/live-position-combined.md
! grep -Eq "link_type: (career_article|search_page)|posting_status: unknown|opened_at: unknown" /tmp/live-position-combined.md
POSITION_RECOMMENDER_NOTIFY=0 bash career-os/scripts/position-recommender/run_daily_with_claude.sh --validate-existing
```

---

## 금지 사항

- `POSITION_RECOMMENDER_SOURCE` daily 기본값을 `all`로 바꾸지 말 것. 별도 사용자 결정 전까지 기본은 `wanted`.
- 추천 prompt의 Toss 쿨다운 정책을 삭제하지 말 것.
- docs 수정 금지.
- 외부 push 실패를 숨기지 말 것.

---

## Blocked / Failed 조건

- 오늘 report가 없어 `--validate-existing`만 실패하면 `PHASE_BLOCKED: no existing daily report for validate-existing` 출력 후 exit 2.
- active-only leak grep이 실패하면 `PHASE_FAILED: active-only snapshot leak detected` 출력 후 exit 1.
- 그 외 검증 명령 중 하나라도 실패하면 `PHASE_FAILED: position-recommender source adapter integration validation failed` 출력 후 exit 1.
