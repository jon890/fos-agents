---
name: position-recommender
description: 후보자 프로필·이력서·태스크 문서와 현재 열린 개별 채용공고를 바탕으로 지원 가능한 포지션을 추천하는 비공개 career-os skill. "내가 갈만한 포지션 추천", "지원 포지션 후보", "role-fit 분석", "이직 추천", "어떤 회사에 지원할까", "채용 공고 맞는 거 찾아줘", "AI 서비스팀 백엔드 위주", "최신 Wanted 공고", "Toss 채용 자동 수집", `/position-recommender`처럼 지원 후보 추천이나 최신 active/open 공고 분석이 필요할 때 사용. 강력/도전 추천에는 개별 active/open 공고 URL이 확인된 항목만 올리고 fos-study write는 하지 않는다.
---

# Position Recommender

후보자 프로필과 **현재 열린 개별 채용공고**를 종합 분석해 현실적인 지원 후보와 포지셔닝 전략을 추천하는 비공개 career-os skill.

핵심 정책: 강력 추천/도전 추천에는 **구체적인 개별 공고 URL이 있고 현재 active/open 지원 가능함이 확인된 공고만** 올린다.
닫힌 공고, 상태 확인 실패 공고, 회사명, 채용 홈, 기술블로그, 뉴스, "이 회사가 좋아 보인다" 수준의 lead는 추천 티어에 올리지 않는다.
active/open 여부가 검증되지 않으면 보류 또는 제외한다.

## 호출 후 입력 해석

- 자연어 포커스가 있으면 추천 축에 반영한다.
- 최신 채용, 실시간 채용, Wanted, Toss 자동 수집 신호가 있으면 수집 snapshot을 먼저 갱신한다.
- 채용공고 markdown 파일 경로가 있으면 해당 파일을 우선 읽는다.
- 비정형 면담 요청, 학습 갭, 직무 핏·갭 진단은 `job-fit-analyzer`로 라우팅한다.

## 현재 세션 실행 원칙

이 skill을 읽은 현재 에이전트가 직접 실행한다.
수동 실행에서는 이 문서와 참조 파일을 기준으로 필요한 파일 읽기, 수집, 리포트 작성을 현재 세션에서 수행한다.
외부 daily runner는 cron 운영 경로에서만 다루고, 수동 skill 실행 지침에는 포함하지 않는다.

## 출력 정책

먼저 `references/output-policy.md`를 읽고 비공개 산출물 정책을 따른다.
포지션 추천 리포트는 비공개 내부 분석이지만 사용자가 바로 결정을 내릴 수 있어야 한다.
첫 10줄 안에 오늘 가장 추천하는 행동, 추천 후보가 부족한 이유, 또는 보류 판단 중 하나를 둔다.
내부 분석에는 근거 경로와 수집 snapshot 근거를 유지한다.
개별 공고 URL, active/open 근거, 최근 반복 점검 근거를 숨기지 않는다.
Discord 요약은 내부 파일 경로, plan 번호, commit hash 같은 내부 맥락을 포함하지 않는다.

## Inputs

현재 에이전트는 다음 파일과 명령 출력을 직접 로드:

1. `career-os/config/candidate-profile.md` — 후보자 프로필 (11섹션 prose, 경력·기술·자기진단 포함)
2. `career-os/config/sources.json` (`techBlog` 필드) — 엔지니어링 블로그 신호 판단
3. `references/output-policy.md` — 비공개 산출물과 Discord 요약 정책
4. `references/position-recommendation-prompt.md` — 추천 분석과 출력 형식 가이드
5. `references/position-context-index.md` — 추천 컨텍스트 인덱스 (도메인·회사 우선순위)
6. `references/position-decision-criteria.md` — 랭킹·제외 기준 (role-fit 점수 기준 포함)
7. `references/company-upside-reference.md` — 회사 브랜드·규모·성장 upside 참조
8. `config/verified-company-research-targets.json` — 검증된 회사 탐색 대상 목록. 추천 티어 입력이 아니라, active 개별 공고가 부족할 때 다음 수집 범위 결정에만 사용한다.
9. (선택) `references/verified-company-discovery.md` — 수집 snapshot이 부족하고 검증 회사군을 다시 파야 할 때만 읽는 보조 탐색 가이드
10. (선택) 사용자가 자연어로 지정한 채용공고 markdown 파일 경로 (예: `career-os/data/runtime/live-position-postings.md`)

## Workflow

### 1. 채용공고 자동 수집

수동 실행에서는 현재 에이전트가 필요할 때 `collect_live_postings.ts`를 직접 호출한다.
daily/cron 운영 경로에서는 외부 runner가 에이전트 호출 전에 `data/runtime/live-position-postings.md`를 먼저 갱신할 수 있다.
현재 에이전트는 수집 snapshot이 있으면 이 파일을 우선 읽는다.

daily runner 실행에서는 수집 snapshot이 active/open 개별 공고를 하나도 만들지 못하면 실패 처리한다.
이는 stale report를 재전송하지 않기 위한 운영 guard다.

수동 에이전트 실행에서 사용자 요청에 **"최신 채용"**, **"실시간 채용"**, **"Wanted"**, **"공고 가져와줘"** 키워드가 있는데 `data/runtime/live-position-postings.md`가 없거나 오래됐으면 실행:

```bash
bun scripts/position-recommender/collect_live_postings.ts
```

(기본 출력 경로는 스크립트 자기 위치 기준으로 `career-os/data/runtime/live-position-postings.md`로 고정 — cwd 무관. 다른 위치로 redirect할 때만 `--output <path>` 추가.)

- 수동 실행에서 수집 실패 (exit non-zero) 시 stderr warn 출력 후 계속 진행한다.
  단, 이 경우 강력 추천/도전 추천을 억지로 채우지 않고 후보 부족 또는 보류로 쓴다.
- daily runner 실행에서 수집 실패, active/open direct posting 0건, stale report/runtime은 실패로 끝낸다.
- 사용자가 직접 파일 경로를 지정한 경우: 이 단계 건너뛰고 해당 파일을 읽는다.
- `Toss 자동 수집` 또는 커리어 아티클은 active/open 개별 공고로 검증되지 않는 한 추천 입력에서 제외한다.
- 강력 추천/도전 추천의 입력 후보는 수집 snapshot 안에서 아래 조건을 모두 만족하는 항목으로 제한한다.
  - `posting_status: active/open`
  - `link_type: direct_posting`
  - 개별 URL 존재
- snapshot에 `posting_status: unknown`, career article, search page, 채용홈 lead만 있는 항목이 있으면 추천 후보로 사용하지 않는다.
- snapshot의 `closes_at`, `days_until_close`, `close_urgency`를 우선 읽고, `opened_at`은 값이 있을 때만 공고 기간에 포함한다. 마감이 없으면 `상시/마감 미정`으로 쓴다. `close_urgency`가 `urgent`/`soon`이면 준비 액션에 마감 임박을 반영한다.
- snapshot의 `main_tasks`, `requirements`, `preferred`는 실행 시간을 줄이기 위해 요약 길이로 잘린 입력이다.
  추천 판단에는 충분하지만, 문장 일부가 `...`로 끝나면 원문을 보았다고 쓰지 않는다.

### 2. 컨텍스트 + 최근 추천 이력 로드

- Inputs 1~7 모두 읽는다.
- 수집된 `career-os/data/runtime/live-position-postings.md` 또는 사용자 지정 파일을 읽는다.
- 최근 7일 `career-os/data/reports/daily/*/position-recommendation/report.md` 중 존재하는 파일을 읽는다.
- 사용자의 자연어 포커스 키워드 (예: "AI 서비스팀 위주") 를 분석 컨텍스트에 반영
- 사용자의 현재 선호상 AI 서비스/AI Transformation(AX)/AI Agent/AI 플랫폼 포지션도 탐색한다. 단, 강력/도전 추천에는 서버·플랫폼 개발 전이가 분명하고 active/open 개별 공고 URL이 확인된 항목만 올린다.
- 백엔드와 AI 전환 후보는 별도 관점으로 검토한다. 예: AI Agent/RAG/MCP/LLMOps/ML Backend/AI Platform처럼 API·서버·플랫폼·운영 자동화와 AI 응용 경험이 함께 필요한 공고.
- Toss는 공식 `job-groups` API의 그룹/하위 포지션까지 수집 대상으로 본다. `AI Engineer` 그룹의 Platform/Brain/Commerce/Model/Ads 하위 포지션처럼 목록 화면의 그룹 구조에 묶인 공고를 누락하지 않는다.
- 최근 7일 강력 추천/도전 추천에 반복 등장한 회사·URL은 확인한다.
- 반복 자체는 감점하지 않는다.
- 동일 개별 active 공고가 여전히 최상위 후보면 유지하고 “반복 유지 사유”와 “아직 지원 액션이 필요한 이유”를 명시한다.
- 신규 공고 포함은 목표가 아니라 보조 신호다. 낮은 fit의 신규 공고를 넣기 위해 더 좋은 반복 후보를 내리지 않는다.

### 3. 추천 분석 + 리포트 작성

`references/position-recommendation-prompt.md` 가이드에 따라 후보자 프로필 × 포지션 후보 교차 분석:

산출물은 **구조화 JSON `recommendation.json`**(정본, schemaVersion 2)이다 (ADR-094).
아래 구조를 `scripts/position-recommender/recommendation_schema.ts` 스키마에 맞춰 채운다.
사람이 읽는 Markdown·HTML은 이 JSON에서 파생하므로, 산문을 직접 쓰지 않는다.

최상위 필드:
- `reportDate` — `<YYYY-MM-DD>` (Asia/Seoul)
- `conclusion[]` — 오늘의 결론 또는 권장 행동 1~3개 (첫 10줄 결론 역할)
- `background[]` — 후보자 현재 강점·약점 포지션 2~3문장
- `tiers.strong[]` — role-fit 높고 gap 준비 가능 (최대 3)
- `tiers.stretch[]` — stretch goal, 준비 기간 필요 (최대 2, `stretchGap` 포함)
- `tiers.hold[]` — 현시점 비추천 + 사유 (최대 3, `company`·`title`·`link`·`reason`)
- `additionalTargets[]` — 개별 active URL 미확보 회사 lead (최대 3, 다음 수집 범위 결정용)
- `recentCheck[]` — 최근 7일 반복 후보의 active/open 상태, 유지 사유, 아직 지원 액션이 필요한 이유
- `weeklyActions` — `apply` / `resume` / `study` 각 1개

각 포지션 항목(`PositionItem`)은 스키마가 14개 필드를 강제한다. 옛 markdown 라벨이 곧 이 필드다.
- `postingUrl`(개별 공고 URL 필수) · `exploreLink`("-") · `linkEvidenceLevel`(active/open enum)
- `postingPeriod` · `searchKeywords[]` · `whyFit` · `candidateEvidence[]` · `jdKeywords[]`
- `companyUpside{level: 강함|중간|약함, reason}` · `welfareLearning` · `techBlogSignal`
- `businessRisk` · `ambiguity` · `prepAction` · `stretchGap`(도전 전용)

판단 근거를 충실히 담되, 장문 회사 설명·JD 원문 재서술은 쓰지 않는다.
md/html의 한국어 라벨 변환은 `render_recommendation.ts`가 담당하므로, 라벨 텍스트를 직접 맞출 필요가 없다.

### 4. 산출물 생성 — JSON 정본 + 파생 (ADR-094)

정본은 구조화 JSON이다. 정본 하나에서 md/html을 파생하므로 자체 markdown 파서를 거치지 않고 출력이 항상 일관된다.

```
쓰기 → career-os/data/reports/daily/YYYY-MM-DD/position-recommendation/recommendation.json  (정본)
파생 → bun scripts/position-recommender/render_recommendation.ts --input <json> --format md   --output .../report.md
파생 → bun scripts/position-recommender/render_recommendation.ts --input <json> --format html --output .../report.html
미러 → career-os/data/runtime/position-recommendation.{json,md,html}
Runner post-process → fos-career DB recommendation items ingest (recommendation.json 직접 ingest)
```

날짜는 Asia/Seoul 기준 (`TZ=Asia/Seoul date +%F`). UTC `new Date().toISOString()` 날짜를 사용하지 않는다.

daily/cron 실행에서 오늘 날짜 정본을 새로 쓰지 못하면 성공으로 끝내지 않는다.
DB ingest는 runner 책임이다. skill은 정본 JSON과 파생물을 정확히 만드는 데 집중한다.

### 5. Discord 알림

현재 에이전트는 skill 내부에서 Discord 알림을 직접 보내지 않는다.

daily/cron 실행의 Discord 전송은 외부 runner가 freshness check 통과 후 `_shared/lib/notify_discord.ts`로 수행한다.
runner는 Markdown 리포트 검증 후 HTML 미러를 생성하고,
아침 Discord 알림에 HTML 파일을 첨부한다.
이는 운영 runner가 실행 조율과 외부 전송을 맡고,
현재 에이전트가 리포트 생성·자기 검증에 집중하게 하기 위함이다.

Discord 알림은 리포트 전체 요약이 아니라 “클릭 가능한 카드형 후보 목록”으로 보낸다.

- 강력 추천 최대 3개, 도전 추천 최대 2개만 포함한다.
- 각 후보는 다음 4줄을 유지한다:
  - 공고명: 회사명 — 포지션명
  - 스택: 보고서의 `검색 키워드` 또는 핵심 기술 키워드
  - 한줄: 보고서의 `왜 맞는가` 첫 문장 수준 요약
  - 링크: 개별 공고 URL
- 보류·주의와 추가 수집 대상은 기본 Discord 알림에서 제외한다. 자세한 근거는 report/runtime 파일에 남긴다.
- 링크만 있는 과압축 알림을 피하고, Discord에서 바로 다음 행동을 판단할 수 있는 최소 맥락을 제공한다.

## Self-check

산출물 검증은 **zod 스키마 검증**으로 한다 (ADR-094). 옛 markdown grep 17항목을 스키마가 대체한다.

검증 실행은 별도 코드가 필요 없다. `render_recommendation.ts`가 입력 JSON을 `RecommendationRun.safeParse`로 먼저 검증하고, 실패하면 위반 필드를 stderr로 출력하며 exit 1한다.
즉 **4번의 md/html 파생 명령을 돌리는 것이 곧 self-check**다. 파생이 성공하면 아래 스키마 조건이 모두 충족된 것이다.

스키마 검증 (`render_recommendation.ts` 실행 시 자동) — `recommendation_schema.ts`의 `RecommendationRun`이 보장:
- 14개 라벨 필드 누락 없음 (빈 문자열·빈 배열 거부).
- tier 상한: 강력 3 / 도전 2 / 보류 3.
- `linkEvidenceLevel`이 `개별 공고 active 확인` 또는 `개별 공고 open 확인` enum.
- 추천 티어 항목은 개별 공고 URL만 허용 (`exploreLink`는 "-", 탐색 링크 금지).
- 강력 추천 항목에 `stretchGap` 금지 (도전 전용).
- `reportDate`가 Asia/Seoul 오늘 날짜와 일치.

파생물 확인:
- `report.md` / `report.html` / runtime mirror가 정본에서 생성됨.

스키마로 잡히지 않는 사람-facing 점검:
- 닫힌 공고·`unknown` 상태·커리어 아티클·채용홈·검색 페이지가 추천 티어에 없음.
- raw `needs_evidence`가 사용자-facing 문장에 없음 (`보강 필요 / 선택지 / 권장 행동` 구조로).
- Discord 요약 대상 문장에 내부 파일 경로·plan 번호·commit hash 없음.
- 실제 제출·로그인·공개 발행·candidate-profile 수정 지시 없음 (필요시 `사용자 승인 필요`로만).

스키마 검증 실패 시 해당 필드 보완 후 재생성. **최대 3회 시도**.
4회째도 실패 시 `stderr: position-recommender 검증 실패: <필드>`를 출력하고 exit 1로 종료한다.

## Error handling

| 상황 | 처리 |
|---|---|
| `references/position-recommendation-prompt.md` 부재 | stderr 출력 후 exit 1 |
| `candidate-profile.md` 부재 | stderr 출력 후 exit 1 |
| `sources.json` 부재 | stderr warn을 출력하고 techBlog 없이 계속 진행 |
| 수동 실행의 `collect_live_postings.ts` 실패 | stderr warn을 출력하고 수동 컨텍스트로 계속 진행하되 추천 티어를 억지로 채우지 않음 |
| daily runner의 수집 실패 또는 active/open direct posting 0건 | stale output 방지를 위해 stderr 출력 후 exit 1 |
| 사용자 지정 파일 path 부재 | stderr warn을 출력하고 해당 파일 없이 계속 진행 |
| 오늘 날짜 report/runtime 미생성 | stale output으로 간주하고 stderr 출력 후 exit 1 |
| self-check 3회 실패 | `position-recommender 검증 실패: <항목>`를 출력하고 exit 1 |
| Discord notify 실패 | agent skill 내부에서는 호출하지 않음. 외부 runner가 stderr warn 후 계속 |

## Why this design

- **ADR-094**: 산출물 정본을 구조화 JSON(`recommendation.json`)으로 전환. `render_recommendation.ts`가 정본에서 md/html을 파생하고, self-check는 `recommendation_schema.ts` zod 검증으로 대체. 자체 markdown 파서 폐기.
- **ADR-030**: 옛 외부 subprocess 패턴 (`run_position_recommendation.sh` 76줄, `extract_position_report.ts` 45줄) → agent skill 직접 읽기/쓰기. SKILL.md 단일 진실 출처.
- **현재 세션 실행**: skill을 읽은 현재 에이전트가 직접 실행한다. 수동 실행 지침과 cron 운영 runner의 책임을 분리한다.
- **self-check 내재화**: `extract_position_report.ts`가 하던 첫 줄 `#` 검증과 줄 수 검증을 현재 에이전트 자체 검증으로 흡수. 외부 프로세스 불필요.
- **수집 선택적 호출**: 기존 `POSITION_POSTINGS_FILE` env 주입 패턴 → 자연어 인자 흡수. 매번 수집하지 않아 비용·시간 효율.
- **env 변수 제거**: `POSITION_CONTEXT`와 `POSITION_POSTINGS_FILE` → 자연어 인자.
- **비공개 유지**: position 분석은 후보자 본인 의사결정 자산 — fos-study publish 안 함. `publish_job_analysis.sh` 폐기 근거(ADR-030).
- **재실행 멱등**: 날짜별 경로(`data/reports/daily/YYYY-MM-DD/...`)로 충돌 없는 복수 실행 지원.

## References

- `references/position-recommendation-prompt.md` — 분석 프롬프트 가이드
- `references/output-policy.md` — 비공개 산출물과 Discord 요약 정책
- `references/position-context-index.md` — 추천 컨텍스트 인덱스
- `references/position-decision-criteria.md` — 랭킹·제외 기준
- `references/company-upside-reference.md` — 회사 브랜드·규모 upside 참조
- `config/verified-company-research-targets.json` — 검증된 탐색 대상 회사군. 회사 tier·쿨다운(`cooldown`)·선호제외(`preferenceExcluded`) 운영 데이터 단일 출처(ADR-095)
- `references/verified-company-discovery.md` — snapshot 부족 시만 쓰는 보조 탐색 가이드
- `scripts/position-recommender/recommendation_schema.ts` — **산출물 정본 zod 스키마** (ADR-094). recommendation.json을 채우기 전에 이 파일에서 `PositionItem` 등 필드 정의를 확인한다.
- `scripts/position-recommender/render_recommendation.ts` — 정본 JSON에서 Markdown·HTML을 파생하는 렌더러. 입력 시 스키마 검증을 내장하므로 실행 자체가 self-check다.
- `career-os/docs/adr/INDEX.md` ADR-094 / ADR-030 — 본 설계 결정 근거
- daily/cron runner 자산(`scripts/position-recommender/run_daily_with_claude.ts`·`structured_recommendation_items.ts`)의 역할 — career-os/docs/code-architecture.md position-recommender 섹션이 단일 출처. 본 SKILL.md는 agent 직접 실행 절차에 집중하고, runner 후처리 자산의 책임은 code-architecture.md를 역참조한다.
