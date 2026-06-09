# Phase 02 — LLM 후보 refresh entrypoint 추가

**Model**: sonnet
**Status**: pending

## 목표

ADR-070의 candidate refresh turn을 실행하는 entrypoint를 추가한다.

entrypoint는 LLM 후보 제안 결과를 runtime JSON/Markdown으로 남기고, deterministic 검증을 통과한 `new` 후보만 active config 캐시에 반영한다.

## 중요 지침

이 phase는 implementation phase다.

docs-first 반영은 이미 완료됐다.
`docs/`, ADR, `AGENTS.md`, `TOOLS.md`, 정책 문서를 임의 수정하지 않는다.
문서 계약이 부족하면 추측하지 말고 `PHASE_BLOCKED`로 멈춘다.

같은 plan의 phase는 병렬 실행하지 않는다.
Phase 01 산출물을 정확한 파일 경로로 다시 읽고 시작한다.

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)/career-os"
pwd
git status --short
```

## 관련 파일

실행 전 반드시 읽는다.

- `docs/adr.md`의 ADR-070
- `docs/data-schema.md`의 후보 refresh runtime/config 스키마
- `docs/flow.md`의 `study-topic-recommender` 내부 흐름
- `docs/code-architecture.md`의 `scripts/study-topic-recommender/refresh_candidate_pool.ts` 구조
- `tasks/plan069-study-topic-candidate-refresh/index.json`
- `tasks/plan069-study-topic-candidate-refresh/phase-01.md`
- `scripts/study-topic-recommender/refresh_topic_inventory.ts`
- Phase 01에서 추가한 후보 refresh schema/helper 파일
- `config/study-preferences.json`
- `config/study-progress.json`
- `config/study-pack-candidates.json`
- `data/runtime/topic-inventory-history.jsonl`

## 범위

- `scripts/study-topic-recommender/refresh_candidate_pool.ts` 또는 동등 entrypoint 추가.
- fos-study inventory, preferences, progress, recent history, 실행 context를 입력으로 모으는 loader 추가.
- LLM 후보 proposal JSON을 읽거나 생성할 수 있는 entrypoint 계약 추가.
- deterministic decision과 config apply를 연결.
- `data/runtime/study-topic-candidate-refresh.json`과 `.md` 생성.

## 비범위

- native skill workflow 연결.
- cron 또는 systemd 설정 수정.
- `refresh_topic_inventory.ts`의 기존 추천 ranking 대규모 재작성.
- docs/ADR/정책 문서 수정.
- `sources/fos-study/` 수정.
- commit, push, PR 생성.

## 작업 절차

1. `refresh_candidate_pool.ts` CLI 옵션을 기존 script style에 맞춰 정의한다.
2. 입력 loader가 ADR-070 입력 파일과 자연어 context를 읽게 한다.
3. LLM proposal draft를 runtime 또는 stdin/file에서 받아 validator와 duplicate decision에 통과시킨다.
4. `new` 후보만 `config/study-pack-candidates.json`에 append/update하고 stale 후보를 report에 기록한다.
5. runtime JSON/Markdown에 trigger, inputs, proposals, decisions, applied 요약을 쓴다.

## 검증 명령

보고 직전 반드시 실행하고 raw 결과를 남긴다.

```bash
cd "$(git rev-parse --show-toplevel)/career-os"
git status --short

test -f scripts/study-topic-recommender/refresh_candidate_pool.ts
rg -n "study-topic-candidate-refresh|refresh_candidate_pool|generatedAt|proposals|decisions|applied|--context|render-only|new|update-existing|needs-confirmation" \
  scripts/study-topic-recommender

bun --check scripts/study-topic-recommender/*.ts

bun scripts/study-topic-recommender/refresh_candidate_pool.ts --help >/tmp/plan069-refresh-candidate-help.txt
test -s /tmp/plan069-refresh-candidate-help.txt

git diff --check -- scripts/study-topic-recommender data/runtime config/study-pack-candidates.json
git diff --name-only -- docs AGENTS.md TOOLS.md
```

가능하면 dry-run 또는 render-only fixture 실행을 추가로 수행한다.
실행 경로가 아직 skill 연결 전이라 불가능하면 이유를 phase 결과에 남긴다.

## 성공 기준

- refresh candidate entrypoint가 존재하고 `--help` 또는 동등 usage를 출력한다.
- entrypoint가 ADR-070 입력을 읽는 loader를 가진다.
- runtime JSON과 Markdown writer가 구현된다.
- 자동 config 반영은 `new` 후보로 제한된다.
- `update-existing`, `skip`, `needs-confirmation`은 runtime report에만 남는다.
- `bun --check scripts/study-topic-recommender/*.ts`가 통과한다.

## 민감 정보 경계

- 자연어 context는 private 전문을 그대로 저장하지 않는다.
- runtime markdown에는 공개 가능한 후보 제목, domain/tag, 보류 사유만 요약한다.
- Discord 요약으로 재사용될 수 있는 markdown에 개인 이력, 회사별 전략, 비공개 답변 전문을 넣지 않는다.

## common-pitfalls self-check

- phase 시작 시 Phase 01 helper 파일을 실제로 읽었다.
- `refresh_topic_inventory.ts`의 기존 inventory/recommendation 책임을 빼앗지 않는다.
- `--render-only`나 dry-run 옵션이 있다면 config를 변경하지 않는다.
- JSON 산출물은 trailing newline을 포함한다.
- docs/ADR/정책 문서를 수정하지 않는다.
- PHASE_FAILED/PHASE_BLOCKED는 반드시 Bash 도구로 직접 실행하고 exit code를 남긴다.

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- LLM proposal 입력/출력 경계가 문서만으로 결정되지 않는다.
- 기존 `config/study-pack-candidates.json` 구조가 자동 후보 필수 필드와 충돌한다.
- runtime report 저장 위치가 `docs/data-schema.md`와 다르다.
- private context를 저장하지 않고는 trigger reason을 표현할 방법이 없다.
- 기존 dirty 변경이 같은 entrypoint/helper 파일에서 충돌한다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- `new` 외 decision을 config에 자동 반영한다.
- `--render-only` 또는 dry-run 실행에서 config를 변경한다.
- runtime JSON/Markdown을 `docs/` 아래에 쓴다.
- docs/ADR/AGENTS/TOOLS/정책 문서를 임의 수정한다.
- 민감 본문을 runtime report나 stdout에 출력한다.
- `bun --check scripts/study-topic-recommender/*.ts` 실패를 무시한다.
