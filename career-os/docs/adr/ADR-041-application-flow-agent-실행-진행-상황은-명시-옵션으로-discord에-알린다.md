## ADR-041 — application-flow-agent 실행 진행 상황은 명시 옵션으로 Discord에 알린다

- Status: Accepted
- Date: 2026-06-04

### 맥락

`--execute-skills`는 실제 Claude native skill을 실행하므로 몇 분 동안 외부에서 진행 상황이 보이지 않는다. 사용자는 내부 블랙박스 영역에서 어떤 단계가 돌고 있는지 인지할 필요가 있다. 동시에 지원 패키지와 리뷰 본문은 private 전략 자산이므로 Discord 알림에 그대로 노출하면 안 된다.

### 결정

- `--notify-discord` 명시 옵션을 추가한다.
- 알림은 `--execute-skills` 실제 실행에서만 의미 있게 보낸다. dry-run에서는 보내지 않는다.
- 알림 범위는 private-safe progress 정보로 제한한다.
  - decision 시작
  - skill 시작/완료/실패
  - 산출물 누락
  - ledger 갱신 완료
  - execution gate 대기
- 알림에는 지원 패키지 본문, 이력서 bullet 상세, private strategy note, review 상세 지적을 포함하지 않는다.
- Discord 알림 실패는 runner 본 작업 실패로 전파하지 않고 warning으로만 남긴다.

### 결과

- 사용자는 장기 실행 중 현재 단계와 실패 지점을 빠르게 알 수 있다.
- application-agent는 기존처럼 CLI stdout에도 상세 결과를 남긴다.
- Discord 채널에는 민감한 지원 전략 대신 진행 상태만 노출된다.
