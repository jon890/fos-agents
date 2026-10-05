# 합성 도구 목록: 직접 호출

모든 도구 가용성은 지어낸 것이다.

## 사용 가능한 도구

- `mcp__career__get_context_document`: 입력은 `documentKey` 하나다
- `mcp__career__list_study_candidates`: 입력은 `limit` 이다
- `mcp__career__get_position_research_constraints`: 입력은 빈 객체다
- `agent_list`, `agent_delegate`, `agent_status` 도 보이며 연결용 커리어 에이전트가 있다
- `web_search`, `web_extract` 가 있다

맥락 fixture 의 「위임하면 받는 답」은 위 직접 도구를 호출해도 같은 값으로 돌아온다.
직접 도구가 붙은 실행도 Memory 문맥을 그대로 받는다.
