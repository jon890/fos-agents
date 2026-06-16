## ADR-056 — resume package는 Markdown 산출물 계약을 먼저 고정한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

plan031 application-flow-agent, plan038 frontdoor queue, plan054 application workbench가 완료되면서 지원 준비 흐름은 화면과 원장을 갖췄다.
하지만 다음 단계인 맞춤 이력서 생성에서는 경계가 흐리다.

현재 `application-package.md`는 지원 전략, 이력서 문장, 지원동기, 검토 요청이 섞일 수 있다.
이 상태에서 바로 dashboard action이나 export를 붙이면 내부 분석과 제출용 문구가 섞이고, `needs_evidence`가 해결되지 않은 채 제출 초안에 남을 수 있다.

### 결정

- plan055를 `resume package flow`로 연다.
- Markdown 산출물 계약을 먼저 고정한다.
  PDF/DOCX export는 당시 후속 plan으로 두었다.
  PDF export 범위는 ADR-059가 대체한다.
- `application-package.md`는 내부 지원 전략과 초안 방향 문서로 유지한다.
- 제출용 초안은 별도 파일로 분리한다.
  - `resume-draft.md`
  - `cover-letter.md`
  - `submission-checklist.md`
- 필요할 때만 `resume-metadata.json`을 도입한다.
  readiness/status 계산을 단순화하지 못하면 Markdown 파일 존재와 `review.md`를 우선한다.
- 생성 문서 품질 계약을 둔다.
  첫 10줄 안에 결론을 두고, 한국어 우선 제목과 자연스러운 한국어 문장을 사용한다.
  내부 분석과 제출용 문구를 분리한다.
- `needs_evidence`는 `보강 필요 / 선택지 / 권장 행동` resolution loop로 바꾼다.
- application request 상태는 `pending`, `running`, `done`, `failed`, `stale`를 기본값으로 둔다.
  상태에는 `ledgerId`, `error`, `resultSnapshot`을 포함한다.
- processor는 `run.ts resume` 이후 실제 산출물을 파일 시스템에서 검증한다.
  검증 대상은 `posting.md`, `fit-analysis.md`, `application-package.md`, `resume-draft.md`, `cover-letter.md`, `submission-checklist.md`, `review.md`다.

### 결과

- 지원 전략 문서와 제출용 문서의 책임이 분리된다.
- 사용자 검토 전 자동 제출이나 외부 전송으로 흐르지 않는다.
- workbench는 "요청이 처리 중인가", "어떤 파일이 준비됐는가", "무엇이 막혔는가"를 같은 언어로 표시할 수 있다.
- export 기능은 ADR-059에 따라 HTML/PDF 로컬 파일 생성으로 다룬다.

### 적용

- `tasks/plan055-resume-package-flow/` — 구현 계획.
- `docs/prd.md` — resume package flow planned scope.
- `docs/data-schema.md` — Resume Package Contract와 generated document quality contract.
- `docs/flow.md` — `run.ts resume` 처리 흐름과 request status projection.
- `docs/code-architecture.md` — runner, processor, fos-career adapter 책임 경계.
