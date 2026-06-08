# Phase 05 — 문서 일치 검토와 운영 확인

**Model**: haiku
**Status**: pending

## 목표

plan068 구현 결과가 ADR-069, data-schema, flow, code-architecture의 config diet 계약과 일치하는지 검토한다.

필수 동작 확인과 운영 확인을 끝내고, 남은 후속 구현 후보를 task 결과로 정리한다.

## 중요 지침

이 phase는 검증 phase다.

docs-first 반영은 이미 완료됐다.
새로운 정책이나 ADR 결정을 작성하지 않는다.
문서 계약이 실제 구현과 충돌하면 docs를 고치지 말고 `PHASE_BLOCKED`로 멈춘다.

같은 plan의 phase는 병렬 실행하지 않는다.
Phase 04 결과가 없으면 시작하지 않는다.

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
- Phase 02, Phase 03, Phase 04 실행 결과
- `docs/adr.md`의 ADR-069
- `docs/data-schema.md`의 config 책임 원칙
- `docs/flow.md`의 config diet 흐름
- `docs/code-architecture.md`의 config 설계 원칙

## 수정 범위

- `tasks/plan068-config-diet/index.json`
- `tasks/plan068-config-diet/phase-05.md`
- 필요하면 `tasks/plan068-config-diet/follow-ups.md`

## 검토 항목

- config가 정책, 현재 타깃, baseline, override/seed 중심으로 줄었는지 확인한다.
- fos-study inventory가 `sources/fos-study/`에서 파생되는지 확인한다.
- 공개 질문 inventory가 `public/question-bank/`에서 파생되는지 확인한다.
- 대량 topic/reservoir JSON이 정본으로 남지 않았는지 확인한다.
- reader fallback이 config 파일 부재 또는 축소 상태에서 명확히 동작하는지 확인한다.
- 삭제되거나 축소된 config를 active reader가 필수 입력으로 요구하지 않는지 확인한다.
- private 자료가 public inventory에 섞이지 않았는지 확인한다.
- 후속으로 분리해야 할 구현 후보가 있으면 `follow-ups.md`에 적는다.

## 금지 범위

- docs/ADR/정책 문서 수정.
- 구현 코드 수정.
- config 추가 축소 또는 삭제.
- public/question-bank 질문 내용 수정.
- sources/fos-study 문서 수정 또는 발행.
- unrelated dirty 변경 revert, stage, commit, push.
- 새 산출물에 금지 표현 사용.

## 검증 명령

보고 직전 가능한 범위에서 실행하고 raw 결과를 남긴다.

```bash
cd "$(git rev-parse --show-toplevel)"
git status --short

bun --check scripts/study-topic-recommender/refresh_topic_inventory.ts
bun --check scripts/study-topic-recommender/fos_study_inventory.ts
bun scripts/study-topic-recommender/refresh_topic_inventory.ts

if test -f scripts/question-bank-collector/validate.ts; then
  bun scripts/question-bank-collector/validate.ts
fi

rg -n "study-pack-topics|study-pack-candidates|topic-file-map|topic-profiles|question-bank-topics|study-preferences|first-round-drill-core-files|live-coding-seed" \
  scripts .claude/skills config docs tasks \
  | tee /tmp/plan068-phase05-reader-review.txt

rg -n "sources/fos-study|public/question-bank|override|pin|exclusion|seed|fallback|sourceOfTruth" \
  scripts .claude/skills data/runtime/topic-inventory.json public/question-bank \
  | tee /tmp/plan068-phase05-derived-review.txt

rg -n "candidate-profile|data/private|data/applications|private/" \
  scripts/study-topic-recommender scripts/question-bank-collector data/runtime/topic-inventory.json \
  | tee /tmp/plan068-phase05-private-review.txt || true

rg -n "smo""ke" tasks/plan068-config-diet config scripts .claude/skills public/question-bank && exit 1 || true
git diff --check
```

`private-review` 결과는 명시적 제외 처리일 수 있다.
runtime inventory나 public output에 private 본문이 있으면 실패로 본다.

## 성공 기준

- ADR-069의 config 책임 원칙과 구현 결과가 충돌하지 않는다.
- study-topic-recommender 실행 확인이 통과하고 `data/runtime/topic-inventory.json`이 생성된다.
- question-bank validator가 있으면 통과한다.
- active reader가 제거된 config를 필수 입력으로 요구하지 않는다.
- config가 fos-study/public-question-bank 전체 목록을 복제하지 않는다.
- private 자료가 public inventory나 runtime inventory에 섞이지 않는다.
- 후속 구현 후보가 있으면 `follow-ups.md`에 남긴다.
- `index.json`에 plan 결과와 phase 완료 결과가 갱신된다.
- 새 산출물에 금지 표현이 없다.

## 민감 정보 경계

- 검증 보고에는 경로, count, 상태만 적는다.
- candidate-profile 본문, private 지원 패키지, 회사별 prep 본문, 비공개 답변은 복사하지 않는다.
- Discord나 PR 본문에는 민감하지 않은 요약만 남긴다.

## HUD 갱신 지점

모든 HUD 갱신은 `session_status`와 subagent 목록을 먼저 확인한 뒤 `/home/bifos/.openclaw/workspace-career/scripts/task-hud/update_from_session_status.ts`로 full snapshot 갱신한다.
`update_event.ts` 같은 부분 갱신 경로를 쓰지 않는다.

- Phase 05 시작: `implementation running`
- Phase 05 완료: `implementation completed`
- Phase 05 실패: `implementation failed`
- Phase 05 보류: `implementation blocked`

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- Phase 04 결과가 없어 최종 검증을 할 수 없다.
- docs 계약과 구현 결과가 충돌하고 docs/ADR 수정 없이는 해소할 수 없다.
- active reader가 제거된 config를 필수 입력으로 요구하는데 어느 phase에서 고칠지 불명확하다.
- private 자료 누수 의심이 있어 사용자 판단이 필요하다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- 동작 확인 없이 plan을 완료 처리한다.
- active reader가 제거된 config를 필수 입력으로 요구하는 상태를 성공으로 보고한다.
- config가 fos-study/public-question-bank 전체 목록을 정본처럼 복제한다.
- private 본문이 runtime inventory나 public output에 포함된다.
- docs/ADR/정책 문서를 임의 수정한다.
- 구현 코드나 config를 이 검증 phase에서 추가 수정한다.
- 새 산출물에 금지 표현을 남긴다.
- unrelated dirty 변경을 revert, stage, commit, push한다.

## 실행 결과

완료 시각: 2026-06-08T21:23:38+09:00

상태: completed

### 검토 요약

- ADR-069, data-schema, flow, code-architecture의 config 책임 원칙과 구현 결과가 충돌하지 않음을 확인했다.
- `config/`는 전체 학습 문서 DB나 공개 질문 DB가 아니라 override, seed, fallback, guide 중심으로 축소된 상태다.
- 학습 문서 inventory는 `sources/fos-study/`에서 파생되고, `data/runtime/topic-inventory.json`에 `sourceOfTruth.root`가 `sources/fos-study`로 기록된다.
- 공개 질문 inventory는 `public/question-bank/` validator에서 파생되며, validator 실행 결과 categories 5개, questions 35개가 통과했다.
- `first-round-drill-core-files`는 active script, skill, config 참조가 없고 docs/task history에만 남는다.
- private 경계 확인 결과 runtime inventory에는 private 경로 매치가 없고, validator의 차단 패턴 문구만 확인됐다.

### 범위 확인

- docs/ADR/AGENTS/TOOLS/정책 문서 수정 없음.
- 구현 코드와 config 수정 없음.
- public/question-bank 질문 내용 수정 없음.
- sources/fos-study 문서 수정 또는 발행 없음.
- private 자료 수정 또는 복사 없음.
- unrelated apartment dirty 변경 수정, stage, revert, commit, push 없음.
- Phase 05에서 수정한 파일은 이 phase 파일과 `index.json`뿐이다.

### 실행한 명령과 결과

다음 명령을 career-os repo root에서 실행했다.

```bash
git status --short
python3 -m json.tool tasks/plan068-config-diet/index.json
bun --check scripts/study-topic-recommender/refresh_topic_inventory.ts
bun --check scripts/study-topic-recommender/fos_study_inventory.ts
bun scripts/study-topic-recommender/refresh_topic_inventory.ts
bun scripts/question-bank-collector/validate.ts
rg -n "study-pack-topics|study-pack-candidates|topic-file-map|topic-profiles|question-bank-topics|study-preferences|first-round-drill-core-files|live-coding-seed" scripts .claude/skills config docs tasks | tee /tmp/plan068-phase05-reader-review.txt
rg -n "sources/fos-study|public/question-bank|override|pin|exclusion|seed|fallback|sourceOfTruth" scripts .claude/skills data/runtime/topic-inventory.json public/question-bank | tee /tmp/plan068-phase05-derived-review.txt
rg -n "candidate-profile|data/private|data/applications|private/" scripts/study-topic-recommender scripts/question-bank-collector data/runtime/topic-inventory.json | tee /tmp/plan068-phase05-private-review.txt || true
git diff --check
```

결과:

- `git status --short`: Phase 05 정리 전 career-os 내부 dirty 없음.
  최종 dirty는 이 phase 파일과 `index.json`뿐이며, 기존 unrelated dirty는 `../apartment` 쪽 파일뿐이다.
- `python3 -m json.tool tasks/plan068-config-diet/index.json`: 통과.
- `bun --check scripts/study-topic-recommender/refresh_topic_inventory.ts`: 통과.
- `bun --check scripts/study-topic-recommender/fos_study_inventory.ts`: 통과.
- `bun scripts/study-topic-recommender/refresh_topic_inventory.ts`: 통과.
  stdout 기준 backend 3, techBlog 3, ai 3, geek 1 추천이 생성됐다.
- `bun scripts/question-bank-collector/validate.ts`: 통과.
  stdout 기준 status ok, categories 5, questions 35.
- reader review는 `/tmp/plan068-phase05-reader-review.txt`에 기록했다.
  active reader는 축소된 config를 optional override, seed, fallback, guide로만 참조한다.
- derived review는 `/tmp/plan068-phase05-derived-review.txt`에 기록했다.
  `sources/fos-study`, `public/question-bank`, `sourceOfTruth`, override/seed/fallback 참조를 확인했다.
- private review는 `/tmp/plan068-phase05-private-review.txt`에 기록했다.
  validator의 private/copyright 차단 패턴 문구만 확인됐다.
- 금지 표현 broad grep은 오래된 task history와 기존 범위 밖 파일의 문구를 잡았다.
  `tasks/plan068-config-diet` 기준 확인은 no matches다.
- `git diff --check`: 통과.

### 후속 후보

- 필수 후속 구현 후보는 없다.
- 별도 정리 후보로는 오래된 task history와 plan068 범위 밖 파일에 남은 금지 표현을 future cleanup에서 다루는 정도가 있다.

PHASE_BLOCKED: false

PHASE_FAILED: false
