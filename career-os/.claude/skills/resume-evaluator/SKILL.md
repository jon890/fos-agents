---
name: resume-evaluator
description: 근거 감사를 마친 공고 맞춤 HTML 이력서를 100점 기준으로 평가하고 설득력, 구조, 가독성과 A4 출력 품질을 개선하는 career-os 스킬. "이력서 채점해줘", "HTML 이력서 평가", "resume score"처럼 제출 전 품질 개선이 필요할 때 사용한다.
---

# 이력서 평가

검증된 사실의 범위 안에서 HTML 이력서의 설득력과 제출 품질을 개선한다.
사실성의 정본은 `resume-evidence-auditor`가 만든 원장이다.

## 입력

- `applications/<company>/<role>/resume.html`
- 같은 디렉터리의 `claim-ledger.json`
- 공고 또는 `posting.md`
- 후보자 프로필
- `references/scoring-rubric.md`

원장이 없거나 다른 파일을 가리키거나 제출 문구 해시가 다르면 평가를 시작하지 않는다.
먼저 `resume-evidence-auditor`를 실행한다.

## 실행

최대 세 번 반복한다.

1. 다음 명령으로 근거 원장이 현재 HTML을 가리키는지 확인한다.

```bash
bun career-os/.claude/skills/resume-evidence-auditor/scripts/validate_claim_ledger.ts \
  <claim-ledger.json> --artifact <resume.html>
```

2. 다음 명령으로 HTML 계약을 검사한다.

```bash
bun career-os/.claude/skills/resume-evaluator/scripts/check_resume_html.ts <resume.html>
```

3. 실제 브라우저 렌더에서 글자 겹침, 잘림, 링크, 대비와 페이지 넘침을 확인한다.
4. `references/scoring-rubric.md`로 인사 40점, 기술 45점, 제출 품질 15점을 채점한다.
5. 탈락 가능성이 큰 문제부터 HTML과 문구를 수정한다.
6. 보이는 문구가 바뀌면 근거 감사를 다시 실행한다.
7. 정적 검사와 실제 렌더를 다시 확인한다.

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

## 통과 조건

- 근거 원장 검증 통과
- 총점 90점 이상
- 인사 담당자 32/40 이상
- 기술 리더 36/45 이상
- 제출 품질 12/15 이상
- 치명적 결함 0개
- 정적 검사 통과
- 실제 렌더 결함 0개

세 번째 반복에도 기준을 충족하지 못하면 `revise` 또는 `blocked`로 끝낸다.
근거 없이 점수를 올리거나 수치, 역할과 기술 경험을 만들지 않는다.

## 산출물

- 개선된 `resume.html`
- 같은 디렉터리의 `resume-scorecard.md`

점수표에는 최종 판정, 두 평가자 점수, 감점 근거, 실제 수정, 자동 검사와 남은 위험을 남긴다.
내부 경로와 검토 상태는 제출 HTML에 넣지 않는다.
실제 지원, 로그인, 업로드와 외부 전송은 하지 않는다.

## 참고 자료

- `references/scoring-rubric.md`
- `scripts/resume_html_contract.ts`
- `config/resume-design.md`
