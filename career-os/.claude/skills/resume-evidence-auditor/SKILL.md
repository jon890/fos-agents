---
name: resume-evidence-auditor
description: 이력서·경력기술서·포트폴리오의 주장을 실제 코드, 테스트, Git 이력, 문서와 사용자 확인에 대조해 과장과 소유권 확대를 차단하는 career-os 내부 스킬. "이력서 근거 검증", "경력기술서 사실 확인", "코드와 경력 대조", "resume evidence audit"처럼 제출 문구의 사실 검증이 필요할 때 사용한다.
---

# 이력서 근거 감사

제출할 문장마다 구현, 소유권, 결과의 근거 수준을 기록한다.
이 스킬이 이력서 사실성 판정의 단일 책임자다.

## 입력

- 감사할 최종 이력서 파일
- `config/candidate-profile.md`
- 프로필에서 연결한 최신 경력 자료와 업무 근거
- 같은 지원 디렉터리의 공고와 지원 자료
- 프로필에 직접 연결된 `sources/fos-study/` 근거
- 관련 코드, 테스트와 Git 이력

감사 대상은 제출할 정확한 파일이어야 한다.
기존 이력서와 업무 문서는 근거 후보이며 진실의 최종 출처가 아니다.

## 실행

1. `references/claim-model.md`를 읽는다.
2. 제출 문구를 독립적인 사실 주장으로 분해한다.
   기간이 붙은 기술은 기술별로 나누고, 여러 기술을 하나의 경력 기간으로 묶지 않는다.
3. 각 주장에 연결되는 코드, 테스트, Git, 실행 결과와 문서를 직접 확인한다.
4. 구현, 소유권, 결과와 경험 깊이를 서로 독립적으로 판정한다.
5. 코드 사용 이력을 숙련도나 운영 노하우로 확대하지 않는다.
6. 후보자만 확인할 수 있는 경험 깊이가 결론을 바꾸면 `ask_user`로 남기고 한 번에 한 질문만 확인한다.
7. 근거보다 강한 문장은 약화하거나 삭제한다.
8. 이력서는 `claim-ledger.json`과 `evidence-audit.md`, 경력기술서는 `career-description-claim-ledger.json`과 `career-description-evidence-audit.md`를 같은 디렉터리에 만든다.
9. 다음 명령으로 원장과 제출 파일의 일치 여부를 검증한다.

```bash
bun career-os/.claude/skills/resume-evidence-auditor/scripts/validate_claim_ledger.ts \
  <claim-ledger.json> --artifact <submission-document.html>
```

원장에는 다음 식별 정보를 반드시 기록한다.

- `schemaVersion: 2`
- 감사 대상의 상대 경로인 `artifact`
- `artifact_identity.ts`가 계산한 `artifactTextSha256`
- ISO 8601 형식의 `generatedAt`

## 판정

- `safe`: 제출 문구가 확인된 근거 수준을 넘지 않는다.
- `revise`: 문구 약화 또는 사용자 확인이 필요하다.
- `blocked`: 모순이나 근거 없는 핵심 경력이 남아 있다.

코드가 존재해도 후보자가 직접 설계하거나 구현했다는 뜻은 아니다.
Git 작성 이력도 운영 성과나 단독 소유권을 자동으로 증명하지 않는다.
기능 커밋이 많아도 해당 언어의 장애 대응, 성능 분석과 운영 노하우를 자동으로 증명하지 않는다.
수치, 기간, 강한 소유권과 인과 표현에는 직접 근거가 필요하다.

다음 표현은 경험 깊이를 별도로 확인한다.

- `주력`, `숙련`, `전문`, `깊이 있게`: 반복적인 기술 판단과 후보자 확인이 필요하다.
- `운영`, `트러블슈팅`, `노하우`: 장애, 배포, 관측, 성능 또는 운영 결정 근거가 필요하다.
- `N년 동안 A와 B`: A와 B의 기간을 각각 확인한다. 하나라도 불명확하면 문장을 나누거나 `ask_user`로 판정한다.

저장소에서 확인할 수 있는 것이 코드 사용과 기능 개발뿐이라면 `사용 경험` 또는 특정 프로젝트의 기여로만 표현한다.
사용자가 핵심 역량이 아니라고 확인한 기술은 커밋 수와 관계없이 주력 기술과 첫 소개에서 제외한다.

## 산출물

`claim-ledger.json`은 기계 검증에 사용하는 기준 데이터다.
`evidence-audit.md`는 사람이 읽는 결론, 중요 발견, 주장별 판정, 수정 문구와 사용자 확인 항목을 담는다.

`soften`, `ask_user`, `remove`가 하나라도 남은 원장은 제출 준비가 끝난 상태가 아니다.
사용자 확인 전에는 `resume-evaluator`로 넘기거나 `safe`로 바꾸지 않는다.

내부 경로, 커밋 해시와 사내 식별자는 제출 파일에 쓰지 않는다.
근거 저장소는 읽기 전용으로 다룬다.
실제 제출, 업로드와 외부 공개는 하지 않는다.

## 다른 스킬과의 경계

- `application-reviewer`는 Markdown 지원 패키지의 정합성을 검토한다.
- `resume-evaluator`는 검증된 이력서의 설득력, 구조와 렌더링을 개선한다.
- 제출 문구가 바뀌면 이 스킬로 다시 감사한다.

## 참고 자료

- `references/claim-model.md`
- `scripts/claim_ledger_schema.ts`
- `scripts/artifact_identity.ts`
