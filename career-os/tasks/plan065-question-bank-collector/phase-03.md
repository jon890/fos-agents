# Phase 03 — normalizer/validator 구현과 seed 질문 생성

**Model**: sonnet
**Status**: pending

## 목표

question bank 항목을 반복 보강할 수 있도록 normalizer/validator를 만든다.

seed 질문은 공개 가능한 일반 backend/CS 지식만 사용해 생성하고, private 정보나 원문 복사를 배제한다.

## 범위

- 필요 시 `scripts/question-bank-collector/` 아래 TypeScript normalizer/validator 생성.
- package script 추가가 필요하면 기존 Bun/TypeScript 패턴을 따른다.
- `public/question-bank/` seed 질문을 카테고리별로 보강.
- 항목 중복, 필수 필드, 태그, 난이도, private 금지어, 원문 복사 위험 문구를 검증.
- validator 실행 방법을 skill 또는 README에 연결.

## 비범위

- dashboard 버튼 또는 request processor 연동.
- private prep.md 실제 선별 반영.
- 외부 웹 크롤링 자동화.
- 유료 강의/문제집/면접 후기 원문 수집.
- docs/ADR/정책 문서 수정.
- fos-study 자동 발행.
- commit, push, PR 생성.

## 중요 지침

이 phase는 implementation phase다.

docs-first 반영은 이미 완료됐다.
`docs/`, ADR, 정책 문서를 임의 수정하지 않는다.

validator 계약이 docs와 맞지 않거나 새 데이터 스키마 결정이 필요하면 `PHASE_BLOCKED`로 멈춘다.

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
git status --short
```

## 관련 파일

실행 전 반드시 읽는다.

- `tasks/plan065-question-bank-collector/index.json`
- `public/question-bank/README.md`
- `public/question-bank/**`
- `.claude/skills/question-bank-collector/SKILL.md`
- `docs/data-schema.md`의 public/question-bank schema
- 기존 `scripts/*` TypeScript validator 또는 schema helper 예시
- `package.json` 또는 repo root runtime 설정 파일이 있으면 해당 파일

## 작업 절차

1. Phase 01 seed 구조와 docs schema를 비교한다.
2. normalizer/validator가 필요한지 판단한다.
   - seed가 markdown만으로 충분하고 docs가 script를 요구하지 않으면 validator 없이 grep 기반 검증을 강화해도 된다.
   - docs 또는 skill이 script를 요구하면 `scripts/question-bank-collector/`에 구현한다.
3. TypeScript validator를 구현하는 경우 다음을 확인한다.
   - 카테고리 디렉터리 존재.
   - 항목별 필수 필드 존재.
   - 중복 id 또는 중복 질문 탐지.
   - private 금지어 탐지.
   - source/copyright 금지 문구 탐지.
4. seed 질문을 카테고리별로 보강한다.
   - Java/Spring
   - DB/JPA/MyBatis/Redis/cache
   - CS(Network/OS/자료구조/알고리즘 기초)
   - 운영/장애/관측성
   - System design/backend architecture
5. README 또는 skill에 validator 실행 명령을 연결한다.

## 검증 명령

보고 직전 반드시 아래 bash 블록을 실행하고 raw count를 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
git status --short

find public/question-bank -type f | sort | tee /tmp/plan065-phase03-bank-files.txt
BANK_FILE_COUNT=$(wc -l </tmp/plan065-phase03-bank-files.txt)
echo "[bank files] $BANK_FILE_COUNT"
test "$BANK_FILE_COUNT" -ge 6

rg -n "question:|질문|follow-up|follow up|평가 포인트|weakness|tag|difficulty|난이도" \
  public/question-bank \
  | tee /tmp/plan065-phase03-question-refs.txt
QUESTION_REF_COUNT=$(wc -l </tmp/plan065-phase03-question-refs.txt)
echo "[question refs] $QUESTION_REF_COUNT"
test "$QUESTION_REF_COUNT" -ge 25

if test -f scripts/question-bank-collector/validate.ts; then
  bun scripts/question-bank-collector/validate.ts
else
  echo "[validator] scripts/question-bank-collector/validate.ts not present; using static checks only"
fi

rg -n "지원 전략|회사별 비공개|답변 전문|개인 이력|유료 강의 원문|문제집 원문|면접 후기 원문|합격 후기 원문" \
  public/question-bank scripts/question-bank-collector .claude/skills/question-bank-collector \
  | tee /tmp/plan065-phase03-sensitive-review.txt || true
SENSITIVE_REVIEW_COUNT=$(wc -l </tmp/plan065-phase03-sensitive-review.txt)
echo "[sensitive review refs] $SENSITIVE_REVIEW_COUNT"

git diff --check
```

`SENSITIVE_REVIEW_COUNT`는 금지 문구 때문에 0이 아닐 수 있다.
금지 문구가 아니라 실제 private 내용이면 실패로 본다.

## 성공 기준

- seed 질문이 5개 카테고리에 고르게 존재한다.
- validator를 만든 경우 `bun scripts/question-bank-collector/validate.ts`가 통과한다.
- validator를 만들지 않은 경우 정적 검증과 README/skill 지침으로 반복 보강 방법이 충분히 설명된다.
- public/question-bank에 private 답변, 지원 전략, 회사별 비공개 맥락, 유료 자료 원문 복사가 없다.
- `git diff --check`가 통과한다.

## common-pitfalls self-check

- 첫 bash 블록에 `cd "$(git rev-parse --show-toplevel)"`가 있다.
- 수치 보고는 `wc -l` raw count만 사용한다.
- validator가 없으면 그 이유와 대체 검증을 보고한다.
- docs/ADR/정책 문서는 수정하지 않는다.
- 공개 seed 질문은 직접 재작성한 일반 지식이어야 한다.
- fos-study 자동 발행을 하지 않는다.

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- docs/data-schema와 Phase 01 seed 구조가 충돌한다.
- validator 구현에 새 스키마 결정이 필요하다.
- 공개 seed 보강에 사용할 수 있는 안전한 일반 지식 범위를 결정할 수 없다.
- docs/ADR/정책 문서 수정 없이는 진행할 수 없다.
- 기존 dirty 변경이 같은 파일에서 충돌해 의도한 변경과 사용자 변경을 구분할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- validator가 private 정보나 원문 복사 위험을 허용한다.
- public/question-bank에 private 답변, 지원 전략, 회사별 비공개 맥락을 넣는다.
- 유료 강의, 문제집, 면접 후기 원문을 복사한다.
- seed 질문을 `data/`에 만든다.
- docs/ADR/정책 문서를 임의 수정한다.
- apartment repo 변경을 수정, stage, revert한다.
