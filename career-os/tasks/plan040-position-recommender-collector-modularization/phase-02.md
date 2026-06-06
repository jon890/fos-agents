# Phase 02 — Wanted adapter 모듈 이동

**Model**: sonnet
**Status**: pending

---

## 목표

Wanted 수집 로직을 `career-os/scripts/position-recommender/live-postings/adapters/wanted.ts`로 이동하고, phase 01에서 만든 공통 타입/validator/renderer를 통해 기존 동작을 보존한다.

**범위 외**:
- 새 source adapter 추가
- Toss adapter 이동 또는 정책 변경
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

docs는 읽기 전용이다. 구현 중 docs drift가 발견되면 docs를 수정하지 말고 Blocked 처리한다.

---

## 작업 항목

### 1. Wanted adapter 파일 생성

`career-os/scripts/position-recommender/live-postings/adapters/wanted.ts`를 만든다.

adapter 책임:
- Wanted API 호출
- detail fetch
- `status=active` 근거 확인
- raw/normalized candidate 생성
- source diagnostics 생성

### 2. Wanted 정책 보존

기존 동작을 보존한다.

- detail fetch 실패 후보 제외 또는 diagnostics 기록
- `status=active`만 `postingStatus: active`
- `linkType: direct_posting`
- `activeEvidence`에 Wanted detail active 근거 포함
- lower-preference exclusion과 backend/server/AI-transfer 필터의 기존 의미 유지
- ranking/fit/gap 판단을 adapter에 넣지 않음

### 3. CLI wrapper 연결

`collect_live_postings.ts --source wanted`와 `--source all`이 새 Wanted adapter를 호출하게 한다.

`run_daily_with_claude.sh`가 호출하는 기존 entrypoint path는 그대로 둔다.

### 4. safe leftover 정리

`collect_live_postings.ts`에는 Wanted API 세부 구현이 남지 않게 한다. 단, import/adapter dispatch/옵션명에 `wanted`가 등장하는 것은 정상이다.

---

## Critical Files

- `career-os/scripts/position-recommender/collect_live_postings.ts`
- `career-os/scripts/position-recommender/live-postings/adapters/wanted.ts`
- `career-os/scripts/position-recommender/live-postings/types.ts`
- `career-os/scripts/position-recommender/live-postings/validator.ts`

---

## 검증

보고 직전 반드시 아래 Bash 블록을 직접 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"

test -f career-os/scripts/position-recommender/live-postings/adapters/wanted.ts
bun --check career-os/scripts/position-recommender/collect_live_postings.ts

bun career-os/scripts/position-recommender/collect_live_postings.ts --source wanted --max-wanted 10 --output /tmp/plan040-phase02-wanted.md
test -s /tmp/plan040-phase02-wanted.md
grep -q "source: wanted" /tmp/plan040-phase02-wanted.md
grep -q "link_type: direct_posting" /tmp/plan040-phase02-wanted.md
! grep -Eq "link_type: (career_article|search_page|home_page)|posting_status: unknown" /tmp/plan040-phase02-wanted.md

# Wanted API detail implementation should live in the adapter, not in the CLI wrapper.
rg -n "wanted\\.|Wanted|jobsfeed|JobPosting" career-os/scripts/position-recommender/collect_live_postings.ts career-os/scripts/position-recommender/live-postings/adapters/wanted.ts

# 실행 전 docs diff가 이미 있으면 그 baseline은 허용하되, 본 phase가 docs diff를 바꾸면 중단한다.
if ! cmp -s /tmp/plan040-docs-before.diff <(git diff -- career-os/docs/adr.md career-os/docs/code-architecture.md career-os/docs/flow.md); then
  echo "PHASE_BLOCKED: docs drift detected; implementation phase must not patch docs" >&2
  exit 2
fi
```

성공 기준:
- 위 명령이 모두 exit 0
- `adapters/wanted.ts` 존재
- Wanted snapshot이 active/open direct posting만 포함
- 기존 CLI entrypoint path가 작동
- docs 파일 diff가 없음

---

## Blocked / Failed 조건

- Wanted API schema가 바뀌어 active status 근거를 확인할 수 없으면 `PHASE_BLOCKED: Wanted active status schema changed` 출력 후 exit 2.
- docs drift가 구현에 필요하면 `PHASE_BLOCKED: docs drift detected; implementation phase must not patch docs` 출력 후 exit 2.
- 검증 명령이 실패하면 `PHASE_FAILED: Wanted adapter extraction validation failed` 출력 후 exit 1.
- `--force`, `--no-verify`, destructive git 명령은 사용하지 않는다.
