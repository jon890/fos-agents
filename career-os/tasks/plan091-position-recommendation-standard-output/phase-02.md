# Phase 02 — 렌더러에 source·closeDate 표시 추가

**Model**: sonnet
**Status**: pending

---

## 목표

`render_recommendation.ts`가 표준 출력 JSON의 새 필드 `source`·`closeDate`를 Markdown과 HTML 파생물에 표시하도록 한다.
사람이 읽는 산출물에서도 수집 source와 마감일을 확인할 수 있어야 하고, 새 필드가 들어와도 렌더가 깨지지 않아야 한다.

**범위 외**: 스키마 정의(phase-01 선행), SKILL 지시(phase-03). 이 phase는 렌더러 한 파일만 바꾼다.

---

## 사전 cwd 설정 (run-phases.py hotfix 표준)

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes 루트
```

---

## 관련 docs

- `career-os/docs/adr/ADR-101-position-recommender-표준출력-json-단일화-소비측-가공.md`
- `career-os/scripts/position-recommender/render_recommendation.ts` — 변경 대상
- `career-os/scripts/position-recommender/recommendation_schema.ts` — phase-01에서 추가된 `source`·`closeDate` 확인

---

## 작업 항목 (2)

### 1. Markdown 파생 — `positionToMarkdown`

각 추천 항목 출력에 두 줄을 추가한다(기존 라벨 줄과 같은 들여쓰기·스타일).

- `- 수집 source: ${item.source}`
- `- 마감일: ${item.closeDate ?? "상시/미정"}`

배치 위치는 `공고 기간`(`postingPeriod`) 근처가 자연스럽다.

### 2. HTML 파생 — `positionCardHtml`

같은 두 필드를 `field(...)` 헬퍼로 추가한다.

- `field("수집 source", escapeHtml(item.source))`
- `field("마감일", escapeHtml(item.closeDate ?? "상시/미정"))`

`source`·`closeDate`는 자유 텍스트가 아니라 단순 값이므로 `escapeHtml`만 적용한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/render_recommendation.ts` | `positionToMarkdown`·`positionCardHtml`에 source·마감일 표시 추가 |

## 검증

```bash
cd "$(git rev-parse --show-toplevel)"

# 샘플 표준 출력 JSON 작성 (source·closeDate 포함)
cat > /tmp/p91_sample.json <<'EOF'
{
  "schemaVersion": 2,
  "reportDate": "2026-06-19",
  "generatedAt": "2026-06-19 10:00",
  "conclusion": ["테스트 결론"],
  "background": ["배경"],
  "tiers": {
    "strong": [{
      "rank": 1, "company": "NAVER", "title": "Backend",
      "postingUrl": "https://recruit.navercorp.com/job/1", "exploreLink": "-",
      "linkEvidenceLevel": "개별 공고 open 확인",
      "postingPeriod": "상시/마감 미정", "searchKeywords": ["java"],
      "whyFit": "fit", "candidateEvidence": ["evidence"], "jdKeywords": ["spring"],
      "companyUpside": { "level": "강함", "reason": "성장" },
      "welfareLearning": "복지", "techBlogSignal": "blog", "businessRisk": "risk",
      "ambiguity": "ambiguity", "prepAction": "prep",
      "source": "naver-careers", "closeDate": null
    }],
    "stretch": [], "hold": []
  },
  "additionalTargets": [],
  "recentCheck": ["점검"],
  "weeklyActions": { "apply": "a", "resume": "r", "study": "s" },
  "sourceSnapshot": { "collectionRunId": null, "snapshotPath": "x" }
}
EOF

# md/html 파생 — render_recommendation.ts의 zod 검증이 통과해야 생성된다 (self-check 겸용)
cd career-os
bun scripts/position-recommender/render_recommendation.ts --input /tmp/p91_sample.json --format md   --output /tmp/p91_out.md
bun scripts/position-recommender/render_recommendation.ts --input /tmp/p91_sample.json --format html --output /tmp/p91_out.html

# 새 필드가 표시되는지
grep -q "수집 source" /tmp/p91_out.md && grep -q "naver-careers" /tmp/p91_out.md && echo "md OK"
grep -q "수집 source" /tmp/p91_out.html && echo "html OK"
grep -q "마감일" /tmp/p91_out.md && echo "closeDate OK"
```

성공 기준: 두 파생 명령이 exit 0으로 산출물을 만들고, `수집 source`·`naver-careers`·`마감일`이 출력에 포함.

## 커밋

검증 통과 후 이 phase 변경만 stage해 커밋한다. push하지 않는다. 무관한 dirty 파일을 stage하지 않도록 경로를 명시한다.

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/scripts/position-recommender/render_recommendation.ts
git commit -m "feat(career-os): position 리포트 렌더러에 source·마감일 표시 (plan091)"
```

## 의도 메모 (왜)

- 렌더 파생이 곧 zod self-check다(ADR-094). 새 필드를 추가해도 파생이 성공해야 스키마와 렌더가 정합임을 보장한다.
- `closeDate`가 null이면 `상시/미정`으로 표시해 사람 가독성을 유지한다.

## Blocked 조건

- bun 미설치로 파생 검증 불가 → `PHASE_BLOCKED: bun 미설치로 렌더 검증 불가` 출력 후 종료.
- phase-01의 source·closeDate가 스키마에 없어 샘플 parse 실패 → `PHASE_FAILED: phase-01 스키마 선행 누락` 출력 후 종료.
