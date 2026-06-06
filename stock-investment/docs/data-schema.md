# Data Schema — stock-investment

stock-investment 워크스페이스의 **config · data · logs · .env 스키마** 단일 출처.
새 config 도입 또는 산출물 구조 변경 시 이 문서가 기준.

## 1. config/

6개 JSON 파일.
모두 `scripts/<name>/` runner에서 읽기 전용으로 참조.

### 1-1. catalysts.json

종목별/테마별 관심 이벤트 수동 관리 파일.
daily-stock-analysis-note와 morning-brief에서 참조.

```json
{
  "policy": {
    "mode": "manual-or-semi-automated",
    "description": "..."
  },
  "events": [
    {
      "ticker": "string",              // 종목 심볼 (예: "000660.KS")
      "name": "string",               // 종목명
      "theme": "string",              // 연관 테마 (예: "HBM / AI memory")
      "event": "string",              // 이벤트 내용 설명
      "date": "YYYY-MM-DD | null",    // null이면 날짜 미확정 watch
      "status": "watch | past",
      "notes": "string"
    }
  ]
}
```

현재 수록 종목: SK하이닉스(000660.KS) × 2건, NVDA, GOOGL, QQQ.

### 1-2. current-issues.json

`current-issue-analysis` skill이 분석할 현안 큐.
각 issue 키는 `run_issue_report.sh <issue-key>` 호출 시 참조.

```json
{
  "issues": {
    "<issue-key>": {
      "title": "string",
      "description": "string",
      "focusQuestions": ["string"],
      "sources": [
        {
          "id": "string",
          "url": "string",
          "topic": "string",
          "type": "string (optional)"    // 예: "sec-submissions-json"
        }
      ]
    }
  },
  "defaultIssue": "string"              // 기본 분석 대상 issue-key
}
```

현재 수록 issue:

- `us-clarity-act` — CLARITY Act·스테이블코인·Circle/USDC 규제 분석
- `google-io-alphabet-ai` — Google I/O·Alphabet AI 모멘텀 분석
- `ai-semiconductor-infrastructure` — AI 반도체/인프라 사이클 분석

### 1-3. daily-stock-universe.json

`daily-stock-analysis-note` skill이 분석 후보를 고르는 종목 풀.

```json
{
  "policy": {
    "tone": "관찰 후보 / 분석 후보",
    "markets": ["US", "KR"],
    "focus": ["string"]
  },
  "symbols": [
    {
      "ticker": "string",    // 예: "NVDA", "000660.KS"
      "name": "string",
      "market": "US | KR",
      "theme": ["string"]
    }
  ]
}
```

현재 수록: US 17종목 + KR 13종목 = 30종목.
이미 발행된 종목은 `data/daily-notes/history.json` 기준으로 자동 후보에서 제외한다.
같은 종목을 다시 다룰 때는 신규 일일 노트가 아니라 기존 노트 업데이트나 별도 후속 분석으로 처리한다.

### 1-4. sources.json

morning-brief 수집에 사용하는 뉴스·가격 소스 목록.

```json
{
  "newsSources": [
    {
      "id": "string",
      "url": "string",
      "topic": "string"
    }
  ],
  "priceRanges": {
    "<symbol>": "1mo | 3mo | 1y"
  }
}
```

현재 뉴스 소스 17개: Circle/USDC, Bitcoin, Alphabet IR, Google AI, Google I/O, Nasdaq, NVIDIA, TSMC, ASML, Broadcom, AMD, 반도체 산업, Vertiv 등.
가격 수집 범위: CRCL, BTC-USD, QQQ, ^NDX, GOOGL, GOOG, SMH, NVDA, TSM, AVGO, AMD, ASML, VRT (모두 `1mo`).

### 1-5. theme-reports.json

Core + Theme 구조 메타데이터.
morning-brief core 섹션과 테마별 현안 분석 실행 정책 정의.

```json
{
  "version": 1,
  "policy": "string",
  "coreMorningSections": ["string"],     // 매일 포함할 core 섹션 목록
  "themes": {
    "<theme-key>": {
      "issueKey": "string",              // current-issues.json의 issue-key 매핑
      "manualCommand": "string",         // 직접 실행 명령 예시
      "triggerCandidates": ["string"],   // 자동 트리거 조건 (현재 수동 참조용)
      "defaultCadence": "string"
    }
  }
}
```

현재 coreMorningSections:

- CRCL
- BTC
- GOOGL/Google
- QQQ/Nasdaq
- AI semiconductor/infrastructure summary

현재 themes: `ai-semiconductor-infrastructure`, `google-ai`, `stablecoin-regulation`.

### 1-6. watchlist.json

morning-brief의 종목 감시 프로필.

```json
{
  "profiles": {
    "<profile-name>": {
      "title": "string",
      "primaryEquities": [
        { "symbol": "string", "name": "string", "focus": ["string"] }
      ],
      "crypto": [
        { "symbol": "string", "name": "string", "focus": ["string"] }
      ],
      "macroIndices": [
        { "symbol": "string", "name": "string", "focus": ["string"] }
      ],
      "expansionWatchlist": [
        { "symbol": "string", "name": "string", "focus": ["string"] }
      ]
    }
  },
  "defaultProfile": "string"
}
```

현재 프로필: `circle-bitcoin` 1개.

- primaryEquities: CRCL, GOOGL, GOOG
- crypto: BTC-USD
- macroIndices: QQQ, ^NDX
- expansionWatchlist: SMH, NVDA, TSM, AVGO, AMD, ASML, VRT

## 2. data/ 산출물 스키마

### 2-1. data/YYYY-MM-DD/ (morning-brief)

| 파일 | 생성자 | 내용 |
|---|---|---|
| `market-data.json` | collect_sources.py | 종목별 가격 데이터 (yfinance 기반) |
| `raw-news.json` | collect_sources.py | 소스별 뉴스 수집 결과 |
| `report.md` | native skill (Claude 직접 Write) | 최종 한국어 보고서 |

### 2-2. data/issues/YYYY-MM-DD/\<issue\>/ (current-issue-analysis)

| 파일 | 생성자 | 내용 |
|---|---|---|
| `raw-sources.json` | collect_issue_sources.py | 소스별 수집 결과 |
| `report.md` | native skill (Claude 직접 Write) | 최종 한국어 현안 분석 보고서 |

### 2-3. data/daily-notes/YYYY-MM-DD/ (daily-stock-analysis-note)

| 파일 | 생성자 | 내용 |
|---|---|---|
| `selected.json` | collect_daily_note_inputs.py | 선택된 종목 정보 + 선택 근거 |
| `raw-inputs.json` | collect_daily_note_inputs.py | 종목 관련 뉴스·가격 수집 결과 |
| `report.md` | native skill (Claude 직접 Write) | 런타임 초안 (fos-study 발행본과 별개) |

fos-study 발행본: `career-os/sources/fos-study/finance/investing/ai-tech-stock/YYYY-MM-DD-<slug>.md`

### 2-4. data/daily-notes/history.json

daily-stock-analysis-note가 종목 선택 이력을 기록하고, 이미 발행된 종목의 중복 신규 노트를 막는 파일.
자동 선택은 `pushStatus`가 `pushed` 또는 `no-change`인 티커를 제외한다.
`TICKER` 환경변수로 수동 지정해도 이미 발행된 티커면 수집 단계에서 실패해야 한다.
US 종목만 연속 선택될 경우 한국 종목에 rotation 가점 부여.

### 2-5. data/thesis-tracker/\<ticker-slug\>.json

Anthropic financial-services 레퍼런스 기반 종목 가설 누적 로그.
prd.md 8번 미연결 항목 — 현재 디렉터리만 존재, 자동화 미실행.

```json
{
  "ticker": "string",
  "name": "string",
  "currentThesis": "string",      // 현재 핵심 투자 가설 (1문장)
  "pillars": ["string"],          // thesis 지지 근거 3개
  "risks": ["string"],            // thesis 반증 조건 3개
  "catalysts": ["string"],        // 앞으로 1-3개월 catalyst
  "updates": [
    {
      "date": "YYYY-MM-DD",
      "event": "string",
      "impact": "strengthen | weaken | neutral",
      "notes": "string"
    }
  ]
}
```

### 2-6. data/audit/

workspace-audit skill 결과물.
형식은 audit 시점마다 다를 수 있음.

## 3. logs/ 스키마

ADR-003 native 전환으로 `_shared/bin/track_task.sh` self-wrap를 제거했다.
`logs/task-runs.jsonl` 은 stock-investment에서 더 이상 생성되지 않는다 (후속 모노레포 plan 폐기 예정).

### 3-1. logs/task-runs.jsonl

ADR-003으로 stock-investment 미생성.
후속 모노레포 정리 plan에서 파일 제거 예정.

### 3-2. logs/token-usage.jsonl

openclaw cron 실행 메타데이터. 상세 토큰 분류 포함.

## 4. .env 스키마

계획: plan003에서 도입. 현재는 `.env.example` placeholder.

| 변수 | 필수 여부 | 설명 |
|---|---|---|
| `DISCORD_CHANNEL_ID` | 필수 | Discord `#주식토크` 채널 ID (openclaw 경유 알림) |
| `TZ` | 권장 | `Asia/Seoul` (현재 run_daily_note.sh에 하드코드 — .env 이전 검토 중) |
| `SKIP_NOTIFY` | 선택 | `1` 설정 시 Discord 알림 억제 (로컬 테스트용) |
| `SKIP_PUSH` | 선택 | `1` 설정 시 fos-study git push 억제 (daily-note 전용) |
| `TICKER` | 선택 | daily-note 종목 수동 지정 (예: `TICKER=NVDA`) |
| `CLAUDE_TIMEOUT_SECONDS` | 선택 | Claude CLI 타임아웃 (기본 120초) |
