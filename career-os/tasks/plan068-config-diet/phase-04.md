# Phase 04 — dead config 제거 또는 축소

**Model**: sonnet
**Status**: pending

## 목표

Phase 01 reader inventory와 Phase 03 migration 결과를 근거로 dead config를 제거하거나 override/seed 파일로 축소한다.

삭제는 reader 제거와 fallback 검증이 끝난 파일에만 수행한다.

## 중요 지침

이 phase는 implementation phase다.

docs-first 반영은 이미 완료됐다.
`docs/`, ADR, `AGENTS.md`, `TOOLS.md`, 정책 문서를 임의 수정하지 않는다.

같은 plan의 phase는 병렬 실행하지 않는다.
Phase 03 migration 결과가 없으면 시작하지 않는다.

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
- Phase 02와 Phase 03 실행 결과
- 축소 또는 삭제 대상 config 파일
- 해당 config를 읽던 script와 skill 파일

## 수정 범위

- `config/first-round-drill-core-files.json`
- `config/study-preferences.json`
- `config/study-pack-topics.json`
- `config/study-pack-candidates.json`
- `config/topic-file-map.json`
- `config/topic-profiles.json`
- `config/question-bank-topics.json`
- `config/live-coding-seed-pool.json`
- `config/live-coding-seed-candidates.json`
- 필요한 경우 skill reference로 이관되는 작은 파일.
- `tasks/plan068-config-diet/index.json`
- `tasks/plan068-config-diet/phase-04.md`

## 축소 계약

- 유지할 config는 정책, pin, override, exclusion, seed만 담는다.
- 전체 fos-study 문서 목록은 config에 남기지 않는다.
- 전체 public/question-bank 질문 목록은 config에 남기지 않는다.
- `study-preferences.json`은 current target 반복을 제거하고 추천 철학/제약만 남긴다.
- `study-pack-topics.json`과 `study-pack-candidates.json`은 필요한 override/seed만 남긴다.
- `topic-file-map.json`은 active reader가 없으면 삭제 후보로 처리한다.
- `topic-profiles.json`은 skill 전용 작성 guide라면 `.claude/skills/study-pack-writer/references/`로 이관하거나 작은 override로 축소한다.
- `question-bank-topics.json`은 public bank 정본 역할을 제거하고 interview-asset override로 좁힌다.
- live-coding seed 파일은 active reader가 있으면 seed 역할로 유지하고, 없으면 삭제 후보로 처리한다.

## 금지 범위

- Phase 01과 Phase 03 근거 없는 삭제.
- docs/ADR/정책 문서 수정.
- reader migration 없이 config만 삭제.
- public/question-bank 질문 내용 수정.
- sources/fos-study 문서 수정 또는 발행.
- private 자료를 config override로 복사.
- unrelated dirty 변경 revert, stage, commit, push.
- 새 산출물에 금지 표현 사용.

## 검증 명령

보고 직전 가능한 범위에서 실행하고 raw 결과를 남긴다.

```bash
cd "$(git rev-parse --show-toplevel)"
git status --short

for file in \
  config/first-round-drill-core-files.json \
  config/study-preferences.json \
  config/study-pack-topics.json \
  config/study-pack-candidates.json \
  config/topic-file-map.json \
  config/topic-profiles.json \
  config/question-bank-topics.json \
  config/live-coding-seed-pool.json \
  config/live-coding-seed-candidates.json; do
  if test -f "$file"; then
    printf "[remaining] %s " "$file"
    wc -c <"$file"
  else
    printf "[removed] %s\n" "$file"
  fi
done

rg -n "study-pack-topics|study-pack-candidates|topic-file-map|topic-profiles|question-bank-topics|study-preferences|first-round-drill-core-files|live-coding-seed" \
  scripts .claude/skills config docs tasks \
  | tee /tmp/plan068-phase04-post-cleanup-readers.txt

bun --check scripts/study-topic-recommender/refresh_topic_inventory.ts
bun scripts/study-topic-recommender/refresh_topic_inventory.ts

if test -f scripts/question-bank-collector/validate.ts; then
  bun scripts/question-bank-collector/validate.ts
fi

rg -n "smo""ke" tasks/plan068-config-diet config scripts .claude/skills && exit 1 || true
git diff --check
```

삭제한 파일이 docs/task history에서만 검색되는 것은 허용한다.
active script나 skill reader가 삭제 파일을 필수 입력으로 요구하면 실패로 본다.

## 성공 기준

- dead config는 reader 제거와 fallback 확인 후에만 제거된다.
- 유지 config는 정책, pin, override, exclusion, seed 중심으로 축소된다.
- config가 fos-study 전체 목록이나 public/question-bank 전체 목록을 복제하지 않는다.
- study-topic-recommender 실행 확인이 통과한다.
- question-bank validator가 있으면 통과한다.
- active reader가 삭제된 config를 필수로 요구하지 않는다.
- 새 산출물에 금지 표현이 없다.

## 민감 정보 경계

- 축소된 config에 private 답변, 지원 전략, 회사별 비공개 맥락, 개인 이력 세부사항을 넣지 않는다.
- public-safe topic override만 남긴다.
- private 자료를 이관 대상으로 삼지 않는다.

## HUD 갱신 지점

모든 HUD 갱신은 `session_status`와 subagent 목록을 먼저 확인한 뒤 `/home/bifos/.openclaw/workspace-career/scripts/task-hud/update_from_session_status.ts`로 full snapshot 갱신한다.
`update_event.ts` 같은 부분 갱신 경로를 쓰지 않는다.

- Phase 04 시작: `implementation running`
- Phase 04 완료: `implementation running`
- Phase 04 실패: `implementation failed`
- Phase 04 보류: `implementation blocked`

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- Phase 01 또는 Phase 03 결과가 없어 삭제 근거가 부족하다.
- active reader가 남아 있는데 fallback 없이 파일 삭제가 필요해 보인다.
- 어떤 항목을 override로 남길지 docs 계약만으로 판정할 수 없다.
- 기존 dirty 변경이 같은 config 파일에서 충돌한다.
- docs/ADR 수정이 필요한 새 config 책임 결정이 필요하다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- active reader가 필수로 요구하는 config를 삭제한다.
- config가 다시 fos-study 전체 목록이나 public/question-bank 전체 목록을 복제한다.
- private 정보를 config override로 복사한다.
- docs/ADR/정책 문서를 임의 수정한다.
- sources/fos-study 또는 public/question-bank 질문 본문을 임의 수정한다.
- 새 산출물에 금지 표현을 남긴다.
- unrelated dirty 변경을 revert, stage, commit, push한다.

## 실행 결과

완료 시각: 2026-06-08T21:12:26+09:00

상태: completed

### 변경 요약

- `config/first-round-drill-core-files.json`은 마지막 `rg` 확인에서 active script/skill reader가 없어 제거했다.
- `config/study-preferences.json`은 current target 반복과 secondary target 운영 상태를 제거하고 추천 철학, 관심 축, 제약, 회피 조건만 남겼다.
- `config/study-pack-topics.json`은 전체 study-pack 목록 역할을 중단하고 4개 public-safe override/fallback 후보만 남겼다.
- `config/study-pack-candidates.json`은 전체 reservoir 역할을 중단하고 8개 seed/fallback 후보만 남겼다.
- `config/topic-file-map.json`은 `interview-prep-analyzer` active fallback reader가 남아 있어 삭제하지 않고 5개 fallback topic만 남겼다.
- `config/topic-profiles.json`은 active writer guide reader가 남아 있어 구조를 유지하고, 정본 inventory가 아니라 optional guide임을 명시했다.
- `config/question-bank-topics.json`은 public/question-bank 정본 역할을 제거하고 interview-asset override 2개만 남겼다.
  긴 company-specific prompt는 private 판단을 복사하지 않는 일반 안내로 축소했다.
- `config/live-coding-seed-pool.json`은 active reader가 남아 있어 seed 구조를 유지하고 5개 pinned example만 남겼다.
- `config/live-coding-seed-candidates.json`은 기존 candidate seed가 모두 `sources/fos-study`에 있어 빈 `seeds` 배열로 축소했다.

### 범위 확인

- docs/ADR/AGENTS/TOOLS/정책 문서 수정 없음.
- public/question-bank 질문 내용 수정 없음.
- sources/fos-study 문서 수정 또는 발행 없음.
- private 자료를 config override로 복사하지 않음.
- unrelated apartment dirty 변경 수정, stage, revert, commit, push 없음.
- 같은 plan의 Phase 05는 실행하지 않음.

### 실행 확인 결과

다음 명령을 career-os repo root에서 실행했다.

```bash
git status --short

for file in \
  config/first-round-drill-core-files.json \
  config/study-preferences.json \
  config/study-pack-topics.json \
  config/study-pack-candidates.json \
  config/topic-file-map.json \
  config/topic-profiles.json \
  config/question-bank-topics.json \
  config/live-coding-seed-pool.json \
  config/live-coding-seed-candidates.json; do
  if test -f "$file"; then
    printf "[remaining] %s " "$file"
    wc -c <"$file"
  else
    printf "[removed] %s\n" "$file"
  fi
done

rg -n "study-pack-topics|study-pack-candidates|topic-file-map|topic-profiles|question-bank-topics|study-preferences|first-round-drill-core-files|live-coding-seed" \
  scripts .claude/skills config docs tasks \
  | tee /tmp/plan068-phase04-post-cleanup-readers.txt

python3 -m json.tool tasks/plan068-config-diet/index.json
bun --check scripts/study-topic-recommender/refresh_topic_inventory.ts
bun scripts/study-topic-recommender/refresh_topic_inventory.ts
bun scripts/question-bank-collector/validate.ts
rg -n "smo""ke" tasks/plan068-config-diet config scripts .claude/skills && exit 1 || true
git diff --check
```

결과:

- remaining/removed 확인:
  - removed: `config/first-round-drill-core-files.json`
  - remaining bytes:
    - `config/study-preferences.json`: 2380
    - `config/study-pack-topics.json`: 3600
    - `config/study-pack-candidates.json`: 9203
    - `config/topic-file-map.json`: 1125
    - `config/topic-profiles.json`: 2060
    - `config/question-bank-topics.json`: 1853
    - `config/live-coding-seed-pool.json`: 1893
    - `config/live-coding-seed-candidates.json`: 148
- post-cleanup reader grep 결과는 `/tmp/plan068-phase04-post-cleanup-readers.txt`에 기록했다.
  삭제된 first-round config는 docs/task history에만 남고 active script/skill reader는 없다.
- `python3 -m json.tool tasks/plan068-config-diet/index.json`: passed.
- `bun --check scripts/study-topic-recommender/refresh_topic_inventory.ts`: passed.
  Bun 동작상 entrypoint가 실행되어 runtime inventory도 갱신됐다.
- `bun scripts/study-topic-recommender/refresh_topic_inventory.ts`: passed.
  stdout 기준 backend 3, techBlog 3, ai 3, geek 1 추천을 생성했다.
- `bun scripts/question-bank-collector/validate.ts`: passed.
  stdout 기준 categories=5, questions=35.
- 금지 표현 broad grep:
  기존 범위 밖 파일인 `config/candidate-profile.md`와 `scripts/application-agent/priority_recommendation.ts`의 오래된 문구가 잡혔다.
  Phase 04 변경 파일 기준 grep은 no matches.
- `git diff --check`: passed.
- 메인 세션 review에서 `config/topic-file-map.json`에 실제 `sources/fos-study`에 없는 오래된 fallback 경로가 남아 있음을 확인했고, 해당 경로를 제거한 뒤 다시 검증했다.
  - `topic-file-map.json`의 남은 fallback path 존재 확인: passed.
  - `python3 -m json.tool tasks/plan068-config-diet/index.json`: passed.
  - `bun --check scripts/study-topic-recommender/refresh_topic_inventory.ts`: passed.
  - `bun scripts/study-topic-recommender/refresh_topic_inventory.ts`: passed.
  - `bun scripts/question-bank-collector/validate.ts`: passed, categories=5, questions=35.
  - `rg -n "first-round-drill-core-files" scripts .claude/skills config`: no active refs.
  - `git diff --check`: passed.

PHASE_BLOCKED: false

PHASE_FAILED: false
