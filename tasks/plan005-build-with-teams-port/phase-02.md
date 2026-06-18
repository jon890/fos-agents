# Phase 02 — career-os 전용 agent 2개 신규 작성

**Model**: sonnet
**Status**: pending

---

## 목표

`.claude/agents/career-os-executor.md`, `.claude/agents/career-os-docs-verifier.md`를 신규 작성한다.
docu-parser 정본의 5블록 구조를 따르되 career-os 도메인 지식을 내장한다.

**범위 외**: SKILL/references(phase-01), variant(phase-03), AGENTS/code-arch(phase-04).

---

## 사전 cwd

```bash
cd "$(git rev-parse --show-toplevel)"
```

## 정본 대조 (읽기, 구조만 차용)

- `/Users/nhn/projects/ai-playground-docu-parser/.claude/agents/docu-parser-executor.md` (239줄)
- `/Users/nhn/projects/ai-playground-docu-parser/.claude/agents/docu-parser-docs-verifier.md` (232줄)

5블록 골격: `<Role>` / `<Domain_Rules>` / `<Self_Check>` / `<Verification_Protocol>` / `<Self_Discipline>`.
frontmatter: `name`, `description`(트리거 범위를 career-os로 한정 — "다른 워크스페이스 적용 금지"), `model`.

## 작업

### 1. career-os-executor.md

- frontmatter: `name: career-os-executor`, `model: sonnet`, description에 "career-os phase 실행 전용, build-with-teams가 호출".
- `<Role>`: 책임(phase 코드 작성·로컬 검증·SendMessage 보고) / 비책임(git commit·docs 검증·plan 평가 — team-lead/critic/docs-verifier 몫).
- `<Domain_Rules>` — career-os 도메인 내장:
  - 디렉터리 책임: `scripts/<skill>/` 실행 파일, `.claude/skills/<skill>/` SKILL+references (ADR-019 분리), `_shared/lib`는 워크스페이스 무관 헬퍼만.
  - 런타임: bun(TS, zod), python3(수집기). 검증: `bun <script>`, `bun --check`.
  - 데이터 경계: config는 정책·타깃·예외만(ADR-069). data/ private. public/question-bank 질문 정본(ADR-097). fos-study 공개 경계.
  - ADR 참조 표: 데이터 스키마 변경→docs/data-schema.md, 새 흐름→flow.md, 새 결정→docs/adr/ADR-NNN-slug.md + INDEX(ADR-015 career-os 파일럿).
- `<Self_Check>`: 완료 직전 grep(예: 새 `claude -p` 하드코딩 0 — ADR-093, fos-study 직접 commit 금지, unrelated 변경 0).
- `<Verification_Protocol>`: 완료 보고 형식(변경 파일·검증 결과·특이사항 4종) + 차단 조건(import 실패, 범위 밖 → PHASE_BLOCKED).
- `<Self_Discipline>`: git commit 금지(team-lead 몫), 워크트리 격리, 꼭 필요한 변경만, 단일 소스 존중.

### 2. career-os-docs-verifier.md

- frontmatter: `name: career-os-docs-verifier`, `model: sonnet`, **`tools`에서 Write/Edit 제외**(read-only 강제).
- `<Role>`: 코드↔docs 정합 검증만(PASS/UPDATE_NEEDED/VIOLATION). 코드 수정·plan 평가 금지.
- `<Domain_Rules>`: career-os 5문서(prd/data-schema/flow/code-architecture/adr) 단일 소스, ADR 개별파일+INDEX, docs-style(semantic line break·한자어 회피·명사형 종결 회피), fos-study 공개 경계.
- `<Self_Check>`: 6축(부패·과대화·추론성·중복·자명성·가독성) + planning 영향 표 대조.
- `<Verification_Protocol>`: 판정 + 근거(파일:줄). 자기-면제 금지("재검사 불필요" 수용 안 함).
- `<Self_Discipline>`: read-only, 작성 agent와 별도 lane(self-approval 금지).

---

## common-pitfalls self-check

INDEX 라우터에서 관련 패턴 점검(특히 custom agent·self-approval 관련).

---

## 성공 기준

```bash
cd "$(git rev-parse --show-toplevel)"
FAIL=0
for a in career-os-executor career-os-docs-verifier; do
  [ -f .claude/agents/$a.md ] || { echo "[FAIL] $a.md 없음"; FAIL=1; continue; }
  grep -q "<Role>\|## Role\|Role" .claude/agents/$a.md || { echo "[FAIL] $a 5블록 구조 미흡"; FAIL=1; }
done
# docs-verifier read-only (Write/Edit 제외 명시)
grep -qi "read-only\|Write.*제외\|tools:" .claude/agents/career-os-docs-verifier.md || { echo "[FAIL] docs-verifier read-only 미명시"; FAIL=1; }
# career-os 도메인 내장 확인
grep -q "ADR-019\|data-schema\|public/question-bank\|fos-study" .claude/agents/career-os-executor.md || { echo "[FAIL] executor 도메인 미내장"; FAIL=1; }
[ "$FAIL" = 0 ] && echo "SUCCESS phase-02" || { echo "PHASE_FAILED"; exit 1; }
```

## commit (push 금지)

```bash
git add .claude/agents/career-os-executor.md .claude/agents/career-os-docs-verifier.md
git commit -q -m "feat(agent): career-os 전용 executor·docs-verifier (ADR-018)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## Blocked 조건

- 정본 agent 경로 접근 불가: `PHASE_BLOCKED`
- 성공 기준 FAIL: `PHASE_FAILED`
