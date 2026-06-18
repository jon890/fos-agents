# phase-04: end-to-end 통합 검증 + plan 완료 마킹

## 목표
job-fit-analyzer 재정의(phase-01~03)가 정본 JSON → md 파생 → zod 검증 흐름으로 end-to-end 동작하는지 실제 샘플로 검증하고, plan088을 완료로 마킹한다.

## 먼저 읽을 것
- `career-os/scripts/job-fit-analyzer/jobfit_schema.ts` (phase-01)
- `career-os/scripts/job-fit-analyzer/render_job_fit.ts` (phase-02)
- `career-os/.claude/skills/job-fit-analyzer/SKILL.md` (phase-03)

## 검증 (실행 가능)
```bash
cd career-os
# 1) AI 에이전트 백엔드 역할로 JobFitRun 샘플 JSON 작성 (verdict·careerPath·interviewStrategy 1급 포함, 최소 필드 채움)
#    경로: data/reports/job-fit-2026-06-17-ai-agent-backend.json
#    (SKILL.md Workflow가 기대하는 정본 구조를 그대로 따른다)
# 2) 렌더러로 md 파생
bun scripts/job-fit-analyzer/render_job_fit.ts \
  --input data/reports/job-fit-2026-06-17-ai-agent-backend.json \
  --format md --output data/reports/job-fit-2026-06-17-ai-agent-backend.md
# 3) 검증: zod 통과(렌더 성공) + md에 핵심 섹션
test -f data/reports/job-fit-2026-06-17-ai-agent-backend.md && \
grep -q "## 지원 의사결정" data/reports/job-fit-2026-06-17-ai-agent-backend.md && \
grep -q "## 면접 전략" data/reports/job-fit-2026-06-17-ai-agent-backend.md && \
grep -q "## 커리어 패스" data/reports/job-fit-2026-06-17-ai-agent-backend.md && echo "E2E OK"
# 4) 위반 JSON(slug 대문자 등)으로 렌더러 exit 1 확인
```
- `E2E OK` 출력 + 위반 입력 거부 확인이면 통과.
- (node_modules 없으면 repo 루트 node_modules 심링크 후 검증, 끝나고 심링크 제거.)
- 검증용 샘플 산출물(`data/reports/job-fit-2026-06-17-ai-agent-backend.{json,md}`)은 `data/`라 gitignore — 커밋 대상 아님. 검증 후 남겨도 무방하나 정리 권장.

## index.json 완료 마킹
- `tasks/plan088-job-fit-redesign/index.json`의 `status`를 `completed`, `current_phase`를 4, `updated_at`을 현재 UTC로 갱신.
- (phase별 status/commitSha는 run-phases.py가 자동 기록하므로 건드리지 않는다.)

## 금지 사항
- scripts·SKILL(phase-01~03 산출물) 로직 수정 금지. 검증만 한다. 검증 실패면 PHASE_FAILED.
- docs/ADR 수정 금지.

## 완료 시 (push 포함 — 마지막 phase)
```bash
cd career-os && git add tasks/plan088-job-fit-redesign/index.json && \
git -C .. commit -q -m "chore(career-os): plan088 통합 검증 완료 + index.json 완료 마킹 (ADR-096 phase-04)
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" && \
git -C .. push -q origin feat/job-fit-analyzer-enhance
```

## 막히면
- 검증 실패: `PHASE_FAILED: <실패 항목>` stdout 출력 후 종료.
- 사람 결정 필요: `PHASE_BLOCKED: <이유>` 출력.
