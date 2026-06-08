# 공개 질문 bank

일반 backend/CS 면접 질문을 공개 가능한 형태로 모아 두는 저장소다.
포지션별 준비 정본은 `private/<company>/<position>/interview/prep.md`이며, 이 bank는 그곳으로 선별 반영할 원천 질문만 담는다.

## 카테고리

- `java-spring/` — Java, Spring, JVM, HTTP API 구현 질문.
- `database/` — RDB, transaction, index, JPA, MyBatis, Redis, cache 질문.
- `cs/` — Network, OS, 자료구조, 알고리즘 기초 질문.
- `operations/` — 장애 대응, 배포, 로그, metric, tracing, 운영 자동화 질문.
- `system-design/` — backend architecture, 확장성, consistency, queue, storage 설계 질문.

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
- `positionFitHint`: private prep.md로 선별할 때 참고할 적합도 힌트.
- `normalizedFrom`: 원문 복사가 아니라 어떤 축으로 정규화했는지 적는 메모.
- `tags`: 약점 기반 질문 재선별에 쓸 일반 태그.
- `followUps`: 꼬리 질문 후보.

## 경계

- `public/question-bank/`에는 private 답변, 포지션별 지원 전략, 회사별 비공개 맥락, 개인 이력 세부사항을 넣지 않는다.
- 유료 강의, 문제집, 면접 후기 원문을 복사하지 않는다.
- 공개 가능한 일반 지식으로 직접 재작성하고, 원문을 보존해야 하는 자료는 이 경로에 넣지 않는다.
- `sources/fos-study/`로 자동 발행하지 않는다.
  공개 글이 필요하면 별도 요청과 검수 뒤 public-safe 문서로 재작성한다.
- private prep.md에 반영할 때는 질문, 의도, 평가 포인트, 태그만 가져간다.
  답변 전문과 회사별 전략은 private 파일 안에서만 작성한다.

## 검증

반복 보강 뒤 다음 명령으로 구조와 금지선을 확인한다.

```bash
bun scripts/question-bank-collector/validate.ts
```

validator는 필수 필드, 중복 id, 중복 질문, 카테고리 구조, private 금지어, 원문 복사 위험 문구를 검사한다.
