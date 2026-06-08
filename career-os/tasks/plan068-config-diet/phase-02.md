# Phase 02 — derived inventory helper 계약 구현

**Model**: sonnet
**Status**: pending

## 목표

`sources/fos-study/`와 `public/question-bank/`에서 inventory를 파생하는 helper 계약을 구현하거나 기존 helper를 확장한다.

config 대량 목록을 정본으로 읽지 않아도 추천기와 skill이 실제 자산 목록을 확인할 수 있는 기반을 만든다.

## 중요 지침

이 phase는 implementation phase다.

docs-first 반영은 이미 완료됐다.
`docs/`, ADR, `AGENTS.md`, `TOOLS.md`, 정책 문서를 임의 수정하지 않는다.

같은 plan의 phase는 병렬 실행하지 않는다.
Phase 01의 `reader-inventory.md`가 없으면 시작하지 않는다.

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
- `scripts/study-topic-recommender/fos_study_inventory.ts`
- `scripts/study-topic-recommender/duplicate_detection.ts`
- `scripts/study-topic-recommender/refresh_topic_inventory.ts`
- `scripts/question-bank-collector/validate.ts`가 있으면 읽기
- `.claude/skills/study-topic-recommender/SKILL.md`
- `.claude/skills/study-pack-writer/SKILL.md`
- `.claude/skills/interview-asset-writer/SKILL.md`

## 수정 범위

- `scripts/study-topic-recommender/` 아래 기존 inventory helper 또는 새 helper.
- `scripts/question-bank-collector/` 아래 기존 validator/helper 또는 새 helper.
- 필요한 경우 helper self-test 파일.
- `tasks/plan068-config-diet/index.json`
- `tasks/plan068-config-diet/phase-02.md`

## 구현 계약

- fos-study inventory helper는 `sources/fos-study/**/*.md`를 스캔한다.
- fos-study scan은 `.git/**`와 `.claude/**`를 제외한다.
- inventory item에는 최소한 path, slug 또는 key, title 후보, domain 또는 category 후보, tags 후보, updatedAt 또는 mtime 기반 진단값을 담는다.
- public question bank inventory는 `public/question-bank/` validator 결과 또는 동등한 scan 결과에서 파생한다.
- helper는 private 디렉터리, candidate profile 본문, 회사별 prep 본문을 inventory에 포함하지 않는다.
- helper는 config override를 적용하지 않는다.
  override 적용은 caller phase에서 처리한다.
- 기존 helper가 충분하면 확장하고, 중복 helper를 새로 만들지 않는다.

## 금지 범위

- config 파일 삭제 또는 축소.
- study-topic-recommender 추천 알고리즘 migration.
- skill reader migration.
- docs/ADR/정책 문서 수정.
- `sources/fos-study/` 문서 수정 또는 발행.
- `public/question-bank/` 질문 내용 수정.
- unrelated dirty 변경 revert, stage, commit, push.
- 새 산출물에 금지 표현 사용.

## 검증 명령

보고 직전 가능한 범위에서 실행하고 raw 결과를 남긴다.

```bash
cd "$(git rev-parse --show-toplevel)"
git status --short

test -f tasks/plan068-config-diet/reader-inventory.md

bun --check scripts/study-topic-recommender/fos_study_inventory.ts
if test -f scripts/question-bank-collector/validate.ts; then
  bun --check scripts/question-bank-collector/validate.ts
fi

find sources/fos-study -path '*/.git/*' -prune -o -path '*/.claude/*' -prune -o -name '*.md' -type f -print \
  | wc -l \
  | xargs printf "[fos-study markdown count] %s\n"

if test -d public/question-bank; then
  find public/question-bank -type f | sort | wc -l | xargs printf "[question-bank file count] %s\n"
fi

rg -n "sourceOfTruth|fos-study|public/question-bank|questionBank|question-bank|inventory" \
  scripts/study-topic-recommender scripts/question-bank-collector public/question-bank \
  | tee /tmp/plan068-phase02-inventory-refs.txt

rg -n "candidate-profile|data/private|data/applications|private/" \
  scripts/study-topic-recommender scripts/question-bank-collector \
  | tee /tmp/plan068-phase02-private-review.txt || true

rg -n "smo""ke" tasks/plan068-config-diet scripts/study-topic-recommender scripts/question-bank-collector && exit 1 || true
git diff --check
```

`private-review` 결과는 경계 문구나 명시적 제외 처리일 수 있다.
본문을 inventory에 포함하는 코드가 있으면 실패로 본다.

## 성공 기준

- fos-study inventory helper가 실제 markdown tree를 기준으로 inventory를 만들 수 있다.
- public question bank inventory가 validator 또는 scan 결과에서 파생된다.
- `.git/**`, `.claude/**`, private 자료가 inventory에서 제외된다.
- helper는 config 대량 topic JSON을 정본으로 요구하지 않는다.
- 기존 study-topic-recommender helper와 중복되는 새 구현이 생기지 않는다.
- TypeScript check 또는 동등한 실행 확인이 통과한다.
- 새 산출물에 금지 표현이 없다.

## 민감 정보 경계

- inventory item에는 public-safe path와 메타데이터만 담는다.
- candidate-profile, private 지원 패키지, 회사별 prep 본문은 읽거나 복사하지 않는다.
- public/question-bank helper는 private 답변, 지원 전략, 회사별 비공개 맥락을 결과에 포함하지 않는다.

## HUD 갱신 지점

모든 HUD 갱신은 `session_status`와 subagent 목록을 먼저 확인한 뒤 `/home/bifos/.openclaw/workspace-career/scripts/task-hud/update_from_session_status.ts`로 full snapshot 갱신한다.
`update_event.ts` 같은 부분 갱신 경로를 쓰지 않는다.

- Phase 02 시작: `implementation running`
- Phase 02 완료: `implementation running`
- Phase 02 실패: `implementation failed`
- Phase 02 보류: `implementation blocked`

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- Phase 01 reader inventory가 없거나 대상 reader 분류가 비어 있다.
- 기존 helper 구조가 docs 계약과 충돌해 docs/ADR 수정 없이는 진행할 수 없다.
- public/question-bank validator 또는 schema가 없어 inventory 계약을 안전하게 정할 수 없다.
- private 자료를 읽지 않으면 helper 구현이 불가능하다.
- 동일 파일에 기존 dirty 변경이 있어 사용자 변경과 phase 변경을 구분할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- config 대량 topic JSON을 새 helper의 정본으로 만든다.
- helper가 private 본문, candidate profile 본문, 회사별 prep 본문을 inventory에 포함한다.
- sources/fos-study 문서를 수정하거나 발행한다.
- public/question-bank 질문 내용을 임의 수정한다.
- docs/ADR/정책 문서를 임의 수정한다.
- 새 산출물에 금지 표현을 남긴다.
- unrelated dirty 변경을 revert, stage, commit, push한다.
