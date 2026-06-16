# Phase 01 — adr.md 기계적 분해 + INDEX 생성 + 라우팅 docs 갱신

**Model**: sonnet
**Status**: pending

---

## 목표

단일 `career-os/docs/adr.md`(88 ADR·3560줄)를 기계적·무손실로 개별 파일로 분해한다.
이 phase는 표현을 바꾸지 않는다 — 본문은 원본 그대로 옮기고, 파일을 쪼개고 cross-ref만 링크화한다.
슬림화(표현 압축)는 phase-02 책임이라 여기서 하지 않는다.

산출:
- `career-os/docs/adr/ADR-NNN-<kebab-slug>.md` 88개(번호는 원본 유지, zero-pad 없음).
- `career-os/docs/adr/INDEX.md` — 번호·제목·status·파일명 조망 표.
- 원본 `career-os/docs/adr.md` 제거.
- 라우팅 갱신 — `career-os/AGENTS.md`·`career-os/docs/code-architecture.md`·`docs/workspace-structure.md`의 `docs/adr.md` 참조를 `docs/adr/INDEX.md`로.

**범위 외**:
- ADR 본문 표현 압축·슬림화는 phase-02. 이 phase는 무손실 이동만.
- 전역 스킬(planning·plan-and-build·docs-check) 수정은 phase-03.
- career-os 외 워크스페이스 adr.md는 손대지 않는다.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes 저장소 루트 (career-os의 부모)
```

run-phases.py는 cwd=workspace로 실행하므로 첫 bash에서 루트로 고정한다. Bash 도구는 같은 phase 안 cwd를 보존한다. Write/Edit는 절대경로/루트 기준 경로라 cwd와 무관하다.

---

## 관련 docs

실행 전 읽을 것:
- `career-os/docs/adr.md` 상단(1~95줄) — 헤더 형식(`## ADR-N — 제목`), Quick Index 표 구조(번호·제목·Status·한 줄 요약). 이 Quick Index가 INDEX.md의 1차 소스다.
- 라우팅 대상 3개 파일의 adr.md 참조 위치는 작업 항목 4번에서 grep으로 확인한다.

원본 사실(실측 기준값 — 실행 시 재측정한다):
- `## ADR-` 헤더 88개.
- 상단 Quick Index 데이터 행 76개(일부 ADR이 Quick Index에 누락 — INDEX.md는 헤더 기준 88행이 정답이고 Quick Index는 보조 참고용).

---

## 작업 항목 (5)

**반드시 Write/Bash 도구를 직접 호출한다. prose 응답으로 "분해했다"고 끝내면 PHASE_FAILED다.**

### 1. 분해 스크립트 작성

`career-os/tasks/plan079-adr-individual-files/split_adr.py`를 Write로 생성한다. 동작:

- `career-os/docs/adr.md`를 읽어 `^## ADR-(\d+)\b` 헤더 기준으로 split한다.
- 각 ADR 블록 = 해당 헤더 줄부터 다음 `## ADR-` 헤더 직전까지. 블록 사이의 `---` 구분선은 블록에 포함하지 않고 버린다(개별 파일에서는 불필요).
- 헤더의 제목(`— ` 뒤 텍스트)에서 kebab-slug를 만든다: 소문자화, 한글·영문·숫자만 남기고 나머지는 `-`로, 연속 `-` 1개로, 양끝 `-` 제거. slug가 비면 `adr`로 대체.
- 파일명 `career-os/docs/adr/ADR-<번호>-<slug>.md`. 번호는 원본 문자열 그대로(zero-pad 없음, 예: `ADR-1-...`가 아니라 원본이 `ADR-001`이면 `ADR-001-...`).
- 각 ADR 본문에서 *다른 ADR 참조*를 `[[ADR-NNN]]`로 변환한다. 정규식은 `\bADR-(\d+)\b`를 `[[ADR-\1]]`로 바꾸되, 이미 `[[ ]]`로 감싼 것과 자기 자신 헤더 줄(`## ADR-NNN —`)은 제외한다. `ai-nodes ADR-NNN`처럼 다른 저장소 ADR 참조도 career-os 내부 링크가 아니므로 `[[ ]]`로 감싸지 않는다 — "ai-nodes ADR-" / "모노레포 ADR-" 앞붙은 경우는 변환 제외한다.
- 모든 출력 파일은 trailing newline 1개로 끝낸다.
- 마지막에 처리한 ADR 개수, slug 충돌 여부를 stdout으로 출력한다(같은 slug 2건이면 에러로 표시).

스크립트는 결정적이어야 한다. 본문 한 글자도 추가/삭제하지 않는다(헤더 split·`---` 제거·cross-ref 링크화 외).

### 2. INDEX.md 생성 로직

같은 스크립트 안에서 `career-os/docs/adr/INDEX.md`를 생성한다:
- 헤더: `# ADR INDEX — career-os` + 1줄 요약(개별 ADR 파일 조망, 새 ADR은 새 파일 + INDEX 행 추가).
- 표 컬럼: `| ADR | 제목 | Status | 파일 |`.
- 각 행 = ADR 번호 / 제목 / Status 라인 값 / `[ADR-NNN-slug.md](ADR-NNN-slug.md)` 링크.
- Status는 각 ADR 본문의 `- Status:` 라인에서 추출. 없으면 빈칸.
- 행은 ADR 번호 오름차순.

### 3. 스크립트 실행 + 원본 제거

```bash
cd "$(git rev-parse --show-toplevel)"
mkdir -p career-os/docs/adr
python3 career-os/tasks/plan079-adr-individual-files/split_adr.py
git rm -q career-os/docs/adr.md
```

`git rm`이 실패하면(이미 staged 등) `rm -f career-os/docs/adr.md`로 대체하고 이후 `git add -A`로 처리한다.

### 4. 라우팅 docs 갱신 (Edit)

아래 3개 파일에서 `docs/adr.md`(career-os 한정) 참조를 `docs/adr/INDEX.md`로 갱신한다.
**career-os 자신의 adr.md만 대상**이다. `ai-nodes/docs/adr.md`·`../docs/adr.md`(모노레포 ADR) 참조는 그대로 둔다.

먼저 grep으로 정확한 줄을 확인한 뒤 Edit한다:

```bash
cd "$(git rev-parse --show-toplevel)"
grep -n "docs/adr\.md" career-os/AGENTS.md career-os/docs/code-architecture.md docs/workspace-structure.md
```

- `career-os/AGENTS.md`: 5문서 라우팅 표 행(`[\`docs/adr.md\`](docs/adr.md)` → `[\`docs/adr/INDEX.md\`](docs/adr/INDEX.md)`), "새 결정은 항상 `docs/adr.md` 맨 아래에 누적" → "새 결정은 `docs/adr/`에 새 ADR 파일 + INDEX.md 행 추가"로, "개별 ADR 파일 신설 금지" 문구는 career-os ADR-089로 무효화됐으므로 "career-os는 ADR-089로 개별 파일 + INDEX 구조"로 갱신. 그 외 `docs/adr.md` 단일 출처 언급도 `docs/adr/`로.
- `career-os/docs/code-architecture.md`: 디렉터리 트리의 `adr.md ...` 줄을 `adr/ ...` 디렉터리로 갱신(INDEX.md + ADR-NNN-slug.md 개별 파일, ADR-089/ai-nodes ADR-015).
- `docs/workspace-structure.md`: career-os만 adr/ 비대칭임을 기존 비대칭 표(travel 등) 옆에 추가하거나 본문 표준 설명에서 career-os 예외를 명시. **다른 워크스페이스의 adr.md 단일 누적 표준 설명은 그대로 둔다** — career-os 파일럿 예외만 덧붙인다(ai-nodes ADR-015).

라우팅 문구는 career-os 외 워크스페이스가 여전히 단일 adr.md를 쓴다는 점을 흐리지 않게 분기 표현으로 적는다.

### 5. INDEX 행 수 == ADR 파일 수 == 원본 ADR 수 자체 점검

phase 검증에서 다시 확인하지만, 작업 직후 한 번 스스로 맞춘다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/tasks/plan079-adr-individual-files/split_adr.py` | 신규(분해 스크립트) |
| `career-os/docs/adr/ADR-NNN-slug.md` × 88 | 신규(분해 산출물) |
| `career-os/docs/adr/INDEX.md` | 신규(조망 표) |
| `career-os/docs/adr.md` | 제거 |
| `career-os/AGENTS.md` | adr.md 참조 → adr/INDEX.md |
| `career-os/docs/code-architecture.md` | 디렉터리 트리 adr.md → adr/ |
| `docs/workspace-structure.md` | career-os adr/ 파일럿 예외 명시 |

## 검증

보고 직전 반드시 아래 bash 블록을 Bash 도구로 직접 실행하고 출력 값을 그대로 echo한다.

```bash
cd "$(git rev-parse --show-toplevel)"

# 1. 원본 adr.md 부재
if [ -f career-os/docs/adr.md ]; then echo "FAIL: adr.md 잔존"; exit 1; fi
echo "[adr.md 부재] OK"

# 2. 생성된 ADR 개별 파일 수 (INDEX.md 제외)
FILES=$(ls career-os/docs/adr/ADR-*.md 2>/dev/null | wc -l | tr -d ' ')
echo "[ADR 개별 파일 수] $FILES"

# 3. 원본 헤더 수(git show로 직전 커밋 원본에서 측정)
ORIG=$(git show HEAD:career-os/docs/adr.md | grep -cE "^## ADR-")
echo "[원본 ADR 헤더 수] $ORIG"
[ "$FILES" = "$ORIG" ] || { echo "FAIL: 파일 수($FILES) != 원본 ADR 수($ORIG)"; exit 1; }

# 4. INDEX.md 데이터 행 수 == ADR 파일 수
INDEX_ROWS=$(grep -cE "^\| ADR-" career-os/docs/adr/INDEX.md)
echo "[INDEX 데이터 행 수] $INDEX_ROWS"
[ "$INDEX_ROWS" = "$FILES" ] || { echo "FAIL: INDEX 행($INDEX_ROWS) != 파일 수($FILES)"; exit 1; }

# 5. slug 충돌 없음(파일명 유일성은 ls 수로 보장되나, 같은 번호 중복 체크)
DUP=$(ls career-os/docs/adr/ADR-*.md | sed -E 's#.*/ADR-([0-9]+)-.*#\1#' | sort | uniq -d | wc -l | tr -d ' ')
echo "[번호 중복 ADR 수] $DUP"
[ "$DUP" = "0" ] || { echo "FAIL: 번호 중복"; exit 1; }

# 6. 라우팅: career-os AGENTS/code-architecture에 career-os 단독 docs/adr.md 참조 잔존 없음
#    (ai-nodes/docs/adr.md, ../docs/adr.md 모노레포 참조는 허용)
LEFT=$(grep -nE "docs/adr\.md" career-os/AGENTS.md career-os/docs/code-architecture.md | grep -vE "ai-nodes/docs/adr\.md|\.\./docs/adr\.md" | wc -l | tr -d ' ')
echo "[career-os adr.md 잔존 참조] $LEFT"
[ "$LEFT" = "0" ] || { echo "FAIL: career-os adr.md 참조 잔존"; grep -nE "docs/adr\.md" career-os/AGENTS.md career-os/docs/code-architecture.md; exit 1; }

# 7. INDEX.md 존재
[ -f career-os/docs/adr/INDEX.md ] && echo "[INDEX.md 존재] OK" || { echo "FAIL: INDEX.md 없음"; exit 1; }

echo "✅ Phase 01 검증 명령 실행 완료"
```

## commit

별도 worktree+branch 실행이므로 commit만 한다. push와 PR은 하지 않는다.

```bash
cd "$(git rev-parse --show-toplevel)"
git add -A career-os/docs/adr career-os/tasks/plan079-adr-individual-files/split_adr.py \
        career-os/AGENTS.md career-os/docs/code-architecture.md docs/workspace-structure.md
# adr.md 제거가 git rm으로 안 됐다면 add -A로 삭제 반영
git add -A career-os/docs/adr.md 2>/dev/null || true
git diff --cached --name-status | head -30
git commit -q -m "$(cat <<'EOF'
docs(career-os): adr.md를 개별 파일 + INDEX 구조로 분해

- adr.md(88 ADR) → docs/adr/ADR-NNN-slug.md 개별 파일 + INDEX.md 조망
- ADR 간 cross-ref를 [[ADR-NNN]] wiki 링크로 변환(무손실)
- AGENTS.md / code-architecture.md / workspace-structure.md 라우팅 갱신
- career-os ADR-089 + ai-nodes ADR-015 파일럿 전환

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
# Write 위장 방어: 이 phase가 실제 commit을 만들었는지 self-check
git log --oneline -1
```

## 의도 메모 (왜)

- 분해를 먼저 무손실로 끝내야 phase-02 슬림화 diff가 "표현 압축"만으로 좁아진다. 분해+슬림화를 한 phase에 섞으면 무엇이 이동이고 무엇이 의미 변경인지 review가 불가능해진다(career-os ADR-089 "분해 먼저 → 슬림화 별도").
- INDEX.md를 헤더 88개 기준으로 만드는 이유 — 상단 Quick Index는 76행만 있어 누락이 있다. 헤더가 진실 출처다.
- 라우팅을 분기 표현으로 적는 이유 — 다른 워크스페이스는 단일 adr.md 유지(파일럿 격리, ai-nodes ADR-015). career-os만 adr/ 구조임을 흐리면 후속 작업이 오인한다.

## Blocked 조건

- slug 충돌(같은 번호 2건) 또는 split 결과 파일 수가 원본 헤더 수와 불일치하면 스크립트 버그다. `PHASE_FAILED: 분해 결과 불일치 (파일 N != 원본 M)` 출력 후 `exit 1`. 반드시 Bash 도구로 직접 실행한다. prose만 출력하면 success로 잘못 처리된다.
- 라우팅 대상 파일에서 career-os adr.md 참조 줄을 grep으로 못 찾으면(파일 구조 변경 등) `PHASE_BLOCKED: 라우팅 참조 줄 부재 — docs 구조 확인 필요` 출력 후 `exit 2`. 반드시 Bash 도구로 직접 실행한다.
