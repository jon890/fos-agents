# Phase 04 — source registry와 확장 계약 추가

**Model**: sonnet
**Status**: pending

---

## 목표

Wanted/Toss adapter를 registry로 묶고, 새 source를 나중에 쉽게 추가할 수 있는 interface/contract/checklist를 코드 가까이에 남긴다. 이번 phase에서도 새 source는 추가하지 않는다.

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

docs는 읽기 전용이다. 구현 중 docs drift가 발견되면 docs를 수정하지 말고 Blocked 처리한다.

---

## 작업 항목

### 1. Source adapter interface 확정

공통 타입에 `LivePostingSourceAdapter` 같은 명시적 interface를 둔다.

최소 계약:
- stable source id
- human label
- CLI source key
- `collect(options, context)` 함수
- diagnostics 반환
- normalized posting 후보 반환

### 2. registry 추가

`career-os/scripts/position-recommender/live-postings/registry.ts`를 추가한다.

registry 책임:
- `wanted`, `toss` adapter 등록
- `--source all|wanted|toss` 해석
- unknown source 입력 시 명확한 error
- adapter 실행 순서 고정

### 3. extension checklist 추가

코드 가까운 위치에 짧은 확장 체크리스트를 둔다. 권장 위치:
- `career-os/scripts/position-recommender/live-postings/README.md`

내용:
- 새 source는 기본 daily에 바로 켜지지 않음
- active/open direct posting evidence 필수
- article/search/home page는 posting으로 렌더링 금지
- ranking/fit/gap 판단은 LLM 책임
- validator 통과 전 snapshot 렌더링 금지
- `--source <new-source>` shadow run 후 별도 결정으로 default 전환

이 README는 코드 인접 계약 문서로 허용한다. 단, `career-os/docs/` 파일은 수정하지 않는다.

### 4. CLI behavior 보존

`collect_live_postings.ts --source all|wanted|toss` behavior를 유지한다.

---

## Critical Files

- `career-os/scripts/position-recommender/collect_live_postings.ts`
- `career-os/scripts/position-recommender/live-postings/types.ts`
- `career-os/scripts/position-recommender/live-postings/registry.ts`
- `career-os/scripts/position-recommender/live-postings/README.md`
- `career-os/scripts/position-recommender/live-postings/adapters/wanted.ts`
- `career-os/scripts/position-recommender/live-postings/adapters/toss.ts`

---

## 검증

보고 직전 반드시 아래 Bash 블록을 직접 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"

test -f career-os/scripts/position-recommender/live-postings/registry.ts
test -f career-os/scripts/position-recommender/live-postings/README.md
bun --check career-os/scripts/position-recommender/collect_live_postings.ts

bun career-os/scripts/position-recommender/collect_live_postings.ts --source wanted --max-wanted 30 --output /tmp/plan040-phase04-wanted.md
bun career-os/scripts/position-recommender/collect_live_postings.ts --source toss --output /tmp/plan040-phase04-toss.md
bun career-os/scripts/position-recommender/collect_live_postings.ts --source all --max-wanted 30 --output /tmp/plan040-phase04-all.md

test -s /tmp/plan040-phase04-wanted.md
test -s /tmp/plan040-phase04-toss.md
test -s /tmp/plan040-phase04-all.md
! grep -Eq "link_type: (career_article|search_page|home_page)|posting_status: unknown" /tmp/plan040-phase04-all.md

# Source keys remain exactly current scope for this plan.
rg -n "\"(wanted|toss|all)\"|'(wanted|toss|all)'" career-os/scripts/position-recommender/live-postings career-os/scripts/position-recommender/collect_live_postings.ts
! rg -n "saramin|jumpit|remember|linkedin|rocketpunch|programmers|wantedplus" career-os/scripts/position-recommender/live-postings career-os/scripts/position-recommender/collect_live_postings.ts

# 실행 전 docs diff가 이미 있으면 그 baseline은 허용하되, 본 phase가 docs diff를 바꾸면 중단한다.
if ! cmp -s /tmp/plan040-docs-before.diff <(git diff -- career-os/docs/adr.md career-os/docs/code-architecture.md career-os/docs/flow.md); then
  echo "PHASE_BLOCKED: docs drift detected; implementation phase must not patch docs" >&2
  exit 2
fi
```

성공 기준:
- 위 명령이 모두 exit 0
- source registry가 `all|wanted|toss`를 처리
- 새 source가 추가되지 않음
- code-adjacent extension checklist가 존재
- docs 파일 diff가 없음

---

## Blocked / Failed 조건

- registry 도입이 기존 `--source all|wanted|toss` behavior를 깨면 `PHASE_BLOCKED: source registry compatibility unclear` 출력 후 exit 2.
- docs drift가 구현에 필요하면 `PHASE_BLOCKED: docs drift detected; implementation phase must not patch docs` 출력 후 exit 2.
- 검증 명령이 실패하면 `PHASE_FAILED: source registry validation failed` 출력 후 exit 1.
- `--force`, `--no-verify`, destructive git 명령은 사용하지 않는다.
