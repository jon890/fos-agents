# Flow — stock-investment

stock-investment 워크스페이스의 **데이터 흐름 및 실행 흐름** 단일 출처.
새 흐름 추가·디버깅 시 이 문서가 기준.

## 1. 전체 흐름 개요

3 skill 모두 Claude native skill 직접 호출 패턴 (ADR-003).

```
사용자/cron
  └─► thin wrapper (run_with_claude.sh)
        ├─► Discord 시작 알림 (notify_discord.ts)
        └─► claude -p "/<skill>" (native 직접 호출)
              └─► native skill (SKILL.md) 이 워크플로 수행
                    ├─► Python 수집기를 python3 Bash로 호출
                    │     └─► collect_*.py → 수집 산출물 (JSON)
                    ├─► 수집 산출물 Read → report.md 직접 Write (Claude 합성)
                    └─► notify_discord.ts (완료/요약)
```

track_task.sh self-wrap는 ADR-003으로 제거됨 (ADR-003 참조).

## 2. stock-investing-morning-brief 흐름

운영 진입점은 `scripts/stock-investing-morning-brief/run_with_claude.sh`.
Claude native skill을 직접 호출한다.

```
Step 1  thin wrapper 진입
        cd ~/ai-nodes/stock-investment
        Discord 시작 알림 (notify_discord.ts, bun run)
        claude --permission-mode bypassPermissions -p "/stock-investing-morning-brief"

Step 2  native skill 이 워크플로 수행 (SKILL.md 기준)
        - python3 collect_sources.py 호출
            입력: config/watchlist.json, config/sources.json
            산출물: data/YYYY-MM-DD/market-data.json
                    data/YYYY-MM-DD/raw-news.json
        - 수집 산출물 Read → data/YYYY-MM-DD/report.md 직접 Write

Step 3  알림 + 폴백
        완료/요약: native skill 이 notify_discord.ts 호출 (SKILL.md 지시)
        실패: thin wrapper 가 Discord 실패 알림
```

## 3. current-issue-analysis 흐름

운영 진입점은 `scripts/current-issue-analysis/run_with_claude.sh <issue-key>`.
Claude native skill을 직접 호출한다.

```
Step 1  thin wrapper 진입
        issue-key 인자를 wrapper 가 전달
        cd ~/ai-nodes/stock-investment
        Discord 시작 알림 (notify_discord.ts, bun run)
        claude --permission-mode bypassPermissions -p "/current-issue-analysis <issue-key>"

Step 2  native skill 이 워크플로 수행 (SKILL.md 기준)
        - issue-key 없으면 config/current-issues.json defaultIssue 사용
        - python3 collect_issue_sources.py 호출
            입력: config/current-issues.json (해당 issue 의 sources 목록)
            산출물: data/issues/YYYY-MM-DD/<issue-key>/raw-sources.json
        - 수집 산출물 Read → data/issues/YYYY-MM-DD/<issue-key>/report.md 직접 Write

Step 3  알림 + 폴백
        완료/요약: native skill 이 notify_discord.ts 호출 (SKILL.md 지시)
        실패: thin wrapper 가 Discord 실패 알림
```

트리거 조건 (현재 수동):

- `theme-reports.json` 의 각 theme `triggerCandidates` 참조.
- 대형 변동, 실적 발표 주간, 정책 이벤트 발생 시 수동 실행.
- ai-semiconductor-infrastructure: SMH ±4% 초과 또는 NVDA/AMD/AVGO/TSM 등 ±5% 초과 시
- google-io-alphabet-ai: Google I/O 이벤트 전후 window
- us-clarity-act: CLARITY Act 입법 이벤트 발생 시

## 4. daily-stock-analysis-note 흐름

운영 진입점은 `scripts/daily-stock-analysis-note/run_with_claude.sh`.
Claude native skill을 직접 호출한다.

```
Step 1  thin wrapper 진입
        cd ~/ai-nodes/stock-investment
        Discord 시작 알림 (notify_discord.ts, bun run)
        claude --permission-mode bypassPermissions -p "/daily-stock-analysis-note"

Step 2  native skill 이 워크플로 수행 (SKILL.md 기준)
        - python3 collect_daily_note_inputs.py 호출
            입력: config/daily-stock-universe.json (후보 풀: US 17 + KR 13)
                  data/daily-notes/history.json (rotation 패널티)
                  TICKER 환경변수 (수동 지정 시 우선)
                  config/catalysts.json (catalyst 참조)
                  data/thesis-tracker/<slug>.json (기존 가설, 파일 존재 시)
            산출물: data/daily-notes/YYYY-MM-DD/selected.json (선택 종목 + 근거)
                    data/daily-notes/YYYY-MM-DD/raw-inputs.json (종목 뉴스·가격)
            부작용: data/daily-notes/history.json 업데이트
        - 수집 산출물 Read → data/daily-notes/YYYY-MM-DD/report.md 직접 Write

Step 3  fos-study 발행
        sanitize_fos_study_markdown.py 로 fos-study 마크다운 규칙 적용
        BLOG_MD 경로:
          career-os/sources/fos-study/finance/investing/ai-tech-stock/YYYY-MM-DD-<slug>.md
        git add + git commit + git push (SKIP_PUSH=1 로 억제 가능)

Step 4  알림 + 폴백
        완료/요약: native skill 이 notify_discord.ts 호출 (SKILL.md 지시)
        실패: thin wrapper 가 Discord 실패 알림
```

cross-workspace 쓰기 예외:

- `career-os/sources/fos-study` 는 발행 목적 git 저장소.
- 투자 공부 블로그 노트를 fos-study로 발행하는 단방향 쓰기.
- 워크스페이스 격리 원칙 예외 (ADR-001 미위반).

## 5. 공통 흐름

### 5-1. Discord 알림

`_shared/lib/notify_discord.ts` 단일 진입점 (ADR-002, ai-nodes 공용).
thin wrapper 가 `bun run` 으로 호출.

```
인자: <message>
  └─► DISCORD_CHANNEL_ID 환경변수 확인 (누락 시 exit 1)
        └─► openclaw message send --channel discord --target channel:<id> (10s 타임아웃)
```

SKIP_NOTIFY=1 로 로컬 테스트 시 억제 가능.

ADR-002 이전에는 워크스페이스 한정 `notify_discord.sh` 사용 — `_shared/lib/notify_discord.ts`로 통합 (ADR-002 참조).

## 6. 직접 호출 진입점

cron 진입과 동일한 경로.

```bash
# morning-brief (native, ADR-003)
bash stock-investment/scripts/stock-investing-morning-brief/run_with_claude.sh
# 또는
claude -p "/stock-investing-morning-brief"

# current-issue-analysis
bash stock-investment/scripts/current-issue-analysis/run_with_claude.sh us-clarity-act
bash stock-investment/scripts/current-issue-analysis/run_with_claude.sh ai-semiconductor-infrastructure
bash stock-investment/scripts/current-issue-analysis/run_with_claude.sh google-io-alphabet-ai

# daily-stock-analysis-note
bash stock-investment/scripts/daily-stock-analysis-note/run_with_claude.sh

# 종목 수동 지정
TICKER=NVDA bash stock-investment/scripts/daily-stock-analysis-note/run_with_claude.sh

# 알림·발행 없이 로컬 테스트
SKIP_NOTIFY=1 SKIP_PUSH=1 bash stock-investment/scripts/daily-stock-analysis-note/run_with_claude.sh
```
