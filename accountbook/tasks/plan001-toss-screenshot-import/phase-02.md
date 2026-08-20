# Phase 02: 승인과 accountbook API 등록 구현

**Execution profile**: standard

## 목표

검증된 batch를 사용자 승인 상태로 전환하고 기존 accountbook API에 중복과 부분 성공을 통제하며 등록한다.

**범위 외**: accountbook 백엔드 변경, 새 인증 방식과 화면 OCR 구현은 포함하지 않는다.

## 작업 항목 (3)

### 1. 승인 helper

`accountbook/scripts/accountbook-screenshot-import/approve_import.ts`에 batch ID 일치, `submissionReady`, 승인 시각 확인 뒤 별도 approved JSON을 쓰는 CLI를 구현한다.

### 2. API client와 상태 복구

`accountbook/scripts/accountbook-screenshot-import/submit_import.ts`에 refresh token 갱신, 카테고리 조회, 기존 거래 사전 확인, 수입·지출 POST, 후보별 private 상태 저장과 batch lock을 구현한다.

### 3. API 회귀 테스트

`accountbook/scripts/accountbook-screenshot-import/submit_import.test.ts`에서 미승인 차단, endpoint와 payload, 기존 동일 거래 차단, 성공 상태 저장과 부분 성공 재실행을 검증한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `accountbook/scripts/accountbook-screenshot-import/approve_import.ts` | 신규 |
| `accountbook/scripts/accountbook-screenshot-import/submit_import.ts` | 신규 |
| `accountbook/scripts/accountbook-screenshot-import/submit_import.test.ts` | 신규 |

## 검증

보고 직전 반드시 다음 명령을 실행하고 원시 결과를 확인한다.

```bash
# cwd: fos-agents root
cd "$(git rev-parse --show-toplevel)"
pwd
bun test accountbook/scripts/accountbook-screenshot-import/submit_import.test.ts
bunx tsc --noEmit --strict --skipLibCheck --target ESNext --module ESNext --moduleResolution bundler --allowImportingTsExtensions --types bun-types accountbook/scripts/accountbook-screenshot-import/*.ts
```

## 의도 메모

- API의 idempotency key 부재를 private 후보 상태와 기존 거래 사전 확인으로 보완한다.
- 기존 동일 거래는 자동 중복으로 판정하지 않고 사용자 검토로 넘긴다.
