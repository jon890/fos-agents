# Phase 1 — tsconfig 확장 + career-os/scripts/_lib 신설 + 3개 헬퍼 git mv

**Model**: sonnet
**Status**: pending

---

## 목표

ai-nodes ADR-001 정책을 적용해 `_shared/lib`에 잘못 들어간 career-os 한정 헬퍼 3개를 `career-os/scripts/_lib/`로 이동. 이 phase는 *파일 이동 + tsconfig 확장*만. caller 갱신은 phase-02/03.

**범위 외**: caller 갱신 (phase-02/03), 통합 smoke (phase-04).

## 관련 docs (실행 전 필수 읽기)

- `docs/adr.md` ai-nodes ADR-001 — 본 plan의 결정 출처. `_shared/lib`는 워크스페이스 무관 헬퍼만, 워크스페이스 한정은 `<ws>/scripts/_lib/`.
- `career-os/docs/code-architecture.md` 디렉터리 트리 — `scripts/_lib/` 신설 위치 확인.

## 사전 검증 (실행 시작 시)

```bash
cd /home/bifos/ai-nodes

# 1-A. 3개 mv 대상 파일 _shared/lib에 존재 확인
for f in build_prompt study_pack_publish fos_study_git; do
  test -f "_shared/lib/${f}.ts" || { echo "PHASE_BLOCKED: _shared/lib/${f}.ts 없음 — plan010 미완 상태"; exit 2; }
done

# 1-B. career-os/scripts/_lib/ 미존재 확인 (이미 있으면 부분 실행 잔재 의심)
[ ! -d career-os/scripts/_lib ] || { echo "PHASE_FAILED: career-os/scripts/_lib/ 이미 존재 — 부분 실행 잔재"; exit 1; }

echo "사전 검증 OK"
```

## 작업 항목

### 1. `career-os/scripts/_lib/` 디렉터리 신설

```bash
cd /home/bifos/ai-nodes
mkdir -p career-os/scripts/_lib
```

### 2. `tsconfig.json` 갱신

기존:
```json
"paths": {
  "@shared/lib/*": ["./_shared/lib/*"],
  "@shared/types/*": ["./_shared/types/*"]
},
"include": ["_shared/**/*.ts"]
```

→ 변경:
```json
"paths": {
  "@shared/lib/*": ["./_shared/lib/*"],
  "@shared/types/*": ["./_shared/types/*"],
  "@career-os/_lib/*": ["./career-os/scripts/_lib/*"]
},
"include": ["_shared/**/*.ts", "career-os/scripts/**/*.ts"]
```

Edit으로 `paths`와 `include` 두 키 갱신.

검증:
```bash
python3 -c "import json; t=json.load(open('tsconfig.json')); ps=t['compilerOptions']['paths']; assert '@career-os/_lib/*' in ps, 'path alias 누락'; assert any('career-os/scripts' in inc for inc in t['include']), 'include 미확장'; print('tsconfig OK')" \
  || { echo "PHASE_FAILED: tsconfig 갱신 미흡"; exit 1; }
```

### 3. 3개 헬퍼 `git mv`

```bash
cd /home/bifos/ai-nodes
git mv _shared/lib/build_prompt.ts        career-os/scripts/_lib/build_prompt.ts
git mv _shared/lib/study_pack_publish.ts  career-os/scripts/_lib/study_pack_publish.ts
git mv _shared/lib/fos_study_git.ts       career-os/scripts/_lib/fos_study_git.ts
```

### 4. mv 후 자체 import 검증

study_pack_publish.ts가 fos_study_git.ts를 같은 디렉터리 상대경로로 import하는지 확인. 옛 위치 기준이라면 상대경로(`./fos_study_git`)는 자동 유지 — 단 `_shared/lib/`나 `@shared/lib/` 절대 import는 갱신 필요.

```bash
cd /home/bifos/ai-nodes
for f in career-os/scripts/_lib/{build_prompt,study_pack_publish,fos_study_git}.ts; do
  # 절대 import _shared/lib/{본 3개 헬퍼} 잔재 검색 (자기 자신 가리키는 옛 경로)
  for h in build_prompt study_pack_publish fos_study_git; do
    grep -q "_shared/lib/${h}\|@shared/lib/${h}" "$f" && { echo "PHASE_FAILED: $f 안 옛 위치 import 잔재 ($h)"; exit 1; }
  done
done
echo "헬퍼 간 import OK"
```

발견되면 Edit으로 새 경로로 갱신 (예: `from "@shared/lib/fos_study_git"` → `from "./fos_study_git"` 또는 `from "@career-os/_lib/fos_study_git"`).

### 5. tsc 검증

```bash
cd /home/bifos/ai-nodes
bunx tsc --noEmit 2>&1 | tee /tmp/plan010-2-phase01-tsc.log
# caller가 아직 옛 경로 호출하므로 tsc에러는 caller 측 import에서만 발생 가능 — 본 phase는 헬퍼 *내부* tsc만 검사
# 만약 caller가 _shared/lib import (절대) 사용 중이면 tsc는 통과(파일 없어도 path resolution 그대로) 또는 실패
# 기준: 본 phase 후 tsc 결과를 logging만 하고 phase-02/03이 정리. 단 _shared/lib/ 안 잔존 헬퍼 tsc 자체는 통과해야
test ! -e _shared/lib/build_prompt.ts || { echo "PHASE_FAILED: _shared/lib/build_prompt.ts 잔존"; exit 1; }
test ! -e _shared/lib/study_pack_publish.ts || { echo "PHASE_FAILED: _shared/lib/study_pack_publish.ts 잔존"; exit 1; }
test ! -e _shared/lib/fos_study_git.ts || { echo "PHASE_FAILED: _shared/lib/fos_study_git.ts 잔존"; exit 1; }
echo "옛 위치 잔존 0건 OK"
```

## Critical Files

| 파일 | 변경 |
|---|---|
| `tsconfig.json` | paths + include 확장 |
| `_shared/lib/build_prompt.ts` → `career-os/scripts/_lib/build_prompt.ts` | git mv |
| `_shared/lib/study_pack_publish.ts` → `career-os/scripts/_lib/study_pack_publish.ts` | git mv |
| `_shared/lib/fos_study_git.ts` → `career-os/scripts/_lib/fos_study_git.ts` | git mv |
| (헬퍼 안 자체 import) | 필요 시 Edit |

caller 갱신은 phase-02/03 책임.

## 커밋

```bash
cd /home/bifos/ai-nodes
git add tsconfig.json career-os/scripts/_lib/ _shared/lib/
git commit -m "refactor(ai-nodes): _shared/lib career-os 한정 헬퍼 3개를 career-os/scripts/_lib/로 git mv (plan010-2 phase-01)

ai-nodes ADR-001 적용. plan010 phase-02/03/04가 잘못된 위치(_shared/lib)에
넣은 career-os 한정 헬퍼 3개를 워크스페이스 격리 원칙에 맞게 이동.

- _shared/lib/build_prompt.ts → career-os/scripts/_lib/build_prompt.ts
- _shared/lib/study_pack_publish.ts → career-os/scripts/_lib/study_pack_publish.ts
- _shared/lib/fos_study_git.ts → career-os/scripts/_lib/fos_study_git.ts
- tsconfig.json paths(@career-os/_lib/*) + include(career-os/scripts/**/*.ts) 확장

caller 갱신은 phase-02/03."
```

push는 phase-04.

## 검증

```bash
cd /home/bifos/ai-nodes

# 1. 3개 새 위치에 존재 + 실행 권한
for f in career-os/scripts/_lib/{build_prompt,study_pack_publish,fos_study_git}.ts; do
  test -f "$f" || { echo "PHASE_FAILED: $f 누락"; exit 1; }
  test -x "$f" || { echo "PHASE_FAILED: $f 실행 권한"; exit 1; }
done

# 2. 옛 위치 0건
for f in _shared/lib/{build_prompt,study_pack_publish,fos_study_git}.ts; do
  test ! -e "$f" || { echo "PHASE_FAILED: $f 잔존"; exit 1; }
done

# 3. tsconfig
python3 -c "
import json
t = json.load(open('tsconfig.json'))
assert '@career-os/_lib/*' in t['compilerOptions']['paths'], 'path alias 누락'
includes = t.get('include', [])
assert any('career-os/scripts' in i for i in includes), 'include 미확장'
print('tsconfig OK')
" || { echo "PHASE_FAILED: tsconfig 검증"; exit 1; }

# 4. 헬퍼 간 절대 import 잔재 0건
for f in career-os/scripts/_lib/{build_prompt,study_pack_publish,fos_study_git}.ts; do
  for h in build_prompt study_pack_publish fos_study_git; do
    grep -q "_shared/lib/${h}\|@shared/lib/${h}" "$f" && { echo "PHASE_FAILED: $f 안 옛 import 잔재 ($h)"; exit 1; } || true
  done
done

echo "phase-01 검증 통과"
```

## Blocked 조건

**중요 — exit code 명시**: 아래 어느 마커든 출력만 하지 말고 반드시 `sys.exit(1)` (FAILED) 또는 `sys.exit(2)` (BLOCKED) — shell에서는 `exit 1` / `exit 2` — 비-0 exit code로 종료. 본 phase의 모든 검증 bash 블록은 반드시 Bash 도구로 직접 실행 (prose로 마커만 출력하면 run-phases.py가 success로 잘못 처리 — plan001/plan004 사례).

- `_shared/lib/<3개 헬퍼>` 부재 → `PHASE_BLOCKED: plan010 미완` + `exit 2`
- `career-os/scripts/_lib/` 이미 존재 → `PHASE_FAILED: 부분 실행 잔재` + `exit 1`
- tsconfig 갱신 검증 실패 → `PHASE_FAILED: tsconfig` + `exit 1`
- git mv 후 검증 실패 → `PHASE_FAILED: mv` + `exit 1`

## 의도 메모

- git mv는 destructive 같지만 git 추적이라 안전 (commit 안 하면 rollback OK).
- tsconfig 갱신은 caller 영향 없음 — 새 alias는 phase-02/03에서 caller가 import 시 사용 (optional).
- caller가 `bun run` 절대 경로로 부르면 alias 없이도 동작. alias는 미래 TS runner(plan011 후) 도입 시 유용.
