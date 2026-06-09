# Phase 03 — study-topic-recommender skill과 CLI 연결

**Model**: sonnet
**Status**: pending

## 목표

`study-topic-recommender` native skill이 추천 전에 후보 refresh 필요 조건을 판단하고, 필요할 때 Phase 02 entrypoint를 호출하도록 연결한다.

기존 `refresh_topic_inventory.ts`, `--render-only`, duplicate review 흐름은 보존한다.

## 중요 지침

이 phase는 implementation phase다.

docs-first 반영은 이미 완료됐다.
`docs/`, ADR, `AGENTS.md`, `TOOLS.md`, 정책 문서를 임의 수정하지 않는다.
문서 계약이 부족하면 추측하지 말고 `PHASE_BLOCKED`로 멈춘다.

같은 plan의 phase는 병렬 실행하지 않는다.
Phase 01과 Phase 02 산출물을 정확한 파일 경로로 다시 읽고 시작한다.

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)/career-os"
pwd
git status --short
```

## 관련 파일

실행 전 반드시 읽는다.

- `docs/adr.md`의 ADR-070
- `docs/flow.md`의 `study-topic-recommender` 내부 흐름
- `docs/code-architecture.md`의 `study-topic-recommender` 구조
- `tasks/plan069-study-topic-candidate-refresh/index.json`
- `tasks/plan069-study-topic-candidate-refresh/phase-01.md`
- `tasks/plan069-study-topic-candidate-refresh/phase-02.md`
- `.claude/skills/study-topic-recommender/SKILL.md`
- `scripts/study-topic-recommender/refresh_topic_inventory.ts`
- `scripts/study-topic-recommender/refresh_candidate_pool.ts`
- Phase 01에서 추가한 후보 refresh schema/helper 파일

## 범위

- `.claude/skills/study-topic-recommender/SKILL.md` workflow에 candidate refresh decision step 반영.
- refresh 필요 조건 판단 기준 연결.
- `refresh_candidate_pool.ts` 실행과 `refresh_topic_inventory.ts` 실행 순서 고정.
- 기존 `--render-only`와 duplicate review 흐름 보존.
- on-demand 자연어 context가 refresh decision에 들어가도록 연결.

## 비범위

- cron 하루 1회 제한 구현.
- Discord routing 최종 검증.
- docs/ADR/정책 문서 수정.
- `sources/fos-study/` 수정.
- duplicate detection 알고리즘 대규모 교체.
- commit, push, PR 생성.

## 작업 절차

1. 현재 SKILL.md workflow와 script 호출 지점을 읽고 기존 render-only/duplicate review 흐름을 기록한다.
2. 새 후보 5개 이하, 최근 7회 반복, 사용자 새 관심사, 새 지원·면접 맥락, 기존 문서 혼입 조건을 refresh trigger로 반영한다.
3. refresh가 필요할 때 `refresh_candidate_pool.ts`를 먼저 호출하고, 그 뒤 기존 `refresh_topic_inventory.ts`를 호출하게 한다.
4. refresh가 필요 없거나 실패해도 기존 deterministic inventory와 duplicate review가 가능한 범위에서 계속되게 한다.
5. on-demand context와 render-only 동작이 config 자동 반영 여부를 명확히 구분하게 한다.

## 검증 명령

보고 직전 반드시 실행하고 raw 결과를 남긴다.

```bash
cd "$(git rev-parse --show-toplevel)/career-os"
git status --short

rg -n "candidate refresh|refresh_candidate_pool|study-topic-candidate-refresh|render-only|duplicate review|possibleDuplicates|needs-confirmation|recent 7|새 후보|새 관심사" \
  .claude/skills/study-topic-recommender/SKILL.md scripts/study-topic-recommender

bun --check scripts/study-topic-recommender/*.ts

bun scripts/study-topic-recommender/refresh_topic_inventory.ts --render-only >/tmp/plan069-refresh-topic-render-only.txt
test -s /tmp/plan069-refresh-topic-render-only.txt

git diff --check -- .claude/skills/study-topic-recommender scripts/study-topic-recommender
git diff --name-only -- docs AGENTS.md TOOLS.md
```

## 성공 기준

- SKILL.md가 candidate refresh decision step을 포함한다.
- refresh 필요 조건이 ADR-070과 일치한다.
- `refresh_candidate_pool.ts`는 필요한 경우에만 기존 inventory refresh 전에 호출된다.
- 기존 `refresh_topic_inventory.ts --render-only`가 계속 실행된다.
- duplicate review 흐름이 제거되거나 우회되지 않는다.
- docs/ADR/정책 문서는 수정되지 않는다.

## 민감 정보 경계

- on-demand context를 SKILL.md 예시나 runtime report에 private 전문으로 남기지 않는다.
- 새 지원·면접 맥락은 trigger reason 수준으로만 요약한다.
- 추천 결과와 후보 refresh 요약은 이직준비방에 보내더라도 민감한 개인 이력과 회사별 전략을 포함하지 않는다.

## common-pitfalls self-check

- SKILL.md 수정 시 references/가 있으면 함께 audit한다.
  현재 study-topic-recommender는 references/ 없음이 전제지만, 있으면 옛 subprocess 지시문을 grep한다.
- `refresh_topic_inventory.ts --render-only` 검증을 실제 실행한다.
- duplicate review 관련 키워드가 SKILL.md와 inventory script에서 사라지지 않았다.
- docs/ADR/정책 문서를 수정하지 않는다.
- PHASE_FAILED/PHASE_BLOCKED는 반드시 Bash 도구로 직접 실행하고 exit code를 남긴다.

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- SKILL.md 현재 workflow가 docs/flow.md의 ADR-070 흐름과 충돌한다.
- render-only에서 config 자동 반영을 해야 하는지 문서 계약이 모호하다.
- duplicate review 흐름을 보존하면서 refresh_candidate_pool을 연결할 위치를 정할 수 없다.
- 기존 dirty 변경이 같은 SKILL.md 또는 script 파일에서 충돌한다.
- docs/ADR/정책 문서 수정 없이는 진행할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- `refresh_topic_inventory.ts --render-only`를 깨뜨린다.
- duplicate review 흐름을 제거하거나 항상 skip하게 만든다.
- refresh가 필요 없는 실행에서도 config를 무조건 변경한다.
- docs/ADR/AGENTS/TOOLS/정책 문서를 임의 수정한다.
- 민감 context를 SKILL.md, runtime report, stdout에 그대로 남긴다.
- unrelated dirty 변경을 revert, stage, commit, push한다.
