# Phase 03: 통합 검증과 실행 계획 완료

**Execution profile**: standard

---

## 목표

Discord 첨부 파일 적재부터 안전 정책 판정까지 연결된 동작을 검증한다.
모든 검증이 통과한 경우에만 실행 계획을 완료 상태로 바꾼다.

**범위 외**: 실제 Discord 메시지 전송, 실제 accountbook API 호출, 운영 서버 배포와 Discord 메시지 삭제는 수행하지 않는다.

## 작업 항목

### 1. Discord 입력 통합 테스트 추가

`accountbook/scripts/accountbook-discord-import/discord_pipeline.test.ts`에서 비식별 PNG와 가짜 거래 후보를 사용해 다음 흐름을 검증한다.

- 첨부 파일과 보조 정보 파일 적재
- `scanAndClaimInbox`의 처리 대상 획득
- Discord 날짜 허용 범위가 맞는 후보의 `weekly-safe-v1` 승인
- 15일 지난 거래 날짜의 POST 0회 차단
- 같은 첨부 파일 재전송 시 중복 작업 생성 없음

외부 네트워크는 사용하지 않고 기존 fetch stub 패턴을 재사용한다.

### 2. 회귀 검증 실행

스크린샷 대화형 등록과 주간 자동 등록 테스트를 함께 실행한다.
TypeScript 정적 검사를 accountbook의 세 스크립트 디렉터리에 수행한다.
세 스킬의 구조, 한국어 표현과 마크다운 가독성을 검사한다.

### 3. 실행 계획 완료 표시

검증이 통과하면 `accountbook/tasks/plan002-2-hermes-discord-import/index.json`에서 세 phase의 `status`와 최상위 `status`를 `completed`로 바꾸고 `current_phase`를 `3`으로 둔다.
`updated_at`은 실제 완료 시각의 RFC 3339 UTC 값으로 갱신한다.
검증이 하나라도 실패하면 완료 상태로 바꾸지 않는다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `accountbook/scripts/accountbook-discord-import/discord_pipeline.test.ts` | 신규 |
| `accountbook/tasks/plan002-2-hermes-discord-import/index.json` | 완료 상태 갱신 |

## 검증

보고 직전 반드시 다음 명령을 실행하고 원시 종료 상태를 출력한다.

```bash
# cwd: fos-agents 저장소 루트
cd "$(git rev-parse --show-toplevel)"
pwd
bun test \
  accountbook/scripts/accountbook-discord-import \
  accountbook/scripts/accountbook-screenshot-import \
  accountbook/scripts/accountbook-weekly-import
test_status=$?
bunx tsc --noEmit --strict --skipLibCheck --target ESNext --module ESNext \
  --moduleResolution bundler --allowImportingTsExtensions --types bun-types \
  accountbook/scripts/accountbook-discord-import/*.ts \
  accountbook/scripts/accountbook-screenshot-import/*.ts \
  accountbook/scripts/accountbook-weekly-import/*.ts
type_status=$?
for skill in accountbook-discord-import accountbook-screenshot-import accountbook-weekly-import; do
  python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
    "accountbook/.claude/skills/$skill" || exit 1
done
~/.claude/scripts/korean-style-check.sh \
  accountbook/.claude/skills/accountbook-discord-import/SKILL.md \
  accountbook/.claude/skills/accountbook-screenshot-import/SKILL.md \
  accountbook/.claude/skills/accountbook-weekly-import/SKILL.md
style_status=$?
python3 ~/.claude/scripts/check-readability.py \
  accountbook/.claude/skills/accountbook-discord-import/SKILL.md \
  accountbook/.claude/skills/accountbook-screenshot-import/SKILL.md \
  accountbook/.claude/skills/accountbook-weekly-import/SKILL.md
readability_status=$?
echo "[test_status] $test_status"
echo "[type_status] $type_status"
echo "[style_status] $style_status"
echo "[readability_status] $readability_status"
test "$test_status" -eq 0
test "$type_status" -eq 0
test "$style_status" -eq 0
test "$readability_status" -eq 0
git diff --check
```

## 의도 메모

- 실제 금융 데이터와 외부 API를 쓰지 않고도 입력 경계와 POST 차단 여부를 증명한다.
- 실행 계획 완료 표시는 검증 성공 이후의 마지막 변경으로 남긴다.

## 커밋

통합 테스트와 실행 계획 상태만 stage한 뒤 다음 형식으로 커밋한다.

```text
test(accountbook): Discord 가계부 입력 흐름을 통합 검증한다
```
