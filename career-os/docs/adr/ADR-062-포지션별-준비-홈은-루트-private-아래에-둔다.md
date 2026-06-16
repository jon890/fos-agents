## ADR-062 — 포지션별 준비 홈은 루트 private 아래에 둔다

- Status: Accepted
- Date: 2026-06-08

### 맥락

CJ푸드빌 면접 준비가 dashboard, markdown 보기, 질문 선택, 답변 피드백으로 이어지면서 회사·포지션별 자료가 기능별 경로에 흩어졌다.
초기 정리는 `data/<company>/<position>` 형태였지만, 이 경로는 runtime, report, cache, queue 같은 시스템 데이터와 포지션별 작업 자료의 의미를 섞는다.

사용자는 포지션 준비 자료가 외부 공개 전 작업물이라는 점이 경로에서 바로 드러나길 원했다.
동시에 `private`를 절대 공개 금지 금고로 과도하게 해석하면, 여기서 출발한 순수 기술 공부팩을 `sources/fos-study/`에 발행하는 정상 흐름까지 막을 수 있다.

### 결정

- 회사·포지션별 active 준비 홈은 `private/<company-slug>/<position-slug>/`에 둔다.
- `config/mvp-target.json`의 `primary.data_root`를 정본 경로로 사용하고, dashboard와 자동화는 이 경로를 따른다.
- 면접 질문 정본을 runtime/report 경로에 중복 유지하지 않는다.
- 구조 전환으로 대체된 legacy runtime/report는 archive 없이 삭제할 수 있다.
- 새 코드는 legacy fallback을 추가하지 않는다. 필요한 호환은 일회성 migration으로 끝낸다.
- `private/`는 공개 전 작업 홈이다. 개인 답변, 지원 전략, 회사별 민감 맥락을 그대로 공개 경로에 복사하지 않는다.
- 공개 가능한 기술 공부팩은 private 내용을 재가공해 `sources/fos-study/`에 따로 작성할 수 있다.

### 결과

- 포지션별 준비 자료와 시스템 runtime/report의 경계가 명확해진다.
- dashboard는 `data_root` 하나를 따라가면 현재 포지션의 면접 연습, report, study 자료를 찾을 수 있다.
- legacy fallback을 제거해 경로 drift와 중복 산출물이 줄어든다.
- 공개 공부팩 발행 흐름은 유지하되, 개인 답변과 지원 전략이 그대로 공개되는 일은 막는다.
