# plan058 샘플 감사

결론: 기존 생성 산출물은 대체로 안전 경계를 지켰지만, 첫 10줄 결론과 `needs_evidence` 해소 표현은 더 명확해야 한다.
실제 private 산출물은 수정하지 않았고, 아래 rewrite는 task-local outline으로만 남긴다.

## 감사 기준

- 첫 10줄 안에 결론, 판단, 권장 행동 중 하나가 있는가.
- 섹션 제목이 한국어 우선이고 자연스러운 한국어 문장으로 읽히는가.
- 내부 분석과 공개용 또는 제출용 문구가 분리되는가.
- raw `needs_evidence`가 사용자-facing 문구로 남지 않고 `보강 필요 / 선택지 / 권장 행동`으로 바뀌는가.
- private 지원 맥락, 후보자 세부 이력, 회사별 전략을 길게 인용하지 않는가.

## 샘플 1: live posting snapshot

대상: `data/runtime/live-position-postings.plan048-final.md`

선정 이유:

- tracked runtime exception이라 private 지원서 원문 노출 위험이 낮다.
- recommendation/posting 계열 artifact의 첫 화면 구조를 점검할 수 있다.
- 실제 공고 세부 본문은 공개 채용 정보 기반이지만, 이 audit에서는 긴 원문을 다시 인용하지 않는다.

감사 결과:

- 첫 10줄: 수집 기준과 제외 기준은 있으나, 사용자가 바로 볼 결론 또는 권장 행동은 약하다.
- 한국어: 제목과 diagnostic label이 영어-heavy다.
  `Collection Diagnostics`, `source_counts` 같은 label은 내부 로그로는 괜찮지만 사람용 report 첫 화면에는 딱딱하다.
- 내부 분석 분리: snapshot 목적상 내부 판단과 원문 공고 요약이 한 파일에 섞여 있다.
  추천 report로 승격할 때는 "사용자에게 보여줄 후보 요약"과 "collector 진단"을 분리해야 한다.
- `보강 필요 / 선택지 / 권장 행동`: close urgency나 source error는 다음 행동으로 변환되지 않는다.

기존 outline:

- `# Live Posting Snapshot`
- 수집 기준 설명
- `## Collection Diagnostics`
- source별 숫자와 오류
- 공고별 raw field 나열

개선 outline:

- `# 활성 공고 스냅샷`
- `오늘의 결론`: 직접 지원 가능한 공고 수, 마감 임박 수, 추천 입력으로 쓸 수 있는지.
- `권장 행동`: 마감 임박 공고 확인, source error 재수집 여부, 추천 runner 실행 여부.
- `사용자에게 보여줄 후보 요약`: 회사/역할/마감/핵심 요구사항만 짧게.
- `내부 수집 진단`: source별 수집량, skip 사유, 실패 URL.
- `보강 필요 / 선택지 / 권장 행동`: 상태 확인 실패나 역할 적합성 불확실성을 action 단위로 정리.

rewrite 샘플:

```markdown
# 활성 공고 스냅샷

오늘의 결론: 직접 지원 가능한 공고는 N개이고, 마감 임박 후보는 M개다.
추천 입력으로 사용할 수 있지만 source error가 있어 일부 공고는 재확인이 필요하다.

## 권장 행동

- 마감 임박 후보를 먼저 검토한다.
- source error가 있는 공고는 재수집하거나 추천 후보에서 보류한다.
- 사용자 승인 전에는 ledger 승격이나 지원 준비를 시작하지 않는다.

## 보강 필요 / 선택지 / 권장 행동

- 보강 필요: 특정 source detail page 확인 실패.
- 선택지: 재수집 후 포함, 또는 이번 추천에서 제외.
- 권장 행동: 추천 report 생성 전 source freshness를 다시 확인한다.
```

## 샘플 2: application package와 review audit summary

대상:

- `tasks/plan029-application-agent-mvp/audit/phase-04-application-package-writer-summary.md`
- `tasks/plan029-application-agent-mvp/audit/phase-05-application-reviewer-summary.md`

선정 이유:

- 실제 `data/applications/` private output 대신 tracked audit summary만 확인한다.
- fit/application/review artifact의 구조 문제를 private 내용 없이 점검할 수 있다.
- plan055 이후 추가된 resume artifact chain까지 같은 rewrite outline에 반영할 수 있다.

감사 결과:

- 첫 10줄: 실행 일시와 파일 목록이 먼저 나오며, 결론과 권장 행동은 뒤에 있다.
- 한국어: `dry-run`, `line count`, `Verdict`, `riskFlag` 같은 label이 많다.
  내부 감사 노트로는 허용되지만 사용자가 읽는 review report라면 한국어 제목이 우선이어야 한다.
- 내부 분석 분리: private output 경로와 검증 결과가 같은 흐름에 있다.
  제출용 문구 후보, 내부 리스크, 사용자 승인 gate를 더 분리해야 한다.
- `needs_evidence`: 예전 summary는 raw marker 존재를 PASS로 취급한다.
  새 기준에서는 raw marker 존재 자체가 통과가 아니라 resolution loop 작성 여부가 통과 조건이다.
- resume chain: `resume-draft.md`, `resume.html`, `resume.pdf`는 외부 제출 자동화가 아니라 검토 가능한 완성 산출물이어야 한다.
  업로드, 전송, 제출은 사용자 승인 전 금지다.

기존 outline:

- Phase audit title
- 실행 일시
- 생성/수정 파일 목록
- private output path
- line count
- `needs_evidence` 존재 여부
- sources/fos-study 미변경 확인

개선 outline:

- `# 지원 패키지 리뷰 요약`
- `결론`: pass/revise/blocked와 가장 중요한 이유.
- `권장 행동`: 오늘 사용자가 결정해야 할 일과 agent-only 후속 작업 분리.
- `내부 분석`: fit gap, risk flag, 근거 경로, reviewer 판단.
- `제출용 문구 후보`: 근거가 확인된 문장만 별도 섹션에 둔다.
- `이력서 산출물`: Markdown 초안, HTML, PDF 상태를 분리하되 제출 자동화는 하지 않는다.
- `보강 필요 / 선택지 / 권장 행동`: raw marker 대신 모든 근거 부족 항목을 action loop로 쓴다.
- `사용자 승인 필요`: 공개 발행, 외부 제출, candidate-profile 수정, ledger 최종 전환.

rewrite 샘플:

```markdown
# 지원 패키지 리뷰 요약

결론: 현재 상태는 blocked다.
근거가 부족한 필수 요건이 있어 제출용 문구와 이력서 PDF를 ready로 볼 수 없다.

## 권장 행동

- 사용자: 보강 필요 항목 중 실제 근거가 있는지 확인한다.
- 에이전트: 확인된 근거만 `resume-draft.md`와 `cover-letter.md`에 반영한다.
- 보류: 외부 제출, 공개 발행, candidate-profile 수정은 사용자 승인 전 실행하지 않는다.

## 보강 필요 / 선택지 / 권장 행동

- 보강 필요: 필수 요건과 직접 연결되는 운영 경험 근거가 약함.
- 선택지: 관련 task 근거를 추가하거나 제출용 문장에서 강도를 낮춘다.
- 권장 행동: 근거 확인 전에는 이 항목을 이력서 bullet에서 제외한다.
```

## privacy 메모

이 파일은 private 원문을 길게 인용하지 않는다.
회사별 지원 전략, 후보자 세부 이력, 실제 제출 문구는 task-local sample에 포함하지 않았다.
`data/applications/`와 `sources/fos-study/` 파일은 수정하지 않았다.
