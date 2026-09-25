# Phase 03. 옛 환경값을 뺀다

**Execution profile**: fast

## 목표

전환 기간에 받던 `CAREER_RECOMMENDATION_*` 환경값 읽기를 코드와 문서에서 뺀다.

**범위 외**: 홈서버의 옛 network alias 제거는 fos-home-infra 가 한다.

## 컨텍스트

phase 01 과 02 가 머지됐고 홈서버가 새 이름으로 전환된 뒤에 시작한다.

## Blocked 조건

아래 셋이 모두 확인되지 않았으면 `PHASE_BLOCKED: 운영 전환 확인 전` 을 출력하고 끝낸다. 확인은 코디네이터가 하고 phase 를 넘길 때 알려 준다.

- hermes 의 환경값이 `CAREER_BACKEND_URL`, `CAREER_BACKEND_TOKEN_FILE` 이고 옛 이름이 없다
- Backend container 의 환경값이 새 이름이다
- 전환 뒤 포지션 추천과 공부 추천 cron 이 한 번씩 성공했다

**근거 문서**: `docs/adr/ADR-128-커리어-backend로-이름을-넓힌다.md`

## 작업 항목

### 1. `career-os/scripts/lib/career-backend-config.ts`

옛 이름 읽기를 지운다. 새 이름만 읽는다.

### 2. `career-os/services/career-backend/src/config/config.ts`

`environmentSchema` 와 `loadConfig` 에서 옛 이름을 지운다.

### 3. 문서

`docs/code-architecture.md` 의 「전환 기간에는 옛 `CAREER_RECOMMENDATION_*` 이름도 읽는다」 줄을 지운다.

### 4. 테스트

- phase 01 이 넣은 옛 이름 테스트를 「옛 이름만 있으면 새 이름이 필요하다는 오류가 난다」 로 바꾼다
- `career-os/scripts/lib/career-backend-naming.test.ts` 의 `CAREER_RECOMMENDATION_` 허용 목록을 두 설정 테스트 파일만 남긴다. 두 설정 파일과 `code-architecture.md` 를 뺀다

## 검증

phase 02 의 검증 명령을 모두 다시 돌린다. 기대값은 모두 실패 0 이다.

```bash
# cwd: 저장소 루트
git grep -l "CAREER_RECOMMENDATION_" -- career-os ':!career-os/docs/adr' ':!career-os/tasks' \
  ':!career-os/services/career-backend/test/fixtures/legacy-contract' | sort
```

결과가 `career-os/scripts/lib/career-backend-naming.test.ts` 와 두 설정 테스트 파일뿐이다.

## 마무리

검증이 통과하면 `career-os/tasks/plan132-career-backend-rename/index.json` 의 이 phase 를 완료로 표시하고 `current_phase` 를 다음 번호로 올린다. 마지막 phase 이므로 `status` 를 `completed` 로 바꾼다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/lib/career-backend-config.ts` | 수정 |
| `career-os/services/career-backend/src/config/config.ts` | 수정 |
| 두 설정 테스트와 naming 테스트 | 수정 |
| `career-os/docs/code-architecture.md` | 수정 |
