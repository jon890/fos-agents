# Phase 03 — Interview-Prep-Analyzer Migration

**Model**: sonnet
**Status**: pending

---

## 목표

coffeechat skill에 묶여 있던 재사용 가능한 면접 준비 기능만 `interview-prep-analyzer`로 이관한다. coffeechat 전제는 사용하지 않는다.

**범위 외**:

- coffeechat-specific prompt 유지.
- 새 public fos-study 발행.
- 과거 coffeechat report/archive 수정.
- commit/push.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

- `career-os/AGENTS.md`
- `career-os/docs/adr.md` — ADR-048.
- `career-os/.claude/skills/interview-prep-analyzer/SKILL.md`
- `career-os/tasks/plan041-interview-coffeechat-deprecation/inventory.md`

---

## 작업 항목

1. `interview-prep-analyzer`에 first-round/final/offer 준비 요청을 처리하는 guidance를 추가한다.
2. 이관 대상은 다음 기능으로 제한한다.
   - 회사/비즈니스 분석.
   - 역할/팀 전략.
   - 후보자 경험과 JD 연결.
   - 예상 질문.
   - 역질문.
   - 답변 리스크 점검.
3. coffeechat의 팀 적합성/비공식 대화 전제, 참석자 역할 추정, 내부 추천 전제는 제거한다.
4. 필요 시 `config/mvp-target.json`의 `primary.interview.first_round` 등 살아있는 mode만 참조하도록 guidance를 조정한다.
5. 사용자-facing 표현은 "면접 연습", "실전 답변 연습", "1차 면접 연습"을 사용한다.

---

## 검증

```bash
cd "$(git rev-parse --show-toplevel)"

rg -n "first-round|final-round|offer|1차 면접|최종 면접|오퍼" \
  career-os/.claude/skills/interview-prep-analyzer/SKILL.md \
  || { echo "PHASE_FAILED: interview-prep-analyzer migration guidance missing"; exit 1; }

! rg -n "커피챗.*전제|내부 추천 이후|참석자 역할.*추정" \
  career-os/.claude/skills/interview-prep-analyzer/SKILL.md \
  || { echo "PHASE_FAILED: coffeechat assumptions leaked into interview-prep-analyzer"; exit 1; }
```

---

## Blocked 조건

- `interview-prep-analyzer`의 책임이 커져 기존 baseline/daily 흐름과 충돌하면 `PHASE_BLOCKED: interview-prep-analyzer responsibility conflict`를 출력하고 exit 2.
- first-round/final/offer 이관에 필요한 config 구조가 불명확하면 `PHASE_BLOCKED: interview mode config unclear`를 출력하고 exit 2.
