# Phase 02. 공고 추천 저장소를 SQLite 로 옮긴다

**Execution profile**: standard

## 목표

Backend 의 positions 서비스와 저장소 규칙(공고 버전, 분석 재사용, 회사 평가와 임차, 제외 규칙, 추천)을 `career-store` 로 옮긴다. 함수의 입력과 출력은 지금 HTTP 요청·응답 본문과 같다.

**범위 외**: 실행기 호출부(phase 04). 판정 규칙의 값과 순서는 바꾸지 않는다.

## 컨텍스트

- 옮길 원본: `career-os/services/career-backend/src/positions/` 의 `positions.service.ts`, `repository/positions.repository.ts`, `positions.controller.ts`(경로와 본문 검증 스키마의 짝), `schema.ts`, `hash.ts`, `seoul-date.ts`, `stored.ts`, `tier-provenance.ts`, 그리고 `src/contracts/posting-candidate.ts`.
- Backend 코드는 이 단계에서 지우지 않는다. 그래서 스키마와 순수 함수는 옮기지 않고 복사한다. Backend 쪽 사본은 Backend 를 지우는 단계에서 함께 사라진다.
- 서비스의 판단 코드는 고치지 않고 가져온다. NestJS 장식과 Prisma 타입만 걷는다.
- 기준 버전은 문서 번호 대신 phase 01 의 `contextVersion("position-preferences", 본문)` 이다. 서비스는 「기준 버전을 돌려주는 함수」 를 생성자에서 받는다.

**요구사항**: REQ1, REQ3(설계 DECISION2, 3)

**근거 문서**: `career-os/docs/flow.md` 의 「커리어 Backend」, `career-os/docs/adr/ADR-117-포지션-분석은-우선순위-큐와-버전-이력으로-재사용한다.md`, `career-os/docs/adr/ADR-122-추천-상태는-질의-단위로-읽고-쓴다.md`

## 의도 메모

SQL 을 옮길 때 바꾸는 문법이다. 결과 순서가 달라지면 추천이 달라지므로 아래 대응을 그대로 쓴다.

| MySQL | SQLite |
| --- | --- |
| `ON DUPLICATE KEY UPDATE x = VALUES(x)` | `ON CONFLICT(<키>) DO UPDATE SET x = excluded.x` |
| `INSERT IGNORE` | `INSERT OR IGNORE` |
| `FOR UPDATE` | 뺀다(`BEGIN IMMEDIATE` 가 대신한다) |
| `LEFT JOIN LATERAL (… ORDER BY … LIMIT 1) ON TRUE` | 같은 `ORDER BY … LIMIT 1` 의 상관 서브쿼리로 고른 id 에 `LEFT JOIN` |
| `FIELD(x, 'a', 'b')` | `CASE x WHEN 'a' THEN 1 WHEN 'b' THEN 2 … END` |
| `UPDATE a JOIN b` | `UPDATE a … WHERE <키> IN (SELECT …)` |
| `IF(cond, a, b)` | `CASE WHEN cond THEN a ELSE b END` |
| `IN (${Prisma.join(xs)})` | 자리표시자를 개수만큼 만든다 |

- `ASC` 정렬에서 NULL 이 앞에 오는 것은 두 DB 가 같다.
- 문자열 비교는 SQLite 기본인 바이트 단위다. MySQL 은 대소문자와 끝 공백을 무시했다(`utf8mb4_unicode_ci`). 유일 키로 쓰는 값은 이미 정규화돼 있어(`company_key` 는 소문자, id 는 UUID 와 hash) 결과가 같다. 정렬의 동점 처리에는 id 열이 마지막 기준이라 순서가 정해진다.
- 회사 근거의 「더 오래된 관측으로 덮지 않는다」 는 `excluded.observed_at >= observed_at` 비교로 옮긴다.

## 작업 항목

### 1. 스키마와 순수 함수 복사

`career-os/scripts/lib/career-store/positions/` 에 `schema.ts`, `hash.ts`, `seoul-date.ts`, `stored.ts`, `tier-provenance.ts`, `posting-candidate.ts` 를 둔다. 내용은 바꾸지 않고 import 경로만 맞춘다.

### 2. `career-os/scripts/lib/career-store/positions/repository.ts`

`PositionsRepository` 의 메서드를 같은 이름과 반환값으로 옮긴다. 잠금 메서드(`lockPolicy`, `lockExclusions`, `lockCollectionRun` 등)는 행을 읽기만 한다. `lockCollectionRun` 은 행이 없을 때 자리를 만드는 동작을 유지한다.

### 3. `career-os/scripts/lib/career-store/positions/service.ts`

`PositionsService` 를 옮긴다. `ApiError` 는 `CareerStoreError` 로, `requireContextVersion` 은 주입받은 함수 호출로 바꾼다.

### 4. `career-os/scripts/lib/career-store/positions/store.ts`

HTTP 경로 하나에 함수 하나인 `PositionStore`. controller 가 하던 본문 검증(스키마 위반은 `400 BAD_REQUEST`)과 쓰기 경로의 `runWithReceipt` 를 여기서 한다. 메서드 이름과 인자는 지금 `career-os/scripts/position-recommender/career-backend/client.ts` 의 `CareerBackendClient` 와 같게 해 호출부가 그대로 쓴다.

### 5. 테스트

- `career-os/scripts/lib/career-store/positions/legacy-contract.test.ts`: `career-os/services/career-backend/test/fixtures/legacy-contract/cases.json` 의 positions case 를 `PositionStore` 에 다시 돌려 응답 본문을 대조한다. 보정은 `career-os/services/career-backend/test/support/legacy-contract.ts` 의 규칙(정책의 기준 버전 칸 제거, 근거 id 채우기)을 옮긴다. 인증, health, 본문 크기, 없는 경로 case 는 HTTP 계층이 없어 대상이 아니고, 그 목록을 테스트에 적어 빠진 case 가 생기면 실패하게 한다. `given` 의 SQL 세 문장은 SQLite 문장으로 바꿔 실행한다. DB 행 대조는 하지 않는다(시각 열의 저장 꼴이 다르다).
- Backend 의 `test/positions-company-evidence.e2e.test.ts`, `positions-exclusions.e2e.test.ts`, `positions-analysis-policy.e2e.test.ts` 가 보는 규칙을 `store.test.ts` 로 옮긴다: 회사 근거의 갱신과 오래된 관측, 유효기간, 끝난 실행 거부, 정책 조회와 변경, 제외 규칙의 만료, 그리고 규칙 목록을 통째로 바꾸는 동작. 인증, 헤더, 본문 크기 검사는 옮기지 않는다.
- `career-os/scripts/lib/career-store/positions/store.test.ts`: 두 번째 수집이 바뀌지 않은 공고를 큐에 넣지 않는다(분석 재사용). 본문이 바뀐 공고는 `changed` 로 다시 큐에 든다. 기준 버전이 바뀌면 다시 분석한다. 제외 회사(`exclude`)는 저장하지 않는다. 제외 규칙은 만료일 다음 날부터 빠진다. 임차가 끝난 회사 평가는 회수된다. 같은 분석 실행의 추천은 한 번만 만들어진다.

## 검증

```bash
bun test ./career-os/scripts/lib/career-store
bunx tsc --noEmit -p .
```

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/lib/career-store/positions/schema.ts` | 신규 (Backend 에서 복사) |
| `career-os/scripts/lib/career-store/positions/hash.ts` | 신규 (Backend 에서 복사) |
| `career-os/scripts/lib/career-store/positions/seoul-date.ts` | 신규 (Backend 에서 복사) |
| `career-os/scripts/lib/career-store/positions/stored.ts` | 신규 (Backend 에서 복사) |
| `career-os/scripts/lib/career-store/positions/tier-provenance.ts` | 신규 (Backend 에서 복사) |
| `career-os/scripts/lib/career-store/positions/posting-candidate.ts` | 신규 (Backend 에서 복사) |
| `career-os/scripts/lib/career-store/positions/repository.ts` | 신규 |
| `career-os/scripts/lib/career-store/positions/service.ts` | 신규 |
| `career-os/scripts/lib/career-store/positions/store.ts` | 신규 |
| `career-os/scripts/lib/career-store/positions/legacy-contract.test.ts` | 신규 |
| `career-os/scripts/lib/career-store/positions/store.test.ts` | 신규 |
