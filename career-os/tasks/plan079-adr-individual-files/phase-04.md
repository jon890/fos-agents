# Phase 04 — 통합 검증 + index.json status=completed 마킹

**Model**: haiku
**Status**: pending

---

## 목표

phase-01~03 산출물을 통합 검증하고, `index.json`의 status를 completed로 마킹한다.
이 phase는 신규 코드/문서를 만들지 않는다 — 검증과 상태 마킹만 한다.

**범위 외**:
- ADR 본문·스킬·라우팅 docs 추가 수정 금지. 검증 실패면 보고만 하고 해당 phase로 되돌린다(여기서 고치지 않는다).
- push·PR 금지. 별도 worktree+branch 실행이므로 commit까지만이고, push는 메인 세션 review 후.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes 저장소 루트
```

---

## 통합 검증

보고 직전 반드시 아래 bash 블록을 Bash 도구로 직접 실행하고 출력 값을 그대로 echo한다.
**검증 명령을 실행하지 않고 "통과"로 추정 보고하면 안 된다.**
sigil 문자는 직접 인용하지 않고 escape 변수로 검사한다(common-pitfalls 6-9).

```bash
cd "$(git rev-parse --show-toplevel)"
FAIL=0

# A. phase-01: 원본 adr.md 부재 + 개별 파일 + INDEX
if [ -f career-os/docs/adr.md ]; then echo "[A1] FAIL: adr.md 잔존"; FAIL=1; else echo "[A1] adr.md 부재 OK"; fi
FILES=$(ls career-os/docs/adr/ADR-*.md 2>/dev/null | wc -l | tr -d ' ')
echo "[A2] ADR 개별 파일 수: $FILES"
[ "$FILES" -ge 80 ] || { echo "[A2] FAIL: ADR 파일 부족"; FAIL=1; }
[ -f career-os/docs/adr/INDEX.md ] && echo "[A3] INDEX.md 존재 OK" || { echo "[A3] FAIL: INDEX.md 없음"; FAIL=1; }
INDEX_ROWS=$(grep -cE "^\| ADR-" career-os/docs/adr/INDEX.md 2>/dev/null || echo 0)
echo "[A4] INDEX 데이터 행 수: $INDEX_ROWS (파일 수 $FILES와 일치해야)"
[ "$INDEX_ROWS" = "$FILES" ] || { echo "[A4] FAIL: INDEX 행 != 파일 수"; FAIL=1; }

# B. phase-01: 라우팅 — career-os 단독 adr.md 참조 잔존 없음(모노레포 참조는 허용)
LEFT=$(grep -nE "docs/adr\.md" career-os/AGENTS.md career-os/docs/code-architecture.md 2>/dev/null | grep -vE "ai-nodes/docs/adr\.md|\.\./docs/adr\.md" | wc -l | tr -d ' ')
echo "[B1] career-os adr.md 잔존 참조: $LEFT"
[ "$LEFT" = "0" ] || { echo "[B1] FAIL: 라우팅 잔존"; FAIL=1; }

# C. phase-02: 슬림화 — 30줄 초과 대폭 감소 + prohibited 0
AFTER=$(for f in career-os/docs/adr/ADR-*.md; do n=$(wc -l < "$f"); [ "$n" -gt 30 ] && echo x; done | wc -l | tr -d ' ')
echo "[C1] 30줄 초과 파일 수: $AFTER"
[ "$AFTER" -lt 30 ] || { echo "[C1] FAIL: 슬림화 부족"; FAIL=1; }
SIGIL_CHAR=$(printf '\xc2\xa7')
SIGIL_CNT=$(grep -rc "$SIGIL_CHAR" career-os/docs/adr/ 2>/dev/null | awk -F: '{s+=$2} END{print s+0}')
echo "[C2] section mark 잔존: $SIGIL_CNT"
[ "$SIGIL_CNT" = "0" ] || { echo "[C2] FAIL: section mark 잔존"; FAIL=1; }
MAT=$(grep -rl "매트릭스" career-os/docs/adr/ 2>/dev/null | wc -l | tr -d ' ')
echo "[C3] 매트릭스 잔존 파일: $MAT"
[ "$MAT" = "0" ] || { echo "[C3] FAIL: 매트릭스 잔존"; FAIL=1; }

# D. phase-03: 스킬 분기
BRANCH=$(grep -rlE "career-os.*(adr/|INDEX)" .claude/skills/planning/ .claude/skills/plan-and-build/ .claude/skills/docs-check/ 2>/dev/null | wc -l | tr -d ' ')
echo "[D1] career-os adr/ 분기 명시 파일: $BRANCH"
[ "$BRANCH" -ge 1 ] || { echo "[D1] FAIL: 스킬 분기 미반영"; FAIL=1; }
IMPL=$(grep -rlE "구현명세|구현 명세|파일 목록.*금지|코드 블록.*금지|단계.*금지" .claude/skills/planning/ 2>/dev/null | wc -l | tr -d ' ')
echo "[D2] 구현명세 금지 self-check 파일: $IMPL"
[ "$IMPL" -ge 1 ] || { echo "[D2] FAIL: 구현명세 금지 강화 미반영"; FAIL=1; }

# 종합
if [ "$FAIL" = "0" ]; then echo "✅ 통합 검증 전부 통과"; else echo "❌ 통합 검증 실패 — 위 FAIL 항목 확인"; exit 1; fi
```

## index.json status 마킹

검증이 전부 통과한 뒤에만 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"
python3 - <<'PY'
import json, subprocess
p = "career-os/tasks/plan079-adr-individual-files/index.json"
ts = subprocess.check_output(["bash","-lc","TZ=Asia/Seoul date +%FT%T%z"]).decode().strip()
ts = ts[:-2] + ":" + ts[-2:]
d = json.load(open(p))
d["status"] = "completed"
d["current_phase"] = 4
d["updated_at"] = ts
for ph in d["phases"]:
    ph["status"] = "completed"
open(p, "w").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
print("index.json status=completed 마킹 완료")
PY
```

## commit (push 금지)

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/tasks/plan079-adr-individual-files/index.json
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
chore(career-os): plan079 ADR 개별 파일 전환 통합 검증 + status 마킹

- phase-01~03 산출물 통합 검증 통과
- index.json status=completed

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1

# 마지막 phase: working tree 잔여 확인(6-2). push는 하지 않는다.
echo "[working tree 잔여]"
git status --porcelain | head
```

## 의도 메모 (왜)

- 검증 전용 phase를 분리한 이유 — 분해·슬림화·스킬 분기는 검증 단위가 다르다. 통합 검증을 마지막에 모아 4개 phase가 일관된 최종 상태를 만들었는지 한 번에 확인한다.
- push를 하지 않는 이유 — 별도 worktree+branch 실행 전제. push와 plan 단위 PR은 메인 세션이 전체 diff를 review한 뒤 처리한다(career-os 운영 원칙).

## Blocked 조건

- 통합 검증의 어느 항목이라도 FAIL이면 status 마킹 없이 `PHASE_FAILED: <항목> 검증 실패 — 해당 phase 재실행 필요` 출력 후 `exit 1`. 반드시 Bash 도구로 직접 실행한다. prose만 출력하면 success로 잘못 처리된다. 이 phase에서 직접 산출물을 고치지 않는다(검증 전용).
