# Phase 05. skill 문서를 한 흐름으로 고친다

**Execution profile**: standard

## 목표

`study-topic-recommender` skill 문서에서 파일모드와 `--library` 구분을 지우고
Backend 흐름 하나만 남긴다. 소스를 고치는 방법을 편집 명령으로 바꾼다.

**범위 외**: 배포와 운영 이관. 이 phase 의 「배포 전에 확인할 것」 에 적는다.

## 컨텍스트

`.claude/skills/study-topic-recommender/SKILL.md` 는 117줄이고
18행부터 「기본 실행은 `state/morning-study-history.json` 을 사용하는 파일모드다」 로 시작한다.
`references/execution.md` 는 「파일모드」, 「Library 모드」, 「기존 이력 가져오기」 절을 따로 둔다.
`references/source-management.md` 는 소스를 config 파일에서 고치는 방법을 적는다.

Phase 04 가 파일모드와 import preview 를 지우고 `manage_reading_sources.ts` 를 편집 명령으로 바꿨다.

**근거 문서**: `docs/flow.md` 의 「study-topic-recommender」 절,
`docs/adr/ADR-126-읽을거리-소스-목록은-backend가-원본을-가진다.md`,
`docs/adr/ADR-127-공부-추천은-고르지-않은-후보의-판정을-재사용한다.md`

## 의도 메모

**모델에게 고르지 않은 후보의 이유를 요구한다는 것을 skill 이 말해야 한다.**
그 요구가 문서에 없으면 모델은 선택한 것만 낸다. 판정이 쌓이지 않아 재사용이 일어나지 않는다.

**관심사가 바뀌면 기준 버전을 올린다는 것도 skill 이 말한다.**
사람이 모르면 예전 기준의 판정이 30일 동안 남는다.

## 작업 항목

### 1. `SKILL.md`

- 파일모드와 `--library` 문장을 지운다. Backend 에 저장한다는 한 문장으로 바꾼다
- 최근 7회 리포트 분포를 파일에서 비교하던 문장을 후보 API 의 `recentStudyTopicKeys` 기준으로 고친다
- 선택 결과에 고르지 않은 후보의 한 줄 이유를 함께 낸다는 것을 적는다
- 관심사가 바뀌면 `configure_study_recommendation.ts` 로 기준 버전을 올린다는 것을 적는다

### 2. `references/execution.md`

「파일모드」 와 「기존 이력 가져오기」 절을 지우고 「Library 모드」 를 「실행」 으로 바꾼다.
명령에서 `--library` 를 뺀다. 이관 명령은 「운영 이관」 절로 한 번만 적는다.

### 3. `references/source-management.md`

config 파일을 고치던 절차를 `manage_reading_sources.ts` 의 하위 명령으로 바꾼다.
소스를 끌 때 `--note` 에 실패 원인을 남긴다는 것을 적는다.

### 4. 이 phase 를 검증하는 검사

`scripts/study-topic-recommender/skill_doc.test.ts` 를 만든다. `SKILL.md` 와 `references/` 를 읽어 확인한다.

- `파일모드`, `--library`, `morning-study-history`, `--commit-history` 문자열이 없다
- `configure_study_recommendation.ts` 가 나온다
- 고르지 않은 후보의 이유를 요구하는 문장이 있다. `rejections` 문자열로 확인한다

## 검증

```bash
# cwd: 저장소 루트
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
bun test career-os/scripts/study-topic-recommender
bunx tsc --noEmit
bun test ./career-os/.claude/skills/
python3 "$HOME/.codex/skills/.system/skill-creator/scripts/quick_validate.py" \
  career-os/.claude/skills/study-topic-recommender
```

```bash
# cwd: 저장소 루트
"$HOME/.claude/skills/korean-check/scripts/check.sh" \
  career-os/.claude/skills/study-topic-recommender/SKILL.md \
  career-os/.claude/skills/study-topic-recommender/references/execution.md \
  career-os/.claude/skills/study-topic-recommender/references/source-management.md
```

기대값이다.

- 다섯 명령 모두 종료 코드 0
- `skill_doc.test.ts` 의 항목이 모두 통과

## 배포 전에 확인할 것

이 계획은 배포를 실행하지 않는다.

- migration 이 운영 `fos_career` 에 들어가는지 확인한다. 다른 브랜치의 migration 과 순서가 맞아야 한다
- 운영에서 `import_study_state.ts --dry-run` 을 먼저 돌려 소스 건수와 리포트 3건과 자료 15건을 확인한 뒤 `--commit` 한다
- 이관 뒤 `GET /candidates` 에 이력의 15건이 나오지 않는지 확인한다
- 홈서버의 `morning` 작업이 `--library` 나 `--commit-history` 를 넘기고 있지 않은지 확인한다.
  넘기면 사용법 오류로 멈춘다. 그 설정은 `fos-home-infra` 에 있다
- 해당 container 의 환경에서 `STUDY_LIBRARY_URL` 과 `STUDY_SERVICE_TOKEN` 을 빼고
  `CAREER_RECOMMENDATION_API_URL` 과 token 이 있는지 확인한다
- 이관을 확인한 뒤 `config/external-reading-sources.ts` 와 `state/morning-study-history.json` 을 지운다.
  별도 커밋으로 한다

## 이 plan 을 마감한다

위 검증이 모두 통과하면 `tasks/plan129-study-library-db/index.json` 의
`status` 를 `completed` 로 바꾸고 `current_phase` 를 5 로 둔다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/study-topic-recommender/SKILL.md` | 수정 |
| `career-os/.claude/skills/study-topic-recommender/references/execution.md` | 수정 |
| `career-os/.claude/skills/study-topic-recommender/references/source-management.md` | 수정 |
| `career-os/scripts/study-topic-recommender/skill_doc.test.ts` | 신규 |
