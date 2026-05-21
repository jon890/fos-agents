# skill-creator 4축 검토 리포트 — workspace-audit

**대상 파일**: `skills/workspace-audit/SKILL.md`, `skills/workspace-audit/references/analyst-prompt.md`
**검토 일자**: 2026-05-21
**검토 기준**: skill-creator 4축 (트리거 정확도 / 지시 완결성 / 산출물 명확성 / 강화 기회)
**검토자**: plan002 phase-01 실행 (oh-my-claudecode:executor)

---

## 축 1 — 트리거 정확도

### 개선 전 상태

frontmatter `description`이 영문이었다.
본문은 이미 한국어였지만, 트리거 매칭에 사용되는 description 필드가 영문이라 불일치가 있었다.

### 발견된 문제

- `description` 영문 → 한국어 트리거 구문 없음.
- 본문은 `/workspace-audit` 슬래시 호출을 명시하고 있어 트리거 자체는 명확했으나, 자연어 트리거(예: "워크스페이스 감사해줘", "dead 스크립트 찾아줘")가 description에 없었음.
- 타 skill(agent-browser)과 description 언어 불일치.

### 적용한 개선

description을 한국어로 전면 교체:

```
현재 Claude 세션이 ~/ai-nodes 워크스페이스를 대화형으로 감사한다.
고아 config·dead 스크립트·깨진 심링크·doc-코드 불일치·오래된 실행을 찾아내고,
analyst 서브에이전트로 교차 발견 패턴을 분석한 뒤 사용자와 대화로 결과를 정리한다.
`/workspace-audit`으로 호출.
```

---

## 축 2 — 지시 완결성

### 개선 전 상태

본문이 이미 한국어로 상세하게 작성되어 있었다.
워크플로 5단계, severity 규칙, finding 유형별 권장 행동 표 등 완결도가 높았다.

### 발견된 약점

- **제목 불일치**: `# Workspace Audit` (영문) vs. 본문 한국어 — 일관성 없음.
- **패턴 1 위반 (semantic line break)**: 두 문장이 같은 줄에 붙어있는 부분 다수.
  - 도입 단락 2문장 1줄.
  - 래핑 설명 1문장이 80자 초과.
- **패턴 5 위반 (긴 문장)**: 백틱 3개 이상 + 80자 초과 문장 존재.
  - `openclaw cron → connected model → claude --print 구조이기 때문에 track_task.sh 래핑이 필요하지만...` 줄이 기준 초과.
  - `이 스크립트는 LLM 호출 없이 ... 산출물을 /tmp/... 에 둔다 (세션 한정, 다음 실행 시 덮어씀). 워크스페이스 트리에...` 2문장 1줄.

### 적용한 개선

- `# Workspace Audit` → `# 워크스페이스 감사`
- 도입 단락 2문장 semantic line break 분리.
- 래핑 설명 긴 문장 → 2줄로 분리.
- `/tmp/` 설명 2문장 → 각 줄 분리.

---

## 축 3 — 산출물 명확성

### 개선 전 상태

산출물 위치가 명확히 문서화되어 있었다:

- `/tmp/workspace-audit-<workspace>/` — 세션 한정 stash
- `static.json`, `health.json`, `consistency.json`, `report.md` 목록 명시
- stash 파일은 워크스페이스 트리에 영구화하지 않는다는 정책 명시

### 평가

산출물 명확성은 기존부터 양호.
`references/analyst-prompt.md`도 이미 한국어로 완전히 작성되어 있었다.

---

## 축 4 — 강화 기회

plan002 phase-01 범위 안에서 적용 완료:

| 항목 | 적용 여부 | 비고 |
|---|---|---|
| frontmatter description 한국어화 | 완료 | |
| 제목 `# Workspace Audit` 한국어화 | 완료 | `# 워크스페이스 감사` |
| 도입 단락 semantic line break | 완료 | 패턴 1 적용 |
| 긴 문장 분리 | 완료 | 패턴 5 적용 |
| references/analyst-prompt.md | 변경 없음 | 이미 한국어로 완성됨 |

phase-01 범위 밖 강화 (후속 plan 권장):

- 감사 스크립트 실패 시 복구 절차 (audit_static.py / audit_health.py 오류 처리)
- `--all` 플래그 사용 시 워크스페이스별 순서 제어 방법 명세
- finding 유형 표에 `health.run_count` 항목 추가 (analyst-prompt.md 예시에는 있으나 SKILL.md 표에 없음)

---

## 검증

- `name: workspace-audit` — 영문 유지 ✓
- `description` — 한국어 ✓
- 본문 제목 — 한국어 (`# 워크스페이스 감사`) ✓
- 본문 prose — 기존 한국어 유지 ✓
- CLI 명령·path·도구명 — 영문 유지 ✓
- references/analyst-prompt.md — 기존 한국어 유지, 변경 없음 ✓
- docs-style.md 패턴 1 (semantic line break) — 적용 ✓
- docs-style.md 패턴 5 (긴 문장 분리) — 적용 ✓
- docs-style.md 패턴 8 (헤더 + 본문 구조) — 기존 구조 유지 ✓
