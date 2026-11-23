# Phase 02. 공고 제외 판정을 실행기 명령으로 옮긴다

**Execution profile**: standard

## 목표

대화에서 찾은 공고가 개인 제외 규칙에 걸리는지 판정하던 MCP 도구(`check_position_exclusions`, `get_position_research_constraints`)를 실행기 명령 `position check-exclusions` 로 옮긴다. MCP 서버는 작업 폴더의 규칙에 닿지 못한다.

**범위 외**: MCP 도구 삭제 자체(phase 03).

## 컨텍스트

- 판정 코드는 `career-os/scripts/position-recommender/feedback/exclusion-match.ts` 의 `indexExclusions`, `judgePosting` 이고 수집기와 같다(ADR-142). 지금 도구(`career-os/plugin/src/positions.ts`)는 Backend 에서 규칙과 회사 선호를 읽어 이 함수에 넘긴다.
- 규칙과 회사 선호는 1단계부터 작업 폴더 SQLite 에 있다(`career-os/scripts/lib/career-store/positions/store.ts`).
- 하위 명령 분기는 `career-os/scripts/position-recommender/position_run.ts` 에 있다.

**요구사항**: REQ7(설계 REQ7 줄의 「공고 제외 판정은 실행기 명령 `position check-exclusions` 로 옮긴다」)

**근거 문서**: `career-os/docs/adr/ADR-142-먼저-살펴보기의-공고-제외-판정은-수집기와-같은-코드가-하고-식별-불가는-보류한다.md`

## 의도 메모

- 저장소가 한 파일이라 「목록 하나만 읽지 못함」 은 없다. 도구가 내던 `readiness`, `missing` 은 없애고 저장소 오류는 다른 명령처럼 종료 코드 1 과 첫 줄로 낸다.
- 입력은 파일로 받는다. 공고 제목을 셸 인자로 넘기면 따옴표 처리가 어긋난다.

## 작업 항목

### 1. `career-os/scripts/position-recommender/check_exclusions.ts`

`checkExclusions(store, input, now)`. 입력은 `{ postings: [{ url, company, title, source?, identityHash? }] }`(1개에서 10개, `identityHash` 는 `source` 와 함께만). 출력은 `{ results: [{ position, url, verdict, basis, ... }] }` 로 지금 도구의 `results` 와 같다.

### 2. `career-os/scripts/position-recommender/position_run.ts`

`check-exclusions --input <json>` 하위 명령과 도움말 한 줄.

### 3. `career-os/scripts/position-recommender/check_exclusions.test.ts`

`check-exclusions --input` 명령을 직접 부르는 사례(정상, `--input` 없음)와, `career-os/plugin/src/position-exclusions.test.ts` 의 판정 사례를 임시 작업 폴더 SQLite 로 옮긴다: 회사 제외, 회사·역할 키워드, 공고 식별값이 없어 판정 불가, 제외 회사 선호, 걸리지 않음, `identityHash` 만 온 입력 거절.

## 검증

```bash
bun test ./career-os/scripts/position-recommender/check_exclusions.test.ts
bunx tsc --noEmit -p .
```

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/check_exclusions.ts` | 신규 |
| `career-os/scripts/position-recommender/check_exclusions.test.ts` | 신규 |
| `career-os/scripts/position-recommender/position_run.ts` | 수정 |
