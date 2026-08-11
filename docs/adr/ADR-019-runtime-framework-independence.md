# ADR-019 — 외부 agent runtime 종속성을 제거한다

## Status

Accepted

## Context

`fos-agents`의 일부 runner와 문서는 특정 외부 agent runtime의 cron, HUD, 메시지 전송 기능을 전제로 한다.
그 의존성은 워크스페이스의 데이터 처리와 문서 작성 책임에 필요하지 않다.

특정 runtime을 사용하지 않는 환경에서는 실행 경로가 불필요하게 실패한다.
외부 전달 채널과 스케줄러도 저장소의 정본이 아니므로,
저장소에 구현 세부를 둘 이유가 없다.

## Decision

저장소는 외부 agent runtime과 메시지 전달 채널에 직접 의존하지 않는다.

- runtime CLI를 실행하는 공용 helper와 HUD helper를 제거한다.
- runner는 로컬 파일 산출물, 표준 출력, 종료 코드만 계약으로 삼는다.
- 자동 실행 시점과 외부 전달은 저장소 밖에서 선택한다.
- `.env`에는 작업 자체에 필요한 비밀 값만 두며, 특정 전달 채널 식별자는 두지 않는다.
- 현재 가이드와 실행 코드는 특정 runtime 이름이나 전용 경로를 언급하지 않는다.

agent skill의 정본과 노출 경로는 이 결정의 범위가 아니다.
이는 현재 사용하는 agent 도구와의 호환 구조이며,
실행 runtime의 cron·메시지·HUD 의존성과 구분한다.

## Consequences

자동 실행 결과는 외부 채널에 자동 전송되지 않는다.
필요한 환경은 runner의 stdout과 생성 파일을 읽어 자체 방식으로 전달할 수 있다.

현재 코드와 운영 문서에는 외부 runtime 의존성을 새로 추가하지 않는다.
