# Phase 03. 파일을 옮기고 동기화를 없앤다

**Execution profile**: deep

## 목표

파일에 있는 회사 조사 8개와 개인 제외 규칙 1개를 DB로 옮기고,
스크립트가 파일 대신 API를 읽게 바꾸고,
`position-recommender` skill에서 비공개 작업본 동기화 두 단계를 지운다.

이 phase가 끝나면 `position-recommender`가 `state/`를 읽지도 쓰지도 않는다.

**범위 외**: 다른 skill의 `state/` 사용. `career-workspace` CLI 자체는 지우지 않는다.
`application-package-writer`와 `resume-preparer`와 `interview-practice`와
`study-topic-recommender`가 계속 쓴다.

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
옮기고 대조까지만 한다. 지우는 것은 운영에서 한 번 돌려 본 뒤다.
지금 지우면 되돌릴 때 값을 잃는다.

**버전 1 형식의 제외 규칙을 버전 2로 올린다.**
`scope`가 없는 옛 규칙에 `scope: "posting"`을 붙인다.
`decisionKind`와 `reason`과 `evidenceUrls`가 없으므로
`decisionKind`는 `manual`, `reason`은 「이관 전 규칙」, `evidenceUrls`는 빈 배열로 둔다.
`evidenceUrls`가 비어도 되는 것은 `career-downside`가 아닐 때뿐이다.

**회사 조사의 `facts`를 `company_evidence`로, `inferences`는 버린다.**
추론은 근거가 아니다. 버린 추론이 있었다는 사실을 이관 명령이 출력한다.
다음 판정이 남은 근거 위에서 추론을 다시 만든다.

## 작업 항목

### 1. `scripts/position-recommender/import_position_state.ts` 추가

`--dry-run`이 기본이고 `--commit`을 줘야 실제로 보낸다.

읽는 것이다.

- `state/company-research/*.json`의 `profile.facts`
- `state/private-config/position-exclusions.json`의 `exclusions`

`CompanyResearchFact.source.sourceType`을 `company_evidence.source_type`으로 옮긴다.

| 파일의 값 | table의 값 |
| --- | --- |
| `regulatory-filing` | `dart-financial` |
| `public-compensation` | `review` |
| `job-posting` | `job-posting` |
| `official`, `investor-relations` | `official` |
| `reputable-news`, `other` | `other` |

`statement`가 `summary`가 되고, 원본 fact 전체가 `payload_json`에 들어간다.
`validUntil`이 없는 fact는 `observedAt`에 90일을 더한다.

stdout에는 회사별 근거 건수와 제외 규칙 건수와 버린 추론 건수만 낸다.
회사명과 제외 사유는 내지 않는다.

### 2. `feedback/exclusions.ts`가 API에서 읽게 바꾼다

`loadPositionExclusions`가 파일 대신 `GET api/positions/v1/exclusions`를 부른다.
`defaultExclusionsPath`와 `config/position-exclusions.ts`를 지운다.

Backend가 응답하지 않으면 종료 코드 1로 중단한다.
파일로 되돌아가지 않는다. 오래된 규칙으로 외부 요청을 보내면
제외하기로 한 회사의 공고가 모델에 들어간다.

`normalizePostingUrl`과 규칙 적용 함수는 그대로 둔다. 읽는 곳만 바뀐다.

### 3. `company-research/store.ts`와 `company_research.ts`를 지운다

`company-research/schema.ts`의 zod 계약은 남긴다.
`import_position_state.ts`가 파일을 읽을 때 쓴다.

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
임시 디렉터리에 파일을 만들어 놓고 `--dry-run`의 집계가 맞는지 본다.
버전 1 규칙이 버전 2로 올라가는지, `sourceType` 매핑이 표대로인지,
`validUntil`이 없는 fact에 90일이 붙는지를 확인한다.

`scripts/position-recommender/feedback/exclusions.test.ts`를 고친다.
파일을 읽던 자리를 client stub으로 바꾸고,
Backend가 오류를 내면 종료 코드 1로 끝나는 것을 확인한다.

## 검증

Backend가 떠 있어야 한다. Phase 01과 02의 container를 그대로 쓴다.

```bash
# cwd: career-os/services/recommendation-api
npm run typecheck
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

```bash
# cwd: 저장소 루트
bun career-os/scripts/position-recommender/import_position_state.ts --dry-run
```

회사 근거 건수가 `state/company-research/`의 파일 8개가 담은 `facts` 총합과 같아야 한다.

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
| `career-os/scripts/position-recommender/company-research/store.ts` | 삭제 |
| `career-os/scripts/position-recommender/company_research.ts` | 삭제 |
| `career-os/config/position-exclusions.ts` | 삭제 |
| `career-os/.claude/skills/position-recommender/SKILL.md` | 수정 |
