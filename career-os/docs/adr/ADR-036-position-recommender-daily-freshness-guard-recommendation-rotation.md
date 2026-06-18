## ADR-036 — position-recommender daily freshness guard + recommendation rotation

- Status: Partially superseded by ADR-100
- Date: 2026-05-23

### 맥락

2026-05-23 10:00 daily position cron이 `claude -p "/position-recommender ..."`를 실행했지만 오늘 날짜 report를 만들지 못했고, 기존 `data/runtime/position-recommendation.md`의 2026-05-22 리포트를 다시 읽어 Discord에 전송했다. 또한 cron prompt에 특정 KakaoPay AX 우선 문구가 박혀 있어 같은 공고가 반복 상단 노출될 가능성이 컸다. `position-recommender` native skill에도 최근 추천 이력을 읽어 active/open 상태와 지원 액션 필요 여부를 확인하는 규칙이 없었다.

### 결정

- daily cron은 `scripts/position-recommender/run_daily_with_claude.sh`를 호출한다.
  - wrapper는 Claude native skill을 실행한 뒤 Asia/Seoul 오늘 날짜 report와 runtime 첫 줄을 검증한다.
  - 오늘 날짜 report가 없거나 runtime이 stale이면 cron 실패로 처리한다.
  - freshness check 통과 후 wrapper가 `_shared/lib/notify_discord.ts`를 호출한다.
  - Claude native skill 내부에서는 Discord 알림을 직접 보내지 않는다. 외부 전송은 runner/orchestrator 책임이다.
- `position-recommender` native skill은 최근 7일 `position-recommendation/report.md`를 읽고 반복 후보의 active/open 상태와 지원 액션 필요 여부를 확인한다.
  - 반복 자체는 감점하지 않는다.
  - 반복 후보가 여전히 최상위면 유지하고 “반복 유지 사유”와 “아직 지원 액션이 필요한 이유”를 명시한다.
  - 신규 후보 강제 포함 규칙은 ADR-100에서 폐기했다.
- daily cron prompt에서 특정 KakaoPay AX 우선 문구를 제거한다.
  - 랭킹 기준은 active JD fit, 회사/규모 업사이드, 반복 여부, 도메인 전환 가치로 둔다.
- 기본 live posting 수집에서 Toss career article을 지원 가능한 공고로 섞지 않는다.
  - `--source toss` 또는 `--include-toss-articles`를 명시했을 때만 참고자료로 수집한다.

### 결과

- stale runtime 재전송을 조기에 차단한다.
- Claude 내부 interactive approval 때문에 Discord notify가 멈추는 문제를 피한다.
- stale 재전송은 막되, 닫히지 않은 좋은 공고의 반복 추천은 지원 액션을 촉구하는 신호로 유지할 수 있다.
- OpenClaw/runner는 오케스트레이션과 외부 전송을 담당하고, 실제 추천 작업은 Claude native skill이 수행한다.
