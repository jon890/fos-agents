# Phase 4 — SKILL.md 일괄 갱신 + 빈 skills/<name>/scripts/ 디렉터리 정리

## 목표

11개 skill의 SKILL.md 안에서 "scripts 위치" 또는 "이 skill을 호출할 때" 안내 path를 새 경로(`scripts/<name>/`)로 일괄 갱신. phase-01~03에서 이동된 뒤 빈 채로 남은 `skills/<name>/scripts/` 디렉터리들을 정리(git tracked 파일이 없으므로 자동 사라지나, working tree에 빈 dir 가 남으면 명시적 rmdir).

## 의존성 / 가정

- phase-01~03 완료. 모든 skill의 실행 파일은 `scripts/<name>/`에 있고 dispatcher 14 case path도 새 경로 가리킴.
- working tree clean.

## 작업

### 1. SKILL.md 일괄 path 표기 갱신

대상 11개 SKILL.md:

```
career-os/skills/command-router/SKILL.md
career-os/skills/knowledge-gap-analyzer/SKILL.md
career-os/skills/study-topic-recommender/SKILL.md
career-os/skills/topic-pool-replenisher/SKILL.md
career-os/skills/study-pack-batch/SKILL.md
career-os/skills/study-pack-writer/SKILL.md
career-os/skills/study-pack-maintainer/SKILL.md
career-os/skills/experience-question-bank-writer/SKILL.md
career-os/skills/interview-master-writer/SKILL.md
career-os/skills/position-recommender/SKILL.md
career-os/skills/cj-foodville-coffeechat-prep/SKILL.md
career-os/skills/fos-study-pack/SKILL.md
career-os/skills/docs-audit/SKILL.md (심링크, fos-study 측 진실 출처 — career-os 측 변경 X)
```

각 SKILL.md 안에서:

- `skills/<self-skill>/scripts/<file>` 형태 path → `scripts/<self-skill>/<file>`.
- `skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh` 형태 옛 잔재(있다면) → `scripts/command-router/run_now.sh`.
- "이 skill은 dispatcher의 X 명령으로 호출됩니다" 식 안내가 있다면 dispatcher 경로 `scripts/command-router/run_now.sh`로.

스캔 명령(작업 시작 전):

```bash
grep -rln 'skills/[a-z-]*/scripts/' career-os/skills/ --include='SKILL.md' \
  | grep -v 'docs-audit'  # docs-audit는 심링크라 별도 정책
```

결과의 모든 SKILL.md를 갱신.

추가로 12개 모두에 "실행 파일은 `career-os/scripts/<skill-name>/`(ADR-019)" 한 줄을 일관된 위치(예: SKILL.md 최상단 정보 섹션)에 추가. 이미 있는 경우 skip.

### 2. 빈 skills/<name>/scripts/ 디렉터리 정리

phase-01~03에서 모든 tracked 파일을 git mv로 옮긴 결과, `skills/<name>/scripts/`는 working tree에서 빈 폴더 또는 `__pycache__`만 남은 상태.

```bash
for skill in command-router knowledge-gap-analyzer study-topic-recommender topic-pool-replenisher study-pack-batch study-pack-writer study-pack-maintainer experience-question-bank-writer interview-master-writer position-recommender cj-foodville-coffeechat-prep fos-study-pack; do
  scripts_dir="career-os/skills/$skill/scripts"
  if [ -d "$scripts_dir" ]; then
    # __pycache__ 정리
    rm -rf "$scripts_dir/__pycache__" 2>/dev/null || true
    # 빈 디렉터리만 제거
    rmdir "$scripts_dir" 2>/dev/null || {
      echo "PHASE_FAILED: $scripts_dir 가 비어있지 않음"
      ls -la "$scripts_dir"
      exit 1
    }
  fi
done
```

### 3. 외부 참조 잔재 최종 점검

ai-nodes 전역에 `skills/<name>/scripts/` 패턴 잔재 0 확인(docs / tasks / AGENTS / CLAUDE 제외):

```bash
HITS=$(grep -rln 'skills/[a-z-]*/scripts/' career-os/ \
  --include='*.sh' --include='*.py' --include='*.md' \
  | grep -v 'tasks/' | grep -v 'docs/' | grep -v 'AGENTS.md' | grep -v 'CLAUDE.md')
if [ -n "$HITS" ]; then
  echo "PHASE_FAILED: skills/<name>/scripts/ 잔재"
  echo "$HITS"
  exit 1
fi
```

(docs / tasks / AGENTS / CLAUDE 안의 잔재는 history 보존 + ADR-017/019 컨텍스트 인용으로 의도된 곳.)

## 검증 명령

```bash
# 1. 빈 skills/<name>/scripts/ 디렉터리 없음
[ "$(find career-os/skills -maxdepth 2 -type d -name scripts | wc -l)" = "0" ]

# 2. 각 SKILL.md에 새 경로 안내 존재 (대표 4개 sample)
grep -q 'scripts/command-router' career-os/skills/command-router/SKILL.md
grep -q 'scripts/knowledge-gap-analyzer' career-os/skills/knowledge-gap-analyzer/SKILL.md
grep -q 'scripts/study-topic-recommender' career-os/skills/study-topic-recommender/SKILL.md
grep -q 'scripts/topic-pool-replenisher' career-os/skills/topic-pool-replenisher/SKILL.md

# 3. SKILL.md 안에 skills/<name>/scripts/ 옛 형식 잔재 없음
[ "$(grep -rln 'skills/[a-z-]*/scripts/' career-os/skills/ --include='SKILL.md' | grep -v docs-audit | wc -l)" = "0" ]

# 4. 워크스페이스 코드(sh / py)에 잔재 0
[ -z "$(grep -rln 'skills/[a-z-]*/scripts/' career-os/ --include='*.sh' --include='*.py' | grep -v 'tasks/' | grep -v 'docs/')" ]
```

검증 실패 시 `echo 'PHASE_FAILED: <식>' && exit 1`.

## 커밋

```
refactor(career-os): SKILL.md 일괄 path 갱신 + 빈 skills/<name>/scripts/ 정리

- 11개 SKILL.md의 안내 path를 scripts/<name>/ 형식으로 갱신
- SKILL.md 최상단에 "실행 파일은 scripts/<name>/(ADR-019)" 표기 추가
- phase-01~03 이동 후 비어있던 skills/<name>/scripts/ 디렉터리 정리
- ADR-019 적용의 네 번째 단계
```

## 범위 외

- 통합 smoke / dispatcher 실행 점검(phase-05).
- references 위치는 그대로 `skills/<name>/references/` 유지.
- docs-audit SKILL.md는 fos-study 측 심링크이므로 career-os 측에서 변경 X.
