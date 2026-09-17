---
name: position-recommender
description: 열려 있는 채용공고를 모아 후보자가 해온 일과 선호에 얼마나 맞는지 판단하고, 재사용 가능한 공고 분석과 대기·수집 경고를 담은 리포트를 만든다. "지원할 포지션 추천", "갈 만한 회사 찾아줘", "최신 백엔드 공고 분석", "이직 후보 추천"처럼 실제 공고 탐색과 지원 판단이 필요할 때 사용한다.
---

# position-recommender

열려 있는 공고를 수집하고 Backend가 고른 최대 20건만 분석한다.
본문과 후보자 기준이 같은 과거 분석은 재사용하며, 아직 분석하지 못한 공고와 부분 실패한 소스를 결과에 표시한다.

명령은 저장소 루트에서 실행한다.
실행별 후보풀, 분석 큐, 추천 JSON과 HTML은 시스템 임시 디렉터리인 `<RUN_DIR>`에 만들고 검증이 끝나면 정리한다.
Backend 장애가 발생하면 파일 이력으로 자동 전환하지 않고 실행을 중단한다.

## 최초 설정과 회사 정책 변경

다음 명령은 일일 추천 실행에 포함하지 않는다.
최초 설정이나 사람이 회사 우선순위와 제외 여부를 바꿀 때만 명시적인 JSON 입력으로 실행한다.

```bash
bun career-os/scripts/position-recommender/configure_position_company_preferences.ts \
  --input <회사-정책.json>
```

명령은 회사명을 Backend와 같은 방식으로 정규화하고 `tier` 1부터 3과
`analyze` 또는 `exclude`만 반영한다.
기존 개인 제외 설정을 자동으로 읽거나 바꾸지 않는다.
stdout에는 반영·제외·tier별 건수만 출력한다.

## 실행 준비

`mktemp -d`로 `<RUN_DIR>`을 만들고 회사 조사 파일이 있는 비공개 작업 release를 준비한다.

```bash
bun career-os/scripts/career-workspace/cli.ts skill begin position-recommender --json
```

`CAREER_RECOMMENDATION_API_URL`과 `CAREER_RECOMMENDATION_API_TOKEN` 또는 mode 600인
`CAREER_RECOMMENDATION_API_TOKEN_FILE` 중 하나가 필요하다.
준비 명령이나 API 인증 확인이 실패하면 추천 실행을 중단하고 반환된 복구 정보를 따른다.

## 공고 수집과 분석 큐 준비

```bash
bun career-os/scripts/position-recommender/collect_live_postings.ts \
  --output <RUN_DIR>/posting-candidates.json

bun career-os/scripts/position-recommender/prepare_position_analysis.ts \
  --candidates <RUN_DIR>/posting-candidates.json \
  --output <RUN_DIR>/analysis-queue.json \
  --contract-version 1
```

개인 제외 규칙은 외부 수집 결과가 Backend와 모델에 전달되기 전에 적용한다.
준비 명령은 전체 후보풀을 Backend에 한 번 전달하지만 stdout에는 후보 본문을 출력하지 않는다.
`analysis-queue.json`에는 Backend가 회사 tier, 분석 상태와 대기 시간으로 고른 공고만 상세 본문과 함께 들어 있다.

## 선택된 공고 분석

큐가 비어 있으면 모델 분석과 회사 조사를 모두 생략한다.
큐가 있으면 `brain-search`로 현재 역할 기준과 이직 우선순위를 확인하고 큐에 든 공고만 분석한다.
구체적인 프로젝트 근거는 읽기 전용인 `sources/fos-study/task/`에서 확인한다.

`state/company-research/`에서는 선택된 공고 회사의 유효한 사실만 읽는다.
추천 판단에 영향을 주지만 없거나 만료된 공개 사실만 조사한다.
새 사실과 추론이 있으면 `<RUN_DIR>/company-research-updates.json`을 만든 뒤 다음 명령으로 합친다.

```bash
bun career-os/scripts/position-recommender/company_research.ts \
  --input <RUN_DIR>/company-research-updates.json
```

각 큐 항목에 역할 적합도 40점, 역할 범위와 성장 여지 25점, 회사 기회 20점,
제약이 적은 정도 15점을 평가한다.
합계는 `fitScore`와 같아야 하며 결론은 `recommend`, `consider`, `hold` 중 하나다.
큐의 모든 `positionId`를 한 번씩 담은 `<RUN_DIR>/analysis-updates.json`을 만들고 반영한다.

```bash
bun career-os/scripts/position-recommender/commit_position_analysis.ts \
  --queue <RUN_DIR>/analysis-queue.json \
  --input <RUN_DIR>/analysis-updates.json
```

반영 충돌이나 누락 분석은 고쳐서 같은 멱등 요청으로 다시 시도한다.

## 추천 최종화

다음 명령 한 번으로 Backend 추천 응답, 추천 JSON, HTML과 공개 계약을 검증한다.

```bash
bun career-os/scripts/position-recommender/finalize_position_recommendation.ts \
  --analysis-run-id <analysisRunId> \
  --output-json <RUN_DIR>/recommendation.json \
  --output-html <RUN_DIR>/index.html
```

HTML은 추천, 분석한 활성 공고 순위, 분석 대기와 수집 경고를 구분한다.
수집 경고에는 소스명, `partial` 또는 `failed` 상태와 실패 건수만 표시한다.
원본 오류 메시지와 URL 목록, 비공개 회사 제외 사유, 현재 보상과 로컬 환경 식별자를 넣지 않는다.

## 비공개 작업 반영과 결과 전달

회사 조사 파일을 바꿨다면 검증 뒤 기존 release에 반영한다.
포지션 분석 이력은 Backend와 MySQL만 관리하며 S3 release에 복제하지 않는다.

```bash
bun career-os/scripts/career-workspace/cli.ts skill finish position-recommender --json
```

브라우저에서 데스크톱과 모바일 배치, 가로 넘침과 주요 링크를 확인한다.
사용자가 공유 링크를 요청했을 때만 `report-publisher`로 HTML을 게시한다.

최종 답변에는 로컬 HTML 또는 검증된 공개 링크와 함께 다음 집계를 전달한다.

- 이번 실행 분석, 재사용과 분석 대기 건수
- 개인 제외 건수
- 부분 실패 또는 실패 소스와 실패 건수
- 바로 검토할 공고와 다음 지원 행동

검증과 전달이 끝나면 `<RUN_DIR>`을 삭제한다.
