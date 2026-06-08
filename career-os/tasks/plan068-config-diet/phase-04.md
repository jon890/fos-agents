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
