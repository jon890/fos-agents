# Phase 03. 파일을 옮기고 동기화를 없앤다

**Execution profile**: deep

## 목표

파일에 있는 회사 조사 8개와 개인 제외 규칙 1개를 DB로 옮기고,
스크립트가 파일 대신 API를 읽게 바꾸고,
`position-recommender` skill에서 비공개 작업본 동기화 두 단계를 지운다.

이 phase가 끝나면 `position-recommender`가 `state/`를 읽지도 쓰지도 않는다.

**범위 외**: 다른 skill의 `state/` 사용. `career-workspace` CLI 자체는 지우지 않는다.
`application-package-writer`와 `resume-preparer`와 `interview-practice`와
`study-topic-recommender`와 `sync-profile`이 계속 쓴다.

`career-workspace/cli.ts`의 `managedSkills`에서 `position-recommender`를 빼는 것도 범위 외다.
skill 문서가 더 이상 부르지 않으므로 그 등록은 쓰이지 않고 남지만, 지우면
이미 홈서버에 있는 그 skill의 작업본을 정리할 수단이 함께 없어진다.
원본 파일을 지울 때 함께 정한다.

## 컨텍스트

파일을 읽는 자리는 둘이다.

| 파일 | 지금 하는 일 |
| --- | --- |
| `scripts/position-recommender/company-research/store.ts` | `state/company-research/`의 `*.json`을 읽고 병합해 쓴다 |
| `scripts/position-recommender/feedback/exclusions.ts` | `state/private-config/position-exclusions.json`을 읽는다 |

`company_research.ts`는 `store.ts`의 병합을 부르는 진입점이다.
근거를 DB가 담으면 사람이 파일을 고쳐 병합할 이유가 없어지므로 이 진입점을 지운다.

Backend client는 `scripts/position-recommender/recommendation-api/client.ts`다.
새 경로 넷을 이 client에 더한다.

skill 문서에서 지울 절은 「실행 준비」의 `skill begin`과
「비공개 작업 반영과 결과 전달」의 `skill finish`다.

**근거 문서**: `docs/flow.md`의 「position-recommender」 절,
`docs/code-architecture.md`의 「position-recommender」 절,
`docs/adr/ADR-123-회사-근거와-개인-제외-정책은-backend가-소유한다.md`

## 의도 메모

**이관 명령을 한 번 쓰고 버리지 않는다.**
`import_position_state.ts`로 남긴다. 운영 DB와 로컬을 각각 옮겨야 하고,
옮긴 뒤 행 수를 대조해야 원본을 지울 수 있다.

**원본 파일을 이 phase에서 지우지 않는다.**
이 phase는 옮기는 명령을 만들기까지다.
실제 이관과 행 수 대조는 `state/`를 가진 홈서버 작업본에서 사용자가 돌린다.
이 워크트리에는 `.gitignore` 때문에 `state/`가 없다.
지우는 것은 그 대조가 끝난 뒤다. 지금 지우면 되돌릴 때 값을 잃는다.

**버전 1 형식의 제외 규칙을 버전 2로 올린다.**
`scope`가 없는 옛 규칙에 `scope: "posting"`을 붙인다.
`decisionKind`는 `manual`, `reason`은 「이관 전 규칙」로 둔다.

`evidenceUrls`를 빈 배열로 두지 않는다.
`scripts/position-recommender/feedback/exclusions.ts`의 `exclusionEvidenceSchema`가
`scope`와 무관하게 `evidenceUrls`를 하나 이상 요구해 왔고 Backend가 그 계약을 그대로 옮겼다.
빈 배열로 보내면 `400`으로 거절당한다.

버전 1 규칙이 `url`을 가졌으면 그것을 `evidenceUrls`의 한 건으로 쓴다.
`identityHash`만 있고 `url`이 없는 규칙은 근거로 쓸 URL이 원본에 없다.
지어내지 않고 그 건을 세어 집계에 내고, `--commit`은 아무것도 보내지 않고 종료 코드 1로 끝낸다.

`decidedAt`은 원본에 없고 날짜를 지어낼 수 없다.
`--decided-at YYYY-MM-DD`로 받는다. 버전 1 규칙이 있는데 이 인자가 없으면 종료 코드 1로 끝낸다.
버전 2 규칙만 있으면 이 인자는 필요 없다.

**회사 조사의 `facts`를 `company_evidence`로, `inferences`는 버린다.**
추론은 근거가 아니다. 버린 추론이 있었다는 사실을 이관 명령이 출력한다.
다음 판정이 남은 근거 위에서 추론을 다시 만든다.

## 작업 항목

### 1. `scripts/position-recommender/import_position_state.ts` 추가

`--dry-run`이 기본이고 `--commit`을 줘야 실제로 보낸다.

**`--source-dir`로 읽을 위치를 받는다.** 기본값은 저장소 루트의 `career-os/state`다.
`career-os/state/`는 `.gitignore`의 `**/state/*`에 걸려 워크트리에 없다.
홈서버에서 동기화한 작업본에만 있으므로, 경로를 고정하면 이 명령을 테스트할 수 없고
운영과 로컬을 각각 옮길 때도 손을 대야 한다.

읽는 것이다.

- `<source-dir>/company-research/*.json`의 `profile.facts`
- `<source-dir>/private-config/position-exclusions.json`의 `exclusions`

`<source-dir>`가 없으면 종료 코드 1로 중단하고 어느 경로를 찾았는지 낸다.

`CompanyResearchFact.source.sourceType`을 `company_evidence.source_type`으로 옮긴다.

| 파일의 값 | table의 값 |
| --- | --- |
| `regulatory-filing` | `dart-financial` |
| `public-compensation` | `review` |
| `job-posting` | `job-posting` |
| `official`, `investor-relations` | `official` |
| `reputable-news`, `other` | `other` |

`statement`가 `summary`가 되고, 원본 fact 전체가 `payload_json`에 들어간다.

`validUntil`이 없는 fact는 옮긴 뒤의 `source_type`이 정한 기간을 `observedAt`에 더한다.
기간은 `docs/data-schema.md`의 「회사 근거」 절 유효기간 표가 소유한다.
`dart-financial`은 180일, `review`는 60일, `official`과 `other`는 90일이다.
`job-posting`만 표가 기간을 정하지 않는다. 수집 실행마다 다시 만드는 값이기 때문이다.
이관하는 것은 이미 모아 둔 옛 fact이므로 90일을 준다.
매핑 표가 내는 다섯 값 밖을 만나면 종료 코드 1로 중단한다.

stdout에는 회사별 근거 건수와 제외 규칙 건수와 버린 추론 건수만 낸다.
회사명과 제외 사유는 내지 않는다.

### 2. `feedback/exclusions.ts`가 API에서 읽게 바꾼다

`loadPositionExclusions`가 파일 대신 `GET api/positions/v1/exclusions`를 부른다.
`defaultExclusionsPath`와 `config/position-exclusions.ts`를 지운다.

Backend가 응답하지 않으면 종료 코드 1로 중단한다.
파일로 되돌아가지 않는다. 오래된 규칙으로 외부 요청을 보내면
제외하기로 한 회사의 공고가 모델에 들어간다.

`normalizePostingUrl`과 규칙 적용 함수는 그대로 둔다. 읽는 곳만 바뀐다.

**`loadPositionExclusions`가 비동기가 되므로 호출처를 함께 고친다.**
`scripts/position-recommender/collect_live_postings.ts:148`이 지금 동기로 부른다.
`await`를 붙이고, 그 함수가 이미 `async`인지 확인해 아니면 올린다.

`--exclusions-config` 인자도 함께 지운다.
`collect_live_postings.ts`의 `exclusionsConfig` 파싱과 `live-postings/types.ts:74`의
`exclusionsConfig?: string` 필드가 대상이다. 읽을 파일이 없어져 가리킬 것이 없다.

**`live-postings/collect.test.ts`도 같이 고친다.**
135줄이 `--exclusions-config`를 주며 `collect_live_postings.ts`를 별도 프로세스로 띄우고,
126줄이 프록시를 `http://127.0.0.1:1`로 막아 수집이 실패하는 것을 확인한다.
144줄이 stderr에서 `FAIL collection health`를 찾는다.

인자를 지우면 `parseArgs`가 알 수 없는 인자로 보고 종료 코드 1로 끝나므로
종료 코드는 같지만 `FAIL collection health`가 나오지 않아 이 테스트가 깨진다.
인자를 남겨도 `loadPositionExclusions`가 막힌 프록시 너머의 Backend를 부르므로
수집에 닿기 전에 끝나 같은 결과가 된다.

이 테스트에서 `--exclusions-config` 인자를 지우고,
제외 규칙을 돌려주는 Backend를 테스트 안에 세워 수집 단계까지 가게 한다.
막는 대상은 공고 수집의 외부 호출뿐이어야 한다.

### 3. `company-research/store.ts`와 `company_research.ts`를 지운다

`company-research/schema.ts`의 zod 계약은 남긴다.
`import_position_state.ts`가 파일을 읽을 때 쓴다.

`company-research/store.test.ts`도 함께 지운다.
이 파일이 `company_research.ts`를 import 하므로 남기면 type 검사가 깨진다.

`store.ts`를 부르는 곳을 모두 찾아 `GET companies/:companyKey/evidence`로 바꾼다.

### 4. client에 새 경로 넷을 더한다

`scripts/position-recommender/recommendation-api/client.ts`에 더한다.

- `getExclusions()`
- `replaceExclusions(input)`
- `putCompanyEvidence(companyTierRunId, input)`
- `getCompanyEvidence(companyKey)`

기존 메서드와 같은 오류 처리를 쓴다. 응답 본문의 `error.code`로 분기한다.

### 5. skill 문서에서 동기화 두 단계를 지운다

`.claude/skills/position-recommender/SKILL.md`에서 지울 것이다.

- 「실행 준비」 절의 `career-workspace/cli.ts skill begin` 명령과 그 실패 처리
- 「비공개 작업 반영과 결과 전달」 절의 `skill finish` 명령과 회사 조사 파일 반영 문장
- 「회사 tier 평가」 절의 `state/company-research/`를 읽으라는 문장과 `company_research.ts` 명령

「실행 준비」 절은 API 인증 확인만 남는다.

### 6. 이 phase를 검증하는 테스트

`scripts/position-recommender/import_position_state.test.ts`를 만든다.
임시 디렉터리에 파일을 만들어 `--source-dir`로 가리키고 `--dry-run`의 집계가 맞는지 본다.
`url`을 가진 버전 1 규칙이 그 `url`을 `evidenceUrls`에 담아 버전 2로 올라가는지,
`url`이 없는 버전 1 규칙이 집계에 잡히고 `--commit`이 종료 코드 1로 끝나는지,
버전 1 규칙이 있는데 `--decided-at`이 없으면 종료 코드 1인지,
`sourceType` 매핑이 표대로인지,
`validUntil`이 없는 fact에 `source_type`별 기간이 붙는지를 확인한다.
`dart-financial`에 180일, `review`에 60일, `official`에 90일이 붙는 세 경우를 모두 둔다.
`--source-dir`가 없는 경로를 가리키면 종료 코드 1인 것도 확인한다.

`scripts/position-recommender/feedback/exclusions.test.ts`를 고친다.
파일을 읽던 자리를 client stub으로 바꾸고,
Backend가 오류를 내면 종료 코드 1로 끝나는 것을 확인한다.

## 검증

Backend가 떠 있어야 한다. Phase 01과 02의 container를 그대로 쓴다.

```bash
# cwd: career-os/services/recommendation-api
npm run typecheck
DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
SHADOW_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_shadow" \
  npx prisma migrate deploy
DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
CAREER_RECOMMENDATION_TEST_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
SHADOW_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_shadow" \
  npm test
```

```bash
# cwd: 저장소 루트
bun test career-os/scripts/position-recommender
bunx tsc --noEmit
```

기대값이다.

- 위 셋이 모두 종료 코드 0
- `import_position_state.test.ts`와 고친 `exclusions.test.ts`가 통과
- 출력에 `skipped`가 없다

**파일을 읽는 코드가 남아 있지 않은지 센다.**

```bash
# cwd: 저장소 루트
grep -rn "state/company-research\|position-exclusions.json\|skill begin\|skill finish" \
  career-os/scripts/position-recommender career-os/.claude/skills/position-recommender \
  career-os/config || echo "남은 참조 없음"
```

`import_position_state.ts` 안의 경로 문자열만 남아야 한다. 그 파일이 원본을 읽기 때문이다.
다른 파일에서 나오면 4번이나 5번이 덜 끝난 것이다.

**이관을 dry-run으로 돌려 집계를 본다.**

`career-os/state/`는 `.gitignore`의 `**/state/*`에 걸려 워크트리에 없다.
홈서버에서 동기화한 작업본에만 있고, 그 동기화 명령이 이 phase가 지우는 `skill begin`이다.
그래서 실제 파일 8개를 대상으로 하는 대조는 이 phase에서 하지 않는다.

여기서는 `import_position_state.test.ts`가 만든 표본 디렉터리로 dry-run이 도는 것만 확인한다.

```bash
# cwd: 저장소 루트
bun career-os/scripts/position-recommender/import_position_state.ts \
  --source-dir "$(mktemp -d)" --dry-run; echo "종료 코드 $?"
```

빈 디렉터리이므로 회사 근거 0건과 제외 규칙 0건을 내고 종료 코드 0이어야 한다.

**실제 8개 파일과의 대조는 사용자가 홈서버 작업본에서 직접 돌린다.**
이 워크트리에서는 확인할 수 없으므로 마감 보고에 확인하지 못한 항목으로 남긴다.

## 이 plan 을 마감한다

위 검증이 모두 통과하면 `tasks/plan126-position-state-to-db/index.json` 의
`status` 를 `completed` 로 바꾸고 `current_phase` 를 3 으로 둔다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/import_position_state.ts` | 신규 |
| `career-os/scripts/position-recommender/import_position_state.test.ts` | 신규 |
| `career-os/scripts/position-recommender/feedback/exclusions.ts` | 수정 |
| `career-os/scripts/position-recommender/feedback/exclusions.test.ts` | 수정 |
| `career-os/scripts/position-recommender/recommendation-api/client.ts` | 수정 |
| `career-os/scripts/position-recommender/collect_live_postings.ts` | 수정 |
| `career-os/scripts/position-recommender/live-postings/types.ts` | 수정 |
| `career-os/scripts/position-recommender/live-postings/collect.test.ts` | 수정 |
| `career-os/scripts/position-recommender/company-research/store.ts` | 삭제 |
| `career-os/scripts/position-recommender/company-research/store.test.ts` | 삭제 |
| `career-os/scripts/position-recommender/company_research.ts` | 삭제 |
| `career-os/config/position-exclusions.ts` | 삭제 |
| `career-os/.claude/skills/position-recommender/SKILL.md` | 수정 |
