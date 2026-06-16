## ADR-069 — config는 정책·타깃·예외만 남기고 자산 목록은 파생한다

- Status: Accepted
- Date: 2026-06-08

### 맥락

career-os의 `config/`는 처음에는 사람이 큐레이션한 입력을 모으는 단순한 위치였지만, 여러 plan을 거치며 학습 토픽 목록, 후보 reservoir, topic-file map, live-coding seed, 질문 bank topic이 함께 쌓였다.

실제 학습 자산은 `sources/fos-study/`에 누적되는데 별도 config JSON에도 같은 목록이 존재하면 두 가지 문제가 생긴다.

- fos-study에 새 문서가 생겨도 config topic 목록을 따로 갱신해야 한다.
- config가 "운영 정책"인지 "자산 DB"인지 불명확해진다.

### 결정

- `config/`는 정책, 현재 타깃, 후보자 baseline, 사람이 명시적으로 고른 예외만 보관한다.
- 실제 학습 문서 목록은 `sources/fos-study/` 파일 트리에서 파생한다.
- 공개 가능 일반 질문 목록은 `public/question-bank/`에서 파생한다.
- 대량 topic/reservoir JSON은 정리 대상이며, curated override/seed/guardrail/pin 목록으로 축소한다.
- 추천기는 config 목록 순회 방식에서 실제 자산 목록을 읽고 config override로 가중치를 조정하는 방식으로 이동한다.
- config cleanup은 한 번에 파괴적으로 진행하지 않는다.
  reader inventory, fallback path, 검증 명령을 고정하고 phase 단위로 줄인다.

### 결과

- 공부 자산의 단일 진실 출처가 `sources/fos-study/`로 선명해진다.
- config drift와 2중 관리가 줄어든다.
- 새 공부팩이나 질문 bank 보강이 config 수동 편집 없이 추천 흐름에 반영된다.
- config는 "무엇을 어떻게 우선할지"만 담고, "무엇이 존재하는지"는 파일 트리와 validator가 판단한다.
