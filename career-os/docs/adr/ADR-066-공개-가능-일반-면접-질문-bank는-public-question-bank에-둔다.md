## ADR-066 — 공개 가능 일반 면접 질문 bank는 public/question-bank에 둔다

- Status: Accepted
- Date: 2026-06-08

### 맥락

일반적인 Java/Spring, DB, CS, 운영, System design 질문을 꾸준히 모아야 하지만,
`data/`는 gitignore 대상이라 공개 가능하고 재사용 가능한 질문 bank를 보관하기에 적합하지 않다.
private 지원/면접 맥락과 분리된 공개 가능 자산 위치가 필요하다.

### 결정

- 공개 가능 일반 질문 bank는 `public/question-bank/` 아래에 두고 git 추적한다.
- `public/question-bank/`는 private 지원/면접 맥락을 포함하지 않으며 하위 범위는 java-spring, database, cs, operations, system-design이다.
- 질문 항목은 단순 암기 질문을 그대로 저장하지 않고 backend 실무형으로 정규화한다.
- private 포지션 맞춤 질문은 `private/<company>/<position>/interview/prep.md`에 선별 반영한다.
- 공개 글로 발행할 때만 `sources/fos-study/`로 복사 또는 재작성한다. `public/question-bank`는 공개 가능 원천이지만 자동 발행 대상은 아니다.
- `question-bank-collector` skill을 추가하고, 수집기는 raw 후보를 만든 뒤 normalizer가 중복 제거와 실무형 변환을 수행한다.

### 결과

- 일반 backend/CS 질문이 git 추적 가능한 공개 가능 자산으로 쌓인다.
- private 지원 맥락과 public-safe 질문 bank의 경계가 선명해진다.
- fos-study 발행은 검수된 질문/해설만 별도 초안으로 진행할 수 있다.
