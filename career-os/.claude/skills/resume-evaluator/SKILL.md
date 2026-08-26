---
name: resume-evaluator
description: 근거 감사를 마친 공고 맞춤 이력서 또는 경력기술서를 블라인드 채용 검토와 엄격한 기준으로 평가하고 설득력, 구조, 가독성과 A4 출력 품질을 개선하는 career-os 내부 스킬. "이력서 채점해줘", "경력기술서 평가", "HTML 이력서 하드 리뷰", "resume score"처럼 제출 전 경쟁력 검증이 필요할 때 사용한다.
---

# 제출 문서 평가

검증된 사실의 범위 안에서 HTML 이력서의 설득력과 제출 품질을 개선한다.
사실성은 `resume-evidence-auditor`가 만든 근거 장부를 기준으로 판단한다.
`pass`는 합격 보장이 아니라 이력서가 통제할 수 있는 명백한 탈락 사유가 없다는 판정이다.

## 입력

- `applications/<company>/<role>/resume.html` 또는 `career-description.html`
- 같은 문서를 가리키는 근거 원장
- 공고 또는 `posting.md`
- 후보자 프로필
- `references/scoring-rubric.md`
- `references/hard-review.md`

원장이 없거나 다른 파일을 가리키거나 제출 문구 해시가 다르면 평가를 시작하지 않는다.
먼저 `resume-evidence-auditor`를 실행한다.

## 실행

최대 세 번 반복한다.

1. 다음 명령으로 근거 원장이 현재 HTML을 가리키는지 확인한다.

```bash
bun career-os/.claude/skills/resume-evidence-auditor/scripts/validate_claim_ledger.ts \
  <claim-ledger.json> --artifact <resume.html>
```

2. `references/hard-review.md`를 읽고 블라인드 검토를 먼저 수행한다.
   이 단계에서는 공고와 제출할 정확한 PDF·HTML만 읽고, 기존 점수표와 지원 패키지의 해설은 읽지 않는다.
3. 다음 명령으로 문서 파일명에 맞는 HTML 계약을 검사한다.

```bash
bun career-os/.claude/skills/resume-evaluator/scripts/check_resume_html.ts <resume.html>
```

`career-description.html`에는 경력기술서 전용 필수 섹션을 적용한다.
파일명이 표준 이름이 아니면 `--document-type resume|career-description`을 명시한다.

4. 블라인드 채용 담당자와 기술 리더가 각각 `pass` 또는 `reject`를 선택하고 근거를 기록한다.
5. 근거 장부와 후보자 자료를 읽고 대표 주장마다 면접에서 방어 가능한지 확인한다.
6. 실제 브라우저 렌더에서 글자 겹침, 잘림, 링크, 대비와 페이지 넘침을 확인한다.
7. `references/scoring-rubric.md`로 인사 40점, 기술 45점, 제출 품질 15점을 처음부터 채점한다.
   기존 점수는 참고하거나 이어받지 않는다. 경력기술서는 같은 기준을 쓰되 프로젝트별 문제, 본인 판단, 결과와 직무 연결의 완결성을 더 중점으로 본다.
8. 탈락 가능성이 큰 문제부터 HTML과 문구를 수정한다.
9. 보이는 문구가 바뀌면 근거 감사를 다시 실행한다.
10. 블라인드 검토, 근거 방어, 정적 검사와 실제 렌더를 모두 다시 확인한다.

스타일만 바뀌고 보이는 문구가 같으면 기존 원장을 재사용할 수 있다.
`artifactTextSha256`가 이 경계를 검증한다.

## 수정 우선순위

1. 공개하면 안 되는 내용과 원장보다 강한 표현
2. 불명확한 목표 역할과 분산된 핵심 강점
3. 문제, 행동, 결과가 연결되지 않는 경력 문장
4. 공고와 연결되지 않는 기술 나열
5. 첫 페이지 과밀, 약한 시각 계층과 출력 결함
6. 어색한 문장과 장식적 요소

첫 사례는 가장 복잡한 프로젝트가 아니다.
채용자가 다음 단계로 넘길 이유를 가장 빨리 설명하는 사례를 둔다.
한 사례의 강점으로 다른 대표 사례의 문제 정의, 본인 판단과 결과 부족을 상쇄하지 않는다.

## 통과 조건

- 근거 원장 검증 통과
- 총점 95점 이상
- 인사 담당자 38/40 이상
- 기술 리더 42/45 이상
- 제출 품질 15/15
- 블라인드 채용 담당자와 기술 리더가 모두 `pass`
- 공고 핵심 책임과 연결되는 직접 근거 또는 방어 가능한 인접 근거가 대표 사례마다 존재
- 대표 사례의 설명 불가능한 문장과 미해결 사실 질문 0개
- 치명적 결함 0개
- 정적 검사 통과
- 실제 렌더 결함 0개

점수가 기준을 넘더라도 한 검토자가 `reject`를 선택하거나 경쟁상 명확한 차단 항목이 남으면 `pass`가 아니다.
경쟁 후보, 채용 인원과 조직 상황처럼 이력서가 통제할 수 없는 변수 때문에 합격을 보장하지 않는다.

세 번째 반복에도 기준을 충족하지 못하면 `revise` 또는 `blocked`로 끝낸다.
근거 없이 점수를 올리거나 수치, 역할과 기술 경험을 만들지 않는다.

## 산출물

- 개선된 제출 HTML
- 이력서는 resume-scorecard.md, 경력기술서는 career-description-scorecard.md

점수표 첫 10줄에는 다음 식별자를 기록한다.

```markdown
- artifact: `resume.html`
- artifactTextSha256: `<현재 근거 원장과 같은 64자리 해시>`
- verdict: `pass|revise|blocked`
```

점수표에는 블라인드 판정, 두 평가자 점수, 경쟁상 차단 항목, 근거 방어 결과, 실제 수정, 자동 검사와 통제할 수 없는 위험을 남긴다.
내부 경로와 검토 상태는 제출 HTML에 넣지 않는다.
실제 지원, 로그인, 업로드와 외부 전송은 하지 않는다.

## 참고 자료

- `references/scoring-rubric.md`
- `references/hard-review.md`
- `scripts/resume_html_contract.ts`
- `config/resume-design.md`
