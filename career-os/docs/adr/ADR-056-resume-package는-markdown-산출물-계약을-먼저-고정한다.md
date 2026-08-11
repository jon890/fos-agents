## ADR-056 — resume package는 Markdown 산출물 계약을 먼저 고정한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

지원 전략, 이력서 문장, 지원동기, 검토 요청을 한 문서에 섞으면 내부 분석이 제출용 문구로 누출될 수 있다.
근거가 부족한 문장이 표시만 된 채 최종 초안에 남는 문제도 있다.

### 결정

- `application-package.md`는 내부 지원 전략과 초안 방향을 담는다.
- 제출용 초안은 `resume-draft.md`, `cover-letter.md`, `submission-checklist.md`로 분리한다.
- 근거 부족은 보강 필요, 선택지, 권장 행동으로 나누어 해결한다.
- 산출물은 사용자 검토 전에 외부로 제출하거나 전송하지 않는다.
- 첨부용 HTML/PDF 생성은 ADR-059를 따른다.

### 결과

지원 전략과 외부 제출용 문서의 책임이 분리된다.
