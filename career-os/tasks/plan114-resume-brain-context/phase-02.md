# Phase 02. 조회와 환원 분기를 독립적으로 검증한다

**Execution profile**: standard

## 목표

스킬이 작성 취향을 다른 공고에도 적용하면서 필요한 개인 맥락만 조회하는지 검증한다.

**범위 외**: 실제 지원 데이터 수정과 개인 brain 쓰기, 새 검색 인프라 구축.

## 컨텍스트

Phase 01의 SKILL.md와 두 참조를 대상으로 한다.
기존 평가 형식은 career-os/.claude/skills/resume-preparer/evals/evals.json이다.
**근거 문서**: [조회와 환원 흐름](../../docs/flow.md)의 「이력서 작성 중 개인 맥락 조회와 환원」이다.
평가에는 합성 후보자와 가상의 공고·검색 결과를 사용한다.

## 작업 항목

### 1. 평가 시나리오 추가

기존 evals.json의 식별자 다음부터 추가한다.

1. 새 회사 지원: 현재 회사 이름이나 브랜드 색상값을 복사하지 않고 taste로 표현과 배치를 선택한다.
2. 연속 문구 편집: 조회한 경력 정보를 재사용하고 사실 질문이 새로 생길 때만 추가 조회한다.
3. 사용자 정정: 과거 brain 기록과 현재 사용자의 역할 설명이 다를 때 현재 설명을 반영하고 저장 후보를 구분한다.
4. 검색 결과 없음과 도구 실패: 두 경우를 구분하고 확인된 정보로 작업하며 미확인 주장을 만들어내지 않는다.
5. 취향과 사실 구분: 표현 선호는 스킬 참조로, 새 개인 경력 사실은 brain-add 미리보기로 연결한다.
6. 저장 승인 대기와 원격 revision 충돌: 실제 저장은 brain-add 계약을 따르고 지원 데이터 충돌은 기존 동기화 절차를 따른다.

### 2. 독립 실행 검증

작성 과정과 의도한 답변을 보지 않은 검토자가 최소 세 시나리오를 합성 입력으로 실행한다.
executor는 평가 시나리오를 추가한 뒤 team-lead에게 별도 검토자 배정을 요청한다.
team-lead는 구현에 참여하지 않은 네이티브 검토자를 배정하고, 스킬과 합성 사용자 입력·검색 응답만 전달한다.
검토자에게 expected_output, expectations와 작성자 설명은 전달하지 않는다.
관찰 대상은 실제 선택한 조회 질문, 적용한 출처, 미확인 문장의 처리, 저장 제안과 실행의 구분이다.
실제 brain과 진행 중인 지원 데이터는 수정하지 않는 평가로 실행한다.
검토자는 합성 응답을 사용한 모의 실행임을 밝히고 시나리오별 입력, 실제 응답과 관찰 결과를 team-lead에게 회신한다.
team-lead는 원문 관찰 기록을 저장소 밖 임시 파일에 보존하고 executor에게 결과를 전달한다.
executor는 완료 보고의 「검증」에 시나리오별 관찰 결과와 기록의 절대경로를 남긴다.
발견된 문제를 해당 phase 담당자에게 돌려 수정하고 재검증한다.

### 3. 회귀 테스트

저장소 루트에서 `bun test ./career-os/.claude/skills/`를 실행한다.
스킬 검증과 Markdown 검사를 다시 실행하고 결과를 구현 보고에 기록한다.
검토와 통합 검증이 통과하면 team-lead가 index.json의 status를 completed로 표시한다.

## 검증

```bash
# cwd: 저장소 루트
bun test ./career-os/.claude/skills/
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py career-os/.claude/skills/resume-preparer
~/.claude/scripts/korean-style-check.sh career-os/.claude/skills/resume-preparer/SKILL.md career-os/.claude/skills/resume-preparer/references/resume-taste.md career-os/.claude/skills/resume-preparer/references/brain-context.md
python3 ~/.claude/scripts/check-readability.py career-os/.claude/skills/resume-preparer/SKILL.md career-os/.claude/skills/resume-preparer/references/resume-taste.md career-os/.claude/skills/resume-preparer/references/brain-context.md
git diff --check
python3 -c 'import json; from pathlib import Path; d=json.loads(Path("career-os/.claude/skills/resume-preparer/evals/evals.json").read_text()); e=d["evals"]; ids=[x["id"] for x in e]; assert d["skill_name"]=="resume-preparer" and len(ids)==len(set(ids)) and set(range(1,15)).issubset(ids); assert all(isinstance(x["prompt"],str) and x["prompt"].strip() and isinstance(x["expected_output"],str) and x["expected_output"].strip() and isinstance(x["files"],list) and isinstance(x["expectations"],list) and x["expectations"] and all(isinstance(v,str) and v.strip() for v in x["expectations"]) for x in e); print("평가 JSON 필수 필드와 고유 식별자 확인 완료")'
```

- 기존 스킬 테스트 통과
- 새 평가 시나리오의 실제 관찰 결과와 실패 시 보완 내용 기록
- 별도 검토자가 수행한 최소 세 시나리오의 모의 실행 원문과 임시 기록 경로가 executor 보고에 포함됨
- 평가 JSON 구조와 식별자 검사 통과
- quick_validate.py, 한국어·가독성 검사, git diff --check 통과

## Critical Files

| 파일 | 변경 |
| --- | --- |
| career-os/.claude/skills/resume-preparer/evals/evals.json | 수정 |
| career-os/.claude/skills/resume-preparer/SKILL.md | 검증 및 필요 시 수정 |
| career-os/.claude/skills/resume-preparer/references/resume-taste.md | 검증 및 필요 시 수정 |
| career-os/.claude/skills/resume-preparer/references/brain-context.md | 검증 및 필요 시 수정 |
