## ADR-066 공개 가능 일반 면접 질문 bank는 public/question-bank에 둔다

- Status: Accepted
- Date: 2026-06-08

### 맥락

일반적인 Java/Spring, DB, CS, 운영, System design 질문을 꾸준히 모아야 하지만,
`data/`는 gitignore 대상이라 공개 가능하고 재사용 가능한 질문 bank를 보관하기에 적합하지 않다.
private 지원/면접 맥락과 분리된 공개 가능 자산 위치가 필요하다.

### 결정

- 공개 가능 일반 질문 bank는 `public/question-bank/` 아래에 두고 git 추적한다.
- `public/question-bank/`는 private 지원과 면접 맥락을 포함하지 않으며 하위 범위는 java-spring, database, cs, operations, system-design, behavioral이다.
- 질문 항목은 단순 암기 질문을 그대로 저장하지 않고 backend 실무형으로 정규화한다.
- 질문 출처는 `public/question-bank/sources.json`에서 공식 URL, 게시자, 확인일, 적용 범위와 정규화 방식을 관리한다.
- 각 질문의 `source`는 출처 레지스트리에 등록된 식별자만 사용한다.
- 포지션 맞춤 질문은 공고 책임, 지원 근거와 경험 공백에서 만들고 해당 `applications/<company>/<position>/interview-questions.json`에 둔다.
- 공개 글로 발행할 때만 `sources/fos-study/`로 복사 또는 재작성한다. `public/question-bank`는 공개 가능 원천이지만 자동 발행 대상은 아니다.
- 공개 질문 보강은 `interview-practice`의 필요할 때만 읽는 유지보수 참고 문서가 담당한다.
- 공개 범위, 출처와 질문 구조 검증은 `scripts/question-bank-collector/validate.ts`에 독립 모듈로 유지한다.

### 결과

- 일반 backend/CS 질문이 git 추적 가능한 공개 가능 자산으로 쌓인다.
- private 지원 맥락과 public-safe 질문 bank의 경계가 선명해진다.
- 질문마다 공식 참조와 마지막 확인일을 추적할 수 있다.
- 사용자는 `interview-practice` 하나로 포지션 질문 준비, 공개 질문 보강과 답변 연습을 이어갈 수 있다.
- 일반 답변 연습은 공개 질문 은행을 자동으로 수정하지 않는다.
- fos-study 발행은 검수된 질문/해설만 별도 초안으로 진행할 수 있다.
