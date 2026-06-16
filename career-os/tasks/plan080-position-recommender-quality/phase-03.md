# Phase 03 — ③ 태그 변별력 정교화 (policy.ts classify)

**Model**: sonnet
**Status**: pending

---

## 목표

position-recommender 실제 호출 평가에서, 거의 모든 공고가
"internet-bank/fintech, commerce/payment, ai-service, backend-platform"을 동시에 달았다.
`policy.ts`의 `classify`가 넓은 키워드(회사명·범용 단어)에 매칭돼 회사 단위 일괄 태깅처럼 돼 변별력이 사라졌다.

이 phase는 `classify`의 태그 키워드를 좁혀, 공고마다 태그 분포가 변별력을 갖게 한다.
특히 fullText(회사·카테고리·JD 전체)를 받기 때문에 회사 도메인 단어 하나로 모든 공고에 같은 태그가 붙는 문제를 줄인다.

**범위 외**:
- SKILL.md/prompt.md 문서(phase-01)는 건드리지 않는다.
- 서버 필터(`isServerRole`/`NON_SERVER_TITLE_KEYWORDS`, phase-02)는 건드리지 않는다.
- JD detail fetch 보강(phase-04)은 건드리지 않는다.
- 태그 *집합 자체*(internet-bank/fintech 등 태그 이름)는 바꾸지 않는다 — 매칭 키워드만 좁힌다.

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
- `career-os/scripts/position-recommender/live-postings/policy.ts` — `classify` 함수와 그 안의 키워드 배열, `AI_KEYWORDS`.

현재 `classify`(실행 시 재확인)는 fullText에 대해:
- `internet-bank/fintech`: bank·뱅크·은행·loan·대출·credit·여신·수신·증권·금융
- `commerce/payment`: commerce·커머스·order·주문·payment·결제·정산·페이
- `search/rag`: search·검색·rag·opensearch·elastic·vector
- `ai-service`: `AI_KEYWORDS`
- `backend-platform`: backend·백엔드·server·서버·spring·java·kafka·platform·플랫폼

문제: "금융"·"커머스"·"플랫폼" 같은 회사 소개에 흔한 단어가 fullText에 거의 항상 들어가 모든 공고가 같은 태그를 받는다.

---

## 작업 항목 (4)

**반드시 Edit 도구를 직접 호출한다. prose 응답으로 "정교화했다"고 끝내면 PHASE_FAILED다.**

### 1. 광범위 매칭 키워드 축소

`classify`의 각 태그 키워드 배열에서 변별력을 떨어뜨리는 *회사 소개에 흔한 범용어*를 제거하거나 더 구체적 표현으로 좁힌다. 예(실제 판단은 코드를 보고 한다):
- `backend-platform`: "platform"/"플랫폼"은 회사 소개에 거의 항상 등장 → 직무 신호가 강한 "backend"/"백엔드"/"server"/"서버"/"spring"/"kafka" 위주로 좁히고, "platform" 단독 매칭은 제거하거나 "platform engineer"/"플랫폼 엔지니어" 같은 직무 표현으로 좁힌다.
- `internet-bank/fintech`: "금융" 단독은 너무 넓다 → "은행"/"뱅크"/"여신"/"수신"/"증권"/"대출" 같은 구체 도메인 위주로 좁힌다.
- `commerce/payment`: "페이"는 회사명(카카오페이 등)에 들어가 일괄 태깅된다 → "결제"/"정산"/"payment"/"커머스"/"주문" 위주로 좁히고, 회사명에서 오는 "페이"가 변별력을 떨어뜨리면 제거 검토.

핵심 원칙: classify는 fullText를 받으므로, *직무·도메인을 실제로 가리키는 키워드*만 남기고 *회사 소개에 흔한 일반어*는 뺀다.

### 2. 태그 이름·집합 보존

태그 문자열(`internet-bank/fintech`, `commerce/payment`, `search/rag`, `ai-service`, `backend-platform`, `other`)은 그대로 둔다. 이 태그를 읽는 곳(리포트·분석)이 있으므로 이름을 바꾸지 않는다.

### 3. AI_KEYWORDS 변별력 점검 (해당 시)

`ai-service`가 `AI_KEYWORDS`로 거의 모든 공고에 붙으면, `AI_KEYWORDS`가 회사 소개의 "AI" 단독 같은 범용어를 포함하는지 확인하고 필요 시 좁힌다. 단 `AI_KEYWORDS`가 서버 필터(`isServerRole`의 `AI_PLATFORM_ROLE_KEYWORDS`)와 공유·연계되면 필터 동작을 깨지 않게 주의한다 — 태그용과 필터용이 분리돼 있으면 태그용만 좁힌다. 분리가 불명확하면 이 항목은 보류하고 1번에 집중한다.

### 4. bun으로 태그 분포 즉시 검증

career-os는 shadow 관찰 기간을 두지 않는다. 변경 후 즉시 서로 다른 성격의 샘플 텍스트로 태그 분포가 변별력 있는지 확인한다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun -e '
import { classify } from "./career-os/scripts/position-recommender/live-postings/policy.ts";
const samples = {
  "은행 백엔드": "토스뱅크 여신 시스템 Backend Engineer Spring Kafka 대출 심사",
  "커머스 결제": "쿠팡 결제 정산 시스템 Server Developer payment settlement",
  "검색": "네이버 검색 플랫폼 OpenSearch vector RAG Engineer",
  "AI 서비스": "카카오 AI 추천 모델 서빙 ML serving LLM Engineer",
  "일반 백엔드": "스타트업 Backend Engineer Spring Java REST API",
};
for (const [k,v] of Object.entries(samples)) console.log(k+" => "+JSON.stringify(classify(v)));
'
```

서로 다른 성격의 샘플이 *서로 다른* 태그 집합을 받아야 변별력이 있다. 모든 샘플이 같은 4태그를 받으면 정교화가 부족한 것이다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/live-postings/policy.ts` | `classify` 키워드 배열 축소(범용어 제거), 태그 이름·집합은 보존 |

## 검증

보고 직전 반드시 아래 bash 블록을 Bash 도구로 직접 실행하고 출력 값을 그대로 echo한다.

```bash
cd "$(git rev-parse --show-toplevel)"

# 1. 모듈 로드(타입체크 대체)
bun -e 'import("./career-os/scripts/position-recommender/live-postings/policy.ts").then(()=>console.log("[모듈 로드] OK")).catch(e=>{console.error("FAIL",e);process.exit(1)})'

# 2. 태그 분포 변별력 — 서로 다른 성격 샘플이 서로 다른 태그를 받는지
RESULT=$(bun -e '
import { classify } from "./career-os/scripts/position-recommender/live-postings/policy.ts";
const samples = [
  "토스뱅크 여신 시스템 Backend Engineer Spring Kafka 대출",
  "쿠팡 결제 정산 시스템 Server Developer payment settlement",
  "네이버 검색 플랫폼 OpenSearch vector RAG Engineer",
  "스타트업 Backend Engineer Spring Java REST API",
];
const sets = samples.map(s => classify(s).slice().sort().join(","));
const uniq = new Set(sets);
console.log("DISTINCT="+uniq.size+"/"+samples.length);
sets.forEach((s,i)=>console.log(i+": "+s));
')
echo "$RESULT"
DISTINCT=$(echo "$RESULT" | grep -oE "DISTINCT=[0-9]+" | head -1 | cut -d= -f2)
echo "[고유 태그 집합 수] $DISTINCT"
# 4개 샘플이 최소 3개의 서로 다른 태그 집합으로 갈리면 변별력 있음으로 본다
[ "${DISTINCT:-0}" -ge 3 ] || { echo "FAIL: 태그 변별력 부족(모든 샘플이 거의 같은 태그)"; exit 1; }

echo "✅ Phase 03 검증 명령 실행 완료"
```

## commit

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/scripts/position-recommender/live-postings/policy.ts
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
fix(career-os): position-recommender 태그 분류 변별력 정교화

- classify의 광범위 매칭 키워드(platform/금융/페이 등 회사 소개 범용어) 축소
- 직무·도메인을 실제로 가리키는 키워드 위주로 좁혀 일괄 태깅 완화
- 태그 이름·집합은 보존(internet-bank/fintech 등)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
COMMITS=$(git rev-list HEAD ^HEAD~1 --count)
echo "[이 phase commit 수] $COMMITS"
[ "$COMMITS" -ge 1 ] || { echo "FAIL: commit 미생성 — Edit이 실제 실행 안 됨"; exit 1; }
git log --oneline -1
```

## 의도 메모 (왜)

- `classify`가 fullText(회사 소개 포함)를 받는데 "플랫폼"·"금융"·"페이" 같은 범용어가 키워드에 있으면, 회사 소개만으로 태그가 일괄로 붙어 공고 간 변별력이 사라진다. 직무·도메인 신호가 강한 키워드만 남겨 태그가 실제 차이를 반영하게 한다.
- 태그 이름을 바꾸지 않는 이유 — 리포트·후속 분석이 태그 이름을 참조한다. 키워드만 좁혀 호환을 유지한다.
- shadow 관찰을 두지 않는 이유 — career-os 운영 원칙(AGENTS.md). bun 샘플로 즉시 분포를 확인한다.

## Blocked 조건

- `classify` 함수를 grep으로 못 찾으면(구조 변경) `PHASE_BLOCKED: classify 함수 부재 — 구조 확인 필요` 출력 후 `exit 2`. 반드시 Bash 도구로 직접 실행한다.
- 검증에서 고유 태그 집합 수가 3 미만이면(여전히 일괄 태깅) `PHASE_FAILED: 태그 변별력 부족` 출력 후 `exit 1`. 반드시 Bash 도구로 직접 실행한다. prose만 출력하면 success로 잘못 처리된다.
