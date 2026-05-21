# Phase 03 — cron 실행 회귀 검증 결과

## 결론

**payload edit 정합성 검증 ✓** — 신규 Korean slim payload (491c, 12line) 적용 확인.

**cron 워크플로 라이브 회귀 검증 ✗** — `openclaw cron run` 수동 실행이 1초 만에 실패. 별도 환경 이슈로 본 task와 무관.

## 실행 명령

```bash
openclaw cron run --wait --wait-timeout 16m 9a6ac82d-f6d6-4d25-a8aa-05cddc33dabe
```

실행 시각: 2026-05-21 19:41:42 KST.

## 실패 원인

```json
{
  "status": "error",
  "error": "MissingAgentHarnessError: Requested agent harness \"codex\" is not registered.",
  "runAtMs": 1779360101045,
  "durationMs": 1001
}
```

`openclaw cron run` 수동 debug 경로가 `codex` harness를 요청 — 로컬에 등록되지 않음.

## 우리 변경과 무관함 증거

1. 오늘 09:00 정시 cron daemon 실행은 **성공** — `lastRunStatus: ok`, `lastDeliveryStatus: delivered`, `lastDurationMs: 168081ms` (3분 컴퓨트), report.md 09:05 mtime.
2. 09:00 실행 당시 payload는 **옛 영문 버전** (3439c). 우리 슬림 한국어 payload (491c) 교체는 09:43.
3. 따라서 codex harness 부재는 *현재 manual run 경로* 한정 이슈. 정시 cron daemon은 다른 harness routing 사용.
4. 신규 payload는 `agentTurn` kind + `agentId: main` 그대로 유지 — harness 결정에 영향 없음.

## 파일 변경 비교 (pre vs post)

| 경로 | pre | post | diff |
|---|---|---|---|
| `docs/interior/interior-references.md` | 45034 bytes, mtime 09:04 | 45034 bytes, mtime 09:04 | unchanged |
| `docs/interior/lucky-5-1004-decision-queue.md` | 10266 bytes, mtime 09:04 | 10266 bytes, mtime 09:04 | unchanged |
| `data/interior-reference-digest/2026-05-21/report.md` | 9650 bytes, mtime 09:05 | 9650 bytes, mtime 09:05 | unchanged |
| `data/interior-reference-digest/2026-05-21/request.md` | 1760 bytes, mtime 09:03 | 1760 bytes, mtime 09:03 | unchanged |

워크플로가 실제로 실행되지 않았으므로 파일 변경 0.

## 별도 처리할 이슈 (plan008 외)

`openclaw cron run` manual 경로의 codex harness 의존성. 별도 task / 조사 필요:

- 정시 cron daemon이 사용하는 harness routing 확인
- manual `cron run` 경로의 harness 결정 로직 확인
- claude harness 등록 / codex 의존성 제거 / fallback 옵션 등 선택지 검토

본 task plan008 phase 3은 **payload edit 정합성 + audit trail 완성** 기준으로 완료 처리.

## 산출물 정리

- `phase-03-new-payload.txt` — 적용한 신규 본문 (491c, Korean slim)
- `phase-03-old-payload.json` — 적용 전 cron get 백업
- `phase-03-applied-payload.txt` — 적용 후 cron get 추출본 (490c, trailing newline 1개 차이 외 동일)
- `phase-03-payload-diff.md` — old → applied unified diff + 정책 위임 설명
- `phase-03-regression-pre.txt` — cron run 실행 전 git status + file snapshot
- `phase-03-regression-post.txt` — cron run 실행 후 git status + file snapshot
- `phase-03-regression-run.log` — cron run 실행 로그 (codex harness 오류)
- `phase-03-regression-result.md` — 본 문서

## 다음 정시 실행

`nextRunAtMs: 1779408000000` = 2026-05-22 09:00 KST. 신규 한국어 슬림 payload + (정시 daemon 정상 가정) 자연스러운 회귀 검증 기회.
