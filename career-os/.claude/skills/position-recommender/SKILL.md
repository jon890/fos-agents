---
name: position-recommender
description: 열려 있는 채용공고를 모아 후보자가 해온 일과 선호에 얼마나 맞는지 판정하고, 순위와 근거와 다음 행동을 담은 리포트를 게시해 링크를 돌려준다. "지원할 포지션 추천", "갈 만한 회사 찾아줘", "최신 백엔드 공고 분석", "이직 후보 추천"처럼 실제 공고 탐색과 지원 판단이 필요할 때 사용한다.
---
# position-recommender

**목표: 열려 있는 공고를 모아 후보자가 해온 일과 선호에 얼마나 맞는지 판정하고,
바로 지원을 이어갈 수 있게 순위와 근거, 다음 행동을 전달한다.**

포지션이 적합한지는 다음으로 판단한다.

- **해온 일.** 실제 경력 근거와 공고의 필수 자격을 맞춘다.
- **선호.** 어떤 문제를 풀고 싶은지와 현재 직장 대비 무엇이 나아지는지를 본다.

근거는 공고 원문과 검증 가능한 외부 자료에서 온다. 추측한 방향을 넣지 않고,
확인하지 못한 것은 `확인 필요`와 `정보 없음`으로 표시한다.

## 7단계 실행 절차

**아래 명령은 모두 저장소 루트에서 실행한다.**


| 단계  | 이름                      | 만드는 것                               | 통과 조건                        |
| --- | ----------------------- | ----------------------------------- | ---------------------------- |
| 1   | 실행 경로 준비와 제외 공고 목록 내려받기 | `<RUN_DIR>`, 최신 제외 공고 목록            | 비공개 release 내려받기 성공          |
| 2   | 공고 수집                   | `<RUN_DIR>/posting-candidates.json` | 종료 코드 0과 2단계 통과 조건 셋         |
| 3   | 경력과 선호, 보상 조회           | 판정에 넣을 값                            | brain 과 외부 소스 조회 완료          |
| 4   | 공고별 적합도와 업사이드 판정        | `<RUN_DIR>/recommendation.json`     | 후보풀 대조 검증 통과                 |
| 5   | 제외 공고 목록 갱신             | 다음 수집에서 뺄 공고와 회사                    | 비공개 release 반영 성공            |
| 6   | 보고서                     | `<RUN_DIR>/index.html`              | 공개 계약 검사 통과                  |
| 7   | 게시와 정리                  | 검증된 공개 링크                           | 공개 URL 응답 확인과 `<RUN_DIR>` 삭제 |


산출물은 모두 `<RUN_DIR>` 안에 만들고 끝나면 지운다. 저장소에 남기지 않는다.

---

### 1. 실행 경로 준비와 제외 공고 목록 내려받기

이번 실행 전용 임시 디렉터리를 만들어 `<RUN_DIR>`로 쓴다. 저장소 안에 두지 않는다.

**제외 공고 목록은 사용자가 다시 보지 않기로 정한 공고와 회사다.**
지원할 뜻이 없다고 판정한 것을 적어 두어 다음 수집부터 후보풀에서 빠진다.
목록은 공개 저장소에 두지 않고 `state/private-config/` 에 있다.

아래 명령이 그 목록을 원격 release 에서 내려받는다.
실패하면 오래된 목록으로 진행하지 않는다. 이미 뺀 공고가 다시 후보풀에 들어온다.

```bash
bun career-os/scripts/career-workspace/cli.ts skill begin position-recommender --json
```

### 2. 공고 수집

**후보풀 파일은 실패해도 남는다.** 파일이 있다는 것을 성공으로 판단하지 않는다.
종료 코드와 표준 오류를 함께 읽는다.

| 종료 코드 | 뜻 | 처리 |
| --- | --- | --- |
| 0 | 후보풀 생성 성공 | `WARN collection health` 가 있으면 누락 소스를 사용자에게 알리고 계속한다 |
| 1 | 수집 건전성 실패 | `FAIL collection health` 가 사유를 담는다. 실패 소스를 단독 재확인한다 |
| 2 | 잘못된 인자 | 명령을 고쳐 다시 실행한다 |

표준 오류의 `WARN` 은 세 종류다.
`WARN collection health` 는 허용 범위 안에서 실패한 소스를, `WARN source errors` 와
`WARN posting schema errors` 는 소스별 진단을 담는다.
`FAIL position exclusions` 는 설정 오류이므로 복구 전까지 다음 단계로 가지 않는다.

후보풀이 아래를 모두 만족해야 다음으로 간다.

- `collectedAt` 이 이번 실행 시각이고 `candidates` 가 1건 이상이다.
- 후보가 `direct_posting` 이고 상태가 `active` 또는 `open` 이다.
- 마감이 지나지 않았다.

목표 직무가 아닌 것이 섞여 있으면 추천에서 빼는 데 그치지 않고 수집 정책의 결함으로 보고한다.

```bash
bun career-os/scripts/position-recommender/collect_live_postings.ts --output <RUN_DIR>/posting-candidates.json
```

실패한 소스는 `--source <소스> --output <RUN_DIR>/probe.json` 을 붙여 단독으로 다시 돌린다.

### 3. 경력과 선호, 보상 조회

**brain 에 있는 값을 다시 묻지 않는다.**
없으면 판정을 멈추지 않고 그 한계를 리포트에 적는다.
사용자가 무엇이 빠졌는지 리포트를 보고 말할 수 있기 때문이다.

brain 조회는 `brain-search` 를 쓴다.

| 값 | 소스 | 없을 때 |
| --- | --- | --- |
| 현재 직장의 값. 문제의 난도, 오너십, 도메인 확장 여지, 보상 | private brain `career-position-preferences` | 그 축을 `확인 필요`로 둔다 |
| 역할 선호와 관심 도메인 | private brain `career-position-preferences` | 자격과 스택 일치로만 정렬한다 |
| 지원 이력과 재지원 간격 | private brain `career-status` | 추정하지 않는다 |
| 추천에 올릴 회사의 연봉 구간 | 크레딧잡과 원티드 | 보상 축을 `확인 필요`로 둔다 |
| 후보자 경력 근거 | `sources/fos-study/task/`. 읽기 전용이다 | private brain 근거로만 판정한다 |

`sources/fos-study/` 는 git 추적 대상이 아니라 없을 수 있다.
「없을 때」를 적용한 경우 그 사실을 리포트에 남긴다.

### 4. 공고별 적합도와 업사이드 판정

[`references/position-decision-criteria.md`](references/position-decision-criteria.md) 를 읽고 그 기준으로 판정한다.
후보풀 전체와 3단계에서 모은 값을 한 번의 판정에서 함께 비교한다.

**공고 하나마다 다음을 정한다.**

| 정할 것 | 어떻게 | 어디에 쓰나 |
| --- | --- | --- |
| 적합도 순위 | 필수 자격, 역할 선호, 성장 가치, 업사이드, 준비 가능성, 지원 시점을 이 순서로 비교한다 | `candidateRanking[].rank` |
| 한 줄 판단 | 이 순위가 된 이유를 한 문장으로 쓴다 | `candidateRanking[].oneLineReason` |
| 업사이드 네 축 | 판정 기준 문서의 「업사이드 축」이 정한 축마다 판정과 근거를 한 줄씩 적는다 | 추천 티어 항목의 `companyUpside.axes` |
| 추천 티어 | 강력 추천, 도전 추천, 보류 중 하나에 넣거나 어디에도 넣지 않는다 | `tiers.strong`, `tiers.stretch`, `tiers.hold` |

순위는 후보풀 전체에 매기고, 네 축 근거는 추천 티어에 올린 공고에만 적는다.
후보가 수백 건이라 전부에 근거를 쓰면 확인하지 않은 방향을 채워 넣게 된다.
티어 밖 공고는 네 축을 합친 종합 방향 하나만 `candidateRanking[].upsideDirection` 에 적는다.

결과는 `<RUN_DIR>/recommendation.json` 에 쓴다.
형식은 `scripts/position-recommender/recommendation/schema.ts` 가 소유하므로
그 파일을 읽어 현재 `schemaVersion` 리터럴과 필드를 그대로 따른다.

- `candidateRanking` 에 후보풀의 모든 공고를 한 번씩 넣고 순위를 1부터 이어 쓴다.
- 강력 추천과 도전 추천은 기준을 통과한 공고만 넣는다. 정해진 개수를 채우지 않는다.
- 다시 보지 않을 공고는 `autoExclusionSuggestions` 에 둔다. 제외 조건은 판정 기준 문서가 정한다.

검증기는 후보 ID와 원문 필드, 수집 실행 ID, 전체 순위, 자동 제외 조건을 확인한다.
실패하면 JSON만 고친다. 수집부터 반복하지 않는다.

```bash
bun career-os/scripts/position-recommender/validate_recommendation.ts \
  --input <RUN_DIR>/recommendation.json --candidates <RUN_DIR>/posting-candidates.json
```

### 5. 제외 공고 목록 갱신

**무엇을 뺄지는 4단계가 정했다.** 이 단계는 그 판정을 목록에 반영하기만 한다.

4단계가 `autoExclusionSuggestions` 에 올린 공고가 무엇을 만족해야 하는지는
판정 기준 문서의 「제외 공고 목록에 올릴 조건」이 소유한다.

첫 명령이 목록을 갱신하고 둘째 명령이 그것을 원격 release 로 올린다.
첫 명령의 종료 코드를 확인한 뒤 둘째로 간다. 갱신이 실패한 상태로 올리면 원격이 잘못된 상태가 된다.
같은 공고가 이미 목록에 있으면 건너뛴다.

```bash
bun career-os/scripts/position-recommender/apply_exclusion_suggestions.ts \
  --input <RUN_DIR>/recommendation.json --candidates <RUN_DIR>/posting-candidates.json

bun career-os/scripts/career-workspace/cli.ts skill finish position-recommender --json
```

release 반영이 실패하면 로컬 설정을 지우지 않는다.
충돌 내용과 로컬 설정을 보존했다는 사실을 사용자에게 알린다.

### 6. 보고서

그날 데이터에 맞는 정보 구조와 시각 구성을 골라 `<RUN_DIR>/index.html` 하나를 만든다.
지원 순위와 근거, 위험, 확인할 사항, 다음 행동, 공개 공고 링크가 드러나야 한다.
위험이 무엇을 뜻하는지는 판정 기준 문서의 「위험」 절이 정한다.

**검사기가 막는 것은 공고가 아니라 근거 문장이다.**
순위를 정할 때 지원 이력과 현재 보상을 근거로 쓰는데, 그 근거를 리포트에 그대로 옮기면 개인 정보가 공개된다.
공고 자체는 공개된 것이라 보류 목록에 그대로 둬도 된다.
지원 이력을 근거로 순위를 내렸다면 「같은 법인에 최근 지원 이력이 있어 재지원 시점을 확인해야 한다」처럼
결과를 적지 않고 쓴다.

검사기가 잡는 것은 공개 범위와 HTML 기본 계약 둘이다.
공개 범위는 `현재 연봉` 과 `서류 탈락` 문자열, 로컬 절대 경로, 로컬 호스트, HTTPS 가 아닌 링크다.
기본 계약은 추천 JSON 스키마, `<!doctype html>`, 비어 있지 않은 `<title>`, `viewport` meta,
그리고 강력 추천과 도전 추천의 공고 링크가 HTML 에 실제로 있는지다.

통과했다고 공개해도 된다는 뜻은 아니다.
외부 소스에서 가져온 연봉 수치와 다른 표현으로 적은 지원 결과는 검출되지 않는다.

```bash
bun career-os/scripts/position-recommender/render/validate-report-html.ts \
  --html <RUN_DIR>/index.html --input <RUN_DIR>/recommendation.json
```

검사를 통과하지 못할 때만 고정 템플릿으로 다시 렌더하고 검사한다.

```bash
bun career-os/scripts/position-recommender/render_recommendation.ts \
  --input <RUN_DIR>/recommendation.json --format html --output <RUN_DIR>/index.html
```

`render_candidate_preview.ts` 는 후보풀 미리보기라 위험과 확인할 사항, 다음 행동을 렌더하지 않는다.
이 단계의 대체 경로는 `render_recommendation.ts` 다.

브라우저에서 데스크톱과 모바일 배치, 가로 넘침, 주요 링크를 확인한다.

### 7. 게시와 정리

**`report-publisher` 로 게시한다.** `<RUN_DIR>` 은 이 단계 끝에 지우므로 게시한 링크가 유일하게 남는 결과다.

| 값 | 내용 |
| --- | --- |
| 게시 대상 | `<RUN_DIR>/index.html` |
| slug | `position-YYYY-MM-DD` |
| Pages 프로젝트 | `fos-reports` |

게시 전 공개 점검, 인증, 공개 URL 검증과 어느 주소를 전달할지는 `report-publisher` 가 소유한다.

링크를 전달할 때 이번 주에 어디에 지원할지와 추천마다 바로 할 다음 행동을 함께 알린다.
리포트를 열지 않아도 무엇을 해야 하는지 알 수 있어야 한다.

끝으로 이번 실행에서 만든 파일을 확인해 삭제하고 빈 `<RUN_DIR>` 을 `rmdir` 로 지운다.
공개 Pages 배포와 비공개 release 는 그대로 둔다.

---

## 스킬을 고칠 때

수집 어댑터, 정책, 렌더러의 파일 배치와 책임은 `career-os/docs/code-architecture.md` 가 소유한다.
판정 규칙을 고치려면 [`references/position-decision-criteria.md`](references/position-decision-criteria.md) 를 고친다.