# Phase 02 — ① 공유 서버 필터 강화 (policy.ts NON_SERVER_TITLE_KEYWORDS / isServerRole)

**Model**: sonnet
**Status**: pending

---

## 목표

position-recommender 실제 호출 평가에서, toss snapshot 85건 중
Legal Counsel·Strategic Finance Manager·Security Engineer·KYC/AML/Privacy Manager·SAP Developer·Technical Writer·Recruiting Partner 등
**서버 무관 직무가 필터를 통과**했다.

원인: 이 비개발 직무 키워드가 `policy.ts`의 공유 `NON_SERVER_TITLE_KEYWORDS`에 없고,
`isServerRole`이 넓은 fullText에서 서버 키워드("platform", "finance" 도메인 단어 등)에 매칭돼 통과시킨다.

핵심: 필터를 **공유 `policy.ts`** 에 두면 toss·wanted·coupang·kakao 등 이 모듈을 쓰는 모든 adapter가 동시에 혜택을 본다.
adapter 개별 파일을 고치지 않고 `NON_SERVER_TITLE_KEYWORDS` 확장 + 필요 시 `isServerRole` 보강으로 해결한다.

**범위 외**:
- SKILL.md/prompt.md 문서(phase-01 완료분)는 건드리지 않는다.
- 태그 키워드 정교화(`classify`)는 phase-03 책임이다.
- JD detail fetch 보강은 phase-04 책임이다.
- adapter 파일(toss.ts 등)은 수정하지 않는다 — 이미 공유 `isNonServerTitle`/`isServerRole`을 호출하므로 policy.ts만 고치면 된다.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes 저장소 루트
```

Edit 도구는 절대경로/루트 기준 경로라 cwd와 무관하다. cwd 고정은 grep/bun 검증용이다.

---

## 관련 docs

실행 전 반드시 Read한다:
- `career-os/scripts/position-recommender/live-postings/policy.ts` — `NON_SERVER_TITLE_KEYWORDS`, `SERVER_KEYWORDS`, `AI_PLATFORM_ROLE_KEYWORDS`, `EXCLUDE_NON_SERVER_KEYWORDS`, `isServerRole`, `isNonServerTitle`, `hasKeyword`.
- `career-os/scripts/position-recommender/live-postings/adapters/toss.ts` — `postingFromTossApiJob`이 `isNonServerTitle(title)`로 먼저 reject하고, 통과하면 `isServerRole(fullText)`로 reject하는 2단 구조 확인.

현재 `NON_SERVER_TITLE_KEYWORDS`(실행 시 재확인)는 기획·디자이너·QA·frontend·android·ios·data engineer·data scientist·ai research·마케터·assistant·정책·e/e·데이터 라벨링 위주이고,
평가에서 통과한 legal/counsel/finance/accounting/audit/privacy/kyc/aml/recruiting/hr/sap/technical writer/strategy manager/business analyst/operations manager 류가 빠져 있다.

---

## 작업 항목 (4)

**반드시 Edit 도구를 직접 호출한다. prose 응답으로 "강화했다"고 끝내면 PHASE_FAILED다.**

### 1. NON_SERVER_TITLE_KEYWORDS 확장

`career-os/scripts/position-recommender/live-postings/policy.ts`의 `NON_SERVER_TITLE_KEYWORDS` 배열에
평가에서 통과한 비개발 직무 키워드를 추가한다. 최소 아래를 포함하되, title 기준으로 매칭되는 표현을 쓴다(영문 소문자 + 한국어 병기):

- legal / counsel / 법무 / 변호사
- finance / financial / 재무 / accounting / 회계 / audit / 감사
- privacy / kyc / aml / 준법 / compliance
- recruiting / recruiter / 채용 / hr / 인사 / people / talent
- sap
- technical writer / 테크니컬 라이터
- strategy manager / strategic finance / 전략
- business analyst / 비즈니스 애널리스트
- operations manager / 운영 매니저 (단 server operations / SRE / DevOps 운영과 충돌하지 않게 title 표현 주의)

주의: `NON_SERVER_TITLE_KEYWORDS`는 **title 기준** reject다. "operations" 단독 추가는 server operations/SRE를 오탐할 수 있으므로 "operations manager" 같은 복합 표현으로 좁힌다. "finance"는 도메인(fintech 회사)과 직무(finance manager)를 혼동할 수 있으나, 이 배열은 *title* 매칭이므로 "Strategic Finance Manager" 같은 직무 title을 잡는 용도다 — 회사 도메인 fullText에는 적용되지 않는다(`isNonServerTitle`은 title만 받는다).

### 2. 개발 직무 보존 확인 (오탐 방지)

추가한 키워드가 Server/Backend Engineer·AI/ML Platform Engineer·DevOps/SRE·Platform Engineer 같은 정상 서버 직무 title을 잘못 reject하지 않는지 확인한다.
특히 "security"는 "Security Engineer"(비추천 대상) 대 "platform security" 같은 서버 보안 사이에서 판단이 갈린다.
평가에서 문제가 된 것은 "Security Engineer"(애플리케이션/정보보안 직무)이므로 title에 "security engineer"가 단독으로 오면 reject하되, "backend"/"server"/"platform" 같은 서버 키워드가 함께 있으면 `isServerRole`이 살리도록 한다. 판단이 모호하면 NON_SERVER_TITLE_KEYWORDS에 "security engineer"를 넣지 말고 `isServerRole`/`EXCLUDE_NON_SERVER_KEYWORDS` 보강으로 처리한다.

### 3. isServerRole 보강 (필요 시)

title reject로 충분하지 않은 케이스(title은 중립적인데 JD 전체가 비개발)는 `isServerRole` 또는 `EXCLUDE_NON_SERVER_KEYWORDS`를 보강한다.
단 `isServerRole`은 fullText(회사·카테고리·JD 포함)를 받으므로, 회사 도메인 단어(finance/bank 등)로 reject하면 정상 서버 공고까지 떨어진다.
따라서 fullText 기반 추가 reject는 *직무를 가리키는 표현*("legal counsel", "recruiting partner" 같은 명확한 직무구)에 한정하고, 회사 도메인 단어로 reject하지 않는다.
이 작업이 오탐 위험이 크면 생략하고 1번(title 키워드)만으로 끝낸다 — 1번이 평가 케이스 대부분을 커버한다.

### 4. bun으로 필터 동작 즉시 검증

career-os는 shadow 관찰 기간을 두지 않는다. 변경 후 즉시 비서버 title 샘플 배열로 reject 여부를 확인한다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun -e '
import { isNonServerTitle, isServerRole } from "./career-os/scripts/position-recommender/live-postings/policy.ts";
const nonServer = ["Legal Counsel","Strategic Finance Manager","Security Engineer","KYC/AML/Privacy Manager","SAP Developer","Technical Writer","Recruiting Partner","Business Analyst","Operations Manager"];
const server = ["Backend Engineer","Server Developer","Platform Engineer","DevOps Engineer","AI Platform Engineer","SRE"];
let bad = 0;
for (const t of nonServer) { const rejected = isNonServerTitle(t) || !isServerRole(t); console.log((rejected?"REJECT":"PASS ")+" | "+t); if (!rejected) bad++; }
console.log("---");
for (const t of server) { const kept = !isNonServerTitle(t) && isServerRole(t); console.log((kept?"KEEP  ":"DROP  ")+" | "+t); if (!kept) bad++; }
console.log("BAD="+bad);
'
```

비서버 title이 PASS로 남거나 서버 title이 DROP되면 `BAD`가 0이 아니다. 검증 섹션에서 `BAD=0`을 강제한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/live-postings/policy.ts` | `NON_SERVER_TITLE_KEYWORDS` 비개발 직무 키워드 확장, 필요 시 `isServerRole`/`EXCLUDE_NON_SERVER_KEYWORDS` 보강 |

adapter 파일(toss.ts 등)은 수정하지 않는다 — 공유 함수를 호출하므로 policy.ts 변경만으로 모든 adapter가 혜택.

## 검증

보고 직전 반드시 아래 bash 블록을 Bash 도구로 직접 실행하고 출력 값을 그대로 echo한다.

```bash
cd "$(git rev-parse --show-toplevel)"
POLICY=career-os/scripts/position-recommender/live-postings/policy.ts

# 1. 타입체크 (bun 또는 tsc — 우선 bun으로 모듈 로드)
bun -e 'import("./career-os/scripts/position-recommender/live-postings/policy.ts").then(()=>console.log("[모듈 로드] OK")).catch(e=>{console.error("FAIL: 모듈 로드",e);process.exit(1)})'

# 2. 필터 동작 — 비서버 reject + 서버 keep
RESULT=$(bun -e '
import { isNonServerTitle, isServerRole } from "./career-os/scripts/position-recommender/live-postings/policy.ts";
const nonServer = ["Legal Counsel","Strategic Finance Manager","KYC/AML/Privacy Manager","SAP Developer","Technical Writer","Recruiting Partner"];
const server = ["Backend Engineer","Server Developer","Platform Engineer","DevOps Engineer","AI Platform Engineer"];
let bad = 0;
for (const t of nonServer) { const rejected = isNonServerTitle(t) || !isServerRole(t); if (!rejected) bad++; }
for (const t of server) { const kept = !isNonServerTitle(t) && isServerRole(t); if (!kept) bad++; }
console.log("BAD="+bad);
')
echo "[필터 검증] $RESULT"
echo "$RESULT" | grep -q "BAD=0" || { echo "FAIL: 필터가 비서버 통과 또는 서버 탈락"; exit 1; }

# 3. 신규 키워드 흔적 (legal·finance·recruiting·sap 계열이 배열에 들어갔는지)
HITS=$(grep -ciE "legal|counsel|finance|recruiting|sap|technical writer|kyc|aml" "$POLICY")
echo "[policy.ts 신규 키워드 등장 줄 수] $HITS"
[ "$HITS" -ge 1 ] || { echo "FAIL: 신규 키워드 미반영"; exit 1; }

echo "✅ Phase 02 검증 명령 실행 완료"
```

## commit

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/scripts/position-recommender/live-postings/policy.ts
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
fix(career-os): position-recommender 공유 서버 필터에 비개발 직무 키워드 보강

- policy.ts NON_SERVER_TITLE_KEYWORDS에 legal/finance/recruiting/sap/kyc-aml/
  technical writer/strategy/business analyst/operations manager 등 추가
- 공유 모듈 수정이라 toss/wanted/coupang/kakao 모든 adapter가 동시 적용
- 서버/백엔드/AI Platform/DevOps 직무는 isServerRole로 보존

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
COMMITS=$(git rev-list HEAD ^HEAD~1 --count)
echo "[이 phase commit 수] $COMMITS"
[ "$COMMITS" -ge 1 ] || { echo "FAIL: commit 미생성 — Edit이 실제 실행 안 됨"; exit 1; }
git log --oneline -1
```

## 의도 메모 (왜)

- 필터를 공유 `policy.ts`에 두는 이유 — adapter마다 개별 필터를 두면 같은 누락이 여러 곳에 반복된다. `isNonServerTitle`/`isServerRole`은 이미 toss·coupang 등이 호출하는 단일 진입점이라, 여기 한 곳을 고치면 모든 source가 혜택을 본다.
- 회사 도메인 단어로 fullText reject하지 않는 이유 — fintech 회사의 정상 backend 공고까지 떨어뜨린다. title 기준 직무 reject가 평가 케이스(Legal Counsel·Finance Manager 등)를 정확히 잡는다.
- shadow 관찰을 두지 않는 이유 — career-os 운영 원칙(AGENTS.md). 변경 즉시 bun 샘플 배열로 검증하고 문제 있으면 바로 고친다.

## Blocked 조건

- `policy.ts`의 `NON_SERVER_TITLE_KEYWORDS` 또는 `isServerRole`을 grep으로 못 찾으면(구조 변경) `PHASE_BLOCKED: policy.ts 필터 심볼 부재 — 구조 확인 필요` 출력 후 `exit 2`. 반드시 Bash 도구로 직접 실행한다.
- 검증에서 `BAD=0`을 만족 못 하면(서버 직무 오탐 또는 비서버 누수) `PHASE_FAILED: 필터 검증 실패` 출력 후 `exit 1`. 반드시 Bash 도구로 직접 실행한다. prose만 출력하면 success로 잘못 처리된다.
