# Phase 03. 이관 검증과 운영 전환 준비

**Execution profile**: standard

## 목표

기존 study 저장소가 비어 있거나 데이터가 있는 경우를 모두 검증하고,
다른 저장소가 안전하게 단일 writer를 전환할 수 있는 이관 명령과 증거를 제공한다.

**범위 외**: 운영 쓰기 중지, 실제 data import, 환경 변수 변경, 배포와 기존 table 제거는 각 운영 저장소 작업이 담당한다.

## 컨텍스트

조사한 두 DB 대상의 상태가 달랐다.
홈서버 `fos_blog_db`에서는 13개 table이 0행으로 확인됐고,
`fos-blog` worktree의 공유 환경이 가리킨 DB에서는 13개 table과 migration이 없었다.
따라서 전환 직전에 실제 대상 DB를 다시 확인하고 결과에 따라 빈 전환 또는 snapshot import를 선택해야 한다.

**근거 문서**: `docs/data-schema.md`의 「학습자료 API 연동 상태」,
`docs/adr/ADR-118-추천-상태는-career-os-api와-mysql이-관리한다.md`

## 의도 메모

- dual-write를 사용하지 않고 쓰기를 중지한 일관된 snapshot으로 단일 writer를 바꾼다.
- 비밀값과 개인 메모 원문을 검증 출력에 넣지 않는다.
- 빈 원본도 schema, 인증과 14개 API smoke test를 생략하지 않는다.
- 기존 table 제거는 7일 관찰과 backup 복구 검증 뒤 `fos-blog`가 forward migration으로 수행한다.

## 작업 항목

### 1. 이관 inspect와 import 명령 추가

`services/recommendation-api/study/migration/inspect.ts`는 13개 table 존재 여부,
행 수, 최대 ID, 외래 키 누락과 migration 상태를 JSON으로 출력한다.
DB URL과 row 본문은 출력하지 않는다.

`import.ts`는 정해진 부모·자식 순서로 ID와 version을 보존해 snapshot을 반영한다.
빈 snapshot은 성공적인 no-op으로 처리한다.
운영 DB에는 `--apply`를 명시하지 않으면 dry-run만 수행한다.

### 2. 원본과 대상 검증 명령 추가

`verify.ts`는 table별 행 수, PK와 unique key를 정렬한 hash,
외래 키 누락, 최대 ID 다음의 auto increment, cursor와 상태 version,
history version, latest run과 멱등 영수증을 비교한다.
불일치가 하나라도 있으면 종료 코드 1로 실패한다.

### 3. cutover smoke 명령 추가

producer token으로 source 조회, 빈 ingestion, 후보 조회, 빈 추천 실행과 publication을 검사한다.
admin-gateway token으로 자료 조회, 상태 version 충돌, 추천 조회와 import dry-run을 검사한다.
각 역할이 허용되지 않은 endpoint에서 `403`을 받는지도 확인한다.

smoke 데이터는 전용 식별자를 사용하고 성공 뒤 FK 역순으로 삭제한다.
삭제 실패는 성공으로 숨기지 않고 cleanup 필요 상태로 반환한다.

### 4. 이관과 계약 검증 테스트

table 없음, table은 있으나 0행, 관계가 있는 fixture, FK 누락과 hash 불일치를 테스트한다.
dry-run이 대상을 바꾸지 않고 같은 snapshot import가 멱등인지 확인한다.
stdout과 오류에 token, DB URL과 개인 메모가 없는지 검사한다.

모든 검증이 통과하면 `tasks/plan122-career-study-api/index.json`의 `status`를 `completed`,
`current_phase`를 `3`으로 변경한다.

## 검증

```bash
# cwd: 저장소 루트
bun test career-os/services/recommendation-api/study career-os/scripts/study-topic-recommender/study-library
bunx tsc --noEmit
python3 ~/.claude/scripts/korean-style-check.py career-os/docs/prd.md career-os/docs/flow.md career-os/docs/code-architecture.md career-os/docs/data-schema.md career-os/docs/adr/ADR-118-추천-상태는-career-os-api와-mysql이-관리한다.md career-os/tasks/plan122-career-study-api/phase-01.md career-os/tasks/plan122-career-study-api/phase-02.md career-os/tasks/plan122-career-study-api/phase-03.md
python3 ~/.claude/scripts/check-readability.py career-os/docs/prd.md career-os/docs/flow.md career-os/docs/code-architecture.md career-os/docs/data-schema.md career-os/docs/adr/ADR-118-추천-상태는-career-os-api와-mysql이-관리한다.md career-os/tasks/plan122-career-study-api/phase-01.md career-os/tasks/plan122-career-study-api/phase-02.md career-os/tasks/plan122-career-study-api/phase-03.md
git diff --check
```

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `services/recommendation-api/study/migration/inspect.ts` | 신규 |
| `services/recommendation-api/study/migration/import.ts` | 신규 |
| `services/recommendation-api/study/migration/verify.ts` | 신규 |
| `services/recommendation-api/study/migration/smoke.ts` | 신규 |
| `services/recommendation-api/study/migration/*.test.ts` | 신규 |
| `tasks/plan122-career-study-api/index.json` | 완료 상태 갱신 |
