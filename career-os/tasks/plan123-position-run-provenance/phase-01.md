# Phase 01. 실행 결과 원장과 분석 생성 출처 schema

**Execution profile**: deep

## 목표

분석 run이 고른 공고마다 처리 결과와 연결된 `analysis_id`를 저장하고,
분석마다 그것을 최초로 만든 run을 보존하는 schema와 저장 계층을 만든다.
이 phase가 끝나면 감사 질문 1번, 3번, 4번, 5번을 SQL로 답할 수 있다.
2번의 `failed`와 6번은 Phase 02가 채운다.

**범위 외**: 실패 보고와 재시도 계약, `partial` 상태 전이와 HTTP 계약 변경은 Phase 02가 담당한다.
client 스크립트와 배포 선행 조건은 Phase 03이 담당한다.
홈서버 database 생성, container 배포, cron 연결과 다른 저장소 수정은 이 plan 전체의 범위 밖이다.

## 컨텍스트

`services/recommendation-api/`는 포지션 수집, 분석과 추천 상태를 MySQL에 저장하는 Bun HTTP Backend다.
현재 `migrations/001_position_schema.sql`은 다음 세 table로 분석 실행을 기록한다.

| table | 지금 저장하는 것 |
| --- | --- |
| `position_analysis_runs` | 수집 실행, 후보자 기준 버전, 분석 계약 버전, `pending` 또는 `completed`, 생성 분석 수 |
| `position_analysis_run_items` | 선택한 공고, 그때의 공고 version, 선택 순서, 선택 시점 상태와 선택 이유 |
| `position_analyses` | 공고 version별 분석 결과, 유효기간과 점수 |

`position_analysis_run_items`는 무엇을 골랐는지만 남기고 그 공고가 어떻게 끝났는지는 남기지 않는다.
`position_analyses`는 어느 run이 그 분석을 처음 만들었는지를 가리키지 않는다.
그래서 아래 여섯 질문 중 셋만 지금 답할 수 있다.

| 번호 | 감사 질문 | 현재 | 답하는 경로 |
| --- | --- | --- | --- |
| 1 | run이 선택한 공고 | 답한다 | `position_analysis_run_items` |
| 2 | 공고별 처리 결과 | 답하지 못한다 | 저장하는 열이 없다 |
| 3 | 연결된 `analysis_id` | 답하지 못한다 | 저장하는 열이 없다 |
| 4 | 분석을 최초 생성한 run | 답하지 못한다 | 저장하는 열이 없다 |
| 5 | 추천 run이 재사용한 분석 | 절반만 답한다 | `position_recommendation_items.analysis_id`는 있으나 생성 run을 모른다 |
| 6 | 실패 후 재시도 | 답하지 못한다 | 실패라는 상태 자체가 없다 |

`services/recommendation-api/position/sql-repository.ts`는 시작할 때 전체 상태를 메모리로 읽고,
transaction마다 메모리 상태 전체를 다시 기록한다.
그래서 열을 추가하면 `load`와 `persist` 양쪽을 함께 고쳐야 하며,
`INSERT IGNORE`로 기록하는 행은 값이 바뀌어도 반영되지 않는다.

**근거 문서**: `docs/data-schema.md`의 「공고별 분석 이력」,
`docs/code-architecture.md`의 「추천 상태 Backend」,
`docs/adr/ADR-118-추천-상태는-career-os-api와-mysql이-관리한다.md`

## 의도 메모

### 결과 열과 생성 출처 열을 둘 다 둔다

`position_analysis_run_items`에만 결과를 두는 안과 `position_analyses`에만 생성 run을 두는 안을 모두 기각했다.

- `position_analysis_run_items`만 두면 4번을 파생으로 답해야 한다.
  그 행은 `position_analysis_runs`가 지워질 때 함께 지워지므로 분석보다 수명이 짧다.
  `docs/data-schema.md`는 실행을 지워도 분석은 보존한다고 이미 정해 뒀다.
  수명이 짧은 행에 오래 남아야 할 사실을 두면 실행을 지우는 순간 출처를 잃는다.
- `position_analyses`만 두면 2번과 6번을 답할 곳이 없다.
  실패한 공고는 분석 행을 만들지 않으므로 기록할 자리가 생기지 않는다.

그래서 run 관점 원장은 `position_analysis_run_items`에, 분석 관점 출처는 `position_analyses`에 둔다.
두 값은 서로 검증할 수 있다.
`result_status`가 `created`인 행이 가리키는 run과 그 분석의 `created_by_analysis_run_id`는 항상 같아야 한다.

### 배포 전이므로 초기 migration을 직접 수정한다

`001_position_schema.sql`은 `c9839a4` 한 커밋으로만 존재하고 그 커밋은 `career-token-diet` 브랜치에만 있다.
운영 database는 아직 만들지 않았고 생성과 배포는 홈서버 인프라 저장소가 소유한다.
따라서 이 schema를 적용한 database는 개발자 로컬뿐이다.

초기 파일을 직접 고치면 운영 database를 만들 때 읽을 schema 파일이 하나로 남는다.
대신 이미 001을 적용한 로컬 database는 checksum이 달라져 `applyMigrations`가 409로 거절한다.
그 database는 다시 만들어야 한다. 절차는 「검증」에 적는다.

배포한 뒤에 같은 종류의 변경이 필요하면 그때는 `002_*.sql`을 추가한다.
초기 파일 수정이 허용되는 경계는 운영 database 생성 전까지다.

### 그 밖에 확정한 것

- `attempt_count`는 제출 처리 횟수만 센다. 실패 사유의 전체 이력 table은 만들지 않는다.
  run 하나가 고르는 공고는 최대 20건이고 재시도는 드물다.
  사유별 이력이 필요해지면 그때 별도 table을 추가한다.
- `failure_code`는 짧은 식별자만 담는다. 모델 응답 원문과 외부 오류 전문은 저장하지 않는다.
- Backend 인스턴스를 둘 이상 띄우는 것은 지원하지 않는다.
  `SqlPositionRepository`가 전체 상태를 메모리에 들고 있어 인스턴스마다 다른 상태를 기록한다.
  이 전제는 Phase 03의 배포 선행 조건에 다시 적는다.

## 작업 항목

### 1. `migrations/001_position_schema.sql`의 table 순서 변경

`position_analyses`를 `position_analysis_run_items`보다 먼저 선언하도록 두 `CREATE TABLE` 문의 순서를 바꾼다.
`position_analysis_run_items`가 `position_analyses`를 참조하고,
`position_analyses`가 `position_analysis_runs`를 참조하므로 선언 순서는 아래여야 한다.

1. `position_analysis_runs`
2. `position_analyses`
3. `position_analysis_run_items`

순환 참조는 생기지 않는다.
문장 수는 15개 그대로 유지되며 `db/migrations.test.ts`의 `toHaveLength(15)`도 그대로 통과해야 한다.

### 2. `position_analysis_runs`에 부분 실패 상태 추가

`status` 열의 enum을 `ENUM('pending', 'partial', 'completed')`로 바꾼다.

| 값 | 뜻 |
| --- | --- |
| `pending` | 결과 제출을 아직 처리하지 않았다 |
| `partial` | 제출을 처리했으나 `failed`로 남은 항목이 있다 |
| `completed` | 선택한 모든 항목이 `created` 또는 `reused`다 |

`analyzed_now_count`의 뜻을 「이 run이 새로 만든 분석 수」로 고정한다.
추천 응답의 같은 이름 값과 뜻이 다르며 그 차이는 Phase 02가 문서에 적는다.

### 3. `position_analyses`에 최초 생성 run 추가

```sql
created_by_analysis_run_id CHAR(36) NULL,
```

제약을 함께 추가한다.

```sql
CONSTRAINT fk_position_analyses_created_run
  FOREIGN KEY (created_by_analysis_run_id)
  REFERENCES position_analysis_runs(analysis_run_id) ON DELETE RESTRICT,
```

`NULL`을 허용하는 이유는 Backend 밖에서 넣은 과거 행을 받아들이기 위해서가 아니라,
분석을 만든 경로가 run이 아닌 경우를 열어 두기 위해서다.
현재 Backend는 항상 run 안에서만 분석을 만들므로 실제로는 항상 값이 들어간다.

`ON DELETE RESTRICT`를 쓰므로 분석을 만든 실행은 삭제할 수 없다.
`docs/data-schema.md`의 삭제 규칙 문장을 이 제약에 맞춰 고친다. 작업 항목 7에서 함께 한다.

### 4. `position_analysis_run_items`에 결과 열 추가

기존 열 뒤에 다섯 열을 추가한다.

```sql
result_status ENUM('pending', 'created', 'reused', 'failed') NOT NULL DEFAULT 'pending',
analysis_id CHAR(36) NULL,
failure_code VARCHAR(64) NULL,
attempt_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
completed_at DATETIME(3) NULL,
```

키와 제약을 함께 추가한다.

```sql
KEY idx_position_analysis_items_analysis (analysis_id),
CONSTRAINT fk_position_analysis_items_analysis
  FOREIGN KEY (analysis_id) REFERENCES position_analyses(analysis_id) ON DELETE RESTRICT,
CONSTRAINT chk_position_analysis_item_result CHECK (
  (result_status = 'pending'
    AND analysis_id IS NULL AND completed_at IS NULL AND failure_code IS NULL)
  OR (result_status IN ('created', 'reused')
    AND analysis_id IS NOT NULL AND completed_at IS NOT NULL AND failure_code IS NULL)
  OR (result_status = 'failed'
    AND analysis_id IS NULL AND completed_at IS NOT NULL AND failure_code IS NOT NULL)
),
```

`CHECK` 제약은 이미 `position_analysis_policy`와 `company_preferences`가 쓰고 있으므로 새 전제를 만들지 않는다.
`attempt_count`는 `CHECK`에 넣지 않는다. 제출을 받지 않은 항목은 값이 올라가지 않는다.

### 5. `position/memory-repository.ts`의 실행 모델 통합

`StoredAnalysisRun`의 `selectedPositionIds`, `statusByPosition`, `selectionReasonByPosition`,
`companyTierByPosition` 네 필드를 항목 하나로 묶는다.
필드가 아홉 개로 늘어나는 것을 막고 항목마다 붙는 결과 값을 한곳에 둔다.

```ts
export type StoredAnalysisRunItem = {
  positionId: string;
  positionVersionId: string;
  selectionOrder: number;
  analysisStatus: "new" | "changed" | "stale";
  selectionReason: "priority" | "aging" | "overflow";
  companyTier: number;
  resultStatus: "pending" | "created" | "reused" | "failed";
  analysisId: string | null;
  failureCode: string | null;
  attemptCount: number;
  completedAt: string | null;
};

export type StoredAnalysisRun = {
  analysisRunId: string;
  collectionRunId: string;
  candidateContextVersion: string;
  analysisContractVersion: number;
  createdAt: string;
  completedAt: string | null;
  status: "pending" | "partial" | "completed";
  items: Map<string, StoredAnalysisRunItem>;
  analyzedNowCount: number;
};
```

`items`의 key는 `positionId`다. 선택 순서는 `selectionOrder`가 소유하며 Map의 삽입 순서에 의존하지 않는다.
`StoredAnalysis`에는 `createdByAnalysisRunId: string | null`을 추가한다.

`MemoryPositionRepository`는 `structuredClone`으로 상태를 복제하며 `Map`도 복제 대상이므로 추가 작업이 없다.

### 6. `position/sql-repository.ts`의 읽기와 기록 반영

`load`에서 다음을 반영한다.

- `position_analysis_run_items`를 `ORDER BY selection_order`로 읽어 `items` Map을 만든다.
- `position_analysis_runs.status`를 그대로 읽는다. `completed_at` 유무로 상태를 추정하지 않는다.
- `position_analyses.created_by_analysis_run_id`를 `StoredAnalysis`에 담는다.

`persist`에서 다음을 반영한다.

- **기록 순서를 바꾼다.** `position_analyses`가 `position_analysis_runs`를 참조하게 되므로
  분석을 쓰기 전에 실행 헤더 행이 있어야 한다. 현재 순서는 분석을 먼저 쓰므로 운영 database에서 FK 오류가 난다.
  순서를 아래로 고친다.

  1. `position_analysis_policy`와 `company_preferences`
  2. `position_sources`, `positions`, `position_versions`
  3. `position_collection_runs`, `position_source_run_diagnostics`, `position_collection_items`
  4. `position_analysis_runs` 헤더 행
  5. `position_analyses`
  6. `position_analysis_run_items`
  7. `position_recommendation_runs`, `position_recommendation_items`

  현재 코드는 공고 루프 안에서 분석까지 함께 기록하므로 분석 기록을 별도 루프로 분리해야 한다.
- `position_analyses`는 `INSERT IGNORE`를 유지하고 열 목록에 `created_by_analysis_run_id`를 더한다.
  최초 생성 run은 바뀌지 않으므로 갱신하지 않는 편이 맞다.
- `position_analysis_run_items`는 `INSERT IGNORE`를 버리고
  `ON DUPLICATE KEY UPDATE`로 `result_status`, `analysis_id`, `failure_code`,
  `attempt_count`, `completed_at`만 갱신한다.
  `selection_order`, `analysis_status`, `selection_reason`, `company_tier`는 갱신 대상에서 뺀다.
  `INSERT IGNORE`를 그대로 두면 결과 값이 절대 기록되지 않는다.

### 7. `position/service.ts`를 새 실행 모델에 맞춘다

이 phase에서는 동작을 바꾸지 않고 자료 구조만 옮긴다.
실패 보고와 `partial` 전이는 Phase 02가 넣는다.

- `saveCollection`이 선택 결과로 `items` Map을 만든다.
  각 항목의 `resultStatus`는 `"pending"`, `analysisId`와 `completedAt`과 `failureCode`는 `null`,
  `attemptCount`는 0, `selectionOrder`는 1부터 시작하는 선택 순서다.
  `status`는 선택이 0건이면 `"completed"`, 아니면 `"pending"`으로 둔다.
- `queueResponse`가 `run.selectedPositionIds` 대신
  `items`를 `selectionOrder`로 정렬해 후보 목록을 만든다.
  `statusByPosition`, `selectionReasonByPosition`, `companyTierByPosition` 참조도 항목 필드로 바꾼다.
- `saveAnalysisResults`는 선택 항목 전체가 한 번씩 와야 하는 기존 규칙을 그대로 둔다.
  결과를 반영하면서 항목마다 다음을 채운다.

  | 상황 | `resultStatus` | `analysisId` | `completedAt` |
  | --- | --- | --- | --- |
  | 같은 공고 version과 기준 버전의 분석이 없어 새로 만들었다 | `created` | 새 분석 ID | 처리 시각 |
  | 같은 조건의 분석이 이미 있어 그대로 쓴다 | `reused` | 기존 분석 ID | 처리 시각 |

  새로 만든 분석에는 `createdByAnalysisRunId`를 이 run의 ID로 넣는다.
  `analyzedNowCount`는 `created` 항목 수와 같아야 한다.
- `createRecommendation`의 선행 조건은 `run.completedAt`이 있는지를 그대로 쓴다.

### 8. 책임 문서 갱신

`docs/data-schema.md`의 「공고별 분석 이력」에서 다음을 고친다.

- `position_analysis_run_items` 행의 설명에 처리 결과, 연결한 분석과 제출 횟수를 더한다.
- `position_analyses` 행의 설명에 최초 생성 실행을 더한다.
- `position_analysis_runs` 행의 상태에 `partial`을 더한다.
- 「분석 실행을 삭제하면 선택 항목만 함께 삭제하며 이미 생성된 분석은 보존한다」 문장을
  「분석을 만든 실행은 삭제할 수 없다. 선택 항목만 지우는 삭제는 분석을 만들지 않은 실행에만 허용한다」로 바꾼다.

`docs/adr/`에 ADR을 추가한다.
번호는 파일 목록과 원격 브랜치를 함께 확인해 비어 있는 가장 작은 번호를 쓴다.
이 계획을 쓴 시점의 다음 번호는 `ADR-119`다.
제목은 「분석 실행의 처리 결과와 분석의 생성 출처를 분리해 저장한다」로 한다.
본문에는 「의도 메모」의 기각 근거와 두 열을 함께 두는 대가를 적는다.
`docs/adr/INDEX.md`에는 줄 하나만 덧붙인다. 다른 줄은 고치지 않는다.

계획 번호로 문서를 가리키지 않는다.

### 9. 이 phase를 검증하는 테스트

`db/migrations.test.ts`에 다음을 더한다.

- `position_analyses`의 `CREATE TABLE` 위치가 `position_analysis_run_items`보다 앞이다.
- `001_position_schema.sql`이 `created_by_analysis_run_id`, `result_status`,
  `attempt_count`, `chk_position_analysis_item_result`를 담는다.
- 문장 수는 15개 그대로다.

`position/sql-repository.test.ts`의 `databaseRows`에 새 열을 넣는다.

- `position_analysis_run_items` 행 두 개를 `result_status: "created"`와 `"reused"`로 만들고
  각각 `analysis_id`와 `completed_at`을 채운다.
- `position_analyses` 두 행에 `created_by_analysis_run_id`를 넣되
  하나는 이번 실행이고 하나는 다른 실행이 만든 것으로 둔다.
- `position_analysis_runs`에 `status: "completed"`를 넣는다.

복원 뒤 `repository.snapshot()`으로 다음을 확인한다.

- run의 `items`가 `selectionOrder` 순서로 두 항목을 담고 각 항목의 `resultStatus`와 `analysisId`가 행과 같다.
- 다른 실행이 만든 분석의 `createdByAnalysisRunId`가 그 실행 ID로 복원된다.
- 기존 테스트인 추천 응답 복원은 값이 달라지지 않는다.

`position/service.test.ts`에는 감사 질문 3번과 4번을 확인하는 항목을 더한다.

- 분석 결과를 반영한 뒤 run의 모든 항목이 `resultStatus: "created"`이고 `analysisId`가 채워진다.
- 같은 공고를 다음 수집 실행이 다시 고르지 않는지와 별개로,
  분석이 `fresh`가 아니어서 다시 선택된 경우 두 번째 run의 항목이 `reused`가 되고
  그 분석의 `createdByAnalysisRunId`는 첫 run의 ID로 남는다.

`persist`의 기록 순서는 현재 fake로는 확인할 수 없다.
fake가 FK를 모르기 때문이다. 실제 MySQL 확인은 Phase 03이 담당한다.
이 phase에서는 기록 순서를 확인하는 fake를 하나 추가한다.
실행한 SQL 문자열을 배열에 모으고 `INSERT INTO position_analysis_runs`가
`INSERT IGNORE INTO position_analyses`보다 먼저 나오고,
그것이 다시 `position_analysis_run_items` 기록보다 먼저 나오는지 검사한다.

## 검증

```bash
# cwd: 저장소 루트
bun test career-os/services/recommendation-api
bunx tsc --noEmit
python3 ~/.claude/scripts/korean-style-check.py career-os/docs/data-schema.md career-os/docs/adr/INDEX.md
python3 ~/.claude/scripts/check-readability.py career-os/docs/data-schema.md career-os/docs/adr/INDEX.md
git diff --check
```

새 ADR 파일도 위 두 검사에 경로를 더해 함께 실행한다.

이미 `001_position_schema`를 적용한 로컬 database가 있으면 checksum이 달라져
`applyMigrations`가 `VERSION_CONFLICT`로 거절한다.
그 database는 지우고 다시 만든다.

```bash
# cwd: 저장소 루트, 로컬 개발 database에만 실행한다
mysql -h 127.0.0.1 -u <계정> -p -e "DROP DATABASE IF EXISTS fos_career; CREATE DATABASE fos_career CHARACTER SET utf8mb4;"
CAREER_RECOMMENDATION_DATABASE_URL=mysql://<계정>:<비밀번호>@127.0.0.1:3306/fos_career \
CAREER_RECOMMENDATION_API_TOKEN=<32자 이상 개발용 token> \
  bun career-os/services/recommendation-api/migrate.ts up
```

`migrate.ts`는 `status` 또는 `up` 인자를 요구하며 없으면 종료 코드 2로 끝난다.
`loadConfig`가 database 설정과 API token을 함께 검증하므로 migration만 돌릴 때도 token 값이 필요하다.

운영 database에는 실행하지 않는다. 이 시점에는 아직 만들지 않았다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `services/recommendation-api/migrations/001_position_schema.sql` | 수정 |
| `services/recommendation-api/position/memory-repository.ts` | 수정 |
| `services/recommendation-api/position/sql-repository.ts` | 수정 |
| `services/recommendation-api/position/service.ts` | 수정 |
| `services/recommendation-api/position/sql-repository.test.ts` | 수정 |
| `services/recommendation-api/position/service.test.ts` | 수정 |
| `services/recommendation-api/db/migrations.test.ts` | 수정 |
| `docs/data-schema.md` | 수정 |
| `docs/adr/ADR-119-분석-실행의-처리-결과와-분석의-생성-출처를-분리해-저장한다.md` | 신규 |
| `docs/adr/INDEX.md` | 수정 |
