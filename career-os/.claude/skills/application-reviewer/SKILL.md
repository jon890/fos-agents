---
name: application-reviewer
description: application-package-writer가 생성한 공고별 지원 패키지를 검토해 pass/revise/blocked 판정을 내리는 비공개 career-os skill. 근거 없는 주장·과장·drift·쿨다운·공개 금지 정보를 6개 축으로 심사. '지원 패키지 검토해줘', '리뷰해줘', 'review.md 만들어줘', '/application-reviewer' 슬래시 호출.
---

# Application Reviewer

application-package-writer가 생성한 공고별 지원 패키지가 실제 경력과 어긋나지 않는지 6개 축으로 심사하고 pass/revise/blocked 판정을 내리는 비공개 career-os skill.
내부 전략 문서와 제출용 Markdown 초안을 함께 검토한다.

## When to use

- 슬래시 호출: `/application-reviewer [application-dir]`
- 자연어 요청: "지원 패키지 검토해줘", "리뷰해줘", "review.md 만들어줘", "지원서 점검해줘"
- application-package-writer 완료 후 자동 호출 추천
- ledger에서 `needsUserReview=true` 항목 검토 시

실제 지원서 제출·로그인·채용 사이트 접속 자동화 안 함 — 사용자 승인 필요 항목으로만 안내.
`sources/fos-study/`에 아무것도 쓰지 않음.

## 생성 산출물 품질 계약

review.md는 내부 검토 문서다.
사용자가 바로 수정하거나 승인 보류를 판단할 수 있게 결론과 행동을 앞에 둔다.

- 한국어 우선 섹션 제목과 자연스러운 한국어 문장을 사용한다.
  `pass`, `revise`, `blocked`, `Ledger Update Suggestion` 같은 판정·상태 식별자는 유지한다.
- 첫 10줄 안에 결론을 둔다.
  `pass/revise/blocked` 판정과 가장 중요한 권장 행동이 바로 보여야 한다.
- 내부 분석에는 근거 경로를 유지한다.
  posting, fit-analysis, application-package, ledger, riskFlag, 근거 파일 경로를 reviewer 판단 근거로 남긴다.
- 제출용 문장에 대한 지적은 제출용 문장 자체와 내부 근거를 분리해서 쓴다.
  제출용으로 옮길 수 있는 수정 문구에는 내부 파일 경로, plan 번호, commit hash, runner 상태를 넣지 않는다.
- 이력서 MVP 산출물 체인은 `Markdown 이력서 초안 -> design.md를 적용한 HTML 이력서 -> HTML을 PDF로 변환한 완성 PDF 이력서`로 검토한다.
  HTML 이력서는 model이 `design.md`를 적용했다는 전제를 확인하고, PDF는 사용자가 첨부할 수 있는 최종 산출물로 본다.
  PDF 생성은 제출 자동화가 아니며, 업로드·전송·제출 버튼 클릭 자동화는 이번 MVP 범위 밖이다.
- `needs_evidence`는 사용자에게 raw label로 남기지 않는다.
  발견 항목은 모두 `보강 필요 / 선택지 / 권장 행동` 구조로 바꾼다.
  이 구조는 사용자가 증거를 찾을지, 표현을 낮출지, 진행을 멈출지 바로 고를 수 있어야 한다.
- 실제 제출, 로그인, 채용 사이트 입력, 공개 발행, candidate-profile 수정은 하지 않는다.
  모두 `사용자 승인 필요` 항목으로만 안내한다.

## Inputs

Claude는 다음을 `Read` 도구로 직접 로드:

1. `career-os/data/applications/<company>/<role>/posting.md` — 공고 본문 (필수)
2. `career-os/data/applications/<company>/<role>/fit-analysis.md` — fit 분석 (필수)
3. `career-os/data/applications/<company>/<role>/application-package.md` — 내부 지원 전략 초안 (필수)
4. `career-os/data/applications/<company>/<role>/resume-draft.md` — 제출용 이력서 Markdown 초안 (필수)
5. `career-os/data/applications/<company>/<role>/cover-letter.md` — 제출용 지원동기 Markdown 초안 (필수)
6. `career-os/data/applications/<company>/<role>/submission-checklist.md` — 제출 전 확인 목록 (필수)
7. `career-os/config/candidate-profile.md` — 후보자 프로필 11섹션 (필수)
8. fit-analysis.md 및 application-package.md의 `## 근거 파일 참조` 에 명시된 근거 파일 — 선택적 Read
9. `career-os/data/applications/ledger.jsonl` — riskFlags / status / revisionCount 확인 (선택)

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
4. resume-draft.md
5. cover-letter.md
6. submission-checklist.md
7. `career-os/config/candidate-profile.md`
8. application-package.md의 `## 근거 파일 참조` 에서 관련성 높은 근거 파일 2~5개 선택적 Read
9. ledger.jsonl — riskFlags / revisionCount 확인

### 3. 6개 축 심사

다음 순서로 각 축을 분석한다.

#### 3-1. Evidence Guard (근거 없는 주장 여부)

application-package.md, resume-draft.md, cover-letter.md의 이력서 bullet, 지원동기, 직무별 강조 포인트를 검토:
- 내부적으로 `needs_evidence`에 해당하는 항목을 찾되, review.md에는 raw label이 아니라 `보강 필요 / 선택지 / 권장 행동`으로 작성
- 근거 파일 없이 수치·성과·기술 경험을 주장한 문장 식별
- 근거 파일이 실제 존재하는지 확인 (Read 결과 기반)

#### 3-2. Drift Review (공고 맞춤 중 경력 왜곡 여부)

application-package.md, resume-draft.md, cover-letter.md와 fit-analysis.md를 교차:
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
- 근거 보강 필요 항목의 실제 보강 여부 결정 (후보자 본인만 판단 가능)
- 쿨다운 리스크 수용 여부 (개인 전략 결정)
- 포지셔닝 전환 의사결정 (Java 백엔드 → Applied AI Engineer 등)

### 4. 최종 판정

6개 축 결과를 종합해 다음 중 하나로 판정:

- **`pass`**: 근거 있는 주장만 포함, drift·과장·공개 금지 없음, 리스크 플래그 없거나 사용자 확인 후 진행 가능
- **`revise`**: agent가 수정 가능한 구체 항목이 있음 (근거 보강 루프, 과장 표현 수정 등). 수정 후 재심사 필요
- **`blocked`**: 공고 만료 / 쿨다운 리스크 / fixture-only / 심각한 근거 부족으로 진행 불가. source 근거 명시 필수

판정 기준:
- riskFlags에 `mvp_fixture_only`가 있으면 `blocked` — 실제 제출 판정 불가
- riskFlags에 `toss_group_cooldown` 등 쿨다운이 있으면 사용자 확인 전 `blocked`
- 근거 보강 필요 항목이 필수 요건 1개 이상을 직접 충족해야 하는 경우 `revise` 이상
- 과장·허위 가능성 있는 항목이 1개 이상이면 최소 `revise`

### 5. review.md 작성 (Write)

저장 경로: `career-os/data/applications/<company>/<role>/review.md`

필수 구조:

```markdown
# <Company> <Role> — Application Review

## 결론

## Verdict

- result: pass|revise|blocked
- confidence: low|medium|high
- needsUserReview: true

## Evidence Guard

## Drift Review

## Exaggeration Check

## Privacy / Publication Boundary

## Resume Package Readiness

## Cooldown / Duplication Risk

## User Approval Gate

## Revision Requests

## Ledger Update Suggestion
```

작성 규칙:
- 첫 10줄 안에 판정과 가장 중요한 권장 행동을 쓴다.
- 각 축 섹션에 심사 결과 요약 + 구체 근거 문장 명시
- `revise`일 경우 `## Revision Requests`에 agent가 수정 가능한 구체 항목 3개 이상
  근거 부족 항목은 `보강 필요 / 선택지 / 권장 행동` 구조로 쓴다.
- `blocked`일 경우 `## Revision Requests`에 차단 근거 + source 경로(ledger/posting/riskFlag) 명시
- `pass`일 경우에도 `## User Approval Gate`에 사용자 승인 필요 항목 목록화
- 제출용 수정 문구에는 내부 파일 경로, plan 번호, commit hash, runner 상태를 넣지 않는다.
- 내부 reviewer 근거에는 source 경로를 유지한다.
- `## Resume Package Readiness`에는 `resume-draft.md`, `cover-letter.md`, `submission-checklist.md` 존재 여부와 제출용 문구 안전성을 함께 적는다.
- resume package 산출물이 함께 검토되면 Markdown 초안, design.md 적용 HTML, 첨부 가능한 PDF의 경계를 확인한다.
  PDF가 있어도 외부 제출·업로드·전송은 완료로 보지 않고, 자동화 대상으로도 다루지 않는다.
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
3. `## Resume Package Readiness` 섹션 존재
4. `## User Approval Gate` 섹션 존재
5. `revise`일 경우 `## Revision Requests`에 3개 이상 구체 항목 존재
6. `blocked`일 경우 `## Revision Requests`에 source 경로 포함 차단 근거 존재
7. `sources/fos-study/` 아래 어떤 파일도 쓰지 않았는지 확인
8. 제출·로그인·외부 계정 작업 실행 지시가 없음 확인
9. 첫 10줄 안에 판정과 권장 행동이 있음
10. raw `needs_evidence`가 사용자-facing 항목에 남아 있지 않고, 모두 `보강 필요 / 선택지 / 권장 행동`으로 바뀌어 있음
11. 제출용 수정 문구에는 내부 파일 경로, plan 번호, commit hash, runner 상태가 없음
12. 내부 reviewer 판단에는 posting/ledger/riskFlag/근거 파일 경로가 유지됨
13. candidate-profile 수정, 공개 발행, 외부 제출은 `사용자 승인 필요`로만 표현됨
14. resume package를 검토하면 Markdown 초안 -> design.md 적용 HTML -> 첨부 가능한 PDF 체인을 구분하고, PDF를 제출 자동화 완료로 판정하지 않음

실패 항목 있으면 수정 후 재작성. **최대 3회**. 4회째도 실패 시 `stderr: application-reviewer 검증 실패: <항목>` + exit 1.

## Error handling

| 상황 | 처리 |
|---|---|
| application dir 특정 불가 | stderr + exit 1 |
| posting.md / fit-analysis.md / application-package.md / resume-draft.md / cover-letter.md / submission-checklist.md 부재 | stderr + exit 1 |
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
