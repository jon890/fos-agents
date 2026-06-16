## ADR-056 — resume package는 Markdown 산출물 계약을 먼저 고정한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

plan054 application workbench가 완료되면서 지원 준비 흐름은 화면과 원장을 갖췄다.
하지만 다음 단계인 맞춤 이력서 생성에서는 경계가 흐리다.

`application-package.md`는 지원 전략, 이력서 문장, 지원동기, 검토 요청이 섞일 수 있다.
이 상태에서 바로 dashboard action이나 export를 붙이면 내부 분석과 제출용 문구가 섞이고, `needs_evidence`가 해결되지 않은 채 제출 초안에 남을 수 있다.

### 결정

- plan055를 `resume package flow`로 연다.
- Markdown 산출물 계약을 먼저 고정하고, PDF/DOCX export는 후속 plan으로 둔다.
  PDF export 범위는 ADR-059가 대체한다.
- `application-package.md`는 내부 지원 전략과 초안 방향 문서로 유지한다.
- 제출용 초안은 `resume-draft.md`, `cover-letter.md`, `submission-checklist.md`로 분리한다.
- `needs_evidence`는 보강 필요 / 선택지 / 권장 행동 resolution loop로 바꾼다.
- 생성 문서 품질 계약: 첫 10줄 안에 결론, 한국어 우선, 내부 분석과 제출 문구 분리.

### 결과

- 지원 전략 문서와 제출용 문서의 책임이 분리된다.
- 사용자 검토 전 자동 제출이나 외부 전송으로 흐르지 않는다.
- workbench는 요청 처리 상태, 준비된 파일, 막힌 지점을 같은 언어로 표시할 수 있다.
- export 기능은 ADR-059에 따라 HTML/PDF 로컬 파일 생성으로 다룬다.
