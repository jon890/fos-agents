# Phase 02 — position-recommender SKILL.md runner 자산 경계 역참조 보강

**Model**: sonnet
**Status**: pending

---

## 목표

`career-os/.claude/skills/position-recommender/SKILL.md`에 daily/cron runner 자산의 경계를 명시하는 역참조 한 단락을 추가한다.

현재 SKILL.md는 "agent 직접 실행"을 표방하면서 Workflow 4·5에서 "Runner post-process"를 추상적으로만 언급한다. 그래서 SKILL.md만 읽는 신규 에이전트는 실제 runner 자산(`scripts/position-recommender/run_daily_with_claude.ts`·`render_report_html.ts`·`structured_recommendation_items.ts`)의 존재와 역할을 알 수 없다. 이 자산들의 역할 본문은 이미 `docs/code-architecture.md`에 있으므로(거울 구조), SKILL.md에는 그 단일 출처를 가리키는 역참조만 추가한다.

**범위 외**:
- `docs/*.md`·`AGENTS.md`·`docs/adr.md` 수정 금지. 자산 역할 본문은 code-architecture.md가 이미 단일 출처다. 이 phase는 SKILL.md(스킬 본문)에만 역참조를 더한다.
- Phase 01(docs-audit 제거)과 무관하다.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes 저장소 루트 (career-os의 부모)
```

Edit 도구는 절대경로를 받으므로 cwd와 무관하다. cwd 고정은 아래 grep/git 검증 명령용이다.

---

## 관련 docs

실행 전 읽을 것:
- `career-os/.claude/skills/position-recommender/SKILL.md` — 추가 위치(References 섹션)와 기존 문체 확인.
- `career-os/docs/code-architecture.md` position-recommender 섹션 — runner 자산 역할이 이미 기술돼 있음을 확인(역참조 대상이 실재하는지).

---

## 작업 항목 (1)

### 1. SKILL.md References 섹션에 runner 자산 역참조 추가

**반드시 Edit 도구를 1회 이상 호출한다. prose 응답만으로 "추가했다"고 끝내면 PHASE_FAILED다.**

SKILL.md 맨 끝 `## References` 섹션의 마지막 bullet은 다음 줄이다(Edit anchor):

```
- `career-os/docs/adr.md` ADR-030 — 본 설계 결정 근거
```

이 줄 바로 뒤에 아래 bullet 한 줄을 추가한다(기존 줄은 보존, additive):

```
- daily/cron runner 자산(`scripts/position-recommender/run_daily_with_claude.ts`·`render_report_html.ts`·`structured_recommendation_items.ts`)의 역할 — `career-os/docs/code-architecture.md` position-recommender 섹션이 단일 출처. 본 SKILL.md는 agent 직접 실행 절차에 집중하고, runner 후처리 자산의 책임은 code-architecture.md를 역참조한다.
```

문체는 기존 References bullet과 맞춘다(명사구 종결 OK — list 항목이므로). 백틱 경로 표기를 유지한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/position-recommender/SKILL.md` | References 섹션에 runner 자산 역참조 bullet 1줄 추가 |

## 검증

보고 직전 반드시 아래 bash 블록을 Bash 도구로 직접 실행하고 출력 값을 그대로 echo한다.

```bash
cd "$(git rev-parse --show-toplevel)"
SKILL=career-os/.claude/skills/position-recommender/SKILL.md

# 1. runner 자산 역참조가 들어갔는가
RUNNER_REF=$(grep -c "run_daily_with_claude.ts" "$SKILL")
echo "[run_daily 역참조] $RUNNER_REF"
[ "$RUNNER_REF" -ge 1 ] || { echo "FAIL: runner 역참조 누락"; exit 1; }

# 2. code-architecture.md 역참조가 들어갔는가
ARCH_REF=$(grep -c "code-architecture.md position-recommender 섹션" "$SKILL")
echo "[code-architecture 역참조] $ARCH_REF"
[ "$ARCH_REF" -ge 1 ] || { echo "FAIL: code-architecture 역참조 누락"; exit 1; }

# 3. 기존 ADR-030 bullet이 보존됐는가 (additive 확인, 바꿔치기 방어)
ADR_KEEP=$(grep -c "ADR-030 — 본 설계 결정 근거" "$SKILL")
echo "[ADR-030 bullet 보존] $ADR_KEEP"
[ "$ADR_KEEP" -ge 1 ] || { echo "FAIL: 기존 bullet 손실"; exit 1; }

# 4. docs/*.md와 AGENTS.md는 이 phase에서 안 건드렸는가 (범위 격리)
DOCS_DIRTY=$(git status --short career-os/docs/ career-os/AGENTS.md | wc -l | tr -d ' ')
echo "[docs/AGENTS dirty] $DOCS_DIRTY"
[ "$DOCS_DIRTY" = "0" ] || { echo "FAIL: 범위 밖 docs 변경"; exit 1; }

echo "✅ Phase 02 검증 명령 실행 완료"
```

## index.json status 마킹 (마지막 phase)

```bash
cd "$(git rev-parse --show-toplevel)"
# status="completed", current_phase=2 로 갱신, updated_at 갱신
python3 - <<'PY'
import json, subprocess
p = "career-os/tasks/plan077-skill-config-consistency/index.json"
ts = subprocess.check_output(["bash","-lc","TZ=Asia/Seoul date +%FT%T%z"]).decode().strip()
# +0900 -> +09:00
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

본 plan은 별도 git worktree + branch에서 실행된다. 따라서 commit만 하고 **push와 plan 단위 PR은 하지 않는다**. push와 PR은 모든 phase 완료 후 메인 세션이 worktree branch를 review한 뒤 처리한다(plan-and-build 원칙: PR은 plan 단위, merge는 review 후).

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/.claude/skills/position-recommender/SKILL.md career-os/tasks/plan077-skill-config-consistency/index.json
# intended files만 staged인지 확인
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
docs(career-os): position-recommender SKILL.md runner 자산 경계 역참조

- SKILL.md References에 daily/cron runner 자산 역참조 추가
- 자산 역할 단일 출처는 code-architecture.md (거울 구조)
- plan077 index.json status=completed 마킹

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"

# phase-01·phase-02 commit 2개가 이 branch에 들어갔는지 self-check (Write 위장 방어)
# prose만 출력하고 Edit/commit을 실제로 안 했으면 아래 두 메시지가 안 보인다
git log --oneline -2
```

## 의도 메모 (왜)

- 거울 구조 원칙 — 자산 역할을 SKILL.md와 code-architecture.md 양쪽에 본문으로 적지 않고, code-architecture.md를 단일 출처로 두고 SKILL.md는 역참조만 한다.
- 자명한 문서 명확화라 ADR감이 아니다(adr-writing.md "디렉터리/흐름 한 줄 변경은 해당 docs 책임").
- 이 보강이 다음 plan(D — SKILL.md 공통 섹션 표준화)에서 "runner 자산 가시성"을 다시 다루지 않아도 되게 막아준다.

## Blocked 조건

- `## References` 섹션이나 ADR-030 bullet anchor를 찾지 못하면 `PHASE_BLOCKED: SKILL.md References anchor 부재` 출력 후 `exit 2`. 반드시 Bash 도구로 직접 실행한다. prose만 출력하면 success로 잘못 처리된다.
