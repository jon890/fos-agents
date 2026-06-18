# phase-01: jobfit_schema.ts zod 정본 스키마

## 목표
`career-os/scripts/job-fit-analyzer/jobfit_schema.ts`에 job-fit 산출물 정본 `JobFitRun`의 zod 스키마를 작성한다 (ADR-096).

## 먼저 읽을 것
- `career-os/docs/adr/ADR-096-job-fit-analyzer-의사결정-전략-재정의.md` — 결정 근거
- **모범 패턴**: `career-os/scripts/position-recommender/recommendation_schema.ts` — zod 정본 스키마 구조·superRefine·export 패턴을 그대로 따른다 (ADR-094 동형).

## 변경할 파일
- 신규: `career-os/scripts/job-fit-analyzer/jobfit_schema.ts` (디렉터리 없으면 생성)

## 스키마 스펙 (JobFitRun, schemaVersion 1)
```
JobFitRun = {
  schemaVersion: literal(1),
  reportDate: string (YYYY-MM-DD regex),
  generatedAt: string,
  targetRole: { source: enum["argument","mvp-target"], company?, team?, role(min1), slug(regex ^[a-z0-9-]+$) },
  verdict: { recommendation: enum["지원 권장","조건부 지원","보류"], confidence: enum["강","중","약"], rationale: string[].min(1) },
  careerPath: { expectedTrajectory: string[].min(1), alignmentWithCurrent: enum["정합","확장","이탈"], leverageOrRisk: string[].min(1) },
  strengths: array.min(1) of { point(min1), evidence(min1), roleLeverage(min1) },
  gaps: array.min(1) of { area(min1), priority: enum["고","중","저"], evidenceSupport(min1), interviewRisk(min1) },
  interviewStrategy: { strengthPitch: array of {strength,howToFrame}, weaknessDefense: array of {weakness,howToDefend} },
  reinforcement: { d30: string[], d60: string[], d90: string[] },   // 비어도 통과 (부차)
  interviewQuestions: array of { q, risk, answerAngle },
  nextActions: array.min(1) of { skill(min1), input(min1), why(min1) },
  changeSince: optional { lastDate, resolved: string[], newGaps: string[], persisting: string[] }
}
```
- superRefine 또는 enum으로 강제: recommendation·confidence·alignmentWithCurrent·priority·source enum, targetRole.slug regex, strengths/gaps/rationale/nextActions 최소 1개.
- `reinforcement`는 부차이므로 빈 배열 허용(강제 없음).
- `export const JobFitRun`, `export type JobFitRunType = z.infer<...>`, 필요한 하위 타입(`PositionItemType` 대응)도 export.
- zod import는 recommendation_schema.ts와 동일 방식.

## 성공 기준 (실행 가능)
```bash
cd career-os
# 1) 정상 샘플 parse OK + 위반(슬러그 대문자, verdict enum 위반, strengths 빈배열) 거부 확인하는 임시 테스트 작성·실행
cat > /tmp/jobfit-schema-check.ts <<'TS'
import { JobFitRun } from "<절대경로>/career-os/scripts/job-fit-analyzer/jobfit_schema.ts";
const ok = { schemaVersion:1, reportDate:"2026-06-17", generatedAt:"x",
  targetRole:{source:"argument", role:"AI 에이전트 백엔드", slug:"ai-agent-backend"},
  verdict:{recommendation:"지원 권장", confidence:"강", rationale:["근거"]},
  careerPath:{expectedTrajectory:["경로"], alignmentWithCurrent:"확장", leverageOrRisk:["레버리지"]},
  strengths:[{point:"p",evidence:"e",roleLeverage:"r"}],
  gaps:[{area:"a",priority:"고",evidenceSupport:"s",interviewRisk:"risk"}],
  interviewStrategy:{strengthPitch:[],weaknessDefense:[]},
  reinforcement:{d30:[],d60:[],d90:[]}, interviewQuestions:[],
  nextActions:[{skill:"study-pack-writer",input:"x",why:"y"}] };
console.log("valid:", JobFitRun.safeParse(ok).success ? "OK" : "FAIL");
const bad = structuredClone(ok); (bad.targetRole as any).slug = "AI_Agent";
console.log("invalid rejected:", !JobFitRun.safeParse(bad).success ? "OK" : "FAIL");
TS
# <절대경로>를 실제 워크트리 절대경로로 치환 후:
bun /tmp/jobfit-schema-check.ts
rm -f /tmp/jobfit-schema-check.ts
```
- 출력이 `valid: OK` 와 `invalid rejected: OK` 둘 다여야 통과. (워크트리에 node_modules 없으면 repo 루트 node_modules 심링크 후 검증, 끝나고 심링크 제거.)

## 금지 사항
- docs/ADR/정책 문서 수정 금지 (이미 ADR-096에 반영됨).
- render_job_fit.ts·SKILL.md는 이 phase에서 건드리지 않는다 (phase-02/03 영역).

## 완료 시
변경을 commit (push는 phase-04에서):
```bash
cd career-os && git add scripts/job-fit-analyzer/jobfit_schema.ts && \
git -C .. commit -q -m "feat(career-os): job-fit JobFitRun zod 정본 스키마 (ADR-096 phase-01)
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## 막히면
스키마 필드 의미가 ADR-096·이 phase 스펙으로 불명확하면 `PHASE_BLOCKED: <이유>`를 stdout에 출력하고 종료.
