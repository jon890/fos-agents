# Phase 01 — SKILL.md native 동작 명세 재작성 + claude-prompt.md 흡수

**Model**: sonnet
**Status**: pending

---

## 목표

`apartment-daily-report` SKILL.md를 외부 subprocess 패턴에서 **native skill 직접 동작 명세**로 재작성한다.
Claude가 SKILL.md 지시에 따라 수집·정규화 TS를 `bun` Bash로 호출하고, summary.json을 Read한 뒤 report.md를 직접 Write한다.
합성 프롬프트(`references/claude-prompt.md`)는 SKILL.md 합성 단계 지시로 흡수한다.

근거: ADR-010 (apartment/docs/adr.md). interior-reference-digest가 이미 같은 native 패턴.

**범위 외**:

- thin wrapper `run_with_claude.sh` 신규 작성 + 옛 `run_report.sh` 폐기 — phase-02 책임.
- 수집·정규화 TS 헬퍼(`collect_sources.ts`, `normalize_results.ts`, `load_target_meta.ts`) 내부 로직 변경 — 유지(호출 방식만 SKILL.md에 명시).
- `run_smoke_test.sh` / `run_guri_buy_search.sh` — 보조 진입점, 본 plan 미변경.
- `_shared/bin/track_task.sh` / `extract_claude_result.ts` 파일 자체 삭제 — 후속 모노레포 plan(stock-investment 전환 후).

---

## 사전 cwd 설정 (run-phases.py hotfix 표준)

run-phases.py는 cwd=workspace(apartment)로 실행. 본 phase는 ai-nodes 루트 기준 path 사용이므로 첫 bash에서 루트로 이동. Claude Code Bash 도구 cwd 보존 → 후속 자동 유지.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs (실행 전 Read)

- `apartment/docs/adr.md` ADR-010 — 전환 결정·결과.
- `apartment/docs/flow.md` 2번 — native daily-report 흐름 (목표 시퀀스).
- `apartment/.claude/skills/apartment-interior-reference-digest/SKILL.md` — 참조 native 패턴 (수집·합성·알림을 Claude가 직접 수행하는 구조).

---

## 작업 항목 (3)

### 1. SKILL.md 워크플로 재작성

`apartment/.claude/skills/apartment-daily-report/SKILL.md`의 `## 워크플로` 섹션(현재 1단계 수집/2단계 정규화/3단계 Claude 합성)을 native 동작으로 재작성한다.

native 워크플로 (Claude가 직접 수행):

1. **타깃 메타 로드** — `bun apartment/scripts/_lib/load_target_meta.ts apartment/config/focus-unit.json` 실행해 단지 메타 확보 (ADR-002).
2. **수집** — `bun apartment/scripts/apartment-daily-report/collect_sources.ts <raw-search.json 경로>` 실행. 네이버 정적 수집 실패(`status: not_found`/`error`) 시 `references/naver-browser-prompt.md` 지침으로 agent-browser fallback.
3. **정규화** — `bun apartment/scripts/apartment-daily-report/normalize_results.ts <raw-search.json> <summary.json>` 실행.
4. **합성** — `summary.json`을 Read하고 report.md를 **Claude가 직접 Write**. `claude --print --output-format json` 자기 호출과 `extract_claude_result.ts`는 사용하지 않는다.
5. **알림** — 완료/요약은 `bun _shared/lib/notify_discord.ts "<메시지>"` 호출 (시작/실패 알림은 thin wrapper 담당, phase-02).

산출물 경로: `apartment/data/YYYY-MM-DD/{raw-search.json, summary.json, report.md}`.
`claude.result.json` / `report.fallback.md`는 생성하지 않는다(ADR-010 폐기).

### 2. claude-prompt.md 합성 지침 흡수

`references/claude-prompt.md`의 리포트 구조·합성 지침을 SKILL.md 합성 단계(위 4번) 본문으로 흡수한다.
흡수 후 `references/claude-prompt.md`는 git rm으로 폐기한다(별도 프롬프트 파일 불필요 — native는 SKILL.md가 단일 지침).
`references/naver-browser-prompt.md`는 fallback 수집 지침이라 **유지**.

### 3. 파일·의존성 표 갱신

SKILL.md `## 파일 및 의존성` 표에서 아래 행 제거:

- 메인 러너 `run_report.sh` → `run_with_claude.sh`로 교체 (phase-02에서 신규 생성하지만 표는 본 phase에서 갱신).
- 트래커 `track_task.sh` 행 삭제.
- 결과 파서 `extract_claude_result.ts` 행 삭제.

`## 아키텍처` 섹션의 openclaw wrapper 문구는 유지.

---

## Write 위장 방어 (common-pitfalls 6-6 — 필수)

본 phase는 SKILL.md 본문을 대량 재작성한다.
**반드시 Edit/Write 도구를 실제로 호출**한다. prose 응답으로 "재작성했다"만 출력하면 PHASE_FAILED다.
phase 끝 검증에서 commit 개수를 self-check한다(아래).

## references audit (common-pitfalls 6-7)

SKILL.md 재작성 시 `references/` 본문도 함께 audit.
`claude-prompt.md`는 흡수 후 폐기(작업 2), `naver-browser-prompt.md`는 옛 subprocess 지시문(`--output-format json` 등)이 있으면 정리.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `apartment/.claude/skills/apartment-daily-report/SKILL.md` | native 동작 명세 재작성 |
| `apartment/.claude/skills/apartment-daily-report/references/claude-prompt.md` | SKILL.md 흡수 후 git rm |

## 커밋 (검증 통과 후)

`git add -A` 금지 — 아래 파일만 명시 add. push 안 함(phase-03 후 오케스트레이터).

```bash
cd "$(git rev-parse --show-toplevel)"
git add apartment/.claude/skills/apartment-daily-report/SKILL.md
git rm apartment/.claude/skills/apartment-daily-report/references/claude-prompt.md
STAGED=$(git diff --cached --name-only | wc -l)
echo "[staged] $STAGED (기대 2: SKILL.md 수정 + claude-prompt.md 삭제)"
[ "$STAGED" -eq 2 ] || { echo "PHASE_FAILED: staged 파일 수 불일치 — 무관 파일 혼입 의심"; git reset; exit 1; }
git commit -m "$(cat <<'EOF'
docs(apartment): plan010 phase-01 daily-report SKILL.md native 재작성

- 외부 subprocess(claude json+extractor) → Claude 직접 수집·합성·Write 명세
- claude-prompt.md 합성 지침 SKILL.md 흡수 후 폐기
- 파일·의존성 표에서 track_task.sh / extract_claude_result.ts 제거 (ADR-010)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
# Write 위장 방어: 이 phase에서 commit 1개 생성됐는지 확인
NEW=$(git rev-list HEAD ^origin/main --count 2>/dev/null || echo 1)
echo "[이번 브랜치 신규 commit 수] $NEW"
git log --oneline -1
```

## 검증

보고 직전 반드시 아래 bash 블록을 Bash 도구로 직접 실행하고 stdout 값을 그대로 출력한다(추정 금지).

```bash
cd "$(git rev-parse --show-toplevel)"
SK=apartment/.claude/skills/apartment-daily-report/SKILL.md

# claude-prompt.md 폐기 확인 (기대: 부재)
[ ! -f apartment/.claude/skills/apartment-daily-report/references/claude-prompt.md ] && echo "[claude-prompt.md] 폐기 OK" || { echo "PHASE_FAILED: claude-prompt.md 잔존"; exit 1; }

# naver-browser-prompt.md 유지 확인 (기대: 존재)
[ -f apartment/.claude/skills/apartment-daily-report/references/naver-browser-prompt.md ] && echo "[naver-browser-prompt.md] 유지 OK" || { echo "PHASE_FAILED: naver-browser-prompt.md 소실"; exit 1; }

# SKILL.md 에서 옛 외부 subprocess 잔재 0 확인
LEG=$(grep -cE "extract_claude_result|--output-format json|TRACK_TASK_WRAPPED|track_task\.sh" "$SK")
echo "[SKILL.md 옛 패턴 잔재] $LEG (기대 0)"
[ "$LEG" -eq 0 ] || { echo "PHASE_FAILED: SKILL.md 옛 subprocess 잔재 $LEG건"; grep -nE "extract_claude_result|--output-format json|TRACK_TASK_WRAPPED|track_task\.sh" "$SK"; exit 1; }

# native 핵심 지시 존재 확인 (Claude 직접 Write + bun 호출)
grep -q "직접 Write" "$SK" && grep -q "bun" "$SK" && echo "[native 지시] OK" || { echo "PHASE_FAILED: native 동작 지시 누락"; exit 1; }
echo "✅ 모든 검증 명령 실행 완료"
```

PHASE_FAILED 트리거 시 반드시 위 bash를 Bash 도구로 실행해 exit 1로 종료한다. prose만 출력하면 success로 잘못 처리된다.

## 의도 메모 (왜)

- ADR-010 — 외부 subprocess 패턴 폐기, native 직접 호출로 interior와 일관성.
- claude-prompt.md 흡수 — native는 SKILL.md가 단일 지침 출처(별도 프롬프트 파일은 외부 subprocess 시대 잔재).
- phase-02가 thin wrapper를 만들어 이 SKILL.md를 호출. 본 phase는 동작 명세만 확정.
