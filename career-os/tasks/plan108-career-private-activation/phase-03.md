# Phase 03 작성 skill의 prepare와 publish 활성화

**Execution profile**: deep

---

## 목표

사용자가 기존 career skill만 호출해도 최신 private 작업본을 준비하고 성공한 변경을 새 release로 발행하도록 연결한다.

**범위 외**: 새 사용자용 동기화 skill, 자동 충돌 병합, 추천 리포트 cache 동기화와 운영 인프라 변경은 수행하지 않는다.

---

## 작업 항목 (5)

### 1. 관리 원본과 skill 경계 확인

`skill-creator`를 사용해 실제 관리 원본과 세 skill의 현재 진입 흐름을 확인한다.
`application-package-writer`, `resume-preparer`, `interview-practice`만 private 파일 prepare·publish 대상에 포함한다.
`position-recommender`와 `study-topic-recommender`의 임시 공개 결과는 동기화하지 않는다.

### 2. 실행 전 prepare

세 작성 skill은 private 입력을 읽기 전에 `career-workspace prepare`를 호출한다.
로컬 dirty, remote 충돌, transport 실패에서는 기존 파일로 계속하지 않고 공개 가능한 판정 코드와 로컬 보존 상태를 반환한다.

### 3. 성공 뒤 publish

관리 root를 변경한 실행만 `diff`를 계산하고 새 release를 publish한다.
생성·검증이 실패한 산출물은 publish하지 않으며, publish 충돌이나 연결 실패에서는 로컬 결과를 유지하고 current revision을 바꾸지 않는다.

### 4. Git과 로컬 상태 경계 검증

plan107이 root `.gitignore`에 반영한 `career-os/.career-sync/`와 관리 root의 비공개 파일 경계를 검증한다.
`career-os/state/drill-progress.json`이 public Git index에서 이미 제거됐고 최초 홈서버 release에서 복구되는지 확인한다.
사용자의 다른 미커밋 파일은 수정·이동·stage하지 않는다.

### 5. skill과 회귀 검증

정상 prepare·publish, dirty 차단, transport 오류, publish 충돌과 검증 실패 fixture를 세 skill 흐름에 적용한다.
수정한 `SKILL.md`는 `quick_validate.py`로 검사하고 실제 관리 원본 외 복제본이 달라지지 않았는지 확인한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `career-os/.claude/skills/application-package-writer/SKILL.md` | 패키지 prepare·publish 연결 |
| `career-os/.claude/skills/resume-preparer/SKILL.md` | 이력서 prepare·publish 연결 |
| `career-os/.claude/skills/interview-practice/SKILL.md` | 면접 자료 prepare·publish 연결 |

## 검증

```bash
# cwd: fos-agents root
bun test ./career-os/scripts/career-workspace
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py career-os/.claude/skills/application-package-writer
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py career-os/.claude/skills/resume-preparer
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py career-os/.claude/skills/interview-practice
git ls-files career-os/state/drill-progress.json
git diff --check
```

`git ls-files career-os/state/drill-progress.json`은 빈 출력을 기대한다.

## Blocked 조건

- skill 관리 원본이 불명확하거나 홈서버 최초 release 복구 검증이 끝나지 않았으면 skill을 수정하지 않는다.
- 개인 연습 상태가 remote release에 포함됐음을 증명하지 못하면 skill 연결을 완료 처리하지 않는다.
