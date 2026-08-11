# Flow — stock-investment

stock-investment 워크스페이스의 **데이터 흐름 및 실행 흐름** 단일 출처.
새 흐름 추가·디버깅 시 이 문서가 기준.

## 1. 전체 흐름 개요

3 skill 모두 Claude native skill 직접 호출 패턴 (ADR-003).

```
사용자/cron
  └─► thin wrapper (run_with_claude.sh)
        └─► claude -p "/<skill>" (native 직접 호출)
              └─► native skill (SKILL.md) 이 워크플로 수행
                    ├─► Python 수집기를 python3 Bash로 호출
                    │     └─► collect_*.py → 수집 산출물 (JSON)
                    ├─► 수집 산출물 Read → report.md 직접 Write (Claude 합성)
                    └─► report 경로와 공개 가능한 요약을 stdout으로 반환
```

track_task.sh self-wrap는 ADR-003으로 제거됨 (ADR-003 참조).

## 2. stock-investing-morning-brief 흐름

운영 진입점은 `scripts/stock-investing-morning-brief/run_with_claude.sh`.
Claude native skill을 직접 호출한다.

```
Step 1  thin wrapper 진입
        cd ~/ai-nodes/stock-investment
        claude --permission-mode bypassPermissions -p "/stock-investing-morning-brief"

Step 2  native skill 이 워크플로 수행 (SKILL.md 기준)
        - python3 collect_sources.py 호출
            입력: config/watchlist.json, config/sources.json
            산출물: data/YYYY-MM-DD/market-data.json
                    data/YYYY-MM-DD/raw-news.json
        - 수집 산출물 Read → data/YYYY-MM-DD/report.md 직접 Write

Step 3  결과 반환
        완료/요약: native skill이 stdout으로 반환
        실패: thin wrapper가 stderr와 종료 코드 반환
```

## 3. current-issue-analysis 흐름

운영 진입점은 `scripts/current-issue-analysis/run_with_claude.sh <issue-key>`.
Claude native skill을 직접 호출한다.

```
Step 1  thin wrapper 진입
        issue-key 인자를 wrapper 가 전달
        cd ~/ai-nodes/stock-investment
        claude --permission-mode bypassPermissions -p "/current-issue-analysis <issue-key>"

Step 2  native skill 이 워크플로 수행 (SKILL.md 기준)
        - issue-key 없으면 config/current-issues.json defaultIssue 사용
        - python3 collect_issue_sources.py 호출
            입력: config/current-issues.json (해당 issue 의 sources 목록)
            산출물: data/issues/YYYY-MM-DD/<issue-key>/raw-sources.json
        - 수집 산출물 Read → data/issues/YYYY-MM-DD/<issue-key>/report.md 직접 Write

Step 3  결과 반환
        완료/요약: native skill이 stdout으로 반환
        실패: thin wrapper가 stderr와 종료 코드 반환
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
        claude --permission-mode bypassPermissions -p "/daily-stock-analysis-note"

Step 2  native skill 이 워크플로 수행 (SKILL.md 기준)
        - python3 collect_daily_note_inputs.py 호출
            입력: config/daily-stock-universe.json (후보 풀: US 17 + KR 13)
                  data/daily-notes/history.json (기존 발행 종목 제외 + rotation 보정)
                  TICKER 환경변수 (수동 지정 시 우선, 단 기존 발행 종목이면 실패)
                  config/catalysts.json (catalyst 참조)
                  data/thesis-tracker/<slug>.json (기존 가설, 파일 존재 시)
            산출물: data/daily-notes/YYYY-MM-DD/selected.json (선택 종목 + 근거)
                    data/daily-notes/YYYY-MM-DD/raw-inputs.json (종목 뉴스·가격)
            부작용: data/daily-notes/history.json 업데이트
        - 수집 산출물 Read → data/daily-notes/YYYY-MM-DD/report.md 직접 Write

Step 3  워크스페이스 내부 발행 준비
        sanitize_fos_study_markdown.py 로 마크다운 규칙 적용
        준비 경로:
          stock-investment/data/publish/YYYY-MM-DD-<slug>.md
        실제 fos-study 반영, commit/push, Jenkins 싱크는 이 프로필에서 직접 수행하지 않음

Step 4  결과 반환
        완료/요약: native skill이 stdout으로 반환
        실패: thin wrapper가 stderr와 종료 코드 반환
```

cross-workspace 쓰기 금지:

- 이 프로필은 `stock-investment` 워크스페이스 안에서만 초안과 메타데이터를 만든다.
- `career-os/sources/fos-study` 같은 다른 워크스페이스나 외부 git 저장소는 직접 수정하지 않는다.
- 실제 블로그 반영은 별도 승인된 발행 프로필·Jenkins·수동 작업으로 넘긴다.

## 5. 공통 흐름

### 5-1. 외부 전달

runner는 로컬 파일, 표준 출력, 종료 코드만 계약으로 삼는다.
전달 채널과 자동 실행 시점은 저장소 밖에서 선택한다.

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

# 발행 없이 로컬 테스트
SKIP_PUSH=1 bash stock-investment/scripts/daily-stock-analysis-note/run_with_claude.sh
```
