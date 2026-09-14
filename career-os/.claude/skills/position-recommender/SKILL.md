---
name: position-recommender
description: 열려 있는 채용공고를 모아 후보자가 해온 일과 선호에 얼마나 맞는지 판단하고, 순위와 근거와 다음 행동을 담은 리포트를 게시해 링크를 돌려준다. "지원할 포지션 추천", "갈 만한 회사 찾아줘", "최신 백엔드 공고 분석", "이직 후보 추천"처럼 실제 공고 탐색과 지원 판단이 필요할 때 사용한다.
---
# position-recommender

열려 있는 공고, 후보자의 경력과 선호, 공개 회사 자료를 함께 조사한다.
지원할 포지션의 순위와 근거, 다음 행동을 담은 리포트를 게시해 바로 지원을 이어갈 수 있게 한다.

회사의 성장 여력, 사업 규모, 보상과 복지는 다음 실행에서도 재사용한다.
확인한 사실과 모델의 추론을 구분하고, 추론에 영향을 주는 근거와 가정을 함께 적는다.

명령은 저장소 루트에서 실행한다.
실행별 후보풀, 추천 JSON과 HTML은 시스템 임시 디렉터리인 `<RUN_DIR>`에 만들고 게시가 끝나면 정리한다.

## 실행 준비

`<RUN_DIR>`을 만들고 비공개 작업 release를 준비한다.

```bash
bun career-os/scripts/career-workspace/cli.ts skill begin position-recommender --json
```

준비 명령이 실패하면 추천 실행을 중단하고 반환된 복구 정보를 따른다.

## 공고 수집

```bash
bun career-os/scripts/position-recommender/collect_live_postings.ts \
  --output <RUN_DIR>/posting-candidates.json
```

종료 코드 0인 후보풀만 사용한다.
활성 상태, 마감일, URL, 고용 형태와 대상 직무는 수집 코드가 검증한다.
실패하면 표준 오류가 지목한 소스만 `--source <소스> --output <RUN_DIR>/probe.json`으로 재현한다.

## 후보자와 회사 조사

`brain-search`로 private brain에서 현재 경력, 역할 선호, 이직 우선순위와 지원 이력을 확인해
추천 판단에 반영한다. 구체적인 프로젝트 근거는 읽기 전용인 `sources/fos-study/task/`와 함께 확인한다.

`state/company-research/`의 회사별 파일에서 유효한 회사 조사를 재사용한다.
공고와 경력의 연결성이 높은 후보부터 좁힌 뒤, 추천 가능성이 있는 회사는 공개 자료를 깊게 조사한다.

- 현재 역할과 비교해 맡을 문제, 결정 권한, 운영 책임과 기술 방향이 커지는지 본다.
- 사업과 도메인, 팀이 성장하며 중요한 모듈을 오래 소유할 여지가 있는지 조사한다.
- 내부 플랫폼과 사내 도구라면 전담 인력, 로드맵과 사용자 지표를 통해 투자 의지를 판단한다.
- 회사 성장과 성과가 연봉, 성과급, 지분이나 승진 기회로 이어질 여지와 복지의 실질 가치를 조사한다.
- 회사 공식 자료, 공시·IR, 기술 발표, 신뢰할 수 있는 보도, 공개 보상 자료와 공고를 함께 본다.
- 후보자의 경험은 기술 이름보다 실제 사용자, 운영 범위와 장애 영향을 공고의 책임에 연결한다.
- 공개 자료에서 확인한 사실과 모델의 추론을 구분하고, 추론에 영향을 주는 가정을 밝힌다.
- 공개 자료로 확인되지 않은 숫자나 제도는 만들지 않는다. 결론을 바꿀 정보만 추가 조사나 면접 질문으로 남긴다.

회사 판단이 상세 추천의 순위나 이유에 영향을 줬다면 재사용할 공개 사실과 그 근거를 저장한다.
공고 내용만으로 판단했거나 재사용할 회사 사실이 없다면 빈 회사 프로필을 만들지 않는다.
재조사할 시점과 질문이 구체적일 때만 `researchGaps`를 남긴다.

새 사실, 추론과 재조사할 질문은 `<RUN_DIR>/company-research-updates.json`에 쓰고 합친다.
이번 실행에서 다루지 않은 기존 항목은 병합기가 보존한다.

```bash
bun career-os/scripts/position-recommender/company_research.ts \
  --input <RUN_DIR>/company-research-updates.json
```

## 추천 판단

후보풀 전체와 조사 결과를 읽고 `<RUN_DIR>/recommendation.json`을 만든다.
형식은 [`recommendation/schema.ts`](../../../scripts/position-recommender/recommendation/schema.ts)를 따른다.

- private brain의 우선순위와 조사 결과를 종합해 후보풀 전체의 순서를 정한다.
- 전체 순위는 모든 후보를 한 번씩 포함한다. 숫자는 배열 순서에서 정하고, 낮은 순위에 근거나 판정값을 억지로 만들지 않는다.
- 상세 추천은 전체 순위 앞부분에서 실제로 검토할 가치가 있는 후보만 고른다.
- 추천 이유와 라벨은 후보에 맞게 자유롭게 쓰고, 조사 근거와 다음 행동은 실제로 도움이 될 때만 넣는다.
- 정해진 개수나 분류를 채우지 않는다.

다음 명령이 후보풀 대조와 출력 계약을 검사한다.

```bash
bun career-os/scripts/position-recommender/validate_recommendation.ts \
  --input <RUN_DIR>/recommendation.json \
  --candidates <RUN_DIR>/posting-candidates.json
```

검증이 실패하면 추천 JSON을 고쳐 다시 검사한다.

## 재사용 상태 반영

회사 조사 갱신을 포함한 비공개 작업 release를 발행한다.

```bash
bun career-os/scripts/career-workspace/cli.ts skill finish position-recommender --json
```

release 충돌이나 전송 실패가 발생하면 로컬 변경과 실행 산출물을 보존하고 복구 정보를 전달한다.

## 리포트 게시

추천 JSON을 바탕으로 `<RUN_DIR>/index.html`을 만든다.
전체 후보 순위와 공개 공고 링크를 빠짐없이 담고, 상세 추천에는 사실과 추론 근거, 위험, 확인할 질문과 다음 행동을 담는다.
결정에 영향을 주는 근거를 우선하고 추천 결론을 바꿀 질문만 남긴다.

공개 리포트에는 현재 보상, 구체적인 지원 결과, 비공개 경력 자료와 로컬 환경 식별자를 넣지 않는다.
개인 정보가 판단에 영향을 줬다면 공개 가능한 결과와 다음 행동으로 표현한다.

```bash
bun career-os/scripts/position-recommender/render_candidate_preview.ts \
  --input <RUN_DIR>/recommendation.json \
  --candidates <RUN_DIR>/posting-candidates.json \
  --limit all \
  --output <RUN_DIR>/index.html

bun career-os/scripts/position-recommender/render/validate-report-html.ts \
  --html <RUN_DIR>/index.html \
  --input <RUN_DIR>/recommendation.json
```

브라우저에서 데스크톱과 모바일 배치, 가로 넘침과 주요 링크를 확인한다.
`report-publisher`로 `index.html`을 `position-YYYY-MM-DD` slug에 게시한다.

검증된 공개 링크와 이번 주 지원 행동을 전달한 뒤 `<RUN_DIR>`을 정리한다.
