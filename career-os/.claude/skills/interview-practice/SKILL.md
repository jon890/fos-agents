---
name: interview-practice
description: 기술·인성·포지션별 면접 질문을 준비하고 한 번에 하나씩 연습하며, 답변 평가와 복습 상태를 관리하는 career-os 스킬. "면접 준비", "면접 연습", "기술 면접 질문", "인성 면접 답변", "STAR 연습", "모의 질문", "약점 복습", "질문 은행 보강", "Java/Spring/DB/운영 질문 모아줘"처럼 질문 준비·수집·연습이 필요할 때 사용한다. 공개 질문 보강은 내부 유지보수 절차로 처리한다.
---

# 면접 준비와 답변 연습

사용자가 먼저 답하고 에이전트가 근거, 구조와 표현을 보강한다.
완성 답변을 먼저 써 주거나 단계별 준비 문서를 별도로 만들지 않는다.

## 작업 유형

- 답변 연습: 기술 또는 인성 질문을 고르고 답변을 평가해 복습 상태에 반영한다.
- 포지션 질문 준비: 공고 책임, 이력서 근거 방어와 경험 공백에서 해당 지원 건의 질문을 만들거나 갱신한다.
- 공개 질문 보강: 사용자가 일반 질문 수집·보강을 요청했을 때만 `references/question-bank-maintenance.md`를 읽고 공개 질문 은행을 수정한다.
- 외부 질문 후보 수집: 기술 블로그, YouTube와 GitHub 자료까지 탐색할 때 `references/source-discovery.md`를 함께 읽는다.

일반 연습에서는 공개 질문 은행을 자동으로 수정하지 않는다.
관련 공개 질문이 부족해도 현재 지원 질문과 개인 질문이 있으면 그대로 연습을 이어간다.
세 범위의 질문 묶음이 모두 비었을 때만 최소한의 공식 공개 질문을 보강한 뒤 연습을 이어간다.

## 입력과 모드

- `mode=tech`: Java·Spring, 데이터베이스, CS, 운영, 시스템 설계 질문
- `mode=behavioral`: 협업, 문제 해결, 실패, 고객 영향, 가치관 질문
- private brain의 현재 지원 대상: 포지션별 연습을 요청했으면 `brain-search`로 확인
- `applications/<company>/<role>/interview-questions.json`: 공고 책임, 근거 방어와 경험 공백 질문
- `state/drill-progress.json`: 질문별 복습 상태

사용자가 모드를 정하지 않았고 의도가 불분명할 때만 기술 또는 인성 중 하나를 묻는다.
질문 수를 정하지 않으면 다섯 개를 고른다.

현재 직장과 경력 수준은 private brain에서 찾는다.
회사 이름을 공개 질문에 기록하거나 회사 서열만으로 난도를 정하지 않는다.
공고의 문제 규모, 소유권, 여러 팀에 미치는 영향과 운영 책임을 보고 `production`, `large-scale`, `global-scale` 중 목표 수준을 정한다.
`production`과 `large-scale` 목표에서는 해당 수준과 한 단계 높은 질문만 선별한다.
`global-scale` 목표에서는 `large-scale`의 기반 질문과 `global-scale` 질문을 함께 다룬다.
선별한 묶음에 가능한 경우 한 단계 높은 확장 질문을 하나 포함한다.

## 포지션 질문 준비

현재 지원 대상이 있으면 공고, `application-package.md`, 최신 이력서와 경력기술서에서 질문을 만든다.
질문은 다음 출처를 구분한다.

- `posting_requirement`: 공고가 직접 요구하는 책임과 설계 판단
- `evidence_defense`: 제출 문서의 대표 경험을 방어하는 질문
- `experience_gap`: 직접 해보지 않은 영역과 모호한 근거를 확인하는 질문

질문마다 답변에서 확인할 신호와 `evidenceBoundary`를 기록한다.
공백 질문에는 경험을 꾸미는 모범 답안이 아니라 설계 원칙, 인접 근거와 학습 경계를 넣는다.

```bash
bun career-os/scripts/interview-drill/application_question_schema.ts \
  <application-directory>
```

## 질문 선택

현재 지원 대상이 있으면 brain에서 찾은 회사와 역할에 대응하는 지원 디렉터리를 확인한다.
다음 명령처럼 `--application-dir`를 명시해 공고별 질문을 공통 질문보다 우선한다.

```bash
bun career-os/scripts/interview-drill/drill-engine.ts tech \
  --application-dir career-os/applications/<company>/<role> \
  --target-bar <production|large-scale|global-scale>
```

현재 대상이 없거나 일반 연습을 요청했으면 `--application-dir`를 생략한다.
`scripts/interview-drill/drill-engine.ts`의 `selectQuestions(mode, progress, count, applicationDirectory, targetBar)`를 사용한다.
기술 질문은 `public/question-bank/{java-spring,database,cs,operations,system-design,ai-platform}/questions.json`, 인성 질문은 `public/question-bank/behavioral/questions.json`에서 읽는다.
`private/question-bank/{tech|behavioral}-personal.jsonl`이 있으면 함께 사용한다.
질문 풀이 비어 있으면 `references/question-bank-maintenance.md`를 읽고 요청 범위에 필요한 최소 공개 질문을 공식 자료에서 보강한 뒤 검증하고 연습을 이어간다.

현재 지원 대상이 있으면 공고와 회사 공식 자료에서 확인한 책임, 이력서 근거 방어와 명시한 경험 공백만 질문 순서와 후속 질문에 반영한다.
근거 없는 회사 기준이나 인터넷 후기를 평가 기준으로 단정하지 않는다.
다섯 문제 세션에서는 포지션 질문 세 개와 공통 기반 질문 두 개를 우선해 역할 적합도와 backend 기본기를 함께 확인한다.

## 꼬리질문

사용자의 첫 답변을 평가한 뒤 `scripts/interview-drill/follow-up-policy.ts`의 축을 사용한다.

- 충분한 답변: 선택 근거, 반례, 운영 상황과 근거 경계 순으로 최대 네 단계까지 깊게 묻는다.
- 얕은 답변: 용어와 전제를 명확히 한 뒤 선택 근거까지만 확인한다.
- 틀렸거나 답하지 못한 경우: 한 번 좁혀 묻고 같은 압박을 반복하지 않으며 학습 항목으로 전환한다.

미리 저장된 `followUps`는 후보일 뿐이다.
방금 답한 내용에서 빠진 전제나 모순을 우선해 한 번에 하나만 묻는다.
같은 답을 표현만 바꿔 반복하게 하지 않는다.
로그에는 원 질문, 부모 질문, 깊이, 확인 축과 중단 이유를 남긴다.

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
- 포지션별 질문은 해당 지원 디렉터리의 `interview-questions.json`에만 둔다.
- `sources/fos-study/`와 `config/candidate-profile.md`는 수정하지 않는다.
- 실제 면접 일정, 지원 전략과 회사별 비공개 정보는 공개 질문 은행에 넣지 않는다.
- 유료 강의, 문제집과 면접 후기의 질문·답변 원문을 공개 질문 은행에 복사하지 않는다.

## 참고 자료

- `references/behavioral-scoring.md`
- `references/question-bank-maintenance.md`: 공개 질문을 추가하거나 고칠 때만 읽는다.
- `references/source-discovery.md`: 외부 면접 자료를 수집하거나 질문 공백과 목표 수준을 보강할 때 읽는다.
- `scripts/interview-drill/drill-engine.ts`
- `public/question-bank/`
