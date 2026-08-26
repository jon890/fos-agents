---
name: interview-practice
description: 기술 또는 인성 면접 질문을 한 번에 하나씩 연습하고, 답변을 즉시 채점해 복습 상태에 반영하는 career-os 스킬. "면접 연습", "기술 면접 질문", "인성 면접 답변", "STAR 연습", "모의 질문", "약점 복습"처럼 실제 답변 연습이 필요할 때 사용한다. mode는 tech 또는 behavioral이며, 사용자가 정하지 않으면 질문 맥락으로 판단한다.
---

# 면접 답변 연습

사용자가 먼저 답하고 에이전트가 근거, 구조와 표현을 보강한다.
완성 답변을 먼저 써 주거나 단계별 준비 문서를 별도로 만들지 않는다.

## 입력과 모드

- `mode=tech`: Java·Spring, 데이터베이스, CS, 운영, 시스템 설계 질문
- `mode=behavioral`: 협업, 문제 해결, 실패, 고객 영향, 가치관 질문
- `state/current-target.json`: 있으면 현재 회사와 역할 맥락을 적용
- `state/drill-progress.json`: 질문별 복습 상태

사용자가 모드를 정하지 않았고 의도가 불분명할 때만 기술 또는 인성 중 하나를 묻는다.
질문 수를 정하지 않으면 다섯 개를 고른다.

## 질문 선택

`scripts/interview-drill/drill-engine.ts`의 `selectQuestions(mode, progress)`를 사용한다.
기술 질문은 `public/question-bank/{java-spring,database,cs,operations,system-design}/questions.json`, 인성 질문은 `public/question-bank/behavioral/questions.json`에서 읽는다.
`private/question-bank/{tech|behavioral}-personal.jsonl`이 있으면 함께 사용한다.
질문 풀이 비어 있으면 `question-bank-collector`로 공개 가능한 일반 질문을 보강하도록 안내하고 끝낸다.

현재 지원 대상이 있으면 공고와 회사 공식 자료에서 확인한 책임·가치만 질문 순서와 후속 질문에 반영한다.
근거 없는 회사 기준이나 인터넷 후기를 평가 기준으로 단정하지 않는다.

## 진행

1. 오늘 복습 대상, 신규 질문과 연습 개수를 짧게 알린다.
2. 질문을 한 번에 하나씩 보여주고 사용자의 답을 기다린다.
3. 답변 직후 `pass`, `shallow`, `fail`, `unknown` 중 하나로 판정한다.
4. 잘된 점 한 가지, 가장 큰 공백 한 가지, 더 강한 답변을 위한 후속 질문 한 가지를 준다.
5. 사용자가 보강해서 다시 답하면 새 답변을 기준으로 재평가한다.
6. `updateDrillProgress`와 `recordDrillLog`로 결과를 기록한다.
7. 마지막에 통과 수, 약한 주제와 다음 복습 우선순위를 요약한다.

사용자가 `모르겠어`라고 하면 `unknown`으로 기록하고 핵심 기준만 짧게 설명한 뒤 다음 질문으로 넘어간다.

## 채점

### 기술

질문의 `answerSignals`를 기준으로 정확성, 트레이드오프, 운영 영향과 본인 경험의 경계를 본다.
핵심 신호를 나열했다고 통과시키지 말고 왜 그런 선택을 하는지 설명할 수 있어야 한다.
직접 운영하지 않은 기술은 학습과 인접 경험으로 구분한다.

### 인성

`references/behavioral-scoring.md`를 읽는다.
상황보다 본인 행동과 판단, 확인 가능한 결과를 중점으로 본다.
회사 연결은 공식 기준이 확인된 경우에만 평가한다.

## 기록과 안전 경계

- 진행 상태: `state/drill-progress.json`
- 일별 기록: `state/drill-log-YYYY-MM-DD.jsonl`
- 기술과 인성은 `drillType`으로 구분한다.
- 개인 경험 기반 질문은 `private/question-bank/`에만 추가한다.
- `sources/fos-study/`와 `config/candidate-profile.md`는 수정하지 않는다.
- 실제 면접 일정, 지원 전략과 회사별 비공개 정보는 공개 질문 은행에 넣지 않는다.

## 참고 자료

- `references/behavioral-scoring.md`
- `scripts/interview-drill/drill-engine.ts`
- `public/question-bank/`
