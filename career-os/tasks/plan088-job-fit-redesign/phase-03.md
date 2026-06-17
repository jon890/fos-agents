# phase-03: SKILL.md 의사결정·전략 재정의 재작성

## 목표
`career-os/.claude/skills/job-fit-analyzer/SKILL.md`의 workflow·self-check·boundary·References를 ADR-096 재정의(JSON 정본 + 자연어 타깃 + nextActions + changeSince)에 맞게 재작성한다.

## 먼저 읽을 것
- `career-os/docs/adr/ADR-096-job-fit-analyzer-의사결정-전략-재정의.md`
- 현재 `career-os/.claude/skills/job-fit-analyzer/SKILL.md` (전체)
- **모범 패턴**: `career-os/.claude/skills/position-recommender/SKILL.md` — JSON 정본 workflow(3. 분석+JSON 생성 / 4. 산출물 생성 = 정본+파생 / Self-check = zod) 구조를 그대로 따른다.
- `career-os/scripts/job-fit-analyzer/jobfit_schema.ts` (phase-01) — 필드 정의

## 변경할 파일
- `career-os/.claude/skills/job-fit-analyzer/SKILL.md` (수정)

## 반영할 변경
1. **호출/타깃 해석**: `/job-fit-analyzer [자연어 역할]`. 인자 있으면 targetRole.source="argument"(역할 텍스트에서 slug 생성), 없으면 mvp-target.json primary fallback(source="mvp-target").
2. **산출물 = JSON 정본**: 에이전트는 `JobFitRun`(jobfit_schema.ts) 구조의 JSON을 `data/reports/job-fit-YYYY-MM-DD-<slug>.json`에 쓴다. verdict·careerPath·interviewStrategy를 1급으로 충실히, reinforcement는 부차.
3. **파생**: `render_job_fit.ts --input <json> --format md --output <...-<slug>.md>`로 md 생성. 자체 markdown 작성 금지.
4. **self-check = zod**: render_job_fit.ts 실행이 곧 JobFitRun 검증(실패 시 exit 1). 옛 8항목 markdown self-check를 스키마 검증 + 사람-facing 점검(needs_evidence 없음, 제출/공개 금지)으로 교체.
5. **changeSince**: 같은 slug의 가장 최근 지난 진단 JSON이 있으면 로드해 resolved/newGaps/persisting을 채운다.
6. **nextActions 연결**: 최우선 gap(priority "고")에 대해 study-pack-writer 생성을 첫 nextAction으로 제안. drill/application-package-writer 라우팅도 구조화.
7. **boundary/References**: 회사 최근 동향은 범위 밖(position-recommender)임을 boundary에 명시. References에 jobfit_schema.ts·render_job_fit.ts·ADR-096 추가. Inputs에 baseline-core-files 유지.
8. **Why this design**에 ADR-096 항목 추가.

## 성공 기준 (실행 가능)
```bash
cd career-os
F=.claude/skills/job-fit-analyzer/SKILL.md
# 핵심 키워드 반영 확인
grep -q "JobFitRun\|jobfit_schema" $F && \
grep -q "render_job_fit" $F && \
grep -q "ADR-096" $F && \
grep -q "자연어 역할\|targetRole\|argument" $F && \
grep -q "changeSince\|지난 진단" $F && \
grep -q "지원 의사결정\|verdict" $F && echo "SKILL OK"
# 옛 고정 파일명 흔적 제거 확인 (job-fit-YYYY-MM-DD.md 단독 경로가 정본으로 남아있지 않아야)
! grep -qE "job-fit-YYYY-MM-DD\.md.*정본" $F && echo "LEGACY CLEARED"
```
- `SKILL OK` + `LEGACY CLEARED` 출력이면 통과.

## 금지 사항
- docs/ADR 수정 금지.
- jobfit_schema.ts·render_job_fit.ts(phase-01/02) 수정 금지.
- 스킬 boundary가 다루는 다른 스킬(drill/stage-prep/application-package)의 SKILL.md 건드리지 않는다.

## 완료 시
```bash
cd career-os && git add .claude/skills/job-fit-analyzer/SKILL.md && \
git -C .. commit -q -m "docs(career-os): job-fit-analyzer SKILL을 JSON 정본·의사결정 중심으로 재작성 (ADR-096 phase-03)
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## 막히면
`PHASE_BLOCKED: <이유>`를 stdout에 출력하고 종료.
