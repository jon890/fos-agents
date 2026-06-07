# Phase 01 — 문서 정합성 + 이력서 패키지 계약

**Model**: sonnet
**Status**: completed

---

## 목표

plan031, plan038, plan054 이후 남은 docs drift를 정리하고,
resume package Markdown 산출물 계약을 구현 전 기준으로 고정한다.

**범위 외**: TypeScript 구현, fos-career UI 수정, export 구현, 실제 지원 산출물 생성.

---

## 관련 docs

실행 전 반드시 읽는다.

- `docs/prd.md` — application-agent, frontdoor, workbench, resume package scope
- `docs/data-schema.md` — application files, workbench projection, request schema
- `docs/flow.md` — application-agent resume flow
- `docs/code-architecture.md` — application-agent와 fos-career 경계
- `docs/adr.md` — ADR-037, ADR-038, ADR-040, ADR-045, ADR-053, ADR-054, ADR-056

---

## 작업 항목 (4)

### 1. planned/completed drift 정리

수정 대상:

- `docs/prd.md`
- `docs/data-schema.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `docs/adr.md`

plan031, plan038, plan050, plan053, plan054가 완료됐는데 아직 planned로 보이는 표현을 정리한다.
명확히 stale한 표현만 바꾸고,
새 구현을 암시하는 문장은 추가하지 않는다.

### 2. Resume Package Contract 고정

수정 대상:

- `docs/data-schema.md`
- `docs/code-architecture.md`

필수 Markdown 산출물을 문서화한다.

- `application-package.md`: 내부 지원 전략과 초안 방향
- `resume-draft.md`: 제출용 이력서 초안
- `cover-letter.md`: 지원동기/자기소개서 초안
- `submission-checklist.md`: 수동 제출 전 체크리스트
- `review.md`: evidence, drift, privacy, approval gate 검토

`resume-metadata.json`은 optional로만 적는다.
필수 파일로 만들지 않는다.

### 3. 생성 문서 품질 계약 추가

수정 대상:

- `docs/data-schema.md`
- `docs/flow.md`

생성 문서 품질 계약을 한국어로 고정한다.

- 첫 10줄 안에 결론을 둔다.
- 한국어 우선 섹션 제목을 쓴다.
- 자연스러운 한국어 문장을 쓴다.
- 내부 분석과 제출용 문구를 분리한다.
- `needs_evidence`는 `보강 필요 / 선택지 / 권장 행동`으로 바꾼다.
- 긴 문단과 영어-heavy label을 피한다.

### 4. ADR 적용 확인

수정 대상:

- `docs/adr.md`

ADR-056이 위 결정을 단일 결정 기록으로 설명해야 한다.
Quick Index와 본문 헤더 상태가 일치해야 한다.

---

## 성공 기준

- docs가 plan055 구현자가 따라야 할 Markdown 산출물 계약을 설명한다.
- `application-package.md`와 제출용 문서의 경계가 분명하다.
- `resume-draft.md`, `cover-letter.md`, `submission-checklist.md`가 docs에 등장한다.
- `needs_evidence` resolution loop가 docs에 등장한다.
- export/PDF/DOCX는 후속 작업으로 남는다.

---

## 검증

보고 직전 반드시 실행한다.

```bash
python3 -m json.tool tasks/plan055-resume-package-flow/index.json >/dev/null
rg "resume-draft.md|cover-letter.md|submission-checklist.md" docs/prd.md docs/data-schema.md docs/flow.md docs/code-architecture.md docs/adr.md
rg "생성 문서 품질|보강 필요 / 선택지 / 권장 행동" docs/prd.md docs/data-schema.md docs/flow.md docs/code-architecture.md docs/adr.md
git diff -- docs/prd.md docs/data-schema.md docs/flow.md docs/code-architecture.md docs/adr.md tasks/plan055-resume-package-flow
```

---

## Blocked / Failed 조건

- 기존 docs가 서로 충돌해 단일 기본값을 고르기 어렵다면 `PHASE_BLOCKED: resume package contract conflict`를 출력하고 exit 2.
- `resume-metadata.json` 도입이 필수로 보이면 `PHASE_BLOCKED: resume metadata schema decision required`를 출력하고 exit 2.
- JSON 검증이 실패하면 `PHASE_FAILED: plan055 index json invalid`를 출력하고 exit 1.

---

## Intended File Scope

- `docs/prd.md`
- `docs/data-schema.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `docs/adr.md`
- `tasks/plan055-resume-package-flow/index.json`
- `tasks/plan055-resume-package-flow/phase-01.md`

---

## Self-check

- 구현 코드, `.claude` skill, `config/candidate-profile.md`, public fos-study 파일을 수정하지 않는다.
- docs에는 repo-relative path를 사용한다.
- phase당 작업 항목 5개 이하를 유지한다.
