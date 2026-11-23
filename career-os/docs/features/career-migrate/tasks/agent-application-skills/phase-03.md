# Phase 03. 사용량 수집이 커리어 Backend 대신 노트북 파일에 쓴다

**Execution profile**: standard

## 목표

노트북의 사용량 수집기(`collect_usage.ts`)와 차트 CLI(`render_chart.ts`)가 커리어 Backend 를 부르지 않고 노트북의 JSON 파일 하나를 읽고 쓴다. 실행 공간에서 쓸 일이 없는 `usage` 실행기를 번들에서 뺀다.

**범위 외**: `scripts/profile/`(Backend 를 부르는 노트북 CLI, 5단계), `services/career-backend`, 문서(phase 05).

## 컨텍스트

- 수집기는 `career-os/scripts/agent-usage/collect_usage.ts` 다. 저장소 자리는 `UsageSnapshotStore`(`listMonths`, `putMeasured`)로 추상화돼 있고, 지금 구현은 `createUsageSnapshotStore(createProfileClient())` 로 Backend 를 부른다.
- 측정은 `measure.ts` 가 `agent_usage.py --json` 을 실행해 한다. 이 스크립트는 `--merge <파일>` 로 다른 기기의 합계 파일을 더한다.
- `launchd` 작업은 `manage_launchd.ts` 와 `launchd/agent-usage.plist.template` 이 만든다. 지금은 Backend 연결값을 읽으려고 `--env-file=career-os/.env` 를 넘기고, `install` 이 그 파일이 없으면 실패한다.
- 번들 진입점 `career-os/scripts/plugin-local/main.ts` 가 `usage` 실행기로 같은 수집기를 부른다. phase 02 가 노트북 전용 스킬을 지워(스펙 DECISION2) 이 실행기를 부르는 곳이 없다.

**요구사항**: REQ9 의 사용량 부분(스펙 DECISION8)

**근거 문서**: `career-os/docs/adr/ADR-146-커리어-표-데이터는-에이전트-작업-폴더의-sqlite-가-갖는다.md`, `career-os/docs/adr/ADR-147-후보자-맥락-문서는-비서의-기억이-프로필-원고는-작업-폴더-파일이-갖는다.md`

## 의도 메모

- 파일 자리는 `~/.fos-career/agent-usage/snapshots.json` 이고 `CAREER_AGENT_USAGE_FILE` 로 바꿀 수 있다. 저장소 밖이라 개인 숫자가 공개 저장소에 들어가지 않는다.
- Backend 에 있던 지난 달 기록은 옮기지 않는다(스펙 「이번에 하지 않는 것」). 파일이 비어 있으면 수집기는 가장 최근에 끝난 달 하나부터 쌓는다(기존 `targetMonths` 규칙 그대로).
- 이미 기록한 달은 덮어쓰지 않는다. 다른 기기의 합계를 더해 다시 적어야 하는 달만 `--replace <YYYY-MM> --note <사유>` 로 바꾼다. 세션 기록이 지워진 뒤의 작은 값으로 조용히 덮어쓰는 일을 막는다. 사유를 남기는 것은 Backend 의 교체 규칙(`replace` 는 `note` 와 함께)을 그대로 옮긴 것이다.
- 파일이 깨졌으면 덮어쓰지 않고 실패한다.

## 작업 항목

### 1. `career-os/scripts/agent-usage/usage_file.ts`

- `resolveUsageFilePath(environment, home)`: `CAREER_AGENT_USAGE_FILE` 이 있으면 그 절대 경로, 없으면 `<home>/.fos-career/agent-usage/snapshots.json`. 상대 경로는 거절한다.
- `readUsageFile(filePath)`: 없으면 빈 목록. 있으면 zod 로 검증한다. 꼴은 `{ "schemaVersion": 1, "snapshots": [{ month, claudeTokens, codexTokens, claudeCostUsd, codexCostUsd, sessions, unpricedTokens, measuredOn, source }] }` 이고 `month` 는 `YYYY-MM`, `source` 는 `"MEASURED"`, 선택 칸 `note` 는 교체 사유다. 검증에 실패하면 `사용량 파일이 계약과 다르다: <경로>` 로 던진다.
- `createUsageFileStore(filePath)`: `UsageSnapshotStore` 구현. `putMeasured(measurement, measuredOn, { replaceNote })` 는 그 달이 이미 있으면 `replaceNote` 가 있을 때만 값과 `note` 를 바꾸고 `{ created: false, replaced: true }` 를, 없을 때는 그대로 두고 `{ created: false, replaced: false }` 를, 달이 없으면 더하고 `{ created: true, replaced: false }` 를 돌려준다. 달 오름차순으로 정렬해, 같은 디렉터리의 임시 파일에 쓴 뒤 이름을 바꾼다. 디렉터리는 0700, 파일은 0600 으로 만든다.

### 2. `career-os/scripts/agent-usage/collect_usage.ts`

- `createUsageSnapshotStore`, `createProfileClient`, `formatManageProfileError` import 를 지우고 `createUsageFileStore(resolveUsageFilePath(process.env, os.homedir()))` 를 쓴다. 오류 줄은 `error.message` 만 낸다.
- 인자: `--merge <파일>`(여러 번 줄 수 있다. `agent_usage.py` 에 그대로 넘긴다), `--replace <YYYY-MM> --note <사유>`(그 달을 기록이 있어도 대상에 넣고 덮어쓴다. 결과 코드는 `REPLACED`). `--replace` 값이 `YYYY-MM` 꼴이 아니거나, 아직 끝나지 않은 달이거나, `--note` 가 없거나 비었으면 측정 전에 2 로 끝난다. 그 달에 세션이 없으면 `NO_SESSIONS` 이고 기록을 바꾸지 않는다. 그 밖의 인자는 지금처럼 2 로 끝난다.
- 도움말에서 Backend 연결값 문장을 지우고 파일 자리와 두 옵션을 적는다.
- `measure.ts` 의 `runAgentUsageScript(extraArgs)` 가 `--merge` 인자를 `python3 - --json` 뒤에 붙인다.

### 3. `career-os/scripts/agent-usage/render_chart.ts`

`listBackendSnapshots` 를 `readUsageFile` 로 바꾼다. `scripts/profile/client.ts` 를 import 하지 않는다.

### 4. `launchd`

- `launchd/agent-usage.plist.template`: `--env-file={{REPO_ROOT}}/career-os/.env` 를 `--no-env-file` 로 바꾼다.
- `manage_launchd.ts`: `install` 이 `career-os/.env` 가 없다고 실패하는 검사를 지운다.

### 5. 번들에서 `usage` 실행기를 뺀다

`career-os/scripts/plugin-local/executors.ts`, `main.ts` 에서 `usage` 와 그 import 를 지운다. `cd career-os/plugin && bun run build` 로 `dist/career-local.js` 를 다시 만든다.

### 6. 테스트

- `usage_file.test.ts`(신규): 파일이 없으면 빈 목록, 처음 쓰면 0600 파일이 생김, 같은 달을 다시 쓰면 `created: false` 이고 값이 그대로, `replace` 면 바뀜, 깨진 JSON 과 모르는 꼴은 던지고 파일을 건드리지 않음, 상대 경로 env 거절.
- `collect_usage.test.ts`: Backend client 대역을 파일 저장소로 바꾼다. 「빈 파일에서 실행하면 가장 최근에 끝난 달이 파일에 생긴다」, 「다시 실행하면 `UP_TO_DATE`」, 「`--replace 2026-11` 은 있는 달을 새 값으로 바꾸고 `REPLACED` 를 낸다」, 「`--merge` 값이 측정기에 넘어간다」, 「소스에 `profile/client` 와 `CAREER_BACKEND` 가 없다」.
- `render_chart.test.ts`, `measure.test.ts`, `manage_launchd.test.ts`: 바뀐 입력에 맞춘다. plist 에 `--env-file=` 이 없는지 본다.
- `--replace` 의 거절 사례 셋(꼴, 끝나지 않은 달, 사유 없음)과 `note` 가 파일에 남는지.
- `career-os/scripts/plugin-local/main.test.ts`: 실행기 수 문구와 목록에서 `usage` 를 뺀다. `usage` 는 모르는 실행기로 2 를 낸다.
- `career-os/plugin/scripts/local-bundle.test.ts`: `usage` 번들 테스트를 지운다.

## 검증

```bash
bun test ./career-os/scripts/agent-usage ./career-os/scripts/plugin-local ./career-os/plugin
bunx tsc --noEmit -p .
```

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/agent-usage/usage_file.ts` | 신규 |
| `career-os/scripts/agent-usage/usage_file.test.ts` | 신규 |
| `career-os/scripts/agent-usage/collect_usage.ts` | 수정 |
| `career-os/scripts/agent-usage/collect_usage.test.ts` | 수정 |
| `career-os/scripts/agent-usage/measure.ts` | 수정 |
| `career-os/scripts/agent-usage/measure.test.ts` | 수정 |
| `career-os/scripts/agent-usage/render_chart.ts` | 수정 |
| `career-os/scripts/agent-usage/render_chart.test.ts` | 수정 |
| `career-os/scripts/agent-usage/manage_launchd.ts` | 수정 |
| `career-os/scripts/agent-usage/manage_launchd.test.ts` | 수정 |
| `career-os/scripts/agent-usage/launchd/agent-usage.plist.template` | 수정 |
| `career-os/scripts/plugin-local/executors.ts` | 수정 |
| `career-os/scripts/plugin-local/main.ts` | 수정 |
| `career-os/scripts/plugin-local/main.test.ts` | 수정 |
| `career-os/plugin/scripts/local-bundle.test.ts` | 수정 |
| `career-os/plugin/dist/career-local.js` | 수정 (빌드) |
