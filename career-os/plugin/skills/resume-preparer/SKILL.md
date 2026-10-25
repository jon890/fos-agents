---
name: resume-preparer
description: 공고가 찾는 역량과 후보자의 강한 경험을 연결하는 이력서와 경력기술서를 제출 가능한 PDF로 완성할 때 사용한다. 면접 말하기 준비와 답변 연습은 interview-practice가 담당한다. Claude Code 에서만 돈다.
---
# 이력서 제출 준비

**목표: 공고와 확인된 경험을 연결해 심사자가 다음 전형으로 넘길 이유를 찾을 수 있는 제출 문서를 완성한다.**

## 워크플로 개요

| 단계 | 이름 | 통과 조건 |
| --- | --- | --- |
| 1 | 작업본과 근거 준비 | 공고, 지원 판단과 제출 대상이 특정됐다. |
| 2 | 사실과 대표 근거 확정 | 제출 문장의 사실과 표현에 대한 사용자 확인이 끝났다. |
| 3 | 원고 작성 | 대표 경험의 문제, 역할, 판단과 확인된 결과가 원고에 있다. |
| 4 | HTML과 PDF 검증 | 실제 제출 PDF의 모든 쪽을 확인했고 출력 결함이 없다. |
| 5 | 주장 감사와 채용 리뷰 | 검토 대상과 적용 범위가 기록됐고 필수 수정이 없다. |
| 6 | 검증 완료 주장 재사용과 반영 | 현재 문구와 일치하는 원장의 주장이 모두 safe다. |
| 7 | 제출 묶음 완성 | 최종 파일과 검토 기록의 연결 및 제출 묶음 검증이 통과했다. |

## 실행 환경

이 스킬은 Claude Code 에서만 돈다.
셸이 없는 환경이면 할 수 없다고 알리고 끝낸다.

실행기 명령은 `bun --no-env-file "${CLAUDE_PLUGIN_ROOT}/dist/career-local.js"` 이다.
`references/`의 `<CAREER_LOCAL>`은 위 실행기 명령을 뜻하며 셸에 그대로 입력하지 않는다.
셸 환경에 `CAREER_BACKEND_URL`, `CAREER_BACKEND_TOKEN` 이 있어야 한다.
아래 명령의 `APPLICATION_DIR`은 작업본의 지원 디렉터리, `HTML_FILE`과 `LEDGER_FILE`은 현재 HTML과 주장 원장 경로다. 해당 단계에서 실제 경로로 설정하고 `CLAUDE_PLUGIN_ROOT`가 설치된 플러그인을 가리키는지 확인한다. `CLAIM_QUERY`는 재사용할 주장 검색어다.
PDF 를 만들 때 쓰는 Chrome 은 `CHROME_BIN`, `pdfunite` 는 `PDFUNITE_BIN` 으로 위치를 알려 줄 수 있다.

## 경계

- 공고 안내, 회사별 기준, [개인 작성 취향](references/resume-taste.md), [공통 작성 기준](references/resume-writing-style.md) 순으로 적용한다.
- 구현, 소유권, 결과와 경험 깊이를 분리하고 확인된 근거보다 강하게 쓰지 않는다.
- 비공개 근거와 사내 식별자를 제출 문서에 노출하지 않는다.
- 사용자가 확인하지 않은 사실이 남아 있으면 제출 준비를 완료하지 않는다.
- 실제 제출은 사용자의 최종 승인 뒤에만 수행한다.

## 워크플로

### 1. 작업본과 근거 준비

최신 지원 작업본을 준비한다.

```bash
bun --no-env-file "${CLAUDE_PLUGIN_ROOT}/dist/career-local.js" workspace begin resume-preparer --json
```

결과의 `root` 아래 `applications/<회사>/<직무>/` 가 지원 디렉터리다.
`workspace paths --json` 하위 명령이 `root` 와 `evidenceDir` 를 낸다.
지원 디렉터리의 `evidence/posting.md`, `evidence/fit.md`와 `evidence/status.md`에서 지원 직무, 지원 판단과 제출 문서를 확인한다.
지원 판단이나 후보자 인터뷰가 준비되지 않았으면 `application-package-writer` 스킬로 먼저 만든다고 안내하고 끝낸다.

주장 감사에 쓰는 근거 원본은 `evidenceDir` 에 있다.
근거 원본이 최신인지 확인하고, 오래됐으면 사용자에게 알린다.
개인 맥락은 파일 경로가 아니라 후보자 맥락 문서에서 조회한다.

### 2. 사실과 대표 근거 확정

`evidence/candidate-interview.md`와 기존 근거를 먼저 읽는다.
현재 경력, 역할 선호와 경험 경계는 [개인 맥락 조회 기준](references/candidate-context.md)에 따라 확인한다.
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
bun --no-env-file "${CLAUDE_PLUGIN_ROOT}/dist/career-local.js" resume export --application-dir "${APPLICATION_DIR:?지원 디렉터리를 설정하세요}"
bun --no-env-file "${CLAUDE_PLUGIN_ROOT}/dist/career-local.js" resume check-html "${HTML_FILE:?HTML 경로를 설정하세요}"
```

공고의 분량 제한을 우선한다.
제한이 없으면 근거의 양, 중복과 읽기 편의성으로 분량과 페이지 구분을 정한다.
외부 이력서 편집기에서 PDF를 내보내면 최신 저장본과 내려받은 PDF를 대조한다. 편집기의 제목·기간·서식 지원에 맞추고, 로컬 HTML과 같은 출력이라고 가정하지 않는다.

### 5. 주장 감사와 채용 리뷰

현재 HTML의 주장 원장을 `schemaVersion: 3`으로 만들고,
`document`와 `user` 근거의 인용 위치를 `locator`에 기록한다.
세부 형식은 [주장 검증 모델](references/claim-model.md)을 따른다.
근거 경로는 명령을 실행하는 작업본 `root` 아래의 지원 디렉터리 기준 상대 경로나 절대 경로로 쓴다.
`validate-ledger` 가 상대 경로를 실행 위치(`process.cwd()`) 기준으로 풀기 때문이다. `application-package-writer` 도 같은 자리에서 부른다.

```bash
bun --no-env-file "${CLAUDE_PLUGIN_ROOT}/dist/career-local.js" resume validate-ledger "${LEDGER_FILE:?원장 경로를 설정하세요}" --artifact "${HTML_FILE:?HTML 경로를 설정하세요}"
```

이후 [독립 채용 리뷰](references/hard-review.md)와 [판정 기준](references/scoring-rubric.md)에 따라 인사담당자와 실무담당자 관점으로 검토한다.
공고의 작성 안내에 따라 경험을 다시 평가하고 인터뷰·수정을 반복해야 하면 `resume-review` 스킬을 사용한다. 작성·판정 기준은 기존 참조 문서를 유지한다.
변경 후 재검토 범위와 기록은 [독립 채용 리뷰](references/hard-review.md)의 버전 연결 기준을 따른다.

### 6. 검증 완료 주장 재사용과 반영

이전 검증 결과가 있으면 먼저 재사용 범위를 판정한다. `reuse_partial` 이면
출력의 `rereadEvidence` 와 변경된 주장만 다시 감사하고, `full_audit` 이면 전체 원장을 만든다.

```bash
bun --no-env-file "${CLAUDE_PLUGIN_ROOT}/dist/career-local.js" resume assess-reuse "${APPLICATION_DIR:?지원 디렉터리를 설정하세요}"
bun --no-env-file "${CLAUDE_PLUGIN_ROOT}/dist/career-local.js" resume search-claims "${CLAIM_QUERY:?검색어를 설정하세요}"
```

현재 HTML과 일치하는 버전 3 원장의 모든 주장이 `safe` 일 때만 검증 결과를 반영한다.

```bash
bun --no-env-file "${CLAUDE_PLUGIN_ROOT}/dist/career-local.js" resume promote-claims "${APPLICATION_DIR:?지원 디렉터리를 설정하세요}"
```

### 7. 제출 묶음 완성

사실 확인, 주장 감사, 채용 리뷰와 화면 검증이 모두 통과했을 때만 `readiness: ready`로 바꾼다.
다음 순서로 제출 묶음을 만들고 검증한다.

```bash
bun --no-env-file "${CLAUDE_PLUGIN_ROOT}/dist/career-local.js" resume build-bundle "${APPLICATION_DIR:?지원 디렉터리를 설정하세요}"
bun --no-env-file "${CLAUDE_PLUGIN_ROOT}/dist/career-local.js" resume validate-bundle "${APPLICATION_DIR:?지원 디렉터리를 설정하세요}"
```

지원 패키지 검사와 검토 화면은 `application-package-writer` 스킬이 한다.
manifest의 PDF 해시와 검토 기록의 최종 PDF 해시를 대조한다. 외부 편집기 PDF처럼 기존 묶음 검증기가 다루지 않는 파일은 실제 파일 경로와 해시, 저장본 대조 및 재검토 결과를 별도로 남긴다. 이 확인을 기존 검증기 통과라고 보고하지 않는다.

최종 파일을 확인한 뒤 작업본을 반영한다.

```bash
bun --no-env-file "${CLAUDE_PLUGIN_ROOT}/dist/career-local.js" workspace finish resume-preparer --json
```

사용자에게 제출 PDF를 보여주고 실제 제출 승인을 기다린다.

## 완료 조건

- `human-confirmation`이 `complete`다.
- 모든 제출 문장이 근거 범위 안에 있다.
- 인사담당자와 실무담당자 관점의 검토를 통과했다.
- HTML과 PDF에 겹침, 잘림, 깨진 링크와 페이지 넘침이 없다.
- 제출 묶음 검증이 통과했다.
