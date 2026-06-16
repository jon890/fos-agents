## ADR-064 — fos-career 범용 채팅은 제거하고 목적별 요청 UI로 통일한다

- Status: Accepted
- Date: 2026-06-08

### 맥락

fos-career 초기 MVP에는 career-os 파일을 컨텍스트로 읽는 범용 LLM 채팅이 포함되어 있었다.
dashboard가 발전하면서 주요 행동은 이미 버튼과 pending request queue로 분리됐다.
범용 채팅은 사용자가 무엇이 실행되는지 예측하기 어렵고, career agent 맥락을 과하게 주입하면 private 문서와 지원 전략이 채팅 기록에 새어 나갈 위험이 크다.

### 결정

- fos-career에서 범용 채팅 제품면을 제거한다.
- dashboard에서 skill 실행은 계속 버튼 기반 request queue로 만든다.
- 면접 답변 피드백은 범용 채팅이 아니라 interview evaluator 흐름으로 다룬다.
  evaluator는 prep.md, 현재 질문, 사용자 답변, 포지션 맥락을 명시적으로 묶어 평가한다.
- 기존 MySQL `llm_chat_sessions`, `llm_chat_messages` 테이블은 즉시 drop하지 않는다.
  코드 경로에서 참조를 제거하고 legacy/deprecated로 표시한 뒤, 데이터 보관 여부를 별도 cleanup plan에서 결정한다.
- LLM은 분석, 작성, 추천 근거, 면접 답변 평가에 계속 사용할 수 있다.
  금지되는 것은 목적 없는 자유 채팅 UI와 chat 기반 mutation이다.
- ADR-046의 "LLM 채팅 UI" 범위는 이 ADR로 supersede된다.

거절한 대안:

- 범용 채팅 유지: 사용자가 실행되는 내용을 예측하기 어렵고, private 맥락 노출 위험이 크다.

### 결과

- dashboard의 행동 표면이 버튼과 명시적 request로 정리된다.
- private career-os 맥락이 범용 채팅 기록에 섞일 위험이 줄어든다.
- 면접 피드백은 career agent 맥락을 갖춘 전용 evaluator로 발전시킬 수 있다.
