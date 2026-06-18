## ADR-098 — data-schema는 현재 스키마만 담고 폐기 항목은 ADR로 위임한다

- Status: Accepted
- Date: 2026-06-17

### 맥락

`docs/data-schema.md`가 2300줄을 넘기며 계속 비대해졌다.
원인은 폐기·제거된 항목을 "폐기됨" 상태로 스키마 본문째 남겨둔 것이다.

- `data/generated-artifacts.json` (ADR-033으로 active 제거)
- `config/topics.json` 통합본 (plan017에서 3개 파일로 분리, "history 보존용" 명시)
- `data/runtime/profile-refresh-suggestions/` (plan086에서 스킬 제거, ADR-092)
- `llm_chat_sessions` / `llm_chat_messages` (ADR-064로 범용 채팅 제거)

폐기된 항목의 스키마 전문은 더 이상 현재 동작을 설명하지 않는다.
"왜 폐기됐는가"는 이미 각 ADR이 단일 출처로 보유한다.
폐기 항목을 문서에 남기면 노이즈가 늘고, 읽는 사람과 에이전트 양쪽의 토큰을 낭비한다.

이미 AGENTS.md에 "폐기된 자산의 상세 경로·옛 명령·migration 이력은 반복해 적지 않고, 폐기 이유는 ADR을 단일 출처로 둔다"는 원칙이 있다.
data-schema도 같은 원칙을 따르는 것이 일관적이다.

### 결정

- `data-schema.md`는 **현재 active한 스키마만** 담는다.
- 폐기·제거된 항목은 문서에서 삭제한다. 폐기 이유와 history는 해당 ADR이 단일 출처다.
- 예외: applier·runner·schema validator 등 **코드가 아직 참조하는 항목**은 legacy라도 스키마를 유지한다.
  문서를 지우면 코드가 참조할 계약이 사라지기 때문이다.
- 이 plan(plan089)에서 삭제한 항목:
  - `data/generated-artifacts.json` (표 행 + 섹션)
  - `config/topics.json` 통합본 스키마 섹션
  - `data/runtime/profile-refresh-suggestions/` 섹션
  - `llm_chat_sessions` / `llm_chat_messages` 테이블
- 보존한 legacy 항목(코드 active 확인):
  - `frontdoor-queue.jsonl` (`scripts/application-agent/frontdoor_queue_*.ts`)
  - `priority_action_requests` + applier input (`apply_priority_request.ts`, `priority_request_schema.ts`)
  - `user_position_action_requests` (`apply_position_action_request.ts`, `position_action_request_schema.ts`)

### 결과

- data-schema가 현재 동작만 기술해 노이즈와 토큰이 줄어든다.
- 폐기 history는 ADR이 단일 출처로 보유해 추적성이 유지된다.
- legacy라도 코드가 살아있으면 스키마를 남겨, 문서와 코드의 단절을 막는다.
- 앞으로 항목을 폐기할 때는 같은 기준을 적용한다.
  코드 참조가 0인지 확인한 뒤 문서에서 삭제하고, 폐기 이유는 ADR에 남긴다.
