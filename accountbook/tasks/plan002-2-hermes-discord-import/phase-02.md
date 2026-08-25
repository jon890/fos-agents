# Phase 02: Hermes Discord 입력 스킬과 한국어 문체 정리

**Execution profile**: standard

---

## 목표

Hermes가 Discord에서 받은 PNG 한 장을 기존 가계부 안전 등록 흐름으로 넘기는 스킬을 만든다.
직접 연결된 accountbook 스킬의 설명 문장을 자연스러운 한국어로 정리한다.

이 phase는 Phase 01의 `stage_attachment.ts`와 `hermes-discord` 입력 계약이 현재 branch에 있어야 한다.
없으면 `PHASE_BLOCKED: Discord 입력 적재 구현이 없습니다`를 출력한 뒤 1이 아닌 종료 코드로 끝낸다.

**범위 외**: Hermes 설치, Discord bot token 발급, 채널 생성, 메시지 삭제와 운영 서버 배포는 다루지 않는다.

## 작업 항목

### 1. Discord 입력 스킬 작성

`accountbook/.claude/skills/accountbook-discord-import/`를 만들고 다음 파일을 둔다.

- `SKILL.md`
- `agents/openai.yaml`
- `evals/evals.json`

스킬은 Hermes의 Discord 대화에서 다음 조건으로 동작한다.

- 허용된 사용자와 채널은 Hermes 설정이 검증했다고 전제하되 현재 실행 환경이 Discord인지 확인한다.
- 첨부 이미지가 없거나 두 장 이상이면 파일을 적재하거나 API를 호출하지 않는다.
- PNG가 아닌 파일은 적재하지 않고 PNG 화면을 보내도록 안내한다.
- 로컬 첨부 경로를 `stage_attachment.ts`에 전달한다.
- 적재가 끝나면 `/$accountbook-weekly-import` 같은 특정 CLI 문자열을 만들지 않고 `/accountbook-weekly-import --inbox accountbook/private/inbox/new --mode auto-safe` 의도로 위임한다.
- 성공 회신은 날짜, 등록·검토·실패 건수만 담고 거래 설명, 계좌, 가맹점, 원본 경로와 인증 값을 넣지 않는다.
- `needs_review`와 불명확한 POST는 자동 재시도하지 않는다.
- Discord 원본 메시지를 삭제하지 않는다.

YAML 설명, 제목, 단계명과 안내 문장은 자연스러운 한국어로 쓴다.
제품명, 명령어, 경로, 파일명, 코드 식별자와 상태값만 원문을 유지한다.

### 2. Codex와 Hermes 검색 경로 연결

`accountbook/.codex/skills/accountbook-discord-import`를 `.claude` 정본으로 향하는 상대 symlink로 만든다.
Hermes는 홈서버 설정의 `skills.external_dirs`가 `accountbook/.claude/skills`를 가리키는 방식으로 읽으며 저장소 안에 Hermes 전용 복사본을 만들지 않는다.

### 3. 기존 스킬 문체 교정

다음 두 파일의 스킬 이름과 코드 계약은 유지하고 설명 문장만 고친다.

- `accountbook/.claude/skills/accountbook-screenshot-import/SKILL.md`
- `accountbook/.claude/skills/accountbook-weekly-import/SKILL.md`

일반 문장에 남아 있는 `inbox`, `sidecar manifest`, `queue output`, `work item`, `validated plan`, `finalize`, `submit`, `terminal 상태`, `private submission state`를 문맥에 맞는 한국어로 바꾼다.
경로의 `inbox`, 함수명과 상태값처럼 코드와 맞물리는 표기는 코드 span 안에서 유지한다.
각 스킬의 첫 제목은 식별자 대신 `가계부 스크린샷 가져오기`, `가계부 주간 자동 가져오기`, `Discord 가계부 이미지 가져오기`처럼 사용자 목적이 드러나는 한국어로 쓴다.

### 4. 스킬 평가 입력 작성

`evals/evals.json`에 다음 세 경우를 포함한다.

- Discord에서 PNG 한 장을 보내 즉시 등록을 요청하는 정상 입력
- 이미지 없이 가계부 등록을 요청하는 빈 입력
- PNG 두 장을 한 메시지에 첨부한 차단 입력

기대 결과에는 파일 적재 여부, 기존 스킬 위임 여부, API 호출 금지 조건과 민감 정보가 없는 회신을 적는다.
JSON은 마지막 줄바꿈을 포함한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `accountbook/.claude/skills/accountbook-discord-import/SKILL.md` | 신규 |
| `accountbook/.claude/skills/accountbook-discord-import/agents/openai.yaml` | 신규 |
| `accountbook/.claude/skills/accountbook-discord-import/evals/evals.json` | 신규 |
| `accountbook/.codex/skills/accountbook-discord-import` | 신규 symlink |
| `accountbook/.claude/skills/accountbook-screenshot-import/SKILL.md` | 문체 수정 |
| `accountbook/.claude/skills/accountbook-weekly-import/SKILL.md` | 문체 수정 |

## 검증

보고 직전 반드시 다음 명령을 실행하고 원시 종료 상태를 출력한다.

```bash
# cwd: fos-agents 저장소 루트
cd "$(git rev-parse --show-toplevel)"
pwd
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
mixed_count=$(rg -n 'queue output|work item|validated plan|terminal 상태|private submission state|주간 inbox|sidecar manifest' \
  accountbook/.claude/skills/accountbook-discord-import/SKILL.md \
  accountbook/.claude/skills/accountbook-screenshot-import/SKILL.md \
  accountbook/.claude/skills/accountbook-weekly-import/SKILL.md | wc -l | tr -d ' ')
echo "[style_status] $style_status"
echo "[readability_status] $readability_status"
echo "[mixed_count] $mixed_count"
test "$style_status" -eq 0
test "$readability_status" -eq 0
test "$mixed_count" -eq 0
```

## 의도 메모

- 새 스킬은 Discord 입력만 번역하며 안전 정책과 등록 코드를 복제하지 않는다.
- 한국어 교정은 accountbook의 직접 연결된 세 스킬로 한정한다.
- 코드 계약은 번역하지 않아 실행기와 문서가 어긋나지 않게 한다.

## 커밋

변경 파일만 stage한 뒤 다음 형식으로 커밋한다.

```text
feat(accountbook): Hermes Discord 가계부 입력 스킬을 추가한다
```
