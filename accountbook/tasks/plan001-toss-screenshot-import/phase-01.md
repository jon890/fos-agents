# Phase 01: 거래 후보 스키마와 검증기 구현

**Execution profile**: standard

## 목표

vision agent가 만든 토스 거래 후보를 같은 입력에서 같은 결과로 검증하고 등록 가능 여부를 계산한다.

**범위 외**: accountbook API 호출과 agent skill 본문 작성은 뒤 phase의 책임이다.

## 작업 항목 (4)

### 1. 입력 이미지 검사

`accountbook/scripts/accountbook-screenshot-import/inspect_source.ts`에 PNG 형식, 크기, SHA-256과 생성 시각 검사를 구현하고 비식별 test를 추가한다.

### 2. 후보 계약

`accountbook/scripts/accountbook-screenshot-import/contracts.ts`에 `accountbook/docs/data-schema.md`와 일치하는 Zod 스키마와 TypeScript 타입을 구현한다.

### 3. 결정적 검증기

`accountbook/scripts/accountbook-screenshot-import/validate_candidates.ts`에 날짜 유효성, 행 번호 유일성, 금액 정규화, 일별 합계와 화면 요약 비교, batch·candidate ID 생성을 구현한다.

### 4. 회귀 테스트

`accountbook/scripts/accountbook-screenshot-import/validate_candidates.test.ts`에서 완전한 날짜, 합계 불일치, 잘린 날짜, 중복 행 번호와 낮은 신뢰도를 검증한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `accountbook/scripts/accountbook-screenshot-import/inspect_source.ts` | 신규 |
| `accountbook/scripts/accountbook-screenshot-import/inspect_source.test.ts` | 신규 |
| `accountbook/scripts/accountbook-screenshot-import/contracts.ts` | 신규 |
| `accountbook/scripts/accountbook-screenshot-import/validate_candidates.ts` | 신규 |
| `accountbook/scripts/accountbook-screenshot-import/validate_candidates.test.ts` | 신규 |

## 검증

보고 직전 반드시 다음 명령을 실행하고 원시 결과를 확인한다.

```bash
# cwd: fos-agents root
cd "$(git rev-parse --show-toplevel)"
pwd
bun test accountbook/scripts/accountbook-screenshot-import/validate_candidates.test.ts
bunx tsc --noEmit --strict --skipLibCheck --target ESNext --module ESNext --moduleResolution bundler --allowImportingTsExtensions --types bun-types accountbook/scripts/accountbook-screenshot-import/*.ts
```

## 의도 메모

- OCR 결과의 품질 판단과 외부 상태 변경을 분리한다.
- 화면별 추출기는 같은 후보 계약을 재사용할 수 있다.
