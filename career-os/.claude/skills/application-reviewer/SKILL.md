---
name: application-reviewer
description: application-package-writer가 생성한 공고별 지원 패키지를 검토해 pass/revise/blocked 판정을 내리는 비공개 career-os skill. 근거 없는 주장·과장·drift·쿨다운·공개 금지 정보를 6개 축으로 심사. '지원 패키지 검토해줘', '리뷰해줘', 'review.md 만들어줘', '/application-reviewer' 슬래시 호출.
---

# Application Reviewer

application-package-writer가 생성한 공고별 지원 패키지가 실제 경력과 어긋나지 않는지 6개 축으로 심사하고 pass/revise/blocked 판정을 내리는 비공개 career-os skill.

## When to use

- 슬래시 호출: `/application-reviewer [application-dir]`
- 자연어 요청: "지원 패키지 검토해줘", "리뷰해줘", "review.md 만들어줘", "지원서 점검해줘"
- application-package-writer 완료 후 자동 호출 추천
- ledger에서 `needsUserReview=true` 항목 검토 시

실제 지원서 제출·로그인·채용 사이트 접속 자동화 안 함 — 사용자 승인 필요 항목으로만 안내.
`sources/fos-study/`에 아무것도 쓰지 않음.

## Inputs

Claude는 다음을 `Read` 도구로 직접 로드:

1. `career-os/data/applications/<company>/<role>/posting.md` — 공고 본문 (필수)
2. `career-os/data/applications/<company>/<role>/fit-analysis.md` — fit 분석 (필수)
3. `career-os/data/applications/<company>/<role>/application-package.md` — 지원 패키지 초안 (필수)
4. `career-os/config/candidate-profile.md` — 후보자 프로필 11섹션 (필수)
5. fit-analysis.md 및 application-package.md의 `## 근거 파일 참조` 에 명시된 근거 파일 — 선택적 Read
6. `career-os/data/applications/ledger.jsonl` — riskFlags / status / revisionCount 확인 (선택)

## Workflow

### 1. application directory 추출

자연어에서 application directory 또는 path를 추출한다.

- 예: `/application-reviewer data/applications/tossplace/applied-ai-engineer`
  → dir = `career-os/data/applications/tossplace/applied-ai-engineer`
- path가 없으면 `career-os/data/applications/ledger.jsonl`을 Read해 다음 조건의 첫 항목을 후보로 선택:
  - `needsUserReview=true` 또는 `status`가 `ready_for_user_review|preparing_application|needs_revision` 중 하나
  - 후보 선택 시 사용자에게 확인 후 계속
- dir 특정 불가 시 stderr + exit 1.

### 2. 컨텍스트 로드 (Read)

순서대로 Read:

1. posting.md
2. fit-analysis.md
3. application-package.md
4. `career-os/config/candidate-profile.md`
5. application-package.md의 `## 근거 파일 참조` 에서 관련성 높은 근거 파일 2~5개 선택적 Read
6. ledger.jsonl — riskFlags / revisionCount 확인

### 3. 6개 축 심사

다음 순서로 각 축을 분석한다.

#### 3-1. Evidence Guard (근거 없는 주장 여부)

application-package.md의 이력서 bullet, 지원동기, 직무별 강조 포인트를 검토:
- `needs_evidence` 마킹이 있는 항목 목록화
- 근거 파일 없이 수치·성과·기술 경험을 주장한 문장 식별
- 근거 파일이 실제 존재하는지 확인 (Read 결과 기반)

#### 3-2. Drift Review (공고 맞춤 중 경력 왜곡 여부)

application-package.md와 fit-analysis.md를 교차:
- 공고 키워드를 맞추기 위해 실제 경력에서 멀어진 표현이 있는지 확인
- 예: 짧은 TF 프로젝트를 "장기 운영 경험"처럼 서술하는 경우
- 예: 보조 기여를 "단독 설계·구현"처럼 과잉 주체화하는 경우

#### 3-3. Exaggeration Check (과장·허위 가능성)

- 수치 과장: 출처 문서에 없는 구체 수치·퍼센트·규모 삽입 여부
- 기술 스택 과장: 사용 경험 없는 기술을 "깊은 이해" 또는 "커스텀 경험"으로 서술하는 경우
- 역할 과장: 팀 작업을 단독 공헌처럼, 학습 수준을 운영 수준처럼 서술하는 경우

#### 3-4. Privacy / Publication Boundary (공개 금지 정보)

- 내부 코드명·팀명·비공개 도메인 지식 포함 여부
- 회사 내부 수치 (DAU, 매출, 트래픽 등) 무단 인용 여부
- PII(개인식별정보) 또는 타인 정보 포함 여부

#### 3-5. Cooldown / Duplication Risk (쿨다운·중복 지원)

ledger.jsonl의 riskFlags와 posting.md의 위험 플래그를 교차:
- `toss_group_cooldown`, `duplicate_application` 등 riskFlag 존재 여부 확인
- 동일 회사·그룹 내 복수 지원 이력이 있는지 ledger 전체 스캔
- `revisionCount >= maxRevisionCount`이면 진행 중단 권고

#### 3-6. User Approval Gate (사용자 승인 필요 항목)

다음 항목은 agent가 자동으로 수행할 수 없음 — 사용자 승인 필요:
- 실제 지원서 제출 / 채용 사이트 접속 / 계정 로그인
- needs_evidence 항목 실제 보강 여부 결정 (후보자 본인만 판단 가능)
- 쿨다운 리스크 수용 여부 (개인 전략 결정)
- 포지셔닝 전환 의사결정 (Java 백엔드 → Applied AI Engineer 등)

### 4. 최종 판정

6개 축 결과를 종합해 다음 중 하나로 판정:

- **`pass`**: 근거 있는 주장만 포함, drift·과장·공개 금지 없음, 리스크 플래그 없거나 사용자 확인 후 진행 가능
- **`revise`**: agent가 수정 가능한 구체 항목이 있음 (needs_evidence 강화, 과장 표현 수정 등). 수정 후 재심사 필요
- **`blocked`**: 공고 만료 / 쿨다운 리스크 / fixture-only / 심각한 근거 부족으로 진행 불가. source 근거 명시 필수

판정 기준:
- riskFlags에 `mvp_fixture_only`가 있으면 `blocked` — 실제 제출 판정 불가
- riskFlags에 `toss_group_cooldown` 등 쿨다운이 있으면 사용자 확인 전 `blocked`
- needs_evidence 항목이 필수 요건 1개 이상을 직접 충족해야 하는 경우 `revise` 이상
- 과장·허위 가능성 있는 항목이 1개 이상이면 최소 `revise`

### 5. review.md 작성 (Write)

저장 경로: `career-os/data/applications/<company>/<role>/review.md`

필수 구조:

```markdown
# <Company> <Role> — Application Review

## Verdict

- result: pass|revise|blocked
- confidence: low|medium|high
- needsUserReview: true

## Evidence Guard

## Drift Review

## Exaggeration Check

## Privacy / Publication Boundary

## Cooldown / Duplication Risk

## User Approval Gate

## Revision Requests

## Ledger Update Suggestion
```

작성 규칙:
- 각 축 섹션에 심사 결과 요약 + 구체 근거 문장 명시
- `revise`일 경우 `## Revision Requests`에 agent가 수정 가능한 구체 항목 3개 이상
- `blocked`일 경우 `## Revision Requests`에 차단 근거 + source 경로(ledger/posting/riskFlag) 명시
- `pass`일 경우에도 `## User Approval Gate`에 사용자 승인 필요 항목 목록화
- 총 30줄 이상

**Ledger Update Suggestion 섹션 (필수)**:

```markdown
## Ledger Update Suggestion

- current_status: <ledger에서 읽은 현재 status>
- suggested_next_status: needs_revision|ready_for_user_review|blocked
- revisionCount: <ledger revisionCount + 1 또는 현재 값>
- needsUserReview: true
- nextActions:
  - <판정에 따른 next action>
```

### 6. Self-check (최대 3회)

review.md 작성 후 아래 항목 검증. 실패 시 해당 섹션 재작성:

1. `review.md` 줄 수 ≥ 30
2. `## Verdict` 섹션에 `result: pass|revise|blocked` 중 하나 존재
3. `## User Approval Gate` 섹션 존재
4. `revise`일 경우 `## Revision Requests`에 3개 이상 구체 항목 존재
5. `blocked`일 경우 `## Revision Requests`에 source 경로 포함 차단 근거 존재
6. `sources/fos-study/` 아래 어떤 파일도 쓰지 않았는지 확인
7. 제출·로그인·외부 계정 작업 실행 지시가 없음 확인

실패 항목 있으면 수정 후 재작성. **최대 3회**. 4회째도 실패 시 `stderr: application-reviewer 검증 실패: <항목>` + exit 1.

## Error handling

| 상황 | 처리 |
|---|---|
| application dir 특정 불가 | stderr + exit 1 |
| posting.md / fit-analysis.md / application-package.md 부재 | stderr + exit 1 |
| candidate-profile.md 부재 | stderr + exit 1 |
| ledger.jsonl 부재 (자동 선택 시) | stderr warn + dir를 사용자에게 직접 입력 요청 |
| 근거 파일 Read 실패 | stderr warn + 해당 파일 없이 계속 진행 (evidence guard 강화) |
| self-check 3회 실패 | stderr + exit 1, 실패 항목 명시 |

## Why this design

- **Phase 05 연계**: application-package-writer(Phase 04)가 생성한 패키지를 독립 심사자로 교차 검증. 생성과 심사를 분리해 자기 편향을 줄임.
- **6축 분리**: 각 리스크 유형을 독립 섹션으로 분리해 revisit 용이. revision 요청을 축 단위로 추적 가능.
- **판정 3단계**: pass/revise/blocked로 명확히 분기 — revise는 agent 수정 루프로, blocked는 사용자 개입으로 라우팅 (Phase 07 e2e 리허설 연계).
- **ADR-032 직접 갱신 금지**: ledger를 직접 수정하지 않고 `Ledger Update Suggestion`으로 사용자 의사결정 유도.
- **fixture 안전 장치**: `mvp_fixture_only` riskFlag가 있으면 판정이 `blocked` 이상을 강제 — 실제 제출 경로를 차단.

## References

- `career-os/docs/adr.md` — ADR-032 application ledger 스키마 설계 근거
- `career-os/docs/data-schema.md` — ledger.jsonl 스키마
- `career-os/data/applications/ledger.jsonl` — 지원 이력 원장
- `career-os/config/candidate-profile.md` — 후보자 프로필 단일 출처
- `career-os/.claude/skills/application-package-writer/SKILL.md` — 생성 단계 skill (Phase 04)
