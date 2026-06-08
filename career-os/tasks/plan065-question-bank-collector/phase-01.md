# Phase 01 — public/question-bank schema/seed/README와 private boundary

**Model**: sonnet
**Status**: pending

## 목표

일반 backend/CS 면접 질문 bank의 공개 저장 구조를 만든다.

`public/question-bank/` 아래에 schema, README, 카테고리 seed 파일을 추가하고, private 경계를 파일 구조와 문서 문구에 명확히 남긴다.

## 범위

- `public/question-bank/README.md` 생성.
- `public/question-bank/{java-spring,database,cs,operations,system-design}/` 생성.
- 각 카테고리에 seed markdown 또는 JSON 파일 생성.
- 질문 항목의 기본 필드와 작성 규칙 정의.
- public bank와 `private/<company>/<position>/interview/prep.md`의 책임 분리 명시.
- private 답변, 지원 전략, 회사별 비공개 맥락, 개인 이력 세부사항 금지 문구 추가.
- 유료 강의, 문제집, 면접 후기 원문 복사 금지 문구 추가.

## 비범위

- question-bank-collector skill 생성.
- normalizer/validator 구현.
- dashboard 버튼 또는 request processor 연동.
- `private/<company>/<position>/interview/prep.md` 실제 반영.
- `docs/`, ADR, `AGENTS.md`, `TOOLS.md` 수정.
- fos-study 자동 발행.
- commit, push, PR 생성.

## 중요 지침

이 phase는 implementation phase다.

docs-first 반영은 이미 완료됐다.
`docs/`, ADR, 정책 문서를 임의 수정하지 않는다.

계약이 부족하거나 공개/비공개 경계가 불명확하면 추측으로 진행하지 말고 `PHASE_BLOCKED`로 멈춘다.

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
git status --short
```

## 관련 파일

실행 전 반드시 읽는다.

- `docs/adr.md`의 ADR-066
- `docs/prd.md`의 question bank 관련 범위
- `docs/data-schema.md`의 public/question-bank 경계
- `docs/flow.md`의 question bank 흐름
- `docs/code-architecture.md`의 skill/scripts/public layer 책임
- `tasks/plan065-question-bank-collector/index.json`

## 작업 절차

1. ADR-066과 5문서에서 `public/question-bank/` 계약을 확인한다.
2. `public/question-bank/README.md`를 작성한다.
   - 목적, 카테고리, 항목 형식, 금지 자료, private 반영 경계를 포함한다.
3. 카테고리 디렉터리를 만든다.
   - `java-spring`
   - `database`
   - `cs`
   - `operations`
   - `system-design`
4. 각 카테고리에 최소 seed 파일을 만든다.
   - 질문은 공개 가능한 일반 지식으로 직접 재작성한다.
   - 답변 전문 대신 평가 포인트, follow-up 후보, 약점 태그 중심으로 둔다.
5. private boundary grep에 걸릴 만한 회사명, 지원 전략, 개인 이력 세부사항이 없는지 확인한다.

## 검증 명령

보고 직전 반드시 아래 bash 블록을 실행하고 raw count를 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
git status --short

test -f public/question-bank/README.md
for dir in java-spring database cs operations system-design; do
  test -d "public/question-bank/$dir"
done

find public/question-bank -maxdepth 2 -type f | sort | tee /tmp/plan065-phase01-files.txt
QUESTION_BANK_FILE_COUNT=$(wc -l </tmp/plan065-phase01-files.txt)
echo "[question bank files] $QUESTION_BANK_FILE_COUNT"
test "$QUESTION_BANK_FILE_COUNT" -ge 6

rg -n "private/|지원 전략|회사별|비공개|유료 강의|문제집|면접 후기 원문|fos-study 자동" \
  public/question-bank \
  | tee /tmp/plan065-phase01-boundary-refs.txt
BOUNDARY_REF_COUNT=$(wc -l </tmp/plan065-phase01-boundary-refs.txt)
echo "[boundary refs] $BOUNDARY_REF_COUNT"
test "$BOUNDARY_REF_COUNT" -gt 0

rg -n "지원 전략|회사별 비공개|답변 전문|개인 이력|내 경력|합격 후기 원문" \
  public/question-bank \
  | tee /tmp/plan065-phase01-sensitive-review.txt || true
SENSITIVE_REVIEW_COUNT=$(wc -l </tmp/plan065-phase01-sensitive-review.txt)
echo "[sensitive review refs] $SENSITIVE_REVIEW_COUNT"

git diff --check
```

`SENSITIVE_REVIEW_COUNT`는 README의 금지 문구 때문에 0이 아닐 수 있다.
금지 문구가 아니라 실제 private 내용이면 실패로 본다.

## 성공 기준

- `public/question-bank/README.md`가 존재한다.
- 5개 카테고리 디렉터리가 존재한다.
- 각 카테고리에 공개 가능한 seed 질문 파일이 있다.
- public bank와 private prep.md 책임 분리가 README에 명확하다.
- public 파일에 private 답변, 지원 전략, 회사별 비공개 맥락, 유료 자료 원문 복사가 없다.
- `git diff --check`가 통과한다.

## common-pitfalls self-check

- 첫 bash 블록에 `cd "$(git rev-parse --show-toplevel)"`가 있다.
- 수치 보고는 `wc -l` raw count만 사용한다.
- docs/ADR/정책 문서는 수정하지 않는다.
- public/question-bank에는 private 답변이나 회사별 전략을 넣지 않는다.
- 유료 강의/문제집/면접 후기 원문을 복사하지 않는다.
- fos-study 자동 발행을 하지 않는다.

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- ADR-066 또는 5문서만으로 question bank 항목 형식을 결정할 수 없다.
- public/question-bank에 넣을 수 있는 공개 seed 범위와 private prep.md 범위를 구분할 수 없다.
- seed 질문 작성에 유료 자료나 원문 복사가 필요하다.
- docs/ADR/정책 문서 수정 없이는 진행할 수 없다.
- 기존 dirty 변경이 같은 파일에서 충돌해 의도한 변경과 사용자 변경을 구분할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- `public/question-bank/` 대신 `data/`에 일반 질문 bank를 만든다.
- public/question-bank에 private 답변, 지원 전략, 회사별 비공개 맥락, 개인 이력 세부사항을 넣는다.
- 유료 강의, 문제집, 면접 후기 원문을 복사한다.
- fos-study에 자동 발행하거나 sources/fos-study를 수정한다.
- docs/ADR/정책 문서를 임의 수정한다.
- apartment repo 변경을 수정, stage, revert한다.
