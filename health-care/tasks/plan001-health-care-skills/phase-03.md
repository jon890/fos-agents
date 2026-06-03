# Phase 03 — Create weekly clinic summary skill

**Model**: sonnet
**Status**: pending

---

## 목표

`health-care/skills/weekly-knee-clinic-summary/`를 만들어 Claude를 활용한 주간/진료 전 요약 절차를 정의한다.

**범위 외**: daily checkin 생성, progress log append, 실제 병원 예약/외부 전송.

## 관련 docs

- `health-care/AGENTS.md`
- `health-care/docs/prd.md`
- `health-care/docs/data-schema.md`
- `health-care/docs/code-architecture.md`
- `health-care/docs/flow.md`
- `health-care/docs/adr.md` ADR-002
- `health-care/config/public-health-care-policy.md`

## 작업 항목

1. `health-care/skills/weekly-knee-clinic-summary/SKILL.md` 생성.
   - 사용 시점: 주간 경과 리뷰, 병원 방문 전 1페이지 요약, 질문 리스트 업데이트.
   - Claude 사용은 허용하되 진단/처방 금지와 OCR 불확실성 표시를 강제.
2. 입력 파일을 명시한다.
   - `private/conditions/knee-patellar-instability/current-context.md`
   - `private/conditions/knee-patellar-instability/progress-log.jsonl`가 있을 때만
   - OCR 요약 파일이 있을 때만
3. 출력 위치를 `private/conditions/knee-patellar-instability/weekly-summaries/YYYY-MM-DD.md`로 명시한다.
4. 공개/외부 전송은 사용자 확인 후에만 하도록 명시한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `health-care/skills/weekly-knee-clinic-summary/SKILL.md` | 신규 |

## 검증

```bash
cd /home/bifos/ai-nodes
[ -f health-care/skills/weekly-knee-clinic-summary/SKILL.md ]
grep -q '^name: weekly-knee-clinic-summary' health-care/skills/weekly-knee-clinic-summary/SKILL.md
grep -q 'weekly-summaries' health-care/skills/weekly-knee-clinic-summary/SKILL.md
grep -q 'OCR' health-care/skills/weekly-knee-clinic-summary/SKILL.md
grep -q '진단' health-care/skills/weekly-knee-clinic-summary/SKILL.md
! grep -RE "[0-9]{17,20}" health-care/skills/weekly-knee-clinic-summary
```

## 의도 메모

- Claude는 daily automation이 아니라 요약 품질이 중요한 주간/진료 전 작업에 제한한다.
