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
cron 운영 경로의 자동 실행은 cron 소비측이 다루고, 수동 skill 실행 지침에는 포함하지 않는다.

## 출력 정책

먼저 `references/output-policy.md`를 읽고 비공개 산출물 정책을 따른다.
포지션 추천 리포트는 비공개 내부 분석이지만 사용자가 바로 결정을 내릴 수 있어야 한다.
첫 10줄 안에 오늘 가장 추천하는 행동, 추천 후보가 부족한 이유, 또는 보류 판단 중 하나를 둔다.
내부 분석에는 근거 경로와 수집 snapshot 근거를 유지한다.
개별 공고 URL, active/open 근거, 최근 반복 점검 근거를 숨기지 않는다.
Discord 요약은 내부 파일 경로, plan 번호, commit hash 같은 내부 맥락을 포함하지 않는다.

사용자 전달 원칙:
- 공고·포지션 추천 리포트는 반드시 HTML 파일을 함께 생성해 첨부한다. 텍스트 표만 보내지 않는다.
- HTML은 다운로드 전용 경로(`data/runtime/downloads/`)에 두고, 각 공고명은 개별 공고 URL로 이동하는 링크(`<a href>`)여야 한다.
- Discord 미리보기에는 상위 후보와 핵심 사유를 짧게 쓰되, 각 후보의 공고 링크도 포함한다.
- 다운로드·첨부용 HTML은 전체 active/open 공고가 들어 있는 파일 하나만 만든다.
- 부분 후보 preview HTML이나 `report.html`의 다운로드 copy는 기본 생성하지 않는다.
- AGENTS.md, SKILL.md, ADR, flow 문서처럼 다음 실행자의 행동을 바꾸는 핵심 문서를 수정했으면 완료 보고에 반드시 수정 사실과 파일 목록을 밝히고, 가능한 경우 관심사별 commit/push까지 진행한다.

## Inputs

현재 에이전트는 다음 파일과 명령 출력을 직접 로드:

1. `career-os/config/candidate-profile.md` — 후보자 프로필 (11섹션 prose, 경력·기술·자기진단 포함)
2. `career-os/config/external-reading-sources.json` (`techBlog` 필드) — 엔지니어링 블로그 신호 판단. 공고 수집 source registry가 아님
3. `references/output-policy.md` — 비공개 산출물과 Discord 요약 정책
4. `references/position-recommendation-prompt.md` — 추천 분석과 출력 형식 가이드
5. `references/position-context-index.md` — 추천 컨텍스트 인덱스 (도메인·회사 우선순위)
6. `references/position-decision-criteria.md` — 랭킹·제외 기준 (role-fit 점수 기준 포함)
7. `references/company-upside-reference.md` — 회사 브랜드·규모·성장 upside 참조

주의: 위 `references/...`는 skill linked file 기준 경로다.
Hermes에서 이 skill을 실행할 때는 `skill_view(name='position-recommender', file_path='references/<file>.md')`로 읽거나, 파일 도구를 써야 하면 `career-os/.claude/skills/position-recommender/references/<file>.md`를 사용한다.
워크스페이스 루트의 `references/<file>.md`로 가정하지 않는다.
8. `config/verified-company-research-targets.json` — 검증된 회사 탐색 대상 목록. 추천 티어 입력이 아니라, active 개별 공고가 부족할 때 다음 수집 범위 결정에만 사용한다.
9. (선택) `references/verified-company-discovery.md` — 수집 snapshot이 부족하고 검증 회사군을 다시 파야 할 때만 읽는 보조 탐색 가이드
10. (선택) 사용자가 자연어로 지정한 채용공고 markdown 파일 경로 (예: `career-os/data/runtime/live-position-postings.md`)

## Workflow

### 1. 채용공고 자동 수집

수동 실행에서는 현재 에이전트가 필요할 때 `collect_live_postings.ts`를 직접 호출한다.
daily/cron 운영 경로에서는 cron 소비측이 에이전트 호출 전에 `data/runtime/live-position-postings.md`를 먼저 갱신할 수 있다.
현재 에이전트는 수집 snapshot이 있으면 이 파일을 우선 읽는다.

- daily/cron 실행에서는 수집 snapshot이 active/open 개별 공고를 하나도 만들지 못하면 실패 처리한다.
  이는 stale report를 재전송하지 않기 위한 운영 guard다.
- 단, 호출자가 cron 지시문에서 "live collection 불가 시 기존 snapshot 사용"을 명시 허용하면 실패로 끝내지 않는다.
  이때는 `data/runtime/live-position-postings.md`의 진단부(`direct_active_or_open_postings`, source diagnostics, mtime)를 근거로 추천하고, 최종 요약 첫 부분에 "새 수집은 못 했고 기존 snapshot을 사용했다"는 제한을 짧게 밝힌다.
  낮은 fit의 신규 후보를 억지로 만들지 말고, 기존 active/open 최상위 후보와 최근 반복 점검을 우선한다.

수동 에이전트 실행에서 사용자 요청에 **"최신 채용"**, **"실시간 채용"**, **"Wanted"**, **"공고 가져와줘"** 키워드가 있는데 `data/runtime/live-position-postings.md`가 없거나 오래됐으면 실행:

```bash
# bun이 있으면 기존 실행 경로
bun scripts/position-recommender/collect_live_postings.ts

# Hermes/Discord 환경처럼 bun이 없고 Node 22+가 있으면 Node TypeScript 실행 경로
node scripts/position-recommender/collect_live_postings.ts
```

(기본 출력 경로는 스크립트 자기 위치 기준으로 `career-os/data/runtime/live-position-postings.md`로 고정 — cwd 무관. 다른 위치로 redirect할 때만 `--output <path>` 추가.)

Node 실행에서 `import.meta.dir` 관련 오류가 나면 Bun 전용 경로 계산이 남아 있는 것이다. 해당 스크립트는 `dirname(fileURLToPath(import.meta.url))` 방식으로 바꾼 뒤 `node --check <script>`와 실제 수집을 다시 검증한다.

- 수동 실행에서 수집 실패 (exit non-zero) 시 stderr warn 출력 후 계속 진행한다.
  단, 이 경우 강력 추천/도전 추천을 억지로 채우지 않고 후보 부족 또는 보류로 쓴다.
- daily/cron 실행에서 수집 실패, active/open direct posting 0건, stale report/runtime은 실패로 끝낸다.
- 수집 후에는 `data/runtime/live-position-postings.md`의 mtime, `total_collected`, `direct_active_or_open_postings`, `source_counts`, `source_diagnostics`를 확인해 **실제로 새 snapshot이 쓰였는지** 검증한다.
  기존 runtime/report에 있던 공고라도 새 snapshot에서 해당 source의 `imported=0`이면 강력/도전 추천에 stale 재사용하지 않는다.
- Coupang Careers 상세 페이지는 Node 내장 `fetch`만 403을 받고 `curl`은 200을 받는 Cloudflare fingerprint 문제가 있을 수 있다.
  `coupang-careers`가 `detail_failed`로 떨어지면 `references/coupang-cloudflare-node-fetch.md`의 curl fallback 검증 절차를 따른다.
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
- 단, Toss 루트 회사의 `Server Developer (Product)` 같은 챕터/직군 단위 범용 공고는 구체적인 팀·도메인·상품이 특정된 공고가 아니므로 수집 후보에서 제외한다.
- `Tech Lead`, `Server Lead`, CTO/기술총괄 계열은 현재 사용자의 seniority 대비 과도하므로 기본 수집/프리뷰 후보에서 제외한다.
- 최근 7일 강력 추천/도전 추천에 반복 등장한 회사·URL은 확인한다.
- 반복 자체는 감점하지 않는다.
- 동일 개별 active 공고가 여전히 최상위 후보면 유지하고 “반복 유지 사유”와 “아직 지원 액션이 필요한 이유”를 명시한다.
- 같은 회사 안에서 더 현실적인 active/open 공고가 새로 보이면 반복 후보를 기계적으로 유지하지 말고 교체를 검토한다. 특히 seniority 기대치, hands-on 서버 개발 밀도, Java/Spring 직접성, 도메인 전환 가치가 더 좋아진 경우에는 “반복 후보를 왜 교체했는지”를 최근 반복 점검에 명시한다.
- 신규 공고 포함은 목표가 아니라 보조 신호다. 낮은 fit의 신규 공고를 넣기 위해 더 좋은 반복 후보를 내리지 않는다.

### 3. 추천 분석 + 리포트 작성

`references/position-recommendation-prompt.md` 가이드에 따라 후보자 프로필 × 포지션 후보 교차 분석:

산출물은 **표준 출력 JSON `recommendation.json`**(schemaVersion 2)이다 (ADR-094, ADR-101).
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

`source`와 `closeDate`는 수집 snapshot에서 직접 가져온다.
- `source` — 해당 공고 snapshot 항목의 `source` 필드(adapter 식별자)를 그대로 옮긴다. URL 도메인으로 추측하지 않는다.
- `closeDate` — snapshot의 `closes_at`을 ISO 8601 날짜 문자열(`YYYY-MM-DD`)로 옮긴다. `no_deadline`이거나 미상이면 `null`로 둔다.
후보 매칭은 `postingUrl` 기준이다. snapshot에 없는 항목은 추천 티어에 올리지 않는 기존 규칙과 일관된다.

### 출력 모드

호출자에 따라 최종 응답 형태가 달라진다.

- **기본 (파일 저장)**: `recommendation.json`을 날짜별 경로에 쓴다.
- **backend 호출** (`response_format: json_object` 또는 JSON 응답 요청): `recommendation.json`과 동일한 내용을 최종 응답(run output)으로 출력한다. 산문 설명을 섞지 않는다. 파일도 함께 쓴다.
- **cron 호출**: 최종 응답은 Discord 요약 산문이다. JSON은 파일로만 두고 최종 응답에 포함하지 않는다.

근거: ADR-101 — 전달 매체를 공유 파일과 hermes API 응답 두 가지로 둬서 로컬에서도 검증할 수 있게 한다.

### 4. 표준 출력 JSON 생성 (ADR-094, ADR-101)

표준 출력 JSON이 단일 산출물이다. 이 JSON 하나에서 md/html을 파생하므로 자체 markdown 파서를 거치지 않고 출력이 항상 일관된다.

```
쓰기 → career-os/data/reports/daily/YYYY-MM-DD/position-recommendation/recommendation.json  (표준 출력 JSON)
파생 → <ts-runtime> scripts/position-recommender/render_recommendation.ts --input <json> --format md   --output .../report.md
파생 → <ts-runtime> scripts/position-recommender/render_recommendation.ts --input <json> --format html --output .../report.html
다운로드 HTML → <ts-runtime> scripts/position-recommender/render_candidate_preview.ts --input <json> --postings data/runtime/live-position-postings.md --limit all --output data/runtime/downloads/position-recommendation-all-YYYY-MM-DD.html
미러 → career-os/data/runtime/position-recommendation.{json,md,html}
다운로드 → data/runtime/downloads/position-recommendation-all-YYYY-MM-DD.html 하나만 둔다.
소비측 가공 → cron: 최종 응답 Discord 요약 산문 + HTML 첨부 / backend: JSON을 hermes API 응답으로 받아 DB 적재
```

`<ts-runtime>`은 `bun`이 있으면 `bun`, 없으면 Node 22+의 `node`를 사용한다. 렌더러나 수집기가 `import.meta.dir`에 의존해 Node에서 실패하면 `dirname(fileURLToPath(import.meta.url))`로 바꾸고 `node --check` 후 실제 렌더링까지 확인한다.

날짜는 Asia/Seoul 기준 (`TZ=Asia/Seoul date +%F`). UTC `new Date().toISOString()` 날짜를 사용하지 않는다.

daily/cron 실행에서 오늘 날짜 표준 출력 JSON을 새로 쓰지 못하면 성공으로 끝내지 않는다.
DB 적재는 backend 소비측 책임이다(ADR-101). skill은 표준 출력 JSON과 파생물을 정확히 만드는 데 집중한다.

### 5. Discord 알림

현재 에이전트는 skill 내부에서 Discord 알림을 직접 보내지 않는다.

daily/cron 실행의 Discord 전송은 cron 소비측(호출자)이 freshness check 통과 후 `_shared/lib/notify_discord.ts`로 수행한다(ADR-101).
cron 소비측은 Markdown 리포트 검증 후 HTML 미러를 생성하고,
아침 Discord 알림에 HTML 파일을 첨부한다.
이는 cron 소비측이 실행 조율과 외부 전송을 맡고,
현재 에이전트가 리포트 생성·자기 검증에 집중하게 하기 위함이다.

Discord 알림은 리포트 전체 요약이 아니라 “클릭 가능한 카드형 후보 목록”으로 보낸다.

- 공고·포지션 추천 리포트는 반드시 전체 공고 HTML 파일 하나를 함께 첨부한다.
- HTML 파일은 `career-os/data/runtime/downloads/` 아래에 만들고, 각 후보 공고명은 개별 공고 URL로 이동하는 `<a href>` 링크여야 한다.
- Discord 요약에는 강력 추천 최대 3개, 도전 추천 최대 2개를 짧게 쓴다.
- 첨부 HTML은 항상 `--postings data/runtime/live-position-postings.md --limit all`로 전체 active/open 후보를 보여준다.
- 사용자가 넓은 preview, 20개 이상 후보, 또는 전체 후보를 요청하면 임의로 50개처럼 다시 자르지 않는다.
- 전체 후보 preview와 전체 공고 HTML에서도 AI 모델 연구 중심 포지션과 CTO/기술총괄 포지션은 제외한다.
- **중요: `position-recommendation-full-YYYY-MM-DD.html`은 추천 리포트 전체본이지, 수집된 모든 active/open 공고 목록이 아니다.** 사용자가 "모든 공고", "전체 공고", "다 들어있는 HTML"을 요청하거나 포함 여부를 확인하면 `data/runtime/live-position-postings.md`의 `direct_active_or_open_postings`와 HTML의 공고 링크/행 수를 비교한다. 불일치하면 full report를 재전송하지 말고, snapshot의 `link_type: direct_posting` + `posting_status: active/open` + `url` 항목 전체를 표로 렌더링한 별도 HTML을 `data/runtime/downloads/position-recommendation-all-postings-YYYY-MM-DD.html`로 만들고, 링크 수가 snapshot count와 일치하는지 검증한 뒤 첨부한다.
- 전체 공고 HTML에는 최소 컬럼 `순번`, `출처`, `공고 링크`, `상태`, `마감`, `태그/스킬`, `요약`을 둔다. 공고명은 개별 공고 URL로 이동하는 `<a href>` 링크여야 하며, 최종 전송 전 `<a ` 개수와 표시 행 수가 `direct_active_or_open_postings`와 일치해야 한다.
- 각 후보 preview 또는 전체 공고 HTML 행은 다음 4줄 또는 표 컬럼을 유지한다:
  - 공고명: 회사명 — 포지션명
  - 스택: 보고서의 `검색 키워드` 또는 핵심 기술 키워드
  - 한줄: 보고서의 `왜 맞는가` 첫 문장 수준 요약
  - 링크: 개별 공고 URL
- 보류·주의와 추가 수집 대상은 기본 Discord 요약에서 제외한다.
- AI 모델 연구 중심 포지션, CTO/기술총괄, Tech Lead/Server Lead, Toss 루트 회사의 범용 `Server Developer (...)` 공고는 전체 공고 HTML에서 제외한다.
- 링크만 있는 과압축 알림을 피하고, Discord에서 바로 다음 행동을 판단할 수 있는 최소 맥락을 제공한다.

#### Cron 최종 응답 override

cron 호출자가 최종 응답 형식을 명시하면 위 기본 Discord 카드 정책보다 호출자 지시를 우선한다.
Hermes/Codex scheduled run에서 날짜별 `report.md`와 runtime mirror가 핵심 deliverable인 경우 `references/cron-codex-markdown-delivery.md` 체크리스트를 함께 따른다.
예를 들어 “Discord output must be 30-70 lines max, Korean, with strong recommendations, stretch recommendations, hold/caution, recent-repeat check, and report path”처럼 명시된 경우:

- 최종 응답은 30~70줄 한국어 요약으로 제한한다.
- 강력 추천, 도전 추천, 보류·주의, 최근 반복 점검, 생성한 report/runtime 경로를 모두 포함한다.
- 내부 구현 세부나 긴 JD 원문은 제외하고, 공고명·핵심 이유·링크·다음 액션 중심으로 압축한다.
- 파일 생성이 핵심 deliverable이므로 최종 응답 전에 날짜별 report와 runtime mirror가 실제로 같은 내용인지 확인한다.

#### Cron Markdown-only fallback

호출자가 날짜별 `report.md`와 `data/runtime/position-recommendation.md` 생성을 명시했고, 현재 환경에서 `bun`/renderer를 사용할 수 없으면 stale 재전송보다 Markdown fallback을 우선한다.

- 기존 `data/runtime/live-position-postings.md` snapshot에 `direct_active_or_open_postings > 0`이고 caller가 기존 snapshot 사용을 허용한 경우에만 fallback한다.
- 이때 표준 JSON·HTML 파생은 생략 가능하지만, `report.md`와 runtime markdown mirror는 새 날짜로 직접 작성한다.
- fallback 제한을 첫 결론 또는 최종 cron 요약에 짧게 밝힌다: 새 수집/renderer를 못 돌렸고 기존 active-only snapshot을 사용했다.
- 추천 티어에는 snapshot 안의 `link_type: direct_posting` + `posting_status: active/open` 개별 URL만 올리는 기존 원칙을 그대로 유지한다.
- 최종 응답 전 `wc -l` 또는 동등한 방법으로 라인 수를 확인하고, 날짜별 `report.md`와 runtime mirror가 byte-identical인지 `cmp` 또는 동등한 방법으로 확인한다.

#### Cron file-write/tool-guard fallback

cron 환경에서 표준 JSON 작성이나 대형 파일 작성이 안전 가드에 막히더라도, 호출자가 `report.md`와 runtime mirror 생성을 핵심 deliverable로 명시했다면 작업을 중단하지 말고 Markdown fallback으로 완주한다.

- 먼저 가능한 표준 경로(JSON → md/html render)를 시도하되, 파일 쓰기 안전 가드·approval gate가 막으면 동일한 active/open snapshot 근거로 `report.md`를 직접 작성한다.
- 이 fallback은 새 live collection이 성공했거나, 호출자가 기존 snapshot 사용을 명시 허용했고 snapshot에 `direct_active_or_open_postings > 0`일 때만 사용한다.
- 사용자-facing 요약에는 “새 수집 성공/기존 snapshot 사용” 중 실제 상태만 짧게 밝히고, 내부 tool guard나 approval 세부를 길게 노출하지 않는다.
- terminal heredoc으로 report를 직접 쓸 때 본문에 raw `&` 문자가 있으면 shell/background 가드가 오탐할 수 있으므로, 한국어 제목은 `and`/`및`으로 바꾸거나 escape해서 재시도한다.
<<<<<<< HEAD
- Markdown fallback으로 썼더라도 HTML 전달 정책은 유지한다. 가능한 경우 active/open snapshot에서 전체 공고 HTML을 생성하고 `data/runtime/downloads/position-recommendation-all-YYYY-MM-DD.html`에 둔다.
=======
- cron/Codex 환경에서 대형 JSON·Markdown을 shell heredoc으로 한 번에 쓰다가 URL path의 비ASCII 문자 등으로 보안 가드가 멈추면, shell 우회 대신 `write_file`로 산출물 원문을 쓰고 필요한 단일 URL/문구만 `patch`로 보정한 뒤 renderer와 `cp` 검증 명령을 별도 terminal 호출로 실행한다.
- Markdown fallback으로 썼더라도 HTML 전달 정책은 유지한다. 최소한 같은 Markdown에서 안전한 HTML copy를 생성하고 `data/runtime/downloads/position-recommendation-full-YYYY-MM-DD.html`에 둔다.
>>>>>>> 2f30692 (docs(career-os): Hermes cron 운영 지침 보강)
- 완료 전 `test -s`, `cmp`, HTML 링크 개수 확인 등으로 날짜별 report/runtime mirror/download HTML의 존재와 동일성을 실제로 검증한다.

## Self-check

산출물 검증은 **zod 스키마 검증**으로 한다 (ADR-094). 옛 markdown grep 17항목을 스키마가 대체한다.

검증 실행은 별도 코드가 필요 없다. `render_recommendation.ts`가 입력 JSON을 `RecommendationRun.safeParse`로 먼저 검증하고, 실패하면 위반 필드를 stderr로 출력하며 exit 1한다.
즉 **md/html 파생 명령을 돌리는 것이 곧 self-check**다. 파생이 성공하면 아래 스키마 조건이 모두 충족된 것이다.

실행 경로는 다음 순서로 고른다.
1. `bun` 사용 가능: `bun scripts/position-recommender/render_recommendation.ts ...`
2. `bun` 없음 + Node 22+ 사용 가능: `node scripts/position-recommender/render_recommendation.ts ...`
3. 둘 다 불가하거나 renderer가 runtime 문제로 막힘: stale 재전송 금지. 현재 에이전트가 JSON 필드를 직접 점검하고 Markdown fallback 규칙을 따른다.

단, **cron 환경에는 bun이 없어 `render_recommendation.ts`가 실행되지 않는다**.
이 경우 에이전트가 직접 점검한다.
- `source`·`closeDate` 누락 항목이 없는지 직접 확인한다.
- tier 상한(강력 3 / 도전 2 / 보류 3)을 직접 확인한다.
최종 적재 검증은 소비측(backend)이 zod로 수행한다.

스키마 검증 (`render_recommendation.ts` 실행 시 자동) — `recommendation_schema.ts`의 `RecommendationRun`이 보장:
- 14개 라벨 필드 누락 없음 (빈 문자열·빈 배열 거부).
- tier 상한: 강력 3 / 도전 2 / 보류 3.
- `linkEvidenceLevel`이 `개별 공고 active 확인` 또는 `개별 공고 open 확인` enum.
- 추천 티어 항목은 개별 공고 URL만 허용 (`exploreLink`는 "-", 탐색 링크 금지).
- 강력 추천 항목에 `stretchGap` 금지 (도전 전용).
- `reportDate`가 Asia/Seoul 오늘 날짜와 일치.

파생물 확인:
- `report.md` / `report.html` / runtime mirror가 표준 출력 JSON에서 생성됨.
- `render_candidate_preview.ts --postings ... --limit all`로 다운로드용 전체 공고 HTML을 생성했고, 공고명 링크가 개별 공고 URL로 연결됨.

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
| `external-reading-sources.json` 부재 | stderr warn을 출력하고 techBlog 없이 계속 진행 |
| 수동 실행의 `collect_live_postings.ts` 실패 | stderr warn을 출력하고 수동 컨텍스트로 계속 진행하되 추천 티어를 억지로 채우지 않음 |
| daily/cron 실행의 수집 실패 또는 active/open direct posting 0건 | stale output 방지를 위해 stderr 출력 후 exit 1 |
| 사용자 지정 파일 path 부재 | stderr warn을 출력하고 해당 파일 없이 계속 진행 |
| 오늘 날짜 report/runtime 미생성 | stale output으로 간주하고 stderr 출력 후 exit 1 |
| self-check 3회 실패 | `position-recommender 검증 실패: <항목>`를 출력하고 exit 1 |
| Discord notify 실패 | agent skill 내부에서는 호출하지 않음. cron 소비측이 stderr warn 후 계속 |

## Why this design

- **ADR-094**: 산출물을 표준 출력 JSON(`recommendation.json`)으로 전환. `render_recommendation.ts`가 이 JSON에서 md/html을 파생하고, self-check는 `recommendation_schema.ts` zod 검증으로 대체. 자체 markdown 파서 폐기.
- **ADR-101**: 표준 출력 JSON을 단일 산출물로 확정. `source`·`closeDate`를 JSON에 직접 담아 소비측이 자족적으로 가공한다. cron은 Discord 요약 산문으로, backend는 hermes API 응답 JSON으로 각자 가공. `items.json` 파생과 daily runner 폐기.
- **ADR-030**: 옛 외부 subprocess 패턴 (`run_position_recommendation.sh` 76줄, `extract_position_report.ts` 45줄) → agent skill 직접 읽기/쓰기. SKILL.md 단일 진실 출처.
- **현재 세션 실행**: skill을 읽은 현재 에이전트가 직접 실행한다. 수동 실행 지침과 cron 운영 경로의 책임을 분리한다.
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
- `scripts/position-recommender/recommendation_schema.ts` — **표준 출력 JSON zod 스키마** (ADR-094, ADR-101). recommendation.json을 채우기 전에 이 파일에서 `PositionItem`(`source`·`closeDate` 포함) 등 필드 정의를 확인한다.
- `scripts/position-recommender/render_recommendation.ts` — 표준 출력 JSON에서 Markdown·HTML을 파생하는 렌더러. 입력 시 스키마 검증을 내장하므로 실행 자체가 self-check다.
- `scripts/position-recommender/render_candidate_preview.ts` — 표준 출력 JSON과 live posting snapshot에서 Discord/download용 클릭 가능한 전체 공고 HTML을 파생하는 렌더러.
- `references/report-html-delivery.md` — 포지션 리포트 HTML 전달과 전체 공고 HTML 산출물 규칙.
- `references/cron-operational-checks.md` — 포지션 추천 cron 변경 후 수집·HTML·제외 기준 검증 체크리스트.
- `references/cron-codex-markdown-delivery.md` — Hermes/Codex scheduled run에서 Markdown report/runtime mirror와 HTML copy를 직접 생성·검증하는 체크리스트.
- `career-os/docs/adr/INDEX.md` ADR-094 / ADR-030 — 본 설계 결정 근거
- `career-os/docs/adr/ADR-101-position-recommender-표준출력-json-단일화-소비측-가공.md` — 표준 출력 JSON 단일화와 소비측 가공 계약
