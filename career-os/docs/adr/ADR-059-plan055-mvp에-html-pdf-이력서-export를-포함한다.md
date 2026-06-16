## ADR-059 — plan055 MVP에 HTML/PDF 이력서 export를 포함한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

ADR-056은 Markdown 산출물 계약을 먼저 고정하고 PDF export를 후속으로 두었다.
이후 plan055 완료 범위가 맞춤 이력서 패키지 MVP까지 확장됐다.
사용자가 실제 지원 전 첨부할 수 있는 PDF 이력서가 필요하다.

외부 제출, 채용 사이트 로그인, 브라우저 입력 자동화는 여전히 승인 경계 밖이다.

### 결정

- plan055 MVP에 첨부 가능한 PDF resume export를 포함한다.
- export 체인은 `resume-draft.md` → `design.md` 적용 `resume.html` → headless Chrome 출력 `resume.pdf` 순서로 고정한다.
- 공고별 `design.md`가 있으면 우선 사용한다.
  없으면 `config/resume-design.md` 기본 디자인 계약을 사용한다.
- `resume-exporter`는 career-os 내부 파일만 생성한다.
  업로드, 전송, 제출 버튼 클릭은 하지 않는다.

### 결과

- Markdown 리뷰 루프와 PDF 첨부 파일 생성이 같은 plan 안에서 연결된다.
- 사용자는 `resume.pdf`를 직접 확인한 뒤 수동 제출할 수 있다.
- export 기능은 외부 제출 자동화와 분리된다.
