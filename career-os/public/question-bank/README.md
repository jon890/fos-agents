# 공개 질문 bank

일반 backend/CS 면접 질문을 공개 가능한 형태로 모아 두는 저장소다.
포지션별 질문은 `application-package-writer`가 공고별 `interview-questions.json`에 만든다.
이 질문 은행은 여러 포지션에서 다시 쓸 수 있는 공개 가능한 일반 질문만 담는다.

## 카테고리

- `java-spring/` — Java, Spring, JVM, HTTP API 구현 질문.
- `database/` — RDB, transaction, index, JPA, MyBatis, Redis, cache 질문.
- `cs/` — Network, OS, 자료구조, 알고리즘 기초 질문.
- `operations/` — 장애 대응, 배포, 로그, metric, tracing, 운영 자동화 질문.
- `system-design/` — backend architecture, 확장성, consistency, queue, storage 설계 질문.
- `behavioral/` — 협업, 성장, 커뮤니케이션, 오너십 등 인성·역량 면접 질문.
  웹 수집 자료에서 public-safe로 정규화한 일반 인성 질문도 이 경로에 누적한다.

## 항목 형식

각 카테고리 seed 파일은 JSON 배열이다.
항목은 다음 필드를 가진다.

- `id`: 카테고리 prefix를 포함한 고유 id.
- `category`: 디렉터리 이름과 같은 카테고리.
- `difficulty`: `basic`, `intermediate`, `advanced` 중 하나.
- `question`: 면접에서 물어볼 질문.
- `intent`: 질문 의도.
- `answerSignals`: 좋은 답변에서 기대하는 평가 포인트.
- `source`: 공개 가능한 일반 지식 출처 표시.
- `publicSafe`: 공개 가능 여부.
- `positionFitHint`: 포지션 연습에서 공통 질문을 고를 때 참고할 적합도 힌트.
- `normalizedFrom`: 원문 복사가 아니라 어떤 축으로 정규화했는지 적는 메모.
- `topic`: 질문이 다루는 개념 단위다.
  - kebab-case를 사용한다.
  - 드릴 진행 상태와 같은 topic 식별자를 사용한다.
- `tags`: 약점 기반 질문 재선별에 쓸 일반 태그.
- `followUps`: 꼬리 질문 후보.

## 출처 레지스트리

`sources.json`은 질문의 공개 근거를 관리하는 단일 소스다.
각 질문의 `source`는 레지스트리에 등록된 식별자를 가리킨다.
레지스트리는 다음 정보를 가진다.

- `id`: 질문 항목이 참조하는 고유 식별자.
- `sourceType`: 공식 기술 참조 묶음 또는 공식 채용 안내.
- `checkedAt`: 원문 URL을 실제로 확인한 날짜.
- `scope`: 이 출처 묶음이 검증하는 질문 범위.
- `normalizationNote`: 원문을 실무형 질문으로 바꾼 방식.
- `references`: 제목, 게시자와 HTTPS 원문 URL.

`source`는 질문을 그대로 가져온 단일 페이지를 뜻하지 않는다.
질문을 원문 그대로 복사하지 않고 공식 문서의 개념과 평가 방향을 확인할 수 있는 참조 묶음을 가리킨다.

## 수집 원칙

질문 보강은 기존 bank만 재배열하지 않고 공식 원문을 함께 확인한다.
기술 질문은 공식 표준, 제품 문서와 프로젝트 문서를 근거로 삼는다.
인성 질문은 회사가 직접 공개한 채용 안내와 컬처 자료를 근거로 삼는다.
공개 후기와 개인 회고는 후보 탐색에만 참고하며 공식 참조 묶음을 대체하지 않는다.

## 경계

- `public/question-bank/`에는 private 답변, 포지션별 지원 전략, 회사별 비공개 맥락, 개인 이력 세부사항을 넣지 않는다.
- 유료 강의, 문제집, 면접 후기 원문을 복사하지 않는다.
- 공개 가능한 일반 지식으로 직접 재작성하고, 원문을 보존해야 하는 자료는 이 경로에 넣지 않는다.
- `sources/fos-study/`로 자동 발행하지 않는다.
  공개 글이 필요하면 별도 요청과 검수 뒤 public-safe 문서로 재작성한다.
- 포지션별 질문과 답변 전문, 회사별 전략은 이 공개 질문 은행에 넣지 않는다.

## 검증

반복 보강 뒤 다음 명령으로 구조와 금지선을 확인한다.

```bash
bun career-os/scripts/question-bank-collector/validate.ts
```

validator는 필수 필드, 중복 id, 중복 질문, 카테고리 구조, private 금지어와 원문 복사 위험 문구를 검사한다.
또한 모든 질문의 출처 등록 여부, 확인일 형식, HTTPS URL과 쓰이지 않는 출처를 검사한다.
