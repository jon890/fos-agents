## ADR-097 — question-bank 정본을 public으로 1원화하고 개인 질문은 private에 둔다

- Status: Accepted
- Date: 2026-06-17

### 맥락

질문 자산이 두 경로로 갈라져 있었다.

- `public/question-bank/` (ADR-066, plan065) — 공개 가능 일반 backend/CS 질문 정본. 카테고리별 디렉터리 + `questions.json`. `interview-asset-writer`, `question-bank-collector`가 소비한다.
- `data/question-bank/` (plan086) — 드릴 런타임 질문 풀. `tech-questions.jsonl`, `behavioral-questions.jsonl`. 드릴 엔진이 소비한다.

plan086에서 드릴을 만들 때 이미 있던 `public/question-bank` 정본을 재사용하지 않고 드릴용 질문 풀을 따로 만든 것이 원인이다.
그 결과 세 가지 문제가 생겼다.

- 기술 질문이 두 곳에 중복으로 존재한다 (예: database 카테고리가 양쪽에 있다).
- behavioral 질문은 public 범위 밖이라 정본 없이 `data/`에만 있었다.
- 이름이 같아(`question-bank`) 어느 쪽이 정본인지 혼란스럽다.

드릴의 간격 반복(Spaced Repetition)은 `config/study-progress.json`의 `weak_spots`를 `topic` 키로 추적한다.
이 `topic` 키는 드릴뿐 아니라 `study-topic-recommender`도 공유하는 career-os 전체 약점 추적 식별자다.
하지만 public 질문 스키마에는 `topic` 필드가 없어 드릴이 public 정본을 직접 쓸 수 없었다.

또한 일반 인성 질문(STAR·협업·성장)은 질문 본문 자체는 공개 가능하지만,
후보자 이력 기반 개인 STAR 질문과 회사별 예상 질문은 공개할 수 없다.
공개 일반 질문과 개인 맞춤 질문의 정본 경계가 필요하다.

### 결정

- 질문 정본은 `public/question-bank/` 하나로 1원화한다. `data/question-bank/` 질문 풀은 폐기한다.
- public 질문 스키마에 `topic` 필드를 추가한다.
  `topic`은 `weak_spots` 키이자 드릴·`study-topic-recommender`·공부팩이 공유하는 약점 추적 키다.
- `public/question-bank/`에 behavioral 카테고리를 신설한다.
  일반 STAR·협업·성장 질문 본문만 두고, 개인 답변·회사별 맥락은 넣지 않는다.
- 개인 맞춤 질문은 git 무시 경로(`**/private/`)에 정본을 분리해 둔다.
  - `private/question-bank/behavioral-personal.jsonl` — 후보자 이력 기반 개인 STAR 질문.
  - `private/question-bank/tech-personal.jsonl` — 후보자 경험 기반 기술 심화 질문.
- 드릴은 public(일반) 정본과 private(개인) 정본을 합쳐 질문 풀을 구성한다.
  public·private 질문 모두 `topic` 키로 같은 `weak_spots`를 추적한다.
- 개인 질문 생성 주체는 `interview-asset-writer`다.
  `candidate-profile.md` 기반으로 개인 질문을 파생해 private 정본에 저장하고,
  드릴 중 사용자가 즉석 생성을 요청하는 경로도 둔다.
- `question-bank-collector`는 behavioral 카테고리도 보강 대상에 포함한다.
- public·private 경계는 기존 정책을 유지한다.
  개인 답변, 지원 전략, 회사별 비공개 맥락은 `public/question-bank/`에 넣지 않는다.

### 결과

- 질문 정본이 한 곳으로 모여 중복과 이름 혼란이 사라진다.
- 드릴·자산 생성·질문 수집 스킬이 같은 정본을 읽는다.
- `topic` 필드로 질문·약점·추천·공부팩이 같은 키로 맞물린다.
- 일반 질문은 공개 자산으로 쌓이고, 개인 맞춤 질문은 비공개 정본으로 분리 관리된다.
- ADR-066은 그대로 유효하며, 본 ADR은 정본 1원화, `topic` 필드, behavioral 카테고리, 개인 질문 경계를 더한다.
- plan086이 만든 `data/question-bank/` 질문 풀과 드릴 엔진의 로드 경로는 본 결정으로 대체된다.
