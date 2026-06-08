# Phase 01 — evaluator 계약과 provider 확장

**Model**: sonnet
**Status**: pending

## 목표

fos-career의 면접 답변 evaluator 계약을 고정한다.

답변 guard, career context bundle, structured JSON evaluator result, provider 호출 helper를 구현해 Phase 02 processor가 재사용할 수 있게 한다.

## 범위

- `~/services/fos-career/lib/interview/gateway.ts`에 evaluator types와 helper 추가.
- 답변 상태를 판단하는 deterministic guard 추가.
- insufficient guard 결과는 LLM 호출 없이 1/5 feedback으로 정규화.
- evaluator context bundle contract 정의.
- structured JSON parse helper 추가.
- JSON parse failure fallback helper 추가.
- `~/services/fos-career/lib/llm/*` provider를 structured JSON evaluator 호출에 쓸 수 있게 helper 확장.
- provider disabled fallback path 추가.
- 답변 전문과 상세 피드백이 request result/audit/Discord/HUD payload로 넘어가지 않는 타입 경계 확인.

## 비범위

- processor의 `answer_feedback` 처리 흐름 연결.
- dashboard UI 변경.
- Docker, systemd timer 변경.
- career-os docs/ADR/정책 문서 수정.
- DB schema 변경.
- 범용 chat route/API 복구.
- commit, push, PR 생성.

## 중요 지침

이 phase는 implementation phase다.

`career-os/docs/`, `AGENTS.md`, `TOOLS.md`, ADR, 정책 문서를 수정하지 않는다.

계약이 부족하거나 ADR-065와 코드가 충돌하면 추측으로 구현하지 말고 `PHASE_BLOCKED`로 멈춘다.

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행할 수 있다.
첫 bash에서 ai-nodes root로 이동하고, fos-career는 `git -C`로 다룬다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
git -C career-os status --short
git -C ~/services/fos-career status --short
```

## 관련 파일

실행 전 반드시 읽는다.

- `career-os/docs/adr.md`의 ADR-064와 ADR-065
- `career-os/docs/data-schema.md`의 interview answer/feedback/request 경계
- `career-os/docs/flow.md`의 interview request processor 흐름
- `career-os/docs/code-architecture.md`의 fos-career와 `lib/llm/*` 책임
- `~/services/fos-career/lib/interview/gateway.ts`
- `~/services/fos-career/lib/llm/*`
- `~/services/fos-career/db/schema.ts`
- `~/services/fos-career/scripts/process-interview-requests.ts`

## 작업 절차

1. 현재 `gateway.ts`, `lib/llm/*`, answer record schema, processor의 기존 contract를 inventory한다.
2. evaluator input/output type을 추가한다.
   - input에는 answer id, question, answer text, target/session metadata, career context bundle summary/source refs를 둔다.
   - output에는 numeric score, rubric scores, feedback body, optional follow-up question, improvement topics, study-pack candidates, insufficient/fallback reason을 둔다.
3. deterministic guard를 구현한다.
   - 비어 있음, 지나치게 짧음, 의미 없는 반복, placeholder성 답변은 LLM 호출 전 insufficient로 처리한다.
   - insufficient 결과는 전체 score 1/5와 짧은 피드백으로 고정한다.
4. career context bundle builder contract를 구현한다.
   - private source body는 evaluator input에만 쓰고 request result/audit/HUD로 복사하지 않는다.
   - bundle source refs는 경로와 짧은 label 중심으로 제한한다.
5. structured JSON parse helper와 fallback helper를 구현한다.
   - model output이 JSON이 아니거나 schema에 맞지 않으면 private body 없는 fallback result를 반환한다.
6. `lib/llm/*` provider에 structured JSON evaluator 호출 helper를 추가하거나 기존 streamText provider 위에 얇은 helper를 만든다.
   - 범용 chat surface를 되살리지 않는다.
   - provider disabled 상태는 deterministic fallback으로 이어지게 한다.

## 검증 명령

보고 직전 반드시 아래 bash 블록을 실행하고 raw count를 출력한다.

```bash
cd ~/services/fos-career
git status --short

rg -n "Evaluator|evaluator|structured|JSON|followUpQuestion|improvementTopicsJson|studyPackCandidatesJson|feedbackBody" \
  lib/interview lib/llm db scripts \
  -g '!**/node_modules/**' \
  | tee /tmp/plan064-phase01-evaluator-refs.txt
EVALUATOR_REF_COUNT=$(wc -l </tmp/plan064-phase01-evaluator-refs.txt)
echo "[evaluator refs] $EVALUATOR_REF_COUNT"
test "$EVALUATOR_REF_COUNT" -gt 0

rg -n "app/api/chat|FloatingChat|/dashboard/chat|generic chat|범용 채팅" \
  app lib scripts db README.md docs package.json proxy.ts \
  -g '!**/node_modules/**' \
  -g '!**/.next/**' \
  | tee /tmp/plan064-phase01-chat-regression.txt || true
CHAT_REGRESSION_COUNT=$(wc -l </tmp/plan064-phase01-chat-regression.txt)
echo "[chat regression refs] $CHAT_REGRESSION_COUNT"

npx tsc --noEmit
git diff --check
```

`CHAT_REGRESSION_COUNT`는 legacy 문서 설명이나 schema compatibility 주석 때문에 0이 아닐 수 있다.
runtime chat route/API/floating UI가 되살아난 경우에는 실패로 본다.

## 성공 기준

- evaluator input/output type과 fallback type이 명확하다.
- deterministic guard가 LLM 호출 전 insufficient 답변을 1/5 feedback으로 정규화한다.
- career context bundle contract가 private body와 public-safe summary 경계를 분리한다.
- structured JSON parse failure와 provider disabled 상태가 fallback result로 이어진다.
- `lib/llm/*` provider는 evaluator에서 재사용 가능하지만 범용 chat UI/API는 되살아나지 않는다.
- TypeScript 검증과 diff whitespace 검증이 통과한다.

## common-pitfalls self-check

- 첫 bash 블록에 `cd "$(git rev-parse --show-toplevel)"`가 있다.
- 수치 보고는 `wc -l` raw count만 사용한다.
- docs/ADR/정책 문서는 수정하지 않는다.
- DB schema 변경은 이 phase에서 만들지 않는다.
- fallback payload에 답변 전문이나 상세 피드백 전문을 넣지 않는다.
- generic chat surface를 재생성하지 않는다.

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- ADR-065 또는 docs 계약만으로 evaluator input/output을 결정할 수 없다.
- 기존 `lib/llm/*` provider가 structured evaluator에 재사용 불가능하고 새 provider 선택 결정이 필요하다.
- private body와 request result/audit/HUD 경계를 지키는 저장 위치를 찾을 수 없다.
- docs/ADR/정책 문서 수정 없이는 구현을 계속할 수 없다.
- 기존 dirty 변경이 같은 파일에서 충돌해 의도한 변경과 사용자 변경을 구분할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.

- insufficient guard가 LLM 호출 뒤에 실행된다.
- fallback result가 답변 전문, 상세 피드백 전문, private context body를 request result/audit/Discord/HUD로 복사한다.
- 범용 chat route/API/floating UI를 되살린다.
- destructive DB migration을 만든다.
- apartment repo 변경을 수정, stage, revert한다.
