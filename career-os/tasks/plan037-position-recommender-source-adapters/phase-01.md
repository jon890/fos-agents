# Phase 01 — collector source adapter 구조 분리

**Model**: sonnet
**Status**: pending

---

## 목표

`career-os/scripts/position-recommender/collect_live_postings.ts`를 source adapter + common validator + renderer 구조로 분리한다.

**범위 외**: Toss job-detail 수집 추가는 phase 02에서 한다. 본 phase는 Wanted 동작을 보존하는 구조 분리만 수행한다.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase 실행한다. 본 phase는 ai-nodes 루트 기준 path를 사용하므로 첫 Bash에서 cwd를 ai-nodes 루트로 변경한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/AGENTS.md`
- `career-os/docs/adr.md` — ADR-039, ADR-043
- `career-os/docs/flow.md` — `/position-recommender`
- `career-os/docs/code-architecture.md` — scripts/position-recommender
- `career-os/docs/data-schema.md` — `data/runtime/live-position-postings.md`

---

## 작업 항목

### 1. collector 내부 타입 정리

`career-os/scripts/position-recommender/collect_live_postings.ts` 안에 다음 개념을 분리한다.

- source raw candidate 타입
- normalized `Posting` 타입
- source adapter 함수
- common validator 함수
- markdown renderer 함수

새 파일 분리는 필수는 아니다. 한 파일 안에서 섹션을 나눠도 된다. 다만 phase 02에서 Toss adapter를 붙이기 쉬워야 한다.

### 2. Wanted adapter를 source adapter로 이동

현재 Wanted 수집 동작을 보존한다.

- Wanted detail fetch 실패 시 candidate 제외
- Wanted detail `status=active`만 `postingStatus: active`
- `linkType: direct_posting`
- `activeEvidence: Wanted API detail status=active`
- `openedAt` 값이 없으면 빈 문자열

### 3. common validator 적용

adapter가 반환한 후보를 renderer 전에 공통 validator로 통과시킨다.

validator는 최소한 다음을 보장한다.

- `linkType === "direct_posting"`
- `postingStatus`가 `active` 또는 `open`
- `activeEvidence`가 비어 있지 않음
- 서버/backend 역할 필터 유지
- 계약직/인턴/프리랜서 필터 유지
- `openedAt`이 빈 값이면 렌더링하지 않음

### 4. CLI 동작 보존

기존 CLI 옵션을 유지한다.

- `--source all|wanted|toss`
- `--max-wanted`
- `--server-only`
- `--output`
- `--include-toss-articles`

Toss는 phase 01에서는 계속 0개 또는 disabled diagnostics를 유지해도 된다.

---

## Critical Files

- `career-os/scripts/position-recommender/collect_live_postings.ts`

---

## 검증

보고 직전 반드시 아래 Bash 블록을 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun build career-os/scripts/position-recommender/collect_live_postings.ts --target=bun --outfile=/tmp/collect_live_postings.js
bun career-os/scripts/position-recommender/collect_live_postings.ts --source wanted --max-wanted 30 --output /tmp/live-position-wanted.md
grep -q "link_type: direct_posting" /tmp/live-position-wanted.md
grep -q "posting_status: active" /tmp/live-position-wanted.md
! grep -Eq "link_type: (career_article|search_page)|posting_status: unknown|opened_at: unknown" /tmp/live-position-wanted.md
```

---

## 금지 사항

- docs 수정 금지. docs는 planning 단계에서 이미 반영했다.
- 추천 prompt의 정책 완화 금지.
- `career_article`, `search_page`, `posting_status: unknown`을 active snapshot에 넣지 말 것.
- 값 없는 `opened_at`에 unknown 상태 문자열을 넣지 말 것.
- 외부 npm 의존성 추가 금지.

---

## Blocked / Failed 조건

- Wanted API 응답 형식이 바뀌어 `status=active`를 확인할 수 없으면 `PHASE_BLOCKED: Wanted active status schema changed` 출력 후 exit 2.
- 검증 명령 중 하나라도 실패하면 `PHASE_FAILED: collect_live_postings adapter refactor validation failed` 출력 후 exit 1.
