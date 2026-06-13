---
name: position-recommender
description: 후보자 프로필·이력서·태스크 문서와 현재 열린 개별 채용공고를 바탕으로 지원 가능한 포지션을 추천. '내가 갈만한 포지션 추천', '지원 포지션 후보', 주기적 role-fit 추천 요청 시 사용. fos-study가 아닌 비공개 career-os 리포트.
---

# Position Recommender

후보자 프로필과 **현재 열린 개별 채용공고**를 종합 분석해 현실적인 지원 후보와 포지셔닝 전략을 추천하는 비공개 career-os skill.

핵심 정책: 강력 추천/도전 추천에는 **구체적인 개별 공고 URL이 있고 현재 active/open 지원 가능함이 확인된 공고만** 올린다. 닫힌 공고, 상태 확인 실패 공고, 회사명, 채용 홈, 기술블로그, 뉴스, "이 회사가 좋아 보인다" 수준의 lead는 추천 티어에 올리지 않는다. active/open 여부가 검증되지 않으면 보류 또는 제외한다.

## When to use

- 사용자가 `/position-recommender` 슬래시 호출
- 자연어 요청: "내가 갈만한 포지션 추천해줘", "지원 포지션 후보 뽑아줘", "role-fit 분석해줘"
- 추가 포커스: "AI 서비스팀 백엔드 위주로 봐줘", "AX/AI Transformation 포지션도 봐줘", "AI Agent/AI 플랫폼도 찾아줘", "커머스·핀테크 중심으로", 특정 회사·팀 언급
- 최신 채용 자동 수집 포함: "최신 Wanted 공고 같이 봐줘", "Toss 채용 자동 수집해줘"
- 사용자가 채용공고 markdown 파일 경로 직접 지정: "data/runtime/live-position-postings.md 참고해줘"
- "이직 추천해줘", "어떤 회사에 지원할까", "채용 공고 맞는 거 찾아줘", "job fit 분석해줘"

비정형 면담 요청은 자동 전략 리포트로 라우팅하지 않는다. 회사·상대·목적이 확인된 뒤 일반 면접 준비 메모가 필요하면 `/interview-prep-analyzer` 로 라우팅한다.
학습 갭·면접 준비 진단 → `/interview-prep-analyzer` 로 라우팅.

fos-study가 아닌 비공개 career-os 리포트 — 포지션 분석은 후보자 의사결정 자산.

## 생성 산출물 품질 계약

포지션 추천 리포트는 비공개 내부 분석이지만 사용자가 바로 결정을 내릴 수 있는 문서여야 한다.

- 한국어 우선 섹션 제목과 자연스러운 한국어 문장을 사용한다.
  `role-fit`, `active/open`, URL 같은 코드·상태 label만 필요한 경우 영어를 유지한다.
- 첫 10줄 안에 결론을 둔다.
  오늘 가장 추천하는 행동, 추천 후보가 부족한 이유, 또는 보류 판단 중 하나가 바로 보여야 한다.
- 내부 분석에는 근거 경로와 수집 snapshot 근거를 유지한다.
  개별 공고 URL, active/open 근거, 최근 반복 점검 근거를 숨기지 않는다.
- 사용자에게 보이는 Discord 요약은 내부 파일 경로, plan 번호, commit hash 같은 내부 맥락을 포함하지 않는다.
  추천 리포트 본문도 불필요한 plan/commit 언급으로 결론을 흐리지 않는다.
- 근거가 부족한 항목은 `needs_evidence`라는 raw label을 사용자에게 그대로 노출하지 않는다.
  반드시 `보강 필요 / 선택지 / 권장 행동` 구조로 바꾼다.
  예: `보강 필요: AI Agent 운영 경험 근거가 약함 / 선택지: 관련 프로젝트 근거 확인 또는 도전 추천으로 하향 / 권장 행동: 지원 전 task 근거 1개 확인`.
- 외부 제출, 채용 사이트 로그인, 공개 발행, candidate-profile 수정은 하지 않는다.
  필요한 경우 `사용자 승인 필요` 행동으로만 쓴다.

## Inputs

Claude는 다음을 `Read` 도구로 직접 로드:

1. `career-os/config/candidate-profile.md` — 후보자 프로필 (11섹션 prose, 경력·기술·자기진단 포함)
2. `career-os/config/sources.json` (`techBlog` 필드) — 엔지니어링 블로그 신호 판단
3. `references/position-recommendation-prompt.md` — 추천 분석 프롬프트 가이드
4. `references/position-context-index.md` — 추천 컨텍스트 인덱스 (도메인·회사 우선순위)
5. `references/position-decision-criteria.md` — 랭킹·제외 기준 (role-fit 점수 기준 포함)
6. `references/company-upside-reference.md` — 회사 브랜드·규모·성장 upside 참조
7. `references/verified-company-research-targets.json` — 검증된 회사 탐색 대상 목록. 추천 티어 입력이 아니라, active 개별 공고가 부족할 때 다음 수집 범위 결정에만 사용한다.
8. (선택) 사용자가 자연어로 지정한 채용공고 markdown 파일 경로 (예: `career-os/data/runtime/live-position-postings.md`)

## Workflow

### 1. 채용공고 자동 수집

daily/cron은 `scripts/position-recommender/run_daily_with_claude.sh`가 Claude 호출 전에 `data/runtime/live-position-postings.md`를 먼저 갱신한다. native skill은 이 파일을 우선 Read한다.

수동 Claude 실행에서 사용자 요청에 **"최신 채용"**, **"실시간 채용"**, **"Wanted"**, **"공고 가져와줘"** 키워드가 있는데 `data/runtime/live-position-postings.md`가 없거나 오래됐으면 실행:

```bash
bun career-os/scripts/position-recommender/collect_live_postings.ts
```

(기본 출력 경로는 스크립트 자기 위치 기준으로 `career-os/data/runtime/live-position-postings.md`로 고정 — cwd 무관. 다른 위치로 redirect할 때만 `--output <path>` 추가.)

- 수집 실패 (exit non-zero) 시 stderr warn 출력 후 계속 진행 (수동 컨텍스트만으로 분석)
- 사용자가 직접 파일 경로를 지정한 경우: 이 단계 건너뛰고 해당 파일을 Read
- `Toss 자동 수집` 또는 커리어 아티클은 active/open 개별 공고로 검증되지 않는 한 추천 입력에서 제외한다.
- 강력 추천/도전 추천의 입력 후보는 수집 snapshot 안의 `posting_status: active/open` + `link_type: direct_posting` + 개별 URL이 있는 항목으로 제한한다.
- snapshot에 `posting_status: unknown`, career article, search page, 채용홈 lead만 있는 항목이 있으면 추천 후보로 사용하지 않는다.
- snapshot의 `closes_at`, `days_until_close`, `close_urgency`를 우선 읽고, `opened_at`은 값이 있을 때만 공고 기간에 포함한다. 마감이 없으면 `상시/마감 미정`으로 쓴다. `close_urgency`가 `urgent`/`soon`이면 준비 액션에 마감 임박을 반영한다.
- snapshot의 `main_tasks`, `requirements`, `preferred`는 실행 시간을 줄이기 위해 요약 길이로 잘린 입력이다.
  추천 판단에는 충분하지만, 문장 일부가 `...`로 끝나면 원문을 보았다고 쓰지 않는다.

### 2. 컨텍스트 + 최근 추천 이력 로드 (Read)

- Inputs 1~7 모두 Read
- 수집된 `career-os/data/runtime/live-position-postings.md` 또는 사용자 지정 파일 Read
- 최근 7일 `career-os/data/reports/daily/*/position-recommendation/report.md` 중 존재하는 파일을 Read
- 사용자의 자연어 포커스 키워드 (예: "AI 서비스팀 위주") 를 분석 컨텍스트에 반영
- 사용자의 현재 선호상 AI 서비스/AI Transformation(AX)/AI Agent/AI 플랫폼 포지션도 탐색한다. 단, 강력/도전 추천에는 서버·플랫폼 개발 전이가 분명하고 active/open 개별 공고 URL이 확인된 항목만 올린다.
- 백엔드 + AI 전환 후보는 별도 관점으로 검토한다. 예: AI Agent/RAG/MCP/LLMOps/ML Backend/AI Platform처럼 API·서버·플랫폼·운영 자동화와 AI 응용 경험이 함께 필요한 공고.
- Toss는 공식 `job-groups` API의 그룹/하위 포지션까지 수집 대상으로 본다. `AI Engineer` 그룹의 Platform/Brain/Commerce/Model/Ads 하위 포지션처럼 목록 화면의 그룹 구조에 묶인 공고를 누락하지 않는다.
- 최근 7일 강력 추천/도전 추천에 반복 등장한 회사·URL은 감점한다. 단, 동일 개별 active 공고가 여전히 최상위 후보면 유지할 수 있지만 “반복 유지 사유”를 명시한다.
- 매일 최소 1개 이상은 최근 7일 내 강력 추천에 없던 신규 **개별 active 공고**를 포함한다. 적합한 신규 공고가 없으면 추천 티어를 억지로 채우지 말고 “신규 active 공고 부족”을 명시한다.

### 3. 추천 분석 + 리포트 작성

`references/position-recommendation-prompt.md` 가이드에 따라 후보자 프로필 × 포지션 후보 교차 분석:

보고서 필수 구조:
- 첫 줄: `# <YYYY-MM-DD> 포지션 추천 리포트`
- 첫 10줄 안: 오늘의 결론 또는 권장 행동 1~3줄
- **추천 배경 요약** — 후보자 현재 강점·약점 포지션 2~3문장
- **강력 추천** 티어 — role-fit 높고 gap 준비 가능한 포지션
  - 최대 3개
  - 각 항목: role title + 개별 active 포스팅 링크 + 공고 기간 + 지원 근거 1~2문장 + gap 준비사항 + first action
- **도전 추천** 티어 — stretch goal, 준비 기간 필요
  - 최대 2개
  - 각 항목: role title + 개별 active 포스팅 링크 + 공고 기간 + 지원 근거 1~2문장 + gap 준비사항 + first action
- **보류·주의** 티어 — 현시점 비추천 + 사유 명시
  - 최대 3개
  - 각 항목: role title + 비추천 사유
- **최근 반복 점검** — 최근 7일 반복 후보와 신규 후보 확보 여부
- 총 30~70줄 권장. 판단에 필요한 근거만 남기고 장문 회사 설명은 쓰지 않는다.

### 4. 리포트 저장 (Write)

```
Write → career-os/data/reports/daily/YYYY-MM-DD/position-recommendation/report.md
Write → career-os/data/runtime/position-recommendation.md  (런타임 미러)
Runner post-process → career-os/data/reports/daily/YYYY-MM-DD/position-recommendation/report.html
Runner post-process → career-os/data/runtime/position-recommendation.html  (런타임 HTML 미러)
```

날짜는 Asia/Seoul 기준 (`TZ=Asia/Seoul date +%F`). UTC `new Date().toISOString()` 날짜를 사용하지 않는다.

daily/cron 실행에서 오늘 날짜 파일을 새로 쓰지 못하면 성공으로 끝내지 않는다.

### 5. Discord 알림

Claude native skill 내부에서는 Discord 알림을 직접 보내지 않는다.

daily/cron 실행의 Discord 전송은 외부 runner
`career-os/scripts/position-recommender/run_daily_with_claude.sh`가
freshness check 통과 후 `_shared/lib/notify_discord.ts`로 수행한다.
runner는 Markdown 리포트 검증 후 HTML 미러를 생성하고,
아침 Discord 알림에 HTML 파일을 첨부한다.
이는 OpenClaw/Codex가 오케스트레이션과 외부 전송을 맡고,
Claude native skill은 리포트 생성·자기 검증에 집중하게 하기 위함이다.

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

리포트 작성 후 자기 출력 검증 7항목 (옛 `extract_position_report.ts` 45줄 흡수 + stale-output 방지):

1. 첫 줄 `# ` 시작 (단일 `#`, `## ` 시작 금지)
2. 총 줄 수 ≥ 30
3. **강력 추천**, **도전 추천**, **보류·주의** 3 티어 헤더 모두 존재
4. 첫 줄 날짜가 Asia/Seoul 오늘 날짜와 일치
5. `career-os/data/reports/daily/YYYY-MM-DD/position-recommendation/report.md` 파일 존재 확인
6. `career-os/data/runtime/position-recommendation.md` 파일 존재 확인, 첫 줄 날짜가 오늘 날짜와 일치
7. **최근 반복 점검** 섹션 또는 동등한 반복/신규 후보 설명 존재
8. 강력 추천/도전 추천의 모든 항목이 `공고 링크: https://...`를 포함하고, `탐색 링크`만 있는 항목이 추천 티어에 없음
9. 강력 추천/도전 추천의 `링크 근거 수준`이 `개별 공고 active 확인` 또는 `개별 공고 open 확인` 계열임
10. 닫힌 공고, `unknown` 상태, 커리어 아티클, 채용홈, 검색 페이지가 강력 추천/도전 추천에 없음
11. 강력 추천/도전 추천의 모든 항목에 `공고 기간` 또는 동등한 opened/closes/days_until_close/urgency 정보가 있음
12. 첫 10줄 안에 결론, 오늘의 권장 행동, 또는 추천 후보 부족 사유가 있음
13. 섹션 제목은 한국어 우선이며, 영어 label은 상태값·코드 식별자·URL 설명에만 사용됨
14. raw `needs_evidence`가 사용자-facing 문장에 남아 있지 않고, 필요한 경우 `보강 필요 / 선택지 / 권장 행동` 구조로 바뀌어 있음
15. Discord 요약 대상 문장에 내부 파일 경로, plan 번호, commit hash가 없음
16. 실제 제출·로그인·공개 발행·candidate-profile 수정 지시가 없고, 필요한 경우 `사용자 승인 필요`로만 표현됨

실패 항목 있으면 해당 섹션 보완 후 재작성. **최대 3회 시도**.
4회째도 실패 시 `stderr: position-recommender 검증 실패: <실패 항목>` + exit 1.

## Error handling

| 상황 | 처리 |
|---|---|
| `references/position-recommendation-prompt.md` 부재 | stderr + exit 1 |
| `candidate-profile.md` 부재 | stderr + exit 1 |
| `sources.json` 부재 | stderr warn + techBlog 없이 계속 진행 |
| `collect_live_postings.ts` 실패 | stderr warn + 수동 컨텍스트로 계속 진행 |
| 사용자 지정 파일 path 부재 | stderr warn + 해당 파일 없이 계속 진행 |
| 오늘 날짜 report/runtime 미생성 | stale output으로 간주, stderr + exit 1 |
| self-check 3회 실패 | `position-recommender 검증 실패: <항목>` + exit 1 |
| Discord notify 실패 | native skill 내부에서는 호출하지 않음. 외부 runner가 stderr warn 후 계속 |

## Why this design

- **ADR-030**: 옛 외부 subprocess 패턴 (`run_position_recommendation.sh` 76줄 + `extract_position_report.ts` 45줄) → native skill 직접 Read/Write. SKILL.md 단일 진실 출처.
- **self-check 내재화**: `extract_position_report.ts`가 하던 첫 줄 `#` + 줄 수 검증을 Claude 자체 검증으로 흡수. 외부 프로세스 불필요.
- **수집 선택적 호출**: 기존 `POSITION_POSTINGS_FILE` env 주입 패턴 → 자연어 인자 흡수. 매번 수집하지 않아 비용·시간 효율.
- **env 변수 제거**: `POSITION_CONTEXT` + `POSITION_POSTINGS_FILE` → 자연어 인자. `claude -p "/position-recommender AI 서비스팀 백엔드 위주"`로 직접 전달.
- **비공개 유지**: position 분석은 후보자 본인 의사결정 자산 — fos-study publish 안 함. `publish_job_analysis.sh` 폐기 근거(ADR-030).
- **재실행 멱등**: 날짜별 경로(`data/reports/daily/YYYY-MM-DD/...`)로 충돌 없는 복수 실행 지원.

## References

- `references/position-recommendation-prompt.md` — 분석 프롬프트 가이드
- `references/position-context-index.md` — 추천 컨텍스트 인덱스
- `references/position-decision-criteria.md` — 랭킹·제외 기준
- `references/company-upside-reference.md` — 회사 브랜드·규모 upside 참조
- `references/verified-company-research-targets.json` — 검증된 탐색 대상 회사군
- `career-os/docs/adr.md` ADR-030 — 본 설계 결정 근거
