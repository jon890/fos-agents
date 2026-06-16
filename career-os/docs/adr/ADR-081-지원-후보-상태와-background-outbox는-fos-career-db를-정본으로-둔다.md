## ADR-081 — 지원 후보 상태와 background outbox는 fos-career DB를 정본으로 둔다

- Status: Accepted
- Date: 2026-06-14

### 맥락

기존 포지션 추천 흐름은 daily Markdown 리포트에서 추천 카드를 추출해 `frontdoor-queue.jsonl`에 저장하고, 사용자가 선택한 후보만 `ledger.jsonl`로 승격했다.
웹 대시보드가 중심이 되자 세 가지 문제가 드러났다.

- `frontdoor queue`라는 이름이 사용자 관점에서 의미를 전달하지 못한다.
- HTML 리포트 카드와 action 가능한 queue record를 다시 매칭해야 한다.
- 제외, 보류, 지원 시작 같은 현재 상태를 웹 대시보드에서 일관되게 필터링하기 어렵다.

### 결정

- 추천 후보 상태와 stage의 정본은 fos-career MySQL로 이전한다.
- 포지션 추천 run은 structured recommendation item을 생성하고 fos-career가 이를 DB로 ingest한다.
- 같은 공고는 candidate key unique constraint로 중복 생성하지 않는다.
- 지원 후보는 state와 stage를 분리해 관리하고, 전이 규칙은 master/transition table로 관리한다.
- 오래 걸리는 skill 실행은 fos-career DB outbox job으로 관리한다.
- HTML 리포트는 읽기용 snapshot이며 action source가 아니다.
- `frontdoor-queue.jsonl`은 DB import와 diff 검증 후 삭제한다.

### 결과

- 대시보드가 추천 후보의 현재 상태를 한 곳에서 판단할 수 있다.
- 제외한 후보는 다음 추천 화면에 기본 노출되지 않는다.
- 보류, 제외, 지원 시작, 서류 통과, 면접 대비 같은 상태가 리포트 HTML과 독립적으로 유지된다.
- DB schema, migration, worker, 대시보드 UI가 함께 바뀌는 큰 작업이므로 plan073으로 phase를 나눠 진행한다.
