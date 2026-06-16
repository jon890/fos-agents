# Flow — apartment

apartment 워크스페이스의 **데이터 플로우 및 실행 흐름** 단일 출처. 새 흐름 추가·디버깅 시 이 문서가 기준.

## 1. 전체 흐름 개요

두 skill 모두 Claude native skill 직접 호출 패턴 (daily-report는 ADR-010, interior는 plan007).

```
사용자/cron
  └─► thin wrapper (run_with_claude.sh)
        ├─► Discord 시작 알림 (notify_discord.ts)
        └─► claude -p "/<skill>" (native 직접 호출)
              └─► native skill (SKILL.md) 가 워크플로 수행
                    ├─► (daily-report) 수집·정규화 TS 헬퍼를 bun Bash로 호출
                    │     ├─► collect_sources.ts → raw-search.json
                    │     └─► normalize_results.ts → summary.json
                    ├─► summary.json Read → report.md 직접 Write (Claude 합성)
                    └─► notify_discord.ts (완료/요약)
```

track_task.sh self-wrap는 ADR-010으로 제거됨.

## 2. apartment-daily-report 흐름 (native, ADR-010)

운영 진입점은 `scripts/apartment-daily-report/run_with_claude.sh` — Claude native skill을 직접 호출한다 (interior와 동일 패턴).

```
Step 1  thin wrapper 진입
        cd ~/ai-nodes/apartment
        Discord 시작 알림 (notify_discord.ts, bun run)
        claude --permission-mode bypassPermissions -p "/apartment-daily-report"

Step 2  native skill이 워크플로 수행 (SKILL.md 기준)
        - load_target_meta.ts (bun) → 타깃 메타 (focus-unit.json, ADR-002)
        - collect_sources.ts (bun) → raw-search.json (ADR-006 import 통합)
            네이버 API 3 endpoint (쿠키+Bearer, ADR-001, zod ADR-007)
            + 호갱노노 / KB랜드 HTML 파서 (plan004)
        - normalize_results.ts (bun) → summary.json (plan005, 59A alias 매칭)
        - summary.json Read → report.md 직접 Write (Claude 합성)

Step 3  알림 + 폴백
        완료/요약: native skill이 notify_discord.ts 호출 (SKILL.md 지시)
        실패: thin wrapper가 Discord 실패 알림
        stdout 비면 wrapper가 report.md 경로 안내 (interior 폴백 패턴)
```

산출물·TS 헬퍼 유지 범위의 결정 근거는 ADR-010 참조.

### 2-1. smoke 흐름

`scripts/run_smoke_test.sh` — Claude 호출 없는 수집기/정규화기 헬스 체크.

```
.env 로드 → collect_sources.ts (limited mode) → normalize_results.ts
→ summary.json 생성 여부 확인 → exit 0/1
```

현재: 단순 헬스 체크. 보류 항목: routine health check로 확장 (섹션 1 prd.md 10번 참조).

## 3. apartment-interior-reference-digest 흐름

운영 cron의 진입점은 `scripts/apartment-interior-reference-digest/run_with_claude.sh` — Claude native skill을 직접 호출한다.

### 3-1. Claude native skill 운영 흐름

`scripts/apartment-interior-reference-digest/run_with_claude.sh` 진입점.

```
Step 1  apartment workspace로 이동
        cd ~/ai-nodes/apartment

Step 2  Claude native skill 호출
        claude --permission-mode bypassPermissions -p "/apartment-interior-reference-digest <요청>"

Step 3  Claude native skill이 전체 workflow 수행
        .claude/skills/apartment-interior-reference-digest/SKILL.md 기준
        config/interior-reference-digest.json + docs/interior/* 읽기
        웹 검색/fetch → 후보 평가 → report.md 작성
        의사결정/남은 결정 표시가 필요한 경우 decision-view.html도 함께 작성
        docs/interior/interior-references.md 갱신

Step 4  stdout 요약
        Claude는 Discord에 그대로 보낼 수 있는 한국어 요약을 stdout 마지막에 출력
        NO_REPLY 금지
        추천 레퍼런스는 R 번호 + 제목 + 원문 링크(`<https://...>`) 포함
        오늘 결정할 3개 질문은 단순 A/B/C가 아니라 대표 예시/사진 링크,
        초보자용 비교 포인트, 추천 이유를 함께 포함
        HTML 의사결정 뷰를 만든 경우 decision-view.html 경로 포함
        OpenClaw cron agent는 stdout을 받아 최종 응답으로 반환
        cron delivery(announce)가 해당 최종 응답을 Discord로 전달
```

## 4. 알림 흐름

`_shared/lib/notify_discord.ts` 단일 진입점 (ADR-009, ai-nodes 공용). `run_report.sh`의 `notify_safe` 래퍼가 `bun run`으로 호출.

```
인자: <message>  (실패 시에도 알림 가능하도록 notify_safe로 || true 감쌈)
  └─► DISCORD_CHANNEL_ID 환경변수 확인 (누락 시 exit 1)
        └─► openclaw message send --channel discord --target channel:<id> (10s 타임아웃)
```

ai-nodes 표준 3단계 알림 (시작/완료/실패). 별도 start-notice cron 미사용.
ADR-009 이전에는 워크스페이스 한정 `notify_discord.sh` (openclaw 래핑 셸) 사용 — `_shared/lib/notify_discord.ts`로 통합하며 폐기.

## 5. 트래커 + logs

apartment 두 skill 모두 native 직접 호출이라 `track_task.sh`를 경유하지 않는다.
`task-runs.jsonl` / `token-usage.jsonl`은 더 생성되지 않는다.
폐기 경위·잔존 사용처는 ADR-010 참조.

## 6. 직접 호출 진입점

cron 진입과 동일한 경로.

```bash
# 일일 리포트 (native, ADR-010)
bash apartment/scripts/apartment-daily-report/run_with_claude.sh
# 또는
claude -p "/apartment-daily-report"

# 인테리어 디제스트
bash apartment/scripts/apartment-interior-reference-digest/run_with_claude.sh "오늘의 인테리어 추천"

# 수집기/정규화기 헬스 체크 (Claude 호출 없음)
bash apartment/scripts/apartment-daily-report/run_smoke_test.sh

# Guri 광역 매수 탐색 (별도 진입점)
bash apartment/scripts/apartment-daily-report/run_guri_buy_search.sh
```
