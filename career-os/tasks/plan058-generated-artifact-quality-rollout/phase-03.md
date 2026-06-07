# Phase 03 — 학습/면접 산출물 contract

**Model**: sonnet
**Status**: completed

---

## 목표

study-pack, interview asset, interview prep 계열 native skill에도 같은 생성 문서 품질 계약을 적용한다.

**범위 외**:

- 공개 fos-study 글 작성 또는 push.
- 새 study pack 생성.
- 면접 private 자산 원문 공개.
- commit/push.

---

## 관련 docs/files

실행 전 반드시 읽는다:

- `docs/prd.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `docs/adr.md`
- `.claude/skills/study-pack-writer/SKILL.md`
- `.claude/skills/interview-asset-writer/SKILL.md`
- `.claude/skills/interview-prep-analyzer/SKILL.md`
- 관련 `references/` 파일

---

## 작업 항목 (5)

1. study-pack writer에 한국어 우선 제목과 자연스러운 한국어 문장 기준을 반영한다.
2. interview asset writer에 내부 분석과 공개 또는 제출 가능 문구의 분리 기준을 반영한다.
3. interview prep analyzer에 첫 10줄 결론과 다음 행동 기준을 반영한다.
4. `needs_evidence` 계열 표현을 `보강 필요 / 선택지 / 권장 행동`으로 바꾸는 지시를 넣는다.
5. fos-study publish는 사용자 승인 전 금지라는 gate를 명시한다.

---

## Intended File Scope

- `.claude/skills/study-pack-writer/SKILL.md`
- `.claude/skills/interview-asset-writer/SKILL.md`
- `.claude/skills/interview-prep-analyzer/SKILL.md`
- 필요한 경우 각 skill의 `references/` 안 contract 파일

---

## 검증

```bash
rg -n "첫 10줄|한국어 우선|자연스러운 한국어|내부 분석|보강 필요 / 선택지 / 권장 행동|fos-study|사용자 승인" .claude/skills/study-pack-writer .claude/skills/interview-asset-writer .claude/skills/interview-prep-analyzer
git diff --name-only
```

성공 기준:

- 공부와 면접 skill contract가 같은 품질 기준을 공유한다.
- 공개 publish gate가 유지된다.
- 새 generated output은 만들지 않는다.

---

## Blocked / Failed 조건

- skill 파일이 없거나 현재 native skill 명칭이 바뀌었으면 `echo "PHASE_BLOCKED: study/interview skill path changed" && exit 2`.
- 공개 글 자동 publish 지시가 남아 있으면 `echo "PHASE_FAILED: public publish gate missing" && exit 1`.
- fos-study repo 파일이 변경되면 `echo "PHASE_FAILED: fos-study changed unexpectedly" && exit 1`.

---

## Self-check

- 공개용과 private용 문체를 분리한다.
- 특정 회사/지원 여부를 공개 글에 암시하지 않는다.
- skill contract 외 구현은 건드리지 않는다.
- 승인 없는 commit/push는 하지 않는다.
