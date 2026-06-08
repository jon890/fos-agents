# Phase 03 — dashboard feedback/follow-up 표시와 queue 상태 확인

**Model**: sonnet
**Status**: pending

## 목표

dashboard 면접 화면이 새 evaluator 저장 contract와 맞게 feedback, score, follow-up question, queue 상태를 보여주는지 확인한다.

큰 UI 변경 없이 답변 제출 후 즉시 평가 흐름이 사용자에게 자연스럽게 보이도록 정리한다.

## 범위

- `~/services/fos-career/app/dashboard/interview/page.tsx` 확인과 최소 수정.
- 필요한 경우 `InterviewAnswerForm.tsx` 또는 인접 interview UI 컴포넌트 최소 수정.
- 답변 제출 후 별도 AI 피드백 버튼이 보이지 않는지 확인.
- pending/running/done/failed/blocked 상태 표시 확인.
- guard insufficient feedback 표시 확인.
- evaluator feedback score 표시 확인.
- evaluator가 생성한 optional follow-up question 표시 확인.
- `improvementTopicsJson`, `studyPackCandidatesJson` 표시 또는 기존 표시 contract와의 호환 확인.
- request result/audit summary가 private body를 노출하지 않는지 확인.

## 비범위

- dashboard 전체 redesign.
- 새 chat UI 또는 generic chat route 추가.
- processor core evaluator 로직 변경.
- DB schema 변경.
- systemd timer 변경.
- career-os docs/ADR/정책 문서 수정.
- commit, push, PR 생성.

## 중요 지침

이 phase는 implementation phase다.

`career-os/docs/`, `AGENTS.md`, `TOOLS.md`, ADR, 정책 문서를 수정하지 않는다.

UI contract가 docs와 맞지 않거나 별도 제품 결정이 필요하면 `PHASE_BLOCKED`로 멈춘다.

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
git -C career-os status --short
git -C ~/services/fos-career status --short
```

## 관련 파일

실행 전 반드시 읽는다.

- `career-os/docs/prd.md`의 interview dashboard 범위
- `career-os/docs/flow.md`의 answer submit과 request queue 흐름
- `career-os/docs/data-schema.md`의 feedback fields와 private boundary
- `~/services/fos-career/app/dashboard/interview/page.tsx`
- `~/services/fos-career/app/dashboard/interview/InterviewAnswerForm.tsx`
- `~/services/fos-career/lib/interview/gateway.ts`
- `~/services/fos-career/scripts/process-interview-requests.ts`
- `~/services/fos-career/db/schema.ts`

## 작업 절차

1. 현재 interview dashboard가 answer record와 request queue 상태를 어떻게 읽는지 확인한다.
2. 답변 제출 후 `answer_feedback` request가 자동으로 만들어지고 UI가 그 상태를 보여주는지 확인한다.
3. 별도 AI 피드백 버튼, 수동 feedback trigger, generic chat affordance가 남아 있으면 제거한다.
4. feedback 표시를 evaluator contract와 맞춘다.
   - insufficient feedback도 일반 feedback처럼 표시한다.
   - follow-up question은 값이 있을 때만 표시한다.
   - improvement topics와 study-pack candidates는 기존 UI 표면이 있으면 연결하고, 없으면 작은 상태 표시로 제한한다.
5. failed/blocked/fallback 상태는 private body 없는 짧은 reason summary로 보여준다.
6. loading/pending/running 상태가 답변 입력 영역을 불필요하게 막지 않는지 확인한다.

## 검증 명령

보고 직전 반드시 아래 bash 블록을 실행하고 raw count를 출력한다.

```bash
cd ~/services/fos-career
git status --short

rg -n "AI 피드백|피드백 요청|feedback button|request feedback|answer_feedback|followUpQuestion|improvementTopics|studyPackCandidates|insufficient|blocked|failed" \
  app/dashboard/interview app/api lib scripts \
  -g '!**/node_modules/**' \
  -g '!**/.next/**' \
  | tee /tmp/plan064-phase03-ui-refs.txt
UI_REF_COUNT=$(wc -l </tmp/plan064-phase03-ui-refs.txt)
echo "[ui refs] $UI_REF_COUNT"
test "$UI_REF_COUNT" -gt 0

rg -n "app/api/chat|FloatingChat|/dashboard/chat|generic chat|범용 채팅" \
  app lib scripts db README.md docs package.json proxy.ts \
  -g '!**/node_modules/**' \
  -g '!**/.next/**' \
  | tee /tmp/plan064-phase03-chat-regression.txt || true
CHAT_REGRESSION_COUNT=$(wc -l </tmp/plan064-phase03-chat-regression.txt)
echo "[chat regression refs] $CHAT_REGRESSION_COUNT"

npx tsc --noEmit
npm run build
git diff --check
```

Playwright나 기존 UI smoke가 있으면 interview page만 대상으로 실행한다.
없으면 새 의존성을 추가하지 않고 build와 static grep 결과를 보고한다.

## 성공 기준

- 답변 제출 후 별도 AI 피드백 버튼 없이 evaluator request 상태가 표시된다.
- pending/running/done/failed/blocked 상태가 기존 queue contract와 맞게 보인다.
- insufficient feedback, normal evaluator feedback, fallback feedback이 모두 UI에서 구분 가능하다.
- follow-up question은 evaluator result에 값이 있을 때만 표시된다.
- request result/audit summary 또는 UI 상태에 답변 전문과 상세 피드백 전문이 새로 복사되지 않는다.
- generic chat UI/API가 되살아나지 않는다.
- TypeScript와 build 검증이 통과한다.

## common-pitfalls self-check

- UI copy는 기능 설명문을 길게 추가하지 않고 실제 상태 표시 중심으로 둔다.
- text가 버튼이나 작은 상태 pill 안에서 넘치지 않게 한다.
- docs/ADR/정책 문서는 수정하지 않는다.
- generic chat affordance를 되살리지 않는다.
- private body를 상태 summary로 복사하지 않는다.
- UI가 processor timer 주기 변경을 전제로 하지 않는다.

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- 현재 API가 feedback/follow-up 상태를 dashboard에 제공하지 않아 UI 변경만으로 표시할 수 없다.
- 별도 AI 피드백 버튼 제거가 현재 answer submit contract와 충돌한다.
- follow-up question 표시 위치가 제품 결정 없이는 정해지지 않는다.
- docs/ADR/정책 문서 수정 없이는 구현을 계속할 수 없다.
- 기존 dirty 변경이 같은 파일에서 충돌해 의도한 변경과 사용자 변경을 구분할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.

- 별도 AI 피드백 버튼을 추가하거나 유지한다.
- generic chat UI/API를 되살린다.
- dashboard 상태 표시를 위해 request result/audit에 답변 전문이나 상세 피드백 전문을 복사한다.
- dashboard가 career-os writable mount를 요구하게 만든다.
- systemd timer 변경으로 UI 문제를 해결하려 한다.
- apartment repo 변경을 수정, stage, revert한다.
