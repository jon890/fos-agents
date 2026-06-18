# phase-02: render_job_fit.ts JSON->md 렌더러

## 목표
`career-os/scripts/job-fit-analyzer/render_job_fit.ts`를 작성한다. JobFitRun 정본 JSON을 입력받아 사람 읽기용 Markdown을 파생한다 (ADR-096).

## 먼저 읽을 것
- `career-os/scripts/job-fit-analyzer/jobfit_schema.ts` — phase-01에서 만든 정본 스키마(입력 타입)
- **모범 패턴**: `career-os/scripts/position-recommender/render_recommendation.ts` — CLI(`--input --format md --output`), 입력 시 `safeParse` 검증 내장(실패 stderr + exit 1), `toMarkdown` 구조를 그대로 따른다.

## 변경할 파일
- 신규: `career-os/scripts/job-fit-analyzer/render_job_fit.ts`

## 스펙
- CLI: `render_job_fit.ts --input <jobfit.json> --format md --output <path>`. (format은 md만 우선 지원, 확장 여지만 남김.)
- 입력 JSON을 `JobFitRun.safeParse`로 검증 → 실패 시 위반 필드를 stderr 출력 + exit 1 (이게 self-check 역할).
- `toMarkdown(run)`이 생성할 섹션 순서(의사결정·전략을 앞으로):
  1. 첫 줄: `# 타깃 직무 핏 진단 — <reportDate> · <targetRole.role>`
  2. `## 한 줄 결론` — verdict.recommendation + confidence + rationale 첫 항목
  3. `## 지원 의사결정` — verdict(recommendation/confidence/rationale[])
  4. `## 커리어 패스 정합` — careerPath(alignmentWithCurrent/expectedTrajectory[]/leverageOrRisk[])
  5. `## 면접 전략` — interviewStrategy(strengthPitch: 강점→어필법, weaknessDefense: 약점→방어법)
  6. `## 강점` — strengths[] (point / evidence / roleLeverage)
  7. `## 부족분·갭` — gaps[] (area / priority / evidenceSupport / interviewRisk)
  8. `## 우선 보강 (부차)` — reinforcement d30/d60/d90 (비어 있으면 "해당 없음")
  9. `## 예상 면접 질문` — interviewQuestions[]
  10. `## 다음 액션` — nextActions[] (skill / input / why)
  11. changeSince 있으면 `## 지난 진단 대비 변화` — resolved/newGaps/persisting
- targetRole.source가 "mvp-target"이면 첫 부분에 "(타깃: mvp-target fallback)" 표기, "argument"면 인자 역할 명시.
- 한국어 출력. AGENTS.md 8패턴(semantic line break, 표 셀 압축 회피) 준수.

## 성공 기준 (실행 가능)
```bash
cd career-os
# phase-01 테스트에 쓴 valid 샘플을 /tmp/jobfit-sample.json으로 저장 후:
bun scripts/job-fit-analyzer/render_job_fit.ts --input /tmp/jobfit-sample.json --format md --output /tmp/jobfit-out.md
# 기대: 파일 생성 + 첫 줄 "# 타깃 직무 핏 진단", "## 지원 의사결정"·"## 면접 전략" 섹션 존재
head -1 /tmp/jobfit-out.md | grep -q "타깃 직무 핏 진단" && grep -q "## 지원 의사결정" /tmp/jobfit-out.md && grep -q "## 면접 전략" /tmp/jobfit-out.md && echo "RENDER OK"
# 위반 JSON(verdict enum 깨짐)으로 exit 1 확인
rm -f /tmp/jobfit-sample.json /tmp/jobfit-out.md
```
- `RENDER OK` 출력이면 통과. (node_modules 없으면 phase-01과 동일하게 심링크 후 검증.)

## 금지 사항
- docs/ADR 수정 금지.
- jobfit_schema.ts(phase-01)·SKILL.md(phase-03)는 건드리지 않는다.

## 완료 시
```bash
cd career-os && git add scripts/job-fit-analyzer/render_job_fit.ts && \
git -C .. commit -q -m "feat(career-os): job-fit JSON->md 렌더러 render_job_fit (ADR-096 phase-02)
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## 막히면
`PHASE_BLOCKED: <이유>`를 stdout에 출력하고 종료.
