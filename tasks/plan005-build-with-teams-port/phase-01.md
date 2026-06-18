# Phase 01 — SKILL.md 나머지 공용화 + references 4개 공용화

**Model**: sonnet
**Status**: pending

---

## 목표

`.claude/skills/build-with-teams/`의 docu-parser 전용 표현을 모노레포 공용으로 일반화한다.
브랜치 컨벤션 섹션은 선행 커밋(6fe5d7b)에서 이미 공용화됨 — 나머지를 마친다.

**범위 외**: 전용 agent 작성(phase-02), variant 파일(phase-03), AGENTS/code-arch(phase-04), ADR 수정 금지.

---

## 사전 cwd

```bash
cd "$(git rev-parse --show-toplevel)"   # ai-nodes 루트 (워크트리)
```

## 정본 대조 (읽기)

docu-parser 정본과 비교하며 공용화한다(정본은 docu-parser 전용이라 그대로 복사 금지, 일반화):
- `/Users/nhn/projects/ai-playground-docu-parser/.claude/skills/build-with-teams/SKILL.md`
- 같은 경로 `references/{preflight,team-spawn,phase-exec,review-loops}.md`

## 작업

### 1. SKILL.md 공용화

`.claude/skills/build-with-teams/SKILL.md`에서 다음을 일반화:

- **팀 구성 표**: `docu-parser-executor` → `<workspace>-executor`, `docu-parser-docs-verifier` → `<workspace>-docs-verifier`.
  표 아래에 규칙 명시: "executor·docs-verifier는 **실행 워크스페이스명을 prefix로 한 전용 agent**(`.claude/agents/<workspace>-{executor,docs-verifier}.md`)를 쓴다. 예: career-os 작업이면 `career-os-executor`."
- **환경 가정 섹션**(docu-parser SKILL 끝 "docu-parser 환경 가정" 블록): 제거하고 "워크스페이스 환경 가정은 `variants/<workspace>.md` 참조"로 교체. (variant 파일은 phase-03에서 생성)
- **dooray/AI-TF-VectorSearch 업무 매핑** 언급: 제거하거나 "외부 업무 매핑이 있는 워크스페이스는 variant가 정의"로 일반화.
- `{{CI_CMD}}` placeholder는 유지(variant가 채움).
- `grep -n "docu-parser\|dooray\|AI-TF-VectorSearch\|uv \|weasyprint\|venv" SKILL.md` 결과가 0이 되도록(주석/예시 제외).

### 2. references 4개 공용화

`references/{preflight,team-spawn,phase-exec,review-loops}.md`에서 docu-parser 전용 표현(dooray 브랜치, python/uv 명령, docu-parser agent명)을 `<workspace>`/variant 참조로 일반화. 일반 협업 규칙(스폰 안전·SendMessage·재시도·atomic commit)은 그대로 보존.

---

## common-pitfalls self-check

`.claude/skills/plan-and-build/references/common-pitfalls/INDEX.md` 라우터에서 docs/skill 변경 유형 패턴을 골라 점검.

---

## 성공 기준

```bash
cd "$(git rev-parse --show-toplevel)"
FAIL=0
S=.claude/skills/build-with-teams
# docu-parser 전용 표현 잔존 0 (placeholder·일반 설명 제외)
HITS=$(grep -rn "docu-parser\|AI-TF-VectorSearch\|weasyprint" $S/SKILL.md $S/references/ | grep -v "<workspace>" | wc -l | tr -d ' ')
[ "$HITS" = "0" ] || { echo "[FAIL] 전용 표현 잔존 $HITS"; grep -rn "docu-parser\|AI-TF-VectorSearch" $S; FAIL=1; }
# <workspace> placeholder 또는 variant 참조 존재
grep -q "<workspace>-executor" $S/SKILL.md || { echo "[FAIL] executor placeholder 없음"; FAIL=1; }
grep -q "variants/" $S/SKILL.md || { echo "[FAIL] variant 참조 없음"; FAIL=1; }
[ "$FAIL" = 0 ] && echo "SUCCESS phase-01" || { echo "PHASE_FAILED"; exit 1; }
```

## commit (push 금지)

```bash
cd "$(git rev-parse --show-toplevel)"
git add .claude/skills/build-with-teams/
git commit -q -m "refactor(skill): build-with-teams SKILL·references 공용화 (ADR-018)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## Blocked 조건

- docu-parser 정본 경로 접근 불가: `PHASE_BLOCKED: 정본 미존재 — 경로 확인`
- 성공 기준 FAIL: `PHASE_FAILED`
