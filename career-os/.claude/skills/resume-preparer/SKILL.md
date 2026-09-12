---
name: resume-preparer
description: 공고가 찾는 역량과 후보자의 강한 경험을 연결하는 이력서와 경력기술서를 제출 가능한 PDF로 완성할 때 사용한다. 면접 말하기 준비와 답변 연습은 interview-practice가 담당한다.
---
# 이력서 제출 준비

**공고가 찾는 역량과 후보자의 가장 강한 경험을 연결해, 서류 합격 가능성을 최대한 높이는 이력서와 경력기술서를 완성한다.**

## 진행 단계

스킬 내부 파일은 상대 링크로 연결하고, `career-os/`로 시작하는 경로는 저장소 루트를 기준으로 읽는다.
`evidence/`와 `review/`는 작업 중인 지원 디렉터리 기준이다.

| 번호 | 단계 | 핵심 결과 |
| --- | --- | --- |
| 1 | 지원 작업본 준비 | 작업할 지원 건과 최신 작업본을 확정한다. |
| 2 | 대표 사례 사실 확인 | 후보자만 확정할 사실과 표현 동의를 확인한다. |
| 3 | 원고 작성과 일관성 확인 | 이력서와 경력기술서 원고의 경험, 수치와 기간을 맞춘다. |
| 4 | 디자인과 PDF 검증 | 독립 실행 가능한 A4 HTML과 PDF를 실제 화면에서 검증한다. |
| 5 | 정확한 HTML의 주장 감사 | 현재 HTML의 각 주장을 근거와 대조한 원장을 만든다. |
| 6 | 인사담당자와 실무담당자 리뷰 | 채용 관점의 설득력과 기술 경험을 각각 검토한다. |
| 7 | 사용자가 고른 것을 원칙으로 남긴다 | 다음 지원에도 쓸 표현과 배치를 개인 작성 원칙에 반영한다. |
| 8 | 제출 묶음 검증과 동기화 | 최종 제출 파일과 검토 화면을 완성하고 작업본을 반영한다. |

### 1. 지원 작업본 준비

저장소 루트에서 다음 명령으로 최신 지원 작업본을 준비한다.

```bash
bun career-os/scripts/career-workspace/cli.ts skill begin resume-preparer --json
```

준비가 성공하면 대상 지원 건의 `evidence/posting.md`와 `evidence/fit.md`에서 지원 직무와 제출할 문서를 확인한다.
동기화 오류가 발생하면 [career-os/docs/flow.md](../../../docs/flow.md)의 「비공개 작업 파일의 목표 흐름」에 따라 처리한다.

이어서 이 CLI가 다루지 않는 `fos-study` 로컬 사본이 원격보다 뒤처졌는지 검사한다.
단계 5의 주장 감사가 그 파일을 근거로 삼으므로 최신이어야 감사가 성립한다.
단계 2가 읽는 private brain은 `brain-search`로 조회하며 경로로 확인하지 않는다.

검사 명령과 판정별 다음 행동은 [근거 원본 최신화 확인](../application-package-writer/references/evidence-source-freshness.md)이 소유한다.

지원 디렉터리나 지원 판단, 후보자 인터뷰가 준비되지 않았으면 `application-package-writer`로 연결한다.

### 2. 대표 사례 사실 확인

`evidence/candidate-interview.md`에서 대표 사례에 대해 이미 확인한 내용을 읽는다.
현재 경력, 역할 선호와 경험 경계는 [references/brain-context.md](references/brain-context.md)에 따라 `brain-search`로 조회한다.
같은 편집 흐름에서 이미 확인한 정보는 재사용하고, 추가 사실이 필요하거나 사용자 정정이 생긴 부분만 다시 조회한다.
조회 결과가 없거나 도구가 실패하면 그 차이를 밝히고 현재 확인된 근거로 편집을 계속한다.

후보자만 확정할 수 있는 항목은 제출 문장을 바꾸는 사실과 표현 동의로 제한한다.
서로 독립적인 질문은 최대 넷까지 묶고, 한 답이 다음 질문을 바꾸면 한 가지씩 확인한다.

- 확인할 내용: 문제의 중요성, 당시 제약, 본인 역할과 판단, 기각한 대안과 결과의 검증 범위
- 질문에 함께 제시할 내용: 필요한 이유, 이미 확인한 사실과 답에 따라 달라질 제출 문장

[references/claim-model.md](references/claim-model.md)를 기준으로 확인한다.
사람 확인이 남으면 `evidence/status.md`의 `human-confirmation`을 `needs_input`으로 둔다.
**제출 문장의 사실과 표현 동의를 모두 확인했을 때 `complete`로 바꾼다.**

### 3. 원고 작성과 일관성 확인

공고의 공식 작성 안내를 우선하고, 회사별 기준이 있으면 `career-os/library/company-notes/<회사>.md`에서 이력서 안내와 전형 구조를 확인한다.
공식 안내가 없으면 문제, 중요성과 제약, 본인 역할과 판단, 결과와 검증 순서로 쓴다.

- 개인 작성 취향: [references/resume-taste.md](references/resume-taste.md)
- 공통 작성 기준: [references/resume-writing-style.md](references/resume-writing-style.md)
- 심사자 관점: [references/reviewer-lens.md](references/reviewer-lens.md)

개인 작성 취향은 지금까지의 지원에서 사용자가 고른 문구, 표기와 배치를 모아 둔 문서다.
새 지원을 시작할 때 이 문서를 먼저 읽고 그 기준으로 초안을 쓴다. 같은 지시를 다시 받지 않기 위해서다.

기준이 충돌하면 **공고 안내, 회사별 기준, 개인 작성 취향, 공통 작성 기준, 심사자 관점 순**으로 적용한다.
첫 사례는 다음 단계로 넘길 이유를 가장 빨리 설명하는 사례로 고른다.

- `evidence/resume-draft.md`에는 공고에 맞는 대표 근거를 선별한다.
- 경력기술서가 필요하면 `evidence/career-description-draft.md`에 프로젝트별 판단과 구현 맥락을 보완한다.

원고와 산출물 형식은 [career-os/docs/data-schema.md](../../../docs/data-schema.md)의 「지원 패키지」를 따른다.
같은 경험의 대상, 역할, 수치와 기간을 지원 전략, 이력서, 경력기술서와 지원서 답변에서 맞춘다.
참조는 [career-os/.claude/skills/application-package-writer/references/full-document-review.md](../application-package-writer/references/full-document-review.md)다.
사용자 사실 정정과 작성 취향 합의의 분기는 [references/brain-context.md](references/brain-context.md)의 「환원 분기」를 따른다.

문서 검토 중 면접에서 확인할 질문을 발견하면 `evidence/interview-questions.json`에 선택적으로 남긴다.
답변 연습과 말하기 준비는 `interview-practice`로 이어간다.

### 4. 디자인과 PDF 검증

기본 렌더러는 경력 섹션 앞에서 페이지를 나눈다.
제출처가 분량을 제한하면 그 기준을 우선한다.
제한이 없으면 근거의 양, 중복과 읽기 편의성으로 분량을 정하고, 의미 단위 사이에 `<!-- resume-page-break -->`를 필요한 만큼 넣어 분할 위치를 조정한다.
페이지 균형은 본문 글자 크기와 줄 간격보다 섹션 순서와 분할 위치로 먼저 조정한다.

디자인 파일은 `--design`으로 지정한다. 지정하지 않으면 기본 CSS가 적용되어 지원 회사의 강조색과 로고가 빠진다.
지원별 디자인은 `career-os/library/resume-baselines/<지원>-resume.css`에 두고 로고를 그 안에 포함한다.

[references/resume-design.md](references/resume-design.md) 기준으로 HTML과 PDF를 실제로 열어 글자 겹침, 잘림, 링크, 대비와 페이지 넘침을 확인한다.
렌더링은 [scripts/export_resume.ts](scripts/export_resume.ts) `--application-dir <지원 디렉터리>`로 수행한다.
지원별 브랜드 강조색은 같은 명령의 `--accent "#RRGGBB"`로 준다.
HTML 골격과 CSS, 로고는 `templates/`가 소유하며 화면 구조를 바꿀 때는 렌더러가 아니라 그 파일들을 먼저 고친다.
경력기술서는 같은 명령의 `--resume`, `--html`, `--pdf`에 해당 경로를 지정한다.
HTML 정적 검사는 [scripts/check_resume_html.ts](scripts/check_resume_html.ts) `<HTML 경로>`로 수행한다.

### 5. 정확한 HTML의 주장 감사

[references/claim-model.md](references/claim-model.md)로 제출 문장의 구현, 소유권, 결과와 경험 깊이를 나눠 판정한다.
주장에 필요한 근거를 `career-os/sources/fos-study/`, 실제 프로젝트의 코드, 테스트, Git 이력과 기술 결정 문서에서 확인한다.
코드 존재는 구현 근거로, Git 이력은 소유권 근거로, 운영 기록은 경험 깊이 근거로 각각 분리한다.

원장은 `schemaVersion: 3`으로 만들고, `document`와 `user` 근거마다 인용한 자리를 `locator`에 적는다.
형식은 [references/claim-model.md](references/claim-model.md)의 「근거를 어디서 인용했는지 적는 방법」이 소유한다.

[scripts/validate_claim_ledger.ts](scripts/validate_claim_ledger.ts) `<원장 경로> --artifact <HTML 경로>`를 실행한다.
실패한 항목은 근거와 문구를 보완하거나 후보자에게 확인한 뒤 재검사한다.
문구가 바뀌면 HTML과 PDF도 다시 만든다.

### 6. 인사담당자와 실무담당자 리뷰

작성 과정과 기존 평가를 보지 않은 검토자 두 명이 공고와 현재 제출 문서로 판단한다.

- 인사담당자 관점: 지원 직무, 경력 흐름과 다음 전형으로 넘길 이유가 명확한지 검토한다.
- 실무담당자 관점: 문제의 난도, 본인 판단, 구현과 운영 경험, 결과의 검증 범위를 검토한다.

검토 절차는 [references/hard-review.md](references/hard-review.md), 판정과 기록 형식은 [references/scoring-rubric.md](references/scoring-rubric.md)를 따른다.
두 관점의 수정 의견을 반영하고, 서류 통과를 권하기 어려운 문제가 해소될 때까지 다시 검토한다.

### 7. 사용자가 고른 것을 원칙으로 남긴다

이 지원에서 사용자가 고르거나 되돌린 표현, 표기와 배치 중 다음 지원에도 적용할 것을 개인 작성 원칙에 반영한다.
회사 이름, 기간, 수치처럼 이 지원에만 해당하는 값은 후보자 확인 기록에 남긴다.

한 번의 수정으로 끝내면 다음 지원에서 같은 지시를 다시 받는다.

### 8. 제출 묶음 검증과 동기화

문서 검증과 독립 리뷰가 끝나면 `evidence/status.md`를 `readiness: ready`로 바꾸고 다음 순서로 실행한다.
각 명령에는 지원 디렉터리를 전달한다.

1. [scripts/build_submission_bundle.ts](scripts/build_submission_bundle.ts)로 제출 묶음을 만든다.
2. [scripts/validate_submission_bundle.ts](scripts/validate_submission_bundle.ts)로 제출 묶음을 검사한다.
3. [career-os/.claude/skills/application-package-writer/scripts/validate_application_package.ts](../application-package-writer/scripts/validate_application_package.ts)로 지원 패키지를 검사한다.
4. [career-os/.claude/skills/application-package-writer/scripts/render_application_package.ts](../application-package-writer/scripts/render_application_package.ts)로 최종 파일과 다음 행동을 검토 화면에 반영한다.

검사가 실패하면 원인에 따라 `readiness`를 `revise` 또는 `needs_user_input`으로 갱신하고 해당 단계에서 보완한다.
검토 화면까지 확인한 뒤 작업본을 반영한다.

```bash
bun career-os/scripts/career-workspace/cli.ts skill finish resume-preparer --json
```

사용자에게 최종 검토 화면과 제출 PDF를 보여준다.
실제 제출은 **사용자의 최종 승인 뒤** 수행한다.
