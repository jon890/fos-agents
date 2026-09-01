---
name: application-package-writer
description: 공고 하나의 지원 가치, 회사·포지션 기준, 후보자 인터뷰, 경험 연결, 지원동기, 공백과 면접 검증 포인트를 준비하는 career-os 스킬. "이 공고 지원 준비", "지원서 준비", "지원 패키지", "지원동기 정리", "이 회사에 지원하고 싶어"처럼 개별 공고의 지원 전략이 필요할 때 사용한다. 이력서·경력기술서 작성과 검증은 resume-preparer로 연결한다. 실제 제출, 로그인과 외부 전송은 하지 않는다.
---

# 지원 준비

공고 하나에 지원할 이유와 승부처를 정하고, 지원 전략과 문구를 만든 뒤 제출 문서 준비로 연결한다.
사용자에게 문서 묶음을 떠넘기지 말고 `application-package.md`를 중심으로 현재 판단과 다음 행동을 설명한다.

## 비공개 작업본 동기화

[`career-workspace-sync.md`](../../../.claude/skills/_shared/career-workspace-sync.md)를 `SKILL_NAME=application-package-writer`로 적용한다.

## 사용자에게 주는 결과

사용자가 가장 먼저 볼 파일은 `application-package.md`다.
이 문서는 다음 질문에 한 화면 안에서 답해야 한다.

- 이 공고에 지원할 가치가 있는가?
- 회사와 팀은 어떤 사람을 찾고 있는가?
- 내 경험 중 무엇으로 승부할 수 있는가?
- 어떤 공백을 정직하게 설명해야 하는가?
- 이력서와 면접에서 무엇을 검증받아야 하는가?
- 다음 행동은 무엇인가?

`application-package.html`은 지원 판단, 근거, 제출 문서와 남은 질문을 묶어 보여주는 유일한 로컬 검토 화면이다.
실제 제출 파일은 `resume.pdf`다. 공고나 지원 화면이 경력기술서를 받으면 `career-description.pdf`를 추가하고, 한 파일만 받을 때는 두 문서를 합친 `submission.pdf`도 만든다.
지원 사이트가 별도 문항을 요구할 때만 application-answers.md를 추가한다.

## 입력

1. `applications/<company>/<role>/posting.md`
2. `brain-search`로 확인한 현재 경력, 역할 선호와 경험 경계
3. `sources/fos-study/`의 최신 공개 경력 자료와 관련 업무 근거
4. 필요하면 로컬 프로젝트의 코드, 테스트, Git 이력과 기술 결정 문서
5. `applications/<company>/<role>/candidate-interview.md`가 있으면 기존 답변

공고 경로가 없으면 `brain-search`로 private brain의 현재 지원 대상을 먼저 확인한다.
brain에서 찾은 회사와 역할에 대응하는 `applications/<company>/<role>/` 디렉터리를 사용한다.
brain에 현재 대상이 없거나 대응하는 지원 디렉터리가 없거나 둘 이상이면 임의로 선택하지 말고 정확히 한 가지 질문으로 대상을 확정한다.
`state/current-target.json`을 현재 대상의 기준으로 만들지 않는다.

## 실행 흐름

### 공고와 회사 기준 확인

공고 URL이 있으면 공식 페이지에서 현재 열려 있는지 다시 확인한다.
회사 인재상과 일하는 방식은 회사 공식 채용·회사 소개 자료만 사용한다.
일반적인 좋은 개발자 특성을 회사 기준처럼 쓰지 않는다.

공고에서 다음 내용을 분리한다.

- 실제로 맡을 문제와 사용자
- 필수 경험과 우대 경험
- 이력서 작성 안내와 채용 단계
- 팀이 강조하는 판단 방식과 운영 책임
- 공식 문화 기준 중 이 포지션의 판단과 행동을 실제로 구분하는 항목

확인 시각과 공식 URL을 `posting.md` 또는 `application-package.md`에 남긴다.

### 후보자 인터뷰

`references/candidate-interview-questions.md`를 읽는다.
이미 답한 내용은 다시 묻지 않고 `candidate-interview.md`에 누적한다.
한 번에 질문 하나만 던지며, 완성 문장 대신 키워드와 생각 조각을 받아도 된다.
질문할 때는 왜 후보자 확인이 필요한지, 어떤 제출 문장이나 면접 질문이 달라지는지 먼저 짧게 설명한다.

다음 네 항목이 확보되기 전에는 지원동기를 완성하지 않는다.

- 이 회사와 제품에 끌리는 구체적인 이유
- 입사 후 해결하고 싶은 사용자 문제
- 바로 기여할 수 있는 경험과 본인 역할
- 약한 영역과 보완 방법

대표 사례에는 후보자만 확정할 수 있는 다음 내용을 확인한다.

- 당시 실제로 중요했던 제약
- 후보자가 직접 내린 판단과 책임 범위
- 검토했지만 사용하지 않은 대안과 이유
- 결과를 확인한 방법과 확인하지 못한 범위
- 다시 한다면 바꿀 판단

코드와 문서가 사실을 뒷받침해도 당시 판단, 동기와 말로 설명할 수 있는지는 자동으로 확정하지 않는다.
제출에 사용할 대표 사례를 후보자가 30초로 요약하고 2분 동안 문제, 제약, 판단과 결과로 설명할 준비가 안 됐다면 포지션별 근거 방어 질문과 다음 행동에 남긴다.
완성 답변을 대신 작성하지 말고 답변 구조, 이미 확인한 근거, 예상 후속 질문과 과장하지 않을 경계를 제공한 뒤 후보자가 먼저 말하게 한다.

### 근거와 적합성 분석

`references/application-quality-rubric.md`를 읽는다.
공고 요구사항과 회사 기준을 후보자 근거에 연결한다.

private brain과 기존 경력기술서는 탐색을 위한 색인으로 사용한다.
지원 판단이 달라지는 핵심 경험은 가능하면 로컬 프로젝트에서 확인한다.
로컬 근거로 결론을 낼 수 없으면 기존 문장을 사실로 확정하지 않고 `사용자 확인`으로 남긴다.
코드 존재, 본인 소유권, 결과와 운영 깊이를 주장 단위로 감사하는 일은 `resume-preparer`가 담당한다.
근거 경로가 `${PROJECTS_ROOT}` 또는 `${PERSONAL_ROOT}`로 시작하면 같은 이름의 환경 변수로 바꿔 읽는다.
해당 환경 변수가 없으면 경로를 추측하지 않고 그 근거를 현재 환경에서 확인할 수 없다고 판정한다.

각 판단을 다음 중 하나로 구분한다.

- `확인됨`: 제출 문장으로 사용할 직접 근거가 있다.
- `인접 경험`: 동일 경험은 아니지만 전환 가능한 근거가 있다.
- `공백`: 학습 또는 입사 후 검증이 필요한 영역이다.
- `사용자 확인`: 후보자만 확정할 수 있는 동기, 역할 또는 결과다.

학습 경험을 운영 경험으로, 팀 성과를 단독 성과로 바꾸지 않는다.

### 지원 전략 산출물 작성

지원 전략 단계에는 다음 핵심 파일만 만든다.

- `candidate-interview.md`: 사용자 원문 답변과 정리된 핵심
- `application-package.md`: 요구사항·회사 기준·경력 근거와 다음 행동을 통합한 원본
- `interview-questions.json`: 공고 책임, 근거 방어와 경험 공백에서 만든 포지션별 질문

지원 사이트가 자기소개나 별도 질문을 요구할 때만 application-answers.md를 만든다.
이력서, 경력기술서, 근거 원장, 검토표와 PDF는 `resume-preparer`가 만든다.
`application-package.html`은 두 단계의 결과를 마지막에 하나로 묶는다.

`application-package.md`에는 다음 섹션을 둔다.

```markdown
## 결론
## 회사와 포지션이 찾는 사람
## 요구사항과 근거
## 이 포지션에서의 승부처
## 지원동기
## 입사 후 기여 시나리오
## 보완할 공백
## 회사 문화와의 연결
## 면접에서 검증받을 내용
## 제출 준비 상태
## 사용자 확인 필요
## 다음 행동
```

`면접에서 검증받을 내용`을 작성한 뒤 다음 세 출처로 질문을 구조화한다.

- `posting_requirement`: 공고가 직접 요구하는 책임과 설계 판단
- `evidence_defense`: 이력서와 경력기술서의 핵심 경험을 방어하는 질문
- `experience_gap`: 직접 해보지 않은 영역과 모호한 근거를 확인하는 질문

질문은 `interview-questions.json` 하나에 저장하고 다음 명령으로 검증한다.

```bash
bun "$(git rev-parse --show-toplevel)/career-os/scripts/interview-drill/application_question_schema.ts" \
  <application-directory>
```

각 질문에는 답변에서 확인할 신호와 `evidenceBoundary`를 함께 기록한다.
공백 질문의 답변 신호는 경험을 꾸미는 모범 답안이 아니라 설계 원칙, 인접 근거와 학습 경계를 확인해야 한다.

첫 10줄 안에 아래 상태를 기록한다.

```markdown
- readiness: ready|needs_user_input|revise|do_not_apply
- evidence: safe|revise|blocked
- human-confirmation: complete|needs_input
```

`human-confirmation`은 지원동기, 본인 역할, 실제 제약, 대안, 결과의 확인 범위처럼 후보자만 확정할 수 있는 항목의 상태다.
하나라도 제출 문구를 바꿀 미확인 항목이 있으면 `needs_input`으로 두며, `readiness: ready`와 함께 사용할 수 없다.

### 사용자와 검토

초안을 보여준 뒤 사용자가 다음 내용을 직접 확인하게 한다.

1. 지원동기가 실제 본인 생각과 같은가?
2. 본인 역할과 팀 역할이 정확히 구분됐는가?
3. 가장 강한 사례가 공고의 핵심 문제와 연결되는가?
4. 약한 영역을 숨기지 않고 전환 가능한 경험을 설명했는가?
5. 입사 후 기여 시나리오가 제품 사용자에게 닿는가?

사용자 답변을 `candidate-interview.md`에 반영한 뒤 지원 판단과 문구를 갱신한다.
공고 원문, 인터뷰 답변과 지원동기를 다시 읽어 서로 모순되는 역할·수치·동기가 없는지 확인한다.

### 이력서 제출 준비로 연결

지원 전략과 사람 확인이 준비되면 같은 사용자 요청 안에서 `resume-preparer`를 호출한다.
사용자에게 별도 스킬 실행 순서를 맡기지 않는다.

`resume-preparer`는 다음 책임을 한 흐름으로 수행한다.

- 이력서와 필요한 경력기술서 작성
- 사람만 확정할 수 있는 경험 판단과 설명 준비
- 주장별 근거 감사
- 블라인드 하드 리뷰와 실제 렌더 검증
- HTML, PDF와 제출 묶음 생성

사용자만 확정할 수 있는 지원동기나 사실이 남으면 `needs_user_input`에서 멈춘다.
지원 전략만 요청한 경우에도 다음 행동에 이력서 준비 상태를 명시한다.

## 안전 경계

- 실제 지원, 로그인, 업로드와 외부 전송은 하지 않는다.
- private brain과 `sources/fos-study/`는 읽기 전용이다.
- 내부 파일 경로와 검토 상태를 제출 문장에 넣지 않는다.
- 로컬 프로젝트에서 찾은 사내 식별자, 호스트, 자격증명과 비공개 수치는 제출 문장에 옮기지 않는다.
- `application-package.html`은 로컬 검토용이며 공개 게시하지 않는다.
- 합격 가능성을 높이는 근거와 연습을 제공하되 합격을 보장한다고 표현하지 않는다.

## 참고 자료

- `references/candidate-interview-questions.md`
- `references/application-quality-rubric.md`
- `scripts/validate_application_package.ts`
- `scripts/render_application_package.ts`
- `brain-search`
- `resume-preparer`
