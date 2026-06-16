# Phase 01 — 안전 재검증(피참조 grep) + 13개 ADR 제거 + INDEX.md 행 삭제 + 깨진 링크 0건 검증

**Model**: sonnet
**Status**: pending

---

## 목표

ADR Self-Evidence 정리. "완료된 폐기 / native 마이그레이션 기록"으로 자명해 제거 가능한 안전 후보 13개를 `career-os/docs/adr/`에서 제거한다.

대상 13개 (피참조 0, 사용자 승인):

```
003 004 006 007 011 016 017 029 030 036 072 075 076
```

이 13개는 자산이 이미 git rm으로 사라진 완료된 폐기 또는 native 마이그레이션 기록이고, 다른 ADR이 `[[ADR-NNN]]`로 참조하지 않는다(피참조 0).
제거해도 git history로 보존되므로 ADR 파일 제거는 안전하다.
제거 자체는 완료된 폐기 정리이므로 새 ADR을 만들지 않는다(commit message로 사유를 보존).

**범위 외**:
- `career-os/docs/adr/` 밖의 파일(다른 docs·스킬·코드·config)은 절대 건드리지 않는다.
- 새 ADR을 만들지 않는다. INDEX.md 외 docs 본문도 수정하지 않는다.
- 13개 외 다른 ADR 번호는 제거하지 않는다.
- push/PR은 하지 않는다. 이 phase는 commit까지만 한다(별도 worktree+branch 실행 전제).

---

## 사전 cwd 설정 (run-phases.py hotfix 표준)

run-phases.py는 cwd=workspace로 phase를 실행한다. 본 phase는 ai-nodes 루트 기준 path를 쓰므로 첫 bash에서 루트로 고정한다. Claude Code Bash 도구는 동일 phase 안에서 cwd를 보존하므로 첫 호출에 cd를 박으면 후속 bash가 자동 유지된다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes 저장소 루트 (career-os의 부모)
```

---

## 강제 주의문 (Write 위장 방어)

- 이 phase는 **파일 제거(git rm)와 INDEX.md 행 삭제(Edit)** 만 한다. 새 파일을 만들거나 ADR 본문을 다시 쓰지 않는다.
- 검증 bash는 반드시 **Bash 도구로 직접 실행**하고 출력 값을 그대로 echo한다. 명령을 실행하지 않고 "통과"로 추정 보고하면 안 된다.
- 제거 전 피참조 재확인에서 **하나라도 피참조가 발견되면** 그 번호를 제거 목록에서 빼거나 `PHASE_BLOCKED`로 종료한다. 억지로 제거하지 않는다.

---

## 관련 docs

실행 전 반드시 읽을 워크스페이스 docs:
- `career-os/docs/adr/INDEX.md` — ADR 조망 표. 제거된 ADR의 행을 삭제할 대상.

---

## 작업 항목 (4)

### 1. 파일명 실측 (slug 추측 금지)

13개 각각의 실제 파일명을 `ls`로 확인한다. slug를 추측해 `git rm` 인자에 넣지 않는다.

### 2. 피참조 재확인 (제거 직전 grep)

13개 각각에 대해 `[[ADR-NNN]]` 형태의 피참조가 다른 ADR 파일에 있는지 grep으로 재확인한다.
피참조가 0인 번호만 제거 대상으로 확정한다.
하나라도 피참조가 발견되면 그 번호를 제외하거나 `PHASE_BLOCKED`로 종료한다.

### 3. 제거 + INDEX 행 삭제

피참조 0으로 확정된 번호의 ADR 파일을 `git rm`으로 제거하고, `career-os/docs/adr/INDEX.md`에서 해당 ADR 행을 Edit로 삭제한다.

### 4. 깨진 링크 0건 검증 + commit

남은 ADR 어디에도 제거된 번호를 `[[ADR-NNN]]`로 참조하는 깨진 링크가 없는지 검증하고, 제거된 파일 부재와 INDEX 행 부재를 확인한 뒤 commit한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/docs/adr/ADR-003-*.md` 등 13개 | 제거 (`git rm`) — 피참조 0 확인분만 |
| `career-os/docs/adr/INDEX.md` | 제거된 ADR의 행 삭제 (Edit) |

---

## 실행 절차

### 1. 파일명 실측

```bash
cd "$(git rev-parse --show-toplevel)"
ADR_DIR=career-os/docs/adr
NUMS="003 004 006 007 011 016 017 029 030 036 072 075 076"
for N in $NUMS; do
  F=$(ls "$ADR_DIR"/ADR-$N-*.md 2>/dev/null)
  if [ -z "$F" ]; then echo "MISSING ADR-$N"; else echo "FOUND $F"; fi
done
```

13개 모두 `FOUND`여야 한다. `MISSING`이 있으면 그 번호는 이미 없는 것이므로 제거 목록에서 제외하고 사유를 기록한다(에러 아님).

### 2. 피참조 재확인 (제거 직전 grep)

각 번호에 대해 `[[ADR-NNN]]` 백링크가 다른 ADR 파일에 있는지 확인한다. 자기 자신 파일은 제외한다.

```bash
cd "$(git rev-parse --show-toplevel)"
ADR_DIR=career-os/docs/adr
NUMS="003 004 006 007 011 016 017 029 030 036 072 075 076"
BLOCKED=""
for N in $NUMS; do
  SELF=$(ls "$ADR_DIR"/ADR-$N-*.md 2>/dev/null)
  # 자기 파일을 제외한 나머지에서 [[ADR-NNN]] 피참조 검색
  HITS=$(grep -rl "\[\[ADR-$N\]\]" "$ADR_DIR" 2>/dev/null | grep -vF "$SELF")
  if [ -n "$HITS" ]; then
    echo "[ADR-$N] 피참조 발견:"; echo "$HITS"
    BLOCKED="$BLOCKED $N"
  else
    echo "[ADR-$N] 피참조 0 — 제거 안전"
  fi
done
echo "피참조 발견 번호:${BLOCKED:- 없음}"
```

- `BLOCKED`가 비어 있어야 13개 전부 안전하다.
- `BLOCKED`에 번호가 있으면 그 번호를 제거 목록에서 제외하고 사유를 보고한다.
- 만약 13개 전부 또는 대부분이 BLOCKED라 정리 의미가 없어지면 `PHASE_BLOCKED: 안전 후보 다수에서 피참조 발견 — 식별 전제 재검토 필요` 출력 후 `exit 2`.

### 3. 제거 + INDEX 행 삭제

피참조 0으로 확정된 번호만 `git rm`으로 제거한다. (아래는 13개 전부 안전한 경우. BLOCKED가 있으면 `REMOVE_NUMS`에서 그 번호를 뺀다.)

```bash
cd "$(git rev-parse --show-toplevel)"
ADR_DIR=career-os/docs/adr
REMOVE_NUMS="003 004 006 007 011 016 017 029 030 036 072 075 076"
for N in $REMOVE_NUMS; do
  F=$(ls "$ADR_DIR"/ADR-$N-*.md 2>/dev/null)
  [ -n "$F" ] && git rm "$F"
done
git status --porcelain | grep "^D" | wc -l  # 기대: 제거 대상 수
```

그다음 `INDEX.md`에서 제거된 ADR의 행을 Edit 도구로 삭제한다.
INDEX.md의 각 ADR은 한 행이며 형식은 `| ADR-NNN | 제목 | Status | [링크](파일) |` 이다.
제거 대상 번호(`| ADR-003 |` 등으로 시작하는 행)를 한 행씩 정확히 찾아 삭제한다.
INDEX의 다른 ADR Status 열에 `[[ADR-NNN]]`로 제거 대상을 참조하는 곳은 피참조 재확인(2단계)에서 0건이어야 하므로 INDEX 본문 외 수정은 없다.

### 4. 깨진 링크 0건 검증 + commit

```bash
cd "$(git rev-parse --show-toplevel)"
ADR_DIR=career-os/docs/adr
REMOVE_NUMS="003 004 006 007 011 016 017 029 030 036 072 075 076"

# 4-1. 제거된 파일 부재
for N in $REMOVE_NUMS; do
  if ls "$ADR_DIR"/ADR-$N-*.md >/dev/null 2>&1; then echo "FAIL: ADR-$N 파일 잔존"; exit 1; fi
done
echo "[제거 파일 부재] OK"

# 4-2. INDEX에 제거된 번호의 행 없음
for N in $REMOVE_NUMS; do
  if grep -qE "^\| ADR-$N " "$ADR_DIR/INDEX.md"; then echo "FAIL: INDEX에 ADR-$N 행 잔존"; exit 1; fi
done
echo "[INDEX 행 부재] OK"

# 4-3. 남은 ADR + INDEX 어디에도 제거 번호를 [[ ]]로 참조하는 깨진 링크 0건
BROKEN=$(grep -rE "\[\[ADR-(003|004|006|007|011|016|017|029|030|036|072|075|076)\]\]" "$ADR_DIR" 2>/dev/null | wc -l | tr -d ' ')
echo "[제거 번호 [[ ]] 깨진 링크] $BROKEN 건"
[ "$BROKEN" = "0" ] || { echo "FAIL: 깨진 [[ ]] 링크 잔존"; exit 1; }

echo "✅ Phase 01 검증 명령 실행 완료"
```

`BROKEN`이 0이 아니면 제거 대상을 참조하는 ADR이 남았다는 뜻이다. 2단계 피참조 재확인과 모순되므로 원인을 조사하고, 해결 불가면 `PHASE_FAILED: 제거 번호를 참조하는 깨진 링크 잔존` 출력 후 `exit 1`.

#### commit

별도 worktree+branch 실행이므로 commit만 한다. push와 PR은 하지 않는다.

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/docs/adr/INDEX.md
git status --porcelain | wc -l  # 제거(D) + INDEX 수정(M) 만 있어야 함
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
docs(career-os): plan083 완료된 폐기 ADR 13개 제거 (Self-Evidence 정리)

- 제거 ADR: 003 004 006 007 011 016 017 029 030 036 072 075 076
- 사유: 자산이 git rm으로 사라진 완료된 폐기 또는 native 마이그레이션 기록.
  다른 ADR이 [[ADR-NNN]]로 참조하지 않는 피참조 0 항목이라 제거가 안전하다.
- git history로 전체 본문이 보존되므로 ADR 파일 제거는 비가역적 손실이 아니다.
- 제거 자체는 완료된 폐기 정리라 새 ADR을 만들지 않고 본 commit message로 사유를 보존한다.
- INDEX.md에서 제거된 ADR 행을 함께 삭제하고 깨진 [[ ]] 링크 0건을 확인했다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
COMMITS=$(git rev-list HEAD ^HEAD~1 --count)
echo "[이 phase commit 수] $COMMITS"
[ "$COMMITS" -ge 1 ] || { echo "FAIL: commit 미생성"; exit 1; }
git log --oneline -1
git status --porcelain | wc -l  # 기대: 0 (commit 후 clean)
```

#### index.json status=completed 마킹

검증과 commit이 통과한 뒤에만 실행한다. Edit 도구로 `index.json`의 `status`·`updated_at`을 갱신하거나 아래 python으로 처리한다.

```bash
cd "$(git rev-parse --show-toplevel)"
python3 - <<'PY'
import json, subprocess
p = "career-os/tasks/plan083-adr-self-evidence-cleanup/index.json"
d = json.load(open(p))
d["status"] = "completed"
d["current_phase"] = 1
ts = subprocess.check_output(["bash","-c","TZ=Asia/Seoul date +%FT%T%z"]).decode().strip()
d["updated_at"] = ts[:-2] + ":" + ts[-2:]  # +0900 -> +09:00
s = json.dumps(d, ensure_ascii=False, indent=2) + "\n"
open(p, "w").write(s)
print("status:", d["status"], "current_phase:", d["current_phase"], "updated_at:", d["updated_at"])
PY
grep '"status"' career-os/tasks/plan083-adr-self-evidence-cleanup/index.json | head -1
```

index.json 변경은 실행 이력 정리이므로 별도 commit하거나 위 docs commit과 분리해 관심사별로 둔다(run-phases.py가 자동 처리하면 그대로 둔다).

---

## 검증 (요약)

보고 직전 위 4-1~4-3 검증 bash를 Bash 도구로 직접 실행하고 출력 값을 그대로 echo한다.

- 제거된 13개(또는 피참조 0 확정분) 파일이 모두 부재.
- INDEX.md에 제거된 번호의 행이 없음.
- 남은 ADR + INDEX 어디에도 제거 번호를 `[[ADR-NNN]]`로 참조하는 깨진 링크가 0건.
- 이 phase commit 수 ≥ 1, commit 후 working tree clean(또는 index.json만 남음).

---

## 의도 메모 (왜)

- 안전 후보 13개는 모두 "완료된 폐기 / native 마이그레이션 기록"이라 본문이 더 이상 살아있는 결정을 담지 않는다. git history가 전체 본문을 보존하므로 ADR 파일 제거는 비가역적 손실이 아니다.
- 피참조 0이 핵심 안전 조건이다. 다른 ADR이 `[[ADR-NNN]]`로 참조하면 제거 시 그 ADR에 깨진 링크가 생긴다. 그래서 제거 직전 재확인을 강제하고, 하나라도 발견되면 제외하거나 BLOCKED 처리한다(식별 시점과 실행 시점 사이 drift 방지).
- 제거 자체에 새 ADR을 만들지 않는 이유 — "완료된 폐기 정리"는 trade-off가 있는 아키텍처 결정이 아니라 자명한 청소다. commit message가 사유·번호·git history 보존을 담는 단일 출처다(ADR 단일 책임, planning SKILL.md "한 ADR = 한 의사결정").
- 파일명을 `ls`로 실측하는 이유 — slug를 추측해 `git rm` 인자에 넣으면 잘못된 파일을 지우거나 no-op이 된다. 실제 파일명을 먼저 확인한다.

---

## Blocked 조건

- 13개 중 일부에서 피참조가 발견되면 그 번호를 제거 목록에서 제외하고 사유를 보고한다. 다수가 BLOCKED라 정리 의미가 사라지면 `PHASE_BLOCKED: 안전 후보 다수에서 피참조 발견 — 식별 전제 재검토 필요` 출력 후 `exit 2`.
- 깨진 `[[ ]]` 링크 검증(4-3)이 0이 아니고 원인 해결이 불가하면 `PHASE_FAILED: 제거 번호를 참조하는 깨진 링크 잔존` 출력 후 `exit 1`.
- 검증/commit을 Bash 도구로 직접 실행하지 못하는 환경이면 prose로 "통과" 보고하지 말고 `PHASE_FAILED: 검증 명령 직접 실행 불가` 출력 후 `exit 1`.
