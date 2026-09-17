# 포지션 추천 입력 토큰 조사와 절감 설계안

작성일은 2026-09-17이다.
이 문서는 `position-recommender`의 입력 토큰이 3,460,816까지 늘어난 원인을 실측으로 좁히고,
구현 전에 비교할 절감안을 정리한다.
이번 조사에서는 코드를 바꾸지 않았고 `fos-assistant` 저장소도 수정하지 않았다.

## 핵심 판단

- 3,460,816 입력 토큰은 후보풀 JSON 하나의 크기가 아니다.
  Hermes가 사용자 요청 하나를 처리하면서 모델 API를 51회 호출했고,
  매 호출에 커진 대화 기록을 다시 전달한 합계다.
- 전체 입력 중 3,350,528토큰인 96.8%가 cache read였다.
  새 입력은 110,288토큰이었으므로 같은 앞부분을 반복해서 전달한 것이 비용의 대부분이다.
- career profile의 고정 system prompt는 22,799자이고 도구 정의는 31,147바이트다.
  한 문장만 답한 비교 실행은 입력 12,388토큰이었으므로,
  고정 입력보다 279배 커진 주된 이유는 51회 호출과 누적 대화 기록이다.
- 후보풀 전체 파일이 매번 모델 입력에 직접 들어간 것은 아니다.
  임시 파일은 도구가 읽었고 모델 기록에는 122건의 짧은 목록 10,576자,
  고른 16건의 상세 내용 30,076자와 일부 파일 읽기 결과가 남았다.
  이 결과들이 이후 호출의 대화 기록에 계속 포함된 것은 확인했다.
- 추천 JSON 검증이 끝난 뒤에도 HTML 생성, 브라우저 확인, 게시 준비,
  게시 검증, 작업 release 반영과 임시 파일 정리로 모델을 16회 더 호출했다.
  이 구간의 입력 합계는 1,759,795토큰으로 전체의 50.8%다.
- 따라서 공고를 저장하고 필요한 행만 조회하는 설계와 함께,
  추천 판단이 끝난 뒤의 작업을 한두 개 명령으로 묶어 모델 왕복을 줄여야 한다.
- 수집 실패는 현재 최종 결과에서 보이지 않는다.
  2026-09-17 재실행에서는 쿠팡 상세 62건이 HTTP 429로 실패했지만,
  추천 JSON과 HTML 스키마는 이 진단을 전달하지 않고 렌더러는 `sourceDiagnosticsHtml`에 빈 문자열을 넣는다.

## 권장 구조

Backend 구현과 HTTP·DB 계약은 `career-os`가 담당한다.
포지션과 학습자료의 수집·분석·추천 상태는 홈서버 MySQL의 `fos_career`에 저장하고,
skill과 cron은 DB에 직접 연결하지 않고 작은 HTTP Backend만 호출한다.

저장소별 책임은 다음처럼 나눈다.

| 저장소 | 책임 |
| --- | --- |
| `career-os` | Bun HTTP Backend, `fos_career` migration, 포지션과 학습자료 API, 도메인 검증, API client |
| `fos-home-infra` | database와 최소 권한 계정 생성, container 배포, 비밀 값, healthcheck, backup과 rollback |
| `fos-blog` | 기존 study API 소비자 전환, 전환 검증 뒤 study table과 server route 제거 |

Backend는 기존 Bun과 Zod를 유지하고 MySQL 접근에는 Bun 내장 `Bun.SQL`을 사용한다.
별도 ORM과 외부 queue는 추가하지 않는다.
단일 사용자 cron은 동기 HTTP 요청, 멱등 키와 DB 트랜잭션으로 처리한다.

포지션 데이터는 공고, 공고 버전, 개인 분석과 추천 실행을 분리한다.
같은 공고라도 본문 hash가 달라지면 새 버전이고,
본문 hash, 후보자 기준 버전, 분석 계약 버전과 유효기간이 모두 맞는 분석만 재사용한다.
주관적인 점수와 이유를 공고 원문 행에 함께 저장하지 않는다.

매일 분석 큐는 기본 20건으로 제한한다.
16건은 사용자가 정한 회사 티어와 `미분석`, `본문 변경`, `분석 만료` 순서로 고르고,
4건은 회사 티어와 무관하게 오래 기다린 순서로 고른다.
보고 싶지 않은 회사는 낮은 티어로 두지 않고 명시적 제외 규칙으로 수집 직후 제거한다.

학습자료는 `fos-blog`에 설계한 source, cursor, material, tag, 개인 상태,
추천 실행, 게시 이력과 요청 중복 방지 관계를 `fos_career`로 옮겨 재사용한다.
현재 운영 study table은 모두 0행이므로 데이터 복사는 필요하지 않다.
다만 새 API와 client 전환을 검증하기 전에는 기존 table을 제거하지 않는다.

## 조사 범위와 근거

홈서버의 career profile에서 다음 자료를 읽기 전용으로 확인했다.

- SQLite 상태 DB의 `sessions`, `messages`
- `logs/agent.log`
- 2026-09-17 `fos_career` 스키마 백업
- 이 저장소의 [`position-recommender` 지침](../.claude/skills/position-recommender/SKILL.md)
- 수집, 추천 검증과 HTML 렌더 코드

대상 실행은 2026-09-17 08:55:18 UTC에 시작해 09:05:18 UTC에 사용자 응답을 끝냈다.
Hermes DB의 세션 제목은 `지원할 포지션 추천`이며 모델은 `gpt-5.6-sol`이다.

## 후보풀 크기 실측

홈서버의 현재 `career-os` 작업본과 비공개 제외 규칙을 그대로 사용해 다음 수집기를 다시 실행했다.
산출물은 컨테이너의 시스템 임시 디렉터리에 만들고 측정 뒤 삭제했다.

```bash
bun career-os/scripts/position-recommender/collect_live_postings.ts \
  --output <RUN_DIR>/posting-candidates.json
```

| 항목 | 실측값 |
| --- | ---: |
| 수집기 종료 코드 | 0 |
| 최종 후보 | 105건 |
| 후보풀 JSON | 406,092바이트 |
| 후보 1건당 파일 평균 | 3,867.54바이트 |
| 후보풀 `errors` 배열 | 63건 |
| 쿠팡 상세 실패 | 62건 |

후보 1건당 평균은 후보풀 전체 파일 바이트를 후보 수로 나눈 값이다.
따라서 실행 메타데이터, 소스 진단, 오류 배열과 JSON 들여쓰기까지 포함한다.

같은 날 이 worktree에서 빈 개인 제외 규칙으로 실행한 교차 확인 값은
109건, 422,628바이트, 후보 1건당 3,877.32바이트였다.
두 실행의 후보당 평균 차이는 9.78바이트로 작았다.

대상 Hermes 실행의 122건 후보풀은 실행 종료 때 삭제됐다.
따라서 그 파일의 정확한 바이트는 재지 못했다.
105건 재실행 값을 122건으로 단순 환산하면 실제 파일의 진단과 오류 개수를 무시하게 되므로 환산값을 쓰지 않는다.

## 실제 턴 수

Hermes는 턴을 한 숫자로만 기록하지 않는다.
사용자 대화 턴, 모델 API 호출과 도구 사용 턴을 구분해야 한다.

| 구분 | 실측값 | 확인 방법 |
| --- | ---: | --- |
| 사용자 요청 | 1회 | `messages`의 `role=user` 행 |
| 모델 API 호출 | 51회 | `sessions.api_call_count=51`, `assistant` 메시지 51행 |
| 도구 사용 턴 | 50회 | `agent.log`의 `tool_turns=50` |
| 도구 결과 | 90개 | `messages`의 `role=tool` 행 |
| 허용 한도 | 60회 | `agent.log`의 `api_calls=51/60`, profile의 `max_turns=60` |

`agent.log`의 종료 행은 다음 상태를 기록한다.

```text
Turn ended: ... api_calls=51/60 budget=50/60 tool_turns=50 ...
```

사용자 응답이 끝난 직후 Hermes의 자동 background review가 모델을 5회 더 호출했다.
이 별도 작업은 입력 601,041토큰과 출력 1,817토큰을 사용했지만,
세션의 3,460,816 입력 토큰과 15,301 출력 토큰에는 포함되지 않았다.
따라서 사용자에게 보였던 사용량은 주 실행 51회만의 합계다.

## 3,460,816 입력 토큰의 생성 경로

Hermes의 각 `API call` 로그에는 해당 요청의 전체 입력과 cache read가 함께 기록된다.
51개 로그를 더하면 세션 DB 값과 정확히 일치한다.

| 항목 | 토큰 | 비율 |
| --- | ---: | ---: |
| 전체 입력 | 3,460,816 | 100.0% |
| cache read | 3,350,528 | 96.8% |
| cache에 없던 입력 | 110,288 | 3.2% |
| 출력 | 15,301 | 입력과 별도 |

첫 호출 입력은 12,382토큰이었고 마지막 호출 입력은 115,063토큰이었다.
호출 하나의 평균 입력은 67,859토큰이다.
고정 system prompt와 도구 정의 위에 사용자 메시지, assistant의 도구 호출,
도구 결과와 이후 생성물이 누적되면서 마지막 입력이 첫 입력의 9.3배가 됐다.

한 문장 비교 실행의 입력 12,388토큰과 비교하면 전체 입력은 279.4배다.
사용자가 제시한 입력 100만 토큰당 4달러와 출력 100만 토큰당 20달러를 적용하면
주 실행 비용은 14.15달러다.

### 실행 구간별 입력

| API 호출 | 실행 내용 | 입력 토큰 | 전체 비율 |
| --- | --- | ---: | ---: |
| 1-5 | skill 확인, 작업 준비, 공고 수집 | 69,697 | 2.0% |
| 6-10 | 저장소와 후보자 자료 탐색 | 89,608 | 2.6% |
| 11-19 | 후보풀 일부, 상태와 경력 자료 확인 | 320,844 | 9.3% |
| 20-26 | 122건 짧은 목록과 기존 회사 조사 확인 | 364,811 | 10.5% |
| 27-35 | 16건 상세 조회, 회사 조사와 추천 JSON 생성 | 856,061 | 24.7% |
| 36-51 | 렌더, 검증, 게시, release 반영과 정리 | 1,759,795 | 50.8% |

추천 JSON은 API 호출 35 뒤에 후보풀과 일치한다는 검증을 통과했다.
그 뒤의 16회 호출은 이미 커진 103,557-115,063토큰 입력을 반복해서 전달했다.
후보 분석 자료가 필요하지 않은 후처리에서도 앞선 기록이 계속 포함된 것이다.

### 후보풀 반복 가설의 확인 범위

가설은 일부만 맞다.

전체 `posting-candidates.json` 122건이 매 호출마다 도구 결과로 다시 실린 것은 아니다.
대상 실행은 임시 TypeScript를 만들어 다음 정보만 출력했다.

| 모델 기록에 들어간 후보 정보 | 크기 |
| --- | ---: |
| `read_file`로 읽은 후보풀 일부 | 15,803자 |
| 122건의 ID, 회사, 공고명과 마감일 목록 | 10,576자 |
| 고른 16건의 상세 공고 | 30,076자 |

이 세 결과와 다른 도구 결과는 메시지 기록에 남아 이후 API 호출에 포함됐다.
세션의 도구 결과 본문은 모두 210,254자였고 assistant의 도구 호출 인자는 67,462자였다.
Hermes 로그는 메시지별 토큰 기여량을 기록하지 않으므로 후보 정보만의 정확한 토큰 합계는 분리할 수 없다.

실행 실패와 재시도도 호출 수를 늘렸다.
skill 이름 충돌, 없는 경로 검색, 차단된 `execute_code`, 승인 대기 명령,
설치되지 않은 `jq`, 임시 TypeScript 오류와 정리 명령 재시도가 대화 기록에 남았다.
전용 CLI가 있으면 이 탐색과 임시 스크립트 작성을 반복하지 않아도 된다.

## 최종 결과에서 보이지 않는 수집 실패

현재 후보풀은 `sourceDiagnostics`와 `errors`에 소스 상태를 저장한다.
재실행에서는 `coupang-careers`가 `partial`이었고 상세 후보 62건을 확인하지 못했다.
수집기는 허용 범위 안의 실패 소스 하나로 판정해 종료 코드 0을 반환했다.

다음 단계에서 이 정보가 사라진다.

1. [`recommendation/schema.ts`](../scripts/position-recommender/recommendation/schema.ts)의
   `sourceSnapshot`은 `collectionRunId`만 받는다.
2. [`recommendation-html.ts`](../scripts/position-recommender/render/recommendation-html.ts)는
   `sourceDiagnosticsHtml`에 빈 문자열을 넣는다.
3. [`validate-report-html.ts`](../scripts/position-recommender/render/validate-report-html.ts)는
   소스 실패가 화면에 있는지 검사하지 않는다.
4. 대상 실행의 최종 답변은 `활성 공고 122건을 전부 비교했어`라고만 썼다.

사용자는 최종 HTML과 답변만 보므로 쿠팡 공고가 누락될 수 있다는 사실을 알 수 없다.
절감안을 구현할 때 소스별 성공, 실패와 확인하지 못한 후보 수를 추천 JSON과 HTML에 전달해야 한다.

## 절감안 비교

### 안 A. 전용 후처리 명령과 선택 조회를 먼저 추가

현재 파일 기반 구조를 유지하면서 모델이 임시 코드를 만들지 않도록 전용 명령을 둔다.

1. 전체 후보는 ID, 회사, 공고명, 마감일, 핵심 기술만 담은 짧은 색인으로 한 번 읽는다.
2. 모델이 고른 ID만 전용 조회 명령으로 상세 내용을 가져온다.
3. 추천 JSON 검증 뒤의 렌더, HTML 검증, release 반영 준비와 정리를 전용 명령으로 묶는다.
4. 게시 결과 확인만 모델에게 돌려주고 후보 상세 내용은 후처리 단계의 새 입력에 넣지 않는다.

**예상 효과는 첫 실행부터 크다.**
추천 검증 뒤 구간만 현재 입력의 1,759,795토큰인 50.8%를 차지했다.
이 수치는 절감량이 아니라 전용 후처리 명령이 줄일 수 있는 현재 구간의 크기다.
대체 명령을 호출하고 결과를 확인하는 입력은 남으므로 실제 절감량은 구현 뒤 재야 한다.

122건의 짧은 목록은 이미 10,576자에 만들 수 있었다.
전체 후보를 비교한다는 현재 결정은 유지하면서 상세 본문은 상위 후보만 읽을 수 있다.

변경 후보 파일은 다음과 같다.

- [`.claude/skills/position-recommender/SKILL.md`](../.claude/skills/position-recommender/SKILL.md)
- `scripts/position-recommender/prepare_candidate_index.ts` 신규
- `scripts/position-recommender/select_candidate_details.ts` 신규
- `scripts/position-recommender/finalize_recommendation.ts` 신규
- [`validate_recommendation.ts`](../scripts/position-recommender/validate_recommendation.ts)
- [`render_candidate_preview.ts`](../scripts/position-recommender/render_candidate_preview.ts)
- [`render/validate-report-html.ts`](../scripts/position-recommender/render/validate-report-html.ts)
- 위 명령의 회귀 테스트

이 안은 MySQL과 외부 서비스를 추가하지 않아
파일 기반 흐름을 정한 ADR-102와 충돌하지 않는다.

### 안 B. 공고 상태와 분석 결과를 버전이 있는 저장소에 재사용

사용자 가설처럼 공고를 누적 저장하고 모델은 필요한 공고만 조회한다.
토큰을 줄이는 핵심은 DB 자체가 아니라 선택 조회와 분석 결과의 무효화 조건이다.

공고 원문과 분석 결과는 분리한다.

| 데이터 | 필수 키와 무효화 조건 |
| --- | --- |
| 공고 | `source`, `identityHash`, 정규화 URL, 본문 hash, 활성 상태, 마지막 확인 시각 |
| 수집 실행 | 실행 ID, 소스별 상태, 수집·제외·실패 수, 오류 요약 |
| 후보 분석 | 공고 본문 hash, 후보자 문맥 hash, 판정 규칙 버전, 분석 시각, 요약과 위험 |
| 추천 실행 | 사용한 수집 실행, 분석 ID 목록, 전체 순서와 상세 추천 |

같은 공고라도 본문, 후보자의 우선순위나 판정 규칙이 바뀌면 과거 분석을 쓰지 않는다.
회사 조사는 기존 `state/company-research/`의 유효기간 규칙을 계속 사용한다.

매일 실행하는 현재 사용 방식에서는 이 안을 기본 구조로 삼는다.
기본 일일 분석 상한은 20건으로 두고, 16건은 회사 티어가 높은 순서로,
4건은 분석 대기 시간이 오래된 순서로 고른다.
같은 티어에서는 미분석, 공고 본문 변경, 분석 만료 순으로 처리한다.
한쪽 대상이 부족하면 다른 쪽이 남은 자리를 사용한다.

보고 싶지 않은 회사는 낮은 티어로 두지 않는다.
기존 `state/private-config/position-exclusions.json`의 `scope: company` 규칙으로
수집 단계에서 제외해 모델 입력과 추천 결과 모두에 넣지 않는다.
아직 분석하지 않은 공고는 전체 순위에 억지로 넣지 않고 `분석 대기`로 표시한다.

**예상 효과는 첫 실행에서는 중간, 반복 실행에서는 크다.**
첫 실행은 분석 cache가 없어 현재 후보를 판단해야 한다.
다음 실행부터 상세 분석 건수는 전체 후보 수가 아니라
`신규 공고 + 본문 변경 공고 + 후보자 문맥 변경으로 무효화된 공고`가 된다.
현재 105건 중 몇 건이 다음 실행에서 그대로 남는지 이 조사에서는 재지 않았으므로
구체적인 절감률은 제시하지 않는다.

career-os 안에서 먼저 구현하면 다음 파일을 건드린다.

- [`.claude/skills/position-recommender/SKILL.md`](../.claude/skills/position-recommender/SKILL.md)
- [`collect_live_postings.ts`](../scripts/position-recommender/collect_live_postings.ts)
- [`live-postings/contracts.ts`](../scripts/position-recommender/live-postings/contracts.ts)
- `services/recommendation-api/` 신규
- `services/recommendation-api/migrations/` 신규
- `scripts/position-recommender/recommendation-api/` 신규
- `scripts/position-recommender/candidate-analysis/` 신규
- [`recommendation/schema.ts`](../scripts/position-recommender/recommendation/schema.ts)
- [`validate_recommendation.ts`](../scripts/position-recommender/validate_recommendation.ts)
- [`docs/data-schema.md`](../docs/data-schema.md)
- [`docs/flow.md`](../docs/flow.md)
- [`docs/code-architecture.md`](../docs/code-architecture.md)
- 새 저장 결정을 설명할 ADR

파일 저장과 MySQL을 비교했고 MySQL을 선택했다.
`cache/`와 `state/` 파일은 단일 실행에는 단순하지만 cron 중복, 부분 반영,
조건 조회와 포지션·학습자료의 공통 조회를 별도로 구현해야 한다.
MySQL은 운영 요소가 늘어나지만 홈서버에 이미 운영 중인 MySQL이 있고,
두 추천 기능의 멱등성과 transaction을 같은 Backend에서 제공할 수 있다.

홈서버 스키마 덤프의 옛 `fos_career`에는 이미 다음 표가 있었다.

- `collected_positions`
- `collected_position_run_items`
- `position_collection_runs`
- `position_source_run_diagnostics`
- `position_recommendation_runs`
- `position_status_events`

`collected_positions`는 URL, 회사, 공고명, 기술, 본문, 활성 상태,
수집 진단과 `career_upside_*` 필드를 함께 담았다.
재사용한다면 주관적 분석 필드를 공고 행에 두지 말고
본문 hash와 후보자 문맥 hash를 키로 쓰는 별도 분석 표로 나누는 편이 안전하다.

MySQL 안은 `fos-assistant`가 아니라 `career-os`가 소유하는 작은 HTTP Backend로 구현한다.
`career-os/services/recommendation-api/`에 server, route, repository와 versioned SQL migration을 두고,
기존 position-recommender와 study-topic-recommender는 API client만 가진다.

홈서버 배포와 `fos-blog` 제거 작업은 저장소가 다르므로 별도 Orca 작업으로 나눈다.
`fos-home-infra` 작업은 database, 계정, network, 비밀 값, healthcheck와 backup을 담당하고,
`fos-blog` 작업은 새 study API 전환을 확인한 뒤 기존 schema와 route를 제거한다.

### 안 C. 추천 단계를 독립된 짧은 모델 작업으로 분리

수집과 후보 색인, 상세 후보 분석, 최종 종합과 게시 준비를 서로 다른 짧은 입력으로 실행한다.
각 단계는 구조화한 JSON만 다음 단계에 넘기고 이전 도구 기록은 넘기지 않는다.

**예상 효과는 첫 실행에서도 가장 크지만 변경 범위도 가장 크다.**
현재 입력의 96.8%가 cache read였고,
마지막 25회 호출은 평균 104,634토큰의 입력을 사용했다.
단계를 나누면 한 후보 분석의 웹 검색과 파일 읽기 기록을 다른 후보나 게시 단계에 반복 전달하지 않는다.

다만 full Hermes agent를 후보마다 새로 띄우면 첫 입력 12,382토큰과 도구 정의를 매번 다시 내므로
후보 105건을 105개 agent로 나누는 방식은 적합하지 않다.
도구가 적은 전용 모델 호출에 여러 후보를 묶거나,
안 B의 cache miss만 작은 묶음으로 처리해야 한다.

career-os에서는 다음 계약이 필요하다.

- [`.claude/skills/position-recommender/SKILL.md`](../.claude/skills/position-recommender/SKILL.md)
- `scripts/position-recommender/pipeline/`의 단계별 입력·출력 스키마 신규
- [`recommendation/schema.ts`](../scripts/position-recommender/recommendation/schema.ts)
- [`validate_recommendation.ts`](../scripts/position-recommender/validate_recommendation.ts)
- 단계 재시작과 부분 실패 회귀 테스트

Hermes에서 새 세션이나 도구가 적은 모델 호출을 시작하는 변경은 이번 구현 범위에 넣지 않는다.
먼저 `career-os` Backend와 후처리 통합만으로 줄어든 호출 수를 측정한 뒤 필요하면 별도로 검토한다.

## 공통으로 추가할 수집 상태 계약

세 안 모두 추천 JSON에 공개 가능한 수집 상태를 넣어야 한다.
원본 오류 URL 전체를 공개 리포트에 복제하지 않고 사용자의 판단에 필요한 값만 전달한다.

```json
{
  "collectionHealth": {
    "candidateCount": 105,
    "configuredSourceCount": 16,
    "warningSources": [
      {
        "source": "coupang-careers",
        "status": "partial",
        "failedCount": 62,
        "reason": "상세 페이지 HTTP 429"
      }
    ]
  }
}
```

HTML과 최종 답변은 `쿠팡 상세 62건을 확인하지 못해 쿠팡 후보가 누락될 수 있다`처럼 표시한다.
검증기는 경고 소스가 있으면 HTML에도 같은 소스와 실패 수가 있는지 검사한다.

변경 후보 파일은 다음과 같다.

- [`recommendation/schema.ts`](../scripts/position-recommender/recommendation/schema.ts)
- [`recommendation/validate.test.ts`](../scripts/position-recommender/recommendation/validate.test.ts)
- [`render/recommendation-html.ts`](../scripts/position-recommender/render/recommendation-html.ts)
- [`render/validate-report-html.ts`](../scripts/position-recommender/render/validate-report-html.ts)
- 관련 렌더 테스트와 템플릿

## 권장 순서

매일 반복 실행한다는 조건을 반영해 안 B의 `career-os` HTTP Backend와 MySQL 저장을 기본 구조로 구현한다.
같은 작업에서 안 A의 전용 준비와 최종화 명령을 붙여 모델이 임시 코드를 만들거나
추천 검증 뒤에 여러 도구를 왕복하지 않게 한다.

첫 구현 순서는 Backend 공통 경계와 position schema, 포지션 API와 client,
스킬과 HTML 연결, 학습자료 API, 홈서버 배포, `fos-blog` 전환과 제거다.
Backend와 포지션 코드는 `career-os`, 배포는 `fos-home-infra`, 블로그 변경은 `fos-blog`에서 각각 구현한다.
안 C의 모델 작업 분리는 이 순서의 전후 측정 뒤에도 입력이 크면 다음 단계로 판단한다.

## 재지 못해 확인하지 못한 것

- 2026-09-17 대상 실행의 122건 후보풀 파일은 실행 뒤 삭제돼 정확한 파일 바이트를 측정하지 못했다.
- Hermes 로그는 메시지별 토큰 기여량을 기록하지 않아 후보 정보만의 입력 토큰을 분리하지 못했다.
- 다음 날에도 남아 있는 공고, 본문이 바뀐 공고와 분석 만료 공고 수를 아직 측정하지 못했다.
- HTTP Backend 구현 뒤 API 호출 수, model API 호출 수와 반복 cron 입력 토큰은 아직 측정하지 못했다.
- 첫 실행과 두 번째 실행에서 실제로 줄어드는 토큰 비율은 구현 전이므로 확인하지 못했다.
MySQL을 선택하면 ADR-102를 대체하고 `fos-assistant`의 별도 계획과 연결한다.

파일 기반 재사용과 전용 명령 뒤에도 첫 실행 입력이 크면 안 C를 적용한다.
이 순서는 career-os 안의 작은 변경으로 먼저 실측하고,
Hermes 실행 구조를 바꾸는 작업은 필요한 근거가 생긴 뒤 진행하게 한다.

## 구현 뒤 비교할 값

같은 요청을 다시 실행할 때 다음 값을 함께 남겨야 한다.

1. 후보풀 파일 바이트, 후보 수와 후보당 평균 바이트
2. 전체 색인 바이트와 상세 조회 후보 수
3. 분석 cache hit, miss와 무효화 사유별 건수
4. Hermes의 모델 API 호출 수와 도구 사용 턴 수
5. 전체 입력, cache read, cache에 없던 입력과 출력 토큰
6. 추천 JSON 검증 뒤의 API 호출 수와 입력 토큰
7. 소스별 성공, 부분 실패, 실패 수와 최종 화면 표시 여부
8. 기존 상위 6건이 상세 검토 후보에 포함됐는지와 순서 변경 이유

후보 수가 날마다 달라지므로 전체 토큰만 비교하지 않는다.
후보당 입력 토큰, 상세 분석 건당 입력 토큰과 후처리 입력을 나눠 비교한다.

## 확인하지 못한 것

- 삭제된 122건 후보풀 JSON의 정확한 바이트
- 각 메시지와 후보 정보가 3,460,816토큰 중 차지한 정확한 비율
- 다음 수집에서 그대로 유지되는 공고 수와 분석 cache hit 비율
- 짧은 색인만 본 1차 선별이 현재 상위 후보를 놓치지 않는지
- 안 A, 안 B와 안 C를 구현한 뒤의 실제 입력 토큰과 비용
- background review 5회가 사용자별 비용 화면에 별도로 합산되는지

절감률은 이 값들을 구현 뒤 같은 방식으로 다시 측정한 후 확정한다.
