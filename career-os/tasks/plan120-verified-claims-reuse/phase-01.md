# Phase 01. 검증 완료 주장 저장과 검색

**Execution profile**: standard

## 목표

검증 완료 주장을 근거 파일별 JSON로 저장하고 필요한 주장과 근거만 검색할 수 있는 코드 경계를 만든다.

**범위 외**: 스킬 실행 순서 변경과 기존 비공개 파일 이전은 다음 phase가 담당한다.

## 컨텍스트

공고별 근거 원장은 `.claude/skills/resume-preparer/scripts/claim_ledger_schema.ts`의 `ClaimLedgerSchema`를 사용한다.
현재 HTML과 원장 검증은 같은 디렉터리의 `validate_claim_ledger.ts`가 담당한다.
검증 완료 주장 장부의 경로와 필드는 `docs/data-schema.md`의 「state/verified-claims/」 절을 따른다.

**근거 문서**: `docs/flow.md`의 「이력서 근거 감사와 개선」, `docs/code-architecture.md`의 「지원 패키지」, `docs/adr/ADR-116-검증한-주장은-근거-해시와-함께-state에서-재사용한다.md`

## 의도 메모

- 새 데이터베이스와 검색 의존성을 추가하지 않는다.
- 주장 키는 정규화한 `proposedText`의 SHA-256으로 만들고 파일과 배열 순서를 고정한다.
- HTTPS 실행 근거는 저장하되 자동 재사용하지 않는다.
- `sources/fos-study/`는 읽기 전용으로 유지한다.

## 작업 항목

### 1. `verified-claims/` 모듈 추가

`.claude/skills/resume-preparer/scripts/verified-claims/` 아래에 스키마, 키 생성, 근거 스냅샷, 저장, 검색과 재사용 판정을 책임별 TypeScript 모듈로 나눈다.
경로 해석은 저장소 루트 기준 상대 경로와 기존 환경 변수 자리표시자를 지원하고 절대 경로를 상태 파일에 쓰지 않는다.

### 2. 세 CLI 진입점 추가

`.claude/skills/resume-preparer/scripts/`에 `search_verified_claims.ts`, `assess_claim_reuse.ts`, `promote_verified_claims.ts`를 추가한다.
모든 CLI는 기존 `scripts/lib/cli.ts` 계약으로 JSON을 출력하고 사용법 오류와 검증 실패를 종료 코드 1로 반환한다.

`promote_verified_claims.ts`는 application 디렉터리의 `review/claim-ledger.json`과 `review/resume.html`을 기본값으로 사용한다.
버전 3 원장, 모든 주장 `safe`, 현재 HTML 문구 해시 일치가 모두 참일 때만 상태 파일을 원자적으로 갱신한다.

`assess_claim_reuse.ts`는 `mode`, 전체·재사용·변경·미등록 주장 수, 다시 읽을 근거 경로와 이유를 반환한다.
현재 원장이 HTML과 완전히 일치하면 `reuse_all`, 일부만 유효하면 `reuse_partial`, 사용할 장부가 없으면 `full_audit`를 반환한다.

`search_verified_claims.ts`는 검색어와 일치하는 주장 문구, 근거 설명, 경로, locator, 현재 근거 상태와 원본 application을 점수순으로 반환한다.

### 3. 검증 완료 주장 회귀 테스트

정상 반영과 검색, 같은 원장의 반복 반영에서 파일 무변경, 버전 2와 안전하지 않은 원장 거부, 근거 파일 변경 시 부분 재검증, URL 근거의 재확인 판정을 각각 테스트한다.
테스트는 `/tmp` 아래 실행별 디렉터리를 만들고 성공과 실패 모두에서 정리한다.

## 검증

저장소 루트에서 다음 명령을 실행한다.

```bash
bun test career-os/.claude/skills/resume-preparer/scripts/verified-claims/*.test.ts career-os/.claude/skills/resume-preparer/scripts/*verified_claims*.test.ts career-os/.claude/skills/resume-preparer/scripts/assess_claim_reuse.test.ts
bunx tsc --noEmit
git diff --check
```

정상 반영 뒤 같은 명령을 다시 실행했을 때 상태 파일 내용과 수정 시각이 바뀌지 않아야 한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `.claude/skills/resume-preparer/scripts/verified-claims/*.ts` | 신규 |
| `.claude/skills/resume-preparer/scripts/search_verified_claims.ts` | 신규 |
| `.claude/skills/resume-preparer/scripts/assess_claim_reuse.ts` | 신규 |
| `.claude/skills/resume-preparer/scripts/promote_verified_claims.ts` | 신규 |
| `.claude/skills/resume-preparer/scripts/*verified_claims*.test.ts` | 신규 |
| `.claude/skills/resume-preparer/scripts/assess_claim_reuse.test.ts` | 신규 |
