## ADR-049 — fos-career LLM 채팅은 provider interface 뒤에서 SDK를 교체한다

- Status: Accepted
- Date: 2026-06-06

### 맥락

`plan039-fos-career-dashboard`의 채팅 API는 MVP에서 Anthropic SDK를 route 안에서 직접 호출했다.
사용자는 현재 활용 중인 Codex/OpenAI 계열 LLM으로 갈 수 있되, 나중에 SDK가 바뀔 수 있으므로 LLM API를 교체 가능한 인터페이스로 두길 원했다.

### 결정

- fos-career는 `lib/llm/` 아래에 LLM provider 계약을 둔다.
- `app/api/chat/route.ts`는 특정 SDK를 직접 import하지 않고 provider interface만 호출한다.
- 현재 운영 provider는 `LLM_PROVIDER=openai`로 고정하고 OpenAI Responses API를 사용한다.
- Anthropic 같은 다른 SDK는 지금 활성 provider로 두지 않는다. 나중에 필요하면 `LlmProvider.streamText()` 계약을 만족하는 새 provider로 추가한다.
- 모델은 `LLM_MODEL`로 지정하고, 비어 있으면 provider별 기본값을 사용한다.
- provider/model은 채팅 audit log details에 남긴다.
- LLM provider 변경은 career-os 읽기 전용 경계, 외부 행동 금지, MySQL chat history 저장 정책을 바꾸지 않는다.

### 결과

- OpenAI/Codex 계열을 현재 기본 실행 경로로 사용한다.
- 후속 SDK 구현을 같은 `streamText()` 계약으로 교체할 수 있다.
- Codex/OpenAI 계열로 전환할 때 chat route와 DB 저장 흐름을 크게 바꾸지 않아도 된다.
- provider 설정이 누락되면 채팅 응답에 설정 오류를 반환하고, career-os 파일에는 쓰지 않는다.

### 적용

- `tasks/plan042-fos-career-llm-provider-interface/`
- `~/services/fos-career/lib/llm/`
- `~/services/fos-career/app/api/chat/route.ts`
