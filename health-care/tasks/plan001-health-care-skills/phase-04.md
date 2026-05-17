# Phase 04 — Validate health-care skill plan

**Model**: haiku
**Status**: pending

---

## 목표

세 skill의 경계, 개인정보 가드, 문서/데이터 라우팅이 일관적인지 검증하고 task를 완료 상태로 정리한다.

**범위 외**: 새 기능 추가, cron 변경, force push.

## 관련 docs

- `health-care/AGENTS.md`
- `health-care/docs/prd.md`
- `health-care/docs/data-schema.md`
- `health-care/docs/code-architecture.md`
- `health-care/docs/flow.md`
- `health-care/docs/adr.md`
- `health-care/tasks/plan001-health-care-skills/index.json`

## 작업 항목

1. 세 skill `SKILL.md` frontmatter와 description이 사용 시점을 명확히 구분하는지 확인한다.
2. 민감 식별자 잔재 grep을 실행한다.
3. `data/` 파일이 git에 올라오지 않는지 확인한다.
4. `index.json`의 phase 상태를 completed로 정리한다.

## 검증

```bash
cd /home/bifos/ai-nodes
[ -f health-care/skills/daily-knee-rehab-checkin/SKILL.md ]
[ -f health-care/skills/knee-progress-intake/SKILL.md ]
[ -f health-care/skills/weekly-knee-clinic-summary/SKILL.md ]
! grep -RE "[0-9]{17,20}" health-care/skills health-care/docs health-care/config health-care/tasks
git check-ignore -q health-care/data/conditions/knee-patellar-instability/current-context.md
python3 -m json.tool health-care/tasks/plan001-health-care-skills/index.json >/dev/null
```

## 의도 메모

- 마지막 phase는 구현물이 아니라 가드레일과 task metadata 정리를 검증한다.
- 검증 실패 시 반드시 `echo 'PHASE_FAILED: <reason>' && exit 1` 형태로 비-0 종료한다.
