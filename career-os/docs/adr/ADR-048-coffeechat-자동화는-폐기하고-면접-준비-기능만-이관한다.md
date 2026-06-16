## ADR-048 — coffeechat 자동화는 폐기하고 면접 준비 기능만 이관한다

- Status: Accepted
- Date: 2026-06-06

### 맥락

`interview-coffeechat-prep`는 CJ Foodville coffeechat 준비에서 출발했고, 이후 ADR-034에서 coffeechat / first-round / final-round / offer-chat 4 mode로 일반화됐다.
그러나 coffeechat은 회사마다 목적, 참석자, 평가 방식, 공식성 수준이 크게 다르다. 이를 공통 자동화로 구조화하면 "coffeechat은 이런 자리"라는 과잉 일반화가 생기고, 사용자가 확인하지 않은 면접 맥락을 에이전트가 추정할 위험이 있다.

반면 first-round, final-round, offer 관련 준비에는 여전히 재사용 가능한 기능이 있다. 회사/직무 리서치, 후보자 경험 매핑, 예상 질문, 역질문, 답변 점검은 `interview-prep-analyzer` 계열로 이관하는 편이 더 명확하다.

### 결정

- coffeechat-specific 자동화와 prompt/reference를 active workflow에서 폐기한다.
- `interview-coffeechat-prep`를 새 작업의 기본 진입점으로 쓰지 않는다.
- position-recommender 등 다른 skill에서 "커피챗 전략 리포트"를 자동 라우팅하지 않는다.
- 필요한 면접 준비 기능은 `interview-prep-analyzer`로 이관한다.
  - first-round: 회사/비즈니스 분석, 역할·팀 전략, 후보자 포지셔닝, 예상 질문, 역질문.
  - final-round/offer: 필요 시 별도 mode 또는 context로 확장하되 coffeechat 전제는 사용하지 않는다.

- 과거 coffeechat 산출물과 task/ADR은 history로 보존한다. 단, AGENTS/SKILL/flow의 active path에서는 제거하거나 deprecated tombstone만 남긴다.

### 결과

- 새 에이전트가 coffeechat을 표준화된 평가 이벤트로 오해할 가능성이 줄어든다.
- 면접 준비 기능은 더 일반적인 `interview-prep-analyzer` 책임으로 모인다.
- 회사별 비공식 대화는 자동 리포트 생성보다 사용자 확인 질문을 먼저 하는 방식으로 처리한다.

### 적용

- `tasks/plan041-interview-coffeechat-deprecation/` — 구현 계획.
- `interview-prep-analyzer` — 필요한 면접 준비 기능 이관 대상.
- `interview-coffeechat-prep` — active workflow 폐기 대상.
