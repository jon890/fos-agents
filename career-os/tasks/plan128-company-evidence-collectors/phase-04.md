# Phase 04. 세 축을 판정하고 리포트에 각각 보여준다

**Execution profile**: deep

## 목표

모델이 수집된 근거만 읽고 축 셋을 각각 판정하게 하고,
추천 HTML이 tier 한 줄 대신 축 셋과 각 축의 근거를 보여주게 한다.

**범위 외**: 팀 단위 판정. 근거가 쌓인 뒤 따로 정한다.

## 컨텍스트

Phase 01이 계약을, Phase 02와 03이 근거를 만들었다.
남은 것은 그 근거를 판정에 쓰고 결과를 보여주는 것이다.

지금 추천 HTML은 공고마다 `Tier 1 · 모델 평가`처럼 한 줄을 보여준다.
`scripts/position-recommender/render/recommendation-html.ts`가 그린다.
`tier` 하나가 세 축을 대표하고 있어서, 배울 것이 많지만 보상이 낮은 회사와
그 반대가 같은 줄로 보인다.

skill 문서의 판정 기준은 둘째 계획이 `references/judgment.md`로 내렸다.
이 phase가 그 파일에 축별 판정 기준을 채운다.

**근거 문서**: `docs/prd.md`의 「position-recommender」 절,
`docs/flow.md`의 「position-recommender」 절,
`docs/adr/ADR-125-회사-판정은-세-축을-각각-낸다.md`,
`docs/adr/ADR-124-판정-스키마는-모르는-상태를-표현한다.md`

## 의도 메모

**「근거 없음」을 낮은 평가로 보이게 하지 않는다.**
`unknown`인 축을 `low`와 같은 자리에 같은 모양으로 그리면
근거가 없는 회사가 나쁜 회사로 읽힌다. 다른 표시로 구분한다.

**`assessment`를 공개 HTML에 넣지 않는다.**
유보와 반대 근거를 적는 자리이고 후보자의 개인 판단이 섞인다.
공개에 실리는 것은 200자까지인 `reason`이다.

**현재 직장을 비교의 기준으로 같은 줄에 그린다.**
`disposition`이 `benchmark`인 회사의 판정을 리포트 위쪽에 한 번 보여주고,
후보 회사의 축을 그것과 견주어 읽게 한다.
숫자를 빼서 차이만 보여주지 않는다. 직군 구성이 달라 차이만으로는 오해를 만든다.

**`tier`는 화면에 그리지 않는다.**
분석 큐의 우선순위를 정하는 내부 값이다.
지금처럼 공고마다 tier를 보여주면 축 셋과 tier가 어긋나 보일 때 어느 쪽을 믿을지 알 수 없다.

## 작업 항목

### 1. `references/judgment.md`에 축별 판정 기준을 채운다

축마다 무엇을 보고 어느 등급을 주는지 적는다.

| 축 | 보는 것 |
| --- | --- |
| `growth-scope` | 기술 블로그의 분류와 발행 빈도, GitHub의 언어와 유지 여부, 공고의 기술 스택 |
| `team-growth` | DART 직원 수의 연도 간 변화, 활성 공고 수와 최근 신규 공고 |
| `compensation-upside` | DART 1인 평균 급여와 평균 근속연수, Blind 급여와 복지 평점 |

**1인 평균 급여를 그대로 비교하지 않는다**를 적는다.
평균 근속연수를 함께 놓고 현재 직장과 견준다.

**근거가 없으면 `unknown`이고 그것이 정답이다**를 적는다.
`evidenceIds`가 비어 있는데 등급을 매기면 계약이 거절한다는 사실도 함께 적는다.

### 2. 판정 입력에 근거를 넣는다

`position_run.ts commit-company-tiers`가 읽는 큐 옆에
Phase 03이 만든 `<RUN_DIR>/company-evidence.json`이 있다.
skill 문서가 모델에게 그 파일만 읽고 판정하라고 적는다.

모델이 만드는 `company-tier-updates.json`의 각 결과에
`assessment`와 축별 `evidenceIds`가 들어간다.

### 3. `render/recommendation-html.ts`를 고친다

회사마다 축 셋을 그린다.

| 표시 | 언제 |
| --- | --- |
| 등급과 근거 링크 | `level`이 `low`, `medium`, `high` |
| 「근거 없음」 | `level`이 `unknown` |

`unknown`은 등급 자리에 그리지 않고 회색 표기로 구분한다.
각 축 아래 그 축의 `evidenceIds`가 가리키는 근거의 제목과 링크를 단다.

`disposition`이 `benchmark`인 회사의 판정을 리포트 맨 위에 한 번 그린다.

공고 항목에서 `Tier N · 출처` 줄을 없앤다.
회사 요약에 축 셋이 있으므로 중복이다.

추천 요약에는 축별로 `unknown`인 회사 수를 더한다.

### 4. 공개 범위 검사에 `assessment`를 더한다

`render/validate-report-html.ts`가 확인하는 목록에 더한다.
`assessment`의 내용이 HTML에 나오면 검사가 실패한다.

### 5. `finalize`가 내는 집계에 축을 더한다

`finalize_position_recommendation.ts`가 내는 값에
축별 `unknown` 회사 수를 더한다.
`SKILL.md`의 「최종 답변」 절이 이 값을 전달한다.

### 6. 이 phase를 검증하는 테스트

`render/render-recommendation.test.ts`를 고친다.

- 축 셋이 각각 그려지고 `unknown`은 등급 자리에 나오지 않는다
- 각 축 아래 그 축의 근거 링크만 달린다
- `assessment`가 HTML 어디에도 없다
- `Tier` 문자열이 공고 항목에 없다
- `benchmark` 회사의 판정이 맨 위에 한 번만 나온다
- 세 축이 모두 `unknown`인 회사도 공고가 정상으로 그려진다

`validate-report-html.test.ts`에 `assessment`가 섞인 HTML이 거절되는 항목을 더한다.

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

```bash
# cwd: 저장소 루트
"$HOME/.claude/skills/korean-check/scripts/check.sh" \
  career-os/.claude/skills/position-recommender/references/judgment.md
```

기대값이다.

- 다섯이 모두 종료 코드 0
- 고친 `recommendation-html.test.ts`와 `validate-report-html.test.ts`가 통과
- 출력에 `skipped`가 없다

**고정 입력으로 HTML을 만들어 축이 그려지는지 본다.**

`render/fixture.ts`의 `run`으로 HTML을 만들어 본다.
`render_recommendation.ts`는 `--input`으로 JSON 파일을 받으므로 fixture를 파일로 내려 쓴다.

```bash
# cwd: 저장소 루트
bun -e 'import {run} from "./career-os/scripts/position-recommender/render/fixture.ts";
  await Bun.write("/tmp/recommendation-fixture.json", JSON.stringify(run));'
bun career-os/scripts/position-recommender/render_recommendation.ts \
  --input /tmp/recommendation-fixture.json --format html \
  --output /tmp/recommendation-check.html
grep -c "근거 없음" /tmp/recommendation-check.html
grep -c "Tier " /tmp/recommendation-check.html
```

`근거 없음`이 한 번 이상 나오고 `Tier `가 0이어야 한다.

## 배포 전에 확인할 것

이 계획은 배포를 실행하지 않는다. 배포는 별도로 판단한다.

- migration 넷이 운영 `fos_career`에 순서대로 적용되는지 확인한다.
  Phase 01의 `company_tier_assessments` 변경과 Phase 02와 03의 `company_preferences` 칸 추가다
- `CAREER_DART_API_KEY_FILE`을 홈서버 container에 넣고 mode 600인지 확인한다
- 기존 회사 tier 평가 5건이 유효기간이 끝날 때까지 남는지 확인한다.
  축별 근거 요구를 만족하지 않으므로 만료 뒤 다시 평가된다
- `company_preferences`에 현재 직장을 `benchmark`로 넣는다.
  넣지 않으면 비교의 기준이 없어 축 3의 판정이 의미를 잃는다
- 회사별 `tech_blog_feed_url`과 `github_org`와 `blind_company_slug`를 채운다.
  비어 있으면 그 수집기가 건너뛰어 축이 `unknown`으로 남는다

## 이 plan 을 마감한다

위 검증이 모두 통과하면 `tasks/plan128-company-evidence-collectors/index.json` 의
`status` 를 `completed` 로 바꾸고 `current_phase` 를 4 로 둔다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/position-recommender/references/judgment.md` | 수정 |
| `career-os/.claude/skills/position-recommender/SKILL.md` | 수정 |
| `career-os/scripts/position-recommender/render/recommendation-html.ts` | 수정 |
| `career-os/scripts/position-recommender/render/render-recommendation.test.ts` | 수정 |
| `career-os/scripts/position-recommender/render/validate-report-html.ts` | 수정 |
| `career-os/scripts/position-recommender/render/validate-report-html.test.ts` | 수정 |
| `career-os/scripts/position-recommender/finalize_position_recommendation.ts` | 수정 |
