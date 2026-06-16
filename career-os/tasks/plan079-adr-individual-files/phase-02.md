# Phase 02 — Bloat ADR 슬림화 + prohibited 토큰 정리

**Model**: sonnet
**Status**: pending

---

## 목표

phase-01이 분해한 개별 ADR 파일 중 30줄 초과 Bloat(약 60건)를 결정/맥락/대안 기각 중심으로 압축한다.
슬림화는 *표현·구조 압축*이지 *결정 근거 삭제가 아니다*. 의도(왜)는 반드시 보존한다.

phase-01이 무손실 분해를 끝냈으므로, 이 phase의 diff는 "표현 압축"만이어야 한다.

**범위 외**:
- 파일 split·INDEX·라우팅 docs(phase-01 완료분)는 건드리지 않는다.
- 전역 스킬(planning·plan-and-build·docs-check) 수정은 phase-03.
- ADR의 status·번호·제목은 바꾸지 않는다. cross-ref `[[ADR-NNN]]` 링크도 유지한다.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes 저장소 루트
```

Edit 도구는 절대경로/루트 기준 경로라 cwd와 무관하다. cwd 고정은 grep/wc/git 검증용이다.

---

## 관련 docs

- `.claude/skills/planning/references/adr-writing.md` — "ADR은 *왜*만, 코드가 *어떻게*의 단일 출처". 변경 이력·코드 블록·파일 목록은 ADR에서 빼고 git history/code-architecture.md가 책임진다는 원칙. 슬림화 기준의 단일 출처다.
- 슬림 ADR 형식 참고: `career-os/docs/adr/INDEX.md`에 가까운 최근 ADR(맥락/결정/결과 3섹션이 간결한 것)을 1~2개 Read해 분량 감을 잡는다.

---

## 작업 항목 (5)

**반드시 Edit/Write 도구를 호출한다. prose 응답으로 "압축했다"고 끝내면 PHASE_FAILED다.**
**이 phase는 본문을 실제로 *줄이는* destructive edit이다. 옛 본문을 남긴 채 안내 문구만 덧붙이는 additive 회피는 슬림화 실패다 — 제거 대상은 실제로 파일에서 사라져야 한다.**

### 1. Bloat 대상 식별

```bash
cd "$(git rev-parse --show-toplevel)"
for f in career-os/docs/adr/ADR-*.md; do
  n=$(wc -l < "$f")
  [ "$n" -gt 30 ] && echo "$n $f"
done | sort -rn
```

출력된 30줄 초과 파일이 슬림화 대상이다(실측 약 60건).

### 2. 각 Bloat ADR 압축 (Edit/Write)

각 대상 파일을 Read한 뒤 다음 기준으로 압축한다:

- **유지(의도)**: 맥락(왜 이 결정이 필요했나), 결정(무엇을 골랐나), 대안 기각(다른 선택지를 왜 버렸나), 결과·영향.
- **제거(구현명세)**:
  - 코드 블록(``` 펜스).
  - 파일 목록이 3개 이상 나열된 부분(어떤 파일을 만들었는지는 git history/code-architecture.md 책임).
  - 단계별 구현 절차(① ~ ② ~ 형태의 실행 순서).
  - 변경 이력·migration 절차 나열.
- 결정 근거가 코드 블록 안에만 있으면 그 근거를 한 문장 산문으로 옮겨 보존한 뒤 코드 블록을 제거한다. 근거를 통째로 날리지 않는다.

압축 후에도 맥락/결정/결과 골격과 핵심 trade-off는 읽힌다.

### 3. prohibited 토큰 정리

career-os adr/ 전체에서 금지 토큰을 정리한다:
- section mark(U+00A7) → "섹션".
- "매트릭스" → "표"(문맥에 맞게 "영향 표"·"변경 표" 등).

대상 파일을 Read 후 Edit로 치환한다.

### 4. 대안 기각 보존 확인

압축한 ADR 각각에 "거절한 대안"/"대안"/"왜 다른 선택을 안 했나"에 해당하는 내용이 한 줄이라도 남아 있는지 스스로 확인한다. 원본에 대안 기각이 있었는데 압축 후 사라졌다면 복원한다.

### 5. 30줄 초과 파일 수 대폭 감소 확인

작업 직후 다시 측정해, 30줄 초과가 의미 있게 줄었는지(목표: 절반 이하) 스스로 확인한다. 일부 ADR은 정당하게 30줄을 넘을 수 있다(대안이 많거나 trade-off가 복잡) — 무리하게 30줄로 맞추느라 의도를 깎지 않는다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/docs/adr/ADR-NNN-slug.md`(30줄 초과 약 60건) | 결정/맥락/대안 기각으로 압축, 코드·파일목록·단계 제거 |

phase-01 산출물 외 다른 파일은 수정하지 않는다.

## 검증

보고 직전 반드시 아래 bash 블록을 Bash 도구로 직접 실행하고 출력 값을 그대로 echo한다.
sigil 문자는 직접 인용하지 않고 escape 변수로 검사한다(common-pitfalls 6-9).

```bash
cd "$(git rev-parse --show-toplevel)"

# 1. 30줄 초과 파일 수 — 작업 후
AFTER=$(for f in career-os/docs/adr/ADR-*.md; do n=$(wc -l < "$f"); [ "$n" -gt 30 ] && echo x; done | wc -l | tr -d ' ')
echo "[30줄 초과 파일 수 (후)] $AFTER"

# 2. 원본(phase-01 직후 = 이 branch 직전 커밋) 대비 감소 확인
#    phase-01 commit 시점의 파일은 git show로 직접 못 세므로, 분해 직후 baseline은 약 60.
#    여기서는 절대 기준으로 30 미만이면 합격으로 본다(대폭 감소).
[ "$AFTER" -lt 30 ] || { echo "FAIL: 30줄 초과가 여전히 많음($AFTER) — 슬림화 부족"; exit 1; }

# 3. section mark(U+00A7) 0건
SIGIL_CHAR=$(printf '\xc2\xa7')
SIGIL_CNT=$(grep -rc "$SIGIL_CHAR" career-os/docs/adr/ 2>/dev/null | awk -F: '{s+=$2} END{print s+0}')
echo "[section mark 잔존] $SIGIL_CNT"
[ "$SIGIL_CNT" = "0" ] || { echo "FAIL: section mark 잔존"; grep -rn "$SIGIL_CHAR" career-os/docs/adr/; exit 1; }

# 4. "매트릭스" 0건
MAT=$(grep -rl "매트릭스" career-os/docs/adr/ 2>/dev/null | wc -l | tr -d ' ')
echo "[매트릭스 잔존 파일] $MAT"
[ "$MAT" = "0" ] || { echo "FAIL: 매트릭스 잔존"; grep -rn "매트릭스" career-os/docs/adr/; exit 1; }

# 5. ADR 파일 수 불변 (슬림화가 파일을 삭제하지 않았나)
FILES=$(ls career-os/docs/adr/ADR-*.md 2>/dev/null | wc -l | tr -d ' ')
ORIG=$(git show HEAD~1:career-os/docs/adr.md 2>/dev/null | grep -cE "^## ADR-" || echo SKIP)
echo "[ADR 파일 수] $FILES  [원본 헤더 수(참고)] $ORIG"
[ "$FILES" -ge 80 ] || { echo "FAIL: ADR 파일이 사라짐($FILES)"; exit 1; }

# 6. cross-ref 링크 보존 — [[ADR- 형태가 존재해야 함(분해 phase가 만든 것)
LINKS=$(grep -rl "\[\[ADR-" career-os/docs/adr/ 2>/dev/null | wc -l | tr -d ' ')
echo "[cross-ref 링크 보유 파일] $LINKS"
[ "$LINKS" -ge 1 ] || { echo "FAIL: cross-ref 링크 소실"; exit 1; }

echo "✅ Phase 02 검증 명령 실행 완료"
```

## commit

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/docs/adr
git diff --cached --stat | tail -5
git commit -q -m "$(cat <<'EOF'
docs(career-os): Bloat ADR 슬림화 + prohibited 토큰 정리

- 30줄 초과 ADR을 결정/맥락/대안 기각으로 압축
- 코드 블록·파일 목록·단계별 구현 절차 제거(git history/code-architecture.md 책임)
- section mark → 섹션, 매트릭스 → 표
- 의도(왜)와 대안 기각은 보존

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
# Write 위장 방어: 이 phase가 실제 commit을 만들었는지 self-check
COMMITS=$(git rev-list HEAD ^HEAD~1 --count)
echo "[이 phase commit 수] $COMMITS"
[ "$COMMITS" -ge 1 ] || { echo "FAIL: commit 미생성 — Edit이 실제 실행 안 됨"; exit 1; }
git log --oneline -1
```

## 의도 메모 (왜)

- ADR은 *왜*의 단일 출처다(adr-writing.md). 코드 블록·파일 목록·단계는 git history와 code-architecture.md가 책임지므로 ADR에 두면 drift와 토큰 낭비만 생긴다.
- 그러나 슬림화로 *대안 기각*을 날리면 후속에서 "왜 다른 선택을 안 했나"를 잃는다 — 이게 ADR의 핵심 가치라 압축이 아니라 손실이다. 그래서 의도 보존을 압축보다 우선한다.
- 30줄을 절대 상한으로 보지 않는 이유 — 일부 결정은 정당하게 길다. 기계적 줄 맞춤이 목표가 아니라 noise 제거가 목표다.

## Blocked 조건

- 특정 ADR이 코드 블록 안에만 결정 근거를 담고 있어 산문으로 옮기면 의미가 모호해지는 경우, 그 ADR만 압축을 보류하고 나머지를 진행한다. 전체가 막히면 `PHASE_BLOCKED: <ADR> 근거가 코드 블록 의존 — 슬림화 시 의미 손실` 출력 후 `exit 2`. 반드시 Bash 도구로 직접 실행한다.
- 슬림화로 30줄 초과가 충분히 줄지 않으면(검증 2번 실패) `PHASE_FAILED: 슬림화 부족` 출력 후 `exit 1`. 반드시 Bash 도구로 직접 실행한다. prose만 출력하면 success로 잘못 처리된다.
