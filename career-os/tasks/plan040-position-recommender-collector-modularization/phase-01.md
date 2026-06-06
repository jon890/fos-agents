# Phase 01 — 공통 타입, 정책, validator, renderer, CLI wrapper 추출

**Model**: sonnet
**Status**: pending

---

## 목표

`career-os/scripts/position-recommender/collect_live_postings.ts`의 공통 관심사를 `live-postings/` 하위 모듈로 추출하되, 수집 결과와 CLI 동작은 바꾸지 않는다.

**범위 외**:
- 새 source adapter 추가
- Wanted/Toss 수집 정책 변경
- LLM ranking, fit/gap, career narrative 변경
- `run_daily_with_claude.sh` runner rewrite
- `career-os/docs/adr.md`, `career-os/docs/code-architecture.md`, `career-os/docs/flow.md` 수정
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

docs는 읽기 전용이다. 구현 중 docs drift가 발견되면 docs를 수정하지 말고 아래 Blocked 조건에 따라 중단한다.

---

## 작업 항목

### 1. live-postings 공통 디렉터리 생성

`career-os/scripts/position-recommender/live-postings/` 아래에 공통 모듈을 만든다.

권장 파일:
- `types.ts` — `PostingSource`, raw candidate, normalized posting, diagnostics, CLI option 타입
- `policy.ts` — active/open direct posting 정책, backend/server/AI-transfer 필터 기준
- `validator.ts` — non-posting leakage 차단과 active/open direct posting 검증
- `render.ts` — markdown snapshot renderer

파일명은 기존 코드에 더 자연스러운 이름으로 조정해도 되지만, 책임은 분리되어야 한다.

### 2. collect_live_postings.ts를 CLI wrapper로 축소

기존 entrypoint인 `career-os/scripts/position-recommender/collect_live_postings.ts`는 유지한다.

역할:
- CLI args parse
- source 실행 호출
- validator 적용
- renderer 호출
- output write
- exit code 처리

### 3. behavior-preserving extraction

이 phase는 동작 변경이 아니다.

유지해야 할 것:
- 기존 `--source all|wanted|toss`
- 기존 `--max-wanted`
- 기존 `--server-only`
- 기존 `--output`
- 기존 `--include-toss-articles`
- active/open direct posting만 snapshot에 포함
- 공고가 아닌 career article/search page/home page 누수 차단

### 4. LLM 책임 경계 보존

collector는 추천 판단을 하지 않는다. collector 책임은 깨끗한 active/open direct posting 후보 생성과 누수 차단까지다.

ranking, fit/gap, career narrative, 사용자 이력과의 적합성 판단은 `/position-recommender` LLM 리포트 책임으로 둔다.

---

## Critical Files

- `career-os/scripts/position-recommender/collect_live_postings.ts`
- `career-os/scripts/position-recommender/live-postings/types.ts`
- `career-os/scripts/position-recommender/live-postings/policy.ts`
- `career-os/scripts/position-recommender/live-postings/validator.ts`
- `career-os/scripts/position-recommender/live-postings/render.ts`

---

## 검증

보고 직전 반드시 아래 Bash 블록을 직접 실행한다. prose만 출력하면 성공으로 오판될 수 있다.

```bash
cd "$(git rev-parse --show-toplevel)"

# 문법/타입 확인
bun --check career-os/scripts/position-recommender/collect_live_postings.ts

# entrypoint와 옵션 유지
bun career-os/scripts/position-recommender/collect_live_postings.ts --source wanted --max-wanted 5 --output /tmp/plan040-phase01-wanted.md
test -s /tmp/plan040-phase01-wanted.md
grep -q "link_type: direct_posting" /tmp/plan040-phase01-wanted.md
! grep -Eq "link_type: (career_article|search_page|home_page)|posting_status: unknown" /tmp/plan040-phase01-wanted.md

# docs 수정 금지 확인. 실행 전 docs diff가 이미 있으면 그 baseline은 허용하되, 본 phase가 docs diff를 바꾸면 중단한다.
if ! cmp -s /tmp/plan040-docs-before.diff <(git diff -- career-os/docs/adr.md career-os/docs/code-architecture.md career-os/docs/flow.md); then
  echo "PHASE_BLOCKED: docs drift detected; implementation phase must not patch docs" >&2
  exit 2
fi
```

성공 기준:
- 위 명령이 모두 exit 0
- 기존 CLI entrypoint path가 남아 있음
- 새 공고 source가 추가되지 않음
- docs 파일 diff가 없음

---

## Blocked / Failed 조건

- docs drift가 구현에 필요하다고 판단되면 `PHASE_BLOCKED: docs drift detected; implementation phase must not patch docs` 출력 후 exit 2.
- 기존 CLI 옵션을 유지할 수 없으면 `PHASE_BLOCKED: collect_live_postings CLI compatibility unclear` 출력 후 exit 2.
- 검증 명령이 실패하면 `PHASE_FAILED: common extraction validation failed` 출력 후 exit 1.
- `--force`, `--no-verify`, destructive git 명령은 사용하지 않는다.
