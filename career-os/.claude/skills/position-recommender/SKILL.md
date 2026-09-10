---
name: position-recommender
description: 현재 경력과 열린 외부 채용공고를 비교해 지원 우선순위를 자유형 HTML로 만든다. "지원할 포지션 추천", "갈 만한 회사 찾아줘", "최신 백엔드 공고 분석", "이직 후보 추천"처럼 실제 공고 탐색과 지원 판단이 필요할 때 사용한다. 외부 게시는 사용자가 공유 링크를 요청했을 때만 수행한다.
---

# 포지션 추천

새 공고를 수집한 뒤 현재 커리어와 비교해 지원 우선순위를 정한다.
스크립트는 수집, 결정적 필터, 데이터 검증과 공개 안전을 맡고 모델은 적합도와 보고서 구성을 판단한다.

## 판단 경계

- 소스 adapter는 상세 요청을 줄이는 사전 선별과 소스 고유 상태 확인을 맡는다.
- 공통 eligibility 정책은 개별 공고 URL, 열린 상태, 마감, 고용 형태와 목표 직무 경계를 모든 소스에 동일하게 적용한다.
- 개인 공고·회사 제외 규칙은 다음 실행의 후보풀에서 제거한다.
- 모델은 남은 전체 후보의 적합도, 성장 가능성, 위험과 우선순위를 판단한다.
- 회사나 포지션의 가치 판단을 일반 키워드 정책에 넣지 않는다. 검증된 자동 제외 제안으로 기록한다.

정책 상수는 `scripts/position-recommender/live-postings/policy/keywords.ts`에서 바꾼다.
판정 로직은 같은 `policy/` 아래에 있고, 공통 문자열과 날짜 처리는 `scripts/lib/`를 사용한다.

## 입력

1. `brain-search`로 현재 경력, 역할 선호, 지원 이력과 재지원 간격을 확인한다.
2. [`references/position-decision-criteria.md`](references/position-decision-criteria.md)를 읽는다.
3. 세부 근거가 필요할 때만 `sources/fos-study/`와 실제 프로젝트 기록을 확인한다. 이 경로는 읽기 전용이다.

확인하지 못한 사실은 추정하지 않고 `확인 필요` 또는 `정보 없음`으로 남긴다.

## 실행

### 1. 실행 경로와 비공개 상태 준비

시스템 임시 디렉터리에 실행 전용 경로를 만든다.

```bash
mktemp -d "${TMPDIR:-/tmp}/position-recommender.XXXXXX"
```

반환된 절대 경로를 `<RUN_DIR>`로 사용한다.
비공개 상태 준비가 실패하면 오래된 제외 규칙으로 진행하지 않는다.

```bash
CAREER_WORKSPACE_ROOT="$(git rev-parse --show-toplevel)/career-os" \
  bun "$(git rev-parse --show-toplevel)/career-os/scripts/career-workspace/cli.ts" \
  skill begin position-recommender --json
```

### 2. 공고 수집

```bash
bun "$(git rev-parse --show-toplevel)/career-os/scripts/position-recommender/collect_live_postings.ts" \
  --output <RUN_DIR>/posting-candidates.json
```

종료 코드와 `WARN collection health`, `FAIL collection health`를 확인한다.

| 종료 코드 | 뜻               | 처리                                      |
| --------- | ---------------- | ----------------------------------------- |
| 0         | 후보풀 생성 성공 | 경고가 있으면 누락 소스를 알리고 계속한다 |
| 1         | 수집 건전성 실패 | 실패 소스를 단독 재확인하고 원인을 고친다 |
| 2         | 잘못된 인자      | 명령을 고쳐 다시 실행한다                 |

단독 재확인은 같은 명령에 `--source <소스> --output <RUN_DIR>/probe.json`을 사용한다.
설정 오류인 `FAIL position exclusions`는 복구하기 전까지 후속 단계를 중단한다.

후보풀은 다음 조건을 만족해야 한다.

- 이번 실행의 `collectedAt`과 한 건 이상의 `candidates`가 있다.
- 후보는 `direct_posting`이며 상태가 `active` 또는 `open`이다.
- 마감이 지나지 않았다.

### 3. 모델 판단

후보풀과 현재 커리어 근거를 한 번의 일관된 판단 흐름에서 비교한다.
후보마다 별도 에이전트 호출을 반복하지 않고, 공개 자료 확인이 필요하면 회사·직무별 요청을 묶는다.
이미 읽은 후보풀과 동일한 근거를 도구 호출마다 다시 출력하지 않는다.

추천 결과는 `scripts/position-recommender/recommendation/schema.ts`의 `schemaVersion: 5`에 맞춰
`<RUN_DIR>/recommendation.json`에 쓴다.

판단할 내용은 다음과 같다.

- 필수 자격과 실제 후보자 근거의 연결
- 역할에서 얻을 기술적 성장과 준비 가능한 격차
- 경력 수준, 고용 형태, 사업·업무 불확실성
- 지원 이력, 재지원 간격과 마감 시급성
- 현재 직장 대비 `문제의 난도`, `오너십과 파는 깊이`, `도메인 확장 여지`, `보상`

네 업사이드 축은 각각 `상향`, `동일`, `하향`, `확인 필요`로 판정하고 공고나 회사 공개 자료의 근거를 적는다.
`candidateRanking`에는 후보풀의 모든 공고를 한 번씩 넣고 순위를 1부터 이어 쓴다.
강력·도전 추천은 기준을 통과한 공고만 넣으며 정해진 개수를 채우지 않는다.

다음 수집에서 제외할 후보는 `autoExclusionSuggestions`에 둔다.

- 정보 부족이나 낮은 순위만으로 제외하지 않는다.
- 네 축에 상향이 없고 명확한 하향이 하나 이상일 때만 제외한다.
- 공고 범위는 해당 `candidateId`에만 적용한다.
- 회사 범위는 모든 직무에 적용되는 판단이어야 하며 독립된 공개 근거 URL을 두 개 이상 둔다.

### 4. 검증과 제외 규칙 반영

```bash
bun "$(git rev-parse --show-toplevel)/career-os/scripts/position-recommender/validate_recommendation.ts" \
  --input <RUN_DIR>/recommendation.json \
  --candidates <RUN_DIR>/posting-candidates.json
```

검증기는 후보 ID와 원문 필드, 수집 실행 ID, 전체 순위와 자동 제외 조건을 확인한다.
실패하면 JSON만 고치고 수집부터 반복하지 않는다.

```bash
bun "$(git rev-parse --show-toplevel)/career-os/scripts/position-recommender/apply_exclusion_suggestions.ts" \
  --input <RUN_DIR>/recommendation.json \
  --candidates <RUN_DIR>/posting-candidates.json
```

반영 뒤 비공개 release를 완료한다.
실패하면 로컬 설정을 지우지 않고 충돌과 보존 사실을 알린다.

```bash
CAREER_WORKSPACE_ROOT="$(git rev-parse --show-toplevel)/career-os" \
  bun "$(git rev-parse --show-toplevel)/career-os/scripts/career-workspace/cli.ts" \
  skill finish position-recommender --json
```

### 5. 자유형 HTML 생성

모델은 그날 데이터에 맞는 정보 구조와 시각 구성을 선택해 `<RUN_DIR>/index.html` 하나를 만든다.
고정된 절 이름, 카드 개수와 문장 틀을 반복하지 않는다.
HTML에는 지원 순위와 근거, 위험, 확인할 사항, 다음 행동과 공개 공고 링크가 드러나야 한다.

다음 검사만 고정 계약으로 둔다.

```bash
bun "$(git rev-parse --show-toplevel)/career-os/scripts/position-recommender/render/validate-report-html.ts" \
  --html <RUN_DIR>/index.html \
  --input <RUN_DIR>/recommendation.json
```

모델 HTML이 유효하지 않을 때만 고정 템플릿 대체 렌더를 실행하고 다시 검사한다.

```bash
bun "$(git rev-parse --show-toplevel)/career-os/scripts/position-recommender/render_candidate_preview.ts" \
  --input <RUN_DIR>/recommendation.json \
  --candidates <RUN_DIR>/posting-candidates.json \
  --limit all \
  --output <RUN_DIR>/index.html
```

### 6. 확인, 게시와 정리

브라우저에서 데스크톱과 모바일 배치, 가로 넘침과 주요 링크를 확인한다.
사용자가 공유 URL을 요청했을 때만 `report-publisher`로 공개 범위를 검사하고 Cloudflare Pages에 게시한다.

최종 응답 전 이번 실행에서 만든 파일을 정확히 확인해 삭제하고 빈 `<RUN_DIR>`을 `rmdir`로 제거한다.
공개 Pages 배포와 비공개 release는 삭제하지 않는다.

## 완료 조건

- 새 후보풀과 추천 JSON의 정합성 검사가 통과했다.
- 자동 제외는 상향 없음과 명확한 하향 근거 조건을 만족한다.
- 자유형 HTML의 링크와 공개 안전 검사가 통과했다.
- 게시를 요청한 경우 공개 URL의 HTTP 응답과 실제 화면을 확인했다.
- 임시 실행 파일을 정리했다.

## 유지보수 위치

| 변경하려는 내용                   | 위치                                                            |
| --------------------------------- | --------------------------------------------------------------- |
| 소스별 API와 원문 정규화          | `scripts/position-recommender/live-postings/adapters/`          |
| 목표·제외 키워드                  | `scripts/position-recommender/live-postings/policy/keywords.ts` |
| 역할·분류·마감 판정               | `scripts/position-recommender/live-postings/policy/`            |
| 모든 소스의 최종 eligibility      | `scripts/position-recommender/live-postings/validator.ts`       |
| 개인 공고·회사 제외               | `scripts/position-recommender/feedback/`                        |
| 추천 결과 계약                    | `scripts/position-recommender/recommendation/schema.ts`         |
| 자유형 HTML 안전 검사와 대체 렌더 | `scripts/position-recommender/render/`                          |
| 공통 CLI·텍스트·날짜 유틸         | `scripts/lib/`                                                  |
