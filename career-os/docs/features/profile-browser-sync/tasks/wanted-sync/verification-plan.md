# 원티드 프로필 반영 인수 검증 계획

## 인수 검증 계획

| 요구사항 | 준비 조건 | 실행 절차 | 기대 결과 | 실행 환경 | 실행 담당 | 선행 조건 | 시점 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ1 | `BrowserLink` 대역과 이력서 응답 fixture, `connector.json` | `cd career-os/plugin && bun test src/wanted/tools.test.ts scripts/connector-config.test.ts` | 읽기 시나리오가 칸마다 `field`, `label`, `value`, `fingerprint` 를 돌려주고, 선언 테스트가 `get_wanted_resume` 의 `approval: none` 을 확인 | 로컬 bun 테스트 | worker | 없음 | PR 전 |
| REQ3 | `connector.json` | `cd career-os/plugin && bun test scripts/connector-config.test.ts src/tool-metadata.test.ts src/wanted/fields.test.ts` | `update_wanted_resume` 이 WRITE·required·`grant: false`·대화 허락 없음, 16,000바이트 초과 인자 거절, 도구 설명에 「나눠」 단언 | 로컬 bun 테스트 | worker | 없음 | PR 전 |
| REQ4 | 정상 세 칸 시나리오와 「화면만 바뀌고 서버 저장 안 됨」 시나리오 | `bun test src/wanted/tools.test.ts` | 세 칸 모두 `inserted`. 저장 안 됨은 `failed`(`not_saved`) | 로컬 bun 테스트 | worker | 없음 | PR 전 |
| REQ5 | 둘째 칸 실패, 둘째 칸 지문 다름 시나리오 | 같은 테스트 | 「inserted, failed, not_inserted」 와 지문 다름 칸의 `not_inserted`(`fingerprint_mismatch`), 결과가 `isError` 아님, 도구 설명에 「자동으로 다시 부르지 않는다」 | 로컬 bun 테스트 | worker | 없음 | PR 전 |
| REQ6 | 읽기 중·실행 중 로그인 화면 시나리오 | 같은 테스트 | 읽기는 넘기기 `login` 모양, 실행은 `stopped` 와 `login_required` | 로컬 bun 테스트 | worker | 없음 | PR 전 |
| REQ6 | 사용자 원티드 계정, 「내 브라우저」 에서 로그아웃 | 비서 웹에서 원티드 반영을 요청. 이어서 승인 카드를 띄운 채 「내 브라우저」 에서 로그아웃한 뒤 승인 | 읽기 때 대화에 넘기기 카드가 뜨고 로그인 뒤 「다 했어요」 로 이어진다. 실행 중 로그아웃이면 비서가 멈췄다고 알리고 다시 읽어 카드를 띄우며, 같은 인자로 다시 부르지 않는다 | 배포된 비서 웹과 실제 원티드 계정 | 코디네이터 | 배포 (그 뒤 바인딩 재설치) | PR 뒤 |
| REQ7 | 화면 칸 없음 시나리오 | `bun test src/wanted/tools.test.ts` | `not_inserted`(`page_changed`), 도구 설명에 대안 안내 | 로컬 bun 테스트 | worker | 없음 | PR 전 |
| REQ2, REQ8, REQ12 | 사용자 원티드 계정과 `wanted` 원고 | 비서 웹에서 「원티드 프로필 최신화해 줘」 → 표 확인 → 문장 하나를 대화로 고침 → 승인 → 결과 → 원고 저장 승인 | 다른 칸만 표, 고친 문장이 카드에 그대로, 비서가 다듬은 문장에 「비서 제안」, 새 사내 수치나 조직명이 들어가면 표 위에서 공개 여부를 먼저 묻는다, 반영 뒤 원고 저장 카드가 따로 뜨고 저장된 원고가 사이트 값과 같다 | 배포된 비서 웹과 실제 원티드 계정 | 코디네이터 | 배포 (그 뒤 바인딩 재설치) | PR 뒤 |
| REQ9 | 범위 밖 칸 인자 | `bun test src/wanted/fields.test.ts` | `skills` 같은 범위 밖 `field` 를 거절 | 로컬 bun 테스트 | worker | 없음 | PR 전 |
| REQ10 | 연결용 지침 | `cd career-os/plugin && bun test scripts/connector-config.test.ts` | 본문 8,000자 이하, 모든 도구 이름 포함 | 로컬 bun 테스트 | worker | 없음 | PR 전 |
| REQ11 | 중계 주소 빈 값 | `bun test src/wanted/tools.test.ts src/browser/cdp.test.ts` | `CAREER_BROWSER_UNREACHABLE`, 탭 요청 0회 | 로컬 bun 테스트 | worker | 없음 | PR 전 |
| REQ13 | 이력서 둘 fixture | `bun test src/wanted/tools.test.ts` | `status: "choose"` 와 목록, 쓰기 인자에 `resumeKey`·`resumeTitle` 필수 | 로컬 bun 테스트 | worker | 없음 | PR 전 |
| REQ1, REQ4 | 사용자 원티드 계정 | 실제 계정에서 읽기와 칸 하나 반영 | 회사 이름 키, 편집 화면 주소, 목록 항목 모양, 로그인 판정이 실제 화면과 맞고, 넣은 칸이 서버에 저장된다 | 배포된 비서 웹과 실제 원티드 계정 | 코디네이터 | 배포 (그 뒤 바인딩 재설치) | PR 뒤 |
| REQ3 | 사용자 원티드 계정, 본문 셋을 통째로 바꾸는 큰 변경 | 비서 웹에서 큰 변경을 요청하고 승인 | 승인 카드가 두 장 이상으로 나뉘고, 앞 카드의 칸이 모두 넣음일 때만 다음 카드가 뜬다 | 배포된 비서 웹과 실제 원티드 계정 | 코디네이터 | 배포 (그 뒤 바인딩 재설치) | PR 뒤 |
