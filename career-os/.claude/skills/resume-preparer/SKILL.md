---
name: resume-preparer
description: 공고가 찾는 역량과 후보자의 강한 경험을 연결하는 이력서와 경력기술서를 제출 가능한 PDF로 완성할 때 사용한다. 면접 말하기 준비와 답변 연습은 interview-practice가 담당한다.
---
# 이력서 제출 준비

## 목표

공고가 찾는 역량과 후보자의 가장 강한 실제 경험을 연결해,
서류 심사자가 다음 전형으로 넘길 이유를 빠르게 확인할 수 있는 제출 문서를 완성한다.

## 경계

- 공고 안내, 회사별 기준, [개인 작성 취향](references/resume-taste.md), [공통 작성 기준](references/resume-writing-style.md) 순으로 적용한다.
- 구현, 소유권, 결과와 경험 깊이를 분리하고 확인된 근거보다 강하게 쓰지 않는다.
- 비공개 근거와 사내 식별자를 제출 문서에 노출하지 않는다.
- 사용자가 확인하지 않은 사실이 남아 있으면 제출 준비를 완료하지 않는다.
- 실제 제출은 사용자의 최종 승인 뒤에만 수행한다.

## 워크플로

### 1. 작업본과 근거 준비

저장소 루트에서 최신 지원 작업본을 준비한다.

```bash
bun career-os/scripts/career-workspace/cli.ts skill begin resume-preparer --json
```

`evidence/posting.md`, `evidence/fit.md`와 `evidence/status.md`에서 지원 직무, 지원 판단과 제출 문서를 확인한다.
지원 판단이나 후보자 인터뷰가 준비되지 않았으면 `application-package-writer`로 연결한다.
동기화 오류는 [비공개 작업 파일 흐름](../../../docs/flow.md)에 따라 처리한다.

주장 감사에 사용할 `fos-study`가 최신인지 [근거 원본 최신화 기준](../application-package-writer/references/evidence-source-freshness.md)에 따라 확인한다.
개인 맥락은 파일 경로가 아니라 `brain-search`로 조회한다.

### 2. 사실과 대표 근거 확정

`evidence/candidate-interview.md`와 기존 근거를 먼저 읽는다.
현재 경력, 역할 선호와 경험 경계는 [개인 맥락 조회 기준](references/brain-context.md)에 따라 확인한다.
제출 문장을 바꾸는 사실만 사용자에게 확인하고,
[주장 검증 모델](references/claim-model.md)에 따라 구현, 소유권, 결과와 경험 깊이를 판정한다.

미확인 사실이 있으면 `human-confirmation: needs_input`으로 둔다.
제출 문장의 사실과 표현 동의를 모두 확인했을 때만 `complete`로 바꾼다.

### 3. 원고 작성

공고와 지원 전략에 맞는 대표 근거를 `evidence/resume-draft.md`에 선별한다.
경력기술서가 필요하면 `evidence/career-description-draft.md`에 판단과 구현 맥락을 보완한다.
같은 경험의 대상, 역할, 수치와 기간은 모든 지원 문서에서 일치시킨다.

현재 작업에 필요한 기준만 읽는다.

- 표현과 구성: [개인 작성 취향](references/resume-taste.md), [공통 작성 기준](references/resume-writing-style.md)
- 근거 범위: [주장 검증 모델](references/claim-model.md)
- 채용 관점: [독립 채용 리뷰](references/hard-review.md), [판정 기준](references/scoring-rubric.md)

면접에서 확인할 질문은 `evidence/interview-questions.json`에 남길 수 있다.
답변 연습은 `interview-practice`로 이어간다.

### 4. HTML과 PDF 검증

[디자인 계약](references/resume-design.md)에 따라 HTML과 PDF를 만들고 실제 화면을 확인한다.

```bash
bun career-os/.claude/skills/resume-preparer/scripts/export_resume.ts --application-dir <지원 디렉터리>
bun career-os/.claude/skills/resume-preparer/scripts/check_resume_html.ts <HTML 경로>
```

공고의 분량 제한을 우선한다.
제한이 없으면 근거의 양, 중복과 읽기 편의성으로 분량과 페이지 구분을 정한다.

### 5. 주장 감사와 채용 리뷰

현재 HTML의 주장 원장을 `schemaVersion: 3`으로 만들고,
`document`와 `user` 근거의 인용 위치를 `locator`에 기록한다.
세부 형식은 [주장 검증 모델](references/claim-model.md)을 따른다.

```bash
bun career-os/.claude/skills/resume-preparer/scripts/validate_claim_ledger.ts <원장 경로> --artifact <HTML 경로>
```

이후 [독립 채용 리뷰](references/hard-review.md)와 [판정 기준](references/scoring-rubric.md)에 따라 인사담당자와 실무담당자 관점으로 검토한다.
문구를 바꾸면 HTML, PDF, 주장 원장과 리뷰 결과를 같은 버전으로 다시 만든다.

### 6. 제출 묶음 완성

사실 확인, 주장 감사, 채용 리뷰와 화면 검증이 모두 통과했을 때만 `readiness: ready`로 바꾼다.
다음 순서로 제출 묶음과 검토 화면을 만든다.

1. `scripts/build_submission_bundle.ts`
2. `scripts/validate_submission_bundle.ts`
3. `../application-package-writer/scripts/validate_application_package.ts`
4. `../application-package-writer/scripts/render_application_package.ts`

최종 파일을 확인한 뒤 작업본을 반영한다.

```bash
bun career-os/scripts/career-workspace/cli.ts skill finish resume-preparer --json
```

사용자에게 검토 화면과 제출 PDF를 보여주고 실제 제출 승인을 기다린다.

## 완료 조건

- `human-confirmation`이 `complete`다.
- 모든 제출 문장이 근거 범위 안에 있다.
- 인사담당자와 실무담당자 관점의 검토를 통과했다.
- HTML과 PDF에 겹침, 잘림, 깨진 링크와 페이지 넘침이 없다.
- 제출 묶음과 지원 패키지 검사가 통과했다.
