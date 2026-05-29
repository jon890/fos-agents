# PRD — stock-investment

stock-investment 워크스페이스의 **제품 범위·MVP 기능 명세**.
현재 active 워크플로의 단일 출처.
새 기능을 추가하거나 우선순위를 정할 때 이 문서가 기준.

런타임 상태(어느 명령이 최근에 잘 도는지, 무엇이 멈췄는지)는 여기에 박지 않는다.
`skills/workspace-audit`가 그때그때 보고한다.

## 1. 목적

AI 기술 및 금융 시장 흐름을 매일 자동으로 수집·분석해 한국어 보고서를 생성하는 개인 투자 공부 워크플로.
단일 사용자(=본인)의 매일 재실행 가능한 로컬 워크플로.

## 2. 현재 MVP 타깃

| 항목 | 내용 |
|---|---|
| 1순위 종목 | CRCL (Circle Internet Group), BTC (Bitcoin) |
| 지수 | GOOGL/GOOG (Alphabet), QQQ/^NDX (Nasdaq 100) |
| AI 반도체/인프라 | SMH (섹터 ETF) + NVDA/TSM/AVGO/AMD/ASML/VRT |
| 관심 테마 | 스테이블코인 규제 (CLARITY Act), Google AI/I/O, AI 반도체 인프라 사이클 |
| 분석 범위 | 개인 투자 공부용 `관찰 후보 / 분석 후보` 톤 — 매수/매도 추천 아님 |

## 3. 사용자

본인 1인.
매일 아침 시장 모닝 브리핑 + 심층 현안 분석 + 블로그 노트 생성.

## 4. 기능 목록

| 번호 | skill | 산출물 | Discord | 빈도 |
|---|---|---|---|---|
| 1 | `stock-investing-morning-brief` | `data/YYYY-MM-DD/report.md` | 보고서 전문 | 매일 08:00 (Asia/Seoul) cron |
| 2 | `current-issue-analysis` | `data/issues/YYYY-MM-DD/<issue>/report.md` | 보고서 전문 | 수동 또는 트리거 발동 시 |
| 3 | `daily-stock-analysis-note` | `data/daily-notes/YYYY-MM-DD/report.md` + fos-study 발행 | 요약 + 발행 경로 | 매일 09:00 (Asia/Seoul) cron |

**현재 진입점 (ADR-003 native 전환 완료)**:

```bash
# native skill 진입점
claude -p "/stock-investing-morning-brief"
claude -p "/current-issue-analysis <issue-key>"
claude -p "/daily-stock-analysis-note"

# 또는 thin wrapper 직접 호출 (cron payload 동일 경로)
bash stock-investment/scripts/stock-investing-morning-brief/run_with_claude.sh
bash stock-investment/scripts/current-issue-analysis/run_with_claude.sh <issue-key>
bash stock-investment/scripts/daily-stock-analysis-note/run_with_claude.sh
```

## 5. 산출물 경로 정책

| 경로 | 용도 |
|---|---|
| `data/YYYY-MM-DD/` | morning-brief 산출물 (날짜별 1회 멱등) |
| `data/issues/YYYY-MM-DD/<issue>/` | current-issue-analysis 산출물 |
| `data/daily-notes/YYYY-MM-DD/` | daily-stock-analysis-note 런타임 산출물 |
| `data/daily-notes/history.json` | 종목 선택 이력 (중복 방지 rotation) |
| `data/thesis-tracker/<ticker-slug>.json` | 종목별 투자 가설 누적 로그 |
| `data/audit/` | workspace-audit 결과 |
| `logs/token-usage.jsonl` | 토큰 사용 상세 |

fos-study 발행 (daily-stock-analysis-note만):

- `career-os/sources/fos-study/finance/investing/ai-tech-stock/YYYY-MM-DD-<slug>.md`

## 6. 비기능 요구사항

- **재실행 가능성**: 같은 날 같은 명령을 여러 번 돌려도 정합성이 깨지지 않음 (날짜별 멱등).
- **비용 추적**: `logs/token-usage.jsonl` — openclaw cron 실행 메타데이터.
- **Discord 알림**: 완료 시 `#주식토크` 채널. `SKIP_NOTIFY=1` 로 억제 가능.
- **격리**: 다른 워크스페이스 (apartment, career-os, travel) 자산 교차 참조 없음.
  - 예외: daily-stock-analysis-note는 발행 목적으로 `career-os/sources/fos-study` 에 단방향 쓰기 (decisions/005 기반 예외 — ADR-001 미위반).
- **불확실성 명시**: 추정치는 추정으로 명기. 검증된 사실과 추론 구분.
- **비밀**: 워크스페이스 root `.env` 관리 (plan003에서 도입 예정). `DISCORD_CHANNEL_ID` 필수.

## 7. 의도적으로 안 하는 것

- 실시간 거래 자동화 (매수/매도 주문 전달 금지)
- 개인화된 투자 의견 (`Action: Buy/Sell/Upgrade/Downgrade` 표현 금지)
- 유료 금융 데이터 API 의존 (Daloopa/Morningstar/FactSet 등 MCP 커넥터 없이 동작)
- 광범위 풀-리포 분석 — 비용 및 컨텍스트 규율 위반
- 재무 자문 제공 — 본 워크플로 산출물은 `관찰 후보 / 분석 후보` 공부 노트

## 8. 미연결 / 보류 항목

decisions/006~007 (Anthropic financial-services 레퍼런스 활용) 기반 미실행 계획:

- **thesis tracker 자동화**: daily-stock-analysis-note 생성 시 `data/thesis-tracker/<slug>.json` 읽어 기존 가설 강화/약화 표시
- **catalyst calendar 연동**: `config/catalysts.json` 을 아침 브리프와 daily note에서 자동 참조
- **earnings preview/review 모드**: 실적 발표 전후 전용 runner (`run_earnings_preview.sh`, `run_earnings_review.sh`) 추가
- **Anthropic financial-services equity-research 구조 흡수**: thesis-tracker + catalyst-calendar + earnings preview/review 우선 순위

적용 방향: `equity-research` 스킬의 분석 절차를 `관찰 후보 / 분석 후보` 프레이밍으로 변환해 내부 프롬프트에 흡수.
기관 리포트 형식 직접 복사는 하지 않는다.

## 9. 성공 기준

- 3 skill 매일 정상 실행
- Discord `#주식토크` 알림 정상 수신
- daily-stock-analysis-note → fos-study git push 성공
- source 수집 실패 시 raw 결과 보존 + fallback report.md 생성
- 같은 날 반복 실행 시 데이터 무결성 유지 (멱등 동작)
