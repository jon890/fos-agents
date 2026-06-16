## ADR-064 — fos-career 범용 채팅은 제거하고 목적별 요청 UI로 통일한다

- Status: Accepted
- Date: 2026-06-08

### 맥락

fos-career의 초기 MVP에는 career-os 파일을 컨텍스트로 읽는 범용 LLM 채팅이 포함되어 있었다.
하지만 dashboard가 발전하면서 주요 행동은 이미 버튼과 pending request queue로 분리됐다.
지원 우선순위 변경, 지원 준비 시작, 면접 준비 생성, 공부팩 생성, 답변 피드백은 모두 목적이 정해진 UI와 processor가 처리하는 편이 더 안전하고 추적 가능하다.

범용 채팅은 사용자가 무엇이 실행되는지 예측하기 어렵고, career agent 맥락을 충분히 주입하지 않으면 단순 Q&A처럼 동작한다.
반대로 career agent 맥락을 과하게 주입하면 private 문서와 지원 전략이 채팅 기록, audit log, screenshot에 새어 나갈 위험이 커진다.
따라서 fos-career의 사람용 표면은 자유 채팅이 아니라 명시적 버튼, 정본 markdown, 답변 입력, 피드백, 꼬리질문 흐름으로 제한한다.

### 결정

- fos-career에서 범용 채팅 제품면을 제거한다.
  - `/dashboard/chat`
  - floating chat button/panel
  - `/api/chat/*`
- dashboard navigation과 login shell에서 채팅 메뉴를 노출하지 않는다.
- dashboard에서 skill 실행은 계속 버튼 기반 request queue로 만든다.
  fos-career는 요청을 저장하고, processor가 allowlist와 stale guard를 확인한 뒤 career-os writable checkout에서 실행한다.
- 면접 답변 피드백은 범용 채팅이 아니라 interview evaluator 흐름으로 다룬다.
  evaluator는 `private/<company>/<position>/interview/prep.md`, 현재 질문, 사용자 답변, 최근 답변/피드백 요약, 이미 정리된 주제, 포지션 맥락을 명시적으로 묶어 평가한다.
- 질문 선택 UI는 긴 질문을 잘라 보이는 select가 아니라 버튼 목록과 readonly textarea로 표시한다.
- `lib/llm/*` 같은 provider 경계는 범용 채팅이 아니라 목적별 evaluator/request processor에서 재사용할 수 있다.
  이름과 책임은 후속 plan에서 필요하면 generic provider로 정리한다.
- 기존 MySQL `llm_chat_sessions`, `llm_chat_messages` 테이블은 즉시 destructive migration으로 drop하지 않는다.
  코드 경로에서 참조를 제거하고 문서상 legacy/deprecated로 표시한 뒤, 데이터 보관 여부를 별도 cleanup plan에서 결정한다.
- audit/action log 예시는 `chat.message_sent` 대신 `dashboard.view`, `interview.answer_submitted`, `interview.feedback_generated`, `skill_request.created` 같은 목적별 action으로 갱신한다.
- LLM은 여전히 분석, 작성, 추천 근거, 면접 답변 평가에 사용할 수 있다.
  금지되는 것은 목적 없는 자유 채팅 UI와 chat 기반 mutation이다.

### 결과

- dashboard의 행동 표면이 버튼과 명시적 request로 정리된다.
- private career-os 맥락이 범용 채팅 기록에 섞일 위험이 줄어든다.
- 면접 피드백은 career agent 맥락을 갖춘 전용 evaluator로 발전시킬 수 있다.
- ADR-046의 “LLM 채팅 UI” 범위는 이 ADR로 supersede된다.

### 적용

- `~/services/fos-career/app/dashboard/chat/`
- `~/services/fos-career/app/dashboard/floating-chat.tsx`
- `~/services/fos-career/app/api/chat/`
- `~/services/fos-career/lib/llm/`
- `~/services/fos-career/db/schema.ts`
- `docs/prd.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `docs/data-schema.md`
