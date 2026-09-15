# Phase 04. TypeScript 포맷 hook과 하네스 스킬 경계 교정

**Execution profile**: standard

## 목표

`apply_patch`로 수정한 TypeScript 파일만 Prettier로 정리하고,
`harness-cleanup`이 낡은 하네스 지침 감사 요청에만 선택되도록 설명을 좁힌다.

**범위 외**: 저장소 전체 파일 일괄 포맷, Prettier 의존성 추가,
`harness-cleanup`의 감사 절차 변경은 수행하지 않는다.

## 컨텍스트

fos-agents 루트에는 Prettier가 이미 설치되어 있다.
Codex의 프로젝트 hook은 루트 `.codex/hooks.json`에서 `PostToolUse`와
`apply_patch` matcher로 연결할 수 있다.

`harness-cleanup`의 관리 원본은 `/Users/nhn/personal/fos-skills/harness-cleanup/`이다.
현재 설명은 감사 목적을 담고 있지만, 일반 hook 설정 변경까지 포함하는 것으로
넓게 해석될 여지가 있다.

## 의도 메모

- hook은 patch 입력에서 `.ts`와 `.tsx` 대상만 추출한다.
- 저장소 밖 경로, 삭제한 파일과 존재하지 않는 파일은 건드리지 않는다.
- 성공 시 추가 문맥을 출력하지 않고, 실패만 명시적으로 알린다.
- `exec_command`는 수정 파일을 안정적으로 식별할 수 없으므로 matcher에 넣지 않는다.
- `harness-cleanup` 이름과 본문 절차는 유지하고 frontmatter 설명만 교정한다.

## 작업 항목

### 1. 저장소 공용 formatter 추가

fos-agents 루트 `scripts/hooks/`에 `PostToolUse` JSON을 읽고 변경한 TypeScript
파일만 Prettier로 포맷하는 TypeScript 진입점을 만든다.
입력 파싱, 저장소 경계 확인과 대상 선별은 테스트 가능한 함수로 분리한다.

### 2. Codex project hook 연결

fos-agents 루트 `.codex/hooks.json`에 `PostToolUse`와 `^apply_patch$` matcher를
추가한다. 기존 전역 hook과 함께 실행되어도 출력과 책임이 충돌하지 않아야 한다.

### 3. 회귀 테스트와 실제 입력 검증

복수 파일 patch, `.ts`와 비대상 파일 혼합, 파일 이동과 삭제,
저장소 밖 경로를 테스트한다. `/tmp`의 fixture에 실제 hook 입력을 전달해
TypeScript 파일만 Prettier 결과로 바뀌는지 확인한다.

### 4. `harness-cleanup` 설명 교정

관리 원본 `SKILL.md`의 설명을 낡았거나 실제 동작과 어긋난 하네스 지침을
감사하고 정리하는 스킬로 명시한다. 일반 코드·제품 문서 수정과 formatter hook
추가는 대상이 아니라는 경계를 짧게 적는다. 본문 절차는 바꾸지 않는다.

## 검증

각 저장소 루트에서 해당 명령을 실행한다.

```bash
bun test scripts/hooks/*.test.ts
bunx tsc --noEmit
git diff --check
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py /Users/nhn/personal/fos-skills/harness-cleanup
```

`harness-cleanup` 설명에는 낡은 하네스 지침 감사 조건과 일반 hook 설정 변경 제외가
함께 있어야 한다. 포맷 hook은 동일 파일을 두 번 실행해도 두 번째 실행에서 파일을
바꾸지 않아야 한다.

## Critical Files

| 저장소 | 파일 | 변경 |
| --- | --- | --- |
| `fos-agents` | `.codex/hooks.json` | 신규 |
| `fos-agents` | `scripts/hooks/*.ts` | 신규 |
| `fos-agents` | `docs/code-architecture.md` | 공용 hook 책임 추가 |
| `fos-skills` | `harness-cleanup/SKILL.md` | 설명 교정 |
