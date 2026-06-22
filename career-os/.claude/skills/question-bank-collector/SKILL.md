---
name: question-bank-collector
description: 공개 가능한 일반 backend/CS 면접 질문을 career-os public/question-bank에 모으고 보강하는 public-safe question bank collector. "일반 backend 질문", "CS 질문 수집", "면접 질문 bank", "질문 뱅크 보강", "약점 기반 질문 재선별", "Java/Spring/DB/운영 질문 모아줘", "system design 질문 bank", "Spring/DB 면접 질문"처럼 공개 질문 bank를 정규화하거나 private prep에 질문을 선별 반영해야 할 때 사용. private 답변, 지원 전략, 회사별 비공개 맥락, 유료 강의/문제집/면접 후기 원문, fos-study 자동 발행은 금지한다.
---

# Question Bank Collector

공개 가능한 일반 backend/CS 면접 질문을 `public/question-bank/`에 모으고 보강하는 agent skill이다.
private 포지션 준비 정본은 `private/<company>/<position>/interview/prep.md`이며, 이 skill은 public bank와 private prep 경계를 분리한다.

## 보강 대상 카테고리

- `java-spring` — Java/Spring 기술 면접 질문
- `database` — DB/쿼리/트랜잭션 기술 면접 질문
- `cs` — 운영체제/네트워크/자료구조 등 CS 기초 질문
- `operations` — 배포/모니터링/인프라 운영 질문
- `system-design` — 시스템 설계 질문
- `behavioral` — STAR 형식 경험 공유, 협업, 성장, 가치관 등 일반 인성 질문.
  개인 답변, 지원 전략, 회사별 비공개 맥락은 넣지 않는다.
  개인 맞춤 인성 질문은 `private/question-bank/behavioral-personal.jsonl` 정본(interview-asset-writer 담당).
  웹에서 수집한 면접 후기나 회사별 자료는 먼저 `data/runtime/behavioral-interview-web-source-scan-YYYY-MM-DD.md`에 출처와 신뢰도를 남기고, public-safe 일반 질문으로 정규화 가능한 항목만 `public/question-bank/behavioral/questions.json`에 누적한다.

## 호출 후 범위 해석

- public bank 보강 요청이면 `public/question-bank/`만 수정한다.
- 포지션 맞춤 선별을 명시한 경우에만 public bank에서 골라 private prep에 반영한다.
- private 답변, 회사별 지원 전략, 유료 자료 원문은 추가하지 않는다.

## 입력

- `public/question-bank/README.md`
- `public/question-bank/{java-spring,database,cs,operations,system-design,behavioral}/questions.json`
- `scripts/question-bank-collector/validate.ts`의 `scanQuestionBankInventory()` 결과.
  public/question-bank inventory 정본이며, `config/question-bank-topics.json`을 정본으로 사용하지 않는다.
- 필요한 경우 공개 가능한 기존 study topic 이름.
- 포지션 맞춤 선별을 명시한 경우에만 `private/<company>/<position>/interview/prep.md`.

## 소스 수집 원칙

질문 bank 보강 요청은 기존 bank만 재배열하지 않고, 요청 범위에 맞는 공개 소스를 함께 확인한다.
기본 소스는 한 종류에 치우치지 않게 섞는다:

- 공식 문서와 공식 기술 블로그.
- 공식 채용·커리어·컬처 페이지.
- 공개 채용 플랫폼의 면접 후기와 질문 목록.
- 개발자 개인 회고, 공개 커뮤니티, 컨퍼런스·기술 발표 자료.

기술 질문은 공식 문서와 검증 가능한 기술 자료를 우선 근거로 삼는다.
인성 질문은 공식 채용·컬처 자료와 공개 면접 후기를 함께 보되, 질문 의도와 평가 포인트만 정규화한다.
IT 기업 자료를 수집할 때는 네이버, 카카오, LINE, 쿠팡, 토스, 우아한형제들 등 국내 IT 기업 후기와 공식 채용 자료를 우선 후보로 삼고, 특정 회사 하나에 과적합하지 않게 일반 질문으로 바꾼다.
웹 근거가 필요한 경우 실행 환경의 웹 검색 도구를 먼저 사용하고, 검색 품질이 낮거나 원문 접근이 막힐 때만 검색엔진 결과 페이지나 직접 원문 HTML 확인을 보조 수단으로 사용한다.
검색 결과 스니펫만으로 질문을 확정하지 않고, 접근 가능한 원문이나 공식 페이지를 별도 근거로 표시한다.

## 작업 흐름

1. 요청 범위를 category와 약점 tag로 나눈다.
2. `scanQuestionBankInventory()` 또는 동등한 public bank scan으로 기존 bank를 읽고 중복 id와 중복 질문을 피한다.
3. 요청 범위에 맞는 공개 소스를 수집하고 출처별 신뢰도를 나눈다.
4. 질문을 단순 암기형 원문이 아니라 backend 실무형 질문으로 정규화한다.
5. 각 항목에 category, difficulty, question, intent, answerSignals, source, publicSafe, positionFitHint, normalizedFrom, tags, followUps를 채운다.
6. public bank만 보강하는 요청이면 `public/question-bank/`만 수정한다.
7. 포지션 맞춤 선별을 명시한 요청이면 public bank에서 질문, 의도, 평가 포인트, tag만 골라 `private/<company>/<position>/interview/prep.md`에 반영한다.
8. 보강 후 `bun scripts/question-bank-collector/validate.ts`를 실행한다.

### behavioral 웹 수집 승격 규칙

`behavioral` 보강에서 웹 자료를 사용한 경우 다음 순서를 지킨다:

1. 웹 검색 도구로 공식 채용/회사소개, 채용 플랫폼, 공개 개인 회고를 먼저 확인한다.
2. 원문 URL, 확인 날짜, 신뢰도, 반복 질문 테마를 런타임 수집 파일에 남긴다.
3. 회사명이나 특정 후기 맥락을 제거해 어느 회사에도 쓸 수 있는 일반 질문으로 바꾼다.
4. `source`는 `public-web-behavioral-source-scan`처럼 `public-` prefix를 사용한다.
5. 정규화된 질문은 `public/question-bank/behavioral/questions.json`에 누적한다.

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
