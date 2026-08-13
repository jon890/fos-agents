---
name: application-reviewer
description: application-package-writer가 만든 공고별 Markdown 지원 패키지를 검토해 pass, revise, blocked 판정을 내리는 career-os 스킬. "지원 패키지 검토해줘", "review.md 만들어줘", "지원서 점검"처럼 공고 적합성, 문서 정합성, 제출 문구 안전성과 진행 제한을 확인할 때 사용한다.
---

# 지원 패키지 검토

공고별 Markdown 지원 패키지를 제출 전 단계에서 검토한다.
HTML 이력서의 사실 감사와 렌더 평가는 각각 전용 스킬에 맡긴다.

## 입력

지원 디렉터리에서 다음 파일을 읽는다.

- `posting.md`
- `fit-analysis.md`
- `application-package.md`
- `resume-draft.md`
- `cover-letter.md`
- `submission-checklist.md`
- `config/candidate-profile.md`
- 프로필에서 연결한 최신 경력 자료와 업무 근거
- 선택적으로 `state/positions-queue.jsonl`

입력 경로가 없으면 검토 대기 후보를 찾을 수 있다.
후보가 둘 이상이면 임의로 고르지 않는다.

## 검토 축

- 공고 적합성: 필수 조건과 역할 해석이 공고 원문과 일치하는지 확인한다.
- 패키지 정합성: 분석, 전략, 이력서 초안, 지원동기와 체크리스트가 서로 모순되지 않는지 확인한다.
- 제출 문구 안전성: 프로필 근거보다 강한 수치, 역할, 기술과 인과 표현을 찾는다.
- 개인정보와 공개 범위: 내부 정보, 타인 정보와 로컬 경로가 제출 문서에 없는지 확인한다.
- 중복 지원과 진행 제한: 쿨다운, 중복 지원, 마감과 반복 횟수를 확인한다.
- 사용자 승인 항목: 실제 제출과 후보자만 확인할 수 있는 사실을 분리한다.

깊은 주장 단위 사실 검증은 `resume-evidence-auditor`의 책임이다.
HTML 구조, A4 출력과 렌더 품질은 `resume-evaluator`의 책임이다.
이 스킬은 Markdown 초안에서 발견한 위험을 수정 요청으로 넘긴다.

## 판정

- `pass`: 공고 해석과 문서가 정합하며 제출을 막는 위험이 없다.
- `revise`: 에이전트가 고칠 수 있는 구체적인 문제가 남아 있다.
- `blocked`: 공고 만료, 쿨다운, 심각한 근거 부족 또는 사용자 결정이 필요하다.

실제 제출과 계정 접근은 항상 사용자 승인 뒤 별도 행동으로 남긴다.

## 산출물

지원 디렉터리에 `review.md`를 만든다.
첫 10줄 안에 판정과 가장 중요한 다음 행동을 둔다.
본문에는 다음 섹션을 포함한다.

- `## 결론`
- `## Verdict`
- `## 공고 적합성`
- `## 패키지 정합성`
- `## 제출 문구 안전성`
- `## 개인정보와 공개 범위`
- `## 중복 지원과 진행 제한`
- `## 사용자 승인 항목`
- `## 수정 요청`
- `## 상태 변경 제안`

내부 검토 상태명은 사용자 문서에 노출하지 않는다.
대신 `보강 필요`, `선택지`, `권장 행동`으로 쓴다.
상태 파일은 직접 바꾸지 않고 변경 제안만 기록한다.

## 검증

```bash
bun career-os/.claude/skills/application-reviewer/scripts/validate_review.ts \
  <application-directory>
```

검증 실패를 수정한 뒤 판정을 확정한다.
`sources/fos-study/`와 후보자 프로필은 읽기 전용으로 다룬다.
실제 제출, 로그인, 외부 전송과 공개 발행은 하지 않는다.
