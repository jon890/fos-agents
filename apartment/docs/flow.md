# Flow — apartment

apartment 워크스페이스의 **데이터 플로우 및 실행 흐름** 단일 출처. 새 흐름 추가·디버깅 시 이 문서가 기준.

## 1. 전체 흐름 개요

```
사용자/cron
  └─► runner script (run_report.sh / run_with_claude.sh)
        └─► self-wrap (TRACK_TASK_WRAPPED guard)
              └─► _shared/bin/track_task.sh
                    ├─► openclaw status 캡처 (before)
                    ├─► 파일 메트릭 스냅샷 (before)
                    │
                    ├─► collector (collect_sources.ts, ADR-006 import 통합)
                    │     ├─► collect_naver_api.ts (API 3 endpoint + zod)
                    │     ├─► collect_hogangnono.ts (HTML regex)
                    │     └─► collect_kbland.ts (HTML regex)
                    │
                    ├─► normalizer (normalize_results.ts, plan005)
                    │     └─► summary.json
                    │
                    ├─► Claude CLI (--output-format json, 90s timeout)
                    │     └─► claude.result.json
                    │
                    ├─► extractor (_shared/lib/extract_claude_result.ts, ai-nodes plan001)
                    │     └─► report.md (또는 fallback)
                    │
                    ├─► notify_discord.sh (완료/실패)
                    │
                    ├─► openclaw status 캡처 (after)
                    └─► logs/task-runs.jsonl append
```

## 2. apartment-daily-report 흐름

`scripts/apartment-daily-report/run_report.sh` 진입점.

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

Step 6  수집 (collect_sources.ts, ADR-006 import 통합)
        collect_naver_api.ts — API 3 endpoint (overview / prices / articles)
          — 쿠키 + Bearer JWT 인증 (ADR-001)
          — 요청 간 2초 sleep, 429 시 지수 백오프 (2→4→8s, 3회)
          — 실패 시 마지막 성공 스냅샷 fallback + Discord 알림
          — zod 응답 스키마 검증 (ADR-007)
        collect_hogangnono.ts — Bun.fetch HTML 수집 + regex 파싱 (plan004)
        collect_kbland.ts — Bun.fetch HTML 수집 + regex 파싱 (plan004)
        산출물: raw-search.json

Step 7  정규화 (normalize_results.ts, plan005)
        raw-search.json → summary.json (9 key)
        59A alias 매칭 — exact / unverified / non-match 3단계
        zod 입력/출력 스키마 자기방어 (ADR-007 후속 적용)

Step 8  Claude CLI 호출
        claude --output-format json (90초 타임아웃)
        입력: summary.json + 프롬프트
        출력: claude.result.json

Step 9  추출 (extract_claude_result.ts, ai-nodes plan001)
        claude.result.json 파싱 → report.md
        bun run "$EXTRACT" 호출 (Python wrapper에서 TS로 전환)

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
.env 로드 → collect_sources.ts (limited mode) → normalize_results.ts
→ summary.json 생성 여부 확인 → exit 0/1
```

현재: 단순 헬스 체크. 보류 항목: routine health check로 확장 (섹션 1 prd.md 10번 참조).

## 3. apartment-interior-reference-digest 흐름

운영 cron의 진입점은 `scripts/apartment-interior-reference-digest/run_with_claude.sh`.
`run_digest.sh`는 request/report placeholder를 만드는 scaffold이며, 전체 추천 workflow를 직접 수행하지 않는다.

### 3-1. Claude native skill 운영 흐름

`scripts/apartment-interior-reference-digest/run_with_claude.sh` 진입점.

```
Step 1  apartment workspace로 이동
        cd ~/ai-nodes/apartment

Step 2  Claude native skill 호출
        claude --permission-mode acceptEdits -p "/apartment-interior-reference-digest <요청>"

Step 3  Claude native skill이 전체 workflow 수행
        .claude/skills/apartment-interior-reference-digest/SKILL.md 기준
        config/interior-reference-digest.json + docs/interior/* 읽기
        웹 검색/fetch → 후보 평가 → report.md 작성
        docs/interior/interior-references.md 갱신

Step 4  stdout 요약
        OpenClaw cron agent는 stdout을 받아 Discord 전달용 최종 응답만 처리
```

### 3-2. request scaffold 흐름

`scripts/apartment-interior-reference-digest/run_digest.sh` 진입점.

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

Step 5  종료
        request.md와 report.md 경로를 stdout으로 출력
```

현재 scaffold는 thin 구조 — 운영 cron은 이 파일만 직접 호출하면 안 된다.

## 4. 알림 흐름

`scripts/apartment-daily-report/notify_discord.sh` 단일 진입점.

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
bash apartment/scripts/apartment-daily-report/run_report.sh

# 인테리어 디제스트
bash apartment/scripts/apartment-interior-reference-digest/run_with_claude.sh "오늘의 인테리어 추천"

# 인테리어 request scaffold (Claude 호출 없음)
bash apartment/scripts/apartment-interior-reference-digest/run_digest.sh

# 수집기/정규화기 헬스 체크 (Claude 호출 없음)
bash apartment/scripts/apartment-daily-report/run_smoke_test.sh

# Guri 광역 매수 탐색 (별도 진입점)
bash apartment/scripts/apartment-daily-report/run_guri_buy_search.sh
```
