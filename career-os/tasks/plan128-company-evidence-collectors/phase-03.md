# Phase 03. OpenDART와 Blind 수집기를 만든다

**Execution profile**: deep

## 목표

OpenDART의 「직원 현황」과 재무정보, 그리고 Blind의 항목별 평점을 모으는 수집기 둘을 만든다.

이 둘이 `compensation-upside` 축을 채운다.
지금 그 축은 저장된 5건 전부 `unknown`이다.

**범위 외**: 모델이 근거를 읽고 판정하는 것과 리포트 표시는 Phase 04다.

## 컨텍스트

2026-09-22에 인증키를 발급받아 실제로 호출해 확인한 값이다.

| 회사 | 1인 평균 급여 (남) | 평균 근속 | 인원 |
| --- | --- | --- | --- |
| NHN | 98,159,000 | 3년 7개월 | 503 |
| 카카오 | 122,000,000 | 6년 4개월 | 2,186 |
| 비바리퍼블리카 | 139,000,000 | 1년 8개월 | 1,084 |

우아한형제들은 `status 013 조회된 데이타가 없습니다`를 냈다.
사업보고서를 내지 않는 회사가 있고 그 자리는 빈다.
조회한 세 회사 모두 `fo_bbm`이 `전사`였다. 사업부문별 분해를 기대할 수 없다.

인증키는 `~/.config/career-os/api-accounts.txt`에 있다. 저장소 밖이고 모드 600이다.
`[OpenDART]` 절의 `apikey`가 그 값이다.

호출 형태다.

```
https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=<KEY>
https://opendart.fss.or.kr/api/empSttus.json?crtfc_key=<KEY>&corp_code=<CODE>&bsns_year=<YEAR>&reprt_code=11011
```

`corpCode.xml`은 zip으로 오고 안에 `CORPCODE.xml`이 들어 있다.
회사명으로 `corp_code`를 찾는 데 쓴다.

Blind는 `https://www.teamblind.com/kr/company/<회사>/reviews`가 로그인 없이
항목별 평점을 보여준다. 커리어 향상, 업무와 삶 균형, 급여와 복지, 사내 문화, 경영진 다섯이다.

**근거 문서**: `docs/code-architecture.md`의 「근거 수집기」 절,
`docs/data-schema.md`의 「회사 근거」 절,
`docs/adr/ADR-125-회사-판정은-세-축을-각각-낸다.md`

## 의도 메모

**인증키를 저장소에 넣지 않는다.**
환경 변수 `CAREER_DART_API_KEY`나 mode 600인 `CAREER_DART_API_KEY_FILE`로 받는다.
`CAREER_RECOMMENDATION_API_TOKEN`이 쓰는 방식과 같다.
키가 없으면 DART 수집기를 건너뛰고 진단만 남긴다. 실행을 멈추지 않는다.

**`corp_code` 목록을 매번 내려받지 않는다.**
zip이 수 MB이고 회사 목록은 거의 바뀌지 않는다.
받은 값을 `company_preferences.dart_corp_code`에 적어 두고 다음부터 그것을 쓴다.
없는 회사만 목록을 다시 받아 찾는다.

**1인 평균 급여를 그대로 비교하지 않는다.**
직군 구성과 근속 분포가 회사마다 다르다.
수집기는 급여와 근속과 인원을 함께 저장하고, 해석은 판정이 한다.
`summary`에도 셋을 함께 적는다.

**현재 직장도 같은 방식으로 모은다.**
비교의 기준이 같은 출처에서 나와야 한다.
`company_preferences`에 현재 직장을 넣되 공고는 분석하지 않는 구분이 필요하다.
그 구분을 `disposition`에 값 하나로 더한다.

**Blind 평점만 저장하고 리뷰 본문은 저장하지 않는다.**
본문은 개인이 쓴 글이고 판정에 필요한 것은 항목별 평점이다.

## 작업 항목

### 1. `company_preferences`에 칸 둘을 더하고 `disposition`에 값을 더한다

`prisma/migrations/`에 새 디렉터리를 만든다.

- `dart_corp_code` `CHAR(8)` NULL
- `blind_company_slug` `VARCHAR(191)` NULL
- `disposition`에 `benchmark`를 더한다

`benchmark`는 판정은 하되 그 회사의 공고를 분석 큐에 넣지 않는다는 뜻이다.
현재 직장이 여기 해당한다.

`src/positions/schema.ts`와 큐 선택 코드에서 `benchmark`를 다룬다.
회사 tier 큐에는 들어가고 공고 분석 큐에는 들어가지 않는다.

### 2. `collectors/dart.ts`

인증키가 없으면 건너뛴다.

`corp_code`가 없는 회사는 `corpCode.xml`을 내려받아 회사명으로 찾는다.
찾으면 Backend에 적어 다음부터 다시 찾지 않는다.
동명이인이 여럿이면 `stock_code`가 있는 것을 먼저 고르고, 없으면 진단만 남긴다.

`empSttus`를 최근 사업연도로 부른다. `status`가 `013`이면 근거를 만들지 않고 진단만 남긴다.

근거 두 건을 만든다.

| `sourceType` | `summary` | `payloadJson` |
| --- | --- | --- |
| `dart-employment` | 1인 평균 급여와 평균 근속연수와 인원 | 성별과 부문별 원본 행 |
| `dart-financial` | 최근 사업연도 매출과 영업이익 | 원본 행 |

`validUntil`은 둘 다 180일이다.

### 3. `collectors/review.ts`

`blind_company_slug`가 있는 회사만 대상이다.
항목별 평점 다섯과 전체 평점과 리뷰 수를 읽는다.

근거 한 건을 만든다.
`sourceType`은 `review`, `summary`는 전체 평점과 급여와 복지 항목 평점,
`payloadJson`은 항목별 평점 다섯과 리뷰 수다.
`validUntil`은 60일이다.

응답이 200이 아니거나 평점을 찾지 못하면 근거를 만들지 않고 진단만 남긴다.
리뷰 본문은 저장하지 않는다.

### 4. `collect` 하위 명령에 근거 수집을 넣는다

둘째 계획이 만든 `position_run.ts collect`가
회사 tier 큐를 받은 뒤 `registry.ts`를 돌리고
`PUT company-tier-runs/:companyTierRunId/evidence`로 저장한다.

저장한 뒤 그 회사들의 유효한 근거를 받아
`<RUN_DIR>/company-evidence.json`에 남긴다. 모델이 이 파일을 읽는다.
파일 이름은 `run-dir.ts`가 소유한다.

stdout에는 회사 수와 근거 건수와 실패한 수집기 수만 낸다.
회사명과 급여 수치는 내지 않는다.

### 5. 이 phase를 검증하는 `company-evidence/collectors/external.test.ts`

확인할 것이다.

- `empSttus` 응답을 고정한 입력으로 주면 `dart-employment` 근거의 `summary`에 급여와 근속과 인원이 들어간다
- `status`가 `013`이면 근거를 만들지 않고 진단을 남기며 예외를 던지지 않는다
- 인증키가 없으면 DART 수집기를 건너뛰고 나머지 수집기는 돈다
- `corp_code`가 이미 있으면 `corpCode.xml`을 부르지 않는다
- Blind 응답이 200이 아니면 근거를 만들지 않는다
- `review` 근거의 `payloadJson`에 리뷰 본문이 없다
- `disposition`이 `benchmark`인 회사가 회사 tier 큐에는 들어가고 공고 분석 큐에는 들어가지 않는다

외부 요청은 stub으로 막는다.

## 검증

```bash
# cwd: 저장소 루트
bun test career-os/scripts/position-recommender
bunx tsc --noEmit
```

```bash
# cwd: career-os/services/recommendation-api
npm run typecheck
DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
CAREER_RECOMMENDATION_TEST_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
SHADOW_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_shadow" \
  npm test
```

기대값이다.

- 넷이 모두 종료 코드 0
- `external.test.ts`의 항목이 모두 통과
- 출력에 `skipped`가 없다

**인증키가 코드에 들어가지 않았는지 센다.**

```bash
# cwd: 저장소 루트
grep -rn "crtfc_key=[0-9a-f]\{40\}\|32ecfdde" career-os/ --include=*.ts --include=*.md \
  || echo "키 문자열 없음"
```

출력이 「키 문자열 없음」이어야 한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/company-evidence/collectors/dart.ts` | 신규 |
| `career-os/scripts/position-recommender/company-evidence/collectors/review.ts` | 신규 |
| `career-os/scripts/position-recommender/company-evidence/collectors/external.test.ts` | 신규 |
| `career-os/scripts/position-recommender/company-evidence/collectors/index.ts` | 수정 |
| `career-os/scripts/position-recommender/position_run.ts` | 수정 |
| `career-os/scripts/position-recommender/run-dir.ts` | 수정 |
| `career-os/services/recommendation-api/prisma/migrations/*/migration.sql` | 신규 |
| `career-os/services/recommendation-api/src/positions/schema.ts` | 수정 |
| `career-os/services/recommendation-api/src/positions/queue.ts` | 수정 |
