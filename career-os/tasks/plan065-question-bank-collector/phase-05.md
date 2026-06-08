# Phase 05 — 검증/build/static privacy grep/HUD 완료

**Model**: haiku
**Status**: completed

## 목표

plan065 산출물이 schema, skill trigger, validator, privacy boundary를 통과하는지 검증한다.

모든 phase 결과를 task 상태에 정리하고, implementation 완료/실패/보류 HUD event를 남긴다.

## 범위

- `public/question-bank/` 파일 구조 검증.
- 필수 자연어 trigger 6개 검증.
- normalizer/validator 또는 정적 검증 실행.
- public/private privacy grep.
- fos-study 자동 발행이나 sources/fos-study 변경이 없었는지 확인.
- dashboard/request button 연동을 구현했다면 관련 build/test 실행.
- task `index.json` 완료 상태와 검증 결과 정리.
- HUD implementation completed/failed/blocked 갱신.

## 비범위

- 새 질문 대량 생성.
- 새 dashboard 기능 구현.
- docs/ADR/정책 문서 수정.
- public question bank를 fos-study 글로 발행.
- commit, push, PR 생성.

## 중요 지침

이 phase는 verification phase다.

docs-first 반영은 이미 완료됐다.
`docs/`, ADR, 정책 문서를 임의 수정하지 않는다.

검증 중 계약 부족이나 privacy boundary 의심이 발견되면 추측으로 완료하지 말고 `PHASE_BLOCKED`로 보고한다.

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
- `tasks/plan065-question-bank-collector/phase-01.md`
- `tasks/plan065-question-bank-collector/phase-02.md`
- `tasks/plan065-question-bank-collector/phase-03.md`
- `tasks/plan065-question-bank-collector/phase-04.md`
- `public/question-bank/README.md`
- `.claude/skills/question-bank-collector/SKILL.md`
- OpenClaw workspace `question-bank-collector/SKILL.md`가 있으면 해당 파일
- `scripts/question-bank-collector/validate.ts`가 있으면 해당 파일

## 작업 절차

1. intended files와 dirty state를 확인한다.
2. public/question-bank 구조와 seed 파일 수를 검증한다.
3. 필수 trigger 6개가 skill에 모두 존재하는지 확인한다.
4. validator가 있으면 실행한다.
   - 없으면 Phase 03 보고 사유를 확인하고 정적 검증으로 대체한다.
5. privacy/static grep을 실행한다.
   - public bank에 private 답변, 지원 전략, 회사별 비공개 맥락, 개인 이력 세부사항이 없는지 사람이 review한다.
6. sources/fos-study 변경이 없는지 확인한다.
7. dashboard/request button 연동을 구현했다면 해당 repo의 build/test를 실행한다.
8. career-os task `index.json`에 verification 결과와 완료 상태를 기록한다.
9. HUD를 implementation completed로 갱신한다.
   - 실패 시 implementation failed.
   - 보류 시 implementation blocked.

## 검증 명령

보고 직전 반드시 아래 bash 블록을 실행하고 raw count를 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
git status --short

test -f public/question-bank/README.md
for dir in java-spring database cs operations system-design; do
  test -d "public/question-bank/$dir"
done

find public/question-bank -type f | sort | tee /tmp/plan065-phase05-bank-files.txt
BANK_FILE_COUNT=$(wc -l </tmp/plan065-phase05-bank-files.txt)
echo "[bank files] $BANK_FILE_COUNT"
test "$BANK_FILE_COUNT" -ge 6

for phrase in \
  "일반 backend 질문" \
  "CS 질문 수집" \
  "면접 질문 bank" \
  "질문 뱅크 보강" \
  "약점 기반 질문 재선별" \
  "Java/Spring/DB/운영 질문 모아줘"; do
  rg -n "$phrase" .claude/skills/question-bank-collector ~/.openclaw/workspace-career/skills/question-bank-collector 2>/dev/null
done | tee /tmp/plan065-phase05-trigger-refs.txt
TRIGGER_REF_COUNT=$(wc -l </tmp/plan065-phase05-trigger-refs.txt)
echo "[trigger refs] $TRIGGER_REF_COUNT"
test "$TRIGGER_REF_COUNT" -ge 6

if test -f scripts/question-bank-collector/validate.ts; then
  bun scripts/question-bank-collector/validate.ts
else
  echo "[validator] scripts/question-bank-collector/validate.ts not present; using static checks only"
fi

rg -n "지원 전략|회사별 비공개|답변 전문|개인 이력|유료 강의 원문|문제집 원문|면접 후기 원문|합격 후기 원문" \
  public/question-bank \
  | tee /tmp/plan065-phase05-public-sensitive-review.txt || true
PUBLIC_SENSITIVE_REVIEW_COUNT=$(wc -l </tmp/plan065-phase05-public-sensitive-review.txt)
echo "[public sensitive review refs] $PUBLIC_SENSITIVE_REVIEW_COUNT"

git status --short sources/fos-study
git diff --check
```

dashboard/request button 연동을 구현한 경우 추가 실행한다.

```bash
cd ~/services/fos-career
git status --short
npm run build
git diff --check
```

HUD 갱신 예시:

```bash
cd ~/.openclaw/workspace-career
bun scripts/task-hud/update_event.ts \
  --session discord-career-main \
  --task-label plan065-question-bank-collector \
  --event complete \
  --status completed \
  --target channel:1492521172099666021
```

## 성공 기준

- public/question-bank 구조와 seed 파일이 존재한다.
- 필수 trigger 6개가 skill에 모두 존재한다.
- validator 또는 정적 검증이 통과한다.
- public/question-bank에 private 답변, 지원 전략, 회사별 비공개 맥락, 유료 자료 원문 복사가 없다.
- sources/fos-study 변경이 없다.
- dashboard/request button 연동을 구현했다면 build/test가 통과한다.
- `index.json`에 완료 상태, 검증 명령, HUD 결과가 기록된다.
- implementation completed/failed/blocked HUD event가 남는다.

## common-pitfalls self-check

- 검증 명령을 실행하지 않고 success를 보고하지 않는다.
- raw count는 `wc -l` 출력으로 보고한다.
- docs/ADR/정책 문서는 수정하지 않는다.
- public/private privacy grep 결과를 사람이 review한다.
- fos-study 변경이 있으면 실패로 본다.
- task 완료 기록 외에 새 기능 구현을 하지 않는다.

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- privacy grep 결과가 금지 문구인지 실제 민감 정보인지 즉시 판별할 수 없다.
- dashboard/request button 연동이 구현됐지만 검증 명령을 결정할 수 없다.
- validator 부재 사유가 Phase 03에 없고 정적 검증만으로 충분한지 결정할 수 없다.
- docs/ADR/정책 문서 수정 없이는 완료 검증을 계속할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- 필수 trigger 6개 중 하나라도 누락한다.
- public/question-bank 구조가 없다.
- public/question-bank에 private 답변, 지원 전략, 회사별 비공개 맥락, 개인 이력 세부사항이 들어 있다.
- 유료 강의, 문제집, 면접 후기 원문을 복사했다.
- sources/fos-study가 수정됐다.
- docs/ADR/정책 문서를 임의 수정했다.
- apartment repo 변경을 수정, stage, revert했다.

## 실행 결과

- 완료 시각: 2026-06-08T18:18:45+09:00
- public/question-bank 파일 수 6개를 확인했다.
- 필수 trigger grep 결과는 25 refs다.
- `bun scripts/question-bank-collector/validate.ts`가 통과했다.
- sensitive grep 결과 19 refs는 README, skill, validator의 금지 문구로 분류했다.
- `git status --short sources/fos-study`는 출력이 없다.
- `git diff --check`가 통과했다.
- HUD complete event가 성공했다.
