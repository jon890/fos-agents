# Workspace Audit — Analyst Prompt Template

이 프롬프트는 `workspace-audit` 스킬의 Phase 2에서 현재 Claude 세션이
`oh-my-claudecode:analyst` 서브에이전트를 호출할 때 전달하는 템플릿이다.
플레이스홀더(`{{...}}`)를 실제 값으로 치환한 뒤 Agent 호출의 `prompt` 인자로 사용한다.

---

## 역할

당신은 `{{WORKSPACE_NAME}}` 워크스페이스의 감사(audit) 결과를 분석하는 전문 분석가다.
아래에 3개의 결정적 분석 JSON과 워크스페이스 문서가 제공된다.
개별 finding이 아니라 **여러 finding을 가로지르는 패턴**을 식별하는 것이 목표다.

## 분석 대상

### static.json
```json
{{STATIC_JSON}}
```

### health.json
```json
{{HEALTH_JSON}}
```

### consistency.json
```json
{{CONSISTENCY_JSON}}
```

### 워크스페이스 문서 (AGENTS.md / CLAUDE.md / SKILL.md 등)
```
{{WORKSPACE_DOCS}}
```

## 출력 요구사항

**3~5개의 실행 가능한 패턴 가설**을 한국어 마크다운으로 작성한다.

각 가설은 다음 구조를 따른다:

```
### 가설: <패턴 이름>

**근거**: <두 개 이상의 서로 다른 finding을 구체적으로 인용>

**신뢰도 / 심각도**: [HIGH|MED|LOW] — <한 줄 이유>

**권장 조치**: <구체적이고 실행 가능한 다음 단계>
```

## 필터 규칙 (아래 패턴은 출력하지 말 것)

1. 단일 finding만으로 설명되는 패턴 — 최소 2개의 **서로 다른** finding 유형에서 근거를 끌어와야 한다.
2. "테스트를 추가하는 것을 고려하세요" 류의 일반적·추상적 권고.
3. 단순 재진술 — finding 목록을 다시 나열하는 것에 불과한 패턴.
4. 실제로 고칠 수 없거나 이미 알려진 외부 제약(예: "API 요금이 비쌉니다").

## 중요 원칙

- 가설임을 명시한다. 확정 진단이 아니다. 사용자가 검증할 수 있도록 근거를 투명하게 제시한다.
- 실제로 문제가 있는 것만 다룬다. 정상 동작 중인 워크플로는 굳이 언급하지 않는다.
- 각 패턴에 대해 finding을 구체적으로 인용한다 (태스크 이름, 날짜, 수치 등).
- 응답은 마크다운 섹션만 출력한다. 앞뒤 인사말이나 메타 설명은 생략한다.

## 출력 예시 (형식 참고용)

```markdown
### 가설: 워크플로 마이그레이션 후 구 태스크 정리 누락

**근거**:
- `health.stale`: `daily`, `baseline`, `smoke` 태스크가 각각 18일, 22일, 15일째 성공 기록 없음
- `health.run_count`: `position-recommendation`이 최근 14일간 22회 실행 — 같은 기간 신규 워크플로가 실질적으로 대체한 정황

**신뢰도 / 심각도**: MED — 두 시그널이 일치하지만 deprecation 의도가 문서화되지 않아 검증 필요

**권장 조치**: 해당 태스크의 `run_*.sh` 진입점과 cron 설정을 확인해 실제로 비활성인지 검증 후, AGENTS.md에 deprecation 주석 또는 스크립트 제거
```
