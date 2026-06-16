# Phase 02 — ① 비서버 필터 보강 (policy.ts NON_SERVER_TITLE_KEYWORDS에 product owner·compensation 추가)

**Model**: sonnet
**Status**: pending

---

## 목표

position-recommender 수집에서 비서버 직무가 일부 통과한다.
`NON_SERVER_TITLE_KEYWORDS`에 `po`·`pm`이 있지만 substring 매칭이라 "Product Owner"를 잡지 못한다("product owner" 문자열에 `po` 인접 시퀀스가 없다).
또 보상 직무("Global Compensation Manager")를 거르는 키워드가 없다.

이 phase는 `policy.ts`의 `NON_SERVER_TITLE_KEYWORDS`에 `product owner`·`compensation`을 추가해
"토스 Product Owner"·"Global Compensation Manager" 같은 비서버 직무가 `isNonServerTitle`로 reject되게 한다.
서버 직무(백엔드/플랫폼/AI 플랫폼)는 그대로 keep돼야 한다.

**범위 외**:
- 검증 회사군 config 정합(phase-01 책임)은 건드리지 않는다.
- naver-careers.ts adapter(phase-03 책임)는 건드리지 않는다.
- `isServerRole`·`classify`·`SERVER_KEYWORDS`·`EXCLUDE_NON_SERVER_KEYWORDS`는 이번 변경 대상이 아니다. `NON_SERVER_TITLE_KEYWORDS` 배열에만 항목을 추가한다.

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
- `career-os/scripts/position-recommender/live-postings/policy.ts` — `NON_SERVER_TITLE_KEYWORDS` 배열(현재 22번 줄 근처)과 `isNonServerTitle`(현재 99번 줄 근처) 함수.

현재 `isNonServerTitle`은 `hasKeyword(text, NON_SERVER_TITLE_KEYWORDS)`로, 키워드를 소문자 substring 매칭한다.
`po`·`pm`이 있지만 "Product Owner"는 매칭 안 된다("product owner"에 `po` 인접 없음). `compensation`은 목록에 없다.

---

## 작업 항목 (1)

**반드시 Edit 도구를 직접 호출한다. prose 응답으로 "추가했다"고 끝내면 PHASE_FAILED다.**

### 1. NON_SERVER_TITLE_KEYWORDS에 product owner·compensation 추가

`career-os/scripts/position-recommender/live-postings/policy.ts`의 `NON_SERVER_TITLE_KEYWORDS` 배열에 두 키워드를 추가한다:
- `"product owner"` — "Product Owner"류 직무를 reject. 기존 `"product manager"` 옆(기획 직무 줄)에 둔다.
- `"compensation"` — "Global Compensation Manager"류 보상 직무를 reject. 기존 "채용·인사" 또는 "재무·회계" 그룹 주석 근처에 둔다(보상은 인사 영역이므로 "채용·인사" 그룹 권장).

기존 항목 순서·주석·다른 배열은 보존한다. `NON_SERVER_TITLE_KEYWORDS` 배열에만 두 문자열을 추가한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/live-postings/policy.ts` | `NON_SERVER_TITLE_KEYWORDS`에 `product owner`·`compensation` 추가 |

## 검증

보고 직전 반드시 아래 bash 블록을 Bash 도구로 직접 실행하고 출력 값을 그대로 echo한다.
**검증 명령을 실행하지 않고 "통과"로 추정 보고하면 안 된다.**

```bash
cd "$(git rev-parse --show-toplevel)"
POLICY=career-os/scripts/position-recommender/live-postings/policy.ts

# 1. 두 키워드가 배열에 존재
grep -qF '"product owner"' "$POLICY" && echo "[product owner 추가] OK" || { echo "FAIL: product owner 누락"; exit 1; }
grep -qF '"compensation"' "$POLICY" && echo "[compensation 추가] OK" || { echo "FAIL: compensation 누락"; exit 1; }

# 2. isNonServerTitle 동작 검증 — 비서버 reject + 서버 keep
bun -e '
import { isNonServerTitle } from "./career-os/scripts/position-recommender/live-postings/policy.ts";
const reject = ["토스 Product Owner", "Global Compensation Manager"];
const keep = ["서버 개발자", "Backend Engineer", "AI 플랫폼 엔지니어"];
let fail = 0;
for (const t of reject) { const r = isNonServerTitle(t); console.log(`[reject 기대] ${t} -> ${r}`); if (!r) { console.log(`FAIL: ${t} reject 안 됨`); fail = 1; } }
for (const t of keep) { const r = isNonServerTitle(t); console.log(`[keep 기대] ${t} -> nonServer=${r}`); if (r) { console.log(`FAIL: ${t} 잘못 reject됨`); fail = 1; } }
if (fail) process.exit(1);
console.log("[isNonServerTitle 동작] OK");
'
[ "$?" = "0" ] || { echo "FAIL: isNonServerTitle 동작 검증 실패"; exit 1; }

echo "✅ Phase 02 검증 명령 실행 완료"
```

## commit

별도 worktree+branch 실행이므로 commit만 한다. push와 PR은 하지 않는다.

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/scripts/position-recommender/live-postings/policy.ts
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
fix(career-os): position 비서버 필터에 product owner·compensation 추가

- NON_SERVER_TITLE_KEYWORDS에 "product owner" 추가
  (기존 po·pm은 substring 매칭이라 "Product Owner"를 못 잡음)
- "compensation" 추가로 Global Compensation Manager류 보상 직무 reject
- 서버/백엔드/AI 플랫폼 직무는 그대로 keep

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

- `po`·`pm`은 짧은 약어라 false positive를 피하려 짧게 둔 것이지만, 정작 정식 명칭 "Product Owner"를 못 잡는다("product owner"에 `po` 인접 시퀀스 없음). 긴 정식 명칭 `product owner`를 명시적으로 추가하는 게 안전하다(다른 단어 오탐 위험 낮음).
- `compensation`은 보상/HR 직무 신호로 충분히 특이해 false positive 위험이 낮다. Global Compensation Manager류를 한 키워드로 거른다.
- `NON_SERVER_TITLE_KEYWORDS`는 모든 adapter가 공유하는 공통 필터라, 여기 한 줄 추가로 toss·coupang·naver 등 전 source가 혜택을 본다.

## Blocked 조건

- `policy.ts`에서 `NON_SERVER_TITLE_KEYWORDS` 배열을 grep으로 못 찾으면(파일 구조 변경 등) `PHASE_BLOCKED: NON_SERVER_TITLE_KEYWORDS 배열 부재 — policy.ts 구조 확인 필요` 출력 후 `exit 2`. 반드시 Bash 도구로 직접 실행한다.
- 검증에서 reject 기대 직무가 keep되거나 서버 직무가 잘못 reject되면 `PHASE_FAILED: 비서버 필터 동작 미달` 출력 후 `exit 1`. 반드시 Bash 도구로 직접 실행한다. prose만 출력하면 success로 잘못 처리된다.
