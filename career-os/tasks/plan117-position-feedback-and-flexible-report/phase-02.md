# Phase 02. 자유형 HTML 생성 경계

**Execution profile**: standard

## 목표

모델이 리포트마다 정보 구조를 선택하고 스크립트는 사실·링크·공개 범위만 검사한다.

**범위 외**: 추천 JSON의 근거 필드 삭제와 고정 템플릿 렌더러 제거.

## 컨텍스트

`career-os/.claude/skills/position-recommender/SKILL.md`가 실제 생성 흐름을 정한다.
현재 템플릿 렌더러는 대체 경로와 회귀 검사로 유지한다.

**근거 문서**: `career-os/docs/code-architecture.md`의 「포지션 추천 렌더」 절과 `career-os/docs/data-schema.md`의 추천 결과 계약.

## 작업 항목

### 1. 자유형 HTML 검사기

문서 제목, viewport, 추천 공고 링크, 위험한 URL과 로컬 경로 노출을 검사한다.
HTML 절 이름, 카드 수와 배치는 검사하지 않는다.

### 2. 스킬 생성 지침

모델이 추천 데이터에 맞게 HTML 구성을 정하도록 바꾸고 고정 템플릿은 실패 시 대체 경로로 내린다.

### 3. 검사기 테스트, 스킬 검증과 완료 표시

자유로운 구조 두 가지를 허용하고 링크 누락과 공개 경계 위반을 거부한다.
검증을 모두 통과하면 `index.json`의 상태를 `completed`로 바꾼다.

## 검증

```bash
# cwd: 저장소 루트
bun test career-os/scripts/position-recommender/render/validate-report-html.test.ts
python3 /Users/nhn/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  career-os/.claude/skills/position-recommender
bunx tsc --noEmit
```

## Critical Files

| 파일                                                                         | 변경 |
| ---------------------------------------------------------------------------- | ---- |
| `career-os/scripts/position-recommender/render/validate-report-html.ts`      | 신규 |
| `career-os/scripts/position-recommender/render/validate-report-html.test.ts` | 신규 |
| `career-os/.claude/skills/position-recommender/SKILL.md`                     | 수정 |
