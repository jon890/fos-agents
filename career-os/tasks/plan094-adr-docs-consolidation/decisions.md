# plan094 결정 — ADR·docs 정리

docs-check 5축 감사(read-only) findings + 사용자 결정을 고정한 실행 계약이다.
감사는 plan092·093 병합 후 현재 구조(5버킷·positions-queue·frontdoor 제거·fos-career 폐기) 기준으로 수행했다.

## 정책 결정

- **archive 폴더 안 만든다.** keep / delete binary. 별도 archive/ 디렉터리는 limbo(썩는 곳)가 되므로 배제.
- **죽은 ADR은 삭제한다.** provenance는 tombstone ADR 하나로 보존(fos-career=ADR-102). 세부 사망 결정은 제거.
- ADR은 역사 기록이므로, 삭제 전 tombstone이 WHY를 자족적으로 담는지 확인하고, dangling `[[링크]]`·INDEX 행을 함께 정리한다.

## 삭제 대상 — 23개

### fos-career 웹 대시보드 사망 클러스터 (16, ADR-102가 tombstone)
- 이미 "Superseded by ADR-102" 표기 (11): ADR-046·049·050·054·061·064·068·081·082·083·084
- "Accepted"였으나 실제 죽은 fos-career 인프라 (5): ADR-053·060·065·077·078

### coffeechat 클러스터 (3)
- ADR-034·048·067 (죽은 coffeechat 자동화. flow.md tombstone에 폐기 사실 있음)

### 기타 fully-superseded (4)
- ADR-045·075·011·023

## merge — 이번 포함

- **ADR-094 → ADR-101**: 같은 "recommendation.json 정본" 결정을 나눠 담음. 094 내용을 101에 통합하고 094는 supersede-tag 후 제거(또는 101이 흡수). 주의: 101의 소비측 backend 부분은 ADR-102로 partial superseded.
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

- 삭제는 파일 rm + INDEX 행 제거 + dangling `[[ADR-NNN]]` 링크 정리 + tombstone 자족성 확인 + grep 잔여 참조 0 검증까지 한 묶음.
- ADR 결번(004·007·024·029·076)은 정상 — broken link 아님.
