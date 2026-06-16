# Phase 01 — docs-audit 스킬 디렉터리 제거

**Model**: haiku
**Status**: pending

---

## 목표

career-os의 `.claude/skills/docs-audit/` 디렉터리를 제거한다.
이 디렉터리의 `SKILL.md`는 `sources/fos-study/.claude/skills/docs-audit/SKILL.md`로 향하는 심볼릭 링크인데, career-os 단독 checkout 환경에는 `sources/fos-study`가 없어 항상 깨진 상태로 남는다.
docs-audit는 fos-study 문서를 감사하는 스킬이므로 career-os에서 호출할 일이 없다(ADR-088).

**범위 외**:
- docs/ADR 본문 정리는 선행 commit(3a0844f)에서 이미 끝났다. 이 phase에서 `docs/*.md`나 `AGENTS.md`를 수정하지 않는다.
- position-recommender SKILL.md 보강은 Phase 02 책임이다.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다. 본 phase는 ai-nodes 루트 기준 path를 쓰므로 첫 bash에서 루트로 이동한다. Claude Code Bash 도구는 같은 phase 안에서 cwd를 보존하므로 첫 호출에만 박으면 된다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes 저장소 루트 (career-os의 부모)
```

---

## 관련 docs

실행 전 읽을 것:
- `career-os/docs/adr.md` ADR-088 — docs-audit 제거 결정과 거절한 대안.

---

## 작업 항목 (1)

### 1. docs-audit 디렉터리 제거

제거 대상은 디렉터리 전체다. 내부는 broken 심링크 `SKILL.md`와 로컬 파일 `references/axis-detail.md`로 구성된다.

```bash
cd "$(git rev-parse --show-toplevel)"
# 제거 전 실측 — 무엇이 사라지는지 raw 출력
ls -la career-os/.claude/skills/docs-audit/
git rm -r career-os/.claude/skills/docs-audit/
```

`.codex/skills/`에는 docs-audit 심링크가 원래 없으므로(외부 심링크라 노출 대상에서 제외돼 있었음) 추가로 지울 것은 없다. 검증에서 확인한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/docs-audit/SKILL.md` | 삭제 (broken 심링크) |
| `career-os/.claude/skills/docs-audit/references/axis-detail.md` | 삭제 |
| `career-os/.claude/skills/docs-audit/` | 디렉터리 삭제 |

## 검증

보고 직전 반드시 아래 bash 블록을 Bash 도구로 직접 실행하고, 출력 값을 그대로 echo한다. 추정 보고 금지.

```bash
cd "$(git rev-parse --show-toplevel)"

# 1. 디렉터리가 사라졌는가 (없어야 함)
[ ! -d career-os/.claude/skills/docs-audit ] && echo "OK: docs-audit 디렉터리 제거됨" || { echo "FAIL: 디렉터리 잔존"; exit 1; }

# 2. .codex/skills에도 docs-audit 잔재 없음 (원래 없음)
CODEX_LEFT=$(ls career-os/.codex/skills/ | grep -c "docs-audit" || true)
echo "[codex docs-audit 잔재] $CODEX_LEFT"
[ "$CODEX_LEFT" = "0" ] || { echo "FAIL: codex 잔재"; exit 1; }

# 3. git이 삭제를 staged로 인식하는가
git status --short career-os/.claude/skills/docs-audit/ || true

echo "✅ Phase 01 검증 명령 실행 완료"
```

## commit

단일 관심사 commit. push는 하지 않는다(마지막 phase에서).

```bash
cd "$(git rev-parse --show-toplevel)"
git commit -q -m "$(cat <<'EOF'
chore(career-os): docs-audit 스킬 디렉터리 제거 (ADR-088)

- career-os 단독 checkout 환경에서 깨진 심링크로 남던
  .claude/skills/docs-audit/ 제거
- fos-study 문서 감사는 fos-study repo checkout에서 직접 실행

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
# commit 개수 self-check — 본 phase가 정확히 1개 commit을 만들었는가
git log --oneline -1
```

## 의도 메모 (왜)

- ADR-088 결정의 구현. 깨진 심링크가 스킬 목록에 상주하면 신규 에이전트가 실효 없는 스킬을 발견한다.
- 디렉터리 삭제로 효과가 종료되는 완료된 폐기라 별도 ADR이 아니라 본 plan commit으로 보존(adr-writing.md "완료된 폐기" 분류).

## Blocked 조건

- `.claude/skills/docs-audit/`가 이미 없으면(다른 세션이 선제거) `PHASE_BLOCKED: docs-audit 디렉터리 이미 부재` 출력 후 `exit 2`. 반드시 Bash 도구로 직접 실행한다. prose만 출력하면 success로 잘못 처리된다.
