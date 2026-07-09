# plan094 결정 — ADR·docs 정리

docs-check 5축 감사(read-only) findings + 사용자 결정을 고정한 실행 계약이다.
감사는 plan092·093 병합 후 현재 구조(5버킷·positions-queue·frontdoor 제거·fos-career 폐기) 기준으로 수행했다.

## 정책 결정

- **archive 폴더 안 만든다.** keep / delete binary. 별도 archive/ 디렉터리는 limbo(썩는 곳)가 되므로 배제.
- **죽은 ADR은 삭제한다.** provenance 보존은 두 층으로 나눈다.
  - **live tombstone ADR이 있는 클러스터**는 그 ADR로 보존한다(fos-career=ADR-102). 이때 tombstone의 Supersedes 목록이 삭제 대상 전체를 담아야 한다.
  - **live tombstone이 없고 사용자가 완전 제거를 택한 클러스터**(coffeechat·ADR-077)는 별도 tombstone을 만들지 않고 git history로만 보존한다. 잔재가 혼란을 유발한다는 사용자 판단(2026-07-09).
- ADR은 역사 기록이므로, 삭제 전 provenance 층을 확정하고, dangling `[[링크]]`·INDEX 행을 함께 정리한다.

## 삭제 대상 — 23개

### fos-career 웹 대시보드 사망 클러스터 (15, ADR-102가 tombstone)
- 이미 ADR-102 Supersedes에 등재 (11): ADR-046·049·050·054·061·064·068·081·082·083·084
- "Accepted"였으나 실제 죽은 fos-career/frontdoor 인프라 (4): ADR-053·060·065·078
  - 실측: 053(priority write bridge)·060(공고 상태 액션 pending request, fos-career DB)·065(면접 답변 피드백 host-side processor·dashboard)·078(frontdoor freshness). 모두 웹 대시보드 메커니즘이라 삭제 타당.
  - **provenance 보정 필수**: 이 4개는 ADR-102 Supersedes 목록에 아직 없다. 삭제와 함께 ADR-102 Supersedes에 추가한다.

### ADR-077 (오분류 정정 — 1)
- ADR-077(position-daily-runner Claude 무출력 hang 처리)은 fos-career 웹 대시보드가 아니라 position-recommender cron 운영 결정이다.
- 사용자 결정(2026-07-09): 해당 cron 스크립트를 지금 그 방식으로 돌리지 않아 obsolete → 삭제한다.
- fos-career가 아니므로 ADR-102 Supersedes에 넣지 않는다. tombstone 없이 git history로만 보존한다.

### coffeechat 클러스터 (3)
- ADR-034·048·067 (죽은 coffeechat 자동화).
- **정정**: "flow.md tombstone에 폐기 사실 있음"은 거짓 전제였다(`grep coffeechat flow.md`=0건). coffeechat WHY는 이 3개 ADR 자체에만 있었다(ADR-067 본문이 "폐기는 ADR/task history에만 남긴다"고 선언).
- 사용자 결정(2026-07-09): 3개 전부 삭제, 별도 tombstone을 만들지 않는다. 폐기 잔재가 혼란을 유발하므로 완전 제거하고 1차·2차 면접 준비만 존치한다. provenance는 git history로 갈음한다.
- 삭제 시 live 문서의 dangling 참조 정리: ADR-092(`[[ADR-048]]`)·code-architecture.md·data-schema.md.

### 기타 fully-superseded (4)
- ADR-045·075·011·023

## merge — 이번 포함

- **ADR-094 → ADR-101**: 같은 "recommendation.json 정본" 결정을 나눠 담음. 094 내용을 101에 통합하고 094는 supersede-tag 후 제거(또는 101이 흡수). 주의: 101의 소비측 backend 부분은 ADR-102로 partial superseded.
  - **참조 정리 필수 대상(실측 ~21건)**: position-recommender/SKILL.md(6)·job-fit-analyzer/SKILL.md(1)·code-architecture.md(4)·data-schema.md(1)·ADR-096(2)·ADR-099(1)·ADR-101(1)·INDEX(094 행)·scripts/position-recommender recommendation_schema.ts·render_recommendation.ts 주석(2). live SKILL.md·docs·**코드 주석**을 ADR-101로 리다이렉트한다.
- **포지션 수집 adapter 경계 (043·047·051)**: adapter 경계 3연발. 하나로 merge 검토(각 단계 근거는 병합본에 보존).
- (선택) application-flow-agent runtime ADR-037~042 6개 → 2~3개 장기 후보. 이번엔 여력 되면.

## docs 정리 — 이번 포함

- `code-architecture.md:44-45` — ADR 수 "88개" 오기 → 실제 수로 정정하거나 "개별 파일" 표현으로 수치 제거(재발 방지).
- `data-schema.md` (1490줄) 다이어트:
  - `:357-373` plan002 리다이렉트 stub 5개 제거 (ADR-098 "폐기 항목 스키마 안 남김" 원칙과 자기모순).
  - `study-pack-topics`·`study-pack-candidates` 이중 문서화(legacy stub + 현행) → 현행 1건으로 통합.
  - `:177-187` 미실행 config diet 청소 목록(aspirational) 정리 검토.
- `code-architecture.md:239`·`data-schema.md:225` — 제거된 interview-prep-analyzer의 `mvp_target_schema.ts` "사용 중" 기술 정정(#69에서 스크립트 삭제됨).

## 유지 (삭제 안 함)

- 자명·저가치 삭제 후보는 사실상 없음 — 대부분 거절 대안·비용 수치·팀 규율 보유(ADR-003·019·085·089·091 등).
- ADR-108(ledger→positions-queue rename)은 저가치이나 역참조 많아 추적용 keep.
- prd·flow·code-architecture 본문은 죽은 인프라를 tombstone으로만 언급 — stale 참조 없음(양호).

## 스코프 주의

- 삭제는 파일 rm + INDEX 행 제거 + dangling `[[ADR-NNN]]` 링크 정리 + provenance 층 확정 + grep 잔여 참조 0 검증까지 한 묶음.
- ADR 결번(004·007·024·029·076)은 정상 — broken link 아님.

## 2026-07-09 critic REVISE 반영 (실행 정정)

critic 평가(adversarial)에서 3 MAJOR 결함이 실측 확인돼 계획을 정정했다.

- **MAJOR-1(coffeechat provenance 거짓 전제)**: flow.md에 coffeechat tombstone 없음(0건). 사용자 결정으로 3개 전부 삭제·git history 보존으로 확정(위 coffeechat 절).
- **MAJOR-2(검증 범위 누락)**: Phase 05 dangling grep이 merge 제거분 094·043·047·051을 안 봄. ADR-094는 live SKILL.md·docs 17건 참조 → Phase 03 리다이렉트 + Phase 05 grep에 4개 번호 추가.
- **MAJOR-3(tombstone 미보장·077 오분류)**: 053·060·065·078을 ADR-102 Supersedes에 추가 필수화(조건부 아님). 077은 fos-career 아님 → 오분류 정정, tombstone 없이 삭제(위 ADR-077 절).
- **MINOR**: Phase 04에 code-architecture.md:147-148·131-132, data-schema.md:1032-1033 누락분 추가. data-schema 줄 수는 정정 전후 실측 수치로 기록(막연한 "유의미 감소" 금지). Phase 01→02 확정 목록은 decisions.md에 durable 기록(본 절).

삭제 최종 23개(불변): fos-career 15 + 077(오분류-obsolete) + coffeechat 3 + 기타 superseded 4.
