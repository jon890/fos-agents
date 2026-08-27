---
name: resume-preparer
description: 공고에 맞춘 이력서·경력기술서를 작성하고 사람 확인, 주장 근거 감사, 하드 리뷰, HTML/PDF 렌더링과 제출 묶음 검증까지 한 흐름으로 완료하는 career-os 스킬. "이력서 작성", "맞춤 이력서", "이력서 검증", "이력서 평가", "경력기술서", "PDF 이력서"처럼 제출 문서 자체를 만들거나 고칠 때 사용한다. 회사·공고 지원 판단과 지원동기 인터뷰는 application-package-writer가 담당한다.
---

# 이력서 제출 준비

지원 전략을 채용 담당자가 빠르게 이해하고 면접에서 방어할 수 있는 제출 문서로 바꾼다.
작성, 사실 감사와 설득력 평가는 서로 다른 내부 단계로 유지하지만 사용자는 이 스킬 하나만 호출한다.

## 입력

- `applications/<company>/<role>/posting.md`
- `applications/<company>/<role>/candidate-interview.md`
- `applications/<company>/<role>/application-package.md`
- `config/candidate-profile.md`와 연결된 최신 경력 근거
- 필요하면 로컬 프로젝트의 코드, 테스트, Git 이력과 기술 결정 문서
- 기본 디자인 `config/resume-design.md` 또는 공고별 `design.md`

지원 디렉터리가 없거나 지원 판단과 후보자 인터뷰가 준비되지 않았으면 `application-package-writer`로 먼저 연결한다.
기존 이력서만 고치는 요청도 공고와 근거 경계를 확인할 수 있는 지원 디렉터리 안에서 수행한다.

## 사용자에게 주는 결과

- `resume-draft.md`, `resume.html`, `resume.pdf`
- 경력기술서가 필요한 경우 대응하는 Markdown, HTML과 PDF
- 주장별 근거 원장과 사람이 읽는 감사 결과
- 블라인드 판정과 점수표
- 한 파일 제출이 필요할 때 `submission.pdf`
- 대표 사례의 30초·2분 설명과 남은 연습 항목

지원 판단과 제출 상태는 기존 `application-package.md`와 `application-package.html`에서 함께 보여준다.
별도 진행 요약 문서를 만들지 않는다.

## 사람과 AI의 책임

에이전트는 공고와 근거를 찾고 문장을 구조화하며, 반례와 후속 질문, 표현 경계와 렌더링을 준비한다.
후보자는 문서만으로 확정할 수 없는 다음 내용을 직접 확인한다.

- 당시 실제로 중요했던 제약
- 본인이 직접 내린 판단과 책임 범위
- 검토했지만 선택하지 않은 대안과 이유
- 결과를 확인한 방법과 확인하지 못한 범위
- 다시 한다면 바꿀 판단
- 제출 문구가 자신의 생각과 경험을 정확히 나타내는지

미확인 항목이 있으면 질문 하나만 제시한다.
질문에는 필요한 이유, 이미 확인한 사실, 답에 따라 달라지는 제출 문장, 답변 구조, 예상 후속 질문과 과장하지 않을 경계를 함께 제공한다.
완성 답변을 먼저 쓰지 않고 후보자가 키워드나 생각 조각으로 먼저 답하게 한다.

제출 문구를 바꿀 사람 확인이 남으면 `application-package.md`의 `human-confirmation`을 `needs_input`으로 두며 최종 제출 준비를 진행하지 않는다.

## 실행 흐름

### 제출 방향과 대표 근거 선택

`posting.md`, `candidate-interview.md`, `application-package.md`와 `interview-questions.json`이 있는지 먼저 확인한다.
없으면 임의로 채우지 않고 `application-package-writer`로 연결한다.

공고의 공식 이력서 안내가 있으면 그 구조를 우선한다.
안내가 없으면 문제, 중요성과 제약, 본인 역할과 판단, 결과와 검증 순서로 쓴다.

첫 사례는 가장 복잡한 프로젝트가 아니라 다음 단계로 넘길 이유를 가장 빨리 설명하는 사례다.
대표 사례는 두세 개로 제한하고, 기술 목록보다 공고 책임과 연결되는 판단 근거를 앞에 둔다.
이력서는 선별된 근거를, 경력기술서는 프로젝트별 판단과 구현 맥락을 담당한다.

### Markdown 작성과 설명 준비

`resume-draft.md`를 만들거나 수정한다.
지원 화면이 경력기술서를 받으면 `career-description-draft.md`도 별도로 만든다.

이력서 초안까지 준비되면 다음 명령으로 지원 패키지 계약을 검사한다.

```bash
bun career-os/.claude/skills/application-package-writer/scripts/validate_application_package.ts \
  <application-directory>
```

대표 사례마다 다음 두 수준을 준비한다.

- 30초: 문제, 본인 판단과 확인된 결과를 요약한다.
- 2분: 중요성, 제약, 대안, 선택 이유, 실행, 검증과 남은 한계를 설명한다.

설명이 막히는 문장은 더 그럴듯하게 다듬지 않는다.
근거를 더 확인하거나 표현을 낮추고 `interview-questions.json`에 `evidence_defense` 질문으로 남긴다.

### HTML과 PDF 생성

```bash
bun career-os/.claude/skills/resume-preparer/scripts/export_resume.ts \
  --application-dir <application-directory>
```

경력기술서는 같은 명령에 `--resume`, `--design`, `--html`, `--pdf` 경로를 명시한다.
디자인은 `config/resume-design.md`를 기본으로 사용한다.
단일 열, 선택 가능한 텍스트, 본문 안의 연락처와 독립 실행 가능한 A4 PDF를 유지한다.

기본 렌더러는 경력 섹션 앞에서 페이지를 나눈다.
제출처가 분량을 제한하면 그 기준을 우선한다.
제한이 없으면 근거의 양, 중복과 읽기 편의성으로 분량을 정하고, 의미 단위 사이에 다음 표시를 필요한 만큼 넣어 분할 위치를 조정한다.

```markdown
<!-- resume-page-break -->
```

프로젝트나 경력 항목의 문장 중간에서는 나누지 않는다.
페이지 균형을 맞추려고 본문 글자 크기와 줄 간격부터 줄이지 않으며, 섹션 순서와 분할 위치를 먼저 조정한다.

### 주장 근거 감사

`references/claim-model.md`를 읽는다.
제출할 정확한 HTML의 각 주장을 구현, 소유권, 결과와 경험 깊이로 나누고 코드, 테스트, Git, 문서, 실행 결과와 사용자 확인에 대조한다.

- 이력서: `claim-ledger.json`, `evidence-audit.md`
- 경력기술서: `career-description-claim-ledger.json`, `career-description-evidence-audit.md`

다음 명령으로 원장과 제출 문구가 같은 버전인지 확인한다.

```bash
bun career-os/.claude/skills/resume-preparer/scripts/validate_claim_ledger.ts \
  <claim-ledger.json> --artifact <submission-document.html>
```

`soften`, `ask_user`, `remove`가 하나라도 남으면 평가로 넘어가지 않는다.
코드 존재를 본인 소유권으로, 기능 개발을 운영 깊이로, 팀 결과를 단독 성과로 확대하지 않는다.

### 블라인드 하드 리뷰

`references/hard-review.md`와 `references/scoring-rubric.md`를 읽는다.
먼저 공고와 제출할 정확한 PDF·HTML만 보고 채용 담당자와 기술 리더 관점의 `pass` 또는 `reject`를 각각 기록한다.
그 뒤 근거 원장으로 대표 주장을 방어하고 실제 브라우저 렌더에서 글자 겹침, 잘림, 링크, 대비와 페이지 넘침을 확인한다.

```bash
bun career-os/.claude/skills/resume-preparer/scripts/check_resume_html.ts \
  <submission-document.html>
```

최대 세 번 개선한다.
보이는 문구가 바뀌면 근거 감사를 다시 수행한다.
스타일만 바뀌고 문구 해시가 같으면 기존 원장을 재사용할 수 있다.

점수표에는 대상 파일, `artifactTextSha256`, `verdict`와 두 블라인드 판정을 기록한다.
점수 기준을 넘어도 한 검토자가 `reject`이거나 경쟁상 차단 항목이 남으면 `pass`가 아니다.

### 제출 묶음 검증

모든 사람 확인과 문서별 검증이 끝나면 PDF 해시를 기록하고 필요한 경우 통합 PDF를 만든다.

```bash
bun career-os/.claude/skills/resume-preparer/scripts/build_submission_bundle.ts \
  <application-directory>

bun career-os/.claude/skills/resume-preparer/scripts/validate_submission_bundle.ts \
  <application-directory>
```

검증이 통과한 뒤 `application-package.md`를 `readiness: ready`로 바꾸고 지원 패키지 계약과 제출 묶음 검사를 다시 실행한다.
마지막으로 `application-package-writer/scripts/render_application_package.ts`를 실행해 현재 제출 파일과 다음 행동을 검토 화면에 반영한다.

## 통과 조건

- `human-confirmation: complete`
- 모든 주장 판정이 `safe`
- 채용 담당자와 기술 리더가 모두 `pass`
- 점수표의 기준 점수와 파일 해시가 현재 제출 문서와 일치
- HTML 정적 검사와 실제 A4 렌더 결함 0개
- 페이지 사이의 정보량과 여백이 현저히 치우치지 않음
- PDF manifest와 현재 파일 해시 일치
- 대표 사례별 30초·2분 설명과 근거 방어 질문 준비

`pass`는 합격 보장이 아니라 제출 문서가 통제할 수 있는 명백한 탈락 사유가 없다는 뜻이다.

## 안전 경계

- 실제 지원, 로그인, 업로드와 외부 전송은 하지 않는다.
- 내부 파일 경로, 커밋 해시, 사내 식별자와 비공개 수치를 제출 문장에 넣지 않는다.
- 개인 연락처가 있는 이력서를 공개 게시하지 않는다.
- 근거 없이 수치, 역할, 기술 경험과 지원동기를 만들지 않는다.

## 참고 자료

- `references/claim-model.md`
- `references/hard-review.md`
- `references/scoring-rubric.md`
- `../../../config/resume-design.md`
- `../application-package-writer/references/candidate-interview-questions.md`
