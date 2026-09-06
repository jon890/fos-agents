# Phase 01. 작성 취향과 brain 조회 책임을 스킬 단계에 연결한다

**Execution profile**: standard

## 목표

회사에 관계없이 재사용할 이력서 taste를 스킬에서 소유하고, 편집 중 필요한 개인 맥락을 brain에서 보완한다.

**범위 외**: 실제 지원 원고와 PDF 변경, 개인 brain 저장, brain 플러그인 구현 변경.

## 컨텍스트

기준은 저장소 루트의 planning·build-with-teams 오버레이와 career-os/AGENTS.md다.
현재 스킬은 대표 사례 사실 확인에서 추가 확인이 필요할 때만 brain-search를 언급한다.
새 흐름은 초기 개인 맥락 조회, 편집 중 필요한 추가 조회, 사용자 정정 반영과 저장 후보 제안을 각 단계에 배치한다.

**근거 문서**:

- [제품 목표](../../docs/prd.md)의 지원 준비
- [조회와 환원 흐름](../../docs/flow.md)의 「이력서 작성 중 개인 맥락 조회와 환원」
- [소유권](../../docs/code-architecture.md)의 「후보자 지식과 이력서」
- [데이터 경계](../../docs/data-schema.md)의 지원 패키지

## 의도 메모

작성 취향은 스킬이 직접 소유한다. brain과 library에 같은 기준을 복제하면 수정 지점이 갈리므로 한 문서로 유지한다.
brain 조회·저장 구현은 설치된 brain-search와 brain-add를 재사용한다. 새로운 검색 API, 캐시, 상태 모델과 패키지는 필요하지 않다.
범위는 resume-preparer의 문서와 평가 자료다. 실제 지원 원고·PDF와 brain 지식 저장은 현재 구현 세션의 산출물에 포함하지 않는다.

## 작업 항목

### 1. references/resume-taste.md 작성

아래 확정된 개인 취향을 목표, 표현, 정보 구조, 함께 수정하는 방식 순서로 작성한다.
파일은 career-os/.claude/skills/resume-preparer/references/ 아래에 둔다.

- 목표: 경력과 일하는 방식을 지원 직무의 기여로 연결해 서류 합격 가능성을 최대한 높인다.
- 프로필: 현재 소속과 역할, 업무의 대상과 목적, 관심을 보여주는 실제 행동을 짧게 연결한다.
- 연차는 실제 재직 기간으로 계산하고 소개는 N년 차로 표현한다.
- 개발과 유지보수는 실제 역할에 맞춰 쓰고, 수식어가 실제 동작의 주체를 가리키게 한다.
- 도구와 프로젝트는 목적을 담은 제목, 핵심 행동과 결과의 짧은 항목으로 구성한다. 수치는 집계 기간과 확인 시점을 표시한다.
- 같은 내용을 가장 적절한 위치에서 한 번 설명한다.
- 기술 목록은 사용 범위와 판단을 설명할 수 있는 항목으로 선별한다. 테스트 경험은 관련 프로젝트의 검증으로 설명한다.
- 연락처는 이름과 값을 함께 표시하고, 회사명과 기간 아래에 프로젝트를 묶는다.
- 회사·학교의 실제 로고를 사용하고, 학력과 자격증을 독립 섹션으로 둔다.
- 학력은 재학 기간과 평점, 전공과 부전공을 각각 한 줄로 묶는다.
- 공식 브랜드 강조색은 지원별로 선택하고 제목·아이콘·구분선에 제한해 적용한다.
- 합의한 문구를 Markdown 원고에 반영하고 요청 시 PDF를 갱신하며 실제 배치를 확인한다.

현재 회사·기간·기술 목록·색상값·페이지 수는 예시 값으로 고정하지 않는다.
공통 resume-writing-style.md와 resume-design.md의 일반 검증 설명은 링크로 재사용한다.

### 2. references/brain-context.md 작성과 SKILL.md 연결

대표 사례 확인 단계에서 brain-search로 현재 경력·역할 선호·경험 경계를 조회한다.
원고 작성 단계에는 resume-taste.md를 연결하고, 추가 사실이 필요하거나 사용자 정정이 생기면 관련 질문만 재조회한다.
기존에 확인한 정보는 같은 편집 흐름에서 재사용한다.

출처와 현재 사용자 확인이 충돌하면 현재 문구는 최신 확인으로 수정하고 차이를 기록한다.
조회 결과가 없거나 도구가 실패하면 그 차이를 밝히고 현재 확인된 근거로 편집을 계속한다.
사실을 확정할 근거가 부족한 제출 문장만 후보자 확인 대상으로 남긴다.

새 합의의 분기:

- 개인 작성 취향: resume-taste.md에서 관리
- 재사용할 개인 사실·결정: brain-add의 후보 판정과 미리보기로 연결
- 지원별 표현과 수치: 기존 candidate-interview.md 계약으로 관리

brain-add의 사용자 승인과 public/private 선택은 해당 스킬이 수행한다.
이 구현은 brain 저장을 자동 승인하지 않는다.
개인 지식의 구체적인 slug·절대 경로·검색 구현은 설치된 스킬에서 찾는다.

### 3. 문서 검증 테스트

skill-creator의 quick_validate.py, 한국어 검사기, 가독성 검사기를 실행한다.
스킬 내부 링크가 실제 존재하고 해당 단계를 통해 두 참조에 도달하는지 확인한다.

## 검증

저장소 루트에서 실행한다. 설치된 skill-creator의 위치가 다르면 해당 SKILL.md가 안내하는 quick_validate.py를 사용한다.

```bash
# cwd: 저장소 루트
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py career-os/.claude/skills/resume-preparer
~/.claude/scripts/korean-style-check.sh career-os/.claude/skills/resume-preparer/SKILL.md career-os/.claude/skills/resume-preparer/references/resume-taste.md career-os/.claude/skills/resume-preparer/references/brain-context.md
python3 ~/.claude/scripts/check-readability.py career-os/.claude/skills/resume-preparer/SKILL.md career-os/.claude/skills/resume-preparer/references/resume-taste.md career-os/.claude/skills/resume-preparer/references/brain-context.md
git diff --check
python3 -c 'from pathlib import Path; p=Path("career-os/.claude/skills/resume-preparer"); s=(p/"SKILL.md").read_text(); sections=s.split("### "); checks={"2.": "brain-context.md", "3.": "resume-taste.md"}; assert all(any(part.startswith(step) and f"](references/{name})" in part for part in sections) and (p/"references"/name).is_file() for step,name in checks.items()); print("단계별 참조 링크와 대상 파일 확인 완료")'
```

- quick_validate.py: resume-preparer에 대해 종료 코드 0
- 한국어·가독성 검사: 변경한 Markdown에 대해 종료 코드 0
- git diff --check: 종료 코드 0
- 단계별 링크 검사: 대표 사례 사실 확인에서 brain-context.md, 원고 작성에서 resume-taste.md로 이동하는 링크와 파일 존재 확인

## Critical Files

| 파일 | 변경 |
| --- | --- |
| career-os/.claude/skills/resume-preparer/SKILL.md | 수정 |
| career-os/.claude/skills/resume-preparer/references/resume-taste.md | 신규 |
| career-os/.claude/skills/resume-preparer/references/brain-context.md | 신규 |
