## ADR-134: 공고 분석의 기준 버전은 position-preferences 문서 버전에서 계산한다

- **status**: `accepted`
- **결정**:
  - 포지션 분석의 `candidateContextVersion` 은 Backend 가 `position-preferences` 후보자 맥락 문서의 `version` 에서 `position-preferences:v{version}` 으로 계산한다. 분석 정책에 저장하지 않는다.
  - 계산은 수집을 저장할 때 하고 그 값을 회사 tier 실행에 적는다. 공고 분석 실행은 같은 수집의 회사 tier 실행 값을 이어 써서, 한 수집 안에서는 기준 버전이 하나다.
  - 분석 정책의 요청과 응답에서 `candidateContextVersion` 칸을 뺀다.
  - `position-preferences` 문서가 없으면 수집 저장을 `CANDIDATE_CONTEXT_MISSING` 으로 거절한다.
- **맥락**:
  - [ADR-132](ADR-132-스킬의-개인-맥락은-후보자-맥락-문서에서-읽고-지원서-공통-프로필만-brain에-둔다.md)는 정책에 기준 버전을 저장하고, 문서를 저장한 CLI 가 같은 명령에서 정책을 그 값으로 맞추게 했다. 맞추는 일이 Backend 가 아니라 CLI 에 있어, CLI 를 거치지 않고 문서를 저장하면 두 값이 어긋나고 수집이 멈춘다.
  - 문서를 저장하는 길이 하나 더 생긴다. fos-assistant 의 커넥터가 승인을 받아 후보자 맥락 문서를 저장한다.
  - 공부 추천은 이미 기준 버전을 저장하지 않고 `learning-interests` 문서의 `version` 에서 계산한다([ADR-131](ADR-131-후보자-맥락은-backend-문서로-두고-공부-추천-기준-버전을-문서-버전에서-계산한다.md)).
- **대체된 부분**: ADR-132 의 「`manage_candidate_context.ts put --key position-preferences` 가 저장에 성공하면 같은 명령이 분석 정책을 그 값으로 갱신한다. 수집 명령은 시작할 때 두 값이 다르면 멈춘다」 를 이 결정이 대체한다. 기준 버전의 모양 `position-preferences:v{version}` 은 그대로다.
- **대안 기각**:
  - 문서를 저장하는 트랜잭션에서 정책의 칸도 고친다: 정책 API 의 계약이 그대로다. 그러나 후보자 맥락 모듈이 공고 모듈을 알게 되고, 같은 값을 두 곳에 두는 구조가 남는다.
  - 커넥터가 문서 저장과 정책 저장을 차례로 부른다: 두 번째가 실패하면 어긋난 채 남는다. CLI 가 겪던 문제를 커넥터로 옮길 뿐이다.
  - 커넥터가 `position-preferences` 를 저장하지 못하게 한다: Backend 를 고치지 않는다. 그러나 저장하는 쪽마다 맞추는 일을 기억해야 하는 구조가 남는다.
- **결과**:
  - 얻는 것: 문서를 어느 길로 저장해도 기준 버전이 어긋나지 않는다. CLI 의 정책 맞추기와 수집 전 대조가 없어진다.
  - 감당할 것: 분석 정책 API 의 계약이 바뀐다. 이 칸을 보내던 CLI 와 테스트를 함께 고친다. 저장돼 있던 값은 버린다. 공고 모듈이 후보자 맥락 모듈에 의존한다.
