## ADR-067 — coffeechat 자동화 tombstone도 제거하고 ADR-only history로 둔다

- Status: Accepted
- Date: 2026-06-08

### 맥락

ADR-048로 coffeechat 자동화는 이미 active workflow에서 폐기됐고, first-round/final-round/offer 준비는 `interview-prep-analyzer`로 이관됐다.
그 뒤에도 `.claude/skills/interview-coffeechat-prep/`와 `scripts/interview-coffeechat-prep/`는 tombstone으로 남아 있었고, `config/mvp-target.json`과 schema에는 `coffeechat: null` compatibility field가 남아 있었다.

사용자는 coffeechat이 지원 흐름과 통합할 만큼 일관된 workflow가 아니라고 판단했고, scripts와 문서의 coffeechat 관련 active 흔적을 제거하길 원했다.
따라서 이제 tombstone 파일도 제거하고, coffeechat 폐기 결정은 ADR/task history에만 남긴다.

### 결정

- skill 디렉터리와 script 디렉터리에서 `interview-coffeechat-prep` 관련 자산을 제거한다.
- `mvp-target.json`과 schema에서 coffeechat 호환 필드를 제거한다.
- active docs, AGENTS, candidate-profile에서 coffeechat을 현행 흐름처럼 언급하지 않는다.
- `interview-prep-analyzer`는 `first_round`, `final_round`, `offer_chat`만 지원한다.
- 과거 task 기록은 구현 이력으로 보존하되, active guide처럼 오해될 수 있는 최신 docs·skill index에서는 제거한다.
- 과거 data 산출물은 이번 cleanup 대상으로 보지 않고, data retention cleanup이 필요하면 후속 plan에서 다룬다.

### 결과

- coffeechat 자동화가 active code path와 docs에서 완전히 사라진다.
- 면접 준비 workflow는 first-round/final-round/offer 중심으로 단순화된다.
- history는 ADR/task에 남아 과거 의사결정을 추적할 수 있다.
- 향후 coffeechat 요청은 별도 표준 자동화가 아니라 상황별 수동 리서치/일회성 준비로만 다룬다.
