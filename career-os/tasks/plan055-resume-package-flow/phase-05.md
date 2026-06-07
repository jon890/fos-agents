# Phase 05 — 워크벤치 UX와 export 게이트

**Model**: sonnet
**Status**: pending

---

## 목표

fos-career application workbench가 resume package readiness와 request status를 보여주게 한다.
PDF/DOCX export는 의도적으로 막고,
Markdown contract freeze 이후 별도 plan으로 넘긴다.

**범위 외**: PDF/DOCX 생성, 외부 제출, 로그인/브라우저 입력 자동화, candidate-profile mutation.

---

## 관련 docs

실행 전 반드시 읽는다.

- `docs/prd.md` — plan054와 plan055 범위
- `docs/data-schema.md` — workbench projection, request status
- `docs/flow.md` — Resume Package Flow
- `docs/code-architecture.md` — fos-career adapter/UI responsibility
- `docs/adr.md` — ADR-054, ADR-056
- `tasks/plan054-fos-career-application-workbench/index.json`

---

## 작업 항목 (5)

### 1. readiness projection 확장

수정 대상:

- `/home/bifos/services/fos-career/lib/career-os/types.ts`
- `/home/bifos/services/fos-career/lib/career-os/adapter.ts`

readiness에 다음 항목을 추가한다.

- resume draft
- cover letter
- submission checklist

기존 posting, fit analysis, application package, review readiness는 유지한다.

### 2. request status 표시 추가

수정 대상:

- `/home/bifos/services/fos-career/app/dashboard/applications/**`
- `/home/bifos/services/fos-career/lib/**`

상태 badge 또는 row/detail 표시를 추가한다.

- `pending`
- `running`
- `done`
- `failed`
- `stale`

오류가 있으면 `error` 요약을 보여준다.
문서 전문은 UI status summary에 복사하지 않는다.

### 3. detail 문서 링크/미리보기 정리

detail 화면에서 다음 파일의 존재 여부와 열람 경로를 보여준다.

- `application-package.md`
- `resume-draft.md`
- `cover-letter.md`
- `submission-checklist.md`
- `review.md`

내부 분석과 제출용 문서 구분이 화면에서 보이게 한다.

### 4. export gate 표시

PDF/DOCX 버튼을 구현하지 않는다.
필요하면 비활성 상태나 "Markdown 검토 후 후속" 성격의 내부 UI state로만 표시한다.
사용자 승인 없는 제출/다운로드 자동화로 이어지면 안 된다.

### 5. typecheck와 screenshot smoke

fos-career typecheck를 실행한다.
가능하면 Playwright 또는 기존 smoke 방식으로 list/detail 화면이 깨지지 않는지 확인한다.

---

## 성공 기준

- workbench list/detail에서 resume package readiness가 보인다.
- request status와 error summary가 보인다.
- 내부 전략 문서와 제출용 문서가 구분된다.
- PDF/DOCX export는 구현되지 않았고 후속 gate로 남는다.
- fos-career는 career-os 파일을 직접 쓰지 않는다.

---

## 검증

보고 직전 반드시 실행한다.

```bash
cd /home/bifos/services/fos-career
npx tsc --noEmit
rg "resumeDraft|coverLetter|submissionChecklist|resume-draft.md|cover-letter.md|submission-checklist.md" app lib
rg "pending|running|done|failed|stale" app lib
git status --short
```

가능하면 UI smoke를 실행한다.

```bash
cd /home/bifos/services/fos-career
npm run test -- --runInBand
```

프로젝트에 해당 test script가 없으면 실행하지 말고 이유를 보고한다.

---

## Blocked / Failed 조건

- `/home/bifos/services/fos-career`가 없거나 git repo가 아니면 `PHASE_BLOCKED: fos-career repo unavailable`를 출력하고 exit 2.
- request status source가 phase-02에서 확정되지 않았으면 `PHASE_BLOCKED: application request status source unavailable`를 출력하고 exit 2.
- typecheck가 실패하고 원인을 수정하지 못하면 `PHASE_FAILED: fos-career resume workbench typecheck failed`를 출력하고 exit 1.

---

## Intended File Scope

- `/home/bifos/services/fos-career/lib/career-os/**`
- `/home/bifos/services/fos-career/app/dashboard/applications/**`
- 필요 시 `/home/bifos/services/fos-career/components/**`
- 필요 시 `docs/prd.md`, `docs/data-schema.md`, `docs/flow.md`, `docs/code-architecture.md`

---

## Self-check

- export/PDF/DOCX를 구현하지 않는다.
- 외부 제출, 로그인, 브라우저 입력을 추가하지 않는다.
- career-os data 파일을 fos-career에서 직접 수정하지 않는다.
