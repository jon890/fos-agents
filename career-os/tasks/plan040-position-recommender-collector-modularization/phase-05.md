# Phase 05 — 통합 smoke와 완료 메타데이터 정리

**Model**: haiku
**Status**: pending

---

## 목표

plan040 구현 결과를 통합 검증하고, 성공 시 plan metadata만 완료 상태로 정리한다. 구현 코드 추가 변경은 최소화하고 docs는 수정하지 않는다.

**범위 외**:
- 새 source adapter 추가
- LLM ranking, fit/gap, career narrative 변경
- runner rewrite
- docs 수정
- commit/push

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다. 본 phase는 ai-nodes 루트 기준 path를 사용하므로 첫 Bash에서 cwd를 ai-nodes 루트로 변경한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
git diff -- career-os/docs/adr.md career-os/docs/code-architecture.md career-os/docs/flow.md > /tmp/plan040-docs-before.diff
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/AGENTS.md`
- `career-os/docs/adr.md` — ADR-043, ADR-047이 있으면 ADR-047도 읽는다
- `career-os/docs/code-architecture.md` — scripts/position-recommender 구조
- `career-os/docs/flow.md` — `/position-recommender`와 daily runner 흐름

docs는 읽기 전용이다. docs drift가 발견되면 docs를 수정하지 말고 Blocked 처리한다.

---

## 작업 항목

### 1. 통합 smoke 실행

Wanted, Toss, all source 경로와 daily runner validation path가 모두 깨지지 않았는지 확인한다.

### 2. leakage guard 확인

snapshot에 career article/search/home page/unknown status가 active posting처럼 섞이지 않는지 확인한다.

### 3. entrypoint compatibility 확인

기존 `career-os/scripts/position-recommender/collect_live_postings.ts` path가 유지되고 `run_daily_with_claude.sh --validate-existing`가 광범위 변경 없이 작동하는지 확인한다.

### 4. plan metadata 완료 처리

검증이 모두 성공하면 `career-os/tasks/plan040-position-recommender-collector-modularization/index.json`만 다음처럼 갱신한다.

- `status`: `completed`
- `current_phase`: `5`
- 모든 phase status: `completed`
- `updated_at`: 실행 시점 ISO-8601 UTC
- `error_message`: null
- `blocked_reason`: null

---

## Critical Files

- `career-os/scripts/position-recommender/collect_live_postings.ts`
- `career-os/scripts/position-recommender/live-postings/`
- `career-os/scripts/position-recommender/run_daily_with_claude.sh`
- `career-os/tasks/plan040-position-recommender-collector-modularization/index.json`

---

## 검증

보고 직전 반드시 아래 Bash 블록을 직접 실행한다. PHASE_BLOCKED/PHASE_FAILED 조건은 반드시 nonzero exit로 종료한다.

```bash
cd "$(git rev-parse --show-toplevel)"

python3 -m json.tool career-os/tasks/plan040-position-recommender-collector-modularization/index.json >/tmp/plan040-index.json
bun --check career-os/scripts/position-recommender/collect_live_postings.ts

bun career-os/scripts/position-recommender/collect_live_postings.ts --source wanted --max-wanted 5 --output /tmp/plan040-final-wanted.md
bun career-os/scripts/position-recommender/collect_live_postings.ts --source toss --output /tmp/plan040-final-toss.md
bun career-os/scripts/position-recommender/collect_live_postings.ts --source all --max-wanted 5 --output /tmp/plan040-final-all.md

test -s /tmp/plan040-final-wanted.md
test -s /tmp/plan040-final-toss.md
test -s /tmp/plan040-final-all.md
! grep -Eq "link_type: (career_article|search_page|home_page)|posting_status: unknown" /tmp/plan040-final-all.md

POSITION_RECOMMENDER_NOTIFY_DRY_RUN=1 bash career-os/scripts/position-recommender/run_daily_with_claude.sh --validate-existing

# No docs mutation in implementation phases.
# 실행 전 docs diff가 이미 있으면 그 baseline은 허용하되, 본 phase가 docs diff를 바꾸면 중단한다.
if ! cmp -s /tmp/plan040-docs-before.diff <(git diff -- career-os/docs/adr.md career-os/docs/code-architecture.md career-os/docs/flow.md); then
  echo "PHASE_BLOCKED: docs drift detected; implementation phase must not patch docs" >&2
  exit 2
fi

echo "plan040 final smoke complete"
```

성공 기준:
- 위 명령이 모두 exit 0
- `run_daily_with_claude.sh --validate-existing`가 dry-run notify mode에서 성공
- docs 파일 diff가 없음
- index.json이 valid JSON
- plan metadata만 완료 상태로 갱신
- commit/push는 실행하지 않음

---

## Blocked / Failed 조건

- docs drift가 발견되면 `PHASE_BLOCKED: docs drift detected; implementation phase must not patch docs` 출력 후 exit 2.
- daily runner validation이 기존 report/runtime 부재 때문에 판단 불가하면 `PHASE_BLOCKED: validate-existing requires current report/runtime fixture` 출력 후 exit 2.
- smoke 또는 JSON 검증이 실패하면 `PHASE_FAILED: final smoke validation failed` 출력 후 exit 1.
- commit/push는 수행하지 않는다. 메인 세션이 review 후 별도로 처리한다.
