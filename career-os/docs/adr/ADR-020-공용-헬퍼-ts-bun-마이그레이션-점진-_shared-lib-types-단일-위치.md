## ADR-020 — 공용 헬퍼 TS(Bun) 마이그레이션: 점진 + _shared/lib·types 단일 위치

- Status: Accepted
- Date: 2026-05-13

### 맥락
ai-nodes 자동화가 shell + Python 혼재로 자랐다. 사용자가 Python보다 TS를 읽기 쉬워하고, 공용 호출 패턴이 6+ runner에 흩어져 drift 위험이 있었다.

### 결정
- 런타임은 Bun 단일. TS 공용 코드는 _shared/lib/, 타입은 _shared/types/에. 워크스페이스별 TS 복제 금지.
- 마이그레이션은 점진적. 본 plan(004) 범위는 공용 헬퍼 3개(notify_discord.ts · invoke_claude_skills.ts · format_cost_summary.ts)만.
- 옛 헬퍼는 TS 등장 즉시 폐기. shim·thin wrapper 보존 금지. 부분 마이그레이션 금지.

### 결과
- 자주 쓰이는 호출 패턴(Claude CLI subprocess + usage + retry + Discord + cost summary)이 단일 TS 모듈로 일원화.
- 사용자가 읽기 어렵던 Python·shell 헬퍼 제거. 단점: node_modules 도입으로 루트 무게 증가.

### 적용
- 신규 TS 파일은 _shared/lib/ 또는 _shared/types/에.
- 새 runner는 invoke_claude_skills.ts만 사용, Claude CLI 직접 호출 금지.
- 다음 plan(extractor·renderer TS화)은 본 ADR 정책 따라 진행.
