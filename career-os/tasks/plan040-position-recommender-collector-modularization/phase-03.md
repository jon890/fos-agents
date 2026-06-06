# Phase 03 — Toss adapter 모듈 이동

**Model**: sonnet
**Status**: pending

---

## 목표

Toss 수집 로직을 `career-os/scripts/position-recommender/live-postings/adapters/toss.ts`로 이동하고, 현재 Toss behavior를 보존한다.

**범위 외**:
- 새 source adapter 추가
- Wanted adapter 정책 변경
- Toss source 범위 확대
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

### 1. Toss adapter 파일 생성

`career-os/scripts/position-recommender/live-postings/adapters/toss.ts`를 만든다.

adapter 책임:
- Toss career article/feed 또는 현재 구현이 사용하는 discovery path 처리
- article 자체를 posting으로 채택하지 않음
- job-detail URL과 JD/지원 가능 근거가 확인된 항목만 open direct posting 후보로 반환
- source diagnostics 생성

### 2. Toss 정책 보존

기존 behavior를 보존한다.

- Toss career article은 discovery 수단일 뿐 snapshot posting이 아님
- job-detail 기반 open posting만 포함
- `linkType: direct_posting`
- `postingStatus: open`
- `activeEvidence`에 job-detail/JD/apply evidence 포함
- ranking/fit/gap 판단을 adapter에 넣지 않음

### 3. CLI wrapper 연결

`collect_live_postings.ts --source toss`와 `--source all`이 새 Toss adapter를 호출하게 한다.

`--include-toss-articles`가 기존에 diagnostics/discovery 목적으로 쓰였다면 같은 의미를 유지하되, article 자체가 active posting으로 렌더링되면 안 된다.

### 4. safe leftover 정리

`collect_live_postings.ts`에는 Toss 세부 파싱 구현이 남지 않게 한다. 단, import/adapter dispatch/옵션명에 `toss`가 등장하는 것은 정상이다.

---

## Critical Files

- `career-os/scripts/position-recommender/collect_live_postings.ts`
- `career-os/scripts/position-recommender/live-postings/adapters/toss.ts`
- `career-os/scripts/position-recommender/live-postings/types.ts`
- `career-os/scripts/position-recommender/live-postings/validator.ts`

---

## 검증

보고 직전 반드시 아래 Bash 블록을 직접 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"

test -f career-os/scripts/position-recommender/live-postings/adapters/toss.ts
bun --check career-os/scripts/position-recommender/collect_live_postings.ts

bun career-os/scripts/position-recommender/collect_live_postings.ts --source toss --output /tmp/plan040-phase03-toss.md
test -s /tmp/plan040-phase03-toss.md
! grep -Eq "link_type: (career_article|search_page|home_page)|posting_status: unknown" /tmp/plan040-phase03-toss.md

bun career-os/scripts/position-recommender/collect_live_postings.ts --source all --max-wanted 30 --output /tmp/plan040-phase03-all.md
test -s /tmp/plan040-phase03-all.md
! grep -Eq "link_type: (career_article|search_page|home_page)|posting_status: unknown" /tmp/plan040-phase03-all.md

# 실행 전 docs diff가 이미 있으면 그 baseline은 허용하되, 본 phase가 docs diff를 바꾸면 중단한다.
if ! cmp -s /tmp/plan040-docs-before.diff <(git diff -- career-os/docs/adr.md career-os/docs/code-architecture.md career-os/docs/flow.md); then
  echo "PHASE_BLOCKED: docs drift detected; implementation phase must not patch docs" >&2
  exit 2
fi
```

성공 기준:
- 위 명령이 모두 exit 0
- `adapters/toss.ts` 존재
- Toss article/search/home page가 snapshot posting으로 누수되지 않음
- `--source all`이 계속 작동
- docs 파일 diff가 없음

---

## Blocked / Failed 조건

- Toss page/API schema가 바뀌어 job-detail open evidence를 확인할 수 없으면 `PHASE_BLOCKED: Toss job-detail open evidence schema changed` 출력 후 exit 2.
- Toss가 0건이어도 schema 변경이 아니라면 실패가 아니다. 단, non-posting이 snapshot에 들어가면 실패다.
- docs drift가 구현에 필요하면 `PHASE_BLOCKED: docs drift detected; implementation phase must not patch docs` 출력 후 exit 2.
- 검증 명령이 실패하면 `PHASE_FAILED: Toss adapter extraction validation failed` 출력 후 exit 1.
- `--force`, `--no-verify`, destructive git 명령은 사용하지 않는다.
