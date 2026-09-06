# Phase 02 지원 전략 원본에 공고 항목별 적합도를 넣는다

**Execution profile**: standard

---

## 목표

`application-package.md`에 공고 항목 하나에 한 행을 주는 적합도 표를 만들고, 팀과 인접 사례 링크를 정식 섹션으로 승격한다.
공고 요구 중 어느 항목이 대조에서 빠졌는지 문서에서 바로 보이게 하는 것이 목적이다.

**범위 외**: 검토 화면의 탭 구성과 템플릿 분리는 phase 03이 맡는다. 산출물 경로는 phase 01이 이미 바꿨다.

---

## 컨텍스트

지금 `application-package.md`의 「회사와 포지션이 찾는 사람」 표는 여섯 행이다.
토스플레이스 공고는 주요 업무 7개, 기대 경험 5개, 우대 경험 4개로 항목이 16개다.
여섯 행으로 요약하면 어느 항목이 대조에서 빠졌는지 알 수 없다.

「공개 자료로 확인한 팀과 인접 사례」 표는 토스플레이스 문서에 이미 있지만 섹션 계약에는 없다.
계약에 없으므로 다른 지원 건에서는 만들어지지 않는다.

섹션 계약은 `career-os/.claude/skills/application-package-writer/scripts/package_contract.ts`의 `REQUIRED_HEADINGS`가 소유한다.
phase 01에서 이 키가 `evidence/application-package.md`로 바뀐 상태다.

**근거 문서**: `career-os/docs/flow.md`의 「지원 준비와 검증」 5번, `career-os/docs/data-schema.md`의 「지원 패키지」, `career-os/docs/adr/ADR-109-지원-산출물을-역할별-디렉터리로-나눈다.md`

---

## 의도 메모

- 「회사와 포지션이 찾는 사람」을 지우지 않고 「공고 항목별 적합도」로 대체한다. 같은 일을 하는 두 표를 남기면 어느 쪽을 채워야 하는지 판단이 필요해진다.
- 판정 값은 기존 네 가지를 그대로 쓴다. `확인됨`, `인접 경험`, `공백`, `사용자 확인`이다. 새 값을 만들면 근거 감사와 준비 상태 판정이 함께 흔들린다.

---

## 작업 항목

### 1. `career-os/.claude/skills/application-package-writer/scripts/package_contract.ts`에서 섹션 계약을 바꾼다

`REQUIRED_HEADINGS`의 `evidence/application-package.md` 목록에서 `## 회사와 포지션이 찾는 사람`을 `## 공고 항목별 적합도`로 바꾼다.
그 바로 뒤에 `## 공개 자료로 확인한 팀과 인접 사례`를 더한다.
나머지 섹션과 순서는 그대로 둔다.

### 2. `career-os/.claude/skills/application-package-writer/scripts/validate_application_package.ts`에서 적합도 표를 검사한다

`## 공고 항목별 적합도` 섹션에 표가 있고 머리행이 `공고 항목`, `공고 구분`, `근거`, `판정`인지 확인한다.
`판정` 열의 값이 `확인됨`, `인접 경험`, `공백`, `사용자 확인` 중 하나가 아니면 거부한다.
표가 없거나 데이터 행이 없으면 거부한다.

### 3. `career-os/.claude/skills/application-package-writer/SKILL.md`에서 두 섹션의 작성 기준을 적는다

「지원 전략 산출물 작성」 절의 섹션 목록을 1번 계약과 맞춘다.
`## 공고 항목별 적합도`에 다음 기준을 적는다.

- `posting.md`의 주요 업무, 기대 경험과 우대 경험을 항목 단위로 모두 담는다. 요약해 합치지 않는다.
- 각 행은 공고 항목 원문의 요지, 그 항목이 어느 구분에서 왔는지, 연결할 근거, 판정 넷 중 하나를 담는다.
- 판정이 `공백`인 항목은 「보완할 공백」 절과 같은 내용을 가리켜야 한다.

`## 공개 자료로 확인한 팀과 인접 사례`에는 다음 기준을 적는다.

- 같은 팀의 공식 정보와 인접 조직의 사례를 행에서 구분한다.
- 각 행은 자료 링크, 확인한 범위, 지원 준비에 쓰는 관점을 담는다.
- 공고 페이지에 외부 링크가 없으면 직접 찾은 자료임을 밝힌다.

### 4. `career-os/applications/tossplace/server-developer-ai-platform/evidence/application-package.md`에서 두 섹션을 다시 쓴다

`## 회사와 포지션이 찾는 사람`을 `## 공고 항목별 적합도`로 바꾸고 `evidence/posting.md`의 16개 항목을 모두 담는다.
현재 여섯 행이 다루던 판정은 해당 항목으로 옮긴다.
「공개 자료로 확인한 팀과 인접 사례」 표는 위치만 새 섹션 순서에 맞춘다.

`evidence/posting.md`에서 확인한 다음 항목은 아직 어느 섹션에도 반영되지 않았다. 적합도 표와 관련 섹션에 함께 반영한다.

- `Place Agent`는 공고가 직접 부른 제품 이름이다.
- `전에 없던 Proactive한 매장 관리 경험`이 팀의 제품 방향이다. 지금 「입사 후 기여 시나리오」는 질문에 답하는 Agent 위주다.
- Prompt, Tool과 컨텍스트 구성의 실험 기반 설계가 별도 업무 항목이다.
- 복잡한 AI 시스템 단순화는 경험이 아니라 관심을 묻는 항목이므로 `공백`으로 분류하지 않는다.

`career-os/applications`는 홈서버와 동기화되는 비공개 작업본이다.
`career-os/docs/flow.md`의 「skill이 실행하는 명령」을 `SKILL_NAME=application-package-writer`로 실행해 최신 판을 받고, 작업을 마친 뒤 같은 이름으로 완료 단계를 실행한다.

### 5. 이 phase를 검증하는 테스트를 더한다

`career-os/.claude/skills/application-package-writer/scripts/validate_application_package.test.ts`에 두 경우를 더한다.

- 정상: 네 열 머리행과 판정 값이 올바른 적합도 표를 가진 문서가 통과한다.
- 실패: `판정` 열에 `대체로 맞음`처럼 계약에 없는 값이 있으면 거부한다.

---

## 검증

저장소 루트에서 실행한다.

```bash
# cwd: 저장소 루트 (fos-agents)
bun test ./career-os/.claude/skills/
bunx tsc --noEmit
```

두 명령이 모두 종료 코드 0이어야 한다.

토스플레이스 문서에 두 섹션이 있는지 확인한다.

```bash
# cwd: 저장소 루트 (fos-agents)
grep -c "^## 공고 항목별 적합도\|^## 공개 자료로 확인한 팀과 인접 사례" \
  career-os/applications/tossplace/server-developer-ai-platform/evidence/application-package.md
```

`2`가 나와야 한다.

적합도 표의 데이터 행 수를 확인한다.

```bash
# cwd: 저장소 루트 (fos-agents)
sed -n '/^## 공고 항목별 적합도/,/^## /p' \
  career-os/applications/tossplace/server-developer-ai-platform/evidence/application-package.md \
  | grep -c "^| "
```

머리행과 구분행을 포함해 18행 이상이어야 한다.

한국어 검사를 통과해야 한다.

```bash
# cwd: 저장소 루트 (fos-agents)
~/.claude/scripts/korean-style-check.sh career-os/applications/tossplace/server-developer-ai-platform/evidence/application-package.md
python3 ~/.claude/scripts/check-readability.py career-os/applications/tossplace/server-developer-ai-platform/evidence/application-package.md
```

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/application-package-writer/scripts/package_contract.ts` | 수정 |
| `career-os/.claude/skills/application-package-writer/scripts/validate_application_package.ts` | 수정 |
| `career-os/.claude/skills/application-package-writer/scripts/validate_application_package.test.ts` | 수정 |
| `career-os/.claude/skills/application-package-writer/SKILL.md` | 수정 |
| `career-os/applications/tossplace/server-developer-ai-platform/evidence/application-package.md` | 수정 |
