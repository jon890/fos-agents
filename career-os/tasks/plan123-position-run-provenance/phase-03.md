# Phase 03. client 반영과 감사 조회 확인

**Execution profile**: standard

## 목표

바뀐 계약을 client 스크립트와 스킬에 반영하고,
여섯 감사 질문을 실제 MySQL에서 SQL 하나씩으로 답할 수 있는지 확인한다.

**범위 외**: 홈서버 database 생성, container 배포, cron 등록과 `fos-home-infra` 수정은 하지 않는다.
추천 JSON과 HTML의 항목별 표시 변경도 하지 않는다.

## 컨텍스트

`career-os/scripts/position-recommender/`의 client는
`services/recommendation-api/position/schema.ts`를 직접 import한다.
producer와 consumer가 같은 모듈을 쓰므로 버전 사이 호환을 맞출 필요는 없지만,
`schemaVersion`을 담아 보내는 자리와 디스크에 남는 파일은 함께 고쳐야 한다.

Phase 02를 끝낸 시점에는 다음이 어긋나 있다.

| 파일 | 어긋난 것 |
| --- | --- |
| `prepare_position_analysis.ts` | `schemaVersion: 1`로 수집 실행을 보낸다 |
| `commit_position_analysis.ts` | `schemaVersion: 1`로 결과를 보내고 실패를 보낼 방법이 없다 |
| `recommendation-api/client.ts` | 결과 응답을 인라인 zod 객체로 검증한다 |

`commit_position_analysis.ts`에는 별도 결함이 하나 더 있다.
멱등 키를 `analysis-results:${analysisRunId}`로 고정하므로
실패한 공고를 고쳐 다른 본문으로 다시 보내면 `IDEMPOTENCY_CONFLICT`가 나고 재시도 자체가 막힌다.
재시도를 계약에 넣는 이번 변경에서 이 키를 함께 고쳐야 한다.

**근거 문서**: `docs/flow.md`의 「포지션 추천」,
`docs/code-architecture.md`의 「추천 상태 Backend」와 「공고 추천」,
`docs/data-schema.md`의 「공고별 분석 이력」

## 의도 메모

- 멱등 키에 본문 hash를 넣는다. 같은 본문 재전송은 저장된 응답을 받고 다른 본문은 새 제출이 된다.
  회차 번호를 쓰는 안은 기각했다. client가 회차를 잃어버리면 같은 제출이 두 번 반영된다.
- 스킬은 실패를 숨기지 않는다. 분석하지 못한 공고를 최종 답변에 건수와 함께 남긴다.
- 감사 조회는 애플리케이션 코드를 거치지 않고 SQL만으로 답할 수 있어야 한다.
  Backend가 죽은 뒤에도 답할 수 있어야 감사로서 뜻이 있다.

## 작업 항목

### 1. `recommendation-api/client.ts` 응답 검증 교체

`saveAnalysisResults`의 인라인 zod 객체를 `analysisResultsResponseSchema`로 바꾼다.
반환 타입도 그 스키마에서 파생한 타입으로 바꾼다.

### 2. `prepare_position_analysis.ts` 요청 버전 변경

수집 실행 요청의 `schemaVersion`을 2로 올린다.
stdout JSON은 `...queue.summary`를 그대로 펼치므로
`completedCount`와 `failedCount`가 자동으로 포함된다. 별도 수정은 필요하지 않다.

### 3. `commit_position_analysis.ts` 실패 전달과 멱등 키 수정

모델 갱신 파일의 계약을 아래로 바꾼다.

```ts
const updatesSchema = z
  .object({
    schemaVersion: z.literal(2),
    collectionRunId: z.string().min(1),
    analysisRunId: z.string().min(1),
    results: z.array(analysisUpdateSchema).default([]),
    failures: z.array(analysisFailureSchema).default([]),
  })
  .strict();
```

제출 전에 큐와 대조한다.
큐 항목 중 `resultStatus`가 `pending` 또는 `failed`인 것의 `positionId` 집합과
`results`와 `failures`의 합집합이 같아야 한다.
다르면 Backend에 보내기 전에 어느 공고가 남았는지 적은 오류로 끝낸다.
`results`와 `failures`에 같은 `positionId`가 함께 있으면 그것도 오류로 끝낸다.

멱등 키를 본문에 묶는다.

```ts
const body = {
  schemaVersion: 2,
  collectionRunId: queue.collectionRunId,
  results: updates.results,
  failures: updates.failures,
};
const key = `analysis-results:${queue.analysisRunId}:${canonicalRequestHash(body).slice(7, 23)}`;
```

`canonicalRequestHash`는 `services/recommendation-api/http/idempotency.ts`가 이미 내보내고 있다.
`slice(7, 23)`은 `sha256:` 접두사를 뺀 앞 16자를 쓴다는 뜻이다.
멱등 키 열은 `VARCHAR(200)`이므로 길이에 여유가 있다.

stdout JSON은 Backend 응답을 그대로 펼친다.
`status`, `createdCount`, `reusedCount`, `failedCount`, `remainingCount`와 `applied`가 들어간다.

### 4. `position-recommender` 스킬 문구 수정

`.claude/skills/position-recommender/SKILL.md`를 `skill-creator` 절차로 고친다.
「선택된 공고 분석」 절에서 다음을 바꾼다.

- 「큐의 모든 `positionId`를 한 번씩 담은 `analysis-updates.json`을 만들고 반영한다」를
  「큐에서 `resultStatus`가 `pending` 또는 `failed`인 모든 `positionId`를 한 번씩 담는다.
  분석한 공고는 `results`에, 판단할 내용이 없거나 모델 호출이 실패한 공고는 사유와 함께 `failures`에 넣는다」로 바꾼다.
- 「반영 충돌이나 누락 분석은 고쳐서 같은 멱등 요청으로 다시 시도한다」를
  「반영 결과의 `status`가 `partial`이면 남은 공고만 다시 담아 같은 명령을 다시 실행한다.
  멱등 키는 명령이 본문에서 만들므로 손으로 정하지 않는다」로 바꾼다.

「추천 최종화」 절과 최종 답변 안내에
분석하지 못한 공고 건수를 실행 결과에 포함한다는 문장을 더한다.
실패 사유 원문과 모델 응답 전문은 공개 HTML에 넣지 않는다.

### 5. 감사 조회 확인

아래 여섯 조회가 각각 한 문장으로 답을 낸다는 것을 확인한다.
`docs/data-schema.md`의 「공고별 분석 이력」에 1번, 2번, 5번 조회를 예시로 남긴다.
나머지 셋은 같은 table을 쓰므로 문서에 복제하지 않는다.

**1. 실행이 선택한 공고**

```sql
SELECT i.selection_order, p.company_name, p.title, i.analysis_status, i.selection_reason
FROM position_analysis_run_items i
JOIN positions p ON p.position_id = i.position_id
WHERE i.analysis_run_id = ?
ORDER BY i.selection_order;
```

**2. 공고별 처리 결과**

```sql
SELECT p.title, i.result_status, i.failure_code, i.attempt_count, i.completed_at
FROM position_analysis_run_items i
JOIN positions p ON p.position_id = i.position_id
WHERE i.analysis_run_id = ?
ORDER BY i.selection_order;
```

**3. 실행 항목에 연결된 분석**

```sql
SELECT i.position_id, i.result_status, i.analysis_id, a.analyzed_at, a.valid_until
FROM position_analysis_run_items i
LEFT JOIN position_analyses a ON a.analysis_id = i.analysis_id
WHERE i.analysis_run_id = ?
ORDER BY i.selection_order;
```

**4. 분석을 최초 생성한 실행**

```sql
SELECT a.analysis_id, a.analyzed_at, a.created_by_analysis_run_id, r.collection_run_id
FROM position_analyses a
LEFT JOIN position_analysis_runs r ON r.analysis_run_id = a.created_by_analysis_run_id
WHERE a.position_id = ?
ORDER BY a.analyzed_at;
```

**5. 추천 실행이 재사용한 분석**

```sql
SELECT ri.rank_number, p.title, ri.analysis_id,
       CASE WHEN a.created_by_analysis_run_id = rr.analysis_run_id
            THEN 'created' ELSE 'reused' END AS origin
FROM position_recommendation_items ri
JOIN position_recommendation_runs rr
  ON rr.recommendation_run_id = ri.recommendation_run_id
JOIN position_analyses a ON a.analysis_id = ri.analysis_id
JOIN positions p ON p.position_id = ri.position_id
WHERE ri.recommendation_run_id = ?
ORDER BY ri.rank_number;
```

**6. 실패 후 재시도**

```sql
SELECT p.title, i.result_status, i.failure_code, i.attempt_count, i.completed_at, r.status
FROM position_analysis_run_items i
JOIN position_analysis_runs r ON r.analysis_run_id = i.analysis_run_id
JOIN positions p ON p.position_id = i.position_id
WHERE i.analysis_run_id = ? AND i.attempt_count > 1
ORDER BY i.selection_order;
```

정합성 조회 하나를 함께 확인한다. 결과가 0행이어야 한다.

```sql
SELECT i.analysis_run_id, i.position_id
FROM position_analysis_run_items i
JOIN position_analyses a ON a.analysis_id = i.analysis_id
WHERE i.result_status = 'created'
  AND a.created_by_analysis_run_id <> i.analysis_run_id;
```

### 6. 실제 MySQL 통합 테스트 추가

`db/mysql.integration.test.ts`를 넓혀
`CAREER_RECOMMENDATION_TEST_DATABASE_URL`이 있을 때만 도는 검사를 더한다.
없으면 지금처럼 건너뛰고 사유를 출력한다.

- `applyMigrations`로 빈 database에 `001_position_schema`를 적용한다.
- `SqlPositionRepository`와 `PositionService`로 수집, 결과 반영, 실패 보고,
  재제출과 추천 생성을 순서대로 실행한다.
- 작업 항목 5의 조회 1번부터 6번과 정합성 조회를 실행하고 기대한 행 수를 확인한다.

이 테스트가 `persist`의 기록 순서를 확인하는 유일한 자리다.
메모리 fake는 foreign key를 모르므로 순서가 틀려도 통과한다.
Phase 01에서 순서를 고쳤더라도 여기서 한 번 더 확인한다.

### 7. 배포 선행 조건 정리

`docs/code-architecture.md`의 「추천 상태 Backend」에 아래를 문장으로 남긴다.
홈서버 인프라 저장소가 읽을 값이며 이 저장소에서 실행하지 않는다.

| 조건 | 내용 |
| --- | --- |
| 초기 schema | 운영 database에는 `001_position_schema`를 한 번만 적용한다. 그 뒤에는 초기 파일을 고치지 않고 `002_*.sql`을 추가한다 |
| 인스턴스 수 | Backend는 하나만 띄운다. 상태 전체를 메모리에 들고 기록하므로 둘 이상이면 서로의 기록을 덮는다 |
| 적용 확인 | `migrate.ts up` 실행 뒤 `GET /health/ready`가 200인지 확인한다 |
| 정책 초기화 | `PUT /api/positions/v1/analysis-policy`로 분석 정책을 한 번 넣는다. 넣기 전에는 수집 요청이 409를 반환한다 |
| cron 연결 | 스킬 실행 cron 등록은 홈서버 인프라 저장소가 담당하며 이 plan에서 하지 않는다 |

### 8. 이 phase를 검증하는 테스트

`recommendation-api/client.test.ts`에 결과 응답이 새 계약으로 파싱되는지 확인하는 항목을 더한다.

`position_analysis_pipeline.test.ts`에 다음을 더한다.

- 실패 한 건을 포함해 제출하면 명령이 성공하고 stdout의 `status`가 `partial`이다.
- 남은 한 건을 다시 제출하면 `status`가 `completed`가 되고 두 번의 멱등 키가 다르다.
- 큐에 남은 공고를 빠뜨리면 Backend를 부르기 전에 오류로 끝난다.

`commit_position_analysis` 관련 테스트에서 `schemaVersion: 1` 고정 값을 모두 2로 바꾼다.

## 검증

```bash
# cwd: 저장소 루트
bun test career-os/services/recommendation-api career-os/scripts/position-recommender
bunx tsc --noEmit
bun run format:position-recommender:check
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py career-os/.claude/skills/position-recommender
python3 ~/.claude/scripts/korean-style-check.py career-os/.claude/skills/position-recommender/SKILL.md career-os/docs/data-schema.md career-os/docs/code-architecture.md
python3 ~/.claude/scripts/check-readability.py career-os/.claude/skills/position-recommender/SKILL.md career-os/docs/data-schema.md career-os/docs/code-architecture.md
git diff --check
```

MySQL을 붙여 통합 테스트까지 확인한다.

```bash
# cwd: 저장소 루트, 로컬 개발 database에만 실행한다
CAREER_RECOMMENDATION_TEST_DATABASE_URL=mysql://<계정>:<비밀번호>@127.0.0.1:3306/fos_career_test \
  bun test career-os/services/recommendation-api/db/mysql.integration.test.ts
```

이 명령을 돌리지 못했으면 돌리지 못했다고 남긴다.
메모리 fake만으로는 foreign key 순서를 확인할 수 없으므로 통과로 취급하지 않는다.

모든 검증이 끝나면 `tasks/plan123-position-run-provenance/index.json`의
`status`를 `completed`로 바꾸고 `current_phase`를 3으로 둔다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `scripts/position-recommender/recommendation-api/client.ts` | 수정 |
| `scripts/position-recommender/recommendation-api/client.test.ts` | 수정 |
| `scripts/position-recommender/prepare_position_analysis.ts` | 수정 |
| `scripts/position-recommender/commit_position_analysis.ts` | 수정 |
| `scripts/position-recommender/position_analysis_pipeline.test.ts` | 수정 |
| `.claude/skills/position-recommender/SKILL.md` | 수정 |
| `services/recommendation-api/db/mysql.integration.test.ts` | 수정 |
| `docs/data-schema.md` | 수정 |
| `docs/code-architecture.md` | 수정 |
| `tasks/plan123-position-run-provenance/index.json` | 완료 상태 갱신 |
