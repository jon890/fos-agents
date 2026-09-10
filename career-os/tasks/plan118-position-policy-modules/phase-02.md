# Phase 02. 스킬 지침과 전체 구조 점검

**Execution profile**: standard

## 목표

최신 모델이 보고서 구성을 자율적으로 판단하도록 세부 형식 지시를 줄이고, 실행 계약과 검증 경계만 분명하게 남긴다.

**범위 외**: 추천 기준의 임의 변경, 후보 데이터 필드 삭제와 실제 외부 공고 재수집.

## 컨텍스트

`career-os/.claude/skills/position-recommender/SKILL.md`가 수집부터 게시 전 검증까지의 실행 계약을 소유한다.
렌더 방식은 자유형 HTML이 기본이고 고정 템플릿은 대체 경로다.

**근거 문서**: `career-os/docs/code-architecture.md`의 「포지션 추천 렌더」 절과 `career-os/docs/data-schema.md`의 추천 데이터 계약.

## 의도 메모

- 모델의 판단 품질을 높이기 위한 설명은 목표와 판정 조건 중심으로 남긴다.
- 종료 코드, 비공개 동기화, 후보풀 정합성, 공개 안전 검사는 축약하지 않는다.
- UI 절 이름, 카드 개수, 문장 형식과 같은 표현 지시는 제거한다.

## 작업 항목

### 1. 스킬 본문 축약

중복 설명과 구현 세부를 줄이고 입력, 수집, 판단, 검증, HTML, 게시, 정리 순서가 한 번씩만 나오게 한다.

### 2. 구조 문서 갱신

공통 유틸, 정책 상수, 판정 로직, 소스 어댑터와 공통 validator의 책임을 문서에 반영한다.

### 3. 전체 테스트와 완료 표시

스킬 검사, Markdown 검사, Prettier, TypeScript와 스크립트 전체 테스트를 실행한다.
검증을 모두 통과하면 `index.json`의 상태를 `completed`로 바꾼다.

## 검증

```bash
# cwd: 저장소 루트
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py career-os/.claude/skills/position-recommender
bun run format:position-recommender:check
bun test career-os/scripts
bunx tsc --noEmit
git diff --check
```

## Critical Files

| 파일                                                     | 변경                |
| -------------------------------------------------------- | ------------------- |
| `career-os/.claude/skills/position-recommender/SKILL.md` | 수정                |
| `career-os/docs/code-architecture.md`                    | 수정                |
| `package.json`                                           | 포맷 명령 범위 수정 |
