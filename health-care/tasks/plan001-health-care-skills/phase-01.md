# Phase 01 — Create daily checkin skill

**Model**: sonnet
**Status**: pending

---

## 목표

`health-care/skills/daily-knee-rehab-checkin/`을 만들어 매일 아침 무릎 재활 체크인 메시지를 보수적으로 생성할 수 있게 한다.

**범위 외**: progress log append, Claude 기반 주간 요약, cron 재등록.

## 관련 docs

- `health-care/AGENTS.md`
- `health-care/docs/prd.md`
- `health-care/docs/data-schema.md`
- `health-care/docs/code-architecture.md`
- `health-care/docs/flow.md`
- `health-care/docs/adr.md` ADR-002
- `health-care/config/public-health-care-policy.md`
- `health-care/config/knee-running-recovery-plan.md`

## 작업 항목

1. `health-care/skills/daily-knee-rehab-checkin/SKILL.md` 생성.
   - 사용 시점: morning rehab checkin, knee rehab daily reminder, running recovery guidance.
   - 필수 안전 원칙: 진단/처방 금지, 중단 기준 포함, 민감 식별자 출력 금지.
2. 필요하면 `scripts/` 없이 SKILL.md만 둔다. 반복 로직이 충분히 단순하면 스크립트 도입 금지.
3. 기존 cron payload가 이 skill을 활용하도록 바꾸는 것은 범위 외로 남기고, phase 결과에 후속 권장 문구만 남긴다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `health-care/skills/daily-knee-rehab-checkin/SKILL.md` | 신규 |

## 검증

```bash
cd /home/bifos/ai-nodes
[ -f health-care/skills/daily-knee-rehab-checkin/SKILL.md ]
grep -q '^name: daily-knee-rehab-checkin' health-care/skills/daily-knee-rehab-checkin/SKILL.md
grep -q '진단' health-care/skills/daily-knee-rehab-checkin/SKILL.md
grep -q '중단 기준' health-care/skills/daily-knee-rehab-checkin/SKILL.md
! grep -RE "[0-9]{17,20}" health-care/skills/daily-knee-rehab-checkin
```

## 의도 메모

- ADR-002에 따라 daily checkin은 Claude 의존 없이 보수적이고 짧은 안내로 제한한다.
