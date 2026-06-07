# plan058 검증

결론: plan058의 생성 산출물 품질 계약은 docs, native skill, sample audit에 연결됐다.
외부 제출 자동화와 공개 발행은 추가하지 않았고, `data/applications/`와 `sources/fos-study/` 산출물도 수정하지 않았다.

## 검증한 범위

- Recommendation/posting: `position-recommender`, live posting snapshot sample.
- Fit/application/review: `application-package-writer`, `application-reviewer`, `daily-application-digest`.
- Resume chain: `resume-draft.md`, `resume.html`, `resume.pdf` contract와 sample outline.
- Study/interview: `study-pack-writer`, `interview-asset-writer`, `interview-prep-analyzer`.
- Docs: `prd.md`, `data-schema.md`, `flow.md`, `code-architecture.md`, `adr.md`, `korean-expression-guide.md`.

## 명령 결과

```text
python3 -m json.tool tasks/plan058-generated-artifact-quality-rollout/index.json
PASS

find tasks/plan058-generated-artifact-quality-rollout -maxdepth 1 -type f -name 'phase-*.md' | sort
PASS: phase-01.md부터 phase-05.md까지 총 5개 파일

rg "보강 필요 / 선택지 / 권장 행동|첫 10줄|한국어 우선|사용자 승인" tasks/plan058-generated-artifact-quality-rollout docs .claude/skills
PASS: docs, task files, target skill contract에 rollout language가 모두 있음

rg "needs_evidence" .claude/skills docs
PASS WITH REVIEW: 남은 hit는 raw marker를 노출하지 말라는 contract 또는 docs reference임
```

## raw marker 검토

`daily-application-digest`에는 old marker item을 나열하라는 사용자-facing instruction이 남아 있었다.
phase 05에서 이를 변환했다.

현재 해석:

- 허용: docs와 skill contract는 legacy/raw marker와 변환 규칙을 설명할 때 `needs_evidence`를 언급할 수 있다.
- 금지: generated report, Discord draft, public study pack, application package, review report, resume artifact가 raw marker를 output label로 노출하는 것.
- 필수 출력: `보강 필요 / 선택지 / 권장 행동`.

## post-validation 결정

후속 post-validation script는 아직 도입하지 않는다.
현재는 skill contract와 sample audit으로 충분하다.

도입 조건:

- 같은 raw marker가 생성물에 반복 노출된다.
- 공개용과 private 분석이 다시 섞인다.
- 첫 10줄 결론 누락이 여러 산출물에서 반복된다.
- runner가 ready 상태를 판단해야 하는데 사람이 매번 grep으로 확인해야 한다.

권장 후속안:

- 별도 plan에서 Markdown validator를 만든다.
- 검사는 warning-first로 시작한다.
- 필수 검사는 public publish, application ready, resume PDF ready 전환 지점에만 붙인다.

## 안전 결과

- 공개 fos-study publish 없음.
- 외부 제출, 로그인, 브라우저 입력 자동화 없음.
- candidate-profile 수정 없음.
- private 원문 인용 없음.
- actual generated application artifact rewrite 없음.
