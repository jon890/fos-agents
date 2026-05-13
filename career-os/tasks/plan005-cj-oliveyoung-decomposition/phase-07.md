# Phase 7 — cj-oliveyoung-java-backend-prep 폴더 cleanup + 통합 smoke + push + trailing cleanup

## 목표

phase-01~06이 모든 자산을 새 위치로 옮긴 뒤 비어 있을 `cj-oliveyoung-java-backend-prep/` 폴더의 마지막 잔재(SKILL.md + 사용처 없는 `collect_fos_study.py`)를 제거. 14개 dispatch 명령 전체 syntax + dispatcher path 일관성 검증. 마지막 phase이므로 run-phases.py의 SHA 후기록이 워킹 트리에만 남는 trailing 변경을 한 번 더 정리해 푸시.

## 의존성 / 가정

- phase-01~06 모두 `status: completed`.
- working tree clean(이전 phase 후기록 cleanup 포함).
- 본 phase 끝나면 `cj-oliveyoung-java-backend-prep/` 디렉터리는 git에 존재하지 않는다.

## 작업

### 1. 잔재 파일 정리

먼저 phase-01~06 종료 시점에 `cj-oliveyoung-java-backend-prep/` 폴더에 남아 있을 파일 확인:

```bash
git ls-files career-os/skills/cj-oliveyoung-java-backend-prep/
```

기대 결과(이전 phase 모두 통과했다면):
- `SKILL.md`
- `scripts/collect_fos_study.py`
- (외부 동기 산출물/캐시는 gitignore 대상이라 git ls-files에 안 보임)

#### 1-1. `collect_fos_study.py` 운명 결정

먼저 사용처 grep:

```bash
grep -rln 'collect_fos_study\b' career-os/ \
  --include='*.sh' --include='*.py' --include='*.md' --include='*.json' \
  | grep -v 'tasks/' | grep -v 'docs/'
```

호출처가 본 스크립트의 SKILL.md 외에 없다면(현 시점 grep 결과로 그렇다고 추정) — **git rm**. 호출처가 발견되면 PHASE_FAILED로 종료하고 사용자가 별도 plan(예: plan008-wire-up-or-deprecate)에서 처리.

```bash
if [ "$(grep -rln 'collect_fos_study' career-os/ --include='*.sh' --include='*.py' --include='*.md' --include='*.json' | grep -v 'tasks/' | grep -v 'docs/' | grep -v 'cj-oliveyoung-java-backend-prep/SKILL.md' | wc -l)" -gt 0 ]; then
  echo 'PHASE_FAILED: collect_fos_study.py에 활성 사용처가 있어 안전 제거 불가. plan008로 wire-up 결정 필요.'
  exit 1
fi
git rm career-os/skills/cj-oliveyoung-java-backend-prep/scripts/collect_fos_study.py
```

#### 1-2. SKILL.md + 빈 디렉터리 제거

```bash
git rm career-os/skills/cj-oliveyoung-java-backend-prep/SKILL.md
# scripts/ 와 references/ 폴더는 안에 git tracked 파일이 사라지면 자동으로 제거됨
rmdir career-os/skills/cj-oliveyoung-java-backend-prep/scripts 2>/dev/null || true
rmdir career-os/skills/cj-oliveyoung-java-backend-prep/references 2>/dev/null || true
rmdir career-os/skills/cj-oliveyoung-java-backend-prep 2>/dev/null || true
```

### 2. 14개 dispatch 명령 통합 smoke

#### 2-1. dispatcher 파일 정합성

```bash
# dispatcher syntax + 14개 case 모두 존재
bash -n career-os/skills/command-router/scripts/run_now.sh

# 모든 case가 새 skill 경로를 가리킴 (cj-oliveyoung 잔재 0)
[ "$(grep -c 'cj-oliveyoung-java-backend-prep' career-os/skills/command-router/scripts/run_now.sh)" = "0" ]

# 14개 case 헤더 모두 존재
for case in baseline daily recommend-positions recommend-topics replenish-topics study-pack maintain-study-pack question-bank master foodville-coffeechat smoke bootcamp-batch live-coding-dispatch auto-question-bank; do
  grep -qE "^  ${case}\)" career-os/skills/command-router/scripts/run_now.sh \
    || { echo "PHASE_FAILED: dispatcher에 ${case} case 없음"; exit 1; }
done
```

#### 2-2. 5개 새 skill + 흡수된 자매 skill 모두 syntax 통과

```bash
for sh in \
  career-os/skills/command-router/scripts/*.sh \
  career-os/skills/knowledge-gap-analyzer/scripts/*.sh \
  career-os/skills/study-topic-recommender/scripts/*.sh \
  career-os/skills/topic-pool-replenisher/scripts/*.sh \
  career-os/skills/study-pack-batch/scripts/*.sh \
  career-os/skills/experience-question-bank-writer/scripts/*.sh; do
  bash -n "$sh" || { echo "PHASE_FAILED: $sh syntax"; exit 1; }
done

for py in \
  career-os/skills/knowledge-gap-analyzer/scripts/*.py \
  career-os/skills/study-topic-recommender/scripts/*.py \
  career-os/skills/topic-pool-replenisher/scripts/*.py; do
  python3 -m py_compile "$py" || { echo "PHASE_FAILED: $py compile"; exit 1; }
done
```

#### 2-3. 워크스페이스 전역 cj-oliveyoung 잔재 0 (docs / tasks / AGENTS 제외)

```bash
HITS=$(grep -rln 'cj-oliveyoung-java-backend-prep' career-os/ \
  --include='*.sh' --include='*.py' --include='*.md' --include='*.json' \
  | grep -v 'tasks/' | grep -v 'docs/' | grep -v 'AGENTS.md' | grep -v 'CLAUDE.md')
if [ -n "$HITS" ]; then
  echo "PHASE_FAILED: cj-oliveyoung 잔재"
  echo "$HITS"
  exit 1
fi
```

(docs / tasks / AGENTS는 history 보존 및 ADR-017 컨텍스트 인용으로 잔재가 의도된 곳.)

#### 2-4. dispatcher smoke (실제 1회 실행 — 부작용 없는 case)

```bash
bash career-os/skills/command-router/scripts/run_now.sh smoke
```

`smoke` case는 knowledge-gap-analyzer의 `run_smoke_test.sh`를 호출. 실패 시 PHASE_FAILED.

### 3. push + trailing cleanup

본 phase의 자체 커밋을 만들고 push. 이후 run-phases.py가 phase-07의 SHA를 index.json에 후기록한 trailing 변경(JSON metadata 한 줄)이 워킹 트리에 남는다. 이를 정리하는 trailing cleanup 커밋을 추가로 만들고 push:

```bash
git add career-os/
git commit -m "chore(career-os): cj-oliveyoung-java-backend-prep 폴더 제거 + 통합 smoke 통과"
git push origin main

# run-phases.py가 phase-07 SHA를 index.json에 후기록한 뒤
if [ -n "$(git status --porcelain career-os/tasks/plan005-cj-oliveyoung-decomposition/index.json)" ]; then
  git add career-os/tasks/plan005-cj-oliveyoung-decomposition/index.json
  git commit -m "chore(career-os): plan005 index.json commitSha 후기록"
  git push origin main
fi
```

## 검증 명령 (요약)

```bash
[ ! -d career-os/skills/cj-oliveyoung-java-backend-prep ]
bash -n career-os/skills/command-router/scripts/run_now.sh
[ "$(grep -c 'cj-oliveyoung-java-backend-prep' career-os/skills/command-router/scripts/run_now.sh)" = "0" ]
git log -1 --pretty=%s | grep -q 'cj-oliveyoung-java-backend-prep 폴더 제거\|plan005 index.json commitSha'
```

검증 실패 시 `echo 'PHASE_FAILED: <식>' && exit 1`.

## 커밋

phase-07 자체는 두 커밋을 만든다(2번째는 옵션):

1. `chore(career-os): cj-oliveyoung-java-backend-prep 폴더 제거 + 통합 smoke 통과`
2. `chore(career-os): plan005 index.json commitSha 후기록`(run-phases.py 후기록이 trailing 변경을 남긴 경우에만)

## 범위 외

- plan006(workspace-level `scripts/` 재편)의 작업은 본 plan 끝난 뒤 별도 사이클.
- `data/runtime/cj-foodville-bootcamp-summary.md` 같은 옛 산출물 파일(있다면)은 gitignore 대상이라 working tree에서 자연 소멸. 명시적 git rm 불필요.
- ADR 007a/007b 번호 정리(plan003-2 또는 별도 plan).
