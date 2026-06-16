# Phase 03 — ② naver-careers 0건 복구 (detail skip 원인 조사·수정 또는 PHASE_BLOCKED)

**Model**: sonnet
**Status**: pending

---

## 목표

`naver-careers` adapter가 listing 후보(annoId·title)는 잡지만, detail 단계에서 전부 skip되어 `accepted=0`이다.
diagnostics는 `naver-careers diagnostics: listing_candidates=N, detail_candidates=M, accepted=0, skipped=M, failed=0` 형태로,
listing/detail HTTP는 성공하는데 `postingFromDetail`이 null을 반환해 모두 skipped로 빠진다.

이 phase는 0건 원인을 조사하고(detail HTML 파싱 실패인지, `isServerRole`/`isNonServerTitle`/active 판정에서 떨어지는지) 수정해
active 서버 공고를 수집하게 만든다. 1회 수집에서 `naver-careers accepted > 0`이 목표다.

**범위 외**:
- 검증 회사군 config 정합(phase-01), 비서버 필터 보강(phase-02)은 건드리지 않는다. policy.ts는 phase-02에서 이미 보강됐을 수 있으므로 import해서 쓰되 정의는 바꾸지 않는다.
- 다른 adapter(toss·coupang·wanted·kakaopay 등)는 건드리지 않는다.
- 신규 adapter 추가는 plan082 책임이라 범위 밖이다.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다. 본 phase는 ai-nodes 루트 기준 path를 쓰므로 첫 bash에서 루트로 고정한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes 저장소 루트 (career-os의 부모)
```

Bash 도구는 같은 phase 안 cwd를 보존한다. Edit는 절대경로/루트 기준 경로라 cwd와 무관하다.

---

## 관련 docs

실행 전 반드시 Read로 현재 본문을 확인한다:
- `career-os/scripts/position-recommender/live-postings/adapters/naver-careers.ts` — listing 추출(`extractListItems`), detail 파싱(`postingFromDetail`), reject 게이트.
- `career-os/scripts/position-recommender/live-postings/policy.ts` — `isServerRole`·`isNonServerTitle`·`isContractRole`·`isExcludedCompany`의 판정 기준(읽기 전용, 수정 금지).

현재 `postingFromDetail`의 reject 게이트 순서(실행 시 재확인한다):
1. `if (!title) return null;`
2. `if (isExcludedCompany(fullText)) return null;`
3. `if (isContractRole(fullText) || /인턴|intern|체험형/i.test(fullText)) return null;`
4. `if (isNonServerTitle(title)) return null;`
5. `if (!isServerRole(fullText)) return null;`

`fullText = title + " " + htmlText(detailHtml)`이다. 0건이면 위 게이트 중 하나가 모든 후보를 떨어뜨리거나, detail HTML이 JS 렌더라 `htmlText`가 의미 있는 본문을 못 뽑아 `isServerRole`이 false가 된다.

---

## 작업 항목 (3)

**반드시 조사 → Edit 도구를 직접 호출한다. prose 응답으로 "고쳤다"고 끝내면 PHASE_FAILED다.**

### 1. 0건 원인 조사 (수정 전 진단)

실제 naver-careers를 1회 수집해 어느 게이트에서 떨어지는지 좁힌다. detail HTML을 직접 fetch해 `htmlText` 결과와 각 게이트 판정을 찍어 본다. 진단 bun 스니펫 예(실행 시 경로·함수명 재확인):

```bash
cd "$(git rev-parse --show-toplevel)"
bun -e '
import { naverCareersAdapter } from "./career-os/scripts/position-recommender/live-postings/adapters/naver-careers.ts";
const r = await naverCareersAdapter.collect();
console.log("note:", naverCareersAdapter.note);
console.log("postings:", r.postings.length);
console.log("errors(head):", r.errors.slice(0, 5));
'
```

게이트별 판정이 필요하면 detail HTML을 fetch해서 `htmlText`·`isServerRole`·`isNonServerTitle`를 개별 호출로 찍는다. 원인을 한 줄로 특정한다(예: "detail이 JS 렌더라 본문 비어 isServerRole=false" 또는 "title만으로 isServerRole 판정 가능한데 fullText 본문 노이즈로 EXCLUDE 키워드 오탐").

### 2. 원인에 맞춰 수정

조사 결과에 따라 `naver-careers.ts`만 최소 수정한다. 가능한 방향(실제 원인에 맞는 것만 적용, 추측 변경 금지):
- detail 본문 추출(`htmlText`)이 비거나 노이즈면 — 추출 정규식/대상 영역을 보정하거나, title 기반 1차 판정으로 서버 공고를 keep하도록 게이트 입력을 조정한다.
- active/postingStatus 판정이 잘못 떨어지면 — 그 로직을 보정한다.
- 게이트 입력(`fullText` vs `title`)이 과도하게 넓어 오탐하면 — `isServerRole` 입력을 적절히 좁히거나 넓힌다.

policy.ts의 공통 판정 함수 정의는 바꾸지 않는다(naver adapter 안에서 입력·추출만 보정). 다른 source에 영향을 주는 변경은 하지 않는다.

### 3. 수정 후 1회 수집으로 accepted > 0 확인

`career-os/data/runtime/`에 임시 출력 파일을 쓰는 1회 수집으로 검증한다(검증 섹션). career-os는 shadow 관찰 기간을 두지 않으므로 즉시 1회 수집으로 검증한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/live-postings/adapters/naver-careers.ts` | detail skip 0건 원인에 맞춘 최소 수정 (추출/게이트 입력/active 판정) |

## 검증

보고 직전 반드시 아래 bash 블록을 Bash 도구로 직접 실행하고 출력 값을 그대로 echo한다.
**검증 명령을 실행하지 않고 "통과"로 추정 보고하면 안 된다.**

```bash
cd "$(git rev-parse --show-toplevel)"
OUT=career-os/data/runtime/plan081-naver-verify.md

# naver-careers만 1회 수집 (네트워크 의존 — 외부 사이트 fetch)
bun career-os/scripts/position-recommender/collect_live_postings.ts \
  --source naver-careers --output "$OUT" 2>&1 | tee /tmp/plan081-naver.log

# diagnostics에서 accepted 수 추출
ACCEPTED=$(grep -oE "naver-careers diagnostics:.*accepted=[0-9]+" /tmp/plan081-naver.log | grep -oE "accepted=[0-9]+" | grep -oE "[0-9]+" | head -1)
echo "[naver-careers accepted] ${ACCEPTED:-미검출}"

# 임시 출력 파일 정리 (산출물 보존 불필요)
rm -f "$OUT"

if [ -z "$ACCEPTED" ]; then
  echo "PHASE_BLOCKED: naver 수집 구조 조사 필요 — diagnostics accepted 미검출 (사이트 구조 변경 또는 fetch 차단 가능)"
  exit 2
fi
if [ "$ACCEPTED" -gt 0 ]; then
  echo "[naver 복구] OK — accepted=$ACCEPTED"
  echo "✅ Phase 03 검증 명령 실행 완료"
else
  echo "PHASE_BLOCKED: naver 수집 구조 조사 필요 — accepted=0 (detail 파싱/active 판정 구조 변경 가능, 억지 통과 금지)"
  exit 2
fi
```

## commit

별도 worktree+branch 실행이므로 commit만 한다. push와 PR은 하지 않는다.
**검증에서 accepted>0을 확인한 경우에만 commit한다. PHASE_BLOCKED로 exit 2한 경우 commit하지 않는다.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/scripts/position-recommender/live-postings/adapters/naver-careers.ts
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
fix(career-os): naver-careers adapter 0건 복구

- detail 단계에서 모든 후보가 skip되던 원인(본문 추출/게이트 입력/active 판정)을 보정
- active 서버 공고를 다시 수집하도록 수정 (accepted>0 확인)

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

- listing은 잡히는데 detail에서 전부 skip되면 수집이 사실상 0이라 추천 입력 가치가 없다. NAVER는 검증 회사군 tier A라 0건은 추천 품질에 직접 타격이다.
- policy.ts 공통 함수를 바꾸지 않고 naver adapter 안에서만 고치는 이유 — 공통 함수는 모든 source가 공유하므로 naver 한 source 복구를 위해 공통 판정을 바꾸면 다른 source에 회귀가 난다. naver 고유의 추출/게이트 입력 문제로 국한해 고친다.
- 복구 불가(사이트 구조 변경·fetch 차단)면 억지로 통과 처리하지 않고 PHASE_BLOCKED로 남긴다. 거짓 accepted는 추천 입력을 오염시킨다(common-pitfalls 6-4 — 검증 우회 추정 success 금지).

## Blocked 조건

- detail HTML이 JS 렌더로 본문을 못 뽑거나 사이트 구조가 바뀌어 1회 수집 후에도 `accepted=0`이거나 diagnostics에서 accepted를 못 찾으면, 억지로 통과시키지 말고 `PHASE_BLOCKED: naver 수집 구조 조사 필요` 출력 후 `exit 2`. 반드시 Bash 도구로 직접 실행한다. (검증 블록이 이 분기를 자동 처리한다 — accepted 미검출/0이면 exit 2.)
- naver-careers.ts에서 `postingFromDetail`/`extractListItems`를 grep으로 못 찾으면(파일 구조 변경) `PHASE_BLOCKED: naver-careers.ts 구조 확인 필요` 출력 후 `exit 2`. 반드시 Bash 도구로 직접 실행한다.
- 외부 사이트 fetch 자체가 네트워크 오류로 불가하면 `PHASE_BLOCKED: naver 사이트 fetch 불가 — 네트워크/차단 확인 필요` 출력 후 `exit 2`. prose만 출력하면 success로 잘못 처리된다.
