## ADR-073 — daily study 추천은 action snapshot으로 후속 작업을 연결한다

- Status: Accepted
- Date: 2026-06-09

### 맥락

매일 추천을 학습 자료 초안 생성으로 이어 가려면 날짜와 토픽을 안정적으로 식별할 기계 계약이 필요하다.
외부 전달 계층의 버튼과 callback 형태를 저장소 코드에 고정하면 runtime 의존성이 생긴다.

### 결정

- 추천 3개와 후속 작업 식별자를 `state/study-topic-actions/YYYY-MM-DD.json`에 저장한다.
- 최신 snapshot은 `state/study-topic-actions/latest.json`에 같이 저장한다.
- `career.study-pack.create:*`는 학습 자료 초안 생성 요청이며 공개 발행 승인이 아니다.
- `career.study-pack.skip:*`는 해당 날의 추천을 넘긴 기록이며 영구 제외가 아니다.
- 외부 전달 계층은 snapshot을 읽어 자신의 상호작용 형태와 유효시간을 정한다.

### 결과

저장소는 runtime에 중립적인 action 계약만 소유하고 외부 전달은 별도 계층에 맡긴다.
