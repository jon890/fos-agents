# Data Schema — apartment

apartment 워크스페이스의 **config / logs / 산출물 파일 구조** 단일 출처. 새 config 도입·산출물 형식 변경·스키마 확장 시 이 문서가 기준.

## 1. config/

### 1-1. focus-unit.json

포커스 평형 메타데이터. 수집기·정규화기의 단지·평형 매칭 기준.

```
{
  complexName: string,          // "엘지원앙아파트"
  complexAlias: string,         // "LG원앙"
  primaryFocusUnit: {
    label: string,              // "59A"
    exclusiveAreaM2: number,    // 59.xx
    aliases: string[]           // ["59A", "59-A", "59 A", "전용59", "59㎡", "59형"]
  },
  notes: string[]
}
```

59A non-match 정책: 단지 전체 평균·다른 평형 값을 59A 확인으로 표기 금지. unverified alias 매칭 시 "(타입 미확인)" 명기.

### 1-2. guri-buy-complexes.json

Guri 광역 매수 탐색 후보 단지 메타데이터. Guri buy-search 워크플로의 단일 출처.

```
{
  purpose: string,
  budgetManwon: {
    target: number,             // 65000 (6.5억)
    nearBudgetCeiling: number
  },
  candidateComplexes: [
    {
      name: string,
      aliases: string[],
      complexNo: number,        // Naver complexNo
      focusAreasM2: number[],
      lifeArea: string,         // "인창동" | "수택동" | ...
      notes: string[]
    }
  ],
  commuteTarget: string,        // "경기 성남시 분당구 대왕판교로645번길 16"
  excludedComplexes: [
    {
      name: string,
      complexNo: number,
      reason: string
    }
  ],
  selectionRules: {
    minHouseholdsForRecommendation: number,   // 501
    excludeNonFlatDailyAccess: boolean        // true
  }
}
```

### 1-3. interior-reference-digest.json

인테리어 레퍼런스 디제스트 skill 설정.

```
{
  target: string,               // "구리럭키아파트 5동 1004호"
  stylePreferences: string[],
  currentDecisionNote: string,
  outputRoot: string,           // "data/interior-reference-digest"
  sourcePriority: string[],
  searchQueries: {
    exactComplex: string,
    nearbyAndSimilar: string,
    topicFocused: string
  },
  scoringRubric: object,
  dailyReport: {
    maxRecommendations: number,
    preferredRecommendations: number,
    includeTodayDecisionQuestion: boolean,
    todayDecisionQuestionCount: number,       // 3
    discordSafe: boolean,
    autoAppendReferenceCandidates: boolean,
    autoAppendDecisions: boolean,
    scheduleRecommendation: string
  },
  referenceNotebook: string,
  evaluationFocus: string[]
}
```

### 1-4. lucky-24-floorplan.json

구리럭키 24호 타입 평면도 분석 데이터.

```
{
  target: string,
  source: string,
  visibleDimensionsMm: object,
  laundryInterpretation: string,
  applianceModels: object,
  fieldCheckQuestions: string[]
}
```

### 1-5. .env (워크스페이스 root)

ai-nodes ADR-004: 비밀 정보는 워크스페이스 root `.env` 격리. `.env.example` 템플릿 제공.

| 변수 | 필수 | 용도 |
|---|---|---|
| `NAVER_COOKIE` | 권장 | NID_AUT+NID_SES 쿠키 문자열. 없으면 Naver 수집 비활성화 |
| `NAVER_BEARER` | 선택 | Bearer JWT 수동 주입 fallback. 미설정 시 agent-browser 자동 추출 시도 |
| `DISCORD_WEBHOOK_URL` | 권장 | Discord 알림 발송 대상 |

## 2. data/ (산출물)

### 2-1. data/YYYY-MM-DD/

`apartment-daily-report` skill 산출물. 날짜별 1회 멱등.

| 파일 | 설명 |
|---|---|
| `raw-search.json` | 수집기 원본 응답 (source 실패 raw도 보존) |
| `summary.json` | 정규화 집계 (9 key 구조, 아래 참조) |
| `claude.result.json` | `claude --output-format json` 원본 envelope |
| `report.md` | Claude 생성 최종 리포트 |
| `report.fallback.md` | Claude 90s 타임아웃 시 대체 마크다운 폴백 |

**summary.json 9 key**:

```
{
  generatedAt: string,          // ISO 8601
  target: string,
  focusUnit: string,            // "59A"
  sources: object,              // source별 수집 결과/상태
  recentTransactions: object,
  listingSummary: object,
  comparison: object,           // 3 source 교차비교
  notes: string[],
  focusSummary: object          // 59A 특화 요약
}
```

### 2-2. data/YYYY-MM-DD-HHMM-guri-buy-search/

Guri 광역 매수 탐색 산출물. 실행 시각 포함 (같은 날 복수 실행 허용).

| 파일 | 설명 |
|---|---|
| `raw-search.json` | 후보 단지별 수집 원본 |
| `summary.json` | 후보 단지 집계 + 랭킹 결과 |
| `report.md` | 30개 매물 Discord 출력 포맷 리포트 |

### 2-3. data/interior-reference-digest/YYYY-MM-DD/

`apartment-interior-reference-digest` skill 산출물.

| 파일 | 설명 |
|---|---|
| `request.md` | skill이 생성한 Claude 호출 요청 컨텍스트 |
| `report.md` | 디제스트 리포트 (추천 + 3 결정 질문 + 7일 dedupe) |

### 2-4. data/audit/YYYY-MM-DD.md

워크스페이스 감사 노트. `workspace-audit` skill 산출물.

## 3. logs/

`_shared/bin/track_task.sh`가 단일 출처. 상세 스키마는 `_shared/bin/track_task.sh` 내부 문서.

### 3-1. logs/task-runs.jsonl

실행별 한 줄 JSON.

```
{
  run_id: string,
  task: string,                 // "apartment:daily-report"
  started_at: string,           // ISO 8601
  finished_at: string,
  exit_code: number,
  model: string,
  cost_usd: number,
  tokens_input: number,
  tokens_output: number
}
```

### 3-2. logs/token-usage.jsonl

Claude usage raw JSON. `TRACK_TASK_CLAUDE_USAGE_FILE` env로 수집.

### 3-3. logs/.usage-status/

트래커 상태 캐시 디렉터리.

## 4. docs/interior/ (인테리어 결정 영역)

skill 도메인 자산 — 5문서(prd/data-schema/flow/code-architecture/adr)와 별도 영역. **결정·분석은 docs/interior/**, 디제스트 산출물은 data/interior-reference-digest/. ai-nodes ADR-004 docs vs data 분리 절충.

| 파일 | 용도 |
|---|---|
| `interior-references.md` | 레퍼런스 후보 목록 및 평가 |
| `lucky-5-1004-interior-decisions.md` | 확정 결정 누적 |
| `lucky-5-1004-decision-queue.md` | 검토 대기 결정 항목 |
| `lucky-5-1004-decision-summary.md` | 결정 요약 (전체 상태 스냅샷) |
| `lucky-5-1004-field-checklist.md` | 현장 확인 체크리스트 |
| `lucky-5-1004-contractor-brief.md` | 시공사 브리핑용 정리 |
