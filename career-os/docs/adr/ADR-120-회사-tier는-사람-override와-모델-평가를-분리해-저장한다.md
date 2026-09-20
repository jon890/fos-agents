## ADR-120: 회사 tier는 사람 override와 모델 평가를 분리해 저장한다

- **status**: `accepted`
- **결정**: 사람이 정한 회사 tier와 제외는 지금처럼 `company_preferences`에만 저장하고, 모델이 만든 tier 평가는 세 자리에 나눠 따로 쌓는다. 평가 자체는 근거와 유효기간을 붙여 `company_tier_assessments`에, 어느 수집 실행이 평가를 돌렸는지는 `company_tier_assessment_runs`에, 그 실행이 어느 회사를 골라 어떻게 끝냈는지는 `company_tier_assessment_run_items`에 남긴다. 세 자리를 함께 둔다. 공고를 고를 때는 `manual`, `model`, `default` 순서로 tier를 해결한다. 선택 시점의 tier 값은 `position_analysis_run_items`와 `position_recommendation_items`가 이미 남기고 있으므로, 그 두 table에는 출처와 모델 평가 ID만 더한다. 모델은 tier를 제안할 수 있지만 회사를 제외하지 못한다.
- **맥락**: 지금은 사람이 `company_preferences`에 등록한 회사만 tier를 가진다. 2026-09-20 홈서버 운영 DB를 조회하니 `company_preferences`에 행이 하나도 없고 활성 공고 121건이 회사 36곳에 걸쳐 있었다. 그래서 36곳 전부가 `default_company_tier`인 Tier 3으로 처리되고, 우선 슬롯의 정렬 조건 중 회사 tier 항이 순위에 아무 영향을 주지 못한다. 회사를 사람이 하나씩 등록하는 방식은 수집 소스가 늘어나면 따라가지 못한다. 한편 tier는 회사의 절대 서열이 아니라 `candidate_context_version`에 적힌 후보자 기준에 종속된 우선순위이므로, 값만 저장하면 나중에 왜 그 tier가 됐는지 답할 수 없다.
- **대안 기각**:
  - 모델 평가를 `company_preferences`에 upsert하는 안은 기각했다. 사람이 정한 값과 모델이 정한 값이 한 자리에 섞여 사람의 결정을 모델이 조용히 바꾸게 되고, 되돌릴 이전 값도 남지 않는다.
  - 모델 tier를 사람 승인 뒤에 적용하는 안은 기각했다. 매일 도는 cron이 사람을 기다리게 되어 승인하지 않은 날은 추천이 만들어지지 않는다. tier는 공고를 제외하지 않고 순서만 바꾸므로 잘못된 평가의 손해가 승인 대기의 손해보다 작다.
  - 모델이 회사 제외까지 판정하는 안은 기각했다. 제외한 회사의 공고는 이후 추천에 다시 나타나지 않아 사람이 잘못을 발견할 기회가 없다. 제외는 `company_preferences`에서 사람만 한다.
  - 수집한 활성 공고 수로 tier를 정하는 안은 기각했다. 공고를 많이 내는 회사가 후보자에게 더 좋은 회사라는 근거가 없다. 공고 수는 아직 평가하지 않은 회사의 첫 평가 순서를 정하는 데만 쓴다.
  - 회사마다 최신 평가 한 행만 두고 덮어쓰는 안은 기각했다. 어느 추천이 어느 평가로 만들어졌는지 답할 수 없다. ADR-119가 분석 이력에 적용한 것과 같은 이유로 평가도 추가만 한다.
  - 회사 공개 사실 조사를 MySQL로 옮기는 안은 기각했다. ADR-115의 `state/company-research/`가 이미 공개 사실을 유효기간과 함께 재사용하고 있다. MySQL에는 후보자 기준의 판정만 둔다.
- **결과**:
  - 얻는 것: 사람이 등록하지 않은 회사도 근거가 붙은 tier를 가진다. 사람 override는 모델 평가가 있어도 항상 즉시 이긴다. 어느 추천이 어느 평가를 썼는지, 어느 회사가 기본 tier로 남았는지 SQL 한 문장으로 답할 수 있다. 한 회사의 평가가 실패해도 그 회사만 기본 tier로 떨어지고 그날 추천은 계속 만들어진다.
  - 감당할 것: tier가 `candidate_context_version`과 계약 버전에 종속되므로 후보자 기준을 바꾸면 기존 평가를 재사용할 수 없고 전부 다시 평가해야 한다. 하루 평가 상한이 있어 운영 첫 며칠은 상당수 회사가 기본 tier로 남는다. 같은 회사 tier가 `company_preferences`와 `company_tier_assessments` 두 자리에 있을 수 있으므로 해결 순서를 코드 한 곳에서만 정해야 한다. 평가가 유효기간 안에 있어도 회사 사정이 바뀔 수 있어 유효기간은 정책 기한과 각 근거의 만료일 중 빠른 쪽을 따른다.
- **적용 범위**: `services/recommendation-api/migrations/002_company_tier_assessments.sql`, `services/recommendation-api/position/`, `services/recommendation-api/routes/positions.ts`, `scripts/position-recommender/`, `.claude/skills/position-recommender/SKILL.md`와 `docs/data-schema.md`
