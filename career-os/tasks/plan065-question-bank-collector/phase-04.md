# Phase 04 — prep.md 선별 반영 또는 request button 연동 여부 확인

**Model**: sonnet
**Status**: pending

## 목표

public question bank를 포지션 맞춤 면접 준비 파일로 선별 반영하는 최소 경로를 확인한다.

dashboard 버튼 또는 interview request processor 연동이 이번 plan 범위인지 확인하고, 결정이 부족하면 구현하지 않고 후속 범위로 보고한다.

## 범위

- `private/<company>/<position>/interview/prep.md` 구조 확인.
- public bank에서 private prep.md로 질문을 선별 반영하는 수동 또는 script 경로 확인.
- 약점 기반 질문 재선별 입력으로 쓸 tag/difficulty/source category가 충분한지 확인.
- dashboard 버튼 또는 request processor 연동 가능성을 조사.
- 이번 plan에서 연동 구현이 docs/ADR로 충분히 확정됐는지 판정.
- 확정된 경우에만 좁은 범위의 연결 또는 request payload 계약을 구현.
- 불명확하면 `PHASE_BLOCKED` 또는 후속 plan 후보로 보고.

## 비범위

- 공개 question bank 자체의 대량 보강.
- 민감한 private 답변을 public/question-bank에 역반영.
- docs/ADR/정책 문서 수정.
- dashboard 범용 chat UI/API 복구.
- fos-study 자동 발행.
- commit, push, PR 생성.

## 중요 지침

이 phase는 boundary and integration decision phase다.

docs-first 반영은 이미 완료됐다.
`docs/`, ADR, 정책 문서를 임의 수정하지 않는다.

dashboard 버튼이나 processor 연동 계약이 docs/ADR에 충분히 없으면 구현하지 않는다.
추측 구현 대신 `PHASE_BLOCKED`로 보고하거나, 후속 plan 후보를 task result에 남긴다.

private prep.md에 선별 반영할 때도 민감한 답변 전문이나 회사별 전략을 public/question-bank로 복사하지 않는다.

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
git status --short
git -C ~/services/fos-career status --short 2>/dev/null || true
```

## 관련 파일

실행 전 반드시 읽는다.

- `tasks/plan065-question-bank-collector/index.json`
- `public/question-bank/README.md`
- `public/question-bank/**`
- `.claude/skills/question-bank-collector/SKILL.md`
- `docs/flow.md`의 question bank와 interview prep 흐름
- `docs/data-schema.md`의 public/private 경계
- 존재하는 `private/*/*/interview/prep.md` 예시
- `~/services/fos-career`가 존재하면 request button 또는 interview processor 관련 파일

## 작업 절차

1. private prep.md 파일 구조를 확인한다.
   - 존재하지 않으면 sample 경로를 만들지 말고 보고한다.
2. public question bank의 tag/difficulty/category가 약점 기반 선별에 충분한지 확인한다.
3. private prep.md에 선별 반영할 수 있는 최소 수동 절차 또는 script 후보를 정리한다.
4. dashboard 버튼 또는 request processor 연동 문서 계약을 확인한다.
   - docs/ADR가 충분하면 좁은 범위로 구현한다.
   - 계약이 부족하면 구현하지 않고 `PHASE_BLOCKED` 또는 후속 plan으로 보고한다.
5. private prep.md에 실제 반영하는 경우, public bank에서 질문 제목과 평가 포인트만 가져오고 회사별 전략과 답변 전문은 private 파일 안에서만 유지한다.
6. public/question-bank로 private 내용을 역복사하지 않았는지 확인한다.

## 검증 명령

보고 직전 반드시 아래 bash 블록을 실행하고 raw count를 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
git status --short

find private -path '*/interview/prep.md' -type f 2>/dev/null | sort | tee /tmp/plan065-phase04-prep-files.txt || true
PREP_FILE_COUNT=$(wc -l </tmp/plan065-phase04-prep-files.txt)
echo "[prep files] $PREP_FILE_COUNT"

rg -n "question-bank|질문 뱅크|면접 질문 bank|약점 기반|public/question-bank|answer_feedback|request" \
  docs public/question-bank .claude/skills/question-bank-collector scripts private ~/services/fos-career/app ~/services/fos-career/lib ~/services/fos-career/scripts 2>/dev/null \
  | tee /tmp/plan065-phase04-integration-refs.txt || true
INTEGRATION_REF_COUNT=$(wc -l </tmp/plan065-phase04-integration-refs.txt)
echo "[integration refs] $INTEGRATION_REF_COUNT"

rg -n "지원 전략|회사별 비공개|답변 전문|개인 이력|합격 후기 원문|면접 후기 원문" \
  public/question-bank \
  | tee /tmp/plan065-phase04-public-sensitive-review.txt || true
PUBLIC_SENSITIVE_REVIEW_COUNT=$(wc -l </tmp/plan065-phase04-public-sensitive-review.txt)
echo "[public sensitive review refs] $PUBLIC_SENSITIVE_REVIEW_COUNT"

if test -d ~/services/fos-career; then
  git -C ~/services/fos-career status --short
  git -C ~/services/fos-career diff --check
fi

git diff --check
```

`PUBLIC_SENSITIVE_REVIEW_COUNT`는 README의 금지 문구 때문에 0이 아닐 수 있다.
금지 문구가 아니라 실제 private 내용이면 실패로 본다.

## 성공 기준

- private prep.md 반영 경로가 확인된다.
- public bank의 약점 기반 선별 필드가 충분한지 판단된다.
- dashboard 버튼 또는 processor 연동을 이번 plan에서 구현할지 후속으로 둘지 명확히 보고된다.
- 구현한 경우 docs/ADR 계약 안의 좁은 범위만 바뀐다.
- 계약이 부족한 경우 구현 없이 `PHASE_BLOCKED` 또는 후속 plan 후보로 남긴다.
- public/question-bank로 private 내용이 역유출되지 않는다.
- `git diff --check`가 통과한다.

## common-pitfalls self-check

- 첫 bash 블록에 `cd "$(git rev-parse --show-toplevel)"`가 있다.
- dashboard 연동을 docs 계약 없이 추측 구현하지 않는다.
- private prep.md의 답변 전문이나 회사별 전략을 public으로 복사하지 않는다.
- 범용 chat UI/API를 되살리지 않는다.
- docs/ADR/정책 문서는 수정하지 않는다.
- fos-study 자동 발행을 하지 않는다.

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- private prep.md 경로 또는 형식이 존재하지 않아 선별 반영 계약을 확인할 수 없다.
- dashboard 버튼 또는 processor 연동 여부가 docs/ADR에 충분히 결정되어 있지 않다.
- 약점 기반 재선별 기준이 없어 새 결정이 필요하다.
- docs/ADR/정책 문서 수정 없이는 진행할 수 없다.
- fos-career dirty 변경이 같은 파일에서 충돌해 의도한 변경과 사용자 변경을 구분할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- private prep.md 내용을 public/question-bank에 역복사한다.
- public/question-bank에 private 답변, 지원 전략, 회사별 비공개 맥락을 넣는다.
- dashboard 범용 chat UI/API를 되살린다.
- docs/ADR/정책 문서를 임의 수정한다.
- fos-study에 자동 발행하거나 sources/fos-study를 수정한다.
- apartment repo 변경을 수정, stage, revert한다.
