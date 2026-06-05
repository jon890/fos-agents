# Phase 01 — 개별 공고 기반 추천 정책과 runner validation 적용

## 목표

`position-recommender`가 "좋아 보이는 회사"를 추천하는 흐름으로 흐르지 않게 하고, 현재 열린 개별 채용공고만 강력 추천/도전 추천에 올리도록 고정한다.

## 구현

- `.claude/skills/position-recommender/SKILL.md`
  - 강력 추천/도전 추천 입력을 `posting_status: active/open` + `link_type: direct_posting` 항목으로 제한했다.
  - verified company 목록은 추천 입력이 아니라 추가 수집 범위 결정에만 쓰도록 명시했다.
- `.claude/skills/position-recommender/references/position-recommendation-prompt.md`
  - 추천 단위를 회사가 아니라 개별 active/open 공고로 재정의했다.
  - 회사 채용홈/검색 페이지/기술블로그/뉴스는 `추가 수집 대상`으로만 분리한다.
- `.claude/skills/position-recommender/references/position-decision-criteria.md`
  - JD fit 판단 전에 개별 공고 원문 또는 active detail 확인을 요구하도록 보강했다.
- `scripts/position-recommender/collect_live_postings.ts`
  - snapshot 항목에 `link_type`, `posting_status`, `active_evidence`를 추가했다.
  - Wanted detail `status=active` 확인 공고는 `direct_posting` + `active`로 렌더링한다.
  - Toss career article은 직접 지원 공고가 아니므로 `career_article` + `unknown`으로 표시한다.
- `scripts/position-recommender/run_daily_with_claude.sh`
  - 기본 prompt를 개별 active/open 공고 중심으로 강화했다.
  - Claude 호출 전에 `collect_live_postings.ts --source wanted`를 직접 실행해 `data/runtime/live-position-postings.md`를 갱신한다.
  - `--validate-existing`에서도 강력/도전 추천 항목의 직접 공고 링크, 탐색 링크 부재, active/open 근거를 검증한다.

## 검증

```bash
bash -n scripts/position-recommender/run_daily_with_claude.sh
bun scripts/position-recommender/collect_live_postings.ts --max-wanted 20 --source wanted --output /tmp/live-position-postings-test.md
CAREER_OS_ROOT=<valid-fixture-root> POSITION_RECOMMENDER_NOTIFY=0 scripts/position-recommender/run_daily_with_claude.sh --validate-existing
CAREER_OS_ROOT=<invalid-fixture-root> POSITION_RECOMMENDER_NOTIFY=0 scripts/position-recommender/run_daily_with_claude.sh --validate-existing
```

결과:

- shell syntax check 통과.
- Wanted 수집 샘플이 `link_type: direct_posting`, `posting_status: active`, `active_evidence: Wanted API detail status=active`를 포함했다.
- valid fixture는 통과했다.
- 탐색 링크만 있는 invalid fixture는 직접 공고 링크 없음, 추천 티어 내 탐색 링크 존재, active/open 근거 없음으로 실패했다.
- git log와 최근 리포트 대조 결과, 2026-05-31~2026-06-04 리포트에서 `collect_live_postings.ts`가 Claude 승인 게이트로 막혀 stale snapshot과 회사 lead 기반 추천이 반복된 것이 확인됐다. runner pre-collection으로 이 실패 모드를 차단한다.

## 다음 단계

수집 소스 자체를 Wanted 중심에서 공식 career direct posting crawler까지 확장하면 추천 후보 품질이 더 좋아진다. 단, 공식 career도 회사 홈이 아니라 개별 공고 URL과 open 상태를 구조화해서 넘겨야 한다.
