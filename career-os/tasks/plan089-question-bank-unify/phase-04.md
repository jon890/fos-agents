# Phase 04 — interview-asset-writer 개인 질문 생성 확장 + 드릴 즉석 생성 경로

**Model**: sonnet
**Status**: pending

---

## 목표

개인 맞춤 질문(후보자 이력 기반)을 생성·관리하는 경로를 만든다(ADR-096).

- `interview-asset-writer`가 `config/candidate-profile.md` 기반으로 개인 질문을 `private/question-bank/{behavioral,tech}-personal.jsonl`로 생성하는 흐름을 추가한다.
- 두 드릴 SKILL.md에 "개인 질문 즉석 생성" 경로를 추가한다(드릴 중 사용자가 "이 경험으로 질문 만들어줘" 요청).
- private 경계(git 무시, public 역유출 금지)를 명시한다.

**범위 외**:
- drill-engine.ts 수정 금지(phase-03에서 private merge 이미 구현)
- public 질문·question-bank-collector 수정 금지(phase-05)
- `data/question-bank/` 삭제 금지(phase-05)
- 실제 개인 질문 데이터 대량 생성은 하지 않는다 — 생성 경로(스킬 문서)만 만든다
- docs/ADR 수정 금지
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
# interview-asset-writer 현재 구조
sed -n '1,60p' career-os/.claude/skills/interview-asset-writer/SKILL.md
# private 무시 확인
grep -n "private" ../.gitignore
# 드릴 SKILL.md의 기존 "공부팩 위임" 섹션(같은 비종속 표현 참고)
grep -n "공부팩 위임\|study-pack-writer" career-os/.claude/skills/tech-interview-drill/SKILL.md
```

### 2. interview-asset-writer에 개인 질문 생성 흐름 추가

`career-os/.claude/skills/interview-asset-writer/SKILL.md`:
- 새 산출 형식으로 "개인 질문 풀 생성"을 추가한다.
  - 입력: `config/candidate-profile.md`의 프로젝트·경험.
  - 출력: `private/question-bank/behavioral-personal.jsonl`(이력 기반 STAR), `private/question-bank/tech-personal.jsonl`(경험 기반 기술 심화).
  - 스키마: drill 정본과 동일 필드(`id`(`beh-personal-NNN`/`tech-personal-NNN`), `topic`, `category`, `difficulty`, `question`, `intent`, `answerSignals`, `followUps?`, `source`).
  - `topic`은 weak_spots 키 규칙(kebab-case). 가능하면 public 질문과 같은 topic 체계로 묶는다.
- 경계 명시: 개인 질문은 `private/`에만 둔다(git 무시). `public/question-bank/`로 역유출하지 않는다. 회사별 비공개 맥락·지원 전략은 질문 본문에 넣지 않는다(지원 패키지/면접 메모에서 관리).

### 3. 두 드릴 SKILL.md에 "개인 질문 즉석 생성" 경로 추가

`tech-interview-drill`·`behavioral-interview-drill` SKILL.md:
- 드릴 중 사용자가 "이 경험으로 질문 만들어줘" 같은 요청을 하면 `interview-asset-writer`에 개인 질문 생성을 위임하는 경로를 추가.
- 기존 "공부팩 위임" 섹션과 **같은 에이전트 비종속 표현**을 쓴다(CLI 명령을 직접 박지 않는다. "어떤 입력으로 interview-asset-writer를 호출할지"만 정하고 실행 방식은 환경에 맡긴다).

---

## common-pitfalls self-check (섹션 1~5)

- [ ] **섹션 1 (범위 준수)**: interview-asset-writer·두 드릴 SKILL.md만. drill-engine·public 데이터·docs 금지.
- [ ] **섹션 2 (성공 기준 실행 가능성)**: grep 검증 실행 가능.
- [ ] **섹션 3 (독립 실행 가능성)**: phase-03(private merge) 완료 후 의미 있음.
- [ ] **섹션 4 (작업 항목 3개)**: 현황·asset-writer·드릴 경로.
- [ ] **섹션 5 (blocked 조건 명시)**: 아래에 명시.

---

## 성공 기준

```bash
cd "$(git rev-parse --show-toplevel)"
FAIL=0

# interview-asset-writer에 개인 질문 생성·private 경로 명시
grep -q "private/question-bank" career-os/.claude/skills/interview-asset-writer/SKILL.md \
  || { echo "[FAIL] interview-asset-writer에 private/question-bank 경로 없음"; FAIL=1; }
grep -qi "behavioral-personal\|tech-personal" career-os/.claude/skills/interview-asset-writer/SKILL.md \
  || { echo "[FAIL] 개인 질문 파일명 명시 없음"; FAIL=1; }

# 두 드릴에 개인 질문 즉석 생성 경로 + 비종속 표현
for s in tech-interview-drill behavioral-interview-drill; do
  grep -q "interview-asset-writer" career-os/.claude/skills/$s/SKILL.md \
    || { echo "[FAIL] $s에 개인 질문 위임 경로 없음"; FAIL=1; }
done

# 비종속 표현: claude -p 하드코딩 금지
grep -rq "claude -p\|claude --permission" career-os/.claude/skills/interview-asset-writer/SKILL.md career-os/.claude/skills/tech-interview-drill/SKILL.md career-os/.claude/skills/behavioral-interview-drill/SKILL.md \
  && { echo "[FAIL] claude -p 하드코딩 잔존"; FAIL=1; } || true

# private 무시 확인
grep -q "private" ../.gitignore \
  || { echo "[FAIL] .gitignore에 private 무시 없음"; FAIL=1; }

if [ "$FAIL" = "0" ]; then
  echo "SUCCESS: phase-04 통과"
else
  echo "PHASE_FAILED: 위 항목 수정 후 재실행"; exit 1
fi
```

---

## commit (push 금지)

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/.claude/skills/interview-asset-writer/SKILL.md \
  career-os/.claude/skills/tech-interview-drill/SKILL.md \
  career-os/.claude/skills/behavioral-interview-drill/SKILL.md
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
feat(career-os): 개인 질문 생성 경로 추가 — interview-asset-writer + 드릴 즉석 생성 (ADR-096)

- interview-asset-writer: candidate-profile 기반 private/question-bank/{behavioral,tech}-personal.jsonl 생성
- 두 드릴 SKILL.md: 개인 질문 즉석 생성 위임 경로(에이전트 비종속 표현)
- private 경계(git 무시, public 역유출 금지) 명시

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
git log --oneline -1
git status --porcelain | head
```

---

## Blocked 조건

- `config/candidate-profile.md`가 없으면: `PHASE_BLOCKED: candidate-profile 미존재`
- 성공 기준 FAIL 시: `PHASE_FAILED: 위 항목 수정 후 재실행`
