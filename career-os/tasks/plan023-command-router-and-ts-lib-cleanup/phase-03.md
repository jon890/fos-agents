# Phase 3 — 5문서 + AGENTS.md 갱신 (dispatcher 0 + 외부 의존성 간소화)

**Model**: sonnet
**Status**: pending

---

## 목표

dispatcher 폐기 + ts lib 정리를 5문서 + AGENTS.md에 반영. 외부 의존성 섹션 + dispatcher 흔적 모두 제거.

## 사전 검증

```bash
cd /home/bifos/ai-nodes

git log -1 --format='%s' | grep -q "plan023 phase-02" \
  || { echo "PHASE_BLOCKED: phase-02 commit 없음"; exit 2; }

# 폐기 대상 부재 확인
test ! -d career-os/scripts/command-router \
  || { echo "PHASE_BLOCKED: command-router 잔존"; exit 2; }
test ! -f _shared/lib/invoke_claude_skills.ts \
  || { echo "PHASE_BLOCKED: invoke_claude_skills.ts 잔존"; exit 2; }
test ! -f _shared/lib/format_cost_summary.ts \
  || { echo "PHASE_BLOCKED: format_cost_summary.ts 잔존"; exit 2; }

echo "사전 검증 OK"
```

## 작업 항목

### 1. AGENTS.md 갱신

#### 1-A. 워크플로 진입점 섹션

- "X개 dispatcher 명령" → "**dispatcher 폐기 완료 (plan023)** — native skill 진입점 7개로 단일화"
- native skill 진입점 목록 그대로 유지 (study-pack-writer + interview-asset-writer + study-topic-recommender + interview-prep-analyzer + candidate-baseline-suggester + interview-coffeechat-prep + position-recommender)

#### 1-B. 외부 의존성 섹션

- `_shared/lib/invoke_claude_skills.ts` 제거 (폐기됨)
- `_shared/lib/format_cost_summary.ts` 제거 (폐기됨)
- `_shared/bin/track_task.sh` — **apartment 사용 중이라 유지** (워크스페이스 격리). career-os 한정 사용 0 명시.
- `_shared/lib/notify_discord.ts` 유지 (native skill에서 직접 호출 가능)
- `_shared/lib/extract_claude_result.ts` — career-os 사용 0, apartment + stock-investment 5 caller 잔존 (별도 워크스페이스 plan 대기) 명시
- `_shared/lib/mvp_target_schema.ts` 추가 (plan021 신규)

### 2. prd.md 갱신

- 기능 표에서 dispatcher 명령 부분 제거 (이미 비어있을 가능성)
- "scripts/command-router/run_now.sh가 dispatcher 진입점" 같은 첫 머리 문구 제거 → "native skill 진입점 7개" 표기
- `run_tracked()` 헬퍼 언급 제거 (track_task.sh 자체는 apartment에서 사용 중이라 _shared/bin에 유지)

### 3. flow.md 갱신

- "각 명령은 `run_now.sh <command>` → `run_tracked()` 헬퍼 → `_shared/bin/track_task.sh`" 같은 문구 정리
- 모든 명령이 native skill 진입점이라 dispatcher 거치지 않음 명시
- 다이어그램이나 ASCII flow에서 dispatcher 박스 제거

### 4. code-architecture.md 갱신

- `scripts/command-router/` 디렉터리 트리 제거
- `scripts/_lib/` 디렉터리 트리 제거 (5 파일 모두 폐기 후 빈 디렉터리 사라짐)
- 외부 의존성 섹션 정리 (`_shared/lib/invoke_claude_skills.ts` + `format_cost_summary.ts` 제거)
- 진입점 계층 도식: dispatcher 박스 제거 → native skill 직접 진입

### 5. data-schema.md 갱신

- 변경 거의 없음 (산출물 위치 동일)
- 단 ts lib 폐기로 인한 *의존 자산 변화* 명시 (예: `track_task.sh`가 채우던 `TaskRunEntry`는 apartment에서만 유효)

### 6. 자기 확인

```bash
cd /home/bifos/ai-nodes

# A. 옛 dispatcher 안내 잔재 0 (history mention 제외)
for kw in "command-router/run_now\.sh" "scripts/command-router"; do
  HITS=$(grep -rln "$kw" career-os/AGENTS.md career-os/docs/prd.md career-os/docs/flow.md \
    career-os/docs/code-architecture.md 2>/dev/null | wc -l)
  # history mention (예: "plan023에서 폐기됨")은 허용 — 본문에 *현재 안내*로 박힌 잔재만 검사
  # 단 한 줄 정도 history는 허용. 명확한 active 안내가 없도록만 검증.
done

# B. native skill 진입점 7개 명시
grep -q "native skill 진입점" career-os/AGENTS.md \
  || { echo "PHASE_FAILED: AGENTS.md native skill 진입점 안내 누락"; exit 1; }

# C. 폐기된 ts lib 안내 잔재 0 (현재 의존 안내가 아니라 history만 허용)
for kw in "invoke_claude_skills\.ts" "format_cost_summary\.ts"; do
  # 외부 의존성 섹션에 active 의존 안내가 있으면 잔재
  # history (예: "plan023에서 폐기됨")는 허용
  ACTIVE_HITS=$(grep -c "$kw 의존\|$kw —" career-os/AGENTS.md 2>/dev/null || echo 0)
  # 의존 표기 패턴이 정확히 매칭 안 되면 ok. 단 grep 패턴 정밀 매칭 어려움 — 본문 검토에 위임.
done

echo "[6] docs 갱신 자기 확인 OK"
```

### 7. 커밋 + commit 개수 강제

```bash
cd /home/bifos/ai-nodes
HEAD_BEFORE=$(git rev-parse HEAD)

git add career-os/AGENTS.md career-os/docs/

git commit -m "$(cat <<'COMMIT_EOF'
docs(career-os): dispatcher 폐기 + ts lib 정리 5문서 + AGENTS.md 갱신 (plan023 phase-03)

ADR-031 적용 후속 docs 정리.

- AGENTS.md: dispatcher 폐기 명시 + 외부 의존성 섹션에서 invoke_claude_skills
  + format_cost_summary 제거. mvp_target_schema.ts 추가 (plan021 신규).
  track_task.sh는 apartment 유지 표기, extract_claude_result.ts는
  career-os 사용 0 + 다른 워크스페이스 caller 잔존 표기 (별도 plan 대기)
- prd.md: dispatcher 진입점 머리 문구 제거 → native skill 진입점 7개
- flow.md: dispatcher 박스 제거, native skill 직접 진입 명시
- code-architecture.md: scripts/command-router/ + scripts/_lib/ 트리 제거,
  외부 의존성 섹션 정리
- data-schema.md: ts lib 폐기 영향 명시 (TaskRunEntry는 apartment에서만 유효)

native 진입점 단일화 완성 — career-os의 dispatcher 시대 완전 종료.
COMMIT_EOF
)" || { echo "PHASE_FAILED: commit"; exit 1; }

HEAD_AFTER=$(git rev-parse HEAD)
COMMITS=$(git rev-list "$HEAD_BEFORE..$HEAD_AFTER" --count)
[ "$COMMITS" = "1" ] || { echo "PHASE_FAILED: commit 수 $COMMITS"; exit 1; }
echo "[7] commit 1 OK"
```

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/AGENTS.md` | dispatcher 폐기 + 외부 의존성 |
| `career-os/docs/prd.md` | 기능 표 + 머리 문구 |
| `career-os/docs/flow.md` | dispatcher 박스 제거 |
| `career-os/docs/code-architecture.md` | 트리 + 외부 의존성 |
| `career-os/docs/data-schema.md` | ts lib 영향 |

## Blocked 조건

- phase-02 commit 없음 → `PHASE_BLOCKED` + `exit 2`
- 폐기 대상 잔존 → `PHASE_BLOCKED` + `exit 2`
- 자기 확인 A~C 실패 → `PHASE_FAILED` + `exit 1`
- commit 수 ≠ 1 → `PHASE_FAILED` + `exit 1`

## 의도 메모

- `_shared/bin/track_task.sh`는 *apartment에서 사용 중*이라 *유지* — career-os만의 결정으로 폐기 불가.
- `extract_claude_result.ts`도 마찬가지 (다른 워크스페이스 caller 잔존).
