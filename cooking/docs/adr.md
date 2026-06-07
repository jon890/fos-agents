# ADR — cooking

cooking 워크스페이스 한정 결정 기록.

## ADR-001 — cooking을 독립 ai-nodes 워크스페이스로 둔다

Status: Accepted
Date: 2026-06-07

### 맥락

요리 자료는 아파트, 커리어, 투자, 여행과 다른 도메인이다.
재료 비교, 영상 수집, 장보기 리스트처럼 반복 가능한 흐름이 있고, 개인 취향이나 구매처가 섞일 수 있다.

### 결정

`~/ai-nodes/cooking`을 독립 워크스페이스로 만든다.
OpenClaw skill은 얇은 wrapper로 두고, 실제 자료와 결정은 cooking 워크스페이스에 저장한다.

### 결과

요리 채널의 대화는 기본적으로 cooking 워크스페이스로 라우팅한다.
공개 brain 적재는 별도 승인과 비식별 정리를 거친다.

