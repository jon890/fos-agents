# Phase 02 — Create progress intake skill

**Model**: sonnet
**Status**: pending

---

## 목표

`health-care/skills/knee-progress-intake/`를 만들어 사용자가 남긴 증상/운동 반응을 private data로 구조화하는 절차를 정의한다.

**범위 외**: 의료 판단, 주간 Claude 요약, public config 변경.

## 관련 docs

- `health-care/AGENTS.md`
- `health-care/docs/prd.md`
- `health-care/docs/data-schema.md`
- `health-care/docs/code-architecture.md`
- `health-care/docs/flow.md`
- `health-care/docs/adr.md` ADR-002

## 작업 항목

1. `health-care/skills/knee-progress-intake/SKILL.md` 생성.
   - 사용 시점: 사용자가 오늘 증상, 붓기, 계단, 굽힘 각도, 운동 후 반응을 보고할 때.
   - 출력 책임: `private/conditions/knee-patellar-instability/progress-log.jsonl` append 제안/수행 절차.
2. progress entry 필드가 `docs/data-schema.md`의 `progress-log.jsonl` 권장 스키마와 일치하도록 명시.
3. `current-context.md` 업데이트는 확정 사실/사용자 보고/확인 필요를 분리하도록 지시.
4. skill 내부에 플랫폼 ID, 병원 등록번호, 실명 같은 식별자를 쓰지 말라고 명시.

## Critical Files

| 파일 | 변경 |
|---|---|
| `health-care/skills/knee-progress-intake/SKILL.md` | 신규 |

## 검증

```bash
cd /home/bifos/ai-nodes
[ -f health-care/skills/knee-progress-intake/SKILL.md ]
grep -q '^name: knee-progress-intake' health-care/skills/knee-progress-intake/SKILL.md
grep -q 'progress-log.jsonl' health-care/skills/knee-progress-intake/SKILL.md
grep -q '확인 필요' health-care/skills/knee-progress-intake/SKILL.md
! grep -RE "[0-9]{17,20}" health-care/skills/knee-progress-intake
```

## 의도 메모

- 사용자 보고 기반 기록과 모델 추론을 분리해 다음날 체크인이 잘못된 확신을 갖지 않게 한다.
