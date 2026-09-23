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

`mktemp -d`로 `<RUN_DIR>`을 만든다.

`CAREER_RECOMMENDATION_API_URL`과 `CAREER_RECOMMENDATION_API_TOKEN` 또는 mode 600인
`CAREER_RECOMMENDATION_API_TOKEN_FILE` 중 하나가 필요하다.
API 인증 확인이 실패하면 추천 실행을 중단하고 반환된 복구 정보를 따른다.

## 공고 수집과 1단계 큐 준비

```bash
bun career-os/scripts/position-recommender/collect_live_postings.ts \
  --output <RUN_DIR>/posting-candidates.json

bun career-os/scripts/position-recommender/prepare_position_analysis.ts \
  --candidates <RUN_DIR>/posting-candidates.json \
  --company-tier-queue-output <RUN_DIR>/company-tier-queue.json \
  --analysis-queue-output <RUN_DIR>/analysis-queue.json \
  --contract-version 1
```

개인 제외 규칙은 외부 수집 결과가 Backend와 모델에 전달되기 전에 적용한다.
준비 명령은 전체 후보풀을 Backend에 한 번 전달하지만 stdout에는 후보 본문을 출력하지 않는다.
이 명령은 평가할 회사가 있으면 `<RUN_DIR>/company-tier-queue.json`만 남기고 공고 분석 큐는 아직 만들지 않는다.
평가할 회사가 없으면 회사 tier 평가를 생략하고 바로 공고 분석 run을 요청해 `<RUN_DIR>/analysis-queue.json`을 남긴다.
어느 파일이 생겼는지로 다음 절을 회사 tier 평가부터 시작할지 공고 분석부터 시작할지 정한다.

## 회사 tier 평가

`<RUN_DIR>/company-tier-queue.json`이 없으면 이 절 전체를 생략하고 바로 「선택된 공고 분석」으로 넘어간다.

파일이 있으면 큐에 선택된 회사만 평가한다.
추천 판단에 영향을 주지만 없거나 만료된 사실만 새로 조사한다.

회사별 공개 사실은 Backend 가 담는다.
`GET api/positions/v1/companies/:companyKey/evidence` 가 유효기간이 남은 근거만 돌려주고,
새로 모은 근거는 `PUT api/positions/v1/company-tier-runs/:companyTierRunId/evidence` 로 저장한다.
`career-os/scripts/position-recommender/recommendation-api/client.ts` 의
`getCompanyEvidence` 와 `putCompanyEvidence` 가 이 둘을 부른다.

각 회사마다 성장 범위, 보상 상승, 팀 성장 세 기회 축을 평가한다.
근거가 없는 축은 지어내지 않고 `unknown`으로 남기며, 그 위에서 종합 tier 1부터 3과 신뢰도를 정한다.
근거 URL은 HTTPS만 쓰고 확인 시각을 함께 남긴다.
평가하지 못한 회사는 `posting_body_missing` 대신 `research_unavailable`, `model_unavailable`,
`contract_rejected`, `internal_error` 중 하나의 사유로 `failures`에 넣어 전체 run을 끝낼 수 있게 한다.
`<RUN_DIR>/company-tier-updates.json`에 `results`와 `failures`를 한 번씩 나눠 담는다.

```bash
bun career-os/scripts/position-recommender/complete_company_tier_assessment.ts \
  --queue <RUN_DIR>/company-tier-queue.json \
  --input <RUN_DIR>/company-tier-updates.json \
  --analysis-queue-output <RUN_DIR>/analysis-queue.json
```

이 명령 하나가 평가 결과를 Backend에 반영하고, run이 `completed` 또는 `partial`이면
이어서 공고 분석 run을 요청해 `<RUN_DIR>/analysis-queue.json`을 남긴다.
stdout에는 회사명, 후보자 기준, 평가 이유를 출력하지 않고 상태별 건수와 임시 파일 경로만 출력한다.
회사 tier는 `company_preferences`에 쓰지 않으며, 반영 전에 사용자 승인을 기다리지 않는다.

## 선택된 공고 분석

`<RUN_DIR>/analysis-queue.json`의 큐가 비어 있으면 모델 분석을 생략한다.
큐가 있으면 `brain-search`로 현재 역할 기준과 이직 우선순위를 확인하고 큐에 든 공고만 분석한다.
구체적인 프로젝트 근거는 읽기 전용인 `sources/fos-study/task/`에서 확인한다.

각 큐 항목에 역할 적합도 40점, 역할 범위와 성장 여지 25점, 회사 기회 20점,
제약이 적은 정도 15점을 평가한다.
합계는 `fitScore`와 같아야 하며 결론은 `recommend`, `consider`, `hold` 중 하나다.
큐에서 `resultStatus`가 `pending` 또는 `failed`인 모든 `positionId`를 한 번씩 담는다.
분석한 공고는 `results`에, 판단할 내용이 없거나 모델 호출이 실패한 공고는 사유와 함께 `failures`에 넣는다.
사유는 `posting_body_missing`, `model_unavailable`, `contract_rejected`, `internal_error` 중 하나다.

```bash
bun career-os/scripts/position-recommender/commit_position_analysis.ts \
  --queue <RUN_DIR>/analysis-queue.json \
  --input <RUN_DIR>/analysis-updates.json
```

반영 결과의 `status`가 `partial`이면 남은 공고만 다시 담아 같은 명령을 다시 실행한다.
멱등 키는 명령이 본문에서 만들므로 손으로 정하지 않는다.

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
공고 항목마다 `Tier 1 · 모델 평가`, `Tier 2 · 사람 override`, `Tier 3 · 기본값`처럼
회사 tier 값과 출처를 함께 표시하고, 모델 평가에는 요약 이유와 신뢰도, HTTPS 근거를 연결한다.
추천 요약에는 기본 tier로 남은 건수와 회사 tier 평가 실패 건수도 함께 보여준다.
후보자 기준과 개인 판단 근거는 공개 HTML에 넣지 않는다.
같은 명령이 최종 답변에 넣을 수집 경고 줄을 `collectionWarnings`로 함께 출력한다.
원본 오류 메시지와 URL 목록, 비공개 회사 제외 사유, 현재 보상과 로컬 환경 식별자를 넣지 않는다.
분석하지 못한 공고가 있으면 실행 결과에 그 건수를 포함한다.
실패 사유 원문과 모델 응답 전문은 공개 HTML에 넣지 않는다.
소스 수집 경고와 회사 tier 평가 실패는 서로 다른 항목으로 표시하며 하나로 합치지 않는다.

## 결과 전달

포지션 분석 이력과 회사 근거는 Backend와 MySQL만 관리하며 S3 release에 복제하지 않는다.

브라우저에서 데스크톱과 모바일 배치, 가로 넘침과 주요 링크를 확인한다.
사용자가 공유 링크를 요청했을 때만 `report-publisher`로 HTML을 게시한다.

## 최종 답변

이 절이 최종 답변 형식을 정한다.
cron 실행과 수동 실행에 모두 이 형식을 적용한다.
job 지시문이 더 짧은 형식을 정하고 있어도 아래 항목은 빼지 않는다.

최종 답변에는 로컬 HTML 또는 검증된 공개 링크와 함께 다음 집계를 전달한다.

- 이번 실행 분석, 재사용과 분석 대기 건수
- 분석하지 못한 공고 건수
- 개인 제외 건수
- 회사 tier 출처별 건수와 회사 tier 평가 실패 건수
- 최종화 명령이 출력한 `collectionWarnings`의 각 줄
- 바로 검토할 공고와 다음 지원 행동

`collectionWarnings`는 최종화 명령이 만들므로 문구를 새로 쓰지 않고 그대로 옮긴다.
소스명, `partial` 또는 `failed` 상태, 실패 건수와 후보 누락 가능성 한 줄만 들어 있다.
원본 오류 문구, URL, 내부 경로와 token은 이 줄에 들어오지 않으며 최종 답변에도 넣지 않는다.
배열이 비어 있으면 수집 경고 줄을 만들지 않는다.

검증과 전달이 끝나면 `<RUN_DIR>`을 삭제한다.
