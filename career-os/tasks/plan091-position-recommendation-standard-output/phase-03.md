# Phase 03 — SKILL을 표준 출력 JSON 계약으로 개편

**Model**: sonnet
**Status**: pending

---

## 목표

`position-recommender` SKILL.md를 ADR-101 계약으로 정렬한다.
스킬은 표준 출력 JSON 생성까지만 책임지고, source·closeDate를 채우며, 호출자(cron·backend)가 JSON을 받아 가공하는 모델을 명문화한다.

이 phase에서 SKILL.md가 반영할 것:

1. `source`·`closeDate`를 수집 snapshot에서 채우라는 지시.
2. 표준 출력 JSON을 run output(최종 응답)으로 낼 수 있는 호출 모드.
3. "정본" 표현을 "표준 출력 JSON"으로 교체.
4. 폐기된 runner·items.json 참조 제거.

**범위 외**: 스키마(phase-01)·렌더러(phase-02)·코드 삭제(phase-04). 이 phase는 SKILL.md 문서만 바꾼다.

---

## 사전 cwd 설정 (run-phases.py hotfix 표준)

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes 루트
```

---

## 관련 docs

- `career-os/docs/adr/ADR-101-position-recommender-표준출력-json-단일화-소비측-가공.md` — 계약의 근거
- `career-os/.claude/skills/position-recommender/SKILL.md` — 변경 대상
- `career-os/docs/data-schema.md` live-position-postings.md 섹션 — snapshot의 `source`·`closes_at` 필드 의미

---

## 작업 항목 (5)

### 1. Workflow 3(추천 분석 + 리포트 작성)에 source·closeDate 채우기 지시 추가

각 추천 항목에 다음을 채우라고 명시한다.

- `source` — 해당 공고의 수집 snapshot 항목 `source`(adapter 식별자)를 그대로 옮긴다. URL 도메인으로 추측하지 않는다.
- `closeDate` — snapshot의 `closes_at`을 옮기되, `no_deadline`·미상이면 `null`로 둔다.

후보 매칭은 `postingUrl` 기준이다. snapshot에 없는 항목은 추천 티어에 올리지 않는 기존 규칙과 일관된다.

### 2. 표준 출력 JSON run output 모드 추가

새 절(예: "출력 모드")을 둬서 호출자별 출력을 구분한다.

- 기본: `recommendation.json` 파일을 쓴다(현행).
- backend 호출(JSON 응답 요청, `response_format: json_object` 등): `recommendation.json`과 동일한 내용을 최종 응답(run output)으로 출력한다. 산문 설명을 섞지 않는다.
- cron 호출: 최종 응답은 Discord 요약 산문이고, JSON은 파일로만 둔다.

근거는 ADR-101이다(전달 매체 = 운영 공유 파일 + 로컬·분산 hermes API 응답).

### 3. "정본" → "표준 출력 JSON" 표현 교체

본문 전반의 "정본" 표기를 "표준 출력 JSON"으로 바꾼다(ADR-094 인용 맥락은 유지 가능).

### 4. 폐기 자산 참조 제거·갱신

- 산출물 절(현재 "Runner post-process → fos-career DB ingest")을 "표준 출력 JSON을 호출자가 가공(cron Discord 요약 / backend DB 적재)"으로 갱신한다.
- References의 daily runner 자산(`run_daily_with_claude.ts`·`structured_recommendation_items.ts`) 역참조를 제거한다. 이 자산은 phase-04에서 삭제된다.
- `position-recommendation-items.json` 미러 언급이 있으면 제거한다.

### 5. Self-check 절 보강

- 표준 self-check는 `render_recommendation.ts` 실행(zod 검증)이지만, **cron 환경에는 bun이 없어 이 검증이 실행되지 않는다**는 점을 명시한다.
- 따라서 bun이 없는 실행에서는 에이전트가 직접 `source`·`closeDate` 누락과 tier 상한을 점검하고, 최종 적재 검증은 소비측(backend)이 zod로 수행한다고 적는다.
- ADR-101을 Why this design / References에 추가한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/position-recommender/SKILL.md` | source·closeDate 지시 + run output 모드 + 표현 교체 + 폐기 참조 제거 + self-check 보강 |

## 검증

```bash
cd "$(git rev-parse --show-toplevel)"
SKILL=career-os/.claude/skills/position-recommender/SKILL.md

# 새 계약 반영 확인
grep -q "source" "$SKILL" && grep -q "closeDate" "$SKILL" && echo "필드 지시 OK"
grep -q "표준 출력" "$SKILL" && echo "표현 OK"
grep -q "ADR-101" "$SKILL" && echo "ADR 참조 OK"

# 폐기 자산 참조 제거 확인 (0건이어야)
! grep -q "run_daily_with_claude" "$SKILL" && echo "runner 참조 제거 OK"
! grep -q "structured_recommendation_items" "$SKILL" && echo "items 자산 참조 제거 OK"
! grep -q "position-recommendation-items.json" "$SKILL" && echo "items 미러 참조 제거 OK"
```

성공 기준: 새 계약 grep이 모두 매치, 폐기 자산 참조 grep이 모두 0건.

## 의도 메모 (왜)

- 생성 경로가 "에이전트가 직접 JSON 작성"이므로 source·closeDate를 채우는 책임은 코드 후처리가 아니라 SKILL 지시에 있다(cron 환경 bun 부재로 후처리 스크립트가 안 돈다).
- run output 모드는 backend가 파일 공유 없이 로컬에서 적재를 검증하게 하는 핵심이다(ADR-101).

## Blocked 조건

- SKILL.md 부재 → `PHASE_FAILED: SKILL.md 경로 확인 필요` 출력 후 종료.
