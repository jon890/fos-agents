---
name: application-package-writer
description: 공고 하나를 실제 지원 가능한 상태로 준비하는 career-os 스킬. "이 공고 지원 준비", "지원서 만들어줘", "지원 패키지", "맞춤 이력서", "지원동기 정리", "이 회사에 지원하고 싶어"처럼 개별 공고의 지원 판단, 후보자 인터뷰, 근거 매핑, 맞춤 이력서와 지원 문구, 면접 방어 포인트가 필요할 때 사용한다. 사용자는 이 스킬 하나만 호출하며, 근거 감사와 최종 이력서 평가는 내부 단계로 연결한다. 실제 제출, 로그인과 외부 전송은 하지 않는다.
---

# 지원 준비

공고 하나에 지원할 이유와 승부처를 정하고, 실제 제출에 사용할 이력서와 지원 문구를 만든다.
사용자에게 문서 묶음을 떠넘기지 말고 `application-package.md`를 중심으로 현재 판단과 다음 행동을 설명한다.

## 사용자에게 주는 결과

사용자가 가장 먼저 볼 파일은 `application-package.md`다.
이 문서는 다음 질문에 한 화면 안에서 답해야 한다.

- 이 공고에 지원할 가치가 있는가?
- 회사와 팀은 어떤 사람을 찾고 있는가?
- 내 경험 중 무엇으로 승부할 수 있는가?
- 어떤 공백을 정직하게 설명해야 하는가?
- 이력서와 면접에서 무엇을 검증받아야 하는가?
- 다음 행동은 무엇인가?

`application-package.html`은 지원 판단, 근거, 이력서 초안과 남은 질문을 묶어 보여주는 로컬 검토 화면이다.
실제 제출 파일은 `resume.pdf`이며, 지원 사이트가 별도 문항을 요구할 때만 `application-answers.md`를 추가한다.

## 입력

1. `applications/<company>/<role>/posting.md`
2. `config/candidate-profile.md`
3. 후보자 프로필에서 연결한 최신 경력 자료와 관련 업무 근거
4. 필요하면 로컬 프로젝트의 코드, 테스트, Git 이력과 기술 결정 문서
5. `applications/<company>/<role>/candidate-interview.md`가 있으면 기존 답변
6. `state/positions-queue.jsonl`이 있으면 현재 지원 상태

공고 경로가 없으면 현재 지원 후보를 찾는다.
후보가 없거나 둘 이상이면 임의로 선택하지 말고 정확히 한 가지 질문으로 대상을 확정한다.

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
- 공식 문화 기준 중 이 포지션과 직접 관련된 3개에서 5개

확인 시각과 공식 URL을 `posting.md` 또는 `application-package.md`에 남긴다.

### 후보자 인터뷰

`references/candidate-interview-questions.md`를 읽는다.
이미 답한 내용은 다시 묻지 않고 `candidate-interview.md`에 누적한다.
한 번에 질문 하나만 던지며, 완성 문장 대신 키워드와 생각 조각을 받아도 된다.

다음 네 항목이 확보되기 전에는 지원동기를 완성하지 않는다.

- 이 회사와 제품에 끌리는 구체적인 이유
- 입사 후 해결하고 싶은 사용자 문제
- 바로 기여할 수 있는 경험과 본인 역할
- 약한 영역과 보완 방법

### 근거와 적합성 분석

`references/application-quality-rubric.md`를 읽는다.
공고 요구사항과 회사 기준을 후보자 근거에 연결한다.

`brain`과 경력기술서는 탐색을 위한 색인으로 사용한다.
중요한 경험, 수치, 소유권과 기술 판단은 가능하면 로컬 프로젝트에서 다시 확인한다.

- 실제 코드와 테스트가 존재하는가?
- 현재 사용자의 Git 기여 이력과 변경 범위가 연결되는가?
- 결과 수치는 같은 조건의 비교나 운영 기록으로 재현되는가?
- ADR, 회고 또는 코드 변화에서 당시 판단과 기각한 대안이 확인되는가?
- 현재 코드가 과거 문서의 설명과 달라졌는가?

로컬 프로젝트를 확인할 수 없거나 결과 근거가 없으면 기존 문장을 사실로 확정하지 않는다.
`사용자 확인`으로 남기고, 학습 내용과 운영 경험을 분리한다.

기술 이름이 코드와 Git 이력에 나타나더라도 다음 수준을 구분한다.

- 사용: 해당 기술의 코드베이스를 읽거나 수정했다.
- 기능 개발: 본인 커밋과 테스트로 기능 변경 범위를 확인했다.
- 운영 깊이: 장애, 배포, 성능, 관측 또는 기술 고유 문제를 진단하고 해결한 근거가 있다.
- 주력 역량: 여러 문제에 반복 적용한 판단과 후보자 확인이 있다.

코드와 커밋만으로 운영 깊이나 주력 역량을 확정하지 않는다.
경력 기간과 여러 기술을 한 문장에 묶을 때는 기술별 실제 기간이 같은지 확인한다.
로컬 근거로 결론을 낼 수 없고 제출 문구가 달라진다면 `references/candidate-interview-questions.md`의 경험 깊이 질문으로 전환한다.

각 판단을 다음 중 하나로 구분한다.

- `확인됨`: 제출 문장으로 사용할 직접 근거가 있다.
- `인접 경험`: 동일 경험은 아니지만 전환 가능한 근거가 있다.
- `공백`: 학습 또는 입사 후 검증이 필요한 영역이다.
- `사용자 확인`: 후보자만 확정할 수 있는 동기, 역할 또는 결과다.

학습 경험을 운영 경험으로, 팀 성과를 단독 성과로 바꾸지 않는다.
수치와 강한 소유권 표현은 코드, 테스트, Git, 운영 기록 또는 사용자 확인이 있을 때만 쓴다.

### 산출물 작성

지원 디렉터리에 다음 핵심 파일만 만든다.

- `candidate-interview.md`: 사용자 원문 답변과 정리된 핵심
- `application-package.md`: 요구사항·회사 기준·경력 근거와 다음 행동을 통합한 원본
- `resume-draft.md`: 맞춤 HTML과 PDF의 Markdown 원본
- `application-package.html`: 위 원본과 이력서 초안을 묶은 로컬 검토 화면

지원 사이트가 자기소개나 별도 질문을 요구할 때만 `application-answers.md`를 만든다.
`review.md`, 근거 원장과 점수표는 자동화와 내부 검증이 필요할 때만 만든다.

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

첫 10줄 안에 아래 상태를 기록한다.

```markdown
- readiness: ready|needs_user_input|revise|do_not_apply
- evidence: safe|revise|blocked
```

이력서 프로젝트는 공고의 공식 안내가 있으면 그 구조를 우선한다.
안내가 없으면 문제, 중요성과 제약, 본인 역할과 판단, 결과와 검증 순서로 쓴다.

### 사용자와 검토

초안을 보여준 뒤 사용자가 다음 내용을 직접 확인하게 한다.

1. 지원동기가 실제 본인 생각과 같은가?
2. 본인 역할과 팀 역할이 정확히 구분됐는가?
3. 가장 강한 사례가 공고의 핵심 문제와 연결되는가?
4. 약한 영역을 숨기지 않고 전환 가능한 경험을 설명했는가?
5. 입사 후 기여 시나리오가 제품 사용자에게 닿는가?

사용자 답변을 `candidate-interview.md`에 반영한 뒤 제출 문장을 갱신한다.
자동 실행처럼 독립 검토가 필요한 경우에만 `application-reviewer`를 내부 단계로 호출한다.

### 검증과 최종 이력서

먼저 지원 패키지 계약을 검사하고 하나의 HTML로 묶는다.

```bash
bun career-os/.claude/skills/application-package-writer/scripts/validate_application_package.ts \
  <application-directory>

bun career-os/.claude/skills/application-package-writer/scripts/render_application_package.ts \
  <application-directory>
```

검사가 통과하고 사용자 확인 항목이 해결되면 다음 순서로 최종 이력서를 준비한다.

1. `resume-exporter`로 `resume.html`과 `resume.pdf`를 만든다.
2. `resume-evidence-auditor`로 제출 문장의 근거와 소유권을 감사한다.
3. `resume-evaluator`로 설득력, 정보 구조와 실제 렌더링을 평가한다.
4. 보이는 문구가 바뀌면 근거 감사를 다시 실행한다.

한 번의 사용자 요청 안에서 위 단계를 이어가되, 사용자만 확정할 수 있는 사실이 남으면 `needs_user_input`에서 멈춘다.
근거 원장에 `soften`, `ask_user`, `remove`가 남아 있어도 멈춘다.

## 안전 경계

- 실제 지원, 로그인, 업로드와 외부 전송은 하지 않는다.
- `sources/fos-study/`와 후보자 프로필은 읽기 전용이다.
- 내부 파일 경로와 검토 상태를 제출 문장에 넣지 않는다.
- 로컬 프로젝트에서 찾은 사내 식별자, 호스트, 자격증명과 비공개 수치는 제출 문장에 옮기지 않는다.
- `application-package.html`은 로컬 검토용이며 공개 게시하지 않는다.
- 합격 가능성을 높이는 근거와 연습을 제공하되 합격을 보장한다고 표현하지 않는다.

## 참고 자료

- `references/candidate-interview-questions.md`
- `references/application-quality-rubric.md`
- `scripts/validate_application_package.ts`
- `scripts/render_application_package.ts`
- `config/candidate-profile.md`
- `config/resume-design.md`
