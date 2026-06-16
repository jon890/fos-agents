## ADR-065 — 면접 답변 피드백은 career context LLM evaluator로 처리한다

- Status: Accepted
- Date: 2026-06-08

### 맥락

ADR-064로 범용 채팅 UI/API를 제거했기 때문에 fos-career의 LLM 사용은 목적별 evaluator/request processor에 붙어야 한다.
현재 면접 답변 제출 흐름은 답변 저장 후 `answer_feedback` request를 pending queue에 넣고, host-side processor가 2분 간격으로 처리한다.
다만 feedback 생성은 아직 deterministic fallback 중심이라 짧은 테스트 답변도 표현상 과하게 긍정적으로 보일 수 있었다.

사용자는 답변 제출 뒤 즉시 평가되는 경험을 원하고, 꼬리질문 생성 여부도 LLM이 답변 상태를 보고 판단하길 원한다.
따라서 `answer_feedback`은 범용 채팅이 아니라 career agent 맥락을 가진 전용 LLM evaluator로 승격한다.

### 결정

- 답변 제출 시 `interview_answer_records` row와 `answer_feedback` request를 즉시 생성한다.
- feedback 처리는 별도 버튼 없이 제출 직후 pending queue에 들어가고, 기존 host-side interview processor가 처리한다.
- 너무 짧거나 의미 없는 답변은 LLM을 호출하지 않고 deterministic guard에서 즉시 insufficient feedback으로 처리한다.
  예: 매우 짧은 문자열, 기술/경험/구조/도메인 신호가 없는 답변.
- guard를 통과한 답변만 LLM evaluator를 호출한다.
- evaluator context bundle은 다음 입력으로 제한한다.
  - `private/<company>/<position>/interview/prep.md`
  - 현재 질문
  - 사용자 답변
  - 최근 3-5개 답변/피드백 요약
  - 이미 정리된 주제와 낮은 우선순위 주제
  - 포지션/회사 맥락
  - 평가 기준: 기술 정확성, 경험 연결, 답변 구조, CJ푸드빌 맥락 반영, 위험 표현
- LLM 응답은 strict JSON으로 받는다.
  기본 필드는 `feedbackBody`, `scores`, `followUpQuestion`, `shouldAskFollowUp`, `improvementTopics`, `studyPackCandidates`, `riskFlags`다.
- 꼬리질문은 LLM이 `shouldAskFollowUp`과 `followUpQuestion`으로 판단한다.
  후속 턴 전환은 dashboard가 해당 값을 보여주고 사용자가 이어 답하는 흐름으로 둔다.
- LLM 실패, timeout, JSON parse 실패는 deterministic fallback으로 처리하고 request를 실패로 방치하지 않는다.
- DB에는 답변 전문과 상세 피드백을 private 영역으로 저장한다.
  audit log, request result, Discord, HUD에는 길이, 점수, 짧은 summary, 상태만 저장한다.
- evaluator는 외부 사이트 접근, fos-study 발행, candidate-profile 수정, 지원서 제출을 수행하지 않는다.
- 기존 `lib/llm/*` provider는 이 evaluator에서 재사용한다.
  필요하면 streaming 중심 계약을 structured JSON 평가 계약으로 확장한다.

### 결과

- 면접 피드백의 품질과 맥락성이 올라간다.
- 답변이 충분하지 않은 경우에는 비용을 쓰지 않고 빠르게 낮은 점수와 재답변 가이드를 제공한다.
- 꼬리질문은 고정 생성이 아니라 답변 상태에 맞춰 생성된다.
- 범용 채팅 없이도 career agent 맥락이 면접 연습 흐름 안에 살아난다.

### 적용

- `~/services/fos-career/lib/interview/gateway.ts`
- `~/services/fos-career/lib/llm/`
- `~/services/fos-career/scripts/process-interview-requests.ts`
- `~/services/fos-career/app/api/interview/answers/route.ts`
- `~/services/fos-career/db/schema.ts`
- `docs/prd.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `docs/data-schema.md`
