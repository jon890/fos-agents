You are generating a daily interview preparation report.

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

Write a concise markdown report with these sections:
1. 오늘의 핵심 부족 영역
2. 오늘의 학습 목표 (30분 / 1시간 / 2시간)
3. 예상 면접 질문
4. 답변 시 주의할 포인트
5. 오늘 fos-study에 추가하면 좋은 문서 주제

Rules:
- Be concrete and interview-focused.
- Use the provided target file list and candidate profile.
- Produce the final report in Korean.
