# Phase 01 — ADR·docs 건전성 감사 (발견 전용)

**Model**: opus
**Status**: pending

## 목표

ADR 약 100개와 의사결정 문서에서 정리 후보를 발견해 findings.md로 남긴다. 이 phase는 read-only 발견이다. 실제 정리는 Phase 02.

## 중요 지침

아무 ADR·문서도 수정하지 않는다. 오직 감사·분류만 한다.
`docs-check` 스킬(ADR 건전성·stale·drift·중복·self-evidence 5축 감사)을 활용한다.

## 작업

- `docs-check`로 5축 감사: Decay(stale), Bloat(과대), Clarity, Duplication(중복), Self-Evidence.
- ADR별로 분류:
  - **superseded** — 이후 ADR이 대체했는데 supersede 표기가 없는 것.
  - **stale** — 현재 코드·구조(plan092/093 반영 후)와 어긋나는 것.
  - **duplicate/mergeable** — 같은 결정을 여러 ADR이 나눠 담아 병합 가능한 것.
  - **bloat** — 구현 상세·이력이 과하게 쌓여 압축 가능한 것.
  - **keep** — 그대로 둘 것.
- 5문서(data-schema·code-architecture·flow·prd·README)의 drift·중복·과대 서술 식별.
- `docs/adr/INDEX.md`와 실제 ADR 파일 정합성 확인.

## 성공 기준

- `findings.md`에 ADR별 분류(superseded/stale/duplicate/bloat/keep) + 근거가 정리됐다.
- 각 정리 후보에 제안 조치(supersede 표기 / 병합 / archive / 압축)가 붙었다.
- 문서 drift 목록이 정리됐다.

## 보류 조건

- plan093 구조 변경이 미완이면, 그에 의존하는 ADR의 stale 판정은 보류하고 표시만 한다.
