# 원격 검증

| 선행 조건 | 실행 위치 | 명령 | 기대값 |
|---|---|---|---|
| PR 을 머지하고 fos-assistant 가 새 `career-os/plugin` 판을 읽은 뒤 | fos-assistant 웹 화면의 커리어 연결 | 연결 확인을 다시 누르거나 커넥터를 다시 등록한다 | 연결이 `READY` 이고 도구 열여섯 개가 보인다 |
| 위 연결이 `READY` 인 뒤 | fos-assistant 대화 | "기술 면접 연습 한 문제 내 줘" 로 시작해 답한 뒤 기록 승인 카드를 승인한다 | `get_interview_questions` 가 질문을 내고, 승인한 `save_interview_attempt` 결과에 `progress` 가 온다 |
| 위 연결이 `READY` 인 뒤 | fos-assistant 대화 | "오늘 공부 주제 추천해 줘" 로 시작해 추천 저장 승인 카드를 승인한다 | `get_study_candidates` 가 후보를 내고, 승인한 `save_study_recommendation` 결과에 `reportId` 가 온다 |
