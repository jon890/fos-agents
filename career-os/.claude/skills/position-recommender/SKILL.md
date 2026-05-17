---
name: position-recommender
description: 후보자 프로필·이력서·태스크 문서·채용 시장 컨텍스트를 바탕으로 적합한 포지션과 포지셔닝 전략을 추천. '내가 갈만한 포지션 추천', '지원 포지션 후보', 주기적 role-fit 추천 요청 시 사용. fos-study가 아닌 비공개 career-os 리포트.
---

# Position Recommender

후보자 프로필과 채용 시장 컨텍스트를 종합 분석해 현실적인 타깃 포지션·포지셔닝 전략을 추천하는 비공개 career-os skill.

## When to use

- 사용자가 `/position-recommender` 슬래시 호출
- 자연어 요청: "내가 갈만한 포지션 추천해줘", "지원 포지션 후보 뽑아줘", "role-fit 분석해줘"
- 추가 포커스: "AI 서비스팀 백엔드 위주로 봐줘", "커머스·핀테크 중심으로", 특정 회사·팀 언급
- 최신 채용 자동 수집 포함: "최신 Wanted 공고 같이 봐줘", "Toss 채용 자동 수집해줘"
- 사용자가 채용공고 markdown 파일 경로 직접 지정: "data/runtime/live-position-postings.md 참고해줘"

fos-study가 아닌 비공개 career-os 리포트 — 포지션 분석은 후보자 의사결정 자산.

## Inputs

Claude는 다음을 `Read` 도구로 직접 로드:

1. `career-os/config/candidate-profile.md` — 후보자 프로필 (11섹션 prose, 경력·기술·자기진단 포함)
2. `career-os/config/sources.json` (`techBlog` 필드) — 엔지니어링 블로그 신호 판단
3. `references/position-recommendation-prompt.md` — 추천 분석 프롬프트 가이드
4. `references/position-context-index.md` — 추천 컨텍스트 인덱스 (도메인·회사 우선순위)
5. `references/position-decision-criteria.md` — 랭킹·제외 기준 (role-fit 점수 기준 포함)
6. `references/company-upside-reference.md` — 회사 브랜드·규모·성장 upside 참조
7. `references/verified-company-research-targets.json` — 검증된 회사 탐색 대상 목록
8. (선택) 사용자가 자연어로 지정한 채용공고 markdown 파일 경로 (예: `career-os/data/runtime/live-position-postings.md`)

## Workflow

### 1. (선택적) 채용공고 자동 수집

사용자 요청에 **"최신 채용"**, **"Wanted"**, **"Toss 자동 수집"** 키워드가 있을 때만 실행:

```bash
bun career-os/scripts/position-recommender/collect_live_postings.ts \
  --output career-os/data/runtime/live-position-postings.md
```

- 수집 실패 (exit non-zero) 시 stderr warn 출력 후 계속 진행 (수동 컨텍스트만으로 분석)
- 사용자가 직접 파일 경로를 지정한 경우: 이 단계 건너뛰고 해당 파일을 Read

### 2. 컨텍스트 로드 (Read)

- Inputs 1~7 모두 Read
- (선택) 수집된 `career-os/data/runtime/live-position-postings.md` 또는 사용자 지정 파일 Read
- 사용자의 자연어 포커스 키워드 (예: "AI 서비스팀 위주") 를 분석 컨텍스트에 반영

### 3. 추천 분석 + 리포트 작성

`references/position-recommendation-prompt.md` 가이드에 따라 후보자 프로필 × 포지션 후보 교차 분석:

보고서 필수 구조:
- 첫 줄: `# <YYYY-MM-DD> 포지션 추천 리포트`
- **추천 배경 요약** — 후보자 현재 강점·약점 포지션 1단락
- **강력 추천** 티어 — role-fit 높고 gap 준비 가능한 포지션
  - 각 항목: role title + 포스팅 링크 + 지원 근거 + gap 준비사항 + first action
- **도전 추천** 티어 — stretch goal, 준비 기간 필요
  - 각 항목: role title + 포스팅 링크 + 지원 근거 + gap 준비사항 + first action
- **보류·주의** 티어 — 현시점 비추천 + 사유 명시
  - 각 항목: role title + 비추천 사유
- 총 30줄 이상

### 4. 리포트 저장 (Write)

```
Write → career-os/data/reports/daily/YYYY-MM-DD/position-recommendation/report.md
Write → career-os/data/runtime/position-recommendation.md  (런타임 미러)
```

날짜는 실행 시점 ISO 기준 (`new Date().toISOString().slice(0, 10)`).

### 5. Discord 알림

```bash
bun --env-file=career-os/.env ../_shared/lib/notify_discord.ts \
  "[완료] position-recommender: data/reports/daily/YYYY-MM-DD/position-recommendation/report.md"
```

알림 실패는 비치명적 — stderr warn만, skill은 success 종료.

## Self-check

리포트 작성 후 자기 출력 검증 4항목 (옛 `extract_position_report.ts` 45줄 흡수):

1. 첫 줄 `# ` 시작 (단일 `#`, `## ` 시작 금지)
2. 총 줄 수 ≥ 30
3. **강력 추천**, **도전 추천**, **보류·주의** 3 티어 헤더 모두 존재
4. `career-os/data/runtime/position-recommendation.md` 파일 존재 확인

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
| self-check 3회 실패 | `position-recommender 검증 실패: <항목>` + exit 1 |
| Discord notify 실패 | stderr warn, skill은 success |

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
