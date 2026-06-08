# Phase 01 — fos-career chat UI/API 제거 및 라우팅 정리

## 목표

fos-career에서 범용 채팅 화면, floating chat, chat API, routing surface를 제거한다.

내부 skill 호출은 버튼과 pending request로 처리한다는 ADR-064 결정을 코드에 반영한다.

## 범위

- `~/services/fos-career/app/dashboard/chat/` route 제거.
- `~/services/fos-career/app/dashboard/floating-chat.tsx` 제거.
- `~/services/fos-career/app/api/chat/` route 제거.
- dashboard layout의 floating chat import와 render 제거.
- 로그인 화면, nav, sidebar, command affordance에 남은 chat mention 제거.
- chat 제거 뒤 dashboard 주요 route가 정상 import되는지 확인.

## 비범위

- `lib/llm/*` provider 삭제.
- interview evaluator 신규 구현.
- pending request queue 설계 변경.
- career-os docs/ADR/정책 문서 수정.
- DB `llm_chat_sessions`, `llm_chat_messages` drop migration 작성.
- private 면접 준비 본문 수정.
- commit, push, PR 생성.

## 작업 절차

1. `~/services/fos-career`에서 현재 dirty 상태를 확인하고 unrelated 변경은 되돌리지 않는다.
2. chat route, floating component, API route, layout/nav/login mention을 `rg`로 inventory한다.
3. chat 전용 파일과 route를 제거하고, import/render/navigation 참조를 함께 정리한다.
4. 내부 skill 호출 CTA는 기존 버튼과 pending request UI로만 연결되는지 확인한다.
5. docs/ADR 계약이 부족하거나 서로 충돌하면 임의 수정하지 않고 `PHASE_BLOCKED`로 보고한다.

## 검증 명령

```bash
cd ~/services/fos-career
git status --short
rg -n "FloatingChat|/dashboard/chat|app/api/chat|chat session|chat message|generic chat|범용 채팅" app lib db README.md docs package.json
npx tsc --noEmit
npm run build
```

`rg` 명령은 제거 대상 문자열을 찾기 위한 검증이다.
legacy/deprecated 문서나 schema에 남아야 하는 항목은 Phase 02에서 근거를 남긴다.
현재 fos-career에는 `lint` script가 없으므로 `npx tsc --noEmit`과 `npm run build`를 기본 검증으로 사용한다.

## 성공 기준

- `/dashboard/chat` route와 chat API route가 제거됐다.
- floating chat import/render가 dashboard layout에 남지 않는다.
- 로그인/nav/sidebar에서 범용 chat 진입점이 보이지 않는다.
- dashboard는 pending request 기반 skill 호출 affordance만 남긴다.
- lint 또는 TypeScript 검증이 chat 제거로 깨지지 않는다.

## PHASE_BLOCKED

- ADR-064와 현재 fos-career 구현이 충돌해 chat 제거 범위를 결정할 수 없으면 `PHASE_BLOCKED: generic chat removal contract is insufficient`를 출력한다.
- docs/ADR/정책 문서를 수정해야만 구현을 계속할 수 있으면 `PHASE_BLOCKED: docs contract needs update before implementation`를 출력한다.
- 기존 dirty 변경이 같은 파일에서 충돌해 의도한 제거와 사용자 변경을 구분할 수 없으면 `PHASE_BLOCKED: conflicting dirty changes in chat surface`를 출력한다.

## PHASE_FAILED

- `lib/llm/*` provider를 삭제하면 실패로 본다.
- DB chat table을 drop하는 migration을 만들면 실패로 본다.
- Discord, HUD, audit log, request result에 private 본문이나 면접 답변 전문을 노출하면 실패로 본다.
- apartment repo 변경을 수정, stage, revert하면 실패로 본다.
