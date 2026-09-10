---
name: position-recommender
description: 현재 경력·역할 선호와 열린 외부 채용공고를 비교해 지원 우선순위를 카드형 HTML로 만드는 career-os 스킬. "지원할 포지션 추천", "갈 만한 회사 찾아줘", "최신 백엔드 공고 분석", "이직 후보 추천"처럼 실제 공고 탐색과 지원 우선순위가 필요할 때 사용한다. 외부 게시는 사용자가 공유 링크를 요청했을 때만 수행한다.
---

# 포지션 추천

외부 소스에서 현재 열린 공고를 먼저 수집한다.
private brain의 현재 커리어 정보와 전체 후보풀을 모델이 비교해 추천한다.

## 입력

항상 다음 정보를 읽는다.

- `brain-search`로 확인한 현재 경력, 역할 선호와 경험 경계
- [`references/position-decision-criteria.md`](references/position-decision-criteria.md)

세부 경력 근거가 판단에 필요하면 `sources/fos-study/`와 실제 프로젝트 기록을 확인한다.
현재 지원 대상, 지원 이력이나 회사별 재지원 간격이 순위에 영향을 주면 `brain-search`로 private brain을 확인한다.
저장소 안에 별도 쿨다운 상태 파일을 만들지 않는다.

## 실행

### 1. 임시 실행 경로 준비

시스템 임시 디렉터리에 이번 실행 전용 경로를 만든다.

```bash
mktemp -d "${TMPDIR:-/tmp}/position-recommender.XXXXXX"
```

반환된 절대 경로를 아래 명령의 `<RUN_DIR>`에 넣는다.
후보풀, 추천 JSON과 HTML은 모두 `<RUN_DIR>`에 만든다.

### 2. 외부 공고 수집

먼저 기존 비공개 release를 준비한다. 개인 제외 설정도 이 release에 포함된다.
준비가 실패하면 수집과 모델 선별을 중단한다.

```bash
CAREER_WORKSPACE_ROOT="$(git rev-parse --show-toplevel)/career-os" \
  bun "$(git rev-parse --show-toplevel)/career-os/scripts/career-workspace/cli.ts" prepare --json
```

설정 위치와 형식은 [데이터 구조](../../../docs/data-schema.md#개인-공고-제외-설정)를 따른다.
설정이 없거나 잘못되면 빈 규칙을 만들거나 필터를 생략하지 않고 복구한다.
공통 수집기는 명시적으로 제외된 공고를 후보풀 생성 전에 제거한다.

```bash
bun "$(git rev-parse --show-toplevel)/career-os/scripts/position-recommender/collect_live_postings.ts" \
  --output <RUN_DIR>/posting-candidates.json
```

`<RUN_DIR>/posting-candidates.json`이 이번 실행의 추천 입력이다.

**종료 코드를 먼저 본다.** 수집 실패 시 후보풀 파일이 남을 수 있으므로 파일이 있다는 것만으로 성공으로 읽지 않는다.
`FAIL position exclusions`이면 설정 오류다. 설정을 복구하기 전에는 기존 후보풀도 사용하지 않는다.

| 종료 코드 | 뜻 | 다음 행동 |
| --- | --- | --- |
| 0 | 판정 통과 | `WARN collection health` 줄이 있으면 그 내용을 사용자에게 알린 뒤 계속한다 |
| 1 | 실패 소스가 허용 개수를 넘었거나 후보가 0건 | 아래 재확인 절차를 따른다 |
| 2 | 인자를 잘못 줬다 | 명령을 고쳐 다시 돌린다 |

허용 개수는 전체 수집이 2개, 단일 소스 수집이 0개다.

**종료 코드가 0이어도 `WARN collection health` 줄을 읽는다.**
허용 범위 안에서 실패한 소스의 이름이 여기 나온다.
그 소스가 사용자의 지원 대상 회사면 결과가 줄어든 실행이므로 사용자에게 알린다.

종료 코드가 1이면 `FAIL collection health` 줄이 사유를 담는다.
실패한 소스를 단독으로 다시 돌려 일시적 장애인지 어댑터 결함인지 가른다.

```bash
bun "$(git rev-parse --show-toplevel)/career-os/scripts/position-recommender/collect_live_postings.ts" \
  --source <실패한 소스> --output <RUN_DIR>/probe.json
```

재확인은 종료 코드보다 `sourceDiagnostics`의 `message`를 읽어 판단한다.
단일 소스 수집은 허용 개수가 0이라, 상세 요청 하나만 실패해도 종료 코드가 1이 된다.
목록 요청이 성공하고 공고를 하나 이상 넘겼으면 어댑터는 살아 있다.
그 소스를 뺀 채 전체 수집을 다시 돌릴지, 원인을 먼저 고칠지는 사용자가 정한다.

목록 요청부터 실패하면 그 어댑터의 결함이다. 추천을 진행하지 않고 사용자에게 알린다.

허용 개수를 바꿔야 하면 `--max-failed-sources <개수>`를 준다.
이 값을 올려서 진행할지는 사용자가 정한다.

이어서 후보풀 내용을 확인한다.

- `collectedAt`이 이번 실행 시각이다.
- `candidates`가 1건 이상이다.
- 후보는 `linkType: direct_posting`이며 개별 공고 URL을 가진다.
- 후보의 `postingStatus`는 `active` 또는 `open`이다.
- 후보의 마감 상태가 `no_deadline`이거나 마감일이 현재 실행 시각 이후다.

현재 수집 성공을 모델 선별의 선행 조건으로 삼는다.
사용자가 기존 후보 사용을 지정하면 해당 수집 시각과 한계를 알리고 계속한다.

### 3. 모델 선별

모델은 후보풀 전체와 private brain에서 확인한 현재 커리어 정보를 비교한다.
추천 순위는 후보자 근거와 아래 판단 축으로 정한다.
닫힘 여부와 마감일은 수집기의 판정을 사용한다.

다음 축을 함께 판단한다.

- 명시된 지원 자격과 후보자 근거
- 역할에서 얻을 기술적 성장
- 현재 직장 대비 업사이드를 네 축으로 나눈 판정
- 경력 수준과 고용 형태
- 현재 약점으로 준비 가능한 범위
- private brain에서 확인한 지원 이력, 재지원 간격과 탐색 시급성

업사이드는 회사 단위가 아니라 공고 단위로 판정한다.
`문제의 난도`, `오너십과 파는 깊이`, `도메인 확장 여지`, `보상` 넷을 각각
`상향`, `동일`, `하향`, `확인 필요` 중 하나로 정하고 근거를 한 줄씩 적는다.
축 이름과 판정 규칙은 [`references/position-decision-criteria.md`](references/position-decision-criteria.md)의 「업사이드 축」이 소유한다.

**후보풀에 업사이드 판정 근거가 없다.** 공고 원문과 회사 공개 자료에서 축마다 직접 확인한다.

공고의 담당 업무는 미래 업무 범위다.
필수 자격과 전이 가능한 경험을 구분해 채점한다.

추천 결과는 `scripts/position-recommender/recommendation_schema.ts`의 `schemaVersion: 5`에 맞춘다.
강력 추천과 도전 추천의 각 항목에는 후보풀의 `candidateId`를 그대로 넣는다.
`candidateRanking`에는 후보풀의 모든 공고를 적합도 순서로 한 번씩 넣는다.
순위는 1부터 후보 수까지 이어져야 하며, 강력 추천과 도전 추천의 순위와 일치해야 한다.
각 순위에는 공개 가능한 `oneLineReason`을 한 문장으로 작성하고, 네 축을 합친 `upsideDirection`을 함께 넣는다.
후보풀 전체를 분석하고 강력 추천과 도전 추천 기준을 통과한 공고는 개수 제한 없이 모두 해당 단계에 넣는다.
정해진 개수를 채우려고 기준 미달 공고를 추천으로 올리지 않는다.
결과는 `<RUN_DIR>/recommendation.json`에만 만든다.

확인할 수 없는 값은 `확인 필요` 또는 `정보 없음`으로 표시한다.

### 4. 결과 검증

```bash
bun "$(git rev-parse --show-toplevel)/career-os/scripts/position-recommender/validate_recommendation.ts" \
  --input <RUN_DIR>/recommendation.json \
  --candidates <RUN_DIR>/posting-candidates.json
```

검증기는 다음 조건을 확인한다.

- 모든 추천 ID가 후보풀에 존재한다.
- 추천 ID가 서로 다르다.
- 회사명, 공고명, URL과 소스가 후보 원문과 일치한다.
- 추천 결과와 후보풀의 수집 실행 ID가 일치한다.
- 전체 후보가 빠짐없이 중복 없이 순위에 포함된다.
- 전체 후보 순위가 1부터 후보 수까지 이어진다.
- 추천 순위와 전체 후보 순위가 일치한다.

검증이 실패하면 JSON을 고친 뒤 다시 실행한다.

### 5. 임시 HTML 생성

포지션 추천은 HTML만 생성한다.
Markdown 리포트는 만들지 않으며 추천 JSON과 후보풀 JSON은 검증 입력으로 유지한다.
상세 렌더 명령을 직접 사용하는 경우에도 `--format html`만 허용한다.
화면·카드·스타일·검색을 수정하는 위치와 검증 명령은 [코드 아키텍처](../../../docs/code-architecture.md#포지션-추천-렌더)를 따른다.

```bash
bun "$(git rev-parse --show-toplevel)/career-os/scripts/position-recommender/render_candidate_preview.ts" \
  --input <RUN_DIR>/recommendation.json \
  --candidates <RUN_DIR>/posting-candidates.json \
  --limit all \
  --output <RUN_DIR>/index.html
```

HTML에는 다음 내용을 담는다.

- 모델이 작성한 간단한 결론
- 강력 추천과 도전 추천을 합쳐 순위가 높은 3건을 먼저 비교하는 카드
- 강력 추천과 도전 추천을 합친 전체 추천 개수와 단계별 개수
- 우선 검토 3건 다음의 모든 추천 공고를 잇는 압축 목록
- 추천 공고와 분리한 보류·주의 목록
- 추천 이유와 기술 태그
- 추천 공고의 축별 업사이드 판정과 근거
- 전체 후보 목록의 업사이드 종합 방향 배지
- 적합도 순위와 한 줄 판단이 있는 전체 후보 접이식 목록
- 전체 후보의 회사, 공고명, 기술과 판단 검색 및 빠른 필터
- 각 공고의 개별 링크
- 연월일·시간 단위의 간단한 생성·수집 시각

데스크톱에서는 우선 검토 카드를 3열로 보여주고 모바일에서는 1열로 바꾼다.
모바일에서 표와 가로 스크롤을 사용하지 않으며 주요 링크의 터치 높이는 44px 이상으로 둔다.
전체 추천 개수를 제목 가까이에 `5 추천 공고`처럼 표시한다.
같은 영역에 `강력 3 · 도전 2`처럼 단계별 개수를 나눠 표시한다.
상위 3건은 화면에서 먼저 보여주는 수이며 추천 데이터의 개수 제한이 아니다.
수집 실행 ID는 기본 화면에서 강조하지 않고 `수집 정보` 상세 영역에 둔다.

외부 공유용 HTML은 공개 공고 정보와 일반화한 추천 근거로 구성한다.

### 6. 로컬 검토와 선택적 게시

생성한 HTML을 실제 브라우저에서 열어 카드, 검색, 모바일 배치와 공고 링크를 확인한다.
사용자가 외부 공유 링크를 요청했을 때만 `report-publisher`로 Cloudflare Pages 준비, 게시와 검증을 수행한다.

`report-publisher`에 다음 값을 전달한다.

- 게시 대상: `<RUN_DIR>/index.html`
- 공개 이름: `position-YYYY-MM-DD`
- Pages 프로젝트: `fos-reports`

게시 전에 다음 내용을 공개 HTML에서 다시 확인한다.

- 내용은 공개 공고 정보와 일반화한 추천 근거로 한정된다.
- 공고 URL은 공개된 HTTPS 개별 공고 링크다.

게시를 요청한 경우 `report-publisher`의 준비 검사, Cloudflare Pages 업로드와 공개 URL 검증을 모두 따른다.
최종 응답에는 검증된 `branch_url`을 우선 전달하고, 없으면 검증된 `public_url`을 전달한다.

### 7. 임시 파일 정리

로컬 렌더 또는 게시 검증을 마친 뒤 최종 응답 전에 `<RUN_DIR>`을 삭제한다.
삭제 전 경로가 시스템 임시 디렉터리 아래에 있고 이름이 `position-recommender`로 시작하는지 확인한다.
아래 명령으로 알려진 파일을 삭제하고 빈 디렉터리를 제거한다.

```bash
for file in index.html recommendation.json posting-candidates.json; do
  [ ! -e "<RUN_DIR>/$file" ] || unlink "<RUN_DIR>/$file"
done
rmdir "<RUN_DIR>"
```

## 완료 조건

- 새 외부 후보풀이 임시 실행 경로에 생성됐다.
- 모든 추천 공고가 후보 ID로 연결됐다.
- 후보풀 대조 검증이 통과했다.
- HTML이 검증된 추천 JSON에서 생성됐다.
- 전체 후보 순위와 한 줄 판단이 후보풀 전체를 포함한다.
- 추천 공고마다 네 축의 업사이드 판정과 근거가 있다.
- HTML의 모든 공고 링크가 개별 공고 URL이다.
- 확인할 수 없는 값이 불확실성 표기로 드러난다.
- 외부 게시를 요청한 경우 `report-publisher`가 Cloudflare Pages 공개 URL을 검증했다.
- 알려진 임시 파일 삭제와 `<RUN_DIR>`의 `rmdir`가 성공했다.

## 관련 파일

- `scripts/position-recommender/live-postings/adapters/`
  - 소스별 수집 어댑터
- `scripts/position-recommender/live-postings/contracts.ts`
  - 외부 공고와 후보풀의 Zod 스키마
- `scripts/position-recommender/recommendation_schema.ts`
  - 추천 결과의 Zod 스키마
- `scripts/position-recommender/validate_recommendation.ts`
  - 후보 ID와 공고 원문 대조
- `references/position-decision-criteria.md`
  - 모델의 판단 기준
