# Phase 03 — study-topic-recommender와 skill reader migration

**Model**: sonnet
**Status**: pending

## 목표

`study-topic-recommender`와 관련 native skill의 reader/fallback을 derived inventory 중심으로 옮긴다.

기존 config는 정본 목록이 아니라 override, pin, exclusion, seed, fallback 가중치로만 적용되게 한다.

## 중요 지침

이 phase는 implementation phase다.

docs-first 반영은 이미 완료됐다.
`docs/`, ADR, `AGENTS.md`, `TOOLS.md`, 정책 문서를 임의 수정하지 않는다.

같은 plan의 phase는 병렬 실행하지 않는다.
Phase 02의 helper 구현 또는 확장 결과가 없으면 시작하지 않는다.

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
git status --short
```

## 관련 파일

실행 전 반드시 읽는다.

- `tasks/plan068-config-diet/index.json`
- `tasks/plan068-config-diet/reader-inventory.md`
- `scripts/study-topic-recommender/refresh_topic_inventory.ts`
- `scripts/study-topic-recommender/fos_study_inventory.ts`
- `scripts/study-topic-recommender/feed_discovery.ts`
- `scripts/study-topic-recommender/duplicate_detection.ts`
- `.claude/skills/study-topic-recommender/SKILL.md`
- `.claude/skills/study-pack-writer/SKILL.md`
- `.claude/skills/interview-asset-writer/SKILL.md`
- `.claude/skills/question-bank-collector/SKILL.md`가 있으면 읽기

## 수정 범위

- `scripts/study-topic-recommender/` reader와 fallback 코드.
- `.claude/skills/study-topic-recommender/SKILL.md`
- `.claude/skills/study-pack-writer/SKILL.md`
- `.claude/skills/interview-asset-writer/SKILL.md`
- `.claude/skills/question-bank-collector/SKILL.md`가 존재하고 필요할 때만.
- `tasks/plan068-config-diet/index.json`
- `tasks/plan068-config-diet/phase-03.md`

## migration 계약

- `study-topic-recommender`는 `sources/fos-study/` inventory를 먼저 읽는다.
- `study-pack-topics.json`과 `study-pack-candidates.json`은 전체 목록 정본이 아니라 override, seed, fallback 후보로만 읽는다.
- `topic-file-map.json`은 실제 파일 존재 여부보다 우선하지 않는다.
- `study-preferences.json`의 current target 중복 값은 새 reader에서 요구하지 않는다.
- `topic-profiles.json`은 작성 guide 또는 family override로만 사용한다.
- `question-bank-topics.json`은 public/question-bank 정본이 아니라 interview-asset-writer 전용 override 후보로만 사용한다.
- live-coding seed 파일은 active reader 여부를 Phase 01 결과에 맞춰 유지하거나 fallback/seed로 제한한다.
- config 파일이 일부 없어도 최소 안내 또는 deterministic fallback이 가능해야 한다.

## 금지 범위

- dead config 삭제 또는 축소.
- docs/ADR/정책 문서 수정.
- public/question-bank 질문 내용 수정.
- sources/fos-study 문서 수정 또는 발행.
- candidate-profile 자동 수정.
- private prep 자동 반영.
- unrelated dirty 변경 revert, stage, commit, push.
- 새 산출물에 금지 표현 사용.

## 검증 명령

보고 직전 가능한 범위에서 실행하고 raw 결과를 남긴다.

```bash
cd "$(git rev-parse --show-toplevel)"
git status --short

bun --check scripts/study-topic-recommender/refresh_topic_inventory.ts
bun --check scripts/study-topic-recommender/fos_study_inventory.ts

rg -n "study-pack-topics|study-pack-candidates|topic-file-map|topic-profiles|question-bank-topics|study-preferences|live-coding-seed" \
  scripts/study-topic-recommender .claude/skills \
  | tee /tmp/plan068-phase03-config-readers.txt

rg -n "sources/fos-study|fosStudy|fos-study|public/question-bank|override|pin|exclusion|seed|fallback" \
  scripts/study-topic-recommender .claude/skills \
  | tee /tmp/plan068-phase03-derived-refs.txt

bun scripts/study-topic-recommender/refresh_topic_inventory.ts

test -f data/runtime/topic-inventory.json
rg -n "sourceOfTruth|fos-study|excluded|pools|claudeDuplicateReview" data/runtime/topic-inventory.json

rg -n "smo""ke" tasks/plan068-config-diet scripts/study-topic-recommender .claude/skills && exit 1 || true
git diff --check
```

`refresh_topic_inventory.ts` 실행이 외부 네트워크나 환경 문제로 실패하면 실패 원인을 기록한다.
config reader migration 자체가 확인되면 부분 성공으로 보고할 수 있지만, fallback이 깨지면 실패로 본다.

## 성공 기준

- study-topic-recommender가 fos-study derived inventory를 우선한다.
- 대량 config JSON은 정본 목록이 아니라 override, seed, fallback으로만 남는다.
- `topic-file-map.json`이 실제 파일 존재 여부보다 우선하지 않는다.
- 관련 SKILL.md의 입력 설명이 ADR-069와 충돌하지 않는다.
- config 일부가 없어도 명확한 fallback 또는 보류 메시지를 낸다.
- `refresh_topic_inventory.ts` 실행 확인 또는 동등한 실행 확인이 통과한다.
- 새 산출물에 금지 표현이 없다.

## 민감 정보 경계

- reader migration은 public-safe 학습 문서와 public question bank inventory만 대상으로 한다.
- candidate-profile은 기존 skill 입력으로 읽더라도 inventory source로 사용하지 않는다.
- private 지원 패키지, 회사별 prep, 비공개 답변을 추천 inventory에 포함하지 않는다.

## HUD 갱신 지점

모든 HUD 갱신은 `session_status`와 subagent 목록을 먼저 확인한 뒤 `/home/bifos/.openclaw/workspace-career/scripts/task-hud/update_from_session_status.ts`로 full snapshot 갱신한다.
`update_event.ts` 같은 부분 갱신 경로를 쓰지 않는다.

- Phase 03 시작: `implementation running`
- Phase 03 완료: `implementation running`
- Phase 03 실패: `implementation failed`
- Phase 03 보류: `implementation blocked`

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- Phase 02 helper가 없거나 helper 계약이 실행 흐름에 충분하지 않다.
- config reader migration 중 docs/ADR 수정이 필요한 새 결정점이 생긴다.
- live-coding seed 유지/흡수 판단이 Phase 01 결과와 충돌한다.
- 기존 dirty 변경이 같은 script 또는 skill 파일에서 충돌한다.
- private 자료를 읽지 않으면 fallback을 설계할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- study-topic-recommender가 대량 topic JSON을 계속 정본으로 요구한다.
- topic-file-map이 실제 파일 존재 여부보다 우선한다.
- public/question-bank 정본을 question-bank-topics.json으로 되돌린다.
- private 본문을 추천 inventory에 포함한다.
- docs/ADR/정책 문서를 임의 수정한다.
- 새 산출물에 금지 표현을 남긴다.
- unrelated dirty 변경을 revert, stage, commit, push한다.
