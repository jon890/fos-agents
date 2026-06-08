---
name: question-bank-collector
description: 일반 backend 질문, CS 질문 수집, 면접 질문 bank, 질문 뱅크 보강, 약점 기반 질문 재선별, Java/Spring/DB/운영 질문 모아줘 같은 요청을 처리하는 public-safe question bank collector. career-os public/question-bank에 Java/Spring, database, CS, operations, system-design 질문을 정규화하고 private 답변, 지원 전략, 회사별 비공개 맥락, 유료 강의/문제집/면접 후기 원문, fos-study 자동 발행을 금지한다.
---

# Question Bank Collector

공개 가능한 일반 backend/CS 면접 질문을 `public/question-bank/`에 모으고 보강하는 native skill이다.
private 포지션 준비 정본은 `private/<company>/<position>/interview/prep.md`이며, 이 skill은 public bank와 private prep 경계를 분리한다.

## When To Use

다음 trigger 문구가 있으면 이 skill을 사용한다.

- 일반 backend 질문
- CS 질문 수집
- 면접 질문 bank
- 질문 뱅크 보강
- 약점 기반 질문 재선별
- Java/Spring/DB/운영 질문 모아줘

비슷한 표현도 이 skill로 라우팅한다.
예: "Spring/DB 면접 질문 모아줘", "운영 질문 seed 보강", "system design 질문 bank 정리".

## 입력

- `public/question-bank/README.md`
- `public/question-bank/{java-spring,database,cs,operations,system-design}/questions.json`
- 필요한 경우 공개 가능한 기존 study topic 이름.
- 포지션 맞춤 선별을 명시한 경우에만 `private/<company>/<position>/interview/prep.md`.

## 작업 흐름

1. 요청 범위를 category와 약점 tag로 나눈다.
2. 기존 bank를 읽고 중복 id와 중복 질문을 피한다.
3. 질문을 단순 암기형 원문이 아니라 backend 실무형 질문으로 정규화한다.
4. 각 항목에 category, difficulty, question, intent, answerSignals, source, publicSafe, positionFitHint, normalizedFrom, tags, followUps를 채운다.
5. public bank만 보강하는 요청이면 `public/question-bank/`만 수정한다.
6. 포지션 맞춤 선별을 명시한 요청이면 public bank에서 질문, 의도, 평가 포인트, tag만 골라 `private/<company>/<position>/interview/prep.md`에 반영한다.
7. 보강 후 `bun scripts/question-bank-collector/validate.ts`를 실행한다.

## 금지선

- `public/question-bank`에는 private 답변을 넣지 않는다.
- `public/question-bank`에는 지원 전략을 넣지 않는다.
- `public/question-bank`에는 회사별 비공개 맥락을 넣지 않는다.
- 개인 이력 세부사항을 public bank에 넣지 않는다.
- 유료 강의, 문제집, 면접 후기 원문을 복사하지 않는다.
- fos-study 자동 발행을 하지 않는다.
- `sources/fos-study`를 수정하지 않는다.
- 범용 chat UI/API를 되살리지 않는다.

## 약점 기반 재선별

약점 기반 질문 재선별 요청은 public bank의 `tags`, `difficulty`, `category`, `positionFitHint`를 기준으로 고른다.
최근에 이미 답변이 정리된 주제나 낮은 우선순위 주제는 감점한다.
최종 반영 위치가 private prep.md라면 public 항목의 질문과 평가 포인트만 가져가고, 답변 전문과 회사별 전략은 private 파일 안에서만 작성한다.

## 검증

변경 뒤 다음 명령을 실행한다.

```bash
bun scripts/question-bank-collector/validate.ts
git diff --check
git status --short sources/fos-study
```

sensitive grep 결과는 사람이 확인한다.
README나 skill의 금지 문구는 허용되지만, 실제 private 내용이면 실패로 본다.
