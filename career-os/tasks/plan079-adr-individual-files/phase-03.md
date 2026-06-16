# Phase 03 — 전역 스킬 career-os adr/ 분기 + 구현명세 금지 self-check 강화

**Model**: sonnet
**Status**: pending

---

## 목표

전역 스킬(planning·plan-and-build·docs-check)이 "career-os는 adr/ 개별 파일 + INDEX 구조이고, 새 ADR은 새 파일 생성 + INDEX 갱신(adr.md append 아님)"을 인지하도록 개편한다.
동시에 planning의 ADR 작성 self-check에 "ADR 본문에 구현명세(파일 목록·단계·코드 블록) 금지"를 강화한다(career-os ADR-089 ⑥ 예방).

다른 워크스페이스(apartment·stock-investment·travel·health-care)는 여전히 단일 adr.md 방식이므로, 모든 문구는 **워크스페이스별 분기**로 적는다 — career-os만 adr/ 예외(ai-nodes ADR-015).

**범위 외**:
- ADR 본문 자체(docs/adr/)는 phase-01·02 완료분이라 건드리지 않는다.
- career-os docs/AGENTS.md 라우팅(phase-01 완료분)은 건드리지 않는다.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes 저장소 루트
```

Edit 도구는 절대경로/루트 기준 경로라 cwd와 무관하다. cwd 고정은 grep/git 검증용이다.

---

## 관련 docs

실행 전 grep으로 각 스킬의 adr.md 언급 위치를 파악한다:

```bash
cd "$(git rev-parse --show-toplevel)"
grep -rn "adr\.md\|개별 ADR\|맨 아래\|append\|단일 누적" \
  .claude/skills/planning/ .claude/skills/plan-and-build/ .claude/skills/docs-check/
```

대상 지점(실측 기준 — 실행 시 재확인):
- `.claude/skills/planning/references/adr-writing.md` — ADR 작성 원칙.
- `.claude/skills/planning/task-create.md` — 3-2 "개별 ADR 파일 신설" self-check, related_docs 예시 경로.
- `.claude/skills/planning/references/5docs-policy.md` — adr.md 책임 설명.
- `.claude/skills/plan-and-build/SKILL.md` — "개별 ADR 파일 신설 금지" 문구(여러 곳), `git add career-os/docs/adr.md` 예시.
- `.claude/skills/plan-and-build/references/common-pitfalls.md` — 3-2 "개별 ADR 파일 신설" self-check.
- `.claude/skills/docs-check/SKILL.md` — career-os adr.md 스캔 경로(여러 곳), "ADR 개수" 설명.

---

## 작업 항목 (5)

**반드시 Edit 도구를 호출한다. prose 응답으로 "고쳤다"고 끝내면 PHASE_FAILED다.**

### 1. planning task-create.md / common-pitfalls.md의 "개별 ADR 파일 신설 금지" 분기

- task-create.md 3-2 self-check와 common-pitfalls.md 3-2는 현재 "개별 ADR 파일 신설 = 위반"으로 단정한다. 이를 워크스페이스 분기로 바꾼다:
  - career-os: 새 ADR은 `docs/adr/ADR-NNN-slug.md` 새 파일 생성 + `docs/adr/INDEX.md` 행 추가(adr.md append 아님).
  - 그 외 워크스페이스: `docs/adr.md` 맨 아래 append(기존 유지).
- task-create.md의 related_docs 예시·참조 경로에 `career-os/docs/adr.md`가 있으면 `career-os/docs/adr/INDEX.md`로 갱신하되, 일반 예시는 워크스페이스 무관 표현으로 남긴다.

### 2. plan-and-build SKILL.md "개별 ADR 파일 신설 금지" 분기

- "새 결정은 `<workspace>/docs/adr.md` 맨 아래에 누적 (개별 ADR 파일 신설 금지)" 류 문구를 career-os 예외로 분기한다.
- `git add career-os/docs/adr.md` 예시가 있으면 career-os 맥락에서는 `career-os/docs/adr/` 디렉터리 기준으로 갱신한다(일반 예시는 `<workspace>/docs/adr.md` 유지).

### 3. docs-check SKILL.md career-os adr 스캔 경로 분기

- career-os adr를 스캔하는 부분(`career-os/docs/adr.md`)을 `career-os/docs/adr/` 개별 파일 + `INDEX.md` 구조로 인지하도록 갱신한다.
- `ai-nodes/docs/adr.md`(모노레포) 스캔은 그대로 둔다.
- Quick Index sync 점검 같은 단일 파일 전제 로직이 career-os에 있으면, career-os는 INDEX.md ↔ 개별 파일 헤더 sync로 의미를 바꾼다(스크립트가 복잡하면 설명 텍스트만 분기하고 구현 변경은 PHASE_BLOCKED 후보로 본다).

### 4. ADR 본문 구현명세 금지 self-check 강화 (⑥)

- `planning/references/adr-writing.md`(또는 task-create.md self-check)에 명시 항목을 강화한다: **"ADR 본문에 구현명세(파일 목록 3개+·단계별 절차·코드 블록)를 넣지 않는다. 그건 코드·code-architecture.md·git history 책임이다."**
- 이미 유사 원칙이 산문으로 있으면, self-check 체크리스트 형태(작성 직후 확인 가능한 한 줄)로 끌어올려 강화한다.

### 5. 분기 표현 일관성 확인

수정한 모든 문구가 "career-os는 adr/, 그 외는 adr.md"를 흐리지 않는지 확인한다. career-os를 전체 표준으로 오해하게 적지 않는다(파일럿 격리, ai-nodes ADR-015).

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `.claude/skills/planning/task-create.md` | 3-2 self-check 분기 + 구현명세 금지 강화 + 경로 예시 |
| `.claude/skills/planning/references/adr-writing.md` | 구현명세 금지 self-check 강화 |
| `.claude/skills/planning/references/5docs-policy.md` | career-os adr/ 분기(해당 시) |
| `.claude/skills/plan-and-build/SKILL.md` | 개별 ADR 신설 금지 → career-os 예외 분기 |
| `.claude/skills/plan-and-build/references/common-pitfalls.md` | 3-2 self-check 분기 |
| `.claude/skills/docs-check/SKILL.md` | career-os adr/ 스캔 경로 분기 |

실제 수정 파일은 작업 항목 grep 결과에 따라 가감한다. 위 표는 예상 범위다.

## 검증

보고 직전 반드시 아래 bash 블록을 Bash 도구로 직접 실행하고 출력 값을 그대로 echo한다.

```bash
cd "$(git rev-parse --show-toplevel)"

# 1. 세 스킬에 career-os adr/ 구조 언급이 들어갔는지(분기 인지)
PLAN_HIT=$(grep -rl "adr/" .claude/skills/planning/ | wc -l | tr -d ' ')
PB_HIT=$(grep -rl "adr/" .claude/skills/plan-and-build/ | wc -l | tr -d ' ')
DC_HIT=$(grep -rl "adr/" .claude/skills/docs-check/ | wc -l | tr -d ' ')
echo "[planning adr/ 언급 파일] $PLAN_HIT"
echo "[plan-and-build adr/ 언급 파일] $PB_HIT"
echo "[docs-check adr/ 언급 파일] $DC_HIT"
[ "$PLAN_HIT" -ge 1 ] && [ "$PB_HIT" -ge 1 ] && [ "$DC_HIT" -ge 1 ] || { echo "FAIL: adr/ 구조 분기 미반영"; exit 1; }

# 2. career-os 분기 키워드(career-os + adr/ 또는 INDEX)가 최소 1개 스킬에 함께 등장
BRANCH=$(grep -rlE "career-os.*(adr/|INDEX)" .claude/skills/planning/ .claude/skills/plan-and-build/ .claude/skills/docs-check/ | wc -l | tr -d ' ')
echo "[career-os adr/ 분기 명시 파일] $BRANCH"
[ "$BRANCH" -ge 1 ] || { echo "FAIL: career-os 분기 명시 없음"; exit 1; }

# 3. 구현명세 금지 self-check 강화 흔적
IMPL=$(grep -rlE "구현명세|구현 명세|파일 목록.*금지|코드 블록.*금지|단계.*금지" .claude/skills/planning/ | wc -l | tr -d ' ')
echo "[구현명세 금지 self-check 파일] $IMPL"
[ "$IMPL" -ge 1 ] || { echo "FAIL: 구현명세 금지 강화 미반영"; exit 1; }

echo "✅ Phase 03 검증 명령 실행 완료"
```

## commit

```bash
cd "$(git rev-parse --show-toplevel)"
git add .claude/skills/planning .claude/skills/plan-and-build .claude/skills/docs-check
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
docs(skills): 전역 스킬에 career-os adr/ 개별 파일 구조 분기 반영

- planning/plan-and-build/docs-check가 career-os adr/ + INDEX 구조 인지
- 새 ADR은 새 파일 + INDEX 갱신(adr.md append 아님), 그 외 워크스페이스는 adr.md 유지
- ADR 본문 구현명세(파일 목록·단계·코드 블록) 금지 self-check 강화
- career-os ADR-089 + ai-nodes ADR-015 파일럿 격리

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
COMMITS=$(git rev-list HEAD ^HEAD~1 --count)
echo "[이 phase commit 수] $COMMITS"
[ "$COMMITS" -ge 1 ] || { echo "FAIL: commit 미생성"; exit 1; }
git log --oneline -1
```

## 의도 메모 (왜)

- 스킬을 분기로 적는 이유 — career-os만 파일럿이라 다른 워크스페이스는 단일 adr.md 그대로다. "개별 ADR 파일 = 항상 위반"을 단정한 옛 self-check를 그대로 두면, career-os 작업이 정상 동작인데도 critic이 위반으로 잡는다.
- 구현명세 금지를 강화하는 이유 — 이번 Bloat 68%의 근본 원인이 ADR에 파일 목록·단계가 섞인 것이다. self-check를 체크리스트로 끌어올려야 다음 ADR 작성 때 같은 Bloat가 재발하지 않는다(예방).

## Blocked 조건

- docs-check의 Quick Index sync 점검이 단일 파일 파싱 스크립트에 깊게 묶여 있어 career-os 분기가 구현 변경을 요구하면, 그 부분은 설명 텍스트만 분기하고 `PHASE_BLOCKED: docs-check sync 스크립트 분기는 별도 plan 필요` 출력 후 `exit 2`. 반드시 Bash 도구로 직접 실행한다. 나머지 텍스트 분기는 완료한 뒤 보고한다.
