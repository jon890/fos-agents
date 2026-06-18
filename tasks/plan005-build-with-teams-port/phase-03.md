# Phase 03 — variants/career-os.md + verify_team_members.sh 적응

**Model**: sonnet
**Status**: pending

---

## 목표

career-os 환경 variant를 작성하고, verify 스크립트가 워크스페이스 무관하게 동작하는지 적응한다.

**범위 외**: SKILL/agent(phase-01/02), AGENTS/code-arch(phase-04).

---

## 사전 cwd

```bash
cd "$(git rev-parse --show-toplevel)"
```

## 작업

### 1. variants/career-os.md 작성

`.claude/skills/build-with-teams/variants/career-os.md` 신규. SKILL.md "프로젝트 환경 가정" 항목을 career-os 값으로 채운다:

- **브랜치 컨벤션**: GitHub PR 기반(dooray 매핑 없음). `<type>/{plan}` 또는 `refactor/plan{N}-<slug>` 신규 생성. 다른 세션 동시 작업이 흔하므로 worktree 분리 기본(`fos-agents-worktrees/<plan>`).
- **패키지 매니저**: bun(TS·zod), python3(수집기).
- **통합 검증 (`{{CI_CMD}}`)**: 변경 영역에 맞춰 — 예) `bun <변경 스크립트>` 실행 + `bun --check <변경 ts>`. career-os는 빌드 단계 없음.
- **worktree 직후 setup**: ai-nodes 루트에서 `bun install` 1회(이미 돼 있으면 생략).
- **전용 agent**: `career-os-executor`, `career-os-docs-verifier`.
- **코드 규칙 권위**: `career-os/AGENTS.md` + `career-os/docs/` 5문서.
- **PR 제목**: conventional commit + 한글 subject(`<type>(career-os): ...`).
- **번호 충돌 주의**: ADR·plan 번호는 다른 세션이 선점할 수 있으니 생성 전 origin/main + 원격 브랜치 스캔(실측 함정 — plan088/ADR-096 충돌 사례).

### 2. verify_team_members.sh 적응

`.claude/skills/build-with-teams/scripts/verify_team_members.sh` 확인:
- docu-parser 특정 경로·이름 가정이 있으면 인자 기반(plan명 + 멤버명)으로 일반화.
- 워크스페이스 무관하게 team config.json 멤버 등록을 검증하면 OK(수정 불필요할 수 있음 — 확인만).

---

## 성공 기준

```bash
cd "$(git rev-parse --show-toplevel)"
FAIL=0
[ -f .claude/skills/build-with-teams/variants/career-os.md ] || { echo "[FAIL] career-os variant 없음"; FAIL=1; }
grep -q "career-os-executor\|career-os-docs-verifier" .claude/skills/build-with-teams/variants/career-os.md || { echo "[FAIL] variant에 전용 agent 미명시"; FAIL=1; }
grep -qi "bun" .claude/skills/build-with-teams/variants/career-os.md || { echo "[FAIL] variant에 검증명령 미명시"; FAIL=1; }
bash -n .claude/skills/build-with-teams/scripts/verify_team_members.sh || { echo "[FAIL] verify 스크립트 문법 오류"; FAIL=1; }
[ "$FAIL" = 0 ] && echo "SUCCESS phase-03" || { echo "PHASE_FAILED"; exit 1; }
```

## commit (push 금지)

```bash
git add .claude/skills/build-with-teams/variants/ .claude/skills/build-with-teams/scripts/
git commit -q -m "feat(skill): build-with-teams career-os variant + verify 스크립트 적응 (ADR-018)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## Blocked 조건

- 성공 기준 FAIL: `PHASE_FAILED`
