# Phase 03 — daily-stock-analysis-note native 전환 (fos-study 발행 유지)

**Model**: sonnet
**Status**: pending

---

## 목표

`daily-stock-analysis-note`를 native skill 직접 호출로 전환(ADR-003) + Discord 알림 `_shared/lib/notify_discord.ts` 통합(ADR-002).
이 skill은 **fos-study 발행**(cross-workspace git push)과 **sanitize 단계**가 있다 — native 워크플로에 유지·명시한다.

참조 정본: phase-01/02에서 전환한 wrapper + apartment plan010 패턴.

**범위 외**: morning-brief(phase-01), current-issue(phase-02).

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs (실행 전 Read)

- `stock-investment/docs/adr.md` ADR-002 + ADR-003.
- `stock-investment/docs/flow.md` 4번 — daily-note 흐름 (종목 선택 + fos-study 발행 + history.json).
- `stock-investment/scripts/daily-stock-analysis-note/run_daily_note.sh` — 폐기 전 fos-study 발행·sanitize·SKIP_PUSH 패턴 참고.

---

## 작업 항목 (5)

### 1. SKILL.md native 재작성

`stock-investment/.claude/skills/daily-stock-analysis-note/SKILL.md` 워크플로 native화:

1. 종목 선택 + 수집 — `python3 stock-investment/scripts/daily-stock-analysis-note/collect_daily_note_inputs.py` (universe.json + history.json rotation + TICKER env → selected.json + raw-inputs.json, history.json 업데이트 부작용).
2. 합성 — selected.json + raw-inputs.json Read 후 report.md 직접 Write.
3. fos-study 발행 — `python3 .../sanitize_fos_study_markdown.py`로 마크다운 규칙 적용 후 `career-os/sources/fos-study/finance/investing/ai-tech-stock/YYYY-MM-DD-<slug>.md`에 작성, `git add/commit/push` (SKIP_PUSH=1 억제). cross-workspace 단방향 쓰기(ADR-001 예외).
4. 알림 — `bun run _shared/lib/notify_discord.ts` (요약 + 발행 경로).

산출물: `data/daily-notes/YYYY-MM-DD/{selected.json, raw-inputs.json, report.md}`.
`analysis-input.md` / `claude.result.json` 생성 안 함.

### 2. blog-note-prompt.md 흡수

`references/blog-note-prompt.md`의 블로그 노트 구조·지침을 SKILL.md로 흡수 후 git rm.

### 3. run_with_claude.sh 신규

`stock-investment/scripts/daily-stock-analysis-note/run_with_claude.sh`:

- `.env` 로드, Discord 시작 알림, `claude --permission-mode bypassPermissions -p "/daily-stock-analysis-note"`.
- `TICKER` / `SKIP_NOTIFY` / `SKIP_PUSH` env 전달 유지.
- 종료 처리: phase-01 패턴 동일.

### 4. 옛 러너 폐기

- `scripts/daily-stock-analysis-note/run_daily_note.sh` git rm.
- daily-note는 자체 notify_discord.sh가 없다(morning-brief 것을 참조했음). 참조가 SKILL/wrapper에 남지 않도록 `_shared/lib/notify_discord.ts`로 정리.
- `collect_daily_note_inputs.py` + `sanitize_fos_study_markdown.py`는 **유지**.

### 5. SKILL.md 파일·의존성 표 갱신

track_task / extract / cross-skill notify 참조 제거, run_with_claude.sh + notify_discord.ts 반영. fos-study 발행 + sanitize 유지 표기.

---

## Write 위장 방어 (6-6) + references audit (6-7)

SKILL.md 실제 Write 필수. blog-note-prompt.md 흡수 후 폐기.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `.../daily-stock-analysis-note/SKILL.md` | native 재작성 (fos-study 발행 유지) |
| `.../daily-stock-analysis-note/references/blog-note-prompt.md` | 흡수 후 git rm |
| `scripts/daily-stock-analysis-note/run_with_claude.sh` | 신규 |
| `scripts/daily-stock-analysis-note/run_daily_note.sh` | git rm |

## 커밋 (검증 통과 후)

```bash
cd "$(git rev-parse --show-toplevel)"
chmod +x stock-investment/scripts/daily-stock-analysis-note/run_with_claude.sh
git add stock-investment/.claude/skills/daily-stock-analysis-note/SKILL.md \
        stock-investment/scripts/daily-stock-analysis-note/run_with_claude.sh
git rm stock-investment/.claude/skills/daily-stock-analysis-note/references/blog-note-prompt.md \
       stock-investment/scripts/daily-stock-analysis-note/run_daily_note.sh
git commit -m "$(cat <<'EOF'
feat(stock-investment): plan006 phase-03 daily-stock-analysis-note native 전환

- SKILL.md native 재작성 (python3 수집 → Claude 직접 Write → fos-study 발행 유지), blog-note-prompt.md 흡수
- run_with_claude.sh thin wrapper 신규(TICKER/SKIP_PUSH 전달), run_daily_note.sh 폐기
- Discord 알림 _shared/lib/notify_discord.ts 통합 (ADR-002)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

## 검증

```bash
cd "$(git rev-parse --show-toplevel)"
SK=stock-investment/.claude/skills/daily-stock-analysis-note/SKILL.md
WRAP=stock-investment/scripts/daily-stock-analysis-note/run_with_claude.sh
D=stock-investment/scripts/daily-stock-analysis-note

bash -n "$WRAP" && echo "[bash -n] OK" || { echo "PHASE_FAILED: wrapper 문법"; exit 1; }
[ ! -f "$D/run_daily_note.sh" ] && echo "[run_daily_note.sh] 폐기 OK" || { echo "PHASE_FAILED: 잔존"; exit 1; }
[ ! -f stock-investment/.claude/skills/daily-stock-analysis-note/references/blog-note-prompt.md ] && echo "[blog-note-prompt.md] 폐기 OK" || { echo "PHASE_FAILED: 잔존"; exit 1; }
# 수집기·sanitize 유지 확인
[ -f "$D/collect_daily_note_inputs.py" ] && [ -f "$D/sanitize_fos_study_markdown.py" ] && echo "[Python 헬퍼 유지] OK" || { echo "PHASE_FAILED: Python 헬퍼 소실"; exit 1; }
# fos-study 발행 지침 SKILL.md 유지
grep -q "fos-study" "$SK" && echo "[fos-study 발행 지침] OK" || { echo "PHASE_FAILED: fos-study 발행 지침 누락"; exit 1; }
grep -q 'claude.*-p.*"/daily-stock-analysis-note"' "$WRAP" && echo "[native 호출] OK" || { echo "PHASE_FAILED: native 호출 누락"; exit 1; }
LEG=$(grep -cE "extract_claude_result|--output-format json|TRACK_TASK_WRAPPED|track_task\.sh" "$SK" "$WRAP")
echo "[옛 패턴 잔재] $LEG (기대 0)"
[ "$LEG" -eq 0 ] || { echo "PHASE_FAILED: 옛 패턴 잔재"; exit 1; }
echo "✅ 모든 검증 명령 실행 완료"
```

PHASE_FAILED 시 반드시 Bash 도구로 실행해 exit 1.

## 의도 메모 (왜)

- fos-study 발행 + sanitize는 native 전환과 무관하게 유지 — SKILL.md 워크플로에 명시.
- collect/sanitize Python 헬퍼 유지 (ADR-003: 결정론적 수집 재구현 안 함).
