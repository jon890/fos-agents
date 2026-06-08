# Phase 02 — README/deployment/docs와 schema/code 참조 정리

## 목표

fos-career의 문서, deployment 설명, schema 주석, code reference에서 범용 채팅 기능을 제거하거나 legacy/deprecated로 정리한다.

DB chat table은 즉시 삭제하지 않고 비사용 상태를 명확히 한다.

## 범위

- `README.md`, deployment 문서, 운영 문서에 남은 chat 기능 설명 제거.
- Prisma schema 또는 DB 설명에서 `llm_chat_sessions`, `llm_chat_messages`를 legacy/deprecated로 표시.
- application code에서 chat table runtime reference 제거.
- `lib/llm/*` provider의 현재 책임이 chat API 전용으로 오해되지 않도록 이름, export, 주석, README mention을 정리.
- audit log나 request result에 private 본문과 면접 답변 전문을 저장하지 않는 경계 재확인.

## 비범위

- career-os `docs/adr.md`, `docs/prd.md`, `docs/flow.md`, `docs/code-architecture.md`, `docs/data-schema.md` 수정.
- DB destructive migration.
- LLM provider 삭제.
- 신규 interview evaluator 구현.
- private 면접 준비 정본 내용 편집.
- commit, push, PR 생성.

## 작업 절차

1. Phase 01 결과와 `rg` inventory를 기준으로 문서와 schema에 남은 chat reference를 분류한다.
2. 제품 기능으로 남은 generic chat mention은 제거한다.
3. DB table 또는 migration history처럼 남아야 하는 reference는 legacy/deprecated 문맥으로 제한한다.
4. `lib/llm/*`가 후속 interview evaluator에서 재사용 가능한 provider 계층임을 확인하고, chat-only coupling이 남으면 책임을 좁게 정리한다.
5. docs-first 계약이 부족해 career-os docs 수정이 필요하면 직접 고치지 말고 `PHASE_BLOCKED`로 보고한다.

## 검증 명령

```bash
cd ~/services/fos-career
rg -n "chat|Chat|llm_chat|FloatingChat|/api/chat|/dashboard/chat|범용 채팅" README.md docs app lib db scripts package.json proxy.ts --glob '!db/data/**'
rg -n "private/cj-foodville|interview/prep|answer|feedback|audit|Discord|request result" app lib db scripts README.md docs --glob '!db/data/**'
npx tsc --noEmit
npm run build
```

`chat` grep 결과는 0건일 필요는 없다.
허용되는 결과는 legacy/deprecated table 문서, LLM provider 이름, 외부 package 명칭처럼 chat feature가 아닌 항목으로 제한한다.

## 성공 기준

- generic chat이 현행 제품 기능으로 문서화되어 있지 않다.
- `llm_chat_sessions`, `llm_chat_messages`는 runtime path에서 쓰이지 않는다.
- chat table은 legacy/deprecated로만 남고 drop migration은 없다.
- `lib/llm/*`는 유지되며 후속 evaluator 재사용 가능성을 해치지 않는다.
- private 본문, 면접 답변 전문, 상세 피드백 전문이 Discord/audit/request result로 흐르지 않는 경계가 유지된다.

## PHASE_BLOCKED

- schema와 migration 상태가 불명확해 table을 유지할지 drop할지 결정해야 하면 `PHASE_BLOCKED: legacy chat table migration policy needs decision`을 출력한다.
- `lib/llm/*`가 chat route와 강하게 결합되어 provider 유지와 chat 제거를 동시에 만족하기 어렵다면 `PHASE_BLOCKED: llm provider is coupled to generic chat route`를 출력한다.
- career-os docs/ADR 수정 없이는 문서 정리가 불가능하면 `PHASE_BLOCKED: docs contract needs update before reference cleanup`를 출력한다.

## PHASE_FAILED

- destructive migration으로 chat table을 drop하면 실패로 본다.
- chat feature를 다른 이름으로 되살리면 실패로 본다.
- private target 본문이나 답변 전문을 README, deployment 문서, audit log 예시에 넣으면 실패로 본다.
