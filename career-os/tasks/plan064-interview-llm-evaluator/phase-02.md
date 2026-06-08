# Phase 02 — processor answer_feedback 연동과 fallback

**Model**: sonnet
**Status**: pending

## 목표

`answer_feedback` request 처리에서 답변 제출 직후 evaluator가 실행되도록 processor를 연결한다.

guard 통과 답변은 career context bundle로 LLM evaluator를 호출하고, guard/fallback 결과는 private DB feedback 필드에 저장한다.

## 범위

- `~/services/fos-career/scripts/process-interview-requests.ts`의 `answer_feedback` 처리 확장.
- 답변 제출 후 생성된 pending request가 evaluator path를 타는지 확인.
- deterministic guard 결과를 DB에 저장.
- 정상 답변의 LLM evaluator 호출 연결.
- JSON parse failure fallback 저장.
- provider disabled fallback 저장.
- evaluator call failure fallback 저장.
- 기존 `feedbackBody`, score fields, `followUpQuestion`, `improvementTopicsJson`, `studyPackCandidatesJson` 우선 활용.
- 꼭 필요한 경우에만 non-destructive DB column 추가.
- smoke test 또는 self-test path 추가.

## 비범위

- dashboard UI의 큰 변경.
- 별도 AI feedback button 추가.
- 범용 chat API/UI 복구.
- career-os docs/ADR/정책 문서 수정.
- systemd timer 주기 변경.
- 한 번에 pending 1건 처리 원칙 변경.
- 외부 제출, 공개 발행, candidate-profile 자동 수정.
- commit, push, PR 생성.

## 중요 지침

이 phase는 implementation phase다.

`career-os/docs/`, `AGENTS.md`, `TOOLS.md`, ADR, 정책 문서를 수정하지 않는다.

계약이 부족하거나 schema 변경 필요성이 docs와 충돌하면 `PHASE_BLOCKED`로 멈춘다.

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
git -C career-os status --short
git -C ~/services/fos-career status --short
```

## 관련 파일

실행 전 반드시 읽는다.

- `career-os/docs/adr.md`의 ADR-065
- `career-os/docs/flow.md`의 interview request processor와 systemd timer 설명
- `career-os/docs/data-schema.md`의 answer/feedback/request payload 경계
- `~/services/fos-career/scripts/process-interview-requests.ts`
- `~/services/fos-career/scripts/run-interview-request-processor.sh`
- `~/services/fos-career/lib/interview/gateway.ts`
- `~/services/fos-career/lib/llm/*`
- `~/services/fos-career/db/schema.ts`
- `~/services/fos-career/package.json`

## 작업 절차

1. processor가 pending 1건을 처리하는 현재 흐름과 `answer_feedback` branch를 확인한다.
2. 답변 record에서 question과 answer body를 private DB 안에서 읽는다.
   - request row에는 answer body를 복사하지 않는다.
3. Phase 01 helper를 호출한다.
   - guard insufficient이면 LLM provider를 호출하지 않는다.
   - 정상 답변이면 career context bundle을 만든 뒤 evaluator를 호출한다.
4. evaluator 결과를 answer feedback storage에 저장한다.
   - 상세 feedback은 private DB의 feedback field에 저장한다.
   - request result에는 status, short summary, reason code, score summary만 저장한다.
5. 실패 경로를 정리한다.
   - JSON parse failure
   - provider disabled
   - provider error/timeout
   - context bundle load failure
6. smoke/self-test를 추가한다.
   - 짧은 답변 guard
   - JSON parse failure fallback
   - provider disabled fallback
   - 정상 evaluator mock path
7. schema 변경이 꼭 필요하면 additive migration 또는 non-destructive column만 사용한다.
   - 기존 필드로 충분하면 schema를 건드리지 않는다.

## 검증 명령

보고 직전 반드시 아래 bash 블록을 실행하고 raw count를 출력한다.

```bash
cd ~/services/fos-career
git status --short

rg -n "answer_feedback|feedbackBody|followUpQuestion|improvementTopicsJson|studyPackCandidatesJson|provider disabled|parse failure|insufficient" \
  scripts lib db tests app \
  -g '!**/node_modules/**' \
  -g '!**/.next/**' \
  | tee /tmp/plan064-phase02-feedback-refs.txt
FEEDBACK_REF_COUNT=$(wc -l </tmp/plan064-phase02-feedback-refs.txt)
echo "[feedback refs] $FEEDBACK_REF_COUNT"
test "$FEEDBACK_REF_COUNT" -gt 0

rg -n "answerText|answerBody|feedbackBody|full answer|detailed feedback|private context" \
  scripts lib app db \
  -g '!**/node_modules/**' \
  -g '!**/.next/**' \
  | tee /tmp/plan064-phase02-private-boundary-review.txt
PRIVATE_REVIEW_COUNT=$(wc -l </tmp/plan064-phase02-private-boundary-review.txt)
echo "[private boundary review refs] $PRIVATE_REVIEW_COUNT"

npx tsc --noEmit
npm run build
git diff --check
```

추가한 smoke/self-test 명령이 있으면 함께 실행한다.
예시는 아래와 같다.

```bash
cd ~/services/fos-career
npm run smoke:interview-evaluator
```

repo에 해당 script를 만들지 않았다면 package script를 강제로 추가하지 말고, 구현한 테스트 파일의 실제 실행 명령을 보고한다.

## 성공 기준

- `answer_feedback` request가 guard 또는 evaluator 결과를 private feedback storage에 저장한다.
- 짧거나 의미 없는 답변은 LLM 호출 없이 1/5 insufficient feedback으로 처리된다.
- 정상 답변은 career context bundle과 provider helper를 통해 evaluator를 호출한다.
- JSON parse failure, provider disabled, provider error가 fallback feedback으로 저장된다.
- request result/audit payload에는 본문 전문이나 상세 피드백 전문이 저장되지 않는다.
- 기존 systemd timer의 2분 주기와 pending 1건 처리 원칙을 바꾸지 않는다.
- TypeScript, build, smoke/self-test가 통과한다.

## common-pitfalls self-check

- phase가 이전 phase 대화 내용을 가정하지 않고 파일 경로와 helper 이름을 직접 확인한다.
- 수치 보고는 `wc -l` raw count만 사용한다.
- docs/ADR/정책 문서는 수정하지 않는다.
- 새 DB 변경이 있다면 additive/non-destructive인지 확인한다.
- request result에 private body가 들어가지 않는지 grep 결과를 사람이 review한다.
- `scripts/run-interview-request-processor.sh`와 systemd timer 주기를 임의 변경하지 않는다.

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- `answer_feedback` request와 answer record를 안전하게 연결할 식별자가 없다.
- 기존 DB field만으로 evaluator 결과를 저장할 수 없고 docs-first schema 결정이 필요하다.
- career context bundle에 넣을 source 범위를 ADR-065만으로 결정할 수 없다.
- provider disabled 상태의 product behavior가 docs와 충돌한다.
- docs/ADR/정책 문서 수정 없이는 구현을 계속할 수 없다.
- 기존 dirty 변경이 같은 파일에서 충돌해 의도한 변경과 사용자 변경을 구분할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.

- 별도 AI 피드백 버튼을 추가한다.
- insufficient guard 이전에 LLM을 호출한다.
- request result/audit/Discord/HUD에 답변 전문이나 상세 피드백 전문을 저장한다.
- provider failure를 request processor 전체 crash로 방치한다.
- systemd timer 주기나 pending 1건 처리 원칙을 임의 변경한다.
- destructive migration을 만든다.
- apartment repo 변경을 수정, stage, revert한다.
