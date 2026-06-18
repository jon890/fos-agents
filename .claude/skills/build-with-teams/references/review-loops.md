# build-with-teams reference: 리뷰 루프 메커니즘

code-reviewer FIX_NEEDED 루프, docs-verifier UPDATE/VIOLATION 루프, 자기-면제 금지 규칙.

## code-reviewer 판정 + FIX_NEEDED 루프 (7단계)

판정 (SendMessage로 team-lead에게 회신):

- **PASS** → 8단계로
- **FIX_NEEDED** → team-lead가 executor에게 수정 목록 전달 → executor 수정 → code-reviewer 재검사 (한도 2회)

## docs-verifier 판정 + UPDATE/VIOLATION 루프 (8단계)

판정:

- **PASS** → 9단계로
- **UPDATE_NEEDED** → team-lead가 docs 업데이트 후 재검증 (한도 2회)
- **VIOLATION** → team-lead가 코드 수정 지시 (executor 재투입, 한도 2회)

## 자기-면제 금지 (CRITICAL — code-reviewer · docs-verifier 공통)

**code-reviewer FIX_NEEDED 처리 시**:

code-reviewer 가 FIX 회신에 _"재검사 불필요"_ / _"단순 변경이라 검증 생략 가능"_ 같은 자기-면제 문구를 포함하더라도 **그대로 수용 금지**.
자기 자신의 검토를 자기가 면제하는 것은 OMC `<execution_protocols>` 의 "Never self-approve in the same active context" 위반.

수정 주체와 무관하게 **모든 FIX 후 재검사 SendMessage 강제**:

| 수정 시나리오                                             | 처리                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| executor 가 수정 (다중 파일·로직 변경)                    | executor 수정 commit → code-reviewer 재검사 SendMessage             |
| team-lead 직접 수정 (1줄 이동·rename·typo 등 trivial fix) | team-lead 수정 commit → **여전히** code-reviewer 재검사 SendMessage |
| code-reviewer 본인 _"재검사 불필요"_ 명시                 | 무시. 재검사 SendMessage.                                           |

빌드/테스트 통과는 자체 검증을 대신하지 못한다 — 정적 검사·관습·매직넘버 같은 항목은 빌드를 통과해도 잡혀야 한다.
재검사 한도 2회 카운터는 동일하게 적용 — 한도 초과 시 `PHASE_BLOCKED`.

**Why**: trivial 한 1줄 수정도 회귀 가능.
더 중요한 건 일관성 — "code-reviewer 가 면제했으니 OK" 가 한 번 통과되면 다음 plan 부터는 더 큰 수정도 면제 요청이 들어올 수 있다.
그때도 자기-승인 회피 원칙이 깨진다.

**docs-verifier UPDATE_NEEDED / VIOLATION 처리 시**:

docs-verifier 가 _"내용 확인 수준으로 충분"_ / _"재검증 없이 PR 진행 가능"_ 같은 자기-면제 문구를 회신에 포함하더라도 **그대로 수용 금지**.
동일 원칙 적용.

| 수정 시나리오                                                          | 처리                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| docs 갱신 (UPDATE_NEEDED) — team-lead 직접 수정 / executor 재투입 무관 | docs 수정 commit → docs-verifier 재검증 SendMessage 강제     |
| 코드 수정 (VIOLATION) — executor 재투입                                | executor 수정 commit → docs-verifier 재검증 SendMessage 강제 |
| docs-verifier 본인 _"재검증 불요"_ 명시                                | 무시. 재검증 SendMessage.                                    |

재검증 한도 2회 카운터 동일 적용. 한도 초과 시 `PHASE_BLOCKED: docs-verifier 한도 초과 — docs/코드 정합성 수동 점검`.

**Why**: 일관성 측면.
UPDATE_NEEDED 가 3곳 같이 잡혔는데 그중 1곳을 잘못 갱신했어도 자기-면제로 묻히면 다음 plan 부터 PASS 신뢰성이 떨어진다.
