# Flow — apartment

apartment 워크스페이스의 **데이터 플로우 및 실행 흐름** 단일 출처. 새 흐름 추가·디버깅 시 이 문서가 기준.

## 1. 전체 흐름 개요

```
사용자/cron
  └─► runner script (run_report.sh / run_digest.sh)
        └─► self-wrap (TRACK_TASK_WRAPPED guard)
              └─► _shared/bin/track_task.sh
                    ├─► openclaw status 캡처 (before)
                    ├─► 파일 메트릭 스냅샷 (before)
                    │
                    ├─► collector (collect_sources.py)
                    │     ├─► Naver API (overview + prices + articles)
                    │     ├─► Hogangnono
                    │     └─► KB Land
                    │
                    ├─► normalizer (normalize_results.py)
                    │     └─► summary.json
                    │
                    ├─► Claude CLI (--output-format json, 90s timeout)
                    │     └─► claude.result.json
                    │
                    ├─► extractor (_shared/bin/extract_claude_result.py)
                    │     └─► report.md (또는 fallback)
                    │
                    ├─► notify_discord.sh (완료/실패)
                    │
                    ├─► openclaw status 캡처 (after)
                    └─► logs/task-runs.jsonl append
```

## 2. apartment-daily-report 흐름

`skills/apartment-daily-report/scripts/run_report.sh` 진입점.

```
Step 1  self-wrap 체크
        TRACK_TASK_WRAPPED 환경변수 확인
        미설정이면 track_task.sh로 자신을 재실행 (exec 패턴)

Step 2  .env 로드
        워크스페이스 root .env — NAVER_COOKIE, NAVER_BEARER, DISCORD_WEBHOOK_URL

Step 3  타깃 변수 설정
        COMPLEX_NO, FOCUS_UNIT, DATE 등 config/focus-unit.json 기반

Step 4  출력 디렉터리 생성
        data/YYYY-MM-DD/ mkdir -p

Step 5  Discord 시작 알림
        notify_discord.sh "시작" 메시지

Step 6  수집 (collect_sources.py)
        Naver API 3 endpoint (overview / prices / articles)
          — 쿠키 + Bearer JWT 인증
          — 요청 간 2초 sleep, 429 시 지수 백오프 (2→4→8s, 3회)
          — 실패 시 마지막 성공 스냅샷 fallback + Discord 알림
        Hogangnono 수집
        KB Land 수집
        산출물: raw-search.json

Step 7  정규화 (normalize_results.py)
        raw-search.json → summary.json (9 key)
        59A alias 매칭 — exact / unverified / non-match 3단계

Step 8  Claude CLI 호출
        claude --output-format json (90초 타임아웃)
        입력: summary.json + 프롬프트
        출력: claude.result.json

Step 9  추출 (extract_claude_result.py)
        claude.result.json 파싱 → report.md

Step 10 fallback (타임아웃 발생 시)
        90초 초과 → report.fallback.md 생성
        (summary.json 기반 정적 마크다운)

Step 11 Discord 완료 알림
        notify_discord.sh "완료" + 소요 시간 + cost summary

Step 12 logs append
        track_task.sh 종료 훅 → task-runs.jsonl + token-usage.jsonl
```

### 2-1. smoke 흐름

`scripts/run_smoke_test.sh` — Claude 호출 없는 수집기/정규화기 헬스 체크.

```
.env 로드 → collect_sources.py (limited mode) → normalize_results.py
→ summary.json 생성 여부 확인 → exit 0/1
```

현재: 단순 헬스 체크. 보류 항목: routine health check로 확장 (섹션 1 prd.md 10번 참조).

## 3. apartment-interior-reference-digest 흐름

`skills/apartment-interior-reference-digest/scripts/run_digest.sh` 진입점.

```
Step 1  경로 설정
        CONFIG=config/interior-reference-digest.json
        DECISION=docs/interior/lucky-5-1004-interior-decisions.md
        QUEUE=docs/interior/lucky-5-1004-decision-queue.md
        REFERENCE=docs/interior/interior-references.md
        OUTPUT=data/interior-reference-digest/YYYY-MM-DD/

Step 2  출력 디렉터리 생성
        data/interior-reference-digest/YYYY-MM-DD/ mkdir -p

Step 3  request.md 작성
        CONFIG + DECISION + QUEUE + REFERENCE 컨텍스트 결합
        오늘의 결정 질문 3개 포함 (config.dailyReport.todayDecisionQuestionCount)
        7일 dedupe 처리

Step 4  report.md placeholder
        실제 Claude 호출은 사용자 또는 외부 cron이 처리
        현재 runner: thin shell — request.md 작성까지

Step 5  Discord 알림 (운영 시)
        요약 + 3 결정 질문 Discord 출력
```

현재 runner는 thin 구조 — 실제 Claude 호출은 사용자 대화 또는 별도 외부 진입점.

## 4. 알림 흐름

`skills/apartment-daily-report/scripts/notify_discord.sh` 단일 진입점.

```
인자: TYPE (start|complete|failure) + 메시지 + [cost_summary]
  └─► DISCORD_WEBHOOK_URL 환경변수 확인
        └─► curl POST to Discord webhook
```

ai-nodes 표준 3단계 알림 (시작/완료/실패). 별도 start-notice cron 미사용.

## 5. 트래커 + logs

`_shared/bin/track_task.sh` self-wrap 패턴.

```
run_report.sh 최초 실행
  TRACK_TASK_WRAPPED 미설정
    └─► exec track_task.sh run_report.sh (TRACK_TASK_WRAPPED=1 환경 설정)

track_task.sh 실행
  ├─► openclaw status 캡처 (before)
  ├─► 파일 메트릭 스냅샷
  ├─► run_report.sh 본체 실행 (TRACK_TASK_WRAPPED=1)
  ├─► exit code 기록
  ├─► openclaw status 캡처 (after)
  ├─► logs/task-runs.jsonl append
  └─► logs/token-usage.jsonl append (TRACK_TASK_CLAUDE_USAGE_FILE 수집)
```

task-id 형태: `apartment:daily-report`. 중복 래핑 방지: `TRACK_TASK_WRAPPED` guard.

## 6. 직접 호출 진입점

cron 진입과 동일한 경로.

```bash
# 일일 리포트
bash apartment/skills/apartment-daily-report/scripts/run_report.sh

# 인테리어 디제스트
bash apartment/skills/apartment-interior-reference-digest/scripts/run_digest.sh

# 수집기/정규화기 헬스 체크 (Claude 호출 없음)
bash apartment/skills/apartment-daily-report/scripts/run_smoke_test.sh

# Guri 광역 매수 탐색 (별도 진입점)
bash apartment/skills/apartment-daily-report/scripts/run_guri_buy_search.sh
```
