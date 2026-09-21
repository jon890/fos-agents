# Phase 01. 학습자료 schema와 역할별 인증

**Execution profile**: deep

> **이 계획은 보류 상태다. 지금 구현하지 않는다.**
> plan125가 Backend를 Node 22의 NestJS와 Prisma로 옮기고 있다.
> 학습자료 schema는 그 전환이 끝난 뒤에 얹어야 하므로, 이 계획은 그때 다시 세운다.
> 아래 내용은 그때 참고할 자료로 남긴다. 그대로 구현하면 옛 스택 기준으로 만들게 된다.

## 목표

기존 학습자료 관계와 제약을 `fos_career` migration으로 옮기고,
producer와 admin-gateway의 권한을 Backend에서 분리한다.

**범위 외**: `fos-blog` 코드 변경, 홈서버 배포와 운영 DB 적용은 다른 저장소 작업이 담당한다.

## 컨텍스트

`fos-blog`에는 source, cursor, material, 개인 상태, 추천과 게시 이력을 다루는 13개 table 설계가 있다.
초기 이전에서는 table과 column 의미를 유지해 기존 client와 관리자 화면의 계약을 바꾸지 않는다.
포지션 API와 공통 HTTP·DB 경계는 `services/recommendation-api/`에 이미 구현돼 있다.
`db/connection.ts`의 연결, `db/migrations.ts`의 migration runner,
`db/receipt-store.ts`의 멱등 처리와 `routes/positions.ts`의 인증 경계를 그대로 쓴다.

**근거 문서**: `docs/data-schema.md`의 「학습자료 API 연동 상태」와 「학습자료 HTTP 계약」,
`docs/code-architecture.md`의 「추천 상태 Backend」와 「아침 읽을거리」,
`docs/adr/ADR-118-추천-상태는-career-os-api와-mysql이-관리한다.md`

## Blocked 조건

- `services/recommendation-api/`의 공통 인증, DB 연결과 migration runner가 없으면 `PHASE_BLOCKED: Backend 기반 미구현`을 출력하고 종료한다.

## 의도 메모

- 기존 ID, unique key, version과 외래 키 의미를 유지한다.
- `owner_key`는 단일 사용자여도 유지해 상태와 추천 제어 key를 바꾸지 않는다.
- 브라우저 세션과 Better Auth는 Backend로 옮기지 않는다.
- producer와 admin-gateway token은 별도로 발급하며 로그와 응답에 남기지 않는다.

## 작업 항목

### 1. study schema migration 추가

`services/recommendation-api/migrations/`의 다음 순서에 13개 study table을 추가한다.

- `study_sources`
- `study_source_cursors`
- `study_materials`
- `study_material_sources`
- `study_material_tags`
- `study_material_states`
- `study_recommendation_control`
- `study_recommendation_runs`
- `study_recommendation_topics`
- `study_recommendation_items`
- `study_recommended_materials`
- `study_publications`
- `study_request_receipts`

기존 `fos-blog`의 PK, unique key, foreign key, version, JSON 제한과 삭제 규칙을 그대로 옮긴다.
migration은 기존 position migration 뒤에 적용하며 이미 적용된 파일을 수정하지 않는다.

### 2. 역할별 token 설정과 권한 검사 추가

`config.ts`에 producer와 admin-gateway token을 별도 환경값으로 추가한다.
요청 인증 결과는 `producer` 또는 `admin-gateway` 역할 하나를 반환하고 route가 허용 역할을 선언한다.

producer는 source, cursor, ingestion, candidate, recommendation 저장과 publication만 사용한다.
admin-gateway는 자료 조회와 상태 변경, 추천 조회, import dry-run과 commit만 사용한다.
허용하지 않은 역할은 `403`으로 거부한다.

### 3. study repository 경계 추가

`services/recommendation-api/study/repository.ts`를 source, material, recommendation과 import repository로 나눈다.
repository는 HTTP DTO를 직접 받지 않고 검증된 도메인 값을 받는다.
자료와 cursor 저장, 추천 전체 저장과 import commit은 각각 하나의 transaction에서 끝낸다.

deadlock과 lock wait timeout은 제한된 횟수만 같은 transaction callback으로 재시도한다.
멱등 영수증이 있으면 DB mutation을 다시 실행하지 않고 저장된 응답을 반환한다.

### 4. schema와 권한 회귀 테스트

13개 table과 제약, migration checksum, 역할별 허용·거절 표를 테스트한다.
token, 메모, import 본문과 DB URL이 오류와 로그에 없는지 검사한다.
transaction 실패 때 material만 저장되고 cursor가 진행되는 부분 반영이 없는지 확인한다.

## 검증

```bash
# cwd: 저장소 루트
bun test career-os/services/recommendation-api/study career-os/services/recommendation-api/migrations
bunx tsc --noEmit
git diff --check
```

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `services/recommendation-api/config.ts` | 역할별 token 추가 |
| `services/recommendation-api/http/auth.ts` | 역할 판정 추가 |
| `services/recommendation-api/migrations/*.sql` | study schema migration 신규 |
| `services/recommendation-api/study/repository*.ts` | 신규 |
| `services/recommendation-api/study/*.test.ts` | 신규 |
