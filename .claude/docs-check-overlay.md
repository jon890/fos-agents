# docs-check 오버레이 — fos-agents

공용 코어(`~/.claude/skills/docs-check`)에 fos-agents 특화를 주입한다.
코어가 뼈대, 아래 내용이 이 레포의 살점이다.

## scope 해석

scope 는 `career-os` / `fos-agents` / `all` 중 하나다.
scope 가 없으면 `all` 로 본다.
plan 완료 후 또는 새 ADR 추가 후에는 Quick Index sync 를 함께 확인한다.

## docs 구조와 문서 목록

| 범위 | ADR 저장 방식 | 5문서 |
|---|---|---|
| fos-agents 루트 | `docs/adr/ADR-NNN-slug.md` + `docs/adr/INDEX.md` | `docs/code-architecture.md` |
| 모든 워크스페이스 | `<workspace>/docs/adr/ADR-NNN-slug.md` + `<workspace>/docs/adr/INDEX.md` | `<workspace>/docs/{prd,data-schema,flow,code-architecture}.md` |

워크스페이스 범위가 지정되면 해당 경로의 `docs/`와 `AGENTS.md`, `README.md`를 검사한다.

## docs-verifier 전용 agent

career-os scope 는 `career-os-docs-verifier`(`.claude/agents/career-os-docs-verifier.md`)를 우선 쓴다 — 검증 항목·grep 명령의 단일 소스다.
fos-agents 루트 scope 는 전용 agent 가 없다 — 범용 read-only 에이전트(`verifier` 등)에 위임하거나 위임 불가 시 메인이 직접 6축을 점검한다.

## 코드 ↔ docs 부패 검사 (grep 명령)

### ADR Quick Index ↔ 본문 sync

```bash
# cwd: fos-agents root
# career-os: 개별 파일 + INDEX.md
BODY=$(grep -rhoE '^## ADR-[0-9]+' career-os/docs/adr/ 2>/dev/null | grep -oE 'ADR-[0-9]+' | sort -u)
INDEX=$(grep -oE 'ADR-[0-9]+' career-os/docs/adr/INDEX.md 2>/dev/null | sort -u)
diff <(echo "$BODY") <(echo "$INDEX") && echo "OK: career-os ADR Index synced"

# fos-agents root: 개별 파일 + INDEX.md
BODY=$(grep -rhoE '^## ADR-[0-9]+' docs/adr/ADR-*.md 2>/dev/null | grep -oE 'ADR-[0-9]+' | sort -u)
INDEX=$(grep -oE 'ADR-[0-9]+' docs/adr/INDEX.md 2>/dev/null | sort -u)
diff <(echo "$BODY") <(echo "$INDEX") && echo "OK: docs/adr Index synced"
```

### Config schema alignment (career-os 전용)

`career-os/config/*.json` 최상위 파일명이 `career-os/docs/data-schema.md` 에 문서화됐는지 확인한다.

```bash
# cwd: fos-agents root
for cfg in career-os/config/*.json; do
  name=$(basename "$cfg" .json)
  grep -q "$name" career-os/docs/data-schema.md \
    || echo "SCHEMA_MISSING: $cfg not documented in data-schema.md"
done
```

### Skill docs coverage (career-os 전용)

`career-os/.claude/skills/*/SKILL.md` 각 skill 이름이 career-os 5문서 중 하나에 언급되는지 확인한다.

```bash
# cwd: fos-agents root
for skill in career-os/.claude/skills/*/SKILL.md; do
  [ -f "$skill" ] || continue
  name=$(basename "$(dirname "$skill")")
  grep -q "$name" career-os/docs/prd.md career-os/docs/flow.md career-os/docs/code-architecture.md \
    || echo "SKILL_DOC_MISSING: $name not referenced in career-os docs"
done
```

## 폐기된 실행 지시문

```bash
# cwd: fos-agents root
grep -n "Output only valid JSON\|Do not output markdown\|claude --json-schema" <파일> \
  && echo "PROHIBITED: 폐기된 실행 지시문"
```
