# Phase 02 — Self-check 헤더 레벨 ## 독립 섹션으로 통일

**Model**: sonnet
**Status**: pending

---

## 목표

Workflow 하위 번호 단계(`### N. Self-check`)로 들어간 self-check 헤더를 `## Self-check` 독립 섹션 레벨로 통일한다.

현황(이전 점검 실측):
- `### N. Self-check` (Workflow 하위 단계)를 쓰는 스킬: daily-application-digest, interview-asset-writer, study-pack-writer, application-package-writer, application-reviewer.
- 이미 `## Self-check` 독립 섹션인 스킬: candidate-baseline-suggester, interview-prep-analyzer, study-topic-recommender.

표준은 `## Self-check` 독립 섹션(code-architecture.md 권장 섹션 구성). 위 5개 스킬의 self-check를 독립 섹션으로 통일한다.

**범위 외**:
- `docs/*.md`·`AGENTS.md` 수정 금지.
- Phase 01(References 추가)과 무관. 단 Phase 01이 같은 파일(interview-asset-writer)을 건드렸으므로, 이 phase는 Phase 01 commit 이후 상태에서 시작한다.
- self-check **내용**은 바꾸지 않는다. 헤더 레벨과 섹션 위치만 조정한다.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes 저장소 루트
```

---

## 관련 docs

- `career-os/docs/code-architecture.md`의 "### SKILL.md 권장 섹션 구성" — "Self-check ... 독립 섹션이면 `## Self-check` 레벨로 둔다".

---

## 작업 항목 (5)

**반드시 Edit 도구를 호출한다. prose 응답만으로 끝내면 PHASE_FAILED다.**

각 스킬에서 `### N. Self-check ...` 헤더를 찾아 `## Self-check`로 바꾼다. 이때:
- self-check가 Workflow 섹션의 마지막 번호 단계로 들어가 있으면, 그 블록을 Workflow 섹션 **뒤**의 독립 `## Self-check` 섹션으로 옮긴다.
- self-check가 Workflow 중간 단계면(뒤에 다른 단계가 더 있으면) 흐름이 깨지므로 옮기지 말고 `PHASE_BLOCKED`로 보고한다.
- 헤더에 붙은 번호(`9.`, `5.` 등)는 제거하되, "(최대 3회)" 같은 부가 설명은 보존한다.

대상:
1. daily-application-digest — `### 9. Self-check` → `## Self-check`
2. interview-asset-writer — `### 5. Self-check` → `## Self-check`
3. study-pack-writer — `### 5. Self-check` → `## Self-check`
4. application-package-writer — `### 9. Self-check` → `## Self-check`
5. application-reviewer — `### 6. Self-check` → `## Self-check`

각 스킬의 실제 헤더 텍스트는 Edit 전에 Read/grep으로 확인한다(번호가 위와 다를 수 있다).

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/daily-application-digest/SKILL.md` | Self-check 헤더 `## ` 레벨 + 독립 섹션화 |
| `career-os/.claude/skills/interview-asset-writer/SKILL.md` | 동일 |
| `career-os/.claude/skills/study-pack-writer/SKILL.md` | 동일 |
| `career-os/.claude/skills/application-package-writer/SKILL.md` | 동일 |
| `career-os/.claude/skills/application-reviewer/SKILL.md` | 동일 |

## 검증

```bash
cd "$(git rev-parse --show-toplevel)"

# 1. ### 레벨 Self-check가 더는 없어야 함 (career-os 스킬 전체)
LEFT=$(grep -rE "^### [0-9]*\.? *Self-check" career-os/.claude/skills/ | wc -l | tr -d ' ')
echo "[### 레벨 Self-check 잔존] $LEFT"
[ "$LEFT" = "0" ] || { echo "FAIL: ### Self-check 잔존"; grep -rnE "^### [0-9]*\.? *Self-check" career-os/.claude/skills/; exit 1; }

# 2. 대상 5개 스킬에 ## Self-check 독립 섹션 존재
MISSING=0
for s in daily-application-digest interview-asset-writer study-pack-writer application-package-writer application-reviewer; do
  f="career-os/.claude/skills/$s/SKILL.md"
  CNT=$(grep -c "^## Self-check" "$f")
  echo "[$s] ## Self-check: $CNT"
  [ "$CNT" -ge 1 ] || MISSING=1
done
[ "$MISSING" = "0" ] && echo "OK: 5개 스킬 ## Self-check 독립 섹션" || { echo "FAIL"; exit 1; }

# 3. docs/AGENTS 범위 격리
DOCS_DIRTY=$(git status --short career-os/docs/ career-os/AGENTS.md | wc -l | tr -d ' ')
echo "[docs/AGENTS dirty] $DOCS_DIRTY"
[ "$DOCS_DIRTY" = "0" ] || { echo "FAIL: 범위 밖 변경"; exit 1; }

echo "✅ Phase 02 검증 명령 실행 완료"
```

## index.json status 마킹 (마지막 phase)

```bash
cd "$(git rev-parse --show-toplevel)"
python3 - <<'PY'
import json, subprocess
p = "career-os/tasks/plan078-skill-md-section-consistency/index.json"
ts = subprocess.check_output(["bash","-lc","TZ=Asia/Seoul date +%FT%T%z"]).decode().strip()
ts = ts[:-2] + ":" + ts[-2:]
d = json.load(open(p))
d["status"] = "completed"
d["current_phase"] = 2
d["updated_at"] = ts
for ph in d["phases"]:
    ph["status"] = "completed"
open(p, "w").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
print("index.json status=completed 마킹 완료")
PY
```

## commit (마지막 phase)

별도 worktree+branch 실행이므로 commit만 한다. push와 plan 단위 PR은 모든 phase 완료 후 메인 세션이 review한 뒤 처리한다.

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/.claude/skills/daily-application-digest/SKILL.md \
        career-os/.claude/skills/interview-asset-writer/SKILL.md \
        career-os/.claude/skills/study-pack-writer/SKILL.md \
        career-os/.claude/skills/application-package-writer/SKILL.md \
        career-os/.claude/skills/application-reviewer/SKILL.md \
        career-os/tasks/plan078-skill-md-section-consistency/index.json
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
docs(career-os): Self-check 헤더를 ## 독립 섹션 레벨로 통일

- Workflow 하위 ### N. Self-check 5개를 ## Self-check 독립 섹션으로
- self-check 내용은 불변, 헤더 레벨과 위치만 조정
- plan078 index.json status=completed 마킹

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
# phase-01·phase-02 commit이 이 branch에 들어갔는지 self-check (Write 위장 방어)
git log --oneline -2
```

## 의도 메모 (왜)

- `## Self-check` 독립 섹션이 표준 권장 구성(code-architecture.md). 헤더 레벨 일관성으로 스킬 간 스캔이 쉬워진다.
- 단 self-check가 Workflow 흐름의 일부로 의도된 경우(중간 단계)는 억지로 빼지 않는다 — 의미 보존이 일관성보다 우선.

## Blocked 조건

- self-check가 Workflow 중간 단계라 독립 섹션화하면 흐름이 깨지는 스킬이 있으면 `PHASE_BLOCKED: <skill> Self-check가 Workflow 중간 단계` 출력 후 `exit 2`. 반드시 Bash 도구로 직접 실행한다.
