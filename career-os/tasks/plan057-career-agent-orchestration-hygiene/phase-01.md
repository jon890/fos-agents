# Phase 01 — agent workspace 소유권 inventory

**Model**: sonnet
**Status**: completed

---

## 목표

career workspace와 main workspace 사이의 career-specific wrapper skill 소유권을 inventory하고 정리 방향을 문서화한다.

**범위 외**:

- skill 삭제 또는 이동.
- OpenClaw config 변경.
- session log/cache/token 읽기.
- commit/push.

---

## 관련 docs/files

실행 전 반드시 읽는다:

- `../AGENTS.md`
- `AGENTS.md`
- `TOOLS.md`
- `docs/code-architecture.md`
- `docs/adr.md`
- `~/.openclaw/workspace-career/AGENTS.md`가 있으면 공개 가능한 운영 규칙만 확인

---

## 작업 항목 (4)

1. career workspace가 소유해야 하는 career wrapper skills 목록을 만든다.
2. main workspace에 남아 있으면 혼선을 만드는 career-specific skills 후보를 적는다.
3. 삭제가 아니라 archive/migration decision이 필요한 항목을 구분한다.
4. `tasks/plan057-career-agent-orchestration-hygiene/ownership-inventory.md`에 소유권 원칙과 후속 작업을 작성한다.

---

## Intended File Scope

- `tasks/plan057-career-agent-orchestration-hygiene/ownership-inventory.md`

---

## 검증

```bash
test -f tasks/plan057-career-agent-orchestration-hygiene/ownership-inventory.md
rg -n "career workspace|main workspace|wrapper skill|career-specific|archive|migration" tasks/plan057-career-agent-orchestration-hygiene/ownership-inventory.md
git status --short tasks/plan057-career-agent-orchestration-hygiene
```

성공 기준:

- career workspace 소유 원칙이 명시된다.
- main workspace 잔여물은 삭제가 아니라 후보로만 적힌다.
- task 디렉터리 밖 파일은 수정되지 않는다.

---

## Blocked / Failed 조건

- main/career workspace 경계를 확인할 수 없으면 `echo "PHASE_BLOCKED: agent workspace boundary unclear" && exit 2`.
- private secret 또는 token 파일을 열어야만 판단 가능하면 `echo "PHASE_BLOCKED: secret-backed workspace inventory requires user approval" && exit 2`.
- task scope 밖 파일이 변경되면 `echo "PHASE_FAILED: unexpected file scope" && exit 1`.

---

## Self-check

- private path 세부 정보를 공개 docs처럼 길게 쓰지 않는다.
- session logs, cache, tokens는 열지 않는다.
- 소유권 원칙과 정리 후보를 분리한다.
- 즉시 삭제 명령을 제안하지 않는다.
