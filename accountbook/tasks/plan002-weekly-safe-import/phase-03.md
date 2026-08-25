# Phase 03: 주간 agent skill과 통합 검증 완성

**Execution profile**: standard

## 목표

vision 지원 agent가 주간 inbox를 비대화형으로 처리하고 안전 정책 통과분만 기존 accountbook API에 등록하도록 skill과 통합 검증을 완성한다.

**범위 외**: iPhone 업로드 endpoint, scheduler 설정, 메시지 채널 전송과 여러 이미지의 같은 날짜 자동 병합은 구현하지 않는다.

## 작업 항목 (6)

### 1. 주간 skill workflow

`accountbook/.claude/skills/accountbook-weekly-import/SKILL.md`에 `/accountbook-weekly-import --inbox accountbook/private/inbox/new --mode auto-safe` 흐름을 작성한다.
scan 결과가 비면 성공 종료하고, 모든 work item에 기존 `/accountbook-screenshot-import`의 추출 계약을 재사용해 vision 추출과 검증을 먼저 완료한다.
모든 `selectedDates`를 기록한 뒤 날짜가 둘 이상 이미지에 나타나면 관련 항목을 전부 `needs_review`로 finalize하고 POST하지 않는다.
skill은 모든 `validated.json`과 manifest 경로를 주간 실행 plan에 기록하고 결정적 주간 실행기를 호출한다.
결정적 주간 실행기는 충돌 없는 항목만 정책 평가, approved JSON submit, finalize 순서로 처리한다.
성공·검토·실패를 모두 finalize한 뒤 같은 run ID로 lease lock을 해제한다.
중간 오류가 발생해도 `finally` 경계에서 lock 해제를 시도하되, POST 결과가 불명확한 항목의 상태는 바꾸지 않는다.
특정 agent CLI, scheduler와 알림 API를 직접 호출하지 않는다.

### 2. Codex 노출과 agent metadata

`accountbook/.codex/skills/accountbook-weekly-import`를 `.claude` 정본의 상대 symlink로 만들고 `agents/openai.yaml`에 한국어 표시 이름, 설명과 기본 prompt를 추가한다.

### 3. 기존 추출 계약 연결

`accountbook/.claude/skills/accountbook-screenshot-import/references/extraction-contract.md`에 sidecar 원본 생성 시각과 `upload-metadata` 날짜 근거를 추가한다.
주간 skill은 이 reference를 링크해 화면 행·합계 규칙을 복제하지 않는다.

### 4. 결정적 주간 실행기

`accountbook/scripts/accountbook-weekly-import/run_weekly_import.ts`에 검증 이후 실행 entrypoint를 구현한다.
주간 실행 plan의 모든 경로가 private root 안에 있고 이미지 상태가 `processing`인지 검증한 뒤, 전체 선택 날짜 충돌 검사를 마치기 전에는 submit을 시작하지 않는다.
submit에는 `weekly-safe-v1` 승인 출처를 필수로 요구하고, 거래 생성 POST의 5xx와 네트워크 오류는 `submitting` 상태를 유지해 재실행에서 새 POST를 보내지 않는다.
모든 `lastErrorCode`는 허용된 안정 코드로만 기록한다.

### 5. 통합 dry-run 테스트

`accountbook/scripts/accountbook-weekly-import/weekly_pipeline.test.ts`에서 비식별 PNG·manifest·validated fixture와 fetch stub을 사용해 신규 scan부터 production 주간 실행 entrypoint, 정책 승인, approved JSON API payload, submitted finalize까지 연결한다.
두 이미지에 같은 선택 날짜가 있으면 두 항목 모두 `needs_review`이고 POST가 0회인지 검증한다.
설명 `medium`, 기존 동일 거래와 불명확한 POST도 새 POST 없이 끝나는지 검증한다.
주간 승인 출처 누락, queue output의 private 경로 이탈, 거래 생성 POST 5xx 재실행은 API 호출 전 또는 재POST 전에 차단되는지 검증한다.

### 6. skill과 전체 회귀 검증

두 skill의 quick validation, TypeScript typecheck와 전체 accountbook test를 실행한다.
검증이 모두 통과하면 `accountbook/tasks/plan002-weekly-safe-import/index.json`의 전체와 phase 상태를 `completed`, `current_phase`를 `3`으로 갱신한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `accountbook/.claude/skills/accountbook-weekly-import/SKILL.md` | 신규 |
| `accountbook/.claude/skills/accountbook-weekly-import/agents/openai.yaml` | 신규 |
| `accountbook/.codex/skills/accountbook-weekly-import` | 신규 symlink |
| `accountbook/.claude/skills/accountbook-screenshot-import/references/extraction-contract.md` | 수정 |
| `accountbook/scripts/accountbook-weekly-import/run_weekly_import.ts` | 신규 |
| `accountbook/scripts/accountbook-weekly-import/weekly_pipeline.test.ts` | 신규 |
| `accountbook/tasks/plan002-weekly-safe-import/index.json` | 완료 상태 갱신 |

## 검증

보고 직전 반드시 다음 명령을 실행하고 원시 결과를 확인한다.

```bash
# cwd: fos-agents root
cd "$(git rev-parse --show-toplevel)"
pwd
bun test accountbook/scripts/accountbook-screenshot-import accountbook/scripts/accountbook-weekly-import
bunx tsc --noEmit --strict --skipLibCheck --target ESNext --module ESNext --moduleResolution bundler --allowImportingTsExtensions --types bun-types accountbook/scripts/accountbook-screenshot-import/*.ts accountbook/scripts/accountbook-weekly-import/*.ts
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py accountbook/.claude/skills/accountbook-screenshot-import
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py accountbook/.claude/skills/accountbook-weekly-import
```

## 의도 메모

- schedule과 업로드 transport는 루트 ADR-019에 따라 저장소 밖에서 선택한다.
- 주간 skill은 여러 이미지의 진행을 조정하고 안전 판정과 외부 상태 변경은 결정적 script에 맡긴다.
