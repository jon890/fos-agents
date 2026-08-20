# Phase 03: agent skill과 샘플 검증 완성

**Execution profile**: standard

## 목표

다른 agent가 이전 대화 없이 이미지를 추출하고 검증, 미리보기, 승인, 등록 흐름을 안전하게 실행하도록 skill을 완성한다.

**범위 외**: 실제 금융 이미지와 거래 내용을 fixture나 문서에 저장하지 않는다.

## 작업 항목 (4)

### 1. skill workflow

`accountbook/.claude/skills/accountbook-screenshot-import/SKILL.md`에 입력 확인, vision 추출, 결정적 검증, 미리보기 정지, 승인 후 등록과 중단 조건을 작성한다.

### 2. 추출 계약 reference

`accountbook/.claude/skills/accountbook-screenshot-import/references/extraction-contract.md`에 토스 화면 행 경계, 날짜 연도 근거, 합계 검증과 JSON 생성 규칙을 작성한다.

### 3. 비식별 fixture 검증

실제 화면과 구조만 같은 비식별 후보 JSON으로 validator와 승인 helper를 실행한다.

### 4. skill과 문서 검증

skill quick validation, TypeScript test, 한국어 표현 검사와 문서 가독성 검사를 실행한다.
검증이 모두 통과하면 `accountbook/tasks/plan001-toss-screenshot-import/index.json`의 상태와 각 phase 상태를 `completed`로 바꾼다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `accountbook/.claude/skills/accountbook-screenshot-import/SKILL.md` | 수정 |
| `accountbook/.claude/skills/accountbook-screenshot-import/references/extraction-contract.md` | 신규 |
| `accountbook/tasks/plan001-toss-screenshot-import/index.json` | 완료 상태 갱신 |

## 검증

보고 직전 반드시 다음 명령을 실행하고 원시 결과를 확인한다.

```bash
# cwd: fos-agents root
cd "$(git rev-parse --show-toplevel)"
pwd
bun test accountbook/scripts/accountbook-screenshot-import
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py accountbook/.claude/skills/accountbook-screenshot-import
~/.claude/scripts/korean-style-check.sh accountbook/AGENTS.md accountbook/README.md accountbook/docs/*.md accountbook/docs/adr/*.md accountbook/.claude/skills/accountbook-screenshot-import/*.md accountbook/.claude/skills/accountbook-screenshot-import/references/*.md accountbook/tasks/plan001-toss-screenshot-import/*.md
python3 ~/.claude/scripts/check-readability.py accountbook/AGENTS.md accountbook/README.md accountbook/docs/*.md accountbook/docs/adr/*.md accountbook/.claude/skills/accountbook-screenshot-import/*.md accountbook/.claude/skills/accountbook-screenshot-import/references/*.md accountbook/tasks/plan001-toss-screenshot-import/*.md
```

## 의도 메모

- skill은 runtime의 vision 기능을 사용하되 특정 agent CLI를 직접 호출하지 않는다.
- 실제 금융 데이터는 private runtime 산출물로만 검증한다.
