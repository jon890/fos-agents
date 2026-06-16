## ADR-029 — cj-foodville-coffeechat-prep → interview-coffeechat-prep native rename + 회사 추상화 + ts collector + 준비 자산 data 이동

**Status**: Accepted
**Date**: 2026-05-16

### 맥락

`cj-foodville-coffeechat-prep` skill은 CJ Foodville 면접 시즌 전용으로 이름·URL·강의 자료가 회사명에 박혀 있다. mvp-target.json의 `coffeechat_*` 변수로 일부 추상화됐지만 *collector script 자체*가 3 URL hard-coded (vips / cheiljemyunso / cjfoodville-brand) + skill 이름도 회사명. 회사 전환 시 skill 이름·collector·전략 노트·체크리스트 모두 재작성 필요 — 회사 불가지론 의도 불완전.

또 `collect_foodville_sites.py` 156줄 Python (stdlib only)이 ai-nodes ADR-022 (Bun TS 마이그) 정책과 어긋남. shell runner도 옛 외부 subprocess 패턴이라 native skill 흐름과 맞지 않음.

`docs/prep/cj-foodville-coffeechat-{strategy,30min-final-checklist}.md`는 [[ADR-015]] 정렬 위반 후보 — `docs/`는 의사결정·학습 누적이고, *회사 특화 hand-crafted 준비 hint*는 `data/prep/<company-slug>/`가 자연.

### 결정

일곱 묶음 변경 (한 plan021):

1. **skill rename**: `cj-foodville-coffeechat-prep` → `interview-coffeechat-prep`. SKILL.md 본문에서 회사명 박힘 제거. mvp-target.json의 `primary.coffeechat` 객체가 회사별 context 단일 출처.
2. **mvp-target.json `primary.coffeechat` 객체로 묶기**: 옛 평면 변수 6개 (`coffeechat_skill_dir`, `coffeechat_report_slug`, `coffeechat_source_dir`, `coffeechat_collector_script`, `coffeechat_brand_snapshot`) → `primary.coffeechat: { sites: [{key, url, label}], source_dir, report_slug, prep_dir, strategy_filename, checklist_filename }` 한 객체. 회사 전환 시 `primary.coffeechat` 통째 교체.
3. **zod 스키마 도입**: `_shared/lib/mvp_target_schema.ts` 신규 — zod 스키마 + `parseMvpTarget()` 함수. collector ts와 (향후) 다른 mvp-target Read 위치에서 공유 검증. 신규 의존성: `zod` (작은 라이브러리, Bun 호환).
4. **Python collector → TypeScript 마이그**: `collect_foodville_sites.py` (156줄) → `collect_company_sites.ts` (Bun fetch + HTML → text). 회사 hard-coded URL 제거 — sites 배열을 zod 스키마로 Read.
5. **shell runner 폐기**: `run_foodville_coffeechat_prep.sh` 폐기. native skill SKILL.md가 Bash로 ts collector 호출 + 결과 Read.
6. **회사 준비 자산 위치 이동**: `docs/prep/cj-foodville-coffeechat-*.md` → `data/prep/cj-foodville/{strategy,checklist}.md`. [[ADR-015]] 정렬 — docs/ 비움, data/prep/<company-slug>/ 신설.
7. **dispatcher `foodville-coffeechat` case 즉시 폐기**: native `/interview-coffeechat-prep` 단일 진입점. 남은 dispatcher case 1개 (`recommend-positions`).

거절한 대안:
- skill 이름 `coffeechat-prep`: 면접 외 용도도 포함 — 의도 모호. `interview-coffeechat-prep`이 interview-asset-writer / interview-prep-analyzer 계열과 일관.
- URL을 별도 `config/coffeechat-targets.json`: mvp-target.json과 drift 위험. 단일 출처 원칙 따라 mvp-target.json에 통합.
- Python collector 유지: [[ADR-022]] 일관성 + stdlib only라 ts 마이그 비용 낮음.
- **전체 config json zod 일괄 도입**: topics-* / sources / mvp-target 모두 zod — 큰 plan이라 별도 분리. 본 plan021은 mvp-target만, 다른 config는 추후 별도 plan으로 확장.

### 결과

- 회사 전환 시 *mvp-target.json `primary.coffeechat` 객체만 교체*. skill 이름·collector·SKILL.md 본문 그대로.
- [[ADR-022]] ts 일관성 회복 (Python collector 폐기).
- [[ADR-015]] 정렬 — `docs/prep/` 비움, `data/prep/<company-slug>/` 신설.
- zod 의존성 추가 — 향후 다른 config (topics / sources)도 zod 스키마 적용 가능한 기반 (별도 plan).
- dispatcher case 2 → 1 (recommend-positions만). plan022 후 plan023에서 command-router 일괄 폐기.
- 단점: skill rename으로 docs/AGENTS.md/git history 영향 — 본 plan021에서 일괄 정리. zod 의존성 한 개 추가.

### 적용

`tasks/plan021-interview-coffeechat-prep-native/`. depends_on: 없음. common-pitfalls 6-6 회피: SKILL.md draft + collect_company_sites.ts draft 별도 파일.
