# Phase 03. 실제 지원 자료 재사용 검증

**Execution profile**: standard

## 목표

당근 부동산 백엔드 지원 자료로 검증 재사용 판정과 검색 품질을 측정하고 전체 지원 흐름의 회귀를 확인한다.

**범위 외**: 이력서 문구 변경, 새 모델 평가와 실제 지원서 제출은 수행하지 않는다.

## 컨텍스트

당근 부동산 백엔드 지원 자료는 `applications/daangn/backend-real-estate/`에 있으며 버전 3 근거 원장과 현재 제출 HTML이 있다.
이 phase는 같은 문서를 모델로 다시 감사하지 않고 코드가 판정한 재사용 범위를 측정한다.

**근거 문서**: `docs/prd.md`의 「지원 문서와 검증」, `docs/flow.md`의 「이력서 근거 감사와 개선」, `docs/data-schema.md`의 「state/verified-claims/」

## 의도 메모

- 토큰 절감 수치는 실제 모델 호출 비용으로 추정하지 않는다.
- 대신 전체 주장 수, 재사용 수, 다시 감사할 주장 수와 다시 읽을 근거 파일 수를 기계 출력으로 남긴다.
- 장부가 손상된 경우 성공으로 처리하지 않고 전체 감사 필요 상태를 반환한다.

## 작업 항목

### 1. 재사용 판정 실측

당근 지원 디렉터리에 `assess_claim_reuse.ts`를 실행해 `reuse_all`, 재사용 주장 95건, 다시 감사할 주장 0건을 확인한다.
판정 JSON을 `/tmp` 아래 실행별 디렉터리에 저장하고 사용자용 근거 수치만 결과 보고에 남긴다.

### 2. 근거 검색 실측

`Document Parser`, `OCR 오류`, `Spring Batch`를 각각 검색한다.
각 결과가 관련 주장과 실제 근거 경로, locator, `fresh` 또는 재확인 필요 상태를 포함하는지 확인한다.

### 3. 실패와 부분 변경 실측

시스템 임시 디렉터리에 복사한 fixture에서 근거 파일 하나를 바꿔 해당 주장만 다시 감사 대상으로 바뀌는지 확인한다.
상태 파일 누락, 잘못된 JSON과 버전 2 원장은 전체 감사 또는 명시적 오류로 끝나는지 확인한다.

### 4. 전체 회귀 검증

resume-preparer 전체 테스트, application-package-writer 관련 테스트, TypeScript 검사와 문서 검사를 실행한다.
스킬 두 개의 `quick_validate.py`, JSON 파싱과 `git diff --check`도 통과해야 한다.

## 검증

저장소 루트에서 다음 명령을 실행한다.

```bash
bun career-os/.claude/skills/resume-preparer/scripts/assess_claim_reuse.ts career-os/applications/daangn/backend-real-estate
bun career-os/.claude/skills/resume-preparer/scripts/search_verified_claims.ts "Document Parser"
bun career-os/.claude/skills/resume-preparer/scripts/search_verified_claims.ts "OCR 오류"
bun career-os/.claude/skills/resume-preparer/scripts/search_verified_claims.ts "Spring Batch"
bun test career-os/.claude/skills/resume-preparer/scripts/*.test.ts career-os/.claude/skills/resume-preparer/scripts/verified-claims/*.test.ts career-os/.claude/skills/application-package-writer/scripts/*.test.ts
bunx tsc --noEmit
python3 ~/.claude/scripts/korean-style-check.py career-os/AGENTS.md career-os/docs/prd.md career-os/docs/flow.md career-os/docs/code-architecture.md career-os/docs/data-schema.md career-os/docs/adr/ADR-116-검증한-주장은-근거-해시와-함께-state에서-재사용한다.md career-os/tasks/plan120-verified-claims-reuse/phase-01.md career-os/tasks/plan120-verified-claims-reuse/phase-02.md career-os/tasks/plan120-verified-claims-reuse/phase-03.md
python3 ~/.claude/scripts/check-readability.py career-os/AGENTS.md career-os/docs/prd.md career-os/docs/flow.md career-os/docs/code-architecture.md career-os/docs/data-schema.md career-os/docs/adr/ADR-116-검증한-주장은-근거-해시와-함께-state에서-재사용한다.md career-os/tasks/plan120-verified-claims-reuse/phase-01.md career-os/tasks/plan120-verified-claims-reuse/phase-02.md career-os/tasks/plan120-verified-claims-reuse/phase-03.md
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py career-os/.claude/skills/resume-preparer
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py career-os/.claude/skills/sync-profile
git diff --check
```

재사용 판정의 `totalClaims`, `reusableClaims`, `changedClaims`, `unregisteredClaims` 합계가 일치해야 한다.
전체 회귀 테스트 건수와 성공 여부를 결과 보고에 기록한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `applications/daangn/backend-real-estate/review/claim-ledger.json` | 검증 입력 |
| `state/verified-claims/**/*` | 검증 입력 |
| `.claude/skills/resume-preparer/scripts/*.test.ts` | 검증 |
| `.claude/skills/application-package-writer/scripts/*.test.ts` | 검증 |
