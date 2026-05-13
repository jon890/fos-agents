# Phase 5 — 통합 smoke + 잔재 grep + push + trailing cleanup

## 목표

phase-01~04 통과 후 14개 dispatch 명령 전체 syntax + dispatcher path 일관성 검증. dispatcher smoke 1회 실행으로 새 구조의 동작 확인. 마지막 phase이므로 trailing working tree 변경을 정리해서 push.

## 의존성 / 가정

- phase-01~04 모두 `status: completed`.
- working tree clean.
- 본 phase 끝나면 `skills/<name>/scripts/`는 어디에도 존재하지 않고, 모든 실행 파일은 `career-os/scripts/<name>/`에 있다.

## 작업

### 1. dispatcher 파일 정합성 통합 검사

```bash
# dispatcher syntax + 14개 case 모두 존재 + 잔재 0
bash -n career-os/scripts/command-router/run_now.sh

# cj-oliveyoung 잔재는 의도된 곳(docs / tasks / AGENTS) 외에 0
HITS=$(grep -rln 'cj-oliveyoung-java-backend-prep' career-os/ \
  --include='*.sh' --include='*.py' --include='*.json' \
  | grep -v 'tasks/' | grep -v 'docs/' | grep -v 'AGENTS.md' | grep -v 'CLAUDE.md')
if [ -n "$HITS" ]; then
  echo "PHASE_FAILED: cj-oliveyoung 코드 잔재"; echo "$HITS"; exit 1
fi

# 14개 case 헤더 모두 존재
for case in baseline daily recommend-positions recommend-topics replenish-topics study-pack maintain-study-pack question-bank master foodville-coffeechat smoke bootcamp-batch live-coding-dispatch auto-question-bank; do
  grep -qE "^  ${case}\)" career-os/scripts/command-router/run_now.sh \
    || { echo "PHASE_FAILED: dispatcher에 ${case} case 없음"; exit 1; }
done

# 모든 dispatcher case가 scripts/<name>/ 형식 가리킴 (skills/<name>/scripts/ 잔재 0)
[ "$(grep -c 'skills/[a-z-]*/scripts/' career-os/scripts/command-router/run_now.sh)" = "0" ]
```

### 2. 전체 skill scripts/ syntax 통합 통과

```bash
fail=0
for f in career-os/scripts/*/*.sh; do
  bash -n "$f" || { echo "FAIL: $f"; fail=1; }
done
for f in career-os/scripts/*/*.py; do
  python3 -m py_compile "$f" || { echo "FAIL: $f"; fail=1; }
done
if [ $fail -ne 0 ]; then echo "PHASE_FAILED: syntax"; exit 1; fi
```

### 3. workspace-level 잔재 최종 grep

```bash
# 워크스페이스 전역에 skills/<name>/scripts/ 패턴 잔재 0 (docs / tasks / AGENTS / CLAUDE 제외)
HITS=$(grep -rln 'skills/[a-z-]*/scripts/' career-os/ \
  --include='*.sh' --include='*.py' --include='*.md' --include='*.json' \
  | grep -v 'tasks/' | grep -v 'docs/' | grep -v 'AGENTS.md' | grep -v 'CLAUDE.md' \
  | grep -v 'sources/fos-study')
if [ -n "$HITS" ]; then
  echo "PHASE_FAILED: skills/<name>/scripts/ 잔재"
  echo "$HITS"
  exit 1
fi
```

### 4. dispatcher smoke 1회 실행

```bash
bash career-os/scripts/command-router/run_now.sh smoke
```

`smoke` case는 knowledge-gap-analyzer의 `run_smoke_test.sh`를 호출. 실패 시 `PHASE_FAILED: smoke` + exit 1.

### 5. 빈 디렉터리 최종 점검

```bash
[ "$(find career-os/skills -maxdepth 2 -type d -name scripts | wc -l)" = "0" ]
```

### 6. push + trailing cleanup

```bash
git add career-os/
git commit -m "chore(career-os): ADR-019 통합 smoke 통과 + skills/<name>/scripts/ 정리 완료"
git push origin main

# run-phases.py가 phase-05 SHA를 index.json에 후기록한 뒤
if [ -n "$(git status --porcelain career-os/tasks/plan006-workspace-scripts-restructure/index.json)" ]; then
  git add career-os/tasks/plan006-workspace-scripts-restructure/index.json
  git commit -m "chore(career-os): plan006 index.json commitSha 후기록"
  git push origin main
fi
```

## 검증 명령 (요약)

```bash
[ "$(find career-os/skills -maxdepth 2 -type d -name scripts | wc -l)" = "0" ]
bash -n career-os/scripts/command-router/run_now.sh
[ "$(grep -c 'skills/[a-z-]*/scripts/' career-os/scripts/command-router/run_now.sh)" = "0" ]
git log -1 --pretty=%s | grep -q 'ADR-019 통합 smoke\|plan006 index.json commitSha'
```

검증 실패 시 `echo 'PHASE_FAILED: <식>' && exit 1`.

## 커밋

phase-05 자체는 두 커밋(2번째는 옵션):

1. `chore(career-os): ADR-019 통합 smoke 통과 + skills/<name>/scripts/ 정리 완료`
2. `chore(career-os): plan006 index.json commitSha 후기록`(run-phases.py 후기록이 trailing 변경 남긴 경우)

## 범위 외

- 다른 워크스페이스(apartment 등)의 `skills/<name>/scripts/` 패턴 — ai-nodes/CLAUDE.md 컨벤션상 그대로 유지(ADR-019는 career-os 한정).
- ADR 007a/007b 번호 정리(별도 plan).
- `data/runtime/` 안의 옛 로그 / 잠금 파일 정리는 gitignore 대상이라 자연 소멸.
