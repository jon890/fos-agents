# Phase 02 — question-bank-collector skill 생성 및 자연어 trigger 강화

**Model**: sonnet
**Status**: pending

## 목표

OpenClaw와 Claude native 양쪽에서 `question-bank-collector` skill이 자연어 요청을 잘 잡히도록 만든다.

필수 trigger 문구를 skill description과 사용 규칙에 강하게 넣고, public bank와 private prep.md 경계를 skill 지침으로 고정한다.

## 범위

- `.claude/skills/question-bank-collector/SKILL.md` 생성.
- OpenClaw workspace skill 위치가 존재하면 그 위치에도 `question-bank-collector/SKILL.md` 생성 또는 동기화.
- skill description에 필수 자연어 trigger 6개 반영.
- public/question-bank 수집, 정규화, seed 보강, 약점 기반 재선별 흐름 작성.
- private/<company>/<position>/interview/prep.md 선별 반영은 별도 명시 요청 또는 Phase 04 계약을 따르도록 제한.
- public/private boundary, 저작권 금지, fos-study 자동 발행 금지 문구 추가.

## 비범위

- normalizer/validator 구현.
- 질문 seed 대량 생성.
- dashboard 버튼 또는 processor 구현.
- docs/ADR/정책 문서 수정.
- OpenClaw 플러그인 설치 또는 외부 tool 설치.
- commit, push, PR 생성.

## 중요 지침

이 phase는 implementation phase다.

docs-first 반영은 이미 완료됐다.
`docs/`, ADR, 정책 문서를 임의 수정하지 않는다.

OpenClaw workspace skill 위치가 확정되지 않았거나 현재 workspace 구조와 충돌하면 추측으로 만들지 말고 `PHASE_BLOCKED`로 보고한다.

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
git status --short
```

## 관련 파일

실행 전 반드시 읽는다.

- `tasks/plan065-question-bank-collector/index.json`
- `docs/adr.md`의 ADR-066
- `docs/code-architecture.md`의 skill 위치와 책임
- `.claude/skills/*/SKILL.md` 중 최근 native skill 1-2개
- OpenClaw workspace skill 위치 후보가 있으면 해당 디렉터리의 기존 skill 예시

## 작업 절차

1. 현재 career-os native skill 구조를 확인한다.
2. OpenClaw workspace skill 위치를 확인한다.
   - 후보: `.openclaw/workspace-career/skills/question-bank-collector/SKILL.md`
   - 실제 위치가 다르면 기존 workspace skill 구조를 우선한다.
3. `.claude/skills/question-bank-collector/SKILL.md`를 작성한다.
4. OpenClaw skill 위치가 확인되면 같은 trigger와 boundary를 담은 `SKILL.md`를 작성한다.
5. skill description 또는 초반 trigger 섹션에 아래 문구를 모두 그대로 포함한다.
   - “일반 backend 질문”
   - “CS 질문 수집”
   - “면접 질문 bank”
   - “질문 뱅크 보강”
   - “약점 기반 질문 재선별”
   - “Java/Spring/DB/운영 질문 모아줘”
6. skill 본문에 금지선을 명시한다.
   - public/question-bank에는 private 답변, 지원 전략, 회사별 비공개 맥락 금지.
   - 유료 강의/문제집/면접 후기 원문 복사 금지.
   - fos-study 자동 발행 금지.

## 검증 명령

보고 직전 반드시 아래 bash 블록을 실행하고 raw count를 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
git status --short

test -f .claude/skills/question-bank-collector/SKILL.md

for phrase in \
  "일반 backend 질문" \
  "CS 질문 수집" \
  "면접 질문 bank" \
  "질문 뱅크 보강" \
  "약점 기반 질문 재선별" \
  "Java/Spring/DB/운영 질문 모아줘"; do
  rg -n "$phrase" .claude/skills/question-bank-collector ~/.openclaw/workspace-career/skills/question-bank-collector 2>/dev/null
done | tee /tmp/plan065-phase02-trigger-refs.txt
TRIGGER_REF_COUNT=$(wc -l </tmp/plan065-phase02-trigger-refs.txt)
echo "[trigger refs] $TRIGGER_REF_COUNT"
test "$TRIGGER_REF_COUNT" -ge 6

rg -n "public/question-bank|private/.*/.*/interview/prep.md|private 답변|지원 전략|회사별 비공개|유료 강의|문제집|면접 후기 원문|fos-study 자동" \
  .claude/skills/question-bank-collector ~/.openclaw/workspace-career/skills/question-bank-collector 2>/dev/null \
  | tee /tmp/plan065-phase02-boundary-refs.txt
BOUNDARY_REF_COUNT=$(wc -l </tmp/plan065-phase02-boundary-refs.txt)
echo "[skill boundary refs] $BOUNDARY_REF_COUNT"
test "$BOUNDARY_REF_COUNT" -gt 0

git diff --check
```

OpenClaw workspace skill 위치가 존재하지 않아 생성하지 않았다면, 그 사유를 보고한다.
단, Claude native `.claude/skills/question-bank-collector/SKILL.md`는 반드시 존재해야 한다.

## 성공 기준

- Claude native `question-bank-collector` skill이 생성된다.
- OpenClaw workspace skill 위치가 확인된 경우 해당 skill도 생성된다.
- 필수 trigger 6개가 skill description 또는 trigger 섹션에 모두 들어간다.
- public/private boundary와 저작권 금지선이 skill 지침에 들어간다.
- skill은 fos-study 자동 발행을 금지한다.
- `git diff --check`가 통과한다.

## common-pitfalls self-check

- 첫 bash 블록에 `cd "$(git rev-parse --show-toplevel)"`가 있다.
- trigger 문구는 paraphrase하지 않고 그대로 포함한다.
- `.claude/skills`와 OpenClaw skill 위치를 혼동하지 않는다.
- docs/ADR/정책 문서는 수정하지 않는다.
- plugin install, external publish, fos-study 수정은 하지 않는다.

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- OpenClaw workspace skill 위치가 불명확하고 생성 여부 결정이 필요하다.
- 기존 skill 구조가 ADR-066과 충돌한다.
- 필수 trigger를 description에 넣을 수 없는 skill manifest 제약이 있다.
- docs/ADR/정책 문서 수정 없이는 진행할 수 없다.
- 기존 dirty 변경이 같은 파일에서 충돌해 의도한 변경과 사용자 변경을 구분할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- 필수 trigger 6개 중 하나라도 누락한다.
- public bank skill이 private 답변이나 회사별 지원 전략을 public/question-bank에 쓰도록 지시한다.
- 유료 자료나 면접 후기 원문 복사를 허용한다.
- fos-study 자동 발행을 허용한다.
- docs/ADR/정책 문서를 임의 수정한다.
- apartment repo 변경을 수정, stage, revert한다.
