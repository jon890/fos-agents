## ADR-062 — 포지션별 준비 홈은 루트 private 아래에 둔다

- Status: Accepted
- Date: 2026-06-08

### 맥락

면접 준비, 질문, 답변 피드백이 기능별 경로에 흩어지면 회사·포지션별 작업 맥락을 찾기 어렵다.
초기 정리는 `data/<company>/<position>` 형태였지만, 이 경로는 runtime, report, cache, queue 같은 시스템 데이터와 포지션별 작업 자료의 의미를 섞는다.

사용자는 포지션 준비 자료가 외부 공개 전 작업물이라는 점이 경로에서 바로 드러나길 원했다.
`private`의 내용은 공개 가능한 기술 학습 방향을 판단하는 근거가 될 수 있지만 원문을 공개 경로로 복사하면 안 된다.

### 결정

- 회사·포지션별 active 준비 홈은 `private/<company-slug>/<position-slug>/`에 둔다.
- `state/current-target.json`의 `primary.data_root`를 정본 경로로 사용한다.
- 파일 기반 자동화는 이 경로를 따른다.
- 면접 질문 정본을 runtime/report 경로에 중복 유지하지 않는다.
- 구조 전환으로 대체된 legacy runtime/report는 archive 없이 삭제할 수 있다.
- 새 코드는 legacy fallback을 추가하지 않는다. 필요한 호환은 일회성 migration으로 끝낸다.
- `private/`는 공개 전 작업 홈이다. 개인 답변, 지원 전략, 회사별 민감 맥락을 그대로 공개 경로에 복사하지 않는다.
- 공개 가능한 기술 주제는 민감 맥락을 제거한 뒤 외부 읽을거리 추천 신호로만 사용할 수 있다.

### 결과

- 포지션별 준비 자료와 시스템 runtime/report의 경계가 명확해진다.
- 자동화는 `data_root` 하나로 현재 포지션의 면접 연습, report, study 자료를 찾을 수 있다.
- legacy fallback을 제거해 경로 drift와 중복 산출물이 줄어든다.
- 개인 답변과 지원 전략이 공개 산출물에 그대로 노출되는 일을 막는다.
