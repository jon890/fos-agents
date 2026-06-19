# Phase 01 — 스키마에 source·closeDate 추가

**Model**: sonnet
**Status**: pending

---

## 목표

`recommendation.json` 표준 출력 JSON의 각 추천 항목이 적재에 필요한 진실 데이터를 담도록, `PositionItem` 스키마에 `source`와 `closeDate`를 추가한다.
fos-career candidate identity 키가 `company_title_source_close_date`이고 `source`는 `NOT NULL`이라, 표준 출력 JSON만으로 candidate 동일성 판정이 닫혀야 한다(ADR-101).

**범위 외**: 렌더러 표시(phase-02), SKILL 지시(phase-03), 죽은 코드 제거(phase-04). 이 phase는 zod 스키마 파일 한 곳만 바꾼다.

---

## 사전 cwd 설정 (run-phases.py hotfix 표준)

run-phases.py는 cwd=workspace로 phase를 실행한다. 본 phase는 ai-nodes 루트 기준 path를 쓰므로 첫 bash에서 루트로 이동한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes 루트
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr/ADR-101-position-recommender-표준출력-json-단일화-소비측-가공.md` — 왜 정본이 source·closeDate를 담아야 하는가
- `career-os/docs/data-schema.md` recommendation.json 섹션 — 필드 책임 단일 출처
- `career-os/scripts/position-recommender/recommendation_schema.ts` — 변경 대상

---

## 작업 항목 (1)

### 1. `career-os/scripts/position-recommender/recommendation_schema.ts` — PositionItem 확장

`PositionItem` 객체에 두 필드를 추가한다.

- `source: z.string().min(1)` — 수집 adapter 식별자(예: `naver-careers`, `kakaopay`). enum이 아니라 string으로 둔다. adapter id의 단일 출처는 `live-postings/adapters` registry이므로 스키마에 목록을 하드코딩하면 drift한다(ADR-101).
- `closeDate: z.string().nullable()` — 마감일 문자열 또는 `null`. 마감이 없거나 미상이면 `null`. 사람용 자유문자열 `postingPeriod`는 그대로 두고, 기계 적재용 구조화 값으로 별도 추가한다.

적용 범위는 `PositionItem`(강력·도전 티어)만이다. `HoldItem`과 `AdditionalTarget`은 개별 공고 URL이 없어 적재·dedup 대상이 아니므로 추가하지 않는다.

기존 14개 라벨 필드의 정의 방식과 같은 스타일로 주석을 단다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/recommendation_schema.ts` | `PositionItem`에 `source`·`closeDate` 추가 |

## 검증

```bash
cd "$(git rev-parse --show-toplevel)"

# 1. 필드 추가 확인
grep -q "source: z.string" career-os/scripts/position-recommender/recommendation_schema.ts && echo "source OK"
grep -q "closeDate: z" career-os/scripts/position-recommender/recommendation_schema.ts && echo "closeDate OK"

# 2. HoldItem/AdditionalTarget에는 source가 들어가지 않았는지 (PositionItem만)
#    PositionItem 블록 안에만 source가 있어야 한다 — 육안 + 아래 parse 검증으로 보강

# 3. zod 스키마가 실제로 파싱되는지 (bun 환경)
cat > /tmp/p91_schema_check.ts <<'EOF'
import { PositionItem } from "../career-os/scripts/position-recommender/recommendation_schema.ts";
const base = {
  rank: 1, company: "X", title: "Y",
  postingUrl: "https://example.com/job/1", exploreLink: "-",
  linkEvidenceLevel: "개별 공고 open 확인",
  postingPeriod: "상시", searchKeywords: ["a"], whyFit: "f",
  candidateEvidence: ["e"], jdKeywords: ["k"],
  companyUpside: { level: "중간", reason: "r" },
  welfareLearning: "w", techBlogSignal: "t", businessRisk: "b",
  ambiguity: "a", prepAction: "p",
  source: "naver-careers", closeDate: null,
};
const ok = PositionItem.safeParse(base);
const missingSource = PositionItem.safeParse({ ...base, source: undefined });
console.log("with source/closeDate:", ok.success);          // 기대 true
console.log("without source:", missingSource.success);       // 기대 false
process.exit(ok.success && !missingSource.success ? 0 : 1);
EOF
cd career-os && bun /tmp/p91_schema_check.ts
```

성공 기준: 위 bun 검증이 exit 0 (source·closeDate 있으면 통과, source 누락 시 거부).

## 의도 메모 (왜)

- `source`를 enum이 아닌 string으로 둔 이유: adapter 목록의 단일 출처는 registry이고, 스키마 enum은 adapter 추가마다 drift를 만든다(ADR-101 거절 대안).
- `closeDate`를 `postingPeriod`와 별도로 둔 이유: `postingPeriod`는 사람용 자유문자열이라 dedup 키로 파싱하기 취약하다. 기계 적재용 구조화 값이 필요하다.

## Blocked 조건

- bun 미설치로 검증 불가 → `PHASE_BLOCKED: bun 미설치로 스키마 parse 검증 불가` 출력 후 종료.
