# 공개 질문 은행 보강

이 참고 문서는 `interview-practice`가 공개 가능한 일반 backend·CS 면접 질문을 `public/question-bank/`에 추가하거나 고칠 때만 읽는다.
일반 답변 연습에서는 읽지 않는다.
포지션별 질문은 해당 지원 디렉터리의 `interview-questions.json`에서 관리한다.
외부 자료에서 질문 후보를 수집할 때는 먼저 `source-discovery.md`를 읽는다.

## 보강 대상 카테고리

- `java-spring` — Java/Spring 기술 면접 질문
- `database` — DB/쿼리/트랜잭션 기술 면접 질문
- `cs` — 운영체제/네트워크/자료구조 등 CS 기초 질문
- `operations` — 배포/모니터링/인프라 운영 질문
- `system-design` — 시스템 설계 질문
- `ai-platform` — RAG, 검색, Agent, Tool, 모델 서빙과 AI Platform 질문
- `behavioral` — STAR 형식 경험 공유, 협업, 성장, 가치관 등 일반 인성 질문.
  개인 답변, 지원 전략, 회사별 비공개 맥락은 넣지 않는다.
  개인 맞춤 질문과 포지션별 질문은 이 스킬의 책임이 아니다.
  공식 채용 안내와 컬처 자료를 `sources.json`에 등록하고, public-safe 일반 질문으로 정규화 가능한 항목만 `public/question-bank/behavioral/questions.json`에 누적한다.

## 작업 범위

- 일반 답변 연습이면 기존 질문 풀을 사용하고 `public/question-bank/`를 수정하지 않는다.
- 공개 질문 보강 요청이면 `public/question-bank/`만 수정한다.
- 포지션 맞춤 요청이면 공고, 지원 패키지와 제출 문서에서 질문을 만들고 해당 지원 디렉터리만 수정한다.
- private 답변, 회사별 지원 전략, 유료 자료 원문은 추가하지 않는다.

## 입력

- `public/question-bank/README.md`
- `public/question-bank/sources.json`
- `public/question-bank/{java-spring,database,cs,operations,system-design,behavioral}/questions.json`
- `scripts/question-bank-collector/validate.ts`의 `scanQuestionBankInventory()` 결과.
  공개 질문 은행의 실제 파일을 검사한다.
- 필요한 경우 공개 가능한 기존 study topic 이름.

## 소스 수집 원칙

질문 bank 보강 요청은 기존 bank만 재배열하지 않고 요청 범위에 맞는 공식 소스를 함께 확인한다.
기술 질문은 공식 표준, 제품 문서와 프로젝트 문서를 근거로 삼는다.
인성 질문은 회사가 직접 공개한 채용 안내와 컬처 자료를 근거로 삼는다.
공개 후기나 개인 회고는 질문 후보를 찾는 데만 참고하며 canonical 출처로 등록하지 않는다.
특정 회사 표현은 제거하고 여러 포지션에서 쓸 수 있는 질문으로 바꾼다.
웹 근거가 필요한 경우 실행 환경의 웹 검색 도구를 먼저 사용하고, 검색 품질이 낮거나 원문 접근이 막힐 때만 검색엔진 결과 페이지나 직접 원문 HTML 확인을 보조 수단으로 사용한다.
검색 결과 스니펫만으로 질문을 확정하지 않고, 접근 가능한 원문이나 공식 페이지를 별도 근거로 표시한다.

질문의 `source`는 `sources.json`에 등록된 식별자만 사용한다.
새 출처를 쓰면 같은 변경에서 공식 URL, 게시자, 확인일, 적용 범위와 정규화 방식을 등록한다.
확인일은 실제 원문을 연 날짜를 `YYYY-MM-DD`로 기록한다.
질문 항목은 원문 위치를 뜻하지 않고, 해당 질문을 검증할 공식 참조 묶음을 가리킨다.

## 공개 질문 보강 흐름

1. 요청 범위를 category와 약점 tag로 나눈다.
2. `scanQuestionBankInventory()` 또는 동등한 public bank scan으로 기존 bank를 읽고 중복 id와 중복 질문을 피한다.
3. 요청 범위에 맞는 공식 원문을 열어 URL과 확인일을 검증한다.
4. 질문을 단순 암기형 원문이 아니라 backend 실무형 질문으로 정규화한다.
5. 재사용할 출처가 없으면 `sources.json`에 검증 가능한 공식 참조 묶음을 추가한다.
6. 각 항목에 category, difficulty, question, intent, answerSignals, source, publicSafe, positionFitHint, normalizedFrom, tags, followUps를 채운다.
   목표 수준을 구분해야 하면 `bar`도 기록한다.
7. public bank만 보강하는 요청이면 `public/question-bank/`만 수정한다.
8. 보강 후 `bun career-os/scripts/question-bank-collector/validate.ts`를 실행한다.

### behavioral 웹 수집 승격 규칙

`behavioral` 보강에서 웹 자료를 사용한 경우 다음 순서를 지킨다:

1. 웹 검색 도구로 공식 채용 안내와 컬처 자료를 확인한다.
2. 원문 URL, 게시자, 확인 날짜와 적용 범위를 `sources.json`에 남긴다.
3. 회사명이나 특정 후기 맥락을 제거해 어느 회사에도 쓸 수 있는 일반 질문으로 바꾼다.
4. `source`는 `sources.json`에 등록된 식별자를 사용한다.
5. 정규화된 질문은 `public/question-bank/behavioral/questions.json`에 누적한다.

## 질문 품질 기준

- 용어 정의만 묻지 않고 선택 기준, 제약, 실패 처리, 운영 영향 또는 검증 방법 중 하나 이상을 요구한다.
- `answerSignals`는 정답 단어 목록이 아니라 정확성, 판단, 위험과 확인 방법을 평가할 수 있어야 한다.
- `followUps`는 첫 답변의 암기 여부가 아니라 깊이, 반례와 실제 적용 경계를 확인한다.
- 특정 설정값이나 튜닝 공식을 보편적인 정답으로 단정하지 않는다.
- 수치가 없는 경험도 관측, 테스트, 사용자 피드백과 이후 변화로 검증할 수 있게 한다.
- 전체 질문 풀에서 한 카테고리만 반복 보강하지 않고 현재 부족한 기술 범위와 난도를 우선한다.
- 한 질문의 꼬리질문이 명확화에만 머물지 않고 판단, 반례, 운영과 근거 경계까지 이어지는지 확인한다.

## 금지선

- `public/question-bank`에는 private 답변을 넣지 않는다.
- `public/question-bank`에는 지원 전략을 넣지 않는다.
- `public/question-bank`에는 회사별 비공개 맥락을 넣지 않는다.
- 현재 직장, 목표 회사와 개인 경력 수준을 `public/question-bank`에 넣지 않는다.
- 개인 이력 세부사항을 public bank에 넣지 않는다.
- 유료 강의, 문제집, 면접 후기 원문을 복사하지 않는다.
- 공고, 개인 경험과 회사별 전략에서 포지션 질문을 만들지 않는다.

## 검증

변경 뒤 다음 명령을 실행한다.

```bash
bun career-os/scripts/question-bank-collector/validate.ts
git diff --check
git status --short sources/fos-study
```

sensitive grep 결과는 사람이 확인한다.
README나 skill의 금지 문구는 허용되지만, 실제 private 내용이면 실패로 본다.
