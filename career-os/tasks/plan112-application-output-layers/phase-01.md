# Phase 01 산출물 경로를 세 층으로 바꾼다

**Execution profile**: deep

---

## 목표

공고 디렉터리 안의 파일을 세 층으로 나누고, 생성기와 검증기가 그 경로를 계약으로 사용하게 한다.
사용자가 공고 디렉터리를 열었을 때 자신이 여는 파일만 보이게 하는 것이 목적이다.

**범위 외**: 검토 화면의 탭 구성, 템플릿 분리와 `application-package.md`의 섹션 계약 변경은 phase 02와 03이 맡는다.

---

## 컨텍스트

지금은 공고 디렉터리 바로 아래에 사용자용 HTML, 제출 PDF, 기준 원본과 내부 검증 자료가 함께 있다.
토스플레이스 지원 건은 파일이 18개이며 사용자가 실제로 여는 것은 둘이다.

층별 파일 목록은 `career-os/docs/data-schema.md`의 「지원 패키지」가 소유한다.
구현하기 전에 그 절을 읽는다.

경로 계약을 담은 파일은 셋이다.

- `career-os/.claude/skills/application-package-writer/scripts/package_contract.ts`
- `career-os/.claude/skills/resume-preparer/scripts/resume_submission_contract.ts`
- `career-os/scripts/interview-drill/` 안의 질문 스키마와 drill engine

`career-os/scripts/career-workspace/manifest.ts`는 경로를 목록으로 훑는 방식이라 파일이 옮겨져도 그대로 동작한다.
이 파일은 변경 대상이 아니다.

**근거 문서**: `career-os/docs/data-schema.md`의 「지원 패키지」, `career-os/docs/adr/ADR-109-지원-산출물을-역할별-디렉터리로-나눈다.md`

---

## 의도 메모

- 기준 원본과 내부 검증 자료를 한 디렉터리에 모으는 안을 기각했다. 근거 원본은 사람이 가끔 열지만 장부와 점수표는 열 일이 없다.
- 기존 지원 자료를 새 구조로 이전하지 않기로 했다. `coupang`, `daangn`과 `_archive`는 현재 진행하지 않는 지원이며 이전 판은 홈서버 release에 남아 있다.
- 생성기와 검증기를 같은 phase에서 함께 바꾼다. 한쪽만 바꾸면 검증이 통과하지 않는 중간 상태가 남는다.

---

## 작업 항목

### 1. `career-os/.claude/skills/application-package-writer/scripts/package_contract.ts`에서 경로 상수를 세 층으로 나눈다

`REQUIRED_PACKAGE_FILES`의 다섯 항목에 `evidence/` 접두사를 붙인다.
`ALLOWED_PACKAGE_FILES`를 세 층으로 나눠 다음 세 상수로 대체한다.

- `TOP_LEVEL_FILES`: `application-package.html`, `resume.pdf`, `career-description.pdf`, `submission.pdf`
- `EVIDENCE_FILES`: `posting.md`, `candidate-interview.md`, `application-package.md`, `resume-draft.md`, `interview-questions.json`, `career-description-draft.md`, `application-form.json`
- `REVIEW_FILES`: `resume.html`, `career-description.html`, `claim-ledger.json`, `career-description-claim-ledger.json`, `resume-scorecard.md`, `career-description-scorecard.md`, `submission-manifest.json`

`ALLOWED_PACKAGE_FILES`는 세 상수를 각 층의 접두사와 함께 합친 값으로 유지해 기존 호출부가 그대로 동작하게 한다.
`REQUIRED_HEADINGS`의 키도 `evidence/` 접두사를 붙인 경로로 바꾼다.
`REDUNDANT_PACKAGE_FILES`와 `SUBMISSION_LEAK_PATTERNS`는 그대로 둔다.

### 2. `career-os/.claude/skills/application-package-writer/scripts/validate_application_package.ts`에서 층이 어긋난 파일을 거부한다

허용 목록 검사에 층 검사를 더한다.
`EVIDENCE_FILES`에 속한 이름이 디렉터리 최상위나 `review/`에서 발견되면 어느 층에 있어야 하는지를 담은 오류를 낸다.
`REVIEW_FILES`와 `TOP_LEVEL_FILES`도 같다.
오류 문구에는 발견한 경로와 기대 경로를 함께 담는다.

### 3. `career-os/.claude/skills/resume-preparer/scripts/resume_submission_contract.ts`에서 제출 문서 경로를 층에 맞춘다

`REQUIRED_RESUME_SUBMISSION_FILES`에서 `resume.pdf`는 최상위로 두고 `resume.html`, `claim-ledger.json`, `resume-scorecard.md`, `submission-manifest.json`에 `review/` 접두사를 붙인다.
`REQUIRED_CAREER_DESCRIPTION_FILES`에서 `career-description.pdf`와 `submission.pdf`는 최상위로 두고 나머지 셋에 `review/` 접두사를 붙인다.

### 4. `career-os/.claude/skills/resume-preparer/scripts/export_resume.ts`에서 기본 경로를 바꾼다

`resumePath` 기본값을 `<application-dir>/evidence/resume-draft.md`로, `htmlPath` 기본값을 `<application-dir>/review/resume.html`로, `pdfPath` 기본값을 `<application-dir>/resume.pdf`로 바꾼다.
경력기술서 경로도 같은 규칙으로 바꾼다.
`--html`과 `--pdf` 플래그로 명시한 경로는 그대로 존중한다.
`--help` 출력의 기본값 설명도 함께 고친다.
출력 디렉터리가 없으면 만든다. 지금도 `mkdirSync(dirname(...), { recursive: true })`를 쓰고 있으므로 HTML 쪽에도 같은 처리를 둔다.

### 5. `career-os/.claude/skills/resume-preparer/scripts/build_submission_bundle.ts`와 `validate_submission_bundle.ts`, `validate_claim_ledger.ts`에서 경로 계산을 바꾼다

세 파일이 읽고 쓰는 경로를 3번의 계약에 맞춘다.
`submission-manifest.json`이 기록하는 파일 경로도 새 층을 반영한다.

### 6. `career-os/scripts/interview-drill/application_question_schema.ts`와 `drill-engine.ts`에서 질문 파일 경로를 바꾼다

`interview-questions.json`을 `<application-dir>/evidence/interview-questions.json`에서 읽는다.
두 파일 모두 공고 디렉터리를 인자로 받으므로 경로 결합 지점만 바꾼다.

### 7. `career-os/applications/`에서 진행하지 않는 지원 자료를 정리하고 토스플레이스를 새 층으로 옮긴다

`career-os/applications/coupang`, `career-os/applications/daangn`과 `career-os/applications/_archive`를 삭제한다.
`career-os/applications/tossplace/server-developer-ai-platform`의 파일을 1번 계약대로 옮긴다.

- 최상위에 남길 것: `application-package.html`, `resume.pdf`, `career-description.pdf`, `submission.pdf`
- `evidence/`로 옮길 것: `posting.md`, `candidate-interview.md`, `application-package.md`, `resume-draft.md`, `career-description-draft.md`, `interview-questions.json`, `application-form.json`
- `review/`로 옮길 것: `resume.html`, `career-description.html`, `claim-ledger.json`, `career-description-claim-ledger.json`, `resume-scorecard.md`, `career-description-scorecard.md`, `submission-manifest.json`

`career-os/applications`는 홈서버와 동기화되는 비공개 작업본이다.
파일을 옮기기 전에 `career-os/docs/flow.md`의 「skill이 실행하는 명령」을 `SKILL_NAME=resume-preparer`로 실행해 최신 판을 받고, 작업을 마친 뒤 같은 이름으로 완료 단계를 실행한다.

### 8. `career-os/.claude/skills/application-package-writer/SKILL.md`와 `career-os/.claude/skills/resume-preparer/SKILL.md`, `career-os/.claude/skills/interview-practice/SKILL.md`에서 경로 서술을 바꾼다

세 문서에서 공고 디렉터리 바로 아래 파일명을 가리키는 서술을 새 층에 맞춘다.
`application-package-writer/SKILL.md`의 「파일 보존 기준」 절과 "화면 정리를 위해 파일을 복제하거나 임의로 하위 디렉터리로 옮기지 않는다"로 시작하는 두 문장을 제거하고, 층별 배치가 `career-os/docs/data-schema.md`의 「지원 패키지」에 있다는 한 줄로 대체한다.
`references/full-document-review.md`와 `references/candidate-interview-questions.md`, `resume-preparer/references/scoring-rubric.md`, `interview-practice/references/question-bank-maintenance.md`의 경로 언급도 함께 고친다.

### 9. 이 phase를 검증하는 테스트를 더한다

`career-os/.claude/skills/application-package-writer/scripts/validate_application_package.test.ts`에 두 경우를 더한다.

- 정상: 세 층에 각각 올바른 파일이 있는 디렉터리가 통과한다.
- 실패: `evidence/`에 있어야 할 `application-package.md`가 최상위에 있으면 발견 경로와 기대 경로를 담은 오류로 거부한다.

`career-os/.claude/skills/resume-preparer/scripts/validate_submission_bundle.test.ts`에도 새 경로 기준의 정상 경로 하나와 `review/` 파일이 최상위에 있을 때의 실패 하나를 더한다.
기존 테스트의 경로 문자열도 새 계약으로 고친다.

---

## 검증

저장소 루트에서 실행한다.

```bash
# cwd: 저장소 루트 (fos-agents)
bun test ./career-os/.claude/skills/
bun test ./career-os/scripts/
bunx tsc --noEmit
```

세 명령이 모두 종료 코드 0이어야 한다.

토스플레이스 디렉터리가 계약대로 배치됐는지 확인한다.

```bash
# cwd: 저장소 루트 (fos-agents)
ls career-os/applications/tossplace/server-developer-ai-platform
ls career-os/applications/tossplace/server-developer-ai-platform/evidence
ls career-os/applications/tossplace/server-developer-ai-platform/review
```

최상위에 `.md`와 `.json`이 남아 있지 않아야 한다.

```bash
# cwd: 저장소 루트 (fos-agents)
ls career-os/applications/tossplace/server-developer-ai-platform/*.md \
  career-os/applications/tossplace/server-developer-ai-platform/*.json 2>&1
```

`no matches found` 또는 `No such file` 이어야 한다.

`career-os/applications`에 `coupang`, `daangn`과 `_archive`가 없어야 한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/application-package-writer/scripts/package_contract.ts` | 수정 |
| `career-os/.claude/skills/application-package-writer/scripts/validate_application_package.ts` | 수정 |
| `career-os/.claude/skills/application-package-writer/scripts/validate_application_package.test.ts` | 수정 |
| `career-os/.claude/skills/resume-preparer/scripts/resume_submission_contract.ts` | 수정 |
| `career-os/.claude/skills/resume-preparer/scripts/export_resume.ts` | 수정 |
| `career-os/.claude/skills/resume-preparer/scripts/build_submission_bundle.ts` | 수정 |
| `career-os/.claude/skills/resume-preparer/scripts/validate_submission_bundle.ts` | 수정 |
| `career-os/.claude/skills/resume-preparer/scripts/validate_submission_bundle.test.ts` | 수정 |
| `career-os/.claude/skills/resume-preparer/scripts/validate_claim_ledger.ts` | 수정 |
| `career-os/scripts/interview-drill/application_question_schema.ts` | 수정 |
| `career-os/scripts/interview-drill/drill-engine.ts` | 수정 |
| `career-os/.claude/skills/application-package-writer/SKILL.md` | 수정 |
| `career-os/.claude/skills/resume-preparer/SKILL.md` | 수정 |
| `career-os/.claude/skills/interview-practice/SKILL.md` | 수정 |
| `career-os/applications/tossplace/server-developer-ai-platform/` | 이동 |
| `career-os/applications/coupang/`, `career-os/applications/daangn/`, `career-os/applications/_archive/` | 삭제 |
