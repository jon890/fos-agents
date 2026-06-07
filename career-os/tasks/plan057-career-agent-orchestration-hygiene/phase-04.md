# Phase 04 — backup allowlist와 검증

**Model**: haiku
**Status**: pending

---

## 목표

career agent workspace 파일 백업 선택지를 allowlist 기준으로 정리하고 plan057 전체를 검증한다.

**범위 외**:

- private repo 생성.
- backup 실행.
- tokens, cache, session logs 복사.
- commit/push.

---

## 관련 docs/files

실행 전 반드시 읽는다:

- `tasks/plan057-career-agent-orchestration-hygiene/ownership-inventory.md`
- `tasks/plan057-career-agent-orchestration-hygiene/hud-protocol.md`
- `tasks/plan057-career-agent-orchestration-hygiene/session-registry-flow.md`
- `AGENTS.md`
- `TOOLS.md`

---

## 작업 항목 (4)

1. backup 대상 allowlist 후보와 제외 대상을 정리한다.
2. 제외 대상에 session logs, cache, tokens, private secrets를 명시한다.
3. private repo 방식과 local archive 방식의 tradeoff를 적는다.
4. `tasks/plan057-career-agent-orchestration-hygiene/backup-allowlist.md`를 작성하고 plan057 검증을 실행한다.

---

## Intended File Scope

- `tasks/plan057-career-agent-orchestration-hygiene/backup-allowlist.md`

---

## 검증

```bash
python3 -m json.tool tasks/plan057-career-agent-orchestration-hygiene/index.json > /dev/null
find tasks/plan057-career-agent-orchestration-hygiene -maxdepth 1 -type f -name 'phase-*.md' | sort
rg -n "session_status|stale snapshot|backup|allowlist|session logs|cache|tokens|private secrets" tasks/plan057-career-agent-orchestration-hygiene
git status --short tasks/plan057-career-agent-orchestration-hygiene
```

성공 기준:

- plan057 phase 파일이 4개다.
- backup allowlist와 제외 대상이 명확하다.
- `session_status`와 `stale snapshot` 문구가 plan057 산출물에 존재한다.

---

## Blocked / Failed 조건

- 백업 범위가 secret 제외 없이 정의되면 `echo "PHASE_FAILED: backup allowlist missing secret exclusions" && exit 1`.
- private repo 생성이 필요해지면 `echo "PHASE_BLOCKED: backup repo creation needs user approval" && exit 2`.
- task scope 밖 파일이 변경되면 `echo "PHASE_FAILED: unexpected file scope" && exit 1`.

---

## Self-check

- 백업은 실행하지 않는다.
- allowlist는 구체적이되 비밀 경로를 노출하지 않는다.
- plan057 index status는 pending으로 둔다.
- 운영 절차와 구현 변경을 분리한다.
