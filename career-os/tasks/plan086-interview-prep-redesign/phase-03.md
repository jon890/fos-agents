# Phase 03 — 공용 드릴 엔진 + tech-interview-drill 신규 스킬

**Model**: sonnet
**Status**: pending

---

## 목표

공용 드릴 엔진(`scripts/interview-drill/drill-engine.ts`)을 작성하고,
`tech-interview-drill` 스킬을 신규 작성한다.
behavioral-interview-drill(phase-04)이 이 엔진을 재사용한다.

공용 드릴 엔진 동작 계약 (변경 금지):
1. **질문 선정 (간격 반복)**: weak_spots의 `next_review_date` 기준으로 오늘 복습 대상 우선 선정. 최근 통과 질문은 당분간 제외. 풀 고갈 시 question-bank-collector 호출 안내 출력.
2. **대화 답변 (질문당)**: ① 1문장 답변 → 3단계 채점(통과/얕음/틀림). ② 사용자가 "모르겠어" / "공부팩" 요청 → 모름 처리 + **백그라운드 서브에이전트로 study-pack-writer 호출**(non-blocking) → 즉시 다음 질문.
3. **기록**: 드릴 일별 로그(`data/runtime/drill-log-YYYY-MM-DD.jsonl`) + `config/study-progress.json` weak_spots 직접 갱신 (candidate-profile.md 아님 — 구조화된 weak_spots는 study-progress.json에 있다).
4. **약점 환류**: 같은 토픽 2회 이상 틀림·모름이면 study-pack-writer 자동 위임(1개). 과생성 방지(같은 토픽 당일 1회 한정).

**범위 외**:
- behavioral-interview-drill 작성 금지 (phase-04)
- interview-stage-prep 작성 금지 (phase-05)
- docs/ADR 수정 금지 (phase-01 완료됨)
- push·PR 금지

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 작업 항목

### 1. 현황 파악

```bash
cd "$(git rev-parse --show-toplevel)"
# 기존 scripts 구조 확인
ls career-os/scripts/
# 기존 question-bank 구조 확인
ls career-os/data/question-bank/ 2>/dev/null || echo "question-bank 없음"
# 기존 weak_spots 형식 확인 (study-progress.json — 구조화된 weak_spots 정본)
python3 -c "import json; print(json.load(open('career-os/config/study-progress.json')).get('weak_spots',{}))" 2>/dev/null | head -20
# study-pack-writer SKILL.md 진입점 확인 (위임 방식 파악)
grep -n "description\|호출\|입력" career-os/.claude/skills/study-pack-writer/SKILL.md | head -15
```

### 2. 공용 드릴 엔진 작성

`career-os/scripts/interview-drill/drill-engine.ts` 신규 작성.

엔진이 담당하는 로직:
- `selectQuestions(drillType, profile)` — 간격 반복 기반 오늘 질문 목록 반환 (5개 기본)
- `scoreAnswer(answer, question)` — 3단계 채점 (`pass` | `shallow` | `fail` | `unknown`)
- `recordDrillLog(entry)` — `data/runtime/drill-log-YYYY-MM-DD.jsonl` 추가
- `updateWeakSpots(question, score)` — `config/study-progress.json`의 weak_spots 필드 갱신 (pass_count·fail_count·next_review_date·last_passed)
- `shouldDispatchStudyPack(profile, topics)` — 같은 토픽 2회+ 틀림·모름 여부 판단
- `loadQuestionBank(drillType)` — `data/question-bank/{tech|behavioral}-questions.jsonl` 로드

질문 풀 샘플 파일도 함께 생성한다:
- `career-os/data/question-bank/tech-questions.jsonl` — 기본 기술 면접 질문 10개 이상 (JPA·트랜잭션·Redis·Kafka·시스템 설계 등)
- `career-os/data/question-bank/behavioral-questions.jsonl` — 기본 인성 면접 질문 5개 이상 (STAR 예시 포함)

### 3. tech-interview-drill 스킬 작성

`career-os/.claude/skills/tech-interview-drill/SKILL.md` 신규 작성.

포함 내용:
- description: "매일 기술 면접 질문에 1문장으로 답하고 채점·약점 환류. 공용 드릴 엔진(`scripts/interview-drill/drill-engine.ts`) 사용. 매일 실행."
- 진행 흐름 (사용자 대화 시나리오 포함):
  1. 오늘 드릴 시작 안내 (복습 대상 질문 수·신규 질문 수)
  2. 질문 제시 → 1문장 답변 요청
  3. 채점 결과 즉시 피드백 (통과/얕음/틀림 + 한 줄 보완)
  4. "모르겠어" / "공부팩 만들어줘" 요청 처리
  5. 드릴 완료 요약 (오늘 결과·누적 약점 토픽 상위 3개)
- 기록 경로: `data/runtime/drill-log-YYYY-MM-DD.jsonl`
- 약점 환류: 같은 토픽 2회+ 틀림이면 "study-pack-writer [토픽]을 백그라운드 서브에이전트로 실행한다" 명시

`.codex/skills/` 심링크 생성:
```bash
ln -sf ../../.claude/skills/tech-interview-drill career-os/.codex/skills/tech-interview-drill
```

### 4. CLAUDE.md 진입점 추가

`career-os/CLAUDE.md`의 agent skill 목록에 `/tech-interview-drill` 진입점 추가.

---

## common-pitfalls self-check (섹션 1~5)

- [ ] **섹션 1 (범위 준수)**: drill-engine.ts + tech-interview-drill만. behavioral-drill·stage-prep 금지.
- [ ] **섹션 2 (성공 기준 실행 가능성)**: 아래 검증 명령 직접 실행 가능 확인.
- [ ] **섹션 3 (독립 실행 가능성)**: phase-02 완료 후 단독 실행 가능.
- [ ] **섹션 4 (작업 항목 4개)**: 현황 파악·드릴 엔진·스킬·CLAUDE.md.
- [ ] **섹션 5 (blocked 조건 명시)**: 아래에 명시.

---

## 성공 기준

```bash
cd "$(git rev-parse --show-toplevel)"
FAIL=0

# 공용 드릴 엔진 존재 확인
[ -f career-os/scripts/interview-drill/drill-engine.ts ] \
  || { echo "[FAIL] drill-engine.ts 없음"; FAIL=1; }

# 드릴 엔진 핵심 함수 확인
for FN in "selectQuestions" "scoreAnswer" "recordDrillLog" "updateWeakSpots" "shouldDispatchStudyPack"; do
  grep -q "$FN" career-os/scripts/interview-drill/drill-engine.ts \
    || { echo "[FAIL] drill-engine.ts: $FN 함수 누락"; FAIL=1; }
done

# 질문 풀 샘플 파일 확인
[ -f career-os/data/question-bank/tech-questions.jsonl ] \
  || { echo "[FAIL] tech-questions.jsonl 없음"; FAIL=1; }

# tech-interview-drill 스킬 존재 확인
[ -f career-os/.claude/skills/tech-interview-drill/SKILL.md ] \
  || { echo "[FAIL] tech-interview-drill/SKILL.md 없음"; FAIL=1; }

# SKILL.md 핵심 구절 확인
grep -q "drill-engine" career-os/.claude/skills/tech-interview-drill/SKILL.md \
  || { echo "[FAIL] SKILL.md에 drill-engine 참조 없음"; FAIL=1; }
grep -q "study-pack-writer" career-os/.claude/skills/tech-interview-drill/SKILL.md \
  || { echo "[FAIL] SKILL.md에 study-pack-writer 위임 없음"; FAIL=1; }

# CLAUDE.md 진입점 확인
grep -q "tech-interview-drill" career-os/CLAUDE.md \
  || { echo "[FAIL] CLAUDE.md 진입점 누락"; FAIL=1; }

# TypeScript 문법 기본 확인 (bun 있을 때)
if command -v bun &>/dev/null; then
  bun --check career-os/scripts/interview-drill/drill-engine.ts 2>&1 \
    | grep -i "error" && { echo "[FAIL] drill-engine.ts 타입 에러"; FAIL=1; } || true
fi

if [ "$FAIL" = "0" ]; then
  echo "SUCCESS: phase-03 공용 드릴 엔진 + tech-interview-drill 검증 통과"
else
  echo "PHASE_FAILED: 위 항목 수정 후 재실행"
  exit 1
fi
```

---

## commit (push 금지)

```bash
cd "$(git rev-parse --show-toplevel)"
git add \
  career-os/scripts/interview-drill/ \
  career-os/data/question-bank/ \
  career-os/.claude/skills/tech-interview-drill/ \
  career-os/CLAUDE.md
# .codex 심링크도 추가
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
feat(career-os): 공용 드릴 엔진 + tech-interview-drill 스킬 신규 추가

- scripts/interview-drill/drill-engine.ts: 질문 선정·채점·기록·약점 환류·study-pack 위임
- data/question-bank/tech-questions.jsonl: 기본 기술 면접 질문 풀 초안
- data/question-bank/behavioral-questions.jsonl: 기본 인성 면접 질문 풀 초안
- .claude/skills/tech-interview-drill/SKILL.md: 매일 기술 면접 드릴 스킬

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
git log --oneline -1
echo "[working tree 잔여]"
git status --porcelain | head
```

---

## Blocked 조건

- `config/study-progress.json` weak_spots 구조를 파악할 수 없으면: `PHASE_BLOCKED: study-progress.json weak_spots 형식 불명확 — 파일 확인 후 drill-engine 필드 설계`
- study-pack-writer 호출 인터페이스를 파악할 수 없으면: `PHASE_BLOCKED: study-pack-writer SKILL.md 접근 불가 — 위임 방식 확인 필요`
- TypeScript 타입 에러가 발생하면: `PHASE_FAILED: drill-engine.ts 타입 에러 — 수정 후 재실행`
- 성공 기준 검증 FAIL 시: `PHASE_FAILED: 위 항목 수정 후 재실행`
