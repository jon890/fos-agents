# Phase 02. skill을 판단 기준으로 다시 쓴다

**Execution profile**: deep

## 목표

`position-recommender` skill 문서를 실행 절차 나열에서
「무엇을 판단하는가」로 바꾼다.

명령은 넷만 남기고, 판정 기준은 `references/`로 내린다.

**범위 외**: 다른 다섯 skill의 문서. 근거 수집기는 셋째 계획이다.

## 컨텍스트

지금 `SKILL.md`는 171줄에 명령 블록이 17개이고 「목표」 절이 없다.
무엇을 전달하는 skill인지 한 줄도 적혀 있지 않다.

Phase 01이 진입점을 넷으로 줄였고, 첫째 계획이 파일 동기화를 없앴다.
그래서 지금 문서가 설명하는 절차 대부분이 이미 사라졌다.

이 저장소의 skill 여섯 중 「목표」 절이 있는 것은 둘뿐이다.
`study-topic-recommender`의 17줄짜리 「목표」 절이 가장 가까운 본보기다.

`references/` 디렉터리가 이 skill 번들에 아직 없다.
`interview-practice`와 `application-package-writer`가 쓰는 배치를 따른다.

**근거 문서**: `docs/prd.md`의 「position-recommender」 절,
`docs/flow.md`의 「position-recommender」 절,
`docs/adr/ADR-125-회사-판정은-세-축을-각각-낸다.md`

## 의도 메모

**절차를 문서에서 지우는 것이 아니라 명령 뒤로 옮긴 것이다.**
Phase 01이 그 자리를 만들었다. 이 phase는 문서만 고친다.
문서에서 지운 단계가 명령 안에 실제로 있는지 확인하지 않고 지우면
실행이 조용히 빠진다.

**판정 기준을 `SKILL.md` 본문에 두지 않는다.**
축 셋의 판정 기준과 근거의 종류는 길고 자주 바뀐다.
`references/judgment.md`가 소유하고 `SKILL.md`는 그것을 가리킨다.

**최종 답변 형식은 `SKILL.md`가 계속 소유한다.**
`docs/flow.md`가 그렇게 적고 있고 cron과 수동 실행이 같은 형식을 쓴다.
이것을 `references/`로 내리면 cron 실행이 형식을 찾지 못한다.

**명령을 아예 없애지 않는다.**
넷은 남긴다. 모델이 무엇을 부를지 알아야 하고,
`--run`을 이어 주는 것은 모델의 일이다.

## 작업 항목

### 1. `SKILL.md`에 「목표」 절을 만든다

한 문장으로 시작한다. 이 skill이 전달하는 것은
「지금 열린 공고 가운데 지원할 가치가 있는 것을 고르고, 그 회사가 어떤 곳인지 세 축으로 판정한다」다.

이어서 무엇을 판단해야 하는지를 적는다.

- 이 공고의 역할이 후보자가 해온 일과 맞는가
- 그 회사에서 기술적으로 성장할 수 있는가
- 그 팀이 커지고 있는가
- 보상과 복지가 지금보다 나은가

**근거가 없는 축은 지어내지 않고 「근거 없음」으로 남긴다**를 함께 적는다.

### 2. 실행 절을 명령 넷으로 줄인다

각 명령마다 한 줄로 무엇을 하는지와, 그 뒤에 모델이 무엇을 판단해야 하는지를 적는다.

```
collect                → 다음은 회사 판정이다
commit-company-tiers   → 다음은 공고 분석이다
commit-analyses        → 다음은 최종화다
finalize               → 리포트가 나온다
```

플래그는 `--run` 하나만 적는다.
중간 파일 경로와 이름은 적지 않는다. 명령이 stdout에 낸다.

### 3. `references/judgment.md`를 만든다

담을 것이다.

- 축 셋이 각각 무엇에 답하는지
- 축마다 어느 근거를 보는지
- 근거가 없을 때 `unknown`으로 두는 규칙과 그 이유
- 공고 분석의 배점 넷과 `recommend`와 `consider`와 `hold`의 경계

지금 `SKILL.md`의 「회사 tier 평가」와 「선택된 공고 분석」 절에 흩어져 있는 판정 문장을 옮긴다.

### 4. `references/failures.md`를 만든다

실패 사유 코드와 그때 무엇을 하는지를 표로 담는다.
`posting_body_missing`, `research_unavailable`, `model_unavailable`,
`contract_rejected`, `internal_error` 다섯이다.

지금 `SKILL.md` 본문에 섞여 있는 실패 처리 문장을 옮긴다.

### 5. 「최종 답변」 절을 손보고 공개 경계를 유지한다

축 셋을 보여준다는 것을 더한다.
공개 HTML에 넣지 않는 것의 목록은 그대로 둔다.
`assessment`가 공개에 들어가지 않는다는 줄을 더한다.

### 6. 이 phase를 검증하는 검사

`scripts/position-recommender/skill_doc.test.ts`를 만든다.
`SKILL.md` 본문을 읽어 확인한다.

- 「목표」 절이 있다
- 명령 블록이 다섯 개 이하다
- `skill begin`, `skill finish`, `company_research.ts`,
  `collect_live_postings.ts`, `prepare_position_analysis.ts` 문자열이 없다
- `references/judgment.md`와 `references/failures.md`가 실재한다
- 「최종 답변」 절이 남아 있다

문서가 다시 절차로 자라는 것을 이 검사가 막는다.

## 검증

```bash
# cwd: 저장소 루트
bun test career-os/scripts/position-recommender
bunx tsc --noEmit
```

```bash
# cwd: 저장소 루트
"$HOME/.claude/skills/korean-check/scripts/check.sh" \
  career-os/.claude/skills/position-recommender/SKILL.md \
  career-os/.claude/skills/position-recommender/references/judgment.md \
  career-os/.claude/skills/position-recommender/references/failures.md
```

기대값이다.

- 위 셋이 모두 종료 코드 0
- `skill_doc.test.ts`의 항목이 모두 통과

**문서가 실제로 줄었는지 센다.**

```bash
# cwd: career-os/.claude/skills/position-recommender
wc -l SKILL.md
grep -c '^```bash' SKILL.md
```

`SKILL.md`가 171줄보다 짧고 명령 블록이 5개 이하여야 한다.

## 이 plan 을 마감한다

위 검증이 모두 통과하면 `tasks/plan127-position-skill-value/index.json` 의
`status` 를 `completed` 로 바꾸고 `current_phase` 를 2 로 둔다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/position-recommender/SKILL.md` | 수정 |
| `career-os/.claude/skills/position-recommender/references/judgment.md` | 신규 |
| `career-os/.claude/skills/position-recommender/references/failures.md` | 신규 |
| `career-os/scripts/position-recommender/skill_doc.test.ts` | 신규 |
