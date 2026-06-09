# Phase 01 — 스키마와 검증 helper 추가

**Model**: sonnet
**Status**: pending

## 목표

ADR-070 후보 refresh turn이 사용할 proposal, decision, apply 스키마와 결정적 검증 helper를 추가한다.

`config/study-pack-candidates.json`에는 `new` 후보만 반영할 수 있게 append/update/stale 로직을 구현한다.

## 중요 지침

이 phase는 implementation phase다.

docs-first 반영은 이미 완료됐다.
`docs/`, ADR, `AGENTS.md`, `TOOLS.md`, 정책 문서를 임의 수정하지 않는다.
문서 계약이 부족하면 추측하지 말고 `PHASE_BLOCKED`로 멈춘다.

같은 plan의 phase는 병렬 실행하지 않는다.
Phase 01 완료 후에만 Phase 02로 넘어간다.

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)/career-os"
pwd
git status --short
```

## 관련 파일

실행 전 반드시 읽는다.

- `AGENTS.md`
- `docs/adr.md`의 ADR-070
- `docs/data-schema.md`의 `data/runtime/study-topic-candidate-refresh.json` 섹션
- `docs/data-schema.md`의 `config/study-pack-candidates.json (ADR-070 이후 active 후보 캐시)` 섹션
- `docs/flow.md`의 `study-topic-recommender` 섹션
- `docs/code-architecture.md`의 `scripts/study-topic-recommender/` 구조
- `tasks/plan069-study-topic-candidate-refresh/index.json`
- `../skills/plan-and-build/references/common-pitfalls.md`
- `scripts/study-topic-recommender/refresh_topic_inventory.ts`
- `scripts/study-topic-recommender/duplicate_detection.ts`
- `scripts/study-topic-recommender/fos_study_inventory.ts`

## 범위

- `scripts/study-topic-recommender/` 아래 후보 refresh용 TypeScript schema/helper 추가.
- proposal, decision, applied report 타입과 JSON parse/validate 함수 추가.
- `new`, `update-existing`, `skip`, `needs-confirmation` decision 검증 추가.
- `config/study-pack-candidates.json` append/update/stale helper 추가.
- 기존 duplicate detection 또는 fos-study inventory helper 재사용.

## 비범위

- LLM 호출 entrypoint 구현.
- `.claude/skills/study-topic-recommender/SKILL.md` 수정.
- cron 설정 수정.
- `docs/`, ADR, `AGENTS.md`, `TOOLS.md`, 정책 문서 수정.
- `sources/fos-study/`, `public/question-bank/`, private 자료 수정.
- commit, push, PR 생성.

## 작업 절차

1. 기존 `scripts/study-topic-recommender/` 타입, helper, import style을 확인한다.
2. 후보 refresh proposal/decision/applied 타입과 validator를 추가한다.
3. `promotionTarget.outputPath`, `sourceSignals`, `source`, `generatedAt`, `status` 필수 조건을 검증한다.
4. `new`만 config에 반영하고 다른 decision은 report에만 남기는 apply helper를 추가한다.
5. active 자동 후보 30개 제한과 30일 이상 미선택 stale 후보 판정 helper를 추가한다.

## 검증 명령

보고 직전 반드시 실행하고 raw 결과를 남긴다.

```bash
cd "$(git rev-parse --show-toplevel)/career-os"
git status --short

rg -n "llm-candidate-refresh|study-topic-candidate-refresh|needs-confirmation|update-existing|promotionTarget|sourceSignals|stale" \
  scripts/study-topic-recommender

bun --check scripts/study-topic-recommender/*.ts

git diff --check -- scripts/study-topic-recommender
git diff --name-only -- docs AGENTS.md TOOLS.md
```

## 성공 기준

- 후보 refresh proposal/decision/applied 타입과 validator가 TypeScript로 추가된다.
- `new` 외 decision이 config에 자동 반영되지 않는 코드 경계가 있다.
- 자동 후보 필수 필드가 누락되면 validator가 실패한다.
- active 자동 후보 30개 제한과 stale 판정 helper가 코드로 표현된다.
- `bun --check scripts/study-topic-recommender/*.ts`가 통과한다.
- docs/ADR/정책 문서와 `sources/fos-study/`는 수정되지 않는다.

## 민감 정보 경계

- `config/candidate-profile.md`, `data/private/`, `data/applications/`, 회사별 prep 본문을 테스트 fixture나 report에 복사하지 않는다.
- runtime report에 후보 이유를 남길 때 개인 이력, 회사별 전략, 비공개 답변 전문을 포함하지 않는다.
- Discord로 보낼 수 있는 값은 후보 수, 공개 가능한 후보 제목, 보류 사유 요약으로 제한한다.

## common-pitfalls self-check

- 첫 bash 블록에 `cd "$(git rev-parse --show-toplevel)"`가 있다.
- docs/data-schema.md 계약을 먼저 읽었고, phase 안에서 docs를 고치지 않는다.
- 새 config 파일을 만들지 않는다.
- JSON write가 필요하면 trailing newline을 보존한다.
- PHASE_FAILED/PHASE_BLOCKED는 반드시 Bash 도구로 직접 실행하고 exit code를 남긴다.
- unrelated dirty files를 수정, stage, revert, commit, push하지 않는다.

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- `docs/data-schema.md`의 ADR-070 스키마와 기존 `config/study-pack-candidates.json` 구조가 충돌한다.
- 기존 helper 구조가 없어 새 schema 위치를 결정할 수 없다.
- stale 판정에 필요한 선택 이력 필드가 문서와 코드에서 확인되지 않는다.
- docs/ADR/정책 문서 수정 없이는 구현 기준을 세울 수 없다.
- 기존 dirty 변경이 같은 script 파일에서 충돌해 의도한 변경과 사용자 변경을 구분할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- `update-existing`, `skip`, `needs-confirmation`을 config에 자동 반영한다.
- docs/ADR/AGENTS/TOOLS/정책 문서를 임의 수정한다.
- `sources/fos-study/`, `public/question-bank/`, private 자료를 수정한다.
- 민감 본문을 fixture, runtime report, Discord message에 복사한다.
- `bun --check scripts/study-topic-recommender/*.ts`가 실패하는데 성공 보고한다.
- unrelated dirty 변경을 revert, stage, commit, push한다.
