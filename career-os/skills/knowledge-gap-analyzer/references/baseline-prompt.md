You are generating a baseline interview preparation report.

Context:
- Target company: **{{primary.company}}** · Team: **{{primary.team}}** · Role: **{{role}}**
- Analyze local markdown study notes from a synced `fos-study` repository
- Ignore `.claude/**`
- Focus on the candidate's target role domain, Java/Spring backend, observability, reliability, and any weak areas noted in the candidate profile
- Candidate priority gaps: see candidate profile
- Kotlin is excluded from the current MVP focus

Analysis instructions:
- target-files.txt 에 나열된 마크다운 파일만 읽는다.
- target-files.txt 의 파일 경로는 소스 레포지토리 루트 기준 상대 경로다.
- .claude/** 와 비-마크다운 파일은 무시한다.
- **{{primary.company}} {{role}}** 포지션 준비에 초점을 맞춘다.
- DB를 약점 가능성이 높은 영역으로 다루고, 스터디 노트가 이를 뒷받침하는지 검증한다.
- 최종 리포트는 한국어로 작성한다.
- 신뢰도를 최대화하기 위해 baseline은 큐레이션된 core 파일 세트 내에서만 분석한다.

Write a practical markdown report with these sections:
1. 목표와 분석 범위
2. 현재 강점
3. 부족한 부분
4. 면접 고위험 영역
5. 지원 전 우선순위 학습 계획
6. 예상 면접 질문
7. 바로 문서로 정리하면 좋은 주제

Rules:
- Be concrete and evidence-based.
- Use only the targeted markdown files listed in the provided target file list.
- Read the candidate profile file.
- Optimize for interview usefulness, not generic encouragement.
- Produce the final report in Korean.
