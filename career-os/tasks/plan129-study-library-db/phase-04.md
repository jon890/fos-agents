# Phase 04. client 를 Backend 에 붙이고 파일모드를 지운다

**Execution profile**: deep

## 목표

`study-topic-recommender` 의 client 가 Phase 01 부터 03 의 Backend 만 쓰게 한다.
파일모드와 config 소스 동기화와 import preview 를 지우고,
사람이 소스와 기준 버전을 고치는 명령과 파일 원본을 옮기는 일회성 명령을 만든다.

이 phase 가 끝나면 `morning_reading_cli.ts` 가 파일에 이력을 읽거나 쓰지 않는다.

**범위 외**: skill 문서는 Phase 05 다. 운영 이관은 하지 않는다.

## 컨텍스트

지금 `scripts/study-topic-recommender/morning_reading_cli.ts` 의 `main` 은 `--library` 가 있으면
`runLibrary` 로, 없으면 파일모드로 간다.
파일모드는 `persistence/history.ts` 가 소유하는 `state/morning-study-history.json` 을 읽고 `--commit-history` 로 쓴다.
`runLibrary` 는 시작할 때 `study-library/source-sync.ts` 로 `config/external-reading-sources.ts` 를 API 에 밀어 넣는다.
`--import-preview` 는 `study-library/imports.ts` 를 쓴다.

client 의 환경값은 `study-library/client.ts` 가 `STUDY_LIBRARY_URL` 과 `STUDY_SERVICE_TOKEN` 으로 읽는다.
`STUDY_LIBRARY_URL` 은 HTTPS origin 만 받는다.
포지션 client 인 `scripts/position-recommender/recommendation-api/client.ts` 는
`CAREER_RECOMMENDATION_API_URL` 과 `CAREER_RECOMMENDATION_API_TOKEN` 과 `CAREER_RECOMMENDATION_API_TOKEN_FILE` 을 읽고
프로토콜을 제한하지 않는다. 홈서버 cron 은 container 내부망의 http 주소로 Backend 를 부른다.

**Backend 의 멱등 처리는 `Idempotency-Key` 헤더를 요구한다.** 지금 공부 client 는 그 헤더를 보내지 않고
본문의 `idempotencyKey` 에만 키를 담는다. 이대로면 모든 쓰기 요청이 거절된다.

파일 원본이다. 운영에서 옮기기 전에는 지우지 않는다.

| 원본 | 규모 |
| --- | --- |
| `config/external-reading-sources.ts` | 소스 목록. 활성 35개 |
| `state/morning-study-history.json` | 리포트 3건과 entry 15건. `reportId` 는 `morning-2026-09-04`, `morning-2026-09-09`, `morning-2026-09-10` |

`career-os/state/` 는 gitignore 라 워크트리에 없다. 옮기는 명령은 원본 경로를 인자로 받는다.

**근거 문서**: `docs/flow.md` 의 「study-topic-recommender」 절,
`docs/code-architecture.md` 의 「study-topic-recommender」 절,
`docs/data-schema.md` 의 「파일에서 옮기는 것」 절,
`docs/adr/ADR-126-읽을거리-소스-목록은-backend가-원본을-가진다.md`,
`docs/adr/ADR-127-공부-추천은-고르지-않은-후보의-판정을-재사용한다.md`

## 의도 메모

**환경값을 포지션 client 와 합친다.** 같은 Backend 를 두 이름으로 가리키지 않는다.
token 파일을 읽는 규칙도 같게 한다. 두 client 가 쓸 함수를 `scripts/lib/` 로 옮겨 함께 쓴다.

**모델이 고르지 않은 후보에 이유를 남긴다.**
선택 파일의 zod 계약인 `reading_contracts.ts` 에 `rejections` 를 더한다. `{ candidateId, reason }` 배열이다.
후보풀의 모든 후보를 덮을 필요는 없다. 이유 없이 빠진 후보는 판정이 없어 다음 날 다시 나온다.
`rejections` 의 `candidateId` 는 후보풀에 있어야 하고 선택한 것과 겹치면 안 된다.

**`--render-only` 는 남긴다.** 실행 디렉터리 안의 리포트를 다시 그리는 도구이고 저장소의 `state/` 를 읽지 않는다.

**이관은 기존 경로를 그대로 쓴다.** 새 import endpoint 를 만들지 않는다.
이력의 자료는 `study_materials` 에 없으므로 추천을 저장하기 전에 `POST /ingestions` 로 먼저 넣는다.
이때 소스의 현재 cursor 를 받아 그 값을 그대로 돌려보내 cursor 내용이 바뀌지 않게 한다.
자료의 `kind` 는 소스의 adapter 가 `youtube` 면 `feed-video`, 아니면 `feed-article` 이다.
`url` 은 `canonicalUrl`, `published` 는 빈 문자열, `publishedAt` 과 `excerpt` 는 `null`, `collectedAt` 은 entry 의 `recommendedAt` 이다.
이력에 없는 값은 지어내지 않는다.

## 작업 항목

### 1. 환경값과 URL 규칙을 포지션 client 와 합친다

`study-library/client.ts` 가 `CAREER_RECOMMENDATION_API_URL` 과 token 둘 중 하나를 읽는다.
`STUDY_LIBRARY_URL` 과 `STUDY_SERVICE_TOKEN` 을 지운다. `.env.example` 에서도 지운다.
URL 검증은 포지션 client 와 같게 한다. credentials 와 query 와 hash 는 계속 거부한다.

### 2. 쓰기 요청에 `Idempotency-Key` 헤더를 붙인다

본문에 `idempotencyKey` 가 있는 요청은 그 값을 헤더로도 보낸다.
`PUT /sources/{sourceKey}` 는 본문에 키가 없다.
`source:` 뒤에 `{sourceKey, payload}` 의 canonical JSON SHA-256 hex 를 붙여 만든다.

### 3. 파일모드와 동기화와 import preview 를 지운다

- `persistence/history.ts` 와 그 테스트
- `study-library/source-sync.ts`. 테스트 파일은 없다
- `study-library/imports.ts` 와 그 테스트
- `morning_reading_cli.ts` 의 `--library`, `--commit-history`, `--history-file`, `--import-preview`, `--pages-manifest` 와 파일모드 분기

`main` 은 하위 동작 플래그 하나를 요구한다. 없으면 쓸 수 있는 플래그를 적고 종료 코드 2 로 끝낸다.
`--library` 를 주면 사용법 오류로 끝내고 「이제 기본이다, 빼고 다시 실행한다」 를 적는다.

`morning_reading_cli.ts` 가 `config/external-reading-sources.ts` 를 import 하지 않게 한다.
켜진 소스는 `GET /sources` 에서 받는다.

### 4. 추천 저장에 기준 버전과 제외 판정을 싣는다

- `contracts.ts` 의 `studyLibraryCandidatePageSchema` 에 `candidateContextVersion` 을 더한다
- 후보 meta 파일에 `candidateContextVersion` 을 남긴다
- `reading_contracts.ts` 의 선택 계약에 `rejections` 를 더한다
- `study-library/recommendations.ts` 가 `candidateContextVersion` 과 `rejections` 를 본문에 담는다.
  `rejections` 의 `candidateId` 는 그대로 `contentKey` 다

### 5. `manage_reading_sources.ts` 를 편집 명령으로 바꾼다

하위 명령 다섯이다. 모두 API 를 부른다.

| 하위 명령 | 하는 일 |
| --- | --- |
| `list` | 소스 목록 |
| `add --key --title --category --adapter [--url] [--feed-url] --note` | 새 소스. `expectedVersion: 0` |
| `update --key [필드] --note` | 필드를 바꾼다 |
| `disable --key --note`, `enable --key --note` | 켜고 끈다 |

`add`, `update`, `disable`, `enable` 은 `--note` 를 요구한다. 무엇을 왜 바꿨는지 남기는 자리다.

### 6. `configure_study_recommendation.ts` 추가

`--candidate-context-version <값>` 을 받아 `PUT /recommendation-control` 을 부른다.
`scripts/position-recommender/configure_position_analysis_policy.ts` 와 같은 모양이다.

### 7. `import_study_state.ts` 추가

`--dry-run` 이 기본이고 `--commit` 을 줘야 보낸다.
`--sources-file <경로>` 기본값은 `config/external-reading-sources.ts`,
`--history-file <경로>` 는 필수다.

순서다.

1. 소스를 `GET /sources` 와 비교해 없는 것만 `PUT` 한다. `note` 는 「config 에서 이관」
2. 리포트를 `reportId` 오름차순으로 하나씩 처리한다
3. 그 리포트의 entry 를 소스별로 묶어 `POST /ingestions` 로 넣는다. 위 「의도 메모」 의 규칙을 따른다
4. 같은 리포트를 `POST /recommendation-runs` 로 저장한다.
   `studyTopicKey` 로 묶어 주제를 만들고 `title` 은 `studyTopic`, `careerQuestion` 은 `null` 이다.
   자료의 `summary` 와 `reason` 은 `null`, `careerValue` 는 entry 값이다. `rejections` 는 빈 배열이다

이미 있는 `reportId` 는 건너뛰고 그 사실을 출력한다. 다시 돌려도 안전해야 한다.
stdout 에는 소스 건수, 리포트 건수, 자료 건수, 건너뛴 건수만 낸다.

### 8. 이 phase 를 검증하는 테스트

있는 파일을 고친다.

- `study-library/client.test.ts`: 쓰기 요청에 `Idempotency-Key` 헤더가 붙는다. `http://` 내부 주소를 받는다
- `study-library/candidates.test.ts`: meta 파일에 `candidateContextVersion` 이 남는다
- `study-library/recommendations.test.ts`: 본문에 `candidateContextVersion` 과 `rejections` 가 들어간다

새로 만든다.

- `morning_reading_cli.test.ts`: `--library` 와 `--commit-history` 가 사용법 오류로 끝난다
- `reading_selection.test.ts`: `rejections` 가 후보풀 밖이거나 선택과 겹치면 거부된다
- `manage_reading_sources.test.ts`: `--note` 없는 `disable` 이 거부된다. API 는 stub 이다
- `import_study_state.test.ts`: 임시 디렉터리의 이력 파일로 `--dry-run` 집계가 리포트 3, 자료 15 로 나온다.
  YouTube 소스의 entry 가 `feed-video` 가 된다. 이미 있는 `reportId` 를 건너뛴다

## 검증

```bash
# cwd: 저장소 루트
export PATH="$HOME/.bun/bin:$PATH"
bun test career-os/scripts/study-topic-recommender
bunx tsc --noEmit
```

기대값이다.

- 둘 다 종료 코드 0
- 위 테스트가 모두 통과
- 출력에 `skipped` 가 없다

**지운 경로가 남아 있지 않은지 센다.**

```bash
# cwd: 저장소 루트
grep -rn "STUDY_LIBRARY_URL\|STUDY_SERVICE_TOKEN\|morning-study-history\|source-sync\|--commit-history\|--import-preview" \
  career-os/scripts career-os/.env.example || echo "남은 참조 없음"
```

`import_study_state.ts` 안에서 이력 파일 이름이 나오는 것만 허용한다. 그 명령이 원본을 읽는다.

**로컬 Backend 에 이관을 dry-run 으로 돌린다.**
Phase 01 의 container 에 Backend 를 띄운 뒤 원본을 가리킨다.

```bash
# cwd: 저장소 루트
export PATH="$HOME/.bun/bin:$PATH"
bun career-os/scripts/study-topic-recommender/import_study_state.ts --dry-run \
  --history-file <메인 checkout 의 career-os/state/morning-study-history.json>
```

리포트 3건과 자료 15건이 나와야 한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/study-topic-recommender/morning_reading_cli.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/client.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/contracts.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/candidates.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/recommendations.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/reading_contracts.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/reading_selection.ts` | 수정. `rejections` 검증 |
| `career-os/scripts/study-topic-recommender/manage_reading_sources.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/configure_study_recommendation.ts` | 신규 |
| `career-os/scripts/study-topic-recommender/import_study_state.ts` | 신규 |
| `career-os/scripts/study-topic-recommender/persistence/history.ts` | 삭제 |
| `career-os/scripts/study-topic-recommender/study-library/source-sync.ts` | 삭제 |
| `career-os/scripts/study-topic-recommender/study-library/imports.ts` | 삭제 |
| `career-os/scripts/lib/` | 신규. 두 client 가 함께 쓰는 환경값 해석 |
| `career-os/.env.example` | 수정 |
