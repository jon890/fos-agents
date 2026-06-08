# Phase 01 — config reader inventory와 사용 분류

**Model**: sonnet
**Status**: completed

## 목표

ADR-069 정리 후보 config의 active reader를 전수 조사한다.

각 파일을 유지, 축소, 이관, 삭제 후보로 분류하고, 이후 phase가 사용할 reader inventory를 task 산출물로 고정한다.

## 중요 지침

이 phase는 implementation phase다.

docs-first 반영은 이미 완료됐다.
`docs/`, ADR, `AGENTS.md`, `TOOLS.md`, 정책 문서를 임의 수정하지 않는다.

같은 plan의 phase는 병렬 실행하지 않는다.
Phase 01 완료 후에만 Phase 02로 넘어간다.

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
git status --short
```

## 관련 파일

실행 전 반드시 읽는다.

- `AGENTS.md`
- `docs/adr.md`의 ADR-069
- `docs/data-schema.md`의 config 책임 원칙
- `docs/flow.md`의 config diet 흐름
- `docs/code-architecture.md`의 config 설계 원칙
- `tasks/plan068-config-diet/index.json`

## 수정 범위

- `tasks/plan068-config-diet/phase-01.md`
- `tasks/plan068-config-diet/index.json`
- 필요하면 `tasks/plan068-config-diet/reader-inventory.md`

## 조사 대상 config

- `config/first-round-drill-core-files.json`
- `config/study-preferences.json`
- `config/study-pack-topics.json`
- `config/study-pack-candidates.json`
- `config/topic-file-map.json`
- `config/topic-profiles.json`
- `config/question-bank-topics.json`
- `config/live-coding-seed-pool.json`
- `config/live-coding-seed-candidates.json`

## 작업 절차

1. 각 대상 파일의 존재 여부와 대략적인 크기, top-level key를 기록한다.
2. `rg`로 active reader를 찾는다.
   - `scripts/`
   - `.claude/skills/`
   - `skills/`
   - `public/`
   - `config/`
   - `docs/`
   - `tasks/`
3. 검색 결과를 active reader, docs reference, task history, dead reference로 분류한다.
4. 각 대상 파일에 대해 다음 결론 중 하나를 부여한다.
   - 유지
   - 축소
   - 이관
   - 삭제 후보
   - 보류
5. `reader-inventory.md`에 근거와 다음 phase 의존성을 적는다.
6. `index.json`의 Phase 01 결과만 갱신한다.

## 금지 범위

- config 파일 내용 수정.
- scripts, skill, public/question-bank, sources/fos-study 수정.
- docs/ADR/정책 문서 수정.
- reader가 남은 config 파일 삭제.
- unrelated dirty 변경 revert, stage, commit, push.
- 새 산출물에 금지 표현 사용.

## 검증 명령

보고 직전 반드시 실행하고 raw 결과를 남긴다.

```bash
cd "$(git rev-parse --show-toplevel)"
git status --short

for file in \
  config/first-round-drill-core-files.json \
  config/study-preferences.json \
  config/study-pack-topics.json \
  config/study-pack-candidates.json \
  config/topic-file-map.json \
  config/topic-profiles.json \
  config/question-bank-topics.json \
  config/live-coding-seed-pool.json \
  config/live-coding-seed-candidates.json; do
  if test -f "$file"; then
    printf "[exists] %s " "$file"
    wc -c <"$file"
  else
    printf "[missing] %s\n" "$file"
  fi
done

rg -n "first-round-drill-core-files|study-preferences|study-pack-topics|study-pack-candidates|topic-file-map|topic-profiles|question-bank-topics|live-coding-seed-pool|live-coding-seed-candidates" \
  scripts .claude/skills public config docs tasks \
  | tee /tmp/plan068-phase01-reader-rg.txt

test -f tasks/plan068-config-diet/reader-inventory.md
rg -n "유지|축소|이관|삭제 후보|보류|active reader|docs reference|task history" \
  tasks/plan068-config-diet/reader-inventory.md

rg -n "smo""ke" tasks/plan068-config-diet && exit 1 || true
git diff --check -- tasks/plan068-config-diet
```

## 성공 기준

- 대상 config 9개의 존재 여부와 reader가 기록된다.
- active reader와 docs/task history reference가 구분된다.
- 각 대상 파일의 유지, 축소, 이관, 삭제 후보, 보류 판단이 근거와 함께 기록된다.
- Phase 02와 Phase 03가 구현할 helper 또는 migration 대상이 명확하다.
- config, scripts, skill, public/question-bank, sources/fos-study는 수정되지 않는다.
- 새 task 산출물에 금지 표현이 없다.

## 민감 정보 경계

- `config/candidate-profile.md`, `data/private/`, `data/applications/`, `private/` 본문을 inventory에 복사하지 않는다.
- reader 경로와 파일명은 기록할 수 있지만 개인 이력, 회사별 전략, 비공개 답변 본문은 기록하지 않는다.
- 공개 질문 inventory는 public-safe 질문 구조만 대상으로 삼는다.

## HUD 갱신 지점

모든 HUD 갱신은 `session_status`와 subagent 목록을 먼저 확인한 뒤 `/home/bifos/.openclaw/workspace-career/scripts/task-hud/update_from_session_status.ts`로 full snapshot 갱신한다.
`update_event.ts` 같은 부분 갱신 경로를 쓰지 않는다.

- Phase 01 시작: `implementation running`
- Phase 01 완료: `implementation running`
- Phase 01 실패: `implementation failed`
- Phase 01 보류: `implementation blocked`

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- 대상 config 중 active reader가 있는데 역할을 문서만으로 판정할 수 없다.
- 동일 파일에 기존 dirty 변경이 있어 사용자 변경과 phase 변경을 구분할 수 없다.
- docs/ADR/정책 문서 수정 없이는 reader 분류 기준을 세울 수 없다.
- private 자료 본문을 읽지 않으면 판단할 수밖에 없는 흐름이 발견된다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- config 파일을 수정하거나 삭제한다.
- scripts, skill, public/question-bank, sources/fos-study를 수정한다.
- docs/ADR/정책 문서를 임의 수정한다.
- private 본문을 reader inventory에 복사한다.
- 새 task 산출물에 금지 표현을 남긴다.
- unrelated dirty 변경을 revert, stage, commit, push한다.

## 실행 결과

- 완료일: 2026-06-08
- 상태: completed
- 산출물: `tasks/plan068-config-diet/reader-inventory.md`
- index 갱신: `tasks/plan068-config-diet/index.json`의 Phase 01 status를 `completed`, plan status를 `in_progress`, `current_phase`를 2로 갱신했다.
- PHASE_BLOCKED: 없음
- PHASE_FAILED: 없음

### reader 분류 요약

- 유지: `config/live-coding-seed-pool.json`
- 축소: `config/study-preferences.json`, `config/study-pack-topics.json`, `config/study-pack-candidates.json`, `config/live-coding-seed-candidates.json`
- 이관: `config/topic-file-map.json`, `config/topic-profiles.json`, `config/question-bank-topics.json`
- 삭제 후보: `config/first-round-drill-core-files.json`
- 보류: 없음

### 검증 결과

career-os cwd 기준으로 검증했다.
phase 문서의 명령 블록에 포함됐던 `skills/` 디렉터리는 현재 존재하지 않아 `rg` 경고가 출력됐지만, 파이프라인 전체는 0으로 종료됐다.
검토 후 후속 실행에서 경고가 반복되지 않도록 검증 경로는 `.claude/skills` 기준으로 정리했다.

```text
git status --short
 M ../apartment/docs/interior/interior-references.md
 M ../apartment/docs/interior/lucky-5-1004-decision-queue.md
 M tasks/plan068-config-diet/index.json
 M tasks/plan068-config-diet/phase-01.md
?? ../apartment/docs/interior/contractor-estimates/designflat-todayhome-2026-06-08.md
?? tasks/plan068-config-diet/reader-inventory.md

[exists] config/first-round-drill-core-files.json 3399
[exists] config/study-preferences.json 4140
[exists] config/study-pack-topics.json 39846
[exists] config/study-pack-candidates.json 41812
[exists] config/topic-file-map.json 5079
[exists] config/topic-profiles.json 2068
[exists] config/question-bank-topics.json 2732
[exists] config/live-coding-seed-pool.json 4605
[exists] config/live-coding-seed-candidates.json 973

rg: skills: No such file or directory (os error 2)
reader inventory grep: active reader, docs reference, task history, 유지, 축소, 이관, 삭제 후보 확인됨
금지 표현 grep: 통과
git diff --check -- tasks/plan068-config-diet: 통과
python3 -m json.tool tasks/plan068-config-diet/index.json: 통과
```
